/**
 * 파일시스템 도구 모음.
 * 모든 캐릭터가 공통으로 사용하는 파일/디렉토리 조작 기능.
 */
import fs from 'fs/promises';
import path from 'path';
import type { ToolExecutable, Tool, ToolResult } from './types';

/** FS 도구 정의 + 실행 로직을 생성하여 반환 */
export function createFsTools(): ToolExecutable[] {
  return [
    createReadFileTool(),
    createWriteFileTool(),
    createListDirectoryTool(),
    createCreateDirectoryTool(),
    createDeleteFileTool(),
    createMoveFileTool(),
    createCopyFileTool(),
    createFileInfoTool(),
  ];
}

function createReadFileTool(): ToolExecutable {
  const definition: Tool = {
    name: 'readFile',
    description: '파일 내용을 읽어서 텍스트로 반환합니다. 텍스트 파일만 지원됩니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '읽을 파일의 절대 경로' },
        encoding: { type: 'string', description: '인코딩 (기본: utf-8)', default: 'utf-8' },
      },
      required: ['path'],
    },
  };

  return {
    name: 'readFile',
    definition,
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const encoding = (args.encoding as BufferEncoding) ?? 'utf-8';
      const MAX_READ_BYTES = 50_000;

      const handle = await fs.open(filePath, 'r');
      try {
        const stat = await handle.stat();
        if (stat.size <= MAX_READ_BYTES) {
          const content = await handle.readFile({ encoding });
          return { toolCallId: '', success: true, output: content };
        }
        const buf = Buffer.alloc(MAX_READ_BYTES);
        const { bytesRead } = await handle.read(buf, 0, MAX_READ_BYTES, 0);
        const content = buf.subarray(0, bytesRead).toString(encoding);
        return { toolCallId: '', success: true, output: content + '\n...(truncated)' };
      } finally {
        await handle.close();
      }
    },
  };
}

function createWriteFileTool(): ToolExecutable {
  const definition: Tool = {
    name: 'writeFile',
    description: '파일에 내용을 작성합니다. 파일이 없으면 새로 생성하고, 있으면 덮어씁니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '작성할 파일의 절대 경로' },
        content: { type: 'string', description: '파일에 작성할 내용' },
      },
      required: ['path', 'content'],
    },
  };

  return {
    name: 'writeFile',
    definition,
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const content = args.content as string;
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return {
        toolCallId: '',
        success: true,
        output: `파일이 작성되었습니다: ${filePath} (${Buffer.byteLength(content, 'utf-8')} bytes)`,
      };
    },
  };
}

function createListDirectoryTool(): ToolExecutable {
  const definition: Tool = {
    name: 'listDirectory',
    description: '디렉토리의 파일/폴더 목록을 반환합니다.',
    parameters: {
      type: 'object',
      properties: {
        dirPath: { type: 'string', description: '목록을 조회할 디렉토리 경로' },
      },
      required: ['dirPath'],
    },
  };

  return {
    name: 'listDirectory',
    definition,
    async execute(args): Promise<ToolResult> {
      const dirPath = args.dirPath as string;
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const listing = entries.map((e) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`).join('\n');
      return { toolCallId: '', success: true, output: listing || '(빈 디렉토리)' };
    },
  };
}

function createCreateDirectoryTool(): ToolExecutable {
  const definition: Tool = {
    name: 'createDirectory',
    description: '디렉토리를 생성합니다. 중간 경로도 함께 생성됩니다.',
    parameters: {
      type: 'object',
      properties: {
        dirPath: { type: 'string', description: '생성할 디렉토리 경로' },
      },
      required: ['dirPath'],
    },
  };

  return {
    name: 'createDirectory',
    definition,
    async execute(args): Promise<ToolResult> {
      const dirPath = args.dirPath as string;
      await fs.mkdir(dirPath, { recursive: true });
      return { toolCallId: '', success: true, output: `디렉토리가 생성되었습니다: ${dirPath}` };
    },
  };
}

function createDeleteFileTool(): ToolExecutable {
  const definition: Tool = {
    name: 'deleteFile',
    description: '파일 또는 빈 디렉토리를 삭제합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '삭제할 파일/디렉토리 경로' },
      },
      required: ['path'],
    },
  };

  return {
    name: 'deleteFile',
    definition,
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await fs.rmdir(filePath);
      } else {
        await fs.unlink(filePath);
      }
      return { toolCallId: '', success: true, output: `삭제되었습니다: ${filePath}` };
    },
  };
}

function createMoveFileTool(): ToolExecutable {
  const definition: Tool = {
    name: 'moveFile',
    description: '파일 또는 디렉토리를 이동(이름 변경)합니다.',
    parameters: {
      type: 'object',
      properties: {
        sourcePath: { type: 'string', description: '원본 경로' },
        targetPath: { type: 'string', description: '대상 경로' },
      },
      required: ['sourcePath', 'targetPath'],
    },
  };

  return {
    name: 'moveFile',
    definition,
    async execute(args): Promise<ToolResult> {
      const src = args.sourcePath as string;
      const dst = args.targetPath as string;
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.rename(src, dst);
      return { toolCallId: '', success: true, output: `이동 완료: ${src} → ${dst}` };
    },
  };
}

function createCopyFileTool(): ToolExecutable {
  const definition: Tool = {
    name: 'copyFile',
    description: '파일을 복사합니다.',
    parameters: {
      type: 'object',
      properties: {
        sourcePath: { type: 'string', description: '원본 파일 경로' },
        targetPath: { type: 'string', description: '복사 대상 경로' },
      },
      required: ['sourcePath', 'targetPath'],
    },
  };

  return {
    name: 'copyFile',
    definition,
    async execute(args): Promise<ToolResult> {
      const src = args.sourcePath as string;
      const dst = args.targetPath as string;
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
      return { toolCallId: '', success: true, output: `복사 완료: ${src} → ${dst}` };
    },
  };
}

function createFileInfoTool(): ToolExecutable {
  const definition: Tool = {
    name: 'fileInfo',
    description: '파일/디렉토리의 메타정보(크기, 수정일 등)를 반환합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '정보를 조회할 파일/디렉토리 경로' },
      },
      required: ['path'],
    },
  };

  return {
    name: 'fileInfo',
    definition,
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const stat = await fs.stat(filePath);
      const info = [
        `경로: ${filePath}`,
        `유형: ${stat.isDirectory() ? '디렉토리' : '파일'}`,
        `크기: ${stat.size} bytes`,
        `생성일: ${stat.birthtime.toISOString()}`,
        `수정일: ${stat.mtime.toISOString()}`,
      ].join('\n');
      return { toolCallId: '', success: true, output: info };
    },
  };
}
