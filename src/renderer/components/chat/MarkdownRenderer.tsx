/**
 * 경량 Markdown → JSX 렌더러.
 * 외부 라이브러리 없이 볼드, 이탤릭, 인라인 코드, 코드 블록,
 * 테이블, 리스트, 헤딩을 렌더링한다.
 */
import React from 'react';

interface Props {
  text: string;
  accentColor?: string;
}

export function MarkdownRenderer({ text, accentColor = '#60a5fa' }: Props) {
  const blocks = parseBlocks(text);

  return (
    <div style={{ fontSize: '13px', lineHeight: '1.65', color: 'rgba(255,255,255,0.92)', wordBreak: 'break-word' }}>
      {blocks.map((block, i) => (
        <React.Fragment key={i}>{renderBlock(block, accentColor)}</React.Fragment>
      ))}
    </div>
  );
}

type Block =
  | { type: 'paragraph'; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'code'; lang: string; content: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'list'; ordered: boolean; items: string[] };

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'code', lang, content: codeLines.join('\n') });
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = parseTableCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(parseTableCells(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    if (line.trim() === '' || line.trim() === '---') {
      i++;
      continue;
    }

    let paragraph = line;
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !lines[i].match(/^#{1,4}\s/) &&
      !isTableRow(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      lines[i].trim() !== '---'
    ) {
      paragraph += '\n' + lines[i];
      i++;
    }

    blocks.push({ type: 'paragraph', content: paragraph });
  }

  return blocks;
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:]*-+[\s:|-]*\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function renderBlock(block: Block, color: string): React.ReactNode {
  switch (block.type) {
    case 'heading':
      return renderHeading(block, color);
    case 'code':
      return renderCodeBlock(block);
    case 'table':
      return renderTable(block, color);
    case 'list':
      return renderList(block);
    case 'paragraph':
      return <p style={{ margin: '4px 0' }}>{renderInline(block.content)}</p>;
  }
}

function renderHeading(block: { level: number; content: string }, color: string) {
  const sizes: Record<number, string> = { 1: '16px', 2: '14.5px', 3: '13.5px', 4: '13px' };
  return (
    <div style={{
      fontSize: sizes[block.level] ?? '13px',
      fontWeight: 700,
      color,
      margin: '8px 0 4px',
    }}>
      {renderInline(block.content)}
    </div>
  );
}

function renderCodeBlock(block: { lang: string; content: string }) {
  return (
    <pre style={{
      margin: '6px 0',
      padding: '8px 10px',
      borderRadius: '8px',
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.08)',
      fontSize: '11.5px',
      lineHeight: '1.5',
      overflowX: 'auto',
      fontFamily: "'SF Mono', 'Fira Code', monospace",
      color: 'rgba(255,255,255,0.85)',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }}>
      {block.content}
    </pre>
  );
}

function renderTable(block: { headers: string[]; rows: string[][] }, color: string) {
  return (
    <div style={{ margin: '6px 0', overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '11.5px',
        lineHeight: '1.5',
      }}>
        <thead>
          <tr>
            {block.headers.map((h, i) => (
              <th key={i} style={{
                padding: '6px 10px',
                textAlign: 'left',
                fontWeight: 700,
                color,
                background: 'rgba(255,255,255,0.06)',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                whiteSpace: 'nowrap',
              }}>
                {renderInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '5px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.85)',
                }}>
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderList(block: { ordered: boolean; items: string[] }) {
  const Tag = block.ordered ? 'ol' : 'ul';
  return (
    <Tag style={{
      margin: '4px 0',
      paddingLeft: '20px',
      listStyleType: block.ordered ? 'decimal' : 'disc',
    }}>
      {block.items.map((item, i) => (
        <li key={i} style={{ margin: '2px 0', color: 'rgba(255,255,255,0.88)' }}>
          {renderInline(item)}
        </li>
      ))}
    </Tag>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(<strong key={match.index} style={{ fontWeight: 700, color: 'rgba(255,255,255,1)' }}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.95)' }}>{match[4]}</em>);
    } else if (match[5]) {
      parts.push(
        <code key={match.index} style={{
          padding: '1px 5px',
          borderRadius: '4px',
          background: 'rgba(255,255,255,0.1)',
          fontSize: '11.5px',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          color: 'rgba(255,255,255,0.95)',
        }}>
          {match[6]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 0 ? text : parts;
}
