'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Send, Sparkles } from 'lucide-react';
import { StaffWorkTicket, TicketStatus } from '@/types/staff-ticket';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { StaffTicketVolumeFields } from './StaffTicketVolumeFields';

interface StaffTicketFormModalProps {
  isOpen: boolean;
  unitCode: string;
  ownerEmail: string;
  ownerName: string;
  ownerTitle: string;
  editingTicket: StaffWorkTicket | null;
  a1Missions: GenericGridRow[];
  c1Vtvls: GenericGridRow[];
  onClose: () => void;
  onSaved: () => void;
}

export function StaffTicketFormModal({
  isOpen,
  unitCode,
  ownerEmail,
  ownerName,
  ownerTitle,
  editingTicket,
  a1Missions,
  c1Vtvls,
  onClose,
  onSaved
}: StaffTicketFormModalProps) {
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

  useEffect(() => {
    if (!isOpen) return;
    setErr('');
    const t = editingTicket;
    setMaNhiemVu(t?.maNhiemVu || '');
    setMaCongViec(t?.maCongViec || '');
    setTenCongViec(t?.tenCongViec || '');
    setMaVtvl(t?.maVtvl || '');
    setMaVtvlPhoiHop(t?.maVtvlPhoiHop || '');
    setSanPham(t?.sanPham || '');
    setChatLuong(t?.chatLuong || '');
    setCanCu(t?.canCu || '');
    setSoSpNam(String(t?.soSpNam ?? 0));
    setNguonSoLieu(t?.nguonSoLieu || '');
    setPhutThucTe(String(t?.phutThucTe ?? 0));
    setGioBoSung(String(t?.gioBoSung ?? 0));
  }, [isOpen, editingTicket]);

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
      onSaved();
      onClose();
    } catch {
      setErr('Lỗi kết nối máy chủ khi lưu phiếu.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const missionOptions = a1Missions.map((m) => ({
    value: String(m.maNhiemVu || ''),
    label: `${m.maNhiemVu} — ${String(m.tenNhiemVu || '').slice(0, 60)}`
  }));

  const vtvlOptions = c1Vtvls.map((v) => ({
    value: String(v.maVtvl || ''),
    label: `${v.maVtvl} — ${String(v.tenVtvl || '')}`
  }));

  return (
    <div className="fixed inset-0 z-50 bg-[#004776]/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#004776]">
              {editingTicket ? `Cập nhật Phiếu công việc [${editingTicket.maCongViec}]` : 'Tạo Phiếu công việc mới'}
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Dữ liệu sẽ tự động liên thông vào Biểu A2 và Biểu B1 của đơn vị [{unitCode}].
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#e2e8f0] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-sm text-[#004776]">
          {err && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">{err}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">1. Mã nhiệm vụ (từ Biểu A1) *</label>
              <ShadcnSelect
                value={maNhiemVu}
                options={missionOptions}
                placeholder="Chọn nhiệm vụ..."
                onChange={handleMissionChange}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">2. Mã công việc (tự động nhảy chống trùng)</label>
              <div className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] flex items-center justify-between text-sm font-mono font-semibold text-[#0072BC]">
                <span>{maCongViec || 'Chọn nhiệm vụ để tự sinh mã...'}</span>
                <Sparkles className="w-4 h-4 text-[#0072BC]" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">3. Tên công việc cụ thể (Biểu A2) *</label>
            <input
              type="text"
              value={tenCongViec}
              onChange={(e) => setTenCongViec(e.target.value)}
              placeholder="Nhập tên công việc cụ thể đang đảm nhận..."
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] text-sm text-[#004776] focus:border-[#0072BC] outline-hidden"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">3a. Mã vị trí việc làm chính (từ Biểu C1) *</label>
              <ShadcnSelect
                value={maVtvl}
                options={vtvlOptions}
                placeholder="Chọn VTVL chính..."
                onChange={setMaVtvl}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">3b. Mã vị trí việc làm phối hợp (nếu có)</label>
              <ShadcnSelect
                value={maVtvlPhoiHop}
                options={[{ value: '', label: 'Không có' }, ...vtvlOptions]}
                placeholder="Chọn VTVL phối hợp..."
                onChange={setMaVtvlPhoiHop}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">4. Sản phẩm đầu ra (Biểu A2)</label>
              <textarea
                rows={2}
                value={sanPham}
                onChange={(e) => setSanPham(e.target.value)}
                placeholder="Mô tả sản phẩm đầu ra cụ thể..."
                className="w-full p-2.5 rounded-lg border border-[#cbd5e1] text-sm text-[#004776] focus:border-[#0072BC] outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">5. Yêu cầu chất lượng (Biểu A2)</label>
              <textarea
                rows={2}
                value={chatLuong}
                onChange={(e) => setChatLuong(e.target.value)}
                placeholder="Tiêu chuẩn, chất lượng, tiến độ yêu cầu..."
                className="w-full p-2.5 rounded-lg border border-[#cbd5e1] text-sm text-[#004776] focus:border-[#0072BC] outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">6. Giải trình / Căn cứ nguồn tài liệu (Biểu A2)</label>
            <input
              type="text"
              value={canCu}
              onChange={(e) => setCanCu(e.target.value)}
              placeholder="Ví dụ: Quy chế đào tạo, QĐ 2266/QĐ-ĐHCNKT, phân công công tác..."
              className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] text-sm text-[#004776] focus:border-[#0072BC] outline-hidden"
            />
          </div>

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

        <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#e2e8f0] flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-[#cbd5e1] bg-white text-sm font-medium text-[#004776] hover:bg-[#f1f5f9] cursor-pointer"
          >
            Hủy bỏ
          </button>
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
            className="h-10 px-5 rounded-xl bg-[#0072BC] hover:bg-[#004776] text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu và gửi (Đã nộp)'}
          </button>
        </div>
      </div>
    </div>
  );
}
