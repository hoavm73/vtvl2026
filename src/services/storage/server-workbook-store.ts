import { ExcelSheetKey, GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';
import { fetchWorkbooksFromSupabase, fetchUnitWorkbookFromSupabase, persistWorkbookToSupabase, deleteWorkbookFromSupabase, invalidateSupabaseCache, upsertWorkbookInSupabaseCache, evictUnitFromSupabaseCache } from './server-supabase-store';
import { getInitialSeedWorkbooks } from './server-seed-workbooks';
import { registerCacheInvalidator, withCrossProcessLock } from './server-file-lock';
import { invalidateCacheTags, invalidateUnitMutationCache } from './runtime-cache';
import { writeJsonFileAtomic, shouldPersistLocalJson } from './atomic-json-file';
import { isDatabaseConfigured } from './prisma';
import fs from 'fs'; import path from 'path';

export interface ServerParticipant {
  id: string; sessionId: string; workbookId: string; displayName: string;
  email: string; emailNormalized: string; roleLabel: string; startedAt: string; updatedAt: string;
}
export interface ServerRevision {
  id: string; workbookId: string; revision: number; data: Record<ExcelSheetKey, GenericGridRow[]>;
  actorEmail: string; actorTitle?: string; sessionId?: string; changeSummary?: string; createdAt: string;
}
export interface ServerWorkbook {
  id: string; unitId: string; unitNameVi: string; reportingPeriod: string;
  status: 'not_started' | 'draft' | 'returned' | 'submitted' | 'under_review' | 'reviewed' | 'approved' | 'archived';
  currentRevision: number; data: Record<ExcelSheetKey, GenericGridRow[]>;
  touchedCells: string[]; createdAt: string; updatedAt: string;
  participants: ServerParticipant[]; revisions: ServerRevision[]; isDeleted?: boolean;
}

export function normalizeEmail(raw: string): string {
  let e = (raw || '').trim().toLowerCase();
  if (!e) return '';
  return !e.includes('@') ? `${e}@hcmute.edu.vn` : e.endsWith('@hcmute') ? `${e}.edu.vn` : e;
}

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'server_workbooks.json');
const DELETED_WB_FILE = path.join(DATA_DIR, 'deleted_workbooks.json');
let memoryWorkbooks: Map<string, ServerWorkbook> | null = null;
let deletedWbIds: Set<string> | null = null;
const wbLockGlobal = globalThis as unknown as { __uteVtvlWbLockStatusCache?: Map<string, { locked: boolean; fetchedAt: number }> };
const evictWbLockCache = (uc?: string) => { const m = wbLockGlobal.__uteVtvlWbLockStatusCache; if (m) uc ? m.delete(uc.trim().toUpperCase()) : m.clear(); };
const onUnitMutated = (uc: string, wbId?: string) => { evictWbLockCache(uc); invalidateUnitMutationCache(uc, wbId); };
export function hasWorkbookInMemory(unitCode: string): boolean { return Boolean(memoryWorkbooks && findLatestUnitWorkbook(memoryWorkbooks, unitCode)); }
export function resetWorkbookMemoryStore(): void {
  memoryWorkbooks = null; deletedWbIds = null; invalidateSupabaseCache(); evictWbLockCache();
  invalidateCacheTags(['workbooks', 'overview-stats', 'unit-monitor']);
}
registerCacheInvalidator((lockKey?: string) => {
  const m = lockKey?.match(/^(?:unit_wb_|ticket_unit_)(.+)$/i);
  if (!m || !isDatabaseConfigured()) return resetWorkbookMemoryStore();
  const uc = m[1].trim().toUpperCase();
  if (memoryWorkbooks) for (const [id, wb] of memoryWorkbooks.entries()) if (wb.unitId.toUpperCase() === uc) memoryWorkbooks.delete(id);
  evictUnitFromSupabaseCache(uc); onUnitMutated(uc);
});
export async function withUnitWorkbookLock<T>(unitCode: string, fn: () => Promise<T>): Promise<T> {
  return withCrossProcessLock(`unit_wb_${unitCode.trim().toUpperCase()}`, fn);
}
function ensureDataDir(): void { try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ } }
function loadDeletedWbIds(): Set<string> {
  if (deletedWbIds) return deletedWbIds;
  deletedWbIds = new Set();
  try {
    ensureDataDir();
    if (fs.existsSync(DELETED_WB_FILE)) {
      const list = JSON.parse(fs.readFileSync(DELETED_WB_FILE, 'utf8'));
      if (Array.isArray(list)) list.forEach((id) => deletedWbIds!.add(String(id)));
    }
  } catch { /* ignore */ }
  return deletedWbIds;
}
function persistDeletedWbIds(): void { if (deletedWbIds) writeJsonFileAtomic(DELETED_WB_FILE, Array.from(deletedWbIds)); }
function persistStore(): void { if (memoryWorkbooks && shouldPersistLocalJson()) writeJsonFileAtomic(STORE_FILE, Array.from(memoryWorkbooks.values()), true); }
function loadStore(): Map<string, ServerWorkbook> {
  if (memoryWorkbooks) return memoryWorkbooks;
  memoryWorkbooks = new Map();
  const deleted = loadDeletedWbIds();
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_FILE)) {
      const list: ServerWorkbook[] = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      list.forEach((wb) => { if (deleted.has(wb.id) || deleted.has(wb.unitId)) wb.isDeleted = true; memoryWorkbooks!.set(wb.id, wb); });
    }
  } catch { /* ignore */ }
  if (memoryWorkbooks.size === 0 && !process.env.DATABASE_URL) {
    try {
      getInitialSeedWorkbooks().forEach((wb) => { if (!deleted.has(wb.id) && !deleted.has(wb.unitId)) memoryWorkbooks!.set(wb.id, wb); });
      persistStore();
    } catch { /* ignore */ }
  }
  return memoryWorkbooks;
}
function findLatestUnitWorkbook(store: Map<string, ServerWorkbook>, unitCode: string): ServerWorkbook | null {
  const target = unitCode.trim().toUpperCase();
  return Array.from(store.values()).filter((w) => !w.isDeleted && w.unitId.toUpperCase() === target).sort((a, b) => (b.currentRevision || 0) - (a.currentRevision || 0))[0] || null;
}

