import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import {
  HCMUTE_UNITS,
  INACTIVE_HISTORICAL_UNITS,
  UNIT_CODE_ALIASES,
  findHcmuteUnit
} from '@/configs/hcmute-units';

export const A1_SHEET_NAME = '1. A1_NhiemVu';
export const A1_DEFAULT_PERIOD = '01/10/2025–30/9/2026';

export const A1_HEADERS = [
  'Mã nhiệm vụ',
  'Tên nhiệm vụ',
  'Cơ quan',
  'Căn cứ',
  'Kỳ',
  'Trạng thái',
  'Nguồn'
] as const;

export const A1_STATUS_OPTIONS = [
  'Tiếp tục thực hiện',
  'Mới tiếp nhận',
  'Đã chuyển giao',
  'Không còn thực hiện'
] as const;

export type A1RequiredField = 'tenNhiemVu' | 'coQuan' | 'canCu' | 'ky' | 'trangThai' | 'nguon';

export const A1_FIELD_META: Record<
  A1RequiredField,
  { label: string; colLetter: string; isSelect?: boolean }
> = {
  tenNhiemVu: { label: 'Tên nhiệm vụ', colLetter: 'B' },
  coQuan: { label: 'Cơ quan / Đơn vị thực hiện', colLetter: 'C' },
  canCu: { label: 'Căn cứ giao nhiệm vụ', colLetter: 'D' },
  ky: { label: 'Kỳ số liệu', colLetter: 'E' },
  trangThai: { label: 'Trạng thái', colLetter: 'F', isSelect: true },
  nguon: { label: 'Nguồn dữ liệu / Quyết định', colLetter: 'G' }
};

export const A1_REQUIRED_FIELDS: A1RequiredField[] = [
  'tenNhiemVu',
  'coQuan',
  'canCu',
  'ky',
  'trangThai',
  'nguon'
];

export interface A1RowValidationResult {
  valid: boolean;
  errors: Partial<Record<A1RequiredField | 'maNhiemVu', string>>;
  firstErrorField?: A1RequiredField | 'maNhiemVu';
}

export interface A1CellErrorEntry {
  rowId: string;
  rowIndex: number;
  maNhiemVu: string;
  field: A1RequiredField | 'maNhiemVu';
  colLetter: string;
  message: string;
}

const VALID_STATUS_SET = new Set<string>(A1_STATUS_OPTIONS);

export function trimA1Value(val: unknown): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

export function isValidA1Status(val: unknown): boolean {
  const clean = trimA1Value(val);
  return clean !== '' && VALID_STATUS_SET.has(clean);
}

