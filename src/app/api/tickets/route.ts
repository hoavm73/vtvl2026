import { NextRequest, NextResponse } from 'next/server';
import {
  getTicketsByUnit, getTicketById, upsertTicketAndSyncUnit, deleteTicketAndSyncUnit,
  allocateNextTaskCodeAsync, syncSingleTicketFromSupabase, appendTicketStatusHistory, restoreTicketInMemory
} from '@/services/storage/server-ticket-store';
import { executeRevokeOrCancelTicket } from '@/services/storage/server-ticket-unmerge';
import { createImmutableSurveyVersion, compensateRemoveSurveyVersion } from '@/services/storage/server-ticket-version-store';
import { compensateRemoveReplacedWorkCode, recordReplacedWorkCode } from '@/services/storage/server-coordination-store';
import { withCrossProcessLock } from '@/services/storage/server-file-lock';
import { getOrCreateWorkbook, normalizeEmail, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { appendAuditLog, persistAuditLogToSupabase } from '@/services/storage/server-audit-store';
import { TicketStatus, toCanonicalStatus } from '@/types/staff-ticket';
import { executePatchTicketAction } from '@/services/tickets/ticket-workflow-handlers';
import { compensateRemoveCoordinationProjection, hasTicketOrTargetCoordination, syncSubmittedCoordinationProjection } from '@/services/tickets/vtvl-coordination-service';
import { normalizeCoordinatedVtvls } from '@/services/tickets/vtvl-coordination-helpers';
import { computeWorkRelationshipsAndEnrichProposals } from '@/services/storage/server-work-relationship-store';
import {
  checkTicketOptimisticConcurrency, extractIdempotencyKey, getRecordedIdempotencyResponse, saveIdempotencyResponse
} from '@/services/storage/server-mission-counter';
import {
  executeGetTicketsRoute, handleTicketRouteError, isSameEditablePayload, parseTicketJsonWithGuard, validateMutableTicket
} from '@/services/tickets/ticket-route-helpers';
import { checkUnitWorkbookApprovedLock } from '@/services/workbooks/workbook-lock-guard';
import { enforceApiRateLimit } from '@/services/auth/api-rate-limiter';
import { withHeavyMutationBudget } from '@/services/storage/heavy-mutation-gate';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  const unitCodeParam = (req.nextUrl.searchParams.get('unitCode') || '').trim().toUpperCase();
  if (!caller.isAdmin && unitCodeParam === 'ALL') {
    return NextResponse.json({ error: 'Chỉ Quản trị viên mới được phép lọc toàn trường.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  }
  if (!caller.isAdmin && unitCodeParam && unitCodeParam !== caller.unitCode.toUpperCase()) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập dữ liệu của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  }
  const rateErr = enforceApiRateLimit('read', caller.email);
  if (rateErr) return rateErr;
  return executeGetTicketsRoute(req, caller);
}

export async function POST(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  try {
    const parsed = await parseTicketJsonWithGuard(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const idempotencyKey = extractIdempotencyKey(req, body);
    const reqOwner = body.ownerEmail || body.owner_id, reqUnit = body.unitCode || body.unit_id, reqActor = body.actorEmail || body.actor_id;
    if (reqOwner && normalizeEmail(String(reqOwner)) !== normalizeEmail(caller.email)) return NextResponse.json({ error: 'Không ai được phép kê khai hoặc sửa trực tiếp nội dung của người khác.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
    if (reqActor && normalizeEmail(String(reqActor)) !== normalizeEmail(caller.email)) return NextResponse.json({ error: 'Không được phép giả mạo danh tính actor_id.', code: 'FORBIDDEN_ACTOR_SPOOFING' }, { status: 403 });
    if (body.role && String(body.role) !== caller.role) return NextResponse.json({ error: 'Không được phép giả mạo vai trò trong payload.', code: 'FORBIDDEN_ROLE_SPOOFING' }, { status: 403 });
    if (body.status === 'approved' || body.status === 'Đã duyệt') return NextResponse.json({ error: 'Không được phép tự gán trạng thái Đã duyệt trực tiếp.', code: 'FORBIDDEN_DIRECT_APPROVAL' }, { status: 403 });
    if (!caller.isAdmin && reqUnit && String(reqUnit).toUpperCase() !== caller.unitCode.toUpperCase()) return NextResponse.json({ error: 'Bạn không thể lập phiếu cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    if (!body.maNhiemVu || !body.tenCongViec || !body.maVtvl) return NextResponse.json({ error: 'Vui lòng chọn Mã nhiệm vụ, Mã vị trí việc làm và nhập Tên công việc.', code: 'MISSING_CORE_FIELDS' }, { status: 400 });

    const rateErr = enforceApiRateLimit('ticket_write', caller.email);
    if (rateErr) return rateErr;
    const effectiveUnit = caller.isAdmin && reqUnit ? String(reqUnit).toUpperCase() : caller.unitCode;
    const unitLockErr = await checkUnitWorkbookApprovedLock(effectiveUnit);
    if (unitLockErr) return unitLockErr;
    if (body.id) await syncSingleTicketFromSupabase(String(body.id)).catch(() => null);
    const existing = body.id ? getTicketById(String(body.id)) : null;
    const preGuardErr = validateMutableTicket(existing, caller.email);
    if (preGuardErr) return preGuardErr;

    const existingCanon = existing ? toCanonicalStatus(existing.status) : null;
    const isUpdatingPending = Boolean(existing && (existingCanon === 'submitted' || existingCanon === 'resubmitted'));
    if (isUpdatingPending && (body.action === 'draft' || body.status === 'draft' || body.status === 'Nháp')) {
      return NextResponse.json({ error: 'Phiếu đang Chờ duyệt không thể chuyển ngược về trạng thái Nháp.', code: 'FORBIDDEN_TICKET_LOCKED' }, { status: 403 });
    }
    const isSubmitting = body.action === 'submit' || body.status === 'Đã nộp' || body.status === 'submitted';
    const isResubmitting = body.action === 'resubmit' || body.status === 'Đã nộp lại' || body.status === 'resubmitted';
    const changeSummary = typeof body.changeSummary === 'string' ? body.changeSummary.trim() : undefined;

    if (isResubmitting && existingCanon !== 'changes_requested' && !isUpdatingPending) return NextResponse.json({ error: 'Chỉ phiếu có Yêu cầu bổ sung mới được nộp lại.', code: 'INVALID_STATUS_FOR_RESUBMIT' }, { status: 400 });
    if (isResubmitting && existingCanon === 'changes_requested' && !changeSummary) return NextResponse.json({ error: 'Vui lòng nhập Giải trình nội dung đã cập nhật trước khi nộp lại.', code: 'MISSING_CHANGE_SUMMARY' }, { status: 400 });
    if ((isSubmitting || isResubmitting || isUpdatingPending) && (!body.sanPham?.trim() || !body.chatLuong?.trim() || !body.canCu?.trim() || !Number(body.soSpNam) || !body.nguonSoLieu?.trim() || !Number(body.phutThucTe))) {
      return NextResponse.json({ error: 'Vui lòng điền đủ các trường bắt buộc (trừ các mục "nếu có") để nộp hoặc cập nhật phiếu.', code: 'MISSING_REQUIRED_FIELDS' }, { status: 400 });
    }

    return await withHeavyMutationBudget({ kind: 'ticket_mutation', op: 'submit_ticket', unitCode: effectiveUnit, actorEmail: caller.email }, () =>
      withCrossProcessLock(`ticket_unit_${effectiveUnit.toUpperCase()}`, async () => {
      if (idempotencyKey) {
        const recorded = await getRecordedIdempotencyResponse(idempotencyKey, 'ticket_post');
        if (recorded) return NextResponse.json({ ...recorded, idempotent: true });
      }
      if (body.id) await syncSingleTicketFromSupabase(String(body.id)).catch(() => null);
      const latestExisting = body.id ? getTicketById(String(body.id)) : null;
      const inLockGuardErr = validateMutableTicket(latestExisting, caller.email);
      if (inLockGuardErr) return inLockGuardErr;

      const concurrency = checkTicketOptimisticConcurrency(latestExisting, body);
      if (concurrency.conflict) {
        return NextResponse.json({
          error: concurrency.message, code: 'REVISION_CONFLICT', conflict: true,
          currentVersionNo: concurrency.currentVersionNo, currentUpdatedAt: concurrency.currentUpdatedAt
        }, { status: 409 });
      }

      const nowIso = new Date().toISOString();
      const curCanon = latestExisting ? toCanonicalStatus(latestExisting.status) : null;
      const pendingEdit = Boolean(latestExisting && (curCanon === 'submitted' || curCanon === 'resubmitted'));
      const resolvedStatus: TicketStatus = pendingEdit
        ? (curCanon === 'resubmitted' ? 'Đã nộp lại' : 'Đã nộp')
        : isResubmitting ? 'Đã nộp lại' : isSubmitting ? 'Đã nộp' : (latestExisting?.status === 'Yêu cầu bổ sung' ? 'Yêu cầu bổ sung' : 'Nháp');

      const oldMission = latestExisting?.maNhiemVu ? latestExisting.maNhiemVu.trim() : '';
      const newMission = String(body.maNhiemVu).trim();
      const missionChanged = Boolean(latestExisting && oldMission.toUpperCase() !== newMission.toUpperCase());

      if (latestExisting && !missionChanged && (pendingEdit || (curCanon === 'draft' && !isSubmitting)) && isSameEditablePayload(latestExisting, body, effectiveUnit, changeSummary)) {
        return NextResponse.json({ ok: true, idempotent: true, ticket: latestExisting });
      }

      let createdVersionNo: number | null = null, savedTicketId: string | null = null, replacedRecordId: string | null = null;
      try {
        const result = await upsertTicketAndSyncUnit({
          id: body.id, unitCode: latestExisting?.unitCode || effectiveUnit, ownerEmail: latestExisting?.ownerEmail || caller.email,
          ownerName: latestExisting?.ownerName || body.ownerName || caller.email.split('@')[0],
          ownerTitle: latestExisting?.ownerTitle || body.ownerTitle || (caller.isUnitLeader ? 'Lãnh đạo đơn vị' : 'Cán bộ – Giảng viên'),
          status: resolvedStatus, maNhiemVu: newMission,
          maCongViec: missionChanged ? '' : (latestExisting?.maCongViec || String(body.maCongViec || '')),
          tenCongViec: String(body.tenCongViec), maVtvl: String(body.maVtvl), maVtvlPhoiHop: body.maVtvlPhoiHop ? String(body.maVtvlPhoiHop) : '',
          coordinationNote: typeof body.coordinationNote === 'string' ? body.coordinationNote.trim() : '',
          coordinatedVtvls: normalizeCoordinatedVtvls(body.coordinatedVtvls, latestExisting?.unitCode || effectiveUnit),
          sanPham: String(body.sanPham || ''), chatLuong: String(body.chatLuong || ''), canCu: String(body.canCu || ''),
          soSpNam: Number(body.soSpNam) || 0, nguonSoLieu: String(body.nguonSoLieu || ''),
          phutThucTe: Number(body.phutThucTe) || 0, gioBoSung: Number(body.gioBoSung) || 0,
          coordinatedTasks: Array.isArray(body.coordinatedTasks) ? body.coordinatedTasks : (latestExisting?.coordinatedTasks || []),
          submittedAt: latestExisting?.submittedAt || (isSubmitting ? nowIso : undefined),
          resubmittedAt: (isResubmitting || pendingEdit) ? nowIso : latestExisting?.resubmittedAt,
          lastChangeSummary: changeSummary || (pendingEdit ? 'Cập nhật phiếu sau khi gửi duyệt' : latestExisting?.lastChangeSummary)
        });
        savedTicketId = result.ticket.id;

        const oldWorkCode = latestExisting?.maCongViec || '', newWorkCode = result.ticket.maCongViec;
        const missionChangeNote = missionChanged && oldWorkCode && oldWorkCode !== newWorkCode
          ? `Thay đổi Mã nhiệm vụ từ ${oldMission} sang ${newMission}; Mã công việc được thay đổi từ ${oldWorkCode} sang ${newWorkCode}.` : undefined;
        const prevVerNo = latestExisting?.currentVersionNo || 0;

        if (missionChanged && latestExisting && oldWorkCode && oldWorkCode !== newWorkCode) {
          replacedRecordId = recordReplacedWorkCode({
            surveyId: result.ticket.id, unitCode: result.ticket.unitCode, oldMissionCode: oldMission, newMissionCode: newMission,
            oldWorkCode, newWorkCode, status: 'replaced', ticketStatusAtChange: curCanon || 'draft',
            previousVersionNo: prevVerNo, currentVersionNo: (isSubmitting || isResubmitting || pendingEdit) ? prevVerNo + 1 : prevVerNo,
            actorEmail: caller.email, actorRole: caller.role, replacedAt: nowIso
          }).id;
        }

        const toCanon = toCanonicalStatus(resolvedStatus);
        if (isSubmitting || isResubmitting || pendingEdit) {
          const baseNote = changeSummary || (pendingEdit ? 'Cập nhật phiếu sau khi gửi duyệt' : undefined);
          const summaryNote = missionChangeNote ? (baseNote ? `${missionChangeNote} (${baseNote})` : missionChangeNote) : baseNote;
          const ver = await createImmutableSurveyVersion({
            surveyId: result.ticket.id, ticket: result.ticket, submittedBy: caller.email, submittedAt: nowIso,
            changeSummary: summaryNote, simulateFailure: Boolean(body._simulateVersionFailure)
          });
          createdVersionNo = ver.versionNo;
          if (hasTicketOrTargetCoordination(result.ticket, latestExisting)) { await syncSubmittedCoordinationProjection(result.ticket, ver); await computeWorkRelationshipsAndEnrichProposals([], result.ticket.unitCode, caller.isAdmin).catch(() => {}); }
          await appendTicketStatusHistory(result.ticket, {
            surveyId: result.ticket.id, fromStatus: curCanon || 'draft', toStatus: toCanon,
            action: missionChangeNote ? 'CHANGE_MISSION_CODE' : (pendingEdit ? 'UPDATE_PENDING' : (isResubmitting ? 'RESUBMIT' : 'SUBMIT')),
            reason: summaryNote, actorId: caller.email, actorRole: caller.role, unitId: result.ticket.unitCode,
            oldMissionCode: missionChanged ? oldMission : undefined, newMissionCode: missionChanged ? newMission : undefined,
            oldWorkCode: missionChanged ? oldWorkCode : undefined, newWorkCode: missionChanged ? newWorkCode : undefined,
            previousVersionNo: prevVerNo, currentVersionNo: ver.versionNo
          });
          const audit = appendAuditLog({
            unitCode: result.ticket.unitCode, unitName: findHcmuteUnit(result.ticket.unitCode).nameVi,
            action: missionChangeNote ? 'ĐỔI_MÃ_NHIỆM_VỤ_PHIẾU' : (pendingEdit ? 'CẬP_NHẬT_PHIẾU_CHỜ_DUYỆT' : (isResubmitting ? 'NỘP_LẠI_PHIẾU' : 'NỘP_PHIẾU')),
            targetId: result.ticket.id, targetEntity: 'staff_work_tickets',
            details: missionChangeNote ? `${missionChangeNote} (v${ver.versionNo})` : `${pendingEdit ? 'Cập nhật phiếu sau khi gửi duyệt' : (isResubmitting ? 'Nộp lại phiếu' : 'Nộp phiếu')} ${result.ticket.maCongViec} (v${ver.versionNo})`,
            actorEmail: caller.email, actorRole: caller.role,
            oldValues: latestExisting ? { status: curCanon, versionNo: prevVerNo, maNhiemVu: oldMission, maCongViec: oldWorkCode } : null,
            newValues: { status: toCanon, versionNo: ver.versionNo, maNhiemVu: newMission, maCongViec: newWorkCode, changeSummary: summaryNote }
          });
          await persistAuditLogToSupabase(audit);
        } else if (missionChangeNote && latestExisting) {
          if (body._simulateVersionFailure) {
            throw Object.assign(new Error('[VERSION_SNAPSHOT_FAILED] Lỗi giả lập khi cập nhật đổi mã nhiệm vụ.'), { code: 'VERSION_SNAPSHOT_FAILED', status: 500 });
          }
          await appendTicketStatusHistory(result.ticket, {
            surveyId: result.ticket.id, fromStatus: curCanon || 'draft', toStatus: toCanon,
            action: 'CHANGE_MISSION_CODE', reason: missionChangeNote, actorId: caller.email, actorRole: caller.role, unitId: result.ticket.unitCode,
            oldMissionCode: oldMission, newMissionCode: newMission, oldWorkCode, newWorkCode, previousVersionNo: prevVerNo, currentVersionNo: prevVerNo
          });
        }
        const finalTicket = getTicketById(result.ticket.id) || result.ticket;
        const responsePayload = { ok: true, ticket: finalTicket, unitWorkbookRevision: result.unitWorkbookRevision };
        if (idempotencyKey) {
          await saveIdempotencyResponse({ idempotencyKey, actionScope: 'ticket_post', actorEmail: caller.email, targetId: finalTicket.id, response: responsePayload });
        }
        return NextResponse.json(responsePayload);
      } catch (txErr) {
        if (savedTicketId) {
          if (replacedRecordId) compensateRemoveReplacedWorkCode(savedTicketId, replacedRecordId);
          if (createdVersionNo !== null) { compensateRemoveSurveyVersion(savedTicketId, createdVersionNo); compensateRemoveCoordinationProjection(savedTicketId, createdVersionNo); }
          restoreTicketInMemory(latestExisting || undefined, savedTicketId);
        }
        throw txErr;
      }
    }));
  } catch (err: unknown) {
    return handleTicketRouteError(err, 'Lưu phiếu công việc thất bại.');
  }
}

export async function DELETE(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  const rateErr = enforceApiRateLimit('ticket_write', caller.email);
  if (rateErr) return rateErr;
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Thiếu mã phiếu cần xóa.', code: 'MISSING_ID' }, { status: 400 });

  let target = getTicketById(id);
  if (!target) { await syncSingleTicketFromSupabase(id).catch(() => null); target = getTicketById(id); }
  if (!target) return NextResponse.json({ error: 'Không tìm thấy phiếu hoặc bạn không có quyền xóa.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
  const deleteLockErr = await checkUnitWorkbookApprovedLock(target.unitCode);
  if (deleteLockErr) return deleteLockErr;

  const isUnitReviewer = caller.isAdmin || (caller.isUnitLeader && target.unitCode.toUpperCase() === caller.unitCode.toUpperCase());
  const isDraft = toCanonicalStatus(target.status) === 'draft';
  if (!isDraft && isUnitReviewer) {
    return withHeavyMutationBudget({ kind: 'ticket_mutation', unitCode: target.unitCode, actorEmail: caller.email }, () =>
      executeRevokeOrCancelTicket(caller, target, 'cancel_ticket', req.nextUrl.searchParams.get('reason') || 'Hủy / xóa phiếu kê khai sai')
    );
  }
  if (normalizeEmail(target.ownerEmail) !== normalizeEmail(caller.email) && !caller.isAdmin) {
    return NextResponse.json({ error: 'Bạn không có quyền xóa phiếu của người khác.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
  }
  if (!isDraft && !caller.isAdmin) return NextResponse.json({ error: 'Chỉ phiếu Nháp mới được phép xóa.', code: 'FORBIDDEN_DELETE_NON_DRAFT' }, { status: 403 });
  try {
    const actor = caller.isAdmin ? (target.ownerEmail || caller.email) : caller.email;
    const deleted = await withHeavyMutationBudget({ kind: 'ticket_mutation', unitCode: target.unitCode, actorEmail: caller.email }, () =>
      deleteTicketAndSyncUnit(id, actor)
    );
    if (!deleted) return NextResponse.json({ error: 'Không tìm thấy phiếu.' }, { status: 403 });
    const delAudit = appendAuditLog({ unitCode: target.unitCode, unitName: target.unitCode, action: 'XÓA_PHIẾU_NHÁP', details: `Xóa phiếu nháp ${target.maCongViec}: ${target.tenCongViec}`, actorEmail: caller.email, actorRole: caller.role, targetId: target.id, targetEntity: 'staff_work_tickets' });
    await persistAuditLogToSupabase(delAudit).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return handleTicketRouteError(err, 'Xóa phiếu thất bại.');
  }
}

export async function PUT(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  const rateErr = enforceApiRateLimit('ticket_write', caller.email);
  if (rateErr) return rateErr;
  const parsed = await parseTicketJsonWithGuard(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const requestedUnit = (body.unitCode || caller.unitCode).toUpperCase();
  if (!caller.isAdmin && requestedUnit !== caller.unitCode) {
    return NextResponse.json({ error: 'Không thể cấp mã cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  }
  const maNhiemVu = String(body.maNhiemVu || '').trim();
  if (!maNhiemVu) return NextResponse.json({ nextTaskCode: '' });
  return await withCrossProcessLock(`ticket_unit_${requestedUnit}`, async () => {
    await syncServerWorkbooksFromSupabase(false, requestedUnit);
    const wb = getOrCreateWorkbook(requestedUnit, '01/10/2025–30/9/2026', caller.email, caller.role);
    const nextTaskCode = await allocateNextTaskCodeAsync(requestedUnit, maNhiemVu, wb.data.A2 || [], getTicketsByUnit(requestedUnit, true), body.excludeTicketId);
    return NextResponse.json({ nextTaskCode, maCongViec: nextTaskCode });
  });
}

export async function PATCH(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  try {
    const parsed = await parseTicketJsonWithGuard(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const act = String(body.action || '').trim();
    const rateGroup = act === 'submit' || act === 'resubmit' ? 'ticket_write' : 'ticket_review';
    const rateErr = enforceApiRateLimit(rateGroup, caller.email);
    if (rateErr) return rateErr;
    const idempotencyKey = extractIdempotencyKey(req, body);
    if (idempotencyKey) body.idempotencyKey = idempotencyKey;
    const targetId = String(body.ticketId || body.id || '').trim();
    const unitCode = (targetId ? getTicketById(targetId)?.unitCode : '') || String(body.unitCode || caller.unitCode || '');
    return await withHeavyMutationBudget({ kind: 'ticket_mutation', op: 'review_ticket', unitCode, actorEmail: caller.email }, () =>
      executePatchTicketAction(caller, body)
    );
  } catch (err: unknown) {
    return handleTicketRouteError(err, 'Lỗi máy chủ khi thao tác phiếu.');
  }
}
