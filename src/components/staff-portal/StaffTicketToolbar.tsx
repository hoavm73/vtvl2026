'use client';

import React from 'react';
import { Save, Send, RotateCcw, Printer } from 'lucide-react';
import { TicketStatus } from '@/types/staff-ticket';

interface StaffTicketToolbarProps {
  isEditing: boolean;
  isEditingPending?: boolean;
  editingTaskCode?: string;
  saving: boolean;
  onCancelEdit: () => void;
  onPrint: () => void;
  onSave: (status: TicketStatus) => void;
}

/**
 * Thanh tác vụ phiếu công việc — bố cục co giãn linh hoạt, không tràn khung ở mọi độ rộng.
 */
export function StaffTicketToolbar({
  isEditing,
  isEditingPending = false,
  editingTaskCode,
  saving,
  onCancelEdit,
  onPrint,
  onSave
}: StaffTicketToolbarProps) {
  return (
    <div className="space-y-2.5 print:hidden">
      {isEditing && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#eef5ff] border border-[#cfe2fc] text-xs">
          <span className="font-semibold text-[#004776]">
            Đang chỉnh sửa <strong className="font-mono text-[#006cee]">[{editingTaskCode}]</strong>
          </span>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs text-[#006cee] hover:text-[#004776] hover:underline inline-flex items-center gap-1 cursor-pointer font-semibold whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3 shrink-0" />
            <span>Tạo mới</span>
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrint}
          className="h-9 px-3 rounded-[10px] hover:bg-[#eef5ff] text-[#004776] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
        >
          <Printer className="w-4 h-4 text-[#004776] shrink-0" />
          <span>In phiếu</span>
        </button>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {!isEditingPending && (
            <button
              type="button"
              disabled={saving}
              onClick={() => onSave('Nháp')}
              className="h-9 px-3.5 rounded-[10px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-[#006cee] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>Lưu nháp</span>
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave('Đã nộp')}
            className="h-9 px-4 rounded-[10px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap transition-colors"
          >
            <Send className="w-4 h-4 shrink-0" />
            <span>{saving ? (isEditingPending ? 'Đang cập nhật...' : 'Đang lưu...') : (isEditingPending ? 'Cập nhật phiếu' : 'Lưu & nộp')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
