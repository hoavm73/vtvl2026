'use client';

import React from 'react';
import Link from 'next/link';
import {
  ChevronDown, ArrowUpDown,
  Download, Lock, Unlock, Lightbulb, SlidersHorizontal, RefreshCw, Timer, PackagePlus, History
} from 'lucide-react';
import { ExcelSheetKey, SheetOrderMode } from './excel-grid-types';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/Popover';

interface ExcelCommandToolsMenuProps {
  unitCode?: string;
  activeSheet: ExcelSheetKey;
  orderMode: SheetOrderMode;
  isExporting: boolean;
  isC1Unlocked: boolean;
  onToggleOrderMode: (mode: SheetOrderMode) => void;
  onOpenOrgTreeModal?: () => void;
  onOpenChartModal?: () => void;
  onLoadTcnsData: () => void;
  onLoadRecommendedVtvls: () => void;
  onExportWorkbook: () => void;
  onOpenUnlockModal: () => void;
}

export function ExcelCommandToolsMenu({
  unitCode = 'TCNS',
  activeSheet,
  orderMode,
  isExporting,
  isC1Unlocked,
  onToggleOrderMode,
  onOpenOrgTreeModal,
  onOpenChartModal,
  onLoadTcnsData,
  onLoadRecommendedVtvls,
  onExportWorkbook,
  onOpenUnlockModal
}: ExcelCommandToolsMenuProps) {
  return (
    <Popover>
      <PopoverTrigger>
        <span
          className="h-9 px-3 text-[13.5px] font-semibold text-[#004776] hover:bg-[#eef5ff] rounded-xl inline-flex items-center gap-1.5 transition-colors border border-[#cbd5e1] bg-white"
          title="Mở menu chức năng mở rộng và công cụ tiện ích"
        >
          <SlidersHorizontal className="w-4 h-4 text-[#004776]" />
          <span>Công cụ</span>
          <ChevronDown className="w-3.5 h-3.5 text-[#476885]" />
        </span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-2 space-y-0.5">
        <Link href={`/bam-gio?step=3&unitCode=${encodeURIComponent(unitCode)}`} className="w-full text-left px-3 py-2 text-[13px] text-[#004776] hover:bg-[#f4f7fb] rounded-lg flex items-center gap-2.5 font-medium">
          <Timer className="w-4 h-4 text-[#006cee]" />
          <span>Đo định mức thời gian (B1)</span>
        </Link>

        <Link href={`/tao-tep?mode=wizard&unitCode=${encodeURIComponent(unitCode)}`} className="w-full text-left px-3 py-2 text-[13px] text-[#004776] hover:bg-[#f4f7fb] rounded-lg flex items-center gap-2.5 font-medium">
          <PackagePlus className="w-4 h-4 text-[#006cee]" />
          <span>Xuất gói tệp / Khởi tạo (.xlsx/.zip)</span>
        </Link>

        <Link href={`/nghiep-vu-don-vi?tab=history&unitCode=${encodeURIComponent(unitCode)}`} className="w-full text-left px-3 py-2 text-[13px] text-[#004776] hover:bg-[#f4f7fb] rounded-lg flex items-center gap-2.5 font-medium">
          <History className="w-4 h-4 text-[#006cee]" />
          <span>Lịch sử &amp; khôi phục phiên bản</span>
        </Link>

        <div className="my-1 border-t border-[#e8eff7]" />

        <PopoverClose onClick={() => onToggleOrderMode(orderMode === 'excel' ? 'technical' : 'excel')}>
          <div className="w-full text-left px-3 py-2 text-[13px] text-[#004776] hover:bg-[#f4f7fb] rounded-lg flex items-center justify-between gap-2 font-medium">
            <div className="flex items-center gap-2.5">
              <ArrowUpDown className="w-4 h-4 text-[#004776]" />
              <span>Thứ tự biểu:</span>
            </div>
            <span className="font-bold text-xs text-[#004776] bg-[#eef5ff] px-2 py-0.5 rounded-md border border-[#cbd5e1]">
              {orderMode === 'excel' ? 'Theo Excel' : 'Theo kỹ thuật'}
            </span>
          </div>
        </PopoverClose>

        <div className="my-1 border-t border-[#e8eff7]" />

        {unitCode.toUpperCase() === 'TCNS' && (
          <PopoverClose onClick={onLoadTcnsData}>
            <div className="w-full text-left px-3 py-2 text-[13px] text-[#004776] hover:bg-[#f4f7fb] rounded-lg flex items-center gap-2.5 font-medium">
              <RefreshCw className="w-4 h-4 text-[#004776]" />
              <span>Khôi phục dữ liệu mẫu TCNS</span>
            </div>
          </PopoverClose>
        )}

        <PopoverClose onClick={onLoadRecommendedVtvls}>
          <div className="w-full text-left px-3 py-2 text-[13px] text-[#004776] hover:bg-[#f4f7fb] rounded-lg flex items-center gap-2.5 font-medium">
            <Lightbulb className="w-4 h-4 text-[#8f4f00]" />
            <span>Nạp gợi ý VTVL chuẩn theo Đề án</span>
          </div>
        </PopoverClose>

        <PopoverClose onClick={() => { if (!isExporting) onExportWorkbook(); }}>
          <div className={`w-full text-left px-3 py-2 text-[13px] text-[#13653f] hover:bg-[#e3f5ec]/60 rounded-lg flex items-center gap-2.5 font-semibold ${isExporting ? 'opacity-50' : ''}`}>
            <Download className="w-4 h-4 text-[#13653f]" />
            <span>{isExporting ? 'Đang xuất gói Excel…' : 'Xuất bảng tính Excel'}</span>
          </div>
        </PopoverClose>

        {activeSheet === 'C1' && (
          <>
            <div className="my-1 border-t border-[#e8eff7]" />
            <PopoverClose onClick={onOpenUnlockModal}>
              <div className="w-full text-left px-3 py-2 text-[13px] text-[#8f4f00] hover:bg-[#fdf2e1]/60 rounded-lg flex items-center gap-2.5 font-semibold">
                {isC1Unlocked ? (
                  <>
                    <Unlock className="w-4 h-4 text-[#13653f]" />
                    <span>C1 đang mở khóa quản trị</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-[#8f4f00]" />
                    <span>Mở khóa chỉnh sửa C1</span>
                  </>
                )}
              </div>
            </PopoverClose>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
