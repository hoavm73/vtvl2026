'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentOperatorSession, OperatorSession } from '@/services/telemetry/operator-session';
import { performFullLogout } from '@/services/auth/google-auth';
import { ProposedCoordinatedTaskItem, StaffWorkTicket, WorkRelationshipItem, toCanonicalStatus } from '@/types/staff-ticket';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { StaffTicketInlineForm } from '@/components/staff-portal/StaffTicketInlineForm';
import { ChangesRequestedAlertBanner, StaffPortalHeaderBanner, StaffTicketsTabBar, StaffTicketsTabKey } from '@/components/staff-portal/StaffTicketsTabBar';
import { ProposedCoordinatedTasksTab } from '@/components/staff-portal/ProposedCoordinatedTasksTab';
import { ProposedCoordinatedSideCard } from '@/components/staff-portal/ProposedCoordinatedSideCard';
import { WorkRelationshipsTab } from '@/components/staff-portal/WorkRelationshipsTab';
import { StaffMyTicketsList } from '@/components/staff-portal/StaffMyTicketsList';
import { UnitVtvlLookupCard } from '@/components/staff-portal/UnitVtvlLookupCard';
import { StaffTicketPrintModal } from '@/components/staff-portal/StaffTicketPrintModal';
import { StaffTicketDetailModal } from '@/components/staff-portal/StaffTicketDetailModal';
import { CoordinatedTaskModal } from '@/components/staff-portal/CoordinatedTaskModal';
import { syncOperatorAccountWithServer } from '@/services/auth/account-client';
import { syncContextQueryParams } from '@/services/context/workbook-context';
import { PageWorkspaceSkeleton } from '@/components/ui/Skeleton';

