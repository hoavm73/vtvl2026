import { findHcmuteUnit, HCMUTE_UNITS } from '@/configs/hcmute-units';
import { OperatorSession } from '@/services/telemetry/operator-session';

export interface WorkbookContextMismatchResult {
  valid: boolean;
  code?: 'UNIT_MISMATCH' | 'REVISION_STALE';
  message?: string;
}

const VALID_UNIT_CODES = new Set(HCMUTE_UNITS.map((u) => u.code.toUpperCase()));

/**
 * Xác định mã đơn vị an toàn theo vai trò hiện tại.
 * - Cán bộ / Lãnh đạo đơn vị bị khóa theo đơn vị phiên đăng nhập.
 * - Admin (TCNS) có thể chọn đơn vị hợp lệ trong 39 đơn vị.
 */
export function resolveSafeUnitCode(
  session: Pick<OperatorSession, 'role' | 'unitCode'> | null | undefined,
  requestedUnit?: string | null
): string {
  const fallback = session?.unitCode ? findHcmuteUnit(session.unitCode).code : 'TCNS';
  if (!session) {
    const req = (requestedUnit || '').trim().toUpperCase();
    return req && VALID_UNIT_CODES.has(req) ? req : 'TCNS';
  }
  const isAdmin = session.role === 'admin';
  if (!isAdmin) return fallback;

  const req = (requestedUnit || '').trim().toUpperCase();
  if (!req || req === 'ALL') return fallback;
  return VALID_UNIT_CODES.has(req) ? req : findHcmuteUnit(req).code;
}

export function getCanonicalWorkbookId(unitCode: string): string {
  const safe = findHcmuteUnit(unitCode).code.toUpperCase();
  return `wb_${safe}_2026`;
}

export function extractUnitCodeFromWorkbookId(workbookId?: string | null): string | null {
  if (!workbookId) return null;
  const match = String(workbookId).trim().match(/^wb_([A-Za-z0-9-]+?)(?:_|$)/i);
  if (!match) return null;
  const candidate = match[1].toUpperCase();
  return VALID_UNIT_CODES.has(candidate) ? candidate : findHcmuteUnit(candidate).code;
}

/**
 * Đối chiếu tính nhất quán ngữ cảnh giữa đơn vị đang chọn, workbook, tệp Excel và báo cáo kiểm tra.
 */
export function verifyWorkbookContextMatch(params: {
  expectedUnitCode: string;
  workbookUnitCode?: string | null;
  fileUnitCode?: string | null;
  auditUnitCode?: string | null;
  expectedRevision?: number | null;
  actualRevision?: number | null;
}): WorkbookContextMismatchResult {
  const expected = (params.expectedUnitCode || '').trim().toUpperCase();
  if (!expected) {
    return { valid: false, code: 'UNIT_MISMATCH', message: 'Thiếu mã đơn vị trong ngữ cảnh hiện tại.' };
  }

  const checks: { label: string; value?: string | null }[] = [
    { label: 'Hồ sơ workbook', value: params.workbookUnitCode },
    { label: 'Tệp Excel', value: params.fileUnitCode },
    { label: 'Kết quả kiểm tra', value: params.auditUnitCode }
  ];

  for (const item of checks) {
    const val = (item.value || '').trim().toUpperCase();
    if (val && val !== expected) {
      return {
        valid: false,
        code: 'UNIT_MISMATCH',
        message: `Phát hiện lệch đơn vị: ${item.label} thuộc [${val}] nhưng phiên đang chọn [${expected}]. Vui lòng chọn lại đúng hồ sơ.`
      };
    }
  }

  if (
    typeof params.expectedRevision === 'number' &&
    typeof params.actualRevision === 'number' &&
    params.expectedRevision > 0 &&
    params.actualRevision > 0 &&
    params.expectedRevision !== params.actualRevision
  ) {
    return {
      valid: false,
      code: 'REVISION_STALE',
      message: `Phiên bản đang xem (v${params.expectedRevision}) khác phiên bản máy chủ (v${params.actualRevision}). Vui lòng tải lại hồ sơ mới nhất.`
    };
  }

  return { valid: true };
}

/**
 * Đồng bộ query ngữ cảnh vào URL trình duyệt mà không làm mất lịch sử Back/Forward khi pushState.
 */
export function syncContextQueryParams(
  params: Record<string, string | number | undefined | null>,
  mode: 'push' | 'replace' = 'replace'
): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let changed = false;

  for (const [k, v] of Object.entries(params)) {
    const nextVal = v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim();
    const curVal = url.searchParams.get(k);
    if (nextVal === null) {
      if (curVal !== null) {
        url.searchParams.delete(k);
        changed = true;
      }
    } else if (curVal !== nextVal) {
      url.searchParams.set(k, nextVal);
      changed = true;
    }
  }

  if (!changed) return;
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (mode === 'push') {
    window.history.pushState({ url: nextUrl }, '', nextUrl);
  } else {
    window.history.replaceState(window.history.state, '', nextUrl);
  }
}

export function persistUnitContextSelection(unitCode: string): void {
  if (typeof window === 'undefined' || !unitCode) return;
  try {
    localStorage.setItem('vtvl_active_unit_code', unitCode.toUpperCase());
  } catch {
    // Bỏ qua nếu trình duyệt chặn storage
  }
}
