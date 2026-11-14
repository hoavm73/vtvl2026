'use client';

import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { StaffWorkTicket } from '@/types/staff-ticket';

interface StaffTicketRevisionModalProps {
  ticket: StaffWorkTicket | null;
  onClose: () => void;
  onSubmit: (ticket: StaffWorkTicket, reason: string) => Promise<void>;
}

export function StaffTicketRevisionModal({ ticket, onClose, onSubmit }: StaffTicketRevisionModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  if (!ticket) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setErr('Vui lòng nhập lý do cụ thể cần cán bộ chỉnh sửa / bổ sung hồ sơ.');
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      await onSubmit(ticket, cleanReason);
      onClose();
    } catch {
      setErr('Không thể gửi yêu cầu bổ sung.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-[#004776]">
              Yêu cầu bổ sung phiếu [{ticket.maCongViec}]
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#64748b] hover:text-[#004776] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1 text-xs text-[#004776]">
            <div>Công việc: <strong>{ticket.tenCongViec}</strong></div>
            <div className="text-[#64748b]">Người kê khai: {ticket.ownerName} ({ticket.ownerEmail})</div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#004776]">
              Lý do yêu cầu bổ sung <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={4}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ghi rõ nội dung cần hoàn thiện (căn cứ pháp lý, tài liệu chứng minh, định mức thời gian, sản phẩm đầu ra...)"
              className="w-full p-3 rounded-xl border border-[#cbd5e1] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 text-xs sm:text-[13px] text-[#004776] resize-none outline-none leading-relaxed"
            />
            {err && <p className="text-xs text-rose-600 font-medium">{err}</p>}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-xs font-semibold text-[#004776] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Đang gửi...' : 'Gửi yêu cầu bổ sung'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
