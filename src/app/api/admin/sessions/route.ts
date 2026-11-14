import { NextResponse } from 'next/server';
import { getServerAdminAuth } from '@/services/storage/server-admin-auth';
import {
  getAllActiveServerWorkbooks,
  deleteServerWorkbook,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';

export async function GET() {
  const isAuth = await getServerAdminAuth();
  if (!isAuth) {
    return NextResponse.json(
      { error: 'Yêu cầu quyền Quản trị viên để truy cập dữ liệu này.', code: 'UNAUTHORIZED_ADMIN' },
      { status: 401 }
    );
  }

  await syncServerWorkbooksFromSupabase();
  const workbooks = getAllActiveServerWorkbooks();
  const summary = workbooks.map((w) => {
    const parts = Array.isArray(w.participants) ? w.participants : [];
    const latestParticipant = parts[parts.length - 1] || {
      email: 'tcns@hcmute.edu.vn',
      roleLabel: 'Chuyên viên'
    };

    let totalRows = 0;
    let populatedSheetsCount = 0;
    if (w.data) {
      for (const sheetKey of Object.keys(w.data)) {
        const rows = (w.data as Record<string, any[]>)[sheetKey];
        if (Array.isArray(rows) && rows.length > 0) {
          totalRows += rows.length;
          populatedSheetsCount++;
        }
      }
    }

    const revs = Array.isArray(w.revisions) ? w.revisions : [];

    return {
      id: w.id,
      unitCode: w.unitId,
      unitNameVi: w.unitNameVi,
      reportingPeriod: w.reportingPeriod,
      email: latestParticipant.email,
      title: latestParticipant.roleLabel,
      lastSavedAt: w.updatedAt,
      currentRevision: w.currentRevision,
      touchedCells: Array.isArray(w.touchedCells) ? w.touchedCells : [],
      revisionCount: revs.length || 1,
      revisions: revs.map((r) => ({
        revision: r.revision,
        actorEmail: r.actorEmail,
        actorTitle: r.actorTitle,
        changeSummary: r.changeSummary,
        createdAt: r.createdAt
      })),
      totalRows,
      populatedSheetsCount,
      status: w.status
    };
  });

  return NextResponse.json({ workbooks: summary, total: summary.length });
}

export async function DELETE(req: Request) {
  const isAuth = await getServerAdminAuth();
  if (!isAuth) {
    return NextResponse.json(
      { error: 'Yêu cầu quyền Quản trị viên để xóa hồ sơ.', code: 'UNAUTHORIZED_ADMIN' },
      { status: 401 }
    );
  }

  try {
    const url = new URL(req.url);
    const workbookId = url.searchParams.get('id');
    if (!workbookId) {
      return NextResponse.json({ error: 'Thiếu mã workbook.' }, { status: 400 });
    }
    const ok = await deleteServerWorkbook(workbookId);
    return NextResponse.json({ success: ok });
  } catch {
    return NextResponse.json({ error: 'Lỗi khi xóa hồ sơ.' }, { status: 500 });
  }
}
