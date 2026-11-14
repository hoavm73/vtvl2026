'use client';

import React from 'react';
import {
  Edit3, Trash2, Eye, Printer, Link2, CheckCircle2, Clock, AlertTriangle, RefreshCw, Send
} from 'lucide-react';
import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';

interface StaffMyTicketsListProps {
  tickets: StaffWorkTicket[];
  loading: boolean;
  onEditTicket: (t: StaffWorkTicket) => void;
  onPrintTicket: (t: StaffWorkTicket) => void;
  onCoordTicket: (t: StaffWorkTicket) => void;
  onDeleteTicket: (t: StaffWorkTicket) => void;
  onSubmitTicket?: (t: StaffWorkTicket, isResubmit: boolean) => void;
  onViewTicket?: (t: StaffWorkTicket) => void;
}

export function StaffMyTicketsList({
  tickets, loading, onEditTicket, onPrintTicket, onCoordTicket, onDeleteTicket, onSubmitTicket, onViewTicket
}: StaffMyTicketsListProps) {
  const getBadge = (ticket: StaffWorkTicket) => {
    const c = toCanonicalStatus(ticket.status);
    switch (c) {
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

  return (
    <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#004776]">
            Phiếu của tôi ({tickets.length})
          </h2>
          <p className="text-xs text-[#64748b]">
            Quản lý, nộp phiếu và theo dõi trạng thái phê duyệt của đơn vị.
          </p>
        </div>
      </div>

      <div className="divide-y divide-[#f1f5f9]">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#64748b]">Đang tải danh sách phiếu...</div>
        ) : tickets.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#64748b]">
            Bạn chưa có phiếu công việc nào trong danh sách. Hãy điền thông tin và bấm &quot;Lưu nháp&quot; hoặc &quot;Lưu và nộp&quot;.
          </div>
        ) : (
          tickets.map((t) => {
            const hours = Math.round((((t.soSpNam * t.phutThucTe) / 60) + t.gioBoSung) * 10) / 10;
            const canonical = toCanonicalStatus(t.status);
            const badge = getBadge(t);
            const StatusIcon = badge.icon;
            const canEdit = canonical === 'draft' || canonical === 'changes_requested';
            const canDelete = canonical === 'draft';
            const canSubmit = canonical === 'draft';
            const canResubmit = canonical === 'changes_requested';

            return (
              <div key={t.id} className="p-4 hover:bg-[#f8fbff] transition-colors space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#0072BC] bg-[#eef5ff] px-2 py-0.5 rounded-md">
                        {t.maCongViec}
                      </span>
                      <span className="text-xs font-semibold text-[#475569] bg-[#f1f5f9] px-2 py-0.5 rounded-md">
                        VTVL: {t.maVtvl}
                      </span>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                        <StatusIcon className="w-3 h-3" />
                        {badge.label}
                      </span>
                      {t.isMergedToB1B2 && (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          Đã gộp B1/B2
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-[#004776]">{t.tenCongViec}</div>

                    {/* Hiển thị lý do yêu cầu bổ sung nếu có */}
                    {t.revisionReason && canonical === 'changes_requested' && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong>Yêu cầu chỉnh sửa: </strong>{t.revisionReason}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-[#64748b]">
                      Sản lượng: <strong>{t.soSpNam}</strong> SP • Thời gian: <strong>{t.phutThucTe}</strong> phút/SP • Tổng: <strong>{hours}</strong> giờ/năm
                      {t.coordinatedTasks && t.coordinatedTasks.length > 0 && (
                        <span className="ml-2 text-[#0072BC] font-medium">• {t.coordinatedTasks.length} công việc phối hợp</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEditTicket(t)}
                      className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#0072BC]" /> Sửa
                    </button>
                  )}

                  {canSubmit && onSubmitTicket && (
                    <button
                      type="button"
                      onClick={() => onSubmitTicket(t, false)}
                      className="h-8 px-2.5 rounded-lg bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Send className="w-3.5 h-3.5" /> Nộp phiếu
                    </button>
                  )}

                  {canResubmit && onSubmitTicket && (
                    <button
                      type="button"
                      onClick={() => onSubmitTicket(t, true)}
                      className="h-8 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Nộp lại
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onViewTicket ? onViewTicket(t) : onPrintTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#0072BC]" /> Xem chi tiết
                  </button>

                  <button
                    type="button"
                    onClick={() => onPrintTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#0072BC]" /> In PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => onCoordTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5 text-[#0072BC]" /> Phối hợp
                  </button>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteTicket(t)}
                      className="h-8 px-2.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-medium text-red-600 inline-flex items-center gap-1 cursor-pointer ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
