/**
 * Google Gemini LLM Provider.
 * Gemini 2.0 Flash / Pro 모델을 지원하며 @google/genai SDK를 사용한다.
 */
import { GoogleGenAI } from '@google/genai';
import type { ModelInfo, StreamChunk } from '../../../shared/types';
import type { LLMProvider, ChatParams } from './types';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini' as const;
  readonly models: ModelInfo[] = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini' },
    { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', provider: 'gemini' },
  ];

  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    const { systemPrompt, contents } = this.convertMessages(params.messages);

    const stream = await this.client.models.generateContentStream({
      model: params.model,
      contents,
      config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      const meta = chunk.usageMetadata;

      if (meta) {
        inputTokens = meta.promptTokenCount ?? 0;
        outputTokens = meta.candidatesTokenCount ?? 0;
      }

      const isDone = (chunk.candidates?.[0]?.finishReason ?? '') !== '';

      yield {
        text,
        done: isDone,
        usage: isDone ? { inputTokens, outputTokens } : undefined,
      };
    }
  }

  async dispose(): Promise<void> {
    // Gemini SDK는 별도 정리 불필요
  }

  private convertMessages(messages: ChatParams['messages']) {
    let systemPrompt = '';
    const chatMessages = messages.filter((m) => {
      if (m.role === 'system') {
        systemPrompt = m.content;
        return false;
      }
      return true;
    });

    return {
      systemPrompt,
      contents: chatMessages.map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }],
      })),
    };
  }
}
