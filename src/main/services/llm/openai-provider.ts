/**
 * OpenAI LLM Provider.
 * GPT-4o / GPT-4o Mini 모델을 지원하며 Chat Completions API를 사용한다.
 */
import OpenAI from 'openai';
import type { ModelInfo, StreamChunk } from '../../../shared/types';
import type { LLMProvider, ChatParams } from './types';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai' as const;
  readonly models: ModelInfo[] = [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
  ];

  private client: OpenAI;
  private abortController: AbortController | null = null;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    this.abortController = new AbortController();

    const stream = await this.client.chat.completions.create(
      {
        model: params.model,
        messages: params.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: this.abortController.signal },
    );

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      const choice = event.choices?.[0];
      const text = choice?.delta?.content ?? '';
      const isDone = choice?.finish_reason != null;

      if (event.usage) {
        inputTokens = event.usage.prompt_tokens ?? 0;
        outputTokens = event.usage.completion_tokens ?? 0;
      }

      yield {
        text,
        done: isDone,
        usage: isDone ? { inputTokens, outputTokens } : undefined,
      };
    }

    this.abortController = null;
  }

  async dispose(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
  }
}
