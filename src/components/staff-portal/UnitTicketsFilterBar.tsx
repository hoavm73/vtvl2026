'use client';

import React from 'react';
import { Building2, CheckCircle2, Clock, Search, Users } from 'lucide-react';
import { HCMUTE_UNITS } from '@/configs/hcmute-units';

export type UnitReviewMode = 'pending' | 'approved' | 'all';
export type PendingSubFilter = 'ALL' | 'WAITING' | 'CHANGES';
export type ApprovedSubFilter = 'ALL' | 'UNMERGED' | 'MERGED';

interface UnitTicketsFilterBarProps {
  mode: UnitReviewMode;
  isLeader: boolean;
  showUnitFilter?: boolean;
  unitFilter?: string;
  onUnitFilterChange?: (value: string) => void;
  unitCounts?: Record<string, number>;
  totalAllUnitsCount?: number;
  displayedCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  pendingSubFilter: PendingSubFilter;
  onPendingSubFilterChange: (value: PendingSubFilter) => void;
  waitingCount: number;
  changesCount: number;
  approvedSubFilter: ApprovedSubFilter;
  onApprovedSubFilterChange: (value: ApprovedSubFilter) => void;
  unmergedCount: number;
  mergedCount: number;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  ownerFilter: string;
  onOwnerFilterChange: (value: string) => void;
  missionFilter: string;
  onMissionFilterChange: (value: string) => void;
  owners: string[];
  missions: string[];
}

