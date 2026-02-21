/**
 * Embedding 추상 인터페이스 (Port).
 * OpenAI, Cohere, 로컬 모델 등 어떤 임베딩이든 이 인터페이스를 구현하면
 * RAG 파이프라인에서 사용할 수 있다.
 */

export interface EmbeddingPort {
  /** 단일 텍스트를 벡터로 변환한다 */
  embed(text: string): Promise<number[]>;

  /**
   * 여러 텍스트를 한 번에 벡터로 변환한다.
   * API 호출 횟수를 줄여 비용과 레이턴시를 절감한다.
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /** 벡터 차원 수 (예: text-embedding-3-small → 1536) */
  readonly dimensions: number;

  /** 사용 중인 모델 이름 */
  readonly modelName: string;
}
