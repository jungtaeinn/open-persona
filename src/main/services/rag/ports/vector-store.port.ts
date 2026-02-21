/**
 * Vector Store 추상 인터페이스 (Port).
 * Vectra, LanceDB, ChromaDB 등 어떤 벡터 DB든 이 인터페이스를 구현하면
 * RAG 파이프라인에 끼워넣을 수 있다.
 */
import type { DocumentChunk, QueryOptions, SearchResult } from '../types';

export interface VectorStorePort {
  /** 인덱스 초기화 (폴더 생성, 스키마 설정 등) */
  initialize(): Promise<void>;

  /**
   * 청크 배열을 인덱스에 추가한다.
   * @param chunks - 임베딩이 완료된 청크 배열
   */
  addChunks(chunks: DocumentChunk[]): Promise<void>;

  /**
   * 벡터 유사도 검색을 수행한다.
   * @param vector - 쿼리 임베딩 벡터
   * @param options - topK, 필터, 최소 점수 등
   */
  query(vector: number[], options: QueryOptions): Promise<SearchResult[]>;

  /**
   * 특정 소스의 모든 청크를 삭제한다.
   * @param sourceUri - 삭제할 원본의 URI
   */
  deleteBySource(sourceUri: string): Promise<void>;

  /** 인덱스에 있는 모든 고유 sourceUri 목록을 반환한다 */
  listSources(): Promise<string[]>;

  /** 인덱스의 전체 아이템 수를 반환한다 */
  count(): Promise<number>;

  /** 리소스를 정리한다 */
  dispose(): Promise<void>;
}
