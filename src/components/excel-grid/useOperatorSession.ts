'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  OperatorSession, getCurrentOperatorSession, saveCurrentOperatorSession,
  updateOperatorSessionUnit, clearCurrentOperatorSession, getSessionByEmail,
  saveEmailSessionData, normalizeEmail
} from '@/services/telemetry/operator-session';
import { saveLocalDraft, queueOfflineSync } from '@/services/storage/indexeddb-storage';
import { saveActiveUnitSession } from '@/services/telemetry/activity-log';
import { consumeGoogleOAuthCallback } from '@/services/auth/google-auth';
import { ExcelSheetKey, GenericGridRow } from './excel-grid-types';

export type SyncStatusKind = 'synced' | 'saving' | 'offline' | 'conflict' | 'unsaved';
export type DataSourceKind = 'sample' | 'local_draft' | 'server_created' | 'server_restored' | 'server_synced';

export interface ApiSyncError {
  code: string;
  message: string;
  retryable: boolean;
  timestamp: number;
}

export function useOperatorSession() {
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [workbookId, setWorkbookId] = useState<string | null>(null);
  const [currentRevision, setCurrentRevision] = useState<number>(1);
  const [syncStatus, setSyncStatus] = useState<SyncStatusKind>('synced');
  const [dataSource, setDataSource] = useState<DataSourceKind>('sample');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [conflictData, setConflictData] = useState<any | null>(null);
  const [apiError, setApiError] = useState<ApiSyncError | null>(null);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [touchedCells, setTouchedCells] = useState<Set<string>>(new Set());
  const [isRestoredSession, setIsRestoredSession] = useState<boolean>(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<Record<ExcelSheetKey, GenericGridRow[]> | null>(null);

  useEffect(() => {
    let isMounted = true;
    const sync = async () => {
      const oauth = consumeGoogleOAuthCallback();
      const cur = oauth || getCurrentOperatorSession();
      if (!isMounted) return;
      setSession(cur);
      setIsModalOpen(false);
      if (cur) {
        const saved = getSessionByEmail(cur.email);
        if (saved?.touchedCells) setTouchedCells(new Set(saved.touchedCells));
      } else {
        setTouchedCells(new Set());
      }
      const targetUnitCode = cur?.unitCode || 'TCNS';
      try {
        const res = await fetch(`/api/workbooks/wb_${targetUnitCode}_2026`);
        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.workbook) {
            setWorkbookId(json.workbook.id);
            setCurrentRevision(json.workbook.currentRevision || 1);
            setDataSource('server_synced');
            setSyncStatus('synced');
            setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
          }
        }
      } catch { /* offline fallback */ }
    };
    const openModalHandler = () => setIsModalOpen(true);
    sync();
    window.addEventListener('vtvl-operator-changed', sync);
    window.addEventListener('vtvl-open-session-modal', openModalHandler);
    return () => {
      isMounted = false;
      window.removeEventListener('vtvl-operator-changed', sync);
      window.removeEventListener('vtvl-open-session-modal', openModalHandler);
    };
  }, []);

  const markCellTouched = useCallback((cellKey: string) => {
    setTouchedCells((prev) => {
      if (prev.has(cellKey)) return prev;
      const next = new Set(prev);
      next.add(cellKey);
      return next;
    });
    setSyncStatus('unsaved');
    if (dataSource === 'sample') setDataSource('local_draft');
  }, [dataSource]);

  const updateSessionUnit = useCallback((newUnitCode: string) => {
    const updated = updateOperatorSessionUnit(newUnitCode);
    if (updated) {
      setSession(updated);
      setWorkbookId(null);
      setDataSource('sample');
      saveActiveUnitSession({ unitCode: newUnitCode, actorEmail: updated.email, actorTitle: updated.title });
    }
  }, []);

  const submitSession = useCallback(async (
    email: string, unitCode: string, title: string, chosenWorkbookId?: string
  ): Promise<{ restoredData: Record<ExcelSheetKey, GenericGridRow[]> | null; isExisting: boolean }> => {
    const norm = normalizeEmail(email) || email;
    const newSession = saveCurrentOperatorSession(norm, unitCode, title);
    setSession(newSession);
    setIsModalOpen(false);
    setApiError(null);

    saveActiveUnitSession({ unitCode: newSession.unitCode, actorEmail: newSession.email, actorTitle: newSession.title });

    let targetWorkbookId = chosenWorkbookId;

    if (!targetWorkbookId) {
      try {
        const res = await fetch('/api/workbooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitCode, reportingPeriod: '01/10/2025–30/9/2026', email: norm,
            displayName: norm.split('@')[0], roleLabel: title
          })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.workbook) {
            targetWorkbookId = json.workbook.id;
            setWorkbookId(json.workbook.id);
            setCurrentRevision(json.workbook.currentRevision || 1);
            setDataSource('server_created');
            setSyncStatus('synced');
            setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
            if (json.workbook.data && Object.keys(json.workbook.data).length > 0) {
              setIsRestoredSession(true);
              setDataSource('server_restored');
              return { restoredData: json.workbook.data, isExisting: true };
            }
          }
        } else {
          setApiError({ code: 'HTTP_' + res.status, message: 'Lỗi khởi tạo hồ sơ máy chủ (' + res.status + ')', retryable: true, timestamp: Date.now() });
        }
      } catch {
        setApiError({ code: 'NETWORK_ERROR', message: 'Không thể kết nối máy chủ tạo hồ sơ.', retryable: true, timestamp: Date.now() });
      }
    } else {
      setWorkbookId(targetWorkbookId);
      try {
        const res = await fetch(`/api/workbooks/${targetWorkbookId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.workbook) {
            setCurrentRevision(json.workbook.currentRevision || 1);
            setDataSource('server_restored');
            setSyncStatus('synced');
            setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
            if (json.workbook.data) {
              setIsRestoredSession(true);
              return { restoredData: json.workbook.data, isExisting: true };
            }
          }
        }
      } catch {
        setApiError({ code: 'NETWORK_ERROR', message: 'Không thể tải hồ sơ từ máy chủ.', retryable: true, timestamp: Date.now() });
      }
    }

    const savedRecord = getSessionByEmail(norm, true);
    if (savedRecord?.data) {
      setIsRestoredSession(true);
      setDataSource('local_draft');
      if (savedRecord.touchedCells) setTouchedCells(new Set(savedRecord.touchedCells));
      return { restoredData: savedRecord.data, isExisting: true };
    }

    setIsRestoredSession(false);
    setTouchedCells(new Set());
    return { restoredData: null, isExisting: false };
  }, []);

  const persistDataForSession = useCallback(async (
    data: Record<ExcelSheetKey, GenericGridRow[]>, forceImmediate = false
  ) => {
    if (!session) return;
    setSyncStatus('saving');
    lastDataRef.current = data;

    const touchedArray = Array.from(touchedCells);
    saveEmailSessionData(session.email, session.unitCode, session.title, data, touchedArray);

    saveLocalDraft({
      id: workbookId || `draft_${session.unitCode}_${session.email}`,
      unitCode: session.unitCode, reportingPeriod: '01/10/2025–30/9/2026',
      operatorEmail: session.email, data, touchedCells: touchedArray,
      clientSavedAt: new Date().toISOString(), clientTimestamp: Date.now(),
      serverRevision: currentRevision, isDirty: false
    });

    const runServerSave = async () => {
      const activeWbId = workbookId || `wb_${session.unitCode}_2026`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
      if (session.email) headers['x-actor-email'] = session.email;
      try {
        const res = await fetch(`/api/workbooks/${activeWbId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            data, touchedCells: touchedArray, baseRevision: currentRevision,
            commitMessage: `Lưu tự động lúc ${new Date().toLocaleTimeString('vi-VN')}`,
            unitCode: session.unitCode,
            participant: { email: session.email, displayName: session.displayName || session.email.split('@')[0], roleLabel: session.title, unitCode: session.unitCode }
          })
        });

        if (res.status === 409) {
          const json = await res.json();
          setSyncStatus('conflict');
          setConflictData(json.currentServerWorkbook);
          setApiError({ code: 'CONFLICT_409', message: 'Dữ liệu máy chủ đã được cập nhật bởi phiên khác.', retryable: false, timestamp: Date.now() });
          return;
        }

        if (res.ok) {
          const json = await res.json();
          const targetWb = json.workbook?.serverWorkbook || json.workbook;
          if (targetWb?.id) setWorkbookId(targetWb.id);
          const nextRev = json.workbook?.currentRevision || targetWb?.currentRevision;
          if (typeof nextRev === 'number') setCurrentRevision(nextRev);
          setSyncStatus('synced');
          setDataSource('server_synced');
          setApiError(null);
          setLastSyncedAt(new Date().toLocaleTimeString('vi-VN'));
        } else {
          setSyncStatus('offline');
          setApiError({ code: 'SAVE_FAIL_' + res.status, message: 'Máy chủ phản hồi lỗi khi lưu hồ sơ.', retryable: true, timestamp: Date.now() });
        }
      } catch {
        setSyncStatus('offline');
        setApiError({ code: 'NETWORK_TIMEOUT', message: 'Lỗi mạng khi lưu máy chủ, đã ghi tạm vào hàng đợi.', retryable: true, timestamp: Date.now() });
        queueOfflineSync({
          id: `queue_${Date.now()}`, workbookId: activeWbId, baseRevision: currentRevision,
          data, touchedCells: touchedArray, queuedAt: Date.now(), operatorEmail: session.email
        });
      }
    };

    if (forceImmediate) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      await runServerSave();
    } else {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(runServerSave, 1500);
    }
  }, [session, workbookId, currentRevision, touchedCells]);

  const retrySync = useCallback(() => {
    if (lastDataRef.current) persistDataForSession(lastDataRef.current, true);
  }, [persistDataForSession]);

  const switchSession = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const logoutSession = useCallback(() => {
    clearCurrentOperatorSession();
    setSession(null);
    setWorkbookId(null);
    setDataSource('sample');
    setTouchedCells(new Set());
    setIsModalOpen(true);
  }, []);

  return {
    session, workbookId, currentRevision, syncStatus, dataSource,
    lastSyncedAt, conflictData, apiError, isModalOpen, touchedCells,
    isRestoredSession, markCellTouched, submitSession, updateSessionUnit,
    switchSession, closeModal, logoutSession, persistDataForSession, retrySync
  };
}
