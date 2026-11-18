'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronDown, Check, MoreHorizontal, Save, ShieldCheck, AlertTriangle,
  HelpCircle, ArrowUpDown, Download, RefreshCw, Lightbulb, Lock, Unlock,
  Network, BarChart3, ArrowRight, Building2, User, Timer, History
} from 'lucide-react';
import { ExcelSheetKey, SheetOrderMode, EXCEL_NATURAL_SHEET_ORDER, WORKFLOW_SHEET_ORDER, ADMIN_ONLY_SHEETS } from './excel-grid-types';
import { EXCEL_SHEET_METAS } from './excel-sheet-metas';
import { HcmuteUnit } from '@/types/vtvl';
import { HCMUTE_UNITS, getActiveHcmuteUnits } from '@/configs/hcmute-units';
import { ValidationReport } from '@/services/validation';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { SyncStatusKind, DataSourceKind, ApiSyncError } from './useOperatorSession';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/Popover';

interface MobileWorkspaceHeaderProps {
  activeSheet: ExcelSheetKey;
  currentUnit: HcmuteUnit;
  unitCode: string;
  orderMode: SheetOrderMode;
  qualityReport: ValidationReport;
  session: OperatorSession | null;
  revision: number;
  syncStatus: SyncStatusKind;
  dataSource?: DataSourceKind;
  apiError?: ApiSyncError | null;
  isDirty: boolean;
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
  onSaveAndNext: () => void;
  onExportWorkbook: () => void;
  onLoadTcnsData: () => void;
  onLoadRecommendedVtvls: () => void;
  onOpenUnlockModal: () => void;
}

