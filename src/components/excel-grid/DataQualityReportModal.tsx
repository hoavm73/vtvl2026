'use client';

import React, { useState } from 'react';
import { ExcelSheetKey } from './excel-grid-types';
import { ValidationReport, ValidationSeverity } from '@/services/validation';
import {
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  ExternalLink,
  Award
} from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';

interface DataQualityReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ValidationReport;
  onSelectSheet: (sheetKey: ExcelSheetKey) => void;
}

export function DataQualityReportModal({
  isOpen,
  onClose,
  report,
  onSelectSheet
}: DataQualityReportModalProps) {
  const [filterSeverity, setFilterSeverity] = useState<ValidationSeverity | 'all'>('all');

  if (!isOpen) return null;

  const { summary, issues, unitCode, unitName } = report;
  const filteredIssues = filterSeverity === 'all'
    ? issues
    : issues.filter((i) => i.severity === filterSeverity);

  const handleJumpToSheet = (sheetKey: ExcelSheetKey) => {
    onSelectSheet(sheetKey);
    onClose();
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#004776]/35 backdrop-blur-xs select-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quality-modal-title"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-5xl h-[100dvh] sm:h-[90dvh] bg-white rounded-none sm:rounded-2xl shadow-2xl border border-[#cbd5e1] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#cbd5e1] bg-[#f8fafc] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#004776] text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 id="quality-modal-title" className="text-base font-bold text-[#004776]">
                    Kiểm soát chất lượng dữ liệu
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#004776]/10 text-[#004776] border border-[#004776]/20">
                    {unitCode}
                  </span>
                </div>
                <p className="text-xs font-medium text-[#476885] truncate">{unitName} · Theo chuẩn Hướng dẫn 07-HD/BTCTW</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#476885] hover:text-[#004776] hover:bg-[#e2e8f0]/60 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        {/* Quality Score & KPI Bar */}
        <div className="px-5 py-3.5 bg-white border-b border-[#e2e8f0] grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#cbd5e1]">
            <Award className="w-7 h-7 text-[#004776] shrink-0" />
            <div>
              <div className="text-[11px] font-semibold text-[#64748b]">Điểm chất lượng</div>
              <div className="text-lg font-extrabold text-[#004776]">{summary.scorePercent} / 100</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50/70 border border-red-200">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
            <div>
              <div className="text-[11px] font-semibold text-red-800">Phải sửa (Lỗi đỏ)</div>
              <div className="text-lg font-extrabold text-red-700">{summary.fixCount}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <div className="text-[11px] font-semibold text-amber-800">Cần bổ sung (Ô cam)</div>
              <div className="text-lg font-extrabold text-amber-700">{summary.evidenceCount}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-sky-50/70 border border-sky-200">
            <Info className="w-6 h-6 text-sky-600 shrink-0" />
            <div>
              <div className="text-[11px] font-semibold text-sky-800">Nên xem lại</div>
              <div className="text-lg font-extrabold text-sky-700">{summary.reviewCount}</div>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 bg-[#f8fafc] border-b border-[#cbd5e1] text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[#004776]">
            <span>Bộ lọc:</span>
            <button
              type="button"
              onClick={() => setFilterSeverity('all')}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                filterSeverity === 'all' ? 'bg-[#006cee] text-white font-bold' : 'bg-white text-[#475569] hover:bg-[#e2e8f0]'
              }`}
            >
              Tất cả ({summary.totalIssues})
            </button>
            <button
              type="button"
              onClick={() => setFilterSeverity('fix')}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                filterSeverity === 'fix' ? 'bg-red-600 text-white font-bold' : 'bg-white text-red-700 hover:bg-red-50'
              }`}
            >
              🔴 Phải sửa ({summary.fixCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterSeverity('evidence')}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                filterSeverity === 'evidence' ? 'bg-amber-600 text-white font-bold' : 'bg-white text-amber-800 hover:bg-amber-50'
              }`}
            >
              🟡 Cần căn cứ ({summary.evidenceCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterSeverity('review')}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                filterSeverity === 'review' ? 'bg-sky-600 text-white font-bold' : 'bg-white text-sky-800 hover:bg-sky-50'
              }`}
            >
              🔵 Xem lại ({summary.reviewCount})
            </button>
          </div>

          <div className="text-[11px] font-bold">
            {summary.isEligibleToSubmit ? (
              <span className="text-emerald-700 inline-flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Đủ điều kiện ký nộp biểu mẫu
              </span>
            ) : (
              <span className="text-red-700 inline-flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                <AlertCircle className="w-3.5 h-3.5" />
                Còn {summary.fixCount} lỗi đỏ cần sửa trước khi nộp
              </span>
            )}
          </div>
        </div>

        {/* Issue list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
          {filteredIssues.length === 0 ? (
            <div className="py-12 text-center text-[#64748b]">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-[#004776]">Không phát hiện lỗi nào trong nhóm đã chọn!</p>
              <p className="text-xs text-[#64748b] mt-1">Dữ liệu các bảng tính đã tuân thủ đúng chuẩn Hướng dẫn số 07-HD/BTCTW.</p>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const isFix = issue.severity === 'fix';
              const isEvidence = issue.severity === 'evidence';

              return (
                <div
                  key={issue.id}
                  className={`p-3.5 rounded-xl border text-xs transition-all ${
                    isFix
                      ? 'bg-red-50/40 border-red-200'
                      : isEvidence
                      ? 'bg-amber-50/40 border-amber-200'
                      : 'bg-sky-50/40 border-sky-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            isFix ? 'bg-red-600 text-white' : isEvidence ? 'bg-amber-600 text-white' : 'bg-sky-600 text-white'
                          }`}
                        >
                          {issue.ruleId}
                        </span>
                        <span className="font-bold text-[#004776]">{issue.title}</span>
                        <span className="text-[11px] px-2 py-0.2 rounded bg-white border border-[#cbd5e1] font-bold text-[#334155]">
                          {issue.cellRef}
                        </span>
                      </div>
                      <p className="text-[#334155]">
                        <strong className="font-semibold text-[#004776]">Giá trị hiện tại:</strong>{' '}
                        <span className="font-bold text-red-700 bg-red-100/50 px-1 rounded">{issue.currentValue}</span>
                      </p>
                      <p className="text-[#334155]">
                        <strong className="font-semibold text-emerald-800">Hướng dẫn khắc phục:</strong> {issue.suggestion}
                      </p>
                      {issue.legalBasis && (
                        <p className="text-[11px] text-[#64748b] italic">Căn cứ: {issue.legalBasis}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJumpToSheet(issue.sheetKey)}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#006cee] hover:bg-[#005ecc] transition-colors cursor-pointer"
                      title="Chuyển ngay tới sheet này để xử lý"
                    >
                      <span>Sửa</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-[#cbd5e1] bg-[#f8fafc] flex items-center justify-between shrink-0">
          <span className="text-xs font-medium text-[#476885]">
            Dữ liệu kiểm tra: {issues.length} cảnh báo trên {Object.keys(summary.countsBySheet).length} sheet nghiệp vụ.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#006cee] text-white hover:bg-[#005ecc] transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}

