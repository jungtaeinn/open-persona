/**
 * Electron Main Process 진입점.
 * 투명 frameless BrowserWindow, 트레이, IPC 핸들러를 초기화한다.
 * RAG Engine, Orchestrator, Tool 시스템, 학습 시스템을 부트스트랩.
 */
import { app, BrowserWindow, screen, globalShortcut } from 'electron';
import path from 'path';
import { createTray } from './tray';
import { registerIpcHandlers, cleanupIpcTimers } from './ipc-handlers';
import { MemoryGuard } from './services/memory-guard';
import { TokenTracker } from './services/token-tracker';
import { LLMRouter } from './services/llm/llm-router';
import { OpenAIProvider } from './services/llm/openai-provider';
import { GeminiProvider } from './services/llm/gemini-provider';
import { OpenAIEmbeddingAdapter } from './services/rag/adapters/openai-embedding.adapter';
import { GeminiEmbeddingAdapter } from './services/rag/adapters/gemini-embedding.adapter';
import { RAGEngine } from './services/rag/rag-engine';
import { loadStaticKnowledge } from './services/rag/knowledge-loader';
import { ToolRegistry } from './services/tools/tool-registry';
import { createFsTools } from './services/tools/fs-tools';
import { createExcelTools } from './services/tools/excel-tools';
import { Orchestrator } from './services/orchestrator/orchestrator';
import { LearningManager } from './services/learning/learning-manager';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
const memoryGuard = new MemoryGuard();
const tokenTracker = new TokenTracker();
const llmRouter = new LLMRouter();

let ragEngine: RAGEngine;
let orchestrator: Orchestrator;
let learningManager: LearningManager;

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

/** RAG Engine, Tool Registry, Orchestrator, Learning Manager 초기화 */
function initRAGAndOrchestrator() {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const dataDir = path.join(app.getPath('userData'), 'vectra');
  const embedding = selectEmbeddingAdapter(geminiKey, openaiKey);

  ragEngine = new RAGEngine(embedding, {
    dataDir,
    quickLLMCall: (prompt) => llmRouter.quickCall(prompt, 'gemini', 'gemini-2.0-flash'),
  });

  const toolRegistry = new ToolRegistry();
  toolRegistry.registerAll(createFsTools());
  toolRegistry.registerAll(createExcelTools());

  orchestrator = new Orchestrator({
    router: llmRouter,
    ragEngine,
    toolRegistry,
  });

  learningManager = new LearningManager(ragEngine);
}

app.whenReady().then(async () => {
  loadEnv();
  initLLMProviders();
  initRAGAndOrchestrator();

  mainWindow = createWindow();
  createTray(mainWindow);
  registerIpcHandlers(mainWindow, llmRouter, tokenTracker, orchestrator, ragEngine, learningManager);

  memoryGuard.start();

  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });

  // 임베딩 모델 일관성 체크 후 정적 지식 로드 (앱 시작을 차단하지 않음)
  ragEngine.ensureEmbeddingConsistency()
    .then(() => loadStaticKnowledge(ragEngine))
    .catch((err) => {
      console.error('[main] 정적 지식 로드 실패:', err);
    });
});

app.on('before-quit', async () => {
  cleanupIpcTimers();
  memoryGuard.stop();
  globalShortcut.unregisterAll();
  await tokenTracker.flush();
  await llmRouter.dispose();
  await ragEngine?.dispose();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

import type { EmbeddingPort } from './services/rag/ports/embedding.port';

/** Gemini 우선, OpenAI 폴백으로 임베딩 어댑터를 선택한다 */
function selectEmbeddingAdapter(geminiKey?: string, openaiKey?: string): EmbeddingPort {
  if (geminiKey) {
    console.log('[main] 임베딩: Gemini gemini-embedding-001 사용');
    return new GeminiEmbeddingAdapter(geminiKey);
  }
  if (openaiKey) {
    console.log('[main] 임베딩: OpenAI text-embedding-3-small 사용');
    return new OpenAIEmbeddingAdapter(openaiKey);
  }
  console.warn('[main] 임베딩 API 키 없음 — RAG 비활성화 (Gemini 또는 OpenAI 키 필요)');
  return new GeminiEmbeddingAdapter('');
}

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
