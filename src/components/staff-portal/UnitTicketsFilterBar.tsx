'use client';

import React from 'react';
import { ChevronRight, RotateCcw, Search } from 'lucide-react';
import { ShadcnSelect, type ShadcnSelectOption } from '@/components/ui/ShadcnSelect';
import type { PendingSubFilter } from './unit-tickets-cascade-helpers';

export type UnitReviewMode = 'pending' | 'approved' | 'all';
export type { PendingSubFilter };
export type ApprovedSubFilter = 'ALL' | 'UNMERGED' | 'MERGED';

interface UnitTicketsFilterBarProps {
  mode: UnitReviewMode;
  search: string;
  onSearchChange: (value: string) => void;
  pendingSubFilter: PendingSubFilter;
  onPendingSubFilterChange: (value: PendingSubFilter) => void;
  pendingMissionFilter: string;
  onPendingMissionFilterChange: (value: string) => void;
  pendingMissionOptions: ShadcnSelectOption[];
  pendingOwnerFilter: string;
  onPendingOwnerFilterChange: (value: string) => void;
  pendingOwnerOptions: ShadcnSelectOption[];
  pendingStatusOptions: ShadcnSelectOption[];
  onResetPendingFilters: () => void;
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
  search,
  onSearchChange,
  pendingSubFilter,
  onPendingSubFilterChange,
  pendingMissionFilter,
  onPendingMissionFilterChange,
  pendingMissionOptions,
  pendingOwnerFilter,
  onPendingOwnerFilterChange,
  pendingOwnerOptions,
  pendingStatusOptions,
  onResetPendingFilters,
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

  const hasPendingActiveFilter =
    pendingMissionFilter !== 'ALL' ||
    pendingOwnerFilter !== 'ALL' ||
    pendingSubFilter !== 'ALL' ||
    search.trim().length > 0;

  return (
    <>
      {mode === 'pending' && (
        <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1.1fr)] gap-2.5 items-end">
            <div className="min-w-0">
              <label
                htmlFor="pending-mission-cascade-filter"
                className="flex items-center gap-1 text-[11px] font-semibold text-[#004776] mb-1"
              >
                <span>1. Nhiệm vụ</span>
                <ChevronRight className="w-3 h-3 text-[#0072BC]" aria-hidden="true" />
              </label>
              <ShadcnSelect
                id="pending-mission-cascade-filter"
                value={pendingMissionFilter}
                options={pendingMissionOptions}
                onValueChange={onPendingMissionFilterChange}
                ariaLabel="Lọc cấp 1 theo nhiệm vụ"
                size="sm"
                searchable
                searchableThreshold={5}
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor="pending-owner-cascade-filter"
                className="flex items-center gap-1 text-[11px] font-semibold text-[#004776] mb-1"
              >
                <span>2. Người khai</span>
                <ChevronRight className="w-3 h-3 text-[#0072BC]" aria-hidden="true" />
              </label>
              <ShadcnSelect
                id="pending-owner-cascade-filter"
                value={pendingOwnerFilter}
                options={pendingOwnerOptions}
                onValueChange={onPendingOwnerFilterChange}
                ariaLabel="Lọc cấp 2 theo người khai"
                size="sm"
                searchable
                searchableThreshold={5}
              />
            </div>
            <div className="min-w-0">
              <label
                htmlFor="pending-status-cascade-filter"
                className="block text-[11px] font-semibold text-[#004776] mb-1"
              >
                3. Trạng thái duyệt
              </label>
              <ShadcnSelect
                id="pending-status-cascade-filter"
                value={pendingSubFilter}
                options={pendingStatusOptions}
                onValueChange={(val) => onPendingSubFilterChange(val as PendingSubFilter)}
                ariaLabel="Lọc cấp 3 theo trạng thái duyệt (Chờ phê duyệt / Yêu cầu bổ sung)"
                size="sm"
                searchable={false}
              />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-[#20446c]/70 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="text"
                  aria-label="Tìm phiếu chờ duyệt theo mã công việc, tên việc hoặc người kê khai"
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Tìm mã việc, tên việc, người khai..."
                  className="w-full h-9 pl-8 pr-2.5 text-xs rounded-lg border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] outline-none"
                />
              </div>
              {hasPendingActiveFilter && (
                <button
                  type="button"
                  onClick={onResetPendingFilters}
                  title="Đặt lại bộ lọc"
                  aria-label="Đặt lại 3 bộ lọc và từ khóa tìm kiếm"
                  className="h-9 px-2.5 inline-flex items-center gap-1 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#004776] hover:bg-[#eef5ff] hover:border-[#006cee] transition-colors shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden xl:inline">Đặt lại</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'approved' && (
        <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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
        <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0] grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
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
