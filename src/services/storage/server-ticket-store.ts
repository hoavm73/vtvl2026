import fs from 'fs';
import path from 'path';
import {
  StaffWorkTicket,
  TicketStatus,
  toDisplayStatus,
  WorkSurveyStatusHistory
} from '@/types/staff-ticket';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import {
  getOrCreateWorkbook,
  normalizeEmail,
  syncServerWorkbooksFromSupabase
} from './server-workbook-store';
import {
  fetchTicketsFromSupabase,
  persistTicketToSupabase,
  deleteTicketFromSupabase,
  recordStatusHistoryInSupabase
} from './server-ticket-db';
import {
  fetchStatusHistoryFromSupabase,
  mergeTicketStatusHistory
} from './server-ticket-history-db';
import { getUserAccountByEmail, syncAccountsFromSupabase } from './server-account-store';
import {
  getTicketVersions,
  getTicketMergeLinks,
  resetVersionMemoryStore
} from './server-ticket-version-store';
import { registerCacheInvalidator } from './server-file-lock';

export {
  mergeApprovedTicketToUnitWorkbook,
  syncTicketsFromWorkbook,
  migrateTicketsForUnit,
  getTicketCounts
} from './server-ticket-merge';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const TICKETS_FILE = path.join(DATA_DIR, 'staff_tickets.json');
let memoryTickets: Map<string, StaffWorkTicket> | null = null;
export function resetTicketMemoryStore(): void { memoryTickets = null; resetVersionMemoryStore(); }
registerCacheInvalidator(() => { memoryTickets = null; });

function resolveActorName(email?: string): string | undefined {
  if (!email) return undefined;
  return getUserAccountByEmail(email)?.displayName;
}

export function enrichTicket(ticket: StaffWorkTicket): StaffWorkTicket {
  const versions = getTicketVersions(ticket.id);
  const mergeLinks = getTicketMergeLinks(ticket.id);
  const latestVer = versions.length > 0 ? versions[versions.length - 1].versionNo : (ticket.currentVersionNo || 0);
  const statusHistory = (ticket.statusHistory || []).map((h) => ({
    ...h,
    actorName: h.actorName || resolveActorName(h.actorId)
  }));
  return {
    ...ticket,
    approvedByName: ticket.approvedByName || resolveActorName(ticket.approvedBy),
    revisionRequestedByName: ticket.revisionRequestedByName || resolveActorName(ticket.revisionRequestedBy),
    mergedByName: ticket.mergedByName || resolveActorName(ticket.mergedBy),
    statusHistory,
    currentVersionNo: latestVer,
    versions,
    mergeLinks
  };
}

export function loadTickets(): Map<string, StaffWorkTicket> {
  if (memoryTickets) return memoryTickets;
  const store = new Map<string, StaffWorkTicket>();
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item?.id) store.set(item.id, item as StaffWorkTicket);
        });
      }
    }
  } catch { /* ignore */ }
  memoryTickets = store;
  return store;
}

export function persistTickets(): void {
  const store = loadTickets();
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(Array.from(store.values()), null, 2), 'utf8');
  } catch { /* ignore */ }
}

export async function syncTicketsFromSupabase(unitCode?: string): Promise<void> {
  const store = loadTickets();
  const remote = await fetchTicketsFromSupabase(unitCode);
  if (remote === null) return;
  await syncAccountsFromSupabase().catch(() => {});
  const remoteHistory = await fetchStatusHistoryFromSupabase(unitCode);
  if (unitCode) {
    const uc = unitCode.toUpperCase();
    for (const [id, t] of Array.from(store.entries())) {
      if (t.unitCode.toUpperCase() === uc) store.delete(id);
    }
  }
  for (const t of remote) {
    const existing = store.get(t.id);
    store.set(t.id, {
      ...existing,
      ...t,
      statusHistory: mergeTicketStatusHistory(existing?.statusHistory || t.statusHistory, remoteHistory?.get(t.id))
    });
  }
  persistTickets();
}

