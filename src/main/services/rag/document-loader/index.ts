/**
 * 통합 문서 로더.
 * 파일 확장자에 따라 적절한 파서를 선택한다.
 */
import path from 'path';
import { readFile } from 'fs/promises';
import type { ParsedDocument } from '../types';
import { loadExcel } from './excel-loader';
import { loadDocx } from './docx-loader';

const SUPPORTED_EXTENSIONS = new Set(['.xlsx', '.xls', '.docx', '.md', '.txt', '.json']);

export async function loadDocument(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.xlsx':
    case '.xls':
      return loadExcel(filePath);

    case '.docx':
      return loadDocx(filePath);

    case '.md':
    case '.txt':
      return loadTextFile(filePath, ext);

    case '.json':
      return loadJsonFile(filePath);

    default:
      throw new Error(`지원하지 않는 파일 형식: ${ext} (지원: ${[...SUPPORTED_EXTENSIONS].join(', ')})`);
  }
}

async function loadTextFile(filePath: string, ext: string): Promise<ParsedDocument> {
  const content = await readFile(filePath, 'utf-8');

  return {
    sourcePath: filePath,
    content,
    sections: [
      {
        title: path.basename(filePath, ext),
        content,
      },
    ],
  };
}

async function loadJsonFile(filePath: string): Promise<ParsedDocument> {
  const raw = await readFile(filePath, 'utf-8');
  const data = JSON.parse(raw);

  // JSON 배열: 각 항목을 섹션으로 분리
  if (Array.isArray(data)) {
    return {
      sourcePath: filePath,
      content: raw,
      sections: data.map((item, i) => ({
        title: item.title ?? `Item ${i + 1}`,
        content: typeof item === 'string' ? item : JSON.stringify(item, null, 2),
        metadata: { index: i },
      })),
    };
  }

  // JSON 객체: 최상위 키를 섹션으로
  return {
    sourcePath: filePath,
    content: raw,
    sections: Object.entries(data).map(([key, value]) => ({
      title: key,
      content: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    })),
  };
}

export function isSupportedDocument(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
