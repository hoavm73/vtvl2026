'use client';

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ListPaginationBarProps {
  totalCount: number;
  visibleCount: number;
  step?: number;
  unitLabel?: string;
  onChangeVisibleCount: (next: number) => void;
}

/**
 * Thanh tải từng phần / phân trang gọn giúp giảm độ dài danh sách dài trên điện thoại
 * và giữ ổn định vị trí cuộn khi thêm hoặc thu gọn.
 */
export function ListPaginationBar({
  totalCount,
  visibleCount,
  step = 10,
  unitLabel = 'dòng',
  onChangeVisibleCount
}: ListPaginationBarProps) {
  if (totalCount === 0) return null;
  const shown = Math.min(visibleCount, totalCount);
  const remaining = Math.max(0, totalCount - shown);
  const nextStepCount = Math.min(step, remaining);

  return (
    <div className="px-3.5 py-2.5 bg-[#f8fbff] border-t border-[#e2ecf7] flex flex-wrap items-center justify-between gap-2 text-xs text-[#20446c]">
      <span className="tabular-nums font-medium">
        Hiển thị <strong className="font-bold text-[#004776]">1–{shown}</strong> / {totalCount} {unitLabel}
      </span>

      {totalCount > step && (
        <div className="flex flex-wrap items-center gap-1.5">
          {remaining > 0 && (
            <>
              <button
                type="button"
                onClick={() => onChangeVisibleCount(shown + step)}
                className="h-9 px-4 rounded-full bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                <span>Xem thêm {nextStepCount} {unitLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeVisibleCount(totalCount)}
                className="h-9 px-3.5 rounded-full bg-[#e1edf8] hover:bg-[#d3e4f5] text-[#004776] text-xs font-semibold cursor-pointer transition-colors"
              >
                Hiện tất cả ({totalCount})
              </button>
            </>
          )}
          {shown > step && (
            <button
              type="button"
              onClick={() => onChangeVisibleCount(step)}
              className="h-9 px-3.5 rounded-full bg-[#e1edf8] hover:bg-[#d3e4f5] text-[#004776] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5 shrink-0" />
              <span>Thu gọn về {step} {unitLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
