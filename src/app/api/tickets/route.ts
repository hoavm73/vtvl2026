import { NextRequest, NextResponse } from 'next/server';
import {
  getTicketsByOwner, getTicketsByUnit, getTicketById, upsertTicketAndSyncUnit, deleteTicketAndSyncUnit,
  allocateNextTaskCode, syncTicketsFromWorkbook, syncTicketsFromSupabase
} from '@/services/storage/server-ticket-store';
import { getOrCreateWorkbook, normalizeEmail, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { appendAuditLog } from '@/services/storage/server-audit-store';
import { recordStatusHistoryInSupabase } from '@/services/storage/server-ticket-db';
import { TicketStatus, toCanonicalStatus } from '@/types/staff-ticket';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  const unitCodeParam = (req.nextUrl.searchParams.get('unitCode') || '').trim().toUpperCase();
  if (!caller.isAdmin && unitCodeParam && unitCodeParam !== caller.unitCode) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập dữ liệu của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  }

  const effectiveUnit = caller.isAdmin && unitCodeParam ? unitCodeParam : caller.unitCode;
  const unit = findHcmuteUnit(effectiveUnit);

  await syncTicketsFromSupabase(unit.code);
  await syncServerWorkbooksFromSupabase();
  const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', caller.email, caller.role);
  await syncTicketsFromWorkbook(wb.data, unit.code);

  const myTickets = getTicketsByOwner(caller.email, unit.code);
  const rawUnitTickets = getTicketsByUnit(unit.code);
  const unitTickets = caller.isAdmin
    ? rawUnitTickets
    : rawUnitTickets.filter((t) => t.ownerEmail.toLowerCase() === caller.email.toLowerCase() || (toCanonicalStatus(t.status) !== 'draft'));

  return NextResponse.json({
    myTickets, unitTickets, unitCode: unit.code, unitNameVi: unit.nameVi,
    a1Missions: wb.data.A1 || [], c1Vtvls: wb.data.C1 || [],
    unitA2Tasks: wb.data.A2 || [], unitB1Volumes: wb.data.B1 || []
  });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  try {
    const body = await req.json();
    const effectiveOwner = caller.isAdmin && body.ownerEmail ? normalizeEmail(body.ownerEmail) : caller.email;
    const effectiveUnit = caller.isAdmin && body.unitCode ? String(body.unitCode).toUpperCase() : caller.unitCode;

    if (!caller.isAdmin && body.ownerEmail && normalizeEmail(body.ownerEmail) !== caller.email) {
      return NextResponse.json({ error: 'Bạn không có quyền thao tác trên phiếu của người khác.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
    }
    if (!caller.isAdmin && body.unitCode && String(body.unitCode).toUpperCase() !== caller.unitCode) {
      return NextResponse.json({ error: 'Bạn không thể lập phiếu cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    }
    if (!body.maNhiemVu || !body.tenCongViec || !body.maVtvl) {
      return NextResponse.json({ error: 'Vui lòng chọn Mã nhiệm vụ, Mã vị trí việc làm và nhập Tên công việc.' }, { status: 400 });
    }

    const existingTickets = getTicketsByUnit(effectiveUnit);
    let existing = body.id ? existingTickets.find((t) => t.id === body.id) : undefined;
    if (existing) {
      if (!caller.isAdmin && existing.ownerEmail !== caller.email) {
        return NextResponse.json({ error: 'Bạn không có quyền cập nhật phiếu của người khác.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
      }
      const canonical = toCanonicalStatus(existing.status);
      if (!caller.isAdmin && canonical !== 'draft' && canonical !== 'changes_requested') {
        return NextResponse.json({ error: 'Phiếu đã nộp hoặc đã duyệt không thể chỉnh sửa.', code: 'FORBIDDEN_TICKET_LOCKED' }, { status: 403 });
      }
    }

    const nowIso = new Date().toISOString();
    const isSubmitting = body.action === 'submit' || body.status === 'Đã nộp' || body.status === 'submitted';
    const isResubmitting = body.action === 'resubmit' || body.status === 'Đã nộp lại' || body.status === 'resubmitted';

    let resolvedStatus: TicketStatus = 'Nháp';
    if (isSubmitting) resolvedStatus = 'Đã nộp';
    else if (isResubmitting) resolvedStatus = 'Đã nộp lại';
    else if (caller.isAdmin && body.status) resolvedStatus = body.status;

    if (isSubmitting || isResubmitting) {
      if (!body.sanPham?.trim() || !body.chatLuong?.trim() || !body.canCu?.trim() || !Number(body.soSpNam) || !body.nguonSoLieu?.trim() || !Number(body.phutThucTe)) {
        return NextResponse.json({ error: 'Vui lòng điền đủ các trường bắt buộc (trừ các mục "nếu có") để nộp phiếu.', code: 'MISSING_REQUIRED_FIELDS' }, { status: 400 });
      }
    }

    const result = await upsertTicketAndSyncUnit({
      id: body.id, unitCode: effectiveUnit, ownerEmail: effectiveOwner,
      ownerName: body.ownerName || caller.email.split('@')[0],
      ownerTitle: body.ownerTitle || (caller.isUnitLeader ? 'Lãnh đạo đơn vị' : 'Cán bộ – Giảng viên'),
      status: resolvedStatus, maNhiemVu: String(body.maNhiemVu), maCongViec: String(body.maCongViec || ''),
      tenCongViec: String(body.tenCongViec), maVtvl: String(body.maVtvl), maVtvlPhoiHop: body.maVtvlPhoiHop ? String(body.maVtvlPhoiHop) : '',
      sanPham: String(body.sanPham || ''), chatLuong: String(body.chatLuong || ''), canCu: String(body.canCu || ''),
      soSpNam: Number(body.soSpNam) || 0, nguonSoLieu: String(body.nguonSoLieu || ''),
      phutThucTe: Number(body.phutThucTe) || 0, gioBoSung: Number(body.gioBoSung) || 0,
      coordinatedTasks: Array.isArray(body.coordinatedTasks) ? body.coordinatedTasks : [],
      submittedAt: isSubmitting ? nowIso : existing?.submittedAt,
      resubmittedAt: isResubmitting ? nowIso : existing?.resubmittedAt
    });

    if (isSubmitting || isResubmitting) {
      await recordStatusHistoryInSupabase({
        surveyId: result.ticket.id, fromStatus: existing?.status || 'draft',
        toStatus: resolvedStatus, action: isResubmitting ? 'RESUBMIT' : 'SUBMIT',
        actorId: caller.email, actorRole: caller.role, unitId: effectiveUnit
      });
    }

    return NextResponse.json({ ok: true, ticket: result.ticket, unitWorkbookRevision: result.unitWorkbookRevision });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'REVISION_CONFLICT' || errorObj?.status === 409) {
      return NextResponse.json({ error: 'Xung đột phiên bản dữ liệu máy chủ.', code: 'REVISION_CONFLICT' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Lưu phiếu công việc thất bại.', code: 'PERSISTENCE_FAILED' }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Thiếu mã phiếu cần xóa.', code: 'MISSING_ID' }, { status: 400 });

  const unitTickets = getTicketsByUnit(caller.unitCode);
  const target = unitTickets.find((t) => t.id === id);
  if (target && target.ownerEmail !== caller.email && !caller.isAdmin) {
    return NextResponse.json({ error: 'Bạn không có quyền xóa phiếu của người khác.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
  }
  if (target && toCanonicalStatus(target.status) !== 'draft' && !caller.isAdmin) {
    return NextResponse.json({ error: 'Chỉ phiếu Nháp mới được phép xóa.', code: 'FORBIDDEN_DELETE_NON_DRAFT' }, { status: 403 });
  }

  try {
    const actor = caller.isAdmin ? (target?.ownerEmail || caller.email) : caller.email;
    const deleted = await deleteTicketAndSyncUnit(id, actor);
    if (!deleted) return NextResponse.json({ error: 'Không tìm thấy phiếu.' }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Xóa phiếu thất bại.', code: 'PERSISTENCE_FAILED' }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });

  const body = await req.json();
  const requestedUnit = (body.unitCode || caller.unitCode).toUpperCase();
  if (!caller.isAdmin && requestedUnit !== caller.unitCode) {
    return NextResponse.json({ error: 'Không thể cấp mã cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  }

  const maNhiemVu = String(body.maNhiemVu || '').trim();
  if (!maNhiemVu) return NextResponse.json({ nextTaskCode: '' });

  await syncServerWorkbooksFromSupabase();
  const wb = getOrCreateWorkbook(requestedUnit, '01/10/2025–30/9/2026', caller.email, caller.role);
  const unitTickets = getTicketsByUnit(requestedUnit);
  const nextTaskCode = allocateNextTaskCode(requestedUnit, maNhiemVu, wb.data.A2 || [], unitTickets, body.excludeTicketId);
  return NextResponse.json({ nextTaskCode, maCongViec: nextTaskCode });
}

export async function PATCH(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  try {
    const body = await req.json();
    const { id, ticketId, action, note, reason, revisionNotes } = body;
    const targetId = ticketId || id;
    const reasonText = (reason || revisionNotes || note || '').trim();

    if (!targetId) return NextResponse.json({ error: 'Thiếu mã phiếu.', code: 'INVALID_ID' }, { status: 400 });
    if (action !== 'approve' && action !== 'return' && action !== 'changes_requested' && action !== 'submit' && action !== 'resubmit' && action !== 'merge') {
      return NextResponse.json({ error: 'Hành động không hợp lệ.', code: 'INVALID_ACTION' }, { status: 400 });
    }

    const target = getTicketById(targetId) || (body.unitCode ? getTicketsByUnit(String(body.unitCode)).find((t) => t.id === targetId) : null);
    if (!target) return NextResponse.json({ error: 'Không tìm thấy phiếu.', code: 'TICKET_NOT_FOUND' }, { status: 404 });

    const nowIso = new Date().toISOString();

    // 1. Cán bộ nộp phiếu nháp (SUBMIT) hoặc nộp lại (RESUBMIT)
    if (action === 'submit' || action === 'resubmit') {
      if (!caller.isAdmin && target.ownerEmail.toLowerCase() !== caller.email.toLowerCase()) {
        return NextResponse.json({ error: 'Bạn chỉ có quyền nộp phiếu của chính mình.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
      }
      if (!target.sanPham?.trim() || !target.chatLuong?.trim() || !target.canCu?.trim() || !Number(target.soSpNam) || !target.nguonSoLieu?.trim() || !Number(target.phutThucTe)) {
        return NextResponse.json({ error: 'Phiếu chưa đủ các trường bắt buộc (trừ các mục "nếu có") để nộp.', code: 'MISSING_REQUIRED_FIELDS' }, { status: 400 });
      }
      const isResubmit = action === 'resubmit';
      const nextStatus: TicketStatus = isResubmit ? 'Đã nộp lại' : 'Đã nộp';
      const updated = await upsertTicketAndSyncUnit({
        ...target, status: nextStatus,
        submittedAt: !isResubmit ? nowIso : target.submittedAt,
        resubmittedAt: isResubmit ? nowIso : target.resubmittedAt
      });
      await recordStatusHistoryInSupabase({
        surveyId: target.id, fromStatus: target.status, toStatus: nextStatus,
        action: isResubmit ? 'RESUBMIT' : 'SUBMIT', actorId: caller.email, actorRole: caller.role, unitId: target.unitCode
      });
      return NextResponse.json({ ok: true, ticket: updated.ticket });
    }

    // Các hành động Duyệt / Yêu cầu bổ sung / Gộp đòi hỏi quyền Lãnh đạo hoặc Admin
    if (caller.isStaff) {
      return NextResponse.json({ error: 'Cán bộ không có quyền duyệt hoặc trả lại phiếu.', code: 'FORBIDDEN_STAFF_REVIEW' }, { status: 403 });
    }
    if (!caller.isAdmin && target.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json({ error: 'Lãnh đạo đơn vị chỉ thao tác trên phiếu thuộc đơn vị mình.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    }

    // 2. Gộp vào B1/B2 (MERGE)
    if (action === 'merge') {
      const canonical = toCanonicalStatus(target.status);
      if (canonical !== 'approved') {
        return NextResponse.json({ error: 'Chỉ phiếu Đã duyệt mới được phép gộp vào B1/B2.', code: 'FORBIDDEN_UNAPPROVED_MERGE' }, { status: 400 });
      }
      const result = await upsertTicketAndSyncUnit({
        ...target, status: 'Đã duyệt', isMergedToB1B2: true, mergedBy: caller.email, mergedAt: nowIso
      });
      appendAuditLog({
        unitCode: target.unitCode, unitName: findHcmuteUnit(target.unitCode).nameVi,
        action: 'GỘP_PHIẾU_B1_B2', targetId: target.id, targetEntity: 'staff_work_tickets',
        details: `Gộp phiếu ${target.maCongViec} (${target.tenCongViec}) vào biểu B1/B2`,
        actorEmail: caller.email, actorRole: caller.role
      });
      return NextResponse.json({ ok: true, merged: true, ticket: result.ticket, unitWorkbookRevision: result.unitWorkbookRevision });
    }

    // 3. Phê duyệt (APPROVE)
    if (action === 'approve') {
      if (!caller.isAdmin && target.ownerEmail.toLowerCase() === caller.email.toLowerCase()) {
        return NextResponse.json({
          error: 'Lãnh đạo đơn vị không thể tự duyệt phiếu của chính mình. Vui lòng chuyển Phòng TCNS phê duyệt.',
          code: 'FORBIDDEN_SELF_REVIEW'
        }, { status: 403 });
      }
      const canonical = toCanonicalStatus(target.status);
      if (canonical !== 'submitted' && canonical !== 'resubmitted') {
        return NextResponse.json({ error: 'Chỉ phiếu Đã nộp hoặc Đã nộp lại mới có thể phê duyệt.', code: 'INVALID_STATUS_FOR_APPROVAL' }, { status: 400 });
      }
      const result = await upsertTicketAndSyncUnit({
        ...target, status: 'Đã duyệt', approvedBy: caller.email, approvedAt: nowIso
      });
      appendAuditLog({
        unitCode: target.unitCode, unitName: findHcmuteUnit(target.unitCode).nameVi,
        action: 'DUYỆT_PHIẾU', targetId: target.id, targetEntity: 'staff_work_tickets',
        details: `Duyệt phiếu ${target.maCongViec} (${target.tenCongViec}) của ${target.ownerEmail}`,
        actorEmail: caller.email, actorRole: caller.role
      });
      await recordStatusHistoryInSupabase({
        surveyId: target.id, fromStatus: target.status, toStatus: 'approved',
        action: 'APPROVE', actorId: caller.email, actorRole: caller.role, unitId: target.unitCode
      });
      return NextResponse.json({ ok: true, ticket: result.ticket });
    }

    // 4. Yêu cầu bổ sung (CHANGES_REQUESTED / RETURN)
    if (action === 'changes_requested' || action === 'return') {
      if (!reasonText) {
        return NextResponse.json({ error: 'Lý do yêu cầu bổ sung là bắt buộc và không được để trống.', code: 'MISSING_REVISION_REASON' }, { status: 400 });
      }
      const canonical = toCanonicalStatus(target.status);
      if (canonical !== 'submitted' && canonical !== 'resubmitted') {
        return NextResponse.json({ error: 'Chỉ phiếu Đã nộp hoặc Đã nộp lại mới có thể yêu cầu bổ sung.', code: 'INVALID_STATUS_FOR_RETURN' }, { status: 400 });
      }
      const result = await upsertTicketAndSyncUnit({
        ...target, status: 'Yêu cầu bổ sung', revisionReason: reasonText,
        revisionRequestedBy: caller.email, revisionRequestedAt: nowIso
      });
      appendAuditLog({
        unitCode: target.unitCode, unitName: findHcmuteUnit(target.unitCode).nameVi,
        action: 'TRẢ_LẠI_PHIẾU', targetId: target.id, targetEntity: 'staff_work_tickets',
        details: `Yêu cầu bổ sung phiếu ${target.maCongViec} (${target.tenCongViec}): ${reasonText}`,
        actorEmail: caller.email, actorRole: caller.role
      });
      await recordStatusHistoryInSupabase({
        surveyId: target.id, fromStatus: target.status, toStatus: 'changes_requested',
        action: 'REQUEST_CHANGES', reason: reasonText, actorId: caller.email, actorRole: caller.role, unitId: target.unitCode
      });
      return NextResponse.json({ ok: true, ticket: result.ticket });
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ.', code: 'INVALID_ACTION' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Lỗi máy chủ khi thao tác phiếu.', code: 'PERSISTENCE_FAILED' }, { status: 502 });
  }
}
