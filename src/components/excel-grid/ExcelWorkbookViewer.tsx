'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Eye } from 'lucide-react';
import { useExcelGridState } from './excel-grid-state';
import { EXCEL_SHEET_METAS } from './excel-sheet-metas';
import { ExcelSheetTabs } from './ExcelSheetTabs';
import { ExcelTableRenderer } from './ExcelTableRenderer';
import { ScientificWorkspaceCard } from './ScientificWorkspaceCard';
import { GuidanceDrawerModal } from './GuidanceDrawerModal';
import { ExcelSheetKey } from './excel-grid-types';
import { C1AdminStatusBanner, C1AdminLockModal } from './C1AdminLockModal';
import { DataQualityReportModal } from './DataQualityReportModal';
import { OperatorSessionModal } from './OperatorSessionModal';
import { WorkforceStructureChartModal } from './WorkforceStructureChartModal';
import { UnitOrgTreeModal } from '@/components/admin/UnitOrgTreeModal';
import { useOperatorSession } from './useOperatorSession';
import { validateWorkbookData } from '@/services/validation';

const getStepFromSheet = (sheet: ExcelSheetKey): number => {
  switch (sheet) {
    case 'A1': return 1;
    case 'A2':
    case 'DM_SP': return 2;
    case 'B1': return 3;
    case 'B2_CT':
    case 'B2': return 4;
    case 'C1':
    case 'C2': return 5;
    case 'C3': return 6;
    case 'D1':
    case 'D2':
    case 'DU_BAO': return 7;
    case 'K':
    case 'T':
    case 'S': return 8;
    default: return 1;
  }
};

interface ExcelWorkbookViewerProps {
  initialUnitCode?: string;
}

export function ExcelWorkbookViewer({ initialUnitCode = 'TCNS' }: ExcelWorkbookViewerProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showGuidanceModal, setShowGuidanceModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showOrgTreeModal, setShowOrgTreeModal] = useState(false);
  const [dirtySheets, setDirtySheets] = useState<Set<ExcelSheetKey>>(new Set());

  const markSheetDirty = (sheetKey: ExcelSheetKey) => {
    setDirtySheets((prev) => (prev.has(sheetKey) ? prev : new Set(prev).add(sheetKey)));
  };

  const clearSheetDirty = (sheetKey: ExcelSheetKey) => {
    setDirtySheets((prev) => {
      if (!prev.has(sheetKey)) return prev;
      const next = new Set(prev);
      next.delete(sheetKey);
      return next;
    });
  };

  const {
    session, isModalOpen, touchedCells,
    currentRevision, syncStatus, dataSource, apiError, lastSyncedAt,
    markCellTouched, submitSession, updateSessionUnit, switchSession,
    closeModal, persistDataForSession, retrySync
  } = useOperatorSession();

  const isAdmin = session?.role === 'admin';

  const {
    unitCode, currentUnit, orderMode, setOrderMode, currentSheetOrder,
    activeSheet, activeSheetIndex, data, lastSaved, lastSavedSheet,
    isExporting, dynamicOptionsMap, isC1Unlocked, unlockC1, lockC1,
    handleUnitChange: gridHandleUnitChange, handleLoadTcnsData, restoreWorkbookData,
    loadRecommendedVtvls, setActiveSheet,
    updateCell, addRow, splitRow, deleteRow, saveSheetData,
    exportFullWorkbook, goToNextSheet, goToPrevSheet
  } = useExcelGridState(session?.unitCode || initialUnitCode, isAdmin);

  useEffect(() => {
    if (session?.unitCode && session.unitCode !== unitCode) {
      gridHandleUnitChange(session.unitCode);
    }
  }, [session?.unitCode, unitCode, gridHandleUnitChange]);

  const activeMeta = EXCEL_SHEET_METAS[activeSheet];
  const activeRows = data[activeSheet] || [];
  const isReadOnlyViewer = session?.role === 'viewer';
  const effectiveC1Unlocked = isC1Unlocked || session?.role === 'unit_leader';

  const handleSave = useCallback(() => {
    if (isReadOnlyViewer) return;
    saveSheetData(activeSheet);
    persistDataForSession(data);
    clearSheetDirty(activeSheet);
  }, [isReadOnlyViewer, activeSheet, saveSheetData, persistDataForSession, data]);

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
    if (dirtySheets.has(activeSheet)) {
      handleSave();
    }
    setActiveSheet(targetKey);
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
        onUnitChange={(u) => { gridHandleUnitChange(u); updateSessionUnit(u); setDirtySheets(new Set()); }}
        onSwitchSession={switchSession}
        onSaveNow={() => {
          if (isReadOnlyViewer) return;
          handleSave();
          persistDataForSession(data, true);
        }}
        onToggleOrderMode={setOrderMode}
        onOpenGuidance={() => setShowGuidanceModal(true)}
        onOpenQualityModal={() => setShowQualityModal(true)}
        onOpenChartModal={() => setShowChartModal(true)}
        onOpenOrgTreeModal={() => setShowOrgTreeModal(true)}
        onSaveSheet={handleSave}
        onSaveAndNext={handleSaveAndNext}
        onExportWorkbook={exportFullWorkbook}
        onLoadTcnsData={handleLoadTcnsData}
        onLoadRecommendedVtvls={loadRecommendedVtvls}
        onOpenUnlockModal={() => setShowUnlockModal(true)}
      />

      {/* 2. DẢI TAB 15 BIỂU CUỘN NGANG (UNDERLINE TABS) */}
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
          <span>Chế độ Người xem / Tra cứu: Tài khoản của bạn chỉ có quyền xem và xuất báo cáo, không thể chỉnh sửa ô dữ liệu.</span>
        </div>
      )}

      <ExcelTableRenderer
        meta={activeMeta}
        rows={activeRows}
        dynamicOptionsMap={dynamicOptionsMap}
        lastSaved={lastSaved}
        lastSavedSheet={lastSavedSheet}
        isC1Unlocked={!isReadOnlyViewer}
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
          markSheetDirty(activeSheet);
          return deleteRow(activeSheet, rowId);
        }}
        onSaveSheet={handleSave}
        onSaveAndNext={handleSaveAndNext}
        canNext={activeSheetIndex < currentSheetOrder.length - 1}
      />

      <GuidanceDrawerModal
        isOpen={showGuidanceModal}
        onClose={() => setShowGuidanceModal(false)}
        meta={activeMeta}
      />

      <C1AdminLockModal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        onUnlock={unlockC1}
      />

      <DataQualityReportModal
        isOpen={showQualityModal}
        onClose={() => setShowQualityModal(false)}
        report={qualityReport}
        onSelectSheet={handleSelectSheetSafe}
      />

      <WorkforceStructureChartModal
        isOpen={showChartModal}
        onClose={() => setShowChartModal(false)}
        unitCode={unitCode}
        unitNameVi={currentUnit.nameVi}
        c1Rows={data.C1 || []}
        d2Rows={data.D2 || []}
        onSelectSheet={handleSelectSheetSafe}
      />

      <UnitOrgTreeModal
        isOpen={showOrgTreeModal}
        onClose={() => setShowOrgTreeModal(false)}
        defaultUnitCode={unitCode}
        workbookData={data}
      />

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
    </div>
  );
}
