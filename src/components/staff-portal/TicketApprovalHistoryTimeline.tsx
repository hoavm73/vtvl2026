'use client';

import React from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Clock,
  History,
  ChevronDown,
  ChevronUp,
  UserCheck
} from 'lucide-react';
import { StaffWorkTicket, toCanonicalStatus } from '@/types/staff-ticket';

export type ApprovalActionType =
  | 'SUBMIT'
  | 'UPDATE_PENDING'
  | 'CHANGE_MISSION_CODE'
  | 'REQUEST_CHANGES'
  | 'RESUBMIT'
  | 'APPROVE'
  | 'MERGE_TO_SHEETS'
  | 'REVOKE_APPROVAL'
  | 'CANCEL_TICKET';

export interface ApprovalTimelineEvent {
  id: string;
  action: ApprovalActionType;
  label: string;
  actorEmail: string;
  actorName?: string;
  actorRoleLabel: string;
  reason?: string;
  timestampIso: string;
}

const ACTION_META: Record<ApprovalActionType, { label: string; dotCls: string; badgeCls: string; boxCls: string }> = {
  SUBMIT: { label: 'Nộp phiếu khảo sát', dotCls: 'bg-[#006cee] ring-[#e6f1ff]', badgeCls: 'bg-[#eef5ff] text-[#006cee]', boxCls: 'bg-[#f4f9ff] border-[#cfe2fc]' },
  UPDATE_PENDING: { label: 'Cập nhật phiếu sau khi gửi duyệt', dotCls: 'bg-[#006cee] ring-[#e6f1ff]', badgeCls: 'bg-[#eef5ff] text-[#006cee]', boxCls: 'bg-[#f4f9ff] border-[#cfe2fc]' },
  CHANGE_MISSION_CODE: { label: 'Đổi Mã nhiệm vụ & cấp lại Mã công việc', dotCls: 'bg-[#0072BC] ring-[#e6f1ff]', badgeCls: 'bg-[#eef5ff] text-[#0072BC]', boxCls: 'bg-[#f4f9ff] border-[#cfe2fc]' },
  REQUEST_CHANGES: { label: 'Yêu cầu bổ sung / phản hồi', dotCls: 'bg-[#f99c00] ring-[#fff4e5]', badgeCls: 'bg-[#fff8eb] text-[#b45309]', boxCls: 'bg-[#fff8eb] border-[#fcd34d]' },
  RESUBMIT: { label: 'Nộp lại sau chỉnh sửa', dotCls: 'bg-[#7c3aed] ring-[#f3e8ff]', badgeCls: 'bg-[#f5f3ff] text-[#6d28d9]', boxCls: 'bg-[#f5f3ff] border-[#ddd6fe]' },
  APPROVE: { label: 'Phê duyệt phiếu', dotCls: 'bg-[#00b87a] ring-[#e6f9f1]', badgeCls: 'bg-[#e6f9f1] text-[#008f5d]', boxCls: 'bg-[#e6f9f1] border-[#a7f3d0]' },
  MERGE_TO_SHEETS: { label: 'Đưa vào Biểu A2 & B1', dotCls: 'bg-[#008f5d] ring-[#e6f9f1]', badgeCls: 'bg-[#e6f9f1] text-[#008f5d]', boxCls: 'bg-[#f1f9f5] border-[#a7f3d0]' },
  REVOKE_APPROVAL: { label: 'Thu hồi phê duyệt (yêu cầu sửa lại)', dotCls: 'bg-[#d97706] ring-[#fff4e5]', badgeCls: 'bg-[#fff8eb] text-[#b45309]', boxCls: 'bg-[#fff8eb] border-[#fcd34d]' },
  CANCEL_TICKET: { label: 'Hủy / xóa phiếu kê khai sai', dotCls: 'bg-[#e11d48] ring-[#ffe4e6]', badgeCls: 'bg-rose-50 text-rose-700', boxCls: 'bg-rose-50 border-rose-200' }
};

function normalizeActionType(rawAction?: string, toStatus?: string): ApprovalActionType {
  const act = (rawAction || '').toUpperCase().trim();
  if (act === 'CHANGE_MISSION_CODE') return 'CHANGE_MISSION_CODE';
  if (act === 'UPDATE_PENDING') return 'UPDATE_PENDING';
  if (act === 'REVOKE_APPROVAL') return 'REVOKE_APPROVAL';
  if (act === 'CANCEL_TICKET') return 'CANCEL_TICKET';
  if (act === 'APPROVE') return 'APPROVE';
  if (act === 'REQUEST_CHANGES' || act === 'CHANGES_REQUESTED' || act === 'RETURN') return 'REQUEST_CHANGES';
  if (act === 'RESUBMIT') return 'RESUBMIT';
  if (act === 'MERGE_TO_SHEETS' || act === 'MERGE') return 'MERGE_TO_SHEETS';
  if (act === 'SUBMIT') return 'SUBMIT';
  const canon = toCanonicalStatus(toStatus);
  if (canon === 'approved') return 'APPROVE';
  if (canon === 'changes_requested') return 'REQUEST_CHANGES';
  if (canon === 'resubmitted') return 'RESUBMIT';
  return 'SUBMIT';
}

