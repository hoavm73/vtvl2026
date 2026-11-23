import * as XLSX from 'xlsx';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { getNextMissionCode } from '@/components/excel-grid/excel-grid-code-helpers';
import {
  A1_DEFAULT_PERIOD,
  A1_HEADERS,
  A1_SHEET_NAME,
  A1_FIELD_META,
  A1_REQUIRED_FIELDS,
  diffA1ContentFields,
  normalizeA1ContentSignature,
  trimA1Value,
  validateA1Row
} from './a1-validation';

import {
  A1ImportCandidateRow,
  A1ImportConflictRow,
  A1ImportDuplicateContentRow,
  A1ImportPreviewResult,
  A1ImportRowError
} from './a1-excel-types';

export type {
  A1ImportCandidateRow,
  A1ImportConflictRow,
  A1ImportDuplicateContentRow,
  A1ImportPreviewResult,
  A1ImportRowError
};

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
  const emptySummary = { totalRead: 0, newCount: 0, unchangedCount: 0, duplicateContentCount: 0, conflictCount: 0, errorCount: 0 };
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(params.buffer, { type: 'array' });
  } catch {
    return {
      ok: false, sheetFound: false, fatalError: 'Không thể đọc tệp Excel (.xlsx). Vui lòng kiểm tra định dạng tệp.',
      summary: emptySummary, newRows: [], duplicateContentRows: [], unchangedRows: [], conflictRows: [], errorRows: []
    };
  }

  const sheetName = wb.SheetNames.find((n) => n.trim() === A1_SHEET_NAME);
  if (!sheetName) {
    return {
      ok: false, sheetFound: false,
      fatalError: `Không tìm thấy sheet "${A1_SHEET_NAME}" trong tệp tải lên.`,
      summary: emptySummary, newRows: [], duplicateContentRows: [], unchangedRows: [], conflictRows: [], errorRows: []
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
      summary: emptySummary, newRows: [], duplicateContentRows: [], unchangedRows: [], conflictRows: [], errorRows: []
    };
  }

  const unitUpper = params.unitCode.trim().toUpperCase();
  const existingByCode = new Map<string, GenericGridRow>();
  const existingBySig = new Map<string, GenericGridRow>();
  const existingByName = new Map<string, GenericGridRow>();
  for (const r of params.existingA1 || []) {
    const c = trimA1Value(r.maNhiemVu).toUpperCase();
    if (c) existingByCode.set(c, r);
    const sig = normalizeA1ContentSignature(r);
    if (sig.replace(/\u001f/g, '')) existingBySig.set(sig, r);
    const nm = trimA1Value(r.tenNhiemVu).toLowerCase().replace(/\s+/g, ' ');
    if (nm) existingByName.set(nm, r);
  }

  const virtualRows: GenericGridRow[] = [...(params.existingA1 || [])];
  const seenInFile = new Map<string, number>();
  const newRows: A1ImportCandidateRow[] = [];
  const duplicateContentRows: A1ImportDuplicateContentRow[] = [];
  const unchangedRows: { excelRow: number; maNhiemVu: string }[] = [];
  const conflictRows: A1ImportConflictRow[] = [];
  const errorRows: A1ImportRowError[] = [];
  let totalRead = 0;

  for (let i = 2; i < matrix.length; i += 1) {
    const raw = matrix[i] || [];
    const cells = [0, 1, 2, 3, 4, 5, 6].map((idx) => trimA1Value(raw[idx]));
    // Bỏ qua dòng hoàn toàn trống hoặc dòng mẫu chỉ có sẵn Cơ quan / Kỳ mặc định
    const isEmptyOrPrefilledOnly =
      cells[0] === '' && cells[1] === '' && cells[3] === '' && cells[5] === '' && cells[6] === '' &&
      (cells[4] === '' || cells[4] === A1_DEFAULT_PERIOD);
    if (isEmptyOrPrefilledOnly) continue;

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
    const candidate: A1ImportCandidateRow = { excelRow, maNhiemVu, assignedCode, tenNhiemVu, coQuan, canCu, ky, trangThai, nguon };

    // Kiểm tra trùng nội dung với dữ liệu đã nhập trên bảng trước đó (để người dùng xác nhận bỏ qua hoặc thêm mới)
    const sigMatch = existingBySig.get(normalizeA1ContentSignature(rowObj));
    const nameKey = tenNhiemVu.toLowerCase().replace(/\s+/g, ' ');
    const matchedExisting = sigMatch || existingByName.get(nameKey);
    if (matchedExisting) {
      duplicateContentRows.push({
        excelRow,
        matchReason: sigMatch ? 'exact' : 'same_name',
        incoming: candidate,
        existing: {
          maNhiemVu: trimA1Value(matchedExisting.maNhiemVu),
          tenNhiemVu: trimA1Value(matchedExisting.tenNhiemVu),
          coQuan: trimA1Value(matchedExisting.coQuan),
          canCu: trimA1Value(matchedExisting.canCu),
          ky: trimA1Value(matchedExisting.ky),
          trangThai: trimA1Value(matchedExisting.trangThai),
          nguon: trimA1Value(matchedExisting.nguon)
        }
      });
      continue;
    }

    virtualRows.push({ id: `preview-${excelRow}`, maNhiemVu: assignedCode });
    newRows.push(candidate);
  }

  return {
    ok: errorRows.length === 0 && conflictRows.length === 0,
    sheetFound: true,
    summary: {
      totalRead,
      newCount: newRows.length,
      unchangedCount: unchangedRows.length,
      duplicateContentCount: duplicateContentRows.length,
      conflictCount: conflictRows.length,
      errorCount: errorRows.length
    },
    newRows,
    duplicateContentRows,
    unchangedRows,
    conflictRows,
    errorRows
  };
}

export function applyA1ImportPreview(params: {
  preview: A1ImportPreviewResult;
  existingA1: GenericGridRow[];
  unitCode: string;
  duplicateDecisions?: Record<number, 'skip' | 'add_new'>;
}): { ok: boolean; error?: string; nextA1: GenericGridRow[]; addedCount: number; skippedDuplicateCount: number } {
  const { preview, existingA1, unitCode, duplicateDecisions = {} } = params;
  if (!preview.ok || preview.summary.errorCount > 0 || preview.summary.conflictCount > 0) {
    return {
      ok: false,
      error: 'Tệp nhập còn dòng lỗi hoặc xung đột mã nhiệm vụ. Hệ thống không ghi một phần lô.',
      nextA1: existingA1,
      addedCount: 0,
      skippedDuplicateCount: 0
    };
  }

  const nextA1: GenericGridRow[] = [...(existingA1 || [])];
  const unitUpper = unitCode.trim().toUpperCase();
  const ts = Date.now().toString(36);
  let skippedDuplicateCount = 0;

  const approvedDuplicates: A1ImportCandidateRow[] = [];
  for (const dup of preview.duplicateContentRows || []) {
    if (duplicateDecisions[dup.excelRow] === 'add_new') {
      approvedDuplicates.push(dup.incoming);
    } else {
      skippedDuplicateCount += 1;
    }
  }

  const allToAdd = [...preview.newRows, ...approvedDuplicates];
  allToAdd.forEach((item, idx) => {
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

  return { ok: true, nextA1, addedCount: allToAdd.length, skippedDuplicateCount };
}
