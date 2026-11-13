'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, AlertTriangle, Clock, CircleDot, Circle, ArrowLeft, ArrowRight, Save, Loader2, X } from 'lucide-react';
import { ProposedVtvlRow } from '@/types/vtvl';
import { isPositionRowValid } from './Step1PositionList';
import { Step1ValidationError } from './Step1ReviewConfirm';
import { SaveLifecycleState, SaveStatus } from '@/components/ui/FormFeedbackPrimitives';

export type WorkflowStatusKind = 'completed' | 'in_progress' | 'needs_supplement' | 'error' | 'not_started';

export interface StageMetaItem {
  num: 1 | 2 | 3 | 4 | 5;
  stepNum: 1 | 2 | 5 | 6 | 7;
  shortLabel: string;
  fullTitle: string;
  status: WorkflowStatusKind;
}

const STATUS_META: Record<WorkflowStatusKind, { label: string; badgeClass: string; circleClass: string; Icon: React.ComponentType<{ className?: string }> }> = {
  completed: { label: 'Hoàn thành', badgeClass: 'bg-[var(--ok-soft)] text-[var(--ok)] border-[var(--ok)]/30', circleClass: 'bg-[var(--ok)] text-white border-[var(--ok)]', Icon: Check },
  in_progress: { label: 'Đang thực hiện', badgeClass: 'bg-[var(--primary)]/12 text-[var(--primary)] border-[var(--primary)]/35', circleClass: 'bg-[var(--primary)] text-white border-[var(--primary)] ring-4 ring-[var(--primary)]/15', Icon: CircleDot },
  needs_supplement: { label: 'Cần bổ sung', badgeClass: 'bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]/35', circleClass: 'bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn)]', Icon: Clock },
  error: { label: 'Có lỗi', badgeClass: 'bg-[var(--fix-soft)] text-[var(--fix)] border-[var(--fix)]/35', circleClass: 'bg-[var(--fix)] text-white border-[var(--fix)]', Icon: AlertTriangle },
  not_started: { label: 'Chưa thực hiện', badgeClass: 'bg-[var(--muted)] text-[var(--ink-subtle)] border-[var(--border)]', circleClass: 'bg-[var(--sheet)] text-[var(--ink-subtle)] border-[var(--border)]', Icon: Circle }
};

export function StatusBadge({ status, compact = false }: { status: WorkflowStatusKind; compact?: boolean }) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs'} ${meta.badgeClass}`}>
      <Icon className="w-3 h-3 shrink-0" /><span>{meta.label}</span>
    </span>
  );
}

/**
 * Hàm duy nhất xác định trạng thái của 5 Chặng trong Giai đoạn 1.
 * Chỉ duy nhất 1 chặng (currentStage) mang trạng thái "Đang thực hiện".
 * Không báo lỗi đỏ cho các chặng người dùng chưa truy cập trừ khi đã sang Chặng 5 hoặc bấm Kiểm tra toàn hồ sơ.
 */
