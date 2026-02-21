/**
 * Vectra LocalIndex 기반 VectorStorePort 구현체.
 * 파일 시스템에 벡터 인덱스를 저장하며, 커스텀 청킹된 아이템을 관리한다.
 */
import { LocalIndex } from 'vectra';
import type { VectorStorePort } from '../ports/vector-store.port';
import type { DocumentChunk, QueryOptions, SearchResult } from '../types';

/** Vectra 메타데이터 중 인덱스에 인라인 저장할 필드 (필터링용) */
const INDEXED_FIELDS = ['characterId', 'category', 'sourceType', 'sourceUri'];

export class VectraAdapter implements VectorStorePort {
  private index: LocalIndex;

  constructor(private folderPath: string) {
    this.index = new LocalIndex(folderPath);
  }

  async initialize(): Promise<void> {
    if (await this.index.isIndexCreated()) return;

    await this.index.createIndex({
      version: 1,
      metadata_config: { indexed: INDEXED_FIELDS },
    });
  }

  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    await this.index.beginUpdate();
    try {
      for (const chunk of chunks) {
        await this.index.insertItem({
          id: chunk.id,
          vector: chunk.vector,
          metadata: { text: chunk.content, ...chunk.metadata },
        });
      }
      await this.index.endUpdate();
    } catch (error) {
      await this.index.cancelUpdate();
      throw error;
    }
  }

  async query(vector: number[], options: QueryOptions = {}): Promise<SearchResult[]> {
    const { topK = 5, filter, minScore = 0.3 } = options;

    const results = await this.index.queryItems(vector, '', topK, filter);

    return results
      .filter((r) => r.score >= minScore)
      .map((r) => ({
        id: String(r.item.id),
        content: (r.item.metadata.text as string) ?? '',
        score: r.score,
        metadata: extractChunkMetadata(r.item.metadata),
      }));
  }

  async deleteBySource(sourceUri: string): Promise<void> {
    const items = await this.index.listItemsByMetadata({
      sourceUri: { $eq: sourceUri },
    });

    if (items.length === 0) return;

    await this.index.beginUpdate();
    try {
      for (const item of items) {
        await this.index.deleteItem(String(item.id));
      }
      await this.index.endUpdate();
    } catch (error) {
      await this.index.cancelUpdate();
      throw error;
    }
  }

  async listSources(): Promise<string[]> {
    const items = await this.index.listItems();
    const uris = new Set<string>();
    for (const item of items) {
      const uri = item.metadata.sourceUri as string;
      if (uri) uris.add(uri);
    }
    return [...uris];
  }

  async count(): Promise<number> {
    const items = await this.index.listItems();
    return items.length;
  }

  async dispose(): Promise<void> {
    // Vectra LocalIndex는 파일 기반이므로 별도 정리 불필요
  }
}

/** Vectra 메타데이터에서 ChunkMetadata 형태로 추출 */
function extractChunkMetadata(
  raw: Record<string, unknown>,
): import('../types').ChunkMetadata {
  return {
    sourceUri: (raw.sourceUri as string) ?? '',
    characterId: (raw.characterId as string) ?? '',
    category: (raw.category as string) ?? '',
    sourceType: (raw.sourceType as 'static' | 'user-upload' | 'learned') ?? 'static',
    chunkIndex: (raw.chunkIndex as number) ?? 0,
    totalChunks: (raw.totalChunks as number) ?? 0,
  };
}
