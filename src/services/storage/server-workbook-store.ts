import { ExcelSheetKey, GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';
import { fetchWorkbooksFromSupabase, persistWorkbookToSupabase, deleteWorkbookFromSupabase } from './server-supabase-store';
import { getInitialSeedWorkbooks } from './server-seed-workbooks';
import fs from 'fs';
import path from 'path';

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
  status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'archived';
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

function ensureDataDir(): void {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ }
}
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
function persistDeletedWbIds(): void {
  if (!deletedWbIds) return;
  try {
    ensureDataDir();
    fs.writeFileSync(DELETED_WB_FILE, JSON.stringify(Array.from(deletedWbIds)), 'utf8');
  } catch { /* ignore */ }
}

function loadStore(): Map<string, ServerWorkbook> {
  if (memoryWorkbooks) return memoryWorkbooks;
  memoryWorkbooks = new Map();
  const deleted = loadDeletedWbIds();
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_FILE)) {
      const list: ServerWorkbook[] = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      list.forEach((wb) => {
        if (deleted.has(wb.id) || deleted.has(wb.unitId)) wb.isDeleted = true;
        memoryWorkbooks!.set(wb.id, wb);
      });
    }
  } catch { /* ignore */ }
  if (memoryWorkbooks.size === 0 && !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL) {
    try {
      const seeds = getInitialSeedWorkbooks();
      seeds.forEach((wb) => {
        if (!deleted.has(wb.id) && !deleted.has(wb.unitId)) memoryWorkbooks!.set(wb.id, wb);
      });
      persistStore();
    } catch { /* ignore */ }
  }
  return memoryWorkbooks;
}

function persistStore(): void {
  if (!memoryWorkbooks) return;
  try {
    ensureDataDir();
    fs.writeFileSync(STORE_FILE, JSON.stringify(Array.from(memoryWorkbooks.values()), null, 2), 'utf8');
  } catch { /* ignore */ }
}

export async function syncServerWorkbooksFromSupabase(): Promise<void> {
  const store = loadStore();
  const deleted = loadDeletedWbIds();
  try {
    const supaWorkbooks = await fetchWorkbooksFromSupabase();
    for (const sw of supaWorkbooks) {
      if (!sw.id || deleted.has(sw.id) || deleted.has(sw.unitId)) continue;
      const local = store.get(sw.id);
      if (local?.isDeleted) continue;
      if (!local || (sw.currentRevision && sw.currentRevision >= local.currentRevision)) {
        store.set(sw.id, sw);
      }
    }
    persistStore();
  } catch { /* ignore */ }
}

