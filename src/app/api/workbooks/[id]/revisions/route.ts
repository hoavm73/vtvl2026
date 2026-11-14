import { NextResponse } from 'next/server';
import {
  getWorkbookById,
  rollbackServerWorkbookRevision
} from '@/services/storage/server-workbook-store';
import { getCallerSession } from '@/services/storage/server-auth-guard';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const workbook = getWorkbookById(id);

    if (!workbook) {
      return NextResponse.json({ error: 'Không tìm thấy hồ sơ.', code: 'NOT_FOUND' }, { status: 404 });
    }

    if (!caller.isAdmin && workbook.unitId.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json({ error: 'Không có quyền truy cập lịch sử đơn vị khác.', code: 'FORBIDDEN' }, { status: 403 });
    }

    return NextResponse.json({
      workbookId: id,
      currentRevision: workbook.currentRevision || 1,
      revisions: workbook.revisions || []
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!caller.isAdmin && !caller.isUnitLeader) {
    return NextResponse.json({ error: 'Chỉ Lãnh đạo đơn vị hoặc Quản trị viên mới có quyền khôi phục phiên bản.', code: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const { id } = await context.params;
    const workbook = getWorkbookById(id);
    if (workbook && !caller.isAdmin && workbook.unitId.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json({ error: 'Không thể khôi phục phiên bản đơn vị khác.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const body = await req.json();
    const { targetRevision, reason } = body;

    if (typeof targetRevision !== 'number') {
      return NextResponse.json({ error: 'Thiếu số phiên bản cần khôi phục (targetRevision).' }, { status: 400 });
    }

    const updated = rollbackServerWorkbookRevision(id, targetRevision, reason);
    if (!updated) {
      return NextResponse.json({ error: 'Không thể khôi phục phiên bản đã chọn.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, workbook: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
