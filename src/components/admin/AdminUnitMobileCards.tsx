'use client';

import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { HcmuteUnit, UnitGroupKind } from '@/types/vtvl';

const GROUP_LABELS: Record<UnitGroupKind, string> = {
  'khoa-vien': 'Khoa - Viện đào tạo',
  'phong-ban': 'Phòng ban quản lý',
  'trung-tam': 'Trung tâm - Phân hiệu',
  'dang-doanthe': 'Quản trị - Đoàn thể'
};

interface AdminUnitMobileCardsProps {
  units: HcmuteUnit[];
  highlightedId?: string | null;
  onEdit: (unit: HcmuteUnit) => void;
  onDelete: (code: string) => void;
}

/** Hiển thị danh sách đơn vị dạng thẻ 100% chiều rộng dưới 768px để không tràn ngang màn hình điện thoại. */
export function AdminUnitMobileCards({
  units,
  highlightedId,
  onEdit,
  onDelete
}: AdminUnitMobileCardsProps) {
  if (units.length === 0) {
    return (
      <div className="md:hidden p-8 text-center text-xs text-[#476885]">
        Không tìm thấy đơn vị phù hợp với bộ lọc hiện tại.
      </div>
    );
  }

  return (
    <div className="md:hidden divide-y divide-[#e2e8f0]">
      {units.map((u, idx) => {
        const isHighlighted = highlightedId === u.code;
        return (
          <div
            key={u.code}
            data-row-anchor={u.code}
            style={{ contentVisibility: 'auto' }}
            className={`px-3.5 py-3 space-y-2 transition-colors ${
              isHighlighted ? 'bg-[#eef6ff]' : 'bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <span className="text-[11px] font-bold text-[#476885] tabular-nums shrink-0 mt-0.5">
                  #{idx + 1}
                </span>
                <span className="px-2 py-0.5 rounded-[6px] bg-[#eef5ff] text-[#004776] font-bold text-xs shrink-0">
                  {u.code}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#004776] leading-snug break-words">{u.nameVi}</div>
                  {u.nameEn && <div className="text-[11px] text-[#476885] break-words mt-0.5">{u.nameEn}</div>}
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#eef5ff] text-[#004776] tabular-nums shrink-0">
                ĐB: {u.defaultStaffCount || 10}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#476885]">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#004776] font-medium">
                  {GROUP_LABELS[u.group] || u.group}
                </span>
                <span className="truncate">{u.headTitleVi || 'Trưởng đơn vị'}</span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onEdit(u)}
                  className="h-8 px-2.5 inline-flex items-center gap-1 text-xs font-semibold text-[#006cee] hover:bg-[#eef5ff] rounded-[8px] transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Sửa</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(u.code)}
                  aria-label={`Xóa đơn vị ${u.code}`}
                  className="h-8 w-8 inline-flex items-center justify-center text-red-600 hover:bg-red-50 rounded-[8px] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
