/**
 * Tool 실행 가드레일.
 * 파일 시스템 작업의 안전성을 보장하기 위한 검증/차단 로직.
 */
import path from 'path';
import type { ToolGuardrailsConfig } from './types';

const DEFAULT_CONFIG: ToolGuardrailsConfig = {
  requireConfirmation: ['deleteFile', 'moveFile', 'writeFile', 'writeExcel'],
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  blockedPaths: [
    '/System',
    '/usr',
    '/bin',
    '/sbin',
    '/Library',
    '/private',
    '/var',
    '/etc',
    path.join(process.env.HOME ?? '~', '.ssh'),
    path.join(process.env.HOME ?? '~', '.gnupg'),
    path.join(process.env.HOME ?? '~', '.aws'),
  ],
  maxToolCallsPerSession: 30,
};

export class ToolGuardrails {
  private config: ToolGuardrailsConfig;
  private callCount = 0;

  constructor(config?: Partial<ToolGuardrailsConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 도구 실행 전 전체 검증 */
  validate(toolName: string, args: Record<string, unknown>): ValidationResult {
    // 1) 세션 호출 횟수 제한
    if (this.callCount >= this.config.maxToolCallsPerSession) {
      return {
        allowed: false,
        reason: `세션당 최대 도구 호출 횟수(${this.config.maxToolCallsPerSession})를 초과했습니다.`,
      };
    }

    // 2) 경로 기반 차단
    const targetPath = extractPath(args);
    if (targetPath) {
      const resolved = path.resolve(targetPath);
      for (const blocked of this.config.blockedPaths) {
        if (resolved.startsWith(blocked)) {
          return {
            allowed: false,
            reason: `보안 상 차단된 경로입니다: ${blocked}`,
          };
        }
      }
    }

    // 3) 파일 크기 검증 (writeFile의 경우)
    if (toolName === 'writeFile') {
      const content = args.content as string | undefined;
      if (content && Buffer.byteLength(content, 'utf-8') > this.config.maxFileSizeBytes) {
        return {
          allowed: false,
          reason: `파일 크기가 제한(${formatBytes(this.config.maxFileSizeBytes)})을 초과합니다.`,
        };
      }
    }

    // 4) 사용자 확인 필요 여부
    const needsConfirmation = this.config.requireConfirmation.includes(toolName);

    this.callCount++;
    return { allowed: true, needsConfirmation };
  }

  /** 세션 호출 카운터 리셋 */
  resetSession(): void {
    this.callCount = 0;
  }

  get currentCallCount(): number {
    return this.callCount;
  }
}

function extractPath(args: Record<string, unknown>): string | undefined {
  return (args.path ?? args.sourcePath ?? args.targetPath ?? args.dirPath) as
    | string
    | undefined;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface ValidationResult {
  allowed: boolean;
  reason?: string;
  needsConfirmation?: boolean;
}
