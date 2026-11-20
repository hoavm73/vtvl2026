import { NextResponse } from 'next/server';
import { appendAuditLog, getAuditLogs, persistAuditLogToSupabase, syncAuditLogsFromSupabase } from '@/services/storage/server-audit-store';
import { getServerAdminAuth } from '@/services/storage/server-admin-auth';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { normalizeEmail } from '@/services/storage/server-workbook-store';

export async function POST(req: Request) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để ghi nhật ký thao tác.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { unitCode, unitName, action, details, actorEmail, workbookId } = body;

    if (!unitCode || !action || !details) {
      return NextResponse.json(
        { error: 'Thiếu trường bắt buộc cho nhật ký thao tác (unitCode, action, details).' },
        { status: 400 }
      );
    }

    const headerSpoof = normalizeEmail(req.headers.get('x-actor-email') || '');
    const bodySpoof = normalizeEmail(actorEmail || '');
    if (
      (headerSpoof && headerSpoof !== normalizeEmail(caller.email)) ||
      (bodySpoof && bodySpoof !== normalizeEmail(caller.email))
    ) {
      return NextResponse.json(
        { error: 'Không được phép giả mạo danh tính người thực hiện.', code: 'FORBIDDEN_ACTOR_SPOOFING' },
        { status: 403 }
      );
    }

    if (!caller.isAdmin && String(unitCode).trim().toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json(
        { error: 'Không được phép ghi nhật ký cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
        { status: 403 }
      );
    }

    const cleanDetails = String(details).replace(/\s*\[Người thực hiện:\s*[^\]]+\]/g, '').trim();

    const log = appendAuditLog({
      unitCode: String(unitCode).trim().toUpperCase(),
      unitName: String(unitName || unitCode),
      action: String(action),
      details: cleanDetails,
      actorEmail: caller.email,
      actorRole: caller.role,
      workbookId: workbookId ? String(workbookId) : undefined
    });
    await persistAuditLogToSupabase(log);

    return NextResponse.json({ success: true, log }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống khi ghi nhật ký.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const caller = await getCallerSession(req);
  const isAuth = caller.isAdmin || (await getServerAdminAuth());
  if (!isAuth) {
    return NextResponse.json(
      { error: 'Yêu cầu quyền Quản trị viên để xem nhật ký kiểm toán hệ thống.' },
      { status: 401 }
    );
  }

  try {
    const url = new URL(req.url);
    const unitCode = url.searchParams.get('unitCode') || undefined;
    const workbookId = url.searchParams.get('workbookId') || undefined;
    const limit = Number(url.searchParams.get('limit')) || 100;

    await syncAuditLogsFromSupabase(Math.max(limit, 200)).catch(() => {});
    const logs = getAuditLogs({ unitCode, workbookId, limit });
    return NextResponse.json({ success: true, logs, total: logs.length }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi khi đọc nhật ký.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
