'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentOperatorSession, OperatorSession } from '@/services/telemetry/operator-session';
import { syncOperatorAccountWithServer } from '@/services/auth/account-client';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { UnitTicketsReviewList } from '@/components/staff-portal/UnitTicketsReviewList';
import { UnitReviewMode } from '@/components/staff-portal/UnitTicketsFilterBar';
import { UnitTicketsHeaderBar } from '@/components/staff-portal/UnitTicketsHeaderBar';
import { StaffTicketDetailModal } from '@/components/staff-portal/StaffTicketDetailModal';
import { StaffTicketPrintModal } from '@/components/staff-portal/StaffTicketPrintModal';
import { StaffTicketRevisionModal, TicketModerationModalMode } from '@/components/staff-portal/StaffTicketRevisionModal';
import { StaffTicketMergePreviewModal } from '@/components/staff-portal/StaffTicketMergePreviewModal';
import { syncContextQueryParams } from '@/services/context/workbook-context';

export default function UnitTicketsManagementPage() {
  const router = useRouter();
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [tickets, setTickets] = useState<StaffWorkTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<UnitReviewMode>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');

  const [detailTicket, setDetailTicket] = useState<StaffWorkTicket | null>(null);
  const [printTicket, setPrintTicket] = useState<StaffWorkTicket | null>(null);
  const [mergeTicket, setMergeTicket] = useState<StaffWorkTicket | null>(null);
  const [moderationModal, setModerationModal] = useState<{ ticket: StaffWorkTicket; mode: TicketModerationModalMode; seq: number } | null>(null);
  const isSyncingTokenRef = useRef(false);

  const loadTicketsData = useCallback(async (op: OperatorSession, showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      let activeToken = op.accessToken;
      if (!activeToken && !isSyncingTokenRef.current) {
        isSyncingTokenRef.current = true;
        try {
          await syncOperatorAccountWithServer(op);
          const refreshed = getCurrentOperatorSession();
          if (refreshed?.accessToken) activeToken = refreshed.accessToken;
        } finally {
          isSyncingTokenRef.current = false;
        }
      }
      const headers: Record<string, string> = { 'x-actor-email': op.email };
      if (activeToken) headers.Authorization = `Bearer ${activeToken}`;
      const queryUnit = op.role === 'admin' ? 'ALL' : op.unitCode;
      const res = await fetch(`/api/tickets?email=${encodeURIComponent(op.email)}&unitCode=${encodeURIComponent(queryUnit)}`, { headers, cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setTickets(json.unitTickets || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cur = getCurrentOperatorSession();
    if (!cur) { router.replace('/login?redirect=/phieu-don-vi'); return; }
    setSession(cur);

    const applyUrlParams = () => {
      const params = new URLSearchParams(window.location.search);
      const uParam = (params.get('unitCode') || params.get('unit') || '').trim().toUpperCase();
      if (cur.role === 'admin' && uParam) setSelectedUnit(uParam === 'ALL' ? 'ALL' : findHcmuteUnit(uParam).code);
      else if (cur.role !== 'admin') setSelectedUnit(cur.unitCode);
      else if (!uParam) setSelectedUnit('ALL');
      const mParam = params.get('tab') || params.get('mode');
      setMode(mParam === 'pending' || mParam === 'approved' || mParam === 'all' ? mParam : 'all');
    };
    applyUrlParams();
    window.addEventListener('popstate', applyUrlParams);
    loadTicketsData(cur, true);

    const onOperatorChanged = () => {
      const next = getCurrentOperatorSession();
      if (!next) { router.replace('/login'); return; }
      setSession(next);
      loadTicketsData(next, false);
    };
    window.addEventListener('vtvl-operator-changed', onOperatorChanged);
    return () => {
      window.removeEventListener('popstate', applyUrlParams);
      window.removeEventListener('vtvl-operator-changed', onOperatorChanged);
    };
  }, [router, loadTicketsData]);

  const isAdmin = session?.role === 'admin';
  const isLeader = isAdmin || session?.role === 'unit_leader';

  const unitCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tickets) {
      const uc = (t.unitCode || '').toUpperCase();
      if (uc) map[uc] = (map[uc] || 0) + 1;
    }
    return map;
  }, [tickets]);

  const scopedTickets = useMemo(() => {
    if (!isAdmin || selectedUnit === 'ALL') return tickets;
    const uc = selectedUnit.toUpperCase();
    return tickets.filter((t) => (t.unitCode || '').toUpperCase() === uc);
  }, [tickets, isAdmin, selectedUnit]);

  const { pendingCount, approvedCount } = useMemo(() => {
    let pending = 0, approved = 0;
    for (const t of scopedTickets) {
      const c = toCanonicalStatus(t.status);
      if (c === 'submitted' || c === 'resubmitted' || c === 'changes_requested') pending += 1;
      else if (c === 'approved') approved += 1;
    }
    return { pendingCount: pending, approvedCount: approved };
  }, [scopedTickets]);

  const sendPatchAction = async (payload: Record<string, unknown>) => {
    if (!session) return false;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-actor-email': session.email };
    if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const res = await fetch('/api/tickets', { method: 'PATCH', headers, body: JSON.stringify(payload) });
    if (res.ok) { loadTicketsData(session, false); return true; }
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Thao tác xử lý phiếu không thành công.');
    return false;
  };

  const handleApprove = async (t: StaffWorkTicket) => {
    if (!session) return;
    if (!window.confirm(`Xác nhận phê duyệt phiếu [${t.maCongViec} - ${t.tenCongViec}] của đơn vị [${t.unitCode}] và tự động đưa vào Biểu A2 & B1?`)) return;
    await sendPatchAction({ ticketId: t.id, action: 'approve', unitCode: t.unitCode });
  };

  const handleRevisionSubmit = (t: StaffWorkTicket, m: TicketModerationModalMode) => setModerationModal({ ticket: t, mode: m, seq: Date.now() });
  const handleModerationSubmit = async (t: StaffWorkTicket, reason: string) => {
    const m = moderationModal?.mode || 'request_changes';
    await sendPatchAction({ ticketId: t.id, action: m === 'request_changes' ? 'changes_requested' : m, reason, unitCode: t.unitCode });
  };
  const handleMergeSubmit = async (t: StaffWorkTicket) => { await sendPatchAction({ ticketId: t.id, action: 'merge', unitCode: t.unitCode }); };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#f8fbff] text-[#004776] p-3 sm:p-6">
      <div className="max-w-[1440px] mx-auto space-y-4">
        <UnitTicketsHeaderBar
          isAdmin={Boolean(isAdmin)}
          sessionUnitCode={session.unitCode}
          sessionUnitNameVi={session.unitNameVi}
          selectedUnit={selectedUnit}
          totalTicketsCount={tickets.length}
          scopedCount={scopedTickets.length}
          pendingCount={pendingCount}
          approvedCount={approvedCount}
          unitCounts={unitCounts}
          mode={mode}
          loading={loading}
          onSelectUnit={(nextU) => {
            setSelectedUnit(nextU);
            syncContextQueryParams({ unitCode: nextU === 'ALL' ? null : nextU, tab: mode === 'all' ? null : mode }, 'push');
          }}
          onSelectMode={(nextM) => {
            setMode(nextM);
            syncContextQueryParams({ tab: nextM === 'all' ? null : nextM, unitCode: selectedUnit === 'ALL' ? null : selectedUnit }, 'push');
          }}
          onRefresh={() => loadTicketsData(session, true)}
        />

        <UnitTicketsReviewList
          tickets={tickets} loading={loading} mode={mode} unitFilter={selectedUnit}
          onUnitFilterChange={(u) => { setSelectedUnit(u); syncContextQueryParams({ unitCode: u === 'ALL' ? null : u, tab: mode === 'all' ? null : mode }, 'push'); }}
          currentUserRole={session.role} currentUserEmail={session.email}
          onViewTicket={setDetailTicket} onPrintTicket={setPrintTicket}
          onEditTicket={(t) => router.push(`/phieu-cong-viec?editId=${encodeURIComponent(t.id)}`)}
          onApproveTicket={isLeader ? handleApprove : undefined}
          onRequestChanges={isLeader ? (t) => handleRevisionSubmit(t, 'request_changes') : undefined}
          onMergeTicket={isLeader ? setMergeTicket : undefined}
          onRevokeApproval={isLeader ? (t) => handleRevisionSubmit(t, 'revoke_approval') : undefined}
          onCancelTicket={isLeader ? (t) => handleRevisionSubmit(t, 'cancel_ticket') : undefined}
        />
      </div>

      <StaffTicketDetailModal
        ticket={detailTicket} unitNameVi={detailTicket ? findHcmuteUnit(detailTicket.unitCode).nameVi : session.unitNameVi}
        currentUserRole={session.role} currentUserEmail={session.email} onClose={() => setDetailTicket(null)} onPrint={setPrintTicket}
        onApprove={isLeader ? async (t) => { setDetailTicket(null); await handleApprove(t); } : undefined}
        onRequestChanges={isLeader ? (t) => { setDetailTicket(null); handleRevisionSubmit(t, 'request_changes'); } : undefined}
        onRevokeApproval={isLeader ? (t) => { setDetailTicket(null); handleRevisionSubmit(t, 'revoke_approval'); } : undefined}
        onCancelTicket={isLeader ? (t) => { setDetailTicket(null); handleRevisionSubmit(t, 'cancel_ticket'); } : undefined}
      />
      <StaffTicketPrintModal ticket={printTicket} unitNameVi={printTicket ? findHcmuteUnit(printTicket.unitCode).nameVi : session.unitNameVi} onClose={() => setPrintTicket(null)} />
      {moderationModal && <StaffTicketRevisionModal key={`${moderationModal.ticket.id}-${moderationModal.mode}-${moderationModal.seq}`} ticket={moderationModal.ticket} mode={moderationModal.mode} onClose={() => setModerationModal(null)} onSubmit={handleModerationSubmit} />}
      <StaffTicketMergePreviewModal ticket={mergeTicket} onClose={() => setMergeTicket(null)} onConfirmMerge={handleMergeSubmit} />
    </div>
  );
}
