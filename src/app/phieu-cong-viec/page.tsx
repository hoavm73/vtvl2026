'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentOperatorSession, clearCurrentOperatorSession, OperatorSession } from '@/services/telemetry/operator-session';
import { ProposedCoordinatedTaskItem, StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { StaffTicketInlineForm } from '@/components/staff-portal/StaffTicketInlineForm';
import { ChangesRequestedAlertBanner, StaffPortalHeaderBanner, StaffTicketsTabBar, StaffTicketsTabKey } from '@/components/staff-portal/StaffTicketsTabBar';
import { ProposedCoordinatedTasksTab } from '@/components/staff-portal/ProposedCoordinatedTasksTab';
import { ProposedCoordinatedSideCard } from '@/components/staff-portal/ProposedCoordinatedSideCard';
import { StaffMyTicketsList } from '@/components/staff-portal/StaffMyTicketsList';
import { UnitTicketsReviewList } from '@/components/staff-portal/UnitTicketsReviewList';
import { UnitVtvlLookupCard } from '@/components/staff-portal/UnitVtvlLookupCard';
import { StaffTicketPrintModal } from '@/components/staff-portal/StaffTicketPrintModal';
import { StaffTicketDetailModal } from '@/components/staff-portal/StaffTicketDetailModal';
import { StaffTicketRevisionModal, TicketModerationModalMode } from '@/components/staff-portal/StaffTicketRevisionModal';
import { StaffTicketMergePreviewModal } from '@/components/staff-portal/StaffTicketMergePreviewModal';
import { CoordinatedTaskModal } from '@/components/staff-portal/CoordinatedTaskModal';
import { syncOperatorAccountWithServer } from '@/services/auth/account-client';

export default function StaffWorkTicketsPage() {
  const router = useRouter();
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [unitNameVi, setUnitNameVi] = useState('');
  const [myTickets, setMyTickets] = useState<StaffWorkTicket[]>([]);
  const [unitTickets, setUnitTickets] = useState<StaffWorkTicket[]>([]);
  const [a1Missions, setA1Missions] = useState<GenericGridRow[]>([]);
  const [c1Vtvls, setC1Vtvls] = useState<GenericGridRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<StaffTicketsTabKey>('my');
  const [proposedItems, setProposedItems] = useState<ProposedCoordinatedTaskItem[]>([]);
  const [myVtvlAssignments, setMyVtvlAssignments] = useState<{ id: string; unitCode: string; maVtvl: string; tenVtvl?: string }[]>([]);
  const [pickedVtvl, setPickedVtvl] = useState<{ code: string; seq: number } | null>(null);

  const [editingTicket, setEditingTicket] = useState<StaffWorkTicket | null>(null), [detailTicket, setDetailTicket] = useState<StaffWorkTicket | null>(null);
  const [printTicket, setPrintTicket] = useState<StaffWorkTicket | null>(null);
  const [moderationModal, setModerationModal] = useState<{ ticket: StaffWorkTicket; mode: TicketModerationModalMode; seq: number } | null>(null);
  const [mergeTicket, setMergeTicket] = useState<StaffWorkTicket | null>(null), [coordTicket, setCoordTicket] = useState<StaffWorkTicket | null>(null);

  const lastLoadedKeyRef = useRef<string>('');
  const isSyncingTokenRef = useRef(false);

  const loadData = useCallback(async (op: OperatorSession, isInitial = false) => {
    if (isInitial) setLoading(true);
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
      const [res, coordRes] = await Promise.all([
        fetch(`/api/tickets?email=${encodeURIComponent(op.email)}&unitCode=${encodeURIComponent(op.unitCode)}`, { headers, cache: 'no-store' }),
        fetch('/api/tickets/coordinated', { headers, cache: 'no-store' })
      ]);
      if (res.ok) {
        const json = await res.json();
        setUnitNameVi(json.unitNameVi || op.unitNameVi);
        setMyTickets(json.myTickets || []);
        setUnitTickets(json.unitTickets || []);
        setA1Missions(json.a1Missions || []);
        setC1Vtvls(json.c1Vtvls || []);
      }
      if (coordRes.ok) {
        const cJson = await coordRes.json();
        setProposedItems(cJson.items || []);
        setMyVtvlAssignments(cJson.myAssignments || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const syncWithSession = useCallback((op: OperatorSession | null, isInitial = false) => {
    if (!op) { router.replace('/login'); return; }
    setSession((prev) => { if (prev && prev.unitCode !== op.unitCode) setEditingTicket(null); return op; });
    setUnitNameVi(op.unitNameVi);
    const key = `${op.email.toLowerCase()}__${op.unitCode.toUpperCase()}`;
    if (lastLoadedKeyRef.current !== key) {
      lastLoadedKeyRef.current = key;
      loadData(op, isInitial);
    }
  }, [router, loadData]);

  const selectTab = useCallback((nextTab: StaffTicketsTabKey) => {
    setActiveTab(nextTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (nextTab === 'my') url.searchParams.delete('tab');
      else url.searchParams.set('tab', nextTab);
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => {
    syncWithSession(getCurrentOperatorSession(), true);
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam === 'pending' || tabParam === 'review') setActiveTab('pending');
      else if (tabParam === 'approved') setActiveTab('approved');
      else if (tabParam === 'unit') setActiveTab('unit');
      else if (tabParam === 'proposed') setActiveTab('proposed');
    }
    const onUp = () => {
      const op = getCurrentOperatorSession();
      if (!op) { router.replace('/login'); return; }
      const key = `${op.email.toLowerCase()}__${op.unitCode.toUpperCase()}`;
      if (lastLoadedKeyRef.current !== key) syncWithSession(op, false);
    };
    const onFocus = () => {
      const cur = getCurrentOperatorSession();
      if (cur) loadData(cur, false);
    };
    window.addEventListener('vtvl-operator-changed', onUp);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('vtvl-operator-changed', onUp);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncWithSession, loadData, router]);

  const isLeader = session?.role === 'unit_leader' || session?.role === 'admin';
  const myDraftTickets = useMemo(() => myTickets.filter((t) => toCanonicalStatus(t.status) === 'draft'), [myTickets]);
  const myChangesRequestedTickets = useMemo(() => myTickets.filter((t) => toCanonicalStatus(t.status) === 'changes_requested'), [myTickets]);
  const reviewSourceTickets = useMemo(() => (isLeader ? unitTickets : myTickets), [isLeader, unitTickets, myTickets]);
  const pendingCount = useMemo(() => reviewSourceTickets.filter((t) => {
    const c = toCanonicalStatus(t.status);
    return c === 'submitted' || c === 'resubmitted' || c === 'changes_requested';
  }).length, [reviewSourceTickets]);
  const approvedCount = useMemo(() => reviewSourceTickets.filter((t) => toCanonicalStatus(t.status) === 'approved').length, [reviewSourceTickets]);

  const sendPatchAction = async (payload: Record<string, unknown>) => {
    if (!session) return false;
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-actor-email': session.email };
    if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const res = await fetch('/api/tickets', { method: 'PATCH', headers, body: JSON.stringify(payload) });
    if (res.ok) { loadData(session); return true; }
    const err = await res.json().catch(() => ({}));
    alert(err.error || 'Thao tác không thành công.');
    return false;
  };

  const handleApprove = async (t: StaffWorkTicket) => {
    if (!window.confirm(`Xác nhận phê duyệt phiếu [${t.maCongViec} - ${t.tenCongViec}] và tự động đưa vào Biểu A2 & B1?`)) return;
    await sendPatchAction({ ticketId: t.id, action: 'approve', unitCode: t.unitCode });
  };
  const handleRevisionSubmit = (t: StaffWorkTicket, mode: TicketModerationModalMode) => setModerationModal({ ticket: t, mode, seq: Date.now() });
  const handleModerationSubmit = async (t: StaffWorkTicket, reason: string) => {
    const mode = moderationModal?.mode || 'request_changes';
    const ok = await sendPatchAction({ ticketId: t.id, action: mode === 'request_changes' ? 'changes_requested' : mode, reason, unitCode: t.unitCode });
    if (ok && editingTicket?.id === t.id) setEditingTicket(null);
  };
  const handleMergeSubmit = async (t: StaffWorkTicket) => { await sendPatchAction({ ticketId: t.id, action: 'merge', unitCode: t.unitCode }); };
  const handleSubmitMyTicket = async (t: StaffWorkTicket, isResubmit: boolean) => {
    const missing: string[] = [];
    if (!t.maNhiemVu) missing.push('Mã nhiệm vụ');
    if (!t.tenCongViec?.trim()) missing.push('Tên công việc cụ thể');
    if (!t.maVtvl) missing.push('Mã VTVL chính');
    if (!t.sanPham?.trim()) missing.push('Sản phẩm đầu ra');
    if (!t.chatLuong?.trim()) missing.push('Tiêu chuẩn chất lượng');
    if (!t.canCu?.trim()) missing.push('Căn cứ pháp lý');
    if (!t.soSpNam || Number(t.soSpNam) <= 0) missing.push('Số sản phẩm hoàn thành trong năm');
    if (!t.nguonSoLieu?.trim()) missing.push('Nguồn số liệu kiểm chứng');
    if (!t.phutThucTe || Number(t.phutThucTe) <= 0) missing.push('Thời gian thực tế (phút/SP)');
    if (isResubmit && !t.lastChangeSummary?.trim()) missing.push('Giải trình nội dung đã cập nhật / chỉnh sửa');
    if (missing.length > 0) {
      setEditingTicket(t); selectTab('my');
      alert(`Vui lòng hoàn thiện các trường bắt buộc ở biểu mẫu bên trái trước khi nộp (trừ các trường "nếu có"):\n• ${missing.join('\n• ')}`);
      return;
    }
    const msg = isResubmit ? `Nộp lại phiếu [${t.maCongViec}] sau khi hoàn thiện?` : `Nộp phiếu [${t.maCongViec}] cho Lãnh đạo đơn vị duyệt?`;
    if (window.confirm(msg)) await sendPatchAction({ ticketId: t.id, action: isResubmit ? 'resubmit' : 'submit', unitCode: t.unitCode, changeSummary: t.lastChangeSummary });
  };

  const handleDelete = async (ticket: StaffWorkTicket) => {
    if (!session || !window.confirm(`Xóa phiếu [${ticket.maCongViec}]?`)) return;
    const headers: Record<string, string> = { 'x-actor-email': session.email };
    if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    const res = await fetch(`/api/tickets?id=${encodeURIComponent(ticket.id)}`, { method: 'DELETE', headers });
    if (res.ok) { if (editingTicket?.id === ticket.id) setEditingTicket(null); loadData(session); }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#f8fbff] text-[#004776] p-3 sm:p-6 print:p-0 print:m-0 print:bg-white print:min-h-0">
      <div className="max-w-[1440px] mx-auto space-y-4 print:space-y-0 print:max-w-none print:w-full">
        <StaffPortalHeaderBanner
          unitCode={session.unitCode} unitNameVi={unitNameVi}
          onCreateNew={() => { selectTab('my'); setEditingTicket(null); }}
          onLogout={() => { clearCurrentOperatorSession(); router.push('/login'); }}
        />

        <StaffTicketsTabBar
          activeTab={activeTab} onSelectTab={selectTab} draftCount={myDraftTickets.length}
          pendingCount={pendingCount} approvedCount={approvedCount}
          unitCount={unitTickets.length} proposedCount={proposedItems.length} isLeader={Boolean(isLeader)}
        />

        {activeTab === 'my' && (
          <div className="space-y-4 print:space-y-0">
            {myChangesRequestedTickets.length > 0 && (
              <ChangesRequestedAlertBanner
                count={myChangesRequestedTickets.length} firstTicket={myChangesRequestedTickets[0]}
                onEditNow={setEditingTicket} onOpenPendingTab={() => selectTab('pending')}
              />
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start print:block">
              <div className="xl:col-span-6 min-w-0 print:w-full">
                <StaffTicketInlineForm
                  unitCode={session.unitCode} ownerEmail={session.email}
                  ownerName={session.displayName || session.email.split('@')[0]} ownerTitle={session.title}
                  editingTicket={editingTicket?.unitCode === session.unitCode ? editingTicket : null}
                  pickedVtvl={pickedVtvl} a1Missions={a1Missions} c1Vtvls={c1Vtvls}
                  onCancelEdit={() => setEditingTicket(null)}
                  onSaved={(st?: StaffWorkTicket) => {
                    if (st) setMyTickets((p) => p.some((t) => t.id === st.id) ? p.map((t) => t.id === st.id ? st : t) : [st, ...p]);
                    loadData(session);
                  }}
                />
              </div>
              <div className="xl:col-span-6 min-w-0 print:hidden space-y-5">
                {myDraftTickets.length > 0 && (
                  <StaffMyTicketsList
                    title="Phiếu nháp chưa gửi duyệt"
                    tickets={myDraftTickets} loading={loading}
                    onEditTicket={(t) => { setEditingTicket(t); selectTab('my'); }}
                    onPrintTicket={setPrintTicket} onViewTicket={setDetailTicket}
                    onCoordTicket={setCoordTicket} onDeleteTicket={handleDelete}
                    onSubmitTicket={handleSubmitMyTicket}
                  />
                )}
                <UnitVtvlLookupCard
                  unitCode={session.unitCode} c1Vtvls={c1Vtvls}
                  onSelectVtvl={(code) => {
                    setPickedVtvl({ code, seq: Date.now() });
                    setEditingTicket((prev) => (prev ? { ...prev, maVtvl: code } : null));
                  }}
                />
                <ProposedCoordinatedSideCard
                  items={proposedItems} myAssignments={myVtvlAssignments}
                  loading={loading} onOpenFullTab={() => selectTab('proposed')}
                />
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'pending' || activeTab === 'approved' || activeTab === 'unit') && (
          <div className="print:hidden">
            <UnitTicketsReviewList
              tickets={activeTab === 'unit' ? unitTickets : reviewSourceTickets}
              loading={loading}
              mode={activeTab === 'unit' ? 'all' : activeTab}
              currentUserRole={session.role} currentUserEmail={session.email}
              onViewTicket={setDetailTicket} onPrintTicket={setPrintTicket}
              onEditTicket={(t) => { setEditingTicket(t); selectTab('my'); }}
              onCoordTicket={setCoordTicket} onSubmitTicket={handleSubmitMyTicket}
              onApproveTicket={isLeader && activeTab !== 'approved' ? handleApprove : undefined}
              onRequestChanges={isLeader && activeTab !== 'approved' ? (t) => handleRevisionSubmit(t, 'request_changes') : undefined}
              onMergeTicket={isLeader && activeTab !== 'pending' ? setMergeTicket : undefined}
              onRevokeApproval={isLeader ? (t) => handleRevisionSubmit(t, 'revoke_approval') : undefined}
              onCancelTicket={isLeader ? (t) => handleRevisionSubmit(t, 'cancel_ticket') : undefined}
            />
          </div>
        )}

        {activeTab === 'proposed' && (
          <div className="print:hidden"><ProposedCoordinatedTasksTab items={proposedItems} myAssignments={myVtvlAssignments} loading={loading} /></div>
        )}
      </div>

      <StaffTicketDetailModal
        ticket={detailTicket} unitNameVi={unitNameVi} currentUserRole={session.role} currentUserEmail={session.email}
        onClose={() => setDetailTicket(null)} onPrint={setPrintTicket}
        onApprove={isLeader ? async (t) => { setDetailTicket(null); await handleApprove(t); } : undefined}
        onRequestChanges={isLeader ? (t) => { setDetailTicket(null); handleRevisionSubmit(t, 'request_changes'); } : undefined}
        onRevokeApproval={isLeader ? (t) => { setDetailTicket(null); handleRevisionSubmit(t, 'revoke_approval'); } : undefined}
        onCancelTicket={isLeader ? (t) => { setDetailTicket(null); handleRevisionSubmit(t, 'cancel_ticket'); } : undefined}
      />
      <StaffTicketPrintModal ticket={printTicket} unitNameVi={unitNameVi} onClose={() => setPrintTicket(null)} />
      {moderationModal && <StaffTicketRevisionModal key={`${moderationModal.ticket.id}-${moderationModal.mode}-${moderationModal.seq}`} ticket={moderationModal.ticket} mode={moderationModal.mode} onClose={() => setModerationModal(null)} onSubmit={handleModerationSubmit} />}
      <StaffTicketMergePreviewModal ticket={mergeTicket} onClose={() => setMergeTicket(null)} onConfirmMerge={handleMergeSubmit} />
      <CoordinatedTaskModal ticket={coordTicket} onClose={() => setCoordTicket(null)} onSaved={() => loadData(session)} />
    </div>
  );
}
