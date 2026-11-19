import { NextResponse } from 'next/server';
import {
  getWorkbookForUnitReadOnly,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';

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
  await syncServerWorkbooksFromSupabase(false).catch(() => {});
  if (isUnitWorkbookApprovedLocked(cleanCode)) {
    return buildUnitWorkbookLockedResponse(cleanCode);
  }
  return null;
}
