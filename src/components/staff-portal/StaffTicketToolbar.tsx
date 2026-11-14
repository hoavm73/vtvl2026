'use client';

import React from 'react';
import { Save, Send, RotateCcw, Printer } from 'lucide-react';
import { TicketStatus } from '@/types/staff-ticket';

interface StaffTicketToolbarProps {
  isEditing: boolean;
  editingTaskCode?: string;
  saving: boolean;
  onCancelEdit: () => void;
  onPrint: () => void;
  onSave: (status: TicketStatus) => void;
}

export function StaffTicketToolbar({
  isEditing,
  editingTaskCode,
  saving,
  onCancelEdit,
  onPrint,
  onSave
}: StaffTicketToolbarProps) {
  return (
    <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap sm:flex-nowrap print:hidden">
      {isEditing && (
        <div className="flex items-center gap-2 mr-1">
          <span className="text-xs font-semibold text-[#004776] bg-[#f0f7fd] border border-[#bae0ff] px-2.5 py-1 rounded-lg whitespace-nowrap">
            Đang chỉnh sửa [{editingTaskCode}]
          </span>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs text-[#004776] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Tạo mới</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onPrint}
          className="h-9 px-3.5 rounded-xl border border-[#cbd5e1] hover:border-[#94a3b8] bg-white hover:bg-[#f8fafc] text-[#004776] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap transition-colors"
        >
          <Printer className="w-4 h-4 text-[#004776]" />
          <span>In phiếu</span>
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave('Nháp')}
          className="h-9 px-3.5 rounded-xl border border-[#0072BC] bg-white hover:bg-[#f0f7fd] text-[#0072BC] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs whitespace-nowrap transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>Lưu nháp</span>
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave('Đã nộp')}
          className="h-9 px-4 rounded-xl bg-[#004776] hover:bg-[#00385d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs whitespace-nowrap transition-colors"
        >
          <Send className="w-4 h-4" />
          <span>{saving ? 'Đang lưu...' : 'Lưu & nộp'}</span>
        </button>
      </div>
    </div>
  );
}
