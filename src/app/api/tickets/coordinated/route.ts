import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { syncAccountsFromSupabase } from '@/services/storage/server-account-store';
import { syncTicketsFromSupabase } from '@/services/storage/server-ticket-store';
import { syncVtvlAssignmentsFromSupabase } from '@/services/storage/server-vtvl-assignment-store';
import { syncVersionsCacheFromSupabase } from '@/services/storage/server-coordination-store';
import { normalizeEmail, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { isIsolatedLocalMode } from '@/services/storage/server-ticket-db';
import {
  queryProposedTaskDetailForUser,
  queryProposedTasksForUser
} from '@/services/tickets/vtvl-coordination-service';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const spoofEmail = sp.get('actorEmail') || sp.get('actor_id') || sp.get('asEmail') || '';
  if (spoofEmail && normalizeEmail(spoofEmail) !== normalizeEmail(caller.email)) {
    return NextResponse.json(
      { error: 'Không được phép giả mạo danh tính người nhận phối hợp.', code: 'FORBIDDEN_ACTOR_SPOOFING' },
      { status: 403 }
    );
  }

  if (!isIsolatedLocalMode()) {
    await Promise.all([
      syncAccountsFromSupabase().catch(() => {}),
      syncVtvlAssignmentsFromSupabase().catch(() => {}),
      syncTicketsFromSupabase().catch(() => {}),
      syncVersionsCacheFromSupabase().catch(() => {}),
      syncServerWorkbooksFromSupabase().catch(() => {})
    ]);
  }

  const surveyId = (sp.get('surveyId') || sp.get('id') || '').trim();
  const taskRowId = (sp.get('taskRowId') || '').trim() || undefined;

  if (surveyId) {
    const result = queryProposedTaskDetailForUser(caller.email, surveyId, taskRowId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    }
    return NextResponse.json({ item: result.item });
  }

  // Tuyệt đối không dùng email hoặc unitCode từ query client để quyết định quyền; chỉ dùng caller.email đã xác thực
  const { items, myAssignments } = queryProposedTasksForUser(caller.email);
  return NextResponse.json({
    items,
    total: items.length,
    myAssignments: myAssignments.map((a) => ({
      id: a.id,
      unitCode: a.unitCode,
      maVtvl: a.maVtvl,
      tenVtvl: a.tenVtvl
    }))
  });
}
