import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { batchReconcileUnitTickets } from '@/services/storage/server-ticket-merge';
import {
  claimNextQueuedBackgroundJob,
  completeBackgroundJob,
  enqueueBackgroundJob,
  failBackgroundJob,
  getBackgroundJobById
} from '@/services/storage/server-background-jobs';
import {
  extractIdempotencyKey,
  getRecordedIdempotencyResponse,
  saveIdempotencyResponse
} from '@/services/storage/server-mission-counter';
import { handleTicketRouteError, parseTicketJsonWithGuard } from '@/services/tickets/ticket-route-helpers';
import { enforceApiRateLimit } from '@/services/auth/api-rate-limiter';
import { withHeavyMutationBudget } from '@/services/storage/heavy-mutation-gate';
import { appendAuditLog, persistAuditLogToSupabase } from '@/services/storage/server-audit-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const jobId = (req.nextUrl.searchParams.get('jobId') || '').trim();
  if (!jobId) {
    return NextResponse.json({ error: 'Thiếu mã jobId cần tra cứu.', code: 'MISSING_JOB_ID' }, { status: 400 });
  }
  const job = await getBackgroundJobById(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Không tìm thấy tác vụ nền.', code: 'JOB_NOT_FOUND' }, { status: 404 });
  }
  if (!caller.isAdmin && job.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
    return NextResponse.json({ error: 'Không có quyền xem tác vụ của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  }
  return NextResponse.json({ ok: true, job }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }
  if (caller.isStaff) {
    return NextResponse.json(
      { error: 'Chỉ Lãnh đạo đơn vị hoặc Quản trị viên mới được phép gộp/đối soát hàng loạt.', code: 'FORBIDDEN_STAFF_RECONCILE' },
      { status: 403 }
    );
  }

  try {
    const parsed = await parseTicketJsonWithGuard(req);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const requestedUnit = String(body.unitCode || caller.unitCode || '').trim().toUpperCase();
    if (!requestedUnit) {
      return NextResponse.json({ error: 'Thiếu mã đơn vị cần đối soát.', code: 'MISSING_UNIT_CODE' }, { status: 400 });
    }
    if (!caller.isAdmin && requestedUnit !== caller.unitCode.toUpperCase()) {
      return NextResponse.json(
        { error: 'Lãnh đạo đơn vị chỉ được phép đối soát phiếu thuộc đơn vị mình.', code: 'FORBIDDEN_CROSS_UNIT' },
        { status: 403 }
      );
    }

    const idempotencyKey = extractIdempotencyKey(req, body);
    if (idempotencyKey) {
      const recorded = await getRecordedIdempotencyResponse(idempotencyKey, `reconcile_${requestedUnit}`);
      if (recorded) return NextResponse.json({ ...recorded, idempotent: true });
    }

    const rateErr = enforceApiRateLimit('unit_reconcile', requestedUnit);
    if (rateErr) return rateErr;

    if (body.async === true) {
      const queued = await enqueueBackgroundJob({
        jobType: 'batch_reconcile_unit',
        unitCode: requestedUnit,
        actorEmail: caller.email,
        payload: { unitCode: requestedUnit, actorEmail: caller.email }
      });

      const claimed = await claimNextQueuedBackgroundJob('batch_reconcile_unit');
      if (claimed) {
        try {
          const result = await withHeavyMutationBudget(
            { kind: 'unit_reconcile', op: 'reconcile_unit', unitCode: claimed.unitCode, actorEmail: claimed.actorEmail },
            () => batchReconcileUnitTickets(claimed.unitCode, claimed.actorEmail)
          );
          const completed = await completeBackgroundJob(claimed.id, result as unknown as Record<string, unknown>, 100);
          const unitInfo = findHcmuteUnit(claimed.unitCode);
          const audit = appendAuditLog({
            unitCode: claimed.unitCode,
            unitName: unitInfo.nameVi,
            action: 'GỘP_PHIẾU_HÀNG_LOẠT',
            details: `Gộp hàng loạt ${result.mergedCount} phiếu đã duyệt vào Biểu A2 & B1 (phiên bản hồ sơ v${result.unitWorkbookRevision})`,
            actorEmail: caller.email,
            actorRole: caller.role,
            targetEntity: 'workbooks'
          });
          await persistAuditLogToSupabase(audit).catch(() => {});
          return NextResponse.json({ ok: true, mode: 'background_job', job: completed || claimed, result }, { status: 202 });
        } catch (jobErr) {
          await failBackgroundJob(claimed.id, jobErr instanceof Error ? jobErr.message : String(jobErr));
          throw jobErr;
        }
      }
      return NextResponse.json({ ok: true, mode: 'background_job', job: queued }, { status: 202 });
    }

    const result = await withHeavyMutationBudget(
      { kind: 'unit_reconcile', op: 'reconcile_unit', unitCode: requestedUnit, actorEmail: caller.email },
      () => batchReconcileUnitTickets(requestedUnit, caller.email)
    );
    const unitInfo = findHcmuteUnit(requestedUnit);
    const audit = appendAuditLog({
      unitCode: requestedUnit,
      unitName: unitInfo.nameVi,
      action: 'GỘP_PHIẾU_HÀNG_LOẠT',
      details: `Gộp hàng loạt ${result.mergedCount} phiếu đã duyệt vào Biểu A2 & B1 (phiên bản hồ sơ v${result.unitWorkbookRevision})`,
      actorEmail: caller.email,
      actorRole: caller.role,
      targetEntity: 'workbooks'
    });
    await persistAuditLogToSupabase(audit).catch(() => {});
    const payload = { ok: true, mode: 'synchronous_batch', ...result };
    if (idempotencyKey) {
      await saveIdempotencyResponse({
        idempotencyKey,
        actionScope: `reconcile_${requestedUnit}`,
        actorEmail: caller.email,
        targetId: requestedUnit,
        response: payload
      });
    }
    return NextResponse.json(payload);
  } catch (err: unknown) {
    return handleTicketRouteError(err, 'Lỗi khi đối soát và gộp phiếu hàng loạt.');
  }
}
