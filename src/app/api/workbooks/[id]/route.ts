import { NextResponse } from 'next/server';
import {
  getWorkbookById,
  getWorkbookForUnitReadOnly,
  deleteServerWorkbook,
  syncServerWorkbooksFromSupabase,
  withUnitWorkbookLock
} from '@/services/storage/server-workbook-store';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { appendAuditLog, persistAuditLogToSupabase } from '@/services/storage/server-audit-store';
import { loadTickets, syncTicketsFromSupabase } from '@/services/storage/server-ticket-store';
import {
  projectUnmergedApprovedTicketsReadOnly,
  saveWorkbookWithPendingApprovedTickets,
  saveWorkbookWithPendingApprovedTicketsUnlocked
} from '@/services/storage/server-ticket-merge';
import {
  applyTicketsToSheetArrays,
  syncPendingApprovedTicketsDelta,
  syncUnitWorkbookIfRevisionChanged
} from '@/services/storage/server-ticket-merge-helpers';
import { MAX_WORKBOOK_PAYLOAD_BYTES, readBoundedJsonBody } from '@/services/auth/payload-limiter';
import { enforceApiRateLimit } from '@/services/auth/api-rate-limiter';
import { toHeavyBusyResponse, withHeavyMutationBudget } from '@/services/storage/heavy-mutation-gate';
import { cacheGetOrSet, invalidateUnitMutationCache } from '@/services/storage/runtime-cache';
import { validateAndNormalizeUnitC1Rows } from '@/services/storage/server-vtvl-catalog-store';
import { validateNewA1RowsForSave } from '@/services/a1/a1-validation';
import { buildUnitWorkbookLockedResponse, isWorkbookStatusLocked } from '@/services/workbooks/workbook-lock-guard';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để xem hồ sơ bảng tính.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  if (caller.isSuspended) {
    return NextResponse.json(
      { error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' },
      { status: 403 }
    );
  }
  const rateErr = enforceApiRateLimit('read', caller.email);
  if (rateErr) return rateErr;

  try {
    const { id } = await context.params;
    const unitMatch = id.match(/^wb_([A-Za-z0-9]+)/);
    await syncServerWorkbooksFromSupabase(false, unitMatch?.[1]);
    let workbook = getWorkbookById(id);

    if (!workbook && unitMatch) {
      workbook = getWorkbookForUnitReadOnly(unitMatch[1]);
    }

    if (!workbook) {
      return NextResponse.json({ error: 'Không tìm thấy hồ sơ.', code: 'WORKBOOK_NOT_FOUND' }, { status: 404 });
    }

    // Độc lập dữ liệu đa đơn vị: Cán bộ/Lãnh đạo chỉ xem hồ sơ thuộc đơn vị của mình
    if (!caller.isAdmin && workbook.unitId.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json(
        { error: 'Bạn không có quyền truy cập hồ sơ của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
        { status: 403 }
      );
    }

    const unitUpper = workbook.unitId.toUpperCase();
    const projectedWorkbook = await cacheGetOrSet(
      `wb:proj:|u:${unitUpper}|r:${workbook.currentRevision}`,
      ['workbooks', 'tickets'],
      10000,
      async () => {
        const delta = await syncPendingApprovedTicketsDelta(unitUpper, workbook.data, loadTickets()).catch(() => null);
        if (delta && delta.orphanIds.length === 0) {
          if (delta.pendingTickets.length === 0) return workbook;
          return { ...workbook, data: applyTicketsToSheetArrays(workbook.data, delta.pendingTickets).nextData };
        }
        await syncTicketsFromSupabase(workbook.unitId, false, false).catch(() => {});
        return projectUnmergedApprovedTicketsReadOnly(workbook);
      },
      { forceSingleFlight: true }
    );

    const isUnstartedEmpty =
      unitUpper !== 'TCNS' &&
      projectedWorkbook.status === 'draft' &&
      (projectedWorkbook.data?.A1?.length || 0) === 0 &&
      (projectedWorkbook.data?.C1?.length || 0) === 0 &&
      (projectedWorkbook.data?.A2?.length || 0) === 0;
    const responseWorkbook = isUnstartedEmpty ? { ...projectedWorkbook, status: 'not_started' as const } : projectedWorkbook;
    return NextResponse.json({ success: true, workbook: responseWorkbook }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg, code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để lưu bảng tính.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  if (caller.isSuspended) {
    return NextResponse.json(
      { error: 'Tài khoản đã bị tạm khóa, không có quyền lưu bảng biểu.', code: 'ACCOUNT_SUSPENDED' },
      { status: 403 }
    );
  }
  if (caller.isStaff) {
    return NextResponse.json(
      { error: 'Cán bộ – Giảng viên kê khai qua Phiếu công việc, không trực tiếp sửa bảng đơn vị.', code: 'FORBIDDEN_VIEWER_WRITE' },
      { status: 403 }
    );
  }

  try {
    const parsed = await readBoundedJsonBody<Record<string, unknown>>(req, MAX_WORKBOOK_PAYLOAD_BYTES);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: parsed.code }, { status: parsed.status });
    }
    const { id } = await context.params;
    const body = parsed.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const { data, touchedCells, baseRevision, commitMessage, participant } = body;

    if (!data) {
      return NextResponse.json({ error: 'Thiếu dữ liệu bảng biểu.', code: 'MISSING_DATA' }, { status: 400 });
    }

    const unitMatch = id.match(/^wb_([A-Za-z0-9]+)/);
    const prelimUnit = (unitMatch ? unitMatch[1] : caller.unitCode).toUpperCase();
    const rateErr = enforceApiRateLimit('workbook_write', prelimUnit);
    if (rateErr) return rateErr;

    return await withHeavyMutationBudget({ kind: 'workbook_save', op: 'save_workbook', unitCode: prelimUnit, actorEmail: caller.email }, async () => {
      return withUnitWorkbookLock(prelimUnit, async () => {
        await syncUnitWorkbookIfRevisionChanged(prelimUnit);
        const existingWb = getWorkbookById(id);

        const targetUnit = (existingWb?.unitId || prelimUnit).toUpperCase();

        if (!caller.isAdmin && targetUnit !== caller.unitCode.toUpperCase()) {
          return NextResponse.json(
            { error: 'Bạn không có quyền sửa đổi hồ sơ của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' },
            { status: 403 }
          );
        }

        const currentWbForLock = existingWb || getWorkbookForUnitReadOnly(targetUnit);
        if (isWorkbookStatusLocked(currentWbForLock?.status)) {
          return buildUnitWorkbookLockedResponse(targetUnit);
        }

        // Bảo mật danh mục VTVL Biểu C1
        if (existingWb?.data?.C1 && data.C1) {
          const existingC1 = existingWb.data.C1;
          const newC1 = data.C1;
          const isC1Changed =
            existingC1.length !== newC1.length ||
            existingC1.some((r: any, i: number) => r.id !== newC1[i]?.id || r.maVtvl !== newC1[i]?.maVtvl); // eslint-disable-line @typescript-eslint/no-explicit-any

          if (isC1Changed && !caller.isAdmin && !caller.isUnitLeader) {
            return NextResponse.json(
              { error: 'Chỉ Quản trị viên hệ thống hoặc Lãnh đạo đơn vị có quyền sửa đổi danh mục VTVL tại Biểu C1.', code: 'FORBIDDEN_C1_CHANGE' },
              { status: 403 }
            );
          }
        }

        let normalizedData = data;
        if (Array.isArray(data?.C1)) {
          const c1Check = validateAndNormalizeUnitC1Rows({
            unitCode: targetUnit,
            incomingC1: data.C1,
            existingC1: existingWb?.data?.C1
          });
          if (!c1Check.ok) {
            return NextResponse.json({ error: c1Check.error, code: c1Check.code }, { status: c1Check.status });
          }
          normalizedData = { ...data, C1: c1Check.normalizedC1 };
        }

        if (existingWb && (typeof baseRevision !== 'number' || baseRevision < existingWb.currentRevision)) {
          return NextResponse.json(
            {
              error: 'Phát hiện phiên bản dữ liệu trình duyệt cũ hơn máy chủ. Vui lòng tải lại dữ liệu mới nhất trước khi lưu.',
              code: 'STALE_CLIENT_REVISION',
              conflict: true,
              serverRevision: existingWb.currentRevision,
              currentServerWorkbook: existingWb
            },
            { status: 409 }
          );
        }

        if (Array.isArray(normalizedData?.A1)) {
          const a1Check = validateNewA1RowsForSave({
            incomingA1: normalizedData.A1,
            existingA1: existingWb?.data?.A1
          });
          if (!a1Check.ok) {
            return NextResponse.json(
              { error: a1Check.error, code: a1Check.code, rowErrors: a1Check.entries },
              { status: a1Check.status }
            );
          }
        }

        const saveParams = {
          workbookId: id,
          unitCode: targetUnit,
          existingWb,
          data: normalizedData,
          touchedCells: Array.isArray(touchedCells) ? touchedCells : [],
          baseRevision: typeof baseRevision === 'number' ? baseRevision : 1,
          changeSummary: commitMessage || 'Cập nhật từ phiên làm việc',
          actorEmail: caller.email,
          actorTitle: participant?.roleLabel || (caller.isUnitLeader ? 'Lãnh đạo đơn vị' : 'Quản trị viên')
        };
        const finalResult =
          targetUnit === prelimUnit
            ? await saveWorkbookWithPendingApprovedTicketsUnlocked(saveParams)
            : await saveWorkbookWithPendingApprovedTickets(saveParams);

        if (finalResult.conflict) {
          return NextResponse.json(
            {
              error: 'Xung đột phiên bản dữ liệu máy chủ.',
              code: 'REVISION_CONFLICT',
              conflict: true,
              serverRevision: finalResult.currentRevision,
              currentServerWorkbook: finalResult.serverWorkbook
            },
            { status: 409 }
          );
        }

        const audit = appendAuditLog({
          workbookId: id,
          unitCode: targetUnit,
          unitName: existingWb?.unitNameVi || targetUnit,
          action: 'SỬA_BIỂU',
          details: commitMessage || 'Cập nhật bảng tính 10 biểu',
          actorEmail: caller.email,
          actorRole: caller.role
        });
        await persistAuditLogToSupabase(audit);
        invalidateUnitMutationCache(targetUnit, existingWb?.id || id);

        return NextResponse.json({ success: true, workbook: finalResult });
      });
    });
  } catch (error) {
    const busy = toHeavyBusyResponse(error);
    if (busy) return busy;
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg, code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated || !caller.isAdmin) {
    return NextResponse.json(
      { error: 'Yêu cầu quyền Quản trị viên để xóa hồ sơ.', code: 'UNAUTHORIZED_ADMIN' },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;
    const ok = await deleteServerWorkbook(id);
    if (ok) invalidateUnitMutationCache();
    return NextResponse.json({ success: ok });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg, code: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
