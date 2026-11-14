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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1">1. Mã nhiệm vụ (chọn từ Biểu A1) *</label>
          <ShadcnSelect
            value={maNhiemVu}
            options={missionOptions}
            placeholder="Chọn nhiệm vụ..."
            onChange={onChangeMission}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">2. Mã công việc (tự sinh chống trùng)</label>
          <div className="h-10 px-3 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] flex items-center justify-between text-sm font-mono font-bold text-[#0072BC]">
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
          onChange={(e) => onChangeTenCongViec(e.target.value)}
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
            onChange={onChangeVtvl}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">3b. Mã vị trí việc làm phối hợp (nếu có)</label>
          <ShadcnSelect
            value={maVtvlPhoiHop}
            options={[{ value: '', label: 'Không có' }, ...vtvlOptions]}
            placeholder="Chọn VTVL phối hợp..."
            onChange={onChangeVtvlPhoiHop}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1">4. Sản phẩm đầu ra (Biểu A2)</label>
          <textarea
            rows={2}
            value={sanPham}
            onChange={(e) => onChangeSanPham(e.target.value)}
            placeholder="Mô tả sản phẩm đầu ra cụ thể..."
            className="w-full p-2.5 rounded-lg border border-[#cbd5e1] text-sm text-[#004776] focus:border-[#0072BC] outline-hidden"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1">5. Yêu cầu chất lượng (Biểu A2)</label>
          <textarea
            rows={2}
            value={chatLuong}
            onChange={(e) => onChangeChatLuong(e.target.value)}
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
          onChange={(e) => onChangeCanCu(e.target.value)}
          placeholder="Ví dụ: Quy chế đào tạo, QĐ 2266/QĐ-ĐHCNKT, phân công công tác..."
          className="w-full h-10 px-3 rounded-lg border border-[#cbd5e1] text-sm text-[#004776] focus:border-[#0072BC] outline-hidden"
        />
      </div>
    </>
  );
}
