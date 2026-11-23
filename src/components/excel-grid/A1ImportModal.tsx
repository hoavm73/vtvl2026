'use client';

import React, { useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { GenericGridRow } from './excel-grid-types';
import { A1ImportPreviewTable } from './A1ImportPreviewTable';
import {
  A1ImportPreviewResult,
  parseAndPreviewA1Import
} from '@/services/a1/a1-excel-service';

interface A1ImportModalProps {
  isOpen: boolean;
  unitCode: string;
  unitNameVi: string;
  existingA1: GenericGridRow[];
  isSaving?: boolean;
  onClose: () => void;
  onDownloadTemplate: () => void;
  onConfirmImport: (preview: A1ImportPreviewResult, duplicateDecisions: Record<number, 'skip' | 'add_new'>) => Promise<boolean>;
}

export function A1ImportModal({
  isOpen,
  unitCode,
  unitNameVi,
  existingA1,
  isSaving = false,
  onClose,
  onDownloadTemplate,
  onConfirmImport
}: A1ImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<A1ImportPreviewResult | null>(null);
  const [duplicateDecisions, setDuplicateDecisions] = useState<Record<number, 'skip' | 'add_new'>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFileName('');
    setPreview(null);
    setDuplicateDecisions({});
    setSubmitError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const res = parseAndPreviewA1Import({ buffer: buf, unitCode, existingA1 });
      const initDecisions: Record<number, 'skip' | 'add_new'> = {};
      (res.duplicateContentRows || []).forEach((d) => { initDecisions[d.excelRow] = 'skip'; });
      setDuplicateDecisions(initDecisions);
      setPreview(res);
    } catch {
      setSubmitError('Không thể đọc tệp Excel đã chọn. Vui lòng thử lại với tệp .xlsx hợp lệ.');
      setPreview(null);
    }
  };

  const handleSetAllDuplicates = (decision: 'skip' | 'add_new') => {
    if (!preview) return;
    const next: Record<number, 'skip' | 'add_new'> = {};
    (preview.duplicateContentRows || []).forEach((d) => { next[d.excelRow] = decision; });
    setDuplicateDecisions(next);
  };

  const approvedDupCount = (preview?.duplicateContentRows || []).filter((d) => duplicateDecisions[d.excelRow] === 'add_new').length;
  const totalWillAdd = (preview?.summary.newCount || 0) + approvedDupCount;
  const issueCount = (preview?.summary.errorCount || 0) + (preview?.summary.conflictCount || 0);

  const handleConfirm = async () => {
    if (!preview || !preview.ok) return;
    setSubmitError(null);
    const ok = await onConfirmImport(preview, duplicateDecisions);
    if (ok) handleClose();
    else setSubmitError('Không thể lưu dữ liệu nhập vào máy chủ. Vui lòng kiểm tra thông báo lỗi hoặc tải lại phiên bản mới nhất.');
  };

  const canConfirm = Boolean(
    preview &&
    preview.ok &&
    !isSaving &&
    (totalWillAdd > 0 || preview.summary.unchangedCount > 0 || preview.summary.duplicateContentCount > 0)
  );

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nhập dữ liệu Biểu A1 từ Excel"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-[#004776]/35 backdrop-blur-xs p-3"
        onClick={handleClose}
      >
        <div
          className="w-[96vw] max-w-6xl max-h-[92vh] bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-3.5 bg-[#f8fafc] border-b border-[#cbd5e1] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileSpreadsheet className="w-5 h-5 text-[#0072BC] shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#004776] truncate">
                  Nhập Biểu 1. A1_NhiemVu từ Excel ({unitCode})
                </h3>
                <p className="text-xs text-[#476885] truncate">{unitNameVi}</p>
              </div>
            </div>
            <button type="button" onClick={handleClose} aria-label="Đóng hộp thoại nhập Excel" className="p-1.5 rounded-lg text-[#476885] hover:bg-[#e2e8f0]/60 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4 text-xs text-[#004776]">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-dashed border-[#94a3b8] bg-[#f8fbff]">
              <div className="space-y-1">
                <p className="font-semibold text-[#004776]">Chọn tệp .xlsx có sheet &ldquo;1. A1_NhiemVu&rdquo; (dữ liệu từ dòng 3)</p>
                <p className="text-[#476885]">Hệ thống hiển thị toàn bộ dữ liệu đọc được từ tệp để rà soát trước khi nạp, giữ nguyên dòng cũ cùng mã và chỉ ghi khi không còn lỗi.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onDownloadTemplate}
                  className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#004776] font-semibold cursor-pointer"
                >
                  Tải mẫu trống
                </button>
                <label className="h-9 px-3.5 rounded-lg bg-[#006cee] hover:bg-[#0058c4] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{fileName ? 'Chọn tệp khác' : 'Chọn tệp Excel'}</span>
                  <input ref={inputRef} type="file" accept=".xlsx" onChange={handleFileSelected} className="sr-only" />
                </label>
              </div>
            </div>

            {fileName && (
              <div className="text-xs text-[#476885]">
                Tệp đang kiểm tra: <strong className="text-[#004776]">{fileName}</strong>
              </div>
            )}

            {submitError && (
              <div className="p-3 rounded-xl border border-[#f8b4af] bg-[#fdeceb] text-[#b42318] font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {preview?.fatalError && (
              <div className="p-3 rounded-xl border border-[#f8b4af] bg-[#fdeceb] text-[#b42318] font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{preview.fatalError}</span>
              </div>
            )}

            {preview && !preview.fatalError && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="p-2.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc]">
                    <div className="text-[11px] text-[#476885]">Tổng dòng đọc</div>
                    <div className="text-lg font-bold text-[#004776] tabular-nums">{preview.summary.totalRead}</div>
                  </div>
                  <div className="p-2.5 rounded-xl border border-[#cbd5e1] bg-[#f8fbff]">
                    <div className="text-[11px] text-[#476885]">Mới hợp lệ</div>
                    <div className="text-lg font-bold text-[#0072BC] tabular-nums">{preview.summary.newCount}</div>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${preview.summary.duplicateContentCount > 0 ? 'border-amber-300 bg-amber-50' : 'border-[#cbd5e1] bg-[#f8fafc]'}`}>
                    <div className="text-[11px] text-[#476885]">Trùng cần xác nhận</div>
                    <div className="text-lg font-bold text-amber-800 tabular-nums">{preview.summary.duplicateContentCount}</div>
                  </div>
                  <div className="p-2.5 rounded-xl border border-[#cbd5e1] bg-[#f8fafc]">
                    <div className="text-[11px] text-[#476885]">Đã có mã (bỏ qua)</div>
                    <div className="text-lg font-bold text-[#004776] tabular-nums">{preview.summary.unchangedCount}</div>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${issueCount > 0 ? 'border-[#f8b4af] bg-[#fdeceb]' : 'border-[#cbd5e1] bg-[#f8fafc]'}`}>
                    <div className="text-[11px] text-[#476885]">Lỗi / Xung đột</div>
                    <div className="text-lg font-bold text-[#b42318] tabular-nums">{issueCount}</div>
                  </div>
                </div>

                <A1ImportPreviewTable
                  rows={preview.parsedRows || []}
                  duplicateCount={preview.summary.duplicateContentCount}
                  duplicateDecisions={duplicateDecisions}
                  onChangeDecision={(excelRow, decision) => setDuplicateDecisions((p) => ({ ...p, [excelRow]: decision }))}
                  onSetAllDuplicates={handleSetAllDuplicates}
                />

                {preview.ok && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-900 flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      {totalWillAdd > 0
                        ? `Sẵn sàng nạp ${totalWillAdd} nhiệm vụ mới vào Biểu A1 (bỏ qua ${preview.summary.unchangedCount + (preview.summary.duplicateContentCount - approvedDupCount)} dòng đã tồn tại).`
                        : `Tất cả dòng trong tệp đều đã tồn tại hoặc đang chọn bỏ qua — bấm Xác nhận nạp để hoàn tất.`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-5 py-3 bg-[#f8fafc] border-t border-[#cbd5e1] flex items-center justify-end gap-2 shrink-0">
            <button type="button" onClick={handleClose} className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-xs font-semibold text-[#004776] cursor-pointer">
              Đóng
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className="h-9 px-4 rounded-lg bg-[#006cee] hover:bg-[#0058c4] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-bold text-white cursor-pointer"
            >
              {isSaving ? 'Đang nạp…' : totalWillAdd > 0 ? `Xác nhận nạp (${totalWillAdd} dòng)` : 'Xác nhận nạp'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
