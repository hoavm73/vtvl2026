'use client';

import React, { useState, useEffect } from 'react';
import { StaffWorkTicket, TicketStatus } from '@/types/staff-ticket';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { replaceUnitCodePrefix } from '@/services/units/unit-synchronizer';
import { StaffTicketCoreFields } from './StaffTicketCoreFields';
import { StaffTicketVolumeFields } from './StaffTicketVolumeFields';
import { StaffTicketToolbar } from './StaffTicketToolbar';
import { StaffTicketSignatureBlock } from './StaffTicketSignatureBlock';

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

  return (
    <div id="staff-ticket-form-card" className="space-y-3">
      <StaffTicketToolbar
        isEditing={Boolean(editingTicket)}
        editingTaskCode={editingTicket?.maCongViec}
        saving={saving}
        onCancelEdit={onCancelEdit}
        onPrint={() => window.print()}
        onSave={handleSave}
      />

      {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium print:hidden">{err}</div>}
      {successMsg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium print:hidden">{successMsg}</div>}

      <div
        className="bg-white rounded-2xl border-2 border-[#cbd5e1] shadow-2xl p-4 sm:p-8 md:p-10 text-[#004776] print:border-none print:shadow-none print:p-0"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-3 sm:gap-2 text-center mb-5">
          <div className="sm:col-span-5 print:col-span-5">
            <div className="text-[11px] uppercase font-normal">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
            <div className="text-[11px] font-bold uppercase">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM</div>
            <div className="text-[11px] font-bold uppercase mt-0.5">{unit.nameVi}</div>
            <div className="w-24 h-[1px] bg-[#004776] mx-auto mt-1" />
          </div>
          <div className="sm:col-span-7 print:col-span-7">
            <div className="text-[11px] font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="text-[12px] font-bold">Độc lập – Tự do – Hạnh phúc</div>
            <div className="w-32 h-[1px] bg-[#004776] mx-auto mt-1" />
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-[16px] sm:text-[18px] font-bold uppercase tracking-tight text-[#004776]">
            PHIẾU KHẢO SÁT KHỐI LƯỢNG CÔNG VIỆC CÁ NHÂN
          </h2>
          <div className="text-[12px] italic text-[#475569] mt-0.5">
            (Kỳ thống kê: Từ ngày 01/10/2025 đến ngày 30/9/2026 • Theo Hướng dẫn số 07-HD/BTCTW)
          </div>
        </div>

        <div className="space-y-1.5 mb-5 text-[13px] border-b border-[#e2e8f0] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><strong>Họ và tên người lập phiếu:</strong> {ownerName} ({ownerEmail})</div>
            <div><strong>Trạng thái phiếu:</strong> <span className="font-bold text-[#0072BC]">{editingTicket?.status || 'Đang tạo mới'}</span></div>
          </div>
          <div><strong>Chức danh / Chức vụ:</strong> {ownerTitle || 'Chuyên viên'} &nbsp;|&nbsp; <strong>Đơn vị:</strong> {unit.nameVi} ({unit.code})</div>
        </div>

        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <table className="w-full min-w-[500px] sm:min-w-0 border-collapse border border-[#004776] text-[12.5px] mb-5">
            <tbody>
              <StaffTicketCoreFields
                maNhiemVu={maNhiemVu}
                maCongViec={maCongViec}
                tenCongViec={tenCongViec}
                maVtvl={maVtvl}
                maVtvlPhoiHop={maVtvlPhoiHop}
                sanPham={sanPham}
                chatLuong={chatLuong}
                canCu={canCu}
                missionOptions={missionOptions}
                vtvlOptions={vtvlOptions}
                onChangeMission={handleMissionChange}
                onChangeTenCongViec={setTenCongViec}
                onChangeVtvl={setMaVtvl}
                onChangeVtvlPhoiHop={setMaVtvlPhoiHop}
                onChangeSanPham={setSanPham}
                onChangeChatLuong={setChatLuong}
                onChangeCanCu={setCanCu}
              />

              <StaffTicketVolumeFields
                soSpNam={soSpNam}
                phutThucTe={phutThucTe}
                gioBoSung={gioBoSung}
                nguonSoLieu={nguonSoLieu}
                onChangeSoSp={setSoSpNam}
                onChangePhut={setPhutThucTe}
                onChangeGioBoSung={setGioBoSung}
                onChangeNguon={setNguonSoLieu}
              />
            </tbody>
          </table>
        </div>

        <StaffTicketSignatureBlock ownerName={ownerName} />
      </div>
    </div>
  );
}
