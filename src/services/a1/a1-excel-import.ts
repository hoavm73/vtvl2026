import * as XLSX from 'xlsx';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { getNextMissionCode } from '@/components/excel-grid/excel-grid-code-helpers';
import {
  A1_HEADERS,
  A1_SHEET_NAME,
  A1_FIELD_META,
  A1_REQUIRED_FIELDS,
  diffA1ContentFields,
  normalizeA1ContentSignature,
  trimA1Value,
  validateA1Row
} from './a1-validation';

export interface A1ImportRowError {
  excelRow: number;
  colLetter: string;
  field: string;
  maNhiemVu: string;
  message: string;
}

export interface A1ImportConflictRow {
  excelRow: number;
  maNhiemVu: string;
  differingFields: string[];
}

export interface A1ImportCandidateRow {
  excelRow: number;
  maNhiemVu: string;
  assignedCode: string;
  tenNhiemVu: string;
  coQuan: string;
  canCu: string;
  ky: string;
  trangThai: string;
  nguon: string;
}

export interface A1ImportPreviewResult {
  ok: boolean;
  sheetFound: boolean;
  fatalError?: string;
  summary: {
    totalRead: number;
    newCount: number;
    unchangedCount: number;
    conflictCount: number;
    errorCount: number;
  };
  newRows: A1ImportCandidateRow[];
  unchangedRows: { excelRow: number; maNhiemVu: string }[];
  conflictRows: A1ImportConflictRow[];
  errorRows: A1ImportRowError[];
}

function normalizeHeader(val: unknown): string {
  return trimA1Value(val).toLowerCase().replace(/\s+/g, ' ');
}

const EXPECTED_HEADER_PATTERNS: RegExp[] = [
  /mã nhiệm vụ/i,
  /tên nhiệm vụ/i,
  /cơ quan/i,
  /căn cứ/i,
  /^kỳ/i,
  /trạng thái/i,
  /nguồn/i
];