export function getOrCreateWorkbook(
  unitId: string,
  reportingPeriod = '01/10/2025–30/9/2026',
  email = 'tcns@hcmute.edu.vn',
  roleLabel = 'Chuyên viên'
): ServerWorkbook {
  const store = loadStore();
  const normEmail = normalizeEmail(email);
  const existing = Array.from(store.values()).find(
    (w) => !w.isDeleted && w.unitId === unitId && w.reportingPeriod === reportingPeriod
  );
  const now = new Date().toLocaleString('vi-VN');
  if (existing) {
    let p = existing.participants.find((x) => x.emailNormalized === normEmail);
    if (!p) {
      existing.participants.push({
        id: `part_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sessionId: `sess_${Date.now()}`, workbookId: existing.id,
        displayName: roleLabel, email, emailNormalized: normEmail,
        roleLabel, startedAt: now, updatedAt: now
      });
      persistStore();
      persistWorkbookToSupabase(existing).catch(() => {});
    }
    return existing;
  }

  const unit = findHcmuteUnit(unitId);
  const id = `wb_${unitId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const defaultData = buildDefaultGridWorkbook(unitId);
  const newWorkbook: ServerWorkbook = {
    id, unitId, unitNameVi: unit.nameVi, reportingPeriod, status: 'draft',
    currentRevision: 1, data: defaultData, touchedCells: [], createdAt: now, updatedAt: now,
    participants: [{
      id: `part_${Date.now()}`, sessionId: `sess_${Date.now()}`, workbookId: id,
      displayName: roleLabel, email, emailNormalized: normEmail,
      roleLabel, startedAt: now, updatedAt: now
    }],
    revisions: [{
      id: `rev_${id}_1`, workbookId: id, revision: 1, data: defaultData,
      actorEmail: normEmail, actorTitle: roleLabel, changeSummary: 'Khởi tạo hồ sơ ban đầu',
      createdAt: now
    }]
  };
  store.set(id, newWorkbook);
  persistStore();
  persistWorkbookToSupabase(newWorkbook).catch(() => {});
  return newWorkbook;
}

export function findWorkbooksByEmail(email: string): ServerWorkbook[] {
  const store = loadStore();
  const norm = normalizeEmail(email);
  const username = norm.split('@')[0];
  return Array.from(store.values()).filter(
    (w) => !w.isDeleted && Array.isArray(w.participants) && w.participants.some(
      (p) => p && (p.emailNormalized === norm || p.emailNormalized?.split('@')[0] === username)
    )
  );
}

export function getWorkbookById(id: string): ServerWorkbook | null {
  const store = loadStore();
  const wb = store.get(id);
  if (wb && !wb.isDeleted) return wb;
  const m = id.match(/^wb_([A-Za-z0-9]+)/);
  return m ? Array.from(store.values()).find((w) => !w.isDeleted && (w.unitId === m[1] || w.id === id)) || null : null;
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
  actorEmail: string; actorTitle?: string; touchedCells?: string[]; changeSummary?: string; unitCode?: string;
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
    p = {
      id: `part_${Date.now()}`, sessionId: `sess_${Date.now()}`, workbookId: wb.id,
      displayName: params.actorTitle || 'Chuyên viên', email: params.actorEmail,
      emailNormalized: normEmail, roleLabel: params.actorTitle || 'Chuyên viên',
      startedAt: now, updatedAt: now
    };
    wb.participants.push(p);
  } else {
    p.updatedAt = now;
    if (params.actorTitle) p.roleLabel = params.actorTitle;
  }

  wb.revisions.unshift({
    id: `rev_${wb.id}_${nextRev}`, workbookId: wb.id, revision: nextRev,
    data: params.data, actorEmail: normEmail, actorTitle: params.actorTitle,
    changeSummary: params.changeSummary || `Cập nhật lần ${nextRev}`, createdAt: now
  });
  if (wb.revisions.length > 15) wb.revisions = wb.revisions.slice(0, 15);

  persistStore();
  persistWorkbookToSupabase(wb).catch(() => {});
  return { success: true, currentRevision: nextRev, serverWorkbook: wb };
}

export function rollbackServerWorkbookRevision(
  workbookId: string, targetRevision: number, actorEmail: string
): { success: boolean; currentRevision?: number } {
  const store = loadStore();
  const wb = store.get(workbookId);
  if (!wb || wb.isDeleted) return { success: false };
  const targetRevItem = wb.revisions.find((r) => r.revision === targetRevision);
  if (!targetRevItem) return { success: false };

  const now = new Date().toLocaleString('vi-VN');
  const nextRev = wb.currentRevision + 1;
  wb.currentRevision = nextRev;
  wb.data = targetRevItem.data;
  wb.updatedAt = now;
  wb.revisions.unshift({
    id: `rev_${wb.id}_${nextRev}`, workbookId: wb.id, revision: nextRev,
    data: targetRevItem.data, actorEmail: normalizeEmail(actorEmail),
    changeSummary: `Khôi phục từ phiên bản #${targetRevision}`, createdAt: now
  });
  persistStore();
  persistWorkbookToSupabase(wb).catch(() => {});
  return { success: true, currentRevision: nextRev };
}

export async function deleteServerWorkbook(workbookId: string): Promise<boolean> {
  const store = loadStore();
  const wb = store.get(workbookId) || Array.from(store.values()).find((w) => w.id === workbookId || w.unitId === workbookId);
  if (!wb) return false;
  wb.isDeleted = true;
  const deleted = loadDeletedWbIds();
  deleted.add(wb.id);
  deleted.add(wb.unitId);
  deleted.add(workbookId);
  persistDeletedWbIds();
  persistStore();
  await deleteWorkbookFromSupabase(wb.unitId);
  return true;
}

export function removeParticipantFromAllWorkbooks(email: string): void {
  const store = loadStore();
  const norm = normalizeEmail(email);
  if (!norm) return;
  let changed = false;
  for (const wb of store.values()) {
    if (Array.isArray(wb.participants)) {
      const orig = wb.participants.length;
      wb.participants = wb.participants.filter(
        (p) => p.emailNormalized !== norm && normalizeEmail(p.email) !== norm
      );
      if (wb.participants.length !== orig) {
        changed = true;
        persistWorkbookToSupabase(wb).catch(() => {});
      }
    }
  }
  if (changed) persistStore();
}
