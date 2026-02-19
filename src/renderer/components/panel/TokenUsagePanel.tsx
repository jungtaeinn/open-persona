/**
 * 토큰 사용량 패널.
 * 오늘/이번달 토큰 소비 현황과 모델별 비용을 글래스모피즘 UI로 표시한다.
 * 월간 비용 한도 대비 사용량 게이지를 포함한다.
 */
import { useEffect, useState, useCallback } from 'react';
import { useAgentStore } from '../../stores/agent-store';
import type { TokenUsageSummary } from '../../../shared/types';

const MODEL_LABELS: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-pro': 'Gemini 2.0 Pro',
};

const MODEL_COLORS: Record<string, string> = {
  'gpt-4o': '#10b981',
  'gpt-4o-mini': '#34d399',
  'gemini-2.0-flash': '#60a5fa',
  'gemini-2.0-pro': '#818cf8',
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function StatCard({ label, tokens, cost, color }: { label: string; tokens: number; cost: number; color: string }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '14px',
      background: 'rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      flex: 1,
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        color: 'rgba(255, 255, 255, 0.5)',
        textTransform: 'uppercase' as const,
        letterSpacing: '1px',
        marginBottom: '8px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '22px',
        fontWeight: 700,
        color,
        lineHeight: 1.2,
      }}>
        {formatTokens(tokens)}
      </div>
      <div style={{
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.45)',
        marginTop: '2px',
      }}>
        {formatCost(cost)}
      </div>
    </div>
  );
}

function BudgetGauge({ used, limit, label, color, formatFn }: {
  used: number;
  limit: number;
  label: string;
  color: string;
  formatFn: (n: number) => string;
}) {
  if (limit <= 0) return null;
  const pct = Math.min((used / limit) * 100, 100);
  const remaining = Math.max(limit - used, 0);
  const isWarning = pct > 80;
  const isDanger = pct > 95;
  const barColor = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : color;

  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '6px',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
          {label}
        </span>
        <span style={{ fontSize: '11px', color: isDanger ? '#ef4444' : 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
          {formatFn(used)} <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>/ {formatFn(limit)}</span>
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '8px',
        borderRadius: '4px',
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: '4px',
          background: `linear-gradient(90deg, ${barColor}90, ${barColor})`,
          transition: 'width 0.6s ease',
          boxShadow: `0 0 8px ${barColor}40`,
        }} />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '4px',
      }}>
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
          {pct.toFixed(1)}% 사용
        </span>
        <span style={{
          fontSize: '10px',
          color: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : 'rgba(255,255,255,0.35)',
          fontWeight: isDanger ? 600 : 400,
        }}>
          잔여 {formatFn(remaining)}
        </span>
      </div>
    </div>
  );
}

function ModelRow({ model, tokens, cost }: { model: string; tokens: number; cost: number }) {
  const label = MODEL_LABELS[model] ?? model;
  const color = MODEL_COLORS[model] ?? '#a78bfa';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
          {formatTokens(tokens)}
        </span>
        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', minWidth: '50px', textAlign: 'right' }}>
          {formatCost(cost)}
        </span>
      </div>
    </div>
  );
}

export function TokenUsagePanel() {
  const setActivePanel = useAgentStore((s) => s.setActivePanel);
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await window.electronAPI.invoke('token:summary') as TokenUsageSummary;
        setSummary(data);
      } catch {
        // 조회 실패 시 빈 상태 유지
      } finally {
        setIsLoading(false);
      }
    }
    void load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveLimit = useCallback(async () => {
    const val = parseFloat(limitInput);
    if (isNaN(val) || val < 0) return;
    try {
      await window.electronAPI.invoke('token:set-limit', { monthlyCostLimit: val });
      const data = await window.electronAPI.invoke('token:summary') as TokenUsageSummary;
      setSummary(data);
    } catch { /* ignore */ }
    setIsEditingLimit(false);
  }, [limitInput]);

  const models = summary ? Object.entries(summary.byModel) : [];
  const hasData = summary && (summary.today.totalTokens > 0 || summary.thisMonth.totalTokens > 0);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '16px',
      gap: '12px',
      overflowY: 'auto',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(250,204,21,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.9)',
          }}>
            토큰 사용량
          </span>
        </div>
        <button
          onClick={() => setActivePanel('none')}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: 'pointer',
            fontSize: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.5)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
          }}
        >
          ✕
        </button>
      </div>

      {isLoading ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '12px',
        }}>
          로딩 중...
        </div>
      ) : !hasData ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: '12px' }}>
            아직 사용 기록이 없어요
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.2)', fontSize: '11px' }}>
            캐릭터에게 말을 걸어보세요!
          </span>
        </div>
      ) : (
        <>
          {/* 월간 예산 게이지 */}
          {summary!.monthlyCostLimit > 0 && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' as const, letterSpacing: '1px' }}>
                  월간 예산
                </span>
                <button
                  onClick={() => {
                    setLimitInput(String(summary!.monthlyCostLimit));
                    setIsEditingLimit(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'none'; }}
                >
                  수정
                </button>
              </div>
              <BudgetGauge
                used={summary!.thisMonth.estimatedCost}
                limit={summary!.monthlyCostLimit}
                label="비용"
                color="#60a5fa"
                formatFn={formatCost}
              />
              {summary!.monthlyTokenLimit > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <BudgetGauge
                    used={summary!.thisMonth.totalTokens}
                    limit={summary!.monthlyTokenLimit}
                    label="토큰"
                    color="#a78bfa"
                    formatFn={formatTokens}
                  />
                </div>
              )}
            </div>
          )}

          {/* 한도 편집 모달 */}
          {isEditingLimit && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px', fontWeight: 600 }}>
                월간 비용 한도 (USD)
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>$</span>
                <input
                  type="number"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveLimit(); if (e.key === 'Escape') setIsEditingLimit(false); }}
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '13px',
                    padding: '6px 10px',
                    outline: 'none',
                  }}
                  step="0.5"
                  min="0"
                />
                <button
                  onClick={() => void handleSaveLimit()}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.7)',
                    border: 'none',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  저장
                </button>
                <button
                  onClick={() => setIsEditingLimit(false)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>
                0으로 설정하면 한도 없음
              </div>
            </div>
          )}

          {/* 한도 미설정 시 설정 유도 */}
          {summary!.monthlyCostLimit <= 0 && !isEditingLimit && (
            <button
              onClick={() => {
                setLimitInput('10');
                setIsEditingLimit(true);
              }}
              style={{
                padding: '10px 14px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px dashed rgba(255, 255, 255, 0.12)',
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                fontSize: '11px',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
            >
              + 월간 예산 한도 설정하기
            </button>
          )}

          {/* 오늘 / 이번달 카드 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <StatCard
              label="오늘"
              tokens={summary!.today.totalTokens}
              cost={summary!.today.estimatedCost}
              color="#facc15"
            />
            <StatCard
              label="이번 달"
              tokens={summary!.thisMonth.totalTokens}
              cost={summary!.thisMonth.estimatedCost}
              color="#60a5fa"
            />
          </div>

          {/* 모델별 사용량 */}
          {models.length > 0 && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.4)',
                textTransform: 'uppercase' as const,
                letterSpacing: '1px',
                marginBottom: '8px',
              }}>
                모델별 사용량
              </div>
              {models.map(([model, data]) => (
                <ModelRow
                  key={model}
                  model={model}
                  tokens={data.totalTokens}
                  cost={data.estimatedCost}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
