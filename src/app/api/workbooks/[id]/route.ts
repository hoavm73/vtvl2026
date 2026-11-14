import { NextResponse } from 'next/server';
import {
  getWorkbookById,
  getOrCreateWorkbook,
  saveServerWorkbook,
  deleteServerWorkbook,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';
import { getCallerSession } from '@/services/storage/server-auth-guard';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để xem hồ sơ bảng tính.', code: 'UNAUTHORIZED' },
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
    const { id } = await context.params;
    let workbook = getWorkbookById(id);

    if (!workbook) {
      await syncServerWorkbooksFromSupabase();
      workbook = getWorkbookById(id);
    }

    if (!workbook) {
      const unitMatch = id.match(/^wb_([A-Za-z0-9]+)/);
      if (unitMatch) {
        workbook = getOrCreateWorkbook(unitMatch[1]);
      }
    }

    if (!workbook) {
      return NextResponse.json({ error: 'Không tìm thấy hồ sơ.', code: 'WORKBOOK_NOT_FOUND' }, { status: 404 });
    }

    // Độc lập dữ liệu đa đơn vị: Cán bộ/Lãnh đạo chỉ xem hồ sơ thuộc đơn vị của mình
    if (!caller.isAdmin && workbook.unitId.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json(
        { error: 'Bạn không có quyền truy cập hồ sơ của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, workbook });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg, code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để lưu bảng tính.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  if (caller.isSuspended) {
    return NextResponse.json(
      { error: 'Tài khoản đã bị tạm khóa, không có quyền lưu bảng biểu.', code: 'ACCOUNT_SUSPENDED' },
      { status: 403 }
    );
  }
  if (caller.isStaff) {
    return NextResponse.json(
      { error: 'Cán bộ – Giảng viên kê khai qua Phiếu công việc, không trực tiếp sửa bảng đơn vị.', code: 'FORBIDDEN_VIEWER_WRITE' },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await req.json();
    const { data, touchedCells, baseRevision, commitMessage, participant } = body;

    if (!data) {
      return NextResponse.json({ error: 'Thiếu dữ liệu bảng biểu.', code: 'MISSING_DATA' }, { status: 400 });
    }

    let existingWb = getWorkbookById(id);
    if (!existingWb) {
      await syncServerWorkbooksFromSupabase();
      existingWb = getWorkbookById(id);
    }

    const unitMatch = id.match(/^wb_([A-Za-z0-9]+)/);
    const targetUnit = (existingWb?.unitId || (unitMatch ? unitMatch[1] : caller.unitCode)).toUpperCase();

    if (!caller.isAdmin && targetUnit !== caller.unitCode.toUpperCase()) {
      return NextResponse.json(
        { error: 'Bạn không có quyền sửa đổi hồ sơ của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
        { status: 403 }
      );
    }

    // Bảo mật danh mục VTVL Biểu C1
    if (existingWb?.data?.C1 && data.C1) {
      const existingC1 = existingWb.data.C1;
      const newC1 = data.C1;
      const isC1Changed =
        existingC1.length !== newC1.length ||
        existingC1.some((r, i) => r.id !== newC1[i]?.id || r.maVtvl !== newC1[i]?.maVtvl);

      if (isC1Changed && !caller.isAdmin && !caller.isUnitLeader) {
        return NextResponse.json(
          { error: 'Chỉ Quản trị viên hệ thống có quyền sửa đổi cấu trúc danh mục VTVL tại Biểu C1.', code: 'FORBIDDEN_C1_CHANGE' },
          { status: 403 }
        );
      }
    }

    const result = saveServerWorkbook({
      workbookId: id,
      data,
      touchedCells: Array.isArray(touchedCells) ? touchedCells : [],
      baseRevision: typeof baseRevision === 'number' ? baseRevision : 1,
      changeSummary: commitMessage || 'Cập nhật từ phiên làm việc',
      actorEmail: caller.email,
      actorTitle: participant?.roleLabel || (caller.isUnitLeader ? 'Lãnh đạo đơn vị' : 'Quản trị viên')
    });

    if (result.conflict) {
      return NextResponse.json(
        {
          error: 'Xung đột phiên bản dữ liệu máy chủ.',
          code: 'REVISION_CONFLICT',
          conflict: true,
          serverRevision: result.currentRevision,
          currentServerWorkbook: result.serverWorkbook
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, workbook: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg, code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated || !caller.isAdmin) {
    return NextResponse.json(
      { error: 'Yêu cầu quyền Quản trị viên để xóa hồ sơ.', code: 'UNAUTHORIZED_ADMIN' },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;
    const ok = await deleteServerWorkbook(id);
    return NextResponse.json({ success: ok });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg, code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
