'use client';

import React from 'react';
import { FileSpreadsheet, Users, UserCheck, Building2, AlertCircle, RefreshCw } from 'lucide-react';

interface AdminStatusStripProps {
  isLeader: boolean;
  sessionCount: number | null;
  accountCount: number | null;
  activeUnitCode: string;
  unitCount: number;
  migrationSummary: string | null;
  statsError: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function AdminStatusStrip({
  isLeader, sessionCount, accountCount, activeUnitCode,
  unitCount, migrationSummary, statsError, isRefreshing, onRefresh
}: AdminStatusStripProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-1 text-xs font-semibold text-[#20446c] min-w-0">
      {!isLeader && (
        <div className="inline-flex items-center gap-1.5">
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
          <span className="text-[#004776]">{sessionCount === null ? 'Đang tải hồ sơ…' : `${sessionCount} hồ sơ`}</span>
          <button type="button" onClick={onRefresh} aria-label="Làm mới dữ liệu từ máy chủ" title="Làm mới dữ liệu từ máy chủ" className="ml-0.5 text-[#004776]/70 hover:text-[#004776] cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}
      <div className="inline-flex items-center gap-1.5">
        <Users className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
        <span className="text-[#004776]">{accountCount === null ? 'Đang tải tài khoản…' : `${accountCount} tài khoản ${isLeader ? 'thuộc đơn vị' : ''}`}</span>
      </div>
      <div className="inline-flex items-center gap-1.5 max-w-full sm:max-w-md truncate min-w-0" title={activeUnitCode}>
        <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
        <span className="truncate text-emerald-800">Phiên: {activeUnitCode}</span>
      </div>
      {!isLeader && (
        <div className="inline-flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
          <span className="text-[#004776]">{unitCount} đơn vị</span>
        </div>
      )}
      {!isLeader && migrationSummary && (
        <span className="px-2.5 py-0.5 rounded-full bg-[#e9f0f8] text-[#004776]">{migrationSummary}</span>
      )}
      {statsError && (
        <button type="button" onClick={onRefresh} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-[#b42318] cursor-pointer">
          <AlertCircle className="w-3.5 h-3.5" /><span>{statsError} Thử lại</span>
        </button>
      )}
    </div>
  );
}
