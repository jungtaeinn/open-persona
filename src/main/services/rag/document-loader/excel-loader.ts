/**
 * Excel (.xlsx) 파서.
 * ExcelJS로 시트별로 파싱하여 Markdown 테이블로 변환한다.
 */
import ExcelJS from 'exceljs';
import type { ParsedDocument, DocumentSection } from '../types';

export async function loadExcel(filePath: string): Promise<ParsedDocument> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sections: DocumentSection[] = [];

  workbook.eachSheet((sheet) => {
    const rows: string[][] = [];
    let maxCols = 0;

    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cells.push(cellToString(cell));
      });
      if (cells.length > maxCols) maxCols = cells.length;
      rows.push(cells);
    });

    if (rows.length === 0) return;

    // 각 행의 열 수를 maxCols에 맞춤
    const normalized = rows.map((row) => {
      while (row.length < maxCols) row.push('');
      return row;
    });

    const markdown = toMarkdownTable(normalized);

    sections.push({
      title: sheet.name,
      content: `## ${sheet.name}\n\n${markdown}`,
      metadata: { sheetName: sheet.name, rowCount: rows.length, colCount: maxCols },
    });
  });

  return {
    sourcePath: filePath,
    content: sections.map((s) => s.content).join('\n\n---\n\n'),
    sections,
  };
}

function cellToString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return '';
  if (cell.type === ExcelJS.ValueType.Formula) {
    return String(cell.result ?? '');
  }
  return String(cell.value);
}

function toMarkdownTable(rows: string[][]): string {
  if (rows.length === 0) return '';

  const header = rows[0];
  const separator = header.map(() => '---');
  const dataRows = rows.slice(1);

  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...dataRows.map((row) => `| ${row.join(' | ')} |`),
  ];

  return lines.join('\n');
}
