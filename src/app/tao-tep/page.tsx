'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, BookOpenCheck } from 'lucide-react';
import { WorkflowSidebar, focusTaskTarget } from '@/components/layout/MilestonesBar';
import { HCMUTE_UNITS, UNIT_GROUPS, findHcmuteUnit, getActiveHcmuteUnits } from '@/configs/hcmute-units';
import { HD07_CONSTANTS } from '@/configs/hcmute-hd07-catalog';
import { buildDefaultProposedPositionsForUnit, buildProposedPositionFromFramework } from '@/configs/hcmute-nd232-catalog';
import { NgachAllocationRow, ProposedVtvlRow, SplitResultSummary, UnitGroupKind, UnitScaleMetrics } from '@/types/vtvl';
import { generateUnitFiles } from '@/services/excel-split/workbook-builder';
import { MergeStepSection } from '@/components/tao-tep/MergeStepSection';
import { SplitFileNamesPreview } from '@/components/tao-tep/SplitResultBanner';
import { Hd07OrderGuideCard } from '@/components/tao-tep/Hd07OrderGuideCard';
import { Step1CatalogSelector } from '@/components/tao-tep/Step1CatalogSelector';
import { Step1PositionList } from '@/components/tao-tep/Step1PositionList';
import { validateStep1Data } from '@/components/tao-tep/Step1ReviewConfirm';
import { Step1Stage4Export } from '@/components/tao-tep/Step1Stage4Export';
import { StageStepperBar, computeStageStatuses } from '@/components/tao-tep/StageStepperBar';
import { FormField, FormFieldState, SaveLifecycleState, SegmentedControl, ToastNotice, ToastRegion } from '@/components/ui/FormFeedbackPrimitives';
import { TextInput, DateInput, Select } from '@/components/ui/FormInputs';
import { buildDefaultNgachAllocations, buildDefaultScaleMetrics, formatCurrentHHMM, getActiveUnitSession, getRealtimeDateYYYYMMDD, recordActivity, saveActiveUnitSession, setSessionRootWorkbook } from '@/services/telemetry/activity-log';
import { syncUnitSplitToSupabase } from '@/services/supabase/vtvl-sync';
import { ExcelWorkbookViewer } from '@/components/excel-grid/ExcelWorkbookViewer';

const ROLE_PRESETS = ['Trưởng đơn vị (Trưởng khoa / Viện trưởng / Trưởng phòng / Giám đốc)', 'Phó Trưởng đơn vị phụ trách VTVL', 'Thư ký Tổ công tác VTVL đơn vị', 'Trưởng Bộ môn / Trưởng Ngành', 'Chuyên viên / Thư ký khoa tổng hợp hồ sơ'];

