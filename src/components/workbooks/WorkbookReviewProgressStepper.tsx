'use client';

import React from 'react';
import {
  FileEdit,
  Send,
  SearchCheck,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Clock,
  ShieldCheck
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
      title: 'Đạt thẩm định & khóa',
      desc: 'Chốt số liệu, khóa chỉnh sửa',
      icon: isLocked ? Lock : CheckCircle2
    }
  ];

  const badgeStyle = isLocked
    ? 'bg-[#e8fbf2] text-[#13653f] border-[#a7f3d0]'
    : isNeedsRevision
      ? 'bg-[#fff6e5] text-[#8f4f00] border-[#fcd34d]'
      : norm === 'chua_gui'
        ? 'bg-[#f1f5f9] text-[#476885] border-[#cbd5e1]'
        : 'bg-[#eef5ff] text-[#006cee] border-[#bfdbfe]';

  return (
    <section aria-label="Tiến độ thẩm định hồ sơ đơn vị" className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#006cee] shrink-0" />
          <span className="text-xs sm:text-sm font-bold text-[#0072BC]">Tiến độ thẩm định hồ sơ đơn vị</span>
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

      {/* Dải 4 khối phẳng ngăn bằng divider, nền gradient pastel đồng bộ với Các con số trọng yếu */}
      <ol className="border-y border-[#e2e8f0] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x divide-[#e2e8f0]">
        {steps.map((step, idx) => {
          const state = states[idx];
          const Icon = step.icon;
          const cellBg =
            state === 'locked'
              ? 'bg-gradient-to-br from-[#e8fbf2] via-[#f3fcf8] to-white'
              : state === 'warning'
                ? 'bg-gradient-to-br from-[#fff6e5] via-[#fffaf0] to-white'
                : state === 'active'
                  ? 'bg-gradient-to-br from-[#eef6ff] via-[#f5f9ff] to-white'
                  : state === 'done'
                    ? 'bg-gradient-to-br from-[#ecfeff]/85 via-[#f2f9ff] to-white'
                    : 'bg-gradient-to-br from-[#f8fafc] via-white to-white opacity-80';

          const stepLabelCls =
            state === 'locked'
              ? 'text-[#13653f]'
              : state === 'warning'
                ? 'text-[#8f4f00]'
                : state === 'active'
                  ? 'text-[#006cee]'
                  : state === 'done'
                    ? 'text-[#0072BC]'
                    : 'text-[#476885]';

          const titleCls =
            state === 'locked'
              ? 'text-[#13653f]'
              : state === 'warning'
                ? 'text-[#8f4f00]'
                : 'text-[#004776]';

          const iconCls =
            state === 'locked'
              ? 'text-[#13653f]'
              : state === 'warning'
                ? 'text-[#8f4f00]'
                : state === 'active'
                  ? 'text-[#006cee]'
                  : state === 'done'
                    ? 'text-[#0072BC]'
                    : 'text-[#94a3b8]';

          return (
            <li
              key={step.num}
              aria-current={state === 'active' || state === 'warning' || state === 'locked' ? 'step' : undefined}
              className={`p-3.5 sm:p-4 space-y-1 transition-colors ${cellBg}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold ${stepLabelCls}`}>
                  Bước {step.num}/4 {state === 'done' ? '· Đã qua' : state === 'active' ? '· Hiện tại' : state === 'locked' ? '· Đã khóa' : state === 'warning' ? '· Cần sửa' : ''}
                </span>
                <Icon className={`w-4 h-4 shrink-0 ${iconCls}`} />
              </div>
              <div className={`text-sm font-extrabold tracking-tight leading-snug ${titleCls}`}>
                {step.title}
              </div>
              <p className="text-[11px] text-[#476885] leading-snug">{step.desc}</p>
            </li>
          );
        })}
      </ol>

      {isLocked && (
        <div role="status" className="flex items-start gap-2 rounded-[8px] border border-[#a7f3d0] bg-[#e8fbf2] px-3.5 py-2.5 text-xs text-[#13653f]">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Hồ sơ đơn vị đã đạt thẩm định và được khóa chỉnh sửa.</strong> Toàn bộ bảng tính 10 biểu và phiếu công việc của đơn vị đang ở chế độ chỉ đọc. Liên hệ Phòng Tổ chức – Nhân sự bấm <em>Mở lại hồ sơ</em> nếu cần điều chỉnh bổ sung.
          </span>
        </div>
      )}

      {isNeedsRevision && reviewNote && (
        <div role="alert" className="flex items-start gap-2 rounded-[8px] border border-[#fcd34d] bg-[#fff6e5] px-3.5 py-2.5 text-xs text-[#8f4f00]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Yêu cầu bổ sung từ Phòng TCNS:</strong> {reviewNote}
          </span>
        </div>
      )}
    </section>
  );
}
