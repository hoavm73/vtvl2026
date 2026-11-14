'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, FileSpreadsheet, Building2 } from 'lucide-react';
import {
  getCurrentOperatorSession,
  saveCurrentOperatorSession,
  clearCurrentOperatorSession,
  OperatorSession
} from '@/services/telemetry/operator-session';
import { StaffWorkTicket } from '@/types/staff-ticket';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { StaffTicketInlineForm } from '@/components/staff-portal/StaffTicketInlineForm';
import { StaffMyTicketsList } from '@/components/staff-portal/StaffMyTicketsList';
import { StaffTicketPrintModal } from '@/components/staff-portal/StaffTicketPrintModal';
import { CoordinatedTaskModal } from '@/components/staff-portal/CoordinatedTaskModal';
import { UnitTasksReadOnlyPanel } from '@/components/staff-portal/UnitTasksReadOnlyPanel';
import { findHcmuteUnit } from '@/configs/hcmute-units';

export default function StaffWorkTicketsPage() {
  const router = useRouter();
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [unitNameVi, setUnitNameVi] = useState('');
  const [myTickets, setMyTickets] = useState<StaffWorkTicket[]>([]);
  const [a1Missions, setA1Missions] = useState<GenericGridRow[]>([]);
  const [c1Vtvls, setC1Vtvls] = useState<GenericGridRow[]>([]);
  const [unitA2Tasks, setUnitA2Tasks] = useState<GenericGridRow[]>([]);
  const [unitB1Volumes, setUnitB1Volumes] = useState<GenericGridRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingTicket, setEditingTicket] = useState<StaffWorkTicket | null>(null);
  const [printTicket, setPrintTicket] = useState<StaffWorkTicket | null>(null);
  const [coordTicket, setCoordTicket] = useState<StaffWorkTicket | null>(null);
  const lastLoadedKeyRef = useRef<string>('');

  const loadData = useCallback(async (op: OperatorSession) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tickets?email=${encodeURIComponent(op.email)}&unitCode=${encodeURIComponent(op.unitCode)}`
      );
      if (res.ok) {
        const json = await res.json();
        setUnitNameVi(json.unitNameVi || op.unitNameVi);
        setMyTickets(json.myTickets || []);
        setA1Missions(json.a1Missions || []);
        setC1Vtvls(json.c1Vtvls || []);
        setUnitA2Tasks(json.unitA2Tasks || []);
        setUnitB1Volumes(json.unitB1Volumes || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const syncWithActiveSession = useCallback((op: OperatorSession | null) => {
    if (!op) {
      router.replace('/login');
      return;
    }
    setSession((prev) => {
      if (prev && prev.unitCode !== op.unitCode) {
        setEditingTicket(null);
      }
      return op;
    });
    setUnitNameVi(op.unitNameVi);

    const sessionKey = `${op.email.toLowerCase()}__${op.unitCode.toUpperCase()}`;
    if (lastLoadedKeyRef.current !== sessionKey) {
      lastLoadedKeyRef.current = sessionKey;
      loadData(op);
    }
  }, [router, loadData]);

  useEffect(() => {
    const op = getCurrentOperatorSession();
    syncWithActiveSession(op);

    const handleSessionChange = () => {
      syncWithActiveSession(getCurrentOperatorSession());
    };

    const handleGridSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ oldCode: string; newCode: string; newNameVi?: string }>;
      const cur = getCurrentOperatorSession();
      if (cur && customEvent.detail?.oldCode && cur.unitCode.toUpperCase() === customEvent.detail.oldCode.toUpperCase()) {
        const nextCode = customEvent.detail.newCode.toUpperCase();
        lastLoadedKeyRef.current = '';
        const updated = saveCurrentOperatorSession(cur.email, nextCode, cur.title, {
          displayName: cur.displayName,
          avatarUrl: cur.avatarUrl,
          authProvider: cur.authProvider,
          accessToken: cur.accessToken,
          role: cur.role,
          hasSelectedUnit: true
        });
        syncWithActiveSession(updated);
      } else {
        lastLoadedKeyRef.current = '';
        syncWithActiveSession(getCurrentOperatorSession());
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'hcmute_vtvl_current_operator_v1' || e.key === 'vtvl_operator_session') {
        lastLoadedKeyRef.current = '';
        syncWithActiveSession(getCurrentOperatorSession());
      }
    };

    window.addEventListener('vtvl-operator-changed', handleSessionChange);
    window.addEventListener('vtvl-grid-sync', handleGridSync);
    window.addEventListener('storage', handleStorageChange);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('hcmute_vtvl_realtime');
        channel.onmessage = (event) => {
          if (event.data?.type === 'OPERATOR_CHANGED') {
            syncWithActiveSession(getCurrentOperatorSession());
          }
        };
      } catch { /* ignore */ }
    }

    return () => {
      window.removeEventListener('vtvl-operator-changed', handleSessionChange);
      window.removeEventListener('vtvl-grid-sync', handleGridSync);
      window.removeEventListener('storage', handleStorageChange);
      if (channel) channel.close();
    };
  }, [syncWithActiveSession]);

  const handleDelete = async (ticket: StaffWorkTicket) => {
    if (!session) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phiếu [${ticket.maCongViec}]?\nDòng tương ứng trên bảng đơn vị cũng sẽ được xóa.`)) {
      return;
    }
    const res = await fetch(
      `/api/tickets?id=${encodeURIComponent(ticket.id)}&email=${encodeURIComponent(session.email)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      if (editingTicket?.id === ticket.id) setEditingTicket(null);
      loadData(session);
    }
  };

  const handleEditClick = (ticket: StaffWorkTicket) => {
    if (ticket.unitCode !== session?.unitCode) return;
    setEditingTicket(ticket);
    const el = document.getElementById('staff-ticket-form-card');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCreateNewClick = () => {
    setEditingTicket(null);
    const el = document.getElementById('staff-ticket-form-card');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogout = () => {
    clearCurrentOperatorSession();
    router.push('/login');
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#f8fbff] text-[#004776] p-3 sm:p-6">
      <div className="max-w-[1440px] mx-auto space-y-4 sm:space-y-5">
        {/* Banner chào mừng */}
        <div className="bg-white rounded-2xl border border-[#dbeafe] shadow-xs p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0072BC] bg-[#eef5ff] px-3 py-1 rounded-full">
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>{unitNameVi || findHcmuteUnit(session.unitCode).nameVi} ({findHcmuteUnit(session.unitCode).code})</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-[#004776] leading-tight">
              Chào mừng {session.displayName || session.email} đến với Hệ thống Vị trí việc làm HCM-UTE
            </h1>
            <p className="text-xs sm:text-[13px] text-[#475569] leading-relaxed">
              {session.role === 'unit_leader'
                ? 'Không gian Lãnh đạo đơn vị • Rà soát, duyệt phiếu công việc và quản trị toàn bộ dữ liệu đơn vị.'
                : 'Không gian Cán bộ – Giảng viên • Kê khai trực tiếp phiếu công việc cá nhân và đối chiếu danh sách công việc chung của đơn vị.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 pt-2 xl:pt-0 border-t xl:border-t-0 border-[#f1f5f9]">
            <Link
              href="/bang-tinh"
              className="h-10 px-3.5 sm:px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs sm:text-[13px] font-semibold text-[#004776] flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#0072BC]" />
              <span>{session.role === 'unit_leader' ? 'Vào bảng tính đơn vị' : 'Xem bảng biểu đơn vị'}</span>
            </Link>
            <button
              type="button"
              onClick={handleCreateNewClick}
              className="h-10 px-3.5 sm:px-4 rounded-xl bg-[#0072BC] hover:bg-[#004776] text-white text-xs sm:text-[13px] font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo phiếu mới</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="h-10 px-3 rounded-xl border border-[#e2e8f0] hover:bg-red-50 text-xs sm:text-[13px] font-medium text-[#64748b] hover:text-red-600 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>

        {/* Bố cục 2 cột: Trái (Phiếu công việc nằm sẵn to ra + Danh sách phiếu của tôi) | Phải (Danh sách công việc đơn vị) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Cột Trái */}
          <div className="xl:col-span-7 space-y-5">
            {/* Form Phiếu công việc nằm sẵn to ra */}
            <StaffTicketInlineForm
              unitCode={session.unitCode}
              ownerEmail={session.email}
              ownerName={session.displayName || session.email.split('@')[0]}
              ownerTitle={session.title}
              editingTicket={editingTicket?.unitCode === session.unitCode ? editingTicket : null}
              a1Missions={a1Missions}
              c1Vtvls={c1Vtvls}
              onCancelEdit={() => setEditingTicket(null)}
              onSaved={() => loadData(session)}
            />

            {/* Danh sách phiếu đã tạo của tôi */}
            <StaffMyTicketsList
              tickets={myTickets}
              loading={loading}
              onEditTicket={handleEditClick}
              onPrintTicket={setPrintTicket}
              onCoordTicket={setCoordTicket}
              onDeleteTicket={handleDelete}
            />
          </div>

          {/* Cột Phải: Danh sách công việc của đơn vị (Chỉ đọc) */}
          <UnitTasksReadOnlyPanel
            unitCode={session.unitCode}
            unitA2Tasks={unitA2Tasks}
            unitB1Volumes={unitB1Volumes}
          />
        </div>
      </div>

      {/* Modal In / Xuất PDF khổ A4 */}
      <StaffTicketPrintModal
        ticket={printTicket}
        unitNameVi={unitNameVi}
        onClose={() => setPrintTicket(null)}
      />

      {/* Modal gán công việc phối hợp liên đơn vị */}
      <CoordinatedTaskModal
        ticket={coordTicket}
        onClose={() => setCoordTicket(null)}
        onSaved={() => loadData(session)}
      />
    </div>
  );
}
