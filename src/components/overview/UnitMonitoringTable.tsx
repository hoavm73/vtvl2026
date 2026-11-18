'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, ExternalLink, ArrowUpDown, FlaskConical, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { HCMUTE_UNITS, UNIT_GROUPS } from '@/configs/hcmute-units';
import { SHORT_UNIT_GROUP_LABELS, StageFilterKey, UnitSummaryRow } from './UnitMonitoringTypes';
import { MonitorSearchInput } from './MonitorSearchInput';
import { UnitMonitoringMobileCards } from './UnitMonitoringMobileCards';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import { usePersistedListState } from '@/services/query/use-persisted-list-state';

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

/** Bảng & danh sách thẻ theo dõi tiến trình 39 đơn vị (tải từng phần 10 dòng, giữ nguyên vị trí cuộn & bộ lọc). */
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
  const { state, setField, patchFields, highlightedId, saveScrollAnchor } = usePersistedListState(
    'unit-monitor-table',
    { mode: 'all', sortAct: true, limit: 10 },
    { readyToScroll: filteredUnitRows.length > 0 }
  );
  const activityMode = (state.mode === 'active' || state.mode === 'empty' ? state.mode : 'all') as ActivityMode;
  const sortByActivity = Boolean(state.sortAct);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [listExpanded, setListExpanded] = useState(true);

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

  const visibleRows = useMemo(() => displayRows.slice(0, state.limit), [displayRows, state.limit]);

  return (
    <div className="bg-white rounded-[16px] border border-[#e2e8f0] overflow-hidden min-w-0">
      {/* Header khu vực Danh sách đơn vị + Nút Đóng/Mở & Bộ lọc Mobile */}
      <div className="px-4 py-3.5 border-b border-[#e2e8f0] bg-white flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setListExpanded((v) => !v)}
          aria-expanded={listExpanded}
          className="inline-flex items-center gap-2 text-sm sm:text-base font-bold text-[#0072BC] cursor-pointer"
        >
          <span>Danh sách đơn vị ({displayRows.length})</span>
          <ChevronDown className={`w-4 h-4 text-[#476885] transition-transform ${listExpanded ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setShowMobileFilters((v) => !v)}
            aria-expanded={showMobileFilters}
            className={`min-h-[38px] px-3 rounded-[10px] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
              showMobileFilters || selectedGroup !== 'ALL' || activityMode !== 'all' || includeTest
                ? 'bg-[#eef5ff] text-[#006cee]'
                : 'bg-[#f1f5f9] text-[#004776]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Bộ lọc</span>
          </button>
        </div>
      </div>

      {listExpanded && (
        <>
      {/* Thanh công cụ lọc nhóm & tìm kiếm */}
      <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc] flex-col xl:flex-row xl:items-center justify-between gap-2.5 min-w-0`}>
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {[{ id: 'ALL', label: `Tất cả (${HCMUTE_UNITS.length})` }, ...UNIT_GROUPS.map((g) => ({ id: g.id, label: `${SHORT_UNIT_GROUP_LABELS[g.id] || g.label} (${GROUP_COUNTS[g.id] || 0})` }))].map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => { onSelectGroup(g.id); setField('limit', 10); }}
              className={`h-8 px-3 rounded-full text-xs font-semibold cursor-pointer transition-colors ${selectedGroup === g.id ? 'bg-[#006cee] text-white' : 'bg-white text-[#20446c] hover:bg-[#eef5ff] hover:text-[#004776]'}`}
            >{g.label}</button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto min-w-0">
          <div className="inline-flex items-center p-0.5 rounded-[10px] bg-[#e9f0f8] max-w-full overflow-x-auto no-scrollbar">
            {([{ id: 'all', label: 'Tất cả' }, { id: 'active', label: 'Có dữ liệu' }, { id: 'empty', label: 'Chưa kê khai' }] as const).map((m) => (
              <button key={m.id} type="button" onClick={() => patchFields({ mode: m.id, limit: 10 })} className={`h-7 px-2.5 rounded-[8px] text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${activityMode === m.id ? 'bg-white text-[#004776]' : 'text-[#20446c] hover:text-[#004776]'}`}>
                {m.label}
              </button>
            ))}
          </div>

          <MonitorSearchInput
            value={searchQuery}
            onChange={(q) => { onChangeSearch(q); setField('limit', q.trim() ? 39 : 10); }}
            placeholder="Tìm mã hoặc tên đơn vị…"
            ariaLabel="Tìm kiếm mã hoặc tên đơn vị"
            className="w-full sm:w-60 min-w-0"
          />

          <button type="button" onClick={() => onToggleIncludeTest(!includeTest)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] text-xs font-semibold cursor-pointer transition-colors ${includeTest ? 'bg-[#fff4e5] text-[#c26d00]' : 'bg-white text-[#20446c] hover:bg-[#eef5ff]'}`}>
            <FlaskConical className="w-3.5 h-3.5" /><span>Phiếu thử (CK)</span>
          </button>
        </div>
      </div>

      {stageFilter !== 'ALL' && (
        <div className="px-4 py-2 bg-[#f4f9ff] border-b border-[#e2e8f0] flex items-center justify-between gap-2 text-xs text-[#004776]">
          <span>Đang lọc theo thẻ KPI — hiển thị <strong>{displayRows.length}</strong> đơn vị phù hợp.</span>
          <button type="button" onClick={onResetStageFilter} className="font-semibold text-[#006cee] hover:underline cursor-pointer shrink-0">
            Hiển thị tất cả đơn vị
          </button>
        </div>
      )}

      {/* Mobile: Danh sách phân cách bằng đường kẻ */}
      <UnitMonitoringMobileCards
        rows={visibleRows}
        selectedUnit={selectedUnit}
        highlightedId={highlightedId}
        onSelectUnit={onSelectUnit}
        onAnchorClick={saveScrollAnchor}
      />

      {/* Desktop / Tablet: Bảng tổng hợp đầy đủ cột */}
      <div className="hidden md:block overflow-x-auto max-h-[480px]">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-[#f8fafc] text-[#004776] sticky top-0 z-10 border-b border-[#e2e8f0] text-[11.5px] font-semibold">
            <tr>
              <th className="py-2.5 px-4">
                <div className="flex items-center gap-2">
                  <span>Đơn vị ({displayRows.length})</span>
                  <button
                    type="button"
                    onClick={() => setField('sortAct', !sortByActivity)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] bg-[#eef4fb] text-[10.5px] font-semibold text-[#20446c] hover:text-[#006cee] cursor-pointer"
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
          <tbody className="divide-y divide-[#e2e8f0]">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-xs text-[#20446c]">Không có đơn vị nào phù hợp với điều kiện lọc hiện tại.</td>
              </tr>
            ) : (
              visibleRows.map((u) => {
                const isSelected = selectedUnit === u.unitCode;
                const isHighlighted = highlightedId === u.unitCode;
                return (
                  <tr
                    key={u.unitCode}
                    data-row-anchor={u.unitCode}
                    className={`transition-colors ${isHighlighted || isSelected ? 'bg-[#eef6ff]' : 'bg-white hover:bg-[#f8fafc]'}`}
                  >
                    <td className="py-2.5 px-4">
                      <button type="button" onClick={() => onSelectUnit(isSelected ? 'ALL' : u.unitCode)} className="text-left group cursor-pointer flex items-start gap-2">
                        <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-[6px] bg-[#e1edf8] text-[#004776] group-hover:bg-[#006cee] group-hover:text-white transition-colors shrink-0 mt-0.5">{u.unitCode}</span>
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
                        <Link href={`/nghiep-vu-don-vi?unitCode=${encodeURIComponent(u.unitCode)}`} onClick={() => { saveScrollAnchor(u.unitCode); if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', u.unitCode); }} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[8px] bg-[#eef5ff] hover:bg-[#dce8f5] text-[11px] font-semibold text-[#006cee] transition-colors">
                          <span>Hồ sơ ĐV</span>
                        </Link>
                        <Link href={`/phieu-don-vi?unitCode=${encodeURIComponent(u.unitCode)}&tab=all`} onClick={() => { saveScrollAnchor(u.unitCode); if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', u.unitCode); }} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[8px] bg-[#f1f5f9] hover:bg-[#e1edf8] text-[11px] font-semibold text-[#004776] transition-colors">
                          <span>Phiếu</span><ExternalLink className="w-3 h-3 text-[#006cee]" />
                        </Link>
                        <Link href={`/bang-tinh?unit=${encodeURIComponent(u.unitCode)}`} onClick={() => { saveScrollAnchor(u.unitCode); if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', u.unitCode); }} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[8px] bg-[#f1f5f9] hover:bg-[#e1edf8] text-[11px] font-semibold text-[#004776] transition-colors">
                          <FileSpreadsheet className="w-3 h-3 text-[#006cee]" /><span>10 biểu</span>
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

      <ListPaginationBar
        totalCount={displayRows.length}
        visibleCount={state.limit}
        step={10}
        unitLabel="đơn vị"
        onChangeVisibleCount={(n) => setField('limit', n)}
      />
        </>
      )}
    </div>
  );
}
