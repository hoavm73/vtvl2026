'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, FileSpreadsheet, ExternalLink, ArrowUpDown, X, FlaskConical } from 'lucide-react';
import { HCMUTE_UNITS, UNIT_GROUPS } from '@/configs/hcmute-units';
import { SHORT_UNIT_GROUP_LABELS, StageFilterKey, UnitSummaryRow } from './UnitMonitoringTypes';

interface UnitMonitoringTableProps {
  selectedUnit: string;
  selectedGroup: string;
  stageFilter: StageFilterKey;
  searchQuery: string;
  includeTest: boolean;
  filteredUnitRows: UnitSummaryRow[];
  onSelectUnit: (unitCode: string) => void;
  onSelectGroup: (group: string) => void;
  onResetStageFilter: () => void;
  onChangeSearch: (q: string) => void;
  onToggleIncludeTest: (val: boolean) => void;
}

type ActivityMode = 'all' | 'active' | 'empty';

const GROUP_COUNTS: Record<string, number> = UNIT_GROUPS.reduce(
  (acc, g) => ({ ...acc, [g.id]: HCMUTE_UNITS.filter((u) => u.group === g.id).length }),
  {}
);

function renderCountPill(value: number, activeClass: string) {
  if (value <= 0) return <span className="text-[#20446c]/30 font-normal select-none tabular-nums">—</span>;
  return (
    <span className={`inline-flex items-center justify-center min-w-[24px] px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${activeClass}`}>
      {value}
    </span>
  );
}

/**
 * Bảng theo dõi tiến trình 39 đơn vị thiết kế phẳng, tối ưu mật độ & ưu tiên đơn vị đang triển khai.
 */
