'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, FileText, Briefcase, ShieldCheck, AlertCircle } from 'lucide-react';
import { AuditReportResult } from '@/types/vtvl';

export function UnitCheckSummaryBar({ report }: { report: AuditReportResult }) {
  return (
    <>
      {report.countsBySeverity.fix > 0 ? (
        <div className="rounded-[12px] bg-[var(--fix-soft)] px-4 py-3 flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-[var(--fix)] shrink-0" />
          <div>
            <div className="text-xs sm:text-sm font-semibold text-[var(--fix)]">Hồ sơ cần sửa lỗi bắt buộc</div>
            <p className="text-xs text-[var(--foreground)]">
              Phát hiện <strong>{report.countsBySeverity.fix}</strong> mục phải sửa và <strong>{report.countsBySeverity.evidence}</strong> nội dung cần bổ sung căn cứ.
            </p>
          </div>
        </div>
      ) : report.countsBySeverity.evidence > 0 ? (
        <div className="rounded-[12px] bg-[var(--warn-soft)] px-4 py-3 flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-[var(--warn)] shrink-0" />
          <div>
            <div className="text-xs sm:text-sm font-semibold text-[var(--warn)]">Hồ sơ cần bổ sung căn cứ</div>
            <p className="text-xs text-[var(--foreground)]">
              <strong>{report.countsBySeverity.evidence}</strong> nội dung cần bổ sung trước khi hoàn tất thẩm định.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-[12px] bg-[var(--ok-soft)] px-4 py-3 flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[var(--ok)] shrink-0" />
          <div>
            <div className="text-xs sm:text-sm font-semibold text-[var(--ok)]">Hồ sơ đạt yêu cầu kiểm tra chéo</div>
            <p className="text-xs text-[var(--foreground)]">Đạt toàn bộ chỉ tiêu kiểm tra chéo và đầy đủ căn cứ.</p>
          </div>
        </div>
      )}

      <div className="border-y border-[#e2e8f0] grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#e2e8f0]">
        <div className="px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs">
          <ShieldCheck className={`w-4 h-4 shrink-0 ${report.countsBySeverity.fix > 0 ? 'text-[#b42318]' : 'text-[#13653f]'}`} />
          <strong className={`text-sm font-bold tabular-nums ${report.countsBySeverity.fix > 0 ? 'text-[#b42318]' : 'text-[#13653f]'}`}>{report.countsBySeverity.fix}</strong>
          <span className="text-[#20446c]">Phải sửa</span>
        </div>
        <div className="px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs">
          <FileText className="w-4 h-4 text-[#c2410c] shrink-0" />
          <strong className="text-sm font-bold text-[#c2410c] tabular-nums">{report.countsBySeverity.evidence}</strong>
          <span className="text-[#20446c]">Cần bổ sung</span>
        </div>
        <div className="px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs">
          <AlertCircle className="w-4 h-4 text-[#a16207] shrink-0" />
          <strong className="text-sm font-bold text-[#a16207] tabular-nums">{report.countsBySeverity.review}</strong>
          <span className="text-[#20446c]">Nên xem lại</span>
        </div>
        <div className="px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs">
          <CheckCircle2 className="w-4 h-4 text-[#13653f] shrink-0" />
          <strong className="text-sm font-bold text-[#13653f] tabular-nums">{report.vtvlRecalcRows.length}</strong>
          <span className="text-[#20446c]">VTVL (C1)</span>
        </div>
        <div className="col-span-2 sm:col-span-1 px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs">
          <Briefcase className="w-4 h-4 text-[#006cee] shrink-0" />
          <strong className="text-sm font-bold text-[#004776] tabular-nums">{report.templateFeedbackItems.length}</strong>
          <span className="text-[#20446c]">Góp ý biểu</span>
        </div>
      </div>
    </>
  );
}
