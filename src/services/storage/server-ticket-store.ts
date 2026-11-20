import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { StaffWorkTicket, TicketStatus, toDisplayStatus, WorkSurveyStatusHistory } from '@/types/staff-ticket';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { getOrCreateWorkbook, hasWorkbookInMemory, normalizeEmail, syncServerWorkbooksFromSupabase } from './server-workbook-store';
import { fetchTicketsFromSupabase, persistTicketToSupabase, deleteTicketFromSupabase, recordStatusHistoryInSupabase } from './server-ticket-db';
import { assertAuthoritativeRemoteTickets, fetchStatusHistoryFromSupabase, mergeRemoteTicketsIntoStore, syncSingleTicketAuthoritativeFromDb } from './server-ticket-history-db';
import { getUserAccountByEmail, syncAccountsFromSupabase } from './server-account-store';
import { getTicketVersions, getTicketMergeLinks, resetVersionMemoryStore } from './server-ticket-version-store';
import { getDraftCoordinationExtras, getReplacedWorkCodesForSurvey, removeCoordinationDataForSurvey, resetCoordinationMemoryStore, saveDraftCoordinationExtras } from './server-coordination-store';
import { registerCacheInvalidator } from './server-file-lock';
import { invalidateCacheTags, invalidateUnitMutationCache } from './runtime-cache';
import { writeJsonFileAtomic, shouldPersistLocalJson } from './atomic-json-file';
import { isDatabaseConfigured } from './prisma';
import { bumpMissionCounterWatermark, getMissionCounterWatermark } from './server-mission-counter';
import { allocateNextTaskCodeAsync } from './server-mission-code-scanner';

export { computeMaxMissionSeq, allocateNextTaskCode, allocateNextTaskCodeAsync } from './server-mission-code-scanner';
export { fetchStatusHistoryFromSupabase, mergeTicketStatusHistory } from './server-ticket-history-db';
export {
  mergeApprovedTicketToUnitWorkbook, batchReconcileUnitTickets, batchReconcileUnitTicketsUnlocked,
  projectUnmergedApprovedTicketsReadOnly, syncTicketsFromWorkbook, migrateTicketsForUnit, migrateTicketsForUnitDetailed, getTicketCounts
} from './server-ticket-merge';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const TICKETS_FILE = path.join(DATA_DIR, 'staff_tickets.json');
let memoryTickets: Map<string, StaffWorkTicket> | null = null;
let globalTicketMutationSeq = 0;
export function getGlobalTicketMutationSeq(): number { return globalTicketMutationSeq; }
const unitMutationSeq = new Map<string, number>();
const deletedTicketIds = new Set<string>();
const lastTicketSyncByScope = new Map<string, number>();
const inFlightTicketSync = new Map<string, Promise<void>>();

/** Ghi nhận mốc ghi/xóa/gộp phiếu mới nhất để chặn preload `ALL` chậm hơn ghi đè hoặc xóa nhầm dữ liệu đơn vị. */
export function bumpTicketMutationWatermark(unitCode?: string, deletedId?: string, resurrectedId?: string): void {
  globalTicketMutationSeq += 1;
  if (resurrectedId) deletedTicketIds.delete(resurrectedId);
  if (deletedId) {
    deletedTicketIds.add(deletedId);
    if (deletedTicketIds.size > 500) deletedTicketIds.delete(deletedTicketIds.values().next().value!);
  }
  if (unitCode) {
    const uc = unitCode.trim().toUpperCase();
    unitMutationSeq.set(uc, (unitMutationSeq.get(uc) || 0) + 1);
    lastTicketSyncByScope.delete(uc);
    lastTicketSyncByScope.delete(`${uc}:lite`);
  }
  lastTicketSyncByScope.delete('ALL');
  lastTicketSyncByScope.delete('ALL:lite');
}

