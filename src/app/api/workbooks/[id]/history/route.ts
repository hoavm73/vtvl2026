import { NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import {
  getOrCreateWorkbook,
  getWorkbookById,
  saveServerWorkbookAndPersist,
  ServerRevision,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';
import { appendAuditLog, getAuditLogs, persistAuditLogToSupabase } from '@/services/storage/server-audit-store';
import { getTicketsByUnit, syncTicketsFromSupabase } from '@/services/storage/server-ticket-store';
import { isDatabaseConfigured, prisma, toIsoString } from '@/services/storage/prisma';
import { extractUnitCodeFromWorkbookId } from '@/services/context/workbook-context';
import { cacheGetOrSet, buildScopedCacheKey, invalidateUnitMutationCache } from '@/services/storage/runtime-cache';
import {
  buildAggregatedWorkbookHistory,
  deriveReviewMetaFromWorkbook,
  REVIEW_STATUS_LABELS,
  summarizeErrorCountFromWorkbookData
} from '@/services/workbooks/workbook-history-service';
import { toCanonicalStatus } from '@/types/staff-ticket';
import { findHcmuteUnit, UNIT_GROUPS } from '@/configs/hcmute-units';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const ACTION_MAP: Record<string, { auditAction: string; wbStatus?: 'draft' | 'submitted' | 'reviewed' | 'approved'; requireAdmin: boolean; label: string }> = {
  submit_to_tcns: { auditAction: 'GUI_TCNS', wbStatus: 'submitted', requireAdmin: false, label: 'Gửi hồ sơ đề án cho Phòng TCNS' },
  tcns_start_review: { auditAction: 'BAT_DAU_THAM_DINH', wbStatus: 'reviewed', requireAdmin: true, label: 'Phòng TCNS bắt đầu thẩm định hồ sơ' },
  tcns_comment: { auditAction: 'NHAN_XET_THAM_DINH', requireAdmin: true, label: 'Phòng TCNS ghi nhận xét thẩm định' },
  tcns_request_changes: { auditAction: 'THAM_DINH_YEU_CAU_BO_SUNG', wbStatus: 'draft', requireAdmin: true, label: 'Phòng TCNS yêu cầu bổ sung hồ sơ' },
  tcns_approve: { auditAction: 'THAM_DINH_DAT', wbStatus: 'approved', requireAdmin: true, label: 'Phòng TCNS xác nhận hồ sơ đạt yêu cầu' },
  tcns_reopen: { auditAction: 'MO_LAI_HO_SO', wbStatus: 'draft', requireAdmin: true, label: 'Phòng TCNS mở lại hồ sơ để đơn vị chỉnh sửa' }
};

export async function GET(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const requestedUnit = extractUnitCodeFromWorkbookId(id);
    if (requestedUnit && !caller.isAdmin && requestedUnit !== caller.unitCode.toUpperCase()) {
      return NextResponse.json({ error: 'Không có quyền xem lịch sử hồ sơ đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    }

    const key = buildScopedCacheKey('wb-history', { unitCode: requestedUnit || caller.unitCode, workbookId: id, role: caller.role });
    const payload = await cacheGetOrSet(key, ['audit-history', 'review-submission', 'workbooks', 'tickets'], 3000, async () => {
      await syncServerWorkbooksFromSupabase(true).catch(() => {});
      let wb = getWorkbookById(id);
      if (!wb && requestedUnit) wb = getOrCreateWorkbook(requestedUnit, '01/10/2025–30/9/2026', caller.email);
      if (!wb) return null;
      await syncTicketsFromSupabase(wb.unitId).catch(() => {});

      const revMap = new Map<number, ServerRevision>();
      for (const r of wb.revisions || []) revMap.set(r.revision, r);
      if (process.env.VTVL_ISOLATED_LOCAL_STORE !== 'true' && isDatabaseConfigured()) {
        try {
          const rows = await prisma.workbook_revisions.findMany({ where: { workbook_id: wb.id }, orderBy: { revision: 'desc' }, take: 20 });
          for (const r of rows) {
            if (!revMap.has(r.revision)) {
              revMap.set(r.revision, {
                id: r.id, workbookId: r.workbook_id, revision: r.revision,
                data: r.data as unknown as ServerRevision['data'],
                actorEmail: r.actor_email, actorTitle: r.actor_title || undefined,
                changeSummary: r.change_summary || undefined, createdAt: toIsoString(r.created_at) || new Date().toISOString()
              });
            }
          }
        } catch { /* fallback to workbook revisions */ }
      }

      const revisions = Array.from(revMap.values()).sort((a, b) => b.revision - a.revision);
      const auditLogs = getAuditLogs({ unitCode: wb.unitId, limit: 150 });
      const unitTickets = getTicketsByUnit(wb.unitId, false);
      const reviewMeta = deriveReviewMetaFromWorkbook(wb, auditLogs);
      const unitDef = findHcmuteUnit(wb.unitId);
      const groupLabel = UNIT_GROUPS.find((g) => g.id === unitDef.group)?.label || unitDef.group;
      const coreSheets = ['A1', 'A2', 'B1', 'B2_CT', 'B2', 'C1', 'C2', 'C3', 'D1', 'D2'] as const;
      let populatedSheetsCount = 0;
      let totalRows = 0;
      for (const k of coreSheets) {
        const rows = (wb.data as Record<string, unknown[]>)?.[k];
        if (Array.isArray(rows) && rows.length > 0) { populatedSheetsCount++; totalRows += rows.length; }
      }
      const submittedCount = unitTickets.filter((t) => { const c = toCanonicalStatus(t.status); return c === 'submitted' || c === 'resubmitted'; }).length;
      const approvedCount = unitTickets.filter((t) => toCanonicalStatus(t.status) === 'approved').length;
      const mergedCount = unitTickets.filter((t) => Boolean(t.isMergedToB1B2)).length;
      const progressPercent = mergedCount > 0 && populatedSheetsCount >= 6 ? 100 : approvedCount > 0 ? 80 : submittedCount > 0 ? 60 : unitTickets.length > 0 ? 35 : populatedSheetsCount > 0 ? 20 : 0;
      return {
        success: true,
        workbookId: wb.id,
        unitCode: wb.unitId,
        unitNameVi: wb.unitNameVi,
        currentRevision: wb.currentRevision || 1,
        reviewMeta,
        unitSummary: {
          unitCode: wb.unitId, unitNameVi: wb.unitNameVi, group: unitDef.group, groupLabel,
          totalTickets: unitTickets.length, draftCount: unitTickets.filter((t) => toCanonicalStatus(t.status) === 'draft').length,
          submittedCount, resubmittedCount: 0, changesRequestedCount: unitTickets.filter((t) => toCanonicalStatus(t.status) === 'changes_requested').length,
          approvedCount, mergedCount, testTicketCount: 0, hasWorkbook: true, workbookRevision: wb.currentRevision || 1,
          populatedSheetsCount, totalCoreSheets: coreSheets.length, totalRows, accountCount: 0, leaderCount: 0, staffCount: 0,
          progressPercent, stageLabel: progressPercent === 100 ? 'Đã gộp B1/B2 & hoàn thiện biểu' : populatedSheetsCount > 0 ? 'Đang hoàn thiện biểu mẫu' : 'Chưa kê khai',
          lastUpdatedAt: wb.updatedAt || null, reviewStatus: reviewMeta.status, reviewStatusLabel: REVIEW_STATUS_LABELS[reviewMeta.status],
          submittedAt: reviewMeta.submittedAt, submittedBy: reviewMeta.submittedBy, submittedRevision: reviewMeta.submittedRevision,
          reviewerEmail: reviewMeta.reviewerEmail, reviewedAt: reviewMeta.reviewedAt, reviewNote: reviewMeta.reviewNote,
          errorCount: summarizeErrorCountFromWorkbookData(wb.data)
        },
        revisions,
        timeline: buildAggregatedWorkbookHistory(wb, revisions, auditLogs, unitTickets)
      };
    });

    if (!payload) return NextResponse.json({ error: 'Không tìm thấy hồ sơ.', code: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lỗi máy chủ' }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (caller.isStaff) return NextResponse.json({ error: 'Cán bộ không có quyền gửi hoặc thẩm định hồ sơ đơn vị.', code: 'FORBIDDEN_STAFF' }, { status: 403 });

  try {
    const { id } = await context.params;
    const body = await req.json();
    const { action, note, unitCode: bodyUnitCode, expectedRevision } = body as {
      action?: string; note?: string; unitCode?: string; expectedRevision?: number;
    };
    const cfg = action ? ACTION_MAP[action] : undefined;
    if (!cfg) return NextResponse.json({ error: 'Hành động không hợp lệ.', code: 'INVALID_ACTION' }, { status: 400 });
    if (cfg.requireAdmin && !caller.isAdmin) {
      return NextResponse.json({ error: 'Chỉ Phòng Tổ chức – Nhân sự (Admin) mới có quyền thẩm định hồ sơ.', code: 'FORBIDDEN_TCNS_ONLY' }, { status: 403 });
    }
    if ((action === 'tcns_request_changes' || action === 'tcns_comment') && (!note || !note.trim())) {
      return NextResponse.json({ error: 'Vui lòng nhập nhận xét / lý do yêu cầu bổ sung.', code: 'MISSING_REVIEW_NOTE' }, { status: 400 });
    }

    await syncServerWorkbooksFromSupabase(true).catch(() => {});
    const requestedUnit = extractUnitCodeFromWorkbookId(id);
    const wb = getWorkbookById(id) || (requestedUnit ? getOrCreateWorkbook(requestedUnit, '01/10/2025–30/9/2026', caller.email) : null);
    if (!wb) return NextResponse.json({ error: 'Không tìm thấy hồ sơ.', code: 'NOT_FOUND' }, { status: 404 });

    if (bodyUnitCode && bodyUnitCode.trim().toUpperCase() !== wb.unitId.toUpperCase()) {
      return NextResponse.json({ error: `Lệch mã đơn vị [${bodyUnitCode}] và hồ sơ [${wb.unitId}].`, code: 'UNIT_MISMATCH' }, { status: 400 });
    }
    if (!caller.isAdmin && wb.unitId.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json({ error: 'Không được thao tác hồ sơ của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    }
    if (typeof expectedRevision === 'number' && expectedRevision > 0 && expectedRevision !== wb.currentRevision) {
      return NextResponse.json({ error: `Phiên bản hồ sơ đã thay đổi (v${expectedRevision} ≠ v${wb.currentRevision}). Vui lòng tải lại.`, code: 'REVISION_STALE' }, { status: 409 });
    }

    const cleanNote = (note || '').trim();
    const nowText = new Date().toLocaleString('vi-VN');
    const prevMeta = deriveReviewMetaFromWorkbook(wb, getAuditLogs({ unitCode: wb.unitId, limit: 150 }));
    const actualAuditAction = action === 'submit_to_tcns' && prevMeta.status === 'can_bo_sung' ? 'GUI_LAI_TCNS' : cfg.auditAction;

    const nextS = [
      ...(wb.data.S || []),
      {
        id: `snk_rev_${Date.now()}`,
        thoiGian: nowText,
        nguoiThaoTac: caller.email,
        bieuThayDoi: '14. T_TienDo · Thẩm định',
        noiDungThayDoi: `${cfg.label}${cleanNote ? `: ${cleanNote}` : ''}`,
        canCuThayDoi: `Phiên bản hồ sơ v${wb.currentRevision}`
      }
    ];
    if (cfg.wbStatus) wb.status = cfg.wbStatus;

    const saved = await saveServerWorkbookAndPersist({
      workbookId: wb.id,
      baseRevision: wb.currentRevision,
      data: { ...wb.data, S: nextS },
      actorEmail: caller.email,
      actorTitle: caller.isAdmin ? 'Phòng TCNS' : 'Lãnh đạo đơn vị',
      changeSummary: `${cfg.label}${cleanNote ? ` — ${cleanNote}` : ''}`,
      unitCode: wb.unitId
    });
    if (!saved.success) {
      return NextResponse.json({ error: 'Xung đột phiên bản khi cập nhật trạng thái hồ sơ.', code: 'REVISION_CONFLICT' }, { status: 409 });
    }

    const audit = appendAuditLog({
      workbookId: wb.id, unitCode: wb.unitId, unitName: wb.unitNameVi,
      action: actualAuditAction,
      details: cleanNote ? `${cfg.label}: ${cleanNote}` : cfg.label,
      actorEmail: caller.email, actorRole: caller.role,
      targetEntity: 'workbook', targetId: wb.id,
      newValues: { status: cfg.wbStatus || wb.status, revision: wb.currentRevision, reviewNote: cleanNote }
    });
    await persistAuditLogToSupabase(audit);
    invalidateUnitMutationCache(wb.unitId);

    const freshLogs = getAuditLogs({ unitCode: wb.unitId, limit: 150 });
    return NextResponse.json({
      success: true,
      workbookId: wb.id,
      currentRevision: saved.currentRevision,
      reviewMeta: deriveReviewMetaFromWorkbook(saved.serverWorkbook || wb, freshLogs)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lỗi máy chủ' }, { status: 500 });
  }
}