export function parseAndPreviewA1Import(params: {
  buffer: ArrayBuffer | Uint8Array;
  unitCode: string;
  existingA1: GenericGridRow[];
}): A1ImportPreviewResult {
  const emptySummary = { totalRead: 0, newCount: 0, unchangedCount: 0, conflictCount: 0, errorCount: 0 };
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(params.buffer, { type: 'array' });
  } catch {
    return {
      ok: false, sheetFound: false, fatalError: 'Không thể đọc tệp Excel (.xlsx). Vui lòng kiểm tra định dạng tệp.',
      summary: emptySummary, newRows: [], unchangedRows: [], conflictRows: [], errorRows: []
    };
  }

  const sheetName = wb.SheetNames.find((n) => n.trim() === A1_SHEET_NAME);
  if (!sheetName) {
    return {
      ok: false, sheetFound: false,
      fatalError: `Không tìm thấy sheet "${A1_SHEET_NAME}" trong tệp tải lên.`,
      summary: emptySummary, newRows: [], unchangedRows: [], conflictRows: [], errorRows: []
    };
  }

  const ws = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  const headerRow = matrix[1] || [];
  const headerValid = EXPECTED_HEADER_PATTERNS.every((rx, i) => rx.test(normalizeHeader(headerRow[i])));
  if (!headerValid) {
    return {
      ok: false, sheetFound: true,
      fatalError: `Dòng tiêu đề (dòng 2) của sheet "${A1_SHEET_NAME}" không khớp 7 cột chuẩn: ${A1_HEADERS.join(' | ')}.`,
      summary: emptySummary, newRows: [], unchangedRows: [], conflictRows: [], errorRows: []
    };
  }

  const unitUpper = params.unitCode.trim().toUpperCase();
  const existingByCode = new Map<string, GenericGridRow>();
  for (const r of params.existingA1 || []) {
    const c = trimA1Value(r.maNhiemVu).toUpperCase();
    if (c) existingByCode.set(c, r);
  }

  const virtualRows: GenericGridRow[] = [...(params.existingA1 || [])];
  const seenInFile = new Map<string, number>();
  const newRows: A1ImportCandidateRow[] = [];
  const unchangedRows: { excelRow: number; maNhiemVu: string }[] = [];
  const conflictRows: A1ImportConflictRow[] = [];
  const errorRows: A1ImportRowError[] = [];
  let totalRead = 0;

  for (let i = 2; i < matrix.length; i += 1) {
    const raw = matrix[i] || [];
    const cells = [0, 1, 2, 3, 4, 5, 6].map((idx) => trimA1Value(raw[idx]));
    if (cells.every((v) => v === '')) continue;

    totalRead += 1;
    const excelRow = i + 1;
    const [maNhiemVu, tenNhiemVu, coQuan, canCu, ky, trangThai, nguon] = cells;
    const codeUpper = maNhiemVu.toUpperCase();
    const rowObj: Partial<GenericGridRow> = { maNhiemVu, tenNhiemVu, coQuan, canCu, ky, trangThai, nguon };

    if (codeUpper) {
      if (seenInFile.has(codeUpper)) {
        errorRows.push({
          excelRow, colLetter: 'A', field: 'maNhiemVu', maNhiemVu,
          message: `Mã nhiệm vụ "${maNhiemVu}" bị trùng với dòng ${seenInFile.get(codeUpper)} trong cùng tệp.`
        });
        continue;
      }
      seenInFile.set(codeUpper, excelRow);

      const existingMatch = existingByCode.get(codeUpper);
      if (existingMatch) {
        if (normalizeA1ContentSignature(existingMatch) === normalizeA1ContentSignature(rowObj)) {
          unchangedRows.push({ excelRow, maNhiemVu: trimA1Value(existingMatch.maNhiemVu) });
        } else {
          conflictRows.push({
            excelRow,
            maNhiemVu: trimA1Value(existingMatch.maNhiemVu),
            differingFields: diffA1ContentFields(existingMatch, rowObj)
          });
        }
        continue;
      }

      if (codeUpper.includes('.') && !codeUpper.startsWith(`${unitUpper}.`)) {
        errorRows.push({
          excelRow, colLetter: 'A', field: 'maNhiemVu', maNhiemVu,
          message: `Mã nhiệm vụ "${maNhiemVu}" không thuộc đơn vị ${unitUpper}.`
        });
        continue;
      }
    }

    const check = validateA1Row(rowObj);
    if (!check.valid) {
      for (const field of A1_REQUIRED_FIELDS) {
        if (check.errors[field]) {
          errorRows.push({
            excelRow,
            colLetter: A1_FIELD_META[field].colLetter,
            field,
            maNhiemVu: maNhiemVu || '(Cấp tự động)',
            message: check.errors[field]!
          });
        }
      }
      continue;
    }

    const assignedCode = codeUpper || getNextMissionCode(virtualRows, unitUpper);
    virtualRows.push({ id: `preview-${excelRow}`, maNhiemVu: assignedCode });
    newRows.push({ excelRow, maNhiemVu, assignedCode, tenNhiemVu, coQuan, canCu, ky, trangThai, nguon });
  }

  return {
    ok: errorRows.length === 0 && conflictRows.length === 0,
    sheetFound: true,
    summary: {
      totalRead,
      newCount: newRows.length,
      unchangedCount: unchangedRows.length,
      conflictCount: conflictRows.length,
      errorCount: errorRows.length
    },
    newRows,
    unchangedRows,
    conflictRows,
    errorRows
  };
}

export function applyA1ImportPreview(params: {
  preview: A1ImportPreviewResult;
  existingA1: GenericGridRow[];
  unitCode: string;
}): { ok: boolean; error?: string; nextA1: GenericGridRow[]; addedCount: number } {
  const { preview, existingA1, unitCode } = params;
  if (!preview.ok || preview.summary.errorCount > 0 || preview.summary.conflictCount > 0) {
    return {
      ok: false,
      error: 'Tệp nhập còn dòng lỗi hoặc xung đột mã nhiệm vụ. Hệ thống không ghi một phần lô.',
      nextA1: existingA1,
      addedCount: 0
    };
  }

  const nextA1: GenericGridRow[] = [...(existingA1 || [])];
  const unitUpper = unitCode.trim().toUpperCase();
  const ts = Date.now().toString(36);

  preview.newRows.forEach((item, idx) => {
    const finalCode = item.maNhiemVu.trim()
      ? item.maNhiemVu.trim().toUpperCase()
      : getNextMissionCode(nextA1, unitUpper);
    nextA1.push({
      id: `a1-imp-${ts}-${idx + 1}`,
      maNhiemVu: finalCode,
      tenNhiemVu: item.tenNhiemVu,
      coQuan: item.coQuan,
      canCu: item.canCu,
      ky: item.ky,
      trangThai: item.trangThai,
      nguon: item.nguon
    });
  });

  return { ok: true, nextA1, addedCount: preview.newRows.length };
}
