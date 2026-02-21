/**
 * 학습 시스템 타입 정의.
 * 대화 기억, 사용자 피드백, 지식 업로드를 통한 지속 학습 구조.
 */

/** 사용자 피드백 유형 */
export type FeedbackType = 'positive' | 'negative' | 'correction';

/** 피드백 레코드 */
export interface FeedbackRecord {
  /** 피드백 대상 메시지 ID */
  messageId: string;
  /** 해당 캐릭터 ID */
  characterId: string;
  /** 피드백 유형 */
  type: FeedbackType;
  /** 수정된 내용 (type === 'correction'일 때만 사용) */
  correctedContent?: string;
  timestamp: number;
}

/** 대화에서 추출된 Q&A 쌍 */
export interface QAPair {
  question: string;
  answer: string;
  characterId: string;
  /** 답변 품질 지표 (길이, 피드백 등 기반) */
  quality: 'high' | 'medium' | 'low';
  timestamp: number;
}

/** 학습된 지식 엔트리 */
export interface MemoryEntry {
  id: string;
  content: string;
  characterId: string;
  /** 학습 출처 */
  source: 'conversation' | 'feedback' | 'upload';
  /** 가중치 (검색 시 score에 곱해짐, 기본 1.0) */
  boost: number;
  timestamp: number;
}
