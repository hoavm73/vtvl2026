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
import { validateWorkbookData } from '@/services/validation';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { syncContextQueryParams } from '@/services/context/workbook-context';

interface ExcelWorkbookViewerProps {
  initialUnitCode?: string;
  requestedUnitCode?: string;
  initialSheet?: ExcelSheetKey;
}

export function ExcelWorkbookViewer({ initialUnitCode = 'TCNS', requestedUnitCode, initialSheet }: ExcelWorkbookViewerProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showGuidanceModal, setShowGuidanceModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showOrgTreeModal, setShowOrgTreeModal] = useState(false);
  const [dirtySheets, setDirtySheets] = useState<Set<ExcelSheetKey>>(new Set());

  const markSheetDirty = (sheetKey: ExcelSheetKey) => setDirtySheets((p) => (p.has(sheetKey) ? p : new Set(p).add(sheetKey)));
  const clearSheetDirty = (sheetKey: ExcelSheetKey) => setDirtySheets((p) => { if (!p.has(sheetKey)) return p; const n = new Set(p); n.delete(sheetKey); return n; });

  const {
    session, isModalOpen, touchedCells,
    currentRevision, syncStatus, dataSource, remoteWorkbook, apiError, lastSyncedAt,
    markCellTouched, submitSession, updateSessionUnit, switchSession,
    closeModal, persistDataForSession, retrySync
  } = useOperatorSession();

  const lastRemoteHandledRef = useRef<string>('');
  const lastAutoSyncedSnapshotRef = useRef<string>('');
  const adminManualUnitRef = useRef<string | null>(null);
  const didApplyRoleSheetRef = useRef<boolean>(false);

  const isAdmin = session?.role === 'admin';

  const {
    unitCode, currentUnit, orderMode, setOrderMode, currentSheetOrder,
    activeSheet, activeSheetIndex, data, lastSaved, lastSavedSheet,
    isExporting, dynamicOptionsMap, isC1Unlocked, unlockC1,
    handleUnitChange: gridHandleUnitChange, handleLoadTcnsData, restoreWorkbookData,
    loadRecommendedVtvls, setActiveSheet,
    updateCell, addRow, splitRow, deleteRow, saveSheetData,
    exportFullWorkbook, goToNextSheet, goToPrevSheet
  } = useExcelGridState(session?.unitCode || requestedUnitCode || initialUnitCode, isAdmin, initialSheet);

  useEffect(() => {
    if (!session) return;
    if (session.role === 'admin' && requestedUnitCode && !adminManualUnitRef.current) {
      const reqCode = findHcmuteUnit(requestedUnitCode).code;
      const reqUpper = reqCode.toUpperCase();
      adminManualUnitRef.current = reqUpper;
      if (unitCode.toUpperCase() !== reqUpper) gridHandleUnitChange(reqCode);
      updateSessionUnit(reqCode);
      return;
    }
    if (!adminManualUnitRef.current && session.unitCode && session.unitCode !== unitCode) {
      gridHandleUnitChange(session.unitCode);
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
  const isReadOnlyViewer = session?.role === 'staff';
  const effectiveC1Unlocked = isC1Unlocked || session?.role === 'admin' || session?.role === 'unit_leader';

  const handleSave = useCallback(() => {
    if (isReadOnlyViewer) return;
    const synced = saveSheetData(activeSheet);
    lastAutoSyncedSnapshotRef.current = `${unitCode}:${JSON.stringify(synced)}`;
    persistDataForSession(synced, true, unitCode);
    clearSheetDirty(activeSheet);
  }, [isReadOnlyViewer, activeSheet, saveSheetData, persistDataForSession, unitCode]);

  useEffect(() => {
    if (isReadOnlyViewer || dirtySheets.size === 0) return;
    const snapKey = `${unitCode}:${JSON.stringify(data)}`;
    if (snapKey === lastAutoSyncedSnapshotRef.current) return;
    lastAutoSyncedSnapshotRef.current = snapKey;
    persistDataForSession(data, false, unitCode);
  }, [dirtySheets, data, unitCode, isReadOnlyViewer, persistDataForSession]);

  useEffect(() => {
    if (!remoteWorkbook || remoteWorkbook.unitCode.toUpperCase() !== unitCode.toUpperCase() || dirtySheets.size > 0) return;
    const key = `${unitCode}:${remoteWorkbook.revision}`;
    if (lastRemoteHandledRef.current === key) return;
    lastRemoteHandledRef.current = key;
    const gridKey = `hcmute_vtvl_grid_${unitCode}`;
    const revKey = `hcmute_vtvl_grid_rev_${unitCode}`;
    let hasLocalGrid = false;
    let savedRev = 0;
    try {
      hasLocalGrid = Boolean(typeof window !== 'undefined' && localStorage.getItem(gridKey));
      savedRev = typeof window !== 'undefined' ? Number(localStorage.getItem(revKey) || 0) : 0;
    } catch { /* ignore */ }
    const effectiveLocalRev = hasLocalGrid ? Math.max(savedRev, 1) : 0;
    const serverTicketDiff = (data.A2 || []).filter((r) => r.sourceTicketId).length !== (remoteWorkbook.data?.A2 || []).filter((r) => r.sourceTicketId).length;
    const shouldPullServer = isReadOnlyViewer || !hasLocalGrid || remoteWorkbook.revision > effectiveLocalRev || serverTicketDiff;
    const localDiffersOnInit = (data.C1 || []).length !== (remoteWorkbook.data?.C1 || []).length || (data.A1 || []).length !== (remoteWorkbook.data?.A1 || []).length;

    if (shouldPullServer) {
      lastAutoSyncedSnapshotRef.current = `${unitCode}:${JSON.stringify(remoteWorkbook.data)}`;
      restoreWorkbookData(remoteWorkbook.data, unitCode);
      try {
        localStorage.setItem(gridKey, JSON.stringify(remoteWorkbook.data));
        localStorage.setItem(revKey, String(remoteWorkbook.revision));
      } catch { /* ignore */ }
      setDirtySheets(new Set());
    } else if (!isReadOnlyViewer && savedRev === 0 && localDiffersOnInit) {
      lastAutoSyncedSnapshotRef.current = `${unitCode}:${JSON.stringify(data)}`;
      persistDataForSession(data, true, unitCode);
    }
  }, [remoteWorkbook, unitCode, dirtySheets.size, isReadOnlyViewer, data, restoreWorkbookData, persistDataForSession]);

  const handleSaveAndNext = useCallback(() => {
    handleSave();
    goToNextSheet();
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
    if (dirtySheets.has(activeSheet)) handleSave();
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
      {/* 1. HEADER (Page Header & Command Bar thống nhất theo Mockup) */}
      <ScientificWorkspaceCard
        activeSheet={activeSheet}
        currentUnit={currentUnit}
        unitCode={unitCode}
        activeStep={getStepFromSheet(activeSheet)}
        activeSheetIndex={activeSheetIndex}
        totalSheets={currentSheetOrder.length}
        rowsCount={activeRows.length}
        isDirty={dirtySheets.has(activeSheet)}
        qualityReport={qualityReport}
        session={session}
        revision={currentRevision}
        syncStatus={syncStatus}
        dataSource={dataSource}
        apiError={apiError}
        lastSyncedAt={lastSyncedAt}
        orderMode={orderMode}
        canNext={activeSheetIndex < currentSheetOrder.length - 1}
        isExporting={isExporting}
        isC1Unlocked={effectiveC1Unlocked}
        onSelectSheet={handleSelectSheetSafe}
        onUnitChange={(u) => { adminManualUnitRef.current = u.toUpperCase(); gridHandleUnitChange(u); updateSessionUnit(u); setDirtySheets(new Set()); if (typeof window !== 'undefined' && window.location.pathname === '/bang-tinh') syncContextQueryParams({ unit: u.toUpperCase(), sheet: activeSheet }, 'replace'); }}
        onSwitchSession={switchSession}
        onSaveNow={handleSave}
        onToggleOrderMode={setOrderMode}
        onOpenGuidance={() => setShowGuidanceModal(true)}
        onOpenQualityModal={() => setShowQualityModal(true)}
        onOpenChartModal={() => setShowChartModal(true)}
        onOpenOrgTreeModal={() => setShowOrgTreeModal(true)}
        onSaveSheet={handleSave}
        onSaveAndNext={handleSaveAndNext}
        onExportWorkbook={exportFullWorkbook}
        onLoadTcnsData={() => { if (!isReadOnlyViewer) { markSheetDirty('C1'); handleLoadTcnsData(); } }}
        onLoadRecommendedVtvls={() => { if (!isReadOnlyViewer) { markSheetDirty('C1'); loadRecommendedVtvls(); } }}
        onOpenUnlockModal={() => setShowUnlockModal(true)}
      />

      {/* 2. DẢI TAB 10 BIỂU CUỘN NGANG (UNDERLINE TABS) */}
      <ExcelSheetTabs
        activeSheet={activeSheet}
        sheetOrder={currentSheetOrder}
        orderMode={orderMode}
        dirtySheets={dirtySheets}
        onSelectSheet={handleSelectSheetSafe}
        onPrev={goToPrevSheet}
        onNext={goToNextSheet}
        canPrev={activeSheetIndex > 0}
        canNext={activeSheetIndex < currentSheetOrder.length - 1}
      />

      {/* 4. BANNER CHẾ ĐỘ CHỈ XEM / BANNER C1 / LƯỚI BẢNG DỮ LIỆU CHÍNH */}
      {isReadOnlyViewer && (
        <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50 flex items-center gap-2 text-xs font-semibold text-amber-900">
          <Eye className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Chế độ chỉ xem (Cán bộ – Giảng viên)</span>
        </div>
      )}

      <ExcelTableRenderer
        meta={activeMeta}
        rows={activeRows}
        dynamicOptionsMap={dynamicOptionsMap}
        lastSaved={lastSaved}
        lastSavedSheet={lastSavedSheet}
        isC1Unlocked={effectiveC1Unlocked}
        isReadOnly={isReadOnlyViewer}
        touchedCells={touchedCells}
        onCellTouch={markCellTouched}
        onCellChange={(rowId, field, val) => {
          if (isReadOnlyViewer) return;
          markCellTouched(`${rowId}_${field}`);
          markSheetDirty(activeSheet);
          updateCell(activeSheet, rowId, field, val);
        }}
        onAddRow={() => {
          if (isReadOnlyViewer) return;
          markSheetDirty(activeSheet);
          addRow(activeSheet);
        }}
        onSplitRow={(rowId) => {
          if (isReadOnlyViewer) return;
          markSheetDirty(activeSheet);
          splitRow(activeSheet, rowId);
        }}
        onDeleteRow={(rowId) => {
          if (isReadOnlyViewer) return false;
          const ok = deleteRow(activeSheet, rowId);
          if (ok) markSheetDirty(activeSheet);
          return ok;
        }}
        onSaveSheet={handleSave}
        onSaveAndNext={handleSaveAndNext}
        canNext={activeSheetIndex < currentSheetOrder.length - 1}
      />

      <GuidanceDrawerModal isOpen={showGuidanceModal} onClose={() => setShowGuidanceModal(false)} meta={activeMeta} />
      <C1AdminLockModal isOpen={showUnlockModal} onClose={() => setShowUnlockModal(false)} onUnlock={unlockC1} />
      <DataQualityReportModal isOpen={showQualityModal} onClose={() => setShowQualityModal(false)} report={qualityReport} onSelectSheet={handleSelectSheetSafe} />
      <WorkforceStructureChartModal
        isOpen={showChartModal} onClose={() => setShowChartModal(false)}
        unitCode={unitCode} unitNameVi={currentUnit.nameVi}
        c1Rows={data.C1 || []} d2Rows={data.D2 || []} onSelectSheet={handleSelectSheetSafe}
      />
      <UnitOrgTreeModal isOpen={showOrgTreeModal} onClose={() => setShowOrgTreeModal(false)} defaultUnitCode={unitCode} workbookData={data} />

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
