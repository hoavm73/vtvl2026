'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, FileSpreadsheet } from 'lucide-react';
import { SHORT_UNIT_GROUP_LABELS, UnitSummaryRow } from './UnitMonitoringTypes';

interface UnitMonitoringMobileCardsProps {
  rows: UnitSummaryRow[];
  selectedUnit: string;
  highlightedId?: string | null;
  onSelectUnit: (unitCode: string) => void;
  onAnchorClick: (unitCode: string) => void;
}

/**
 * Giao diện thẻ đơn vị dưới 768px cho Dashboard theo dõi 39 đơn vị, giữ vừa khít khung 390px
 * và gắn mốc cuộn data-row-anchor để khôi phục đúng vị trí khi quay lại.
 */
export function UnitMonitoringMobileCards({
  rows,
  selectedUnit,
  highlightedId,
  onSelectUnit,
  onAnchorClick
}: UnitMonitoringMobileCardsProps) {
  if (rows.length === 0) {
    return (
      <div className="md:hidden py-10 px-4 text-center text-xs text-[#20446c]">
        Không có đơn vị nào phù hợp với điều kiện lọc hiện tại.
      </div>
    );
  }

  return (
    <div className="md:hidden divide-y divide-[#e2e8f0]">
      {rows.map((u) => {
        const isSelected = selectedUnit === u.unitCode;
        const isHighlighted = highlightedId === u.unitCode;
        return (
          <div
            key={u.unitCode}
            data-row-anchor={u.unitCode}
            style={{ contentVisibility: 'auto' }}
            className={`px-3.5 py-3 space-y-2.5 transition-colors ${
              isHighlighted || isSelected
                ? 'bg-[#eef6ff] border-l-4 border-[#006cee]'
                : 'bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2 min-w-0">
              <button
                type="button"
                aria-label={`Chọn đơn vị ${u.unitCode} - ${u.unitNameVi}`}
                onClick={() => onSelectUnit(isSelected ? 'ALL' : u.unitCode)}
                className="text-left min-w-0 flex-1 flex items-start gap-2 cursor-pointer"
              >
                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[6px] bg-[#e1edf8] text-[#004776] shrink-0 mt-0.5">
                  {u.unitCode}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-[#004776] leading-snug break-words">{u.unitNameVi}</div>
                  <div className="text-[11px] text-[#20446c]/80">
                    {SHORT_UNIT_GROUP_LABELS[u.group] || u.groupLabel} · {u.accountCount} NS ({u.leaderCount} LĐ · {u.staffCount} CB)
                  </div>
                </div>
              </button>
              <span className="text-xs font-bold text-[#006cee] tabular-nums shrink-0">{u.progressPercent}%</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-[#20446c] tabular-nums">
                <span className="truncate">{u.stageLabel}</span>
                <span className="shrink-0">
                  Biểu: <strong className="text-[#004776]">{u.populatedSheetsCount}/{u.totalCoreSheets}</strong>
                  {u.populatedSheetsCount > 0 ? ` (v${u.workbookRevision})` : ''}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#e8eff7] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#006cee] to-[#00b87a] rounded-full" style={{ width: `${u.progressPercent}%` }} />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
              {u.draftCount > 0 && <span className="px-2 py-0.5 rounded-full bg-[#eef4fb] text-[#004776] font-semibold">Nháp: {u.draftCount}</span>}
              {u.submittedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-[#e6f1ff] text-[#006cee] font-semibold">Chờ duyệt: {u.submittedCount}</span>}
              {u.changesRequestedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-[#fff4e5] text-[#c26d00] font-semibold">Cần sửa: {u.changesRequestedCount}</span>}
              {u.approvedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-[#e6f9f1] text-[#008f5d] font-semibold">Đã duyệt: {u.approvedCount}</span>}
              {u.mergedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 font-semibold">Đã gộp: {u.mergedCount}</span>}
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <Link
                href={`/phieu-don-vi?unitCode=${encodeURIComponent(u.unitCode)}&tab=all`}
                aria-label={`Xem phiếu đơn vị ${u.unitCode}`}
                onClick={() => {
                  onAnchorClick(u.unitCode);
                  if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', u.unitCode);
                }}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#006cee] hover:bg-[#005ecc] text-xs font-semibold text-white transition-colors"
              >
                <span>Phiếu đơn vị</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <Link
                href={`/bang-tinh?unit=${encodeURIComponent(u.unitCode)}`}
                aria-label={`Mở bảng 10 biểu đơn vị ${u.unitCode}`}
                onClick={() => {
                  onAnchorClick(u.unitCode);
                  if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', u.unitCode);
                }}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-[#f1f5f9] hover:bg-[#e2e8f0] text-xs font-semibold text-[#004776] transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#006cee]" />
                <span>Bảng 10 biểu</span>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