export function validateA1Row(row: Partial<GenericGridRow>): A1RowValidationResult {
  const errors: Partial<Record<A1RequiredField | 'maNhiemVu', string>> = {};
  let firstErrorField: A1RequiredField | 'maNhiemVu' | undefined;

  for (const field of A1_REQUIRED_FIELDS) {
    const clean = trimA1Value(row[field]);
    const meta = A1_FIELD_META[field];
    if (!clean) {
      errors[field] = meta.isSelect ? `Bắt buộc chọn ${meta.label}` : `Bắt buộc nhập ${meta.label}`;
      if (!firstErrorField) firstErrorField = field;
    } else if (field === 'trangThai' && !VALID_STATUS_SET.has(clean)) {
      errors[field] = `Trạng thái không hợp lệ (chỉ nhận: ${A1_STATUS_OPTIONS.join(', ')})`;
      if (!firstErrorField) firstErrorField = field;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, firstErrorField };
}

export function normalizeA1ContentSignature(row: Partial<GenericGridRow>): string {
  return A1_REQUIRED_FIELDS.map((f) => trimA1Value(row[f]).replace(/\s+/g, ' ')).join('\u001f');
}

export function diffA1ContentFields(
  existing: Partial<GenericGridRow>,
  incoming: Partial<GenericGridRow>
): string[] {
  const diffs: string[] = [];
  for (const f of A1_REQUIRED_FIELDS) {
    const a = trimA1Value(existing[f]).replace(/\s+/g, ' ');
    const b = trimA1Value(incoming[f]).replace(/\s+/g, ' ');
    if (a !== b) diffs.push(A1_FIELD_META[f].label);
  }
  return diffs;
}

export function validateNewA1RowsForSave(params: {
  incomingA1: GenericGridRow[];
  existingA1?: GenericGridRow[];
}): {
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  cellErrors: Record<string, string>;
  entries: A1CellErrorEntry[];
  firstErrorCellKey?: string;
} {
  const existing = Array.isArray(params.existingA1) ? params.existingA1 : [];
  const existingIds = new Set(existing.map((r) => String(r.id || '').trim()).filter(Boolean));
  const existingCodes = new Set(
    existing.map((r) => trimA1Value(r.maNhiemVu).toUpperCase()).filter(Boolean)
  );

  const cellErrors: Record<string, string> = {};
  const entries: A1CellErrorEntry[] = [];
  const seenCodes = new Set<string>();
  let firstErrorCellKey: string | undefined;

  (params.incomingA1 || []).forEach((row, idx) => {
    const rowId = String(row.id || `a1-row-${idx + 1}`);
    const code = trimA1Value(row.maNhiemVu);
    const codeUpper = code.toUpperCase();
    const isLegacyExisting = existingIds.has(rowId) || (Boolean(codeUpper) && existingCodes.has(codeUpper));

    if (codeUpper) {
      if (seenCodes.has(codeUpper) && !isLegacyExisting) {
        const key = `${rowId}_maNhiemVu`;
        const msg = `Mã nhiệm vụ "${code}" bị trùng lặp trong Biểu A1`;
        cellErrors[key] = msg;
        if (!firstErrorCellKey) firstErrorCellKey = key;
        entries.push({ rowId, rowIndex: idx, maNhiemVu: code, field: 'maNhiemVu', colLetter: 'A', message: msg });
      }
      seenCodes.add(codeUpper);
    }

    if (isLegacyExisting) return;

    const check = validateA1Row(row);
    if (!check.valid) {
      for (const field of A1_REQUIRED_FIELDS) {
        const msg = check.errors[field];
        if (!msg) continue;
        const key = `${rowId}_${field}`;
        cellErrors[key] = msg;
        if (!firstErrorCellKey) firstErrorCellKey = key;
        entries.push({
          rowId,
          rowIndex: idx,
          maNhiemVu: code || `Dòng ${idx + 1}`,
          field,
          colLetter: A1_FIELD_META[field].colLetter,
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
      code: 'A1_VALIDATION_FAILED',
      error: `Biểu A1 dòng ${first.rowIndex + 1} (${first.maNhiemVu}) thiếu hoặc sai thông tin: ${first.message}.`,
      cellErrors,
      entries,
      firstErrorCellKey
    };
  }

  return { ok: true, status: 200, cellErrors: {}, entries: [] };
}

function expandAbbreviatedUnitName(name: string): string {
  return name
    .replace(/^\[[A-Za-z0-9_-]+\]\s*/, '')
    .trim()
    .replace(/ĐH\s+CNKT\s+TP\.?HCM/gi, 'Đại học Công nghệ Kỹ thuật Thành phố Hồ Chí Minh');
}

/**
 * Trả về tên tiếng Việt đầy đủ (không viết tắt) của đơn vị cho cột "Cơ quan / Đơn vị thực hiện".
 */
export function resolveFullUnitAgencyName(unitCode: string, fallbackNameVi?: string): string {
  const code = trimA1Value(unitCode).toUpperCase();
  const isKnownUnit =
    HCMUTE_UNITS.some((u) => u.code === code) ||
    Boolean(UNIT_CODE_ALIASES[code]) ||
    Boolean(INACTIVE_HISTORICAL_UNITS[code]) ||
    code === 'BGH';
  const rawName = isKnownUnit
    ? findHcmuteUnit(code).nameVi
    : trimA1Value(fallbackNameVi) || (code ? findHcmuteUnit(code).nameVi : '');
  return expandAbbreviatedUnitName(rawName);
}

/**
 * Chuẩn hóa giá trị ô "Cơ quan / Đơn vị thực hiện": nếu trống hoặc chỉ là mã viết tắt (VD: CTL, TCNS)
 * thì tự động chuyển thành tên đầy đủ của đơn vị.
 */
export function normalizeA1AgencyValue(rawVal: unknown, unitCode: string, fallbackNameVi?: string): string {
  const raw = expandAbbreviatedUnitName(trimA1Value(rawVal));
  if (!raw) return resolveFullUnitAgencyName(unitCode, fallbackNameVi);
  const rawUpper = raw.toUpperCase();
  const isUnitAbbrev =
    rawUpper === trimA1Value(unitCode).toUpperCase() ||
    HCMUTE_UNITS.some((u) => u.code === rawUpper) ||
    Boolean(UNIT_CODE_ALIASES[rawUpper]) ||
    Boolean(INACTIVE_HISTORICAL_UNITS[rawUpper]);
  if (isUnitAbbrev) return resolveFullUnitAgencyName(rawUpper, fallbackNameVi);
  return raw;
}

export function normalizeA1Rows(
  rows: GenericGridRow[] | undefined,
  unitCode: string,
  fallbackNameVi?: string
): GenericGridRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    ...r,
    coQuan: normalizeA1AgencyValue(r.coQuan, unitCode, fallbackNameVi)
  }));
}
