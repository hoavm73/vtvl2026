import { NextResponse } from 'next/server';
import {
  getWorkbookForUnitReadOnly,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';
import { getDbTestHook, getPgPool, isDatabaseConfigured, pgQuery } from '@/services/storage/prisma';
import { isIsolatedLocalMode } from '@/services/storage/server-ticket-db';

const LOCK_STATUS_TTL_MS = 15000;
const wbLockGlobal = globalThis as unknown as {
  __uteVtvlWbLockStatusCache?: Map<string, { locked: boolean; fetchedAt: number }>;
};
const statusCache = wbLockGlobal.__uteVtvlWbLockStatusCache || new Map<string, { locked: boolean; fetchedAt: number }>();
wbLockGlobal.__uteVtvlWbLockStatusCache = statusCache;

export function clearUnitWorkbookLockCache(unitCode?: string): void {
  if (unitCode) statusCache.delete(unitCode.trim().toUpperCase());
  else statusCache.clear();
}

export function isWorkbookStatusLocked(status?: string | null): boolean {
  return status === 'approved' || status === 'archived';
}

export function isUnitWorkbookApprovedLocked(unitCode: string): boolean {
  const cleanCode = (unitCode || '').trim().toUpperCase();
  if (!cleanCode) return false;
  const wb = getWorkbookForUnitReadOnly(cleanCode);
  return isWorkbookStatusLocked(wb?.status);
}

export function buildUnitWorkbookLockedResponse(unitCode: string): NextResponse {
  const cleanCode = (unitCode || '').trim().toUpperCase();
  return NextResponse.json(
    {
      error: `Hồ sơ đơn vị [${cleanCode}] đã được Phòng Tổ chức – Nhân sự xác nhận đạt thẩm định và khóa chỉnh sửa. Vui lòng liên hệ Phòng TCNS bấm "Mở lại hồ sơ" nếu cần điều chỉnh.`,
      code: 'FORBIDDEN_UNIT_APPROVED_LOCKED',
      locked: true,
      unitCode: cleanCode
    },
    { status: 403 }
  );
}

export async function checkUnitWorkbookApprovedLock(unitCode: string): Promise<NextResponse | null> {
  const cleanCode = (unitCode || '').trim().toUpperCase();
  if (!cleanCode) return null;

  if (isDatabaseConfigured() && !isIsolatedLocalMode() && !getDbTestHook() && getPgPool()) {
    const cached = statusCache.get(cleanCode);
    if (cached && Date.now() - cached.fetchedAt < LOCK_STATUS_TTL_MS) {
      return cached.locked ? buildUnitWorkbookLockedResponse(cleanCode) : null;
    }
    try {
      const res = await pgQuery<{ status: string }>(
        `SELECT status FROM public.workbooks
         WHERE unit_id = $1 AND is_deleted = false
         ORDER BY current_revision DESC LIMIT 1`,
        [cleanCode]
      );
      const locked = res.rows[0]?.status ? isWorkbookStatusLocked(res.rows[0].status) : isUnitWorkbookApprovedLocked(cleanCode);
      statusCache.set(cleanCode, { locked, fetchedAt: Date.now() });
      return locked ? buildUnitWorkbookLockedResponse(cleanCode) : null;
    } catch {
      // Fallback sang luồng đồng bộ chuẩn nếu bảng workbooks chưa sẵn sàng
    }
  }

  await syncServerWorkbooksFromSupabase(false, cleanCode).catch(() => {});
  if (isUnitWorkbookApprovedLocked(cleanCode)) {
    return buildUnitWorkbookLockedResponse(cleanCode);
  }
  return null;
}
