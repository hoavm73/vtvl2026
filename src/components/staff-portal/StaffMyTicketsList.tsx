'use client';

import React from 'react';
import { Edit3, Trash2, Eye, Printer, Link2, CheckCircle2, Clock } from 'lucide-react';
import { StaffWorkTicket } from '@/types/staff-ticket';

interface StaffMyTicketsListProps {
  tickets: StaffWorkTicket[];
  loading: boolean;
  onEditTicket: (t: StaffWorkTicket) => void;
  onPrintTicket: (t: StaffWorkTicket) => void;
  onCoordTicket: (t: StaffWorkTicket) => void;
  onDeleteTicket: (t: StaffWorkTicket) => void;
}

export function StaffMyTicketsList({
  tickets,
  loading,
  onEditTicket,
  onPrintTicket,
  onCoordTicket,
  onDeleteTicket
}: StaffMyTicketsListProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#004776]">
            Danh sách phiếu đã tạo của tôi ({tickets.length})
          </h2>
          <p className="text-xs text-[#64748b]">
            Bấm nút &quot;Sửa&quot; để nạp thông tin lên form phía trên, hoặc In PDF / Thêm công việc phối hợp.
          </p>
        </div>
      </div>

      <div className="divide-y divide-[#f1f5f9]">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#64748b]">Đang tải danh sách phiếu...</div>
        ) : tickets.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#64748b]">
            Bạn chưa có phiếu công việc nào trong danh sách. Hãy điền các thông tin ở form phía trên và bấm &quot;Lưu nháp&quot; hoặc &quot;Lưu và gửi&quot;.
          </div>
        ) : (
          tickets.map((t) => {
            const hours = Math.round((((t.soSpNam * t.phutThucTe) / 60) + t.gioBoSung) * 10) / 10;
            const isSubmitted = t.status === 'Đã nộp';
            return (
              <div key={t.id} className="p-4 hover:bg-[#f8fbff] transition-colors space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#0072BC] bg-[#eef5ff] px-2 py-0.5 rounded-md">
                        {t.maCongViec}
                      </span>
                      <span className="text-xs font-semibold text-[#475569] bg-[#f1f5f9] px-2 py-0.5 rounded-md">
                        VTVL: {t.maVtvl}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isSubmitted
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isSubmitted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {t.status}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#004776]">{t.tenCongViec}</div>
                    <div className="text-xs text-[#64748b]">
                      Sản lượng: <strong>{t.soSpNam}</strong> SP • Thời gian: <strong>{t.phutThucTe}</strong> phút/SP • Tổng: <strong>{hours}</strong> giờ/năm
                      {t.coordinatedTasks && t.coordinatedTasks.length > 0 && (
                        <span className="ml-2 text-[#0072BC] font-medium">• {t.coordinatedTasks.length} công việc phối hợp</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => onEditTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#0072BC]" /> Sửa trên form
                  </button>
                  <button
                    type="button"
                    onClick={() => onPrintTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#0072BC]" /> Xem trước
                  </button>
                  <button
                    type="button"
                    onClick={() => onPrintTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#0072BC]" /> In PDF (A4)
                  </button>
                  <button
                    type="button"
                    onClick={() => onCoordTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5 text-[#0072BC]" /> Thêm công việc phối hợp
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-medium text-red-600 inline-flex items-center gap-1 cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xóa
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
