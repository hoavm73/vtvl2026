'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { User, Link2 } from 'lucide-react';
import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { getTicketCoordinatedVtvlBadges } from '@/services/tickets/vtvl-coordination-helpers';
import { TicketApprovalProgress, getTicketStatusMeta } from './TicketApprovalProgress';
import { formatApprovalDateTime } from './TicketApprovalHistoryTimeline';
import { UnitTicketActionButtons } from './UnitTicketActionButtons';
import { TicketListSkeleton } from '@/components/ui/Skeleton';
import {
  ApprovedSubFilter,
  PendingSubFilter,
  UnitReviewMode,
  UnitTicketsFilterBar
} from './UnitTicketsFilterBar';

interface UnitTicketsReviewListProps {
  tickets: StaffWorkTicket[];
  loading: boolean;
  currentUserRole?: 'admin' | 'unit_leader' | 'staff';
  currentUserEmail?: string;
  mode?: UnitReviewMode;
  unitFilter?: string;
  onUnitFilterChange?: (unitCode: string) => void;
  onViewTicket: (ticket: StaffWorkTicket) => void;
  onPrintTicket: (ticket: StaffWorkTicket) => void;
  onEditTicket?: (ticket: StaffWorkTicket) => void;
  onCoordTicket?: (ticket: StaffWorkTicket) => void;
  onSubmitTicket?: (ticket: StaffWorkTicket, isResubmit: boolean) => void;
  onApproveTicket?: (ticket: StaffWorkTicket) => Promise<void>;
  onRequestChanges?: (ticket: StaffWorkTicket) => void;
  onMergeTicket?: (ticket: StaffWorkTicket) => void;
  onRevokeApproval?: (ticket: StaffWorkTicket) => void;
  onCancelTicket?: (ticket: StaffWorkTicket) => void;
}

