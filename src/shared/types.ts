/**
 * Main/Renderer 프로세스 간 공유되는 타입 정의.
 * IPC 통신, 에이전트 상태, LLM 모델 정보 등을 포함한다.
 */

/** 에이전트의 현재 동작 상태 */
export type AgentState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'acting'
  | 'responding'
  | 'done';

/** LLM 모델 정보 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: 'openai' | 'gemini';
}

/** 채팅 메시지 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: number;
}

/** 스트리밍 응답 청크 */
export interface StreamChunk {
  text: string;
  done: boolean;
  toolCall?: { id: string; name: string; args: Record<string, unknown> };
  usage?: TokenUsageRaw;
}

/** API 응답에서 추출한 원시 토큰 사용량 */
export interface TokenUsageRaw {
  inputTokens: number;
  outputTokens: number;
}

/** 토큰 사용량 기록 */
export interface TokenUsageRecord {
  timestamp: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/** 토큰 사용량 요약 */
export interface TokenUsageSummary {
  today: { totalTokens: number; estimatedCost: number };
  thisMonth: { totalTokens: number; estimatedCost: number };
  byModel: Record<string, { totalTokens: number; estimatedCost: number }>;
  /** 월간 토큰 한도 (0이면 무제한) */
  monthlyTokenLimit: number;
  /** 월간 비용 한도 USD (0이면 무제한) */
  monthlyCostLimit: number;
}

/** 메모리 상태 */
export interface MemoryStatus {
  rssMB: number;
  limitMB: number;
}

/** 시스템 통계 (CPU/메모리 상세) */
export interface SystemStats {
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  uptime: number;
  limitMB: number;
}

/** 에이전트 캐릭터 정보 */
export interface AgentCharacterInfo {
  id: string;
  name: string;
  role: string;
  modelFile: 'fox' | 'rabbit' | 'pig';
  color: string;
}

/** Renderer -> Main IPC 채널 */
export type IpcMainChannels =
  | 'chat:send'
  | 'chat:clear'
  | 'model:switch'
  | 'model:list'
  | 'token:summary'
  | 'token:set-limit'
  | 'token:history'
  | 'memory:status'
  | 'system:stats'
  | 'feedback:submit'
  | 'knowledge:upload'
  | 'rag:stats';

/** Main -> Renderer IPC 채널 */
export type IpcRendererChannels =
  | 'chat:stream'
  | 'chat:tool-call'
  | 'agent:state'
  | 'chat:toggle'
  | 'panel:open';
