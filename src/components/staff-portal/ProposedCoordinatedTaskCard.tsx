'use client';

import React from 'react';
import { CalendarClock, CheckCircle2, Clock, Eye, FileText, PackageCheck, UserCheck } from 'lucide-react';
import { ProposedCoordinatedTaskItem } from '@/types/staff-ticket';
import { normalizeCode } from '@/services/tickets/vtvl-coordination-helpers';

function formatViDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getStatusBadgeClass(canonical: string): string {
  if (canonical === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (canonical === 'changes_requested') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (canonical === 'resubmitted') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-[#eff8ff] text-[#006cee] border-[#bfdbfe]';
}

interface ProposedCoordinatedTaskCardProps {
  task: ProposedCoordinatedTaskItem;
  selectedVtvl?: string;
  loadingDetail: boolean;
  onOpenDetail: (task: ProposedCoordinatedTaskItem) => void;
}

export function ProposedCoordinatedTaskCard({
  task,
  selectedVtvl,
  loadingDetail,
  onOpenDetail
}: ProposedCoordinatedTaskCardProps) {
  const normSel = normalizeCode(selectedVtvl);
  const matchesSelected = Boolean(normSel && task.matchedVtvls.some((m) => normalizeCode(m.maVtvl) === normSel));
  const isHighlighted = matchesSelected || Boolean(task.isDeclaredByTargetUnit);

  return (
    <div
      className={`p-3.5 rounded-xl transition-all flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 ${
        isHighlighted
          ? 'border-[1.3px] border-[#006cee] bg-[#eef6ff] ring-[1.3px] ring-[#006cee]/15 shadow-xs'
          : 'border border-[#dbeafe] bg-[#fcfdff] hover:border-[#93c5fd]'
      }`}
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-md bg-white border border-[#bfdbfe] text-[#006cee] text-[11px] font-bold">
            {task.maCongViec}
          </span>
          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${getStatusBadgeClass(task.canonicalStatus)}`}>
            {task.sourceStatus}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#20446c] text-[11px] font-bold">
            v{task.versionNo}
          </span>
          {matchesSelected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#006cee] text-white text-[11px] font-bold">
              Đang chọn VTVL: {selectedVtvl}
            </span>
          )}
          {task.isDeclaredByTargetUnit ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold">
              <CheckCircle2 className="w-3 h-3" /> Đã được kê khai ({task.targetDeclaredTicketCode})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-[#cbd5e1] text-[#476885] text-[11px] font-semibold">
              <Clock className="w-3 h-3" /> Chưa kê khai tại đơn vị tôi
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[11px] text-[#476b8e]">
            <CalendarClock className="w-3 h-3" />
            <span>{formatViDate(task.submittedAt)}</span>
          </span>
        </div>

        <p className="text-sm font-bold text-[#004776] break-words">{task.tenCongViec}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#20446c]">
          <span className="inline-flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-[#006cee]" />
            <span>Đề xuất: <strong>{task.proposerName}</strong></span>
          </span>
          <span>VTVL chủ trì: <strong>{task.hostPrimaryVtvlCode}</strong></span>
          <span>
            VTVL phối hợp:{' '}
            <strong className="text-[#006cee]">{task.matchedVtvls.map((m) => m.maVtvl).join(', ')}</strong>
          </span>
        </div>

        {task.sanPham && (
          <p className="text-xs text-[#20446c] flex items-start gap-1.5">
            <PackageCheck className="w-3.5 h-3.5 text-[#006cee] shrink-0 mt-0.5" />
            <span>Sản phẩm: {task.sanPham}</span>
          </p>
        )}
        {task.coordinationNote && (
          <p className="text-xs text-[#20446c] flex items-start gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#006cee] shrink-0 mt-0.5" />
            <span>Phối hợp: {task.coordinationNote}</span>
          </p>
        )}

        {(task.hostApprovalLabel || task.targetApprovalLabel) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            {task.hostApprovalLabel && (
              <span className={`px-2 py-0.5 rounded-md border font-semibold ${
                task.hostUnitApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {task.hostApprovalLabel}
              </span>
            )}
            {task.targetApprovalLabel && (
              <span className={`px-2 py-0.5 rounded-md border font-semibold ${
                task.targetUnitApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {task.targetApprovalLabel}
              </span>
            )}
            {task.approvalBadgeText && (
              <span className="px-2 py-0.5 rounded-md border border-[#bfdbfe] bg-white text-[#004776] font-bold">
                {task.approvalBadgeText}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 flex items-center">
        <button
          type="button"
          onClick={() => onOpenDetail(task)}
          disabled={loadingDetail}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#bfdbfe] bg-white hover:bg-[#eff8ff] text-[#004776] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
        >
          <Eye className="w-3.5 h-3.5 text-[#006cee]" />
          <span>{loadingDetail ? 'Đang mở...' : 'Xem chi tiết'}</span>
        </button>
      </div>
    </div>
  );
}
