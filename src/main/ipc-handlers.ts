/**
 * IPC 핸들러 등록.
 * Renderer 프로세스의 요청을 받아 Orchestrator, RAG, 학습, 토큰 정보를 처리한다.
 * 메모리 안전: 핸들러 중복 등록 방지, AbortController로 스트림 취소, 타이머 관리.
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { LLMRouter } from './services/llm/llm-router';
import type { TokenTracker } from './services/token-tracker';
import type { Orchestrator } from './services/orchestrator/orchestrator';
import type { RAGEngine } from './services/rag/rag-engine';
import type { LearningManager } from './services/learning/learning-manager';
import type { AgentState, ChatMessage } from '../shared/types';
import type { Attachment } from './services/orchestrator/types';
import { getPersona } from '../shared/character-personas';

const MAX_HISTORY = 50;
const MAX_CHARACTERS = 10;
const chatHistoryByCharacter = new Map<string, ChatMessage[]>();
let currentCharacterId = 'pig';

let activeAbortController: AbortController | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function getHistory(charId: string): ChatMessage[] {
  const existing = chatHistoryByCharacter.get(charId);
  if (existing) {
    chatHistoryByCharacter.delete(charId);
    chatHistoryByCharacter.set(charId, existing);
    return existing;
  }
  const fresh: ChatMessage[] = [];
  chatHistoryByCharacter.set(charId, fresh);
  return fresh;
}

/** 앱 종료 시 타이머 정리 */
export function cleanupIpcTimers(): void {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (activeAbortController) { activeAbortController.abort(); activeAbortController = null; }
}

function safeRemoveHandler(channel: string) {
  try { ipcMain.removeHandler(channel); } catch { /* no-op */ }
}

function safeRemoveAllListeners(channel: string) {
  ipcMain.removeAllListeners(channel);
}

/**
 * 모든 IPC 핸들러를 등록한다.
 * 중복 호출 시 이전 핸들러를 자동 정리한다.
 */
