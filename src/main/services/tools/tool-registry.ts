/**
 * Tool Registry + Executor.
 * LLM Function Calling과 실제 도구 실행을 중개한다.
 */
import type { Tool, ToolCall, ToolResult, ToolExecutable } from './types';
import { ToolGuardrails } from './tool-guardrails';

const TOOL_TIMEOUT_MS = 30_000;
const EXCEL_TOOL_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(msg)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export class ToolRegistry {
  private tools = new Map<string, ToolExecutable>();
  private guardrails = new ToolGuardrails();

  /** 도구 등록 */
  register(tool: ToolExecutable): void {
    this.tools.set(tool.name, tool);
  }

  /** 여러 도구 일괄 등록 */
  registerAll(tools: ToolExecutable[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /** LLM에 전달할 도구 정의 목록 */
  getDefinitions(): Tool[] {
    return [...this.tools.values()].map((t) => t.definition);
  }

  /** LLM이 요청한 도구를 실행한다 */
  async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return {
        toolCallId: call.id,
        success: false,
        output: '',
        error: `알 수 없는 도구: ${call.name}`,
      };
    }

    const validation = this.guardrails.validate(call.name, call.args);
    if (!validation.allowed) {
      return {
        toolCallId: call.id,
        success: false,
        output: '',
        error: validation.reason,
      };
    }

    // TODO: needsConfirmation이면 IPC로 사용자 확인 요청 → Phase 1.5
    try {
      const isExcelTool = call.name.startsWith('readExcel') || call.name.startsWith('writeExcel') || call.name.startsWith('queryExcel');
      const timeout = isExcelTool ? EXCEL_TOOL_TIMEOUT_MS : TOOL_TIMEOUT_MS;
      return await withTimeout(
        tool.execute(call.args),
        timeout,
        `도구 실행 시간 초과 (${timeout / 1000}초): ${call.name}`,
      );
    } catch (error) {
      return {
        toolCallId: call.id,
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** 여러 도구 호출을 병렬 실행한다 */
  async executeBatch(calls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(calls.map((call) => this.execute(call)));
  }

  /** 세션 리셋 (호출 카운터 등) */
  resetSession(): void {
    this.guardrails.resetSession();
  }

  get registeredToolNames(): string[] {
    return [...this.tools.keys()];
  }
}
