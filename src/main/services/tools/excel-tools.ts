/**
 * Excel 전용 도구 모음.
 * ExcelJS를 활용하여 .xlsx 파일을 읽고, 쿼리하고, 생성한다.
 * LLM이 엑셀 데이터를 이해하고 조작할 수 있게 한다.
 */
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';
import type { ToolExecutable, Tool, ToolResult } from './types';

const MAX_PREVIEW_ROWS = 200;

export function createExcelTools(): ToolExecutable[] {
  return [
    createReadExcelTool(),
    createWriteExcelTool(),
    createQueryExcelTool(),
  ];
}

function cellToString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return '';
  if (cell.type === ExcelJS.ValueType.Formula) {
    return String(cell.result ?? '');
  }
  if (cell.value instanceof Date) {
    return cell.value.toISOString().split('T')[0];
  }
  return String(cell.value);
}

/**
 * readExcel: .xlsx 파일을 읽어 시트별 구조와 데이터를 Markdown 테이블로 반환.
 */
function createReadExcelTool(): ToolExecutable {
  const definition: Tool = {
    name: 'readExcel',
    description:
      'Excel(.xlsx) 파일을 읽어서 시트별 구조(시트명, 컬럼, 행 수)와 데이터를 Markdown 테이블로 반환합니다. 최대 200행까지 미리보기합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '읽을 .xlsx 파일의 절대 경로' },
        sheetName: {
          type: 'string',
          description: '특정 시트만 읽을 경우 시트 이름 (생략 시 모든 시트)',
        },
      },
      required: ['path'],
    },
  };

  return {
    name: 'readExcel',
    definition,
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const targetSheet = args.sheetName as string | undefined;

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sheetNames = workbook.worksheets.map((s) => s.name);
      const results: string[] = [
        `📊 파일: ${path.basename(filePath)}`,
        `📋 시트 목록: ${sheetNames.join(', ')}`,
        '',
      ];

      const sheetsToRead = targetSheet
        ? workbook.worksheets.filter((s) => s.name === targetSheet)
        : workbook.worksheets;

      if (targetSheet && sheetsToRead.length === 0) {
        return {
          toolCallId: '',
          success: false,
          output: '',
          error: `시트 "${targetSheet}"을 찾을 수 없습니다. 사용 가능: ${sheetNames.join(', ')}`,
        };
      }

      for (const sheet of sheetsToRead) {
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

        if (rows.length === 0) {
          results.push(`### ${sheet.name}\n(빈 시트)\n`);
          continue;
        }

        const normalized = rows.map((row) => {
          while (row.length < maxCols) row.push('');
          return row;
        });

        const totalRows = normalized.length - 1;
        const preview = normalized.slice(0, MAX_PREVIEW_ROWS + 1);
        const truncated = totalRows > MAX_PREVIEW_ROWS;

        const header = preview[0];
        const separator = header.map(() => '---');
        const dataRows = preview.slice(1);

        const table = [
          `| ${header.join(' | ')} |`,
          `| ${separator.join(' | ')} |`,
          ...dataRows.map((r) => `| ${r.join(' | ')} |`),
        ].join('\n');

        results.push(`### ${sheet.name} (${totalRows}행 × ${maxCols}열)`);
        results.push(`컬럼: ${header.join(', ')}`);
        results.push('');
        results.push(table);
        if (truncated) {
          results.push(`\n... (총 ${totalRows}행 중 ${MAX_PREVIEW_ROWS}행만 표시)`);
        }
        results.push('');
      }

      return { toolCallId: '', success: true, output: results.join('\n') };
    },
  };
}

/**
 * writeExcel: JSON 데이터로 .xlsx 파일을 생성.
 * sheets 배열에 시트별 데이터를 전달하면 엑셀 파일을 만든다.
 */
