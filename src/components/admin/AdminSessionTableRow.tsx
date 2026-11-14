'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Eye, Download, LogIn, Trash2, Calendar, User, MoreVertical } from 'lucide-react';
import { AdminDisplaySession } from './AdminSessionsTab';

interface AdminSessionTableRowProps {
  session: AdminDisplaySession;
  index: number;
  isRecentlyUpdated: boolean;
  viewingId: string | null;
  exportingEmail: string | null;
  onView: (session: AdminDisplaySession) => void;
  onExport: (session: AdminDisplaySession) => void;
  onOpen: (session: AdminDisplaySession) => void;
  onDelete: (session: AdminDisplaySession) => void;
}

export function AdminSessionTableRow({
  session: s,
  index: idx,
  isRecentlyUpdated,
  viewingId,
  exportingEmail,
  onView,
  onExport,
  onOpen,
  onDelete
}: AdminSessionTableRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const rowKey = s.id || s.email;
  const isViewingThis = viewingId === rowKey;
  const isExportingThis = exportingEmail === s.email;

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <tr
      className={`h-[56px] border-b border-[#cbd5e1]/70 transition-colors ${
        isRecentlyUpdated
          ? 'bg-blue-50/70 border-l-4 border-l-[#004776]'
          : 'hover:bg-blue-50/30'
      }`}
    >
      <td className="p-3 text-center text-[#64748b] font-semibold text-xs sm:text-[13px] border-r border-[#cbd5e1] bg-[#f8fafc]/50">
        {idx + 1}
      </td>

      <td className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#004776]/10 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-[#004776]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] sm:text-sm font-bold text-[#004776] truncate max-w-[220px]">
                {s.email}
              </span>
              {isRecentlyUpdated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Vừa cập nhật</span>
                </span>
              )}
            </div>
            <div className="text-xs font-normal text-[#64748b] truncate mt-0.5">
              {s.title || 'Người thực hiện'}
            </div>
          </div>
        </div>
      </td>

      <td className="p-3 text-[#004776] border-r border-[#cbd5e1]">
        <div className="flex items-center gap-2">
          <span className="font-bold px-2 py-0.5 rounded-md bg-[#004776]/10 text-[#004776] text-xs">
            {s.unitCode}
          </span>
          <span className="text-[13px] sm:text-sm font-medium text-[#004776] truncate max-w-[190px]" title={s.unitNameVi}>
            {s.unitNameVi}
          </span>
        </div>
      </td>

      <td className="p-3 text-[#64748b] border-r border-[#cbd5e1]">
        <div className="text-xs font-medium text-[#475569]">{s.reportingPeriod || '2025–2026'}</div>
        <div className="text-xs text-[#0072BC] font-bold mt-0.5">
          Revision v{s.currentRevision || 1}
        </div>
      </td>

      <td className="p-3 border-r border-[#cbd5e1]">
        <div className="text-[13px] font-bold text-[#004776]">{s.totalRows || 0} dòng</div>
        <div className="text-xs text-[#64748b] mt-0.5">{s.populatedSheetsCount || 0}/15 sheet</div>
      </td>

      <td className="p-3 text-[#64748b] border-r border-[#cbd5e1] whitespace-nowrap">
        <span className="flex items-center gap-1.5 text-xs text-[#475569]">
          <Calendar className="w-3.5 h-3.5 text-[#0072BC]" />
          <span>{s.lastSavedAt || '—'}</span>
        </span>
      </td>

      <td className="p-3 text-center sticky right-0 bg-white/95 backdrop-blur-xs border-l border-[#cbd5e1]/60">
        <div className="flex items-center justify-center gap-1.5">
          {/* Nút Xem là Action chính nổi bật */}
          <button
            type="button"
            onClick={() => onView(s)}
            disabled={isViewingThis}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs sm:text-[13px] font-bold text-white bg-[#004776] hover:bg-[#00385c] rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Xem dữ liệu 15 biểu"
          >
            <Eye className={`w-3.5 h-3.5 ${isViewingThis ? 'animate-spin' : ''}`} />
            <span>{isViewingThis ? 'Đang mở...' : 'Xem'}</span>
          </button>

          {/* Dãy nút trực tiếp trên màn hình rộng */}
          <div className="hidden xl:inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onExport(s)}
              disabled={isExportingThis}
              className="inline-flex items-center gap-1 h-9 px-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="Xuất file Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất</span>
            </button>
            <button
              type="button"
              onClick={() => onOpen(s)}
              className="h-9 w-9 flex items-center justify-center text-[#004776] hover:bg-[#e2e8f0] rounded-xl transition-colors cursor-pointer border border-[#cbd5e1]"
              title="Mở trên Bảng tính"
            >
              <LogIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(s)}
              className="h-9 w-9 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-red-200"
              title="Xóa hồ sơ máy chủ"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Menu ba chấm gom gọn trên màn hình hẹp (xl:hidden) */}
          <div className="relative xl:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="h-9 w-9 flex items-center justify-center text-[#64748b] hover:text-[#004776] hover:bg-[#f1f5f9] rounded-xl border border-[#cbd5e1] cursor-pointer"
              title="Thao tác khác"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-10 w-44 bg-white rounded-xl shadow-lg border border-[#cbd5e1] py-1 z-30 text-left text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onExport(s); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onOpen(s); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[#004776] hover:bg-[#f1f5f9] cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Mở Bảng tính</span>
                </button>
                <div className="my-1 border-t border-[#e2e8f0]" />
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onDelete(s); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa hồ sơ</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
