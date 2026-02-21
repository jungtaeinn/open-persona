/**
 * Gemini Flash 기반 경량 리랭커.
 * 초기 검색 결과(top-10)를 LLM이 관련성 순으로 재정렬하여 top-K를 선별한다.
 * 비용: ~100 input tokens per call -- 무시할 수준.
 */
import type { SearchResult } from './types';

/** 리랭킹에 사용할 LLM 호출 함수 타입 */
export type QuickLLMCall = (prompt: string) => Promise<string>;

/**
 * 검색 결과를 LLM 기반으로 리랭킹한다.
 *
 * @param query - 원본 사용자 질문
 * @param results - 초기 검색 결과 (시맨틱 + 키워드 병합 후)
 * @param topK - 최종 반환할 결과 수
 * @param llmCall - Gemini Flash quickCall 함수
 */
export async function rerankWithLLM(
  query: string,
  results: SearchResult[],
  topK: number,
  llmCall: QuickLLMCall,
): Promise<SearchResult[]> {
  if (results.length <= topK) return results;

  const snippets = results
    .map((r, i) => `[${i}] ${r.content.slice(0, 150).replace(/\n/g, ' ')}`)
    .join('\n');

  const prompt = [
    '다음 검색 결과 중 질문과 가장 관련 높은 것을 선택하세요.',
    '',
    `질문: "${query}"`,
    '',
    '검색 결과:',
    snippets,
    '',
    `가장 관련 높은 ${topK}개의 인덱스를 JSON 배열로만 반환하세요. 예: [0, 3, 1]`,
  ].join('\n');

  try {
    const response = await llmCall(prompt);
    const indices = parseIndices(response, results.length);

    if (indices.length === 0) {
      return results.slice(0, topK);
    }

    return indices.slice(0, topK).map((i) => results[i]);
  } catch {
    // 리랭킹 실패 시 원본 순서 유지 (graceful degradation)
    return results.slice(0, topK);
  }
}

/** LLM 응답에서 인덱스 배열을 파싱 */
function parseIndices(response: string, maxIndex: number): number[] {
  const match = response.match(/\[[\d\s,]+\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]) as number[];
    return parsed.filter((n) => Number.isInteger(n) && n >= 0 && n < maxIndex);
  } catch {
    return [];
  }
}