export default function StaffWorkTicketsPage() {
  const router = useRouter();
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [unitNameVi, setUnitNameVi] = useState('');
  const [myTickets, setMyTickets] = useState<StaffWorkTicket[]>([]);
  const [a1Missions, setA1Missions] = useState<GenericGridRow[]>([]);
  const [c1Vtvls, setC1Vtvls] = useState<GenericGridRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<StaffTicketsTabKey>('my-tickets');
  const [proposedItems, setProposedItems] = useState<ProposedCoordinatedTaskItem[]>([]), [relationships, setRelationships] = useState<WorkRelationshipItem[]>([]);
  const [myVtvlAssignments, setMyVtvlAssignments] = useState<{ id: string; unitCode: string; maVtvl: string; tenVtvl?: string }[]>([]);
  const [pickedVtvl, setPickedVtvl] = useState<{ code: string; seq: number } | null>(null), [activeVtvlCode, setActiveVtvlCode] = useState('');

  const [editingTicket, setEditingTicket] = useState<StaffWorkTicket | null>(null), [detailTicket, setDetailTicket] = useState<StaffWorkTicket | null>(null);
  const [printTicket, setPrintTicket] = useState<StaffWorkTicket | null>(null), [coordTicket, setCoordTicket] = useState<StaffWorkTicket | null>(null);

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
      const queryUnit = op.role === 'admin' ? 'ALL' : op.unitCode;
      const [res, coordRes] = await Promise.all([
        fetch(`/api/tickets?email=${encodeURIComponent(op.email)}&unitCode=${encodeURIComponent(queryUnit)}`, { headers, cache: 'no-store' }),
        fetch('/api/tickets/coordinated?scope=unit', { headers, cache: 'no-store' })
      ]);
      if (res.ok) {
        const json = await res.json();
        setUnitNameVi(op.role === 'admin' ? op.unitNameVi : (json.unitNameVi || op.unitNameVi));
        const loadedMy: StaffWorkTicket[] = json.myTickets || [], loadedUnit: StaffWorkTicket[] = json.unitTickets || [];
        setMyTickets(loadedMy); setA1Missions(json.a1Missions || []); setC1Vtvls(json.c1Vtvls || []);
        const editId = isInitial && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('editId') : null;
        const foundEdit = editId ? (loadedMy.find((t) => t.id === editId) || loadedUnit.find((t) => t.id === editId)) : null;
        if (foundEdit) { setEditingTicket(foundEdit); setActiveTab('create'); }
      }
      if (coordRes.ok) {
        const cJson = await coordRes.json();
        setProposedItems(cJson.items || []);
        setRelationships(cJson.relationships || []);
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
    if (nextTab === 'my-tickets') {
      const cur = getCurrentOperatorSession();
      if (cur) loadData(cur, false);
    }
    syncContextQueryParams({ tab: nextTab === 'my-tickets' ? null : nextTab }, 'push');
  }, [loadData]);

  useEffect(() => {
    syncWithSession(getCurrentOperatorSession(), true);
    const applyUrlTab = () => {
      const p = new URLSearchParams(window.location.search);
      const tabParam = p.get('tab');
      const unitParam = p.get('unitCode') || p.get('unit');
      if (tabParam === 'pending' || tabParam === 'approved' || tabParam === 'unit' || tabParam === 'review') {
        const mappedTab = tabParam === 'unit' ? 'all' : tabParam === 'review' ? 'pending' : tabParam;
        const qs = new URLSearchParams({ tab: mappedTab });
        if (unitParam) qs.set('unitCode', unitParam);
        router.replace(`/phieu-don-vi?${qs.toString()}`);
        return;
      }
      if (tabParam === 'proposed' || tabParam === 'coordination') setActiveTab('coordination');
      else if (tabParam === 'create') setActiveTab('create');
      else if (tabParam === 'relationships') setActiveTab('relationships');
      else setActiveTab('my-tickets');
    };
    applyUrlTab();
    window.addEventListener('popstate', applyUrlTab);
    const onUp = () => {
      const op = getCurrentOperatorSession();
      if (!op) { router.replace('/login'); return; }
      const key = `${op.email.toLowerCase()}__${op.unitCode.toUpperCase()}`;
      if (lastLoadedKeyRef.current !== key) syncWithSession(op, false);
    };
    const onFocus = () => { const cur = getCurrentOperatorSession(); if (cur) loadData(cur, false); };
    window.addEventListener('vtvl-operator-changed', onUp);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('popstate', applyUrlTab);
      window.removeEventListener('vtvl-operator-changed', onUp);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncWithSession, loadData, router]);

  const myDraftTickets = useMemo(() => myTickets.filter((t) => toCanonicalStatus(t.status) === 'draft'), [myTickets]);
  const myChangesRequestedTickets = useMemo(() => myTickets.filter((t) => toCanonicalStatus(t.status) === 'changes_requested'), [myTickets]);

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
      setEditingTicket(t); selectTab('create');
      alert(`Vui lòng hoàn thiện các trường bắt buộc trước khi nộp:\n• ${missing.join('\n• ')}`);
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

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f8fbff] p-3 sm:p-6">
        <PageWorkspaceSkeleton statusText="Đang tải không gian phiếu công việc cá nhân..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fbff] text-[#004776] p-3 sm:p-6 print:p-0 print:m-0 print:bg-white print:min-h-0">
      <div className={`max-w-[1440px] mx-auto space-y-4 print:space-y-0 print:max-w-none print:w-full ${(printTicket || detailTicket) ? 'print:hidden' : ''}`}>
        <StaffPortalHeaderBanner
          unitCode={session.unitCode} unitNameVi={unitNameVi}
          onCreateNew={() => { setEditingTicket(null); selectTab('create'); }}
          onLogout={() => { void performFullLogout('/login'); }}
        />
        <StaffTicketsTabBar
          activeTab={activeTab} onSelectTab={selectTab}
          myCount={myTickets.length} draftCount={myDraftTickets.length}
          proposedCount={proposedItems.length} relationshipsCount={relationships.length}
        />

        {(activeTab === 'my-tickets' || activeTab === 'create') && (
          <div className="space-y-4 print:space-y-0">
            {myChangesRequestedTickets.length > 0 && (
              <ChangesRequestedAlertBanner
                count={myChangesRequestedTickets.length}
                firstTicket={myChangesRequestedTickets[0]}
                onEditNow={(t) => { setEditingTicket(t); selectTab('create'); }}
                onOpenMyTab={() => selectTab('my-tickets')}
              />
            )}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start print:block">
              <div className="xl:col-span-6 min-w-0 print:w-full">
                <StaffTicketInlineForm
                  unitCode={session.unitCode} ownerEmail={session.email}
                  ownerName={session.displayName || session.email.split('@')[0]} ownerTitle={session.title}
                  editingTicket={editingTicket?.unitCode === session.unitCode ? editingTicket : null}
                  pickedVtvl={pickedVtvl} a1Missions={a1Missions} c1Vtvls={c1Vtvls}
                  onActiveVtvlChange={setActiveVtvlCode} onCancelEdit={() => setEditingTicket(null)}
                  onSaved={(st?: StaffWorkTicket) => {
                    if (st) {
                      setMyTickets((p) => p.some((t) => t.id === st.id) ? p.map((t) => t.id === st.id ? st : t) : [st, ...p]);
                      setEditingTicket((prev) => (prev && prev.id === st.id ? st : prev));
                    }
                    loadData(session);
                  }}
                />
              </div>
              <div className="xl:col-span-6 min-w-0 print:hidden space-y-5">
                {(loading || myTickets.length > 0) && (
                  <StaffMyTicketsList
                    title={myDraftTickets.length > 0 ? 'Phiếu của tôi (Nháp & Chờ duyệt)' : 'Phiếu của tôi'}
                    tickets={myTickets} loading={loading}
                    onEditTicket={(t) => { setEditingTicket(t); selectTab('create'); }}
                    onPrintTicket={setPrintTicket} onViewTicket={setDetailTicket}
                    onCoordTicket={setCoordTicket} onDeleteTicket={handleDelete} onSubmitTicket={handleSubmitMyTicket}
                  />
                )}
                <UnitVtvlLookupCard
                  unitCode={session.unitCode} c1Vtvls={c1Vtvls}
                  onSelectVtvl={(code) => { setPickedVtvl({ code, seq: Date.now() }); setActiveVtvlCode(code); setEditingTicket((prev) => (prev ? { ...prev, maVtvl: code } : null)); }}
                />
                <ProposedCoordinatedSideCard items={proposedItems} myAssignments={myVtvlAssignments} unitCode={session.unitCode} selectedVtvl={activeVtvlCode} loading={loading} onOpenFullTab={() => selectTab('coordination')} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'coordination' && <div className="print:hidden"><ProposedCoordinatedTasksTab items={proposedItems} myAssignments={myVtvlAssignments} unitCode={session.unitCode} selectedVtvl={activeVtvlCode} loading={loading} /></div>}
        {activeTab === 'relationships' && <div className="print:hidden"><WorkRelationshipsTab relationships={relationships} unitCode={session.unitCode} userRole={session.role || 'staff'} selectedVtvl={activeVtvlCode} loading={loading} onRefresh={() => loadData(session)} /></div>}
      </div>

      <StaffTicketDetailModal
        ticket={detailTicket} unitNameVi={unitNameVi} currentUserRole={session.role} currentUserEmail={session.email} onClose={() => setDetailTicket(null)}
      />
      <StaffTicketPrintModal ticket={printTicket} unitNameVi={unitNameVi} onClose={() => setPrintTicket(null)} />
      <CoordinatedTaskModal ticket={coordTicket} onClose={() => setCoordTicket(null)} onSaved={() => loadData(session)} />
    </div>
  );
}
