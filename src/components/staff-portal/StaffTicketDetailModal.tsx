'use client';

import React from 'react';
import { X, CheckCircle2, Clock, AlertTriangle, RefreshCw, FileText, User, Building, Calendar, Layers } from 'lucide-react';
import { StaffWorkTicket, toCanonicalStatus, toDisplayStatus } from '@/types/staff-ticket';

interface StaffTicketDetailModalProps {
  ticket: StaffWorkTicket | null;
  unitNameVi?: string;
  onClose: () => void;
  onPrint?: (t: StaffWorkTicket) => void;
}

export function StaffTicketDetailModal({ ticket, unitNameVi, onClose, onPrint }: StaffTicketDetailModalProps) {
  if (!ticket) return null;
  const canonical = toCanonicalStatus(ticket.status);
  const hours = Math.round((((ticket.soSpNam * ticket.phutThucTe) / 60) + ticket.gioBoSung) * 10) / 10;

  const getStatusBadge = () => {
    switch (canonical) {
      case 'approved':
        return { cls: 'bg-emerald-50 text-emerald-700 border-emerald-300', icon: CheckCircle2, label: 'Đã duyệt' };
      case 'changes_requested':
        return { cls: 'bg-amber-50 text-amber-700 border-amber-300', icon: AlertTriangle, label: 'Yêu cầu bổ sung' };
      case 'resubmitted':
        return { cls: 'bg-purple-50 text-purple-700 border-purple-300', icon: RefreshCw, label: 'Đã nộp lại' };
      case 'submitted':
        return { cls: 'bg-blue-50 text-[#0072BC] border-blue-200', icon: Clock, label: 'Đã nộp' };
      default:
        return { cls: 'bg-slate-100 text-slate-700 border-slate-300', icon: Clock, label: 'Nháp' };
    }
  };

  const badge = getStatusBadge();
  const StatusIcon = badge.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#0072BC] bg-[#eef5ff] px-2.5 py-0.5 rounded-md">
                {ticket.maCongViec}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.cls}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {badge.label}
              </span>
              {ticket.isMergedToB1B2 && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Đã gộp B1/B2
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#004776] truncate">
              {ticket.tenCongViec}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-[#004776] hover:bg-[#e2e8f0] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body scroll */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-[13px] text-[#004776]">
          {/* Cảnh báo lý do bổ sung */}
          {ticket.revisionReason && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Ý kiến / Lý do yêu cầu bổ sung từ Lãnh đạo:</span>
              </div>
              <p className="text-xs pl-5 whitespace-pre-wrap">{ticket.revisionReason}</p>
              {ticket.revisionRequestedBy && (
                <div className="text-[11px] text-amber-700 pl-5 pt-0.5">
                  Người yêu cầu: {ticket.revisionRequestedBy} • {ticket.revisionRequestedAt ? new Date(ticket.revisionRequestedAt).toLocaleString('vi-VN') : ''}
                </div>
              )}
            </div>
          )}

          {/* Thông tin nhân sự & đơn vị */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#f8fbff] border border-[#dbeafe]">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#0072BC]" />
              <div>
                <span className="text-[#64748b]">Người kê khai: </span>
                <strong>{ticket.ownerName}</strong> ({ticket.ownerTitle || ticket.ownerEmail})
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-[#0072BC]" />
              <div>
                <span className="text-[#64748b]">Đơn vị: </span>
                <strong>{unitNameVi || ticket.unitCode}</strong>
              </div>
            </div>
          </div>

          {/* Vị trí & Nhiệm vụ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-[#e2e8f0] space-y-0.5">
              <span className="text-[#64748b] text-[11px]">Mã nhiệm vụ (A1):</span>
              <div className="font-semibold">{ticket.maNhiemVu}</div>
            </div>
            <div className="p-3 rounded-lg border border-[#e2e8f0] space-y-0.5">
              <span className="text-[#64748b] text-[11px]">Vị trí việc làm chính (C1):</span>
              <div className="font-semibold">{ticket.maVtvl}</div>
            </div>
          </div>

          {/* Nội dung chuyên môn */}
          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-[#e2e8f0] space-y-1">
              <span className="text-[#64748b] text-[11px] font-semibold">Sản phẩm đầu ra:</span>
              <p className="whitespace-pre-wrap">{ticket.sanPham || '—'}</p>
            </div>
            <div className="p-3 rounded-lg border border-[#e2e8f0] space-y-1">
              <span className="text-[#64748b] text-[11px] font-semibold">Tiêu chuẩn chất lượng:</span>
              <p className="whitespace-pre-wrap">{ticket.chatLuong || '—'}</p>
            </div>
            <div className="p-3 rounded-lg border border-[#e2e8f0] space-y-1">
              <span className="text-[#64748b] text-[11px] font-semibold">Căn cứ pháp lý & hồ sơ minh chứng:</span>
              <p className="whitespace-pre-wrap">{ticket.canCu || '—'}</p>
            </div>
          </div>

          {/* Định mức khối lượng */}
          <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#f1f5f9] text-center">
            <div>
              <span className="text-[11px] text-[#64748b] block">Sản lượng năm</span>
              <strong className="text-sm">{ticket.soSpNam} SP</strong>
            </div>
            <div>
              <span className="text-[11px] text-[#64748b] block">Định mức thời gian</span>
              <strong className="text-sm">{ticket.phutThucTe} phút/SP</strong>
            </div>
            <div>
              <span className="text-[11px] text-[#64748b] block">Tổng giờ / năm</span>
              <strong className="text-sm text-[#0072BC]">{hours} giờ</strong>
            </div>
          </div>

          {/* Lịch sử phê duyệt */}
          <div className="p-3 rounded-lg border border-[#e2e8f0] space-y-1 text-xs text-[#64748b]">
            <div className="flex items-center gap-1.5 font-bold text-[#004776]">
              <Calendar className="w-3.5 h-3.5 text-[#0072BC]" /> Lịch sử xử lý:
            </div>
            <div>Tạo phiếu: {new Date(ticket.createdAt).toLocaleString('vi-VN')}</div>
            {ticket.submittedAt && <div>Nộp phiếu: {new Date(ticket.submittedAt).toLocaleString('vi-VN')}</div>}
            {ticket.resubmittedAt && <div>Nộp lại: {new Date(ticket.resubmittedAt).toLocaleString('vi-VN')}</div>}
            {ticket.approvedAt && <div>Duyệt bởi <strong>{ticket.approvedBy}</strong> lúc {new Date(ticket.approvedAt).toLocaleString('vi-VN')}</div>}
            {ticket.mergedAt && <div>Gộp vào B1/B2 bởi <strong>{ticket.mergedBy}</strong> lúc {new Date(ticket.mergedAt).toLocaleString('vi-VN')}</div>}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end gap-2">
          {onPrint && (
            <button
              type="button"
              onClick={() => onPrint(ticket)}
              className="h-9 px-3.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] cursor-pointer"
            >
              In PDF (A4)
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
