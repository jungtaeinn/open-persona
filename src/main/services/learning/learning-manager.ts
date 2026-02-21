/**
 * Learning Manager.
 * 대화 기억, 사용자 피드백, 지식 업로드를 통한 지속 학습을 관리한다.
 *
 * 학습 흐름:
 * 1) 대화 기억: 양질의 Q&A 쌍을 추출하여 learned 인덱스에 저장
 * 2) 사용자 피드백: positive → boost, correction → 수정된 내용 학습
 * 3) 지식 업로드: 사용자가 올린 문서를 파싱/청킹하여 learned 인덱스에 추가
 */
import type { RAGEngine } from '../rag/rag-engine';
import type { RawChunk } from '../rag/types';
import type { FeedbackRecord, QAPair, MemoryEntry } from './types';
import { chunkSections, splitMarkdownIntoSections, estimateTokens } from '../rag/chunker';
import { loadDocument, isSupportedDocument } from '../rag/document-loader';

/** 학습할 가치가 있는 최소 답변 길이 (토큰) */
const MIN_ANSWER_TOKENS = 30;
/** Q&A 추출 시 최소 질문 길이 */
const MIN_QUESTION_LENGTH = 10;

export class LearningManager {
  constructor(private ragEngine: RAGEngine) {}

  /**
   * 대화 히스토리에서 양질의 Q&A 쌍을 추출하여 학습한다.
   * positive 피드백이 있는 메시지는 우선 학습.
   */
  async learnFromConversation(
    characterId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    feedbacks?: FeedbackRecord[],
  ): Promise<number> {
    const qaPairs = extractQAPairs(messages, feedbacks);
    if (qaPairs.length === 0) return 0;

    const rawChunks: RawChunk[] = qaPairs.map((qa) => ({
      content: `Q: ${qa.question}\nA: ${qa.answer}`,
      metadata: {
        sourceUri: `conversation://${characterId}/${Date.now()}`,
        characterId,
        category: 'conversation',
        sourceType: 'learned' as const,
      },
    }));

    return this.ragEngine.indexChunks(characterId, rawChunks, 'learned');
  }

  /**
   * 사용자의 수정 피드백을 학습한다.
   * correction 타입의 피드백에서 correctedContent를 새 지식으로 저장.
   */
  async learnFromFeedback(feedback: FeedbackRecord): Promise<number> {
    if (feedback.type !== 'correction' || !feedback.correctedContent) return 0;

    const rawChunks: RawChunk[] = [
      {
        content: feedback.correctedContent,
        metadata: {
          sourceUri: `feedback://${feedback.characterId}/${feedback.messageId}`,
          characterId: feedback.characterId,
          category: 'feedback',
          sourceType: 'learned' as const,
        },
      },
    ];

    return this.ragEngine.indexChunks(feedback.characterId, rawChunks, 'learned');
  }

  /**
   * 사용자가 업로드한 문서를 파싱/청킹하여 learned 인덱스에 추가한다.
   * 지원 형식: .xlsx, .docx, .md, .txt, .json
   */
  async learnFromUpload(
    characterId: string,
    filePath: string,
    category?: string,
  ): Promise<{ chunksAdded: number; error?: string }> {
    if (!isSupportedDocument(filePath)) {
      return {
        chunksAdded: 0,
        error: `지원하지 않는 파일 형식입니다.`,
      };
    }

    try {
      const doc = await loadDocument(filePath);
      const rawChunks = chunkSections(
        doc.sections,
        {
          sourceUri: `upload://${filePath}`,
          characterId,
          category: category ?? 'user-upload',
          sourceType: 'learned',
        },
        { maxTokens: 500, overlapTokens: 50 },
      );

      const count = await this.ragEngine.indexChunks(characterId, rawChunks, 'learned');
      return { chunksAdded: count };
    } catch (error) {
      return {
        chunksAdded: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Markdown 텍스트를 직접 학습한다.
   * 정적 지식 초기 로딩이나 수동 지식 추가에 사용.
   */
  async indexMarkdown(
    characterId: string,
    markdown: string,
    sourceUri: string,
    category: string,
    indexType: 'static' | 'learned' = 'static',
  ): Promise<number> {
    const sections = splitMarkdownIntoSections(markdown);
    const rawChunks = chunkSections(
      sections,
      {
        sourceUri,
        characterId,
        category,
        sourceType: indexType,
      },
      { maxTokens: 500, overlapTokens: 50 },
    );

    return this.ragEngine.indexChunks(characterId, rawChunks, indexType);
  }
}

/** 대화 히스토리에서 양질의 Q&A 쌍을 추출 */
function extractQAPairs(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  feedbacks?: FeedbackRecord[],
): QAPair[] {
  const pairs: QAPair[] = [];
  const feedbackSet = new Set(
    feedbacks?.filter((f) => f.type === 'positive').map((f) => f.messageId) ?? [],
  );

  for (let i = 0; i < messages.length - 1; i++) {
    const q = messages[i];
    const a = messages[i + 1];

    if (q.role !== 'user' || a.role !== 'assistant') continue;
    if (q.content.length < MIN_QUESTION_LENGTH) continue;
    if (estimateTokens(a.content) < MIN_ANSWER_TOKENS) continue;

    pairs.push({
      question: q.content,
      answer: a.content,
      characterId: '',
      quality: feedbackSet.size > 0 ? 'high' : 'medium',
      timestamp: Date.now(),
    });
  }

  return pairs;
}
