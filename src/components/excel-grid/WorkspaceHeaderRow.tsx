'use client';

import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Layers, AlertTriangle, HelpCircle, ShieldCheck, Check } from 'lucide-react';
import { ExcelSheetKey, SheetOrderMode, EXCEL_NATURAL_SHEET_ORDER, WORKFLOW_SHEET_ORDER, ADMIN_ONLY_SHEETS } from './excel-grid-types';
import { EXCEL_SHEET_METAS } from './excel-sheet-metas';
import { getActiveHcmuteUnits } from '@/configs/hcmute-units';
import { HcmuteUnit } from '@/types/vtvl';
import { ValidationReport } from '@/services/validation';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/Popover';

interface WorkspaceHeaderRowProps {
  activeSheet: ExcelSheetKey;
  currentUnit: HcmuteUnit;
  unitCode: string;
  activeStep: number;
  activeSheetIndex: number;
  totalSheets: number;
  orderMode: SheetOrderMode;
  qualityReport: ValidationReport;
  session?: OperatorSession | null;
  onSelectSheet: (key: ExcelSheetKey) => void;
  onUnitChange: (code: string) => void;
  onOpenGuidance: () => void;
  onOpenQualityModal: () => void;
}

export function WorkspaceHeaderRow({
  activeSheet,
  currentUnit,
  unitCode,
  activeStep,
  activeSheetIndex,
  totalSheets,
  orderMode,
  qualityReport,
  session,
  onSelectSheet,
  onUnitChange,
  onOpenGuidance,
  onOpenQualityModal
}: WorkspaceHeaderRowProps) {
  const [unitSearch, setUnitSearch] = useState('');
  const [availableUnits, setAvailableUnits] = useState<HcmuteUnit[]>(() => getActiveHcmuteUnits());

  const isAdmin = session?.role === 'admin';
  const canChangeUnit = !session || isAdmin;

  const activeMeta = EXCEL_SHEET_METAS[activeSheet];
  const fixCount = qualityReport.summary.fixCount;
  const rawSheetOrder = orderMode === 'technical' ? WORKFLOW_SHEET_ORDER : EXCEL_NATURAL_SHEET_ORDER;
  const sheetOrder = isAdmin ? rawSheetOrder : rawSheetOrder.filter((key) => !ADMIN_ONLY_SHEETS.has(key));

  useEffect(() => {
    const handleUnitsUpdated = () => setAvailableUnits(getActiveHcmuteUnits());
    window.addEventListener('vtvl-units-updated', handleUnitsUpdated);
    return () => window.removeEventListener('vtvl-units-updated', handleUnitsUpdated);
  }, []);

  const filteredUnits = availableUnits.filter(
    (u: HcmuteUnit) =>
      u.nameVi.toLowerCase().includes(unitSearch.toLowerCase()) ||
      u.code.toLowerCase().includes(unitSearch.toLowerCase())
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 min-h-[58px] px-3.5 sm:px-5 py-2.5 border-b border-[#e2ecf7] bg-white min-w-0">
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* 1. Popover chọn biểu trong 15 biểu mẫu */}
        <Popover>
          <PopoverTrigger>
            <span
              className="inline-flex items-center gap-1.5 h-9 px-3.5 bg-[#004776] hover:bg-[#00365c] text-white rounded-xl text-[13.5px] font-bold transition-colors shadow-2xs"
              title="Đổi nhanh biểu khác trong 15 biểu mẫu"
            >
              <span>{activeMeta.sheetName}</span>
              <ChevronDown className="w-4 h-4 text-white/85" />
            </span>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-[min(21rem,calc(100vw-2rem))] p-2 max-h-80 overflow-y-auto">
            <div className="px-3 py-1.5 text-xs font-bold text-[#476885] border-b border-[#e8eff7] mb-1">
              Chọn biểu tính ({sheetOrder.length} biểu HD 07)
            </div>
            <div className="space-y-0.5">
              {sheetOrder.map((key, idx) => {
                const m = EXCEL_SHEET_METAS[key];
                const isCurrent = key === activeSheet;
                return (
                  <PopoverClose key={key} onClick={() => onSelectSheet(key)}>
                    <div
                      className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between gap-2 transition-colors ${
                        isCurrent
                          ? 'bg-[#eef5ff] text-[#004776] font-bold'
                          : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'
                      }`}
                    >
                      <span className="truncate">{idx + 1}. {m.title}</span>
                      {isCurrent && <Check className="w-4 h-4 text-[#004776] shrink-0" />}
                    </div>
                  </PopoverClose>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* 2. Tiêu đề biểu chữ to rõ ràng */}
        <h1
          className="text-base sm:text-lg font-bold text-[#004776] leading-snug truncate max-w-[240px] sm:max-w-xs md:max-w-md lg:max-w-lg min-w-0"
          title={activeMeta.title}
        >
          {activeMeta.title}
        </h1>

        <span className="hidden sm:inline text-[#cbd5e1]">|</span>

        {/* 3. Popover đổi đơn vị công tác (hoặc nhãn cố định nếu đã đăng nhập và không phải Admin) */}
        {canChangeUnit ? (
          <Popover>
            <PopoverTrigger>
              <span
                className="inline-flex items-center gap-1.5 h-9 px-3 bg-white hover:bg-[#f4f7fb] border border-[#cbd5e1] hover:border-[#004776] rounded-xl text-[13.5px] font-semibold text-[#004776] transition-colors max-w-[220px] sm:max-w-xs truncate"
                title={`[${unitCode}] ${currentUnit.nameVi} — Nhấp để đổi đơn vị công tác`}
              >
                <Building2 className="w-4 h-4 text-[#004776] shrink-0" />
                <span className="truncate font-bold">[{unitCode}] {currentUnit.nameVi}</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#476885] shrink-0" />
              </span>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2.5">
              <input
                type="text"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                placeholder="Tìm mã hoặc tên đơn vị..."
                className="w-full h-9 px-3 text-sm rounded-xl border border-[#cbd5e1] mb-2 text-[#004776] font-medium focus:ring-2 focus:ring-[#004776]/25 focus:border-[#004776] outline-hidden"
              />
              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {filteredUnits.map((u: HcmuteUnit) => (
                  <PopoverClose key={u.code} onClick={() => onUnitChange(u.code)}>
                    <div
                      className={`w-full text-left px-3 py-2 rounded-lg text-[13px] truncate flex items-center justify-between gap-2 ${
                        u.code === unitCode
                          ? 'bg-[#eef5ff] text-[#004776] font-bold'
                          : 'hover:bg-[#f4f7fb] text-[#004776] font-medium'
                      }`}
                    >
                      <span className="truncate">[{u.code}] {u.nameVi}</span>
                      {u.code === unitCode && <Check className="w-4 h-4 text-[#004776] shrink-0" />}
                    </div>
                  </PopoverClose>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#f5f9ff] border border-[#d8e3ef] rounded-xl text-[13.5px] font-bold text-[#004776] max-w-[220px] sm:max-w-xs truncate cursor-default shadow-2xs"
            title={`[${unitCode}] ${currentUnit.nameVi} · Đơn vị công tác cố định (Chỉ Admin mới có quyền đổi)`}
          >
            <Building2 className="w-4 h-4 text-[#004776] shrink-0" />
            <span className="truncate font-bold">[{unitCode}] {currentUnit.nameVi}</span>
            <span className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-[#e1edf8] text-[#004776] font-semibold shrink-0">
              Cố định
            </span>
          </span>
        )}

        {/* 4. Trạng thái Bước & Biểu */}
        <span className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 bg-[#f4f7fb] border border-[#e2ecf7] rounded-xl text-[13px] font-semibold text-[#20446c] shrink-0">
          <Layers className="w-3.5 h-3.5 text-[#004776] shrink-0" />
          <span className="whitespace-nowrap">Bước {activeStep}/8 · Biểu {activeSheetIndex + 1}/{totalSheets}</span>
        </span>

        {/* 5. Cảnh báo QA */}
        {fixCount > 0 ? (
          <button
            type="button"
            onClick={onOpenQualityModal}
            className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#fdeceb] hover:bg-[#fbd5d3] border border-[#f8b4af] rounded-xl text-[13px] font-bold text-[#b42318] cursor-pointer transition-colors shrink-0"
            title="Xem chi tiết các điểm cần bổ sung hoặc xem lại"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">{fixCount} mục cần xem</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenQualityModal}
            className="inline-flex items-center gap-1.5 h-9 px-3 bg-[#e3f5ec] hover:bg-[#ccecd9] border border-[#a3e2c3] rounded-xl text-[13px] font-bold text-[#13653f] cursor-pointer transition-colors shrink-0"
            title="Dữ liệu biểu mẫu hoàn tất và đạt chuẩn"
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Dữ liệu hợp lệ</span>
          </button>
        )}
      </div>

      {/* 6. Liên kết Hướng dẫn bên phải */}
      <button
        type="button"
        onClick={onOpenGuidance}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 text-[13.5px] font-bold text-[#004776] bg-white hover:bg-[#eef5ff] border border-[#cbd5e1] hover:border-[#004776] rounded-xl transition-colors cursor-pointer shrink-0"
        title="Xem căn cứ pháp lý, hướng dẫn chuẩn HD 07 và lưu ý biểu này"
      >
        <HelpCircle className="w-4 h-4 shrink-0" />
        <span>Hướng dẫn</span>
      </button>
    </div>
  );
}