export function computeStageStatuses(
  currentStage: 1 | 2 | 3 | 4 | 5,
  unitCode: string,
  actorEmail: string,
  actorTitle: string,
  positions: ProposedVtvlRow[],
  validationErrors: Step1ValidationError[],
  visitedStages: number[] = [1]
): StageMetaItem[] {
  const emailTrim = actorEmail.trim();
  const titleTrim = actorTitle.trim();
  const inspectAll = currentStage === 5 || visitedStages.includes(5);

  const evalRawStatus = (num: 1 | 2 | 3 | 4 | 5): WorkflowStatusKind => {
    const isVisited = inspectAll || visitedStages.includes(num);
    if (num === 1) {
      if (!unitCode.trim()) return 'needs_supplement';
      if (!emailTrim && !titleTrim) return isVisited ? 'needs_supplement' : 'not_started';
      if (emailTrim && (!emailTrim.includes('@') || !emailTrim.includes('.'))) return isVisited ? 'error' : 'needs_supplement';
      if (!emailTrim || !titleTrim) return 'needs_supplement';
      return 'completed';
    }
    if (num === 2) return positions.length > 0 ? 'completed' : 'needs_supplement';
    if (num === 3) {
      if (positions.length === 0) return 'not_started';
      if (positions.some((p) => !isPositionRowValid(p).valid)) return isVisited ? 'error' : 'needs_supplement';
      const totalStaff = positions.reduce((s, p) => s + Number(p.staffCount || 0), 0);
      return totalStaff === 0 ? 'needs_supplement' : 'completed';
    }
    if (num === 4) {
      if (!isVisited) return 'not_started';
      if (validationErrors.length > 0) return 'needs_supplement';
      return 'completed';
    }
    return isVisited ? 'completed' : 'not_started';
  };

  const labels: { num: 1 | 2 | 3 | 4 | 5; stepNum: 1 | 2 | 5 | 6 | 7; shortLabel: string; fullTitle: string }[] = [
    { num: 1, stepNum: 1, shortLabel: 'Bước 1: Nhiệm vụ (A1) & Người lập', fullTitle: 'Bước 1/8 (HD 07) — Rà soát chức năng, nhiệm vụ đơn vị (Biểu 1. A1_NhiemVu) & Khai báo người thực hiện (15. S_NhatKy)' },
    { num: 2, stepNum: 2, shortLabel: 'Bước 2: Công việc & SP (A2)', fullTitle: 'Bước 2/8 (HD 07) — Xác định công việc, công đoạn và sản phẩm đầu ra (Biểu 2. A2_CongViec & 11. DM_SAN_PHAM)' },
    { num: 3, stepNum: 5, shortLabel: 'Bước 5: Danh mục VTVL (C1, C2)', fullTitle: 'Bước 5/8 (HD 07) — Đối chiếu danh mục VTVL chuẩn, xây dựng bản mô tả công việc và khung năng lực (Biểu 6. C1 & 7. C2)' },
    { num: 4, stepNum: 6, shortLabel: 'Bước 6: Nhu cầu (C3) & Xuất biểu', fullTitle: 'Bước 6/8 (HD 07) — Xác định số lượng người làm việc cần thiết PP1/PP2/PP3 (Biểu 8. C3_NhuCau) & Xuất bộ 10 biểu gốc' },
    { num: 5, stepNum: 7, shortLabel: 'Bước 7: Đối chiếu D1, Dự báo & Phương án D2', fullTitle: 'Bước 7/8 (HD 07) — Đối chiếu nhân lực (Biểu 9. D1_NhanLuc), Dự báo 5 năm (10. DU_BAO_5_NAM) & Phương án biên chế (11. D2_PhuongAn)' }
  ];

  return labels.map((item) => {
    const raw = evalRawStatus(item.num);
    const status: WorkflowStatusKind = item.num === currentStage ? (raw === 'error' ? 'error' : 'in_progress') : raw;
    return { ...item, status };
  });
}

