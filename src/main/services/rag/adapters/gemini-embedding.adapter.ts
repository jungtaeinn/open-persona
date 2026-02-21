/**
 * Google Gemini gemini-embedding-001 기반 EmbeddingPort 구현체.
 * 768 차원 (outputDimensionality 지정), 무료 티어 제공.
 * text-embedding-004는 2025-11 이후 v1beta에서 제거되어 GA 모델로 교체.
 */
import { GoogleGenAI } from '@google/genai';
import type { EmbeddingPort } from '../ports/embedding.port';

const MAX_BATCH_SIZE = 100;
const OUTPUT_DIMENSIONS = 768;

export class GeminiEmbeddingAdapter implements EmbeddingPort {
  readonly dimensions = OUTPUT_DIMENSIONS;
  readonly modelName = 'gemini-embedding-001';

  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.models.embedContent({
      model: this.modelName,
      contents: sanitize(text),
      config: { outputDimensionality: OUTPUT_DIMENSIONS },
    });
    return response.embeddings?.[0]?.values ?? [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE).map(sanitize);

      const results = await Promise.all(
        batch.map((text) =>
          this.client.models.embedContent({
            model: this.modelName,
            contents: text,
            config: { outputDimensionality: OUTPUT_DIMENSIONS },
          }),
        ),
      );

      for (const res of results) {
        allEmbeddings.push(res.embeddings?.[0]?.values ?? []);
      }
    }

    return allEmbeddings;
  }
}

function sanitize(text: string): string {
  return text.replace(/\n+/g, ' ').trim().slice(0, 8000);
}
