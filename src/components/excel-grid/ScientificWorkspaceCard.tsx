'use client';

import React from 'react';
import { ExcelSheetKey, SheetOrderMode } from './excel-grid-types';
import { HcmuteUnit } from '@/types/vtvl';
import { ValidationReport } from '@/services/validation';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { SyncStatusKind, DataSourceKind, ApiSyncError } from './useOperatorSession';
import { WorkspaceHeaderRow } from './WorkspaceHeaderRow';
import { ExcelCommandBar } from './ExcelCommandBar';
import { MobileWorkspaceHeader } from './MobileWorkspaceHeader';

interface ScientificWorkspaceCardProps {
  activeSheet: ExcelSheetKey;
  currentUnit: HcmuteUnit;
  unitCode: string;
  activeStep: number;
  activeSheetIndex: number;
  totalSheets: number;
  rowsCount: number;
  isDirty: boolean;
  qualityReport: ValidationReport;
  session: OperatorSession | null;
  revision: number;
  syncStatus: SyncStatusKind;
  dataSource?: DataSourceKind;
  apiError?: ApiSyncError | null;
  lastSyncedAt: string | null;
  orderMode: SheetOrderMode;
  canNext: boolean;
  isExporting: boolean;
  isC1Unlocked: boolean;
  onSelectSheet: (key: ExcelSheetKey) => void;
  onUnitChange: (code: string) => void;
  onSwitchSession: () => void;
  onSaveNow: () => void;
  onToggleOrderMode: (mode: SheetOrderMode) => void;
  onOpenGuidance: () => void;
  onOpenQualityModal: () => void;
  onOpenChartModal?: () => void;
  onOpenOrgTreeModal?: () => void;
  onSaveSheet: () => void;
  onSaveAndNext: () => void;
  onExportWorkbook: () => void;
  onLoadTcnsData: () => void;
  onLoadRecommendedVtvls: () => void;
  onOpenUnlockModal: () => void;
}

export function ScientificWorkspaceCard(props: ScientificWorkspaceCardProps) {
  return (
    <div className="bg-white border-b border-[#cbd5e1] flex flex-col w-full max-w-full min-w-0">
      <MobileWorkspaceHeader
        activeSheet={props.activeSheet}
        currentUnit={props.currentUnit}
        unitCode={props.unitCode}
        orderMode={props.orderMode}
        qualityReport={props.qualityReport}
        session={props.session}
        revision={props.revision}
        syncStatus={props.syncStatus}
        dataSource={props.dataSource}
        apiError={props.apiError}
        isDirty={props.isDirty}
        canNext={props.canNext}
        isExporting={props.isExporting}
        isC1Unlocked={props.isC1Unlocked}
        onSelectSheet={props.onSelectSheet}
        onUnitChange={props.onUnitChange}
        onSwitchSession={props.onSwitchSession}
        onSaveNow={props.onSaveNow}
        onToggleOrderMode={props.onToggleOrderMode}
        onOpenGuidance={props.onOpenGuidance}
        onOpenQualityModal={props.onOpenQualityModal}
        onOpenChartModal={props.onOpenChartModal}
        onOpenOrgTreeModal={props.onOpenOrgTreeModal}
        onSaveAndNext={props.onSaveAndNext}
        onExportWorkbook={props.onExportWorkbook}
        onLoadTcnsData={props.onLoadTcnsData}
        onLoadRecommendedVtvls={props.onLoadRecommendedVtvls}
        onOpenUnlockModal={props.onOpenUnlockModal}
      />

      {/* Desktop & Tablet (>= 768px): Page Header + Command Bar */}
      <div className="hidden md:flex md:flex-col w-full max-w-full min-w-0">
        <WorkspaceHeaderRow
          activeSheet={props.activeSheet}
          currentUnit={props.currentUnit}
          unitCode={props.unitCode}
          activeStep={props.activeStep}
          activeSheetIndex={props.activeSheetIndex}
          totalSheets={props.totalSheets}
          orderMode={props.orderMode}
          qualityReport={props.qualityReport}
          session={props.session}
          onSelectSheet={props.onSelectSheet}
          onUnitChange={props.onUnitChange}
          onOpenGuidance={props.onOpenGuidance}
          onOpenQualityModal={props.onOpenQualityModal}
        />

        <ExcelCommandBar
          activeSheet={props.activeSheet}
          session={props.session}
          revision={props.revision}
          syncStatus={props.syncStatus}
          dataSource={props.dataSource}
          apiError={props.apiError}
          lastSyncedAt={props.lastSyncedAt}
          isDirty={props.isDirty}
          orderMode={props.orderMode}
          canNext={props.canNext}
          isExporting={props.isExporting}
          isC1Unlocked={props.isC1Unlocked}
          onSwitchSession={props.onSwitchSession}
          onSaveNow={props.onSaveNow}
          onOpenQualityModal={props.onOpenQualityModal}
          onSaveSheet={props.onSaveSheet}
          onSaveAndNext={props.onSaveAndNext}
          onToggleOrderMode={props.onToggleOrderMode}
          onOpenOrgTreeModal={props.onOpenOrgTreeModal}
          onOpenChartModal={props.onOpenChartModal}
          onLoadTcnsData={props.onLoadTcnsData}
          onLoadRecommendedVtvls={props.onLoadRecommendedVtvls}
          onExportWorkbook={props.onExportWorkbook}
          onOpenUnlockModal={props.onOpenUnlockModal}
        />
      </div>
    </div>
  );
}
