'use client';

import React from 'react';
import { StaffWorkTicket } from '@/types/staff-ticket';
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
}

export function StaffTicketA4Preview(props: StaffTicketA4PreviewProps) {
  const soSp = Number(props.soSpNam) || 0;
  const phut = Number(props.phutThucTe) || 0;
  const gioBs = Number(props.gioBoSung) || 0;
  const totalHoursSp = Math.round(((soSp * phut) / 60) * 10) / 10;
  const totalHoursAll = Math.round((totalHoursSp + gioBs) * 10) / 10;

  const missionLabel = props.missionOptions.find((m) => m.value === props.maNhiemVu)?.label || props.maNhiemVu || '—';
  const vtvlLabel = props.vtvlOptions.find((v) => v.value === props.maVtvl)?.label || props.maVtvl || '—';
  const vtvlPhoiHopLabel = props.vtvlOptions.find((v) => v.value === props.maVtvlPhoiHop)?.label || (props.maVtvlPhoiHop ? props.maVtvlPhoiHop : 'Không có');

  return (
    <div className="flex justify-center print:block">
      <div
        id="vtvl-a4-print-sheet"
        className="vtvl-printable-sheet bg-white w-full max-w-[210mm] min-h-[297mm] pt-[20mm] pr-[20mm] pb-[20mm] pl-[30mm] shadow-md border border-[#cbd5e1] text-[#004776] text-[13px] leading-relaxed mx-auto print:p-0 print:m-0 print:border-none print:shadow-none print:w-full print:max-w-none print:min-h-0"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
        {/* Quốc hiệu & Tên đơn vị theo thể thức Nghị định 30/2020/NĐ-CP */}
        <div className="grid grid-cols-12 gap-2 text-center mb-5">
          <div className="col-span-5">
            <div className="text-[11px] uppercase font-normal">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
            <div className="text-[11px] font-bold uppercase">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM</div>
            <div className="text-[11px] font-bold uppercase mt-0.5">{props.unitNameVi}</div>
            <div className="w-24 h-[1px] bg-[#004776] mx-auto mt-1" />
          </div>
          <div className="col-span-7">
            <div className="text-[11px] font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
            <div className="text-[12px] font-bold">Độc lập – Tự do – Hạnh phúc</div>
            <div className="w-32 h-[1px] bg-[#004776] mx-auto mt-1" />
          </div>
        </div>

        {/* Tiêu đề biểu mẫu */}
        <div className="text-center mb-6">
          <h2 className="text-[16px] sm:text-[18px] font-bold uppercase tracking-tight text-[#004776]">
            PHIẾU KHẢO SÁT KHỐI LƯỢNG CÔNG VIỆC CÁ NHÂN
          </h2>
          <div className="text-[12px] italic text-[#476885] mt-0.5">
            (Kỳ thống kê: Từ ngày 01/10/2025 đến ngày 30/9/2026 • Theo Hướng dẫn số 07-HD/BTCTW)
          </div>
        </div>

        {/* Thông tin nhân sự kê khai */}
        <div className="space-y-1.5 mb-5 text-[13px] border-b border-[#e2e8f0] pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><strong>Họ và tên người lập phiếu:</strong> {props.ownerName} ({props.ownerEmail})</div>
            <div><strong>Trạng thái:</strong> <span className="font-bold text-[#0072BC]">{props.editingTicket?.status || 'Đang tạo mới'}</span></div>
          </div>
          <div><strong>Chức danh / Chức vụ:</strong> {props.ownerTitle || 'Chuyên viên'} &nbsp;|&nbsp; <strong>Đơn vị:</strong> {props.unitNameVi} ({props.unitCode})</div>
        </div>

        {/* Bảng chi tiết 12 trường dạng văn bản hành chính (Không dùng thẻ input) */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#004776] text-[12.5px] mb-5">
            <tbody>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold w-1/3 align-top">
                  1. Mã nhiệm vụ (Biểu A1)
                </td>
                <td className="border border-[#004776] px-3 py-2 leading-relaxed">
                  {missionLabel}
                </td>
              </tr>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  2. Mã công việc (tự sinh)
                </td>
                <td className="border border-[#004776] px-3 py-2 font-bold text-[#0072BC]">
                  {props.maCongViec || '—'}
                </td>
              </tr>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  3. Tên công việc cụ thể
                </td>
                <td className="border border-[#004776] px-3 py-2 font-medium leading-relaxed">
                  {props.tenCongViec || '—'}
                </td>
              </tr>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  3a. Mã vị trí việc làm chính (Biểu C1)
                </td>
                <td className="border border-[#004776] px-3 py-2 leading-relaxed">
                  {vtvlLabel}
                </td>
              </tr>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  3b. Vị trí việc làm phối hợp
                </td>
                <td className="border border-[#004776] px-3 py-2 leading-relaxed">
                  {vtvlPhoiHopLabel}
                </td>
              </tr>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  4. Sản phẩm đầu ra
                </td>
                <td className="border border-[#004776] px-3 py-2 whitespace-pre-wrap leading-relaxed">
                  {props.sanPham || '—'}
                </td>
              </tr>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  5. Yêu cầu chất lượng
                </td>
                <td className="border border-[#004776] px-3 py-2 whitespace-pre-wrap leading-relaxed">
                  {props.chatLuong || '—'}
                </td>
              </tr>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  6. Căn cứ / Tài liệu giải trình
                </td>
                <td className="border border-[#004776] px-3 py-2 whitespace-pre-wrap leading-relaxed">
                  {props.canCu || '—'}
                </td>
              </tr>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  7. Số lượng SP / năm (Kỳ 2025–2026)
                </td>
                <td className="border border-[#004776] px-3 py-2">
                  <strong>{soSp}</strong> sản phẩm/năm
                  {props.nguonSoLieu ? ` (Nguồn số liệu: ${props.nguonSoLieu})` : ''}
                </td>
              </tr>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  8. Thời gian trung bình / 1 SP
                </td>
                <td className="border border-[#004776] px-3 py-2">
                  <strong>{phut}</strong> phút/sản phẩm
                </td>
              </tr>
              <tr>
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  9. Giờ bổ sung
                </td>
                <td className="border border-[#004776] px-3 py-2">
                  <strong>{gioBs}</strong> giờ/năm
                </td>
              </tr>
              <tr className="bg-[#f8fbff] print:bg-transparent">
                <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                  Tổng thời gian quy đổi (Biểu B1)
                </td>
                <td className="border border-[#004776] px-3 py-2 font-bold text-[#004776]">
                  {totalHoursAll} giờ/năm (Giờ sản phẩm: {totalHoursSp}h + Giờ bổ sung: {gioBs}h)
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Khối chữ ký xác nhận */}
        <StaffTicketSignatureBlock ownerName={props.ownerName} />
      </div>
    </div>
  );
}
