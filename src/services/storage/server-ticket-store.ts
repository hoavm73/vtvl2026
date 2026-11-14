import fs from 'fs';
import path from 'path';
import { StaffWorkTicket, TicketStatus, toDisplayStatus } from '@/types/staff-ticket';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { recalculateGridFormulas } from '@/components/excel-grid/excel-grid-formulas';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import {
  getOrCreateWorkbook, saveServerWorkbook, normalizeEmail, syncServerWorkbooksFromSupabase
} from './server-workbook-store';
import { replaceUnitCodePrefix } from '@/services/units/unit-synchronizer';
import { fetchTicketsFromSupabase, persistTicketToSupabase, deleteTicketFromSupabase } from './server-ticket-db';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const TICKETS_FILE = path.join(DATA_DIR, 'staff_tickets.json');
let memoryTickets: Map<string, StaffWorkTicket> | null = null;

function loadTickets(): Map<string, StaffWorkTicket> {
  if (memoryTickets) return memoryTickets;
  const store = new Map<string, StaffWorkTicket>();
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
      if (Array.isArray(parsed)) parsed.forEach((item) => { if (item?.id) store.set(item.id, item as StaffWorkTicket); });
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

export async function syncTicketsFromSupabase(unitCode?: string): Promise<void> {
  const store = loadTickets(), remote = await fetchTicketsFromSupabase(unitCode);
  if (remote === null) return;
  if (unitCode) {
    const uc = unitCode.toUpperCase();
    for (const [id, t] of Array.from(store.entries())) {
      if (t.unitCode.toUpperCase() === uc) store.delete(id);
    }
  }
  for (const t of remote) store.set(t.id, t);
  persistTickets();
}

export function allocateNextTaskCode(
  unitCode: string, missionCode: string, a2Rows: GenericGridRow[], existingTickets: StaffWorkTicket[], excludeTicketId?: string
): string {
  const cleanMission = missionCode.trim();
  if (!cleanMission) return '';
  const pattern = new RegExp(`^${cleanMission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.CV(\\d+)$`, 'i');
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
  const norm = normalizeEmail(email), targetUnit = unitCode ? unitCode.trim().toUpperCase() : undefined, store = loadTickets();
  let modified = false;
  const tickets = Array.from(store.values()).filter((t) => normalizeEmail(t.ownerEmail) === norm);
  if (targetUnit) {
    for (const t of tickets) {
      if (t.unitCode.toUpperCase() !== targetUnit) {
        const oldC = t.unitCode.toUpperCase();
        t.unitCode = targetUnit;
        t.maNhiemVu = replaceUnitCodePrefix(t.maNhiemVu, oldC, targetUnit);
        t.maCongViec = replaceUnitCodePrefix(t.maCongViec, oldC, targetUnit);
        t.maVtvl = replaceUnitCodePrefix(t.maVtvl, oldC, targetUnit);
        if (t.maVtvlPhoiHop) t.maVtvlPhoiHop = replaceUnitCodePrefix(t.maVtvlPhoiHop, oldC, targetUnit);
        t.updatedAt = new Date().toISOString();
        modified = true;
      }
    }
    if (modified) persistTickets();
  }
  return tickets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getTicketsByUnit(unitCode: string): StaffWorkTicket[] {
  return Array.from(loadTickets().values()).filter((t) => t.unitCode === unitCode).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function upsertTicketAndSyncUnit(
  input: Omit<StaffWorkTicket, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<{ ticket: StaffWorkTicket; unitWorkbookRevision: number }> {
  await syncServerWorkbooksFromSupabase();
  const store = loadTickets(), unit = findHcmuteUnit(input.unitCode);
  const existing = input.id ? store.get(input.id) : undefined;
  const nowIso = new Date().toISOString();
  const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', input.ownerEmail, input.ownerTitle);
  const currentA2 = wb.data.A2 || [], currentB1 = wb.data.B1 || [], allTickets = Array.from(store.values());

  let resolvedTaskCode = (input.maCongViec || '').trim();
  const missionChanged = existing && existing.maNhiemVu !== input.maNhiemVu;
  if (!resolvedTaskCode || missionChanged) {
    resolvedTaskCode = allocateNextTaskCode(unit.code, input.maNhiemVu, currentA2, allTickets, existing?.id);
  } else if (!existing) {
    const dupA2 = currentA2.some((r) => String(r.maCongViec).trim() === resolvedTaskCode);
    const dupT = allTickets.some((t) => t.unitCode === unit.code && t.maCongViec === resolvedTaskCode);
    if (dupA2 || dupT) resolvedTaskCode = allocateNextTaskCode(unit.code, input.maNhiemVu, currentA2, allTickets);
  }

  const status: TicketStatus = toDisplayStatus(input.status);
  const ticketId = existing?.id || `tkt-${unit.code}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const ticket: StaffWorkTicket = {
    ...input, id: ticketId, unitCode: unit.code, unitId: unit.code, ownerEmail: normalizeEmail(input.ownerEmail),
    ownerId: normalizeEmail(input.ownerEmail), status, maCongViec: resolvedTaskCode,
    sourceTicketId: input.sourceTicketId || ticketId, createdAt: existing?.createdAt || nowIso, updatedAt: nowIso
  };

  await persistTicketToSupabase(ticket);
  store.set(ticket.id, ticket);
  persistTickets();

  if (ticket.status !== 'Đã duyệt') return { ticket, unitWorkbookRevision: wb.currentRevision };

  let savedRevision = wb.currentRevision;
  try {
    const oldCode = existing?.maCongViec || resolvedTaskCode;
    const filteredA2 = currentA2.filter((r) => String(r.sourceTicketId || r.maCongViec).trim() !== ticket.id && String(r.maCongViec).trim() !== oldCode && r.id !== `a2-${ticket.id}`);
    const nextA2Row: GenericGridRow = {
      id: `a2-${ticket.id}`, sourceTicketId: ticket.id, maCongViec: ticket.maCongViec, maNhiemVu: ticket.maNhiemVu, maVtvl: ticket.maVtvl,
      maVtvlPhoiHop: ticket.maVtvlPhoiHop || '', tenCongViec: ticket.tenCongViec, sanPham: ticket.sanPham,
      dvt: 'Sản phẩm / Hồ sơ', chatLuong: ticket.chatLuong, canCu: ticket.canCu,
      trangThaiPhieu: ticket.status, nguoiLapPhieu: ticket.ownerName || ticket.ownerEmail
    };

    const filteredB1 = currentB1.filter((r) => String(r.sourceTicketId || r.maCongViec).trim() !== ticket.id && String(r.maCongViec).trim() !== oldCode && r.id !== `b1-${ticket.id}`);
    const nextB1Row: GenericGridRow = {
      id: `b1-${ticket.id}`, sourceTicketId: ticket.id, maCongViec: ticket.maCongViec, maVtvl: ticket.maVtvl,
      soSpNam: Number(ticket.soSpNam) || 0, phutThucTe: Number(ticket.phutThucTe) || 0,
      gioBoSung: Number(ticket.gioBoSung) || 0, nguon: ticket.nguonSoLieu || '',
      ppThucTe: 'nhật ký công việc', trangThaiPhieu: ticket.status
    };

    const updatedData = recalculateGridFormulas({ ...wb.data, A2: [...filteredA2, nextA2Row], B1: [...filteredB1, nextB1Row] }, unit.code, unit.nameVi);
    const saved = saveServerWorkbook({
      workbookId: wb.id, baseRevision: wb.currentRevision, data: updatedData,
      actorEmail: ticket.ownerEmail, actorTitle: ticket.ownerTitle,
      changeSummary: `[Phiếu cá nhân - ${ticket.status}] ${ticket.maCongViec}: ${ticket.tenCongViec}`, unitCode: unit.code
    });
    if (saved.conflict) throw Object.assign(new Error('Xung đột phiên bản bảng tính.'), { code: 'REVISION_CONFLICT', status: 409 });
    savedRevision = saved.currentRevision || wb.currentRevision;

    ticket.isMergedToB1B2 = true;
    ticket.b1RowId = `b1-${ticket.id}`;
    ticket.b2RowId = `a2-${ticket.id}`;
    ticket.mergedAt = ticket.mergedAt || nowIso;
    store.set(ticket.id, ticket);
    await persistTicketToSupabase(ticket).catch(() => {});
  } catch (workflowErr: unknown) {
    const errObj = workflowErr as { code?: string; status?: number };
    if (errObj?.code === 'REVISION_CONFLICT' || errObj?.status === 409) {
      if (existing) { store.set(existing.id, existing); await persistTicketToSupabase(existing).catch(() => {}); }
      else { store.delete(ticket.id); await deleteTicketFromSupabase(ticket.id).catch(() => {}); }
      persistTickets();
      throw workflowErr;
    }
    throw Object.assign(new Error('Lỗi xử lý bảng tính máy chủ sau khi lưu phiếu.'), { code: 'PERSISTENCE_FAILED', status: 502 });
  }

  return { ticket, unitWorkbookRevision: savedRevision };
}

export async function deleteTicketAndSyncUnit(ticketId: string, actorEmail: string): Promise<boolean> {
  const store = loadTickets();
  const target = store.get(ticketId);
  if (!target || normalizeEmail(target.ownerEmail) !== normalizeEmail(actorEmail)) return false;

  await deleteTicketFromSupabase(ticketId);
  if (target.status === 'Đã duyệt') {
    try {
      await syncServerWorkbooksFromSupabase();
      const unit = findHcmuteUnit(target.unitCode);
      const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', actorEmail, target.ownerTitle);
      const nextA2 = (wb.data.A2 || []).filter((r) => r.id !== `a2-${ticketId}` && r.maCongViec !== target.maCongViec);
      const nextB1 = (wb.data.B1 || []).filter((r) => r.id !== `b1-${ticketId}` && r.maCongViec !== target.maCongViec);
      const updatedData = recalculateGridFormulas({ ...wb.data, A2: nextA2, B1: nextB1 }, unit.code, unit.nameVi);
      const saved = saveServerWorkbook({
        workbookId: wb.id, baseRevision: wb.currentRevision, data: updatedData,
        actorEmail, actorTitle: target.ownerTitle, changeSummary: `[Xóa phiếu cá nhân] ${target.maCongViec}`, unitCode: unit.code
      });
      if (saved.conflict) throw Object.assign(new Error('Xung đột revision khi xóa phiếu.'), { code: 'REVISION_CONFLICT', status: 409 });
    } catch (err: unknown) {
      const errObj = err as { code?: string; status?: number };
      if (errObj?.code === 'REVISION_CONFLICT' || errObj?.status === 409) {
        store.set(target.id, target);
        await persistTicketToSupabase(target).catch(() => {});
        persistTickets();
        throw err;
      }
    }
  }

  store.delete(ticketId);
  persistTickets();
  return true;
}

export async function syncTicketsFromWorkbook(wbData: Record<string, GenericGridRow[]>, unitCode: string): Promise<void> {
  const store = loadTickets(), a2Rows = wbData.A2 || [], b1Rows = wbData.B1 || [];
  const b1Map = new Map<string, GenericGridRow>();
  for (const b of b1Rows) { if (b.maCongViec) b1Map.set(String(b.maCongViec).trim(), b); }
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
        id: ticketId, unitCode, ownerEmail: validEmail, ownerName: author.split('@')[0], ownerTitle: 'Cán bộ – Giảng viên',
        status: (a.trangThaiPhieu === 'Đã nộp' ? 'Đã nộp' : 'Nháp') as TicketStatus,
        maNhiemVu: String(a.maNhiemVu || ''), maCongViec: taskCode, tenCongViec: String(a.tenCongViec || ''),
        maVtvl: String(a.maVtvl || ''), maVtvlPhoiHop: String(a.maVtvlPhoiHop || ''), sanPham: String(a.sanPham || ''),
        chatLuong: String(a.chatLuong || ''), canCu: String(a.canCu || ''), soSpNam: Number(b1?.soSpNam) || 0,
        nguonSoLieu: String(b1?.nguon || ''), phutThucTe: Number(b1?.phutThucTe) || 0, gioBoSung: Number(b1?.gioBoSung) || 0,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      await persistTicketToSupabase(newTicket);
      store.set(newTicket.id, newTicket);
      modified = true;
    }
  }
  if (modified) persistTickets();
}

export function migrateTicketsForUnit(oldCode: string, newCode: string): number {
  const store = loadTickets(), cOld = oldCode.trim().toUpperCase(), cNew = newCode.trim().toUpperCase();
  let count = 0;
  for (const ticket of store.values()) {
    if (ticket.unitCode.toUpperCase() === cOld) {
      ticket.unitCode = cNew;
      ticket.maNhiemVu = replaceUnitCodePrefix(ticket.maNhiemVu, cOld, cNew);
      ticket.maCongViec = replaceUnitCodePrefix(ticket.maCongViec, cOld, cNew);
      ticket.maVtvl = replaceUnitCodePrefix(ticket.maVtvl, cOld, cNew);
      if (ticket.maVtvlPhoiHop) ticket.maVtvlPhoiHop = replaceUnitCodePrefix(ticket.maVtvlPhoiHop, cOld, cNew);
      if (Array.isArray(ticket.coordinatedTasks)) {
        ticket.coordinatedTasks = ticket.coordinatedTasks.map((c) => ({
          ...c, targetUnitCode: c.targetUnitCode.toUpperCase() === cOld ? cNew : c.targetUnitCode,
          targetTaskCode: replaceUnitCodePrefix(c.targetTaskCode, cOld, cNew)
        }));
      }
      ticket.updatedAt = new Date().toISOString();
      count++;
    }
  }
  if (count > 0) persistTickets();
  return count;
}
