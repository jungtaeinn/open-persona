/**
 * AI 토큰 사용량 추적기.
 * 매 API 호출의 토큰 소비를 기록하고,
 * 일별/월별/모델별 요약과 예상 비용을 제공한다.
 */
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import type { TokenUsageRecord, TokenUsageRaw, TokenUsageSummary } from '../../shared/types';

/** 모델별 토큰 1K당 비용 (USD) */
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':           { input: 0.0025,  output: 0.01 },
  'gpt-4o-mini':      { input: 0.00015, output: 0.0006 },
  'gemini-2.0-flash': { input: 0.0001,  output: 0.0004 },
  'gemini-2.0-pro':   { input: 0.00125, output: 0.005 },
};

const FLUSH_THRESHOLD = 10;

interface LimitConfig {
  monthlyTokenLimit: number;
  monthlyCostLimit: number;
}

export class TokenTracker {
  private records: TokenUsageRecord[] = [];
  private pendingCount = 0;
  private storagePath: string;
  private limitPath: string;
  private limits: LimitConfig = { monthlyTokenLimit: 0, monthlyCostLimit: 10 };

  constructor() {
    const userDataPath = app?.getPath?.('userData') ?? '/tmp/taeinn-agent';
    this.storagePath = path.join(userDataPath, 'token-usage.json');
    this.limitPath = path.join(userDataPath, 'token-limits.json');
    this.loadFromDisk();
    this.loadLimits();
  }

  /**
   * 토큰 사용량을 기록한다.
   * @param provider - 프로바이더명
   * @param model - 모델 ID
   * @param usage - API 응답에서 추출한 토큰 수
   */
  record(provider: string, model: string, usage: TokenUsageRaw): void {
    const record: TokenUsageRecord = {
      timestamp: Date.now(),
      provider,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.inputTokens + usage.outputTokens,
      estimatedCost: this.calculateCost(model, usage),
    };

    this.records.push(record);
    this.pendingCount++;

    if (this.pendingCount >= FLUSH_THRESHOLD) {
      void this.flush();
    }
  }

  /** 오늘/이번달/모델별 요약을 반환한다 */
  getSummary(): TokenUsageSummary {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const todayRecords = this.records.filter((r) => r.timestamp >= todayStart);
    const monthRecords = this.records.filter((r) => r.timestamp >= monthStart);

    const byModel: TokenUsageSummary['byModel'] = {};
    for (const r of monthRecords) {
      if (!byModel[r.model]) {
        byModel[r.model] = { totalTokens: 0, estimatedCost: 0 };
      }
      byModel[r.model].totalTokens += r.totalTokens;
      byModel[r.model].estimatedCost += r.estimatedCost;
    }

    return {
      today: this.aggregate(todayRecords),
      thisMonth: this.aggregate(monthRecords),
      byModel,
      monthlyTokenLimit: this.limits.monthlyTokenLimit,
      monthlyCostLimit: this.limits.monthlyCostLimit,
    };
  }

  /** 월간 한도를 설정한다 */
  setLimits(limits: Partial<LimitConfig>): void {
    if (limits.monthlyTokenLimit !== undefined) {
      this.limits.monthlyTokenLimit = limits.monthlyTokenLimit;
    }
    if (limits.monthlyCostLimit !== undefined) {
      this.limits.monthlyCostLimit = limits.monthlyCostLimit;
    }
    this.saveLimits();
  }

  getLimits(): LimitConfig {
    return { ...this.limits };
  }

  /**
   * 최근 N일간 기록을 반환한다.
   * @param days - 조회할 일수
   */
  getHistory(days: number): TokenUsageRecord[] {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    return this.records.filter((r) => r.timestamp >= since);
  }

  /** 디스크에 저장한다 */
  async flush(): Promise<void> {
    this.pendingCount = 0;
    try {
      const dir = path.dirname(this.storagePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.storagePath, JSON.stringify(this.records, null, 2));
    } catch {
      // 저장 실패 시 다음 flush 에서 재시도
    }
  }

  private loadLimits(): void {
    try {
      if (!fs.existsSync(this.limitPath)) return;
      const data = fs.readFileSync(this.limitPath, 'utf-8');
      const parsed = JSON.parse(data) as Partial<LimitConfig>;
      if (parsed.monthlyTokenLimit !== undefined) this.limits.monthlyTokenLimit = parsed.monthlyTokenLimit;
      if (parsed.monthlyCostLimit !== undefined) this.limits.monthlyCostLimit = parsed.monthlyCostLimit;
    } catch {
      // 기본값 유지
    }
  }

  private saveLimits(): void {
    try {
      const dir = path.dirname(this.limitPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.limitPath, JSON.stringify(this.limits, null, 2));
    } catch {
      // 저장 실패 시 무시
    }
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(this.storagePath)) return;
      const data = fs.readFileSync(this.storagePath, 'utf-8');
      this.records = JSON.parse(data);
    } catch {
      this.records = [];
    }
  }

  private calculateCost(model: string, usage: TokenUsageRaw): number {
    const rate = PRICING[model] ?? { input: 0, output: 0 };
    return (
      (usage.inputTokens / 1000) * rate.input +
      (usage.outputTokens / 1000) * rate.output
    );
  }

  private aggregate(records: TokenUsageRecord[]) {
    return records.reduce(
      (acc, r) => ({
        totalTokens: acc.totalTokens + r.totalTokens,
        estimatedCost: acc.estimatedCost + r.estimatedCost,
      }),
      { totalTokens: 0, estimatedCost: 0 },
    );
  }
}
