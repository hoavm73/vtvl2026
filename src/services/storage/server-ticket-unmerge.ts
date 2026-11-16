import { NextResponse } from 'next/server';
import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { recalculateGridFormulas } from '@/components/excel-grid/excel-grid-formulas';
import { CallerAuthContext } from './server-auth-guard';
import { appendAuditLog, persistAuditLogToSupabase } from './server-audit-store';
import {
  getOrCreateWorkbook,
  normalizeEmail,
  saveServerWorkbookAndPersist,
  syncServerWorkbooksFromSupabase,
  withUnitWorkbookLock
} from './server-workbook-store';
import {
  appendTicketStatusHistory,
  getTicketById,
  loadTickets,
  persistTickets,
  upsertTicketAndSyncUnit
} from './server-ticket-store';
import { clearLocalMergeLinks, getTicketVersions } from './server-ticket-version-store';
import { removeCoordinationDataForSurvey } from './server-coordination-store';
import { deleteTicketFromSupabase, isIsolatedLocalMode } from './server-ticket-db';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

/**
 * Gỡ dòng công việc & khối lượng của một phiếu cụ thể khỏi Biểu A2/B1 đơn vị,
 * đồng thời giữ nguyên dữ liệu của các cán bộ khác (kể cả khi trùng mã công việc).
 */
