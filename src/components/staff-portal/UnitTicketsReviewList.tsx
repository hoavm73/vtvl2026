'use client';

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2, AlertTriangle, Eye, Printer, Users, Layers, Search, User, Link2
} from 'lucide-react';
import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { TicketApprovalProgress, getTicketStatusMeta } from './TicketApprovalProgress';

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

  const owners = useMemo(() => Array.from(new Set(tickets.map((t) => t.ownerName || t.ownerEmail))), [tickets]);
  const missions = useMemo(() => Array.from(new Set(tickets.map((t) => t.maNhiemVu).filter(Boolean))), [tickets]);

  const displayedTickets = useMemo(() => {
    let list = [...tickets];
    if (mode === 'pending') {
      list = list.filter((t) => {
        const c = toCanonicalStatus(t.status);
        return c === 'submitted' || c === 'resubmitted';
      });
      list.sort((a, b) => (b.resubmittedAt || b.submittedAt || b.updatedAt).localeCompare(a.resubmittedAt || a.submittedAt || a.updatedAt));
      return list;
    }
    if (statusFilter !== 'ALL') list = list.filter((t) => toCanonicalStatus(t.status) === statusFilter);
    if (ownerFilter !== 'ALL') list = list.filter((t) => (t.ownerName || t.ownerEmail) === ownerFilter);
    if (missionFilter !== 'ALL') list = list.filter((t) => t.maNhiemVu === missionFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) =>
        t.tenCongViec.toLowerCase().includes(q) ||
        t.maCongViec.toLowerCase().includes(q) ||
        t.ownerName.toLowerCase().includes(q) ||
        t.ownerEmail.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tickets, mode, statusFilter, ownerFilter, missionFilter, search]);

  return (
    <div className="bg-white rounded-2xl border border-[#dbe8f5] shadow-[0_2px_14px_-4px_rgba(0,71,118,0.06)] overflow-hidden">
      <div className="px-5 py-3.5 bg-[#fafcff] border-b border-[#e8eff7] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#006cee]" />
          <h2 className="text-base font-bold text-[#004776]">
            {mode === 'pending' ? 'Phiếu chờ phê duyệt' : 'Toàn bộ phiếu của đơn vị'} ({displayedTickets.length})
          </h2>
        </div>
      </div>

      {mode === 'all' && (
        <div className="p-3 bg-[#f8fbff] border-b border-[#e8eff7] grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#20446c]/70 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên việc, mã, người..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] outline-none"
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] outline-none">
            <option value="ALL">Tất cả trạng thái</option>
            <option value="submitted">Đã nộp</option>
            <option value="resubmitted">Đã nộp lại</option>
            <option value="approved">Đã duyệt</option>
            <option value="changes_requested">Yêu cầu bổ sung</option>
            <option value="draft">Nháp</option>
          </select>
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] outline-none">
            <option value="ALL">Tất cả người kê khai</option>
            {owners.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
          <select value={missionFilter} onChange={(e) => setMissionFilter(e.target.value)} className="p-1.5 rounded-lg border border-[#cbd5e1] bg-white text-[#004776] outline-none">
            <option value="ALL">Tất cả nhiệm vụ (A1)</option>
            {missions.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        </div>
      )}

      <div className="divide-y divide-[#eef3f8]">
        {loading && tickets.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#20446c]">Đang tải dữ liệu phiếu...</div>
        ) : displayedTickets.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#20446c]">
            {mode === 'pending' ? 'Hiện tại không có phiếu nào cần phê duyệt.' : 'Không có phiếu công việc phù hợp điều kiện lọc.'}
          </div>
        ) : (
          displayedTickets.map((t) => {
            const hours = Math.round((((t.soSpNam * t.phutThucTe) / 60) + t.gioBoSung) * 10) / 10;
            const meta = getTicketStatusMeta(t);
            const StatusIcon = meta.Icon;
            const canonical = meta.canonical;
            const isOwnLeaderTicket = currentUserRole === 'unit_leader' && t.ownerEmail.toLowerCase() === (currentUserEmail || '').toLowerCase();
            const canReview = isLeader && (canonical === 'submitted' || canonical === 'resubmitted');
            const canMerge = isLeader && canonical === 'approved';
            const submittedDateIso = t.resubmittedAt || t.submittedAt;

            return (
              <div key={t.id} className="relative pl-4 sm:pl-5 pr-4 sm:pr-5 py-4 hover:bg-[#f8fbff]/80 transition-colors">
                <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${meta.stripeCls}`} />

                <div className="flex flex-col lg:flex-row lg:items-stretch justify-between gap-4">
                  {/* Vùng trái: Thông tin định danh, nội dung & định mức */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-[#006cee] bg-[#eef5ff] border border-[#cfe2fc] px-2.5 py-0.5 rounded-md tabular-nums">
                          {t.maCongViec}
                        </span>
                        <span className="text-xs font-semibold text-[#004776] bg-[#f1f6fc] border border-[#dbe8f5] px-2.5 py-0.5 rounded-md">
                          VTVL: {t.maVtvl}
                        </span>
                        {t.maNhiemVu && (
                          <span className="text-[11px] font-medium text-[#20446c] bg-[#f8fafc] border border-[#e2e8f0] px-2 py-0.5 rounded-md">
                            NV: {t.maNhiemVu}
                          </span>
                        )}
                        {(t.currentVersionNo || 0) > 0 && (
                          <span className="text-[11px] font-bold text-[#004776] bg-white border border-[#cbd5e1] px-2 py-0.5 rounded-md tabular-nums">
                            v{t.currentVersionNo}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-[15px] font-bold text-[#004776] leading-snug">{t.tenCongViec}</h3>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#20446c]">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-[#006cee] shrink-0" />
                          Người kê khai: <strong className="text-[#004776]">{t.ownerName}</strong> ({t.ownerTitle || t.ownerEmail})
                        </span>
                        <span>• Đơn vị: <strong className="text-[#004776]">{t.unitCode}</strong></span>
                        {submittedDateIso && (
                          <span className="tabular-nums">• Nộp: {new Date(submittedDateIso).toLocaleDateString('vi-VN')}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                      <span className="px-2.5 py-1 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-[#20446c]">
                        Sản lượng: <strong className="text-[#004776]">{t.soSpNam}</strong> SP
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-[#20446c]">
                        Thời gian: <strong className="text-[#004776]">{t.phutThucTe}</strong> phút/SP
                      </span>
                      {t.gioBoSung > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] text-[#20446c]">
                          Giờ bổ sung: <strong className="text-[#004776]">+{t.gioBoSung}</strong> giờ
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-lg bg-[#eef5ff] border border-[#cfe2fc] text-[#004776] font-semibold">
                        Tổng: <strong className="text-[#006cee]">{hours}</strong> giờ/năm
                      </span>
                      {t.coordinatedTasks && t.coordinatedTasks.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#f1f6fc] border border-[#dbe8f5] text-[#006cee] font-medium">
                          <Link2 className="w-3 h-3" /> {t.coordinatedTasks.length} việc phối hợp
                        </span>
                      )}
                    </div>

                    {t.revisionReason && canonical === 'changes_requested' && (
                      <div className="p-2.5 rounded-lg bg-[#fff8eb] border-l-2 border-[#f99c00] text-xs text-[#004776]">
                        <strong className="text-[#b45309]">Yêu cầu bổ sung: </strong>{t.revisionReason}
                      </div>
                    )}
                    {t.lastChangeSummary && canonical === 'resubmitted' && (
                      <div className="p-2.5 rounded-lg bg-[#f5f3ff] border-l-2 border-[#7c3aed] text-xs text-[#004776]">
                        <strong className="text-[#6d28d9]">Giải trình nộp lại: </strong>{t.lastChangeSummary}
                      </div>
                    )}
                  </div>

                  {/* Vùng phải: Trạng thái (trên), Tiến trình 4 bước (giữa) & Nghiệp vụ căn phải (dưới) */}
                  <div className="lg:w-[395px] xl:w-[425px] shrink-0 flex flex-col lg:items-end justify-between gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[#e8eff7] lg:pl-4">
                    <div className="flex flex-wrap items-center lg:justify-end gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.pillCls}`}>
                        <StatusIcon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      {t.isMergedToB1B2 && (
                        <span className="text-[11px] font-bold text-[#008f5d] bg-[#e6f9f1] px-2.5 py-0.5 rounded-full border border-[#a7f3d0]">
                          Đã gộp B1/B2
                        </span>
                      )}
                    </div>

                    <TicketApprovalProgress ticket={t} />

                    <div className="flex flex-wrap items-center lg:justify-end gap-1.5 w-full">
                      <button type="button" onClick={() => onViewTicket(t)} className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors">
                        <Eye className="w-3.5 h-3.5 text-[#006cee]" /> Xem chi tiết
                      </button>

                      <button type="button" onClick={() => onPrintTicket(t)} className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors">
                        <Printer className="w-3.5 h-3.5 text-[#006cee]" /> In PDF
                      </button>

                      {isLeader && onReviewTicket && canReview && (
                        isOwnLeaderTicket ? (
                          <span className="text-[11px] font-medium text-[#b45309] bg-[#fff8eb] px-2.5 py-1 rounded-lg border border-[#fcd34d]">
                            Phiếu cá nhân của Lãnh đạo (Cần TCNS duyệt)
                          </span>
                        ) : (
                          <>
                            {onRequestChanges && (
                              <button type="button" onClick={() => onRequestChanges(t)} className="h-8 px-3 rounded-lg border border-[#fcd34d] bg-white hover:bg-[#fff8eb] text-[#b45309] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors">
                                <AlertTriangle className="w-3.5 h-3.5 text-[#f99c00]" /> Yêu cầu bổ sung
                              </button>
                            )}
                            {onApproveTicket && (
                              <button type="button" onClick={() => onApproveTicket(t)} className="h-8 px-3 rounded-lg bg-[#00a86b] hover:bg-[#008f5d] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt phiếu
                              </button>
                            )}
                          </>
                        )
                      )}

                      {canMerge && onMergeTicket && (
                        <button
                          type="button"
                          onClick={() => onMergeTicket(t)}
                          className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors ${
                            t.isMergedToB1B2
                              ? 'border border-[#a7f3d0] bg-[#e6f9f1] text-[#008f5d] hover:bg-[#d1fae5]'
                              : 'bg-[#006cee] hover:bg-[#005ecc] text-white'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>{t.isMergedToB1B2 ? 'Cập nhật gộp B1/B2' : 'Gộp vào B1/B2'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
