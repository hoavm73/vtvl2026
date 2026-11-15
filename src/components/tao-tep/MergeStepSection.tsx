'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, Download, Trash2, Building2, ShieldAlert, RefreshCw, Plus, Calendar, Layers, FileSpreadsheet } from 'lucide-react';
import { MergeFormsResult, mergeSurveyFormsIntoUnit } from '@/services/excel-merge/merge-forms';
import { getActiveUnitDefinition, getActiveUnitSession, getRealtimeDateYYYYMMDD, getSessionFilesForUnit, recordActivity, setSessionMergedWorkbook, setSessionRootWorkbook } from '@/services/telemetry/activity-log';
import { generateUnitFiles, previewGeneratedFileNames } from '@/services/excel-split/workbook-builder';
import { buildPersonalTimerWorkbookFile } from '@/services/excel-split/personal-timer-export';
import { TASK_TEMPLATES_BY_GROUP } from '@/configs/hcmute-quotas';
import { HD07_CONSTANTS } from '@/configs/hcmute-hd07-catalog';
import { HcmuteUnit } from '@/types/vtvl';
import { InfoTip } from '@/components/layout/MilestonesBar';

interface MergeStepSectionProps {
  unit?: HcmuteUnit;
}

export function MergeStepSection({ unit: propUnit }: MergeStepSectionProps) {
  const [activeUnit, setActiveUnit] = useState<HcmuteUnit>(() => propUnit || getActiveUnitDefinition());
  const [unitFile, setUnitFile] = useState<File | null>(null);
  const [formFiles, setFormFiles] = useState<File[]>([]);
  const [mergeDate, setMergeDate] = useState<string>(() => getRealtimeDateYYYYMMDD());
  const [merging, setMerging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [mergeResult, setMergeResult] = useState<MergeFormsResult | null>(null);

  useEffect(() => {
    const resolvedUnit = propUnit || getActiveUnitDefinition();
    setActiveUnit(resolvedUnit);
    const session = getActiveUnitSession();
    const dateStr = session.customDate || getRealtimeDateYYYYMMDD();
    setMergeDate(dateStr);
    const cached = getSessionFilesForUnit(resolvedUnit.code);
    if (cached.rootFile) setUnitFile(cached.rootFile);
    if (cached.formFiles.length > 0) {
      setFormFiles(cached.formFiles);
    } else if (session.timeSessions && session.timeSessions.length > 0) {
      const firstPos = session.proposedPositions[0];
      const suffix = firstPos?.vtvlSuffix || 'DT-GV-02';
      const title = firstPos ? `${firstPos.specificName} (${firstPos.careerLevel})` : 'Giảng viên';
      const tasks = TASK_TEMPLATES_BY_GROUP[resolvedUnit.group].map((t) => ({
        ...t,
        fullVtvlCode: `${resolvedUnit.code}-${suffix}`,
        fullTaskCode: `${resolvedUnit.code}-${t.taskSuffix}`
      }));
      const timerFile = buildPersonalTimerWorkbookFile(resolvedUnit, suffix, title, tasks, session.timeSessions, dateStr);
      setFormFiles([timerFile]);
    }
  }, [propUnit]);

  const handleAddForms = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;
    setFormFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...selected.filter((f) => !existingNames.has(f.name))];
    });
    setMergeResult(null);
  };

  const handleRemoveSingleForm = (fileName: string) => {
    setFormFiles((prev) => prev.filter((f) => f.name !== fileName));
    setMergeResult(null);
  };

  const handleRunMerge = async () => {
    setErrorMsg('');
    setMerging(true);
    try {
      let targetRootFile = unitFile;
      if (!targetRootFile) {
        const session = getActiveUnitSession();
        const generated = await generateUnitFiles({
          kind: activeUnit.group, unitCode: activeUnit.code, unitNameVi: activeUnit.nameVi, unitNameEn: activeUnit.nameEn,
          period: HD07_CONSTANTS.STATISTICAL_PERIOD, exportDate: mergeDate, includeZipPerPosition: false,
          actorEmail: session.actorEmail, actorTitle: session.actorTitle,
          scaleMetrics: session.scaleMetrics, ngachAllocations: session.ngachAllocations,
          ngachOverrides: session.ngachOverrides, customPositionNames: session.customPositionNames,
          customCareerLevels: session.customCareerLevels, proposedPositions: session.proposedPositions
        });
        targetRootFile = setSessionRootWorkbook(activeUnit.code, generated.unitBlob, generated.unitFileName);
        setUnitFile(targetRootFile);
      }

      if (formFiles.length === 0) {
        setErrorMsg(`Đơn vị [${activeUnit.code}] vui lòng tải lên ít nhất 01 phiếu khảo sát hoặc thực hiện đo tại Giai đoạn 3 trước khi gộp.`);
        return;
      }

      const res = await mergeSurveyFormsIntoUnit(targetRootFile, formFiles, mergeDate);
      setMergeResult(res);
      setSessionMergedWorkbook(res.unitCode, res.mergedBlob, res.mergedFileName, res.newVersion);
      recordActivity(
        activeUnit.code, activeUnit.nameVi, 'NAP_PHIEU',
        `Tổng hợp ${res.formsMergedCount} phiếu khảo sát (${res.conflicts.length} xung đột) → ${res.mergedFileName}`
      );
    } catch {
      setErrorMsg('Không thể đọc hoặc tích hợp tệp dữ liệu. Vui lòng kiểm tra lại cấu trúc tệp .xlsx theo mẫu chuẩn của hệ thống.');
    } finally {
      setMerging(false);
    }
  };

  const downloadMerged = () => {
    if (!mergeResult) return;
    const url = URL.createObjectURL(mergeResult.mergedBlob);
    const a = document.createElement('a');
    a.href = url; a.download = mergeResult.mergedFileName; a.click(); URL.revokeObjectURL(url);
  };

  const defaultRootName = previewGeneratedFileNames(activeUnit.code, mergeDate).unitFileName;

  return (
    <section id="buoc-4" aria-labelledby="h4s" className="surface-canvas rounded-2xl p-5 sm:p-7 space-y-5">
      <div className="space-y-2 border-b border-[var(--border-subtle)] pb-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <span className="w-7 h-7 rounded-full bg-[var(--primary)] text-white font-extrabold text-xs flex items-center justify-center mr-2.5 shrink-0">7</span>
            <h2 id="h4s" className="text-base sm:text-xl font-extrabold text-[var(--foreground)]">Bước 7/8 (HD 07) — Đối chiếu nhân lực (D1), Gộp phiếu khảo sát &amp; Phương án biên chế (D2)</h2>
            <InfoTip title="Quy tắc gộp phiếu & kiểm soát xung đột">
              <p>Phiếu đầy đủ và phiếu từng vị trí được gộp theo mã công việc; hai phiếu ghi khác nhau cho cùng một việc sẽ được liệt kê chi tiết để đầu mối đối chiếu và sửa, không tự chọn ngẫu nhiên.</p>
              <p>Phiếu của đơn vị khác bị từ chối tự động. Dòng giữ nguyên phút gợi ý được ghi là mức tham khảo, chưa đo thực tế.</p>
            </InfoTip>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[var(--foreground)]">
          <Building2 className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>[{activeUnit.code}] {activeUnit.nameVi}</span>
        </span>
      </div>

      {/* Top 2-Column Section: Tệp đơn vị gốc + Ngày tổng hợp */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4 space-y-2.5">
          <div className="section-eyebrow">
            <Layers className="w-4 h-4 text-[var(--primary)] shrink-0" />
            <span>Tệp đơn vị gốc</span>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--sheet)] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0">X</div>
              <div className="min-w-0 space-y-0.5">
                <div className="font-bold text-xs sm:text-sm text-[var(--foreground)] truncate">{unitFile ? unitFile.name : defaultRootName}</div>
                <div className="text-xs text-[var(--ink-muted)] flex flex-wrap items-center gap-1.5">
                  <span>{unitFile ? `Đã chọn · ${(unitFile.size / 1024).toFixed(1)} KB` : 'Lấy từ Giai đoạn 2 · 22 sheet'}</span>
                  <span>·</span>
                  <span className="text-[var(--ok)] font-bold">✓ Hợp lệ</span>
                </div>
              </div>
            </div>
            <label htmlFor="task-4-root" className="self-start sm:self-center inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] hover:border-[var(--primary)] text-xs font-bold text-[var(--foreground)] shrink-0 cursor-pointer transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>Thay tệp</span>
              <input id="task-4-root" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { setUnitFile(e.target.files?.[0] || null); setMergeResult(null); }} className="sr-only" />
            </label>
          </div>
        </div>

        <div className="md:col-span-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4 space-y-2.5 flex flex-col justify-between">
          <label htmlFor="merge-date" className="section-eyebrow">
            <Calendar className="w-4 h-4 text-[var(--primary)] shrink-0" />
            <span>Ngày tổng hợp</span>
          </label>
          <input id="merge-date" type="date" value={mergeDate} onChange={(e) => setMergeDate(e.target.value)} className="w-full min-h-[46px] rounded-xl border border-[var(--border-subtle)] bg-[var(--sheet)] px-3 text-sm font-semibold text-[var(--foreground)]" />
        </div>
      </div>

      {/* Survey Forms List Container */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] overflow-hidden">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)]">
          <div className="section-eyebrow">
            <FileSpreadsheet className="w-4 h-4 text-[var(--primary)] shrink-0" />
            <span>Các phiếu khảo sát — {formFiles.length} tệp</span>
          </div>
          <div className="flex items-center gap-2">
            {formFiles.length > 0 && (
              <button type="button" onClick={() => { setFormFiles([]); setMergeResult(null); }} className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-[var(--fix)] hover:bg-[var(--fix-soft)] cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /><span>Bỏ hết</span>
              </button>
            )}
            <label htmlFor="task-4-forms" className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 rounded-xl border border-[var(--primary)]/40 bg-[var(--sheet)] hover:border-[var(--primary)] text-xs font-bold text-[var(--primary)] cursor-pointer transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm tệp khảo sát</span>
              <input id="task-4-forms" type="file" multiple accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={handleAddForms} className="sr-only" />
            </label>
          </div>
        </div>

        {formFiles.length === 0 ? (
          <div className="bg-[var(--sheet)] px-4 py-6 text-center text-xs sm:text-sm text-[var(--ink-muted)]">
            Chưa có phiếu khảo sát nào được chọn. Bấm <strong>+ Thêm tệp khảo sát</strong> để nạp các phiếu đã thu thập vào bảng tổng hợp.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)] bg-[var(--sheet)] px-4">
            {formFiles.map((f) => (
              <li key={f.name} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">X</div>
                  <span className="font-bold text-[var(--foreground)] truncate">{f.name}</span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <span className="text-xs text-[var(--ink-muted)] tabular-nums">4 sheet · {(f.size / 1024).toFixed(1)} KB</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--ok-soft)] text-[var(--ok)] text-xs font-bold">✓ Hợp lệ</span>
                  <button type="button" onClick={() => handleRemoveSingleForm(f.name)} aria-label={`Bỏ phiếu ${f.name}`} className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--fix)] hover:bg-[var(--fix-soft)] cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {errorMsg && <div className="rounded-xl border border-[var(--fix)] bg-[var(--fix-soft)] p-3 text-xs text-[var(--fix)] font-semibold">{errorMsg}</div>}

      {/* Summary & Primary Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-xs sm:text-sm font-semibold">
          <span className="text-[var(--ok)] font-bold">{formFiles.length} tệp hợp lệ</span>
          {mergeResult && mergeResult.conflicts.length > 0 && (
            <><span>·</span><span className="text-[var(--warn)] font-bold">{mergeResult.conflicts.length} chỉ tiêu xung đột</span></>
          )}
        </div>
        <button id="task-4-merge" type="button" onClick={() => void handleRunMerge()} disabled={merging} className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-[var(--primary)] text-white font-bold text-xs sm:text-sm cursor-pointer shadow-2xs disabled:opacity-50">
          <Layers className="w-4 h-4" />
          <span>{merging ? 'Đang đọc và đối chiếu các phiếu…' : `Kiểm tra & Tổng hợp phiếu`}</span>
        </button>
      </div>

      {mergeResult && (
        <div className="rounded-xl border border-[var(--ok)]/40 bg-[var(--ok-soft)]/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[var(--ok)]" />
              <h3 className="text-sm font-bold text-[var(--foreground)]">Đã gộp {mergeResult.formsMergedCount} phiếu hợp lệ vào đơn vị {mergeResult.unitCode} (v{mergeResult.oldVersion} → v{mergeResult.newVersion})</h3>
            </div>
            <button type="button" onClick={downloadMerged} className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl bg-[var(--ok)] text-white font-bold text-xs cursor-pointer shadow-2xs">
              <Download className="w-4 h-4" /><span>Tải tệp: {mergeResult.mergedFileName}</span>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl bg-[var(--sheet)] border border-[var(--border-subtle)] p-2.5"><div className="text-xs text-[var(--ink-muted)]">Phiếu hợp lệ đã gộp</div><div className="text-lg font-extrabold text-[var(--primary)] tabular-nums">{mergeResult.formsMergedCount}</div></div>
            <div className="rounded-xl bg-[var(--sheet)] border border-[var(--border-subtle)] p-2.5"><div className="text-xs text-[var(--ink-muted)]">Công việc đã đo thực tế</div><div className="text-lg font-extrabold text-[var(--ok)] tabular-nums">{mergeResult.measuredTasksCount}</div></div>
            <div className="rounded-xl bg-[var(--sheet)] border border-[var(--border-subtle)] p-2.5"><div className="text-xs text-[var(--ink-muted)]">Còn giữ nguyên ô cam gợi ý</div><div className="text-lg font-extrabold text-[var(--warn)] tabular-nums">{mergeResult.keptSuggestionCount}</div></div>
            <div className={`rounded-xl border p-2.5 ${mergeResult.conflicts.length > 0 ? 'bg-[var(--fix-soft)] border-[var(--fix)]' : 'bg-[var(--sheet)] border-[var(--border-subtle)]'}`}><div className="text-xs text-[var(--ink-muted)]">Xung đột giữa các phiếu</div><div className={`text-lg font-extrabold tabular-nums ${mergeResult.conflicts.length > 0 ? 'text-[var(--fix)]' : 'text-[var(--foreground)]'}`}>{mergeResult.conflicts.length}</div></div>
          </div>
          {mergeResult.rejectedForms.length > 0 && (
            <div className="rounded-xl border border-[var(--fix)] bg-[var(--fix-soft)] p-3 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-[var(--fix)]"><ShieldAlert className="w-4 h-4" /><span>Đã từ chối {mergeResult.rejectedForms.length} phiếu không thuộc đơn vị [{mergeResult.unitCode}]:</span></div>
              <ul className="list-disc pl-5 space-y-0.5 text-[var(--foreground)]">{mergeResult.rejectedForms.map((rf, idx) => <li key={idx}><code className="font-bold">{rf.fileName}</code>: {rf.reason}</li>)}</ul>
            </div>
          )}
          {mergeResult.conflicts.length > 0 && (
            <div className="rounded-xl border border-[var(--fix)] bg-[var(--fix-soft)] p-3.5 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-extrabold text-[var(--fix)]"><AlertTriangle className="w-4 h-4 shrink-0" /><span>Phát hiện {mergeResult.conflicts.length} chỉ tiêu xung đột giữa các phiếu cho cùng một mã công việc:</span></div>
              <ul className="space-y-2">
                {mergeResult.conflicts.map((c, idx) => (
                  <li key={idx} className="rounded-lg bg-[var(--sheet)] border border-[var(--fix)]/30 p-2.5 space-y-1">
                    <div className="font-bold text-[var(--foreground)]"><span className="text-[var(--primary)]">{c.taskCode}</span> — {c.taskName} · Chỉ tiêu lệch: <strong className="text-[var(--fix)]">{c.field}</strong></div>
                    <ul className="pl-4 list-disc text-[var(--ink-muted)] space-y-0.5">{c.allValues.map((av, vIdx) => <li key={vIdx}>Tệp <code className="font-semibold text-[var(--foreground)]">{av.fileName}</code> ghi giá trị: <strong className="text-[var(--fix)]">{av.value}</strong></li>)}</ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