export function registerIpcHandlers(
  win: BrowserWindow,
  router: LLMRouter,
  tokenTracker: TokenTracker,
  orchestrator: Orchestrator,
  ragEngine: RAGEngine,
  learningManager: LearningManager,
): void {
  // 이전 핸들러 정리
  const onChannels = ['chat:send', 'chat:clear', 'model:switch', 'window:resize'];
  onChannels.forEach(safeRemoveAllListeners);
  const handleChannels = [
    'feedback:submit', 'knowledge:upload', 'rag:stats',
    'model:list', 'token:summary', 'token:set-limit', 'token:history',
    'memory:status', 'system:stats',
  ];
  handleChannels.forEach(safeRemoveHandler);

  // -- 채팅 (Orchestrator 경유) --
  ipcMain.on(
    'chat:send',
    async (
      _event,
      data: {
        message: string;
        characterId?: string;
        attachments?: Attachment[];
      },
    ) => {
      if (data.characterId) {
        currentCharacterId = data.characterId;
      }

      // 이전 스트림 취소
      if (activeAbortController) {
        activeAbortController.abort();
      }
      activeAbortController = new AbortController();
      const { signal } = activeAbortController;

      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }

      const history = getHistory(currentCharacterId);

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: data.message,
        timestamp: Date.now(),
      };
      history.push(userMsg);
      trimHistory(currentCharacterId);

      sendState(win, 'thinking');

      try {
        let fullText = '';

        for await (const chunk of orchestrator.process({
          message: data.message,
          characterId: currentCharacterId,
          history: history.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          attachments: data.attachments,
        })) {
          if (signal.aborted || win.isDestroyed()) break;

          if (chunk.toolCall) {
            sendState(win, 'acting');
            const persona = getPersona(currentCharacterId);
            const toolMsgs = persona.toolProgressMessages[chunk.toolCall.name]
              ?? persona.toolProgressMessages.default
              ?? [];
            const progressMessage = toolMsgs.length > 0
              ? toolMsgs[Math.floor(Math.random() * toolMsgs.length)]
              : undefined;
            win.webContents.send('chat:tool-call', {
              tool: chunk.toolCall.name,
              status: 'executing',
              progressMessage,
            });
          }

          if (chunk.text) {
            fullText += chunk.text;
            win.webContents.send('chat:stream', {
              chunk: chunk.text,
              done: false,
            });
          }

          if (chunk.done) {
            win.webContents.send('chat:stream', { chunk: '', done: true });

            if (chunk.usage) {
              const activeModel = router.getActiveModel();
              tokenTracker.record(
                activeModel.provider,
                activeModel.id,
                chunk.usage,
              );
            }
          }
        }

        if (!signal.aborted && !win.isDestroyed()) {
          const assistantMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: fullText,
            model: router.getActiveModel().id,
            timestamp: Date.now(),
          };
          history.push(assistantMsg);
          trimHistory(currentCharacterId);

          sendState(win, 'done');
          idleTimer = setTimeout(() => {
            if (!win.isDestroyed()) sendState(win, 'idle');
            idleTimer = null;
          }, 2000);
        }
      } catch (error) {
        if (!signal.aborted && !win.isDestroyed()) {
          const persona = getPersona(currentCharacterId);
          const errorType = classifyError(error);
          const friendlyMessage = persona.errorMessages[errorType];

          console.error(`[ipc] chat error (${errorType}):`, error instanceof Error ? error.message : error);

          win.webContents.send('chat:stream', {
            chunk: friendlyMessage,
            done: true,
          });
          sendState(win, 'idle');
        }
      } finally {
        if (activeAbortController?.signal === signal) {
          activeAbortController = null;
        }
      }
    },
  );

  ipcMain.on('chat:clear', (_event, data: { characterId: string }) => {
    if (data.characterId) {
      chatHistoryByCharacter.delete(data.characterId);
    }
  });

  // -- 피드백 (학습 시스템) --
  ipcMain.handle(
    'feedback:submit',
    async (
      _event,
      data: {
        messageId: string;
        characterId: string;
        type: 'positive' | 'negative' | 'correction';
        correctedContent?: string;
      },
    ) => {
      return learningManager.learnFromFeedback({
        messageId: data.messageId,
        characterId: data.characterId,
        type: data.type,
        correctedContent: data.correctedContent,
        timestamp: Date.now(),
      });
    },
  );

  // -- 지식 업로드 --
  ipcMain.handle(
    'knowledge:upload',
    async (
      _event,
      data: { characterId: string; filePath: string; category?: string },
    ) => {
      return learningManager.learnFromUpload(
        data.characterId,
        data.filePath,
        data.category,
      );
    },
  );

  // -- RAG 상태 조회 --
  ipcMain.handle('rag:stats', async (_event, data: { characterId: string }) => {
    return ragEngine.getStats(data.characterId);
  });

  // -- 모델 전환 --
  ipcMain.on(
    'model:switch',
    (_event, data: { provider: string; model: string }) => {
      router.switchModel(data.provider, data.model);
    },
  );

  ipcMain.handle('model:list', () => router.getAvailableModels());

  // -- 토큰 관리 --
  ipcMain.handle('token:summary', () => tokenTracker.getSummary());

  ipcMain.handle(
    'token:set-limit',
    (
      _event,
      data: { monthlyTokenLimit?: number; monthlyCostLimit?: number },
    ) => {
      tokenTracker.setLimits(data);
      return tokenTracker.getLimits();
    },
  );

  ipcMain.handle('token:history', (_event, data: { days: number }) =>
    tokenTracker.getHistory(data?.days ?? 7),
  );

  // -- 시스템 정보 --
  ipcMain.handle('memory:status', async () => {
    const rssMB = (await process.memoryUsage.rss()) / 1024 / 1024;
    return { rssMB: Math.round(rssMB * 10) / 10, limitMB: 512 };
  });

  ipcMain.handle('system:stats', async () => {
    const mem = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    return {
      memory: {
        rss: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
        heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
        heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
        external: Math.round((mem.external / 1024 / 1024) * 10) / 10,
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000),
        system: Math.round(cpuUsage.system / 1000),
      },
      uptime: Math.round(uptime),
      limitMB: 512,
    };
  });

  ipcMain.on(
    'window:resize',
    (_event, data: { width: number; height: number }) => {
      if (win.isDestroyed()) return;
      const bounds = win.getBounds();
      const newHeight = data.height;
      const dy = bounds.height - newHeight;
      win.setBounds(
        {
          x: bounds.x,
          y: bounds.y + dy,
          width: data.width,
          height: newHeight,
        },
        true,
      );
    },
  );
}

function sendState(win: BrowserWindow, state: AgentState) {
  if (!win.isDestroyed()) {
    win.webContents.send('agent:state', { state });
  }
}

function trimHistory(charId: string) {
  const history = chatHistoryByCharacter.get(charId);
  if (history && history.length > MAX_HISTORY) {
    chatHistoryByCharacter.set(charId, history.slice(-MAX_HISTORY));
  }
  if (chatHistoryByCharacter.size > MAX_CHARACTERS) {
    const oldest = chatHistoryByCharacter.keys().next().value;
    if (oldest) chatHistoryByCharacter.delete(oldest);
  }
}

/** API 에러를 캐릭터 에러 메시지 유형으로 분류 */
function classifyError(error: unknown): 'quota' | 'network' | 'default' {
  if (!(error instanceof Error)) return 'default';
  const msg = error.message.toLowerCase();

  if (
    msg.includes('quota') ||
    msg.includes('insufficient') ||
    msg.includes('billing') ||
    msg.includes('exceeded') ||
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('resource_exhausted') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('too many requests')
  ) {
    return 'quota';
  }

  if (
    msg.includes('network') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('timeout') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('dns')
  ) {
    return 'network';
  }

  return 'default';
}
