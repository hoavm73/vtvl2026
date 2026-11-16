'use client';

import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { StaffWorkTicket } from '@/types/staff-ticket';

export type TicketModerationModalMode = 'request_changes' | 'revoke_approval' | 'cancel_ticket';

interface StaffTicketRevisionModalProps {
  ticket: StaffWorkTicket | null;
  mode?: TicketModerationModalMode;
  onClose: () => void;
  onSubmit: (ticket: StaffWorkTicket, reason: string) => Promise<void>;
}

export function StaffTicketRevisionModal({
  ticket,
  mode = 'request_changes',
  onClose,
  onSubmit
}: StaffTicketRevisionModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setReason('');
    setErr('');
  }, [ticket?.id, mode]);

  if (!ticket) return null;

  const modeCfg = {
    request_changes: {
      title: `Yêu cầu bổ sung phiếu [${ticket.maCongViec}]`,
      notice: '',
      noticeCls: '',
      label: 'Lý do yêu cầu bổ sung',
      placeholder: 'Ghi rõ nội dung cần hoàn thiện (căn cứ pháp lý, tài liệu chứng minh, định mức thời gian, sản phẩm đầu ra...)',
      submitText: 'Gửi yêu cầu bổ sung',
      btnCls: 'bg-amber-600 hover:bg-amber-700',
      Icon: AlertTriangle,
      iconCls: 'text-amber-600'
    },
    revoke_approval: {
      title: `Thu hồi phê duyệt phiếu [${ticket.maCongViec}]`,
      notice: `Phiếu sẽ chuyển về trạng thái "Yêu cầu bổ sung" để nhân viên sửa lại và nộp lại bản mới.${
        ticket.isMergedToB1B2 ? ' Dòng đã gộp vào Biểu A2/B1 sẽ được tự động gỡ khỏi bảng tính đơn vị.' : ''
      }`,
      noticeCls: 'bg-[#fff8eb] border-[#fcd34d] text-[#92400e]',
      label: 'Lý do thu hồi duyệt để sửa lại',
      placeholder: 'Nêu rõ sai sót cần nhân viên chỉnh sửa trước khi nộp và duyệt lại...',
      submitText: 'Xác nhận thu hồi duyệt',
      btnCls: 'bg-[#d97706] hover:bg-[#b45309]',
      Icon: RotateCcw,
      iconCls: 'text-[#d97706]'
    },
    cancel_ticket: {
      title: `Hủy / xóa phiếu kê khai sai [${ticket.maCongViec}]`,
      notice: `Phiếu sẽ bị hủy khỏi danh sách công việc và thống kê đơn vị${
        ticket.isMergedToB1B2 ? ', đồng thời tự động gỡ bỏ dòng đã gộp khỏi Biểu A2/B1' : ''
      }. Lý do hủy sẽ được ghi nhận vào Nhật ký hệ thống.`,
      noticeCls: 'bg-rose-50 border-rose-200 text-rose-800',
      label: 'Lý do hủy / xóa phiếu',
      placeholder: 'Ví dụ: Nhân viên kê khai nhầm vị trí việc làm, trùng công việc hoặc lập thừa phiếu...',
      submitText: 'Xác nhận hủy phiếu',
      btnCls: 'bg-rose-600 hover:bg-rose-700',
      Icon: Trash2,
      iconCls: 'text-rose-600'
    }
  }[mode];

  const HeaderIcon = modeCfg.Icon;

  const handleClose = () => {
    setReason('');
    setErr('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setErr('Vui lòng nhập lý do cụ thể trước khi xác nhận.');
      return;
    }
    setSubmitting(true);
    setErr('');
    try {
      await onSubmit(ticket, cleanReason);
      setReason('');
      setErr('');
      onClose();
    } catch {
      setErr('Thao tác không thành công, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#004776]/45 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <HeaderIcon className={`w-5 h-5 shrink-0 ${modeCfg.iconCls}`} />
            <h2 className="text-base font-bold text-[#004776] truncate">{modeCfg.title}</h2>
          </div>
          <button type="button" onClick={handleClose} className="p-1 rounded-lg text-[#476885] hover:text-[#004776] cursor-pointer" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="p-5 space-y-4">
          <div className="space-y-1 text-xs text-[#004776]">
            <div>Công việc: <strong>{ticket.tenCongViec}</strong></div>
            <div className="text-[#476885]">Người kê khai: {ticket.ownerName} ({ticket.ownerEmail})</div>
          </div>

          {modeCfg.notice && (
            <div className={`p-3 rounded-xl border text-xs leading-relaxed ${modeCfg.noticeCls}`}>
              {modeCfg.notice}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#004776]">
              {modeCfg.label} <span className="text-rose-600">*</span>
            </label>
            <textarea
              name={`moderation-reason-${ticket.id}-${mode}`}
              autoComplete="off"
              rows={4}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={modeCfg.placeholder}
              className="w-full p-3 rounded-xl border border-[#cbd5e1] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 text-xs sm:text-[13px] text-[#004776] resize-none outline-none leading-relaxed"
            />
            {err && <p className="text-xs text-rose-600 font-medium">{err}</p>}
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="h-9 px-4 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-xs font-semibold text-[#004776] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`h-9 px-4 rounded-xl text-white text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50 ${modeCfg.btnCls}`}
            >
              {submitting ? 'Đang xử lý...' : modeCfg.submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
