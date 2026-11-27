'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2, RefreshCw, AlertTriangle, WifiOff,
  Save, Database, ShieldCheck, ArrowRight, HelpCircle
} from 'lucide-react';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { ExcelSheetKey, SheetOrderMode } from './excel-grid-types';
import { SyncStatusKind, DataSourceKind, ApiSyncError } from './useOperatorSession';
import { ExcelCommandToolsMenu } from './ExcelCommandToolsMenu';

interface ExcelCommandBarProps {
  unitCode?: string;
  activeSheet: ExcelSheetKey;
  session: OperatorSession | null;
  revision: number;
  fixCount: number;
  syncStatus: SyncStatusKind;
  dataSource?: DataSourceKind;
  apiError?: ApiSyncError | null;
  lastSyncedAt: string | null;
  isDirty: boolean;
  orderMode: SheetOrderMode;
  canNext: boolean;
  isExporting: boolean;
  isC1Unlocked: boolean;
  onSwitchSession: () => void;
  onSaveNow: () => void;
  onOpenGuidance: () => void;
  onSaveSheet: () => void;
  onSaveAndNext: () => void;
  onToggleOrderMode: (mode: SheetOrderMode) => void;
  onOpenOrgTreeModal?: () => void;
  onOpenChartModal?: () => void;
  onLoadTcnsData: () => void;
  onLoadRecommendedVtvls: () => void;
  onExportWorkbook: () => void;
  onOpenUnlockModal: () => void;
}

