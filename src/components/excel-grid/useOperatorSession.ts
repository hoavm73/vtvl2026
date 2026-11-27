'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  OperatorSession, getCurrentOperatorSession, saveCurrentOperatorSession,
  updateOperatorSessionUnit, getSessionByEmail, saveEmailSessionData, normalizeEmail, clearUnitLocalGridCache
} from '@/services/telemetry/operator-session';
import { saveLocalDraft, queueOfflineSync, purgeStaleLocalDrafts } from '@/services/storage/indexeddb-storage';
import { saveActiveUnitSession } from '@/services/telemetry/activity-log';
import { consumeGoogleOAuthCallback, performFullLogout } from '@/services/auth/google-auth';
import { ExcelSheetKey, GenericGridRow } from './excel-grid-types';
import { buildWorkbookAuthHeaders, createSerializedSaveQueue, persistUnitGridCache } from './workbook-sync-queue';

export type SyncStatusKind = 'synced' | 'saving' | 'offline' | 'conflict' | 'unsaved';
export type DataSourceKind = 'sample' | 'local_draft' | 'server_created' | 'server_restored' | 'server_synced';

export interface ApiSyncError {
  code: string;
  message: string;
  retryable: boolean;
  timestamp: number;
}

interface QueuedSavePayload {
  data: Record<ExcelSheetKey, GenericGridRow[]>;
  targetUnit: string;
  activeWbId: string;
  touchedArray: string[];
  overrideBaseRevision?: number;
}

