'use client';

const DB_NAME = 'HCMUTE_VTVL_OFFLINE_DB';
const DB_VERSION = 2;
const STORE_DRAFTS = 'workbook_drafts';
const STORE_QUEUE = 'offline_sync_queue';

export interface LocalDraftRecord {
  id: string; // `${UNIT_CODE}::${userId}`
  workbookId?: string;
  unitCode: string;
  userId: string;
  reportingPeriod: string;
  operatorEmail: string;
  data: Record<string, any>;
  touchedCells: string[];
  clientSavedAt: string;
  clientTimestamp: number;
  serverRevision: number;
  isDirty: boolean;
}

export interface OfflineQueueItem {
  id: string;
  workbookId: string;
  unitCode?: string;
  userId?: string;
  baseRevision: number;
  data: Record<string, any>;
  touchedCells: string[];
  queuedAt: number;
  operatorEmail: string;
}

export function buildScopedDraftKey(unitCode: string, userId: string, workbookId?: string): string {
  const uc = (unitCode || 'UNKNOWN').trim().toUpperCase();
  const uid = (userId || 'anonymous').trim().toLowerCase();
  const wb = (workbookId || 'default').trim();
  return `${uc}::${uid}::${wb}`;
}

function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const tx = (event.target as IDBOpenDBRequest).transaction;
        const draftStore = db.objectStoreNames.contains(STORE_DRAFTS)
          ? tx?.objectStore(STORE_DRAFTS)
          : db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
        if (draftStore) {
          if (!draftStore.indexNames.contains('unitCode')) draftStore.createIndex('unitCode', 'unitCode', { unique: false });
          if (!draftStore.indexNames.contains('userId')) draftStore.createIndex('userId', 'userId', { unique: false });
          if (!draftStore.indexNames.contains('unit_user')) draftStore.createIndex('unit_user', ['unitCode', 'userId'], { unique: false });
          if (!draftStore.indexNames.contains('operatorEmail')) draftStore.createIndex('operatorEmail', 'operatorEmail', { unique: false });
          if (!draftStore.indexNames.contains('clientTimestamp')) draftStore.createIndex('clientTimestamp', 'clientTimestamp', { unique: false });
        }
        const queueStore = db.objectStoreNames.contains(STORE_QUEUE)
          ? tx?.objectStore(STORE_QUEUE)
          : db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        if (queueStore) {
          if (!queueStore.indexNames.contains('unitCode')) queueStore.createIndex('unitCode', 'unitCode', { unique: false });
          if (!queueStore.indexNames.contains('userId')) queueStore.createIndex('userId', 'userId', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveLocalDraft(draft: Omit<LocalDraftRecord, 'id' | 'userId'> & { id?: string; userId?: string }): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  const userId = (draft.userId || draft.operatorEmail || 'anonymous').trim().toLowerCase();
  const unitCode = (draft.unitCode || '').trim().toUpperCase();
  const wbId = draft.workbookId || (draft.id && draft.id.startsWith('wb_') ? draft.id : 'default');
  const scopedRecord: LocalDraftRecord = {
    ...draft,
    unitCode,
    userId,
    workbookId: wbId,
    id: buildScopedDraftKey(unitCode, userId, wbId)
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_DRAFTS, 'readwrite');
      tx.objectStore(STORE_DRAFTS).put(scopedRecord);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getLocalDraft(draftKeyOrWbId: string): Promise<LocalDraftRecord | null> {
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_DRAFTS, 'readonly');
      const req = tx.objectStore(STORE_DRAFTS).get(draftKeyOrWbId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getLocalDraftScoped(unitCode: string, userId: string, workbookId?: string): Promise<LocalDraftRecord | null> {
  return getLocalDraft(buildScopedDraftKey(unitCode, userId, workbookId));
}

export function downloadStaleDraftJson(unitCode: string, data: Record<string, unknown>, localRevision: number): void {
  if (typeof window === 'undefined') return;
  const payload = { exportedAt: new Date().toISOString(), unitCode: unitCode.toUpperCase(), localRevision, data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ban-nhap-cu-${unitCode.toUpperCase()}-rev${localRevision}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function purgeStaleLocalDrafts(unitCode: string, minServerRevision: number, userId?: string): Promise<number> {
  const db = await openDB();
  if (!db) return 0;
  const targetUc = (unitCode || '').trim().toUpperCase();
  const targetUser = userId ? userId.trim().toLowerCase() : '';

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_DRAFTS, STORE_QUEUE], 'readwrite');
      const dStore = tx.objectStore(STORE_DRAFTS);
      const qStore = tx.objectStore(STORE_QUEUE);
      let removed = 0;

      const dReq = dStore.getAll();
      dReq.onsuccess = () => {
        for (const rec of (dReq.result || []) as LocalDraftRecord[]) {
          const sameUnit = (rec.unitCode || '').toUpperCase() === targetUc || String(rec.id || '').startsWith(`${targetUc}::`) || String(rec.workbookId || '').startsWith(`wb_${targetUc}_`);
          const sameUser = !targetUser || (rec.userId || rec.operatorEmail || '').toLowerCase() === targetUser;
          if (sameUnit && sameUser && Number(rec.serverRevision || 0) < minServerRevision) {
            dStore.delete(rec.id);
            removed++;
          }
        }
      };

      const qReq = qStore.getAll();
      qReq.onsuccess = () => {
        for (const item of (qReq.result || []) as OfflineQueueItem[]) {
          const sameUnit = (item.unitCode || '').toUpperCase() === targetUc || String(item.workbookId || '').startsWith(`wb_${targetUc}_`);
          const sameUser = !targetUser || (item.userId || item.operatorEmail || '').toLowerCase() === targetUser;
          if (sameUnit && sameUser && Number(item.baseRevision || 0) < minServerRevision) {
            qStore.delete(item.id);
            removed++;
          }
        }
      };

      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => resolve(removed);
    } catch {
      resolve(0);
    }
  });
}

export async function queueOfflineSync(item: OfflineQueueItem): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;
  const scopedItem: OfflineQueueItem = {
    ...item,
    unitCode: (item.unitCode || '').trim().toUpperCase() || undefined,
    userId: (item.userId || item.operatorEmail || '').trim().toLowerCase() || undefined
  };

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).put(scopedItem);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  const db = await openDB();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function removeOfflineQueueItem(id: string): Promise<boolean> {
  const db = await openDB();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
