import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { syncAccountsFromSupabase } from '@/services/storage/server-account-store';
import { syncTicketsFromSupabase } from '@/services/storage/server-ticket-store';
import { syncVtvlAssignmentsFromSupabase } from '@/services/storage/server-vtvl-assignment-store';
import { syncVersionsCacheFromSupabase } from '@/services/storage/server-coordination-store';
import { normalizeEmail, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { isIsolatedLocalMode } from '@/services/storage/server-ticket-db';
import {
  computeWorkRelationshipsAndEnrichProposals,
  getWorkRelationshipById,
  setRelationshipManualApproval,
  syncWorkRelationshipsFromSupabase
} from '@/services/storage/server-work-relationship-store';
import { resolveUnitCodeSafe } from '@/services/tickets/vtvl-coordination-helpers';
import {
  queryProposedTaskDetailForUser,
  queryProposedTasksForUser
} from '@/services/tickets/vtvl-coordination-service';

async function syncAllCoordinationSources(): Promise<void> {
  if (isIsolatedLocalMode()) return;
  await Promise.all([
    syncAccountsFromSupabase().catch(() => {}),
    syncVtvlAssignmentsFromSupabase().catch(() => {}),
    syncTicketsFromSupabase().catch(() => {}),
    syncVersionsCacheFromSupabase().catch(() => {}),
    syncServerWorkbooksFromSupabase().catch(() => {}),
    syncWorkRelationshipsFromSupabase().catch(() => {})
  ]);
}

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

  await syncAllCoordinationSources();

  const surveyId = (sp.get('surveyId') || sp.get('id') || '').trim();
  const taskRowId = (sp.get('taskRowId') || '').trim() || undefined;
  const scope = (sp.get('scope') || '').trim();

  if (surveyId) {
    const result = queryProposedTaskDetailForUser(caller.email, surveyId, taskRowId, { unitCode: caller.unitCode, scope });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
    }
    await computeWorkRelationshipsAndEnrichProposals([result.item], caller.unitCode, caller.isAdmin);
    return NextResponse.json({ item: result.item });
  }

  const { items, myAssignments } = queryProposedTasksForUser(caller.email, { unitCode: caller.unitCode, scope });
  const relationships = await computeWorkRelationshipsAndEnrichProposals(items, caller.unitCode, caller.isAdmin);

  return NextResponse.json({
    items,
    total: items.length,
    relationships,
    myAssignments: myAssignments.map((a) => ({
      id: a.id,
      unitCode: a.unitCode,
      maVtvl: a.maVtvl,
      tenVtvl: a.tenVtvl
    }))
  });
}

export async function PATCH(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { relationshipId?: string; side?: string; approved?: boolean };
    const relationshipId = String(body.relationshipId || '').trim();
    const side = body.side === 'host' || body.side === 'target' || body.side === 'tcns' ? body.side : null;
    if (!relationshipId || !side) {
      return NextResponse.json({ error: 'Thiếu thông tin mối quan hệ công việc hoặc phía phê duyệt.', code: 'INVALID_PARAMS' }, { status: 400 });
    }

    await syncAllCoordinationSources();
    await computeWorkRelationshipsAndEnrichProposals([], caller.unitCode, caller.isAdmin);
    const rel = getWorkRelationshipById(relationshipId);
    if (!rel) {
      return NextResponse.json({ error: 'Không tìm thấy mối quan hệ công việc.', code: 'RELATIONSHIP_NOT_FOUND' }, { status: 404 });
    }

    const callerUnit = resolveUnitCodeSafe(caller.unitCode);
    if (side === 'tcns' && !caller.isAdmin) {
      return NextResponse.json({ error: 'Chỉ Phòng Tổ chức – Nhân sự (Admin) mới được xác nhận duyệt cấp trường.', code: 'FORBIDDEN_TCNS_ONLY' }, { status: 403 });
    }
    if (side === 'host' && !caller.isAdmin && !(caller.isUnitLeader && callerUnit === rel.hostUnitCode)) {
      return NextResponse.json({ error: 'Chỉ Lãnh đạo đơn vị đề xuất mới được duyệt xác nhận phía đơn vị này.', code: 'FORBIDDEN_HOST_LEADER_ONLY' }, { status: 403 });
    }
    if (side === 'target' && !caller.isAdmin && !(caller.isUnitLeader && callerUnit === rel.targetUnitCode)) {
      return NextResponse.json({ error: 'Chỉ Lãnh đạo đơn vị phối hợp mới được duyệt xác nhận phía đơn vị này.', code: 'FORBIDDEN_TARGET_LEADER_ONLY' }, { status: 403 });
    }

    const updated = await setRelationshipManualApproval({
      relationshipId,
      side,
      approved: body.approved !== false,
      actorEmail: caller.email
    });
    return NextResponse.json({ ok: true, relationship: updated });
  } catch {
    return NextResponse.json({ error: 'Không thể cập nhật trạng thái phê duyệt mối quan hệ công việc.' }, { status: 500 });
  }
}
