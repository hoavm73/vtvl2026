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
    <div className="bg-white rounded-2xl border border-[#cbd5e1] p-3 sm:p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
      <div className="flex items-center justify-between sm:justify-start gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#0072BC] bg-[#eef5ff] px-2.5 py-1 rounded-md">
          {isEditing ? `Đang chỉnh sửa [${editingTaskCode}]` : 'Kê khai phiếu công việc'}
        </span>
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs text-[#004776] hover:underline inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <RotateCcw className="w-3 h-3" /> Chuyển sang tạo mới
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <button
          type="button"
          onClick={onPrint}
          className="flex-1 sm:flex-initial justify-center h-9 px-3 rounded-xl border border-[#004776] text-[#004776] hover:bg-[#f0f7fd] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
        >
          <Printer className="w-4 h-4" />
          <span>In phiếu</span>
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave('Nháp')}
          className="flex-1 sm:flex-initial justify-center h-9 px-3 rounded-xl border border-[#0072BC] bg-white text-xs font-bold text-[#0072BC] hover:bg-[#eef5ff] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          <Save className="w-4 h-4" />
          <span>Lưu nháp</span>
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave('Đã nộp')}
          className="flex-1 sm:flex-initial justify-center h-9 px-3.5 rounded-xl bg-[#004776] hover:bg-[#00385d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs whitespace-nowrap"
        >
          <Send className="w-4 h-4" />
          <span>{saving ? 'Đang lưu...' : 'Lưu & nộp'}</span>
        </button>
      </div>
    </div>
  );
}