export function resetTicketMemoryStore(): void {
  memoryTickets = null;
  globalTicketMutationSeq = 0; unitMutationSeq.clear(); deletedTicketIds.clear();
  lastTicketSyncByScope.clear(); inFlightTicketSync.clear();
  resetVersionMemoryStore(); resetCoordinationMemoryStore();
  invalidateCacheTags(['tickets', 'overview-stats', 'unit-monitor', 'coordination']);
}
registerCacheInvalidator((lockKey?: string) => {
  if (!lockKey || !isDatabaseConfigured()) {
    memoryTickets = null;
    globalTicketMutationSeq = 0; unitMutationSeq.clear(); deletedTicketIds.clear();
    lastTicketSyncByScope.clear(); inFlightTicketSync.clear(); return;
  }
  const m = lockKey.match(/^(?:unit_wb_|ticket_unit_)(.+)$/i);
  if (m) {
    const u = m[1].trim().toUpperCase();
    lastTicketSyncByScope.delete(u); lastTicketSyncByScope.delete(`${u}:lite`);
    lastTicketSyncByScope.delete('ALL'); lastTicketSyncByScope.delete('ALL:lite');
  } else lastTicketSyncByScope.clear();
});

function resolveActorName(email?: string): string | undefined {
  if (!email) return undefined;
  return getUserAccountByEmail(email)?.displayName;
}

