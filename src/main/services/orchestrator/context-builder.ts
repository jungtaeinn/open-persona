/**
 * Context Builder.
 * 시스템 프롬프트, RAG 검색 결과, 대화 히스토리, 첨부 파일을 합성하여
 * LLM에 전달할 최종 메시지 배열을 구성한다.
 */
import type { MessageInput, ContentPart } from '../llm/types';
import type { ContextBuildInput, Attachment } from './types';

/** RAG 컨텍스트를 시스템 프롬프트에 주입하는 최대 길이 (토큰 절약) */
const MAX_RAG_CONTEXT_CHARS = 8000;

/**
 * LLM에 전달할 최종 메시지 배열을 빌드한다.
 * 순서: system → history → (RAG-augmented) user message
 */
export function buildMessages(input: ContextBuildInput): MessageInput[] {
  const messages: MessageInput[] = [];

  // 1) 시스템 프롬프트
  const systemContent = buildSystemPrompt(input.systemPrompt, input.ragContext);
  messages.push({ role: 'system', content: systemContent });

  // 2) 대화 히스토리 (최근 N턴만)
  const recentHistory = input.history.slice(-20);
  for (const h of recentHistory) {
    messages.push({ role: h.role, content: h.content });
  }

  // 3) 사용자 메시지 (첨부 파일 포함)
  const userMessage = buildUserMessage(input.userMessage, input.attachments);
  messages.push(userMessage);

  return messages;
}

/** 시스템 프롬프트에 RAG 컨텍스트를 주입 */
function buildSystemPrompt(basePrompt: string, ragContext: string): string {
  if (!ragContext) return basePrompt;

  const trimmedContext = ragContext.length > MAX_RAG_CONTEXT_CHARS
    ? ragContext.slice(0, MAX_RAG_CONTEXT_CHARS) + '\n...(truncated)'
    : ragContext;

  return [
    basePrompt,
    '',
    '--- 참고 지식 (RAG) ---',
    '아래는 관련 전문 지식입니다. 답변 시 적극적으로 참고하되, 지식에 없는 내용은 솔직히 모른다고 하세요.',
    '',
    trimmedContext,
    '--- 참고 지식 끝 ---',
  ].join('\n');
}

/** 사용자 메시지를 텍스트/이미지 멀티모달로 구성 */
function buildUserMessage(
  text: string,
  attachments?: Attachment[],
): MessageInput {
  if (!attachments || attachments.length === 0) {
    return { role: 'user', content: text };
  }

  const parts: ContentPart[] = [{ type: 'text', text }];

  for (const att of attachments) {
    if (att.mimeType.startsWith('image/')) {
      parts.push({
        type: 'image',
        mimeType: att.mimeType,
        data: att.dataType === 'base64' ? att.data : '',
      });
    }
  }

  return { role: 'user', content: parts };
}
