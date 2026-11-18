import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { ExcelSheetKey, GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { formatCoordinatedVtvlCodesForA2 } from '@/services/tickets/vtvl-coordination-helpers';
import { getTicketVersions } from './server-ticket-version-store';
import { ServerWorkbook } from './server-workbook-store';

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
export function buildUnmergedApprovedProjection(
  workbook: ServerWorkbook,
  allUnitTickets: StaffWorkTicket[]
): ServerWorkbook {
  const uc = workbook.unitId.trim().toUpperCase();
  const a2Ids = new Set((workbook.data.A2 || []).map((r) => String(r.sourceTicketId || r.id || '').trim()));
  const b1Ids = new Set((workbook.data.B1 || []).map((r) => String(r.sourceTicketId || r.id || '').trim()));
  const missing = allUnitTickets.filter((t) => {
    if (t.unitCode.toUpperCase() !== uc || toCanonicalStatus(t.status) !== 'approved' || t.isTestData || t.isArchived) return false;
    return !(a2Ids.has(t.id) || a2Ids.has(`a2-${t.id}`)) || !(b1Ids.has(t.id) || b1Ids.has(`b1-${t.id}`));
  });
  if (missing.length === 0) return workbook;
  const { nextData } = applyTicketsToSheetArrays(workbook.data, missing);
  return { ...workbook, data: nextData };
}
