import { NextResponse } from 'next/server';
import {
  getTicketById,
  upsertTicketAndSyncUnit,
  mergeApprovedTicketToUnitWorkbook,
  appendTicketStatusHistory,
  restoreTicketInMemory,
  syncTicketsFromSupabase
} from '@/services/storage/server-ticket-store';
import { executeRevokeOrCancelTicket } from '@/services/storage/server-ticket-unmerge';
import {
  createImmutableSurveyVersion,
  compensateRemoveSurveyVersion
} from '@/services/storage/server-ticket-version-store';
import { withCrossProcessLock } from '@/services/storage/server-file-lock';
import { normalizeEmail } from '@/services/storage/server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { CallerAuthContext } from '@/services/storage/server-auth-guard';
import { appendAuditLog, persistAuditLogToSupabase } from '@/services/storage/server-audit-store';
import { StaffWorkTicket, TicketStatus, toCanonicalStatus } from '@/types/staff-ticket';
import {
  compensateRemoveCoordinationProjection,
  syncSubmittedCoordinationProjection
} from './vtvl-coordination-service';
import {
  checkTicketOptimisticConcurrency,
  getRecordedIdempotencyResponse,
  saveIdempotencyResponse
} from '@/services/storage/server-mission-counter';
import { checkUnitWorkbookApprovedLock } from '@/services/workbooks/workbook-lock-guard';

