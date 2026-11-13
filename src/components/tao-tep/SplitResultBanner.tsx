'use client';

import React, { useState } from 'react';
import { CheckCircle2, Circle, Download, FolderArchive, FileSpreadsheet, Settings2, Copy, Check, ChevronDown } from 'lucide-react';
import { SplitResultSummary } from '@/types/vtvl';
import { previewGeneratedFileNames } from '@/services/excel-split/workbook-builder';
import { RegenFormsResult, regenerateFormsFromEditedUnitWorkbook } from '@/services/excel-split/regen-forms';

interface Props {
  result: SplitResultSummary;
  onDownload: (blob: Blob, filename: string) => void;
}

export function SplitFileNamesPreview({
  unitCode,
  exportDate,
  includeZip,
  hasGenerated = false,
  onCopied
}: {
  unitCode: string;
  exportDate: string;
  includeZip: boolean;
  hasGenerated?: boolean;
  onCopied?: (fileName: string) => void;
}) {
  const [copiedName, setCopiedName] = useState<string>('');
  const names = previewGeneratedFileNames(unitCode, exportDate);
  const items = [
    { title: 'Tệp đơn vị gốc', fileName: names.unitFileName, meta: 'Excel (.xlsx) · 22 sheet · Sổ chuẩn nộp thẩm định', isZip: false },
    { title: 'Tệp đơn vị dự thảo', fileName: names.draftUnitFileName, meta: 'Excel (.xlsx) · Có ô gợi ý và sheet căn cứ (Can_cu_goi_y)', isZip: false },
    { title: 'Phiếu thu số liệu', fileName: names.fullFormFileName, meta: 'Excel (.xlsx) · 4 sheet · Có Biểu D1 dành cho đầu mối đơn vị', isZip: false },
    ...(includeZip ? [{ title: 'Phiếu từng vị trí', fileName: names.zipFileName, meta: 'Gói nén (.zip) · Lược bỏ D1 để tránh tính trùng nhân sự kiêm nhiệm', isZip: true }] : [])
  ];

  const handleCopy = (fileName: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(fileName);
    }
    setCopiedName(fileName);
    onCopied?.(fileName);
    setTimeout(() => setCopiedName(''), 1800);
  };

  return (
    <div aria-live="polite" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-[var(--border-subtle)]">
        <span className="section-eyebrow"><FileSpreadsheet className="w-4 h-4 text-[var(--primary)] shrink-0" /><span>Tệp đầu ra</span></span>
        <span className="text-xs font-bold text-[var(--primary)]">{items.length} tệp</span>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)] bg-[var(--sheet)] px-4">
        {items.map((it) => {
          const isCopied = copiedName === it.fileName;
          return (
            <li key={it.fileName} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[var(--surface-tint)] border border-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center shrink-0 mt-0.5">
                  {it.isZip ? <FolderArchive className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="font-bold text-[var(--foreground)] text-sm">{it.title}</div>
                  <div className="text-xs font-semibold text-[var(--primary)] break-all sm:break-words">{it.fileName}</div>
                  <div className="text-xs text-[var(--ink-muted)]">{it.meta}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {hasGenerated ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ok)]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã tạo</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-muted)]">
                    <Circle className="w-3.5 h-3.5 text-[var(--ink-subtle)]" />
                    <span>Chưa tạo</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleCopy(it.fileName)}
                  title={`Sao chép tên tệp ${it.fileName}`}
                  aria-label={`Sao chép tên tệp ${it.fileName}`}
                  className="inline-flex items-center gap-1 min-h-[34px] px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] hover:border-[var(--primary)] text-xs font-semibold text-[var(--ink-muted)] hover:text-[var(--primary)] cursor-pointer transition-colors"
                >
                  {isCopied ? <><Check className="w-3.5 h-3.5 text-[var(--ok)]" /><span className="text-[var(--ok)]">Đã chép</span></> : <><Copy className="w-3.5 h-3.5" /><span className="sr-only sm:not-sr-only">Sao chép</span></>}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function RegenFormsFromUnitBox({ exportDate, includeZip, onDownload }: { exportDate: string; includeZip: boolean; onDownload: (blob: Blob, filename: string) => void }) {
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenErr, setRegenErr] = useState('');
  const [regenRes, setRegenRes] = useState<RegenFormsResult | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRegenErr(''); setRegenLoading(true);
    try {
      const res = await regenerateFormsFromEditedUnitWorkbook(f, includeZip, exportDate);
      setRegenRes(res);
    } catch (err) {
      setRegenErr(err instanceof Error ? err.message : 'Không thể đọc tệp đơn vị đã sửa.');
    } finally { setRegenLoading(false); }
  };

  return (
    <details className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] overflow-hidden">
      <summary className="cursor-pointer px-4 py-3 min-h-[48px] text-xs sm:text-sm font-bold text-[var(--foreground)] flex items-center justify-between list-none">
        <span className="inline-flex items-center gap-2.5">
          <Settings2 className="w-4 h-4 text-[var(--primary)] shrink-0" />
          <span>Tùy chọn nâng cao — Tạo lại phiếu từ tệp đơn vị đã sửa (khi đổi phương pháp ở Biểu C3 hoặc thêm việc ở B1)</span>
        </span>
        <ChevronDown className="w-4 h-4 text-[var(--ink-muted)] transition-transform group-open:rotate-180 shrink-0" />
      </summary>
      <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--sheet)] space-y-3 text-xs sm:text-sm">
        <p className="text-[var(--ink-muted)]">Gợi ý phút/SP chỉ có ở vị trí tính theo <strong>PP2</strong>. Khi đơn vị đổi phương pháp ở Biểu <code>8. C3_NhuCau</code> hoặc bổ sung công việc ở <code>4. B1_KhoiLuong</code>, hãy chọn tệp đơn vị đã sửa tại đây để tạo lại Phiếu thu số liệu và gói <code>.zip</code> từng vị trí.</p>
        <div>
          <label htmlFor="regen-unit-file" className="block font-bold text-[var(--foreground)] mb-1">Chọn tệp đơn vị đã chỉnh sửa (.xlsx)</label>
          <input id="regen-unit-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void handleFileChange(e)} className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--primary)] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white cursor-pointer" />
        </div>
        {regenLoading && <p className="font-bold text-[var(--primary)]">Đang đọc Biểu C3, B1 và tạo lại bộ phiếu…</p>}
        {regenErr && <p className="font-bold text-[var(--fix)]">{regenErr}</p>}
        {regenRes && (
          <div className="rounded-xl bg-[var(--ok-soft)] p-3 space-y-2.5">
            <div className="font-bold text-[var(--ok)]">✓ Đã tạo lại bộ phiếu cho [{regenRes.unitCode}] ({regenRes.vtvlCount} VTVL, trong đó {regenRes.pp2PositionCount} vị trí tính theo PP2 · {regenRes.taskCount} công việc)</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onDownload(regenRes.fullFormBlob, regenRes.fullFormFileName)} className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold cursor-pointer"><Download className="w-3.5 h-3.5" /><span className="break-all sm:break-normal">Tải phiếu đầy đủ: {regenRes.fullFormFileName}</span></button>
              {regenRes.zipBlob && regenRes.zipFileName && <button type="button" onClick={() => onDownload(regenRes.zipBlob!, regenRes.zipFileName!)} className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[var(--primary)] bg-[var(--sheet)] text-[var(--primary)] text-xs font-bold cursor-pointer"><FolderArchive className="w-3.5 h-3.5" /><span className="break-all sm:break-normal">Tải gói .zip từng vị trí: {regenRes.zipFileName}</span></button>}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

export function SplitResultBanner({ result, onDownload }: Props) {
  const files = [
    { title: 'Tệp đơn vị gốc', fileName: result.unitFileName, meta: 'Excel (.xlsx) · 22 sheet · Sổ chuẩn nộp thẩm định', blob: result.unitBlob, primary: true, isZip: false },
    { title: 'Tệp đơn vị dự thảo', fileName: result.draftUnitFileName, meta: 'Excel (.xlsx) · 22 sheet · Có ô cam gợi ý và sheet Can_cu_goi_y', blob: result.draftUnitBlob, primary: false, isZip: false },
    { title: 'Phiếu thu số liệu', fileName: result.fullFormFileName, meta: 'Excel (.xlsx) · 4 sheet · Có Biểu D1 dành cho đầu mối đơn vị', blob: result.fullFormBlob, primary: false, isZip: false },
    ...(result.zipBlob && result.zipFileName ? [{ title: 'Phiếu từng vị trí', fileName: result.zipFileName, meta: `Gói nén (.zip) · ${result.vtvlCount} phiếu .xlsx · Lược bỏ D1 để tránh tính trùng kiêm nhiệm`, blob: result.zipBlob, primary: false, isZip: true }] : [])
  ];

  return (
    <div className="rounded-xl border border-[var(--ok)]/30 bg-[var(--surface-tint)] overflow-hidden">
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-[var(--ok)] shrink-0" /><h3 className="text-sm sm:text-base font-bold text-[var(--foreground)]">Đã khởi tạo {files.length} tệp đầu ra cho {result.unitNameVi} ({result.unitCode})</h3></div>
        <span className="text-xs text-[var(--ink-muted)]">{result.missionCount} nhiệm vụ · {result.vtvlCount} vị trí · {result.taskCount} công việc · {result.totalStandardFte} FTE</span>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)] bg-[var(--sheet)] px-4">
        {files.map((f) => (
          <li key={f.fileName} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[var(--ok-soft)] text-[var(--ok)] flex items-center justify-center shrink-0 mt-0.5">
                {f.isZip ? <FolderArchive className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="text-sm font-bold text-[var(--foreground)]">{f.title}</div>
                <div className="text-xs font-semibold text-[var(--primary)] break-all sm:break-words">{f.fileName}</div>
                <div className="text-xs text-[var(--ink-muted)]">{f.meta}</div>
              </div>
            </div>
            <button type="button" onClick={() => onDownload(f.blob, f.fileName)} className={`w-full sm:w-auto justify-center inline-flex items-center gap-1.5 min-h-[42px] px-4 rounded-xl text-xs sm:text-sm font-bold shrink-0 cursor-pointer ${f.primary ? 'bg-[var(--primary)] text-white shadow-2xs' : 'border border-[var(--border)] bg-[var(--sheet)] text-[var(--primary)] hover:border-[var(--primary)]'}`}>
              <Download className="w-4 h-4 shrink-0" /><span>Tải xuống</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