function createWriteExcelTool(): ToolExecutable {
  const definition: Tool = {
    name: 'writeExcel',
    description:
      'Excel(.xlsx) 파일을 생성합니다. JSON 형식으로 시트 이름, 컬럼 헤더, 행 데이터를 전달합니다. 여러 시트도 지원합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '생성할 .xlsx 파일의 절대 경로' },
        sheets: {
          type: 'array',
          description:
            '시트 배열. 각 시트는 { name: "시트명", headers: ["컬럼1","컬럼2"], rows: [["값1","값2"], ...], columnWidths?: [15, 20] } 형태',
          items: {
            type: 'object',
            description: '시트 데이터',
            properties: {
              name: { type: 'string', description: '시트 이름' },
              headers: { type: 'array', description: '컬럼 헤더 배열', items: { type: 'string' } },
              rows: { type: 'array', description: '행 데이터 배열 (2차원)', items: { type: 'array', items: { type: 'string' } } },
              columnWidths: { type: 'array', description: '컬럼 너비 배열 (선택)', items: { type: 'number' } },
            },
          },
        },
      },
      required: ['path', 'sheets'],
    },
  };

  return {
    name: 'writeExcel',
    definition,
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const sheets = args.sheets as Array<{
        name: string;
        headers: string[];
        rows: unknown[][];
        columnWidths?: number[];
      }>;

      if (!sheets || sheets.length === 0) {
        return {
          toolCallId: '',
          success: false,
          output: '',
          error: 'sheets 배열이 비어 있습니다.',
        };
      }

      const workbook = new ExcelJS.Workbook();
      let totalRows = 0;

      for (const sheetData of sheets) {
        const sheet = workbook.addWorksheet(sheetData.name);

        if (sheetData.headers && sheetData.headers.length > 0) {
          const headerRow = sheet.addRow(sheetData.headers);
          headerRow.font = { bold: true };
          headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' },
          };
        }

        if (sheetData.columnWidths) {
          sheetData.columnWidths.forEach((w, i) => {
            const col = sheet.getColumn(i + 1);
            col.width = w;
          });
        } else if (sheetData.headers) {
          sheetData.headers.forEach((h, i) => {
            const col = sheet.getColumn(i + 1);
            col.width = Math.max(h.length * 2, 12);
          });
        }

        if (sheetData.rows) {
          for (const row of sheetData.rows) {
            sheet.addRow(row);
            totalRows++;
          }
        }

        sheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: sheetData.headers?.length ?? 1 },
        };
      }

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await workbook.xlsx.writeFile(filePath);

      const info = sheets
        .map((s) => `"${s.name}" (${s.rows?.length ?? 0}행)`)
        .join(', ');

      return {
        toolCallId: '',
        success: true,
        output: `Excel 파일이 생성되었습니다: ${filePath}\n시트: ${info}\n총 ${totalRows}행 작성됨`,
      };
    },
  };
}

/**
 * queryExcel: 엑셀 파일에서 조건에 맞는 행만 필터링하여 반환하거나 새 파일로 저장.
 */
