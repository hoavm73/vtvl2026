'use client';

import React from 'react';
import {
  FileEdit,
  Send,
  SearchCheck,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { REVIEW_STATUS_LABELS, WorkbookReviewStatus } from '@/services/workbooks/workbook-history-service';

export interface WorkbookReviewProgressStepperProps {
  status?: string | null;
  statusLabel?: string | null;
  submittedBy?: string | null;
  submittedAt?: string | null;
  reviewerEmail?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  loading?: boolean;
}

type StepVisualState = 'done' | 'active' | 'warning' | 'locked' | 'upcoming';

function normalizeStatus(raw?: string | null): WorkbookReviewStatus {
  const valid: WorkbookReviewStatus[] = [
    'chua_gui',
    'cho_tham_dinh',
    'dang_tham_dinh',
    'can_bo_sung',
    'da_gui_lai',
    'dat_yeu_cau',
    'da_khoa'
  ];
  return valid.includes(raw as WorkbookReviewStatus) ? (raw as WorkbookReviewStatus) : 'chua_gui';
}

function getStepStates(status: WorkbookReviewStatus): StepVisualState[] {
  switch (status) {
    case 'chua_gui':
      return ['active', 'upcoming', 'upcoming', 'upcoming'];
    case 'cho_tham_dinh':
    case 'da_gui_lai':
      return ['done', 'active', 'upcoming', 'upcoming'];
    case 'dang_tham_dinh':
      return ['done', 'done', 'active', 'upcoming'];
    case 'can_bo_sung':
      return ['done', 'done', 'warning', 'upcoming'];
    case 'dat_yeu_cau':
    case 'da_khoa':
      return ['done', 'done', 'done', 'locked'];
    default:
      return ['active', 'upcoming', 'upcoming', 'upcoming'];
  }
}

export function WorkbookReviewProgressStepper({
  status,
  statusLabel,
  submittedBy,
  submittedAt,
  reviewerEmail,
  reviewedAt,
  reviewNote,
  loading
}: WorkbookReviewProgressStepperProps) {
  const norm = normalizeStatus(status);
  const states = getStepStates(norm);
  const isLocked = norm === 'dat_yeu_cau' || norm === 'da_khoa';
  const isNeedsRevision = norm === 'can_bo_sung';
  const badgeLabel = statusLabel || REVIEW_STATUS_LABELS[norm] || 'Chưa gửi';

  const steps = [
    {
      num: 1,
      title: 'Hoàn thiện hồ sơ',
      desc: 'Đơn vị kê khai 10 biểu',
      icon: FileEdit
    },
    {
      num: 2,
      title: norm === 'da_gui_lai' ? 'Đã gửi lại TCNS' : 'Đã gửi TCNS',
      desc: 'Chờ Phòng TCNS tiếp nhận',
      icon: Send
    },
    {
      num: 3,
      title: isNeedsRevision ? 'Cần bổ sung' : 'Đang thẩm định',
      desc: isNeedsRevision ? 'Đơn vị chỉnh sửa theo góp ý' : 'Phòng TCNS rà soát 9 biểu',
      icon: isNeedsRevision ? AlertTriangle : SearchCheck
    },
    {
      num: 4,
      title: 'Đạt thẩm định & khóa hồ sơ',
      desc: 'Chốt số liệu, khóa chỉnh sửa',
      icon: isLocked ? Lock : CheckCircle2
    }
  ];

  const badgeStyle = isLocked
    ? 'bg-[#ecfdf5] text-[#13653f] border-[#a7f3d0]'
    : isNeedsRevision
      ? 'bg-[#fffbeb] text-[#b45309] border-[#fcd34d]'
      : norm === 'chua_gui'
        ? 'bg-[#f1f5f9] text-[#476885] border-[#cbd5e1]'
        : 'bg-[#eef5ff] text-[#006cee] border-[#bfdbfe]';

  return (
    <section
      aria-label="Tiến độ thẩm định hồ sơ đơn vị"
      className="rounded-[12px] border border-[#e2e8f0] bg-white px-4 py-3.5 space-y-3 print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#0072BC]">Tiến độ thẩm định hồ sơ</span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${badgeStyle}`}>
            {isLocked && <Lock className="w-3 h-3" />}
            {isNeedsRevision && <AlertTriangle className="w-3 h-3" />}
            <span>{loading && !status ? 'Đang tải…' : badgeLabel}</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#476885]">
          {submittedBy && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#64748b]" />
              <span>Gửi: <strong className="font-semibold text-[#004776]">{submittedBy}</strong>{submittedAt ? ` (${submittedAt})` : ''}</span>
            </span>
          )}
          {reviewerEmail && (
            <span>
              Thẩm định: <strong className="font-semibold text-[#004776]">{reviewerEmail}</strong>{reviewedAt ? ` (${reviewedAt})` : ''}
            </span>
          )}
        </div>
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {steps.map((step, idx) => {
          const state = states[idx];
          const Icon = step.icon;
          const cardCls =
            state === 'locked'
              ? 'border-[#86efac] bg-[#ecfdf5]/80'
              : state === 'warning'
                ? 'border-[#fcd34d] bg-[#fffbeb]'
                : state === 'active'
                  ? 'border-[#93c5fd] bg-[#eef5ff]/75'
                  : state === 'done'
                    ? 'border-[#cbd5e1] bg-[#f8fafc]'
                    : 'border-[#e2e8f0] bg-white opacity-75';

          const iconWrapCls =
            state === 'locked'
              ? 'bg-[#13653f] text-white'
              : state === 'warning'
                ? 'bg-[#d97706] text-white'
                : state === 'active'
                  ? 'bg-[#006cee] text-white'
                  : state === 'done'
                    ? 'bg-[#0072BC] text-white'
                    : 'bg-[#e2e8f0] text-[#476885]';

          return (
            <li
              key={step.num}
              aria-current={state === 'active' || state === 'warning' || state === 'locked' ? 'step' : undefined}
              className={`flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 transition-colors ${cardCls}`}
            >
              <span className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${iconWrapCls}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-[#476885]">Bước {step.num}/4</div>
                <div className="text-xs font-bold text-[#004776] leading-snug">{step.title}</div>
                <div className="text-[11px] text-[#476885] leading-snug">{step.desc}</div>
              </div>
            </li>
          );
        })}
      </ol>

      {isLocked && (
        <div role="status" className="flex items-start gap-2 rounded-[8px] border border-[#a7f3d0] bg-[#ecfdf5] px-3 py-2 text-xs text-[#13653f]">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Hồ sơ đơn vị đã đạt thẩm định và được khóa chỉnh sửa.</strong> Toàn bộ bảng tính 10 biểu và phiếu công việc của đơn vị đang ở chế độ chỉ đọc. Liên hệ Phòng Tổ chức – Nhân sự bấm <em>Mở lại hồ sơ</em> nếu cần điều chỉnh bổ sung.
          </span>
        </div>
      )}

      {isNeedsRevision && reviewNote && (
        <div role="alert" className="flex items-start gap-2 rounded-[8px] border border-[#fcd34d] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Yêu cầu bổ sung từ Phòng TCNS:</strong> {reviewNote}
          </span>
        </div>
      )}
    </section>
  );
}