export function allocateNextTaskCode(
  unitCode: string,
  missionCode: string,
  a2Rows: GenericGridRow[],
  existingTickets: StaffWorkTicket[],
  excludeTicketId?: string
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
    // Bảo toàn mọi mã công việc đã tồn tại trong CSDL (kể cả phiếu thử/lưu trữ) để không cấp trùng lại mã cũ
    if (t.id === excludeTicketId || t.unitCode.toUpperCase() !== unitCode.toUpperCase()) continue;
    const match = String(t.maCongViec || '').trim().match(pattern);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  return `${cleanMission}.CV${String(maxNum + 1).padStart(2, '0')}`;
}

export function getTicketsByOwner(email: string, unitCode?: string): StaffWorkTicket[] {
  const norm = normalizeEmail(email);
  const targetUnit = unitCode ? unitCode.trim().toUpperCase() : undefined;
  const store = loadTickets();
  const tickets = Array.from(store.values()).filter((t) => {
    if (normalizeEmail(t.ownerEmail) !== norm) return false;
    if (targetUnit && t.unitCode.toUpperCase() !== targetUnit) return false;
    return true;
  });
  return tickets.map(enrichTicket).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getTicketById(id: string): StaffWorkTicket | null {
  const store = loadTickets();
  const found = store.get(id);
  return found ? enrichTicket(found) : null;
}

export function getTicketsByUnit(unitCode: string, includeTestAndArchived = false): StaffWorkTicket[] {
  const uc = (unitCode || '').trim().toUpperCase();
  return Array.from(loadTickets().values())
    .filter((t) => t.unitCode.toUpperCase() === uc && (includeTestAndArchived || (!t.isTestData && !t.isArchived)))
    .map(enrichTicket)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function restoreTicketInMemory(previous: StaffWorkTicket | undefined, ticketId: string): void {
  const store = loadTickets();
  if (previous) store.set(ticketId, previous);
  else store.delete(ticketId);
  persistTickets();
}

export async function appendTicketStatusHistory(
  ticket: StaffWorkTicket,
  entry: Omit<WorkSurveyStatusHistory, 'id' | 'createdAt'>
): Promise<WorkSurveyStatusHistory> {
  await recordStatusHistoryInSupabase(entry);
  const store = loadTickets();
  const current = store.get(ticket.id) || ticket;
  const newItem: WorkSurveyStatusHistory = {
    ...entry,
    id: `hist-${ticket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString()
  };
  const updated: StaffWorkTicket = {
    ...current,
    statusHistory: [...(current.statusHistory || []), newItem]
  };
  store.set(ticket.id, updated);
  persistTickets();
  return newItem;
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
  const allTickets = Array.from(store.values());

  let resolvedTaskCode = (input.maCongViec || '').trim();
  const missionChanged = existing && existing.maNhiemVu !== input.maNhiemVu;
  if (!resolvedTaskCode || missionChanged) {
    resolvedTaskCode = allocateNextTaskCode(unit.code, input.maNhiemVu, currentA2, allTickets, existing?.id);
  }

  const status: TicketStatus = toDisplayStatus(input.status);
  const ticketId = existing?.id || `tkt-${unit.code}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
  const ticket: StaffWorkTicket = {
    ...existing,
    ...input,
    id: ticketId,
    unitCode: unit.code,
    unitId: unit.code,
    ownerEmail: normalizeEmail(input.ownerEmail),
    ownerId: normalizeEmail(input.ownerEmail),
    status,
    maCongViec: resolvedTaskCode,
    sourceTicketId: input.sourceTicketId || existing?.sourceTicketId || ticketId,
    statusHistory: input.statusHistory || existing?.statusHistory || [],
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso
  };

  // Bắt buộc ghi DB thành công trước khi cập nhật cache bộ nhớ (không nuốt lỗi)
  await persistTicketToSupabase(ticket);
  store.set(ticket.id, ticket);
  persistTickets();

  return { ticket: enrichTicket(ticket), unitWorkbookRevision: wb.currentRevision };
}

export async function deleteTicketAndSyncUnit(ticketId: string, actorEmail: string): Promise<boolean> {
  const store = loadTickets();
  const target = store.get(ticketId);
  if (!target || normalizeEmail(target.ownerEmail) !== normalizeEmail(actorEmail)) return false;
  await deleteTicketFromSupabase(ticketId);
  store.delete(ticketId);
  persistTickets();
  return true;
}
