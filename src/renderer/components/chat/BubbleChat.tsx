/**
 * 채팅 입력 UI.
 * 입력바 + 이미지/파일 첨부 + 질문 칩 네비게이션 + 하단 버튼으로 구성.
 * 답변은 App.tsx의 AnswerBubbleOverlay에서 캐릭터 위 말풍선으로 표시.
 */
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useAgentStore, selectMessages } from '../../stores/agent-store';
import { useChat, type ChatAttachment } from '../../hooks/use-chat';
import type { ChatMessage } from '../../../shared/types';

const CHAT_CSS = `
  .chat-input:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.5) !important;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }
`;
function injectStyleOnce(id: string, css: string) {
  const existing = document.head.querySelector(`[data-style-id="${id}"]`);
  if (existing) { existing.textContent = css; return; }
  const el = document.createElement('style');
  el.setAttribute('data-style-id', id);
  el.textContent = css;
  document.head.appendChild(el);
}
injectStyleOnce('chat-input', CHAT_CSS);

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
  const { sendMessage, toolStatus } = useChat();

  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessing = agentState !== 'idle' && agentState !== 'done';

  const pairs = useMemo(() => groupIntoPairs(messages), [messages]);
  const currentIndex = useAgentStore((s) => s.currentQAIndex);

  useEffect(() => {
    setCurrentQAIndex(Math.max(pairs.length - 1, 0));
  }, [pairs.length, setCurrentQAIndex]);

  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 100);
    return () => { if (focusTimerRef.current) clearTimeout(focusTimerRef.current); };
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] ?? '';
        setAttachments((prev) => [
          ...prev,
          { name: file.name, mimeType: file.type, data: base64, dataType: 'base64' },
        ]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(() => {
    if ((!text.trim() && attachments.length === 0) || isProcessing) return;
    sendMessage(text, attachments.length > 0 ? attachments : undefined);
    setText('');
    setAttachments([]);
  }, [text, attachments, sendMessage, isProcessing]);

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

      {/* 도구 실행 상태 표시 */}
      {toolStatus && (
        <div style={{
          padding: '2px 12px 4px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{
            padding: '3px 10px', borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.2)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            fontSize: '10px', color: 'rgba(199, 210, 254, 0.9)',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}>
            <span style={{ animation: 'pulse 1s infinite' }}>⚡</span>
            {toolStatus}
          </div>
        </div>
      )}

      {/* 첨부 파일 미리보기 */}
      {attachments.length > 0 && (
        <div style={{ padding: '0 12px 4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {attachments.map((att, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              fontSize: '10px', color: 'rgba(255,255,255,0.7)',
            }}>
              {att.mimeType.startsWith('image/') ? '🖼️' : '📎'} {att.name}
              <button onClick={() => removeAttachment(i)} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer', padding: '0 2px', fontSize: '10px',
              }}>✕</button>
            </div>
          ))}
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
          {/* 파일 첨부 버튼 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.xlsx,.xls,.docx,.md,.txt,.json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: isProcessing ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.2s ease',
              opacity: isProcessing ? 0.5 : 1,
            }}
            title="파일/이미지 첨부"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

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
            disabled={(!text.trim() && attachments.length === 0) || isProcessing}
            style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: (text.trim() || attachments.length > 0) ? 'rgba(99, 102, 241, 0.8)' : 'rgba(255,255,255,0.1)',
              border: 'none', cursor: (text.trim() || attachments.length > 0) ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s ease', flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={(text.trim() || attachments.length > 0) ? 'white' : 'rgba(255,255,255,0.3)'} strokeWidth="2">
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
