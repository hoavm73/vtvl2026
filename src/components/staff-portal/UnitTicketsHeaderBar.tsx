'use client';

import React from 'react';
import Link from 'next/link';
import {
  Building2, CheckCircle2, ClipboardCheck, Clock, FileEdit, FileSpreadsheet, RefreshCw, ShieldCheck, Upload, Users
} from 'lucide-react';
import { HCMUTE_UNITS, findHcmuteUnit } from '@/configs/hcmute-units';
import { UnitReviewMode } from '@/components/staff-portal/UnitTicketsFilterBar';
import { PageHeaderActions, useSetPageBreadcrumbs } from '@/components/layout/PageHeaderContext';

interface UnitTicketsHeaderBarProps {
  isAdmin: boolean;
  sessionUnitCode: string;
  sessionUnitNameVi: string;
  selectedUnit: string;
  totalTicketsCount: number;
  scopedCount: number;
  pendingCount: number;
  approvedCount: number;
  draftCount?: number;
  unitCounts: Record<string, number>;
  mode: UnitReviewMode;
  loading: boolean;
  onSelectUnit: (unit: string) => void;
  onSelectMode: (mode: UnitReviewMode) => void;
  onRefresh: () => void;
  onOpenBulkImport?: () => void;
}

export function UnitTicketsHeaderBar({
  isAdmin,
  sessionUnitCode,
  sessionUnitNameVi,
  selectedUnit,
  totalTicketsCount,
  scopedCount,
  pendingCount,
  approvedCount,
  draftCount = 0,
  unitCounts,
  mode,
  loading,
  onSelectUnit,
  onSelectMode,
  onRefresh,
  onOpenBulkImport
}: UnitTicketsHeaderBarProps) {
  const currentUnitDef = selectedUnit !== 'ALL' ? findHcmuteUnit(selectedUnit) : null;
  const activeUnitTitle = isAdmin
    ? (selectedUnit === 'ALL' ? 'Toàn trường (39 đơn vị HCM-UTE)' : `${currentUnitDef?.nameVi} (${currentUnitDef?.code})`)
    : `${sessionUnitNameVi} (${sessionUnitCode})`;
  const activeUnitQuery = encodeURIComponent(selectedUnit === 'ALL' ? sessionUnitCode : selectedUnit);

  useSetPageBreadcrumbs([
    { label: 'Tổng quan', href: '/' },
    { label: 'Nghiệp vụ đơn vị', href: `/nghiep-vu-don-vi?unitCode=${activeUnitQuery}` },
    { label: 'Quản lý phiếu đơn vị', icon: 'tickets' }
  ]);

  const actionControls = (
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && (
        <select
          value={selectedUnit}
          onChange={(e) => onSelectUnit(e.target.value)}
          aria-label="Chọn đơn vị cần xem và xử lý phiếu"
          className="h-9 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fbff] text-xs font-bold text-[#004776] focus:border-[#006cee] outline-none cursor-pointer max-w-[230px]"
        >
          <option value="ALL">Tất cả 39 đơn vị ({totalTicketsCount} phiếu)</option>
          {HCMUTE_UNITS.map((u) => (
            <option key={u.code} value={u.code}>
              [{u.code}] {u.nameVi} ({unitCounts[u.code.toUpperCase()] || 0} phiếu)
            </option>
          ))}
        </select>
      )}
      {isAdmin && onOpenBulkImport && (
        <button
          type="button"
          onClick={onOpenBulkImport}
          className="h-9 px-3 rounded-lg border border-[#0072BC]/40 bg-[#eef6ff] hover:bg-[#dbeeff] text-xs font-semibold text-[#0072BC] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5" /><span>Nhập Excel A2</span>
        </button>
      )}
      <Link href={`/nghiep-vu-don-vi?unitCode=${activeUnitQuery}`} className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] inline-flex items-center gap-1.5 whitespace-nowrap">
        <Building2 className="w-3.5 h-3.5 text-[#0072BC]" /><span>Hồ sơ đơn vị</span>
      </Link>
      <Link href={`/bang-tinh?unit=${activeUnitQuery}`} className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] inline-flex items-center gap-1.5 whitespace-nowrap">
        <FileSpreadsheet className="w-3.5 h-3.5 text-[#0072BC]" /><span>Bảng tính 10 biểu</span>
      </Link>
      <button type="button" onClick={onRefresh} className="h-9 px-3 rounded-lg bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span>Làm mới</span>
      </button>
    </div>
  );

  return (
    <>
      <PageHeaderActions>{actionControls}</PageHeaderActions>

      <header className="flex lg:hidden pb-4 border-b border-[#e2e8f0] flex-col gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0072BC] bg-[#eef5ff] px-3 py-1 rounded-full">
            {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
            <span>{isAdmin ? `Phòng Tổ chức – Nhân sự · ${activeUnitTitle}` : activeUnitTitle}</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold text-[#0072BC] flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#006cee] shrink-0" />
            <span>Quản lý &amp; xử lý phiếu công việc đơn vị</span>
          </h1>
        </div>
        {actionControls}
      </header>

      <nav role="tablist" aria-label="Bộ lọc xử lý phiếu đơn vị" className="flex flex-wrap items-center gap-1.5 sm:gap-2 border-b border-[#e2e8f0] overflow-x-auto no-scrollbar">
        <button type="button" role="tab" aria-selected={mode === 'all'} onClick={() => onSelectMode('all')} className={`inline-flex items-center gap-2 px-3.5 py-3 text-[13px] font-bold border-b-[1.8px] transition-colors whitespace-nowrap cursor-pointer ${mode === 'all' ? 'border-[#FD8C73] text-[#006cee]' : 'border-transparent text-[#476b8e] hover:text-[#004776]'}`}>
          <Users className="w-4 h-4 shrink-0" /><span>Toàn bộ phiếu đơn vị ({scopedCount})</span>
        </button>
        <button type="button" role="tab" aria-selected={mode === 'pending'} onClick={() => onSelectMode('pending')} className={`inline-flex items-center gap-2 px-3.5 py-3 text-[13px] font-bold border-b-[1.8px] transition-colors whitespace-nowrap cursor-pointer ${mode === 'pending' ? 'border-[#FD8C73] text-[#006cee]' : 'border-transparent text-[#476b8e] hover:text-[#004776]'}`}>
          <Clock className="w-4 h-4 shrink-0" /><span>Chờ duyệt &amp; Yêu cầu bổ sung</span>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold ${pendingCount > 0 ? 'bg-amber-500 text-white' : 'bg-[#e1edf8] text-[#20446c]'}`}>{pendingCount}</span>
        </button>
        <button type="button" role="tab" aria-selected={mode === 'approved'} onClick={() => onSelectMode('approved')} className={`inline-flex items-center gap-2 px-3.5 py-3 text-[13px] font-bold border-b-[1.8px] transition-colors whitespace-nowrap cursor-pointer ${mode === 'approved' ? 'border-[#FD8C73] text-[#006cee]' : 'border-transparent text-[#476b8e] hover:text-[#004776]'}`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /><span>Đã duyệt &amp; đưa vào Biểu A2 &amp; B1</span>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold ${approvedCount > 0 ? 'bg-emerald-600 text-white' : 'bg-[#e1edf8] text-[#20446c]'}`}>{approvedCount}</span>
        </button>
        <button type="button" role="tab" aria-selected={mode === 'draft'} onClick={() => onSelectMode('draft')} className={`inline-flex items-center gap-2 px-3.5 py-3 text-[13px] font-bold border-b-[1.8px] transition-colors whitespace-nowrap cursor-pointer ${mode === 'draft' ? 'border-[#FD8C73] text-[#006cee]' : 'border-transparent text-[#476b8e] hover:text-[#004776]'}`}>
          <FileEdit className="w-4 h-4 shrink-0" /><span>Phiếu lưu nháp</span>
          <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold ${draftCount > 0 ? 'bg-[#64748b] text-white' : 'bg-[#e1edf8] text-[#20446c]'}`}>{draftCount}</span>
        </button>
      </nav>
    </>
  );
}
