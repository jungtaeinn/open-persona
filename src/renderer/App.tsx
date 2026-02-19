/**
 * 루트 앱 컴포넌트.
 * 캐릭터가 말풍선으로 답변 + 하단에 입력바.
 */
import { Suspense, Component, type ReactNode, useMemo, useState, useCallback } from 'react';
import { CharacterScene } from './components/scene/CharacterScene';
import { BubbleChat, groupIntoPairs } from './components/chat/BubbleChat';
import { TokenUsagePanel } from './components/panel/TokenUsagePanel';
import { SystemMonitorPanel } from './components/panel/SystemMonitorPanel';
import { useAgentInit } from './hooks/use-agent';
import { useAgentStore, selectMessages } from './stores/agent-store';
import { getPersona } from '../shared/character-personas';
import type { AgentState } from '../shared/types';

const GLOBAL_STYLE = document.createElement('style');
GLOBAL_STYLE.textContent = `
  @keyframes speechBubblePop {
    0% { opacity: 0; transform: scale(0.5) translateY(10px); }
    14% { opacity: 1; transform: scale(1.1) translateY(-3px); }
    24% { transform: scale(0.97) translateY(1px); }
    32% { transform: scale(1) translateY(0); }
    78% { opacity: 1; transform: scale(1) translateY(0); }
    100% { opacity: 0; transform: scale(0.9) translateY(-12px); }
  }
  @keyframes answerSlideUp {
    0% { opacity: 0; transform: translateY(14px) scale(0.96); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes dotBounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }
  .answer-bubble-area:hover .answer-copy-btn {
    opacity: 1;
  }
  .answer-copy-btn {
    opacity: 0;
    transition: opacity 0.15s ease;
  }
`;
if (!document.head.querySelector('[data-global-style]')) {
  GLOBAL_STYLE.setAttribute('data-global-style', '');
  document.head.appendChild(GLOBAL_STYLE);
}

const STATUS_LABELS: Record<AgentState, string> = {
  idle: '업무 중',
  listening: '듣는 중...',
  thinking: '생각 중...',
  acting: '작업 중',
  responding: '답변 중',
  done: 'Done',
};

const STATUS_COLORS: Record<AgentState, string> = {
  idle: '#4ade80',
  listening: '#4ade80',
  thinking: '#facc15',
  acting: '#f87171',
  responding: '#60a5fa',
  done: '#34d399',
};

class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  state = { hasError: false, error: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }}>
          <p style={{ color: '#f87171', fontSize: '12px', textAlign: 'center' }}>
            Error: {this.state.error}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

function ActiveCharacterInfo() {
  const activeCharacter = useAgentStore((s) => s.activeCharacter);
  const agentState = useAgentStore((s) => s.state);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '3px', pointerEvents: 'none',
    }}>
      <span style={{
        color: 'rgba(255, 255, 255, 0.85)', fontSize: '13px',
        fontWeight: 600, letterSpacing: '0.5px',
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }}>
        {activeCharacter.name}
      </span>
      <span style={{
        color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px', fontWeight: 500,
      }}>
        {activeCharacter.role}
      </span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '2px 10px', borderRadius: '10px',
        background: 'rgba(0, 0, 0, 0.35)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: STATUS_COLORS[agentState],
          boxShadow: `0 0 6px ${STATUS_COLORS[agentState]}`,
        }} />
        <span style={{
          color: 'rgba(255, 255, 255, 0.7)', fontSize: '10px', fontWeight: 500,
        }}>
          {STATUS_LABELS[agentState]}
        </span>
      </div>
    </div>
  );
}

function CopyToastOverlay() {
  const copyToastMessage = useAgentStore((s) => s.copyToastMessage);
  const activeCharacter = useAgentStore((s) => s.activeCharacter);
  const characters = useAgentStore((s) => s.characters);

  const charIndex = useMemo(
    () => characters.findIndex((c) => c.id === activeCharacter.id),
    [characters, activeCharacter.id],
  );

  if (!copyToastMessage) return null;

  const color = activeCharacter.color;

  type ToastPos = {
    bottom: string;
    left?: string;
    right?: string;
    tailAlign: 'left' | 'right';
    borderRadius: string;
  };

  const positionMap: Record<number, ToastPos> = {
    0: { left: '8%',  bottom: '200px', tailAlign: 'left',  borderRadius: '16px 16px 6px 16px' },
    1: { right: '28%', bottom: '220px', tailAlign: 'left',  borderRadius: '16px 16px 16px 6px' },
    2: { right: '8%',  bottom: '190px', tailAlign: 'right', borderRadius: '16px 16px 6px 16px' },
  };
  const pos = positionMap[charIndex] ?? positionMap[1];

  const outerPos: React.CSSProperties = {
    position: 'absolute',
    bottom: pos.bottom,
    zIndex: 999,
    pointerEvents: 'none',
    animation: 'speechBubblePop 2.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
  };
  if (pos.left) outerPos.left = pos.left;
  if (pos.right) outerPos.right = pos.right;

  return (
    <div key={copyToastMessage} style={outerPos}>
      <div style={{
        position: 'relative',
        padding: '8px 16px',
        borderRadius: pos.borderRadius,
        background: `linear-gradient(135deg, ${color}cc, ${color}99)`,
        border: `1.5px solid ${color}`,
        boxShadow: `0 4px 20px ${color}40, 0 0 40px ${color}15`,
        whiteSpace: 'nowrap',
      }}>
        <span style={{
          fontSize: '13px', fontWeight: 700, color: 'white',
          textShadow: '0 1px 3px rgba(0,0,0,0.3)', letterSpacing: '-0.3px',
        }}>
          {copyToastMessage}
        </span>
      </div>
      <div style={{
        position: 'absolute', bottom: '-8px',
        ...(pos.tailAlign === 'right' ? { right: '18px' } : { left: '18px' }),
        width: 0, height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `9px solid ${color}cc`,
        filter: `drop-shadow(0 2px 4px ${color}30)`,
      }} />
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: '5px', padding: '4px 2px' }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.5)',
          animation: `dotBounce 1.4s ease-in-out infinite`,
          animationDelay: `${i * 0.16}s`,
        }} />
      ))}
    </span>
  );
}

