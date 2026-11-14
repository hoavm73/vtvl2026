'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ExcelSheetKey, ExcelSheetMeta } from './excel-grid-types';
import { HcmuteUnit } from '@/types/vtvl';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { ValidationReport } from '@/services/validation/vtvl-validation-types';
import { getFlatHcmuteUnitOptions } from '@/configs/hcmute-units';
import {
  Download, Building2, ShieldCheck, CheckCircle2, RefreshCw,
  UserCheck, Briefcase, ArrowLeftRight, MoreHorizontal, ArrowRight, Save
} from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';

interface ExcelWorkbookToolbarProps {
  session: OperatorSession | null;
  unitCode: string;
  currentUnit: HcmuteUnit;
  isRestoredSession: boolean;
  activeSheet: ExcelSheetKey;
  activeMeta: ExcelSheetMeta;
  isC1Unlocked: boolean;
  isExporting: boolean;
  qualityReport: ValidationReport;
  isDirty?: boolean;
  lastSaved?: string;
  canNext?: boolean;
  onSwitchSession: () => void;
  onUnitChange: (code: string) => void;
  onOpenUnlockModal: () => void;
  onLoadRecommendedVtvls: () => void;
  onLoadFullPl1Catalog: () => void;
  onLoadTcnsData: () => void;
  onSaveSheet: () => void;
  onSaveAndNext?: () => void;
  onSelectSheet: (key: ExcelSheetKey) => void;
  onShowQualityModal: () => void;
  onExportWorkbook: () => void;
}

export function ExcelWorkbookToolbar({
  session, unitCode, currentUnit, isRestoredSession, activeSheet,
  activeMeta, isC1Unlocked, isExporting, qualityReport, isDirty,
  lastSaved, canNext = true, onSwitchSession, onUnitChange, onOpenUnlockModal,
  onLoadRecommendedVtvls, onLoadFullPl1Catalog, onLoadTcnsData, onSaveSheet,
  onSaveAndNext, onSelectSheet, onShowQualityModal, onExportWorkbook
}: ExcelWorkbookToolbarProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAdmin = session?.role === 'admin';
  const canChangeUnit = !session || isAdmin;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 w-full">
      {/* Phía trái: Hộp chọn đơn vị + Cán bộ thực hiện */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Unit Selector */}
        <div className="flex items-center gap-1.5 bg-[#f1f5f9] px-2.5 py-1 rounded-xl border border-[#cbd5e1] min-w-[240px]">
          <span className="text-xs font-bold text-[#004776] shrink-0">Đơn vị:</span>
          {canChangeUnit ? (
            <ShadcnSelect
              value={unitCode}
              onValueChange={onUnitChange}
              options={getFlatHcmuteUnitOptions()}
              searchable={true}
              size="sm"
            />
          ) : (
            <span className="text-xs font-bold text-[#004776] truncate py-1" title="Đơn vị cố định theo tài khoản">
              [{unitCode}] {currentUnit.nameVi} (Cố định)
            </span>
          )}
        </div>

        {/* Khối Cán bộ thực hiện */}
        {session ? (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-sky-50 border border-[#004776]/25 shadow-2xs text-xs shrink-0">
            <span className="relative flex h-2 w-2 shrink-0" title="Đang đồng bộ trực tuyến">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>

            <span className="font-bold text-[#004776] tracking-tight">{session.email}</span>
            <span className="text-[#cbd5e1]">|</span>
            <span className="font-semibold text-[#004776]/85">{session.title}</span>

            {isAdmin && (
              <button
                type="button"
                onClick={onSwitchSession}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold text-white bg-[#004776] hover:bg-[#00385c] active:scale-95 transition-all shadow-2xs cursor-pointer shrink-0 ml-0.5"
                title="Đổi tài khoản người thực hiện (Admin)"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Đổi</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#476885] shrink-0 font-medium">
            <span>Chưa đăng nhập (Xem mẫu)</span>
          </div>
        )}
      </div>

      {/* Phía phải: Hệ thống nút phân cấp rõ ràng */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Nút kiểm tra dữ liệu */}
        <button
          type="button"
          onClick={onShowQualityModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#004776] bg-white hover:bg-sky-50 border border-[#004776]/30 rounded-xl cursor-pointer transition-colors shadow-2xs"
          title="Kiểm tra chất lượng và rà soát chéo các biểu"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#004776]" />
          <span>Kiểm tra dữ liệu</span>
          {qualityReport.summary.fixCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-bold">
              {qualityReport.summary.fixCount}
            </span>
          )}
        </button>

        {/* Nút phụ: Lưu biểu */}
        <button
          type="button"
          onClick={onSaveSheet}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#004776] bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xl cursor-pointer transition-colors shadow-2xs"
          title="Lưu lại toàn bộ dữ liệu biểu hiện tại (Ctrl + S)"
        >
          <Save className="w-3.5 h-3.5 text-[#004776]" />
          <span>Lưu biểu</span>
        </button>

        {/* Nút chính: Lưu & sang biểu tiếp theo */}
        {onSaveAndNext && canNext && (
          <button
            type="button"
            onClick={onSaveAndNext}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#004776] hover:bg-[#00385c] active:scale-95 rounded-xl cursor-pointer shadow-2xs transition-all"
            title="Lưu dữ liệu hiện tại và tự động chuyển sang sheet tiếp theo"
          >
            <span>Lưu &amp; sang biểu tiếp</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Menu "Thêm thao tác ⋯" */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#004776] cursor-pointer shadow-2xs"
            title="Thao tác nâng cao khác"
            aria-label="Thao tác nâng cao khác"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl shadow-lg border border-[#cbd5e1] py-1.5 z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
              <button
                type="button"
                onClick={() => { setShowMoreMenu(false); onLoadTcnsData(); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-[#004776] hover:bg-sky-50 flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#005fa3]" />
                <span>Nạp mẫu chuẩn TCNS</span>
              </button>

              {activeSheet === 'C1' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); if (!isC1Unlocked) onOpenUnlockModal(); else onLoadRecommendedVtvls(); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-[#004776] hover:bg-sky-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#004776]" />
                    <span>Nạp VTVL chuẩn {currentUnit.code}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowMoreMenu(false); if (!isC1Unlocked) onOpenUnlockModal(); else onLoadFullPl1Catalog(); }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-[#004776] hover:bg-sky-50 flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#005fa3]" />
                    <span>Nạp trọn bộ 56 VTVL (PL1)</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => { setShowMoreMenu(false); onSelectSheet('K'); }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-[#004776] hover:bg-sky-50 flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mở bảng Kiểm tra chéo K</span>
              </button>

              <div className="border-t border-[#f1f5f9] my-1" />

              <button
                type="button"
                onClick={() => { setShowMoreMenu(false); onExportWorkbook(); }}
                disabled={isExporting}
                className="w-full text-left px-3 py-2 text-xs font-bold text-[#004776] hover:bg-sky-50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>{isExporting ? 'Đang xuất tệp...' : 'Xuất tệp Excel (.xlsx)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
