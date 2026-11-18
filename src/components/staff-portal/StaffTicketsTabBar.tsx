'use client';

import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Edit3,
  FileSpreadsheet,
  Handshake,
  LogOut,
  Network,
  Plus,
  User,
  Users
} from 'lucide-react';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { StaffWorkTicket } from '@/types/staff-ticket';

export type StaffTicketsTabKey = 'my' | 'pending' | 'approved' | 'unit' | 'proposed' | 'relationships';

interface StaffPortalHeaderBannerProps {
  unitCode: string;
  unitNameVi: string;
  onCreateNew: () => void;
  onLogout: () => void;
}

export function StaffPortalHeaderBanner({
  unitCode,
  unitNameVi,
  onCreateNew,
  onLogout
}: StaffPortalHeaderBannerProps) {
  const unitInfo = findHcmuteUnit(unitCode);

  return (
    <div className="bg-white rounded-2xl border border-[#dbeafe] shadow-xs p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:hidden">
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0072BC] bg-[#eef5ff] px-3 py-1 rounded-full">
          <Building2 className="w-3.5 h-3.5" />
          <span>{unitNameVi || unitInfo.nameVi} ({unitInfo.code})</span>
        </div>
        <h1 className="text-lg sm:text-2xl font-bold text-[#004776]">
          Phiếu khảo sát khối lượng công việc cá nhân HCM-UTE
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/bang-tinh?sheet=A2"
          className="h-10 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] flex items-center gap-1.5 shadow-2xs"
        >
          <FileSpreadsheet className="w-4 h-4 text-[#0072BC]" />
          <span>Bảng tính toàn đơn vị</span>
        </Link>
        <button
          type="button"
          onClick={onCreateNew}
          className="h-10 px-4 rounded-xl bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo phiếu mới</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Đăng xuất"
          className="min-h-[44px] min-w-[44px] px-3 rounded-xl border border-[#e2e8f0] text-xs font-medium text-[#476b8e] hover:text-[#f4212e] inline-flex items-center justify-center cursor-pointer"
          title="Đăng xuất"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface StaffTicketsTabBarProps {
  activeTab: StaffTicketsTabKey;
  onSelectTab: (tab: StaffTicketsTabKey) => void;
  draftCount: number;
  pendingCount: number;
  approvedCount: number;
  unitCount: number;
  proposedCount: number;
  relationshipsCount?: number;
  isLeader: boolean;
}

export function StaffTicketsTabBar({
  activeTab,
  onSelectTab,
  draftCount,
  pendingCount,
  approvedCount,
  unitCount,
  proposedCount,
  relationshipsCount = 0,
  isLeader
}: StaffTicketsTabBarProps) {
  const baseBtn =
    'inline-flex items-center gap-2 px-3.5 py-3 text-[13px] font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer';
  const activeCls = 'border-[#006cee] text-[#006cee]';
  const inactiveCls = 'border-transparent text-[#476b8e] hover:text-[#004776] hover:border-[#cbd5e1]';

  const tabOptions: {
    key: StaffTicketsTabKey;
    label: string;
    countLabel: string;
    Icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
    badgeCls?: string;
  }[] = [
    {
      key: 'my', label: 'Phiếu của tôi',
      countLabel: draftCount > 0 ? `(Nháp: ${draftCount})` : '', Icon: User,
      badge: draftCount > 0 ? `Nháp: ${draftCount}` : undefined,
      badgeCls: 'h-5 px-2 bg-[#eef5ff] border border-[#bfdbfe] text-[#006cee]'
    },
    {
      key: 'pending', label: 'Chờ duyệt', countLabel: `(${pendingCount})`, Icon: Clock,
      badge: pendingCount,
      badgeCls: `min-w-[20px] h-5 px-1.5 ${pendingCount > 0 ? 'bg-amber-500 text-white' : 'bg-[#e1edf8] text-[#20446c]'}`
    },
    {
      key: 'approved', label: 'Đã duyệt', countLabel: `(${approvedCount})`, Icon: CheckCircle2,
      badge: approvedCount,
      badgeCls: `min-w-[20px] h-5 px-1.5 ${approvedCount > 0 ? 'bg-emerald-600 text-white' : 'bg-[#e1edf8] text-[#20446c]'}`
    },
    { key: 'unit', label: `${isLeader ? 'Toàn bộ phiếu đơn vị' : 'Phiếu toàn đơn vị (Chỉ đọc)'} (${unitCount})`, countLabel: '', Icon: Users },
    {
      key: 'proposed', label: 'Nhiệm vụ được đề xuất phối hợp', countLabel: `(${proposedCount})`, Icon: Handshake,
      badge: proposedCount,
      badgeCls: `min-w-[22px] h-5 px-1.5 ${proposedCount > 0 ? 'bg-[#006cee] text-white' : 'bg-[#e1edf8] text-[#20446c]'}`
    },
    {
      key: 'relationships', label: 'Mối quan hệ công việc', countLabel: `(${relationshipsCount})`, Icon: Network,
      badge: relationshipsCount,
      badgeCls: `min-w-[22px] h-5 px-1.5 ${relationshipsCount > 0 ? 'bg-emerald-600 text-white' : 'bg-[#e1edf8] text-[#20446c]'}`
    }
  ];

  return (
    <div className="bg-white border border-[#cbd5e1] rounded-t-2xl overflow-hidden print:hidden">
      {/* Mobile (< 768px): Bộ chọn chế độ xem đầy đủ, không cắt chữ + các nút tab chính */}
      <div className="md:hidden p-3 space-y-2 border-b border-[#e2e8f0]">
        <label htmlFor="mobile-ticket-view-mode" className="block text-xs font-semibold text-[#20446c]">
          Chế độ xem danh sách
        </label>
        <select
          id="mobile-ticket-view-mode"
          aria-label="Chế độ xem"
          value={activeTab}
          onChange={(e) => onSelectTab(e.target.value as StaffTicketsTabKey)}
          className="w-full min-h-[44px] px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fbff] text-sm font-bold text-[#004776] outline-hidden focus:border-[#006cee]"
        >
          {tabOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label} {opt.countLabel}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-1.5">
          {tabOptions.slice(0, 3).map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelectTab(opt.key)}
              className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold border cursor-pointer truncate ${
                activeTab === opt.key ? 'bg-[#006cee] text-white border-[#006cee]' : 'bg-white text-[#004776] border-[#d8e3ef]'
              }`}
            >
              {opt.key === 'my' ? opt.label : `${opt.label} ${opt.countLabel}`}
            </button>
          ))}
        </div>
      </div>

      {/* Tablet & Desktop (>= 768px): Dải tab đầy đủ có cuộn ngang rõ ràng */}
      <div
        role="tablist"
        aria-label="Chế độ xem phiếu công việc"
        className="hidden md:flex flex-wrap xl:flex-nowrap items-center gap-1 sm:gap-2 border-b border-[#cbd5e1] bg-white px-4 pt-1.5 overflow-x-auto no-scrollbar"
      >
        {tabOptions.map((opt) => {
          const Icon = opt.Icon;
          return (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={activeTab === opt.key}
              onClick={() => onSelectTab(opt.key)}
              className={`${baseBtn} ${activeTab === opt.key ? activeCls : inactiveCls}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{opt.label}</span>
              {opt.badge !== undefined && (
                <span className={`inline-flex items-center justify-center rounded-full text-[11px] font-extrabold ${opt.badgeCls}`}>
                  {opt.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ChangesRequestedAlertBannerProps {
  count: number;
  firstTicket: StaffWorkTicket;
  onEditNow: (ticket: StaffWorkTicket) => void;
  onOpenPendingTab: () => void;
}

export function ChangesRequestedAlertBanner({
  count,
  firstTicket,
  onEditNow,
  onOpenPendingTab
}: ChangesRequestedAlertBannerProps) {
  return (
    <div className="p-3.5 rounded-2xl bg-[#fff8eb] border border-[#fcd34d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
      <div className="flex items-start gap-2.5 text-xs text-[#004776] min-w-0">
        <AlertTriangle className="w-4 h-4 text-[#f99c00] shrink-0 mt-0.5" />
        <div className="space-y-0.5 min-w-0">
          <div className="font-bold text-[#b45309]">
            Bạn có {count} phiếu ở trạng thái Yêu cầu bổ sung ({firstTicket.maCongViec})
          </div>
          {firstTicket.revisionReason && (
            <p className="text-[#004776] break-words">
              Lý do gần nhất: {firstTicket.revisionReason}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onEditNow(firstTicket)}
          className="h-8 px-3 rounded-lg bg-[#f99c00] hover:bg-[#d97706] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
        >
          <Edit3 className="w-3.5 h-3.5" /> Chỉnh sửa ngay
        </button>
        <button
          type="button"
          onClick={onOpenPendingTab}
          className="h-8 px-3 rounded-lg border border-[#fcd34d] bg-white hover:bg-[#fffbeb] text-[#b45309] text-xs font-semibold cursor-pointer"
        >
          Xem trong Chờ duyệt
        </button>
      </div>
    </div>
  );
}