/** Header điện thoại thu gọn dưới 768px: chỉ giữ trực tiếp Tên biểu, Trạng thái lưu, Nút Lưu và Menu Thêm. */
export function MobileWorkspaceHeader(props: MobileWorkspaceHeaderProps) {
  const [unitSearch, setUnitSearch] = useState('');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [units, setUnits] = useState<HcmuteUnit[]>(HCMUTE_UNITS);

  useEffect(() => {
    const onUpdate = () => setUnits(getActiveHcmuteUnits());
    onUpdate();
    window.addEventListener('vtvl-units-updated', onUpdate);
    return () => window.removeEventListener('vtvl-units-updated', onUpdate);
  }, []);

  const isAdmin = props.session?.role === 'admin';
  const isReadOnly = props.session?.role === 'staff';
  const canChangeUnit = !props.session || isAdmin;
  const activeMeta = EXCEL_SHEET_METAS[props.activeSheet];
  const fixCount = props.qualityReport.summary.fixCount;
  const rawOrder = props.orderMode === 'technical' ? WORKFLOW_SHEET_ORDER : EXCEL_NATURAL_SHEET_ORDER;
  const sheetOrder = isAdmin ? rawOrder : rawOrder.filter((k) => !ADMIN_ONLY_SHEETS.has(k));
  const filteredUnits = units.filter((u) => u.nameVi.toLowerCase().includes(unitSearch.toLowerCase()) || u.code.toLowerCase().includes(unitSearch.toLowerCase()));

  const statusMeta = props.syncStatus === 'saving'
    ? { label: 'Đang lưu…', cls: 'bg-[#eef5ff] text-[#004776]', dot: 'bg-[#006cee] animate-pulse' }
    : props.syncStatus === 'conflict'
      ? { label: 'Xung đột', cls: 'bg-red-50 text-red-700', dot: 'bg-red-600' }
      : props.syncStatus === 'offline'
        ? { label: 'Ngoại tuyến', cls: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' }
        : props.isDirty
          ? { label: 'Chưa lưu', cls: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500 animate-pulse' }
          : props.dataSource === 'server_synced'
            ? { label: 'Đã lưu', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' }
            : { label: 'Bản mẫu', cls: 'bg-[#f1f5f9] text-[#476885]', dot: 'bg-[#64748b]' };

  return (
    <div className="md:hidden w-full max-w-full min-w-0 bg-white border-b border-[#d8e3ef]">
      {/* Hàng 1 trên mobile: Tên biểu đầy đủ + Trạng thái lưu + Nút Lưu & Menu Thêm */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 min-h-[52px] min-w-0">
        {/* 1. Tên biểu */}
        <Popover className="min-w-[170px] flex-1">
          <PopoverTrigger className="w-full min-w-0" ariaLabel={`Chọn biểu tính (đang mở ${activeMeta.sheetName})`}>
            <span className="inline-flex items-center justify-between gap-1.5 min-h-[42px] px-3 w-full bg-[#006cee] text-white rounded-xl text-xs font-bold shadow-2xs min-w-0">
              <span className="truncate text-left">{activeMeta.sheetName}</span>
              <ChevronDown className="w-4 h-4 text-white/85 shrink-0" />
            </span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(21rem,calc(100vw-1rem))] p-2 max-h-80 overflow-y-auto z-50">
            <div className="px-2.5 py-1 text-xs font-bold text-[#476885] border-b border-[#e8eff7] mb-1">
              Chọn biểu ({sheetOrder.length} biểu HD 07)
            </div>
            {sheetOrder.map((key, idx) => {
              const m = EXCEL_SHEET_METAS[key];
              const isCurrent = key === props.activeSheet;
              return (
                <PopoverClose key={key} onClick={() => props.onSelectSheet(key)}>
                  <div className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 ${isCurrent ? 'bg-[#eef5ff] text-[#004776] font-bold' : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'}`}>
                    <span className="truncate">{idx + 1}. {m.title}</span>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-[#004776] shrink-0" />}
                  </div>
                </PopoverClose>
              );
            })}
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* 2. Trạng thái lưu */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-semibold shrink-0 whitespace-nowrap ${statusMeta.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusMeta.dot}`} />
            <span>{statusMeta.label}</span>
          </span>

          {/* 3. Nút Lưu trực tiếp */}
          {!isReadOnly ? (
            <button
              type="button"
              onClick={props.onSaveNow}
              disabled={props.syncStatus === 'saving'}
              className="min-h-[42px] px-3 rounded-xl bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <Save className="w-3.5 h-3.5 shrink-0" />
              <span>Lưu</span>
            </button>
          ) : (
            <span className="h-8 px-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold inline-flex items-center shrink-0">Chỉ xem</span>
          )}

          {/* 4. Menu Thêm */}
          <Popover>
          <PopoverTrigger ariaLabel="Mở menu thao tác bảng tính">
            <span className="min-h-[44px] px-3 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f4f7fb] text-xs font-bold text-[#004776] inline-flex items-center gap-1 shrink-0">
              <MoreHorizontal className="w-4 h-4 shrink-0" />
              <span>Thêm</span>
            </span>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[min(21rem,calc(100vw-1rem))] p-2.5 max-h-[76vh] overflow-y-auto space-y-1 z-50">
            <div className="px-2.5 py-2 rounded-xl bg-[#f4f8ff] border border-[#dbe8f5] space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#004776]">
                <span className="inline-flex items-center gap-1.5 truncate"><Building2 className="w-3.5 h-3.5 shrink-0" /><span className="truncate">[{props.unitCode}] {props.currentUnit.nameVi}</span></span>
                <span className="text-[11px] font-semibold text-[#20446c] shrink-0">v{props.revision}</span>
              </div>
              {props.session && (
                <div className="flex items-center justify-between gap-2 text-[11px] text-[#476885]">
                  <span className="inline-flex items-center gap-1 truncate"><User className="w-3 h-3 shrink-0" /><span className="truncate">{props.session.email}</span></span>
                  {isAdmin && <PopoverClose onClick={props.onSwitchSession}><span className="font-bold text-[#006cee]">Đổi phiên</span></PopoverClose>}
                </div>
              )}
              {canChangeUnit && (
                <button type="button" onClick={() => setShowUnitPicker((v) => !v)} className="text-[11px] font-bold text-[#006cee] hover:underline cursor-pointer">
                  {showUnitPicker ? 'Ẩn chọn đơn vị' : 'Đổi đơn vị công tác ▾'}
                </button>
              )}
              {canChangeUnit && showUnitPicker && (
                <div className="pt-1 space-y-1">
                  <input type="text" aria-label="Tìm mã hoặc tên đơn vị" value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} placeholder="Tìm mã/tên đơn vị…" className="w-full h-9 px-2.5 text-xs rounded-lg border border-[#cbd5e1] bg-white text-[#004776]" />
                  <div className="max-h-36 overflow-y-auto space-y-0.5">
                    {filteredUnits.map((u) => (
                      <PopoverClose key={u.code} onClick={() => { props.onUnitChange(u.code); setShowUnitPicker(false); }}>
                        <div className={`w-full text-left px-2 py-1.5 rounded text-xs truncate ${u.code === props.unitCode ? 'bg-[#006cee] text-white font-bold' : 'text-[#004776] hover:bg-white'}`}>[{u.code}] {u.nameVi}</div>
                      </PopoverClose>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {!isReadOnly && (
              <PopoverClose onClick={props.onSaveNow}>
                <div className="w-full px-2.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 text-[#006cee] hover:bg-[#eef5ff]">
                  <Save className="w-4 h-4" /><span>Lưu dữ liệu biểu ngay</span>
                </div>
              </PopoverClose>
            )}

            <Link href={`/nghiep-vu-don-vi?tab=check&unitCode=${encodeURIComponent(props.unitCode)}`} className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between text-[#004776] hover:bg-[#f4f7fb]">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#006cee]" /><span>Kiểm tra hồ sơ (K_KiemTra)</span></span>
              {fixCount > 0 ? <span className="px-2 py-0.5 rounded-full bg-[#fdeceb] text-[#b42318] text-[11px] font-bold">{fixCount} mục</span> : <span className="text-emerald-700 text-[11px] font-bold">Hợp lệ</span>}
            </Link>

            <Link href={`/nghiep-vu-don-vi?tab=history&unitCode=${encodeURIComponent(props.unitCode)}`} className="w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 text-[#004776] hover:bg-[#f4f7fb]">
              <History className="w-4 h-4 text-[#006cee]" /><span>Lịch sử &amp; khôi phục phiên bản</span>
            </Link>

            <Link href={`/bam-gio?step=3&unitCode=${encodeURIComponent(props.unitCode)}`} className="w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 text-[#004776] hover:bg-[#f4f7fb]">
              <Timer className="w-4 h-4 text-[#006cee]" /><span>Đo định mức thời gian (B1)</span>
            </Link>

            <PopoverClose onClick={props.onOpenGuidance}>
              <div className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 text-[#004776] hover:bg-[#f4f7fb]">
                <HelpCircle className="w-4 h-4 text-[#006cee]" /><span>Hướng dẫn biểu {activeMeta.sheetName}</span>
              </div>
            </PopoverClose>

            {props.canNext && (
              <PopoverClose onClick={props.onSaveAndNext}>
                <div className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 text-[#004776] hover:bg-[#f4f7fb]">
                  <ArrowRight className="w-4 h-4 text-[#006cee]" /><span>{isReadOnly ? 'Sang biểu tiếp theo' : 'Lưu & sang biểu tiếp theo'}</span>
                </div>
              </PopoverClose>
            )}

            <PopoverClose onClick={() => props.onToggleOrderMode(props.orderMode === 'excel' ? 'technical' : 'excel')}>
              <div className="w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center justify-between text-[#004776] hover:bg-[#f4f7fb]">
                <span className="inline-flex items-center gap-2"><ArrowUpDown className="w-4 h-4" /><span>Thứ tự biểu</span></span>
                <span className="text-[11px] font-bold bg-[#eef5ff] px-2 py-0.5 rounded">{props.orderMode === 'excel' ? 'Excel' : 'Kỹ thuật'}</span>
              </div>
            </PopoverClose>

            {props.onOpenOrgTreeModal && (
              <PopoverClose onClick={props.onOpenOrgTreeModal}><div className="w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 text-[#004776] hover:bg-[#f4f7fb]"><Network className="w-4 h-4" /><span>Sơ đồ VTVL dự kiến</span></div></PopoverClose>
            )}
            {props.onOpenChartModal && (
              <PopoverClose onClick={props.onOpenChartModal}><div className="w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 text-[#004776] hover:bg-[#f4f7fb]"><BarChart3 className="w-4 h-4" /><span>Biểu đồ cơ cấu nhân lực</span></div></PopoverClose>
            )}
            {!isReadOnly && (
              <>
                <PopoverClose onClick={props.onLoadTcnsData}><div className="w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 text-[#004776] hover:bg-[#f4f7fb]"><RefreshCw className="w-4 h-4" /><span>Khôi phục dữ liệu mẫu TCNS</span></div></PopoverClose>
                <PopoverClose onClick={props.onLoadRecommendedVtvls}><div className="w-full px-2.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 text-[#004776] hover:bg-[#f4f7fb]"><Lightbulb className="w-4 h-4 text-[#8f4f00]" /><span>Nạp gợi ý VTVL chuẩn</span></div></PopoverClose>
                {props.activeSheet === 'C1' && (
                  <PopoverClose onClick={props.onOpenUnlockModal}><div className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 text-[#8f4f00] hover:bg-[#fdf2e1]/60">{props.isC1Unlocked ? <Unlock className="w-4 h-4 text-[#13653f]" /> : <Lock className="w-4 h-4" />}<span>{props.isC1Unlocked ? 'C1 đang mở khóa' : 'Mở khóa chỉnh sửa C1'}</span></div></PopoverClose>
                )}
              </>
            )}

            <PopoverClose onClick={() => { if (!props.isExporting) props.onExportWorkbook(); }}>
              <div className="w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 text-[#13653f] hover:bg-[#e3f5ec]/60">
                <Download className="w-4 h-4" /><span>{props.isExporting ? 'Đang xuất Excel…' : 'Xuất bảng tính Excel (.xlsx)'}</span>
              </div>
            </PopoverClose>
          </PopoverContent>
        </Popover>
        </div>
      </div>

      {props.apiError && (
        <div className="mx-2.5 mb-2 bg-red-50 text-red-700 px-2.5 py-1.5 rounded-lg text-xs border border-red-200 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Lỗi đồng bộ: {props.apiError.message || 'Không thể kết nối'}</span>
        </div>
      )}
    </div>
  );
}
