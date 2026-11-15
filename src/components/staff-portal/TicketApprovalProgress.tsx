'use client';

import React from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileEdit,
  Send,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { StaffWorkTicket, CanonicalTicketStatus, toCanonicalStatus } from '@/types/staff-ticket';

export interface TicketStatusMeta {
  canonical: CanonicalTicketStatus;
  label: string;
  pillCls: string;
  stripeCls: string;
  dotCls: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const STATUS_META_MAP: Record<CanonicalTicketStatus, Omit<TicketStatusMeta, 'canonical'>> = {
  approved: {
    label: 'Đã duyệt',
    pillCls: 'bg-[#e6f9f1] text-[#008f5d] border-[#a7f3d0]',
    stripeCls: 'bg-[#00b87a]',
    dotCls: 'bg-[#00b87a]',
    Icon: CheckCircle2
  },
  changes_requested: {
    label: 'Yêu cầu bổ sung',
    pillCls: 'bg-[#fff8eb] text-[#b45309] border-[#fcd34d]',
    stripeCls: 'bg-[#f99c00]',
    dotCls: 'bg-[#f99c00]',
    Icon: AlertTriangle
  },
  resubmitted: {
    label: 'Đã nộp lại',
    pillCls: 'bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]',
    stripeCls: 'bg-[#7c3aed]',
    dotCls: 'bg-[#7c3aed]',
    Icon: RefreshCw
  },
  submitted: {
    label: 'Đã nộp',
    pillCls: 'bg-[#eef5ff] text-[#006cee] border-[#bfdbfe]',
    stripeCls: 'bg-[#006cee]',
    dotCls: 'bg-[#006cee]',
    Icon: Clock
  },
  draft: {
    label: 'Nháp',
    pillCls: 'bg-[#f1f6fc] text-[#20446c] border-[#cbd5e1]',
    stripeCls: 'bg-[#94b2d0]',
    dotCls: 'bg-[#94b2d0]',
    Icon: Clock
  }
};

/**
 * Chuẩn hóa metadata hiển thị trạng thái phê duyệt theo bảng màu HCM-UTE S-Link V2.
 */
export function getTicketStatusMeta(ticket: StaffWorkTicket): TicketStatusMeta {
  const canonical = toCanonicalStatus(ticket.status);
  return { canonical, ...STATUS_META_MAP[canonical] };
}

type StepState = 'done' | 'active' | 'warning' | 'upcoming';

interface ProgressStep {
  key: string;
  num: number;
  label: string;
  sub: string;
  state: StepState;
  Icon: React.ComponentType<{ className?: string }>;
}

function formatShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function buildApprovalSteps(ticket: StaffWorkTicket): ProgressStep[] {
  const canonical = toCanonicalStatus(ticket.status);
  const version = ticket.currentVersionNo || 0;
  const isResubmitFlow = canonical === 'resubmitted' || version > 1;
  const isApproved = canonical === 'approved';
  const isMerged = Boolean(isApproved && ticket.isMergedToB1B2);

  const step1: ProgressStep = {
    key: 'declare',
    num: 1,
    label: 'Kê khai',
    sub: canonical === 'draft' ? 'Đang soạn' : formatShortDate(ticket.createdAt) || 'Hoàn tất',
    state: canonical === 'draft' ? 'active' : 'done',
    Icon: FileEdit
  };

  const step2Label = isResubmitFlow ? `Nộp lại${version > 1 ? ` v${version}` : ''}` : 'Gửi duyệt';
  const step2Sub =
    canonical === 'draft'
      ? 'Chưa gửi'
      : formatShortDate(ticket.resubmittedAt || ticket.submittedAt) || 'Đã gửi';
  const step2: ProgressStep = {
    key: 'submit',
    num: 2,
    label: step2Label,
    sub: step2Sub,
    state: canonical === 'draft' ? 'upcoming' : 'done',
    Icon: isResubmitFlow ? RefreshCw : Send
  };

  let step3State: StepState = 'upcoming';
  let step3Label = 'Phê duyệt';
  let step3Sub = 'Chờ bước trước';
  let step3Icon: React.ComponentType<{ className?: string }> = ShieldCheck;

  if (canonical === 'submitted' || canonical === 'resubmitted') {
    step3State = 'active';
    step3Label = 'Chờ duyệt';
    step3Sub = 'Đơn vị xét';
    step3Icon = Clock;
  } else if (canonical === 'changes_requested') {
    step3State = 'warning';
    step3Label = 'Cần bổ sung';
    step3Sub = formatShortDate(ticket.revisionRequestedAt) || 'Chỉnh sửa';
    step3Icon = AlertTriangle;
  } else if (isApproved) {
    step3State = 'done';
    step3Label = 'Đã duyệt';
    step3Sub = formatShortDate(ticket.approvedAt) || 'Đạt chuẩn';
    step3Icon = CheckCircle2;
  }

  const step3: ProgressStep = {
    key: 'approve',
    num: 3,
    label: step3Label,
    sub: step3Sub,
    state: step3State,
    Icon: step3Icon
  };

  const step4: ProgressStep = {
    key: 'merge',
    num: 4,
    label: isMerged ? 'Đã gộp' : 'Gộp B1/B2',
    sub: isMerged ? formatShortDate(ticket.mergedAt) || 'Đồng bộ' : isApproved ? 'Sẵn sàng' : 'Sau duyệt',
    state: isMerged ? 'done' : isApproved ? 'active' : 'upcoming',
    Icon: Layers
  };

  return [step1, step2, step3, step4];
}

const NODE_STYLE: Record<StepState, string> = {
  done: 'bg-[#00b87a] text-white border-[#00b87a] shadow-2xs',
  active: 'bg-[#006cee] text-white border-[#006cee] ring-4 ring-[#006cee]/15 shadow-xs',
  warning: 'bg-[#f99c00] text-white border-[#f99c00] ring-4 ring-[#f99c00]/20 shadow-xs',
  upcoming: 'bg-white text-[#20446c]/60 border-[#cbd5e1]'
};

const LABEL_STYLE: Record<StepState, string> = {
  done: 'text-[#008f5d]',
  active: 'text-[#006cee]',
  warning: 'text-[#b45309]',
  upcoming: 'text-[#20446c]/70'
};

interface TicketApprovalProgressProps {
  ticket: StaffWorkTicket;
  variant?: 'compact' | 'banner';
}

/**
 * Thanh tiến trình phê duyệt 4 bước trực quan theo chuẩn HCM-UTE S-Link V2.
 */
export function TicketApprovalProgress({ ticket, variant = 'compact' }: TicketApprovalProgressProps) {
  const steps = buildApprovalSteps(ticket);
  const isBanner = variant === 'banner';

  return (
    <div
      className={`w-full rounded-xl border border-[#dbe8f5] bg-gradient-to-r from-[#f8fbff] via-[#f5f9ff] to-[#eef5ff] ${
        isBanner ? 'px-4 py-3 shadow-2xs' : 'px-2.5 py-2'
      }`}
    >
      <div className="grid grid-cols-4 items-start">
        {steps.map((step, idx) => {
          const prevDone = idx > 0 && steps[idx - 1].state === 'done';
          const currDoneOrActive = step.state === 'done' || step.state === 'active' || step.state === 'warning';
          const leftLineColor =
            prevDone && step.state === 'warning'
              ? 'bg-[#f99c00]'
              : prevDone && currDoneOrActive
                ? 'bg-[#00b87a]'
                : 'bg-[#d5e3f2]';

          const nextState = idx < steps.length - 1 ? steps[idx + 1].state : 'upcoming';
          const rightLineColor =
            step.state === 'done' && nextState === 'warning'
              ? 'bg-[#f99c00]'
              : step.state === 'done' && (nextState === 'done' || nextState === 'active')
                ? 'bg-[#00b87a]'
                : 'bg-[#d5e3f2]';

          const StepIcon = step.Icon;

          return (
            <div key={step.key} className="relative flex flex-col items-center text-center px-0.5">
              {idx > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-0 right-1/2 ${isBanner ? 'top-3.5' : 'top-3'} h-[2px] -translate-y-1/2 ${leftLineColor}`}
                />
              )}
              {idx < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 right-0 ${isBanner ? 'top-3.5' : 'top-3'} h-[2px] -translate-y-1/2 ${rightLineColor}`}
                />
              )}

              <div
                className={`relative z-10 flex items-center justify-center rounded-full border transition-all ${
                  isBanner ? 'w-7 h-7' : 'w-6 h-6'
                } ${NODE_STYLE[step.state]}`}
              >
                {step.state === 'done' ? (
                  <Check className={isBanner ? 'w-3.5 h-3.5 stroke-[2.5]' : 'w-3 h-3 stroke-[2.5]'} />
                ) : step.state === 'upcoming' ? (
                  <span className="text-[10px] font-bold tabular-nums">{step.num}</span>
                ) : (
                  <StepIcon className={isBanner ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
                )}
              </div>

              <div
                className={`mt-1.5 font-bold leading-tight ${
                  isBanner ? 'text-[11px]' : 'text-[10.5px]'
                } ${LABEL_STYLE[step.state]}`}
              >
                {step.label}
              </div>
              <div
                className={`mt-0.5 leading-tight text-[#20446c]/75 tabular-nums truncate max-w-full ${
                  isBanner ? 'text-[10px]' : 'text-[9.5px]'
                }`}
              >
                {step.sub}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
