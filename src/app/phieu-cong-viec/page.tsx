'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Edit3, Trash2, Eye, Printer, Link2, LogOut,
  FileSpreadsheet, Building2, CheckCircle2, Clock
} from 'lucide-react';
import {
  getCurrentOperatorSession,
  clearCurrentOperatorSession,
  OperatorSession
} from '@/services/telemetry/operator-session';
import { StaffWorkTicket } from '@/types/staff-ticket';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { StaffTicketFormModal } from '@/components/staff-portal/StaffTicketFormModal';
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

  const [isFormOpen, setIsFormOpen] = useState(false);
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

  useEffect(() => {
    const op = getCurrentOperatorSession();
    if (!op) {
      router.replace('/login');
      return;
    }
    setSession(op);
    setUnitNameVi(op.unitNameVi);
    loadData(op);
  }, [router, loadData]);

  const handleDelete = async (ticket: StaffWorkTicket) => {
    if (!session) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phiếu [${ticket.maCongViec}]?\nDòng tương ứng trên bảng đơn vị cũng sẽ được xóa.`)) {
      return;
    }
    const res = await fetch(
      `/api/tickets?id=${encodeURIComponent(ticket.id)}&email=${encodeURIComponent(session.email)}`,
      { method: 'DELETE' }
    );
    if (res.ok) loadData(session);
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
              Không gian Cán bộ – Giảng viên • Tạo Phiếu công việc cá nhân và đối chiếu danh sách công việc chung của đơn vị.
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
              onClick={() => { setEditingTicket(null); setIsFormOpen(true); }}
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

        {/* Bố cục 2 cột: Trái (Phiếu công việc của tôi) | Phải (Danh sách công việc của đơn vị) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          {/* Cột Trái: Phiếu công việc của tôi */}
          <div className="xl:col-span-7 bg-white rounded-2xl border border-[#cbd5e1] shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#004776]">Phiếu công việc của tôi ({myTickets.length})</h2>
                <p className="text-xs text-[#64748b]">Quản lý phiếu nháp, phiếu đã nộp, xuất PDF A4 và gán công việc phối hợp.</p>
              </div>
            </div>

            <div className="divide-y divide-[#f1f5f9]">
              {loading ? (
                <div className="p-8 text-center text-xs text-[#64748b]">Đang tải dữ liệu...</div>
              ) : myTickets.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <p className="text-sm text-[#64748b]">Bạn chưa tạo phiếu công việc nào.</p>
                  <button
                    type="button"
                    onClick={() => { setEditingTicket(null); setIsFormOpen(true); }}
                    className="h-9 px-4 rounded-xl bg-[#0072BC] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Bắt đầu tạo phiếu đầu tiên
                  </button>
                </div>
              ) : (
                myTickets.map((t) => {
                  const hours = Math.round((((t.soSpNam * t.phutThucTe) / 60) + t.gioBoSung) * 10) / 10;
                  const isSubmitted = t.status === 'Đã nộp';
                  return (
                    <div key={t.id} className="p-4 hover:bg-[#f8fbff] transition-colors space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[#0072BC] bg-[#eef5ff] px-2 py-0.5 rounded-md">
                              {t.maCongViec}
                            </span>
                            <span className="text-xs font-semibold text-[#475569] bg-[#f1f5f9] px-2 py-0.5 rounded-md">
                              VTVL: {t.maVtvl}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                isSubmitted
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {isSubmitted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {t.status}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-[#004776]">{t.tenCongViec}</div>
                          <div className="text-xs text-[#64748b]">
                            Sản lượng: <strong>{t.soSpNam}</strong> SP • Thời gian: <strong>{t.phutThucTe}</strong> phút/SP • Tổng: <strong>{hours}</strong> giờ/năm
                            {t.coordinatedTasks && t.coordinatedTasks.length > 0 && (
                              <span className="ml-2 text-[#0072BC]">• {t.coordinatedTasks.length} công việc phối hợp</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => { setEditingTicket(t); setIsFormOpen(true); }}
                          className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#0072BC]" /> Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintTicket(t)}
                          className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#0072BC]" /> Xem trước
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintTicket(t)}
                          className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-[#0072BC]" /> In PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setCoordTicket(t)}
                          className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5 text-[#0072BC]" /> Thêm công việc phối hợp
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          className="h-8 px-2.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-medium text-red-600 inline-flex items-center gap-1 cursor-pointer ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cột Phải: Danh sách công việc của đơn vị (Chỉ đọc) */}
          <UnitTasksReadOnlyPanel
            unitCode={session.unitCode}
            unitA2Tasks={unitA2Tasks}
            unitB1Volumes={unitB1Volumes}
          />
        </div>
      </div>

      <StaffTicketFormModal
        isOpen={isFormOpen}
        unitCode={session.unitCode}
        ownerEmail={session.email}
        ownerName={session.displayName || session.email.split('@')[0]}
        ownerTitle={session.title}
        editingTicket={editingTicket}
        a1Missions={a1Missions}
        c1Vtvls={c1Vtvls}
        onClose={() => setIsFormOpen(false)}
        onSaved={() => loadData(session)}
      />

      <StaffTicketPrintModal
        ticket={printTicket}
        unitNameVi={unitNameVi}
        onClose={() => setPrintTicket(null)}
      />

      <CoordinatedTaskModal
        ticket={coordTicket}
        onClose={() => setCoordTicket(null)}
        onSaved={() => loadData(session)}
      />
    </div>
  );
}
