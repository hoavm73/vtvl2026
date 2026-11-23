'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Eye } from 'lucide-react';
import { useExcelGridState } from './excel-grid-state';
import { EXCEL_SHEET_METAS } from './excel-sheet-metas';
import { ExcelSheetTabs } from './ExcelSheetTabs';
import { ExcelTableRenderer } from './ExcelTableRenderer';
import { ScientificWorkspaceCard } from './ScientificWorkspaceCard';
import { GuidanceDrawerModal } from './GuidanceDrawerModal';
import { ExcelSheetKey, getStepFromSheet } from './excel-grid-types';
import { C1AdminLockModal } from './C1AdminLockModal';
import { DataQualityReportModal } from './DataQualityReportModal';
import { OperatorSessionModal } from './OperatorSessionModal';
import { WorkforceStructureChartModal } from './WorkforceStructureChartModal';
import { UnitOrgTreeModal } from '@/components/admin/UnitOrgTreeModal';
import { MobileStickyActionBar } from './MobileStickyActionBar';
import { useOperatorSession } from './useOperatorSession';
import { useA1ExcelWorkflow } from './useA1ExcelWorkflow';
import { A1ExcelToolbarActions } from './A1ExcelToolbarActions';
import { A1ImportModal } from './A1ImportModal';
import { validateWorkbookData } from '@/services/validation';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { syncContextQueryParams } from '@/services/context/workbook-context';

interface ExcelWorkbookViewerProps {
  initialUnitCode?: string;
  requestedUnitCode?: string;
  initialSheet?: ExcelSheetKey;
  hideUnitSelector?: boolean;
}