export async function unmergeTicketFromUnitWorkbook(
  ticketId: string,
  actorEmail: string,
  reasonLabel: string
): Promise<{ removedRows: number; unitWorkbookRevision?: number }> {
  const existing = loadTickets().get(ticketId);
  if (!existing) return { removedRows: 0 };

  const unit = findHcmuteUnit(existing.unitCode);
  const res = await withUnitWorkbookLock(unit.code, async () => {
    await syncServerWorkbooksFromSupabase(true);
    const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', actorEmail, existing.ownerTitle);
    const currentA2 = wb.data.A2 || [];
    const currentB1 = wb.data.B1 || [];
    const a2RowId = `a2-${existing.id}`;
    const b1RowId = `b1-${existing.id}`;

    const isOwnRow = (r: { id?: string; sourceTicketId?: unknown }, fallbackId: string) =>
      String(r.sourceTicketId || '').trim() === existing.id || r.id === fallbackId;

    const nextA2 = currentA2.filter((r) => !isOwnRow(r, a2RowId));
    const nextB1 = currentB1.filter((r) => !isOwnRow(r, b1RowId));
    const removedRows = (currentA2.length - nextA2.length) + (currentB1.length - nextB1.length);

    let nextRevision = wb.currentRevision;
    if (removedRows > 0) {
      const stillHasTask = nextA2.some((r) => String(r.maCongViec || '').trim() === existing.maCongViec);
      const nextB2Ct = stillHasTask
        ? (wb.data.B2_CT || [])
        : (wb.data.B2_CT || []).filter((c) => String(c.maCongViec || '').trim() !== existing.maCongViec);

      const recalculated = recalculateGridFormulas(
        { ...wb.data, A2: nextA2, B1: nextB1, B2_CT: nextB2Ct },
        unit.code,
        unit.nameVi
      );

      const saved = await saveServerWorkbookAndPersist({
        workbookId: wb.id,
        baseRevision: wb.currentRevision,
        data: recalculated,
        actorEmail,
        actorTitle: 'Lãnh đạo đơn vị / Quản trị viên',
        changeSummary: `[Gỡ gộp phiếu] ${existing.maCongViec}: ${reasonLabel}`,
        unitCode: unit.code
      });
      if (saved.conflict) {
        throw Object.assign(new Error('Xung đột phiên bản bảng tính khi gỡ gộp phiếu.'), { code: 'REVISION_CONFLICT', status: 409 });
      }
      nextRevision = saved.currentRevision || wb.currentRevision;
    }

    return { removedRows, unitWorkbookRevision: nextRevision };
  });

  clearLocalMergeLinks(ticketId);
  if (!isIsolatedLocalMode() && SUPABASE_URL && SERVICE_KEY) {
    await fetch(`${SUPABASE_URL}/rest/v1/work_survey_merge_links?survey_id=eq.${encodeURIComponent(ticketId)}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    }).catch(() => {});
  }

  return res;
}

/** Thực thi thu hồi phê duyệt (chuyển về Yêu cầu bổ sung) hoặc hủy/xóa phiếu kê khai sai */
export async function executeRevokeOrCancelTicket(
  caller: CallerAuthContext,
  latest: StaffWorkTicket,
  act: 'revoke_approval' | 'cancel_ticket',
  reasonText: string
) {
  const cleanReason = reasonText.trim();
  if (!cleanReason) {
    return NextResponse.json(
      { error: 'Vui lòng nhập lý do thu hồi phê duyệt hoặc hủy phiếu.', code: 'MISSING_REVISION_REASON' },
      { status: 400 }
    );
  }
  if (caller.isStaff) {
    return NextResponse.json(
      { error: 'Cán bộ không có quyền thu hồi phê duyệt hoặc hủy phiếu đã nộp/duyệt.', code: 'FORBIDDEN_STAFF_REVIEW' },
      { status: 403 }
    );
  }
  if (!caller.isAdmin && latest.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
    return NextResponse.json(
      { error: 'Lãnh đạo đơn vị chỉ thao tác trên phiếu thuộc đơn vị mình.', code: 'FORBIDDEN_CROSS_UNIT' },
      { status: 403 }
    );
  }
  if (!caller.isAdmin && normalizeEmail(latest.ownerEmail) === normalizeEmail(caller.email)) {
    return NextResponse.json(
      {
        error: 'Phiếu cá nhân của Lãnh đạo đơn vị cần Quản trị viên (TCNS) thực hiện thu hồi hoặc hủy sau khi nộp/duyệt.',
        code: 'FORBIDDEN_SELF_REVIEW'
      },
      { status: 403 }
    );
  }

  const nowIso = new Date().toISOString();
  const curCanon = toCanonicalStatus(latest.status);
  const unitName = findHcmuteUnit(latest.unitCode).nameVi;

  if (act === 'revoke_approval') {
    if (curCanon !== 'approved') {
      return NextResponse.json(
        { error: 'Chỉ phiếu ở trạng thái Đã duyệt mới có thể thu hồi phê duyệt.', code: 'INVALID_STATUS_FOR_REVOKE' },
        { status: 400 }
      );
    }

    const unmergeRes = await unmergeTicketFromUnitWorkbook(latest.id, caller.email, cleanReason);
    const result = await upsertTicketAndSyncUnit({
      ...latest,
      status: 'Yêu cầu bổ sung',
      revisionReason: cleanReason,
      revisionRequestedBy: caller.email,
      revisionRequestedAt: nowIso,
      revisionRequestedByName: undefined,
      approvedAt: undefined,
      approvedBy: undefined,
      approvedByName: undefined,
      isMergedToB1B2: false,
      mergedAt: undefined,
      mergedBy: undefined,
      mergedByName: undefined,
      a2RowId: undefined,
      b1RowId: undefined,
      b2RowId: undefined
    });

    await appendTicketStatusHistory(result.ticket, {
      surveyId: latest.id,
      fromStatus: 'approved',
      toStatus: 'changes_requested',
      action: 'REVOKE_APPROVAL',
      reason: cleanReason,
      actorId: caller.email,
      actorRole: caller.role,
      unitId: latest.unitCode
    });

    const audit = appendAuditLog({
      unitCode: latest.unitCode,
      unitName,
      action: 'THU_HỒI_DUYỆT_PHIẾU',
      targetId: latest.id,
      targetEntity: 'staff_work_tickets',
      details: `Thu hồi phê duyệt phiếu ${latest.maCongViec} (gỡ ${unmergeRes.removedRows} dòng B1/A2): ${cleanReason}`,
      actorEmail: caller.email,
      actorRole: caller.role,
      oldValues: { status: curCanon, isMergedToB1B2: Boolean(latest.isMergedToB1B2) },
      newValues: { status: 'changes_requested', isMergedToB1B2: false, revisionReason: cleanReason }
    });
    await persistAuditLogToSupabase(audit);

    return NextResponse.json({
      ok: true,
      revoked: true,
      removedMergedRows: unmergeRes.removedRows,
      ticket: getTicketById(latest.id) || result.ticket
    });
  }

  // Nhánh cancel_ticket: Gỡ gộp khỏi A2/B1 -> xóa hẳn nếu là Nháp chưa có lịch sử, hoặc lưu trữ hủy (isArchived=true) để bảo toàn bất biến lịch sử
  const unmergeRes = await unmergeTicketFromUnitWorkbook(latest.id, caller.email, cleanReason);
  removeCoordinationDataForSurvey(latest.id);

  const hasImmutableHistory = getTicketVersions(latest.id).length > 0 || (latest.statusHistory || []).length > 0;
  let archived = false;
  if (curCanon === 'draft' && !hasImmutableHistory) {
    await deleteTicketFromSupabase(latest.id);
    const store = loadTickets();
    store.delete(latest.id);
    persistTickets();
  } else {
    archived = true;
    const archivedTicket = await upsertTicketAndSyncUnit({
      ...latest,
      isArchived: true,
      revisionReason: `[Đã hủy phiếu] ${cleanReason}`,
      revisionRequestedBy: caller.email,
      revisionRequestedAt: nowIso,
      isMergedToB1B2: false,
      mergedAt: undefined,
      mergedBy: undefined,
      mergedByName: undefined,
      a2RowId: undefined,
      b1RowId: undefined,
      b2RowId: undefined
    });
    await appendTicketStatusHistory(archivedTicket.ticket, {
      surveyId: latest.id,
      fromStatus: curCanon,
      toStatus: curCanon,
      action: 'CANCEL_TICKET',
      reason: cleanReason,
      actorId: caller.email,
      actorRole: caller.role,
      unitId: latest.unitCode
    });
  }

  const audit = appendAuditLog({
    unitCode: latest.unitCode,
    unitName,
    action: 'HỦY_XÓA_PHIẾU',
    targetId: latest.id,
    targetEntity: 'staff_work_tickets',
    details: `Hủy / xóa phiếu ${latest.maCongViec} (gỡ ${unmergeRes.removedRows} dòng B1/A2): ${cleanReason}`,
    actorEmail: caller.email,
    actorRole: caller.role,
    oldValues: { status: curCanon, isMergedToB1B2: Boolean(latest.isMergedToB1B2), isArchived: Boolean(latest.isArchived) },
    newValues: { cancelled: true, archived, isMergedToB1B2: false, reason: cleanReason }
  });
  await persistAuditLogToSupabase(audit);

  return NextResponse.json({
    ok: true,
    cancelled: true,
    archived,
    removedMergedRows: unmergeRes.removedRows,
    ticketId: latest.id
  });
}
