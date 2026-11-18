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
    <div className="px-3 sm:px-6 py-3.5 sm:py-4 border-b border-[#f1f5f9] flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 min-w-0">
      {/* Khối nhận diện tiêu đề Trung tâm Quản trị - Không để bị cắt chữ */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#004776]/10 border border-[#004776]/20 flex items-center justify-center text-[#004776] shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-xl font-bold text-[#004776] tracking-tight leading-snug">
              Trung tâm quản trị VTVL
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
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
            className="h-9 sm:h-10 flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 text-xs sm:text-[13px] font-semibold text-white bg-[#005fa3] hover:bg-[#004776] border border-[#005fa3] rounded-xl transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
            title="Xem sơ đồ cây vị trí việc làm và dự kiến công việc của đơn vị"
          >
            <Network className="w-4 h-4 text-white shrink-0" />
            <span>Sơ đồ VTVL</span>
          </button>
        )}

        <Link
          href="/bang-tinh"
          className="h-9 sm:h-10 flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 text-xs sm:text-[13px] font-semibold text-[#004776] bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#cbd5e1] rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <FileSpreadsheet className="w-4 h-4 text-[#0072BC] shrink-0" />
          <span>Bảng tính 10 biểu</span>
        </Link>

        <button
          type="button"
          onClick={onLogout}
          className="h-9 sm:h-10 flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 text-xs sm:text-[13px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Khóa quản trị</span>
        </button>
      </div>
    </div>
  );
}