export function StageStepperBar({
  stages,
  currentStage,
  onSelectStage
}: {
  stages: StageMetaItem[];
  currentStage: 1 | 2 | 3 | 4 | 5;
  onSelectStage: (stage: 1 | 2 | 3 | 4 | 5) => void;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const activeMeta = stages.find((s) => s.num === currentStage) || stages[0];
  const stagePct = Math.round((currentStage / 5) * 100);

  useEffect(() => { if (drawerOpen) closeRef.current?.focus(); }, [drawerOpen]);
  const closeDrawer = () => { setDrawerOpen(false); setTimeout(() => triggerRef.current?.focus(), 40); };

  const handleKeyNav = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' && idx < stages.length - 1) onSelectStage(stages[idx + 1].num);
    if (e.key === 'ArrowLeft' && idx > 0) onSelectStage(stages[idx - 1].num);
  };

  return (
    <nav aria-label="Các chặng trong Giai đoạn 1" className="border-b border-[var(--border-subtle)] pb-2">
      {/* MOBILE COMPACT STEPPER + DRAWER TRIGGER */}
      <div className="sm:hidden flex items-center justify-between gap-3 py-1.5">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--primary)]">
            <span className="truncate">Chặng {currentStage}/5 — {activeMeta.shortLabel}</span>
            <span className="tabular-nums shrink-0 ml-2">{stagePct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--muted)] overflow-hidden" role="progressbar" aria-valuenow={stagePct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[var(--primary)] rounded-full transition-all" style={{ width: `${stagePct}%` }} />
          </div>
        </div>
        <button ref={triggerRef} type="button" aria-expanded={drawerOpen} aria-haspopup="dialog" onClick={() => setDrawerOpen(true)} className="min-h-[44px] px-3 rounded-lg border border-[var(--border)] bg-[var(--sheet)] text-xs font-bold text-[var(--primary)] shrink-0 cursor-pointer">
          Xem các chặng
        </button>
      </div>

      {/* MOBILE BOTTOM SHEET DRAWER FOR 5 STAGES */}
      {drawerOpen && (
        <div role="dialog" aria-modal="true" aria-label="Danh sách 5 chặng trong Giai đoạn 1" onKeyDown={(e) => { if (e.key === 'Escape') closeDrawer(); }} className="sm:hidden fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={closeDrawer}>
          <div className="w-full max-h-[80vh] overflow-y-auto rounded-t-2xl bg-[var(--sheet)] p-4 space-y-3 shadow-xl pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
              <strong className="text-sm font-bold text-[var(--foreground)]">Các chặng trong Giai đoạn 1 ({currentStage}/5)</strong>
              <button ref={closeRef} type="button" aria-label="Đóng danh sách chặng" onClick={closeDrawer} className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-[var(--border)]"><X className="w-4 h-4" /></button>
            </div>
            <ol className="divide-y divide-[var(--border-subtle)]">
              {stages.map((st) => {
                const isCurrent = st.num === currentStage;
                const meta = STATUS_META[st.status];
                return (
                  <li key={st.num}>
                    <button type="button" aria-current={isCurrent ? 'step' : undefined} onClick={() => { onSelectStage(st.num); closeDrawer(); }} className={`w-full flex items-center justify-between gap-3 px-3 py-3 min-h-[48px] text-left rounded-lg cursor-pointer ${isCurrent ? 'bg-[var(--surface-tint)] font-bold text-[var(--primary)]' : ''}`}>
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${st.status === 'completed' ? 'bg-[var(--ok-soft)] text-[var(--ok)]' : st.status === 'error' ? 'bg-[var(--fix)] text-white' : st.status === 'needs_supplement' ? 'bg-[var(--warn-soft)] text-[var(--warn)]' : isCurrent ? 'bg-[var(--primary)] text-white' : 'bg-[var(--muted)] text-[var(--ink-subtle)]'}`}>
                          {st.status === 'completed' ? <Check className="w-3.5 h-3.5" /> : st.status === 'error' ? <AlertTriangle className="w-3.5 h-3.5" /> : st.stepNum}
                        </span>
                        <span className="text-sm truncate">{st.shortLabel}</span>
                      </span>
                      <span className="text-xs text-[var(--ink-muted)] shrink-0">{meta.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {/* DESKTOP HORIZONTAL STEPPER (Không dùng card viền riêng, dùng connector & underline indicator) */}
      <ol className="hidden sm:flex items-center justify-between gap-1 overflow-x-auto">
        {stages.map((st, idx) => {
          const isCurrent = st.num === currentStage;
          const meta = STATUS_META[st.status];
          const isLast = idx === stages.length - 1;
          const stateTextClass = st.status === 'error' ? 'text-[var(--fix)] font-bold' : isCurrent ? 'text-[var(--primary)] font-bold' : st.status === 'completed' ? 'text-[var(--foreground)] font-semibold' : st.status === 'needs_supplement' ? 'text-[var(--warn)] font-semibold' : 'text-[var(--ink-subtle)] font-medium';
          return (
            <li key={st.num} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                aria-selected={isCurrent}
                onKeyDown={(e) => handleKeyNav(e, idx)}
                onClick={() => onSelectStage(st.num)}
                className={`group flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-t-lg border-b-2 transition-colors duration-150 cursor-pointer text-left w-full ${
                  st.status === 'error'
                    ? 'border-[var(--fix)] bg-[var(--fix-soft)]/50'
                    : isCurrent
                      ? 'border-[var(--primary)] bg-[var(--surface-tint)]'
                      : 'border-transparent hover:bg-[var(--surface-secondary)]'
                }`}
              >
                <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                  st.status === 'completed' ? 'bg-[var(--ok-soft)] text-[var(--ok)]' : st.status === 'error' ? 'bg-[var(--fix)] text-white' : st.status === 'needs_supplement' ? 'bg-[var(--warn-soft)] text-[var(--warn)]' : isCurrent ? 'bg-[var(--primary)] text-white' : 'bg-[var(--muted)] text-[var(--ink-subtle)]'
                }`}>
                  {st.status === 'completed' ? <Check className="w-3.5 h-3.5" /> : st.status === 'error' ? <AlertTriangle className="w-3 h-3" /> : st.status === 'needs_supplement' ? <Clock className="w-3 h-3" /> : st.stepNum}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs sm:text-sm leading-tight truncate ${stateTextClass}`}>{st.shortLabel}</span>
                  <span className="hidden lg:block text-[11px] text-[var(--ink-muted)] truncate">{meta.label}</span>
                </span>
              </button>
              {!isLast && <span aria-hidden="true" className={`h-[1.5px] w-3 lg:w-7 shrink-0 mx-1 ${st.status === 'completed' ? 'bg-[var(--ok)]/45' : 'bg-[var(--border-subtle)]'}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StickyActionBar({
  activeStep, wizardStage, lastSavedAt, unitCode, vtvlCount, errorCount, saveLifecycle = 'idle',
  isCheckingContinue = false, continueCheckedOk = false, onPrevStage, onSaveNow, onInspectErrors, onContinue
}: {
  activeStep: number; wizardStage: 1 | 2 | 3 | 4 | 5; lastSavedAt: string; unitCode: string; vtvlCount: number; errorCount: number;
  saveLifecycle?: SaveLifecycleState; isCheckingContinue?: boolean; continueCheckedOk?: boolean;
  onPrevStage: () => void; onSaveNow: () => void; onInspectErrors: () => void; onContinue: () => void;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof window === 'undefined') return;
    const syncHeight = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) document.documentElement.style.setProperty('--sticky-action-height', `${Math.ceil(h)}px`);
    };
    syncHeight();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncHeight) : null;
    ro?.observe(el);
    window.addEventListener('resize', syncHeight);
    return () => { ro?.disconnect(); window.removeEventListener('resize', syncHeight); };
  }, []);

  const isFinalExportBlocked = wizardStage === 4 && errorCount > 0;
  const continueLabel = wizardStage === 1
    ? 'Sang Bước 2 (Công việc A2)'
    : wizardStage === 2
      ? 'Sang Bước 5 (Danh mục C1–C2)'
      : wizardStage === 3
        ? 'Sang Bước 6 (Nhu cầu C3)'
        : wizardStage === 4
          ? (isFinalExportBlocked ? `Còn ${errorCount} mục cần xử lý` : 'Xuất 4 tệp & Sang Bước 7')
          : 'Sang Bước 8 (Kiểm tra K)';
  return (
    <div ref={barRef} className="fixed bottom-0 left-0 right-0 z-40 sticky-action-bar pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center justify-between sm:justify-start gap-3 text-xs text-[var(--ink-muted)]">
          <SaveStatus lifecycle={saveLifecycle} lastSavedAt={lastSavedAt} errorCount={errorCount} onRetrySave={onSaveNow} />
          <span className="hidden md:inline text-[var(--ink-subtle)]">· [{unitCode}] {vtvlCount} vị trí việc làm</span>
          <button type="button" disabled={saveLifecycle === 'saving'} onClick={onSaveNow} className={`inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 ${saveLifecycle === 'dirty' ? 'border border-[var(--warn)] bg-[var(--warn-soft)] text-[var(--warn)] font-bold' : 'text-[var(--primary)] hover:bg-[var(--primary)]/10'}`}>
            <Save className="w-3.5 h-3.5" /><span>{saveLifecycle === 'saved' ? 'Đã lưu' : 'Lưu ngay'}</span>
          </button>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {wizardStage > 1 && (
            <button type="button" onClick={onPrevStage} className="inline-flex items-center justify-center gap-1 min-h-[44px] px-3.5 rounded-xl border border-[var(--border)] bg-[var(--sheet)] text-xs sm:text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer">
              <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Bước trước</span>
            </button>
          )}
          <button type="button" onClick={onInspectErrors} className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border text-xs sm:text-sm font-bold cursor-pointer transition-colors ${errorCount > 0 ? 'border-[var(--fix)]/50 bg-[var(--fix-soft)] text-[var(--fix)]' : 'border-[var(--border)] bg-[var(--sheet)] text-[var(--foreground)] hover:border-[var(--primary)]'}`}>
            {errorCount > 0 ? <><AlertTriangle className="w-4 h-4 shrink-0" /><span>{errorCount} lỗi cần xử lý</span></> : <><Check className="w-4 h-4 text-[var(--ok)] shrink-0" /><span>Kiểm tra dữ liệu</span></>}
          </button>
          <button type="button" disabled={isCheckingContinue || saveLifecycle === 'saving' || isFinalExportBlocked} title={isFinalExportBlocked ? `Vui lòng bổ sung ${errorCount} mục còn thiếu trước khi xuất 4 tệp` : undefined} onClick={onContinue} className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-deep)] text-white text-xs sm:text-sm font-bold cursor-pointer shadow-2xs transition-colors disabled:opacity-55 disabled:cursor-not-allowed">
            {isCheckingContinue ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" /><span>Đang kiểm tra…</span></> : continueCheckedOk ? <><Check className="w-4 h-4 shrink-0" /><span>Hợp lệ</span></> : <><span>{continueLabel}</span><ArrowRight className="w-4 h-4 shrink-0" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
