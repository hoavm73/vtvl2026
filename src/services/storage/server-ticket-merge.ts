import {
  StaffWorkTicket,
  TicketStatus,
  toCanonicalStatus
} from '@/types/staff-ticket';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { recalculateGridFormulas } from '@/components/excel-grid/excel-grid-formulas';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import {
  getOrCreateWorkbook,
  saveServerWorkbookAndPersist,
  normalizeEmail,
  syncServerWorkbooksFromSupabase,
  withUnitWorkbookLock
} from './server-workbook-store';
import { formatCoordinatedVtvlCodesForA2 } from '@/services/tickets/vtvl-coordination-helpers';
import { persistTicketToSupabase } from './server-ticket-db';
import { getTicketVersions, recordIdempotentMergeLinks } from './server-ticket-version-store';
import { loadTickets, persistTickets, enrichTicket } from './server-ticket-store';

/**
 * Gộp phiếu Đã duyệt vào biểu A2 (Danh mục công việc) và B1 (Thống kê sản phẩm & định mức).
 * - Không gọi A2 là B2; không tự sinh số liệu B2 giả khi phiếu không có dữ liệu tác động B2.
 * - Bảo vệ bằng khóa đơn vị (withUnitWorkbookLock) + kiểm soát phiên bản (baseRevision).
 * - Không ghi đè làm mất kê khai khi nhiều cán bộ cùng kê khai một mã công việc (phân biệt theo sourceTicketId).
 * - Không khôi phục snapshot cũ đè lên cập nhật hợp lệ của request khác.
 */
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
    await syncServerWorkbooksFromSupabase(true);
    const store = loadTickets();
    const existing = store.get(ticketId);
    if (!existing) {
      throw Object.assign(new Error('Không tìm thấy phiếu cần gộp.'), { code: 'TICKET_NOT_FOUND', status: 404 });
    }
    if (existing.isTestData || existing.isArchived) {
      throw Object.assign(
        new Error('Phiếu dữ liệu thử nghiệm hoặc đã lưu trữ không được gộp vào biểu tổng hợp chính thức.'),
        { code: 'FORBIDDEN_TEST_OR_ARCHIVED_MERGE', status: 400 }
      );
    }
    if (toCanonicalStatus(existing.status) !== 'approved') {
      throw Object.assign(
        new Error('Chỉ phiếu Đã duyệt mới được phép gộp vào biểu đơn vị.'),
        { code: 'FORBIDDEN_UNAPPROVED_MERGE', status: 400 }
      );
    }

    const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', actorEmail, existing.ownerTitle);
    const expectedBaseRevision = wb.currentRevision;
    const currentA2 = wb.data.A2 || [];
    const currentB1 = wb.data.B1 || [];
    const a2RowId = `a2-${existing.id}`;
    const b1RowId = `b1-${existing.id}`;
    const sourceVersion = Math.max(getTicketVersions(existing.id).length, existing.currentVersionNo || 1, 1);

    // Giữ nguyên dòng của các phiếu khác (kể cả khi trùng maCongViec); chỉ thay dòng của chính phiếu này hoặc dòng mẫu chưa gắn sourceTicketId
    const filteredA2 = currentA2.filter((r) => {
      const rowTicketId = String(r.sourceTicketId || '').trim();
      if (rowTicketId) return rowTicketId !== existing.id && r.id !== a2RowId;
      return String(r.maCongViec || '').trim() !== existing.maCongViec && r.id !== a2RowId;
    });
    const nextA2Row: GenericGridRow = {
      id: a2RowId,
      sourceTicketId: existing.id,
      sourceVersion,
      maCongViec: existing.maCongViec,
      maNhiemVu: existing.maNhiemVu,
      maVtvl: existing.maVtvl,
      maVtvlPhoiHop: formatCoordinatedVtvlCodesForA2(existing),
      tenCongViec: existing.tenCongViec,
      sanPham: existing.sanPham,
      dvt: 'Sản phẩm / Hồ sơ',
      chatLuong: existing.chatLuong,
      canCu: existing.canCu,
      trangThaiPhieu: 'Đã duyệt',
      nguoiLapPhieu: existing.ownerName || existing.ownerEmail
    };

    const filteredB1 = currentB1.filter((r) => {
      const rowTicketId = String(r.sourceTicketId || '').trim();
      if (rowTicketId) return rowTicketId !== existing.id && r.id !== b1RowId;
      return String(r.maCongViec || '').trim() !== existing.maCongViec && r.id !== b1RowId;
    });
    const nextB1Row: GenericGridRow = {
      id: b1RowId,
      sourceTicketId: existing.id,
      sourceVersion,
      maCongViec: existing.maCongViec,
      maVtvl: existing.maVtvl,
      soSpNam: Number(existing.soSpNam) || 0,
      phutThucTe: Number(existing.phutThucTe) || 0,
      gioBoSung: Number(existing.gioBoSung) || 0,
      nguon: existing.nguonSoLieu || '',
      ppThucTe: 'nhật ký công việc',
      trangThaiPhieu: 'Đã duyệt'
    };

    const updatedData = recalculateGridFormulas(
      { ...wb.data, A2: [...filteredA2, nextA2Row], B1: [...filteredB1, nextB1Row] },
      unit.code,
      unit.nameVi
    );

    // Chỉ liên kết B2 khi thực sự có dòng B2 được tổng hợp từ B2_CT cho mã công việc này (không tự sinh B2 giả)
    const matchedB2Row = (updatedData.B2 || []).find(
      (r) => String(r.maCongViec || '').trim() === existing.maCongViec
    );
    const b2RowId = matchedB2Row ? String(matchedB2Row.id || `b2-${existing.maCongViec}`) : undefined;

    if (simulateFailure) {
      throw Object.assign(
        new Error('MERGE_WRITE_FAILED: Lỗi giả lập khi ghi liên kết gộp vào cơ sở dữ liệu.'),
        { code: 'MERGE_WRITE_FAILED', status: 500 }
      );
    }

    const nowIso = new Date().toISOString();
    const updatedTicket: StaffWorkTicket = {
      ...existing,
      isMergedToB1B2: true,
      mergedBy: normalizeEmail(actorEmail),
      mergedAt: nowIso,
      a2RowId,
      b1RowId,
      b2RowId,
      currentVersionNo: sourceVersion,
      updatedAt: nowIso
    };

    const mergeLinkTargets: Array<{ targetSheet: 'A2' | 'B1' | 'B2'; targetRecordId: string; sourceVersion: number; mergedBy: string }> = [
      { targetSheet: 'A2', targetRecordId: a2RowId, sourceVersion, mergedBy: normalizeEmail(actorEmail) },
      { targetSheet: 'B1', targetRecordId: b1RowId, sourceVersion, mergedBy: normalizeEmail(actorEmail) }
    ];
    if (b2RowId) {
      mergeLinkTargets.push({ targetSheet: 'B2', targetRecordId: b2RowId, sourceVersion, mergedBy: normalizeEmail(actorEmail) });
    }

    // Ghi phiếu và liên kết gộp trước khi commit phiên bản mới của workbook để tránh phải ghi đè snapshot cũ lên workbook
    await persistTicketToSupabase(updatedTicket);
    await recordIdempotentMergeLinks(existing.id, mergeLinkTargets);

    const saved = await saveServerWorkbookAndPersist({
      workbookId: wb.id,
      baseRevision: expectedBaseRevision,
      data: updatedData,
      actorEmail,
      actorTitle: existing.ownerTitle,
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

export async function syncTicketsFromWorkbook(wbData: Record<string, GenericGridRow[]>, unitCode: string): Promise<void> {
  const store = loadTickets();
  const a2Rows = wbData.A2 || [];
  const b1Rows = wbData.B1 || [];
  const b1Map = new Map<string, GenericGridRow>();
  for (const b of b1Rows) {
    if (b.maCongViec) b1Map.set(String(b.maCongViec).trim(), b);
  }
  let modified = false;
  for (const a of a2Rows) {
    if (!a.maCongViec) continue;
    const taskCode = String(a.maCongViec).trim();
    const ticketId = a.id?.startsWith('a2-') ? a.id.slice(3) : undefined;
    if (ticketId && !store.has(ticketId)) {
      const author = String(a.nguoiLapPhieu || '').trim();
      const validEmail = author.includes('@') ? normalizeEmail(author) : '';
      if (!validEmail) continue;
      const b1 = b1Map.get(taskCode);
      const newTicket: StaffWorkTicket = {
        id: ticketId,
        unitCode,
        ownerEmail: validEmail,
        ownerName: author.split('@')[0],
        ownerTitle: 'Cán bộ – Giảng viên',
        status: (a.trangThaiPhieu === 'Đã nộp' ? 'Đã nộp' : 'Nháp') as TicketStatus,
        maNhiemVu: String(a.maNhiemVu || ''),
        maCongViec: taskCode,
        tenCongViec: String(a.tenCongViec || ''),
        maVtvl: String(a.maVtvl || ''),
        maVtvlPhoiHop: String(a.maVtvlPhoiHop || ''),
        sanPham: String(a.sanPham || ''),
        chatLuong: String(a.chatLuong || ''),
        canCu: String(a.canCu || ''),
        soSpNam: Number(b1?.soSpNam) || 0,
        nguonSoLieu: String(b1?.nguon || ''),
        phutThucTe: Number(b1?.phutThucTe) || 0,
        gioBoSung: Number(b1?.gioBoSung) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await persistTicketToSupabase(newTicket);
      store.set(newTicket.id, newTicket);
      modified = true;
    }
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

/** Tự động đối soát và đưa mọi phiếu Đã duyệt còn thiếu vào Biểu A2 & B1 của đơn vị. */
export async function reconcileApprovedUnitTicketsToWorkbook(unitCode: string, actorEmail?: string): Promise<number> {
  const uc = (unitCode || '').trim().toUpperCase();
  if (!uc) return 0;
  const approvedTickets = Array.from(loadTickets().values()).filter(
    (t) => t.unitCode.toUpperCase() === uc && toCanonicalStatus(t.status) === 'approved' && !t.isTestData && !t.isArchived
  );
  if (approvedTickets.length === 0) return 0;

  const wb = getOrCreateWorkbook(uc);
  const a2Rows = wb.data.A2 || [];
  const b1Rows = wb.data.B1 || [];
  const a2Ids = new Set(a2Rows.map((r) => String(r.id || '').trim()));
  const a2Src = new Set(a2Rows.map((r) => String(r.sourceTicketId || '').trim()).filter(Boolean));
  const b1Ids = new Set(b1Rows.map((r) => String(r.id || '').trim()));
  const b1Src = new Set(b1Rows.map((r) => String(r.sourceTicketId || '').trim()).filter(Boolean));

  let reconciled = 0;
  for (const t of approvedTickets) {
    const hasA2 = a2Ids.has(`a2-${t.id}`) || a2Src.has(t.id);
    const hasB1 = b1Ids.has(`b1-${t.id}`) || b1Src.has(t.id);
    if (!t.isMergedToB1B2 || !hasA2 || !hasB1) {
      try {
        await mergeApprovedTicketToUnitWorkbook(t.id, actorEmail || t.approvedBy || t.ownerEmail);
        reconciled++;
      } catch { /* bỏ qua nếu một phiếu xung đột để tránh chặn các phiếu khác */ }
    }
  }
  return reconciled;
}
