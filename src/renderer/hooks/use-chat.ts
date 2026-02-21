/**
 * AI 대화 훅.
 * IPC를 통해 Main 프로세스의 Orchestrator와 통신하며,
 * 스트리밍 응답을 Zustand 스토어에 반영한다.
 * 이미지/파일 첨부, 피드백, 지식 업로드를 지원한다.
 */
import { useEffect, useCallback, useState } from 'react';
import { useAgentStore } from '../stores/agent-store';
import { getPersona } from '../../shared/character-personas';
import type { ChatMessage, AgentState } from '../../shared/types';

/** 첨부 파일 (렌더러 측) */
export interface ChatAttachment {
  name: string;
  mimeType: string;
  data: string;
  dataType: 'base64' | 'filepath';
}

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
  const { addMessage, appendToLastAssistant, setState, showToolProgress, clearToolProgress } = useAgentStore();
  const [toolStatus, setToolStatus] = useState<string | null>(null);

  useEffect(() => {
    const unsubStream = window.electronAPI.on(
      'chat:stream',
      (data: unknown) => {
        const { chunk, done } = data as { chunk: string; done: boolean };
        if (chunk) {
          clearToolProgress();
          const charId = useAgentStore.getState().activeCharacter.id;
          if (chunk.startsWith('오류:')) {
            appendToLastAssistant(convertErrorMessage(chunk, charId));
          } else {
            appendToLastAssistant(chunk);
          }
        }
        if (done) {
          setState('done');
          setToolStatus(null);
          clearToolProgress();
        }
      },
    );

    const unsubToolCall = window.electronAPI.on(
      'chat:tool-call',
      (data: unknown) => {
        const { tool, status, progressMessage } = data as {
          tool: string;
          status: string;
          progressMessage?: string;
        };
        setToolStatus(`${tool}: ${status}`);
        if (progressMessage) {
          showToolProgress(progressMessage);
        }
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
      unsubToolCall();
      unsubState();
    };
  }, [appendToLastAssistant, setState, showToolProgress, clearToolProgress]);

  /** 메시지 전송 (첨부 파일 포함 가능) */
  const sendMessage = useCallback(
    (text: string, attachments?: ChatAttachment[]) => {
      if (!text.trim() && (!attachments || attachments.length === 0)) return;

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
      window.electronAPI.send('chat:send', {
        message: text.trim(),
        characterId: charId,
        attachments,
      });
    },
    [addMessage, setState],
  );

  /** 피드백 전송 */
  const submitFeedback = useCallback(
    async (
      messageId: string,
      type: 'positive' | 'negative' | 'correction',
      correctedContent?: string,
    ) => {
      const charId = useAgentStore.getState().activeCharacter.id;
      return window.electronAPI.invoke('feedback:submit', {
        messageId,
        characterId: charId,
        type,
        correctedContent,
      });
    },
    [],
  );

  /** 지식 파일 업로드 */
  const uploadKnowledge = useCallback(
    async (filePath: string, category?: string) => {
      const charId = useAgentStore.getState().activeCharacter.id;
      return window.electronAPI.invoke('knowledge:upload', {
        characterId: charId,
        filePath,
        category,
      });
    },
    [],
  );

  return { sendMessage, submitFeedback, uploadKnowledge, toolStatus };
}
