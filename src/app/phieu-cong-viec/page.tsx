'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, FileSpreadsheet, Building2 } from 'lucide-react';
import {
  getCurrentOperatorSession,
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

  const loadData = useCallback(async (op: OperatorSession) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tickets?email=${encodeURIComponent(op.email)}&unitCode=${encodeURIComponent(op.unitCode)}`
      );
      if (res.ok) {
        const json = await res.json();
        setMyTickets(json.myTickets || []);
        setUnitNameVi(json.unitNameVi || op.unitNameVi);
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
    loadData(op);
  }, [router, loadData]);

  useEffect(() => {
    const op = getCurrentOperatorSession();
    syncWithActiveSession(op);

    const handleSessionChange = () => {
      syncWithActiveSession(getCurrentOperatorSession());
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'hcmute_vtvl_current_operator_v1' || e.key === 'vtvl_operator_session') {
        syncWithActiveSession(getCurrentOperatorSession());
      }
    };

    window.addEventListener('vtvl-operator-changed', handleSessionChange);
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
    <div className="min-h-screen bg-[#f8fbff] text-[#004776] p-4 sm:p-6">
      <div className="max-w-[1440px] mx-auto space-y-5">
        {/* Banner chào mừng */}
        <div className="bg-white rounded-2xl border border-[#dbeafe] shadow-xs p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0072BC] bg-[#eef5ff] px-3 py-1 rounded-full">
              <Building2 className="w-3.5 h-3.5" />
              {unitNameVi} ({session.unitCode})
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#004776]">
              Chào mừng {session.displayName || session.email} đến với Hệ thống Vị trí việc làm HCM-UTE
            </h1>
            <p className="text-xs sm:text-sm text-[#475569]">
              Không gian Cán bộ – Giảng viên • Kê khai trực tiếp phiếu công việc cá nhân và đối chiếu danh sách công việc chung của đơn vị.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/bang-tinh"
              className="h-10 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#0072BC]" />
              Xem bảng biểu đơn vị (Chỉ đọc)
            </Link>
            <button
              type="button"
              onClick={handleCreateNewClick}
              className="h-10 px-4 rounded-xl bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Tạo phiếu công việc mới
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="h-10 px-3.5 rounded-xl border border-[#e2e8f0] hover:bg-red-50 text-xs font-medium text-[#64748b] hover:text-red-600 flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
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
