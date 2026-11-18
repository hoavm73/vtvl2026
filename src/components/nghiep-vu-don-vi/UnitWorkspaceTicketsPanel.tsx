'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, ExternalLink, RefreshCw, Users } from 'lucide-react';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { UnitReviewMode } from '@/components/staff-portal/UnitTicketsFilterBar';
import { UnitTicketsReviewList } from '@/components/staff-portal/UnitTicketsReviewList';
import { StaffTicketDetailModal } from '@/components/staff-portal/StaffTicketDetailModal';
import { StaffTicketPrintModal } from '@/components/staff-portal/StaffTicketPrintModal';
import { StaffTicketRevisionModal, TicketModerationModalMode } from '@/components/staff-portal/StaffTicketRevisionModal';
import { StaffTicketMergePreviewModal } from '@/components/staff-portal/StaffTicketMergePreviewModal';

interface UnitWorkspaceTicketsPanelProps {
  unitCode: string;
  unitNameVi: string;
  tickets: StaffWorkTicket[];
  loading: boolean;
  session: OperatorSession | null;
  onRefresh: () => void;
}

export function UnitWorkspaceTicketsPanel({
  unitCode,
  unitNameVi,
  tickets,
  loading,
  session,
  onRefresh
}: UnitWorkspaceTicketsPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<UnitReviewMode>('all');
  const [detailTicket, setDetailTicket] = useState<StaffWorkTicket | null>(null);
  const [printTicket, setPrintTicket] = useState<StaffWorkTicket | null>(null);
  const [mergeTicket, setMergeTicket] = useState<StaffWorkTicket | null>(null);
  const [moderationModal, setModerationModal] = useState<{ ticket: StaffWorkTicket; mode: TicketModerationModalMode; seq: number } | null>(null);

  const isLeader = session?.role === 'admin' || session?.role === 'unit_leader';

  const { pendingCount, approvedCount } = useMemo(() => {
    let pending = 0;
    let approved = 0;
    for (const t of tickets) {
      const c = toCanonicalStatus(t.status);
      if (c === 'submitted' || c === 'resubmitted' || c === 'changes_requested') pending += 1;
      else if (c === 'approved') approved += 1;
    }
    return { pendingCount: pending, approvedCount: approved };
  }, [tickets]);

  const sendPatchAction = async (payload: Record<string, unknown>) => {
    if (!session) return false;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-actor-email': session.email };
    if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const res = await fetch('/api/tickets', { method: 'PATCH', headers, body: JSON.stringify(payload) });
    if (res.ok) {
      onRefresh();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('vtvl-unit-session-updated'));
      return true;
    }
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Thao tác xử lý phiếu không thành công.');
    return false;
  };

  const handleApprove = async (t: StaffWorkTicket) => {
    if (!session) return;
    if (!window.confirm(`Xác nhận phê duyệt phiếu [${t.maCongViec} - ${t.tenCongViec}] của đơn vị [${t.unitCode}] và tự động đưa vào Biểu A2 & B1?`)) return;
    await sendPatchAction({ ticketId: t.id, action: 'approve', unitCode: t.unitCode });
  };

  const openModeration = (t: StaffWorkTicket, m: TicketModerationModalMode) => {
    setModerationModal({ ticket: t, mode: m, seq: Date.now() });
  };

  const handleModerationSubmit = async (t: StaffWorkTicket, reason: string) => {
    const m = moderationModal?.mode || 'request_changes';
    await sendPatchAction({ ticketId: t.id, action: m === 'request_changes' ? 'changes_requested' : m, reason, unitCode: t.unitCode });
  };

  const handleMergeSubmit = async (t: StaffWorkTicket) => {
    await sendPatchAction({ ticketId: t.id, action: 'merge', unitCode: t.unitCode });
  };

  return (
    <div className="space-y-4">
      <div className={`space-y-4 ${(printTicket || detailTicket) ? 'print:hidden' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#0072BC]">Phiếu công việc đơn vị [{unitCode}]</h2>
            <p className="text-xs text-[#476885]">
              Quản lý, xem chi tiết, in PDF (A4), phê duyệt và gộp phiếu đã duyệt vào Biểu A2/B1 của {unitNameVi}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span>Làm mới</span>
            </button>
            <Link
              href={`/phieu-don-vi?unitCode=${encodeURIComponent(unitCode)}`}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" /><span>Mở trang quản lý phiếu</span>
            </Link>
          </div>
        </div>

        <nav role="tablist" aria-label="Bộ lọc trạng thái phiếu đơn vị" className="flex flex-wrap items-center gap-1.5 border-b border-[#e2e8f0] overflow-x-auto no-scrollbar">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'all'}
            onClick={() => setMode('all')}
            className={`inline-flex items-center gap-1.5 h-10 px-3 text-xs font-semibold border-b-[2.2px] -mb-[1px] whitespace-nowrap cursor-pointer transition-colors ${mode === 'all' ? 'border-[#FD8C73] text-[#006cee]' : 'border-transparent text-[#476885] hover:text-[#004776]'}`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" /><span>Toàn bộ phiếu đơn vị ({tickets.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'pending'}
            onClick={() => setMode('pending')}
            className={`inline-flex items-center gap-1.5 h-10 px-3 text-xs font-semibold border-b-[2.2px] -mb-[1px] whitespace-nowrap cursor-pointer transition-colors ${mode === 'pending' ? 'border-[#FD8C73] text-[#006cee]' : 'border-transparent text-[#476885] hover:text-[#004776]'}`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" /><span>Chờ duyệt &amp; Yêu cầu bổ sung</span>
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold ${pendingCount > 0 ? 'bg-amber-500 text-white' : 'bg-[#e1edf8] text-[#20446c]'}`}>{pendingCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'approved'}
            onClick={() => setMode('approved')}
            className={`inline-flex items-center gap-1.5 h-10 px-3 text-xs font-semibold border-b-[2.2px] -mb-[1px] whitespace-nowrap cursor-pointer transition-colors ${mode === 'approved' ? 'border-[#FD8C73] text-[#006cee]' : 'border-transparent text-[#476885] hover:text-[#004776]'}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /><span>Đã duyệt &amp; Gộp B1/B2</span>
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-[#ecfdf5] text-[#13653f]">{approvedCount}</span>
          </button>
        </nav>

        <UnitTicketsReviewList
          tickets={tickets}
          loading={loading}
          mode={mode}
          unitFilter={unitCode}
          currentUserRole={session?.role}
          currentUserEmail={session?.email}
          onViewTicket={setDetailTicket}
          onPrintTicket={setPrintTicket}
          onEditTicket={(t) => router.push(`/phieu-cong-viec?editId=${encodeURIComponent(t.id)}`)}
          onApproveTicket={isLeader ? handleApprove : undefined}
          onRequestChanges={isLeader ? (t) => openModeration(t, 'request_changes') : undefined}
          onMergeTicket={isLeader ? setMergeTicket : undefined}
          onRevokeApproval={isLeader ? (t) => openModeration(t, 'revoke_approval') : undefined}
          onCancelTicket={isLeader ? (t) => openModeration(t, 'cancel_ticket') : undefined}
        />
      </div>

      <StaffTicketDetailModal
        ticket={detailTicket}
        unitNameVi={detailTicket ? findHcmuteUnit(detailTicket.unitCode).nameVi : unitNameVi}
        currentUserRole={session?.role}
        currentUserEmail={session?.email}
        onClose={() => setDetailTicket(null)}
        onApprove={isLeader ? async (t) => { setDetailTicket(null); await handleApprove(t); } : undefined}
        onRequestChanges={isLeader ? (t) => { setDetailTicket(null); openModeration(t, 'request_changes'); } : undefined}
        onRevokeApproval={isLeader ? (t) => { setDetailTicket(null); openModeration(t, 'revoke_approval'); } : undefined}
        onCancelTicket={isLeader ? (t) => { setDetailTicket(null); openModeration(t, 'cancel_ticket'); } : undefined}
      />
      <StaffTicketPrintModal
        ticket={printTicket}
        unitNameVi={printTicket ? findHcmuteUnit(printTicket.unitCode).nameVi : unitNameVi}
        onClose={() => setPrintTicket(null)}
      />
      {moderationModal && (
        <StaffTicketRevisionModal
          key={`${moderationModal.ticket.id}-${moderationModal.mode}-${moderationModal.seq}`}
          ticket={moderationModal.ticket}
          mode={moderationModal.mode}
          onClose={() => setModerationModal(null)}
          onSubmit={handleModerationSubmit}
        />
      )}
      <StaffTicketMergePreviewModal
        ticket={mergeTicket}
        onClose={() => setMergeTicket(null)}
        onConfirmMerge={handleMergeSubmit}
      />
    </div>
  );
}
