'use client';

import React from 'react';
import {
  Edit3,
  Trash2,
  Eye,
  Printer,
  Link2,
  AlertTriangle,
  RefreshCw,
  Send
} from 'lucide-react';
import { StaffWorkTicket } from '@/types/staff-ticket';
import { getTicketCoordinatedVtvlBadges } from '@/services/tickets/vtvl-coordination-helpers';
import { TicketApprovalProgress, getTicketStatusMeta } from './TicketApprovalProgress';
import { formatApprovalDateTime } from './TicketApprovalHistoryTimeline';
import { TicketListSkeleton } from '@/components/ui/Skeleton';

interface StaffMyTicketsListProps {
  title?: string;
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
  title = 'Phiếu của tôi',
  tickets,
  loading,
  onEditTicket,
  onPrintTicket,
  onCoordTicket,
  onDeleteTicket,
  onSubmitTicket,
  onViewTicket
}: StaffMyTicketsListProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#dbe8f5] shadow-[0_2px_14px_-4px_rgba(0,71,118,0.06)] overflow-hidden">
      <div className="px-5 py-3.5 bg-[#fafcff] border-b border-[#e8eff7] flex items-center justify-between">
        <h2 className="text-base font-bold text-[#004776]">
          {title} ({tickets.length})
        </h2>
      </div>

      <div className="divide-y divide-[#eef3f8]">
        {loading && tickets.length === 0 ? (
          <TicketListSkeleton rows={3} />
        ) : tickets.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#20446c]">
            Bạn chưa có phiếu công việc nào trong danh sách. Hãy điền thông tin và bấm &quot;Lưu nháp&quot; hoặc &quot;Lưu và nộp&quot;.
          </div>
        ) : (
          tickets.map((t) => {
            const hours = Math.round((((t.soSpNam * t.phutThucTe) / 60) + t.gioBoSung) * 10) / 10;
            const meta = getTicketStatusMeta(t);
            const StatusIcon = meta.Icon;
            const canonical = meta.canonical;
            const coordBadges = getTicketCoordinatedVtvlBadges(t);
            const canEdit = !t.isMergedToB1B2 && (canonical === 'draft' || canonical === 'submitted' || canonical === 'resubmitted' || canonical === 'changes_requested');
            const canDelete = canonical === 'draft';
            const canSubmit = canonical === 'draft';
            const canResubmit = canonical === 'changes_requested';

            return (
              <div key={t.id} className="relative pl-4 sm:pl-5 pr-4 py-4 hover:bg-[#f8fbff]/80 transition-colors space-y-3">
                <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${meta.stripeCls}`} />

                {/* Hàng đầu: Mã công việc bên trái — Trạng thái phê duyệt bên phải */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="text-xs font-mono font-bold text-[#006cee] bg-[#eef5ff] border border-[#cfe2fc] px-2.5 py-0.5 rounded-md tabular-nums">
                      {t.maCongViec}
                    </span>
                    <span className="text-xs font-semibold text-[#004776] bg-[#f1f6fc] border border-[#dbe8f5] px-2.5 py-0.5 rounded-md">
                      VTVL: {t.maVtvl}
                    </span>
                    {(t.currentVersionNo || 0) > 0 && (
                      <span className="text-[11px] font-bold text-[#004776] bg-white border border-[#cbd5e1] px-2 py-0.5 rounded-md tabular-nums">
                        v{t.currentVersionNo}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${meta.pillCls}`}>
                      <StatusIcon className="w-3 h-3" />
                      {meta.label}
                    </span>
                    {t.isMergedToB1B2 && (
                      <span className="text-[11px] font-bold text-[#008f5d] bg-[#e6f9f1] px-2.5 py-0.5 rounded-full border border-[#a7f3d0]">
                        Đã gộp B1/B2
                      </span>
                    )}
                  </div>
                </div>

                {/* Tiêu đề & Chỉ số định mức */}
                <div className="space-y-2">
                  <div className="text-sm sm:text-[15px] font-bold text-[#004776] leading-snug">
                    {t.tenCongViec}
                  </div>
                  {t.updatedAt && (
                    <div className="text-[11px] text-[#20446c] tabular-nums">
                      Cập nhật gần nhất: <strong className="text-[#004776]">{formatApprovalDateTime(t.updatedAt)}</strong>
                    </div>
                  )}

                  {t.revisionReason && canonical === 'changes_requested' && (
                    <div className="p-2.5 rounded-lg bg-[#fff8eb] border-l-2 border-[#f99c00] text-xs text-[#004776] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#f99c00] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-[#b45309]">Yêu cầu chỉnh sửa: </strong>{t.revisionReason}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                    <span className="px-2 py-0.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0] text-[#20446c]">
                      Sản lượng: <strong className="text-[#004776]">{t.soSpNam}</strong> SP
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0] text-[#20446c]">
                      Thời gian: <strong className="text-[#004776]">{t.phutThucTe}</strong> phút/SP
                    </span>
                    {t.gioBoSung > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-[#f8fafc] border border-[#e2e8f0] text-[#20446c]">
                        Bổ sung: <strong className="text-[#004776]">+{t.gioBoSung}</strong> giờ
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-[#eef5ff] border border-[#cfe2fc] text-[#004776] font-semibold">
                      Tổng: <strong className="text-[#006cee]">{hours}</strong> giờ/năm
                    </span>
                    {t.coordinatedTasks && t.coordinatedTasks.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#f1f6fc] border border-[#dbe8f5] text-[#006cee] font-medium">
                        <Link2 className="w-3 h-3" /> {t.coordinatedTasks.length} công việc phối hợp
                      </span>
                    )}
                  </div>
                  {coordBadges.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {coordBadges.map((b) => (
                        <span key={b.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eef5ff] border border-[#bfdbfe] text-[#004776] font-medium">
                          <Link2 className="w-3 h-3 text-[#006cee] shrink-0" />
                          <span>Phối hợp: <strong>{b.label}</strong>{b.note ? ` (${b.note})` : ''}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Thanh tiến trình phê duyệt 4 bước */}
                <TicketApprovalProgress ticket={t} />

                {/* Nghiệp vụ thao tác căn phải */}
                <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-[#eef3f8]">
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteTicket(t)}
                      className="h-8 px-2.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-medium text-[#f4212e] inline-flex items-center gap-1 cursor-pointer mr-auto transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => (onViewTicket ? onViewTicket(t) : onPrintTicket(t))}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#006cee]" /> Xem chi tiết
                  </button>

                  <button
                    type="button"
                    onClick={() => onPrintTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#006cee]" /> In PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => onCoordTicket(t)}
                    className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5 text-[#006cee]" /> Phối hợp
                  </button>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onEditTicket(t)}
                      className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#006cee]" /> Chỉnh sửa
                    </button>
                  )}

                  {canSubmit && onSubmitTicket && (
                    <button
                      type="button"
                      onClick={() => onSubmitTicket(t, false)}
                      className="h-8 px-3 rounded-lg bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" /> Nộp phiếu
                    </button>
                  )}

                  {canResubmit && onSubmitTicket && (
                    <button
                      type="button"
                      onClick={() => onSubmitTicket(t, true)}
                      className="h-8 px-3 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Nộp lại
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
