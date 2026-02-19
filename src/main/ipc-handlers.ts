/**
 * IPC 핸들러 등록.
 * Renderer 프로세스의 요청을 받아 LLM, 도구, 메모리/토큰 정보를 처리한다.
 */
import { ipcMain, BrowserWindow } from 'electron';
import type { LLMRouter } from './services/llm/llm-router';
import type { TokenTracker } from './services/token-tracker';
import type { AgentState, ChatMessage } from '../shared/types';
import { getPersona } from '../shared/character-personas';

const MAX_HISTORY = 50;
const chatHistoryByCharacter = new Map<string, ChatMessage[]>();
let currentCharacterId = 'pig';

function getHistory(charId: string): ChatMessage[] {
  if (!chatHistoryByCharacter.has(charId)) {
    chatHistoryByCharacter.set(charId, []);
  }
  return chatHistoryByCharacter.get(charId)!;
}

/**
 * 모든 IPC 핸들러를 등록한다.
 * @param win - 응답을 보낼 BrowserWindow
 * @param router - LLM 라우터
 * @param tokenTracker - 토큰 추적기
 */
export function registerIpcHandlers(
  win: BrowserWindow,
  router: LLMRouter,
  tokenTracker: TokenTracker,
): void {
  ipcMain.on('chat:send', async (_event, data: { message: string; characterId?: string }) => {
    if (data.characterId) {
      currentCharacterId = data.characterId;
    }

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
      const persona = getPersona(currentCharacterId);
      const messages = [
        { role: 'system' as const, content: persona.systemPrompt },
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      for await (const chunk of router.chat(messages)) {
        if (chunk.toolCall) {
          sendState(win, 'acting');
          win.webContents.send('chat:tool-call', {
            tool: chunk.toolCall.name,
            status: 'executing',
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
      setTimeout(() => sendState(win, 'idle'), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      win.webContents.send('chat:stream', { chunk: `오류: ${message}`, done: true });
      sendState(win, 'idle');
    }
  });

  ipcMain.on('chat:clear', (_event, data: { characterId: string }) => {
    if (data.characterId) {
      chatHistoryByCharacter.delete(data.characterId);
    }
  });

  ipcMain.on('model:switch', (_event, data: { provider: string; model: string }) => {
    router.switchModel(data.provider, data.model);
  });

  ipcMain.handle('model:list', () => router.getAvailableModels());

  ipcMain.handle('token:summary', () => tokenTracker.getSummary());

  ipcMain.handle('token:set-limit', (_event, data: { monthlyTokenLimit?: number; monthlyCostLimit?: number }) => {
    tokenTracker.setLimits(data);
    return tokenTracker.getLimits();
  });

  ipcMain.handle('token:history', (_event, data: { days: number }) =>
    tokenTracker.getHistory(data?.days ?? 7),
  );

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
        rss: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024 * 10) / 10,
        external: Math.round(mem.external / 1024 / 1024 * 10) / 10,
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000),
        system: Math.round(cpuUsage.system / 1000),
      },
      uptime: Math.round(uptime),
      limitMB: 512,
    };
  });

  ipcMain.on('window:resize', (_event, data: { width: number; height: number }) => {
    const bounds = win.getBounds();
    const newHeight = data.height;
    const dy = bounds.height - newHeight;
    win.setBounds({
      x: bounds.x,
      y: bounds.y + dy,
      width: data.width,
      height: newHeight,
    }, true);
  });
}

function sendState(win: BrowserWindow, state: AgentState) {
  win.webContents.send('agent:state', { state });
}

function trimHistory(charId: string) {
  const history = chatHistoryByCharacter.get(charId);
  if (history && history.length > MAX_HISTORY) {
    chatHistoryByCharacter.set(charId, history.slice(-MAX_HISTORY));
  }
}
