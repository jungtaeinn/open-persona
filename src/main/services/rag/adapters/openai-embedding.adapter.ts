/**
 * OpenAI text-embedding-3-small 기반 EmbeddingPort 구현체.
 * 1536 차원, $0.020/1M tokens -- 비용 효율적인 임베딩.
 */
import OpenAI from 'openai';
import type { EmbeddingPort } from '../ports/embedding.port';

/** 한 번의 API 호출에 포함할 최대 텍스트 수 */
const MAX_BATCH_SIZE = 100;

export class OpenAIEmbeddingAdapter implements EmbeddingPort {
  readonly dimensions = 1536;
  readonly modelName = 'text-embedding-3-small';

  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.modelName,
      input: sanitize(text),
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const allEmbeddings: number[][] = [];

    // API 제한에 맞춰 배치 분할
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE).map(sanitize);
      const response = await this.client.embeddings.create({
        model: this.modelName,
        input: batch,
      });

      const sorted = response.data.sort((a, b) => a.index - b.index);
      allEmbeddings.push(...sorted.map((d) => d.embedding));
    }

    return allEmbeddings;
  }
}

/** 임베딩 API에 전달하기 전 텍스트 정리 */
function sanitize(text: string): string {
  return text.replace(/\n+/g, ' ').trim().slice(0, 8000);
}
