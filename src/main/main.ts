/**
 * Electron Main Process 진입점.
 * 투명 frameless BrowserWindow, 트레이, IPC 핸들러를 초기화한다.
 */
import { app, BrowserWindow, screen, globalShortcut } from 'electron';
import path from 'path';
import { createTray } from './tray';
import { registerIpcHandlers } from './ipc-handlers';
import { MemoryGuard } from './services/memory-guard';
import { TokenTracker } from './services/token-tracker';
import { LLMRouter } from './services/llm/llm-router';
import { OpenAIProvider } from './services/llm/openai-provider';
import { GeminiProvider } from './services/llm/gemini-provider';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
const memoryGuard = new MemoryGuard();
const tokenTracker = new TokenTracker();
const llmRouter = new LLMRouter();

function createWindow(): BrowserWindow {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: 600,
    height: 480,
    x: screenW - 640,
    y: screenH - 500,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    roundedCorners: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[main] renderer failed to load:', code, desc);
  });

  return win;
}

function initLLMProviders() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (openaiKey) llmRouter.register(new OpenAIProvider(openaiKey));
  if (geminiKey) llmRouter.register(new GeminiProvider(geminiKey));

  if (geminiKey) {
    llmRouter.switchModel('gemini', 'gemini-2.0-flash');
  } else if (openaiKey) {
    llmRouter.switchModel('openai', 'gpt-4o');
  }
}

app.whenReady().then(() => {
  loadEnv();
  initLLMProviders();

  mainWindow = createWindow();
  createTray(mainWindow);
  registerIpcHandlers(mainWindow, llmRouter, tokenTracker);

  memoryGuard.start();

  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
});

app.on('before-quit', async () => {
  memoryGuard.stop();
  globalShortcut.unregisterAll();
  await tokenTracker.flush();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/** .env 파일에서 환경변수를 로드한다 */
function loadEnv() {
  try {
    const fs = require('fs');
    const candidates = [
      path.join(app.getAppPath(), '.env'),
      path.join(app.getAppPath(), '..', '..', '.env'),
      path.resolve(process.cwd(), '.env'),
    ];

    for (const envPath of candidates) {
      if (!fs.existsSync(envPath)) continue;
      const content: string = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        process.env[trimmed.slice(0, eqIndex).trim()] = trimmed.slice(eqIndex + 1).trim();
      }
      return;
    }
  } catch {
    // .env 파일이 없어도 정상 동작
  }
}
