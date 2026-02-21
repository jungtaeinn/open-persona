/**
 * RAG Engine 코어.
 * 문서 인덱싱 → 하이브리드 검색(벡터 + BM25) → RRF 병합 → LLM 리랭킹 파이프라인.
 *
 * 각 캐릭터마다 static(앱 번들) / learned(사용자 학습) 두 개의 인덱스를 관리한다.
 */
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import type { VectorStorePort } from './ports/vector-store.port';
import type { EmbeddingPort } from './ports/embedding.port';
import type {
  DocumentChunk,
  RawChunk,
  SearchResult,
  RAGSearchRequest,
  ChunkMetadata,
} from './types';
import { keywordSearch, mergeWithRRF } from './keyword-search';
import { rerankWithLLM, type QuickLLMCall } from './reranker';
import { VectraAdapter } from './adapters/vectra.adapter';

interface RAGEngineConfig {
  /** Vectra 인덱스 루트 폴더 (예: ~/open-persona/data/vectra) */
  dataDir: string;
  /** 리랭킹에 사용할 경량 LLM 호출 함수 */
  quickLLMCall: QuickLLMCall;
}

export class RAGEngine {
  private embedding: EmbeddingPort;
  private stores = new Map<string, VectorStorePort>();
  private config: RAGEngineConfig;
  private static readonly MAX_CACHE_ENTRIES = 20;
  private static readonly MAX_CHUNKS_PER_ENTRY = 500;
  /** 키워드 검색용 -- Vectra에서 일괄 로드한 청크 캐시 (LRU 방식) */
  private chunkCache = new Map<
    string,
    Array<{ id: string; content: string; metadata: ChunkMetadata }>
  >();
  /** 키워드 검색용 더미 벡터 (재사용) */
  private dummyVector: number[] | null = null;

  constructor(embedding: EmbeddingPort, config: RAGEngineConfig) {
    this.embedding = embedding;
    this.config = config;
  }

  /**
   * 임베딩 모델이 변경되었으면 기존 인덱스를 삭제하고 true를 반환.
   * 최초 실행이거나 모델이 같으면 false를 반환.
   */
  async ensureEmbeddingConsistency(): Promise<boolean> {
    const markerPath = path.join(this.config.dataDir, '.embedding-model');

    try {
      await fs.mkdir(this.config.dataDir, { recursive: true });
    } catch { /* ignore */ }

    const currentModel = `${this.embedding.modelName}:${this.embedding.dimensions}`;

    try {
      const stored = (await fs.readFile(markerPath, 'utf-8')).trim();
      if (stored === currentModel) return false;

      console.log(`[RAGEngine] 임베딩 모델 변경 감지: ${stored} → ${currentModel}, 인덱스 재생성`);
      await this.clearAllIndexes();
    } catch {
      // 마커 파일 없음 = 최초 실행
    }

    await fs.writeFile(markerPath, currentModel, 'utf-8');
    return true;
  }

