'use client';

import React from 'react';
import { Download, FileDown, Upload } from 'lucide-react';

interface A1ExcelToolbarActionsProps {
  canImport: boolean;
  onDownloadTemplate: () => void;
  onExportA1: () => void;
  onOpenImport: () => void;
}

export function A1ExcelToolbarActions({
  canImport,
  onDownloadTemplate,
  onExportA1,
  onOpenImport
}: A1ExcelToolbarActionsProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={onDownloadTemplate}
        className="inline-flex items-center gap-1.5 h-9 px-2.5 text-xs font-semibold text-[#004776] bg-white hover:bg-[#f4f7fb] border border-[#cbd5e1] rounded-xl cursor-pointer transition-colors"
        title="Tải tệp mẫu trống Biểu 1. A1_NhiemVu (.xlsx)"
      >
        <FileDown className="w-3.5 h-3.5 shrink-0 text-[#0072BC]" />
        <span>Tải mẫu trống</span>
      </button>
      <button
        type="button"
        onClick={onExportA1}
        className="inline-flex items-center gap-1.5 h-9 px-2.5 text-xs font-semibold text-[#004776] bg-white hover:bg-[#f4f7fb] border border-[#cbd5e1] rounded-xl cursor-pointer transition-colors"
        title="Xuất dữ liệu Biểu 1. A1_NhiemVu hiện tại ra Excel (.xlsx)"
      >
        <Download className="w-3.5 h-3.5 shrink-0 text-[#0072BC]" />
        <span>Xuất dữ liệu A1</span>
      </button>
      {canImport && (
        <button
          type="button"
          onClick={onOpenImport}
          className="inline-flex items-center gap-1.5 h-9 px-2.5 text-xs font-semibold text-[#004776] bg-[#eef5ff] hover:bg-[#dfeeff] border border-[#0072BC]/35 rounded-xl cursor-pointer transition-colors"
          title="Nhập nhiệm vụ Biểu A1 từ tệp Excel (.xlsx)"
        >
          <Upload className="w-3.5 h-3.5 shrink-0 text-[#0072BC]" />
          <span>Nhập Excel</span>
        </button>
      )}
    </div>
  );
}
