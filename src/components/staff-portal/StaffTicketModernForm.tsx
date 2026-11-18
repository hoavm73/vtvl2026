'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { CoordinatedVtvlEntry } from '@/types/staff-ticket';
import { CoordinatedVtvlPreviewPanel } from '@/components/staff-portal/CoordinatedVtvlSection';

interface StaffTicketModernFormProps {
  unitCode: string;
  maNhiemVu: string;
  maCongViec: string;
  tenCongViec: string;
  maVtvl: string;
  maVtvlPhoiHop: string;
  coordinationNote: string;
  coordinatedVtvls: CoordinatedVtvlEntry[];
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
  onChangeCoordinationNote: (val: string) => void;
  onChangeCoordinatedVtvls: (items: CoordinatedVtvlEntry[]) => void;
  onChangeSanPham: (val: string) => void;
  onChangeChatLuong: (val: string) => void;
  onChangeCanCu: (val: string) => void;
  onChangeSoSp: (val: string) => void;
  onChangeNguon: (val: string) => void;
  onChangePhut: (val: string) => void;
  onChangeGioBoSung: (val: string) => void;
}

export function StaffTicketModernForm(props: StaffTicketModernFormProps) {
  const textareaClass = (value: string) => `w-full min-h-[72px] px-3 py-2.5 text-xs sm:text-sm leading-relaxed rounded-[10px] border text-[#004776] placeholder:text-[#94a3b8] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden resize-y transition-colors duration-200 ${
    value.trim()
      ? 'border-[#7cc4f5] bg-[#eff8ff]'
      : 'border-[#cbd5e1] bg-white'
  }`;

  const numberInputClass = (value: string) => `w-full h-10 px-3 text-xs sm:text-sm rounded-[10px] border text-[#004776] font-semibold focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden transition-colors duration-200 ${
    Number(value) > 0
      ? 'border-[#7cc4f5] bg-[#eff8ff]'
      : 'border-[#cbd5e1] bg-white'
  }`;

  return (
    <div className="divide-y divide-[#e2e8f0]">
      {/* Nhóm 1: Nhiệm vụ & Vị trí việc làm */}
      <div className="pb-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm sm:text-[15px] font-bold text-[#0072BC] leading-normal">
            1. Nhiệm vụ &amp; vị trí việc làm
          </h3>
          <span className="shrink-0 text-[11px] text-[#0072BC] font-semibold bg-[#eef5ff] px-2.5 py-0.5 rounded-full">
            Bắt buộc *
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
          <div className="sm:col-span-8 space-y-1.5">
            <label htmlFor="field-ma-nhiem-vu" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Mã nhiệm vụ (theo Biểu A1) *
            </label>
            <ShadcnSelect
              id="field-ma-nhiem-vu"
              ariaLabel="Mã nhiệm vụ theo Biểu A1"
              value={props.maNhiemVu}
              options={props.missionOptions}
              placeholder="-- Chọn nhiệm vụ theo Biểu A1 --"
              onChange={props.onChangeMission}
            />
          </div>

          <div className="sm:col-span-4 space-y-1.5">
            <label htmlFor="field-ma-cong-viec" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Mã công việc (tự sinh)
            </label>
            <input
              id="field-ma-cong-viec"
              type="text"
              readOnly
              value={props.maCongViec || 'Tự động cấp mã...'}
              aria-label="Mã công việc tự sinh"
              className="w-full h-10 px-3 rounded-[10px] border border-[#cbd5e1] bg-[#f1f5f9] text-xs sm:text-sm font-mono font-bold text-[#0072BC] cursor-default outline-hidden"
            />
          </div>

          <div className="sm:col-span-12 space-y-1.5">
            <label htmlFor="field-ten-cong-viec" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Tên công việc cụ thể *
            </label>
            <textarea
              id="field-ten-cong-viec"
              name="tenCongViec"
              rows={2}
              value={props.tenCongViec}
              onChange={(e) => props.onChangeTenCongViec(e.target.value)}
              placeholder="Ví dụ: Lập kế hoạch giảng dạy học kỳ 1 năm học 2026–2027..."
              className={textareaClass(props.tenCongViec)}
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label htmlFor="field-ma-vtvl" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Mã VTVL chính (theo Biểu C1) *
            </label>
            <ShadcnSelect
              id="field-ma-vtvl"
              ariaLabel="Mã VTVL chính theo Biểu C1"
              value={props.maVtvl}
              options={props.vtvlOptions}
              placeholder="-- Chọn VTVL chính phụ trách --"
              onChange={props.onChangeVtvl}
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label htmlFor="field-ma-vtvl-phoi-hop" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Mã VTVL phối hợp (nếu có)
            </label>
            <ShadcnSelect
              id="field-ma-vtvl-phoi-hop"
              ariaLabel="Mã VTVL phối hợp nếu có"
              value={props.maVtvlPhoiHop}
              options={[{ value: '', label: '— Không chọn VTVL phối hợp —' }, ...props.vtvlOptions]}
              placeholder="Chọn VTVL phối hợp (nếu có)"
              onChange={props.onChangeVtvlPhoiHop}
            />
          </div>

          <div className="sm:col-span-12">
            <CoordinatedVtvlPreviewPanel
              unitCode={props.unitCode}
              maVtvlPhoiHop={props.maVtvlPhoiHop}
              coordinationNote={props.coordinationNote}
              coordinatedVtvls={props.coordinatedVtvls}
              vtvlOptions={props.vtvlOptions}
              onChangeCoordinationNote={props.onChangeCoordinationNote}
              onChangeCoordinatedVtvls={props.onChangeCoordinatedVtvls}
            />
          </div>
        </div>
      </div>

      {/* Nhóm 2: Sản phẩm đầu ra & Căn cứ */}
      <div className="py-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm sm:text-[15px] font-bold text-[#0072BC] leading-normal">
            2. Sản phẩm đầu ra &amp; tiêu chuẩn
          </h3>
          <span className="shrink-0 text-[11px] text-[#0072BC] font-semibold bg-[#eef5ff] px-2.5 py-0.5 rounded-full">
            Bắt buộc *
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
          <div className="sm:col-span-6 space-y-1.5">
            <label htmlFor="field-san-pham" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Sản phẩm đầu ra cụ thể *
            </label>
            <textarea
              id="field-san-pham"
              name="sanPham"
              rows={2}
              value={props.sanPham}
              onChange={(e) => props.onChangeSanPham(e.target.value)}
              placeholder="Ví dụ: Kế hoạch giảng dạy được phê duyệt..."
              className={textareaClass(props.sanPham)}
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label htmlFor="field-chat-luong" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Tiêu chuẩn chất lượng *
            </label>
            <textarea
              id="field-chat-luong"
              name="chatLuong"
              rows={2}
              value={props.chatLuong}
              onChange={(e) => props.onChangeChatLuong(e.target.value)}
              placeholder="Ví dụ: Đạt 100% tiến độ, không có sai sót..."
              className={textareaClass(props.chatLuong)}
            />
          </div>

          <div className="sm:col-span-12 space-y-1.5">
            <label htmlFor="field-can-cu" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Căn cứ pháp lý / Quyết định giao việc *
            </label>
            <textarea
              id="field-can-cu"
              name="canCu"
              rows={2}
              value={props.canCu}
              onChange={(e) => props.onChangeCanCu(e.target.value)}
              placeholder="Ví dụ: Quyết định phân công nhiệm vụ năm học số 123/QĐ-ĐHCNKT..."
              className={textareaClass(props.canCu)}
            />
          </div>
        </div>
      </div>

      {/* Nhóm 3: Định mức thời gian & Sản lượng */}
      <div className="pt-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm sm:text-[15px] font-bold text-[#0072BC] leading-normal">
            3. Định mức thời gian &amp; sản lượng hằng năm
          </h3>
          <span className="shrink-0 text-[11px] text-[#0072BC] font-semibold bg-[#eef5ff] px-2.5 py-0.5 rounded-full">
            Bắt buộc *
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
          <div className="sm:col-span-6 space-y-1.5">
            <label htmlFor="field-so-sp-nam" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Số sản phẩm hoàn thành trong năm trong chu kỳ 1 năm (01/10/2025 đến 30/9/2026) *
            </label>
            <input
              id="field-so-sp-nam"
              name="soSpNam"
              type="number"
              min="0"
              step="any"
              value={props.soSpNam}
              onChange={(e) => props.onChangeSoSp(e.target.value)}
              className={numberInputClass(props.soSpNam)}
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label htmlFor="field-nguon-so-lieu" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Nguồn số liệu kiểm chứng *
            </label>
            <textarea
              id="field-nguon-so-lieu"
              name="nguonSoLieu"
              rows={2}
              value={props.nguonSoLieu}
              onChange={(e) => props.onChangeNguon(e.target.value)}
              placeholder="Ví dụ: Báo cáo tổng kết khoa, hệ thống phần mềm..."
              className={textareaClass(props.nguonSoLieu)}
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label htmlFor="field-phut-thuc-te" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Thời gian thực hiện thực tế (phút/SP) *
            </label>
            <input
              id="field-phut-thuc-te"
              name="phutThucTe"
              type="number"
              min="0"
              step="any"
              value={props.phutThucTe}
              onChange={(e) => props.onChangePhut(e.target.value)}
              className={numberInputClass(props.phutThucTe)}
            />
          </div>

          <div className="sm:col-span-6 space-y-1.5">
            <label htmlFor="field-gio-bo-sung" className="text-xs sm:text-[13px] font-bold text-[#004776]">
              Giờ bổ sung (Nếu có)
            </label>
            <input
              id="field-gio-bo-sung"
              name="gioBoSung"
              type="number"
              min="0"
              step="any"
              value={props.gioBoSung}
              onChange={(e) => props.onChangeGioBoSung(e.target.value)}
              className={numberInputClass(props.gioBoSung)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
