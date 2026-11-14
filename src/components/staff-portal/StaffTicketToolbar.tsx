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
    <div className="bg-white rounded-2xl border border-[#cbd5e1] p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex items-center gap-2">
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrint}
          className="h-9 px-3.5 rounded-xl border border-[#004776] text-[#004776] hover:bg-[#f0f7fd] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <Printer className="w-4 h-4" />
          In phiếu này
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave('Nháp')}
          className="h-9 px-3.5 rounded-xl border border-[#0072BC] bg-white text-xs font-bold text-[#0072BC] hover:bg-[#eef5ff] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Lưu nháp
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave('Đã nộp')}
          className="h-9 px-4 rounded-xl bg-[#004776] hover:bg-[#00385d] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
        >
          <Send className="w-4 h-4" />
          {saving ? 'Đang lưu...' : 'Lưu và nộp'}
        </button>
      </div>
    </div>
  );
}
