/**
 * BM25 유사 키워드 검색.
 * 벡터 시맨틱 검색이 놓칠 수 있는 정확한 용어 매칭을 보완한다.
 * (예: "VLOOKUP", "INDEX/MATCH", "useState" 같은 고유 키워드)
 */
import type { SearchResult, ChunkMetadata } from './types';

interface StoredChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
}

/**
 * 키워드 기반 검색을 수행한다.
 * TF-IDF 유사 스코어링으로 가장 관련 높은 청크를 반환한다.
 *
 * @param query - 검색 쿼리
 * @param chunks - 검색 대상 청크 목록
 * @param topK - 반환할 최대 결과 수
 */
export function keywordSearch(
  query: string,
  chunks: StoredChunk[],
  topK: number = 5,
): SearchResult[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  // 각 청크에 대한 BM25 유사 점수 계산
  const scored = chunks.map((chunk) => ({
    ...chunk,
    score: calculateBM25Score(queryTerms, chunk.content, chunks.length),
  }));

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => ({
      id: s.id,
      content: s.content,
      score: s.score,
      metadata: s.metadata,
    }));
}

/**
 * Reciprocal Rank Fusion으로 시맨틱 + 키워드 검색 결과를 병합한다.
 * 두 검색 방식에서 높은 순위를 차지한 결과를 우선 반환한다.
 *
 * @param k - RRF 상수 (기본값 60, 논문 권장값)
 */
export function mergeWithRRF(
  semanticResults: SearchResult[],
  keywordResults: SearchResult[],
  topK: number,
  k: number = 60,
): SearchResult[] {
  const scoreMap = new Map<string, { result: SearchResult; rrfScore: number }>();

  for (let rank = 0; rank < semanticResults.length; rank++) {
    const r = semanticResults[rank];
    const rrfScore = 1 / (k + rank + 1);
    scoreMap.set(r.id, { result: r, rrfScore });
  }

  for (let rank = 0; rank < keywordResults.length; rank++) {
    const r = keywordResults[rank];
    const rrfScore = 1 / (k + rank + 1);
    const existing = scoreMap.get(r.id);
    if (existing) {
      existing.rrfScore += rrfScore;
    } else {
      scoreMap.set(r.id, { result: r, rrfScore });
    }
  }

  return [...scoreMap.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK)
    .map(({ result, rrfScore }) => ({ ...result, score: rrfScore }));
}

/** BM25 유사 스코어 계산 (간소화 버전) */
function calculateBM25Score(
  queryTerms: string[],
  document: string,
  totalDocs: number,
): number {
  const docTerms = tokenize(document);
  const docLen = docTerms.length;
  const avgDocLen = 200; // 평균 청크 길이 추정값
  const k1 = 1.2;
  const b = 0.75;

  let score = 0;
  const termFreq = new Map<string, number>();
  for (const term of docTerms) {
    termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
  }

  for (const queryTerm of queryTerms) {
    const tf = termFreq.get(queryTerm) ?? 0;
    if (tf === 0) continue;

    // IDF 근사값 (문서 빈도 정보 없이 단순화)
    const idf = Math.log(1 + (totalDocs - 1) / (1 + 1));
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)));
    score += idf * tfNorm;
  }

  return score;
}

/** 텍스트를 소문자 토큰으로 분리 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}
