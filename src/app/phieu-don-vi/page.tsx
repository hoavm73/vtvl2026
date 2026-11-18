'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, CheckCircle2, ClipboardCheck, Clock, FileSpreadsheet, RefreshCw, ShieldCheck, Users
} from 'lucide-react';
import { getCurrentOperatorSession, OperatorSession } from '@/services/telemetry/operator-session';
import { syncOperatorAccountWithServer } from '@/services/auth/account-client';
import { HCMUTE_UNITS, findHcmuteUnit } from '@/configs/hcmute-units';
import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { UnitTicketsReviewList } from '@/components/staff-portal/UnitTicketsReviewList';
import { UnitReviewMode } from '@/components/staff-portal/UnitTicketsFilterBar';
import { StaffTicketDetailModal } from '@/components/staff-portal/StaffTicketDetailModal';
import { StaffTicketPrintModal } from '@/components/staff-portal/StaffTicketPrintModal';
import { StaffTicketRevisionModal, TicketModerationModalMode } from '@/components/staff-portal/StaffTicketRevisionModal';
import { StaffTicketMergePreviewModal } from '@/components/staff-portal/StaffTicketMergePreviewModal';

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
      const res = await fetch(`/api/tickets?email=${encodeURIComponent(op.email)}&unitCode=${encodeURIComponent(queryUnit)}`, {
        headers,
        cache: 'no-store'
      });
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
    if (!cur) {
      router.replace('/login?redirect=/phieu-don-vi');
      return;
    }
    setSession(cur);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const uParam = (params.get('unitCode') || params.get('unit') || '').trim().toUpperCase();
      if (cur.role === 'admin' && uParam) {
        setSelectedUnit(uParam === 'ALL' ? 'ALL' : findHcmuteUnit(uParam).code);
      } else if (cur.role !== 'admin') {
        setSelectedUnit(cur.unitCode);
      }
      const mParam = params.get('mode') || params.get('tab');
      if (mParam === 'pending' || mParam === 'approved' || mParam === 'all') setMode(mParam);
    }
    loadTicketsData(cur, true);

    const onOperatorChanged = () => {
      const next = getCurrentOperatorSession();
      if (!next) { router.replace('/login'); return; }
      setSession(next);
      loadTicketsData(next, false);
    };
    window.addEventListener('vtvl-operator-changed', onOperatorChanged);
    return () => window.removeEventListener('vtvl-operator-changed', onOperatorChanged);
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

  const handleMergeSubmit = async (t: StaffWorkTicket) => {
    await sendPatchAction({ ticketId: t.id, action: 'merge', unitCode: t.unitCode });
  };

  if (!session) return null;

  const currentUnitDef = selectedUnit !== 'ALL' ? findHcmuteUnit(selectedUnit) : null;
  const activeUnitTitle = isAdmin
    ? (selectedUnit === 'ALL' ? 'Toàn trường (39 đơn vị HCM-UTE)' : `${currentUnitDef?.nameVi} (${currentUnitDef?.code})`)
    : `${session.unitNameVi} (${session.unitCode})`;

  return (
    <div className="min-h-screen bg-[#f8fbff] text-[#004776] p-3 sm:p-6">
      <div className="max-w-[1440px] mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-[#dbeafe] shadow-xs p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0072BC] bg-[#eef5ff] px-3 py-1 rounded-full">
              {isAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
              <span>{isAdmin ? `Phòng Tổ chức – Nhân sự · ${activeUnitTitle}` : activeUnitTitle}</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-[#004776] flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-[#006cee] shrink-0" />
              <span>Quản lý & xử lý phiếu công việc đơn vị</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                aria-label="Chọn đơn vị cần xem và xử lý phiếu"
                className="h-10 px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fbff] text-xs font-bold text-[#004776] focus:border-[#006cee] outline-none cursor-pointer"
              >
                <option value="ALL">Tất cả 39 đơn vị ({tickets.length} phiếu)</option>
                {HCMUTE_UNITS.map((u) => (
                  <option key={u.code} value={u.code}>
                    [{u.code}] {u.nameVi} ({unitCounts[u.code.toUpperCase()] || 0} phiếu)
                  </option>
                ))}
              </select>
            )}
            <Link
              href={`/bang-tinh?unit=${encodeURIComponent(selectedUnit === 'ALL' ? session.unitCode : selectedUnit)}`}
              className="h-10 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] inline-flex items-center gap-1.5 shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#0072BC]" />
              <span>Bảng tính 10 biểu</span>
            </Link>
            <button
              type="button"
              onClick={() => loadTicketsData(session, true)}
              className="h-10 px-3.5 rounded-xl bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 border-b border-[#cbd5e1] bg-white px-4 pt-1.5 rounded-t-2xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setMode('all')}
            className={`inline-flex items-center gap-2 px-3.5 py-3 text-[13px] font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'all' ? 'border-[#006cee] text-[#006cee]' : 'border-transparent text-[#476b8e] hover:text-[#004776]'
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Toàn bộ phiếu đơn vị ({scopedTickets.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('pending')}
            className={`inline-flex items-center gap-2 px-3.5 py-3 text-[13px] font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'pending' ? 'border-[#006cee] text-[#006cee]' : 'border-transparent text-[#476b8e] hover:text-[#004776]'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>Chờ duyệt & Yêu cầu bổ sung</span>
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold ${pendingCount > 0 ? 'bg-amber-500 text-white' : 'bg-[#e1edf8] text-[#20446c]'}`}>
              {pendingCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode('approved')}
            className={`inline-flex items-center gap-2 px-3.5 py-3 text-[13px] font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              mode === 'approved' ? 'border-[#006cee] text-[#006cee]' : 'border-transparent text-[#476b8e] hover:text-[#004776]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Đã duyệt & Gộp B1/B2</span>
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold ${approvedCount > 0 ? 'bg-emerald-600 text-white' : 'bg-[#e1edf8] text-[#20446c]'}`}>
              {approvedCount}
            </span>
          </button>
        </div>

        <UnitTicketsReviewList
          tickets={tickets}
          loading={loading}
          mode={mode}
          unitFilter={selectedUnit}
          onUnitFilterChange={setSelectedUnit}
          currentUserRole={session.role}
          currentUserEmail={session.email}
          onViewTicket={setDetailTicket}
          onPrintTicket={setPrintTicket}
          onEditTicket={(t) => router.push(`/phieu-cong-viec?editId=${encodeURIComponent(t.id)}`)}
          onApproveTicket={isLeader ? handleApprove : undefined}
          onRequestChanges={isLeader ? (t) => handleRevisionSubmit(t, 'request_changes') : undefined}
          onMergeTicket={isLeader ? setMergeTicket : undefined}
          onRevokeApproval={isLeader ? (t) => handleRevisionSubmit(t, 'revoke_approval') : undefined}
          onCancelTicket={isLeader ? (t) => handleRevisionSubmit(t, 'cancel_ticket') : undefined}
        />
      </div>

      <StaffTicketDetailModal
        ticket={detailTicket}
        unitNameVi={detailTicket ? findHcmuteUnit(detailTicket.unitCode).nameVi : session.unitNameVi}
        currentUserRole={session.role}
        currentUserEmail={session.email}
        onClose={() => setDetailTicket(null)}
        onPrint={setPrintTicket}
        onApprove={isLeader ? async (t) => { setDetailTicket(null); await handleApprove(t); } : undefined}
        onRequestChanges={isLeader ? (t) => { setDetailTicket(null); handleRevisionSubmit(t, 'request_changes'); } : undefined}
        onRevokeApproval={isLeader ? (t) => { setDetailTicket(null); handleRevisionSubmit(t, 'revoke_approval'); } : undefined}
        onCancelTicket={isLeader ? (t) => { setDetailTicket(null); handleRevisionSubmit(t, 'cancel_ticket'); } : undefined}
      />
      <StaffTicketPrintModal
        ticket={printTicket}
        unitNameVi={printTicket ? findHcmuteUnit(printTicket.unitCode).nameVi : session.unitNameVi}
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
