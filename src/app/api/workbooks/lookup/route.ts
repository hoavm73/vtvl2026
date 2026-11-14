import { NextRequest, NextResponse } from 'next/server';
import {
  findWorkbooksByEmail,
  normalizeEmail,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';
import { getCallerSession } from '@/services/storage/server-auth-guard';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const rawEmail = req.nextUrl.searchParams.get('email');
    if (!rawEmail) {
      return NextResponse.json({ workbooks: [], total: 0 });
    }

    const normEmail = normalizeEmail(rawEmail);
    if (!normEmail) {
      return NextResponse.json({ workbooks: [], total: 0 });
    }

    // Bảo mật danh tính: Không cho phép tra cứu hồ sơ người khác nếu không phải Admin
    if (!caller.isAdmin && normEmail !== caller.email) {
      return NextResponse.json(
        { error: 'Bạn không có quyền tra cứu hồ sơ của tài khoản khác.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    await syncServerWorkbooksFromSupabase();
    let results = findWorkbooksByEmail(normEmail);

    const unitCode = req.nextUrl.searchParams.get('unitCode');
    if (unitCode) {
      results = results.filter((w) => w.unitId.toUpperCase() === unitCode.toUpperCase());
    }

    const reportingPeriod = req.nextUrl.searchParams.get('reportingPeriod');
    if (reportingPeriod) {
      results = results.filter((w) => w.reportingPeriod === reportingPeriod);
    }

    const summary = results.map((w) => {
      const lastParticipant = w.participants[w.participants.length - 1];
      return {
        id: w.id,
        unitCode: w.unitId,
        unitNameVi: w.unitNameVi,
        reportingPeriod: w.reportingPeriod,
        currentRevision: w.currentRevision,
        status: w.status,
        lastSavedAt: w.updatedAt,
        latestParticipant: lastParticipant || null,
        touchedCellsCount: w.touchedCells?.length || 0,
        revisionsCount: w.revisions?.length || 1
      };
    });

    return NextResponse.json({
      queryEmail: normEmail,
      workbooks: summary,
      total: summary.length
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