function getRoleLabel(role?: string): string {
  if (role === 'admin') return 'Quản trị viên TCNS';
  if (role === 'unit_leader') return 'Lãnh đạo đơn vị';
  return 'Cán bộ kê khai';
}

export function formatApprovalDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hhmm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${hhmm} · ${d.toLocaleDateString('vi-VN')}`;
}

/** Tổng hợp dòng thời gian phê duyệt & phản hồi kèm người thực hiện, vai trò, lý do và thời gian. */
export function buildDisplayApprovalEvents(ticket: StaffWorkTicket): ApprovalTimelineEvent[] {
  const events: ApprovalTimelineEvent[] = [];
  const ownerLower = (ticket.ownerEmail || '').toLowerCase().trim();

  for (const h of ticket.statusHistory || []) {
    const action = normalizeActionType(h.action, h.toStatus);
    const email = (h.actorId || '').toLowerCase().trim();
    events.push({
      id: h.id,
      action,
      label: ACTION_META[action].label,
      actorEmail: email,
      actorName: h.actorName || (email && email === ownerLower ? ticket.ownerName : undefined),
      actorRoleLabel: getRoleLabel(h.actorRole),
      reason: h.reason,
      timestampIso: h.createdAt
    });
  }

  const hasAction = (act: ApprovalActionType) => events.some((e) => e.action === act);
  const fallbacks: Array<[ApprovalActionType, string | undefined, string, string | undefined, string, string | undefined]> = [
    ['SUBMIT', ticket.submittedAt, ticket.ownerEmail, ticket.ownerName, 'Cán bộ kê khai', undefined],
    ['REQUEST_CHANGES', ticket.revisionRequestedAt, ticket.revisionRequestedBy || '', ticket.revisionRequestedByName, 'Lãnh đạo đơn vị', ticket.revisionReason],
    ['RESUBMIT', ticket.resubmittedAt, ticket.ownerEmail, ticket.ownerName, 'Cán bộ kê khai', ticket.lastChangeSummary],
    ['APPROVE', ticket.approvedAt, ticket.approvedBy || '', ticket.approvedByName, 'Lãnh đạo đơn vị', undefined],
    ['MERGE_TO_SHEETS', ticket.isMergedToB1B2 ? ticket.mergedAt : undefined, ticket.mergedBy || '', ticket.mergedByName, 'Lãnh đạo đơn vị', undefined]
  ];

  for (const [action, timestampIso, actorEmail, actorName, actorRoleLabel, reason] of fallbacks) {
    if (!timestampIso || hasAction(action)) continue;
    events.push({
      id: `fallback-${action.toLowerCase()}-${ticket.id}`,
      action,
      label: ACTION_META[action].label,
      actorEmail,
      actorName,
      actorRoleLabel,
      reason,
      timestampIso
    });
  }

  return events.sort((a, b) => (a.timestampIso || '').localeCompare(b.timestampIso || ''));
}

export function TicketApprovalSummaryStrip({
  ticket,
  events,
  expanded,
  onToggle
}: {
  ticket: StaffWorkTicket;
  events: ApprovalTimelineEvent[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const canonical = toCanonicalStatus(ticket.status);
  const approverLabel = ticket.approvedByName || ticket.approvedBy || 'Lãnh đạo đơn vị';
  const reviewerLabel = ticket.revisionRequestedByName || ticket.revisionRequestedBy || 'Lãnh đạo đơn vị';
  const mergerLabel = ticket.mergedByName || ticket.mergedBy;

  return (
    <div className="mt-2 pt-2 border-t border-[#dbe8f5]/80 flex items-start justify-between gap-2 text-[11px] text-[#20446c]">
      <div className="min-w-0 flex-1 space-y-0.5 leading-snug">
        {canonical === 'approved' && (
          <>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <UserCheck className="w-3.5 h-3.5 text-[#00b87a] shrink-0" />
              <span>Người duyệt:</span>
              <strong className="text-[#004776] truncate">{approverLabel}</strong>
              {ticket.approvedAt && <span className="text-[#20446c]/80 tabular-nums">· {formatApprovalDateTime(ticket.approvedAt)}</span>}
            </div>
            {ticket.isMergedToB1B2 && (mergerLabel || ticket.mergedAt) && (
              <div className="flex flex-wrap items-center gap-x-1.5 text-[10.5px] text-[#008f5d] pl-5 tabular-nums">
                <span>Đưa vào Biểu A2 &amp; B1:</span>
                {mergerLabel && <strong className="font-semibold">{mergerLabel}</strong>}
                {ticket.mergedAt && <span>· {formatApprovalDateTime(ticket.mergedAt)}</span>}
              </div>
            )}
          </>
        )}

        {canonical === 'changes_requested' && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <AlertTriangle className="w-3.5 h-3.5 text-[#f99c00] shrink-0" />
            <span>Phản hồi bởi:</span>
            <strong className="text-[#004776] truncate">{reviewerLabel}</strong>
            {ticket.revisionRequestedAt && (
              <span className="text-[#20446c]/80 tabular-nums">· {formatApprovalDateTime(ticket.revisionRequestedAt)}</span>
            )}
          </div>
        )}

        {canonical === 'resubmitted' && (
          <>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <RefreshCw className="w-3.5 h-3.5 text-[#7c3aed] shrink-0" />
              <span>Nộp lại{ticket.currentVersionNo ? ` v${ticket.currentVersionNo}` : ''}:</span>
              <strong className="text-[#004776] truncate">{ticket.ownerName}</strong>
              {ticket.resubmittedAt && <span className="text-[#20446c]/80 tabular-nums">· {formatApprovalDateTime(ticket.resubmittedAt)}</span>}
            </div>
            {(ticket.revisionRequestedByName || ticket.revisionRequestedBy) && (
              <div className="text-[10.5px] text-[#20446c]/80 pl-5 truncate tabular-nums">
                Phản hồi trước: <strong className="text-[#004776]">{reviewerLabel}</strong>
                {ticket.revisionRequestedAt ? ` · ${formatApprovalDateTime(ticket.revisionRequestedAt)}` : ''}
              </div>
            )}
          </>
        )}

        {canonical === 'submitted' && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Clock className="w-3.5 h-3.5 text-[#006cee] shrink-0" />
            <span>Gửi duyệt:</span>
            <strong className="text-[#004776] truncate">{ticket.ownerName}</strong>
            {ticket.submittedAt && <span className="text-[#20446c]/80 tabular-nums">· {formatApprovalDateTime(ticket.submittedAt)}</span>}
          </div>
        )}

        {canonical === 'draft' && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Clock className="w-3.5 h-3.5 text-[#20446c]/70 shrink-0" />
            <span>Người lập:</span>
            <strong className="text-[#004776] truncate">{ticket.ownerName}</strong>
            {ticket.updatedAt && <span className="text-[#20446c]/80 tabular-nums">· {formatApprovalDateTime(ticket.updatedAt)}</span>}
          </div>
        )}
      </div>

      {events.length > 0 && (
        <button
          type="button"
          onClick={onToggle}
          className="shrink-0 h-6 px-2 rounded-full border border-[#cfe2fc] bg-white hover:bg-[#eef5ff] text-[#006cee] text-[10.5px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
        >
          <History className="w-3 h-3" />
          <span>{expanded ? 'Ẩn lịch sử' : `Lịch sử (${events.length})`}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}

export function TicketApprovalHistoryTimeline({ ticket, compact = false }: { ticket: StaffWorkTicket; compact?: boolean }) {
  const events = buildDisplayApprovalEvents(ticket);
  if (events.length === 0) {
    return (
      <div className="py-3 text-center text-xs text-[#20446c]">
        Phiếu đang ở trạng thái Nháp, chưa có mốc lịch sử nộp và phê duyệt.
      </div>
    );
  }

  return (
    <div className={`relative pl-5 ${compact ? 'space-y-2.5 max-h-60 overflow-y-auto pr-1' : 'space-y-4'}`}>
      <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-[#dbe8f5]" />
      {events.map((ev) => {
        const meta = ACTION_META[ev.action];
        const actorDisplay = ev.actorName || ev.actorEmail || ev.actorRoleLabel;
        return (
          <div key={ev.id} className="relative space-y-1 text-left">
            <span className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full ring-4 ${meta.dotCls}`} />
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${meta.badgeCls}`}>
                {ev.label}
              </span>
              <span className="text-[10.5px] text-[#20446c]/80 tabular-nums">{formatApprovalDateTime(ev.timestampIso)}</span>
            </div>
            <div className="text-[11.5px] text-[#20446c] flex flex-wrap items-center gap-x-1.5">
              <strong className="text-[#004776]">{actorDisplay}</strong>
              {ev.actorName && ev.actorEmail && <span className="text-[10.5px] text-[#20446c]/75">({ev.actorEmail})</span>}
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#eef4fb] text-[#20446c]">{ev.actorRoleLabel}</span>
            </div>
            {ev.reason && (
              <div className={`px-2.5 py-1.5 rounded-lg border text-[11px] text-[#004776] whitespace-pre-wrap leading-relaxed ${meta.boxCls}`}>
                {ev.reason}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