export default function TaoTepPage() {
  const [viewMode, setViewMode] = useState<'excel' | 'wizard'>('excel');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [wizardStage, setWizardStage] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [visitedStages, setVisitedStages] = useState<number[]>([1]);
  const [kind, setKind] = useState<UnitGroupKind>('khoa-vien');
  const [selectedUnitCode, setSelectedUnitCode] = useState<string>('TCNS');
  const [customDate, setCustomDate] = useState<string>(() => getRealtimeDateYYYYMMDD());
  const [actorEmail, setActorEmail] = useState<string>('');
  const [actorTitle, setActorTitle] = useState<string>('');
  const [lastSavedAt, setLastSavedAt] = useState<string>(() => formatCurrentHHMM());
  const [, setSaveLifecycle] = useState<SaveLifecycleState>('idle');
  const [fieldStates, setFieldStates] = useState<Record<string, FormFieldState>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [forceShowStageErrors, setForceShowStageErrors] = useState<Record<number, boolean>>({});
  const [isCheckingContinue] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [includeZip, setIncludeZip] = useState<boolean>(true);
  const [positions, setPositions] = useState<ProposedVtvlRow[]>(() => buildDefaultProposedPositionsForUnit('Phòng Tổ chức - Nhân sự', 'phong-ban'));
  const [scaleMetrics, setScaleMetrics] = useState<UnitScaleMetrics>(() => buildDefaultScaleMetrics('phong-ban'));
  const [ngachAllocations, setNgachAllocations] = useState<NgachAllocationRow[]>(() => buildDefaultNgachAllocations(buildDefaultProposedPositionsForUnit('Phòng Tổ chức - Nhân sự', 'phong-ban')));
  const [, setUndoSnapshot] = useState<ProposedVtvlRow[] | undefined>(undefined);
  const [, setConfirmAction] = useState<{ type: 'reset' | 'delete'; row?: ProposedVtvlRow } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [stale, setStale] = useState<boolean>(false);
  const [result, setResult] = useState<SplitResultSummary | null>(null);
  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushToast = (kindType: ToastNotice['kind'], message: string, onRetry?: () => void) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev.filter((t) => t.message !== message), { id, kind: kindType, message, onRetry }]);
    if (kindType !== 'error') setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  };

  const applySessionToState = (saved: ReturnType<typeof getActiveUnitSession>) => {
    setKind(saved.kind); setSelectedUnitCode(saved.unitCode); setCustomDate(saved.customDate);
    setActorEmail(saved.actorEmail); setActorTitle(saved.actorTitle);
    const st = saved.wizardStage || 1; setWizardStage(st); setVisitedStages((prev) => Array.from(new Set([...prev, st])));
    setLastSavedAt(saved.lastSavedAt); setPositions(saved.proposedPositions); setUndoSnapshot(saved.previousPositionsSnapshot);
    if (saved.scaleMetrics) setScaleMetrics(saved.scaleMetrics);
    if (saved.ngachAllocations) setNgachAllocations(saved.ngachAllocations);
  };

  useEffect(() => {
    applySessionToState(getActiveUnitSession());
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'wizard') setViewMode('wizard');
      const sp = params.get('step'); const stg = Number(params.get('stage'));
      if (sp === '1') { setActiveStep(1); setWizardStage(1); }
      else if (sp === '2') { setActiveStep(1); setWizardStage(2); }
      else if (sp === '5') { setActiveStep(1); setWizardStage(3); }
      else if (sp === '6' || window.location.hash === '#buoc-3') { setActiveStep(1); setWizardStage(4); }
      else if (sp === '7' || sp === '4' || window.location.hash === '#buoc-4') { setActiveStep(1); setWizardStage(5); }
      else if (stg >= 1 && stg <= 5) { setActiveStep(1); setWizardStage(stg as 1 | 2 | 3 | 4 | 5); }
    };
    syncFromUrl(); window.addEventListener('popstate', syncFromUrl);
    const onStorage = (e: StorageEvent) => { if (e.key === 'hcmute_vtvl_active_unit_session_v2') applySessionToState(getActiveUnitSession()); };
    window.addEventListener('storage', onStorage);
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('hcmute_vtvl_realtime') : null;
    if (bc) bc.onmessage = () => applySessionToState(getActiveUnitSession());
    return () => { window.removeEventListener('popstate', syncFromUrl); window.removeEventListener('storage', onStorage); bc?.close(); };
  }, []);

  const unitsOfGroup = useMemo(() => HCMUTE_UNITS.filter((u) => u.group === kind), [kind]);
  const currentUnit = useMemo(() => unitsOfGroup.find((u) => u.code === selectedUnitCode) || unitsOfGroup[0] || HCMUTE_UNITS[0], [unitsOfGroup, selectedUnitCode]);

  const persistState = (patch: Parameters<typeof saveActiveUnitSession>[0], fieldKey?: string) => {
    try {
      setSaveLifecycle('saving'); if (fieldKey) setFieldStates((p) => ({ ...p, [fieldKey]: 'saving' }));
      const next = saveActiveUnitSession(patch); setLastSavedAt(next.lastSavedAt); setUndoSnapshot(next.previousPositionsSnapshot); setSaveLifecycle('saved');
      if (fieldKey) setFieldStates((p) => ({ ...p, [fieldKey]: 'saved' }));
      setTimeout(() => { setSaveLifecycle((cur) => (cur === 'saved' ? 'idle' : cur)); if (fieldKey) setFieldStates((p) => ({ ...p, [fieldKey]: p[fieldKey] === 'saved' ? 'default' : p[fieldKey] })); }, 1500);
    } catch { setSaveLifecycle('error'); if (fieldKey) setFieldStates((p) => ({ ...p, [fieldKey]: 'error' })); pushToast('error', 'Chưa thể lưu thay đổi vào bộ nhớ trình duyệt.', () => persistState(patch, fieldKey)); }
  };

  const scheduleAutosave = (patch: Parameters<typeof saveActiveUnitSession>[0], fieldKey: string) => {
    setSaveLifecycle('dirty'); setFieldStates((p) => ({ ...p, [fieldKey]: 'dirty' }));
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => persistState(patch, fieldKey), 380);
  };

  const syncPositions = (next: ProposedVtvlRow[], unitCode = currentUnit.code, nextKind = kind, prevSnap?: ProposedVtvlRow[]) => {
    setPositions(next); persistState({ unitCode, kind: nextKind, proposedPositions: next, ...(prevSnap ? { previousPositionsSnapshot: prevSnap } : {}) }); if (result) setStale(true);
  };

  const handleGroupChange = (newKind: UnitGroupKind) => {
    setKind(newKind); const first = getActiveHcmuteUnits().find((u) => u.group === newKind) || HCMUTE_UNITS[0];
    const nextPos = buildDefaultProposedPositionsForUnit(first.nameVi, newKind); const nextScale = buildDefaultScaleMetrics(newKind); const nextNgach = buildDefaultNgachAllocations(nextPos);
    setSelectedUnitCode(first.code); setScaleMetrics(nextScale); setNgachAllocations(nextNgach); setPositions(nextPos);
    persistState({ unitCode: first.code, kind: newKind, proposedPositions: nextPos, scaleMetrics: nextScale, ngachAllocations: nextNgach }, 'unit');
  };

  const handleUnitChange = (newCode: string) => {
    setSelectedUnitCode(newCode); const u = findHcmuteUnit(newCode);
    const nextPos = buildDefaultProposedPositionsForUnit(u.nameVi, u.group); const nextNgach = buildDefaultNgachAllocations(nextPos);
    setNgachAllocations(nextNgach); syncPositions(nextPos, u.code, u.group); persistState({ ngachAllocations: nextNgach }, 'unit');
  };

  const handleStageChange = (st: 1 | 2 | 3 | 4 | 5, focusHeading = true) => {
    setActiveStep(1); setWizardStage(st); setVisitedStages((prev) => Array.from(new Set([...prev, st]))); persistState({ activeStep: 1, wizardStage: st });
    const stepParam = st === 1 ? 1 : st === 2 ? 2 : st === 3 ? 5 : st === 4 ? 6 : 7;
    if (typeof window !== 'undefined') { window.history.replaceState(null, '', `/tao-tep?step=${stepParam}&mode=wizard`); if (focusHeading) { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => stageHeadingRef.current?.focus(), 80); } }
  };

  const handleAddMultiplePositions = (fwIds: string[]) => {
    syncPositions([...positions, ...fwIds.map((fwId, idx) => buildProposedPositionFromFramework(fwId, currentUnit.nameVi, kind, positions.length + idx + 1))], currentUnit.code, kind, positions);
    pushToast('success', `Đã thêm ${fwIds.length} vị trí việc làm vào [${currentUnit.code}].`);
  };

  const handleCreateFiles = async () => {
    setLoading(true); setStale(false);
    try {
      persistState({ unitCode: currentUnit.code, kind, customDate, actorEmail: actorEmail.trim(), actorTitle: actorTitle.trim(), activeStep: 1, wizardStage: 4, scaleMetrics, ngachAllocations, proposedPositions: positions });
      const res = await generateUnitFiles({ kind, unitCode: currentUnit.code, unitNameVi: currentUnit.nameVi, unitNameEn: currentUnit.nameEn, period: HD07_CONSTANTS.STATISTICAL_PERIOD, exportDate: customDate, includeZipPerPosition: includeZip, actorEmail: actorEmail.trim(), actorTitle: actorTitle.trim(), scaleMetrics, ngachAllocations, ngachOverrides: {}, proposedPositions: positions });
      setResult(res); setSessionRootWorkbook(res.unitCode, res.unitBlob, res.unitFileName);
      recordActivity(res.unitCode, res.unitNameVi, 'TAO_TEP', `Khởi tạo 4 tệp chuẩn: ${res.unitFileName}`, { actorEmail: actorEmail.trim(), actorTitle: actorTitle.trim() });
      pushToast('success', `Đã khởi tạo thành công 4 tệp đầu ra cho [${res.unitCode}].`); void syncUnitSplitToSupabase(res, { scaleMetrics, ngachAllocations, proposedPositions: positions });
    } catch { pushToast('error', 'Không thể khởi tạo bộ biểu. Vui lòng thử lại.', () => void handleCreateFiles()); } finally { setLoading(false); }
  };

  const validationErrors = useMemo(() => validateStep1Data(currentUnit, actorEmail, actorTitle, positions), [currentUnit, actorEmail, actorTitle, positions]);
  const stageStatuses = useMemo(() => computeStageStatuses(wizardStage, currentUnit.code, actorEmail, actorTitle, positions, validationErrors, visitedStages), [wizardStage, currentUnit.code, actorEmail, actorTitle, positions, validationErrors, visitedStages]);
  const currentStageMeta = stageStatuses.find((s) => s.num === wizardStage) || stageStatuses[0];
  const emailErrMsg = (touchedFields.actorEmail || forceShowStageErrors[1]) && (!actorEmail.trim() || !actorEmail.includes('@') || !actorEmail.includes('.')) ? 'Vui lòng nhập địa chỉ email công vụ HCM-UTE.' : undefined;
  const roleErrMsg = (touchedFields.actorTitle || forceShowStageErrors[1]) && !actorTitle.trim() ? 'Vui lòng nhập hoặc chọn chức vụ, vai trò.' : undefined;

  return (
    <div className="w-full max-w-none px-3.5 sm:px-5 lg:px-6 py-4 min-w-0">
      <ToastRegion toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      {viewMode === 'excel' ? (
        <ExcelWorkbookViewer initialUnitCode={selectedUnitCode} />
      ) : (
        <div className="w-full max-w-[1360px] mx-auto flex flex-col lg:flex-row gap-4 items-start min-w-0">
          <WorkflowSidebar activeStep={wizardStage === 1 ? 1 : wizardStage === 2 ? 2 : wizardStage === 3 ? 5 : wizardStage === 4 ? 6 : 7} errorStep={validationErrors.length > 0 && activeStep > 1 ? 1 : null} onSelectStep={(s) => { const map: Record<number, 1 | 2 | 3 | 4 | 5> = { 1: 1, 2: 2, 5: 3, 6: 4, 7: 5 }; if (map[s]) handleStageChange(map[s], true); }} unitCode={currentUnit.code} />
          <div className="flex-1 w-full space-y-4 min-w-0">
            <section className="bg-white rounded-xl border border-[var(--border)] p-4 sm:p-5 space-y-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white font-semibold text-xs flex items-center justify-center shrink-0">{wizardStage}</span>
                  <h1 ref={stageHeadingRef} tabIndex={-1} className="text-lg sm:text-xl font-semibold text-[var(--foreground)] outline-none">{currentStageMeta.fullTitle}</h1>
                </div>
                <span className="text-xs text-[var(--ink-muted)]">Cập nhật lúc: {lastSavedAt}</span>
              </div>
              <StageStepperBar stages={stageStatuses} currentStage={wizardStage} onSelectStage={(s) => handleStageChange(s, true)} />
              {wizardStage === 1 && (
                <div className="space-y-4">
                  <SegmentedControl ariaLabel="Chọn khối đơn vị thuộc HCM-UTE" options={UNIT_GROUPS} value={kind} onChange={handleGroupChange} />
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-7"><FormField htmlFor="task-1-unit" label={`Đơn vị thuộc HCM-UTE (${unitsOfGroup.length} đơn vị)`} required state={fieldStates.unit || 'default'}><Select id="task-1-unit" value={currentUnit.code} onChange={(e) => handleUnitChange(e.target.value)}>{unitsOfGroup.map((u) => <option key={u.code} value={u.code}>[{u.code}] {u.nameVi}</option>)}</Select></FormField></div>
                    <div className="sm:col-span-2"><FormField htmlFor="unit-code-ro" label="Mã đơn vị" state="readOnly"><TextInput id="unit-code-ro" readOnly state="readOnly" value={currentUnit.code} /></FormField></div>
                    <div className="sm:col-span-3"><FormField htmlFor="unit-date" label="Ngày lập hồ sơ" state={fieldStates.customDate || 'default'}><DateInput id="unit-date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); scheduleAutosave({ customDate: e.target.value }, 'customDate'); }} onBlur={() => persistState({ customDate }, 'customDate')} /></FormField></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-[var(--border-subtle)]">
                    <FormField htmlFor="task-1-actor" label="Email công vụ người thực hiện (S_NhatKy)" required state={fieldStates.actorEmail || 'default'} errorMessage={emailErrMsg} errorId="actor-email-err"><TextInput id="task-1-actor" type="email" required errorMessage={emailErrMsg} errorId="actor-email-err" value={actorEmail} onFocusChange={(f) => setFieldStates((p) => ({ ...p, actorEmail: f ? 'focused' : p.actorEmail === 'focused' ? 'default' : p.actorEmail }))} onChange={(e) => { setActorEmail(e.target.value); scheduleAutosave({ actorEmail: e.target.value, actorTitle }, 'actorEmail'); }} onBlur={() => { setTouchedFields((p) => ({ ...p, actorEmail: true })); persistState({ actorEmail, actorTitle }, 'actorEmail'); }} placeholder={`VD: ${currentUnit.code.toLowerCase()}@hcmute.edu.vn`} /></FormField>
                    <FormField htmlFor="task-1-role" label="Chức vụ / Vai trò (S_NhatKy)" required state={fieldStates.actorTitle || 'default'} errorMessage={roleErrMsg} errorId="actor-role-err"><TextInput id="task-1-role" type="text" list="hcmute-actor-roles" required errorMessage={roleErrMsg} errorId="actor-role-err" value={actorTitle} onFocusChange={(f) => setFieldStates((p) => ({ ...p, actorTitle: f ? 'focused' : p.actorTitle === 'focused' ? 'default' : p.actorTitle }))} onChange={(e) => { setActorTitle(e.target.value); scheduleAutosave({ actorEmail, actorTitle: e.target.value }, 'actorTitle'); }} onBlur={() => { setTouchedFields((p) => ({ ...p, actorTitle: true })); persistState({ actorEmail, actorTitle }, 'actorTitle'); }} placeholder={`VD: ${currentUnit.headTitleVi} / Thư ký`} /><datalist id="hcmute-actor-roles">{ROLE_PRESETS.map((r) => <option key={r} value={r} />)}</datalist></FormField>
                  </div>
                  <SplitFileNamesPreview unitCode={currentUnit.code} exportDate={customDate} includeZip={includeZip} onCopied={(fn) => pushToast('success', `Đã sao chép: ${fn}`)} />
                </div>
              )}
              {wizardStage === 2 && (
                <div className="space-y-4">
                  <Step1CatalogSelector unitNameVi={currentUnit.nameVi} kind={kind} existingFrameworkIds={positions.map((p) => p.frameworkId)} onAddMultiplePositions={handleAddMultiplePositions} />
                  <div className="flex justify-end"><button type="button" onClick={() => handleStageChange(3, true)} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold cursor-pointer"><span>Sang Chặng 3: Danh sách VTVL (C1, C2)</span><ArrowRight className="w-4 h-4" /></button></div>
                </div>
              )}
              {wizardStage === 3 && <Step1PositionList unitCode={currentUnit.code} positions={positions} forceShowErrors={Boolean(forceShowStageErrors[3])} onUpdateRow={(id, patch) => syncPositions(positions.map((r) => (r.id === id ? { ...r, ...patch } : r)))} onDuplicateRow={(row) => { const seq = positions.length + 1; const baseCode = row.vtvlSuffix.replace(/-\d+$/, ''); syncPositions([...positions, { ...row, id: `pos-${Date.now()}-${seq}`, vtvlSuffix: `${baseCode}-${String(seq).padStart(2, '0')}`, specificName: `${row.specificName} (${seq})` }], currentUnit.code, kind, positions); }} onRequestRemoveRow={(row) => setConfirmAction({ type: 'delete', row })} />}
              {wizardStage === 4 && (
                <Step1Stage4Export currentUnit={currentUnit} kind={kind} scaleMetrics={scaleMetrics} ngachAllocations={ngachAllocations} positions={positions} actorEmail={actorEmail} actorTitle={actorTitle} customDate={customDate} loading={loading} includeZip={includeZip} result={result} stale={stale} onSetIncludeZip={setIncludeZip} onChangeScaleMetrics={(next) => { setScaleMetrics(next); persistState({ scaleMetrics: next }); }} onChangeNgachAllocations={(next) => { setNgachAllocations(next); persistState({ ngachAllocations: next }); }} onPushToPositionStaffCounts={(staffByPos) => { syncPositions(positions.map((p) => (staffByPos[p.id] !== undefined ? { ...p, staffCount: staffByPos[p.id] } : p)), currentUnit.code, kind, positions); }} onJumpToError={(err) => { setForceShowStageErrors((p) => ({ ...p, [err.stage]: true })); if (err.stage === 1) setTouchedFields({ actorEmail: true, actorTitle: true }); handleStageChange(err.stage, false); focusTaskTarget(err.targetId); }} onConfirmExport={() => void handleCreateFiles()} onDownload={(blob, fn) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = fn; a.click(); URL.revokeObjectURL(url); }} />
              )}
              {wizardStage === 5 && (
                <div className="space-y-4">
                  <MergeStepSection unit={currentUnit} />
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                    <button type="button" onClick={() => handleStageChange(4, true)} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[var(--border)] bg-[var(--sheet)] text-sm font-medium cursor-pointer"><ArrowLeft className="w-4 h-4" /><span>Quay lại Chặng 4</span></button>
                    <Link href="/ra-soat" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold shadow-2xs"><span>Sang Kiểm tra 10 biểu &amp; Gửi kết quả</span><ArrowRight className="w-4 h-4" /></Link>
                  </div>
                </div>
              )}
            </section>
            <details className="bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <summary className="cursor-pointer px-4 h-11 text-[13.5px] font-semibold text-[var(--foreground)] flex items-center justify-between"><span className="inline-flex items-center gap-2"><BookOpenCheck className="w-4 h-4 text-[var(--primary)] shrink-0" /><span>Tra cứu Khung 38 vị trí việc làm HCM-UTE [{currentUnit.code}]</span></span><span className="text-xs font-medium text-[var(--primary)] shrink-0">Mở / Đóng</span></summary>
              <div className="p-4 border-t border-[var(--border-subtle)] bg-white"><Hd07OrderGuideCard unit={currentUnit} splitResult={result} /></div>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
