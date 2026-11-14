'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';

interface StaffTicketCoreFieldsProps {
  maNhiemVu: string;
  maCongViec: string;
  tenCongViec: string;
  maVtvl: string;
  maVtvlPhoiHop: string;
  sanPham: string;
  chatLuong: string;
  canCu: string;
  missionOptions: { value: string; label: string }[];
  vtvlOptions: { value: string; label: string }[];
  onChangeMission: (val: string) => void;
  onChangeTenCongViec: (val: string) => void;
  onChangeVtvl: (val: string) => void;
  onChangeVtvlPhoiHop: (val: string) => void;
  onChangeSanPham: (val: string) => void;
  onChangeChatLuong: (val: string) => void;
  onChangeCanCu: (val: string) => void;
}

export function StaffTicketCoreFields({
  maNhiemVu,
  maCongViec,
  tenCongViec,
  maVtvl,
  maVtvlPhoiHop,
  sanPham,
  chatLuong,
  canCu,
  missionOptions,
  vtvlOptions,
  onChangeMission,
  onChangeTenCongViec,
  onChangeVtvl,
  onChangeVtvlPhoiHop,
  onChangeSanPham,
  onChangeChatLuong,
  onChangeCanCu
}: StaffTicketCoreFieldsProps) {
  return (
    <>
      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 w-1/3 align-middle text-xs uppercase text-[#004776]">
          1. Mã nhiệm vụ (Biểu A1) *
        </td>
        <td className="border border-[#004776] p-2">
          <ShadcnSelect
            value={maNhiemVu}
            options={missionOptions}
            placeholder="-- Chọn nhiệm vụ theo Biểu A1 --"
            onChange={onChangeMission}
          />
        </td>
      </tr>

      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 align-middle text-xs uppercase text-[#004776]">
          2. Mã công việc (tự sinh)
        </td>
        <td className="border border-[#004776] p-2">
          <div className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-[#f1f5f9] flex items-center justify-between text-xs font-mono font-bold text-[#0072BC]">
            <span>{maCongViec || 'Chọn nhiệm vụ để tự sinh mã theo chuẩn...'}</span>
            <Sparkles className="w-3.5 h-3.5 text-[#0072BC]" />
          </div>
        </td>
      </tr>

      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 align-middle text-xs uppercase text-[#004776]">
          3. Tên công việc cụ thể *
        </td>
        <td className="border border-[#004776] p-2">
          <input
            type="text"
            value={tenCongViec}
            onChange={(e) => onChangeTenCongViec(e.target.value)}
            placeholder="Nhập tên công việc cụ thể đang đảm nhận (Biểu A2)..."
            className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white text-xs text-[#004776] font-medium focus:border-[#0072BC] focus:ring-1 focus:ring-[#0072BC] outline-hidden"
          />
        </td>
      </tr>

      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 align-middle text-xs uppercase text-[#004776]">
          3a. Mã VTVL chính *
        </td>
        <td className="border border-[#004776] p-2">
          <ShadcnSelect
            value={maVtvl}
            options={vtvlOptions}
            placeholder="-- Chọn vị trí việc làm chính (Biểu C1) --"
            onChange={onChangeVtvl}
          />
        </td>
      </tr>

      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 align-middle text-xs uppercase text-[#004776]">
          3b. VTVL phối hợp (nếu có)
        </td>
        <td className="border border-[#004776] p-2">
          <ShadcnSelect
            value={maVtvlPhoiHop}
            options={[{ value: '', label: 'Không có phối hợp' }, ...vtvlOptions]}
            placeholder="-- Chọn VTVL phối hợp (nếu có) --"
            onChange={onChangeVtvlPhoiHop}
          />
        </td>
      </tr>

      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 align-middle text-xs uppercase text-[#004776]">
          4. Sản phẩm đầu ra
        </td>
        <td className="border border-[#004776] p-2">
          <input
            type="text"
            value={sanPham}
            onChange={(e) => onChangeSanPham(e.target.value)}
            placeholder="Ví dụ: Báo cáo, Quyết định, Đề thi, Giáo trình..."
            className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white text-xs text-[#004776] font-medium focus:border-[#0072BC] focus:ring-1 focus:ring-[#0072BC] outline-hidden"
          />
        </td>
      </tr>

      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 align-middle text-xs uppercase text-[#004776]">
          5. Yêu cầu chất lượng
        </td>
        <td className="border border-[#004776] p-2">
          <input
            type="text"
            value={chatLuong}
            onChange={(e) => onChangeChatLuong(e.target.value)}
            placeholder="Ví dụ: Đúng tiến độ, đạt chuẩn ISO, đúng quy định..."
            className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white text-xs text-[#004776] font-medium focus:border-[#0072BC] focus:ring-1 focus:ring-[#0072BC] outline-hidden"
          />
        </td>
      </tr>

      <tr>
        <td className="border border-[#004776] bg-[#f8fbff] font-bold p-2.5 align-middle text-xs uppercase text-[#004776]">
          6. Căn cứ / Tài liệu giải trình
        </td>
        <td className="border border-[#004776] p-2">
          <input
            type="text"
            value={canCu}
            onChange={(e) => onChangeCanCu(e.target.value)}
            placeholder="Ví dụ: Quyết định phân công, Quy chế làm việc..."
            className="w-full h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white text-xs text-[#004776] font-medium focus:border-[#0072BC] focus:ring-1 focus:ring-[#0072BC] outline-hidden"
          />
        </td>
      </tr>
    </>
  );
}
