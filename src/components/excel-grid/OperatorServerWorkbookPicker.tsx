'use client';

import React from 'react';
import { FolderArchive } from 'lucide-react';

export interface ServerLookupItem {
  id: string;
  unitCode: string;
  unitNameVi: string;
  reportingPeriod: string;
  currentRevision: number;
  lastSavedAt: string;
}

interface Props {
  workbooks: ServerLookupItem[];
  selectedWorkbookId?: string;
  currentUnitCode: string;
  onSelect: (w: ServerLookupItem) => void;
}

export function OperatorServerWorkbookPicker({
  workbooks, selectedWorkbookId, currentUnitCode, onSelect
}: Props) {
  if (workbooks.length === 0) return null;

  return (
    <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-[#004776] space-y-2 mt-2">
      <div className="flex items-center gap-1.5 font-bold">
        <FolderArchive className="w-4 h-4 text-[#004776] shrink-0" />
        <span>Tìm thấy {workbooks.length} hồ sơ máy chủ cho email này:</span>
      </div>
      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {workbooks.map((w) => {
          const isSelected = selectedWorkbookId === w.id || currentUnitCode === w.unitCode;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onSelect(w)}
              className={`w-full text-left p-2 rounded-lg border text-[11px] transition-all flex items-center justify-between cursor-pointer ${
                isSelected
                  ? 'bg-[#006cee] text-white border-[#006cee] font-bold shadow-xs'
                  : 'bg-white text-[#004776] border-blue-200 hover:bg-blue-100/60'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div><strong>[{w.unitCode}]</strong> {w.unitNameVi}</div>
                <div className={isSelected ? 'text-white/80' : 'text-[#64748b]'}>
                  Kỳ: {w.reportingPeriod} • Phiên bản v{w.currentRevision}
                </div>
              </div>
              <span className="shrink-0 text-[10px] underline">
                {isSelected ? 'Đang chọn' : 'Chọn hồ sơ này'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

