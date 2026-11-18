'use client';

import React from 'react';
import { ExcelSheetMeta } from './excel-grid-types';
import { HcmuteUnit } from '@/types/vtvl';
import {
  BookOpen, HelpCircle, Building2, CheckCircle2,
  Clock, AlertTriangle, Layers
} from 'lucide-react';

interface CompactWorkspaceHeaderProps {
  activeMeta: ExcelSheetMeta;
  currentUnit: HcmuteUnit;
  activeStep: number;
  activeSheetIndex: number;
  totalSheets: number;
  rowsCount: number;
  isDirty: boolean;
  lastSaved?: string;
  isSaving?: boolean;
  fixCount: number;
  onOpenGuidance: () => void;
  onOpenQualityModal: () => void;
}

export function CompactWorkspaceHeader({
  activeMeta,
  currentUnit,
  activeStep,
  activeSheetIndex,
  totalSheets,
  rowsCount,
  isDirty,
  lastSaved,
  isSaving,
  fixCount,
  onOpenGuidance,
  onOpenQualityModal
}: CompactWorkspaceHeaderProps) {
  return (
    <div className="bg-white border border-[#cbd5e1] rounded-xl sm:rounded-2xl p-3 sm:p-3.5 shadow-2xs w-full max-w-full min-w-0 space-y-2.5">
      {/* DÒNG 1: Tên biểu hiện tại · Đơn vị · Bước & Tiến độ · Nút Hướng dẫn */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#f1f5f9] pb-2.5">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          {/* Badge mã biểu */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black bg-[#004776] text-white shrink-0 tracking-wide">
            {activeMeta.sheetName}
          </span>

          {/* Tên biểu */}
          <h1 className="!text-[16.5px] sm:!text-[21px] !leading-[1.35] font-bold !text-[#0072BC] truncate max-w-[280px] sm:max-w-[420px] md:max-w-[560px]">
            {activeMeta.title}
          </h1>

          <span className="hidden sm:inline-block text-[#cbd5e1]">|</span>

          {/* Đơn vị */}
          <div className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#004776]/90 bg-[#004776]/5 px-2.5 py-0.5 rounded-md border border-[#004776]/15 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#004776]" />
            <span className="font-bold">[{currentUnit.code}]</span>
            <span className="truncate max-w-[200px]">{currentUnit.nameVi}</span>
          </div>
        </div>

        {/* Nhóm bên phải: Tiến độ bước + Nút Hướng dẫn */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1 text-xs font-bold text-[#004776] bg-[#f8fafc] px-2.5 py-1 rounded-lg border border-[#cbd5e1]">
            <Layers className="w-3.5 h-3.5 text-[#004776]" />
            <span>Bước {activeStep}/8</span>
            <span className="text-[#94a3b8]">·</span>
            <span>Biểu {activeSheetIndex + 1}/{totalSheets}</span>
          </div>

          <button
            type="button"
            onClick={onOpenGuidance}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#004776] bg-sky-50 hover:bg-[#004776] hover:text-white border border-[#004776]/30 rounded-lg transition-all cursor-pointer shadow-2xs"
            title="Xem căn cứ pháp lý, hướng dẫn chuẩn HD 07 và lưu ý biểu này"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hướng dẫn</span>
          </button>
        </div>
      </div>

      {/* DÒNG 2: Trạng thái lưu · Số dòng · Trạng thái QA / Cảnh báo */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Trạng thái lưu cố định, trực quan */}
          {isSaving ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold text-sky-800 bg-sky-50 border border-sky-200">
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
              <span>Đang lưu...</span>
            </span>
          ) : isDirty ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-bold text-amber-800 bg-amber-50 border border-amber-300 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Có thay đổi chưa lưu</span>
            </span>
          ) : lastSaved ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tất cả thay đổi đã được lưu ({lastSaved})</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[#64748b] bg-[#f8fafc] border border-[#e2e8f0]">
              <Clock className="w-3 h-3" />
              <span>Sẵn sàng thao tác</span>
            </span>
          )}

          {/* Số dòng */}
          <span className="text-[#64748b]">
            Dữ liệu: <strong className="text-[#004776] tabular-nums">{rowsCount}</strong> dòng
          </span>
        </div>

        {/* Trạng thái kiểm tra QA / Cảnh báo */}
        <div className="flex items-center gap-2">
          {fixCount > 0 ? (
            <button
              type="button"
              onClick={onOpenQualityModal}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
              title="Có mục cần bổ sung hoặc sửa lỗi theo chuẩn HD 07"
            >
              <AlertTriangle className="w-3 h-3 text-red-600" />
              <span>{fixCount} mục cần xem</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Dữ liệu hợp chuẩn</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

