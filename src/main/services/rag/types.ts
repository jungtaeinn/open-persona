/**
 * RAG 시스템 전반에서 사용하는 공통 타입 정의.
 * 청킹, 검색, 인덱싱에 필요한 데이터 구조를 포함한다.
 */

/** 청크 메타데이터 -- Vectra indexed 필드로 필터링에 사용 */
export interface ChunkMetadata {
  /** 원본 파일 경로 또는 지식 URI (예: "knowledge://pig/excel/functions") */
  sourceUri: string;
  /** 이 청크가 속한 캐릭터 ID */
  characterId: string;
  /** 지식 카테고리 (예: 'excel', 'typescript', 'ko-en') */
  category: string;
  /** 정적 지식(앱 번들) vs 사용자 업로드 vs 대화 학습 */
  sourceType: 'static' | 'user-upload' | 'learned';
  /** 원본 내 청크 순서 */
  chunkIndex: number;
  /** 원본의 전체 청크 수 */
  totalChunks: number;
}

/** 임베딩이 완료된 하나의 청크 */
export interface DocumentChunk {
  id: string;
  content: string;
  vector: number[];
  metadata: ChunkMetadata;
}

/** 임베딩 전 파서/청커가 생성하는 원시 청크 */
export interface RawChunk {
  content: string;
  metadata: Omit<ChunkMetadata, 'chunkIndex' | 'totalChunks'>;
}

/** 벡터 검색 옵션 */
export interface QueryOptions {
  /** 반환할 최대 결과 수 (기본값: 5) */
  topK?: number;
  /** Vectra MongoDB-style 메타데이터 필터 */
  filter?: Record<string, unknown>;
  /** 이 점수 미만의 결과는 제외 (기본값: 0.3) */
  minScore?: number;
}

/** 검색 결과 하나 */
export interface SearchResult {
  id: string;
  content: string;
  /** cosine similarity 점수 (0~1) */
  score: number;
  metadata: ChunkMetadata;
}

/** 문서 로더가 반환하는 파싱 결과 */
export interface ParsedDocument {
  /** 원본 파일 경로 */
  sourcePath: string;
  /** 파싱된 텍스트 (Markdown 형식) */
  content: string;
  /** 문서 유형에 따른 구조 정보 (시트명, 슬라이드 번호 등) */
  sections: DocumentSection[];
}

/** 문서 내 논리적 섹션 (청킹의 1차 분할 단위) */
export interface DocumentSection {
  /** 섹션 제목 또는 식별자 (예: "Sheet1", "Slide 3", "## 함수 문법") */
  title: string;
  content: string;
  /** 추가 메타데이터 (시트명, 슬라이드 번호 등) */
  metadata?: Record<string, unknown>;
}

/** 청커 설정 */
export interface ChunkerConfig {
  /** 청크당 최대 토큰 수 */
  maxTokens: number;
  /** 연속 청크 간 겹치는 토큰 수 */
  overlapTokens: number;
}

/** RAG 검색 요청 */
export interface RAGSearchRequest {
  query: string;
  characterId: string;
  category?: string;
  topK?: number;
  /** 리랭킹 활성화 여부 (기본값: true) */
  useReranking?: boolean;
}
