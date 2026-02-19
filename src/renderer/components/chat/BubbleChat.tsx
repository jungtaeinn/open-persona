/**
 * 채팅 입력 UI.
 * 입력바 + 질문 칩 네비게이션 + 하단 버튼으로 구성.
 * 답변은 App.tsx의 AnswerBubbleOverlay에서 캐릭터 위 말풍선으로 표시.
 */
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useAgentStore, selectMessages } from '../../stores/agent-store';
import { useChat } from '../../hooks/use-chat';
import type { ChatMessage } from '../../../shared/types';

const CHAT_STYLE = document.createElement('style');
CHAT_STYLE.textContent = `
  .chat-input:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.5) !important;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }
`;
if (!document.head.querySelector('[data-chat-input]')) {
  CHAT_STYLE.setAttribute('data-chat-input', '');
  document.head.appendChild(CHAT_STYLE);
}

export interface QAPair {
  id: string;
  question: ChatMessage;
  answer: ChatMessage | null;
}

export function groupIntoPairs(messages: ChatMessage[]): QAPair[] {
  const pairs: QAPair[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'user') {
      const next = messages[i + 1];
      const hasAnswer = next && next.role === 'assistant';
      pairs.push({ id: msg.id, question: msg, answer: hasAnswer ? next : null });
      if (hasAnswer) i++;
    }
  }
  return pairs;
}

function QuestionChip({ text, isActive, onClick }: { text: string; isActive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px',
      borderRadius: '12px',
      background: isActive
        ? 'linear-gradient(135deg, rgba(99,102,241,0.8), rgba(79,70,229,0.7))'
        : 'rgba(99,102,241,0.15)',
      border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.12)'}`,
      color: isActive ? 'white' : 'rgba(255,255,255,0.45)',
      fontSize: '11px',
      fontWeight: isActive ? 600 : 500,
      cursor: 'pointer',
      maxWidth: '180px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      transition: 'all 0.2s ease',
      flexShrink: 0,
      boxShadow: isActive ? '0 2px 8px rgba(99,102,241,0.2)' : 'none',
    }}>
      {text}
    </button>
  );
}

export function BubbleChat() {
  const messages = useAgentStore(selectMessages);
  const activeCharacter = useAgentStore((s) => s.activeCharacter);
  const agentState = useAgentStore((s) => s.state);
  const toggleChat = useAgentStore((s) => s.toggleChat);
  const clearMessages = useAgentStore((s) => s.clearMessages);
  const setCurrentQAIndex = useAgentStore((s) => s.setCurrentQAIndex);
  const { sendMessage } = useChat();

  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessing = agentState !== 'idle' && agentState !== 'done';

  const pairs = useMemo(() => groupIntoPairs(messages), [messages]);
  const currentIndex = useAgentStore((s) => s.currentQAIndex);

  useEffect(() => {
    setCurrentQAIndex(Math.max(pairs.length - 1, 0));
  }, [pairs.length, setCurrentQAIndex]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSend = useCallback(() => {
    if (!text.trim() || isProcessing) return;
    sendMessage(text);
    setText('');
  }, [text, sendMessage, isProcessing]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !isProcessing) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === 'Escape') toggleChat();
    },
    [handleSend, isProcessing, toggleChat],
  );

  const chipContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chipContainerRef.current) {
      chipContainerRef.current.scrollLeft = chipContainerRef.current.scrollWidth;
    }
  }, [pairs.length]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
    }}>
      {/* 질문 칩 네비게이션 */}
      {pairs.length > 1 && (
        <div style={{ padding: '0 12px 6px' }}>
          <div
            ref={chipContainerRef}
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '2px',
              scrollbarWidth: 'none',
            }}
          >
            {pairs.map((pair, i) => (
              <QuestionChip
                key={pair.id}
                text={pair.question.content}
                isActive={i === currentIndex}
                onClick={() => setCurrentQAIndex(i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 입력 바 */}
      <div style={{ padding: '0 12px 4px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderRadius: '20px',
          background: 'rgba(0, 0, 0, 0.35)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        }}>
          <input
            ref={inputRef}
            className="chat-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${activeCharacter.name}에게 물어보세요...`}
            disabled={isProcessing}
            style={{
              flex: 1, background: 'none', border: 'none',
              color: 'rgba(255, 255, 255, 0.9)', fontSize: '13px',
              padding: '4px 0', outline: 'none',
              opacity: isProcessing ? 0.5 : 1,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || isProcessing}
            style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: text.trim() ? 'rgba(99, 102, 241, 0.8)' : 'rgba(255,255,255,0.1)',
              border: 'none', cursor: text.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease', flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={text.trim() ? 'white' : 'rgba(255,255,255,0.3)'} strokeWidth="2">
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" />
            </svg>
          </button>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: '8px', padding: '4px 0 6px', flexShrink: 0,
      }}>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer', fontSize: '12px', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease', padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(250,204,21,0.5)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.3)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
            title="대화 초기화"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
        <button
          onClick={toggleChat}
          style={{
            width: '26px', height: '26px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontSize: '12px', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s ease', padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.6)'; e.currentTarget.style.color = 'white'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.3)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
