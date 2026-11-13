'use client';

import React, { useRef, useEffect } from 'react';
import {
  ExcelSheetKey, SheetOrderMode, EXCEL_NATURAL_SHEET_ORDER, WORKFLOW_SHEET_ORDER
} from './excel-grid-types';
import { EXCEL_SHEET_METAS } from './excel-sheet-metas';
import { ChevronLeft, ChevronRight, FileSpreadsheet, ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/Popover';

interface ExcelSheetTabsProps {
  activeSheet: ExcelSheetKey;
  onSelectSheet: (key: ExcelSheetKey) => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  sheetOrder?: ExcelSheetKey[];
  orderMode?: SheetOrderMode;
  dirtySheets?: Set<ExcelSheetKey>;
}

export function ExcelSheetTabs({
  activeSheet,
  onSelectSheet,
  onPrev,
  onNext,
  canPrev,
  canNext,
  sheetOrder = EXCEL_NATURAL_SHEET_ORDER,
  orderMode = 'excel',
  dirtySheets
}: ExcelSheetTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const activeTab = scrollRef.current.querySelector<HTMLElement>(`[data-tab-key="${activeSheet}"]`);
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeSheet]);

  const displayOrder = sheetOrder.length > 0 ? sheetOrder : WORKFLOW_SHEET_ORDER;
  const isTechnical = orderMode === 'technical';
  const activeIndex = displayOrder.indexOf(activeSheet);
  const activeMeta = EXCEL_SHEET_METAS[activeSheet];

  return (
    <div className="w-full bg-[#f8fbff] border-b border-[#d8e3ef] select-none">
      {/* 1. MOBILE & TABLET: Shadcn Popover gọn Biểu X/15 · Mã biểu */}
      <div className="flex md:hidden items-center justify-between px-3 py-2">
        <Popover className="w-full">
          <PopoverTrigger className="w-full">
            <span className="w-full flex items-center justify-between gap-2 px-3.5 h-10 bg-white border border-[#d8e3ef] rounded-xl text-sm font-bold text-[#004776] shadow-2xs">
              <span className="flex items-center gap-2 truncate">
                <FileSpreadsheet className="w-4 h-4 text-[#004776] shrink-0" />
                <span className="truncate">
                  Biểu {activeIndex + 1}/{displayOrder.length} · {activeMeta.sheetName}
                </span>
              </span>
              <ChevronDown className="w-4 h-4 text-[#476885] shrink-0" />
            </span>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-[calc(100vw-24px)] p-2 max-h-72 overflow-y-auto space-y-0.5">
            <div className="px-3 py-1.5 text-xs font-bold text-[#476885] border-b border-[#e8eff7] mb-1">
              {displayOrder.length} biểu mẫu theo chuẩn Hướng dẫn số 07
            </div>
            {displayOrder.map((key, idx) => {
              const m = EXCEL_SHEET_METAS[key];
              const isAct = activeSheet === key;
              return (
                <PopoverClose key={key} onClick={() => onSelectSheet(key)}>
                  <div
                    className={`w-full text-left px-3 py-2 rounded-lg text-[13.5px] flex items-center justify-between gap-2 ${
                      isAct ? 'bg-[#eef5ff] text-[#004776] font-bold' : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'
                    }`}
                  >
                    <span className="truncate">
                      {idx + 1}. {m.sheetName} — {m.title}
                    </span>
                    {isAct && <Check className="w-4 h-4 text-[#004776] shrink-0" />}
                  </div>
                </PopoverClose>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>

      {/* 2. DESKTOP: Dải Tab Underline cao 44px cuộn ngang, chữ to rõ */}
      <div className="hidden md:flex items-center gap-1.5 px-3 min-h-[44px]">
        <div className="flex items-center gap-0.5 shrink-0 pr-2 py-1 border-r border-[#d8e3ef]">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Biểu trước"
            title="Biểu tính trước đó"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-white text-[#004776] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            aria-label="Biểu tiếp theo"
            title="Biểu tính tiếp theo"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-white text-[#004776] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div
          ref={scrollRef}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth"
          role="tablist"
          aria-label={`Danh sách ${displayOrder.length} biểu mẫu theo chuẩn Hướng dẫn 07`}
        >
          {displayOrder.map((key, index) => {
            const meta = EXCEL_SHEET_METAS[key];
            const isActive = activeSheet === key;
            const isDirty = dirtySheets?.has(key);

            return (
              <button
                key={key}
                role="tab"
                data-tab-key={key}
                aria-selected={isActive}
                onClick={() => onSelectSheet(key)}
                className={`group relative inline-flex items-center gap-1.5 px-3.5 h-11 text-[13.5px] transition-all shrink-0 cursor-pointer border-b-[3px] ${
                  isActive
                    ? 'bg-white text-[#004776] border-[#004776] font-bold shadow-2xs'
                    : 'bg-transparent text-[#20446c] border-transparent font-semibold hover:text-[#004776] hover:bg-white/70'
                }`}
              >
                {isTechnical ? (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] inline-flex items-center justify-center font-bold ${
                      isActive
                        ? 'bg-[#004776] text-white'
                        : 'bg-[#e1edf8] text-[#004776] group-hover:bg-[#004776] group-hover:text-white'
                    }`}
                    title={`Bước kỹ thuật ${index + 1}`}
                  >
                    B.{index + 1}
                  </span>
                ) : (
                  <FileSpreadsheet
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#004776]' : 'text-[#476885]'}`}
                  />
                )}

                <span className="whitespace-nowrap">{meta.sheetName}</span>

                {isDirty && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Sheet có thay đổi chưa lưu" />
                )}
                {key === 'K' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" title="Chỉ tiêu kiểm soát K" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
