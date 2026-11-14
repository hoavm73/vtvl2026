'use client';

import React from 'react';
import { StaffWorkTicket } from '@/types/staff-ticket';
import { StaffTicketCoreFields } from './StaffTicketCoreFields';
import { StaffTicketVolumeFields } from './StaffTicketVolumeFields';
import { StaffTicketSignatureBlock } from './StaffTicketSignatureBlock';

interface StaffTicketA4PreviewProps {
  unitNameVi: string;
  unitCode: string;
  ownerName: string;
  ownerEmail: string;
  ownerTitle: string;
  editingTicket: StaffWorkTicket | null;
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

export function StaffTicketA4Preview(props: StaffTicketA4PreviewProps) {
  return (
    <div
      className="bg-white rounded-2xl border-2 border-[#cbd5e1] shadow-2xl p-4 sm:p-8 md:p-10 text-[#004776] print:border-none print:shadow-none print:p-0"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-12 print:grid-cols-12 gap-3 sm:gap-2 text-center mb-5">
        <div className="sm:col-span-5 print:col-span-5">
          <div className="text-[11px] uppercase font-normal">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
          <div className="text-[11px] font-bold uppercase">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM</div>
          <div className="text-[11px] font-bold uppercase mt-0.5">{props.unitNameVi}</div>
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
          <div><strong>Họ và tên người lập phiếu:</strong> {props.ownerName} ({props.ownerEmail})</div>
          <div><strong>Trạng thái:</strong> <span className="font-bold text-[#0072BC]">{props.editingTicket?.status || 'Đang tạo mới'}</span></div>
        </div>
        <div><strong>Chức danh:</strong> {props.ownerTitle || 'Chuyên viên'} &nbsp;|&nbsp; <strong>Đơn vị:</strong> {props.unitNameVi} ({props.unitCode})</div>
      </div>

      <div className="overflow-x-auto -mx-1 sm:mx-0">
        <table className="w-full min-w-[500px] sm:min-w-0 border-collapse border border-[#004776] text-[12.5px] mb-5">
          <tbody>
            <StaffTicketCoreFields
              maNhiemVu={props.maNhiemVu}
              maCongViec={props.maCongViec}
              tenCongViec={props.tenCongViec}
              maVtvl={props.maVtvl}
              maVtvlPhoiHop={props.maVtvlPhoiHop}
              sanPham={props.sanPham}
              chatLuong={props.chatLuong}
              canCu={props.canCu}
              missionOptions={props.missionOptions}
              vtvlOptions={props.vtvlOptions}
              onChangeMission={props.onChangeMission}
              onChangeTenCongViec={props.onChangeTenCongViec}
              onChangeVtvl={props.onChangeVtvl}
              onChangeVtvlPhoiHop={props.onChangeVtvlPhoiHop}
              onChangeSanPham={props.onChangeSanPham}
              onChangeChatLuong={props.onChangeChatLuong}
              onChangeCanCu={props.onChangeCanCu}
            />

            <StaffTicketVolumeFields
              soSpNam={props.soSpNam}
              phutThucTe={props.phutThucTe}
              gioBoSung={props.gioBoSung}
              nguonSoLieu={props.nguonSoLieu}
              onChangeSoSp={props.onChangeSoSp}
              onChangePhut={props.onChangePhut}
              onChangeGioBoSung={props.onChangeGioBoSung}
              onChangeNguon={props.onChangeNguon}
            />
          </tbody>
        </table>
      </div>

      <StaffTicketSignatureBlock ownerName={props.ownerName} />
    </div>
  );
}
