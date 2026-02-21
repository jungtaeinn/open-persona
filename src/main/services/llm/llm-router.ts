/**
 * LLM 라우터 -- 여러 Provider 중 현재 활성 Provider로 요청을 라우팅한다.
 * 사용자가 실시간으로 모델을 전환할 수 있다.
 */
import type { ModelInfo, StreamChunk } from '../../../shared/types';
import type { LLMProvider, MessageInput, ToolDefinition } from './types';

export class LLMRouter {
  private providers = new Map<string, LLMProvider>();
  private activeProvider = 'openai';
  private activeModel = 'gpt-4o';

  /**
   * Provider를 등록한다.
   * @param provider - 등록할 LLM Provider
   */
  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
    if (this.providers.size === 1) {
      this.activeProvider = provider.name;
      this.activeModel = provider.models[0]?.id ?? '';
    }
  }

  /**
   * 활성 모델을 변경한다.
   * @param provider - 프로바이더 이름
   * @param model - 모델 ID
   */
  switchModel(provider: string, model: string): void {
    if (!this.providers.has(provider)) return;
    this.activeProvider = provider;
    this.activeModel = model;
  }

  /**
   * 현재 활성 모델로 스트리밍 채팅을 수행한다.
   * @param messages - 대화 히스토리
   * @param tools - 사용할 Function Tools
   * @returns 스트리밍 응답 AsyncGenerator
   */
  async *chat(
    messages: MessageInput[],
    tools?: ToolDefinition[],
  ): AsyncGenerator<StreamChunk> {
    const provider = this.providers.get(this.activeProvider);
    if (!provider) {
      yield { text: 'LLM Provider가 설정되지 않았습니다. API 키를 확인하세요.', done: true };
      return;
    }

    yield* provider.chat({
      model: this.activeModel,
      messages,
      tools,
      stream: true,
    });
  }

  /** 모든 Provider의 모델 목록을 반환한다 */
  getAvailableModels(): ModelInfo[] {
    return [...this.providers.values()].flatMap((p) => p.models);
  }

  /** 현재 활성 모델 정보를 반환한다 */
  getActiveModel(): ModelInfo {
    const provider = this.providers.get(this.activeProvider);
    const model = provider?.models.find((m) => m.id === this.activeModel);
    return model ?? { id: this.activeModel, name: this.activeModel, provider: this.activeProvider as 'openai' | 'gemini' };
  }

  /**
   * 특정 Provider/Model로 비스트리밍 단발 호출을 수행한다.
   * 리랭킹, Intent 분류 등 빠른 응답이 필요할 때 사용.
   */
  async quickCall(prompt: string, provider?: string, model?: string): Promise<string> {
    const targetProvider = provider ?? 'gemini';
    const p = this.providers.get(targetProvider);
    if (!p) return '';

    // quickCall이 있는 provider만 지원 (duck typing)
    const hasQuickCall = 'quickCall' in p && typeof (p as Record<string, unknown>).quickCall === 'function';
    if (hasQuickCall) {
      return (p as { quickCall: (prompt: string, model?: string) => Promise<string> }).quickCall(prompt, model);
    }

    // fallback: 스트리밍으로 전체 응답 수집
    let result = '';
    for await (const chunk of p.chat({ model: model ?? 'gemini-2.0-flash', messages: [{ role: 'user', content: prompt }], stream: true })) {
      result += chunk.text;
    }
    return result;
  }

  /** 특정 Provider/Model로 스트리밍 채팅을 수행한다 */
  async *chatWith(
    provider: string,
    model: string,
    messages: MessageInput[],
    tools?: ToolDefinition[],
  ): AsyncGenerator<StreamChunk> {
    const p = this.providers.get(provider);
    if (!p) {
      yield { text: '요청된 Provider를 찾을 수 없습니다.', done: true };
      return;
    }
    yield* p.chat({ model, messages, tools, stream: true });
  }

  /** 모든 Provider의 리소스를 정리한다 */
  async dispose(): Promise<void> {
    const tasks = [...this.providers.values()].map((p) => p.dispose());
    await Promise.allSettled(tasks);
  }
}
