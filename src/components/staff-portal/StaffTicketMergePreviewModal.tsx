'use client';

import React, { useState } from 'react';
import { X, Layers, CheckCircle2, ArrowRight } from 'lucide-react';
import { StaffWorkTicket } from '@/types/staff-ticket';

interface StaffTicketMergePreviewModalProps {
  ticket: StaffWorkTicket | null;
  onClose: () => void;
  onConfirmMerge: (ticket: StaffWorkTicket) => Promise<void>;
}

export function StaffTicketMergePreviewModal({ ticket, onClose, onConfirmMerge }: StaffTicketMergePreviewModalProps) {
  const [merging, setMerging] = useState(false);
  if (!ticket) return null;
  const hours = Math.round((((ticket.soSpNam * ticket.phutThucTe) / 60) + ticket.gioBoSung) * 10) / 10;

  const handleMerge = async () => {
    setMerging(true);
    try {
      await onConfirmMerge(ticket);
      onClose();
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#0072BC]" />
            <h2 className="text-base font-bold text-[#004776]">
              Gộp vào B1/B2 — Xem trước dữ liệu [{ticket.maCongViec}]
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-[#64748b] hover:text-[#004776] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-[13px] text-[#004776]">
          {ticket.isMergedToB1B2 && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[#0072BC]">
              Phiếu này đã được gộp trước đó (bởi {ticket.mergedBy}). Thao tác gộp lại sẽ <strong>cập nhật bản ghi hiện có</strong> theo phiên bản v{ticket.currentVersionNo || 1} mà không sinh dòng trùng lặp.
            </div>
          )}

          {/* Bản ghi A2 */}
          <div className="space-y-2 p-3.5 rounded-xl border border-[#cbd5e1] bg-[#f8fbff]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0072BC] uppercase text-xs">1. Bản ghi vào Biểu A2 (Danh mục công việc & sản phẩm)</span>
              <span className="text-[11px] font-mono text-[#64748b]">ID: a2-{ticket.id}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Mã công việc: <strong>{ticket.maCongViec}</strong></div>
              <div>Mã nhiệm vụ: <strong>{ticket.maNhiemVu}</strong></div>
              <div>Mã VTVL chính: <strong>{ticket.maVtvl}</strong></div>
              <div>Tên công việc: <strong>{ticket.tenCongViec}</strong></div>
            </div>
            <div className="text-xs pt-1 border-t border-[#e2e8f0]">
              <span className="text-[#64748b]">Sản phẩm đầu ra: </span>{ticket.sanPham || '—'}
            </div>
          </div>

          {/* Bản ghi B1 */}
          <div className="space-y-2 p-3.5 rounded-xl border border-[#cbd5e1] bg-[#f8fbff]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#0072BC] uppercase text-xs">2. Bản ghi vào Biểu B1 (Thống kê sản phẩm & định mức giờ)</span>
              <span className="text-[11px] font-mono text-[#64748b]">ID: b1-{ticket.id}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-lg bg-white border border-[#e2e8f0]">
              <div>
                <span className="text-[11px] text-[#64748b] block">Sản lượng</span>
                <strong>{ticket.soSpNam} SP</strong>
              </div>
              <div>
                <span className="text-[11px] text-[#64748b] block">Thời gian</span>
                <strong>{ticket.phutThucTe} phút</strong>
              </div>
              <div>
                <span className="text-[11px] text-[#64748b] block">Tổng giờ</span>
                <strong className="text-[#0072BC]">{hours} giờ/năm</strong>
              </div>
            </div>
          </div>

          {/* Minh bạch về Biểu B2 */}
          <div className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] text-[11px] text-[#475569]">
            <strong className="text-[#004776]">3. Liên kết Biểu B2 (Tổng hợp nhật ký khảo sát giờ):</strong> Hệ thống chỉ liên kết dòng Biểu B2 khi mã công việc <strong>{ticket.maCongViec}</strong> có dữ liệu đo bấm giờ thực tế tại <strong>Biểu B2_CT</strong> (không tự sinh số liệu B2 giả).
          </div>
        </div>

        <div className="p-3.5 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={merging} className="h-9 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-xs font-semibold text-[#004776] cursor-pointer">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleMerge}
            disabled={merging}
            className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{merging ? 'Đang gộp...' : 'Gộp vào B1/B2'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
