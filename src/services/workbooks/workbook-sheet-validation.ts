import { EXCEL_SHEET_METAS } from '@/components/excel-grid/excel-sheet-metas';
import { ExcelColumnDef, ExcelSheetKey, GenericGridRow } from '@/components/excel-grid/excel-grid-types';

export interface SheetCellErrorEntry {
  sheetKey: ExcelSheetKey;
  rowId: string;
  rowIndex: number;
  field: string;
  colLetter: string;
  headerName: string;
  message: string;
}

export interface SheetValidationResult {
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  cellErrors: Record<string, string>;
  entries: SheetCellErrorEntry[];
  firstErrorCellKey?: string;
}

function isEditableRequiredColumn(col: ExcelColumnDef): boolean {
  return Boolean(col.required) && !col.isFormula && !col.readOnly && col.type !== 'status';
}

function isCellValueMissing(val: unknown): boolean {
  if (val === 0) return false;
  if (val === undefined || val === null) return true;
  return String(val).trim() === '';
}

/**
 * Kiểm tra toàn bộ trường bắt buộc (ô nhập & dropdown) cho các dòng MỚI trên một biểu.
 * Dòng cũ đã tồn tại trên hồ sơ (khớp theo id) không bị chặn để bảo toàn tương thích ngược.
 */
export function validateNewSheetRowsForSave(params: {
  sheetKey: ExcelSheetKey;
  incomingRows: GenericGridRow[];
  existingRows?: GenericGridRow[];
}): SheetValidationResult {
  const meta = EXCEL_SHEET_METAS[params.sheetKey];
  if (!meta) return { ok: true, status: 200, cellErrors: {}, entries: [] };

  const requiredCols = meta.columns.filter(isEditableRequiredColumn);
  if (requiredCols.length === 0) return { ok: true, status: 200, cellErrors: {}, entries: [] };

  const existing = Array.isArray(params.existingRows) ? params.existingRows : [];
  const existingIds = new Set(existing.map((r) => String(r.id || '').trim()).filter(Boolean));

  const cellErrors: Record<string, string> = {};
  const entries: SheetCellErrorEntry[] = [];
  let firstErrorCellKey: string | undefined;

  (params.incomingRows || []).forEach((row, idx) => {
    const rowId = String(row.id || `${params.sheetKey.toLowerCase()}-${idx + 1}`);
    if (existingIds.has(rowId)) return;

    for (const col of requiredCols) {
      const raw = row[col.field];
      const key = `${rowId}_${col.field}`;
      let msg = '';

      if (isCellValueMissing(raw)) {
        const isDropdown = col.type === 'select' || Boolean(col.dynamicOptionsKey);
        msg = isDropdown ? `Bắt buộc chọn ${col.headerName}` : `Bắt buộc nhập ${col.headerName}`;
      } else if (col.selectOptions && col.selectOptions.length > 0 && !col.allowCustom) {
        const clean = String(raw).trim();
        if (!col.selectOptions.includes(clean)) {
          msg = `${col.headerName} không nằm trong danh mục cho phép`;
        }
      }

      if (msg) {
        cellErrors[key] = msg;
        if (!firstErrorCellKey) firstErrorCellKey = key;
        entries.push({
          sheetKey: params.sheetKey,
          rowId,
          rowIndex: idx,
          field: col.field,
          colLetter: col.colLetter,
          headerName: col.headerName,
          message: msg
        });
      }
    }
  });

  if (entries.length > 0) {
    const first = entries[0];
    return {
      ok: false,
      status: 400,
      code: 'SHEET_VALIDATION_FAILED',
      error: `Biểu ${meta.shortLabel} dòng ${first.rowIndex + 1} chưa đủ thông tin: ${first.message}.`,
      cellErrors,
      entries,
      firstErrorCellKey
    };
  }

  return { ok: true, status: 200, cellErrors: {}, entries: [] };
}
