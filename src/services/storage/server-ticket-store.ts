import fs from 'fs';
import path from 'path';
import { StaffWorkTicket, TicketStatus } from '@/types/staff-ticket';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { recalculateGridFormulas } from '@/components/excel-grid/excel-grid-formulas';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import {
  getOrCreateWorkbook,
  saveServerWorkbook,
  normalizeEmail,
  syncServerWorkbooksFromSupabase
} from './server-workbook-store';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const TICKETS_FILE = path.join(DATA_DIR, 'staff_tickets.json');

let memoryTickets: Map<string, StaffWorkTicket> | null = null;

function loadTickets(): Map<string, StaffWorkTicket> {
  if (memoryTickets) return memoryTickets;
  const store = new Map<string, StaffWorkTicket>();
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item?.id) store.set(item.id, item as StaffWorkTicket);
        }
      }
    }
  } catch { /* ignore */ }
  memoryTickets = store;
  return store;
}

function persistTickets(): void {
  const store = loadTickets();
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(Array.from(store.values()), null, 2), 'utf8');
  } catch { /* ignore */ }
}

/** Sinh mã công việc tự nhảy chống trùng từ toàn bộ A2 (cả Nháp & Đã nộp) và bảng ticket */
export function allocateNextTaskCode(
  unitCode: string,
  missionCode: string,
  a2Rows: GenericGridRow[],
  existingTickets: StaffWorkTicket[],
  excludeTicketId?: string
): string {
  const cleanMission = missionCode.trim();
  if (!cleanMission) return '';
  const escaped = cleanMission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escaped}\\.CV(\\d+)$`, 'i');

  let maxNum = 0;
  for (const row of a2Rows) {
    const match = String(row.maCongViec || '').trim().match(pattern);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  for (const t of existingTickets) {
    if (t.id === excludeTicketId || t.unitCode !== unitCode) continue;
    const match = String(t.maCongViec || '').trim().match(pattern);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  return `${cleanMission}.CV${String(maxNum + 1).padStart(2, '0')}`;
}

export function getTicketsByOwner(email: string, unitCode?: string): StaffWorkTicket[] {
  const norm = normalizeEmail(email);
  const targetUnit = unitCode ? unitCode.trim().toUpperCase() : undefined;
  return Array.from(loadTickets().values())
    .filter((t) => normalizeEmail(t.ownerEmail) === norm && (!targetUnit || t.unitCode === targetUnit))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getTicketsByUnit(unitCode: string): StaffWorkTicket[] {
  return Array.from(loadTickets().values())
    .filter((t) => t.unitCode === unitCode)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function upsertTicketAndSyncUnit(
  input: Omit<StaffWorkTicket, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<{ ticket: StaffWorkTicket; unitWorkbookRevision: number }> {
  await syncServerWorkbooksFromSupabase();
  const store = loadTickets();
  const unit = findHcmuteUnit(input.unitCode);
  const existing = input.id ? store.get(input.id) : undefined;
  const nowIso = new Date().toISOString();

  const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', input.ownerEmail, input.ownerTitle);
  const currentA2 = wb.data.A2 || [];
  const currentB1 = wb.data.B1 || [];
  const allTickets = Array.from(store.values());

  // Cấp mã công việc chống trùng nếu tạo mới hoặc đổi mã nhiệm vụ
  let resolvedTaskCode = (input.maCongViec || '').trim();
  const missionChanged = existing && existing.maNhiemVu !== input.maNhiemVu;
  if (!resolvedTaskCode || missionChanged) {
    resolvedTaskCode = allocateNextTaskCode(unit.code, input.maNhiemVu, currentA2, allTickets, existing?.id);
  } else if (!existing) {
    const duplicateInA2 = currentA2.some((r) => String(r.maCongViec).trim() === resolvedTaskCode);
    const duplicateInTickets = allTickets.some((t) => t.unitCode === unit.code && t.maCongViec === resolvedTaskCode);
    if (duplicateInA2 || duplicateInTickets) {
      resolvedTaskCode = allocateNextTaskCode(unit.code, input.maNhiemVu, currentA2, allTickets);
    }
  }

  const status: TicketStatus = input.status === 'Đã nộp' ? 'Đã nộp' : 'Nháp';
  const ticketId = existing?.id || `tkt-${unit.code}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

  const ticket: StaffWorkTicket = {
    ...input,
    id: ticketId,
    unitCode: unit.code,
    ownerEmail: normalizeEmail(input.ownerEmail),
    status,
    maCongViec: resolvedTaskCode,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso
  };

  store.set(ticket.id, ticket);
  persistTickets();

  // Đồng bộ ngay vào Biểu A2 & Biểu B1 của đơn vị với trạng thái Nháp hoặc Đã nộp
  const oldCode = existing?.maCongViec || resolvedTaskCode;
  const filteredA2 = currentA2.filter((r) => String(r.maCongViec).trim() !== oldCode && r.id !== `a2-${ticket.id}`);
  const nextA2Row: GenericGridRow = {
    id: `a2-${ticket.id}`,
    maCongViec: ticket.maCongViec,
    maNhiemVu: ticket.maNhiemVu,
    maVtvl: ticket.maVtvl,
    maVtvlPhoiHop: ticket.maVtvlPhoiHop || '',
    tenCongViec: ticket.tenCongViec,
    sanPham: ticket.sanPham,
    dvt: 'Sản phẩm / Hồ sơ',
    chatLuong: ticket.chatLuong,
    canCu: ticket.canCu,
    trangThaiPhieu: ticket.status,
    nguoiLapPhieu: ticket.ownerName || ticket.ownerEmail
  };

  const filteredB1 = currentB1.filter((r) => String(r.maCongViec).trim() !== oldCode && r.id !== `b1-${ticket.id}`);
  const nextB1Row: GenericGridRow = {
    id: `b1-${ticket.id}`,
    maCongViec: ticket.maCongViec,
    maVtvl: ticket.maVtvl,
    soSpNam: Number(ticket.soSpNam) || 0,
    phutThucTe: Number(ticket.phutThucTe) || 0,
    gioBoSung: Number(ticket.gioBoSung) || 0,
    nguon: ticket.nguonSoLieu || '',
    ppThucTe: 'nhật ký công việc',
    trangThaiPhieu: ticket.status
  };

  const updatedData = recalculateGridFormulas(
    {
      ...wb.data,
      A2: [...filteredA2, nextA2Row],
      B1: [...filteredB1, nextB1Row]
    },
    unit.code,
    unit.nameVi
  );

  const saved = saveServerWorkbook({
    workbookId: wb.id,
    baseRevision: wb.currentRevision,
    data: updatedData,
    actorEmail: ticket.ownerEmail,
    actorTitle: ticket.ownerTitle,
    changeSummary: `[Phiếu cá nhân - ${ticket.status}] ${ticket.maCongViec}: ${ticket.tenCongViec}`,
    unitCode: unit.code
  });

  return { ticket, unitWorkbookRevision: saved.currentRevision || wb.currentRevision };
}

