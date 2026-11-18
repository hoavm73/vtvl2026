'use client';

import React from 'react';
import Link from 'next/link';
import { Building2, ExternalLink, FileSpreadsheet, X, Filter } from 'lucide-react';
import { MonitorTotals, SHORT_UNIT_GROUP_LABELS, StageFilterKey, UnitSummaryRow } from './UnitMonitoringTypes';

interface UnitMonitoringKpiStripProps {
  selectedUnit: string;
  activeUnitRow: UnitSummaryRow | null;
  stageFilter: StageFilterKey;
  totals: MonitorTotals;
  onSelectStageFilter: (filter: StageFilterKey) => void;
  onClearUnit: () => void;
}

interface KpiCardSpec {
  filterKey: StageFilterKey;
  label: string;
  value: number;
  accentText: string;
  dotColor: string;
}

/**
 * Dải thẻ KPI tương tác, thanh tiêu điểm đơn vị và thanh tỷ trọng tiến trình chuẩn S-Link.
 */
export function UnitMonitoringKpiStrip({
  activeUnitRow,
  stageFilter,
  totals,
  onSelectStageFilter,
  onClearUnit
}: UnitMonitoringKpiStripProps) {
  const kpiCards: KpiCardSpec[] = [
    {
      filterKey: 'ALL',
      label: 'Tổng phiếu kê khai',
      value: totals.totalTickets,
      accentText: 'text-[#004776]',
      dotColor: 'bg-[#004776]'
    },
    { filterKey: 'has_draft', label: 'Lưu nháp', value: totals.draftCount, accentText: 'text-[#20446c]', dotColor: 'bg-[#94b2d0]' },
    { filterKey: 'has_pending', label: 'Gửi chờ duyệt', value: totals.submittedCount, accentText: 'text-[#006cee]', dotColor: 'bg-[#006cee]' },
    { filterKey: 'has_changes', label: 'Yêu cầu bổ sung', value: totals.changesRequestedCount, accentText: 'text-[#c26d00]', dotColor: 'bg-[#f99c00]' },
    { filterKey: 'has_approved', label: 'Đã phê duyệt', value: totals.approvedCount, accentText: 'text-[#008f5d]', dotColor: 'bg-[#00b87a]' },
    { filterKey: 'has_merged', label: 'Đã gộp B1/B2', value: totals.mergedCount, accentText: 'text-[#6d28d9]', dotColor: 'bg-[#7c3aed]' }
  ];

  const mergedOnly = Math.max(0, totals.mergedCount);
  const approvedUnmerged = Math.max(0, totals.approvedCount - mergedOnly);
  const totalBase = Math.max(1, mergedOnly + approvedUnmerged + totals.submittedCount + totals.changesRequestedCount + totals.draftCount);
  const pct = (count: number) => `${Math.round((count / totalBase) * 1000) / 10}%`;
  const approvedRate = totals.totalTickets > 0 ? Math.round((totals.approvedCount / totals.totalTickets) * 100) : 0;

  return (
    <div className="space-y-4">
      {activeUnitRow && (
        <div className="rounded-[14px] bg-[#f4f9ff] border border-[#cfe2f7] px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-[10px] bg-white flex items-center justify-center text-[#006cee] shrink-0">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-[6px] bg-[#004776] text-white">{activeUnitRow.unitCode}</span>
                <span className="text-sm font-bold text-[#004776] truncate">{activeUnitRow.unitNameVi}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#e1edf8] text-[#20446c]">
                  {SHORT_UNIT_GROUP_LABELS[activeUnitRow.group] || activeUnitRow.groupLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#20446c] mt-1 tabular-nums">
                <span>Tiến độ: <strong className="text-[#006cee]">{activeUnitRow.progressPercent}%</strong> ({activeUnitRow.stageLabel})</span>
                <span className="text-[#cbd5e1]">•</span>
                <span>Biểu mẫu: <strong className="text-[#004776]">{activeUnitRow.populatedSheetsCount}/{activeUnitRow.totalCoreSheets}</strong> (v{activeUnitRow.workbookRevision})</span>
                <span className="text-[#cbd5e1]">•</span>
                <span>Nhân sự: <strong className="text-[#004776]">{activeUnitRow.leaderCount} LĐ · {activeUnitRow.staffCount} CB</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href={`/phieu-don-vi?unitCode=${encodeURIComponent(activeUnitRow.unitCode)}&tab=all`}
              onClick={() => { if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', activeUnitRow.unitCode); }}
              className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-[10px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold transition-colors"
            >
              <span>Phiếu đơn vị</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/bang-tinh"
              onClick={() => { if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', activeUnitRow.unitCode); }}
              className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-[10px] bg-white hover:bg-[#e1edf8] text-[#004776] text-xs font-semibold transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#006cee]" />
              <span>Bảng 10 biểu</span>
            </Link>
            <button
              type="button"
              onClick={onClearUnit}
              className="inline-flex items-center gap-1 h-8.5 px-3 rounded-[10px] hover:bg-[#e1edf8] text-[#004776] text-xs font-semibold cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Toàn trường</span>
            </button>
          </div>
        </div>
      )}

      <div className="rounded-[14px] border border-[#e2e8f0] bg-white overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-y xl:divide-y-0 divide-[#e2e8f0]">
          {kpiCards.map((card) => {
            const isSelected = stageFilter === card.filterKey;
            return (
              <button
                key={card.filterKey}
                type="button"
                onClick={() => onSelectStageFilter(isSelected && card.filterKey !== 'ALL' ? 'ALL' : card.filterKey)}
                className={`group text-left px-4 py-3.5 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#006cee] ${
                  isSelected ? 'bg-[#eef6ff]' : 'bg-white hover:bg-[#f8fafc]'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#20446c] leading-snug break-words">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${card.dotColor}`} />
                    <span>{card.label}</span>
                  </span>
                  {isSelected && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#006cee] text-white text-[10px] font-semibold shrink-0">
                      <Filter className="w-2.5 h-2.5" /> Lọc
                    </span>
                  )}
                </div>
                <div className={`mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight ${card.accentText}`}>{card.value}</div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="w-full h-2 rounded-full overflow-hidden bg-[#e2e8f0] flex">
              {totals.totalTickets > 0 && (
                <>
                  {mergedOnly > 0 && <div className="h-full bg-[#7c3aed]" style={{ width: pct(mergedOnly) }} title={`Đã gộp B1/B2: ${mergedOnly}`} />}
                  {approvedUnmerged > 0 && <div className="h-full bg-[#00b87a]" style={{ width: pct(approvedUnmerged) }} title={`Đã duyệt chờ gộp: ${approvedUnmerged}`} />}
                  {totals.submittedCount > 0 && <div className="h-full bg-[#006cee]" style={{ width: pct(totals.submittedCount) }} title={`Gửi chờ duyệt: ${totals.submittedCount}`} />}
                  {totals.changesRequestedCount > 0 && <div className="h-full bg-[#f99c00]" style={{ width: pct(totals.changesRequestedCount) }} title={`Yêu cầu bổ sung: ${totals.changesRequestedCount}`} />}
                  {totals.draftCount > 0 && <div className="h-full bg-[#94b2d0]" style={{ width: pct(totals.draftCount) }} title={`Lưu nháp: ${totals.draftCount}`} />}
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-[#20446c]">
              <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#7c3aed]" /> Đã gộp B1/B2</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#00b87a]" /> Đã duyệt</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#006cee]" /> Chờ duyệt</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#f99c00]" /> Cần bổ sung</span>
              <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-[#94b2d0]" /> Lưu nháp</span>
            </div>
          </div>
          <div className="text-xs font-semibold text-[#004776] shrink-0 tabular-nums">
            Tỷ lệ phê duyệt: <span className="text-[#006cee] font-extrabold">{approvedRate}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
