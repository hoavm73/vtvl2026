'use client';

import React from 'react';

interface StaffTicketVolumeFieldsProps {
  soSpNam: string;
  phutThucTe: string;
  gioBoSung: string;
  nguonSoLieu: string;
  onChangeSoSp: (v: string) => void;
  onChangePhut: (v: string) => void;
  onChangeGioBoSung: (v: string) => void;
  onChangeNguon: (v: string) => void;
}

export function StaffTicketVolumeFields({
  soSpNam,
  phutThucTe,
  gioBoSung,
  nguonSoLieu,
  onChangeSoSp,
  onChangePhut,
  onChangeGioBoSung,
  onChangeNguon
}: StaffTicketVolumeFieldsProps) {
  return (
    <div className="p-4 rounded-xl bg-[#f8fbff] border border-[#dbeafe] space-y-3">
      <div className="text-xs font-bold text-[#0072BC] uppercase">
        Đo lường khối lượng thực hiện (Liên thông Biểu B1)
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1">7. Số SP (01/10/2025–30/9/2026)</label>
          <input
            type="number"
            min={0}
            value={soSpNam}
            onChange={(e) => onChangeSoSp(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-white text-sm text-[#004776] outline-hidden"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">8. Trung bình 1 SP (phút)</label>
          <input
            type="number"
            min={0}
            value={phutThucTe}
            onChange={(e) => onChangePhut(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-white text-sm text-[#004776] outline-hidden"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">9. Giờ bổ sung (giờ/năm)</label>
          <input
            type="number"
            min={0}
            value={gioBoSung}
            onChange={(e) => onChangeGioBoSung(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-white text-sm text-[#004776] outline-hidden"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">
          Giải trình nguồn số liệu sản lượng (Cột H Biểu B1)
        </label>
        <input
          type="text"
          value={nguonSoLieu}
          onChange={(e) => onChangeNguon(e.target.value)}
          placeholder="Ví dụ: Thống kê trên hệ thống S-Link / Sổ theo dõi cá nhân năm học 2025–2026..."
          className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] bg-white text-sm text-[#004776] outline-hidden"
        />
      </div>
    </div>
  );
}