export async function deleteTicketAndSyncUnit(ticketId: string, actorEmail: string): Promise<boolean> {
  const store = loadTickets();
  const target = store.get(ticketId);
  if (!target) return false;
  if (normalizeEmail(target.ownerEmail) !== normalizeEmail(actorEmail)) return false;

  store.delete(ticketId);
  persistTickets();

  await syncServerWorkbooksFromSupabase();
  const unit = findHcmuteUnit(target.unitCode);
  const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', actorEmail, target.ownerTitle);
  const nextA2 = (wb.data.A2 || []).filter((r) => r.id !== `a2-${ticketId}` && r.maCongViec !== target.maCongViec);
  const nextB1 = (wb.data.B1 || []).filter((r) => r.id !== `b1-${ticketId}` && r.maCongViec !== target.maCongViec);

  const updatedData = recalculateGridFormulas({ ...wb.data, A2: nextA2, B1: nextB1 }, unit.code, unit.nameVi);
  saveServerWorkbook({
    workbookId: wb.id,
    baseRevision: wb.currentRevision,
    data: updatedData,
    actorEmail,
    actorTitle: target.ownerTitle,
    changeSummary: `[Xóa phiếu cá nhân] ${target.maCongViec}`,
    unitCode: unit.code
  });
  return true;
}
