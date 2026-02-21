/**
 * Orchestrator 시스템 타입 정의.
 * Intent 분류, 모델 선택, 컨텍스트 빌딩에 사용되는 구조.
 */

/** 사용자 의도 분류 결과 */
export interface Intent {
  /** 의도 유형 */
  type: IntentType;
  /** 관련 지식 카테고리 (RAG 필터용) */
  category?: string;
  /** RAG 검색이 필요한지 여부 */
  needsKnowledge: boolean;
  /** 도구 실행이 필요한지 여부 */
  needsTool: boolean;
  /** 이미지가 첨부되었는지 여부 */
  hasImage: boolean;
  /** 분류 신뢰도 (0~1) */
  confidence: number;
}

export type IntentType =
  | 'general_chat'
  | 'knowledge_query'
  | 'file_operation'
  | 'code_review'
  | 'design_qa'
  | 'functional_qa'
  | 'translation'
  | 'document_generation'
  | 'code_generation'
  | 'help_request';

/** 모델 선택 결과 */
export interface ModelSelection {
  provider: 'openai' | 'gemini';
  model: string;
  /** 선택 이유 (디버깅/로깅용) */
  reason: string;
}

/** 첨부 파일 (이미지 또는 문서) */
export interface Attachment {
  /** 파일명 */
  name: string;
  /** MIME 타입 (예: 'image/png', 'application/pdf') */
  mimeType: string;
  /** base64 인코딩된 데이터 또는 파일 경로 */
  data: string;
  /** 데이터 형식 */
  dataType: 'base64' | 'filepath';
}

/** Context Builder에 전달되는 빌드 재료 */
export interface ContextBuildInput {
  /** 캐릭터 시스템 프롬프트 */
  systemPrompt: string;
  /** 대화 히스토리 */
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** RAG 검색 결과 텍스트 */
  ragContext: string;
  /** 사용자 메시지 */
  userMessage: string;
  /** 이미지/파일 첨부 */
  attachments?: Attachment[];
  /** 이미지에서 추출된 텍스트 (번역 등에 사용) */
  extractedText?: string;
}
