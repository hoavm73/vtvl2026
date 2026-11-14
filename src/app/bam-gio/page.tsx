'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Timer, Play, Pause, Plus, Download, CheckCircle2, Trash2, ArrowRight, UserCheck, ClipboardList, Edit3 } from 'lucide-react';
import { WorkflowSidebar, InfoTip } from '@/components/layout/MilestonesBar';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { NGACH_LIST_BY_GROUP, TASK_TEMPLATES_BY_GROUP } from '@/configs/hcmute-quotas';
import { buildDefaultSpecificVtvlName } from '@/configs/hcmute-nd232-catalog';
import { TimeSessionRow, ProposedVtvlRow } from '@/types/vtvl';
import { buildPersonalTimerWorkbookFile, exportPersonalTimerWorkbook } from '@/services/excel-split/personal-timer-export';
import { getActiveUnitSession, getRealtimeDateYYYYMMDD, recordActivity, saveActiveUnitSession } from '@/services/telemetry/activity-log';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';

export default function BamGioPage() {
  const [stepMode, setStepMode] = useState<3 | 4>(3);
  const [unitCode, setUnitCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const s = getActiveUnitSession();
      if (s?.unitCode) return findHcmuteUnit(s.unitCode).code;
    }
    return 'CK';
  });
  const [proposedPositions, setProposedPositions] = useState<ProposedVtvlRow[]>([]);
  const [customPositionNames, setCustomPositionNames] = useState<Record<string, string>>({});
  const [customCareerLevels, setCustomCareerLevels] = useState<Record<string, string>>({});
  const [performerTitle, setPerformerTitle] = useState<string>('Giảng viên chính');
  const [selectedVtvlSuffix, setSelectedVtvlSuffix] = useState<string>('DT-GV-02');
  const [sessions, setSessions] = useState<TimeSessionRow[]>([]);
  const [statusBanner, setStatusBanner] = useState<string>('');
  const [inputMode, setInputMode] = useState<'live' | 'manual'>('live');
  const [activeTaskCode, setActiveTaskCode] = useState<string>('');
  const [running, setRunning] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [productCountInput, setProductCountInput] = useState<number>(1);
  const [manualDate, setManualDate] = useState<string>(() => getRealtimeDateYYYYMMDD());
  const [manualStart, setManualStart] = useState<string>('08:00');
  const [manualEnd, setManualEnd] = useState<string>('10:30');
  const [manualProducts, setManualProducts] = useState<number>(1);
  const [b2Impacts, setB2Impacts] = useState<Record<string, { factor: string; digitalLevel: string; adjustPct: number; note: string }>>({});

  const unit = useMemo(() => findHcmuteUnit(unitCode), [unitCode]);

  const syncFromSession = () => {
    const saved = getActiveUnitSession();
    const matched = findHcmuteUnit(saved.unitCode);
    setUnitCode(matched.code); setProposedPositions(saved.proposedPositions || []); setCustomPositionNames(saved.customPositionNames || {});
    setCustomCareerLevels(saved.customCareerLevels || {}); setManualDate(saved.customDate || getRealtimeDateYYYYMMDD()); setSessions(saved.timeSessions || []);
    if (saved.proposedPositions && saved.proposedPositions.length > 0) {
      setSelectedVtvlSuffix((cur) => (saved.proposedPositions.some((p) => p.vtvlSuffix === cur) ? cur : saved.proposedPositions[0].vtvlSuffix));
    } else if (TASK_TEMPLATES_BY_GROUP[matched.group]?.length > 0) setSelectedVtvlSuffix(TASK_TEMPLATES_BY_GROUP[matched.group][0].vtvlSuffix);
  };

  useEffect(() => {
    syncFromSession();
    const syncUrlStep = () => setStepMode(new URLSearchParams(window.location.search).get('step') === '4' ? 4 : 3);
    syncUrlStep(); window.addEventListener('popstate', syncUrlStep);
    const onFocusTask = (e: Event) => {
      const detail = (e as CustomEvent<{ step: number; taskId: string }>).detail;
      if (detail?.taskId === 'task-3-manual') { setStepMode(3); setInputMode('manual'); }
      if (detail?.taskId === 'task-3-timer') { setStepMode(3); setInputMode('live'); }
      if (detail?.taskId === 'task-3-export') setStepMode(4);
    };
    window.addEventListener('vtvl-unit-session-updated', syncFromSession); window.addEventListener('storage', syncFromSession); window.addEventListener('vtvl-focus-task', onFocusTask);
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('hcmute_vtvl_realtime') : null;
    if (bc) bc.onmessage = () => syncFromSession();
    return () => { window.removeEventListener('popstate', syncUrlStep); window.removeEventListener('vtvl-unit-session-updated', syncFromSession); window.removeEventListener('storage', syncFromSession); window.removeEventListener('vtvl-focus-task', onFocusTask); bc?.close(); };
  }, []);

  const handleSwitchStep = (next: 3 | 4) => {
    setStepMode(next); if (typeof window !== 'undefined') window.history.replaceState(null, '', `/bam-gio?step=${next}`);
  };

  const tasksOfUnit = useMemo(() => TASK_TEMPLATES_BY_GROUP[unit.group].map((t) => {
    const cleanSuffix = t.taskSuffix.replace(/^[A-Za-z0-9_]+-/, '');
    const cleanVtvl = t.vtvlSuffix.replace(/^[A-Za-z0-9_]+-/, '');
    return { ...t, fullVtvlCode: `${unit.code}-${cleanVtvl}`, fullTaskCode: `${unit.code}-${cleanSuffix}` };
  }), [unit]);

  const vtvlOptions = useMemo(() => {
    if (proposedPositions.length > 0) return proposedPositions.map((p) => {
      const cleanSuffix = p.vtvlSuffix.replace(/^[A-Za-z0-9_]+-/, '');
      return { suffix: p.vtvlSuffix, code: `${unit.code}-${cleanSuffix}`, name: p.specificName, level: p.careerLevel, ngachCode: p.ngachCode };
    });
    const ngachList = NGACH_LIST_BY_GROUP[unit.group];
    const map = new Map<string, { suffix: string; code: string; name: string; level: string; ngachCode: string }>();
    tasksOfUnit.forEach((t) => {
      if (!map.has(t.vtvlSuffix)) {
        const cleanSuffix = t.vtvlSuffix.replace(/^[A-Za-z0-9_]+-/, '');
        const ngach = ngachList.find((n) => n.code === t.ngachCode);
        const fwTitle = ngach?.frameworkTitle || ngach?.name || t.vtvlName;
        const defaultName = ngach ? buildDefaultSpecificVtvlName(fwTitle, unit.nameVi, ngach.specificNameSuffix, unit.group) : t.vtvlName;
        const specificName = ngach ? customPositionNames[ngach.code] ?? defaultName : t.vtvlName;
        const careerLevel = ngach ? customCareerLevels[ngach.code] ?? ngach.defaultCareerLevel ?? 'Bậc 3' : 'Bậc 3';
        map.set(t.vtvlSuffix, { suffix: t.vtvlSuffix, code: `${unit.code}-${cleanSuffix}`, name: specificName, level: careerLevel, ngachCode: t.ngachCode });
      }
    });
    return Array.from(map.values());
  }, [proposedPositions, tasksOfUnit, unit, customPositionNames, customCareerLevels]);

  const tasksForPosition = useMemo(() => {
    const direct = tasksOfUnit.filter((t) => t.vtvlSuffix === selectedVtvlSuffix);
    const selectedOpt = vtvlOptions.find((v) => v.suffix === selectedVtvlSuffix);
    const byNgach = selectedOpt ? tasksOfUnit.filter((t) => t.ngachCode === selectedOpt.ngachCode) : [];
    const base = direct.length > 0 ? direct : byNgach.length > 0 ? byNgach : tasksOfUnit.slice(0, 2);
    const clean = selectedVtvlSuffix.replace(/^[A-Za-z0-9_]+-/, '');
    return base.map((t) => ({ ...t, fullVtvlCode: `${unit.code}-${clean}` }));
  }, [tasksOfUnit, selectedVtvlSuffix, vtvlOptions, unit.code]);

  useEffect(() => {
    if (tasksForPosition.length > 0) setActiveTaskCode(tasksForPosition[0].fullTaskCode);
    const currentOpt = vtvlOptions.find((v) => v.suffix === selectedVtvlSuffix);
    if (currentOpt) setPerformerTitle(`${currentOpt.name} (${currentOpt.level})`);
  }, [tasksForPosition, selectedVtvlSuffix, vtvlOptions]);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [running]);

  const formatTimer = (sec: number) => `${String(Math.floor(sec / 3600)).padStart(2, '0')}:${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const activeTask = useMemo(() => tasksForPosition.find((t) => t.fullTaskCode === activeTaskCode) || tasksForPosition[0], [tasksForPosition, activeTaskCode]);
  const measuredTaskCount = useMemo(() => {
    const codes = new Set(sessions.map((s) => s.taskCode));
    return tasksForPosition.filter((t) => codes.has(t.fullTaskCode)).length;
  }, [sessions, tasksForPosition]);

  const commitSessions = (nextSessions: TimeSessionRow[]) => {
    setSessions(nextSessions);
    saveActiveUnitSession({ unitCode: unit.code, timeSessions: nextSessions });
    if (nextSessions.length > 0) buildPersonalTimerWorkbookFile(unit, selectedVtvlSuffix, performerTitle, tasksForPosition, nextSessions, manualDate);
  };

  const handleFinishLiveTimer = () => {
    if (!activeTask) return;
    const durationMin = Math.max(1, Math.round(elapsedSec / 60)); const prods = Math.max(1, productCountInput);
    const minPerProd = Number((durationMin / prods).toFixed(1)); const runNum = sessions.filter((s) => s.taskCode === activeTask.fullTaskCode).length + 1;
    const now = new Date(); const endStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    commitSessions([...sessions, { id: `${Date.now()}`, taskCode: activeTask.fullTaskCode, taskName: activeTask.taskName, runNumber: runNum, date: manualDate, startTime: 'Đo trực tiếp', endTime: endStr, durationMinutes: durationMin, productCount: prods, minutesPerProduct: minPerProd, performerTitle }]);
    setRunning(false); setElapsedSec(0); setStatusBanner(`Đã lưu phiên đo thực tế mã ${activeTask.fullTaskCode} (${minPerProd} phút/SP).`);
  };

  const handleAddManualSession = (e: React.FormEvent) => {
    e.preventDefault(); if (!activeTask) return;
    const [sh, sm] = manualStart.split(':').map(Number); const [eh, em] = manualEnd.split(':').map(Number);
    const durationMin = Math.max(5, eh * 60 + em - (sh * 60 + sm)); const prods = Math.max(1, manualProducts);
    const minPerProd = Number((durationMin / prods).toFixed(1)); const runNum = sessions.filter((s) => s.taskCode === activeTask.fullTaskCode).length + 1;
    commitSessions([...sessions, { id: `${Date.now()}`, taskCode: activeTask.fullTaskCode, taskName: activeTask.taskName, runNumber: runNum, date: manualDate, startTime: manualStart, endTime: manualEnd, durationMinutes: durationMin, productCount: prods, minutesPerProduct: minPerProd, performerTitle }]);
    setStatusBanner(`Đã lưu bản ghi ${activeTask.fullTaskCode} (${minPerProd} phút/SP).`);
  };

  const handleExport = () => {
    const fileName = exportPersonalTimerWorkbook(unit, selectedVtvlSuffix, performerTitle, tasksForPosition, sessions, manualDate);
    saveActiveUnitSession({ unitCode: unit.code, timeSessions: sessions });
    recordActivity(unit.code, unit.nameVi, 'BAM_GIO', `Kết xuất phiếu kê khai định mức thời gian: ${fileName}`);
    setStatusBanner(`Đã xuất tệp ${fileName} thành công.`);
  };

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 lg:px-6 py-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start min-w-0">
        <WorkflowSidebar activeStep={stepMode} onSelectStep={(s) => { if (s === 3 || s === 4) handleSwitchStep(s); }} unitCode={unit.code} />
        <div className="flex-1 w-full space-y-4 min-w-0">
          <section className="bg-white rounded-xl border border-[var(--border)] p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white font-semibold text-xs flex items-center justify-center shrink-0">{stepMode}</span>
                <h1 className="text-lg sm:text-xl font-semibold text-[var(--foreground)]">
                  {stepMode === 3
                    ? 'Bước 3/8 — Số lượng sản phẩm & thời gian (Biểu B1_KhoiLuong)'
                    : 'Bước 4/8 — Tác động chuyển đổi số, tự chủ (Biểu B2_CT → B2)'}
                </h1>
                <InfoTip title="Hướng dẫn Bước 3 & Bước 4">
                  <p>Mỗi bản ghi được lưu trực tiếp vào phiên làm việc và tự động chuyển thành phiếu khảo sát tại Bước 7.</p>
                </InfoTip>
              </div>
              <div className="inline-flex rounded-lg bg-[var(--surface-secondary)] p-1 border border-[var(--border-subtle)]">
                <button type="button" onClick={() => handleSwitchStep(3)} className={`h-8 px-3 rounded-md text-xs font-semibold cursor-pointer transition-colors ${stepMode === 3 ? 'bg-[var(--primary)] text-white' : 'text-[var(--foreground)] hover:text-[var(--primary)]'}`}>Biểu 4: B1_KhoiLuong</button>
                <button type="button" onClick={() => handleSwitchStep(4)} className={`h-8 px-3 rounded-md text-xs font-semibold cursor-pointer transition-colors ${stepMode === 4 ? 'bg-[var(--primary)] text-white' : 'text-[var(--foreground)] hover:text-[var(--primary)]'}`}>Biểu 5: B2_CT_TacDong</button>
              </div>
            </div>

            {statusBanner && <div role="status" aria-live="polite" className="rounded-lg border border-[var(--ok)]/40 bg-[var(--ok-soft)] px-3 py-2 text-xs font-medium text-[var(--ok)]">✓ {statusBanner}</div>}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center py-1">
              <div className="md:col-span-8 flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <UserCheck className="w-4 h-4 text-[var(--primary)] shrink-0" />
                  <ShadcnSelect id="task-3-vtvl" ariaLabel="Chọn vị trí việc làm cần đo" value={selectedVtvlSuffix} onValueChange={setSelectedVtvlSuffix} options={vtvlOptions.map((v) => ({ value: v.suffix, label: `${v.code} · ${v.name} (${v.level})` }))} size="md" />
                </div>
                <input type="text" aria-label="Chức danh và bậc kê khai" value={performerTitle} onChange={(e) => setPerformerTitle(e.target.value)} className="sm:w-44 h-10 rounded-lg border border-[#cbd5e1] bg-white px-2.5 text-xs font-medium text-[var(--ink-muted)]" />
              </div>
              <div className="md:col-span-4 md:border-l md:border-[var(--border-subtle)] md:pl-3 space-y-1">
                <div className="text-xs font-medium text-[var(--foreground)]">{measuredTaskCount}/{tasksForPosition.length} công việc đã đo</div>
                <div className="h-1.5 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden"><div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${Math.max(12, Math.round((measuredTaskCount / Math.max(1, tasksForPosition.length)) * 100))}%` }} /></div>
              </div>
            </div>

            {stepMode === 3 ? (
              <>
                {activeTask && (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--surface-tint)] px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="min-w-0"><span className="font-semibold text-xs text-[var(--primary)]">{activeTask.fullTaskCode}</span><p className="text-xs sm:text-sm font-medium text-[var(--foreground)]">{activeTask.taskName}</p></div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--foreground)] shrink-0"><Timer className="w-4 h-4 text-[var(--primary)]" /><span className="tabular-nums">{activeTask.defaultMinutesPerProduct.toLocaleString('vi-VN')} phút/SP</span></div>
                    </div>
                    {tasksForPosition.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-[var(--ink-muted)]">Đổi việc:</span>
                        {tasksForPosition.map((t) => <button key={t.fullTaskCode} type="button" aria-pressed={activeTaskCode === t.fullTaskCode} onClick={() => setActiveTaskCode(t.fullTaskCode)} className={`px-2 py-0.5 rounded-md text-xs font-semibold border cursor-pointer ${activeTaskCode === t.fullTaskCode ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white text-[var(--foreground)] border-[#cbd5e1]'}`}>{t.fullTaskCode}</button>)}
                      </div>
                    )}
                  </div>
                )}
                <div className="inline-flex rounded-lg bg-[var(--surface-secondary)] p-1 border border-[var(--border-subtle)]">
                  <button type="button" onClick={() => setInputMode('live')} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold cursor-pointer ${inputMode === 'live' ? 'bg-[var(--primary)] text-white shadow-2xs' : 'text-[var(--foreground)]'}`}><Timer className="w-3.5 h-3.5" /><span>Đo trực tiếp</span></button>
                  <button type="button" onClick={() => setInputMode('manual')} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold cursor-pointer ${inputMode === 'manual' ? 'bg-[var(--primary)] text-white shadow-2xs' : 'text-[var(--foreground)]'}`}><Edit3 className="w-3.5 h-3.5" /><span>Nhập thủ công</span></button>
                </div>
                <div className={inputMode === 'live' ? 'rounded-xl bg-[var(--surface-tint)]/70 border border-[var(--primary)]/20 p-4 grid grid-cols-1 md:grid-cols-12 items-center gap-3' : 'sr-only'}>
                  <div className="md:col-span-5 text-center space-y-0.5"><div className="text-xs font-medium text-[var(--ink-muted)]">Đồng hồ đo</div><div className="text-3xl font-semibold text-[var(--foreground)] tracking-wider tabular-nums">{formatTimer(elapsedSec)}</div></div>
                  <div className="md:col-span-3 md:border-l md:border-[var(--border-subtle)] md:pl-4 space-y-1"><label htmlFor="live-prod-count" className="block text-xs font-medium text-[var(--ink-muted)]">Số sản phẩm</label><input id="live-prod-count" type="number" min={1} value={productCountInput} onChange={(e) => setProductCountInput(Math.max(1, parseInt(e.target.value || '1', 10)))} className="w-full h-10 rounded-lg border border-[#cbd5e1] bg-white px-3 text-sm font-semibold tabular-nums" /></div>
                  <div className="md:col-span-4 flex items-center justify-end gap-2">
                    <button id="task-3-timer" type="button" onClick={() => setRunning(!running)} className="h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5">{running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}<span>{running ? 'Tạm dừng' : 'Bắt đầu'}</span></button>
                    <button type="button" onClick={handleFinishLiveTimer} className="h-10 px-4 rounded-lg bg-[var(--ok)] text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /><span>Ghi nhận</span></button>
                  </div>
                </div>
                <form onSubmit={handleAddManualSession} className={inputMode === 'manual' ? 'rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] p-3.5 grid grid-cols-2 sm:grid-cols-5 gap-2.5 items-end' : 'sr-only'}>
                  <div><label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">Ngày thực hiện</label><input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="w-full h-10 rounded-lg border border-[#cbd5e1] bg-white px-2.5 text-xs" /></div>
                  <div><label htmlFor="task-3-manual" className="block text-xs font-medium text-[var(--ink-muted)] mb-1">Giờ bắt đầu</label><input id="task-3-manual" type="time" value={manualStart} onChange={(e) => setManualStart(e.target.value)} className="w-full h-10 rounded-lg border border-[#cbd5e1] bg-white px-2.5 text-xs" /></div>
                  <div><label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">Giờ kết thúc</label><input type="time" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} className="w-full h-10 rounded-lg border border-[#cbd5e1] bg-white px-2.5 text-xs" /></div>
                  <div><label className="block text-xs font-medium text-[var(--ink-muted)] mb-1">Số sản phẩm</label><input type="number" min={1} value={manualProducts} onChange={(e) => setManualProducts(Math.max(1, parseInt(e.target.value || '1', 10)))} className="w-full h-10 rounded-lg border border-[#cbd5e1] bg-white px-2.5 text-xs font-semibold tabular-nums" /></div>
                  <button type="submit" className="col-span-2 sm:col-span-1 h-10 rounded-lg bg-[var(--primary)] text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"><Plus className="w-4 h-4" /><span>Thêm</span></button>
                </form>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--foreground)]"><div className="flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-[var(--primary)]" /><span>Nhật ký định mức B1 — {sessions.length} bản ghi</span></div></div>
                  {sessions.length === 0 ? (
                    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4 text-center text-xs text-[var(--ink-muted)]">Chưa có bản ghi đo định mức B1 nào.</div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] max-h-60">
                      <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 z-10"><tr className="bg-[var(--surface-secondary)] border-b border-[var(--border-subtle)]"><th className="py-2 px-3 text-left">Mã CV</th><th className="py-2 px-3 text-left">Lượt</th><th className="py-2 px-3 text-left">Thời gian</th><th className="py-2 px-3 text-right">Phút</th><th className="py-2 px-3 text-right">SP</th><th className="py-2 px-3 text-right">Phút/SP</th><th className="py-2 px-3 text-center">Xóa</th></tr></thead>
                        <tbody className="divide-y divide-[var(--border-subtle)] bg-white">
                          {sessions.map((s) => (<tr key={s.id}><td className="py-1.5 px-3 font-medium text-[var(--primary)]">{s.taskCode}</td><td className="py-1.5 px-3 tabular-nums">Lần {s.runNumber}</td><td className="py-1.5 px-3">{s.startTime} – {s.endTime}</td><td className="py-1.5 px-3 text-right tabular-nums">{s.durationMinutes}</td><td className="py-1.5 px-3 text-right tabular-nums">{s.productCount}</td><td className="py-1.5 px-3 text-right font-semibold text-[var(--ok)] tabular-nums">{s.minutesPerProduct}</td><td className="py-1.5 px-3 text-center"><button type="button" onClick={() => commitSessions(sessions.filter((x) => x.id !== s.id))} aria-label={`Xóa bản ghi ${s.taskCode}`} className="text-[var(--fix)] hover:opacity-80 cursor-pointer"><Trash2 className="w-3.5 h-3.5 inline" /></button></td></tr>))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
                    <Link href="/tao-tep?step=2" className="text-xs font-medium text-[var(--primary)] hover:underline">← Quay lại Bước 2 (A2)</Link>
                    <button type="button" onClick={() => handleSwitchStep(4)} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold cursor-pointer"><span>Sang Bước 4: Tác động CĐS (B2_CT → B2)</span><ArrowRight className="w-4 h-4" /></button>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-10"><tr className="bg-[var(--surface-secondary)] border-b border-[var(--border-subtle)]"><th className="py-2 px-3 text-left">Mã &amp; Tên công việc (A2)</th><th className="py-2 px-3 text-left">Yếu tố tác động (B2_CT)</th><th className="py-2 px-3 text-left">Mức độ số hóa</th><th className="py-2 px-3 text-right">Điều chỉnh (%)</th><th className="py-2 px-3 text-right">Định mức mới (B2)</th><th className="py-2 px-3 text-left">Phần mềm / Minh chứng</th></tr></thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] bg-white">
                      {tasksForPosition.map((t) => {
                        const row = b2Impacts[t.fullTaskCode] || { factor: 'Số hóa', digitalLevel: 'Một phần', adjustPct: -10, note: 'Hệ thống phần mềm quản trị HCM-UTE' };
                        const newMinutes = Math.max(1, Math.round(t.defaultMinutesPerProduct * (1 + row.adjustPct / 100)));
                        const updateRow = (patch: Partial<typeof row>) => setB2Impacts((p) => ({ ...p, [t.fullTaskCode]: { ...row, ...patch } }));
                        return (
                          <tr key={t.fullTaskCode}>
                            <td className="py-2 px-3 align-middle"><span className="font-medium text-[var(--primary)] block">{t.fullTaskCode}</span><span>{t.taskName}</span></td>
                            <td className="py-2 px-3 align-middle"><ShadcnSelect value={row.factor} onValueChange={(v) => updateRow({ factor: v })} options={['Số hóa', 'Cải tiến quy trình', 'Thuê dịch vụ/đặt hàng', 'Tự chủ', 'Xã hội hóa', 'Công việc mới phát sinh'].map((x) => ({ value: x, label: x }))} size="cell-comfortable" /></td>
                            <td className="py-2 px-3 align-middle"><ShadcnSelect value={row.digitalLevel} onValueChange={(v) => updateRow({ digitalLevel: v })} options={['Toàn trình', 'Một phần', 'Chưa số hóa'].map((x) => ({ value: x, label: x }))} size="cell-comfortable" /></td>
                            <td className="py-2 px-3 text-right align-middle"><ShadcnSelect value={String(row.adjustPct)} onValueChange={(v) => updateRow({ adjustPct: Number(v) })} options={[-30, -20, -15, -10, 0, 10].map((x) => ({ value: String(x), label: `${x > 0 ? '+' : ''}${x}%` }))} size="cell-comfortable" /></td>
                            <td className="py-2 px-3 text-right align-middle font-semibold text-[var(--ok)] tabular-nums">{newMinutes} phút/SP</td>
                            <td className="py-2 px-3 align-middle"><input type="text" value={row.note} onChange={(e) => updateRow({ note: e.target.value })} className="w-full min-w-[140px] h-9 rounded-md border border-[#cbd5e1] bg-white px-2 text-xs font-normal" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
                  <button type="button" onClick={() => handleSwitchStep(3)} className="text-xs font-medium text-[var(--primary)] hover:underline cursor-pointer text-left">← Quay lại Bước 3 (B1)</button>
                  <div className="flex flex-wrap items-center gap-2">
                    <button id="task-3-export" type="button" onClick={handleExport} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[#cbd5e1] bg-white text-[var(--primary)] font-medium text-xs cursor-pointer"><Download className="w-4 h-4 shrink-0" /><span>Xuất phiếu khảo sát B1–B2</span></button>
                    <Link href="/tao-tep?step=5" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold"><span>Sang Bước 5: C1, C2</span><ArrowRight className="w-4 h-4" /></Link>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