export function useOperatorSession(preferredUnitCode?: string) {
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [workbookId, setWorkbookId] = useState<string | null>(null);
  const [currentRevision, setCurrentRevision] = useState<number>(1);
  const [syncStatus, setSyncStatus] = useState<SyncStatusKind>('synced');
  const [dataSource, setDataSource] = useState<DataSourceKind>('sample');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [conflictData, setConflictData] = useState<{ serverRevision?: number; workbook?: unknown } | null>(null);
  const [staleClientDetected, setStaleClientDetected] = useState<boolean>(false);
  const [apiError, setApiError] = useState<ApiSyncError | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [touchedCells, setTouchedCells] = useState<Set<string>>(new Set());
  const [isRestoredSession, setIsRestoredSession] = useState<boolean>(false);
  const [remoteWorkbook, setRemoteWorkbook] = useState<{ unitCode: string; revision: number; status?: string; data: Record<ExcelSheetKey, GenericGridRow[]>; syncToken?: number } | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<Record<ExcelSheetKey, GenericGridRow[]> | null>(null);
  const currentRevisionRef = useRef<number>(1);
  const syncStatusRef = useRef<SyncStatusKind>('synced');
  const touchedCellsRef = useRef<Set<string>>(touchedCells);
  const remoteWorkbookRef = useRef(remoteWorkbook);
  const saveQueueRef = useRef(createSerializedSaveQueue<QueuedSavePayload>());
  const viewingUnitRef = useRef<string | null>(preferredUnitCode ? preferredUnitCode.toUpperCase() : null);

  if (preferredUnitCode) viewingUnitRef.current = preferredUnitCode.toUpperCase();
  touchedCellsRef.current = touchedCells;
  remoteWorkbookRef.current = remoteWorkbook;

  const setRevisionSync = useCallback((rev: number) => { currentRevisionRef.current = rev; setCurrentRevision(rev); }, []);
  const setStatusSync = useCallback((st: SyncStatusKind) => { syncStatusRef.current = st; setSyncStatus(st); }, []);

  const loadUnitWorkbookFromServer = useCallback(async (
    targetUnitCode: string, op: OperatorSession | null, isStillMounted: () => boolean = () => true, forceToken?: number
  ) => {
    try {
      const res = await fetch(`/api/workbooks/wb_${encodeURIComponent(targetUnitCode)}_2026`, { headers: buildWorkbookAuthHeaders(op), cache: 'no-store' });
      if (!res.ok || !isStillMounted()) return null;
      const json = await res.json();
      if (json.workbook && isStillMounted()) {
        const srvRev = Number(json.workbook.currentRevision || 1);
        setWorkbookId(json.workbook.id);
        setRevisionSync(srvRev);
        setDataSource('server_synced');
        if (syncStatusRef.current !== 'saving') setStatusSync('synced');
        setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
        void purgeStaleLocalDrafts(targetUnitCode, srvRev, op?.email);
        if (json.workbook.data) {
          setRemoteWorkbook({ unitCode: json.workbook.unitId || targetUnitCode, revision: srvRev, status: json.workbook.status, data: json.workbook.data, ...(forceToken ? { syncToken: forceToken } : {}) });
        }
        return json.workbook;
      }
    } catch { /* offline fallback */ }
    return null;
  }, [setRevisionSync, setStatusSync]);

  useEffect(() => {
    let isMounted = true;
    const resolveTargetUnit = (cur: OperatorSession) => cur.role === 'admin' && viewingUnitRef.current ? viewingUnitRef.current : (cur.unitCode || 'CNTT');
    const sync = async () => {
      const cur = consumeGoogleOAuthCallback() || getCurrentOperatorSession();
      if (!cur) {
        if (!isMounted) return;
        setSession(null); setWorkbookId(null); setRemoteWorkbook(null); setStaleClientDetected(false);
        setDataSource('sample'); setStatusSync('synced'); setTouchedCells(new Set());
        return;
      }
      if (!isMounted) return;
      setSession(cur); setIsModalOpen(false);
      const saved = getSessionByEmail(cur.email);
      if (saved?.touchedCells) setTouchedCells(new Set(saved.touchedCells));
      if (!cur.hasSelectedUnit && cur.role !== 'admin') return;
      await loadUnitWorkbookFromServer(resolveTargetUnit(cur), cur, () => isMounted);
    };
    const openModalHandler = () => setIsModalOpen(true);
    const onFocusSync = () => {
      if (saveQueueRef.current.isBusy() || syncStatusRef.current === 'saving' || syncStatusRef.current === 'unsaved' || syncStatusRef.current === 'conflict') return;
      const cur = getCurrentOperatorSession();
      if (cur && (cur.hasSelectedUnit || cur.role === 'admin')) void loadUnitWorkbookFromServer(resolveTargetUnit(cur), cur, () => isMounted);
    };
    void sync();
    window.addEventListener('vtvl-operator-changed', sync);
    window.addEventListener('vtvl-open-session-modal', openModalHandler);
    window.addEventListener('focus', onFocusSync);
    return () => {
      isMounted = false;
      window.removeEventListener('vtvl-operator-changed', sync);
      window.removeEventListener('vtvl-open-session-modal', openModalHandler);
      window.removeEventListener('focus', onFocusSync);
    };
  }, [loadUnitWorkbookFromServer, setStatusSync]);

  const markCellTouched = useCallback((cellKey: string) => {
    setTouchedCells((prev) => { if (prev.has(cellKey)) return prev; const next = new Set(prev); next.add(cellKey); return next; });
    setStatusSync('unsaved');
    setDataSource((prev) => (prev === 'sample' ? 'local_draft' : prev));
  }, [setStatusSync]);

  const updateSessionUnit = useCallback((newUnitCode: string) => {
    const cur = getCurrentOperatorSession();
    if (cur?.hasSelectedUnit && cur.role !== 'admin' && cur.unitCode !== newUnitCode) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    saveQueueRef.current.clear();
    viewingUnitRef.current = newUnitCode.toUpperCase();
    const isPreserve = cur?.role === 'admin' || cur?.email === 'tcns@hcmute.edu.vn';
    const updated = isPreserve ? cur : updateOperatorSessionUnit(newUnitCode);
    if (updated) {
      setSession(updated); setWorkbookId(`wb_${newUnitCode}_2026`); setRevisionSync(1);
      setRemoteWorkbook(null); setStaleClientDetected(false); setConflictData(null); setApiError(null); setDataSource('sample'); setStatusSync('synced');
      if (!isPreserve) saveActiveUnitSession({ unitCode: updated.unitCode, actorEmail: updated.email, actorTitle: updated.title });
      void loadUnitWorkbookFromServer(newUnitCode, updated);
    }
  }, [loadUnitWorkbookFromServer, setRevisionSync, setStatusSync]);

  const submitSession = useCallback(async (
    email: string, unitCode: string, title: string, chosenWorkbookId?: string
  ): Promise<{ restoredData: Record<ExcelSheetKey, GenericGridRow[]> | null; isExisting: boolean }> => {
    const norm = normalizeEmail(email) || email;
    const newSession = saveCurrentOperatorSession(norm, unitCode, title);
    setSession(newSession); setIsModalOpen(false); setApiError(null); setStaleClientDetected(false); setConflictData(null);
    saveActiveUnitSession({ unitCode: newSession.unitCode, actorEmail: newSession.email, actorTitle: newSession.title });
    try {
      const res = chosenWorkbookId
        ? await fetch(`/api/workbooks/${chosenWorkbookId}`, { cache: 'no-store' })
        : await fetch('/api/workbooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitCode, reportingPeriod: '01/10/2025–30/9/2026', email: norm, displayName: norm.split('@')[0], roleLabel: title }) });
      if (res.ok) {
        const json = await res.json();
        if (json.workbook) {
          setWorkbookId(json.workbook.id); setRevisionSync(json.workbook.currentRevision || 1);
          setDataSource(chosenWorkbookId ? 'server_restored' : 'server_created'); setStatusSync('synced'); setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
          if (json.workbook.data && Object.keys(json.workbook.data).length > 0) { setIsRestoredSession(true); return { restoredData: json.workbook.data, isExisting: true }; }
        }
      } else {
        setApiError({ code: 'HTTP_' + res.status, message: 'Lỗi khởi tạo hồ sơ máy chủ (' + res.status + ')', retryable: true, timestamp: Date.now() });
      }
    } catch { setApiError({ code: 'NETWORK_ERROR', message: 'Không thể kết nối máy chủ hồ sơ.', retryable: true, timestamp: Date.now() }); }
    const savedRecord = getSessionByEmail(norm, true);
    if (savedRecord?.data && savedRecord.unitCode === newSession.unitCode) {
      setIsRestoredSession(true); setDataSource('local_draft');
      if (savedRecord.touchedCells) setTouchedCells(new Set(savedRecord.touchedCells));
      return { restoredData: savedRecord.data, isExisting: true };
    }
    setIsRestoredSession(false); setTouchedCells(new Set());
    return { restoredData: null, isExisting: false };
  }, [setRevisionSync, setStatusSync]);

  const executeQueuedServerSave = useCallback(async (payload: QueuedSavePayload): Promise<boolean> => {
    if (!session) return false;
    const baseRev = typeof payload.overrideBaseRevision === 'number' ? payload.overrideBaseRevision : currentRevisionRef.current;
    const bodyPayload = {
      data: payload.data, touchedCells: payload.touchedArray, baseRevision: baseRev,
      commitMessage: `Lưu lúc ${new Date().toLocaleTimeString('vi-VN')}`, unitCode: payload.targetUnit,
      participant: { email: session.email, displayName: session.displayName || session.email.split('@')[0], roleLabel: session.title, unitCode: payload.targetUnit }
    };
    try {
      const res = await fetch(`/api/workbooks/${payload.activeWbId}`, { method: 'PUT', headers: buildWorkbookAuthHeaders(session, true), body: JSON.stringify(bodyPayload) });
      if (res.status === 409) {
        const json = await res.json().catch(() => ({}));
        setStatusSync('conflict'); setConflictData({ serverRevision: json.serverRevision, workbook: json.currentServerWorkbook || null }); setStaleClientDetected(true);
        if (typeof json.serverRevision === 'number') void purgeStaleLocalDrafts(payload.targetUnit, json.serverRevision, session.email);
        setApiError({ code: json.code || 'STALE_CLIENT_REVISION', message: json.error || 'Dữ liệu máy chủ đã được cập nhật. Vui lòng chọn tải lại hoặc ghi đè bản đang soạn.', retryable: false, timestamp: Date.now() });
        return false;
      }
      if (res.ok) {
        const json = await res.json();
        const targetWb = json.workbook?.serverWorkbook || json.workbook;
        if (targetWb?.id) setWorkbookId(targetWb.id);
        const nextRev = json.workbook?.currentRevision || targetWb?.currentRevision || (baseRev + 1);
        setRevisionSync(nextRev);
        const savedData = targetWb?.data || payload.data;
        persistUnitGridCache(payload.targetUnit, savedData, nextRev);
        setRemoteWorkbook((prev) => ({ unitCode: payload.targetUnit, revision: nextRev, status: targetWb?.status || prev?.status, data: savedData }));
        setStatusSync('synced'); setDataSource('server_synced'); setStaleClientDetected(false); setConflictData(null); setApiError(null);
        setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
        return true;
      }
      const errJson = await res.json().catch(() => ({}));
      setStatusSync('unsaved');
      setApiError({ code: errJson.code || ('SAVE_FAIL_' + res.status), message: errJson.error || 'Máy chủ phản hồi lỗi khi lưu hồ sơ.', retryable: res.status >= 500, timestamp: Date.now() });
      return false;
    } catch {
      setStatusSync('offline');
      setApiError({ code: 'NETWORK_TIMEOUT', message: 'Lỗi mạng khi lưu máy chủ, dữ liệu vẫn được giữ an toàn tại trình duyệt.', retryable: true, timestamp: Date.now() });
      void queueOfflineSync({ id: `queue_${payload.targetUnit}_${Date.now()}`, workbookId: payload.activeWbId, unitCode: payload.targetUnit, userId: session.email, baseRevision: baseRev, data: payload.data, touchedCells: payload.touchedArray, queuedAt: Date.now(), operatorEmail: session.email });
      return false;
    }
  }, [session, setRevisionSync, setStatusSync]);

  const persistDataForSession = useCallback(async (
    data: Record<ExcelSheetKey, GenericGridRow[]>, forceImmediate = false, unitOverride?: string, overrideBaseRevision?: number
  ): Promise<boolean> => {
    if (!session) return false;
    const targetUnit = (unitOverride || session.unitCode).toUpperCase();
    const activeWbId = (targetUnit === session.unitCode.toUpperCase() && workbookId) ? workbookId : `wb_${targetUnit}_2026`;
    const remote = remoteWorkbookRef.current;
    if (overrideBaseRevision === undefined && remote && remote.unitCode.toUpperCase() === targetUnit && remote.revision > currentRevisionRef.current) {
      setStatusSync('conflict'); setStaleClientDetected(true); setConflictData({ serverRevision: remote.revision, workbook: remote });
      setApiError({ code: 'STALE_CLIENT_REVISION', message: 'Phát hiện phiên bản dữ liệu trình duyệt cũ hơn máy chủ. Vui lòng chọn tải lại hoặc lưu bản đang soạn.', retryable: false, timestamp: Date.now() });
      return false;
    }
    setStatusSync('saving');
    lastDataRef.current = data;
    const touchedArray = Array.from(touchedCellsRef.current);
    saveEmailSessionData(session.email, targetUnit, session.title, data, touchedArray);
    void saveLocalDraft({ workbookId: activeWbId, unitCode: targetUnit, userId: session.email, reportingPeriod: '01/10/2025–30/9/2026', operatorEmail: session.email, data, touchedCells: touchedArray, clientSavedAt: new Date().toISOString(), clientTimestamp: Date.now(), serverRevision: currentRevisionRef.current, isDirty: true });

    const payload: QueuedSavePayload = { data, targetUnit, activeWbId, touchedArray, overrideBaseRevision };
    if (forceImmediate) {
      if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
      return await saveQueueRef.current.enqueue(payload, executeQueuedServerSave);
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    return new Promise<boolean>((resolve) => {
      debounceTimerRef.current = setTimeout(() => { debounceTimerRef.current = null; void saveQueueRef.current.enqueue(payload, executeQueuedServerSave).then(resolve); }, 1500);
    });
  }, [session, workbookId, executeQueuedServerSave, setStatusSync]);

  const forceOverwriteConflict = useCallback(async (data: Record<ExcelSheetKey, GenericGridRow[]>, unitOverride?: string): Promise<boolean> => {
    const targetUnit = (unitOverride || viewingUnitRef.current || session?.unitCode || 'CNTT').toUpperCase();
    let latestRev = conflictData?.serverRevision ?? remoteWorkbookRef.current?.revision ?? currentRevisionRef.current;
    try {
      const res = await fetch(`/api/workbooks/wb_${encodeURIComponent(targetUnit)}_2026`, { headers: buildWorkbookAuthHeaders(session), cache: 'no-store' });
      if (res.ok) { const json = await res.json(); if (typeof json?.workbook?.currentRevision === 'number') latestRev = json.workbook.currentRevision; }
    } catch { /* fallback */ }
    setRevisionSync(latestRev);
    return await persistDataForSession(data, true, targetUnit, latestRev);
  }, [session, conflictData, persistDataForSession, setRevisionSync]);

  const reloadLatestFromServer = useCallback(async (unitOverride?: string) => {
    if (debounceTimerRef.current) { clearTimeout(debounceTimerRef.current); debounceTimerRef.current = null; }
    saveQueueRef.current.clear();
    const targetUnit = (unitOverride || viewingUnitRef.current || session?.unitCode || 'CNTT').toUpperCase();
    clearUnitLocalGridCache(targetUnit, session?.email);
    await purgeStaleLocalDrafts(targetUnit, Number.MAX_SAFE_INTEGER, session?.email);
    setStaleClientDetected(false); setConflictData(null); setApiError(null); setStatusSync('synced');
    return loadUnitWorkbookFromServer(targetUnit, session, () => true, Date.now());
  }, [session, loadUnitWorkbookFromServer, setStatusSync]);

  const retrySync = useCallback(() => { if (!staleClientDetected && lastDataRef.current) void persistDataForSession(lastDataRef.current, true); }, [persistDataForSession, staleClientDetected]);
  const switchSession = useCallback(() => { const cur = getCurrentOperatorSession(); if (!cur || cur.role === 'admin') setIsModalOpen(true); }, []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const logoutSession = useCallback(() => { setSession(null); setWorkbookId(null); setDataSource('sample'); setTouchedCells(new Set()); setIsModalOpen(false); void performFullLogout('/login'); }, []);

  return {
    session, workbookId, currentRevision, syncStatus, dataSource, remoteWorkbook, staleClientDetected, setStaleClientDetected,
    lastSyncedAt, conflictData, apiError, isModalOpen, touchedCells, isRestoredSession,
    markCellTouched, submitSession, updateSessionUnit, reloadLatestFromServer, forceOverwriteConflict, switchSession, closeModal, logoutSession, persistDataForSession, retrySync
  };
}
