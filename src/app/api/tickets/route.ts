import { NextRequest, NextResponse } from 'next/server';
import {
  getTicketsByOwner, getTicketsByUnit, getTicketById, upsertTicketAndSyncUnit, deleteTicketAndSyncUnit,
  allocateNextTaskCode, syncTicketsFromWorkbook, syncTicketsFromSupabase, appendTicketStatusHistory, restoreTicketInMemory
} from '@/services/storage/server-ticket-store';
import {
  withSurveySubmissionLock, createImmutableSurveyVersion, compensateRemoveSurveyVersion, ensureLegacyBaselineVersion
} from '@/services/storage/server-ticket-version-store';
import { getOrCreateWorkbook, normalizeEmail, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { appendAuditLog, persistAuditLogToSupabase } from '@/services/storage/server-audit-store';
import { TicketStatus, toCanonicalStatus } from '@/types/staff-ticket';
import { executePatchTicketAction } from '@/services/tickets/ticket-workflow-handlers';

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

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  const singleTicketId = (req.nextUrl.searchParams.get('id') || '').trim();
  if (singleTicketId) {
    const found = getTicketById(singleTicketId);
    if (!found) return NextResponse.json({ error: 'Không tìm thấy phiếu.', code: 'TICKET_NOT_FOUND' }, { status: 404 });
    if (!caller.isAdmin && found.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json({ error: 'Bạn không có quyền xem phiếu hoặc lịch sử phiên bản của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    }
    if (!caller.isAdmin && toCanonicalStatus(found.status) === 'draft' && normalizeEmail(found.ownerEmail) !== normalizeEmail(caller.email)) {
      return NextResponse.json({ error: 'Phiếu Nháp chỉ chủ sở hữu và Quản trị viên mới được xem.', code: 'FORBIDDEN_DRAFT_ACCESS' }, { status: 403 });
    }
    return NextResponse.json({ ticket: found, versions: ensureLegacyBaselineVersion(found) });
  }

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
    : rawUnitTickets.filter((t) => normalizeEmail(t.ownerEmail) === normalizeEmail(caller.email) || toCanonicalStatus(t.status) !== 'draft');

  return NextResponse.json({
    myTickets,
    unitTickets,
    unitCode: unit.code,
    unitNameVi: unit.nameVi,
    a1Missions: wb.data.A1 || [],
    c1Vtvls: wb.data.C1 || [],
    unitA2Tasks: wb.data.A2 || [],
    unitB1Volumes: wb.data.B1 || []
  });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  try {
    const body = await req.json();
    const reqOwner = body.ownerEmail || body.owner_id;
    const reqUnit = body.unitCode || body.unit_id;
    const reqActor = body.actorEmail || body.actor_id;
    if (reqOwner && normalizeEmail(String(reqOwner)) !== normalizeEmail(caller.email)) {
      return NextResponse.json({ error: 'Không ai được phép kê khai hoặc sửa trực tiếp nội dung của người khác.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
    }
    if (reqActor && normalizeEmail(String(reqActor)) !== normalizeEmail(caller.email)) {
      return NextResponse.json({ error: 'Không được phép giả mạo danh tính actor_id.', code: 'FORBIDDEN_ACTOR_SPOOFING' }, { status: 403 });
    }
    if (body.role && String(body.role) !== caller.role) {
      return NextResponse.json({ error: 'Không được phép giả mạo vai trò trong payload.', code: 'FORBIDDEN_ROLE_SPOOFING' }, { status: 403 });
    }
    if (body.status === 'approved' || body.status === 'Đã duyệt') {
      return NextResponse.json({ error: 'Không được phép tự gán trạng thái Đã duyệt trực tiếp.', code: 'FORBIDDEN_DIRECT_APPROVAL' }, { status: 403 });
    }
    if (!caller.isAdmin && reqUnit && String(reqUnit).toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json({ error: 'Bạn không thể lập phiếu cho đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    }
    if (!body.maNhiemVu || !body.tenCongViec || !body.maVtvl) {
      return NextResponse.json({ error: 'Vui lòng chọn Mã nhiệm vụ, Mã vị trí việc làm và nhập Tên công việc.', code: 'MISSING_CORE_FIELDS' }, { status: 400 });
    }

    const effectiveUnit = caller.isAdmin && reqUnit ? String(reqUnit).toUpperCase() : caller.unitCode;
    const existing = body.id ? getTicketById(String(body.id)) : null;

    if (existing) {
      if (normalizeEmail(existing.ownerEmail) !== normalizeEmail(caller.email)) {
        return NextResponse.json({ error: 'Chỉ chủ sở hữu mới được phép sửa nội dung phiếu kê khai của mình.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
      }
      const canonical = toCanonicalStatus(existing.status);
      const isDuplicateSubmit = (body.action === 'submit' && canonical === 'submitted') || (body.action === 'resubmit' && canonical === 'resubmitted');
      if (isDuplicateSubmit) return NextResponse.json({ ok: true, idempotent: true, ticket: existing });
      if (canonical !== 'draft' && canonical !== 'changes_requested') {
        return NextResponse.json({ error: 'Phiếu đã nộp hoặc đã duyệt bị khóa, không thể chỉnh sửa.', code: 'FORBIDDEN_TICKET_LOCKED' }, { status: 403 });
      }
    }

    const isSubmitting = body.action === 'submit' || body.status === 'Đã nộp' || body.status === 'submitted';
    const isResubmitting = body.action === 'resubmit' || body.status === 'Đã nộp lại' || body.status === 'resubmitted';
    const changeSummary = typeof body.changeSummary === 'string' ? body.changeSummary.trim() : undefined;

    if (isResubmitting && (!existing || toCanonicalStatus(existing.status) !== 'changes_requested')) {
      return NextResponse.json({ error: 'Chỉ phiếu có Yêu cầu bổ sung mới được nộp lại.', code: 'INVALID_STATUS_FOR_RESUBMIT' }, { status: 400 });
    }
    if (isResubmitting && !changeSummary) {
      return NextResponse.json({ error: 'Vui lòng nhập Giải trình nội dung đã cập nhật trước khi nộp lại.', code: 'MISSING_CHANGE_SUMMARY' }, { status: 400 });
    }
    if ((isSubmitting || isResubmitting) && (!body.sanPham?.trim() || !body.chatLuong?.trim() || !body.canCu?.trim() || !Number(body.soSpNam) || !body.nguonSoLieu?.trim() || !Number(body.phutThucTe))) {
      return NextResponse.json({ error: 'Vui lòng điền đủ các trường bắt buộc (trừ các mục "nếu có") để nộp phiếu.', code: 'MISSING_REQUIRED_FIELDS' }, { status: 400 });
    }

    const lockKey = existing?.id || `new-${caller.email}-${body.maNhiemVu}-${body.tenCongViec}`;
    return await withSurveySubmissionLock(lockKey, async () => {
      const latestExisting = body.id ? getTicketById(String(body.id)) : null;
      if (latestExisting) {
        const curCanon = toCanonicalStatus(latestExisting.status);
        if ((isSubmitting && curCanon === 'submitted') || (isResubmitting && curCanon === 'resubmitted')) {
          return NextResponse.json({ ok: true, idempotent: true, ticket: latestExisting });
        }
      }

      const nowIso = new Date().toISOString();
      const resolvedStatus: TicketStatus = isResubmitting ? 'Đã nộp lại' : isSubmitting ? 'Đã nộp' : (latestExisting?.status === 'Yêu cầu bổ sung' ? 'Yêu cầu bổ sung' : 'Nháp');
      let createdVersionNo: number | null = null;
      let savedTicketId: string | null = null;

      try {
        const result = await upsertTicketAndSyncUnit({
          id: body.id,
          unitCode: effectiveUnit,
          ownerEmail: caller.email,
          ownerName: body.ownerName || caller.email.split('@')[0],
          ownerTitle: body.ownerTitle || (caller.isUnitLeader ? 'Lãnh đạo đơn vị' : 'Cán bộ – Giảng viên'),
          status: resolvedStatus,
          maNhiemVu: String(body.maNhiemVu),
          maCongViec: String(body.maCongViec || ''),
          tenCongViec: String(body.tenCongViec),
          maVtvl: String(body.maVtvl),
          maVtvlPhoiHop: body.maVtvlPhoiHop ? String(body.maVtvlPhoiHop) : '',
          sanPham: String(body.sanPham || ''),
          chatLuong: String(body.chatLuong || ''),
          canCu: String(body.canCu || ''),
          soSpNam: Number(body.soSpNam) || 0,
          nguonSoLieu: String(body.nguonSoLieu || ''),
          phutThucTe: Number(body.phutThucTe) || 0,
          gioBoSung: Number(body.gioBoSung) || 0,
          coordinatedTasks: Array.isArray(body.coordinatedTasks) ? body.coordinatedTasks : [],
          submittedAt: isSubmitting ? (latestExisting?.submittedAt || nowIso) : latestExisting?.submittedAt,
          resubmittedAt: isResubmitting ? nowIso : latestExisting?.resubmittedAt,
          lastChangeSummary: changeSummary || latestExisting?.lastChangeSummary
        });
        savedTicketId = result.ticket.id;

        if (isSubmitting || isResubmitting) {
          const ver = await createImmutableSurveyVersion({
            surveyId: result.ticket.id,
            ticket: result.ticket,
            submittedBy: caller.email,
            submittedAt: nowIso,
            changeSummary,
            simulateFailure: Boolean(body._simulateVersionFailure)
          });
          createdVersionNo = ver.versionNo;

          await appendTicketStatusHistory(result.ticket, {
            surveyId: result.ticket.id,
            fromStatus: latestExisting ? toCanonicalStatus(latestExisting.status) : 'draft',
            toStatus: isResubmitting ? 'resubmitted' : 'submitted',
            action: isResubmitting ? 'RESUBMIT' : 'SUBMIT',
            reason: changeSummary,
            actorId: caller.email,
            actorRole: caller.role,
            unitId: effectiveUnit
          });

          const audit = appendAuditLog({
            unitCode: effectiveUnit,
            unitName: findHcmuteUnit(effectiveUnit).nameVi,
            action: isResubmitting ? 'NỘP_LẠI_PHIẾU' : 'NỘP_PHIẾU',
            targetId: result.ticket.id,
            targetEntity: 'staff_work_tickets',
            details: `${isResubmitting ? 'Nộp lại' : 'Nộp'} phiếu ${result.ticket.maCongViec} (v${ver.versionNo})`,
            actorEmail: caller.email,
            actorRole: caller.role,
            oldValues: latestExisting ? { status: toCanonicalStatus(latestExisting.status), versionNo: latestExisting.currentVersionNo || 0 } : null,
            newValues: { status: isResubmitting ? 'resubmitted' : 'submitted', versionNo: ver.versionNo, changeSummary }
          });
          await persistAuditLogToSupabase(audit);
        }

        const finalTicket = getTicketById(result.ticket.id) || result.ticket;
        return NextResponse.json({ ok: true, ticket: finalTicket, unitWorkbookRevision: result.unitWorkbookRevision });
      } catch (txErr) {
        if (savedTicketId) {
          if (createdVersionNo !== null) compensateRemoveSurveyVersion(savedTicketId, createdVersionNo);
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

  const target = getTicketById(id);
  if (!target) {
    return NextResponse.json({ error: 'Không tìm thấy phiếu hoặc bạn không có quyền xóa.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
  }
  if (normalizeEmail(target.ownerEmail) !== normalizeEmail(caller.email) && !caller.isAdmin) {
    return NextResponse.json({ error: 'Bạn không có quyền xóa phiếu của người khác.', code: 'FORBIDDEN_IDOR' }, { status: 403 });
  }
  if (toCanonicalStatus(target.status) !== 'draft' && !caller.isAdmin) {
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

  await syncServerWorkbooksFromSupabase();
  const wb = getOrCreateWorkbook(requestedUnit, '01/10/2025–30/9/2026', caller.email, caller.role);
  const unitTickets = getTicketsByUnit(requestedUnit, true);
  const nextTaskCode = allocateNextTaskCode(requestedUnit, maNhiemVu, wb.data.A2 || [], unitTickets, body.excludeTicketId);
  return NextResponse.json({ nextTaskCode, maCongViec: nextTaskCode });
}

export async function PATCH(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isSuspended) return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    return await executePatchTicketAction(caller, body);
  } catch (err: unknown) {
    return handleRouteError(err, 'Lỗi máy chủ khi thao tác phiếu.');
  }
}
