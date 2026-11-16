'use client';

import React from 'react';
import { Search, UserCheck, RefreshCw } from 'lucide-react';

export interface UserSummaryItem {
  email: string;
  title: string;
  count: number;
}

interface AdminSessionFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedUser: string;
  onUserChange: (userEmail: string) => void;
  users: UserSummaryItem[];
  totalCount: number;
  loading: boolean;
  onRefresh: () => void;
}

export function AdminSessionFilterBar({
  search,
  onSearchChange,
  selectedUser,
  onUserChange,
  users,
  totalCount,
  loading,
  onRefresh
}: AdminSessionFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 min-h-[48px] sm:min-h-[52px] w-full min-w-0">
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
        {/* Search input */}
        <div className="relative w-full sm:flex-1 sm:max-w-xs min-w-0">
          <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm theo email, mã đơn vị hoặc tên đơn vị..."
            className="w-full h-10 pl-9 pr-3 text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#004776] font-medium focus:ring-2 focus:ring-[#004776] focus:outline-none placeholder:text-[#94a3b8]"
          />
        </div>

        {/* User filter selector */}
        <div className="relative w-full sm:w-56 sm:max-w-xs min-w-0">
          <UserCheck className="w-3.5 h-3.5 text-[#004776] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
          <select
            value={selectedUser}
            onChange={(e) => onUserChange(e.target.value)}
            className="w-full h-10 pl-8 pr-7 text-xs font-semibold bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#004776] focus:ring-2 focus:ring-[#004776] focus:outline-none cursor-pointer appearance-none truncate"
          >
            <option value="">Tất cả cán bộ ({users.length})</option>
            {users.map((u) => (
              <option key={u.email} value={u.email}>
                {u.email} ({u.count} bảng)
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748b] text-[10px]">
            ▼
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
        <button
          type="button"
          onClick={onRefresh}
          className="h-10 inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold text-[#004776] bg-slate-50 hover:bg-slate-100 border border-[#cbd5e1] rounded-xl transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới từ máy chủ</span>
        </button>
        <span className="h-10 inline-flex items-center text-xs font-bold text-[#004776] bg-blue-50 border border-blue-200 px-3.5 rounded-xl">
          Máy chủ: {totalCount} hồ sơ
        </span>
      </div>
    </div>
  );
}

