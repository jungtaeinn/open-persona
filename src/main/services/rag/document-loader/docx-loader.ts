/**
 * Word (.docx) 파서.
 * Mammoth로 HTML 변환 후 Markdown으로 정리한다.
 */
import mammoth from 'mammoth';
import type { ParsedDocument, DocumentSection } from '../types';

export async function loadDocx(filePath: string): Promise<ParsedDocument> {
  const result = await mammoth.convertToHtml({ path: filePath });
  const content = htmlToBasicMarkdown(result.value);

  const sections = splitByHeadings(content);

  return {
    sourcePath: filePath,
    content,
    sections,
  };
}

/** HTML → 간단한 Markdown 변환 */
function htmlToBasicMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Markdown 헤딩으로 섹션 분리 */
function splitByHeadings(md: string): DocumentSection[] {
  const lines = md.split('\n');
  const sections: DocumentSection[] = [];
  let currentTitle = 'Introduction';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        sections.push({
          title: currentTitle,
          content: currentLines.join('\n').trim(),
        });
      }
      currentTitle = headingMatch[2];
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentLines.join('\n').trim(),
    });
  }

  return sections.filter((s) => s.content.length > 0);
}