export function ExcelCommandBar({
  unitCode = 'TCNS',
  activeSheet,
  session,
  revision,
  fixCount,
  syncStatus,
  dataSource = 'sample',
  apiError,
  lastSyncedAt,
  isDirty,
  orderMode,
  canNext,
  isExporting,
  isC1Unlocked,
  onSwitchSession,
  onSaveNow,
  onOpenGuidance,
  onSaveSheet,
  onSaveAndNext,
  onToggleOrderMode,
  onOpenOrgTreeModal,
  onOpenChartModal,
  onLoadTcnsData,
  onLoadRecommendedVtvls,
  onExportWorkbook,
  onOpenUnlockModal
}: ExcelCommandBarProps) {
  const isReadOnlyViewer = session?.role === 'staff';

  const getSyncStatusContent = () => {
    if (syncStatus === 'saving') {
      return (
        <span className="inline-flex items-center gap-1 text-[#004776] font-medium whitespace-nowrap">
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-[#006cee]" />
          <span>Đang lưu…</span>
        </span>
      );
    }
    if (syncStatus === 'conflict') {
      return (
        <span className="inline-flex items-center gap-1 text-[#b42318] font-medium whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Xung đột phiên bản</span>
        </span>
      );
    }
    if (syncStatus === 'offline') {
      return (
        <span className="inline-flex items-center gap-1 text-[#b45309] font-medium whitespace-nowrap">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Ngoại tuyến</span>
        </span>
      );
    }
    if (isDirty || syncStatus === 'unsaved') {
      return (
        <span className="inline-flex items-center gap-1 text-[#b45309] font-medium whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Chưa lưu</span>
        </span>
      );
    }
    if (dataSource === 'server_synced') {
      return (
        <span className="inline-flex items-center gap-1 text-[#13653f] font-medium whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-[#008f5d]" />
          <span>Đã lưu {lastSyncedAt || 'vừa xong'}</span>
        </span>
      );
    }
    if (dataSource === 'local_draft') {
      return (
        <span className="inline-flex items-center gap-1 text-[#b45309] font-medium whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Bản nháp cục bộ</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[#476885] whitespace-nowrap">
        <Database className="w-3.5 h-3.5 shrink-0" />
        <span>Bản mẫu</span>
      </span>
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs w-full min-w-0">
      <div className="flex items-center gap-2 text-[#476885] shrink-0">
        <Link
          href={`/nghiep-vu-don-vi?tab=history&unitCode=${encodeURIComponent(unitCode)}`}
          className="font-medium text-[#004776] hover:text-[#006cee] hover:underline whitespace-nowrap tabular-nums"
          title="Xem lịch sử thay đổi và khôi phục phiên bản"
        >
          Phiên bản: <strong className="font-bold">v{revision}</strong>
        </Link>
        <span className="text-[#cbd5e1]">·</span>
        {getSyncStatusContent()}
        {session?.role === 'admin' && (
          <>
            <span className="text-[#cbd5e1]">·</span>
            <button
              type="button"
              onClick={onSwitchSession}
              className="text-[#006cee] hover:underline font-semibold cursor-pointer whitespace-nowrap"
              title="Đổi tài khoản hoặc đơn vị công tác (chỉ Admin)"
            >
              Đổi phiên
            </button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <Link
          href={`/nghiep-vu-don-vi?tab=check&unitCode=${encodeURIComponent(unitCode)}`}
          className={`h-8 px-2.5 rounded-[9px] inline-flex items-center gap-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
            fixCount > 0
              ? 'bg-[#fdeceb] hover:bg-[#fbd5d3] border border-[#f8b4af] text-[#b42318]'
              : 'bg-[#e3f5ec] hover:bg-[#ccecd9] border border-[#a3e2c3] text-[#13653f]'
          }`}
          title="Mở bộ kiểm tra chéo K_KiemTra để xem chi tiết"
        >
          {fixCount > 0 ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <ShieldCheck className="w-3.5 h-3.5 shrink-0" />}
          <span>{fixCount > 0 ? `${fixCount} mục cần xem` : 'Đạt chuẩn'}</span>
        </Link>

        {!isReadOnlyViewer && (
          <button
            type="button"
            onClick={onSaveSheet}
            disabled={syncStatus === 'saving'}
            className="h-8 px-2.5 text-xs font-semibold text-[#004776] border border-[#cbd5e1] bg-white hover:bg-[#eef5fc] rounded-[9px] inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            title="Lưu biểu hiện tại lên máy chủ HCM-UTE (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5 text-[#004776]" />
            <span>Lưu</span>
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Có thay đổi chưa lưu" />}
          </button>
        )}

        <button
          type="button"
          onClick={onSaveAndNext}
          disabled={!canNext}
          className="h-8 px-3 text-xs font-bold bg-[#eef5ff] hover:bg-[#dcebff] text-[#006cee] border border-[#bfdbfe] rounded-[9px] inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          title={isReadOnlyViewer ? 'Chuyển sang biểu nghiệp vụ tiếp theo' : 'Lưu biểu này và tự động chuyển sang biểu tiếp theo'}
        >
          <span>{isReadOnlyViewer ? 'Sang tiếp' : 'Lưu & tiếp'}</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>

        <ExcelCommandToolsMenu
          unitCode={unitCode}
          activeSheet={activeSheet}
          orderMode={orderMode}
          isExporting={isExporting}
          isC1Unlocked={isC1Unlocked}
          onToggleOrderMode={onToggleOrderMode}
          onOpenOrgTreeModal={onOpenOrgTreeModal}
          onOpenChartModal={onOpenChartModal}
          onLoadTcnsData={onLoadTcnsData}
          onLoadRecommendedVtvls={onLoadRecommendedVtvls}
          onExportWorkbook={onExportWorkbook}
          onOpenUnlockModal={onOpenUnlockModal}
        />

        <button
          type="button"
          onClick={onOpenGuidance}
          aria-label="Hướng dẫn biểu mẫu"
          title="Xem căn cứ pháp lý và hướng dẫn biểu này"
          className="h-8 px-2.5 rounded-[9px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5 text-[#006cee] shrink-0" />
          <span className="hidden 2xl:inline">Hướng dẫn</span>
        </button>
      </div>

      {apiError && (
        <div className="basis-full bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-xs border border-red-200 flex items-center justify-between">
          <span>Lỗi đồng bộ máy chủ: {apiError.message || 'Không thể kết nối'}</span>
        </div>
      )}
    </div>
  );
}
