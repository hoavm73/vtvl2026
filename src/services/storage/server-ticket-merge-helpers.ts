import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { ExcelSheetKey, GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { formatCoordinatedVtvlCodesForA2 } from '@/services/tickets/vtvl-coordination-helpers';
import { getTicketVersions } from './server-ticket-version-store';
import { getWorkbookForUnitReadOnly, hasWorkbookInMemory, normalizeEmail, ServerWorkbook, syncServerWorkbooksFromSupabase } from './server-workbook-store';
import { getDbTestHook, getPgPool, isDatabaseConfigured, pgQuery, prisma } from './prisma';
import { DbTicketRow, isIsolatedLocalMode, mapDbRowToTicket } from './server-ticket-db';

function filterRowsExcludingTicket(rows: GenericGridRow[], ticket: StaffWorkTicket, rowId: string): GenericGridRow[] {
  return rows.filter((r) => {
    const rowTicketId = String(r.sourceTicketId || '').trim();
    if (rowTicketId) return rowTicketId !== ticket.id && r.id !== rowId;
    return String(r.maCongViec || '').trim() !== ticket.maCongViec && r.id !== rowId;
  });
}

export function buildMergedA2B1Rows(ticket: StaffWorkTicket, sourceVersion: number) {
  const a2RowId = `a2-${ticket.id}`;
  const b1RowId = `b1-${ticket.id}`;
  const a2Row: GenericGridRow = {
    id: a2RowId, sourceTicketId: ticket.id, sourceVersion,
    maCongViec: ticket.maCongViec, maNhiemVu: ticket.maNhiemVu, maVtvl: ticket.maVtvl,
    maVtvlPhoiHop: formatCoordinatedVtvlCodesForA2(ticket),
    tenCongViec: ticket.tenCongViec, sanPham: ticket.sanPham, dvt: 'Sản phẩm / Hồ sơ',
    chatLuong: ticket.chatLuong, canCu: ticket.canCu, trangThaiPhieu: 'Đã duyệt',
    nguoiLapPhieu: ticket.ownerName || ticket.ownerEmail
  };
  const b1Row: GenericGridRow = {
    id: b1RowId, sourceTicketId: ticket.id, sourceVersion,
    maCongViec: ticket.maCongViec, maVtvl: ticket.maVtvl,
    soSpNam: Number(ticket.soSpNam) || 0, phutThucTe: Number(ticket.phutThucTe) || 0,
    gioBoSung: Number(ticket.gioBoSung) || 0, nguon: ticket.nguonSoLieu || '',
    ppThucTe: 'nhật ký công việc', trangThaiPhieu: 'Đã duyệt'
  };
  return { a2RowId, b1RowId, a2Row, b1Row };
}

export function applyTicketsToSheetArrays(
  baseData: Record<ExcelSheetKey, GenericGridRow[]>,
  tickets: StaffWorkTicket[]
): {
  nextData: Record<ExcelSheetKey, GenericGridRow[]>;
  items: Array<{ ticket: StaffWorkTicket; a2RowId: string; b1RowId: string; sourceVersion: number }>;
} {
  let nextA2 = [...(baseData.A2 || [])];
  let nextB1 = [...(baseData.B1 || [])];
  const items: Array<{ ticket: StaffWorkTicket; a2RowId: string; b1RowId: string; sourceVersion: number }> = [];

  for (const ticket of tickets) {
    const sourceVersion = Math.max(getTicketVersions(ticket.id).length, ticket.currentVersionNo || 1, 1);
    const { a2RowId, b1RowId, a2Row, b1Row } = buildMergedA2B1Rows(ticket, sourceVersion);
    nextA2 = filterRowsExcludingTicket(nextA2, ticket, a2RowId);
    nextB1 = filterRowsExcludingTicket(nextB1, ticket, b1RowId);
    nextA2.push(a2Row);
    nextB1.push(b1Row);
    items.push({ ticket, a2RowId, b1RowId, sourceVersion });
  }
  return { nextData: { ...baseData, A2: nextA2, B1: nextB1 }, items };
}

/**
 * Chiếu chỉ-đọc các phiếu Đã duyệt chưa gộp vào bản sao của Workbook trả về trong GET /api/workbooks/:id
 * mà tuyệt đối không ghi DB, không ghi file và không sửa trạng thái nguồn.
 */
function collectUnmergedApprovedTickets(
  workbook: ServerWorkbook,
  allUnitTickets: Iterable<StaffWorkTicket>,
  stopAtFirst = false
): StaffWorkTicket[] {
  const uc = workbook.unitId.trim().toUpperCase();
  const a2Ids = new Set((workbook.data.A2 || []).map((r) => String(r.sourceTicketId || r.id || '').trim()));
  const b1Ids = new Set((workbook.data.B1 || []).map((r) => String(r.sourceTicketId || r.id || '').trim()));
  const missing: StaffWorkTicket[] = [];
  for (const t of allUnitTickets) {
    if (t.unitCode.toUpperCase() !== uc || toCanonicalStatus(t.status) !== 'approved' || t.isTestData || t.isArchived) continue;
    if (!(a2Ids.has(t.id) || a2Ids.has(`a2-${t.id}`)) || !(b1Ids.has(t.id) || b1Ids.has(`b1-${t.id}`))) {
      missing.push(t);
      if (stopAtFirst) break;
    }
  }
  return missing;
}

export function hasUnmergedApprovedTickets(workbook: ServerWorkbook, allTickets: Iterable<StaffWorkTicket>): boolean {
  return collectUnmergedApprovedTickets(workbook, allTickets, true).length > 0;
}

export function collectPendingApprovedTicketsForData(
  unitCode: string,
  baseData: Record<ExcelSheetKey, GenericGridRow[]>,
  unitTickets: Iterable<StaffWorkTicket>
): StaffWorkTicket[] {
  const uc = unitCode.trim().toUpperCase();
  const a2Ids = new Set((baseData.A2 || []).map((r) => String(r.id || '').trim()));
  const a2Src = new Set((baseData.A2 || []).map((r) => String(r.sourceTicketId || '').trim()).filter(Boolean));
  const b1Ids = new Set((baseData.B1 || []).map((r) => String(r.id || '').trim()));
  const b1Src = new Set((baseData.B1 || []).map((r) => String(r.sourceTicketId || '').trim()).filter(Boolean));
  const pending: StaffWorkTicket[] = [];
  for (const t of unitTickets) {
    if (t.unitCode.toUpperCase() !== uc || toCanonicalStatus(t.status) !== 'approved' || t.isTestData || t.isArchived) continue;
    const hasA2 = a2Ids.has(`a2-${t.id}`) || a2Src.has(t.id);
    const hasB1 = b1Ids.has(`b1-${t.id}`) || b1Src.has(t.id);
    if (!t.isMergedToB1B2 || !hasA2 || !hasB1) pending.push(t);
  }
  return pending;
}

/**
 * Kiểm tra nhanh qua truy vấn chỉ mục nhẹ trên PostgreSQL xem bảng tính trong RAM của đơn vị
 * đã khớp `phien_ban`, đầy đủ phiếu `approved` và đủ liên kết A2/B1 trong `work_survey_merge_links` hay chưa.
 */
export async function tryFastVerifyNoPendingReconcile(unitCode: string, wb: ServerWorkbook): Promise<boolean> {
  if (isIsolatedLocalMode() || !isDatabaseConfigured() || getDbTestHook() || !getPgPool()) return false;
  const uc = unitCode.trim().toUpperCase();
  try {
    const res = await pgQuery<{
      phien_ban: string | null;
      rows: Array<{ id: string; m: boolean; l: number }> | null;
    }>(
      `WITH td AS (
         SELECT phien_ban FROM public.t_tien_do WHERE ma_don_vi = $1 LIMIT 1
       ),
       app AS (
         SELECT t.id, t.is_merged_to_b1_b2,
                count(DISTINCT m.target_sheet)::int AS ml_cnt
         FROM public.staff_work_tickets t
         LEFT JOIN public.work_survey_merge_links m
           ON m.survey_id = t.id AND m.target_sheet IN ('A2', 'B1')
         WHERE t.unit_code = $1 AND t.status = 'approved' AND t.is_archived = false AND t.is_test_data = false
         GROUP BY t.id, t.is_merged_to_b1_b2
       )
       SELECT
         (SELECT phien_ban FROM td) AS phien_ban,
         COALESCE((SELECT json_agg(json_build_object('id', id, 'm', is_merged_to_b1_b2, 'l', ml_cnt)) FROM app), '[]'::json) AS rows`,
      [uc]
    );
    const rec = res.rows[0];
    if (!rec?.phien_ban || rec.phien_ban !== `v${wb.currentRevision}`) return false;
    const rows = Array.isArray(rec.rows) ? rec.rows : [];
    const a2Ids = new Set((wb.data.A2 || []).map((r) => String(r.id || '').trim()));
    const a2Src = new Set((wb.data.A2 || []).map((r) => String(r.sourceTicketId || '').trim()).filter(Boolean));
    const b1Ids = new Set((wb.data.B1 || []).map((r) => String(r.id || '').trim()));
    const b1Src = new Set((wb.data.B1 || []).map((r) => String(r.sourceTicketId || '').trim()).filter(Boolean));
    const approvedIds = new Set<string>();
    for (const r of rows) {
      if (!r?.id || r.m !== true || Number(r.l) !== 2) return false;
      approvedIds.add(r.id);
      if (!(a2Ids.has(`a2-${r.id}`) || a2Src.has(r.id))) return false;
      if (!(b1Ids.has(`b1-${r.id}`) || b1Src.has(r.id))) return false;
    }
    for (const sid of a2Src) if (!approvedIds.has(sid)) return false;
    for (const sid of b1Src) if (!approvedIds.has(sid)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Chỉ tải lại workbook 1.5 MB từ PostgreSQL khi `phien_ban` hoặc `status` trên DB khác với RAM. */
export async function syncUnitWorkbookIfRevisionChanged(unitCode: string): Promise<void> {
  const uc = unitCode.trim().toUpperCase();
  if (!uc) return;
  if (isIsolatedLocalMode() || !isDatabaseConfigured() || getDbTestHook() || !getPgPool() || !hasWorkbookInMemory(uc)) {
    await syncServerWorkbooksFromSupabase(true, uc);
    return;
  }
  const memWb = getWorkbookForUnitReadOnly(uc);
  if (!memWb || memWb.isDeleted) {
    await syncServerWorkbooksFromSupabase(true, uc);
    return;
  }
  try {
    const res = await pgQuery<{ phien_ban: string | null; wb_status: string | null }>(
      `SELECT td.phien_ban, wb.status AS wb_status
       FROM public.t_tien_do td
       LEFT JOIN public.workbooks wb ON wb.id = $2
       WHERE td.ma_don_vi = $1 LIMIT 1`,
      [uc, memWb.id]
    );
    const rec = res.rows[0];
    if (rec?.phien_ban === `v${memWb.currentRevision}` && (!rec.wb_status || rec.wb_status === memWb.status)) return;
  } catch { /* fall back to full sync */ }
  await syncServerWorkbooksFromSupabase(true, uc);
}

/** Truy vấn nhẹ chỉ các phiếu `approved` còn thiếu trong `baseData` hoặc thiếu liên kết gộp A2/B1 để nạp delta thay vì kéo toàn bộ đơn vị. */
export async function syncPendingApprovedTicketsDelta(
  unitCode: string,
  baseData: Record<ExcelSheetKey, GenericGridRow[]>,
  store: Map<string, StaffWorkTicket>
): Promise<{ pendingTickets: StaffWorkTicket[]; orphanIds: string[] } | null> {
  if (isIsolatedLocalMode() || !isDatabaseConfigured() || getDbTestHook() || !getPgPool()) return null;
  const uc = unitCode.trim().toUpperCase();
  const res = await pgQuery<{ id: string; is_merged_to_b1_b2: boolean; ml_cnt: number }>(
    `SELECT t.id, t.is_merged_to_b1_b2, count(DISTINCT m.target_sheet)::int AS ml_cnt
     FROM public.staff_work_tickets t
     LEFT JOIN public.work_survey_merge_links m
       ON m.survey_id = t.id AND m.target_sheet IN ('A2', 'B1')
     WHERE t.unit_code = $1 AND t.status = 'approved' AND t.is_archived = false AND t.is_test_data = false
     GROUP BY t.id, t.is_merged_to_b1_b2`,
    [uc]
  );
  const a2Ids = new Set((baseData.A2 || []).map((r) => String(r.id || '').trim()));
  const a2Src = new Set((baseData.A2 || []).map((r) => String(r.sourceTicketId || '').trim()).filter(Boolean));
  const b1Ids = new Set((baseData.B1 || []).map((r) => String(r.id || '').trim()));
  const b1Src = new Set((baseData.B1 || []).map((r) => String(r.sourceTicketId || '').trim()).filter(Boolean));
  const dbApprovedIds = new Set<string>();
  const pendingIds: string[] = [];
  for (const r of res.rows) {
    if (!r?.id) continue;
    dbApprovedIds.add(r.id);
    const hasA2 = a2Ids.has(`a2-${r.id}`) || a2Src.has(r.id);
    const hasB1 = b1Ids.has(`b1-${r.id}`) || b1Src.has(r.id);
    if (!r.is_merged_to_b1_b2 || !hasA2 || !hasB1 || Number(r.ml_cnt) !== 2) pendingIds.push(r.id);
  }
  const orphanIds: string[] = [];
  for (const sid of a2Src) if (!dbApprovedIds.has(sid)) orphanIds.push(sid);
  for (const sid of b1Src) if (!dbApprovedIds.has(sid) && !orphanIds.includes(sid)) orphanIds.push(sid);
  if (pendingIds.length === 0) return { pendingTickets: [], orphanIds };

  const rows = await prisma.staff_work_tickets.findMany({ where: { id: { in: pendingIds } } });
  const pendingTickets: StaffWorkTicket[] = [];
  for (const r of rows) {
    const mapped = mapDbRowToTicket(r as unknown as DbTicketRow);
    const prev = store.get(mapped.id);
    const merged: StaffWorkTicket = { ...prev, ...mapped, statusHistory: prev?.statusHistory || mapped.statusHistory };
    store.set(merged.id, merged);
    pendingTickets.push(merged);
  }
  return { pendingTickets, orphanIds };
}

export function buildMergedTicketArtifacts(params: {
  actorEmail?: string;
  updatedData: Record<ExcelSheetKey, GenericGridRow[]>;
  items: Array<{ ticket: StaffWorkTicket; a2RowId: string; b1RowId: string; sourceVersion: number }>;
}) {
  const b2ByTaskCode = new Map<string, string>();
  for (const r of params.updatedData.B2 || []) {
    const code = String(r.maCongViec || '').trim();
    if (code) b2ByTaskCode.set(code, String(r.id || `b2-${code}`));
  }
  const nowIso = new Date().toISOString();
  const normActor = normalizeEmail(params.actorEmail || 'tcns@hcmute.edu.vn');
  const mergedTicketIds: string[] = [];
  const updatedTickets: StaffWorkTicket[] = [];
  const allMergeLinks: Array<{ surveyId: string; targetSheet: 'A2' | 'B1' | 'B2'; targetRecordId: string; sourceVersion: number; mergedBy: string }> = [];

  for (const item of params.items) {
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
    if (b2RowId) allMergeLinks.push({ surveyId: item.ticket.id, targetSheet: 'B2', targetRecordId: b2RowId, sourceVersion: item.sourceVersion, mergedBy: normActor });
    mergedTicketIds.push(updatedTicket.id);
  }
  return { updatedTickets, allMergeLinks, mergedTicketIds };
}

export function buildUnmergedApprovedProjection(
  workbook: ServerWorkbook,
  allUnitTickets: Iterable<StaffWorkTicket>
): ServerWorkbook {
  const missing = collectUnmergedApprovedTickets(workbook, allUnitTickets, false);
  if (missing.length === 0) return workbook;
  const { nextData } = applyTicketsToSheetArrays(workbook.data, missing);
  return { ...workbook, data: nextData };
}
