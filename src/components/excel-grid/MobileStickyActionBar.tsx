'use client';

import React from 'react';
import { ShieldCheck, AlertTriangle, Save, ArrowRight } from 'lucide-react';

interface MobileStickyActionBarProps {
  fixCount: number;
  isDirty: boolean;
  isSaving: boolean;
  isReadOnly: boolean;
  canNext: boolean;
  onOpenQualityModal: () => void;
  onSaveNow: () => void;
  onSaveAndNext: () => void;
}

/** Thanh Lưu & Kiểm tra bám đáy màn hình điện thoại (< 768px) để thao tác nhanh khi cuộn danh sách thẻ. */
export function MobileStickyActionBar({
  fixCount,
  isDirty,
  isSaving,
  isReadOnly,
  canNext,
  onOpenQualityModal,
  onSaveNow,
  onSaveAndNext
}: MobileStickyActionBarProps) {
  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#cbd5e1] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_-4px_rgba(0,71,118,0.12)] flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onOpenQualityModal}
        aria-label={fixCount > 0 ? `Kiểm tra chất lượng (${fixCount} mục cần sửa)` : 'Kiểm tra chất lượng dữ liệu'}
        className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
          fixCount > 0
            ? 'bg-[#fdeceb] border-[#f8b4af] text-[#b42318]'
            : 'bg-[#e3f5ec] border-[#a3e2c3] text-[#13653f]'
        }`}
      >
        {fixCount > 0 ? (
          <>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Kiểm tra ({fixCount})</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Kiểm tra</span>
          </>
        )}
      </button>

      <div className="flex items-center gap-2 min-w-0">
        {!isReadOnly && (
          <button
            type="button"
            onClick={onSaveNow}
            disabled={isSaving}
            className="relative min-h-[44px] px-3 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-bold text-[#004776] inline-flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-[#006cee] shrink-0" />
            <span>{isSaving ? 'Đang lưu…' : 'Lưu'}</span>
            {isDirty && !isSaving && (
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Có thay đổi chưa lưu" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onSaveAndNext}
          disabled={!canNext}
          className="min-h-[44px] px-4 rounded-xl bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <span>{isReadOnly ? 'Sang tiếp' : 'Lưu & tiếp'}</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>
      </div>
    </div>
  );
}
