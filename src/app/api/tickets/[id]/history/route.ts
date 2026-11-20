import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { getTicketById, syncTicketsFromSupabase } from '@/services/storage/server-ticket-store';
import { getTicketMergeLinks } from '@/services/storage/server-ticket-version-store';
import { getReplacedWorkCodesForSurvey } from '@/services/storage/server-coordination-store';
import { normalizeEmail } from '@/services/storage/server-workbook-store';
import { isDatabaseConfigured, prisma, toIsoString } from '@/services/storage/prisma';
import { isIsolatedLocalMode } from '@/services/storage/server-ticket-db';
import { toCanonicalStatus, WorkSurveyStatusHistory } from '@/types/staff-ticket';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  const { id } = await context.params;
  const ticketId = (id || '').trim();
  if (!ticketId) return NextResponse.json({ error: 'Thiếu mã phiếu.', code: 'MISSING_ID' }, { status: 400 });

  let found = getTicketById(ticketId);
  if (!found) {
    await syncTicketsFromSupabase(undefined, false).catch(() => {});
    found = getTicketById(ticketId);
  }
  if (!found || (found.isArchived && !caller.isAdmin)) {
    return NextResponse.json({ error: 'Không tìm thấy phiếu.', code: 'TICKET_NOT_FOUND' }, { status: 404 });
  }
  if (!caller.isAdmin && found.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
    return NextResponse.json({ error: 'Bạn không có quyền xem lịch sử phiếu của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  }
  if (!caller.isAdmin && toCanonicalStatus(found.status) === 'draft' && normalizeEmail(found.ownerEmail) !== normalizeEmail(caller.email)) {
    return NextResponse.json({ error: 'Phiếu Nháp chỉ chủ sở hữu và Quản trị viên mới được xem.', code: 'FORBIDDEN_DRAFT_ACCESS' }, { status: 403 });
  }

  let statusHistory: WorkSurveyStatusHistory[] = found.statusHistory || [];
  if (statusHistory.length === 0 && !isIsolatedLocalMode() && isDatabaseConfigured()) {
    try {
      const rows = await prisma.work_survey_status_history.findMany({
        where: { survey_id: ticketId },
        orderBy: { created_at: 'asc' }
      });
      statusHistory = rows.map((r) => ({
        id: String(r.id),
        surveyId: String(r.survey_id),
        fromStatus: r.from_status || undefined,
        toStatus: String(r.to_status),
        action: String(r.action),
        reason: r.reason || undefined,
        actorId: String(r.actor_id || '').toLowerCase().trim(),
        actorRole: String(r.actor_role || 'staff'),
        unitId: String(r.unit_id || ''),
        createdAt: toIsoString(r.created_at) || new Date().toISOString()
      }));
    } catch { /* fallback to empty list */ }
  }

  return NextResponse.json({
    ok: true,
    surveyId: ticketId,
    statusHistory,
    mergeLinks: getTicketMergeLinks(ticketId),
    replacedWorkCodes: getReplacedWorkCodesForSurvey(ticketId)
  }, { headers: { 'Cache-Control': 'no-store' } });
}