export function enrichTicket(ticket: StaffWorkTicket): StaffWorkTicket {
  const versions = getTicketVersions(ticket.id);
  const mergeLinks = getTicketMergeLinks(ticket.id);
  const replacedWorkCodes = getReplacedWorkCodesForSurvey(ticket.id);
  const latestVer = versions.length > 0 ? versions[versions.length - 1].versionNo : (ticket.currentVersionNo || 0);
  const statusHistory = (ticket.statusHistory || []).map((h) => ({ ...h, actorName: h.actorName || resolveActorName(h.actorId) }));
  const draftExtras = getDraftCoordinationExtras(ticket.id);
  return {
    ...ticket,
    coordinatedVtvls: ticket.coordinatedVtvls?.length ? ticket.coordinatedVtvls : (draftExtras.coordinatedVtvls || []),
    coordinationNote: ticket.coordinationNote || draftExtras.coordinationNote || '',
    approvedByName: ticket.approvedByName || resolveActorName(ticket.approvedBy),
    revisionRequestedByName: ticket.revisionRequestedByName || resolveActorName(ticket.revisionRequestedBy),
    mergedByName: ticket.mergedByName || resolveActorName(ticket.mergedBy),
    statusHistory,
    currentVersionNo: latestVer,
    versions,
    mergeLinks,
    replacedWorkCodes: replacedWorkCodes.length ? replacedWorkCodes : ticket.replacedWorkCodes
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
  if (!shouldPersistLocalJson()) return;
  const store = loadTickets();
  writeJsonFileAtomic(TICKETS_FILE, Array.from(store.values()), true);
}

function captureSyncWatermark(uc?: string) {
  return {
    startedGlobalSeq: globalTicketMutationSeq,
    startedUnitSeq: uc ? (unitMutationSeq.get(uc) || 0) : 0,
    startedUnitSeqSnap: uc ? undefined : new Map(unitMutationSeq),
    startedUnitSyncSnap: uc ? undefined : new Map(lastTicketSyncByScope)
  };
}

async function applyRemoteTicketsToStore(
  uc: string | undefined,
  remote: StaffWorkTicket[],
  started: ReturnType<typeof captureSyncWatermark>,
  includeHistory: boolean
): Promise<StaffWorkTicket[]> {
  const store = loadTickets();
  const scopeKey = uc || 'ALL';
  if (includeHistory) await syncAccountsFromSupabase().catch(() => {});
  const remoteHistory = includeHistory && uc ? await fetchStatusHistoryFromSupabase(uc) : null;
  const mutatedDuringFetch = globalTicketMutationSeq !== started.startedGlobalSeq;
  const unitMutated = uc ? (unitMutationSeq.get(uc) || 0) !== started.startedUnitSeq : mutatedDuringFetch;
  const merged = mergeRemoteTicketsIntoStore({
    store, remote, remoteHistory, unitCode: uc, mutatedDuringFetch, unitMutated,
    startedUnitSeqSnap: started.startedUnitSeqSnap, currentUnitSeqMap: unitMutationSeq,
    startedUnitSyncSnap: started.startedUnitSyncSnap, currentUnitSyncMap: lastTicketSyncByScope, deletedTicketIds
  });
  persistTickets();
  if (uc ? !unitMutated : !mutatedDuringFetch) lastTicketSyncByScope.set(includeHistory ? scopeKey : `${scopeKey}:lite`, Date.now());
  return merged;
}

export async function syncTicketsFromSupabase(unitCode?: string, force = false, includeHistory = true): Promise<void> {
  const uc = unitCode ? unitCode.trim().toUpperCase() : undefined;
  const scopeKey = uc || 'ALL';
  const cacheKey = includeHistory ? scopeKey : `${scopeKey}:lite`;
  const lastSync = lastTicketSyncByScope.get(scopeKey) || (!includeHistory ? lastTicketSyncByScope.get(cacheKey) : 0) || 0;
  if (!force && process.env.VTVL_ISOLATED_LOCAL_STORE !== 'true' && lastSync > 0 && Date.now() - lastSync < 2500) return;
  const activeSync = inFlightTicketSync.get(cacheKey) || (includeHistory ? undefined : inFlightTicketSync.get(scopeKey));
  if (activeSync && !force) return activeSync;

  const run = (async () => {
    const started = captureSyncWatermark(uc);
    const remote = await fetchTicketsFromSupabase(uc);
    assertAuthoritativeRemoteTickets(remote, scopeKey);
    if (remote === null) return;
    await applyRemoteTicketsToStore(uc, remote, started, includeHistory);
  })();
  inFlightTicketSync.set(cacheKey, run);
  try { await run; } finally { if (inFlightTicketSync.get(cacheKey) === run) inFlightTicketSync.delete(cacheKey); }
}

/** Đồng bộ trực tiếp đúng 1 phiếu theo `id` (tránh tải toàn đơn vị khi đã có `ticketId`). */
export async function syncSingleTicketFromSupabase(ticketId: string): Promise<StaffWorkTicket | null> {
  const synced = await syncSingleTicketAuthoritativeFromDb(ticketId, loadTickets(), deletedTicketIds);
  return synced ? enrichTicket(synced) : null;
}

/** Đồng bộ trực tiếp phiếu từ PostgreSQL (vượt cache TTL) và trả thẳng danh sách phiếu thuộc đơn vị cho thao tác gộp. */
export async function syncUnitTicketsAuthoritative(unitCode: string): Promise<StaffWorkTicket[]> {
  const uc = (unitCode || '').trim().toUpperCase();
  if (!uc) return [];
  const started = captureSyncWatermark(uc);
  const remote = await fetchTicketsFromSupabase(uc);
  if (assertAuthoritativeRemoteTickets(remote, uc)) return applyRemoteTicketsToStore(uc, remote, started, false);
  return Array.from(loadTickets().values()).filter((t) => t.unitCode.toUpperCase() === uc);
}

export function getTicketsByOwner(email: string, unitCode?: string): StaffWorkTicket[] {
  const norm = normalizeEmail(email);
  const targetUnit = unitCode ? unitCode.trim().toUpperCase() : undefined;
  const store = loadTickets();
  const tickets = Array.from(store.values()).filter((t) => {
    if (t.isArchived) return false;
    if (normalizeEmail(t.ownerEmail) !== norm) return false;
    if (targetUnit && t.unitCode.toUpperCase() !== targetUnit) return false;
    return true;
  });
  return tickets.map(enrichTicket).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getTicketById(id: string): StaffWorkTicket | null {
  const found = loadTickets().get(id);
  return found ? enrichTicket(found) : null;
}

export function getTicketsByUnit(unitCode: string, includeTestAndArchived = false): StaffWorkTicket[] {
  const uc = (unitCode || '').trim().toUpperCase();
  return Array.from(loadTickets().values())
    .filter((t) => (uc === 'ALL' || t.unitCode.toUpperCase() === uc) && (includeTestAndArchived || (!t.isTestData && !t.isArchived)))
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
  ticket: StaffWorkTicket, entry: Omit<WorkSurveyStatusHistory, 'id' | 'createdAt'>
): Promise<WorkSurveyStatusHistory> {
  await recordStatusHistoryInSupabase(entry);
  const store = loadTickets(), current = store.get(ticket.id) || ticket;
  const newItem: WorkSurveyStatusHistory = {
    ...entry, id: `hist-${ticket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString()
  };
  store.set(ticket.id, { ...current, statusHistory: [...(current.statusHistory || []), newItem] });
  bumpTicketMutationWatermark(current.unitCode);
  persistTickets();
  return newItem;
}

export async function upsertTicketAndSyncUnit(
  input: Omit<StaffWorkTicket, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<{ ticket: StaffWorkTicket; unitWorkbookRevision: number }> {
  const store = loadTickets(), unit = findHcmuteUnit(input.unitCode);
  const existing = input.id ? store.get(input.id) : undefined;
  const needMissionSeed = !existing?.maCongViec && !(input.maCongViec || '').trim() && getMissionCounterWatermark(unit.code, input.maNhiemVu) === undefined;
  if (!hasWorkbookInMemory(unit.code) || needMissionSeed) await syncServerWorkbooksFromSupabase(false, input.unitCode);
  const nowIso = new Date().toISOString();
  const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', input.ownerEmail, input.ownerTitle);
  const currentA2 = wb.data.A2 || [];

  const missionChanged = Boolean(existing && existing.maNhiemVu.trim().toUpperCase() !== input.maNhiemVu.trim().toUpperCase());
  let resolvedTaskCode = !missionChanged ? (existing?.maCongViec || (input.maCongViec || '').trim()) : '';
  if (!resolvedTaskCode) {
    resolvedTaskCode = await allocateNextTaskCodeAsync(unit.code, input.maNhiemVu, currentA2, store.values(), existing?.id);
  } else {
    bumpMissionCounterWatermark(unit.code, input.maNhiemVu, resolvedTaskCode);
  }

  const status: TicketStatus = toDisplayStatus(input.status);
  const ticketId = existing?.id || `tkt-${unit.code}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const normOwner = normalizeEmail(input.ownerEmail);
  const ticket: StaffWorkTicket = {
    ...existing, ...input, id: ticketId, unitCode: unit.code, unitId: unit.code,
    ownerEmail: normOwner, ownerId: normOwner, status, maCongViec: resolvedTaskCode,
    sourceTicketId: input.sourceTicketId || existing?.sourceTicketId || ticketId,
    statusHistory: input.statusHistory || existing?.statusHistory || [],
    createdAt: existing?.createdAt || nowIso, updatedAt: nowIso
  };

  // Bắt buộc ghi DB thành công trước khi cập nhật cache bộ nhớ (không nuốt lỗi)
  await persistTicketToSupabase(ticket, !existing);
  saveDraftCoordinationExtras(ticket.id, ticket.coordinatedVtvls, ticket.coordinationNote);
  store.set(ticket.id, ticket);
  bumpTicketMutationWatermark(unit.code, undefined, ticket.id);
  persistTickets();
  const hasCoord = Boolean(existing?.maVtvlPhoiHop?.trim() || existing?.coordinatedVtvls?.length || ticket.maVtvlPhoiHop?.trim() || ticket.coordinatedVtvls?.length);
  if (hasCoord) invalidateCacheTags(['tickets', 'overview-stats', 'unit-monitor', 'coordination']);
  else invalidateUnitMutationCache(unit.code);

  return { ticket: enrichTicket(ticket), unitWorkbookRevision: wb.currentRevision };
}

export async function deleteTicketAndSyncUnit(ticketId: string, actorEmail: string): Promise<boolean> {
  const store = loadTickets();
  const target = store.get(ticketId);
  if (!target || normalizeEmail(target.ownerEmail) !== normalizeEmail(actorEmail)) return false;
  await deleteTicketFromSupabase(ticketId);
  removeCoordinationDataForSurvey(ticketId);
  store.delete(ticketId);
  bumpTicketMutationWatermark(target.unitCode, ticketId);
  persistTickets();
  invalidateCacheTags(['tickets', 'overview-stats', 'unit-monitor', 'coordination']);
  return true;
}
