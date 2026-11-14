'use client';

import React from 'react';
import { Sparkles, HelpCircle } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';

interface StaffTicketModernFormProps {
  maNhiemVu: string;
  maCongViec: string;
  tenCongViec: string;
  maVtvl: string;
  maVtvlPhoiHop: string;
  sanPham: string;
  chatLuong: string;
  canCu: string;
  soSpNam: string;
  nguonSoLieu: string;
  phutThucTe: string;
  gioBoSung: string;
  missionOptions: { value: string; label: string }[];
  vtvlOptions: { value: string; label: string }[];
  onChangeMission: (val: string) => void;
  onChangeTenCongViec: (val: string) => void;
  onChangeVtvl: (val: string) => void;
  onChangeVtvlPhoiHop: (val: string) => void;
  onChangeSanPham: (val: string) => void;
  onChangeChatLuong: (val: string) => void;
  onChangeCanCu: (val: string) => void;
  onChangeSoSp: (val: string) => void;
  onChangeNguon: (val: string) => void;
  onChangePhut: (val: string) => void;
  onChangeGioBoSung: (val: string) => void;
}

export function StaffTicketModernForm(props: StaffTicketModernFormProps) {
  return (
    <div className="space-y-5">
      {/* Nhóm 1: Nhiệm vụ & Vị trí việc làm */}
      <div className="bg-[#fcfdff] rounded-2xl border border-[#dbeafe] p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="border-b border-[#e2ecf7] pb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#004776] uppercase tracking-wide">
            1. Nhiệm vụ &amp; Vị trí việc làm
          </h3>
          <span className="text-[11px] text-[#0072BC] font-semibold bg-[#eef5ff] px-2 py-0.5 rounded-full">
            Bắt buộc *
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
          <div className="sm:col-span-8 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Mã nhiệm vụ (theo Biểu A1) *
            </label>
            <ShadcnSelect
              value={props.maNhiemVu}
              options={props.missionOptions}
              placeholder="-- Chọn nhiệm vụ theo Biểu A1 --"
              onChange={props.onChangeMission}
            />
          </div>

          <div className="sm:col-span-4 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Mã công việc (tự sinh)
            </label>
            <div className="h-10 px-3 rounded-xl border border-[#cbd5e1] bg-[#f1f5f9] flex items-center justify-between text-xs sm:text-sm font-mono font-bold text-[#0072BC]">
              <span className="truncate">{props.maCongViec || 'Tự động cấp mã...'}</span>
              <Sparkles className="w-4 h-4 text-[#0072BC] shrink-0" />
            </div>
          </div>

          <div className="sm:col-span-12 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Tên công việc cụ thể *
            </label>
            <input
              type="text"
              value={props.tenCongViec}
              onChange={(e) => props.onChangeTenCongViec(e.target.value)}
              placeholder="Ví dụ: Lập kế hoạch giảng dạy học kỳ 1 năm học 2026–2027..."
              className="w-full h-10 sm:h-11 px-3 text-xs sm:text-sm rounded-xl border border-[#cbd5e1] bg-white text-[#004776] placeholder:text-[#94a3b8] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden transition-all"
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Mã VTVL chính (theo Biểu C1) *
            </label>
            <ShadcnSelect
              value={props.maVtvl}
              options={props.vtvlOptions}
              placeholder="-- Chọn VTVL chính phụ trách --"
              onChange={props.onChangeVtvl}
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Mã VTVL phối hợp (nếu có)
            </label>
            <ShadcnSelect
              value={props.maVtvlPhoiHop}
              options={props.vtvlOptions}
              placeholder="-- Chọn VTVL phối hợp (nếu có) --"
              onChange={props.onChangeVtvlPhoiHop}
            />
          </div>
        </div>
      </div>

      {/* Nhóm 2: Sản phẩm đầu ra & Căn cứ */}
      <div className="bg-[#fcfdff] rounded-2xl border border-[#dbeafe] p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="border-b border-[#e2ecf7] pb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#004776] uppercase tracking-wide">
            2. Sản phẩm đầu ra &amp; Tiêu chuẩn
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Sản phẩm đầu ra cụ thể
            </label>
            <input
              type="text"
              value={props.sanPham}
              onChange={(e) => props.onChangeSanPham(e.target.value)}
              placeholder="Ví dụ: Kế hoạch giảng dạy được phê duyệt..."
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-[#cbd5e1] bg-white text-[#004776] placeholder:text-[#94a3b8] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden transition-all"
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Tiêu chuẩn chất lượng
            </label>
            <input
              type="text"
              value={props.chatLuong}
              onChange={(e) => props.onChangeChatLuong(e.target.value)}
              placeholder="Ví dụ: Đạt 100% tiến độ, không có sai sót..."
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-[#cbd5e1] bg-white text-[#004776] placeholder:text-[#94a3b8] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden transition-all"
            />
          </div>

          <div className="sm:col-span-12 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Căn cứ pháp lý / Quyết định giao việc
            </label>
            <input
              type="text"
              value={props.canCu}
              onChange={(e) => props.onChangeCanCu(e.target.value)}
              placeholder="Ví dụ: Quyết định phân công nhiệm vụ năm học số 123/QĐ-ĐHCNKT..."
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-[#cbd5e1] bg-white text-[#004776] placeholder:text-[#94a3b8] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden transition-all"
            />
          </div>
        </div>
      </div>

      {/* Nhóm 3: Định mức thời gian & Sản lượng */}
      <div className="bg-[#fcfdff] rounded-2xl border border-[#dbeafe] p-4 sm:p-5 space-y-4 shadow-2xs">
        <div className="border-b border-[#e2ecf7] pb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#004776] uppercase tracking-wide">
            3. Định mức thời gian &amp; Sản lượng hàng năm
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Số sản phẩm hoàn thành trong năm
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={props.soSpNam}
              onChange={(e) => props.onChangeSoSp(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-[#cbd5e1] bg-white text-[#004776] font-semibold focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden transition-all"
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Nguồn số liệu kiểm chứng
            </label>
            <input
              type="text"
              value={props.nguonSoLieu}
              onChange={(e) => props.onChangeNguon(e.target.value)}
              placeholder="Ví dụ: Báo cáo tổng kết khoa, hệ thống phần mềm..."
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-[#cbd5e1] bg-white text-[#004776] placeholder:text-[#94a3b8] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden transition-all"
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
                Thời gian thực hiện thực tế (phút/SP)
              </label>
              <span className="text-[11px] text-[#64748b]">Có thể đo bằng Bấm giờ</span>
            </div>
            <input
              type="number"
              min="0"
              step="any"
              value={props.phutThucTe}
              onChange={(e) => props.onChangePhut(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-[#cbd5e1] bg-white text-[#004776] font-semibold focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden transition-all"
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Giờ làm việc tăng thêm trong năm (nếu có)
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={props.gioBoSung}
              onChange={(e) => props.onChangeGioBoSung(e.target.value)}
              className="w-full h-10 px-3 text-xs sm:text-sm rounded-xl border border-[#cbd5e1] bg-white text-[#004776] font-semibold focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
