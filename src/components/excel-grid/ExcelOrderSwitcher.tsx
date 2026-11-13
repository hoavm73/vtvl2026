'use client';

import React from 'react';
import { SheetOrderMode } from './excel-grid-types';
import { ListOrdered, Layers, CheckCircle2 } from 'lucide-react';

interface ExcelOrderSwitcherProps {
  orderMode: SheetOrderMode;
  onToggleOrderMode: (mode: SheetOrderMode) => void;
  lastSaved?: string;
}

export function ExcelOrderSwitcher({
  orderMode,
  onToggleOrderMode,
  lastSaved
}: ExcelOrderSwitcherProps) {
  const isExcel = orderMode === 'excel';

  return (
    <div className="mt-2.5 pt-2 border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        {/* Toggle buttons matching exact UI */}
        <div className="flex items-center gap-1 bg-[#e2e8f0] p-0.5 rounded-lg text-xs font-semibold border border-[#cbd5e1]">
          <button
            type="button"
            onClick={() => onToggleOrderMode('excel')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded transition-all cursor-pointer ${
              isExcel
                ? 'bg-white text-[#004776] font-bold shadow-2xs'
                : 'text-[#64748b] hover:text-[#004776]'
            }`}
            title="Sắp xếp theo thứ tự số sheet tự nhiên của file Excel (1. A1 -> 15. S)"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Theo file Excel (1..15)</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleOrderMode('technical')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded transition-all cursor-pointer ${
              !isExcel
                ? 'bg-white text-[#004776] font-bold shadow-2xs'
                : 'text-[#64748b] hover:text-[#004776]'
            }`}
            title="Sắp xếp theo thứ tự 12 bước liên kết kỹ thuật trong Hướng dẫn chuẩn nhập dữ liệu"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Luồng kỹ thuật (12 bước)</span>
          </button>
        </div>

        {/* Workflow hint text */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-[#475569]">
          <span className="font-bold text-[#004776]">
            {isExcel ? 'Thứ tự Excel:' : 'Trình tự kỹ thuật:'}
          </span>
          <span className="text-[#334155] truncate max-w-[500px]">
            {isExcel
              ? '1. A1 → 2. A2 → 3. C1 → 4. B1 → 5. B2_CT → 6. B2 → 7. C2 → 8. C3 → 9. D1 → 10. D2 → 11. DM_SP → 12. DU_BAO → 13. K → 14. T → 15. S'
              : '11. DM_SP → 3. C1 → 1. A1 → 2. A2 → 4. B1 → 5. B2_CT → 6. B2 → 7. C2 → 9. D1 → 8. C3 → 12. DU_BAO → 10. D2'}
          </span>
        </div>
      </div>

      {lastSaved && (
        <div className="flex items-center gap-1 text-emerald-700 font-medium text-xs">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Đã lưu lúc {lastSaved}</span>
        </div>
      )}
    </div>
  );
}

