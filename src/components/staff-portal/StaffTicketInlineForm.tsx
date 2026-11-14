'use client';

import React, { useState, useEffect } from 'react';
import { Save, Send, RotateCcw } from 'lucide-react';
import { StaffWorkTicket, TicketStatus } from '@/types/staff-ticket';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { StaffTicketCoreFields } from './StaffTicketCoreFields';
import { StaffTicketVolumeFields } from './StaffTicketVolumeFields';

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
    if (t && t.unitCode === unitCode) {
      setMaNhiemVu(t.maNhiemVu || '');
      setMaCongViec(t.maCongViec || '');
      setTenCongViec(t.tenCongViec || '');
      setMaVtvl(t.maVtvl || '');
      setMaVtvlPhoiHop(t.maVtvlPhoiHop || '');
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
    <div id="staff-ticket-form-card" className="bg-white rounded-2xl border border-[#cbd5e1] shadow-xs overflow-hidden">
      <div className="px-5 py-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-[#004776]">
              {editingTicket ? `Chỉnh sửa Phiếu công việc [${editingTicket.maCongViec}]` : 'Kê khai Phiếu công việc cá nhân'}
            </h2>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              editingTicket ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-[#0072BC] border border-blue-200'
            }`}>
              {editingTicket ? 'Chế độ chỉnh sửa' : 'Tạo mới'}
            </span>
          </div>
          <p className="text-xs text-[#64748b] mt-0.5">
            Điền trực tiếp các mục bên dưới. Dữ liệu sẽ tự động liên thông vào Biểu A2 và Biểu B1 của [{unitCode}].
          </p>
        </div>

        {editingTicket && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="h-8 px-3 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-xs font-medium text-[#004776] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Chuyển sang tạo mới
          </button>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-4 text-sm text-[#004776]">
        {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">{err}</div>}
        {successMsg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium">{successMsg}</div>}

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
      </div>

      <div className="px-5 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave('Nháp')}
          className="h-10 px-4 rounded-xl border border-[#0072BC] bg-white text-sm font-semibold text-[#0072BC] hover:bg-[#eef5ff] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          Lưu nháp (giữ mã ở đơn vị)
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSave('Đã nộp')}
          className="h-10 px-5 rounded-xl bg-[#0072BC] hover:bg-[#004776] text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
        >
          <Send className="w-4 h-4" />
          {saving ? 'Đang lưu...' : 'Lưu và gửi (Đã nộp)'}
        </button>
      </div>
    </div>
  );
}
