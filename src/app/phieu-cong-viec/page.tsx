'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, FileSpreadsheet, Building2, User, Clock, Users } from 'lucide-react';
import { getCurrentOperatorSession, clearCurrentOperatorSession, OperatorSession } from '@/services/telemetry/operator-session';
import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { StaffTicketInlineForm } from '@/components/staff-portal/StaffTicketInlineForm';
import { StaffMyTicketsList } from '@/components/staff-portal/StaffMyTicketsList';
import { UnitTicketsReviewList } from '@/components/staff-portal/UnitTicketsReviewList';
import { UnitVtvlLookupCard } from '@/components/staff-portal/UnitVtvlLookupCard';
import { StaffTicketPrintModal } from '@/components/staff-portal/StaffTicketPrintModal';
import { StaffTicketDetailModal } from '@/components/staff-portal/StaffTicketDetailModal';
import { StaffTicketRevisionModal } from '@/components/staff-portal/StaffTicketRevisionModal';
import { StaffTicketMergePreviewModal } from '@/components/staff-portal/StaffTicketMergePreviewModal';
import { CoordinatedTaskModal } from '@/components/staff-portal/CoordinatedTaskModal';
import { findHcmuteUnit } from '@/configs/hcmute-units';
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

  // Điều khiển Tab: 'my' (Phiếu của tôi), 'pending' (Chờ duyệt), 'unit' (Toàn bộ phiếu đơn vị)
  const [activeTab, setActiveTab] = useState<'my' | 'pending' | 'unit'>('my');

  // Modals
  const [editingTicket, setEditingTicket] = useState<StaffWorkTicket | null>(null), [detailTicket, setDetailTicket] = useState<StaffWorkTicket | null>(null);
  const [printTicket, setPrintTicket] = useState<StaffWorkTicket | null>(null), [revisionTicket, setRevisionTicket] = useState<StaffWorkTicket | null>(null);
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
      const res = await fetch(`/api/tickets?email=${encodeURIComponent(op.email)}&unitCode=${encodeURIComponent(op.unitCode)}`, { headers });
      if (res.ok) {
        const json = await res.json();
        setUnitNameVi(json.unitNameVi || op.unitNameVi);
        setMyTickets(json.myTickets || []);
        setUnitTickets(json.unitTickets || []);
        setA1Missions(json.a1Missions || []);
        setC1Vtvls(json.c1Vtvls || []);
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

  useEffect(() => {
    syncWithSession(getCurrentOperatorSession(), true);
    const onUp = () => {
      const op = getCurrentOperatorSession();
      if (!op) { router.replace('/login'); return; }
      const key = `${op.email.toLowerCase()}__${op.unitCode.toUpperCase()}`;
      if (lastLoadedKeyRef.current !== key) {
        syncWithSession(op, false);
      }
    };
    window.addEventListener('vtvl-operator-changed', onUp);
    return () => {
      window.removeEventListener('vtvl-operator-changed', onUp);
    };
  }, [syncWithSession, router]);

  const isLeader = session?.role === 'unit_leader' || session?.role === 'admin';
  const pendingCount = useMemo(() => unitTickets.filter((t) => {
    const c = toCanonicalStatus(t.status);
    return c === 'submitted' || c === 'resubmitted';
  }).length, [unitTickets]);

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
    if (!window.confirm(`Xác nhận phê duyệt phiếu [${t.maCongViec} - ${t.tenCongViec}]?`)) return;
    await sendPatchAction({ ticketId: t.id, action: 'approve' });
  };
  const handleRevisionSubmit = async (t: StaffWorkTicket, reason: string) => {
    await sendPatchAction({ ticketId: t.id, action: 'changes_requested', reason });
  };
  const handleMergeSubmit = async (t: StaffWorkTicket) => {
    await sendPatchAction({ ticketId: t.id, action: 'merge' });
  };
  const handleSubmitMyTicket = async (t: StaffWorkTicket, isResubmit: boolean) => {
    const msg = isResubmit ? `Nộp lại phiếu [${t.maCongViec}] sau khi hoàn thiện?` : `Nộp phiếu [${t.maCongViec}] cho Lãnh đạo đơn vị duyệt?`;
    if (window.confirm(msg)) await sendPatchAction({ ticketId: t.id, action: isResubmit ? 'resubmit' : 'submit' });
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
        {/* Banner */}
        <div className="bg-white rounded-2xl border border-[#dbeafe] shadow-xs p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:hidden">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0072BC] bg-[#eef5ff] px-3 py-1 rounded-full">
              <Building2 className="w-3.5 h-3.5" />
              <span>{unitNameVi || findHcmuteUnit(session.unitCode).nameVi} ({findHcmuteUnit(session.unitCode).code})</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-[#004776]">
              Phiếu khảo sát khối lượng công việc cá nhân HCM-UTE
            </h1>
            {isLeader && (
              <p className="text-xs text-[#475569]">
                Không gian Lãnh đạo đơn vị • Kê khai cá nhân, rà soát duyệt phiếu và tổng hợp vào B1/B2.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/bang-tinh" className="h-10 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] flex items-center gap-1.5 shadow-2xs">
              <FileSpreadsheet className="w-4 h-4 text-[#0072BC]" /> <span>Vào bảng tính đơn vị</span>
            </Link>
            <button type="button" onClick={() => { setActiveTab('my'); setEditingTicket(null); }} className="h-10 px-4 rounded-xl bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"><Plus className="w-4 h-4" /> <span>Tạo phiếu mới</span></button>
            <button type="button" onClick={() => { clearCurrentOperatorSession(); router.push('/login'); }} className="h-10 px-3 rounded-xl border border-[#e2e8f0] text-xs font-medium text-[#64748b] hover:text-red-600 cursor-pointer" title="Đăng xuất"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Thanh chuyển đổi Tab */}
        <div className="flex items-center gap-2 border-b border-[#cbd5e1] bg-white px-4 pt-2 rounded-t-2xl print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'my' ? 'border-[#0072BC] text-[#0072BC]' : 'border-transparent text-[#64748b] hover:text-[#004776]'
            }`}
          >
            <User className="w-4 h-4" /> <span>Phiếu của tôi ({myTickets.length})</span>
          </button>

          {isLeader && (
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
                activeTab === 'pending' ? 'border-[#0072BC] text-[#0072BC]' : 'border-transparent text-[#64748b] hover:text-[#004776]'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Chờ duyệt</span>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('unit')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'unit' ? 'border-[#0072BC] text-[#0072BC]' : 'border-transparent text-[#64748b] hover:text-[#004776]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isLeader ? 'Toàn bộ phiếu đơn vị' : 'Phiếu toàn đơn vị (Chỉ đọc)'} ({unitTickets.length})</span>
          </button>
        </div>

        {/* Nội dung Tab */}
        {activeTab === 'my' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start print:block">
            <div className="xl:col-span-6 print:w-full">
              <StaffTicketInlineForm
                unitCode={session.unitCode} ownerEmail={session.email}
                ownerName={session.displayName || session.email.split('@')[0]} ownerTitle={session.title}
                editingTicket={editingTicket?.unitCode === session.unitCode ? editingTicket : null}
                a1Missions={a1Missions} c1Vtvls={c1Vtvls}
                onCancelEdit={() => setEditingTicket(null)}
                onSaved={(savedTicket?: StaffWorkTicket) => {
                  if (savedTicket) {
                    setMyTickets((prev) => {
                      const idx = prev.findIndex((t) => t.id === savedTicket.id);
                      if (idx >= 0) {
                        const next = [...prev];
                        next[idx] = savedTicket;
                        return next;
                      }
                      return [savedTicket, ...prev];
                    });
                  }
                  loadData(session);
                }}
              />
            </div>
            <div className="xl:col-span-6 print:hidden space-y-5">
              <StaffMyTicketsList
                tickets={myTickets} loading={loading}
                onEditTicket={(t) => { setEditingTicket(t); setActiveTab('my'); }}
                onPrintTicket={setPrintTicket} onViewTicket={setDetailTicket}
                onCoordTicket={setCoordTicket} onDeleteTicket={handleDelete}
                onSubmitTicket={handleSubmitMyTicket}
              />
              <UnitVtvlLookupCard
                unitCode={session.unitCode}
                c1Vtvls={c1Vtvls}
                onSelectVtvl={(selectedCode) => {
                  setEditingTicket((prev) => (prev ? { ...prev, maVtvl: selectedCode } : null));
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'pending' && isLeader && (
          <div className="print:hidden">
            <UnitTicketsReviewList
              tickets={unitTickets} loading={loading} mode="pending"
              currentUserRole={session.role} currentUserEmail={session.email}
              onViewTicket={setDetailTicket} onPrintTicket={setPrintTicket}
              onApproveTicket={handleApprove} onRequestChanges={setRevisionTicket} onMergeTicket={setMergeTicket}
            />
          </div>
        )}

        {activeTab === 'unit' && (
          <div className="print:hidden">
            <UnitTicketsReviewList
              tickets={unitTickets} loading={loading} mode="all"
              currentUserRole={session.role} currentUserEmail={session.email}
              onViewTicket={setDetailTicket} onPrintTicket={setPrintTicket}
              onApproveTicket={isLeader ? handleApprove : undefined}
              onRequestChanges={isLeader ? setRevisionTicket : undefined}
              onMergeTicket={isLeader ? setMergeTicket : undefined}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <StaffTicketDetailModal
        ticket={detailTicket} unitNameVi={unitNameVi}
        currentUserRole={session.role} currentUserEmail={session.email}
        onClose={() => setDetailTicket(null)} onPrint={setPrintTicket}
        onApprove={isLeader ? async (t) => { setDetailTicket(null); await handleApprove(t); } : undefined}
        onRequestChanges={isLeader ? (t) => { setDetailTicket(null); setRevisionTicket(t); } : undefined}
      />
      <StaffTicketPrintModal ticket={printTicket} unitNameVi={unitNameVi} onClose={() => setPrintTicket(null)} />
      <StaffTicketRevisionModal ticket={revisionTicket} onClose={() => setRevisionTicket(null)} onSubmit={handleRevisionSubmit} />
      <StaffTicketMergePreviewModal ticket={mergeTicket} onClose={() => setMergeTicket(null)} onConfirmMerge={handleMergeSubmit} />
      <CoordinatedTaskModal ticket={coordTicket} onClose={() => setCoordTicket(null)} onSaved={() => loadData(session)} />
    </div>
  );
}
