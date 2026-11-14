'use client';

import React, { useState, useEffect } from 'react';
import { LayoutList, Printer } from 'lucide-react';
import { StaffWorkTicket, TicketStatus } from '@/types/staff-ticket';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { replaceUnitCodePrefix } from '@/services/units/unit-synchronizer';
import { StaffTicketModernForm } from './StaffTicketModernForm';
import { StaffTicketA4Preview } from './StaffTicketA4Preview';
import { StaffTicketToolbar } from './StaffTicketToolbar';

interface StaffTicketInlineFormProps {
  unitCode: string;
  ownerEmail: string;
  ownerName: string;
  ownerTitle: string;
  editingTicket: StaffWorkTicket | null;
  a1Missions: GenericGridRow[];
  c1Vtvls: GenericGridRow[];
  onCancelEdit: () => void;
  onSaved: () => void;
}

export function StaffTicketInlineForm({
  unitCode,
  ownerEmail,
  ownerName,
  ownerTitle,
  editingTicket,
  a1Missions,
  c1Vtvls,
  onCancelEdit,
  onSaved
}: StaffTicketInlineFormProps) {
  const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');
  const [maNhiemVu, setMaNhiemVu] = useState('');
  const [maCongViec, setMaCongViec] = useState('');
  const [tenCongViec, setTenCongViec] = useState('');
  const [maVtvl, setMaVtvl] = useState('');
  const [maVtvlPhoiHop, setMaVtvlPhoiHop] = useState('');
  const [sanPham, setSanPham] = useState('');
  const [chatLuong, setChatLuong] = useState('');
  const [canCu, setCanCu] = useState('');
  const [soSpNam, setSoSpNam] = useState<string>('0');
  const [nguonSoLieu, setNguonSoLieu] = useState('');
  const [phutThucTe, setPhutThucTe] = useState<string>('0');
  const [gioBoSung, setGioBoSung] = useState<string>('0');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const unit = findHcmuteUnit(unitCode);

  const resetForm = () => {
    setMaNhiemVu('');
    setMaCongViec('');
    setTenCongViec('');
    setMaVtvl('');
    setMaVtvlPhoiHop('');
    setSanPham('');
    setChatLuong('');
    setCanCu('');
    setSoSpNam('0');
    setNguonSoLieu('');
    setPhutThucTe('0');
    setGioBoSung('0');
  };

  useEffect(() => {
    setErr('');
    setSuccessMsg('');
    const t = editingTicket;
    if (t) {
      const cleanUnit = unitCode.toUpperCase();
      const updatedMission = replaceUnitCodePrefix(t.maNhiemVu, t.unitCode, cleanUnit);
      const updatedTask = replaceUnitCodePrefix(t.maCongViec, t.unitCode, cleanUnit);
      const updatedVtvl = replaceUnitCodePrefix(t.maVtvl, t.unitCode, cleanUnit);
      const updatedVtvlPhoiHop = t.maVtvlPhoiHop ? replaceUnitCodePrefix(t.maVtvlPhoiHop, t.unitCode, cleanUnit) : '';

      setMaNhiemVu(updatedMission || '');
      setMaCongViec(updatedTask || '');
      setTenCongViec(t.tenCongViec || '');
      setMaVtvl(updatedVtvl || '');
      setMaVtvlPhoiHop(updatedVtvlPhoiHop || '');
      setSanPham(t.sanPham || '');
      setChatLuong(t.chatLuong || '');
      setCanCu(t.canCu || '');
      setSoSpNam(String(t.soSpNam ?? 0));
      setNguonSoLieu(t.nguonSoLieu || '');
      setPhutThucTe(String(t.phutThucTe ?? 0));
      setGioBoSung(String(t.gioBoSung ?? 0));
    } else {
      resetForm();
    }
  }, [editingTicket, unitCode]);

  const handleMissionChange = async (nextMission: string) => {
    setMaNhiemVu(nextMission);
    if (!nextMission) {
      setMaCongViec('');
      return;
    }
    if (editingTicket && editingTicket.maNhiemVu === nextMission) {
      setMaCongViec(editingTicket.maCongViec);
      return;
    }
    try {
      const res = await fetch('/api/tickets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitCode, maNhiemVu: nextMission, excludeTicketId: editingTicket?.id })
      });
      if (res.ok) {
        const json = await res.json();
        setMaCongViec(json.nextTaskCode || '');
      }
    } catch { /* ignore */ }
  };

  const handleSave = async (status: TicketStatus) => {
    setErr('');
    setSuccessMsg('');
    if (!maNhiemVu || !tenCongViec.trim() || !maVtvl) {
      setErr('Vui lòng chọn Mã nhiệm vụ, Mã vị trí việc làm chính và nhập Tên công việc cụ thể.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTicket?.id,
          unitCode,
          ownerEmail,
          ownerName,
          ownerTitle,
          status,
          maNhiemVu,
          maCongViec,
          tenCongViec: tenCongViec.trim(),
          maVtvl,
          maVtvlPhoiHop,
          sanPham: sanPham.trim(),
          chatLuong: chatLuong.trim(),
          canCu: canCu.trim(),
          soSpNam: Number(soSpNam) || 0,
          nguonSoLieu: nguonSoLieu.trim(),
          phutThucTe: Number(phutThucTe) || 0,
          gioBoSung: Number(gioBoSung) || 0,
          coordinatedTasks: editingTicket?.coordinatedTasks || []
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Không thể lưu phiếu công việc.');
        return;
      }
      setSuccessMsg(status === 'Đã nộp' ? 'Đã lưu và gửi thành công lên dữ liệu đơn vị!' : 'Đã lưu nháp và giữ mã công việc ở đơn vị!');
      onSaved();
      if (!editingTicket) resetForm();
    } catch {
      setErr('Lỗi kết nối máy chủ khi lưu phiếu.');
    } finally {
      setSaving(false);
    }
  };

  const missionOptions = a1Missions.map((m) => ({
    value: String(m.maNhiemVu || ''),
    label: `${m.maNhiemVu} — ${String(m.tenNhiemVu || '').slice(0, 60)}`
  }));

  const vtvlOptions = c1Vtvls.map((v) => ({
    value: String(v.maVtvl || ''),
    label: `${v.maVtvl} — ${String(v.tenVtvl || '')}`
  }));

  const formProps = {
    maNhiemVu, maCongViec, tenCongViec, maVtvl, maVtvlPhoiHop,
    sanPham, chatLuong, canCu, soSpNam, nguonSoLieu, phutThucTe, gioBoSung,
    missionOptions, vtvlOptions,
    onChangeMission: handleMissionChange,
    onChangeTenCongViec: setTenCongViec,
    onChangeVtvl: setMaVtvl,
    onChangeVtvlPhoiHop: setMaVtvlPhoiHop,
    onChangeSanPham: setSanPham,
    onChangeChatLuong: setChatLuong,
    onChangeCanCu: setCanCu,
    onChangeSoSp: setSoSpNam,
    onChangeNguon: setNguonSoLieu,
    onChangePhut: setPhutThucTe,
    onChangeGioBoSung: setGioBoSung
  };

  return (
    <div id="staff-ticket-form-card" className="space-y-3">
      {/* Thanh công cụ và chuyển đổi chế độ xem */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#cbd5e1] shadow-2xs">
        <div className="inline-flex p-1 bg-[#f1f5f9] rounded-xl border border-[#e2e8f0]">
          <button
            type="button"
            onClick={() => setViewMode('form')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'form' ? 'bg-white text-[#004776] shadow-xs' : 'text-[#64748b] hover:text-[#004776]'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span>Kê khai nhập liệu</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'preview' ? 'bg-white text-[#004776] shadow-xs' : 'text-[#64748b] hover:text-[#004776]'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Xem trước bản in A4</span>
          </button>
        </div>

        <StaffTicketToolbar
          isEditing={Boolean(editingTicket)}
          editingTaskCode={editingTicket?.maCongViec}
          saving={saving}
          onCancelEdit={onCancelEdit}
          onPrint={() => window.print()}
          onSave={handleSave}
        />
      </div>

      {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium print:hidden">{err}</div>}
      {successMsg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium print:hidden">{successMsg}</div>}

      {viewMode === 'form' ? (
        <StaffTicketModernForm {...formProps} />
      ) : (
        <StaffTicketA4Preview
          {...formProps}
          unitNameVi={unit.nameVi}
          unitCode={unit.code}
          ownerName={ownerName}
          ownerEmail={ownerEmail}
          ownerTitle={ownerTitle}
          editingTicket={editingTicket}
        />
      )}
    </div>
  );
}
