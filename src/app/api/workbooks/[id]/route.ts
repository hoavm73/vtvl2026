import { NextResponse } from 'next/server';
import {
  getWorkbookById,
  getOrCreateWorkbook,
  saveServerWorkbook,
  deleteServerWorkbook,
  normalizeEmail,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';
import { getServerAdminAuth } from '@/services/storage/server-admin-auth';
import { getUserAccountByEmail, syncAccountsFromSupabase } from '@/services/storage/server-account-store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
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

    return NextResponse.json({ success: true, workbook });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg, code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const {
      data,
      touchedCells,
      baseRevision,
      commitMessage,
      participant
    } = body;

    if (!data) {
      return NextResponse.json(
        { error: 'Thiếu dữ liệu bảng biểu.', code: 'MISSING_DATA' },
        { status: 400 }
      );
    }

    // Kiểm tra bảo mật máy chủ độc lập cho Biểu C1:
    let existingWb = getWorkbookById(id);
    if (!existingWb) {
      await syncServerWorkbooksFromSupabase();
      existingWb = getWorkbookById(id);
    }

    if (!existingWb) {
      const normEmail = participant?.email ? normalizeEmail(participant.email) : 'tcns@hcmute.edu.vn';
      const extractedUnitCode =
        body.unitCode ||
        participant?.unitCode ||
        (id.startsWith('wb_') ? id.split('_')[1] : 'FIT');
      existingWb = getOrCreateWorkbook(
        extractedUnitCode,
        body.reportingPeriod || '01/10/2025–30/9/2026',
        normEmail,
        participant?.roleLabel || 'Người thực hiện'
      );
    }

    const normEmail = participant?.email ? normalizeEmail(participant.email) : 'tcns@hcmute.edu.vn';
    const authHeader = req.headers.get('authorization') || '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;

    await syncAccountsFromSupabase();
    const actorAccount = getUserAccountByEmail(normEmail);

    if (actorAccount?.status === 'suspended') {
      return NextResponse.json(
        { error: 'Tài khoản đã bị tạm khóa, không có quyền lưu bảng biểu.', code: 'ACCOUNT_SUSPENDED' },
        { status: 403 }
      );
    }

    if (actorAccount?.role === 'staff') {
      return NextResponse.json(
        { error: 'Vai trò Người xem chỉ có quyền tra cứu, không được phép chỉnh sửa dữ liệu.', code: 'FORBIDDEN_VIEWER_WRITE' },
        { status: 403 }
      );
    }

    if (existingWb?.data?.C1 && data.C1) {
      const existingC1 = existingWb.data.C1;
      const newC1 = data.C1;
      const isC1Changed =
        existingC1.length !== newC1.length ||
        existingC1.some((r, i) => r.id !== newC1[i]?.id || r.maVtvl !== newC1[i]?.maVtvl);

      if (isC1Changed) {
        const isAuth = await getServerAdminAuth(normEmail, bearer);
        const isActiveLeader = actorAccount?.role === 'unit_leader' && actorAccount?.status === 'active';
        if (!isAuth && !isActiveLeader) {
          return NextResponse.json(
            {
              error: 'Chỉ Quản trị viên hệ thống có quyền sửa đổi cấu trúc danh mục VTVL tại Biểu C1.',
              code: 'FORBIDDEN_C1_CHANGE'
            },
            { status: 403 }
          );
        }
      }
    }

    const result = saveServerWorkbook({
      workbookId: id,
      data,
      touchedCells: Array.isArray(touchedCells) ? touchedCells : [],
      baseRevision: typeof baseRevision === 'number' ? baseRevision : 1,
      changeSummary: commitMessage || 'Cập nhật từ phiên làm việc',
      actorEmail: normEmail,
      actorTitle: participant?.roleLabel || 'Người thực hiện'
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

    return NextResponse.json({
      success: true,
      workbook: result
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg, code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const isAuth = await getServerAdminAuth();
  if (!isAuth) {
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