export function UnitTicketsFilterBar({
  mode,
  isLeader,
  showUnitFilter = false,
  unitFilter = 'ALL',
  onUnitFilterChange,
  unitCounts = {},
  totalAllUnitsCount = 0,
  displayedCount,
  search,
  onSearchChange,
  pendingSubFilter,
  onPendingSubFilterChange,
  waitingCount,
  changesCount,
  approvedSubFilter,
  onApprovedSubFilterChange,
  unmergedCount,
  mergedCount,
  statusFilter,
  onStatusFilterChange,
  ownerFilter,
  onOwnerFilterChange,
  missionFilter,
  onMissionFilterChange,
  owners,
  missions
}: UnitTicketsFilterBarProps) {
  const pillCls = (active: boolean) =>
    `h-8 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
      active
        ? 'bg-[#006cee] text-white border-[#006cee]'
        : 'bg-white text-[#004776] border-[#cbd5e1] hover:bg-[#eef5ff]'
    }`;

  const renderHeader = () => {
    if (mode === 'pending') {
      return (
        <>
          <Clock className="w-4 h-4 text-[#f99c00]" />
          <h2 className="text-base font-bold text-[#004776]">
            {isLeader ? 'Phiếu chờ duyệt & yêu cầu bổ sung' : 'Phiếu chờ duyệt & yêu cầu bổ sung của tôi'} ({displayedCount})
          </h2>
        </>
      );
    }
    if (mode === 'approved') {
      return (
        <>
          <CheckCircle2 className="w-4 h-4 text-[#00a86b]" />
          <h2 className="text-base font-bold text-[#004776]">
            {isLeader ? 'Phiếu đã duyệt' : 'Phiếu đã duyệt của tôi'} ({displayedCount})
          </h2>
        </>
      );
    }
    return (
      <>
        <Users className="w-4 h-4 text-[#006cee]" />
        <h2 className="text-base font-bold text-[#004776]">
          {isLeader ? 'Toàn bộ phiếu của đơn vị' : 'Phiếu toàn đơn vị (Chỉ đọc)'} ({displayedCount})
        </h2>
      </>
    );
  };

  return (
    <>
      <div className="px-5 py-3.5 bg-[#fafcff] border-b border-[#e8eff7] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">{renderHeader()}</div>
        {showUnitFilter && onUnitFilterChange && (
          <div className="flex items-center gap-2 min-w-[240px] sm:min-w-[320px]">
            <label htmlFor="unit-tickets-unit-filter" className="inline-flex items-center gap-1 text-xs font-bold text-[#004776] whitespace-nowrap">
              <Building2 className="w-3.5 h-3.5 text-[#006cee]" />
              <span>Đơn vị:</span>
            </label>
            <select
              id="unit-tickets-unit-filter"
              value={unitFilter}
              onChange={(e) => onUnitFilterChange(e.target.value)}
              aria-label="Lọc phiếu theo đơn vị"
              className="flex-1 min-h-[40px] sm:h-8.5 px-2.5 text-xs font-semibold rounded-lg border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả 39 đơn vị toàn trường ({totalAllUnitsCount} phiếu)</option>
              {HCMUTE_UNITS.map((u) => {
                const cnt = unitCounts[u.code.toUpperCase()] || 0;
                return (
                  <option key={u.code} value={u.code}>
                    [{u.code}] {u.nameVi} ({cnt} phiếu)
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {mode === 'pending' && (
        <div className="p-3 bg-[#f8fbff] border-b border-[#e8eff7] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#20446c]/70 absolute left-2.5 top-2.5" aria-hidden="true" />
            <input
              type="text"
              aria-label="Tìm phiếu chờ duyệt theo mã công việc, tên việc hoặc người kê khai"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm theo mã công việc, tên việc, người kê khai..."
              className="w-full min-h-[40px] sm:h-8 pl-8 pr-2.5 text-xs rounded-lg border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => onPendingSubFilterChange('ALL')} className={pillCls(pendingSubFilter === 'ALL')}>
              Tất cả ({waitingCount + changesCount})
            </button>
            <button type="button" onClick={() => onPendingSubFilterChange('WAITING')} className={pillCls(pendingSubFilter === 'WAITING')}>
              Chờ phê duyệt ({waitingCount})
            </button>
            <button type="button" onClick={() => onPendingSubFilterChange('CHANGES')} className={pillCls(pendingSubFilter === 'CHANGES')}>
              Yêu cầu bổ sung ({changesCount})
            </button>
          </div>
        </div>
      )}

      {mode === 'approved' && (
        <div className="p-3 bg-[#f8fbff] border-b border-[#e8eff7] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#20446c]/70 absolute left-2.5 top-2.5" aria-hidden="true" />
            <input
              type="text"
              aria-label="Tìm phiếu đã duyệt theo mã, tên việc hoặc người kê khai"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm phiếu đã duyệt theo mã, tên việc, người kê khai..."
              className="w-full min-h-[40px] sm:h-8 pl-8 pr-2.5 text-xs rounded-lg border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => onApprovedSubFilterChange('ALL')} className={pillCls(approvedSubFilter === 'ALL')}>
              Tất cả ({unmergedCount + mergedCount})
            </button>
            <button type="button" onClick={() => onApprovedSubFilterChange('UNMERGED')} className={pillCls(approvedSubFilter === 'UNMERGED')}>
              Chưa gộp B1/B2 ({unmergedCount})
            </button>
            <button type="button" onClick={() => onApprovedSubFilterChange('MERGED')} className={pillCls(approvedSubFilter === 'MERGED')}>
              Đã gộp B1/B2 ({mergedCount})
            </button>
          </div>
        </div>
      )}

      {mode === 'all' && (
        <div className="p-3 bg-[#f8fbff] border-b border-[#e8eff7] grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#20446c]/70 absolute left-2.5 top-2.5" aria-hidden="true" />
            <input
              type="text"
              aria-label="Tìm theo tên việc, mã công việc hoặc người kê khai"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm theo tên việc, mã, người..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] outline-none"
            />
          </div>
          <select aria-label="Lọc theo trạng thái phiếu" value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] outline-none">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="submitted">Đã nộp</option>
            <option value="resubmitted">Đã nộp lại</option>
            <option value="approved">Đã duyệt</option>
            <option value="changes_requested">Yêu cầu bổ sung</option>
            <option value="draft">Nháp</option>
          </select>
          <select aria-label="Lọc theo người kê khai" value={ownerFilter} onChange={(e) => onOwnerFilterChange(e.target.value)} className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] outline-none">
            <option value="ALL">Tất cả người kê khai</option>
            {owners.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
          <select aria-label="Lọc theo mã nhiệm vụ Biểu A1" value={missionFilter} onChange={(e) => onMissionFilterChange(e.target.value)} className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] outline-none">
            <option value="ALL">Tất cả nhiệm vụ (A1)</option>
            {missions.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        </div>
      )}
    </>
  );
}
