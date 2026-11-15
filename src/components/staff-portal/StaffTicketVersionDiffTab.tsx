'use client';

import React, { useState, useMemo } from 'react';
import { GitCompare, History, CheckCircle2, Info, FileText } from 'lucide-react';
import { StaffWorkTicket, WorkSurveyVersion, TicketFieldDiff } from '@/types/staff-ticket';
import {
  computeTicketVersionDiff,
  FIRST_VERSION_LABEL,
  NO_CHANGE_LABEL,
  MISSING_PRIOR_DATA_LABEL,
  MIGRATION_BASELINE_LABEL
} from '@/services/tickets/ticket-diff-engine';

interface StaffTicketVersionDiffTabProps {
  ticket: StaffWorkTicket;
}

function getChangeBadge(changeType: TicketFieldDiff['changeType']) {
  if (changeType === 'added') {
    return { label: 'Thêm mới', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (changeType === 'deleted') {
    return { label: 'Xóa nội dung', cls: 'bg-red-50 text-[#ED1C24] border-red-200' };
  }
  return { label: 'Cập nhật', cls: 'bg-blue-50 text-[#0072BC] border-blue-200' };
}

export function StaffTicketVersionDiffTab({ ticket }: StaffTicketVersionDiffTabProps) {
  const versions: WorkSurveyVersion[] = useMemo(() => {
    const list = Array.isArray(ticket.versions) ? [...ticket.versions] : [];
    return list.sort((a, b) => a.versionNo - b.versionNo);
  }, [ticket.versions]);

  const latestVerNo = versions.length > 0 ? versions[versions.length - 1].versionNo : 0;
  const prevVerNo = versions.length >= 2 ? versions[versions.length - 2].versionNo : latestVerNo;

  const [selectedCurrentNo, setSelectedCurrentNo] = useState<number>(latestVerNo);
  const [selectedPrevNo, setSelectedPrevNo] = useState<number>(prevVerNo);

  const currentVersion = versions.find((v) => v.versionNo === selectedCurrentNo) || versions[versions.length - 1];
  const prevVersion = versions.find((v) => v.versionNo === selectedPrevNo);

  const diffs = useMemo(() => {
    if (!prevVersion || !currentVersion || prevVersion.versionNo === currentVersion.versionNo) {
      return [];
    }
    return computeTicketVersionDiff(prevVersion.snapshot, currentVersion.snapshot);
  }, [prevVersion, currentVersion]);

  if (versions.length === 0) {
    return (
      <div className="w-full max-w-[210mm] bg-white rounded-2xl border border-[#cbd5e1] p-6 text-center space-y-2 shadow-xs">
        <History className="w-8 h-8 text-[#0072BC] mx-auto" />
        <div className="text-sm font-bold text-[#004776]">{MISSING_PRIOR_DATA_LABEL}</div>
        <p className="text-xs text-[#476885]">
          Phiếu đang ở trạng thái Nháp hoặc chưa có lịch sử phiên bản đã nộp để thực hiện đối chiếu.
        </p>
      </div>
    );
  }

  const isSingleFirstVersion = versions.length === 1 || (currentVersion?.versionNo === 1 && selectedPrevNo === 1);

  return (
    <div className="w-full max-w-[210mm] space-y-4 text-[#004776]">
      {/* Khung thông tin phiên bản & bộ chọn 2 phiên bản đã nộp */}
      <div className="bg-white rounded-2xl border border-[#cbd5e1] p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] pb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-[#0072BC]" />
            <h4 className="text-sm font-bold text-[#004776]">
              Thay đổi so với bản trước (Tổng số phiên bản đã nộp: {versions.length})
            </h4>
          </div>

          {versions.length >= 2 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="font-semibold text-[#476885]">Bản trước:</label>
              <select
                value={selectedPrevNo}
                onChange={(e) => setSelectedPrevNo(Number(e.target.value))}
                className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-[#004776] font-semibold"
              >
                {versions.map((v) => (
                  <option key={`prev-${v.versionNo}`} value={v.versionNo}>
                    v{v.versionNo} ({v.submittedAt ? new Date(v.submittedAt).toLocaleDateString('vi-VN') : 'Chuyển đổi'})
                  </option>
                ))}
              </select>

              <span className="text-[#476885]">→</span>

              <label className="font-semibold text-[#476885]">Bản hiện tại:</label>
              <select
                value={selectedCurrentNo}
                onChange={(e) => setSelectedCurrentNo(Number(e.target.value))}
                className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-[#f8fafc] text-[#004776] font-semibold"
              >
                {versions.map((v) => (
                  <option key={`curr-${v.versionNo}`} value={v.versionNo}>
                    v{v.versionNo} ({v.submittedAt ? new Date(v.submittedAt).toLocaleDateString('vi-VN') : 'Chuyển đổi'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Metadata phiên bản hiện hành */}
        {currentVersion && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs bg-[#f8fafc] p-3 rounded-xl border border-[#e2e8f0]">
            <div>
              <span className="text-[#476885] block">Số phiên bản:</span>
              <strong className="text-[#0072BC]">
                v{currentVersion.versionNo}{' '}
                {currentVersion.versionNo === 1 ? `(${FIRST_VERSION_LABEL})` : ''}
              </strong>
            </div>
            <div>
              <span className="text-[#476885] block">Người nộp:</span>
              <strong className="text-[#004776]">{currentVersion.submittedBy}</strong>
            </div>
            <div>
              <span className="text-[#476885] block">Thời gian nộp:</span>
              <strong className="text-[#004776]">
                {currentVersion.submittedAt
                  ? new Date(currentVersion.submittedAt).toLocaleString('vi-VN')
                  : currentVersion.isMigrationBaseline
                  ? MIGRATION_BASELINE_LABEL
                  : 'Chưa xác định'}
              </strong>
            </div>
            <div>
              <span className="text-[#476885] block">Số trường thay đổi:</span>
              <strong className="text-[#0072BC]">
                {isSingleFirstVersion ? '0 (Bản đầu)' : `${diffs.length} trường`}
              </strong>
            </div>
          </div>
        )}

        {/* Giải trình cập nhật của người nộp (nếu có) */}
        {currentVersion?.changeSummary && (
          <div className="p-3 rounded-xl bg-[#eef6fc] border border-[#cbe0f5] text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#004776]">
              <FileText className="w-3.5 h-3.5 text-[#0072BC]" />
              <span>Giải trình nội dung đã cập nhật (v{currentVersion.versionNo}):</span>
            </div>
            <p className="whitespace-pre-line text-[#004776] pl-5 leading-relaxed">
              {currentVersion.changeSummary}
            </p>
          </div>
        )}
      </div>

      {/* Nội dung bảng đối chiếu */}
      {isSingleFirstVersion ? (
        <div className="bg-white rounded-2xl border border-[#cbd5e1] p-5 text-center space-y-1.5 shadow-xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#0072BC] border border-blue-200 text-xs font-bold">
            <Info className="w-3.5 h-3.5" />
            <span>{FIRST_VERSION_LABEL} (v1)</span>
          </div>
          <p className="text-xs text-[#476885]">
            Đây là phiên bản nộp đầu tiên của phiếu công việc. Khi có phiên bản nộp lại (v2, v3...), hệ thống sẽ đối chiếu chi tiết từng trường tại đây.
          </p>
        </div>
      ) : !prevVersion ? (
        <div className="bg-white rounded-2xl border border-[#cbd5e1] p-5 text-center text-xs font-semibold text-[#476885]">
          {MISSING_PRIOR_DATA_LABEL}
        </div>
      ) : diffs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#cbd5e1] p-5 text-center space-y-1.5 shadow-xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{NO_CHANGE_LABEL}</span>
          </div>
          <p className="text-xs text-[#476885]">
            Giữa phiên bản v{prevVersion.versionNo} và v{currentVersion.versionNo} không có sự khác biệt về nội dung nghiệp vụ.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#cbd5e1] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-[13px] text-[#004776]">
              <thead>
                <tr className="bg-[#f1f5f9] border-b border-[#cbd5e1] text-left">
                  <th className="px-3.5 py-2.5 font-bold w-1/4 border-r border-[#e2e8f0]">
                    Trường/cột thay đổi
                  </th>
                  <th className="px-3.5 py-2.5 font-bold w-[37.5%] border-r border-[#e2e8f0]">
                    Bản trước (v{prevVersion.versionNo})
                  </th>
                  <th className="px-3.5 py-2.5 font-bold w-[37.5%]">
                    Bản hiện tại (v{currentVersion.versionNo})
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {diffs.map((item) => {
                  const badge = getChangeBadge(item.changeType);
                  return (
                    <tr key={item.fieldKey} className="hover:bg-[#f8fafc] align-top">
                      <td className="px-3.5 py-3 border-r border-[#e2e8f0] space-y-1">
                        <div className="font-bold text-[#004776]">{item.fieldLabel}</div>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3.5 py-3 border-r border-[#e2e8f0] whitespace-pre-line text-[#476885] bg-amber-50/30">
                        {item.previousValue}
                      </td>
                      <td
                        className={`px-3.5 py-3 whitespace-pre-line font-medium ${
                          item.changeType === 'deleted'
                            ? 'text-[#ED1C24] italic bg-red-50/40'
                            : 'text-[#004776] bg-emerald-50/30'
                        }`}
                      >
                        {item.currentValue}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