export async function executePatchTicketAction(caller: CallerAuthContext, body: Record<string, unknown>) {
  const { id, ticketId, action, note, reason, revisionNotes, changeSummary } = body;
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  const reqActor = body.actorEmail || body.actor_id;
  if (reqActor && normalizeEmail(String(reqActor)) !== normalizeEmail(caller.email)) {
    return NextResponse.json({ error: 'Không được phép giả mạo danh tính actor_id.', code: 'FORBIDDEN_ACTOR_SPOOFING' }, { status: 403 });
  }
  if (body.role && String(body.role) !== caller.role) {
    return NextResponse.json({ error: 'Không được phép giả mạo vai trò trong payload.', code: 'FORBIDDEN_ROLE_SPOOFING' }, { status: 403 });
  }
  const targetId = String(ticketId || id || '').trim();
  const reasonText = String(reason || revisionNotes || note || '').trim();
  const act = String(action || '').trim();

  if (!targetId) return NextResponse.json({ error: 'Thiếu mã phiếu.', code: 'INVALID_ID' }, { status: 400 });
  if (!['approve', 'return', 'changes_requested', 'request_changes', 'submit', 'resubmit', 'merge', 'revoke_approval', 'cancel_ticket'].includes(act)) {
    return NextResponse.json({ error: 'Hành động không hợp lệ.', code: 'INVALID_ACTION' }, { status: 400 });
  }

  let target: StaffWorkTicket | null = getTicketById(targetId);
  if (!target) {
    await syncTicketsFromSupabase(typeof body.unitCode === 'string' ? body.unitCode : undefined).catch(() => {});
    target = getTicketById(targetId);
  }
  if (!target) return NextResponse.json({ error: 'Không tìm thấy phiếu.', code: 'TICKET_NOT_FOUND' }, { status: 404 });
  const unitLockErr = await checkUnitWorkbookApprovedLock(target.unitCode);
  if (unitLockErr) return unitLockErr;

  // 1. SUBMIT / RESUBMIT bởi chủ sở hữu phiếu
  if (act === 'submit' || act === 'resubmit') {
    if (normalizeEmail(target.ownerEmail) !== normalizeEmail(caller.email)) {
      return NextResponse.json({ error: 'Chỉ chủ sở hữu phiếu mới có quyền nộp hoặc nộp lại phiếu.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
    }
    if (!target.sanPham?.trim() || !target.chatLuong?.trim() || !target.canCu?.trim() || !Number(target.soSpNam) || !target.nguonSoLieu?.trim() || !Number(target.phutThucTe)) {
      return NextResponse.json({ error: 'Phiếu chưa đủ các trường bắt buộc (trừ các mục "nếu có") để nộp.', code: 'MISSING_REQUIRED_FIELDS' }, { status: 400 });
    }

    return await withCrossProcessLock(`ticket_unit_${target.unitCode.toUpperCase()}`, async () => {
      if (idempotencyKey) {
        const cached = await getRecordedIdempotencyResponse(idempotencyKey, `patch_${act}`);
        if (cached) return NextResponse.json({ ...cached, idempotent: true });
      }
      const latest = getTicketById(target.id) || target;
      const concurrency = checkTicketOptimisticConcurrency(latest, body);
      if (concurrency.conflict) {
        return NextResponse.json({ error: concurrency.message, code: 'REVISION_CONFLICT', conflict: true }, { status: 409 });
      }
      const curCanon = toCanonicalStatus(latest.status);
      const isResubmit = act === 'resubmit';

      if ((!isResubmit && curCanon === 'submitted') || (isResubmit && curCanon === 'resubmitted')) {
        return NextResponse.json({ ok: true, idempotent: true, ticket: latest });
      }
      if (isResubmit && curCanon !== 'changes_requested') {
        return NextResponse.json({ error: 'Chỉ phiếu có Yêu cầu bổ sung mới được nộp lại.', code: 'INVALID_STATUS_FOR_RESUBMIT' }, { status: 400 });
      }
      if (isResubmit && (!changeSummary || !String(changeSummary).trim())) {
        return NextResponse.json({ error: 'Vui lòng nhập Giải trình nội dung đã cập nhật trước khi nộp lại.', code: 'MISSING_CHANGE_SUMMARY' }, { status: 400 });
      }
      if (!isResubmit && curCanon !== 'draft') {
        return NextResponse.json({ error: 'Chỉ phiếu Nháp mới được nộp lần đầu.', code: 'INVALID_STATUS_FOR_SUBMIT' }, { status: 400 });
      }

      const nowIso = new Date().toISOString();
      const nextStatus: TicketStatus = isResubmit ? 'Đã nộp lại' : 'Đã nộp';
      let createdVersionNo: number | null = null;

      try {
        const ver = await createImmutableSurveyVersion({
          surveyId: latest.id,
          ticket: latest,
          submittedBy: caller.email,
          submittedAt: nowIso,
          changeSummary: typeof changeSummary === 'string' ? changeSummary.trim() : undefined,
          simulateFailure: Boolean(body._simulateVersionFailure || process.env.VTVL_SIMULATE_VERSION_WRITE_FAILURE === 'true')
        });
        createdVersionNo = ver.versionNo;

        const updated = await upsertTicketAndSyncUnit({
          ...latest,
          status: nextStatus,
          submittedAt: !isResubmit ? (latest.submittedAt || nowIso) : latest.submittedAt,
          resubmittedAt: isResubmit ? nowIso : latest.resubmittedAt,
          currentVersionNo: ver.versionNo,
          lastChangeSummary: typeof changeSummary === 'string' ? changeSummary.trim() : latest.lastChangeSummary
        });

        await appendTicketStatusHistory(updated.ticket, {
          surveyId: latest.id, fromStatus: curCanon, toStatus: isResubmit ? 'resubmitted' : 'submitted',
          action: isResubmit ? 'RESUBMIT' : 'SUBMIT', reason: typeof changeSummary === 'string' ? changeSummary.trim() : undefined,
          actorId: caller.email, actorRole: caller.role, unitId: latest.unitCode
        });
        await syncSubmittedCoordinationProjection(updated.ticket, ver);

        const audit = appendAuditLog({
          unitCode: latest.unitCode, unitName: findHcmuteUnit(latest.unitCode).nameVi,
          action: isResubmit ? 'NỘP_LẠI_PHIẾU' : 'NỘP_PHIẾU', targetId: latest.id, targetEntity: 'staff_work_tickets',
          details: `${isResubmit ? 'Nộp lại' : 'Nộp'} phiếu ${latest.maCongViec} (v${ver.versionNo})`,
          actorEmail: caller.email, actorRole: caller.role,
          oldValues: { status: curCanon, versionNo: latest.currentVersionNo || 0 },
          newValues: { status: isResubmit ? 'resubmitted' : 'submitted', versionNo: ver.versionNo, changeSummary }
        });
        await persistAuditLogToSupabase(audit);

        const finalTicket = getTicketById(latest.id) || updated.ticket;
        const payload = { ok: true, ticket: finalTicket };
        if (idempotencyKey) {
          await saveIdempotencyResponse({ idempotencyKey, actionScope: `patch_${act}`, actorEmail: caller.email, targetId: latest.id, response: payload });
        }
        return NextResponse.json(payload);
      } catch (txErr) {
        if (createdVersionNo !== null) {
          compensateRemoveSurveyVersion(latest.id, createdVersionNo);
          compensateRemoveCoordinationProjection(latest.id, createdVersionNo);
        }
        restoreTicketInMemory(latest, latest.id);
        throw txErr;
      }
    });
  }

  // Các thao tác xét duyệt / gộp đòi hỏi quyền Lãnh đạo đơn vị hoặc Admin
  if (caller.isStaff) {
    return NextResponse.json({ error: 'Cán bộ không có quyền duyệt, trả lại hoặc gộp phiếu.', code: 'FORBIDDEN_STAFF_REVIEW' }, { status: 403 });
  }
  if (!caller.isAdmin && target.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
    return NextResponse.json({ error: 'Lãnh đạo đơn vị chỉ thao tác trên phiếu thuộc đơn vị mình.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  }

  return await withCrossProcessLock(`ticket_unit_${target.unitCode.toUpperCase()}`, async () => {
    if (idempotencyKey) {
      const cached = await getRecordedIdempotencyResponse(idempotencyKey, `patch_${act}`);
      if (cached) return NextResponse.json({ ...cached, idempotent: true });
    }
    await syncTicketsFromSupabase(target.unitCode).catch(() => {});
    const latest = getTicketById(target.id) || target;
    const concurrency = checkTicketOptimisticConcurrency(latest, body);
    if (concurrency.conflict) {
      return NextResponse.json({ error: concurrency.message, code: 'REVISION_CONFLICT', conflict: true }, { status: 409 });
    }
    const nowIso = new Date().toISOString();
    const curCanon = toCanonicalStatus(latest.status);

    if (act === 'revoke_approval' || act === 'cancel_ticket') {
      return await executeRevokeOrCancelTicket(caller, latest, act, reasonText);
    }

    // 2. MERGE vào biểu A2 & B1
    if (act === 'merge') {
      if (curCanon !== 'approved') {
        return NextResponse.json({ error: 'Chỉ phiếu Đã duyệt mới được phép gộp vào biểu đơn vị.', code: 'FORBIDDEN_UNAPPROVED_MERGE' }, { status: 400 });
      }
      const result = await mergeApprovedTicketToUnitWorkbook(
        latest.id,
        caller.email,
        Boolean(body._simulateMergeFailure || process.env.VTVL_SIMULATE_MERGE_FAILURE === 'true')
      );
      await appendTicketStatusHistory(result.ticket, {
        surveyId: latest.id, fromStatus: 'approved', toStatus: 'approved', action: 'MERGE_TO_SHEETS',
        actorId: caller.email, actorRole: caller.role, unitId: latest.unitCode
      });
      const audit = appendAuditLog({
        unitCode: latest.unitCode, unitName: findHcmuteUnit(latest.unitCode).nameVi, action: 'GỘP_PHIẾU_A2_B1',
        targetId: latest.id, targetEntity: 'staff_work_tickets',
        details: `Gộp phiếu ${latest.maCongViec} (v${result.ticket.currentVersionNo || 1}) vào biểu A2 (${result.ticket.a2RowId}) và B1 (${result.ticket.b1RowId})`,
        actorEmail: caller.email, actorRole: caller.role,
        oldValues: { isMergedToB1B2: Boolean(latest.isMergedToB1B2) },
        newValues: { isMergedToB1B2: true, sourceVersion: result.ticket.currentVersionNo || 1, a2RowId: result.ticket.a2RowId, b1RowId: result.ticket.b1RowId, b2RowId: result.ticket.b2RowId || null }
      });
      await persistAuditLogToSupabase(audit);
      const payload = { ok: true, merged: true, ticket: getTicketById(latest.id) || result.ticket, unitWorkbookRevision: result.unitWorkbookRevision };
      if (idempotencyKey) {
        await saveIdempotencyResponse({ idempotencyKey, actionScope: `patch_${act}`, actorEmail: caller.email, targetId: latest.id, response: payload });
      }
      return NextResponse.json(payload);
    }

    // 3. APPROVE
    if (act === 'approve') {
      if (!caller.isAdmin && normalizeEmail(latest.ownerEmail) === normalizeEmail(caller.email)) {
        return NextResponse.json({
          error: 'Lãnh đạo đơn vị không thể tự duyệt phiếu của chính mình. Vui lòng chuyển Quản trị viên (TCNS) phê duyệt.',
          code: 'FORBIDDEN_SELF_REVIEW'
        }, { status: 403 });
      }
      if (curCanon === 'approved' && idempotencyKey) {
        return NextResponse.json({ ok: true, idempotent: true, ticket: latest });
      }
      if (curCanon !== 'submitted' && curCanon !== 'resubmitted') {
        return NextResponse.json({ error: 'Chỉ phiếu Đã nộp hoặc Đã nộp lại mới có thể phê duyệt.', code: 'INVALID_STATUS_FOR_APPROVAL' }, { status: 400 });
      }
      const result = await upsertTicketAndSyncUnit({
        ...latest, status: 'Đã duyệt', approvedBy: caller.email, approvedAt: nowIso
      });
      await appendTicketStatusHistory(result.ticket, {
        surveyId: latest.id, fromStatus: curCanon, toStatus: 'approved', action: 'APPROVE',
        reason: reasonText || undefined, actorId: caller.email, actorRole: caller.role, unitId: latest.unitCode
      });
      if (body.autoMerge !== false && !result.ticket.isTestData && !result.ticket.isArchived) {
        const mergeRes = await mergeApprovedTicketToUnitWorkbook(latest.id, caller.email, Boolean(body._simulateMergeFailure || process.env.VTVL_SIMULATE_MERGE_FAILURE === 'true'));
        await appendTicketStatusHistory(mergeRes.ticket, {
          surveyId: latest.id, fromStatus: 'approved', toStatus: 'approved', action: 'MERGE_TO_SHEETS',
          reason: 'Tự động đưa vào Biểu A2 & B1 khi duyệt phiếu', actorId: caller.email, actorRole: caller.role, unitId: latest.unitCode
        });
      }
      const audit = appendAuditLog({
        unitCode: latest.unitCode, unitName: findHcmuteUnit(latest.unitCode).nameVi, action: 'DUYỆT_PHIẾU',
        targetId: latest.id, targetEntity: 'staff_work_tickets',
        details: `Duyệt phiếu ${latest.maCongViec} (${latest.tenCongViec}) của ${latest.ownerEmail}`,
        actorEmail: caller.email, actorRole: caller.role,
        oldValues: { status: curCanon }, newValues: { status: 'approved', approvedBy: caller.email, approvedAt: nowIso }
      });
      await persistAuditLogToSupabase(audit);
      const payload = { ok: true, ticket: getTicketById(latest.id) || result.ticket };
      if (idempotencyKey) {
        await saveIdempotencyResponse({ idempotencyKey, actionScope: `patch_${act}`, actorEmail: caller.email, targetId: latest.id, response: payload });
      }
      return NextResponse.json(payload);
    }

    // 4. REQUEST_CHANGES / RETURN
    if (act === 'changes_requested' || act === 'return' || act === 'request_changes') {
      if (!reasonText) {
        return NextResponse.json({ error: 'Lý do yêu cầu bổ sung là bắt buộc và không được để trống.', code: 'MISSING_REVISION_REASON' }, { status: 400 });
      }
      if (!caller.isAdmin && normalizeEmail(latest.ownerEmail) === normalizeEmail(caller.email)) {
        return NextResponse.json({ error: 'Lãnh đạo đơn vị không được tự xét duyệt phiếu của chính mình.', code: 'FORBIDDEN_SELF_REVIEW' }, { status: 403 });
      }
      if (curCanon !== 'submitted' && curCanon !== 'resubmitted') {
        return NextResponse.json({ error: 'Chỉ phiếu Đã nộp hoặc Đã nộp lại mới có thể yêu cầu bổ sung.', code: 'INVALID_STATUS_FOR_RETURN' }, { status: 400 });
      }
      const result = await upsertTicketAndSyncUnit({
        ...latest, status: 'Yêu cầu bổ sung', revisionReason: reasonText,
        revisionRequestedBy: caller.email, revisionRequestedAt: nowIso
      });
      await appendTicketStatusHistory(result.ticket, {
        surveyId: latest.id, fromStatus: curCanon, toStatus: 'changes_requested', action: 'REQUEST_CHANGES',
        reason: reasonText, actorId: caller.email, actorRole: caller.role, unitId: latest.unitCode
      });
      const audit = appendAuditLog({
        unitCode: latest.unitCode, unitName: findHcmuteUnit(latest.unitCode).nameVi, action: 'YÊU_CẦU_BỔ_SUNG_PHIẾU',
        targetId: latest.id, targetEntity: 'staff_work_tickets',
        details: `Yêu cầu bổ sung phiếu ${latest.maCongViec}: ${reasonText}`,
        actorEmail: caller.email, actorRole: caller.role,
        oldValues: { status: curCanon }, newValues: { status: 'changes_requested', revisionReason: reasonText }
      });
      await persistAuditLogToSupabase(audit);
      return NextResponse.json({ ok: true, ticket: getTicketById(latest.id) || result.ticket });
    }

    return NextResponse.json({ error: 'Thao tác không hợp lệ.' }, { status: 400 });
  });
}
