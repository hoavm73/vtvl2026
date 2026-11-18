import { StaffWorkTicket, TicketStatus, toCanonicalStatus } from '@/types/staff-ticket';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { recalculateGridFormulas } from '@/components/excel-grid/excel-grid-formulas';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import {
  getOrCreateWorkbook, saveServerWorkbookAndPersist, normalizeEmail,
  syncServerWorkbooksFromSupabase, withUnitWorkbookLock, ServerWorkbook
} from './server-workbook-store';
import { persistTicketToSupabase, batchMarkTicketsMergedInDb } from './server-ticket-db';
import { recordIdempotentMergeLinks, batchRecordMergeLinksInDb } from './server-ticket-version-store';
import { loadTickets, persistTickets, enrichTicket } from './server-ticket-store';
import { applyTicketsToSheetArrays, buildUnmergedApprovedProjection } from './server-ticket-merge-helpers';

export function projectUnmergedApprovedTicketsReadOnly(workbook: ServerWorkbook): ServerWorkbook {
  return buildUnmergedApprovedProjection(workbook, Array.from(loadTickets().values()));
}

export async function mergeApprovedTicketToUnitWorkbook(
  ticketId: string,
  actorEmail: string,
  simulateFailure = false
): Promise<{ ticket: StaffWorkTicket; unitWorkbookRevision: number }> {
  const initialTicket = loadTickets().get(ticketId);
  if (!initialTicket) {
    throw Object.assign(new Error('Không tìm thấy phiếu cần gộp.'), { code: 'TICKET_NOT_FOUND', status: 404 });
  }
  const unit = findHcmuteUnit(initialTicket.unitCode);

  return withUnitWorkbookLock(unit.code, async () => {
    await syncServerWorkbooksFromSupabase(false);
    const store = loadTickets();
    const existing = store.get(ticketId);
    if (!existing) throw Object.assign(new Error('Không tìm thấy phiếu cần gộp.'), { code: 'TICKET_NOT_FOUND', status: 404 });
    if (existing.isTestData || existing.isArchived) {
      throw Object.assign(new Error('Phiếu dữ liệu thử nghiệm hoặc đã lưu trữ không được gộp vào biểu tổng hợp chính thức.'), { code: 'FORBIDDEN_TEST_OR_ARCHIVED_MERGE', status: 400 });
    }
    if (toCanonicalStatus(existing.status) !== 'approved') {
      throw Object.assign(new Error('Chỉ phiếu Đã duyệt mới được phép gộp vào biểu đơn vị.'), { code: 'FORBIDDEN_UNAPPROVED_MERGE', status: 400 });
    }

    const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', actorEmail, existing.ownerTitle);
    const expectedBaseRevision = wb.currentRevision;
    const { nextData, items } = applyTicketsToSheetArrays(wb.data, [existing]);
    const { a2RowId, b1RowId, sourceVersion } = items[0];
    const updatedData = recalculateGridFormulas(nextData, unit.code, unit.nameVi);

    const matchedB2Row = (updatedData.B2 || []).find((r) => String(r.maCongViec || '').trim() === existing.maCongViec);
    const b2RowId = matchedB2Row ? String(matchedB2Row.id || `b2-${existing.maCongViec}`) : undefined;
    if (simulateFailure) {
      throw Object.assign(new Error('MERGE_WRITE_FAILED: Lỗi giả lập khi ghi liên kết gộp vào cơ sở dữ liệu.'), { code: 'MERGE_WRITE_FAILED', status: 500 });
    }

    const nowIso = new Date().toISOString();
    const normActor = normalizeEmail(actorEmail);
    const updatedTicket: StaffWorkTicket = {
      ...existing, isMergedToB1B2: true, mergedBy: normActor, mergedAt: nowIso,
      a2RowId, b1RowId, b2RowId, currentVersionNo: sourceVersion, updatedAt: nowIso
    };
    const mergeLinkTargets: Array<{ targetSheet: 'A2' | 'B1' | 'B2'; targetRecordId: string; sourceVersion: number; mergedBy: string }> = [
      { targetSheet: 'A2', targetRecordId: a2RowId, sourceVersion, mergedBy: normActor },
      { targetSheet: 'B1', targetRecordId: b1RowId, sourceVersion, mergedBy: normActor }
    ];
    if (b2RowId) mergeLinkTargets.push({ targetSheet: 'B2', targetRecordId: b2RowId, sourceVersion, mergedBy: normActor });

    await persistTicketToSupabase(updatedTicket);
    await recordIdempotentMergeLinks(existing.id, mergeLinkTargets);

    const saved = await saveServerWorkbookAndPersist({
      workbookId: wb.id, baseRevision: expectedBaseRevision, data: updatedData,
      actorEmail, actorTitle: existing.ownerTitle,
      changeSummary: `[Gộp phiếu v${sourceVersion}] ${existing.maCongViec}: ${existing.tenCongViec}`,
      unitCode: unit.code
    });
    if (saved.conflict) {
      await persistTicketToSupabase(existing).catch(() => {});
      throw Object.assign(new Error('Xung đột phiên bản bảng tính.'), { code: 'REVISION_CONFLICT', status: 409 });
    }

    store.set(updatedTicket.id, updatedTicket);
    persistTickets();
    return { ticket: enrichTicket(updatedTicket), unitWorkbookRevision: saved.currentRevision || wb.currentRevision };
  });
}