function createQueryExcelTool(): ToolExecutable {
  const definition: Tool = {
    name: 'queryExcel',
    description:
      'Excel(.xlsx) 파일에서 특정 조건으로 행을 필터링합니다. 결과를 텍스트로 반환하거나 새 .xlsx 파일로 저장할 수 있습니다. ' +
      '조건 연산자: eq(같음), neq(다름), contains(포함), gt(초과), gte(이상), lt(미만), lte(이하), empty(비어있음), notEmpty(비어있지 않음)',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '읽을 .xlsx 파일의 절대 경로' },
        sheetName: {
          type: 'string',
          description: '필터링할 시트 이름 (생략 시 첫 번째 시트)',
        },
        column: {
          type: 'string',
          description: '필터링 기준 컬럼명 (헤더 이름)',
        },
        operator: {
          type: 'string',
          description: '비교 연산자: eq, neq, contains, gt, gte, lt, lte, empty, notEmpty',
          enum: ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'empty', 'notEmpty'],
        },
        value: {
          type: 'string',
          description: '비교할 값 (empty/notEmpty 연산자에서는 불필요)',
        },
        outputPath: {
          type: 'string',
          description: '필터 결과를 저장할 .xlsx 파일 경로 (생략 시 텍스트로만 반환)',
        },
      },
      required: ['path', 'column', 'operator'],
    },
  };

  return {
    name: 'queryExcel',
    definition,
    async execute(args): Promise<ToolResult> {
      const filePath = args.path as string;
      const targetSheet = args.sheetName as string | undefined;
      const column = args.column as string;
      const operator = args.operator as string;
      const compareValue = args.value as string | undefined;
      const outputPath = args.outputPath as string | undefined;

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sheet = targetSheet
        ? workbook.getWorksheet(targetSheet)
        : workbook.worksheets[0];

      if (!sheet) {
        return {
          toolCallId: '',
          success: false,
          output: '',
          error: `시트를 찾을 수 없습니다.`,
        };
      }

      const headers: string[] = [];
      const headerRow = sheet.getRow(1);
      headerRow.eachCell({ includeEmpty: true }, (cell) => {
        headers.push(cellToString(cell));
      });

      const colIndex = headers.findIndex(
        (h) => h.trim().toLowerCase() === column.trim().toLowerCase(),
      );
      if (colIndex === -1) {
        return {
          toolCallId: '',
          success: false,
          output: '',
          error: `컬럼 "${column}"을 찾을 수 없습니다. 사용 가능: ${headers.join(', ')}`,
        };
      }

      const matchedRows: string[][] = [];
      const unmatchedRows: string[][] = [];

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          cells.push(cellToString(cell));
        });
        while (cells.length < headers.length) cells.push('');

        const cellValue = cells[colIndex] ?? '';
        const matches = evaluateCondition(cellValue, operator, compareValue);

        if (matches) {
          matchedRows.push(cells);
        } else {
          unmatchedRows.push(cells);
        }
      });

      if (outputPath) {
        const outWorkbook = new ExcelJS.Workbook();
        const outSheet = outWorkbook.addWorksheet(sheet.name);

        const outHeaderRow = outSheet.addRow(headers);
        outHeaderRow.font = { bold: true };
        outHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' },
        };
        headers.forEach((h, i) => {
          outSheet.getColumn(i + 1).width = Math.max(h.length * 2, 12);
        });

        for (const row of matchedRows) {
          outSheet.addRow(row);
        }

        outSheet.autoFilter = {
          from: { row: 1, column: 1 },
          to: { row: 1, column: headers.length },
        };

        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await outWorkbook.xlsx.writeFile(outputPath);

        return {
          toolCallId: '',
          success: true,
          output: [
            `필터 결과: ${matchedRows.length}행 일치 / ${unmatchedRows.length}행 미일치 (전체 ${matchedRows.length + unmatchedRows.length}행)`,
            `조건: "${column}" ${operator} ${compareValue ?? ''}`,
            `저장됨: ${outputPath}`,
          ].join('\n'),
        };
      }

      const preview = matchedRows.slice(0, 50);
      const separator = headers.map(() => '---');
      const table = [
        `| ${headers.join(' | ')} |`,
        `| ${separator.join(' | ')} |`,
        ...preview.map((r) => `| ${r.join(' | ')} |`),
      ].join('\n');

      return {
        toolCallId: '',
        success: true,
        output: [
          `필터 결과: ${matchedRows.length}행 일치 / ${unmatchedRows.length}행 미일치`,
          `조건: "${column}" ${operator} ${compareValue ?? ''}`,
          '',
          table,
          matchedRows.length > 50
            ? `\n... (총 ${matchedRows.length}행 중 50행만 표시)`
            : '',
        ].join('\n'),
      };
    },
  };
}

function evaluateCondition(
  cellValue: string,
  operator: string,
  compareValue: string | undefined,
): boolean {
  const v = cellValue.trim();
  const c = (compareValue ?? '').trim();

  switch (operator) {
    case 'eq':
      return v.toLowerCase() === c.toLowerCase();
    case 'neq':
      return v.toLowerCase() !== c.toLowerCase();
    case 'contains':
      return v.toLowerCase().includes(c.toLowerCase());
    case 'gt':
      return parseFloat(v) > parseFloat(c);
    case 'gte':
      return parseFloat(v) >= parseFloat(c);
    case 'lt':
      return parseFloat(v) < parseFloat(c);
    case 'lte':
      return parseFloat(v) <= parseFloat(c);
    case 'empty':
      return v === '';
    case 'notEmpty':
      return v !== '';
    default:
      return false;
  }
}
