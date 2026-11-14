'use client';

import React from 'react';
import { X, Printer } from 'lucide-react';
import { StaffWorkTicket } from '@/types/staff-ticket';

interface StaffTicketPrintModalProps {
  ticket: StaffWorkTicket | null;
  unitNameVi: string;
  onClose: () => void;
}

export function StaffTicketPrintModal({ ticket, unitNameVi, onClose }: StaffTicketPrintModalProps) {
  if (!ticket) return null;

  const totalHoursSp = Math.round(((ticket.soSpNam * ticket.phutThucTe) / 60) * 10) / 10;
  const totalHoursAll = Math.round((totalHoursSp + ticket.gioBoSung) * 10) / 10;
  const today = new Date();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#004776]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 20mm 20mm 20mm 30mm;
          }
          body * {
            visibility: hidden;
          }
          #vtvl-a4-print-area,
          #vtvl-a4-print-area * {
            visibility: visible;
          }
          #vtvl-a4-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden print:max-h-none print:border-none print:shadow-none">
        <div className="px-6 py-3.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between print:hidden">
          <div>
            <h3 className="text-base font-bold text-[#004776]">
              Xem trước & Xuất PDF khổ A4 — [{ticket.maCongViec}]
            </h3>
            <p className="text-xs text-[#64748b]">
              Định dạng chuẩn A4 dọc • Lề: Trên 2cm – Dưới 2cm – Trái 3cm – Phải 2cm (Nghị định 30/2020/NĐ-CP)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-4 rounded-xl bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              In / Lưu PDF (A4)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#e2e8f0] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Khung giấy A4 mô phỏng lề 2-2-3-2 cm trên màn hình */}
        <div className="p-6 overflow-y-auto bg-[#f1f5f9] flex justify-center print:p-0 print:bg-white print:overflow-visible">
          <div
            id="vtvl-a4-print-area"
            className="bg-white w-[210mm] min-h-[297mm] pt-[20mm] pr-[20mm] pb-[20mm] pl-[30mm] shadow-md border border-[#cbd5e1] text-[#004776] text-[13px] leading-relaxed"
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
          >
            {/* Quốc hiệu & Tên đơn vị */}
            <div className="grid grid-cols-12 gap-2 text-center mb-5">
              <div className="col-span-5">
                <div className="text-[11px] uppercase font-normal">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
                <div className="text-[11px] font-bold uppercase">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM</div>
                <div className="text-[11px] font-bold uppercase mt-0.5">{unitNameVi}</div>
                <div className="w-24 h-[1px] bg-[#004776] mx-auto mt-1" />
              </div>
              <div className="col-span-7">
                <div className="text-[11px] font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="text-[12px] font-bold">Độc lập – Tự do – Hạnh phúc</div>
                <div className="w-32 h-[1px] bg-[#004776] mx-auto mt-1" />
              </div>
            </div>

            <div className="text-center mb-5">
              <h2 className="text-[15px] font-bold uppercase">
                PHIẾU KHẢO SÁT KHỐI LƯỢNG CÔNG VIỆC CÁ NHÂN
              </h2>
              <div className="text-[12px] italic">
                (Kỳ thống kê: Từ ngày 01/10/2025 đến ngày 30/9/2026 • Trạng thái: {ticket.status})
              </div>
            </div>

            <div className="space-y-1.5 mb-4 text-[13px]">
              <div><strong>Họ và tên người lập phiếu:</strong> {ticket.ownerName} ({ticket.ownerEmail})</div>
              <div><strong>Chức danh / Chức vụ:</strong> {ticket.ownerTitle} &nbsp;|&nbsp; <strong>Đơn vị:</strong> {unitNameVi} ({ticket.unitCode})</div>
            </div>

            <table className="w-full border-collapse border border-[#004776] text-[12.5px] mb-5">
              <tbody>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold w-1/3">1. Mã nhiệm vụ (Biểu A1)</td>
                  <td className="border border-[#004776] px-2.5 py-1.5">{ticket.maNhiemVu}</td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">2. Mã công việc (tự sinh)</td>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">{ticket.maCongViec}</td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">3. Tên công việc cụ thể</td>
                  <td className="border border-[#004776] px-2.5 py-1.5">{ticket.tenCongViec}</td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">3a. Mã vị trí việc làm chính</td>
                  <td className="border border-[#004776] px-2.5 py-1.5">{ticket.maVtvl}</td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">3b. Mã vị trí việc làm phối hợp</td>
                  <td className="border border-[#004776] px-2.5 py-1.5">{ticket.maVtvlPhoiHop || 'Không có'}</td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">4. Sản phẩm đầu ra</td>
                  <td className="border border-[#004776] px-2.5 py-1.5">{ticket.sanPham || '—'}</td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">5. Yêu cầu chất lượng</td>
                  <td className="border border-[#004776] px-2.5 py-1.5">{ticket.chatLuong || '—'}</td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">6. Căn cứ / Tài liệu giải trình</td>
                  <td className="border border-[#004776] px-2.5 py-1.5">{ticket.canCu || '—'}</td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">7. Số lượng SP (01/10/2025–30/9/2026)</td>
                  <td className="border border-[#004776] px-2.5 py-1.5">
                    <strong>{ticket.soSpNam}</strong> sản phẩm
                    {ticket.nguonSoLieu ? ` (Nguồn: ${ticket.nguonSoLieu})` : ''}
                  </td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">8. Thời gian trung bình / 1 SP</td>
                  <td className="border border-[#004776] px-2.5 py-1.5"><strong>{ticket.phutThucTe}</strong> phút/sản phẩm</td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">9. Giờ bổ sung</td>
                  <td className="border border-[#004776] px-2.5 py-1.5"><strong>{ticket.gioBoSung}</strong> giờ/năm</td>
                </tr>
                <tr>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">Tổng thời gian quy đổi (B1)</td>
                  <td className="border border-[#004776] px-2.5 py-1.5 font-bold">
                    {totalHoursAll} giờ/năm (Giờ SP: {totalHoursSp}h + Giờ bổ sung: {ticket.gioBoSung}h)
                  </td>
                </tr>
              </tbody>
            </table>

            {ticket.coordinatedTasks && ticket.coordinatedTasks.length > 0 && (
              <div className="mb-5 text-[12px]">
                <div className="font-bold mb-1">Công việc phối hợp liên đơn vị đã gán:</div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {ticket.coordinatedTasks.map((c) => (
                    <li key={c.id}>
                      [{c.targetUnitCode}] {c.targetTaskCode} — {c.targetTaskName}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 2 mục ký tên ở cuối bảng */}
            <div className="grid grid-cols-2 gap-6 mt-8 text-center text-[13px]">
              <div>
                <div className="font-bold uppercase">XÁC NHẬN CỦA TRƯỞNG ĐƠN VỊ</div>
                <div className="text-[11.5px] italic">(Ký, ghi rõ họ tên)</div>
                <div className="h-24" />
              </div>
              <div>
                <div className="text-[12px] italic">
                  TP. Hồ Chí Minh, ngày {String(today.getDate()).padStart(2, '0')} tháng {String(today.getMonth() + 1).padStart(2, '0')} năm {today.getFullYear()}
                </div>
                <div className="font-bold uppercase mt-0.5">NGƯỜI LẬP PHIẾU</div>
                <div className="text-[11.5px] italic">(Ký, ghi rõ họ tên)</div>
                <div className="h-20" />
                <div className="font-bold">{ticket.ownerName}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
