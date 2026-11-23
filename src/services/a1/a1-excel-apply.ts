import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { getNextMissionCode } from '@/components/excel-grid/excel-grid-code-helpers';
import { A1ImportCandidateRow, A1ImportPreviewResult } from './a1-excel-types';

/**
 * Áp dụng kết quả xem trước nhập Biểu A1 kèm quyết định xử lý từng dòng trùng nội dung.
 */
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
