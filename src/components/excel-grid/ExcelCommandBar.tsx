'use client';

import React from 'react';
import Link from 'next/link';
import {
  User, CheckCircle2, RefreshCw, AlertTriangle, WifiOff,
  Save, Database, ShieldCheck, ArrowRight
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
  onOpenQualityModal: () => void;
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
  onOpenQualityModal,
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
        <span className="inline-flex items-center gap-1.5 text-[#004776] font-medium">
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0 text-[#004776]" />
          <span>Đang lưu máy chủ…</span>
        </span>
      );
    }
    if (syncStatus === 'conflict') {
      return (
        <span className="inline-flex items-center gap-1.5 text-red-600 font-medium">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Xung đột phiên bản — thử lại</span>
        </span>
      );
    }
    if (syncStatus === 'offline') {
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Ngoại tuyến, đang giữ bản nháp trên máy</span>
        </span>
      );
    }
    if (dataSource === 'server_synced') {
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          <span>Đã lưu máy chủ lúc {lastSyncedAt || 'vừa xong'}</span>
        </span>
      );
    }
    if (dataSource === 'local_draft' || isDirty) {
      return (
        <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Có thay đổi chưa lưu máy chủ</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[#476885]">
        <Database className="w-3.5 h-3.5 shrink-0" />
        <span>Dữ liệu mẫu</span>
      </span>
    );
  };

  return (
    <div className="min-h-[46px] px-3 sm:px-4 py-2 bg-[#f8fbff] border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2.5 text-[13px]">
      {/* KHỐI TRÁI: Phiên cán bộ · Phiên bản & trạng thái máy chủ · Nút Lưu máy chủ */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-[#476885] min-w-0 basis-full lg:basis-auto">
        {session ? (
          <div className="inline-flex items-center gap-1.5 font-medium text-[#004776]">
            <User className="w-4 h-4 text-[#004776] shrink-0" />
            <span className="truncate max-w-[160px] sm:max-w-[210px]" title={session.email}>{session.email}</span>
            <span className="text-[#cbd5e1]">·</span>
            <span className="text-[#476885] hidden md:inline truncate max-w-[180px]">{session.title || 'Cán bộ'}</span>
            {session.role === 'admin' && (
              <>
                <span className="text-[#cbd5e1] hidden md:inline">·</span>
                <button
                  type="button"
                  onClick={onSwitchSession}
                  className="text-[#004776] hover:underline font-bold cursor-pointer shrink-0"
                  title="Đổi tài khoản hoặc đơn vị công tác (chỉ Admin)"
                >
                  Đổi phiên
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 font-medium text-[#476885]">
            <User className="w-4 h-4 text-[#476885] shrink-0" />
            <span>Chưa đăng nhập (Xem mẫu)</span>
          </div>
        )}

        <span className="text-[#cbd5e1] hidden sm:inline">·</span>

        <Link
          href={`/nghiep-vu-don-vi?tab=history&unitCode=${encodeURIComponent(unitCode)}`}
          className="font-medium text-[#004776] hover:text-[#006cee] hover:underline shrink-0"
          title="Xem lịch sử thay đổi và khôi phục phiên bản"
        >
          Phiên bản: <strong className="font-semibold">v{revision}</strong>
        </Link>

        <span className="text-[#cbd5e1] hidden sm:inline">·</span>

        <div className="truncate max-w-[260px] sm:max-w-none">
          {getSyncStatusContent()}
        </div>
      </div>

      {/* KHỐI PHẢI: Thao tác chuẩn (Kiểm tra · Lưu · Lưu & tiếp · Công cụ) */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-full lg:w-auto justify-between lg:justify-end pt-1 lg:pt-0 border-t lg:border-t-0 border-[#e2e8f0]/70">
        <Link
          href={`/nghiep-vu-don-vi?tab=check&unitCode=${encodeURIComponent(unitCode)}`}
          className="h-9 px-3 text-[13px] font-semibold text-[#004776] hover:bg-[#eef5fc] rounded-xl inline-flex items-center gap-1.5 transition-colors"
          title="Mở trang kiểm tra chéo K_KiemTra và gửi hồ sơ TCNS"
        >
          <ShieldCheck className="w-4 h-4 text-[#004776]" />
          <span className="sm:hidden">Kiểm tra</span>
          <span className="hidden sm:inline">Kiểm tra dữ liệu</span>
        </Link>

        {!isReadOnlyViewer && (
          <button
            type="button"
            onClick={() => { onSaveSheet(); onSaveNow(); }}
            disabled={syncStatus === 'saving'}
            className="hidden sm:inline-flex relative h-9 px-3 text-[13px] font-semibold text-[#004776] border border-[#cbd5e1] bg-white hover:bg-[#eef5fc] rounded-xl items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
            title="Lưu biểu hiện tại và đồng bộ lên máy chủ HCM-UTE"
          >
            <Save className="w-4 h-4 text-[#004776]" />
            <span>Lưu</span>
            {isDirty && (
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Có thay đổi chưa lưu" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onSaveAndNext}
          disabled={!canNext}
          className="h-9 px-3.5 text-[13px] font-bold text-white bg-[#004776] hover:bg-[#00365c] rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          title={isReadOnlyViewer ? 'Chuyển sang biểu nghiệp vụ tiếp theo' : 'Lưu biểu này và tự động chuyển sang biểu nghiệp vụ tiếp theo'}
        >
          <span className="sm:hidden">{isReadOnlyViewer ? 'Sang tiếp' : 'Lưu & tiếp'}</span>
          <span className="hidden sm:inline">{isReadOnlyViewer ? 'Sang biểu tiếp' : 'Lưu & tiếp'}</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
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
      </div>

      {apiError && (
        <div className="w-full bg-red-50 text-red-700 px-3 py-1.5 rounded-lg text-[13px] border border-red-200 flex items-center justify-between">
          <span>Lỗi đồng bộ máy chủ: {apiError.message || 'Không thể kết nối'}</span>
        </div>
      )}
    </div>
  );
}
