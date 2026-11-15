'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, FileEdit, GitCompare } from 'lucide-react';
import { StaffWorkTicket } from '@/types/staff-ticket';
import {
  buildTicketSnapshot,
  computeTicketVersionDiff,
  NO_CHANGE_LABEL
} from '@/services/tickets/ticket-diff-engine';

interface StaffTicketResubmitBoxProps {
  editingTicket: StaffWorkTicket;
  draftTicketCandidate: Partial<StaffWorkTicket>;
  changeSummary: string;
  onChangeSummary: (val: string) => void;
}

export function StaffTicketResubmitBox({
  editingTicket,
  draftTicketCandidate,
  changeSummary,
  onChangeSummary
}: StaffTicketResubmitBoxProps) {
  const latestSubmittedVersion = useMemo(() => {
    const list = Array.isArray(editingTicket.versions) ? [...editingTicket.versions] : [];
    if (list.length === 0) return null;
    list.sort((a, b) => a.versionNo - b.versionNo);
    return list[list.length - 1];
  }, [editingTicket.versions]);

  const previewDiffs = useMemo(() => {
    const prevSnap = latestSubmittedVersion
      ? latestSubmittedVersion.snapshot
      : buildTicketSnapshot(editingTicket);
    const currSnap = buildTicketSnapshot(draftTicketCandidate);
    return computeTicketVersionDiff(prevSnap, currSnap);
  }, [latestSubmittedVersion, editingTicket, draftTicketCandidate]);

  const nextVerNo = (latestSubmittedVersion?.versionNo || editingTicket.currentVersionNo || 1) + 1;

  return (
    <div className="bg-amber-50/70 rounded-2xl border border-amber-300 p-4 sm:p-5 space-y-4 shadow-2xs print:hidden">
      {/* Lý do yêu cầu bổ sung gần nhất */}
      <div className="space-y-1.5 border-b border-amber-200 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-bold text-[#004776] text-xs sm:text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Lý do yêu cầu bổ sung gần nhất:</span>
          </div>
          <span className="text-[11px] font-bold text-[#0072BC] bg-white px-2.5 py-0.5 rounded-full border border-amber-200">
            Chuẩn bị nộp lại: v{nextVerNo} • {previewDiffs.length} trường thay đổi
          </span>
        </div>

        <p className="text-xs sm:text-[13px] text-[#004776] bg-white/90 p-3 rounded-xl border border-amber-200 whitespace-pre-line leading-relaxed">
          {editingTicket.revisionReason || 'Cần rà soát và bổ sung thông tin minh chứng công việc.'}
        </p>

        {editingTicket.revisionRequestedBy && (
          <div className="text-[11px] text-[#476885]">
            Người yêu cầu: <strong>{editingTicket.revisionRequestedBy}</strong>
            {editingTicket.revisionRequestedAt
              ? ` • Thời gian: ${new Date(editingTicket.revisionRequestedAt).toLocaleString('vi-VN')}`
              : ''}
          </div>
        )}
      </div>

      {/* Textarea Giải trình nội dung đã cập nhật */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs sm:text-[13px] font-bold text-[#004776]">
          <FileEdit className="w-3.5 h-3.5 text-[#0072BC]" />
          <span>Giải trình nội dung đã cập nhật</span>
        </label>
        <textarea
          rows={3}
          value={changeSummary}
          onChange={(e) => onChangeSummary(e.target.value)}
          placeholder="Nhập nội dung giải trình các mục đã điều chỉnh, bổ sung căn cứ hoặc số liệu trước khi nộp lại..."
          className="w-full min-h-[76px] px-3 py-2.5 text-xs sm:text-sm leading-relaxed rounded-xl border border-[#cbd5e1] bg-white text-[#004776] placeholder:text-[#94a3b8] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden resize-y"
        />
      </div>

      {/* Xem trước các trường đã đổi so với bản nộp gần nhất */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-[#004776]">
          <span className="inline-flex items-center gap-1.5">
            <GitCompare className="w-3.5 h-3.5 text-[#0072BC]" />
            <span>
              Xem trước các trường đã đổi so với bản nộp gần nhất (v
              {latestSubmittedVersion?.versionNo || 1}):
            </span>
          </span>
          <span className="text-[#0072BC]">{previewDiffs.length} trường thay đổi</span>
        </div>

        {previewDiffs.length === 0 ? (
          <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-xs text-[#476885] text-center">
            {NO_CHANGE_LABEL} so với bản nộp gần nhất.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white">
            <table className="w-full border-collapse text-xs text-[#004776]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-amber-200 text-left">
                  <th className="px-3 py-2 font-bold w-1/3 border-r border-[#e2e8f0]">Trường/cột thay đổi</th>
                  <th className="px-3 py-2 font-bold w-1/3 border-r border-[#e2e8f0]">Bản trước</th>
                  <th className="px-3 py-2 font-bold w-1/3">Bản hiện tại (dự kiến nộp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {previewDiffs.map((d) => (
                  <tr key={d.fieldKey} className="align-top">
                    <td className="px-3 py-2 font-semibold border-r border-[#e2e8f0]">{d.fieldLabel}</td>
                    <td className="px-3 py-2 whitespace-pre-line text-[#476885] border-r border-[#e2e8f0]">
                      {d.previousValue}
                    </td>
                    <td className="px-3 py-2 whitespace-pre-line font-semibold text-[#0072BC]">
                      {d.currentValue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
