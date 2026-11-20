import { StaffWorkTicket, TicketStatus, toCanonicalStatus } from '@/types/staff-ticket';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { recalculateGridFormulas } from '@/components/excel-grid/excel-grid-formulas';
import { ExcelSheetKey, GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import {
  getOrCreateWorkbook, getWorkbookById, hasWorkbookInMemory, saveServerWorkbookAndPersist, normalizeEmail,
  syncServerWorkbooksFromSupabase, withUnitWorkbookLock, ServerWorkbook
} from './server-workbook-store';
import { persistTicketToSupabase, batchMarkTicketsMergedInDb } from './server-ticket-db';
import { recordIdempotentMergeLinks, batchRecordMergeLinksInDb } from './server-ticket-version-store';
import {
  loadTickets, persistTickets, enrichTicket,
  syncTicketsFromSupabase, syncUnitTicketsAuthoritative, bumpTicketMutationWatermark
} from './server-ticket-store';
import {
  applyTicketsToSheetArrays,
  buildMergedTicketArtifacts,
  buildUnmergedApprovedProjection,
  collectPendingApprovedTicketsForData,
  hasUnmergedApprovedTickets,
  syncPendingApprovedTicketsDelta,
  syncUnitWorkbookIfRevisionChanged,
  tryFastVerifyNoPendingReconcile
} from './server-ticket-merge-helpers';

export function projectUnmergedApprovedTicketsReadOnly(workbook: ServerWorkbook): ServerWorkbook {
  return buildUnmergedApprovedProjection(workbook, loadTickets().values());
}

export function hasUnmergedApprovedTicketsForWorkbook(
  workbook: ServerWorkbook,
  unitTickets?: Iterable<StaffWorkTicket>
): boolean {
  return hasUnmergedApprovedTickets(workbook, unitTickets || loadTickets().values());
}

export async function mergeApprovedTicketToUnitWorkbook(
  ticketId: string,
  actorEmail: string,
  simulateFailure = false
): Promise<{ ticket: StaffWorkTicket; unitWorkbookRevision: number }> {
  let initialTicket = loadTickets().get(ticketId);
  if (!initialTicket) {
    await syncTicketsFromSupabase(undefined, true);
    initialTicket = loadTickets().get(ticketId);
  }
  if (!initialTicket) {
    throw Object.assign(new Error('Không tìm thấy phiếu cần gộp.'), { code: 'TICKET_NOT_FOUND', status: 404 });
  }
  const unit = findHcmuteUnit(initialTicket.unitCode);

  return withUnitWorkbookLock(unit.code, async () => {
    await syncServerWorkbooksFromSupabase(true, unit.code);
    const unitTickets = await syncUnitTicketsAuthoritative(unit.code);
    const store = loadTickets();
    const existing = unitTickets.find((t) => t.id === ticketId) || store.get(ticketId);
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
    bumpTicketMutationWatermark(unit.code);
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

async function finalizeMergedTicketItems(params: {
  unitCode: string;
  actorEmail?: string;
  updatedData: Record<ExcelSheetKey, GenericGridRow[]>;
  items: Array<{ ticket: StaffWorkTicket; a2RowId: string; b1RowId: string; sourceVersion: number }>;
  store: Map<string, StaffWorkTicket>;
}): Promise<string[]> {
  const { updatedTickets, allMergeLinks, mergedTicketIds } = buildMergedTicketArtifacts(params);
  for (const t of updatedTickets) params.store.set(t.id, t);
  bumpTicketMutationWatermark(params.unitCode);
  await batchMarkTicketsMergedInDb(updatedTickets);
  await batchRecordMergeLinksInDb(allMergeLinks);
  bumpTicketMutationWatermark(params.unitCode);
  persistTickets();
  return mergedTicketIds;
}

/**
 * Lõi gộp hàng loạt khi caller đã giữ sẵn `withUnitWorkbookLock(unitCode)`.
 */
export async function batchReconcileUnitTicketsUnlocked(unitCode: string, actorEmail?: string): Promise<BatchReconcileResult> {
  const startedAt = Date.now();
  const uc = (unitCode || '').trim().toUpperCase();
  if (!uc) return { unitCode: uc, mergedCount: 0, formulaRuns: 0, workbookWrites: 0, unitWorkbookRevision: 0, mergedTicketIds: [], durationMs: 0 };

  const unit = findHcmuteUnit(uc);
  if (hasWorkbookInMemory(unit.code)) {
    const memWb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', actorEmail || 'tcns@hcmute.edu.vn');
    if (await tryFastVerifyNoPendingReconcile(unit.code, memWb)) {
      return { unitCode: unit.code, mergedCount: 0, formulaRuns: 0, workbookWrites: 0, unitWorkbookRevision: memWb.currentRevision, mergedTicketIds: [], durationMs: Date.now() - startedAt };
    }
  }

  await syncUnitWorkbookIfRevisionChanged(unit.code);
  const store = loadTickets();
  const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', actorEmail || 'tcns@hcmute.edu.vn');
  const delta = await syncPendingApprovedTicketsDelta(unit.code, wb.data, store);
  const pendingTickets =
    delta && delta.orphanIds.length === 0
      ? delta.pendingTickets
      : collectPendingApprovedTicketsForData(unit.code, wb.data, await syncUnitTicketsAuthoritative(unit.code));
  if (pendingTickets.length === 0) {
    return { unitCode: unit.code, mergedCount: 0, formulaRuns: 0, workbookWrites: 0, unitWorkbookRevision: wb.currentRevision, mergedTicketIds: [], durationMs: Date.now() - startedAt };
  }

  const { nextData, items } = applyTicketsToSheetArrays(wb.data, pendingTickets);
  const updatedData = recalculateGridFormulas(nextData, unit.code, unit.nameVi);
  const saved = await saveServerWorkbookAndPersist({
    workbookId: wb.id, baseRevision: wb.currentRevision, data: updatedData,
    actorEmail: actorEmail || 'tcns@hcmute.edu.vn',
    changeSummary: `[Gộp hàng loạt] Đối soát ${items.length} phiếu đã duyệt vào A2 & B1`, unitCode: unit.code
  });
  if (saved.conflict) {
    throw Object.assign(new Error('Xung đột phiên bản bảng tính khi gộp hàng loạt.'), { code: 'REVISION_CONFLICT', status: 409 });
  }

  const mergedTicketIds = await finalizeMergedTicketItems({ unitCode: unit.code, actorEmail, updatedData, items, store: loadTickets() });
  return {
    unitCode: unit.code, mergedCount: items.length, formulaRuns: 1, workbookWrites: 1,
    unitWorkbookRevision: saved.currentRevision || wb.currentRevision, mergedTicketIds, durationMs: Date.now() - startedAt
  };
}

export interface SaveWorkbookWithMergeParams {
  workbookId: string; unitCode: string; existingWb: ServerWorkbook | null;
  data: Record<ExcelSheetKey, GenericGridRow[]>; touchedCells: string[];
  baseRevision: number; changeSummary: string; actorEmail: string; actorTitle: string;
}

export async function saveWorkbookWithPendingApprovedTicketsUnlocked(params: SaveWorkbookWithMergeParams) {
  const unit = findHcmuteUnit(params.unitCode);
  const existingWb = params.existingWb || getWorkbookById(params.workbookId);
  if (existingWb && params.baseRevision > 0 && params.baseRevision !== existingWb.currentRevision) {
    return { success: false, conflict: true, currentRevision: existingWb.currentRevision, serverWorkbook: existingWb };
  }

  const store = loadTickets();
  const delta = await syncPendingApprovedTicketsDelta(unit.code, params.data, store);
  const pendingTickets =
    delta && delta.orphanIds.length === 0
      ? delta.pendingTickets
      : collectPendingApprovedTicketsForData(unit.code, params.data, await syncUnitTicketsAuthoritative(unit.code));
  let dataToSave = params.data;
  let mergedItems: Array<{ ticket: StaffWorkTicket; a2RowId: string; b1RowId: string; sourceVersion: number }> = [];
  if (pendingTickets.length > 0) {
    const applied = applyTicketsToSheetArrays(params.data, pendingTickets);
    dataToSave = recalculateGridFormulas(applied.nextData, unit.code, unit.nameVi);
    mergedItems = applied.items;
  }

  const saved = await saveServerWorkbookAndPersist({
    workbookId: params.workbookId, data: dataToSave, touchedCells: params.touchedCells,
    baseRevision: params.baseRevision, changeSummary: params.changeSummary,
    actorEmail: params.actorEmail, actorTitle: params.actorTitle, unitCode: unit.code
  });
  if (saved.conflict || !saved.success) return saved;
  if (mergedItems.length > 0) {
    await finalizeMergedTicketItems({ unitCode: unit.code, actorEmail: params.actorEmail, updatedData: dataToSave, items: mergedItems, store: loadTickets() });
  }
  return saved;
}

export async function saveWorkbookWithPendingApprovedTickets(params: SaveWorkbookWithMergeParams) {
  return withUnitWorkbookLock(findHcmuteUnit(params.unitCode).code, () => saveWorkbookWithPendingApprovedTicketsUnlocked(params));
}

/**
 * Batch Reconcile theo lô duy nhất cho 1 đơn vị:
 * - Lọc phiếu `status = approved` chưa gộp (`!isMergedToB1B2` hoặc thiếu dòng A2/B1).
 * - Gộp toàn bộ vào RAM -> chạy `recalculateGridFormulas` TỐI ĐA 1 LẦN -> ghi workbook TỐI ĐA 1 LẦN.
 */
export async function batchReconcileUnitTickets(unitCode: string, actorEmail?: string): Promise<BatchReconcileResult> {
  const uc = (unitCode || '').trim().toUpperCase();
  if (!uc) return { unitCode: uc, mergedCount: 0, formulaRuns: 0, workbookWrites: 0, unitWorkbookRevision: 0, mergedTicketIds: [], durationMs: 0 };

  const unit = findHcmuteUnit(uc);
  return withUnitWorkbookLock(unit.code, () => batchReconcileUnitTicketsUnlocked(unit.code, actorEmail));
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