  private async clearAllIndexes(): Promise<void> {
    for (const store of this.stores.values()) {
      await store.dispose();
    }
    this.stores.clear();
    this.chunkCache.clear();

    const entries = await fs.readdir(this.config.dataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await fs.rm(path.join(this.config.dataDir, entry.name), { recursive: true, force: true });
      }
    }
  }

  /**
   * 캐릭터별 벡터 인덱스를 가져오거나 생성한다.
   * indexType: 'static' | 'learned'
   */
  async getStore(characterId: string, indexType: 'static' | 'learned'): Promise<VectorStorePort> {
    const key = `${characterId}:${indexType}`;
    if (this.stores.has(key)) return this.stores.get(key)!;

    const folderPath = path.join(this.config.dataDir, characterId, indexType);
    const store = new VectraAdapter(folderPath);
    await store.initialize();
    this.stores.set(key, store);
    return store;
  }

  /**
   * 원시 청크(임베딩 전)를 인덱스에 추가한다.
   * 배치 임베딩 후 Vectra에 저장.
   */
  async indexChunks(
    characterId: string,
    rawChunks: RawChunk[],
    indexType: 'static' | 'learned' = 'static',
  ): Promise<number> {
    if (rawChunks.length === 0) return 0;

    const store = await this.getStore(characterId, indexType);
    const texts = rawChunks.map((c) => c.content);
    const vectors = await this.embedding.embedBatch(texts);

    const chunks: DocumentChunk[] = rawChunks.map((raw, i) => ({
      id: crypto.randomUUID(),
      content: raw.content,
      vector: vectors[i],
      metadata: {
        sourceUri: raw.metadata.sourceUri,
        characterId: raw.metadata.characterId,
        category: raw.metadata.category,
        sourceType: raw.metadata.sourceType,
        chunkIndex: i,
        totalChunks: rawChunks.length,
      },
    }));

    await store.addChunks(chunks);
    this.invalidateChunkCache(characterId, indexType);
    return chunks.length;
  }

  /**
   * 하이브리드 검색 → RRF 병합 → 리랭킹 파이프라인.
   * 캐릭터의 static + learned 인덱스 모두에서 검색한다.
   */
  async search(request: RAGSearchRequest): Promise<SearchResult[]> {
    const { query, characterId, category, topK = 5, useReranking = true } = request;

    const queryVector = await this.embedding.embed(query);
    const filter: Record<string, unknown> = {};
    if (category) filter.category = { $eq: category };

    // 두 인덱스에서 병렬 벡터 검색
    const [staticResults, learnedResults] = await Promise.all([
      this.queryStore(characterId, 'static', queryVector, filter, topK * 2),
      this.queryStore(characterId, 'learned', queryVector, filter, topK * 2),
    ]);

    const allSemanticResults = [...staticResults, ...learnedResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, topK * 2);

    // 키워드 검색 (BM25)
    const allChunks = await this.getAllChunks(characterId, category);
    const keywordResults = keywordSearch(query, allChunks, topK * 2);

    // RRF 병합
    const merged = mergeWithRRF(allSemanticResults, keywordResults, topK * 2);

    // 리랭킹
    if (useReranking && merged.length > topK) {
      return rerankWithLLM(query, merged, topK, this.config.quickLLMCall);
    }

    return merged.slice(0, topK);
  }

  /** 특정 소스의 청크를 삭제한다 (지식 업데이트/삭제 시 사용) */
  async deleteSource(
    characterId: string,
    sourceUri: string,
    indexType: 'static' | 'learned' = 'static',
  ): Promise<void> {
    const store = await this.getStore(characterId, indexType);
    await store.deleteBySource(sourceUri);
    this.invalidateChunkCache(characterId, indexType);
  }

  /** 인덱스의 상태 정보를 반환한다 */
  async getStats(characterId: string): Promise<{
    static: { count: number; sources: string[] };
    learned: { count: number; sources: string[] };
  }> {
    const staticStore = await this.getStore(characterId, 'static');
    const learnedStore = await this.getStore(characterId, 'learned');

    return {
      static: {
        count: await staticStore.count(),
        sources: await staticStore.listSources(),
      },
      learned: {
        count: await learnedStore.count(),
        sources: await learnedStore.listSources(),
      },
    };
  }

  /** 모든 리소스를 정리한다 */
  async dispose(): Promise<void> {
    for (const store of this.stores.values()) {
      await store.dispose();
    }
    this.stores.clear();
    this.chunkCache.clear();
  }

  private async queryStore(
    characterId: string,
    indexType: 'static' | 'learned',
    vector: number[],
    filter: Record<string, unknown>,
    topK: number,
  ): Promise<SearchResult[]> {
    try {
      const store = await this.getStore(characterId, indexType);
      return store.query(vector, { topK, filter, minScore: 0.25 });
    } catch {
      return [];
    }
  }

  /** 키워드 검색용 청크 캐시 로드 */
  private async getAllChunks(
    characterId: string,
    category?: string,
  ): Promise<Array<{ id: string; content: string; metadata: ChunkMetadata }>> {
    const cacheKey = `${characterId}:all`;

    if (!this.chunkCache.has(cacheKey)) {
      const chunks: Array<{ id: string; content: string; metadata: ChunkMetadata }> = [];

      for (const indexType of ['static', 'learned'] as const) {
        try {
          const store = await this.getStore(characterId, indexType);
          const vectraStore = store as VectraAdapter;
          const sources = await vectraStore.listSources();

          if (!this.dummyVector) {
            this.dummyVector = new Array(this.embedding.dimensions).fill(0);
          }
          for (const source of sources) {
            const remaining = RAGEngine.MAX_CHUNKS_PER_ENTRY - chunks.length;
            if (remaining <= 0) break;
            const results = await vectraStore.query(this.dummyVector, {
              topK: Math.min(remaining, 200),
              filter: { sourceUri: { $eq: source } },
              minScore: 0,
            });
            chunks.push(...results);
          }
        } catch {
          // 인덱스가 없으면 건너뜀
        }
      }

      // LRU: 오래된 캐시 항목 정리
      if (this.chunkCache.size >= RAGEngine.MAX_CACHE_ENTRIES) {
        const oldest = this.chunkCache.keys().next().value;
        if (oldest) this.chunkCache.delete(oldest);
      }
      this.chunkCache.set(cacheKey, chunks);
    } else {
      // LRU: 접근 시 항목을 맨 뒤로 이동
      const cached = this.chunkCache.get(cacheKey)!;
      this.chunkCache.delete(cacheKey);
      this.chunkCache.set(cacheKey, cached);
    }

    const allChunks = this.chunkCache.get(cacheKey)!;
    if (!category) return allChunks;
    return allChunks.filter((c) => c.metadata.category === category);
  }

  private invalidateChunkCache(characterId: string, _indexType: string): void {
    this.chunkCache.delete(`${characterId}:all`);
  }
}