function AnswerCopyButton({ text, characterId }: { text: string; characterId: string }) {
  const showCopyToast = useAgentStore((s) => s.showCopyToast);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      const persona = getPersona(characterId);
      const msgs = persona.copyMessages;
      showCopyToast(msgs[Math.floor(Math.random() * msgs.length)]);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* ignore */ }
  }, [text, characterId, showCopyToast]);

  return (
    <button
      className="answer-copy-btn"
      onClick={handleCopy}
      style={{
        width: '22px', height: '22px', borderRadius: '7px',
        background: copied ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)',
        border: `1px solid ${copied ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
        color: copied ? '#4ade80' : 'rgba(255,255,255,0.4)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, transition: 'all 0.2s ease', flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!copied) { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; } }}
      onMouseLeave={(e) => { if (!copied) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; } }}
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}

type BubblePos = {
  left: string;
  right: string;
  transform: string;
  tailLeft?: string;
  tailRight?: string;
  borderRadius: string;
};

const BUBBLE_POSITIONS: Record<number, BubblePos> = {
  0: {
    left: '4%', right: 'auto', transform: 'none',
    tailLeft: '22%',
    borderRadius: '18px 18px 18px 6px',
  },
  1: {
    left: '8%', right: '8%', transform: 'none',
    tailLeft: '50%',
    borderRadius: '18px 18px 6px 18px',
  },
  2: {
    left: 'auto', right: '4%', transform: 'none',
    tailRight: '22%',
    borderRadius: '18px 18px 6px 18px',
  },
};

function AnswerBubbleOverlay() {
  const messages = useAgentStore(selectMessages);
  const activeCharacter = useAgentStore((s) => s.activeCharacter);
  const characters = useAgentStore((s) => s.characters);
  const currentQAIndex = useAgentStore((s) => s.currentQAIndex);
  const isChatOpen = useAgentStore((s) => s.isChatOpen);
  const activePanel = useAgentStore((s) => s.activePanel);

  const charIndex = useMemo(
    () => characters.findIndex((c) => c.id === activeCharacter.id),
    [characters, activeCharacter.id],
  );

  const pairs = useMemo(() => groupIntoPairs(messages), [messages]);
  const currentPair = pairs[currentQAIndex] ?? null;

  if (!isChatOpen || activePanel !== 'none') return null;

  const color = activeCharacter.color;
  const pos = BUBBLE_POSITIONS[charIndex] ?? BUBBLE_POSITIONS[1];

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '215px',
    left: pos.left,
    right: pos.right,
    transform: pos.transform,
    zIndex: 80,
    pointerEvents: 'auto',
    animation: 'answerSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
    maxWidth: '75%',
  };

  const bubbleBg = 'rgba(0, 0, 0, 0.42)';

  const tailAlign = pos.tailLeft ?? 'auto';
  const tailAlignRight = pos.tailRight ?? 'auto';

  function BubbleTail() {
    return (
      <div style={{
        display: 'flex',
        justifyContent: tailAlignRight !== 'auto' ? 'flex-end' : 'flex-start',
        paddingLeft: tailAlign !== 'auto' ? tailAlign : undefined,
        paddingRight: tailAlignRight !== 'auto' ? tailAlignRight : undefined,
      }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: `9px solid ${bubbleBg}`,
        }} />
      </div>
    );
  }

  if (!currentPair) {
    const { greeting } = getPersona(activeCharacter.id);
    return (
      <div style={{ ...containerStyle, animation: 'answerSlideUp 0.35s ease forwards' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '0 8px', marginBottom: '5px',
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: color, boxShadow: `0 0 8px ${color}80`,
          }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color }}>
            {activeCharacter.name}
          </span>
          <span style={{
            fontSize: '9px', fontWeight: 600, color,
            padding: '1px 6px', borderRadius: '6px',
            background: `${color}15`, border: `1px solid ${color}30`,
          }}>
            {activeCharacter.role}
          </span>
        </div>
        <div style={{
          padding: '12px 16px',
          borderRadius: pos.borderRadius,
          background: bubbleBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${color}25`,
          boxShadow: `0 4px 20px rgba(0,0,0,0.15)`,
          color: 'rgba(255,255,255,0.88)',
          fontSize: '13.5px',
          lineHeight: '1.6',
        }}>
          {greeting}
        </div>
        <BubbleTail />
      </div>
    );
  }

  const answerText = currentPair.answer?.content;
  const isLoading = !currentPair.answer || !answerText;

  return (
    <div
      key={currentPair.id}
      className="answer-bubble-area"
      style={containerStyle}
    >
      {/* 캐릭터 이름 + 복사 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 8px', marginBottom: '5px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: color, boxShadow: `0 0 8px ${color}80`,
          }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color }}>
            {activeCharacter.name}
          </span>
        </div>
        {answerText && (
          <AnswerCopyButton text={answerText} characterId={activeCharacter.id} />
        )}
      </div>

      {/* 말풍선 본체 */}
      <div style={{
        padding: '12px 16px',
        borderRadius: pos.borderRadius,
        background: bubbleBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${color}28`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.18), 0 0 30px ${color}08`,
        maxHeight: '220px',
        overflowY: 'auto',
      }}>
        {isLoading ? (
          <TypingDots />
        ) : (
          <div style={{
            fontSize: '13px', lineHeight: '1.65',
            color: 'rgba(255,255,255,0.92)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {answerText}
          </div>
        )}
      </div>
      <BubbleTail />
    </div>
  );
}

export default function App() {
  useAgentInit();
  const isChatOpen = useAgentStore((s) => s.isChatOpen);
  const activePanel = useAgentStore((s) => s.activePanel);
  const hasPanel = activePanel !== 'none';
  const showChat = isChatOpen && !hasPanel;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      position: 'relative', userSelect: 'none', overflow: 'visible',
    }}>
      {/* 패널 영역 (토큰 사용량 / 시스템 모니터) */}
      {hasPanel && (
        <div style={{
          flex: 1, minHeight: 0,
          WebkitAppRegion: 'no-drag',
          position: 'relative', zIndex: 50, pointerEvents: 'auto',
        } as React.CSSProperties}>
          {activePanel === 'token' && <TokenUsagePanel />}
          {activePanel === 'system' && <SystemMonitorPanel />}
        </div>
      )}

      {/* 캐릭터 씬 + 답변 말풍선 */}
      <div style={{
        position: 'relative',
        flex: hasPanel ? undefined : 1,
        height: hasPanel ? '260px' : undefined,
        flexShrink: 0,
        WebkitAppRegion: 'no-drag',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow: 'visible',
      } as React.CSSProperties}>
        {/* 복사 말풍선 — 캐릭터 머리 위 (복사 시에만) */}
        <CopyToastOverlay />

        {/* 답변 말풍선 — 캐릭터 머리 위 (채팅 열렸을 때) */}
        <AnswerBubbleOverlay />

        {/* 캐릭터 이름/역할 - 채팅/패널 안 열렸을 때만 */}
        {!isChatOpen && !hasPanel && (
          <div style={{
            position: 'absolute', bottom: '210px',
            left: '50%', transform: 'translateX(-50%)', zIndex: 20,
          }}>
            <ActiveCharacterInfo />
          </div>
        )}

        {/* 캐릭터 씬 */}
        <div style={{
          pointerEvents: (isChatOpen || hasPanel) ? 'none' : 'auto',
        }}>
          <SceneErrorBoundary>
            <Suspense fallback={null}>
              <CharacterScene />
            </Suspense>
          </SceneErrorBoundary>
        </div>

        {/* 버전 표기: OPENPERSONA by TAEINN v1.0.0 */}
        <div style={{
          position: 'absolute', bottom: '0px', right: '34px', zIndex: 30,
          display: 'flex', alignItems: 'baseline', gap: '5px', pointerEvents: 'none',
          flexWrap: 'wrap', maxWidth: '200px', justifyContent: 'flex-end',
        }}>
          <span style={{
            fontSize: '9.5px', fontWeight: 600, letterSpacing: '1.8px',
            fontFamily: "'Outfit', sans-serif", textTransform: 'uppercase' as const,
            color: 'rgba(255, 255, 255, 0.55)',
            textShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }}>
            OpenPersona
          </span>
          <span style={{
            fontSize: '8px', fontWeight: 400, letterSpacing: '0.4px',
            fontFamily: "'Outfit', sans-serif",
            color: 'rgba(255, 255, 255, 0.42)',
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}>
            by TAEINN
          </span>
          <span style={{
            fontSize: '8px', fontWeight: 500, letterSpacing: '0.5px',
            fontFamily: "'Outfit', sans-serif",
            color: 'rgba(255, 255, 255, 0.38)',
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}>
            v1.0.0
          </span>
        </div>
      </div>

      {/* 하단: 입력바 (채팅 열렸을 때만) */}
      {showChat && (
        <div style={{
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
          pointerEvents: 'auto',
          zIndex: 50,
        } as React.CSSProperties}>
          <BubbleChat />
        </div>
      )}
    </div>
  );
}
