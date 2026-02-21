/**
 * LLM Provider 추상화 레이어 타입 정의.
 * OpenAI, Gemini 등 각 프로바이더가 이 인터페이스를 구현한다.
 * 멀티모달(이미지+텍스트), Tool Calling 지원.
 */
import type { ModelInfo, StreamChunk } from '../../../shared/types';

/** 채팅 요청 파라미터 */
export interface ChatParams {
  model: string;
  messages: MessageInput[];
  tools?: ToolDefinition[];
  stream: boolean;
}

/** 콘텐츠의 단일 파트 (텍스트 또는 이미지) */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; data: string };

/** LLM에 전달할 메시지 -- 텍스트 또는 멀티모달 콘텐츠 */
export interface MessageInput {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | ContentPart[];
  /** assistant 메시지에 포함된 tool call 정보 */
  toolCalls?: ToolCallInfo[];
  /** tool 역할 메시지에서 어떤 호출에 대한 응답인지 식별 */
  toolCallId?: string;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** Function Tool 정의 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * LLM 프로바이더의 공통 인터페이스.
 *
 * @example
 * ```ts
 * const provider = new OpenAIProvider(apiKey);
 * for await (const chunk of provider.chat(params)) {
 *   console.log(chunk.text);
 * }
 * ```
 */
export interface LLMProvider {
  /** 프로바이더 식별자 (예: "openai", "gemini") */
  readonly name: string;

  /** 지원하는 모델 목록 */
  readonly models: ModelInfo[];

  /**
   * 스트리밍 채팅 요청을 보낸다.
   * @param params - 모델명, 메시지 히스토리, 도구 정의 포함
   * @returns 청크 단위 응답을 yield 하는 AsyncGenerator
   * @throws {Error} API 키가 유효하지 않을 때
   */
  chat(params: ChatParams): AsyncGenerator<StreamChunk>;

  /** 리소스 정리 */
  dispose(): Promise<void>;
}
