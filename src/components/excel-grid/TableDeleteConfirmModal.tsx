'use client';

import React from 'react';
import { AlertTriangle, Undo2, Trash2, X } from 'lucide-react';
import { GenericGridRow } from './excel-grid-types';

interface TableDeleteConfirmModalProps {
  confirmDeleteId: string | null;
  selectedCount?: number;
  lastDeletedCount?: number;
  targetRecordLabel?: string | null;
  sheetLabel?: string;
  deletedRowBackup: { row: GenericGridRow; index: number } | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRestoreBackup: () => void;
}

/** Hộp thoại xác nhận xóa bản ghi (nêu rõ mã/tên dòng đang xóa) + dải hoàn tác sau khi xóa. */
export function TableDeleteConfirmModal({
  confirmDeleteId,
  selectedCount = 0,
  lastDeletedCount = 0,
  targetRecordLabel,
  sheetLabel = 'biểu hiện tại',
  deletedRowBackup,
  onCancel,
  onConfirm,
  onRestoreBackup
}: TableDeleteConfirmModalProps) {
  const isBulk = confirmDeleteId === 'selected';
  const countToDisplay = isBulk ? selectedCount : 1;

  return (
    <>
      {confirmDeleteId && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="vtvl-delete-confirm-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#004776]/45 backdrop-blur-xs p-3 sm:p-4"
          onClick={onCancel}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl border border-rose-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <h2 id="vtvl-delete-confirm-title" className="text-sm font-bold text-[#004776] truncate">
                  {isBulk ? `Xác nhận xóa ${countToDisplay} bản ghi` : 'Xác nhận xóa bản ghi'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onCancel}
                aria-label="Đóng hộp thoại"
                className="w-8 h-8 rounded-lg text-[#476885] hover:text-[#004776] inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs text-[#004776] leading-relaxed">
              <p>
                {isBulk
                  ? `Bạn có chắc chắn muốn xóa ${countToDisplay} bản ghi đã chọn khỏi ${sheetLabel}?`
                  : `Bạn có chắc chắn muốn xóa bản ghi này khỏi ${sheetLabel}?`}
              </p>

              {targetRecordLabel && (
                <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs font-bold text-[#004776] break-words">
                  {targetRecordLabel}
                </div>
              )}

              <p className="text-[11px] text-[#476885]">
                Thao tác sẽ cập nhật lại công thức liên quan trên bảng tính đơn vị.
              </p>
            </div>

            <div className="px-4 py-3 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-9 px-4 text-xs font-bold text-[#004776] bg-white border border-[#cbd5e1] rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBulk ? `Xóa ${countToDisplay} dòng` : 'Xác nhận xóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {(deletedRowBackup || lastDeletedCount > 0) && !confirmDeleteId && (
        <div className="bg-amber-50 border-b border-amber-200 px-3.5 sm:px-4 py-2 flex items-center justify-between gap-2 text-xs sm:text-[13px] text-amber-900">
          <span>
            {lastDeletedCount > 1
              ? `Đã xóa ${lastDeletedCount} dòng đã chọn.`
              : `Đã xóa Dòng #${deletedRowBackup ? deletedRowBackup.index + 1 : 1}.`}
          </span>
          {deletedRowBackup && lastDeletedCount <= 1 && (
            <button
              type="button"
              onClick={onRestoreBackup}
              className="inline-flex items-center gap-1 font-bold text-[#004776] hover:underline cursor-pointer shrink-0"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Tạo lại</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