export async function syncServerWorkbooksFromSupabase(forceRefresh = false, unitCode?: string): Promise<void> {
  const store = loadStore(), deleted = loadDeletedWbIds();
  try {
    const items = unitCode ? [await fetchUnitWorkbookFromSupabase(unitCode, forceRefresh)].filter((x): x is ServerWorkbook => Boolean(x)) : await fetchWorkbooksFromSupabase(forceRefresh);
    let changed = false;
    for (const sw of items) {
      if (!sw.id || deleted.has(sw.id) || deleted.has(sw.unitId) || store.get(sw.id)?.isDeleted) continue;
      const sameUnit = Array.from(store.values()).filter((w) => !w.isDeleted && w.unitId.toUpperCase() === sw.unitId.toUpperCase());
      const maxRev = sameUnit.reduce((m, w) => Math.max(m, w.currentRevision || 0), 0);
      if (!sameUnit.length || forceRefresh || (sw.currentRevision && sw.currentRevision >= maxRev)) {
        sameUnit.forEach((oldWb) => { if (oldWb.id !== sw.id) store.delete(oldWb.id); });
        store.set(sw.id, sw);
        changed = true;
      }
    }
    if (changed) persistStore();
  } catch (err) {
    if (forceRefresh && process.env.VTVL_ISOLATED_LOCAL_STORE !== 'true' && Boolean((process.env.DATABASE_URL || '').trim())) throw err;
  }
}

export function getWorkbookForUnitReadOnly(unitId: string, reportingPeriod = '01/10/2025–30/9/2026'): ServerWorkbook {
  const store = loadStore();
  const existing = findLatestUnitWorkbook(store, unitId);
  if (existing) return existing;
  const unit = findHcmuteUnit(unitId), id = `wb_${unit.code}_2026`, now = new Date().toLocaleString('vi-VN');
  const defaultData = buildDefaultGridWorkbook(unit.code);
  return {
    id, unitId: unit.code, unitNameVi: unit.nameVi, reportingPeriod, status: unit.code === 'TCNS' ? 'draft' : 'not_started', currentRevision: 1,
    data: defaultData, touchedCells: [], createdAt: now, updatedAt: now, participants: [], revisions: []
  };
}