export interface BatchReconcileResult {
  unitCode: string;
  mergedCount: number;
  formulaRuns: number;
  workbookWrites: number;
  unitWorkbookRevision: number;
  mergedTicketIds: string[];
  durationMs: number;
}

/**
 * Batch Reconcile theo lô duy nhất cho 1 đơn vị:
 * - Lọc phiếu `status = approved` chưa gộp (`!isMergedToB1B2` hoặc thiếu dòng A2/B1).
 * - Gộp toàn bộ vào RAM -> chạy `recalculateGridFormulas` TỐI ĐA 1 LẦN -> ghi workbook TỐI ĐA 1 LẦN.
 */
export async function batchReconcileUnitTickets(unitCode: string, actorEmail?: string): Promise<BatchReconcileResult> {
  const startedAt = Date.now();
  const uc = (unitCode || '').trim().toUpperCase();
  if (!uc) return { unitCode: uc, mergedCount: 0, formulaRuns: 0, workbookWrites: 0, unitWorkbookRevision: 0, mergedTicketIds: [], durationMs: 0 };

  const unit = findHcmuteUnit(uc);
  return withUnitWorkbookLock(unit.code, async () => {
    const store = loadTickets();
    const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', actorEmail || 'tcns@hcmute.edu.vn');
    const a2Ids = new Set((wb.data.A2 || []).map((r) => String(r.id || '').trim()));
    const a2Src = new Set((wb.data.A2 || []).map((r) => String(r.sourceTicketId || '').trim()).filter(Boolean));
    const b1Ids = new Set((wb.data.B1 || []).map((r) => String(r.id || '').trim()));
    const b1Src = new Set((wb.data.B1 || []).map((r) => String(r.sourceTicketId || '').trim()).filter(Boolean));

    const pendingTickets = Array.from(store.values()).filter((t) => {
      if (t.unitCode.toUpperCase() !== unit.code || toCanonicalStatus(t.status) !== 'approved' || t.isTestData || t.isArchived) return false;
      const hasA2 = a2Ids.has(`a2-${t.id}`) || a2Src.has(t.id);
      const hasB1 = b1Ids.has(`b1-${t.id}`) || b1Src.has(t.id);
      return !t.isMergedToB1B2 || !hasA2 || !hasB1;
    });

    if (pendingTickets.length === 0) {
      return { unitCode: unit.code, mergedCount: 0, formulaRuns: 0, workbookWrites: 0, unitWorkbookRevision: wb.currentRevision, mergedTicketIds: [], durationMs: Date.now() - startedAt };
    }

    const { nextData, items } = applyTicketsToSheetArrays(wb.data, pendingTickets);
    const updatedData = recalculateGridFormulas(nextData, unit.code, unit.nameVi);
    const formulaRuns = 1;

    const b2ByTaskCode = new Map<string, string>();
    for (const r of updatedData.B2 || []) {
      const code = String(r.maCongViec || '').trim();
      if (code) b2ByTaskCode.set(code, String(r.id || `b2-${code}`));
    }

    const expectedBaseRevision = wb.currentRevision;
    const saved = await saveServerWorkbookAndPersist({
      workbookId: wb.id,
      baseRevision: expectedBaseRevision,
      data: updatedData,
      actorEmail: actorEmail || 'tcns@hcmute.edu.vn',
      changeSummary: `[Gộp hàng loạt] Đối soát ${items.length} phiếu đã duyệt vào A2 & B1`,
      unitCode: unit.code
    });
    if (saved.conflict) {
      throw Object.assign(new Error('Xung đột phiên bản bảng tính khi gộp hàng loạt.'), { code: 'REVISION_CONFLICT', status: 409 });
    }
    const workbookWrites = 1;

    const nowIso = new Date().toISOString();
    const normActor = normalizeEmail(actorEmail || 'tcns@hcmute.edu.vn');
    const mergedTicketIds: string[] = [];
    const updatedTickets: StaffWorkTicket[] = [];
    const allMergeLinks: Array<{ surveyId: string; targetSheet: 'A2' | 'B1' | 'B2'; targetRecordId: string; sourceVersion: number; mergedBy: string }> = [];

    for (const item of items) {
      const b2RowId = b2ByTaskCode.get(item.ticket.maCongViec);
      const updatedTicket: StaffWorkTicket = {
        ...item.ticket, isMergedToB1B2: true, mergedBy: normActor, mergedAt: item.ticket.mergedAt || nowIso,
        a2RowId: item.a2RowId, b1RowId: item.b1RowId, b2RowId,
        currentVersionNo: item.sourceVersion, updatedAt: nowIso
      };
      updatedTickets.push(updatedTicket);
      allMergeLinks.push(
        { surveyId: item.ticket.id, targetSheet: 'A2', targetRecordId: item.a2RowId, sourceVersion: item.sourceVersion, mergedBy: normActor },
        { surveyId: item.ticket.id, targetSheet: 'B1', targetRecordId: item.b1RowId, sourceVersion: item.sourceVersion, mergedBy: normActor }
      );
      if (b2RowId) {
        allMergeLinks.push({ surveyId: item.ticket.id, targetSheet: 'B2', targetRecordId: b2RowId, sourceVersion: item.sourceVersion, mergedBy: normActor });
      }
      store.set(updatedTicket.id, updatedTicket);
      mergedTicketIds.push(updatedTicket.id);
    }

    await batchMarkTicketsMergedInDb(updatedTickets);
    await batchRecordMergeLinksInDb(allMergeLinks);
    persistTickets();
    return {
      unitCode: unit.code,
      mergedCount: items.length,
      formulaRuns,
      workbookWrites,
      unitWorkbookRevision: saved.currentRevision || wb.currentRevision,
      mergedTicketIds,
      durationMs: Date.now() - startedAt
    };
  });
}

