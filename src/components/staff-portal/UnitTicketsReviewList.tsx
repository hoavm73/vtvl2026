'use client';

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2, Clock, AlertTriangle, RefreshCw, Eye, Printer, Users, Layers, Filter, Search
} from 'lucide-react';
import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';

interface UnitTicketsReviewListProps {
  tickets: StaffWorkTicket[];
  loading: boolean;
  currentUserRole?: 'admin' | 'unit_leader' | 'staff';
  currentUserEmail?: string;
  mode?: 'pending' | 'all';
  onViewTicket: (ticket: StaffWorkTicket) => void;
  onPrintTicket: (ticket: StaffWorkTicket) => void;
  onApproveTicket?: (ticket: StaffWorkTicket) => Promise<void>;
  onRequestChanges?: (ticket: StaffWorkTicket) => void;
  onMergeTicket?: (ticket: StaffWorkTicket) => void;
}

export function UnitTicketsReviewList({
  tickets, loading, currentUserRole, currentUserEmail, mode = 'all',
  onViewTicket, onPrintTicket, onApproveTicket, onRequestChanges, onMergeTicket
}: UnitTicketsReviewListProps) {
  const isLeader = currentUserRole === 'unit_leader' || currentUserRole === 'admin';
  const onReviewTicket = onApproveTicket;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [missionFilter, setMissionFilter] = useState('ALL');

  // Danh mục bộ lọc
  const owners = useMemo(() => Array.from(new Set(tickets.map((t) => t.ownerName || t.ownerEmail))), [tickets]);
  const missions = useMemo(() => Array.from(new Set(tickets.map((t) => t.maNhiemVu).filter(Boolean))), [tickets]);

  // Lọc và sắp xếp
  const displayedTickets = useMemo(() => {
    let list = [...tickets];
    if (mode === 'pending') {
      list = list.filter((t) => {
        const c = toCanonicalStatus(t.status);
        return c === 'submitted' || c === 'resubmitted';
      });
      // Sắp xếp nộp gần nhất lên trước
      list.sort((a, b) => {
        const timeA = a.resubmittedAt || a.submittedAt || a.updatedAt;
        const timeB = b.resubmittedAt || b.submittedAt || b.updatedAt;
        return timeB.localeCompare(timeA);
      });
    } else {
      if (statusFilter !== 'ALL') {
        list = list.filter((t) => toCanonicalStatus(t.status) === statusFilter);
      }
      if (ownerFilter !== 'ALL') {
        list = list.filter((t) => (t.ownerName || t.ownerEmail) === ownerFilter);
      }
      if (missionFilter !== 'ALL') {
        list = list.filter((t) => t.maNhiemVu === missionFilter);
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        list = list.filter((t) =>
          t.tenCongViec.toLowerCase().includes(q) ||
          t.maCongViec.toLowerCase().includes(q) ||
          t.ownerName.toLowerCase().includes(q) ||
          t.ownerEmail.toLowerCase().includes(q)
        );
      }
    }
    return list;
  }, [tickets, mode, statusFilter, ownerFilter, missionFilter, search]);

  const getStatusBadge = (t: StaffWorkTicket) => {
    const c = toCanonicalStatus(t.status);
    switch (c) {
      case 'approved':
        return { cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', icon: CheckCircle2, label: 'Đã duyệt' };
      case 'changes_requested':
        return { cls: 'bg-amber-50 text-amber-700 border-amber-300', icon: AlertTriangle, label: 'Yêu cầu bổ sung' };
      case 'resubmitted':
        return { cls: 'bg-purple-50 text-purple-700 border-purple-300', icon: RefreshCw, label: 'Đã nộp lại' };
      case 'submitted':
        return { cls: 'bg-blue-50 text-[#0072BC] border-blue-200', icon: Clock, label: 'Đã nộp' };
      default:
        return { cls: 'bg-slate-100 text-slate-700 border-slate-300', icon: Clock, label: 'Nháp' };
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0072BC]" />
          <h2 className="text-base font-bold text-[#004776]">
            {mode === 'pending' ? 'Phiếu chờ phê duyệt' : 'Toàn bộ phiếu của đơn vị'} ({displayedTickets.length})
          </h2>
        </div>
        {mode === 'all' && (
          <div className="text-xs text-[#64748b]">
            {isLeader ? 'Quản lý, duyệt và gộp vào B1/B2.' : 'Chế độ chỉ đọc toàn đơn vị.'}
          </div>
        )}
      </div>

      {/* Bộ lọc cho chế độ All */}
      {mode === 'all' && (
        <div className="p-3 bg-[#f8fbff] border-b border-[#e2e8f0] grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên việc, mã, người..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#0072BC] outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] outline-none"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="submitted">Đã nộp</option>
            <option value="resubmitted">Đã nộp lại</option>
            <option value="approved">Đã duyệt</option>
            <option value="changes_requested">Yêu cầu bổ sung</option>
            <option value="draft">Nháp</option>
          </select>
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] outline-none"
          >
            <option value="ALL">Tất cả người kê khai</option>
            {owners.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
          <select
            value={missionFilter}
            onChange={(e) => setMissionFilter(e.target.value)}
            className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] outline-none"
          >
            <option value="ALL">Tất cả nhiệm vụ (A1)</option>
            {missions.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        </div>
      )}

      {/* Danh sách phiếu */}
      <div className="divide-y divide-[#f1f5f9]">
        {loading && tickets.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748b]">Đang tải dữ liệu phiếu...</div>
        ) : displayedTickets.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#64748b]">
            {mode === 'pending' ? 'Hiện tại không có phiếu nào cần phê duyệt.' : 'Không có phiếu công việc phù hợp điều kiện lọc.'}
          </div>
        ) : (
          displayedTickets.map((t) => {
            const hours = Math.round((((t.soSpNam * t.phutThucTe) / 60) + t.gioBoSung) * 10) / 10;
            const canonical = toCanonicalStatus(t.status);
            const badge = getStatusBadge(t);
            const StatusIcon = badge.icon;
            const isOwnLeaderTicket = currentUserRole === 'unit_leader' && t.ownerEmail.toLowerCase() === (currentUserEmail || '').toLowerCase();
            const canReview = isLeader && (canonical === 'submitted' || canonical === 'resubmitted');
            const canMerge = isLeader && canonical === 'approved';

            return (
              <div key={t.id} className="p-4 hover:bg-[#f8fbff] transition-colors space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#0072BC] bg-[#eef5ff] px-2 py-0.5 rounded-md">
                        {t.maCongViec}
                      </span>
                      <span className="text-xs font-semibold text-[#475569] bg-[#f1f5f9] px-2 py-0.5 rounded-md">
                        VTVL: {t.maVtvl}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                        <StatusIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                      {t.isMergedToB1B2 && (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Đã gộp B1/B2
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-[#004776]">{t.tenCongViec}</div>

                    <div className="text-xs text-[#476885]">
                      Người kê khai: <strong className="text-[#004776]">{t.ownerName}</strong> ({t.ownerTitle || t.ownerEmail}) • Đơn vị: <strong>{t.unitCode}</strong>
                    </div>

                    <div className="text-xs text-[#64748b]">
                      Sản lượng: <strong>{t.soSpNam}</strong> SP • Thời gian: <strong>{t.phutThucTe}</strong> phút/SP • Tổng: <strong>{hours}</strong> giờ/năm
                      {t.submittedAt && <span className="ml-2">• Nộp lúc: {new Date(t.submittedAt).toLocaleDateString('vi-VN')}</span>}
                    </div>
                  </div>
                </div>

                {/* Thao tác */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onViewTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#0072BC]" /> Xem chi tiết
                  </button>

                  <button
                    type="button"
                    onClick={() => onPrintTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#0072BC]" /> In PDF
                  </button>

                  {/* Quyền Duyệt & Yêu cầu bổ sung của Lãnh đạo/Admin */}
                  {isLeader && onReviewTicket && canReview && (
                    <>
                      {isOwnLeaderTicket ? (
                        <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                          Phiếu cá nhân của Lãnh đạo (Cần TCNS duyệt)
                        </span>
                      ) : (
                        <>
                          {onApproveTicket && (
                            <button
                              type="button"
                              onClick={() => onApproveTicket(t)}
                              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt phiếu
                            </button>
                          )}
                          {onRequestChanges && (
                            <button
                              type="button"
                              onClick={() => onRequestChanges(t)}
                              className="h-8 px-3 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-amber-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Yêu cầu bổ sung
                            </button>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Gộp B1/B2 dành cho phiếu đã duyệt */}
                  {canMerge && onMergeTicket && (
                    <button
                      type="button"
                      onClick={() => onMergeTicket(t)}
                      className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs ${
                        t.isMergedToB1B2
                          ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-[#0072BC] hover:bg-[#004776] text-white'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{t.isMergedToB1B2 ? 'Cập nhật gộp B1/B2' : 'Gộp vào B1/B2'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