export function getOrCreateWorkbook(
  unitId: string, reportingPeriod = '01/10/2025–30/9/2026', email = 'tcns@hcmute.edu.vn', roleLabel = 'Chuyên viên'
): ServerWorkbook {
  const store = loadStore(), normEmail = normalizeEmail(email), existing = findLatestUnitWorkbook(store, unitId), now = new Date().toLocaleString('vi-VN');
  if (existing) {
    if (!existing.participants.some((x) => x.emailNormalized === normEmail)) {
      existing.participants.push({ id: `part_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, sessionId: `sess_${Date.now()}`, workbookId: existing.id, displayName: roleLabel, email, emailNormalized: normEmail, roleLabel, startedAt: now, updatedAt: now });
      persistStore();
    }
    return existing;
  }
  const unit = findHcmuteUnit(unitId), id = `wb_${unitId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, defaultData = buildDefaultGridWorkbook(unitId);
  const newWorkbook: ServerWorkbook = {
    id, unitId, unitNameVi: unit.nameVi, reportingPeriod, status: 'draft', currentRevision: 1, data: defaultData, touchedCells: [], createdAt: now, updatedAt: now,
    participants: [{ id: `part_${Date.now()}`, sessionId: `sess_${Date.now()}`, workbookId: id, displayName: roleLabel, email, emailNormalized: normEmail, roleLabel, startedAt: now, updatedAt: now }],
    revisions: [{ id: `rev_${id}_1`, workbookId: id, revision: 1, data: defaultData, actorEmail: normEmail, actorTitle: roleLabel, changeSummary: 'Khởi tạo hồ sơ ban đầu', createdAt: now }]
  };
  store.set(id, newWorkbook); persistStore(); persistWorkbookToSupabase(newWorkbook).catch(() => {});
  return newWorkbook;
}

export function findWorkbooksByEmail(email: string): ServerWorkbook[] {
  const store = loadStore(), norm = normalizeEmail(email), username = norm.split('@')[0];
  return Array.from(store.values()).filter((w) => !w.isDeleted && Array.isArray(w.participants) && w.participants.some((p) => p && (p.emailNormalized === norm || p.emailNormalized?.split('@')[0] === username)));
}

export function getWorkbookById(id: string): ServerWorkbook | null {
  const store = loadStore(), wb = store.get(id);
  if (wb && !wb.isDeleted) return wb;
  const m = id.match(/^wb_([A-Za-z0-9]+)/);
  return m ? findLatestUnitWorkbook(store, m[1]) : null;
}
export function parseDateToTimestamp(raw?: string): number {
  if (!raw) return 0;
  const m = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(Number(m[6]), Number(m[5]) - 1, Number(m[4]), Number(m[1]), Number(m[2]), Number(m[3])).getTime() : (Date.parse(raw) || 0);
}
export function getAllActiveServerWorkbooks(): ServerWorkbook[] {
  return Array.from(loadStore().values()).filter((w) => !w.isDeleted).sort((a, b) => parseDateToTimestamp(b.updatedAt) - parseDateToTimestamp(a.updatedAt));
}

export function saveServerWorkbook(params: {
  workbookId: string; baseRevision: number; data: Record<ExcelSheetKey, GenericGridRow[]>;
  actorEmail: string; actorTitle?: string; touchedCells?: string[]; changeSummary?: string; unitCode?: string; skipAsyncPersist?: boolean;
}): { success: boolean; conflict?: boolean; currentRevision?: number; serverWorkbook?: ServerWorkbook } {
  const store = loadStore();
  let wb = store.get(params.workbookId) || getWorkbookById(params.workbookId);
  if (!wb || wb.isDeleted) {
    const unitCode = params.unitCode || (params.workbookId.startsWith('wb_') ? params.workbookId.split('_')[1] : 'CNTT');
    wb = getOrCreateWorkbook(unitCode, '01/10/2025–30/9/2026', params.actorEmail, params.actorTitle || 'Chuyên viên');
  }

  // Conflict check: baseRevision must match currentRevision (unless baseRevision <= 0)
  if (typeof params.baseRevision === 'number' && params.baseRevision > 0 && params.baseRevision !== wb.currentRevision) {
    return { success: false, conflict: true, currentRevision: wb.currentRevision, serverWorkbook: wb };
  }

  const now = new Date().toLocaleString('vi-VN');
  const normEmail = normalizeEmail(params.actorEmail);
  const nextRev = wb.currentRevision + 1;
  wb.currentRevision = nextRev;
  wb.data = params.data;
  wb.updatedAt = now;
  if (params.touchedCells) wb.touchedCells = params.touchedCells;

  let p = wb.participants.find((x) => x.emailNormalized === normEmail);
  if (!p) {
    p = { id: `part_${Date.now()}`, sessionId: `sess_${Date.now()}`, workbookId: wb.id, displayName: params.actorTitle || 'Chuyên viên', email: params.actorEmail, emailNormalized: normEmail, roleLabel: params.actorTitle || 'Chuyên viên', startedAt: now, updatedAt: now };
    wb.participants.push(p);
  } else {
    p.updatedAt = now;
    if (params.actorTitle) p.roleLabel = params.actorTitle;
  }

  wb.revisions.unshift({ id: `rev_${wb.id}_${nextRev}`, workbookId: wb.id, revision: nextRev, data: params.data, actorEmail: normEmail, actorTitle: params.actorTitle, changeSummary: params.changeSummary || `Cập nhật lần ${nextRev}`, createdAt: now });
  if (wb.revisions.length > 15) wb.revisions = wb.revisions.slice(0, 15);
  persistStore();
  upsertWorkbookInSupabaseCache(wb);
  onUnitMutated(wb.unitId, wb.id);
  if (!params.skipAsyncPersist) persistWorkbookToSupabase(wb).catch(() => {});
  return { success: true, currentRevision: nextRev, serverWorkbook: wb };
}

export async function saveServerWorkbookAndPersist(
  params: Parameters<typeof saveServerWorkbook>[0] & { simulateTxError?: boolean; requireAtomicRpc?: boolean }
): Promise<ReturnType<typeof saveServerWorkbook>> {
  const store = loadStore();
  const prev = store.get(params.workbookId) || getWorkbookById(params.workbookId);
  const prevClone = prev ? { ...prev, participants: prev.participants.map((p) => ({ ...p })), revisions: [...prev.revisions] } : null;
  const res = saveServerWorkbook({ ...params, skipAsyncPersist: true });
  if (res.success && res.serverWorkbook) {
    try {
      await persistWorkbookToSupabase(res.serverWorkbook, undefined, { simulateTxError: params.simulateTxError, requireAtomicRpc: params.requireAtomicRpc });
    } catch (err) {
      if (prevClone) store.set(prevClone.id, prevClone);
      else store.delete(res.serverWorkbook.id);
      persistStore();
      throw err;
    }
  }
  return res;
}

export function rollbackServerWorkbookRevision(
  workbookId: string, targetRevision: number, actorEmail: string, reason?: string
): { success: boolean; currentRevision?: number; serverWorkbook?: ServerWorkbook } {
  const store = loadStore();
  const wb = store.get(workbookId);
  if (!wb || wb.isDeleted) return { success: false };
  const targetRevItem = wb.revisions.find((r) => r.revision === targetRevision);
  if (!targetRevItem) return { success: false };

  const now = new Date().toLocaleString('vi-VN');
  const nextRev = wb.currentRevision + 1;
  wb.currentRevision = nextRev; wb.data = targetRevItem.data; wb.updatedAt = now;
  wb.revisions.unshift({
    id: `rev_${wb.id}_${nextRev}`, workbookId: wb.id, revision: nextRev,
    data: targetRevItem.data, actorEmail: normalizeEmail(actorEmail),
    changeSummary: reason?.trim() ? `Khôi phục từ phiên bản #${targetRevision}: ${reason.trim()}` : `Khôi phục từ phiên bản #${targetRevision}`,
    createdAt: now
  });
  persistStore();
  upsertWorkbookInSupabaseCache(wb);
  onUnitMutated(wb.unitId, wb.id);
  return { success: true, currentRevision: nextRev, serverWorkbook: wb };
}

export async function rollbackServerWorkbookRevisionAndPersist(
  workbookId: string, targetRevision: number, actorEmail: string, reason?: string, options?: { simulateTxError?: boolean; requireAtomicRpc?: boolean }
): Promise<{ success: boolean; currentRevision?: number; serverWorkbook?: ServerWorkbook }> {
  const store = loadStore();
  const prev = store.get(workbookId);
  const prevClone = prev ? { ...prev, participants: prev.participants.map((p) => ({ ...p })), revisions: [...prev.revisions] } : null;
  const res = rollbackServerWorkbookRevision(workbookId, targetRevision, actorEmail, reason);
  if (res.success && res.serverWorkbook) {
    try {
      await persistWorkbookToSupabase(res.serverWorkbook, undefined, options);
    } catch (err) {
      if (prevClone) { store.set(prevClone.id, prevClone); persistStore(); }
      throw err;
    }
  }
  return res;
}

export async function deleteServerWorkbook(workbookId: string): Promise<boolean> {
  const store = loadStore();
  const wb = store.get(workbookId) || Array.from(store.values()).find((w) => w.id === workbookId || w.unitId === workbookId);
  if (!wb) return false;
  wb.isDeleted = true;
  const deleted = loadDeletedWbIds();
  [wb.id, wb.unitId, workbookId].forEach((k) => deleted.add(k));
  persistDeletedWbIds(); persistStore();
  await deleteWorkbookFromSupabase(wb.unitId);
  onUnitMutated(wb.unitId, wb.id);
  return true;
}

export function removeParticipantFromAllWorkbooks(email: string): void {
  const store = loadStore();
  const norm = normalizeEmail(email);
  if (!norm) return;
  let changed = false;
  for (const wb of store.values()) {
    if (!Array.isArray(wb.participants)) continue;
    const orig = wb.participants.length;
    wb.participants = wb.participants.filter((p) => p.emailNormalized !== norm && normalizeEmail(p.email) !== norm);
    if (wb.participants.length !== orig) { changed = true; persistWorkbookToSupabase(wb).catch(() => {}); }
  }
  if (changed) persistStore();
}
