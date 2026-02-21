/**
 * Preload 스크립트 -- Renderer 프로세스에 안전한 IPC 브릿지를 제공한다.
 * contextIsolation: true 환경에서 contextBridge 를 통해
 * 허용된 채널만 노출한다.
 */
import { contextBridge, ipcRenderer } from 'electron';

const ALLOWED_SEND_CHANNELS = [
  'chat:send',
  'chat:clear',
  'model:switch',
  'window:resize',
] as const;

const ALLOWED_INVOKE_CHANNELS = [
  'model:list',
  'token:summary',
  'token:set-limit',
  'token:history',
  'memory:status',
  'system:stats',
  'feedback:submit',
  'knowledge:upload',
  'rag:stats',
] as const;

const ALLOWED_RECEIVE_CHANNELS = [
  'chat:stream',
  'chat:tool-call',
  'agent:state',
  'chat:toggle',
  'panel:open',
] as const;

type SendChannel = (typeof ALLOWED_SEND_CHANNELS)[number];
type InvokeChannel = (typeof ALLOWED_INVOKE_CHANNELS)[number];
type ReceiveChannel = (typeof ALLOWED_RECEIVE_CHANNELS)[number];

const api = {
  send(channel: SendChannel, data: unknown) {
    if ((ALLOWED_SEND_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  invoke(channel: InvokeChannel, data?: unknown): Promise<unknown> {
    if ((ALLOWED_INVOKE_CHANNELS as readonly string[]).includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Channel not allowed: ${channel}`));
  },

  on(channel: ReceiveChannel, callback: (...args: unknown[]) => void) {
    if ((ALLOWED_RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
      const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
        callback(...args);
      ipcRenderer.on(channel, handler);
      return () => { ipcRenderer.removeListener(channel, handler); };
    }
    return () => {};
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
