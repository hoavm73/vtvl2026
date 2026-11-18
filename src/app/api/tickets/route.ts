import { NextRequest, NextResponse } from 'next/server';
import {
  getTicketsByOwner, getTicketsByUnit, getTicketById, upsertTicketAndSyncUnit, deleteTicketAndSyncUnit,
  allocateNextTaskCode, syncTicketsFromWorkbook, syncTicketsFromSupabase, appendTicketStatusHistory, restoreTicketInMemory
} from '@/services/storage/server-ticket-store';
import { executeRevokeOrCancelTicket } from '@/services/storage/server-ticket-unmerge';
import { reconcileApprovedUnitTicketsToWorkbook } from '@/services/storage/server-ticket-merge';
import { createImmutableSurveyVersion, compensateRemoveSurveyVersion, ensureLegacyBaselineVersion } from '@/services/storage/server-ticket-version-store';
import { compensateRemoveReplacedWorkCode, recordReplacedWorkCode, syncVersionsCacheFromSupabase } from '@/services/storage/server-coordination-store';
import { withCrossProcessLock } from '@/services/storage/server-file-lock';
import { getOrCreateWorkbook, normalizeEmail, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { appendAuditLog, persistAuditLogToSupabase } from '@/services/storage/server-audit-store';
import { StaffWorkTicket, TicketStatus, toCanonicalStatus } from '@/types/staff-ticket';
import { executePatchTicketAction } from '@/services/tickets/ticket-workflow-handlers';
import { compensateRemoveCoordinationProjection, syncSubmittedCoordinationProjection } from '@/services/tickets/vtvl-coordination-service';
import { normalizeCoordinatedVtvls, resolveUnitCodeSafe } from '@/services/tickets/vtvl-coordination-helpers';
import { computeWorkRelationshipsAndEnrichProposals } from '@/services/storage/server-work-relationship-store';

function handleRouteError(err: unknown, defaultMessage: string) {
  const errObj = err as { code?: string; status?: number; message?: string };
  if (errObj?.code === 'REVISION_CONFLICT' || errObj?.status === 409) {
    return NextResponse.json({ error: 'Xung đột phiên bản dữ liệu máy chủ.', code: 'REVISION_CONFLICT' }, { status: 409 });
  }
  if (errObj?.code === 'DATABASE_SCHEMA_OUTDATED') {
    return NextResponse.json({ error: errObj.message || 'Lược đồ CSDL chưa cập nhật.', code: 'DATABASE_SCHEMA_OUTDATED' }, { status: 500 });
  }
  if (errObj?.code === 'VERSION_SNAPSHOT_FAILED' || errObj?.code === 'DB_VERSION_WRITE_FAILED') {
    return NextResponse.json({ error: errObj.message || 'Lỗi lưu phiên bản phiếu.', code: errObj.code }, { status: 500 });
  }
  return NextResponse.json({ error: errObj?.message || defaultMessage, code: errObj?.code || 'PERSISTENCE_FAILED' }, { status: errObj?.status || 502 });
}

function isSameEditablePayload(ex: StaffWorkTicket, body: Record<string, unknown>, effectiveUnit: string, changeSummary?: string): boolean {
  const nextCoord = normalizeCoordinatedVtvls(body.coordinatedVtvls as StaffWorkTicket['coordinatedVtvls'], ex.unitCode || effectiveUnit);
  return ex.tenCongViec.trim() === String(body.tenCongViec || '').trim() && ex.maVtvl.trim() === String(body.maVtvl || '').trim() &&
    (ex.maVtvlPhoiHop || '').trim() === String(body.maVtvlPhoiHop || '').trim() && (ex.coordinationNote || '').trim() === String(body.coordinationNote || '').trim() &&
    JSON.stringify(ex.coordinatedVtvls || []) === JSON.stringify(nextCoord) && (ex.sanPham || '').trim() === String(body.sanPham || '').trim() &&
    (ex.chatLuong || '').trim() === String(body.chatLuong || '').trim() && (ex.canCu || '').trim() === String(body.canCu || '').trim() &&
    Number(ex.soSpNam) === (Number(body.soSpNam) || 0) && (ex.nguonSoLieu || '').trim() === String(body.nguonSoLieu || '').trim() &&
    Number(ex.phutThucTe) === (Number(body.phutThucTe) || 0) && Number(ex.gioBoSung) === (Number(body.gioBoSung) || 0) &&
    (!changeSummary || changeSummary === (ex.lastChangeSummary || ''));
}

function validateMutableTicket(ex: StaffWorkTicket | null, callerEmail: string): NextResponse | null {
  if (!ex) return null;
  if (normalizeEmail(ex.ownerEmail) !== normalizeEmail(callerEmail)) return NextResponse.json({ error: 'Chỉ chủ sở hữu mới được phép sửa nội dung phiếu kê khai của mình.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
  if (ex.isMergedToB1B2) return NextResponse.json({ error: 'Phiếu đã được gộp vào Biểu B1/B2 nên không thể chỉnh sửa nội dung nguồn.', code: 'FORBIDDEN_TICKET_MERGED' }, { status: 403 });
  if (toCanonicalStatus(ex.status) === 'approved') return NextResponse.json({ error: 'Phiếu đã được duyệt nên không thể tiếp tục chỉnh sửa. Vui lòng tải lại dữ liệu.', code: 'FORBIDDEN_TICKET_APPROVED' }, { status: 403 });
  if (ex.isArchived) return NextResponse.json({ error: 'Phiếu đã bị hủy hoặc khóa nên không thể chỉnh sửa.', code: 'FORBIDDEN_TICKET_LOCKED' }, { status: 403 });
  return null;
}

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  const singleTicketId = (req.nextUrl.searchParams.get('id') || '').trim();
  if (singleTicketId) {
    await syncVersionsCacheFromSupabase().catch(() => {});
    let found = getTicketById(singleTicketId);
    if (!found) { await syncTicketsFromSupabase().catch(() => {}); found = getTicketById(singleTicketId); }
    if (!found || (found.isArchived && !caller.isAdmin)) return NextResponse.json({ error: 'Không tìm thấy phiếu.', code: 'TICKET_NOT_FOUND' }, { status: 404 });
    if (!caller.isAdmin && found.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) return NextResponse.json({ error: 'Bạn không có quyền xem phiếu hoặc lịch sử phiên bản của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    if (!caller.isAdmin && toCanonicalStatus(found.status) === 'draft' && normalizeEmail(found.ownerEmail) !== normalizeEmail(caller.email)) return NextResponse.json({ error: 'Phiếu Nháp chỉ chủ sở hữu và Quản trị viên mới được xem.', code: 'FORBIDDEN_DRAFT_ACCESS' }, { status: 403 });
    return NextResponse.json({ ticket: found, versions: ensureLegacyBaselineVersion(found) });
  }

  const unitCodeParam = (req.nextUrl.searchParams.get('unitCode') || '').trim().toUpperCase();
  if (!caller.isAdmin && unitCodeParam && unitCodeParam !== caller.unitCode) return NextResponse.json({ error: 'Bạn không có quyền truy cập dữ liệu của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  const isAllUnits = caller.isAdmin && unitCodeParam === 'ALL';
  const requestedCode = caller.isAdmin && unitCodeParam && !isAllUnits ? resolveUnitCodeSafe(unitCodeParam) : caller.unitCode;
  const unit = findHcmuteUnit(requestedCode);
  const queryCode = isAllUnits ? 'ALL' : (caller.isAdmin && unitCodeParam ? requestedCode : unit.code);
  const isKnownUnit = isAllUnits || unit.code.toUpperCase() === queryCode.toUpperCase();
  await syncTicketsFromSupabase(isAllUnits ? undefined : queryCode);
  if (isKnownUnit) await syncServerWorkbooksFromSupabase(true);
  const wb = isKnownUnit ? getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', caller.email, caller.role) : null;
  if (!isAllUnits && wb) { await syncTicketsFromWorkbook(wb.data, unit.code); await reconcileApprovedUnitTicketsToWorkbook(unit.code, caller.email).catch(() => 0); }
  const latestWb = isKnownUnit ? getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', caller.email, caller.role) : null;
  const myTickets = getTicketsByOwner(caller.email, queryCode === 'ALL' ? unit.code : queryCode), rawUnitTickets = getTicketsByUnit(queryCode);
  const unitTickets = caller.isAdmin ? rawUnitTickets : rawUnitTickets.filter((t) => normalizeEmail(t.ownerEmail) === normalizeEmail(caller.email) || toCanonicalStatus(t.status) !== 'draft');

  return NextResponse.json({
    myTickets, unitTickets, unitCode: queryCode === 'ALL' ? unit.code : queryCode, unitNameVi: isKnownUnit ? unit.nameVi : queryCode,
    a1Missions: latestWb?.data.A1 || [], c1Vtvls: latestWb?.data.C1 || [],
    unitA2Tasks: latestWb?.data.A2 || [], unitB1Volumes: latestWb?.data.B1 || []
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  try {
    const body = await req.json();
    const reqOwner = body.ownerEmail || body.owner_id, reqUnit = body.unitCode || body.unit_id, reqActor = body.actorEmail || body.actor_id;
    if (reqOwner && normalizeEmail(String(reqOwner)) !== normalizeEmail(caller.email)) return NextResponse.json({ error: 'Không ai được phép kê khai hoặc sửa trực tiếp nội dung của người khác.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
    if (reqActor && normalizeEmail(String(reqActor)) !== normalizeEmail(caller.email)) return NextResponse.json({ error: 'Không được phép giả mạo danh tính actor_id.', code: 'FORBIDDEN_ACTOR_SPOOFING' }, { status: 403 });
    if (body.role && String(body.role) !== caller.role) return NextResponse.json({ error: 'Không được phép giả mạo vai trò trong payload.', code: 'FORBIDDEN_ROLE_SPOOFING' }, { status: 403 });
    if (body.status === 'approved' || body.status === 'Đã duyệt') return NextResponse.json({ error: 'Không được phép tự gán trạng thái Đã duyệt trực tiếp.', code: 'FORBIDDEN_DIRECT_APPROVAL' }, { status: 403 });
    if (!caller.isAdmin && reqUnit && String(reqUnit).toUpperCase() !== caller.unitCode.toUpperCase()) return NextResponse.json({ error: 'Bạn không thể lập phiếu cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    if (!body.maNhiemVu || !body.tenCongViec || !body.maVtvl) return NextResponse.json({ error: 'Vui lòng chọn Mã nhiệm vụ, Mã vị trí việc làm và nhập Tên công việc.', code: 'MISSING_CORE_FIELDS' }, { status: 400 });

    const effectiveUnit = caller.isAdmin && reqUnit ? String(reqUnit).toUpperCase() : caller.unitCode;
    if (body.id) await syncTicketsFromSupabase(effectiveUnit).catch(() => {});
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

    return await withCrossProcessLock(`ticket_unit_${effectiveUnit.toUpperCase()}`, async () => {
      if (body.id) await syncTicketsFromSupabase(effectiveUnit).catch(() => {});
      const latestExisting = body.id ? getTicketById(String(body.id)) : null;
      const inLockGuardErr = validateMutableTicket(latestExisting, caller.email);
      if (inLockGuardErr) return inLockGuardErr;

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
          await syncSubmittedCoordinationProjection(result.ticket, ver);
          await computeWorkRelationshipsAndEnrichProposals([], result.ticket.unitCode, caller.isAdmin).catch(() => {});
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
        return NextResponse.json({ ok: true, ticket: getTicketById(result.ticket.id) || result.ticket, unitWorkbookRevision: result.unitWorkbookRevision });
      } catch (txErr) {
        if (savedTicketId) {
          if (replacedRecordId) compensateRemoveReplacedWorkCode(savedTicketId, replacedRecordId);
          if (createdVersionNo !== null) { compensateRemoveSurveyVersion(savedTicketId, createdVersionNo); compensateRemoveCoordinationProjection(savedTicketId, createdVersionNo); }
          restoreTicketInMemory(latestExisting || undefined, savedTicketId);
        }
        throw txErr;
      }
    });
  } catch (err: unknown) {
    return handleRouteError(err, 'Lưu phiếu công việc thất bại.');
  }
}

export async function DELETE(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return NextResponse.json({ error: 'Thiếu mã phiếu cần xóa.', code: 'MISSING_ID' }, { status: 400 });

  let target = getTicketById(id);
  if (!target) { await syncTicketsFromSupabase().catch(() => {}); target = getTicketById(id); }
  if (!target) return NextResponse.json({ error: 'Không tìm thấy phiếu hoặc bạn không có quyền xóa.', code: 'FORBIDDEN_IDOR' }, { status: 403 });

  const isUnitReviewer = caller.isAdmin || (caller.isUnitLeader && target.unitCode.toUpperCase() === caller.unitCode.toUpperCase());
  const isDraft = toCanonicalStatus(target.status) === 'draft';
  if (!isDraft && isUnitReviewer) {
    return await executeRevokeOrCancelTicket(caller, target, 'cancel_ticket', req.nextUrl.searchParams.get('reason') || 'Hủy / xóa phiếu kê khai sai');
  }
  if (normalizeEmail(target.ownerEmail) !== normalizeEmail(caller.email) && !caller.isAdmin) {
    return NextResponse.json({ error: 'Bạn không có quyền xóa phiếu của người khác.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
  }
  if (!isDraft && !caller.isAdmin) {
    return NextResponse.json({ error: 'Chỉ phiếu Nháp mới được phép xóa.', code: 'FORBIDDEN_DELETE_NON_DRAFT' }, { status: 403 });
  }
  try {
    const actor = caller.isAdmin ? (target.ownerEmail || caller.email) : caller.email;
    const deleted = await deleteTicketAndSyncUnit(id, actor);
    if (!deleted) return NextResponse.json({ error: 'Không tìm thấy phiếu.' }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return handleRouteError(err, 'Xóa phiếu thất bại.');
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
  return await withCrossProcessLock(`ticket_unit_${requestedUnit}`, async () => {
    await syncServerWorkbooksFromSupabase(true);
    const wb = getOrCreateWorkbook(requestedUnit, '01/10/2025–30/9/2026', caller.email, caller.role);
    const nextTaskCode = allocateNextTaskCode(requestedUnit, maNhiemVu, wb.data.A2 || [], getTicketsByUnit(requestedUnit, true), body.excludeTicketId);
    return NextResponse.json({ nextTaskCode, maCongViec: nextTaskCode });
  });
}

export async function PATCH(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  try {
    return await executePatchTicketAction(caller, (await req.json()) as Record<string, unknown>);
  } catch (err: unknown) {
    return handleRouteError(err, 'Lỗi máy chủ khi thao tác phiếu.');
  }
}
