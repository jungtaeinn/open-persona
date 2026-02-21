/**
 * Structure-Aware 커스텀 청커.
 * 문서 구조(헤딩, 슬라이드, 시트)를 1차 분할 기준으로 존중하고,
 * 500토큰 초과 시 문단 단위로 2차 분할한다.
 * 50토큰 overlap으로 청크 간 문맥 연속성을 보장한다.
 */
import type { ChunkerConfig, DocumentSection, RawChunk, ChunkMetadata } from './types';

const DEFAULT_CONFIG: ChunkerConfig = {
  maxTokens: 500,
  overlapTokens: 50,
};

/**
 * 문서 섹션 배열을 청크로 분할한다.
 *
 * @example
 * ```ts
 * const chunks = chunkSections(sections, baseMetadata, { maxTokens: 500, overlapTokens: 50 });
 * ```
 */
export function chunkSections(
  sections: DocumentSection[],
  baseMetadata: Omit<ChunkMetadata, 'chunkIndex' | 'totalChunks'>,
  config: ChunkerConfig = DEFAULT_CONFIG,
): RawChunk[] {
  const allChunks: RawChunk[] = [];

  for (const section of sections) {
    const sectionTokenCount = estimateTokens(section.content);

    if (sectionTokenCount <= config.maxTokens) {
      allChunks.push({
        content: section.content,
        metadata: { ...baseMetadata, ...section.metadata },
      });
      continue;
    }

    const subChunks = splitWithOverlap(
      section.content,
      config.maxTokens,
      config.overlapTokens,
    );

    for (const sub of subChunks) {
      allChunks.push({
        content: sub,
        metadata: { ...baseMetadata, ...section.metadata },
      });
    }
  }

  return allChunks;
}

/**
 * Markdown 텍스트를 ## 헤딩 경계로 섹션 분할한다.
 * 정적 지식(.md 파일) 파싱 시 사용.
 */
export function splitMarkdownIntoSections(
  content: string,
  defaultTitle: string = 'untitled',
): DocumentSection[] {
  const lines = content.split('\n');
  const sections: DocumentSection[] = [];
  let currentTitle = defaultTitle;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.match(/^#{1,3}\s+/)) {
      if (currentLines.length > 0) {
        sections.push({
          title: currentTitle,
          content: currentLines.join('\n').trim(),
        });
      }
      currentTitle = line.replace(/^#{1,3}\s+/, '').trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentLines.join('\n').trim(),
    });
  }

  return sections.filter((s) => s.content.length > 0);
}

/**
 * 텍스트를 문단 단위로 분할하되, maxTokens + overlap을 적용한다.
 * 문단(`\n\n`) 경계를 존중하여 문맥이 깨지지 않도록 한다.
 */
function splitWithOverlap(
  text: string,
  maxTokens: number,
  overlapTokens: number,
): string[] {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    // 단일 문단이 maxTokens를 초과하면 문장 단위로 강제 분할
    if (paraTokens > maxTokens) {
      if (current.length > 0) {
        chunks.push(current.join('\n\n'));
        current = [];
        currentTokens = 0;
      }
      chunks.push(...splitLongParagraph(para, maxTokens));
      continue;
    }

    if (currentTokens + paraTokens > maxTokens && current.length > 0) {
      chunks.push(current.join('\n\n'));

      // overlap: 이전 청크의 마지막 부분을 다음 청크 시작에 포함
      const overlapText = extractOverlap(current, overlapTokens);
      current = overlapText ? [overlapText, para] : [para];
      currentTokens = estimateTokens(current.join('\n\n'));
    } else {
      current.push(para);
      currentTokens += paraTokens;
    }
  }

  if (current.length > 0) {
    chunks.push(current.join('\n\n'));
  }

  return chunks;
}

/** 이전 청크의 마지막 N토큰을 overlap 텍스트로 추출 */
function extractOverlap(paragraphs: string[], overlapTokens: number): string {
  const combined = paragraphs.join('\n\n');
  const words = combined.split(/\s+/);
  // 대략 1토큰 ≈ 0.75 단어 (한국어/영어 혼합 기준)
  const wordCount = Math.ceil(overlapTokens * 0.75);
  if (words.length <= wordCount) return combined;
  return words.slice(-wordCount).join(' ');
}

/** maxTokens를 초과하는 긴 문단을 문장 단위로 강제 분할 */
function splitLongParagraph(text: string, maxTokens: number): string[] {
  const sentences = text.split(/(?<=[.!?。！？])\s+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentTokens = estimateTokens(sentence);
    if (currentTokens + sentTokens > maxTokens && current.length > 0) {
      chunks.push(current.join(' '));
      current = [];
      currentTokens = 0;
    }
    current.push(sentence);
    currentTokens += sentTokens;
  }

  if (current.length > 0) {
    chunks.push(current.join(' '));
  }

  return chunks;
}

/**
 * 텍스트의 대략적인 토큰 수를 추정한다.
 * 정확한 토크나이저 대신 경험적 비율 사용 (한영 혼합 기준).
 * - 영어: ~4 chars/token
 * - 한국어: ~2 chars/token
 * - 혼합: ~3 chars/token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const koreanChars = (text.match(/[\uAC00-\uD7AF]/g) || []).length;
  const ratio = koreanChars > text.length * 0.3 ? 2 : 3;
  return Math.ceil(text.length / ratio);
}
