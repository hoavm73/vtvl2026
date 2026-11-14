import { NextRequest, NextResponse } from 'next/server';
import {
  getAllActiveServerWorkbooks,
  getOrCreateWorkbook,
  normalizeEmail,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';
import { getCallerSession } from '@/services/storage/server-auth-guard';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để truy cập danh sách hồ sơ bảng tính.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  if (caller.isSuspended) {
    return NextResponse.json(
      { error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' },
      { status: 403 }
    );
  }

  try {
    await syncServerWorkbooksFromSupabase();
    let list = getAllActiveServerWorkbooks();

    // Phân quyền đa đơn vị: Chỉ Admin được xem toàn trường, đơn vị khác chỉ thấy hồ sơ của mình
    if (!caller.isAdmin) {
      list = list.filter((w) => w.unitId.toUpperCase() === caller.unitCode.toUpperCase());
    }

    const summary = list.map((w) => ({
      id: w.id,
      unitCode: w.unitId,
      unitNameVi: w.unitNameVi,
      reportingPeriod: w.reportingPeriod,
      currentRevision: w.currentRevision,
      status: w.status,
      participants: w.participants,
      updatedAt: w.updatedAt,
      touchedCellsCount: w.touchedCells?.length || 0
    }));
    return NextResponse.json({ workbooks: summary, total: summary.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để khởi tạo hồ sơ.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  if (caller.isSuspended) {
    return NextResponse.json(
      { error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { unitCode, reportingPeriod, roleLabel } = body;
    const requestedUnit = (unitCode || caller.unitCode).toUpperCase();

    if (!caller.isAdmin && requestedUnit !== caller.unitCode) {
      return NextResponse.json(
        { error: 'Bạn không có quyền khởi tạo hồ sơ cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
        { status: 403 }
      );
    }

    const workbook = getOrCreateWorkbook(
      requestedUnit,
      reportingPeriod || '01/10/2025–30/9/2026',
      caller.email,
      roleLabel || (caller.isUnitLeader ? 'Lãnh đạo đơn vị' : 'Cán bộ – Giảng viên')
    );

    return NextResponse.json({ success: true, workbook });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
