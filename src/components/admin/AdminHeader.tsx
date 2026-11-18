'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, FileSpreadsheet, LogOut, Network } from 'lucide-react';

interface AdminHeaderProps {
  onLogout: () => void;
  onOpenOrgTree?: () => void;
}

export function AdminHeader({ onLogout, onOpenOrgTree }: AdminHeaderProps) {
  return (
    <div className="pb-4 border-b border-[#e2e8f0] flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 min-w-0">
      {/* Khối nhận diện tiêu đề Trung tâm Quản trị - Không để bị cắt chữ */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-[10px] bg-[#eef5ff] flex items-center justify-center text-[#004776] shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-xl font-bold text-[#004776] tracking-tight leading-snug">
              Trung tâm quản trị VTVL
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 shrink-0">
              Quyền Admin
            </span>
          </div>
        </div>
      </div>

      {/* Cụm nút thao tác quản trị */}
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto min-w-0">
        {onOpenOrgTree && (
          <button
            type="button"
            onClick={onOpenOrgTree}
            className="h-9 sm:h-10 flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 text-xs sm:text-[13px] font-semibold text-white bg-[#006cee] hover:bg-[#005ecc] rounded-[10px] transition-colors cursor-pointer whitespace-nowrap"
            title="Xem sơ đồ cây vị trí việc làm và dự kiến công việc của đơn vị"
          >
            <Network className="w-4 h-4 text-white shrink-0" />
            <span>Sơ đồ VTVL</span>
          </button>
        )}

        <Link
          href="/bang-tinh"
          className="h-9 sm:h-10 flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 text-xs sm:text-[13px] font-semibold text-[#004776] bg-[#f8fafc] hover:bg-[#eef5ff] rounded-[10px] transition-colors cursor-pointer whitespace-nowrap"
        >
          <FileSpreadsheet className="w-4 h-4 text-[#0072BC] shrink-0" />
          <span>Bảng tính 10 biểu</span>
        </Link>

        <button
          type="button"
          onClick={onLogout}
          className="h-9 sm:h-10 flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 text-xs sm:text-[13px] font-semibold text-red-700 hover:bg-red-50 rounded-[10px] transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Khóa quản trị</span>
        </button>
      </div>
    </div>
  );
}
