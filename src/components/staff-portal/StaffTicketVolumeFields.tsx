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
  const soSp = Number(soSpNam) || 0;
  const phut = Number(phutThucTe) || 0;
  const gioBs = Number(gioBoSung) || 0;
  const totalHoursSp = Number(((soSp * phut) / 60).toFixed(1));
  const totalHoursAll = Number((totalHoursSp + gioBs).toFixed(1));
  const filledNumberClass = (value: string) => Number(value) > 0
    ? 'border-[#7cc4f5] bg-[#eff8ff] shadow-[0_3px_10px_rgba(0,114,188,0.10)]'
    : 'border-[#cbd5e1] bg-white';
  const sourceFilled = nguonSoLieu.trim().length > 0;

  return (
    <>
      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 align-middle text-xs uppercase text-[#004776]">
          7. Số lượng SP / năm (Kỳ 2025–2026)
        </td>
        <td className="border border-[#004776] p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={soSpNam}
              onChange={(e) => onChangeSoSp(e.target.value)}
              className={`w-32 h-9 px-3 rounded-lg border text-xs font-bold text-[#004776] focus:border-[#0072BC] focus:ring-1 focus:ring-[#0072BC] outline-hidden transition-all duration-200 ${filledNumberClass(soSpNam)}`}
            />
            <span className="text-xs font-semibold text-[#475569]">sản phẩm / năm</span>
          </div>
          <textarea
            rows={2}
            value={nguonSoLieu}
            onChange={(e) => onChangeNguon(e.target.value)}
            placeholder="Nguồn số liệu sản lượng (Cột H Biểu B1, vd: Hệ thống thông tin nội bộ, Sổ theo dõi...)"
            className={`w-full min-h-[56px] px-2.5 py-2 rounded-lg border text-[11px] leading-relaxed text-[#004776] focus:border-[#0072BC] focus:ring-1 focus:ring-[#0072BC] outline-hidden resize-y transition-all duration-200 ${sourceFilled ? 'border-[#7cc4f5] bg-[#eff8ff] shadow-[0_3px_10px_rgba(0,114,188,0.10)]' : 'border-[#cbd5e1] bg-white'}`}
          />
        </td>
      </tr>

      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 align-middle text-xs uppercase text-[#004776]">
          8. Thời gian trung bình / 1 SP
        </td>
        <td className="border border-[#004776] p-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={phutThucTe}
              onChange={(e) => onChangePhut(e.target.value)}
              className={`w-32 h-9 px-3 rounded-lg border text-xs font-bold text-[#004776] focus:border-[#0072BC] focus:ring-1 focus:ring-[#0072BC] outline-hidden transition-all duration-200 ${filledNumberClass(phutThucTe)}`}
            />
            <span className="text-xs font-semibold text-[#475569]">phút / sản phẩm</span>
          </div>
        </td>
      </tr>

      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 align-middle text-xs uppercase text-[#004776]">
          9. Giờ bổ sung (giờ/năm)
        </td>
        <td className="border border-[#004776] p-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={gioBoSung}
              onChange={(e) => onChangeGioBoSung(e.target.value)}
              className={`w-32 h-9 px-3 rounded-lg border text-xs font-bold text-[#004776] focus:border-[#0072BC] focus:ring-1 focus:ring-[#0072BC] outline-hidden transition-all duration-200 ${filledNumberClass(gioBoSung)}`}
            />
            <span className="text-xs font-semibold text-[#475569]">giờ / năm</span>
          </div>
        </td>
      </tr>

      <tr>
        <td className="border border-[#004776] bg-[#eef5ff] font-bold p-2.5 align-middle text-xs uppercase text-[#0072BC]">
          Tổng thời gian quy đổi (Biểu B1)
        </td>
        <td className="border border-[#004776] bg-[#f8fbff] p-2.5">
          <div className="text-sm font-bold text-[#0072BC]">
            {totalHoursAll} giờ/năm
          </div>
          <div className="text-[11px] text-[#475569] mt-0.5">
            (Quy đổi sản phẩm: {totalHoursSp} giờ + Giờ bổ sung: {gioBs} giờ)
          </div>
        </td>
      </tr>
    </>
  );
}
