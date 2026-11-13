'use client';

import React from 'react';
import { AlertTriangle, Undo2, Trash2 } from 'lucide-react';
import { GenericGridRow } from './excel-grid-types';

interface TableDeleteConfirmModalProps {
  confirmDeleteId: string | null;
  selectedCount?: number;
  lastDeletedCount?: number;
  deletedRowBackup: { row: GenericGridRow; index: number } | null;
  onCancel: () => void;
  onConfirm: () => void;
  onRestoreBackup: () => void;
}

export function TableDeleteConfirmModal({
  confirmDeleteId,
  selectedCount = 0,
  lastDeletedCount = 0,
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
          role="alert"
          className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px] text-rose-900"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              {isBulk
                ? `Xác nhận xóa ${countToDisplay} dòng dữ liệu đã chọn? Sau khi xóa vẫn có thể thêm lại.`
                : 'Xác nhận xóa dòng dữ liệu đang chọn? Sau khi xóa vẫn có thể thêm lại.'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="h-8 px-3 text-xs font-bold text-[#004776] bg-white border border-[#cbd5e1] rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center gap-1 h-8 px-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isBulk ? `Xóa ${countToDisplay} dòng` : 'Xóa dòng'}</span>
            </button>
          </div>
        </div>
      )}

      {(deletedRowBackup || lastDeletedCount > 0) && !confirmDeleteId && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-[13px] text-amber-900">
          <span>
            {lastDeletedCount > 1
              ? `Đã xóa ${lastDeletedCount} dòng đã chọn.`
              : `Đã xóa dòng #${deletedRowBackup ? deletedRowBackup.index + 1 : 1}.`}
          </span>
          {deletedRowBackup && lastDeletedCount <= 1 && (
            <button
              type="button"
              onClick={onRestoreBackup}
              className="inline-flex items-center gap-1 font-bold text-[#004776] hover:underline cursor-pointer"
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
