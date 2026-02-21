/**
 * Orchestrator 코어.
 * 모든 요청의 중앙 허브로서 Intent 분류 → RAG 검색 → Model 선택 →
 * Context Build → LLM 호출 → Tool Call Loop를 오케스트레이션한다.
 * Provider 실패 시 자동 폴백으로 가용성을 보장한다.
 *
 * ```
 * User Message
 *   ↓
 * Intent Classifier → RAG Engine → Context Builder → Model Selector
 *   ↓                                                       ↓
 * Tool Registry ←←← LLM Provider (stream) ←←←←←←←←←←←←←←←←
 *   ↓
 * Response Stream → Renderer
 * ```
 */
import type { StreamChunk } from '../../../shared/types';
import type { LLMRouter } from '../llm/llm-router';
import type { MessageInput, ToolDefinition } from '../llm/types';
import type { RAGEngine } from '../rag/rag-engine';
import type { ToolRegistry } from '../tools/tool-registry';
import type { Attachment } from './types';
import { classifyIntent } from './intent-classifier';
import { selectModel } from './model-selector';
import { buildMessages } from './context-builder';
import { getPersona } from '../../../shared/character-personas';

const MAX_TOOL_ROUNDS = 5;
const MAX_CONTEXT_MESSAGES = 30;

const FALLBACK_MODELS: Record<string, { provider: string; model: string }> = {
  openai: { provider: 'gemini', model: 'gemini-2.0-flash' },
  gemini: { provider: 'openai', model: 'gpt-4o-mini' },
};

/** quota/auth 관련 에러인지 판별 */
function isQuotaOrAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('rate_limit') ||
    msg.includes('rate limit') ||
    msg.includes('insufficient') ||
    msg.includes('billing') ||
    msg.includes('exceeded') ||
    msg.includes('429') ||
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('api key') ||
    msg.includes('authentication') ||
    msg.includes('permission') ||
    msg.includes('resource_exhausted') ||
    msg.includes('resource has been exhausted')
  );
}

export interface OrchestratorConfig {
  router: LLMRouter;
  ragEngine: RAGEngine;
  toolRegistry: ToolRegistry;
}

export class Orchestrator {
  private router: LLMRouter;
  private ragEngine: RAGEngine;
  private toolRegistry: ToolRegistry;

  constructor(config: OrchestratorConfig) {
    this.router = config.router;
    this.ragEngine = config.ragEngine;
    this.toolRegistry = config.toolRegistry;
  }

  /**
   * 사용자 메시지를 처리하여 스트리밍 응답을 생성한다.
   * Intent 분류 → RAG 검색 → Model 선택 → Tool Call Loop 전체를 관장.
   */
  async *process(params: {
    message: string;
    characterId: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    attachments?: Attachment[];
  }): AsyncGenerator<StreamChunk> {
    const { message, characterId, history, attachments } = params;

    // 0) 세션 리셋 (도구 호출 카운터 등)
    this.toolRegistry.resetSession();

    // 1) Intent 분류
    const hasImage = attachments?.some((a) => a.mimeType.startsWith('image/')) ?? false;
    const intent = classifyIntent(message, characterId, hasImage);

    // 2) RAG 검색 (필요시)
    let ragContext = '';
    if (intent.needsKnowledge) {
      try {
        const results = await this.ragEngine.search({
          query: message,
          characterId,
          category: intent.category,
          topK: 5,
          useReranking: true,
        });
        ragContext = results
          .map((r, i) => `[${i + 1}] ${r.content}`)
          .join('\n\n');
      } catch {
        // RAG 실패 시 graceful degradation
      }
    }

    // 3) Model 선택 (사용 가능한 Provider만 대상)
    const availableProviders = this.router
      .getAvailableModels()
      .map((m) => m.provider)
      .filter((v, i, a) => a.indexOf(v) === i) as Array<'openai' | 'gemini'>;
    const modelSelection = selectModel(intent, availableProviders);

    // 4) Context Build
    const persona = getPersona(characterId);
    const messages = buildMessages({
      systemPrompt: persona.systemPrompt,
      history,
      ragContext,
      userMessage: message,
      attachments,
    });

    // 5) Tool Definitions
    const toolDefs: ToolDefinition[] | undefined =
      intent.needsTool ? this.getToolDefinitions() : undefined;

    // 6) LLM 호출 + Tool Call Loop (with fallback)
    try {
      yield* this.chatWithToolLoop(
        modelSelection.provider,
        modelSelection.model,
        messages,
        toolDefs,
      );
    } catch (error) {
      // 선택된 Provider 실패 시 다른 Provider로 폴백
      if (isQuotaOrAuthError(error)) {
        const fallback = FALLBACK_MODELS[modelSelection.provider];
        if (fallback && availableProviders.includes(fallback.provider as 'openai' | 'gemini')) {
          console.warn(
            `[orchestrator] ${modelSelection.provider} failed, falling back to ${fallback.provider}`,
          );
          yield* this.chatWithToolLoop(
            fallback.provider,
            fallback.model,
            messages,
            toolDefs,
          );
          return;
        }
      }
      throw error;
    }
  }

  /**
   * Tool Call Loop: LLM 호출 → Tool Call 감지 → 도구 실행 → 결과 피드백 반복.
   * 최대 MAX_TOOL_ROUNDS까지 반복 후 강제 종료.
   */
  private async *chatWithToolLoop(
    provider: string,
    model: string,
    messages: MessageInput[],
    tools?: ToolDefinition[],
  ): AsyncGenerator<StreamChunk> {
    let round = 0;
    let currentMessages = [...messages];

    while (round < MAX_TOOL_ROUNDS) {
      let fullText = '';
      const pendingToolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
      let lastUsage: StreamChunk['usage'];

      for await (const chunk of this.router.chatWith(provider, model, currentMessages, tools)) {
        if (chunk.toolCall) {
          pendingToolCalls.push(chunk.toolCall);
          yield { text: '', done: false, toolCall: chunk.toolCall };
          continue;
        }

        fullText += chunk.text;
        if (chunk.usage) lastUsage = chunk.usage;

        if (pendingToolCalls.length === 0) {
          yield chunk;
        }
      }

      if (pendingToolCalls.length === 0) {
        if (lastUsage) {
          yield { text: '', done: true, usage: lastUsage };
        }
        break;
      }

      currentMessages.push({
        role: 'assistant',
        content: fullText || '',
        toolCalls: pendingToolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
        })),
      });

      for (const tc of pendingToolCalls) {
        const result = await this.toolRegistry.execute({
          id: tc.id,
          name: tc.name,
          args: tc.args,
        });

        currentMessages.push({
          role: 'tool',
          content: result.success ? result.output : `Error: ${result.error}`,
          toolCallId: tc.id,
        });
      }

      round++;

      if (currentMessages.length > MAX_CONTEXT_MESSAGES) {
        const system = currentMessages.filter((m) => m.role === 'system');
        const recent = currentMessages.slice(-(MAX_CONTEXT_MESSAGES - system.length));
        currentMessages = [...system, ...recent];
      }

      if (round === MAX_TOOL_ROUNDS) {
        for await (const chunk of this.router.chatWith(provider, model, currentMessages)) {
          yield chunk;
        }
      }
    }
  }

  private getToolDefinitions(): ToolDefinition[] {
    return this.toolRegistry.getDefinitions().map((d) => ({
      name: d.name,
      description: d.description,
      parameters: d.parameters as unknown as Record<string, unknown>,
    }));
  }
}