export async function reconcileApprovedUnitTicketsToWorkbook(unitCode: string, actorEmail?: string): Promise<number> {
  const res = await batchReconcileUnitTickets(unitCode, actorEmail);
  return res.mergedCount;
}

export async function syncTicketsFromWorkbook(wbData: Record<string, GenericGridRow[]>, unitCode: string): Promise<void> {
  const store = loadTickets();
  const a2Rows = wbData.A2 || [];
  const b1Map = new Map<string, GenericGridRow>();
  for (const b of wbData.B1 || []) {
    if (b.maCongViec) b1Map.set(String(b.maCongViec).trim(), b);
  }
  let modified = false;
  for (const a of a2Rows) {
    const taskCode = String(a.maCongViec || '').trim();
    const ticketId = a.id?.startsWith('a2-') ? a.id.slice(3) : undefined;
    if (!taskCode || !ticketId || store.has(ticketId)) continue;
    const author = String(a.nguoiLapPhieu || '').trim();
    if (!author.includes('@')) continue;
    const b1 = b1Map.get(taskCode);
    const newTicket: StaffWorkTicket = {
      id: ticketId, unitCode, ownerEmail: normalizeEmail(author), ownerName: author.split('@')[0], ownerTitle: 'Cán bộ – Giảng viên',
      status: (a.trangThaiPhieu === 'Đã nộp' ? 'Đã nộp' : 'Nháp') as TicketStatus,
      maNhiemVu: String(a.maNhiemVu || ''), maCongViec: taskCode, tenCongViec: String(a.tenCongViec || ''),
      maVtvl: String(a.maVtvl || ''), maVtvlPhoiHop: String(a.maVtvlPhoiHop || ''),
      sanPham: String(a.sanPham || ''), chatLuong: String(a.chatLuong || ''), canCu: String(a.canCu || ''),
      soSpNam: Number(b1?.soSpNam) || 0, nguonSoLieu: String(b1?.nguon || ''), phutThucTe: Number(b1?.phutThucTe) || 0, gioBoSung: Number(b1?.gioBoSung) || 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    await persistTicketToSupabase(newTicket);
    store.set(newTicket.id, newTicket);
    modified = true;
  }
  if (modified) persistTickets();
}

export {
  migrateTicketsForUnit,
  migrateTicketsForUnitDetailed,
  type MigrateUnitOptions,
  type UnitTicketMigrationStats
} from './server-unit-migration';

export function getTicketCounts(): { approved: number; pending: number; draft: number; total: number } {
  const store = loadTickets();
  let approved = 0, pending = 0, draft = 0, total = 0;
  for (const t of store.values()) {
    if (t.isTestData || t.isArchived) continue;
    total++;
    const s = toCanonicalStatus(t.status);
    if (s === 'approved') approved++;
    else if (s === 'submitted' || s === 'resubmitted' || s === 'changes_requested') pending++;
    else draft++;
  }
  return { approved, pending, draft, total };
}
