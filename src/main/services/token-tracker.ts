/**
 * AI 토큰 사용량 추적기.
 * 매 API 호출의 토큰 소비를 기록하고,
 * 일별/월별/모델별 요약과 예상 비용을 제공한다.
 * 90일 이전 기록은 자동 프루닝한다.
 */
import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import type { TokenUsageRecord, TokenUsageRaw, TokenUsageSummary } from '../../shared/types';

const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o':           { input: 0.0025,  output: 0.01 },
  'gpt-4o-mini':      { input: 0.00015, output: 0.0006 },
  'gemini-2.0-flash': { input: 0.0001,  output: 0.0004 },
  'gemini-2.0-pro':   { input: 0.00125, output: 0.005 },
};

const FLUSH_THRESHOLD = 10;
const PRUNE_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  private flushInProgress = false;

  constructor() {
    const userDataPath = app?.getPath?.('userData') ?? '/tmp/taeinn-agent';
    this.storagePath = path.join(userDataPath, 'token-usage.json');
    this.limitPath = path.join(userDataPath, 'token-limits.json');
    this.loadFromDiskSync();
    this.loadLimitsSync();
    this.pruneOldRecords();
  }

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

  setLimits(limits: Partial<LimitConfig>): void {
    if (limits.monthlyTokenLimit !== undefined) {
      this.limits.monthlyTokenLimit = limits.monthlyTokenLimit;
    }
    if (limits.monthlyCostLimit !== undefined) {
      this.limits.monthlyCostLimit = limits.monthlyCostLimit;
    }
    void this.saveLimitsAsync();
  }

  getLimits(): LimitConfig {
    return { ...this.limits };
  }

  getHistory(days: number): TokenUsageRecord[] {
    const since = Date.now() - days * MS_PER_DAY;
    return this.records.filter((r) => r.timestamp >= since);
  }

  async flush(): Promise<void> {
    if (this.flushInProgress) return;
    this.flushInProgress = true;
    this.pendingCount = 0;
    try {
      const dir = path.dirname(this.storagePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.storagePath, JSON.stringify(this.records));
    } catch {
      // 저장 실패 시 다음 flush에서 재시도
    } finally {
      this.flushInProgress = false;
    }
  }

  /** 90일 이전 기록 제거 */
  private pruneOldRecords(): void {
    const cutoff = Date.now() - PRUNE_DAYS * MS_PER_DAY;
    const before = this.records.length;
    this.records = this.records.filter((r) => r.timestamp >= cutoff);
    if (this.records.length < before) {
      void this.flush();
    }
  }

  private loadFromDiskSync(): void {
    try {
      if (!fsSync.existsSync(this.storagePath)) return;
      const data = fsSync.readFileSync(this.storagePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.records = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.records = [];
    }
  }

  private loadLimitsSync(): void {
    try {
      if (!fsSync.existsSync(this.limitPath)) return;
      const data = fsSync.readFileSync(this.limitPath, 'utf-8');
      const parsed = JSON.parse(data) as Partial<LimitConfig>;
      if (parsed.monthlyTokenLimit !== undefined) this.limits.monthlyTokenLimit = parsed.monthlyTokenLimit;
      if (parsed.monthlyCostLimit !== undefined) this.limits.monthlyCostLimit = parsed.monthlyCostLimit;
    } catch {
      // 기본값 유지
    }
  }

  private async saveLimitsAsync(): Promise<void> {
    try {
      const dir = path.dirname(this.limitPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.limitPath, JSON.stringify(this.limits));
    } catch {
      // 저장 실패 시 무시
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
