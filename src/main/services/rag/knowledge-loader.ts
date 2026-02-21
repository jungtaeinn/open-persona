/**
 * 정적 지식 로더.
 * 앱 시작 시 assets/knowledge/ 디렉토리의 Markdown 파일을 읽어
 * 캐릭터별 Vectra static 인덱스에 로드한다.
 * 임베딩 모델이 변경되면 기존 인덱스를 삭제하고 재생성한다.
 */
import path from 'path';
import fs from 'fs/promises';
import { app } from 'electron';
import type { RAGEngine } from './rag-engine';
import { splitMarkdownIntoSections, chunkSections } from './chunker';

/** 캐릭터 ID → 지식 디렉토리 매핑 */
const CHARACTER_KNOWLEDGE: Record<string, string> = {
  pig: 'pig',
  fox: 'fox',
  rabbit: 'rabbit',
};

/**
 * 모든 캐릭터의 정적 지식을 로드한다.
 * 이미 인덱스가 존재하면 건너뛴다 (최초 1회만 로드).
 * 개별 파일/캐릭터 로드 실패 시에도 나머지를 계속 진행한다.
 */
export async function loadStaticKnowledge(ragEngine: RAGEngine): Promise<void> {
  const knowledgeRoot = getKnowledgeRoot();

  for (const [characterId, dirName] of Object.entries(CHARACTER_KNOWLEDGE)) {
    const charDir = path.join(knowledgeRoot, dirName);

    try {
      const stats = await ragEngine.getStats(characterId);
      if (stats.static.count > 0) {
        console.log(`[KnowledgeLoader] ${characterId}: 이미 ${stats.static.count}개 청크 로드됨, 건너뜀`);
        continue;
      }
    } catch {
      // 인덱스가 아직 없으면 계속 진행
    }

    try {
      await fs.access(charDir);
    } catch {
      console.log(`[KnowledgeLoader] ${characterId}: 지식 디렉토리 없음 (${charDir}), 건너뜀`);
      continue;
    }

    try {
      const totalChunks = await loadDirectoryRecursive(
        ragEngine,
        characterId,
        charDir,
        charDir,
      );
      console.log(`[KnowledgeLoader] ${characterId}: ${totalChunks}개 청크 로드 완료`);
    } catch (err) {
      console.warn(
        `[KnowledgeLoader] ${characterId}: 지식 로드 중 오류 발생 (건너뜀)`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/** 배치 크기: 임베딩 API 호출 횟수를 줄이기 위해 파일들을 배치 단위로 묶어 처리 */
const BATCH_CONCURRENCY = 3;

/** 디렉토리를 재귀적으로 탐색하여 .md 파일을 인덱싱 */
async function loadDirectoryRecursive(
  ragEngine: RAGEngine,
  characterId: string,
  rootDir: string,
  currentDir: string,
): Promise<number> {
  const allFiles = await collectMarkdownFiles(rootDir, currentDir);

  let totalChunks = 0;
  for (let i = 0; i < allFiles.length; i += BATCH_CONCURRENCY) {
    const batch = allFiles.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((file) => loadSingleFile(ragEngine, characterId, rootDir, file)),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalChunks += result.value;
      } else {
        console.warn(
          `[KnowledgeLoader] 파일 로드 실패 (건너뜀):`,
          result.reason instanceof Error ? result.reason.message : result.reason,
        );
      }
    }
  }

  return totalChunks;
}

async function collectMarkdownFiles(rootDir: string, currentDir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(rootDir, fullPath));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function loadSingleFile(
  ragEngine: RAGEngine,
  characterId: string,
  rootDir: string,
  fullPath: string,
): Promise<number> {
  const content = await fs.readFile(fullPath, 'utf-8');
  const relativePath = path.relative(rootDir, fullPath);
  const category = path.dirname(relativePath).split(path.sep)[0] || 'general';
  const sourceUri = `knowledge://${characterId}/${relativePath}`;

  const sections = splitMarkdownIntoSections(content, path.basename(fullPath));
  const rawChunks = chunkSections(
    sections,
    { sourceUri, characterId, category, sourceType: 'static' },
    { maxTokens: 500, overlapTokens: 50 },
  );

  return ragEngine.indexChunks(characterId, rawChunks, 'static');
}

function getKnowledgeRoot(): string {
  // 개발 모드에서는 프로젝트 루트의 assets/knowledge
  // 프로덕션에서는 앱 리소스 디렉토리
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', 'knowledge');
  }
  return path.join(app.getAppPath(), 'assets', 'knowledge');
}
