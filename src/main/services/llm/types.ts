/**
 * LLM Provider 추상화 레이어 타입 정의.
 * OpenAI, Gemini 등 각 프로바이더가 이 인터페이스를 구현한다.
 */
import type { ModelInfo, StreamChunk } from '../../../shared/types';

/** 채팅 요청 파라미터 */
export interface ChatParams {
  model: string;
  messages: MessageInput[];
  tools?: ToolDefinition[];
  stream: boolean;
}

/** LLM에 전달할 메시지 */
export interface MessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
