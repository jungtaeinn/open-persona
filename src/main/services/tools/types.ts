/**
 * Tool 시스템 타입 정의.
 * LLM의 Function Calling과 연동되는 도구 정의, 호출, 결과 구조.
 */

/** LLM에 전달할 도구 정의 (OpenAI/Gemini 공통 추상) */
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameters;
}

/** JSON Schema 형식의 파라미터 정의 */
export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolProperty>;
  required?: string[];
}

export interface ToolProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: unknown;
  enum?: string[];
  /** array 타입일 때 요소 스키마 (Gemini Function Calling 필수) */
  items?: ToolProperty;
  /** object 타입일 때 하위 프로퍼티 */
  properties?: Record<string, ToolProperty>;
}

/** LLM이 반환한 도구 호출 요청 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** 도구 실행 결과 */
export interface ToolResult {
  toolCallId: string;
  success: boolean;
  output: string;
  error?: string;
}

/** 도구 실행 가드레일 설정 */
export interface ToolGuardrailsConfig {
  /** 실행 전 사용자 확인이 필요한 도구 이름 */
  requireConfirmation: string[];
  /** 읽기/쓰기 허용 최대 파일 크기 (bytes) */
  maxFileSizeBytes: number;
  /** 접근 차단할 경로 패턴 */
  blockedPaths: string[];
  /** 세션당 최대 도구 호출 횟수 */
  maxToolCallsPerSession: number;
}

/** 도구 실행기가 구현할 인터페이스 */
export interface ToolExecutable {
  /** 도구 이름 */
  name: string;
  /** LLM에 노출할 정의 */
  definition: Tool;
  /** 실제 실행 로직 */
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}
