/**
 * Google Gemini LLM Provider.
 * Gemini 2.0 Flash / Pro 모델을 지원한다.
 * 멀티모달(이미지+텍스트), Tool Calling, 스트리밍을 지원한다.
 */
import { GoogleGenAI } from '@google/genai';
import type { Content, Part, FunctionDeclaration, Tool as GeminiTool } from '@google/genai';
import type { ModelInfo, StreamChunk } from '../../../shared/types';
import type { LLMProvider, ChatParams, ContentPart, MessageInput } from './types';

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini' as const;
  readonly models: ModelInfo[] = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini' },
    { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', provider: 'gemini' },
  ];

  private client: GoogleGenAI;
  private abortController: AbortController | null = null;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async *chat(params: ChatParams): AsyncGenerator<StreamChunk> {
    this.abortController?.abort();
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const { systemPrompt, contents } = this.convertMessages(params.messages);
    const tools = params.tools ? this.convertTools(params.tools) : undefined;

    const stream = await this.client.models.generateContentStream({
      model: params.model,
      contents,
      config: {
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        ...(tools ? { tools } : {}),
      },
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of stream) {
      if (signal.aborted) break;
      const text = chunk.text ?? '';
      const meta = chunk.usageMetadata;

      if (meta) {
        inputTokens = meta.promptTokenCount ?? 0;
        outputTokens = meta.candidatesTokenCount ?? 0;
      }

      // Gemini function call 처리
      const functionCalls = chunk.candidates?.[0]?.content?.parts?.filter(
        (p: Part) => p.functionCall,
      );
      if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
          if (fc.functionCall) {
            yield {
              text: '',
              done: false,
              toolCall: {
                id: `gemini-${Date.now()}`,
                name: fc.functionCall.name ?? '',
                args: (fc.functionCall.args as Record<string, unknown>) ?? {},
              },
            };
          }
        }
      }

      const isDone = (chunk.candidates?.[0]?.finishReason ?? '') !== '';

      yield {
        text,
        done: isDone,
        usage: isDone ? { inputTokens, outputTokens } : undefined,
      };
    }

    this.abortController = null;
  }

  /** 비스트리밍 단발 호출 (리랭킹 등에 사용) */
  async quickCall(prompt: string, model: string = 'gemini-2.0-flash'): Promise<string> {
    const response = await this.client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text ?? '';
  }

  async dispose(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
  }

  private convertMessages(messages: MessageInput[]) {
    let systemPrompt = '';
    const chatMessages: MessageInput[] = [];

    for (const m of messages) {
      if (m.role === 'system') {
        systemPrompt = typeof m.content === 'string' ? m.content : '';
      } else {
        chatMessages.push(m);
      }
    }

    const contents: Content[] = chatMessages.map((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const parts = convertToGeminiParts(m.content);

      // tool 결과 메시지
      if (m.role === 'tool' && m.toolCallId) {
        return {
          role: 'function' as const,
          parts: [
            {
              functionResponse: {
                name: m.toolCallId,
                response: { result: typeof m.content === 'string' ? m.content : '' },
              },
            },
          ],
        } as Content;
      }

      return { role, parts };
    });

    return { systemPrompt, contents };
  }

  private convertTools(
    tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
  ): GeminiTool[] {
    const declarations: FunctionDeclaration[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters as FunctionDeclaration['parameters'],
    }));
    return [{ functionDeclarations: declarations }];
  }
}

function convertToGeminiParts(content: string | ContentPart[]): Part[] {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  return content.map((part) => {
    if (part.type === 'text') {
      return { text: part.text };
    }
    return {
      inlineData: {
        mimeType: part.mimeType,
        data: part.data,
      },
    };
  });
}
