/**
 * 시스템 모니터링 패널.
 * Electron 프로세스의 메모리(RSS/Heap), CPU 누적 시간, 업타임을 표시한다.
 * 메모리 히스토리를 미니 그래프로 그려 누수 추세를 시각화한다.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useAgentStore } from '../../stores/agent-store';
import type { SystemStats } from '../../../shared/types';

const MAX_HISTORY = 30;
const POLL_INTERVAL = 3_000;

function formatMB(n: number): string {
  return `${n.toFixed(1)} MB`;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}시간 ${m}분`;
}

function MiniGraph({ data, max, color, warningThreshold }: {
  data: number[];
  max: number;
  color: string;
  warningThreshold?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    if (warningThreshold) {
      const wy = h - (warningThreshold / max) * h;
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, wy);
      ctx.lineTo(w, wy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const step = w / (MAX_HISTORY - 1);
    const startIdx = MAX_HISTORY - data.length;

    ctx.beginPath();
    ctx.moveTo(startIdx * step, h);
    data.forEach((val, i) => {
      const x = (startIdx + i) * step;
      const y = h - (val / max) * h;
      ctx.lineTo(x, y);
    });
    ctx.lineTo((startIdx + data.length - 1) * step, h);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, color + '40');
    gradient.addColorStop(1, color + '05');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    data.forEach((val, i) => {
      const x = (startIdx + i) * step;
      const y = h - (val / max) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [data, max, color, warningThreshold]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '60px', borderRadius: '8px' }}
    />
  );
}

function GaugeBar({ value, max, color, label }: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const isWarning = pct > 80;

  return (
    <div style={{ marginBottom: '6px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
          {label}
        </span>
        <span style={{
          fontSize: '11px',
          color: isWarning ? '#f87171' : 'rgba(255,255,255,0.7)',
          fontWeight: 600,
        }}>
          {formatMB(value)} <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>/ {formatMB(max)}</span>
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '6px',
        borderRadius: '3px',
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: '3px',
          background: isWarning
            ? 'linear-gradient(90deg, #f87171, #ef4444)'
            : `linear-gradient(90deg, ${color}80, ${color})`,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

function StatItem({ icon, label, value, sub }: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{value}</div>
      </div>
      {sub && (
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{sub}</span>
      )}
    </div>
  );
}

export function SystemMonitorPanel() {
  const setActivePanel = useAgentStore((s) => s.setActivePanel);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [rssHistory, setRssHistory] = useState<number[]>([]);
  const [heapHistory, setHeapHistory] = useState<number[]>([]);
  const [isLeakSuspected, setIsLeakSuspected] = useState(false);

  const poll = useCallback(async () => {
    try {
      const data = await window.electronAPI.invoke('system:stats') as SystemStats;
      setStats(data);
      setRssHistory((prev) => [...prev, data.memory.rss].slice(-MAX_HISTORY));
      setHeapHistory((prev) => [...prev, data.memory.heapUsed].slice(-MAX_HISTORY));
    } catch {
      // 조회 실패 시 무시
    }
  }, []);

  useEffect(() => {
    void poll();
    const timer = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    if (rssHistory.length < 10) return;
    const recent = rssHistory.slice(-10);
    const increasing = recent.every((v, i) => i === 0 || v >= recent[i - 1] - 0.5);
    const growth = recent[recent.length - 1] - recent[0];
    setIsLeakSuspected(increasing && growth > 10);
  }, [rssHistory]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '16px',
      gap: '10px',
      overflowY: 'auto',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            시스템 모니터
          </span>
        </div>
        <button
          onClick={() => setActivePanel('none')}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
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

      {!stats ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '12px',
        }}>
          로딩 중...
        </div>
      ) : (
        <>
          {/* 메모리 누수 경고 */}
          {isLeakSuspected && (
            <div style={{
              padding: '8px 12px',
              borderRadius: '10px',
              background: 'rgba(248, 113, 113, 0.12)',
              border: '1px solid rgba(248, 113, 113, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ fontSize: '14px' }}>⚠️</span>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#f87171' }}>
                  메모리 누수 의심
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(248,113,113,0.7)', marginTop: '2px' }}>
                  RSS 메모리가 지속적으로 증가하고 있어요
                </div>
              </div>
            </div>
          )}

          {/* 메모리 게이지 */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '14px',
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase' as const,
              letterSpacing: '1px',
              marginBottom: '10px',
            }}>
              메모리
            </div>
            <GaugeBar value={stats.memory.rss} max={stats.limitMB} color="#4ade80" label="RSS (총 사용량)" />
            <GaugeBar value={stats.memory.heapUsed} max={stats.memory.heapTotal} color="#60a5fa" label="Heap (JS 힙)" />
            <GaugeBar value={stats.memory.external} max={Math.max(stats.memory.external * 2, 50)} color="#a78bfa" label="External (C++ 바인딩)" />
          </div>

          {/* 메모리 추이 그래프 */}
          {rssHistory.length >= 2 && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '1px',
                }}>
                  메모리 추이
                </span>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>
                  {POLL_INTERVAL / 1000}초 간격 · 최근 {MAX_HISTORY}회
                </span>
              </div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '9px', color: '#4ade80', fontWeight: 500 }}>● RSS</span>
                <span style={{ fontSize: '9px', color: '#60a5fa', fontWeight: 500 }}>● Heap</span>
              </div>
              <MiniGraph
                data={rssHistory}
                max={stats.limitMB}
                color="#4ade80"
                warningThreshold={stats.limitMB * 0.8}
              />
              <div style={{ marginTop: '4px' }}>
                <MiniGraph
                  data={heapHistory}
                  max={stats.memory.heapTotal * 1.2}
                  color="#60a5fa"
                />
              </div>
            </div>
          )}

          {/* 상세 정보 */}
          <div style={{
            padding: '8px 14px',
            borderRadius: '14px',
            background: 'rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}>
            <StatItem
              icon="⏱"
              label="업타임"
              value={formatUptime(stats.uptime)}
            />
            <StatItem
              icon="⚡"
              label="CPU (누적)"
              value={`User ${(stats.cpu.user / 1000).toFixed(1)}s`}
              sub={`Sys ${(stats.cpu.system / 1000).toFixed(1)}s`}
            />
            <StatItem
              icon="📊"
              label="메모리 제한"
              value={formatMB(stats.limitMB)}
              sub={`${Math.round((stats.memory.rss / stats.limitMB) * 100)}% 사용`}
            />
          </div>
        </>
      )}
    </div>
  );
}