export function ExcelWorkbookViewer({ initialUnitCode = 'TCNS', requestedUnitCode, initialSheet, hideUnitSelector = false }: ExcelWorkbookViewerProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showGuidanceModal, setShowGuidanceModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showOrgTreeModal, setShowOrgTreeModal] = useState(false);
  const [dirtySheets, setDirtySheets] = useState<Set<ExcelSheetKey>>(new Set());

  const markSheetDirty = (sheetKey: ExcelSheetKey) => setDirtySheets((p) => (p.has(sheetKey) ? p : new Set(p).add(sheetKey)));
  const clearSheetDirty = (sheetKey: ExcelSheetKey) => setDirtySheets((p) => { if (!p.has(sheetKey)) return p; const n = new Set(p); n.delete(sheetKey); return n; });

  const {
    session, isModalOpen, touchedCells, currentRevision, syncStatus, dataSource, remoteWorkbook, staleClientDetected, setStaleClientDetected,
    apiError, lastSyncedAt, markCellTouched, submitSession, updateSessionUnit, reloadLatestFromServer, switchSession, closeModal, persistDataForSession
  } = useOperatorSession(requestedUnitCode);

  const lastRemoteHandledRef = useRef<string>('');
  const lastAutoSyncedSnapshotRef = useRef<string>('');
  const lastRequestedUnitRef = useRef<string | null>(null);
  const didApplyRoleSheetRef = useRef<boolean>(false);
  const isAdmin = session?.role === 'admin';

  const {
    unitCode, currentUnit, orderMode, setOrderMode, currentSheetOrder, activeSheet, activeSheetIndex, data, lastSaved, lastSavedSheet,
    isExporting, dynamicOptionsMap, isC1Unlocked, unlockC1, handleUnitChange: gridHandleUnitChange, handleLoadTcnsData, restoreWorkbookData,
    loadRecommendedVtvls, setActiveSheet, updateCell, addRow, splitRow, deleteRow, saveSheetData, exportFullWorkbook, goToNextSheet, goToPrevSheet
  } = useExcelGridState(requestedUnitCode || session?.unitCode || initialUnitCode, isAdmin, initialSheet, Boolean(requestedUnitCode));

  useEffect(() => {
    if (!session) return;
    if (session.role !== 'admin') {
      if (session.unitCode && session.unitCode.toUpperCase() !== unitCode.toUpperCase()) gridHandleUnitChange(session.unitCode);
      return;
    }
    if (requestedUnitCode) {
      const reqCode = findHcmuteUnit(requestedUnitCode).code;
      const reqUpper = reqCode.toUpperCase();
      if (lastRequestedUnitRef.current !== reqUpper) {
        lastRequestedUnitRef.current = reqUpper;
        lastRemoteHandledRef.current = '';
        setDirtySheets(new Set());
        if (unitCode.toUpperCase() !== reqUpper) gridHandleUnitChange(reqCode);
        updateSessionUnit(reqCode);
      }
    } else if (!lastRequestedUnitRef.current && session.unitCode) {
      const sesUpper = session.unitCode.toUpperCase();
      lastRequestedUnitRef.current = sesUpper;
      if (unitCode.toUpperCase() !== sesUpper) gridHandleUnitChange(session.unitCode);
    }
  }, [session, requestedUnitCode, unitCode, gridHandleUnitChange, updateSessionUnit]);

  useEffect(() => {
    if (!initialSheet && session?.role === 'staff' && !didApplyRoleSheetRef.current) {
      didApplyRoleSheetRef.current = true;
      setActiveSheet('A2');
    }
  }, [initialSheet, session?.role, setActiveSheet]);

  const activeMeta = EXCEL_SHEET_METAS[activeSheet];
  const activeRows = data[activeSheet] || [];
  const isWorkbookLocked = remoteWorkbook?.status === 'approved' || remoteWorkbook?.status === 'archived';
  const isReadOnlyViewer = session?.role === 'staff' || isWorkbookLocked;
  const effectiveC1Unlocked = !isWorkbookLocked && (isC1Unlocked || session?.role === 'admin' || session?.role === 'unit_leader');

  const a1Flow = useA1ExcelWorkflow({ unitCode, unitNameVi: currentUnit.nameVi, data, isReadOnly: isReadOnlyViewer, restoreWorkbookData, persistDataForSession });
  const { checkA1BeforeSave, isA1ValidForAutoSave, syncA1Baseline, clearCellError } = a1Flow;

  const handleSave = useCallback((): boolean => {
    if (isReadOnlyViewer) return false;
    if (!checkA1BeforeSave(data.A1 || [], true)) return false;
    const synced = saveSheetData(activeSheet);
    lastAutoSyncedSnapshotRef.current = `${unitCode}:${JSON.stringify(synced)}`;
    void persistDataForSession(synced, true, unitCode).then((ok) => { if (ok) syncA1Baseline(synced.A1); });
    clearSheetDirty(activeSheet);
    return true;
  }, [isReadOnlyViewer, activeSheet, data.A1, saveSheetData, persistDataForSession, unitCode, checkA1BeforeSave, syncA1Baseline]);

  useEffect(() => {
    if (isReadOnlyViewer || dirtySheets.size === 0) return;
    if (!isA1ValidForAutoSave(data.A1 || [])) return;
    const snapKey = `${unitCode}:${JSON.stringify(data)}`;
    if (snapKey === lastAutoSyncedSnapshotRef.current) return;
    lastAutoSyncedSnapshotRef.current = snapKey;
    void persistDataForSession(data, false, unitCode).then((ok) => { if (ok) syncA1Baseline(data.A1); });
  }, [dirtySheets, data, unitCode, isReadOnlyViewer, persistDataForSession, isA1ValidForAutoSave, syncA1Baseline]);

  useEffect(() => {
    if (!remoteWorkbook || remoteWorkbook.unitCode.toUpperCase() !== unitCode.toUpperCase()) return;
    const key = `${unitCode}:${remoteWorkbook.revision}`;
    if (lastRemoteHandledRef.current === key) return;
    const gridKey = `hcmute_vtvl_grid_${unitCode}`;
    const revKey = `hcmute_vtvl_grid_rev_${unitCode}`;
    let hasLocalGrid = false;
    let savedRev = 0;
    try {
      hasLocalGrid = Boolean(typeof window !== 'undefined' && localStorage.getItem(gridKey));
      savedRev = typeof window !== 'undefined' ? Number(localStorage.getItem(revKey) || 0) : 0;
    } catch { /* ignore */ }
    const localDiffers = (data.C1 || []).length !== (remoteWorkbook.data?.C1 || []).length || (data.A1 || []).length !== (remoteWorkbook.data?.A1 || []).length;
    const serverTicketDiff = (data.A2 || []).filter((r) => r.sourceTicketId).length !== (remoteWorkbook.data?.A2 || []).filter((r) => r.sourceTicketId).length;
    const isStaleLocal = hasLocalGrid && savedRev < remoteWorkbook.revision;

    if (dirtySheets.size > 0) {
      if (isStaleLocal && !isReadOnlyViewer) setStaleClientDetected(true);
      return;
    }
    lastRemoteHandledRef.current = key;
    if (isReadOnlyViewer || !hasLocalGrid || remoteWorkbook.revision > savedRev || localDiffers || serverTicketDiff) {
      lastAutoSyncedSnapshotRef.current = `${unitCode}:${JSON.stringify(remoteWorkbook.data)}`;
      restoreWorkbookData(remoteWorkbook.data, unitCode);
      syncA1Baseline(remoteWorkbook.data?.A1);
      try {
        localStorage.setItem(gridKey, JSON.stringify(remoteWorkbook.data));
        localStorage.setItem(revKey, String(remoteWorkbook.revision));
      } catch { /* ignore */ }
      setDirtySheets(new Set());
      setStaleClientDetected(false);
    }
  }, [remoteWorkbook, unitCode, dirtySheets.size, isReadOnlyViewer, data, restoreWorkbookData, setStaleClientDetected]);

  const handleSaveAndNext = useCallback(() => {
    if (handleSave()) goToNextSheet();
  }, [handleSave, goToNextSheet]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]);

  const handleSelectSheetSafe = (targetKey: ExcelSheetKey) => {
    if (dirtySheets.has(activeSheet) && !handleSave()) return;
    setActiveSheet(targetKey);
    if (typeof window !== 'undefined' && (window.location.pathname === '/bang-tinh' || window.location.pathname === '/nghiep-vu-don-vi')) {
      syncContextQueryParams(window.location.pathname === '/bang-tinh' ? { unit: unitCode, sheet: targetKey } : { sheet: targetKey }, 'replace');
    }
  };

  const qualityReport = useMemo(() => {
    return validateWorkbookData(data, unitCode, currentUnit.nameVi);
  }, [data, unitCode, currentUnit.nameVi]);

  return (
    <div className="w-full max-w-full min-w-0 bg-white border border-[var(--border)] rounded-xl flex flex-col">
      <ScientificWorkspaceCard
        activeSheet={activeSheet} currentUnit={currentUnit} unitCode={unitCode} activeStep={getStepFromSheet(activeSheet)}
        activeSheetIndex={activeSheetIndex} totalSheets={currentSheetOrder.length} rowsCount={activeRows.length}
        isDirty={dirtySheets.has(activeSheet)} qualityReport={qualityReport} session={session} revision={currentRevision}
        syncStatus={syncStatus} dataSource={dataSource} apiError={apiError} lastSyncedAt={lastSyncedAt}
        orderMode={orderMode} canNext={activeSheetIndex < currentSheetOrder.length - 1} isExporting={isExporting}
        isC1Unlocked={effectiveC1Unlocked} hideUnitSelector={hideUnitSelector} onSelectSheet={handleSelectSheetSafe}
        onUnitChange={(u) => { lastRequestedUnitRef.current = u.toUpperCase(); gridHandleUnitChange(u); updateSessionUnit(u); setDirtySheets(new Set()); if (typeof window !== 'undefined' && window.location.pathname === '/bang-tinh') syncContextQueryParams({ unit: u.toUpperCase(), sheet: activeSheet }, 'replace'); }}
        onSwitchSession={switchSession} onSaveNow={handleSave} onToggleOrderMode={setOrderMode}
        onOpenGuidance={() => setShowGuidanceModal(true)} onOpenQualityModal={() => setShowQualityModal(true)}
        onOpenChartModal={() => setShowChartModal(true)} onOpenOrgTreeModal={() => setShowOrgTreeModal(true)}
        onSaveSheet={handleSave} onSaveAndNext={handleSaveAndNext} onExportWorkbook={exportFullWorkbook}
        onLoadTcnsData={() => { if (!isReadOnlyViewer) { markSheetDirty('C1'); handleLoadTcnsData(); } }}
        onLoadRecommendedVtvls={() => { if (!isReadOnlyViewer) { markSheetDirty('C1'); loadRecommendedVtvls(); } }}
        onOpenUnlockModal={() => setShowUnlockModal(true)}
      />
      <ExcelSheetTabs activeSheet={activeSheet} sheetOrder={currentSheetOrder} orderMode={orderMode} dirtySheets={dirtySheets} onSelectSheet={handleSelectSheetSafe} onPrev={goToPrevSheet} onNext={goToNextSheet} canPrev={activeSheetIndex > 0} canNext={activeSheetIndex < currentSheetOrder.length - 1} />

      {/* 4. BANNER CẢNH BÁO CACHE CŨ / LỖI A1 / CHỈ XEM / LƯỚI DỮ LIỆU */}
      {staleClientDetected && !isReadOnlyViewer && (
        <div className="px-4 py-2.5 border-b border-[#f8b4af] bg-[#fdeceb] flex flex-wrap items-center justify-between gap-2 text-xs text-[#004776]">
          <span className="font-semibold">Phát hiện bản nháp cũ hơn phiên bản máy chủ. Hệ thống đã cách ly bản nháp cục bộ và chặn tự động tải lên — vui lòng tải lại phiên bản mới nhất.</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { import('@/services/storage/indexeddb-storage').then((m) => m.downloadStaleDraftJson(unitCode, data, currentRevision)); }} className="px-3 py-1 rounded-lg border border-[#004776]/30 bg-white hover:bg-[#f4f7fb] text-[#004776] font-semibold cursor-pointer whitespace-nowrap">Tải bản nháp cũ (.json)</button>
            <button type="button" onClick={() => { lastRemoteHandledRef.current = ''; setDirtySheets(new Set()); void reloadLatestFromServer(unitCode); }} className="px-3 py-1 rounded-lg bg-[#006cee] hover:bg-[#0058c4] text-white font-semibold cursor-pointer whitespace-nowrap">Tải lại dữ liệu máy chủ</button>
          </div>
        </div>
      )}
      {a1Flow.validationBanner && (
        <div role="alert" className="px-4 py-2.5 border-b border-[#f8b4af] bg-[#fdeceb] text-xs font-semibold text-[#b42318]">{a1Flow.validationBanner}</div>
      )}
      {isReadOnlyViewer && (
        <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50 flex items-center gap-2 text-xs font-semibold text-amber-900">
          <Eye className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{isWorkbookLocked ? 'Hồ sơ đơn vị đã khóa (Đã nộp / Đã phê duyệt) — chế độ chỉ xem' : 'Chế độ chỉ xem (Cán bộ – Giảng viên)'}</span>
        </div>
      )}

      <ExcelTableRenderer
        meta={activeMeta} rows={activeRows} dynamicOptionsMap={dynamicOptionsMap} lastSaved={lastSaved} lastSavedSheet={lastSavedSheet}
        isC1Unlocked={effectiveC1Unlocked} isReadOnly={isReadOnlyViewer} touchedCells={touchedCells}
        cellErrors={activeSheet === 'A1' ? a1Flow.cellErrors : undefined}
        a1Actions={activeSheet === 'A1' ? <A1ExcelToolbarActions canImport={!isReadOnlyViewer} onDownloadTemplate={a1Flow.handleDownloadA1Template} onExportA1={a1Flow.handleExportA1} onOpenImport={() => a1Flow.setShowA1ImportModal(true)} /> : undefined}
        onCellTouch={markCellTouched}
        onCellChange={(rowId, field, val) => { if (isReadOnlyViewer) return; const key = `${rowId}_${field}`; markCellTouched(key); clearCellError(key); markSheetDirty(activeSheet); updateCell(activeSheet, rowId, field, val); }}
        onAddRow={() => { if (isReadOnlyViewer) return; markSheetDirty(activeSheet); addRow(activeSheet); }}
        onSplitRow={(rowId) => { if (isReadOnlyViewer) return; markSheetDirty(activeSheet); splitRow(activeSheet, rowId); }}
        onDeleteRow={(rowId) => { if (isReadOnlyViewer) return false; const ok = deleteRow(activeSheet, rowId); if (ok) markSheetDirty(activeSheet); return ok; }}
        onSaveSheet={handleSave} onSaveAndNext={handleSaveAndNext} canNext={activeSheetIndex < currentSheetOrder.length - 1}
      />

      <GuidanceDrawerModal isOpen={showGuidanceModal} onClose={() => setShowGuidanceModal(false)} meta={activeMeta} />
      <C1AdminLockModal isOpen={showUnlockModal} onClose={() => setShowUnlockModal(false)} onUnlock={unlockC1} />
      <DataQualityReportModal isOpen={showQualityModal} onClose={() => setShowQualityModal(false)} report={qualityReport} onSelectSheet={handleSelectSheetSafe} />
      <A1ImportModal isOpen={a1Flow.showA1ImportModal} unitCode={unitCode} unitNameVi={currentUnit.nameVi} existingA1={data.A1 || []} isSaving={a1Flow.isImportingA1} onClose={() => a1Flow.setShowA1ImportModal(false)} onDownloadTemplate={a1Flow.handleDownloadA1Template} onConfirmImport={a1Flow.handleConfirmA1Import} />
      {a1Flow.feedbackToast && (
        <div role="status" className={`fixed bottom-5 right-5 z-[110] max-w-md rounded-xl border px-4 py-3 shadow-lg text-xs flex items-start justify-between gap-3 ${a1Flow.feedbackToast.kind === 'error' ? 'bg-[#fdeceb] border-[#f8b4af] text-[#b42318]' : a1Flow.feedbackToast.kind === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-[#eef5ff] border-[#bfe0fa] text-[#004776]'}`}>
          <div className="space-y-0.5"><div className="font-bold">{a1Flow.feedbackToast.title}</div>{a1Flow.feedbackToast.detail && <div className="opacity-90">{a1Flow.feedbackToast.detail}</div>}</div>
          <button type="button" onClick={a1Flow.dismissToast} aria-label="Đóng thông báo" className="font-bold opacity-70 hover:opacity-100 cursor-pointer shrink-0">✕</button>
        </div>
      )}
      <WorkforceStructureChartModal
        isOpen={showChartModal} onClose={() => setShowChartModal(false)}
        unitCode={unitCode} unitNameVi={currentUnit.nameVi}
        c1Rows={data.C1 || []} d2Rows={data.D2 || []} onSelectSheet={handleSelectSheetSafe}
      />
      <UnitOrgTreeModal isOpen={showOrgTreeModal} onClose={() => setShowOrgTreeModal(false)} defaultUnitCode={unitCode} workbookData={data} hideUnitSelector={hideUnitSelector} />

      <OperatorSessionModal
        isOpen={isModalOpen}
        currentSession={session}
        defaultUnitCode={unitCode}
        onSubmit={async (em, u, tit, wbId) => {
          const res = await submitSession(em, u, tit, wbId);
          if (res.restoredData) restoreWorkbookData(res.restoredData, u);
          else gridHandleUnitChange(u);
          setDirtySheets(new Set());
        }}
        onClose={closeModal}
      />

      <MobileStickyActionBar
        fixCount={qualityReport.summary.fixCount} isDirty={dirtySheets.has(activeSheet)} isSaving={syncStatus === 'saving'}
        isReadOnly={isReadOnlyViewer} canNext={activeSheetIndex < currentSheetOrder.length - 1}
        onOpenQualityModal={() => setShowQualityModal(true)} onSaveNow={handleSave} onSaveAndNext={handleSaveAndNext}
      />
    </div>
  );
}