export function UnitMonitoringTable({
  selectedUnit,
  selectedGroup,
  stageFilter,
  searchQuery,
  includeTest,
  filteredUnitRows,
  onSelectUnit,
  onSelectGroup,
  onResetStageFilter,
  onChangeSearch,
  onToggleIncludeTest
}: UnitMonitoringTableProps) {
  const [activityMode, setActivityMode] = useState<ActivityMode>('all');
  const [sortByActivity, setSortByActivity] = useState<boolean>(true);

  const displayRows = useMemo(() => {
    const byMode = filteredUnitRows.filter((u) => {
      const hasData = u.totalTickets > 0 || u.populatedSheetsCount > 0;
      if (activityMode === 'active') return hasData;
      if (activityMode === 'empty') return !hasData;
      return true;
    });
    if (!sortByActivity) return byMode;
    return [...byMode].sort((a, b) => {
      const aActive = a.totalTickets > 0 || a.populatedSheetsCount > 0 ? 1 : 0;
      const bActive = b.totalTickets > 0 || b.populatedSheetsCount > 0 ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;
      if (b.submittedCount !== a.submittedCount) return b.submittedCount - a.submittedCount;
      if (b.totalTickets !== a.totalTickets) return b.totalTickets - a.totalTickets;
      if (b.progressPercent !== a.progressPercent) return b.progressPercent - a.progressPercent;
      return a.unitCode.localeCompare(b.unitCode);
    });
  }, [filteredUnitRows, activityMode, sortByActivity]);

  return (
    <div className="bg-white rounded-2xl border border-[#dbe8f5] shadow-[0_2px_14px_-4px_rgba(0,71,118,0.05)] overflow-hidden">
      {/* Thanh công cụ 1 dòng gọn gàng */}
      <div className="px-4 py-3 border-b border-[#e8eff7] bg-[#fafcff] flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectGroup('ALL')}
            className={`h-8 px-3 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
              selectedGroup === 'ALL' ? 'bg-[#004776] text-white shadow-2xs' : 'bg-white text-[#20446c] border border-[#d8e3ef] hover:bg-[#eef5ff] hover:text-[#004776]'
            }`}
          >
            Tất cả ({HCMUTE_UNITS.length})
          </button>
          {UNIT_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              className={`h-8 px-3 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                selectedGroup === g.id ? 'bg-[#004776] text-white shadow-2xs' : 'bg-white text-[#20446c] border border-[#d8e3ef] hover:bg-[#eef5ff] hover:text-[#004776]'
              }`}
            >
              {SHORT_UNIT_GROUP_LABELS[g.id] || g.label} ({GROUP_COUNTS[g.id] || 0})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center p-0.5 rounded-full bg-[#eef4fb] border border-[#dbe8f5]">
            {([{ id: 'all', label: 'Tất cả' }, { id: 'active', label: 'Có dữ liệu' }, { id: 'empty', label: 'Chưa kê khai' }] as const).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActivityMode(m.id)}
                className={`h-7 px-2.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
                  activityMode === m.id ? 'bg-white text-[#004776] shadow-2xs' : 'text-[#20446c] hover:text-[#004776]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#20446c]/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onChangeSearch(e.target.value)}
              placeholder="Tìm mã hoặc tên đơn vị…"
              className="h-9 pl-8 pr-7 w-48 sm:w-52 rounded-full border border-[#cbd5e1] bg-white text-xs text-[#004776] leading-normal outline-none focus:border-[#006cee] focus:ring-2 focus:ring-[#006cee]/15"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => onChangeSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#20446c]/60 hover:text-[#004776] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onToggleIncludeTest(!includeTest)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
              includeTest ? 'bg-[#fff4e5] text-[#c26d00] border-[#fcd34d]' : 'bg-white text-[#20446c] border-[#d8e3ef] hover:bg-[#eef5ff]'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Phiếu thử (CK)</span>
          </button>
        </div>
      </div>

      {stageFilter !== 'ALL' && (
        <div className="px-4 py-2 bg-[#f4f9ff] border-b border-[#dbe8f5] flex items-center justify-between text-xs text-[#004776]">
          <span>Đang lọc theo thẻ KPI — hiển thị <strong>{displayRows.length}</strong> đơn vị phù hợp.</span>
          <button type="button" onClick={onResetStageFilter} className="font-semibold text-[#006cee] hover:underline cursor-pointer">
            Hiển thị tất cả đơn vị
          </button>
        </div>
      )}

      <div className="overflow-x-auto max-h-[420px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#f4f8fc] text-[#004776] sticky top-0 z-10 border-b border-[#dbe8f5] text-[11.5px] font-semibold">
            <tr>
              <th className="py-2.5 px-4">
                <div className="flex items-center gap-2">
                  <span>Đơn vị ({displayRows.length})</span>
                  <button
                    type="button"
                    onClick={() => setSortByActivity(!sortByActivity)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#d8e3ef] text-[10.5px] font-semibold text-[#20446c] hover:text-[#006cee] cursor-pointer"
                    title="Đổi cách sắp xếp danh sách đơn vị"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>{sortByActivity ? 'Ưu tiên hoạt động' : 'Theo danh mục'}</span>
                  </button>
                </div>
              </th>
              <th className="py-2.5 px-3">Tiến trình</th>
              <th className="py-2.5 px-2 text-center">Lưu nháp</th>
              <th className="py-2.5 px-2 text-center">Gửi duyệt</th>
              <th className="py-2.5 px-2 text-center">Cần sửa</th>
              <th className="py-2.5 px-2 text-center">Đã duyệt</th>
              <th className="py-2.5 px-2 text-center">Đã gộp B1/B2</th>
              <th className="py-2.5 px-2.5 text-center">Biểu đã nhập</th>
              <th className="py-2.5 px-2.5 text-center">Nhân sự</th>
              <th className="py-2.5 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef3f8]">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-xs text-[#20446c]">Không có đơn vị nào phù hợp với điều kiện lọc hiện tại.</td>
              </tr>
            ) : (
              displayRows.map((u) => {
                const isSelected = selectedUnit === u.unitCode;
                return (
                  <tr
                    key={u.unitCode}
                    className={`transition-colors ${isSelected ? 'bg-[#eef6ff]/90 shadow-[inset_3px_0_0_0_#006cee]' : 'bg-white hover:bg-[#f7fbff]'}`}
                  >
                    <td className="py-2.5 px-4">
                      <button type="button" onClick={() => onSelectUnit(isSelected ? 'ALL' : u.unitCode)} className="text-left group cursor-pointer flex items-start gap-2">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#e1edf8] text-[#004776] group-hover:bg-[#006cee] group-hover:text-white transition-colors shrink-0 mt-0.5">
                          {u.unitCode}
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#004776] group-hover:text-[#006cee] leading-snug">{u.unitNameVi}</div>
                          <div className="text-[11px] text-[#20446c]/80">{SHORT_UNIT_GROUP_LABELS[u.group] || u.groupLabel}</div>
                        </div>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 min-w-[160px]">
                      <div className="flex items-center justify-between text-[11px] font-semibold mb-1 tabular-nums">
                        <span className="text-[#20446c] truncate max-w-[120px]">{u.stageLabel}</span>
                        <span className="text-[#006cee] font-bold">{u.progressPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#e8eff7] overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#006cee] to-[#00b87a] rounded-full transition-all" style={{ width: `${u.progressPercent}%` }} />
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">{renderCountPill(u.draftCount, 'bg-[#eef4fb] text-[#004776]')}</td>
                    <td className="py-2.5 px-2 text-center">{renderCountPill(u.submittedCount, 'bg-[#e6f1ff] text-[#006cee]')}</td>
                    <td className="py-2.5 px-2 text-center">{renderCountPill(u.changesRequestedCount, 'bg-[#fff4e5] text-[#c26d00]')}</td>
                    <td className="py-2.5 px-2 text-center">{renderCountPill(u.approvedCount, 'bg-[#e6f9f1] text-[#008f5d]')}</td>
                    <td className="py-2.5 px-2 text-center">{renderCountPill(u.mergedCount, 'bg-purple-50 text-purple-800')}</td>
                    <td className="py-2.5 px-2.5 text-center font-semibold text-[#20446c] tabular-nums whitespace-nowrap">
                      {u.populatedSheetsCount > 0 ? `${u.populatedSheetsCount}/${u.totalCoreSheets} (v${u.workbookRevision})` : <span className="text-[#20446c]/35 font-normal">0/{u.totalCoreSheets}</span>}
                    </td>
                    <td className="py-2.5 px-2.5 text-center text-[11px] text-[#20446c] tabular-nums whitespace-nowrap">
                      <strong className="text-[#004776]">{u.accountCount}</strong> ({u.leaderCount} LĐ · {u.staffCount} CB)
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/phieu-cong-viec?unitCode=${encodeURIComponent(u.unitCode)}&tab=unit`}
                          onClick={() => { if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', u.unitCode); }}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-[#d8e3ef] bg-white hover:bg-[#eef5ff] hover:border-[#006cee]/40 text-[11px] font-semibold text-[#004776] transition-colors"
                        >
                          <span>Phiếu</span>
                          <ExternalLink className="w-3 h-3 text-[#006cee]" />
                        </Link>
                        <Link
                          href="/bang-tinh"
                          onClick={() => { if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', u.unitCode); }}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-[#d8e3ef] bg-white hover:bg-[#eef5ff] hover:border-[#006cee]/40 text-[11px] font-semibold text-[#004776] transition-colors"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-[#006cee]" />
                          <span>15 biểu</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
