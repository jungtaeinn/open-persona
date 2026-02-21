/**
 * OpenAI LLM Provider.
 * GPT-4o / GPT-4o Mini 모델을 지원한다.
 * 멀티모달(이미지+텍스트), Tool Calling, 스트리밍을 지원한다.
 */
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import type { ModelInfo, StreamChunk } from '../../../shared/types';
import type { LLMProvider, ChatParams, ContentPart, MessageInput } from './types';

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
    this.abortController?.abort();
    this.abortController = new AbortController();

    const messages = params.messages.map(convertToOpenAIMessage);
    const tools = params.tools?.map(convertToOpenAITool);

    const stream = await this.client.chat.completions.create(
      {
        model: params.model,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        stream: true,
        stream_options: { include_usage: true },
      },
      { signal: this.abortController.signal },
    );

    let inputTokens = 0;
    let outputTokens = 0;
    const toolCallAccumulator = new Map<number, { id: string; name: string; args: string }>();

    for await (const event of stream) {
      const choice = event.choices?.[0];
      const text = choice?.delta?.content ?? '';
      const isDone = choice?.finish_reason != null;

      // Tool call 델타 누적
      if (choice?.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const existing = toolCallAccumulator.get(tc.index);
          if (existing) {
            existing.args += tc.function?.arguments ?? '';
          } else {
            toolCallAccumulator.set(tc.index, {
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
              args: tc.function?.arguments ?? '',
            });
          }
        }
      }

      if (event.usage) {
        inputTokens = event.usage.prompt_tokens ?? 0;
        outputTokens = event.usage.completion_tokens ?? 0;
      }

      if (isDone && toolCallAccumulator.size > 0) {
        for (const [, tc] of toolCallAccumulator) {
          try {
            const parsedArgs = JSON.parse(tc.args || '{}');
            yield {
              text: '',
              done: false,
              toolCall: { id: tc.id, name: tc.name, args: parsedArgs },
            };
          } catch {
            yield {
              text: '',
              done: false,
              toolCall: { id: tc.id, name: tc.name, args: {} },
            };
          }
        }
      }

      yield {
        text,
        done: isDone,
        usage: isDone ? { inputTokens, outputTokens } : undefined,
      };
    }

    this.abortController = null;
  }

  /** 비스트리밍 단발 호출 (리랭킹 등에 사용) */
  async quickCall(prompt: string, model: string = 'gpt-4o-mini'): Promise<string> {
    const response = await this.client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  async dispose(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
  }
}

function convertToOpenAIMessage(msg: MessageInput): ChatCompletionMessageParam {
  if (msg.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: msg.toolCallId ?? '',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    };
  }

  if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: typeof msg.content === 'string' ? msg.content : null,
      tool_calls: msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      })),
    };
  }

  if (typeof msg.content === 'string') {
    return { role: msg.role as 'user' | 'assistant' | 'system', content: msg.content };
  }

  // 멀티모달: ContentPart[] → OpenAI 형식
  const parts: ChatCompletionContentPart[] = msg.content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text };
    }
    return {
      type: 'image_url',
      image_url: { url: `data:${part.mimeType};base64,${part.data}` },
    };
  });

  return { role: msg.role as 'user', content: parts };
}

function convertToOpenAITool(tool: { name: string; description: string; parameters: Record<string, unknown> }): ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
