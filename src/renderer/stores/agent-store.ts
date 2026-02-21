/**
 * Zustand 글로벌 상태 관리.
 * 에이전트 상태, 채팅 메시지, 활성 모델, 캐릭터 정보를 관리한다.
 */
import { create } from 'zustand';
import type { AgentState, ChatMessage, ModelInfo, AgentCharacterInfo, TokenUsageSummary } from '../../shared/types';

export type PanelType = 'none' | 'token' | 'system';

const DEFAULT_CHARACTERS: AgentCharacterInfo[] = [
  { id: 'fox', name: 'Felix', role: 'Developer', modelFile: 'fox', color: '#f97316' },
  { id: 'pig', name: 'Done', role: 'Doc Expert', modelFile: 'pig', color: '#f472b6' },
  { id: 'rabbit', name: 'Bomi', role: 'Translator', modelFile: 'rabbit', color: '#a78bfa' },
];

interface AgentStore {
  state: AgentState;
  messagesByCharacter: Record<string, ChatMessage[]>;
  models: ModelInfo[];
  activeModel: ModelInfo | null;
  isChatOpen: boolean;
  characters: AgentCharacterInfo[];
  activeCharacter: AgentCharacterInfo;
  activePanel: PanelType;
  tokenSummary: TokenUsageSummary | null;
  copyToastMessage: string | null;
  idleTalkMessage: string | null;
  toolProgressMessage: string | null;
  currentQAIndex: number;

  setState: (state: AgentState) => void;
  addMessage: (message: ChatMessage) => void;
  appendToLastAssistant: (text: string) => void;
  setModels: (models: ModelInfo[]) => void;
  setActiveModel: (model: ModelInfo) => void;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
  setActiveCharacter: (character: AgentCharacterInfo) => void;
  clearMessages: () => void;
  setActivePanel: (panel: PanelType) => void;
  setTokenSummary: (summary: TokenUsageSummary) => void;
  showCopyToast: (message: string) => void;
  showIdleTalk: (message: string) => void;
  showToolProgress: (message: string) => void;
  clearToolProgress: () => void;
  setCurrentQAIndex: (index: number) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  state: 'idle',
  messagesByCharacter: {},
  models: [],
  activeModel: null,
  isChatOpen: false,
  characters: DEFAULT_CHARACTERS,
  activeCharacter: DEFAULT_CHARACTERS[1],
  activePanel: 'none',
  tokenSummary: null,
  copyToastMessage: null,
  idleTalkMessage: null,
  toolProgressMessage: null,
  currentQAIndex: 0,

  setState: (state) => set({ state }),

  addMessage: (message) =>
    set((s) => {
      const charId = s.activeCharacter.id;
      const prev = s.messagesByCharacter[charId] ?? [];
      const next = [...prev, message];
      return {
        messagesByCharacter: {
          ...s.messagesByCharacter,
          [charId]: next.length > 100 ? next.slice(-100) : next,
        },
      };
    }),

  appendToLastAssistant: (text) =>
    set((s) => {
      const charId = s.activeCharacter.id;
      const msgs = [...(s.messagesByCharacter[charId] ?? [])];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + text };
      }
      return {
        messagesByCharacter: {
          ...s.messagesByCharacter,
          [charId]: msgs,
        },
      };
    }),

  setModels: (models) =>
    set({ models, activeModel: models[0] ?? null }),

  setActiveModel: (model) => set({ activeModel: model }),

  toggleChat: () => set((s) => {
    const next = !s.isChatOpen;
    resizeWindow(next);
    return { isChatOpen: next, activePanel: 'none' };
  }),

  setChatOpen: (open) => {
    resizeWindow(open);
    set({ isChatOpen: open, activePanel: 'none' });
  },

  setActiveCharacter: (character) => set((s) => {
    if (s.activeCharacter.id === character.id && !s.isChatOpen) {
      resizeWindow(true);
      return { activeCharacter: character, isChatOpen: true, activePanel: 'none' };
    }
    if (s.activeCharacter.id === character.id && s.isChatOpen) {
      return {};
    }
    resizeWindow(true);
    return { activeCharacter: character, isChatOpen: true, activePanel: 'none' };
  }),

  clearMessages: () =>
    set((s) => {
      const charId = s.activeCharacter.id;
      window.electronAPI.send('chat:clear', { characterId: charId });
      return {
        messagesByCharacter: {
          ...s.messagesByCharacter,
          [charId]: [],
        },
      };
    }),

  setActivePanel: (panel) => set((s) => {
    const isSamePanel = s.activePanel === panel;
    const nextPanel = isSamePanel ? 'none' : panel;
    const willBeOpen = nextPanel !== 'none';

    if (willBeOpen && !s.isChatOpen) resizeWindow(true);
    if (!willBeOpen && !s.isChatOpen) resizeWindow(false);

    return {
      activePanel: nextPanel,
      isChatOpen: willBeOpen ? true : s.isChatOpen,
    };
  }),

  setTokenSummary: (summary) => set({ tokenSummary: summary }),

  showCopyToast: (message) => {
    if (copyToastTimer) clearTimeout(copyToastTimer);
    set({ copyToastMessage: message });
    copyToastTimer = setTimeout(() => {
      set({ copyToastMessage: null });
      copyToastTimer = null;
    }, 2200);
  },

  showIdleTalk: (message) => {
    if (idleTalkTimer) clearTimeout(idleTalkTimer);
    set({ idleTalkMessage: message });
    idleTalkTimer = setTimeout(() => {
      set({ idleTalkMessage: null });
      idleTalkTimer = null;
    }, 3000);
  },

  showToolProgress: (message) => {
    set({ toolProgressMessage: message, idleTalkMessage: null });
  },

  clearToolProgress: () => {
    set({ toolProgressMessage: null });
  },

  setCurrentQAIndex: (index) => set({ currentQAIndex: index }),
}));

let copyToastTimer: ReturnType<typeof setTimeout> | null = null;
let idleTalkTimer: ReturnType<typeof setTimeout> | null = null;

const EMPTY_MESSAGES: ChatMessage[] = [];

/** 현재 활성 캐릭터의 메시지 목록을 반환하는 셀렉터 */
export const selectMessages = (s: AgentStore) =>
  s.messagesByCharacter[s.activeCharacter.id] ?? EMPTY_MESSAGES;

function resizeWindow(chatOpen: boolean) {
  const api = (window as unknown as { electronAPI?: { send: (ch: string, data: unknown) => void } }).electronAPI;
  if (!api) return;
  if (chatOpen) {
    api.send('window:resize', { width: 600, height: 750 });
  } else {
    api.send('window:resize', { width: 600, height: 480 });
  }
}