export function UnitTicketsReviewList({
  tickets, loading, currentUserRole, currentUserEmail, mode = 'all',
  unitFilter: controlledUnitFilter, onUnitFilterChange,
  onViewTicket, onPrintTicket, onEditTicket, onCoordTicket, onSubmitTicket,
  onApproveTicket, onRequestChanges, onMergeTicket, onRevokeApproval, onCancelTicket
}: UnitTicketsReviewListProps) {
  const isLeader = currentUserRole === 'unit_leader' || currentUserRole === 'admin';
  const isAdmin = currentUserRole === 'admin';
  const [internalUnitFilter, setInternalUnitFilter] = useState('ALL');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const param = (new URLSearchParams(window.location.search).get('unitCode') || 'ALL').toUpperCase();
    setInternalUnitFilter(param);
  }, []);
  const activeUnitFilter = controlledUnitFilter !== undefined ? controlledUnitFilter : internalUnitFilter;
  const handleUnitFilterChange = (nextUnit: string) => {
    setInternalUnitFilter(nextUnit);
    onUnitFilterChange?.(nextUnit);
  };
  const [search, setSearch] = useState('');
  const [pendingSubFilter, setPendingSubFilter] = useState<PendingSubFilter>('ALL');
  const [approvedSubFilter, setApprovedSubFilter] = useState<ApprovedSubFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [missionFilter, setMissionFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const unitCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tickets) {
      const uc = (t.unitCode || '').toUpperCase();
      if (uc) map[uc] = (map[uc] || 0) + 1;
    }
    return map;
  }, [tickets]);

  const unitScopedTickets = useMemo(() => {
    if (!isAdmin || !activeUnitFilter || activeUnitFilter === 'ALL') return tickets;
    const uc = activeUnitFilter.toUpperCase();
    return tickets.filter((t) => (t.unitCode || '').toUpperCase() === uc);
  }, [tickets, isAdmin, activeUnitFilter]);

  const owners = useMemo(() => Array.from(new Set(unitScopedTickets.map((t) => t.ownerName || t.ownerEmail))), [unitScopedTickets]);
  const missions = useMemo(() => Array.from(new Set(unitScopedTickets.map((t) => t.maNhiemVu).filter(Boolean))), [unitScopedTickets]);

  const { waitingCount, changesCount, unmergedCount, mergedCount } = useMemo(() => {
    let waitingCount = 0, changesCount = 0, unmergedCount = 0, mergedCount = 0;
    for (const t of unitScopedTickets) {
      const c = toCanonicalStatus(t.status);
      if (c === 'submitted' || c === 'resubmitted') waitingCount += 1;
      else if (c === 'changes_requested') changesCount += 1;
      else if (c === 'approved') { if (t.isMergedToB1B2) mergedCount += 1; else unmergedCount += 1; }
    }
    return { waitingCount, changesCount, unmergedCount, mergedCount };
  }, [unitScopedTickets]);

  const displayedTickets = useMemo(() => {
    let list = [...unitScopedTickets];
    if (mode === 'pending') {
      list = list.filter((t) => {
        const c = toCanonicalStatus(t.status);
        if (pendingSubFilter === 'WAITING') return c === 'submitted' || c === 'resubmitted';
        if (pendingSubFilter === 'CHANGES') return c === 'changes_requested';
        return c === 'submitted' || c === 'resubmitted' || c === 'changes_requested';
      });
      list.sort((a, b) => (b.revisionRequestedAt || b.resubmittedAt || b.submittedAt || b.updatedAt).localeCompare(a.revisionRequestedAt || a.resubmittedAt || a.submittedAt || a.updatedAt));
    } else if (mode === 'approved') {
      list = list.filter((t) => {
        if (toCanonicalStatus(t.status) !== 'approved') return false;
        if (approvedSubFilter === 'UNMERGED') return !t.isMergedToB1B2;
        if (approvedSubFilter === 'MERGED') return Boolean(t.isMergedToB1B2);
        return true;
      });
      list.sort((a, b) => (b.approvedAt || b.updatedAt).localeCompare(a.approvedAt || a.updatedAt));
    } else {
      if (statusFilter !== 'ALL') list = list.filter((t) => toCanonicalStatus(t.status) === statusFilter);
      if (ownerFilter !== 'ALL') list = list.filter((t) => (t.ownerName || t.ownerEmail) === ownerFilter);
      if (missionFilter !== 'ALL') list = list.filter((t) => t.maNhiemVu === missionFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) =>
        t.tenCongViec.toLowerCase().includes(q) || t.maCongViec.toLowerCase().includes(q) ||
        (t.maNhiemVu || '').toLowerCase().includes(q) || t.ownerName.toLowerCase().includes(q) || t.ownerEmail.toLowerCase().includes(q)
      );
    }
    return list;
  }, [unitScopedTickets, mode, pendingSubFilter, approvedSubFilter, statusFilter, ownerFilter, missionFilter, search]);

  const totalPages = Math.max(1, Math.ceil(displayedTickets.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedTickets = useMemo(
    () => displayedTickets.slice((safePage - 1) * pageSize, safePage * pageSize),
    [displayedTickets, safePage, pageSize]
  );

  const emptyText = mode === 'pending'
    ? 'Hiện tại không có phiếu nào đang chờ duyệt hoặc yêu cầu bổ sung.'
    : mode === 'approved' ? 'Chưa có phiếu nào được phê duyệt.' : 'Không có phiếu công việc phù hợp điều kiện lọc.';

  return (
    <div className="bg-white rounded-2xl border border-[#dbe8f5] shadow-[0_2px_14px_-4px_rgba(0,71,118,0.06)] overflow-hidden">
      <UnitTicketsFilterBar
        mode={mode} isLeader={isLeader} showUnitFilter={isAdmin}
        unitFilter={activeUnitFilter} onUnitFilterChange={handleUnitFilterChange}
        unitCounts={unitCounts} totalAllUnitsCount={tickets.length}
        displayedCount={displayedTickets.length}
        search={search} onSearchChange={setSearch}
        pendingSubFilter={pendingSubFilter} onPendingSubFilterChange={setPendingSubFilter}
        waitingCount={waitingCount} changesCount={changesCount}
        approvedSubFilter={approvedSubFilter} onApprovedSubFilterChange={setApprovedSubFilter}
        unmergedCount={unmergedCount} mergedCount={mergedCount}
        statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
        ownerFilter={ownerFilter} onOwnerFilterChange={setOwnerFilter}
        missionFilter={missionFilter} onMissionFilterChange={setMissionFilter}
        owners={owners} missions={missions}
      />

      <div className="divide-y divide-[#eef3f8]">
        {loading && tickets.length === 0 ? (
          <TicketListSkeleton rows={3} />
        ) : displayedTickets.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#20446c]">{emptyText}</div>
        ) : (
          pagedTickets.map((t) => {
            const hours = Math.round((((t.soSpNam * t.phutThucTe) / 60) + t.gioBoSung) * 10) / 10;
            const meta = getTicketStatusMeta(t);
            const StatusIcon = meta.Icon;
            const canonical = meta.canonical;
            const coordBadges = getTicketCoordinatedVtvlBadges(t);
            const isOwnTicket = t.ownerEmail.toLowerCase() === (currentUserEmail || '').toLowerCase();
            const isOwnLeaderTicket = currentUserRole === 'unit_leader' && isOwnTicket;
            const submittedDateIso = t.resubmittedAt || t.submittedAt;

            return (
              <div key={t.id} className="relative pl-4 sm:pl-5 pr-4 sm:pr-5 py-4 hover:bg-[#f8fbff]/80 transition-colors">
                <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${meta.stripeCls}`} />

                <div className="flex flex-col xl:flex-row xl:items-stretch justify-between gap-4">
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
                        {t.updatedAt && (
                          <span className="tabular-nums">• Cập nhật: <strong className="text-[#004776]">{formatApprovalDateTime(t.updatedAt)}</strong></span>
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
                    {coordBadges.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {coordBadges.map((b) => (
                          <span key={b.key} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#eef5ff] border border-[#bfdbfe] text-[#004776] font-medium">
                            <Link2 className="w-3 h-3 text-[#006cee] shrink-0" />
                            <span>Phối hợp: <strong>{b.label}</strong>{b.note ? ` (${b.note})` : ''}</span>
                          </span>
                        ))}
                      </div>
                    )}

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

                  <div className="xl:w-auto xl:min-w-[440px] shrink-0 flex flex-col xl:items-end justify-between gap-2.5 pt-3 xl:pt-0 border-t xl:border-t-0 xl:border-l border-[#e8eff7] xl:pl-4">
                    <div className="flex flex-wrap items-center xl:justify-end gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.pillCls}`}><StatusIcon className="w-3 h-3" />{meta.label}</span>
                      {t.isMergedToB1B2 && <span className="text-[11px] font-bold text-[#008f5d] bg-[#e6f9f1] px-2.5 py-0.5 rounded-full border border-[#a7f3d0]">Đã gộp B1/B2</span>}
                    </div>
                    <TicketApprovalProgress ticket={t} />
                    <UnitTicketActionButtons
                      ticket={t} canonical={canonical} isLeader={isLeader} isOwnTicket={isOwnTicket} isOwnLeaderTicket={isOwnLeaderTicket}
                      onViewTicket={onViewTicket} onPrintTicket={onPrintTicket} onEditTicket={onEditTicket} onCoordTicket={onCoordTicket}
                      onSubmitTicket={onSubmitTicket} onApproveTicket={onApproveTicket} onRequestChanges={onRequestChanges}
                      onMergeTicket={onMergeTicket} onRevokeApproval={onRevokeApproval} onCancelTicket={onCancelTicket}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {displayedTickets.length > pageSize && (
        <div className="px-4 py-2.5 bg-[#f8fafc] border-t border-[#e2e8f0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#004776] tabular-nums">
          <span>Hiển thị <strong>{pagedTickets.length}</strong> / <strong>{displayedTickets.length}</strong> phiếu</span>
          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Số phiếu mỗi trang" className="h-7 px-2 rounded border border-[#cbd5e1] bg-white text-[#004776]">
              <option value={25}>25 / trang</option>
              <option value={50}>50 / trang</option>
            </select>
            <button type="button" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-7 px-2.5 rounded border border-[#cbd5e1] bg-white disabled:opacity-40 cursor-pointer">Trước</button>
            <span className="font-semibold">Trang {safePage}/{totalPages}</span>
            <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="h-7 px-2.5 rounded border border-[#cbd5e1] bg-white disabled:opacity-40 cursor-pointer">Sau</button>
          </div>
        </div>
      )}
    </div>
  );
}
