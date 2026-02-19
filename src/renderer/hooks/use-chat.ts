/**
 * AI 대화 훅.
 * IPC를 통해 Main 프로세스의 LLM Router와 통신하며,
 * 스트리밍 응답을 Zustand 스토어에 반영한다.
 */
import { useEffect, useCallback } from 'react';
import { useAgentStore } from '../stores/agent-store';
import { getPersona } from '../../shared/character-personas';
import type { ChatMessage, AgentState } from '../../shared/types';

function convertErrorMessage(raw: string, characterId: string): string {
  const { errorMessages } = getPersona(characterId);
  if (raw.includes('429') || raw.includes('quota') || raw.includes('billing')) {
    return errorMessages.quota;
  }
  if (raw.includes('network') || raw.includes('ENOTFOUND') || raw.includes('fetch')) {
    return errorMessages.network;
  }
  return errorMessages.default;
}

export function useChat() {
  const { addMessage, appendToLastAssistant, setState } = useAgentStore();

  useEffect(() => {
    const unsubStream = window.electronAPI.on(
      'chat:stream',
      (data: unknown) => {
        const { chunk, done } = data as { chunk: string; done: boolean };
        if (chunk) {
          const charId = useAgentStore.getState().activeCharacter.id;
          if (chunk.startsWith('오류:')) {
            appendToLastAssistant(convertErrorMessage(chunk, charId));
          } else {
            appendToLastAssistant(chunk);
          }
        }
        if (done) setState('done');
      },
    );

    const unsubState = window.electronAPI.on(
      'agent:state',
      (data: unknown) => {
        const { state } = data as { state: AgentState };
        setState(state);
      },
    );

    return () => {
      unsubStream();
      unsubState();
    };
  }, [appendToLastAssistant, setState]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };
      addMessage(userMsg);

      const placeholderMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      addMessage(placeholderMsg);

      setState('listening');
      const charId = useAgentStore.getState().activeCharacter.id;
      window.electronAPI.send('chat:send', { message: text.trim(), characterId: charId });
    },
    [addMessage, setState],
  );

  return { sendMessage };
}
