'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Copy, Trash2, ChevronRight, ChevronUp, CheckCircle2, AlertTriangle, Edit3, MoreHorizontal, ArrowRight, Info, Layers, Users, Search, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { ProposedVtvlRow, WorkforceMethod } from '@/types/vtvl';
import { ND232_2026_VTVL_CATALOG } from '@/configs/hcmute-nd232-catalog';
import { InfoTip } from '@/components/layout/MilestonesBar';
import { InlineStatus, SaveLifecycleState, ValidationMessage } from '@/components/ui/FormFeedbackPrimitives';
import { TextInput, NumberInput, Select, SearchableSelect } from '@/components/ui/FormInputs';

const METHODS: { value: WorkforceMethod; label: string }[] = [
  { value: 'PP1', label: 'PP1 (Số VTVL áp dụng theo chức danh)' },
  { value: 'PP2', label: 'PP2 (Tính theo khối lượng giờ)' },
  { value: 'PP3', label: 'PP3 (Định mức kiêm nhiệm)' },
  { value: 'PP1+PP2', label: 'PP1+PP2 (Kết hợp chức danh & giờ)' },
  { value: 'PP1+PP3', label: 'PP1+PP3 (Kết hợp chức danh & kiêm nhiệm)' },
  { value: 'PP2+PP3', label: 'PP2+PP3 (Kết hợp giờ & kiêm nhiệm)' }
];

export const SUGGESTED_NGACH_OPTIONS: { code: string; label: string }[] = [
  { code: 'V.07.01.01', label: 'V.07.01.01 — Giảng viên cao cấp (Hạng I)' },
  { code: 'V.07.01.02', label: 'V.07.01.02 — Giảng viên chính (Hạng II)' },
  { code: 'V.07.01.03', label: 'V.07.01.03 — Giảng viên (Hạng III)' },
  { code: 'V.07.01.23', label: 'V.07.01.23 — Trợ giảng (Hạng III)' },
  { code: '01.002 / V.07.01.02', label: '01.002 / V.07.01.02 — Quản lý giữ ngạch CV chính / GV chính' },
  { code: '01.003 / V.07.01.03', label: '01.003 / V.07.01.03 — Quản lý giữ ngạch Chuyên viên / Giảng viên' },
  { code: '01.001', label: '01.001 — Chuyên viên cao cấp' },
  { code: '01.002', label: '01.002 — Chuyên viên chính' },
  { code: '01.003', label: '01.003 — Chuyên viên' },
  { code: '01.004', label: '01.004 — Cán sự' },
  { code: '01.005', label: '01.005 — Nhân viên (Hành chính / Văn thư / Thủ quỹ)' },
  { code: '06.030', label: '06.030 — Kế toán viên chính' },
  { code: '06.031', label: '06.031 — Kế toán viên' },
  { code: 'V.05.01.02', label: 'V.05.01.02 — Nghiên cứu viên chính (Hạng II)' },
  { code: 'V.05.01.03', label: 'V.05.01.03 — Nghiên cứu viên (Hạng III)' },
  { code: 'V.05.02.06', label: 'V.05.02.06 — Kỹ sư chính (Hạng II)' },
  { code: 'V.05.02.07', label: 'V.05.02.07 — Kỹ sư / Kỹ thuật viên (Hạng III)' },
  { code: 'V.10.02.06', label: 'V.10.02.06 — Thư viện viên (Hạng III)' },
  { code: 'V.08.01.03', label: 'V.08.01.03 — Bác sĩ (Hạng III)' },
  { code: 'HĐLĐ-NĐ111', label: 'HĐLĐ-NĐ111 — Hợp đồng lao động phục vụ (NĐ 111/2022)' }
];

interface Step1PositionListProps {
  unitCode: string;
  positions: ProposedVtvlRow[];
  forceShowErrors?: boolean;
  onUpdateRow: (id: string, patch: Partial<ProposedVtvlRow>) => void;
  onDuplicateRow: (row: ProposedVtvlRow) => void;
  onRequestRemoveRow: (row: ProposedVtvlRow) => void;
}

export function isPositionRowValid(pos: ProposedVtvlRow): { valid: boolean; reason?: string } {
  if (!pos.specificName.trim()) return { valid: false, reason: 'Vui lòng nhập tên vị trí việc làm cụ thể tại đơn vị (theo Biểu C1).' };
  if (!pos.vtvlSuffix.trim()) return { valid: false, reason: 'Vui lòng bổ sung mã hậu tố vị trí việc làm (ví dụ: GV-01, CV-01).' };
  if (pos.proposedFte <= 0 || Number.isNaN(pos.proposedFte)) return { valid: false, reason: 'Biên chế đề xuất (FTE tại Biểu C3) phải lớn hơn 0 (tối thiểu 0.5 FTE).' };
  return { valid: true };
}

export function Step1PositionList({ unitCode, positions, forceShowErrors = false, onUpdateRow, onDuplicateRow, onRequestRemoveRow }: Step1PositionListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [dirtyRowIds, setDirtyRowIds] = useState<Record<string, boolean>>({});
  const [rowStatus, setRowStatus] = useState<Record<string, SaveLifecycleState>>({});
  const [touchedRows, setTouchedRows] = useState<Record<string, boolean>>({});
  const [lastPatchByRow, setLastPatchByRow] = useState<Record<string, Partial<ProposedVtvlRow>>>({});
  const snapshotRef = useRef<Record<string, ProposedVtvlRow>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (forceShowErrors) {
      const firstInvalid = positions.find((p) => !isPositionRowValid(p).valid);
      if (firstInvalid) { snapshotRef.current[firstInvalid.id] = { ...firstInvalid }; setExpandedId(firstInvalid.id); }
    }
  }, [forceShowErrors, positions]);

  const filteredPositions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const mapped = positions.map((pos, idx) => ({ pos, idx }));
    if (!q) return mapped;
    return mapped.filter(({ pos }) => `${pos.specificName} ${unitCode}-${pos.vtvlSuffix} ${pos.frameworkTitle} ${pos.ngachCode}`.toLowerCase().includes(q));
  }, [positions, searchQuery, unitCode]);

  const triggerRowChange = (id: string, patch: Partial<ProposedVtvlRow>) => {
    setDirtyRowIds((prev) => ({ ...prev, [id]: true }));
    setLastPatchByRow((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
    setRowStatus((prev) => ({ ...prev, [id]: 'dirty' }));
    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    try {
      onUpdateRow(id, patch);
      timersRef.current[id] = setTimeout(() => {
        setRowStatus((prev) => ({ ...prev, [id]: 'saved' }));
        timersRef.current[`${id}-fade`] = setTimeout(() => setRowStatus((prev) => ({ ...prev, [id]: 'idle' })), 1600);
      }, 220);
    } catch { setRowStatus((prev) => ({ ...prev, [id]: 'error' })); }
  };

  const handleRetryRow = (id: string) => { const patch = lastPatchByRow[id]; if (patch) triggerRowChange(id, patch); };

  const openItemForEdit = (pos: ProposedVtvlRow) => {
    setOpenMenuId(null);
    if (!expandAll && expandedId && expandedId !== pos.id && dirtyRowIds[expandedId]) { setPendingSwitchId(pos.id); return; }
    snapshotRef.current[pos.id] = { ...pos };
    setDirtyRowIds((prev) => ({ ...prev, [pos.id]: false }));
    setPendingSwitchId(null); setExpandedId(pos.id);
  };

  const handleSaveAndCollapse = (id: string, nextExpandId: string | null = null) => {
    setTouchedRows((prev) => ({ ...prev, [id]: true }));
    setDirtyRowIds((prev) => ({ ...prev, [id]: false }));
    setRowStatus((prev) => ({ ...prev, [id]: 'saved' }));
    timersRef.current[`${id}-fade`] = setTimeout(() => setRowStatus((prev) => ({ ...prev, [id]: 'idle' })), 1600);
    setPendingSwitchId(null);
    if (expandAll && nextExpandId === null) setExpandAll(false);
    if (nextExpandId) { const target = positions.find((p) => p.id === nextExpandId); if (target) snapshotRef.current[target.id] = { ...target }; }
    setExpandedId(nextExpandId);
  };

  const handleCancelEdit = (id: string, nextExpandId: string | null = null) => {
    const snap = snapshotRef.current[id];
    if (snap) onUpdateRow(id, snap);
    setDirtyRowIds((prev) => ({ ...prev, [id]: false }));
    setRowStatus((prev) => ({ ...prev, [id]: 'idle' }));
    setPendingSwitchId(null);
    if (expandAll && nextExpandId === null) setExpandAll(false);
    if (nextExpandId) { const target = positions.find((p) => p.id === nextExpandId); if (target) snapshotRef.current[target.id] = { ...target }; }
    setExpandedId(nextExpandId);
  };

  const handleToggleExpandAll = () => {
    if (expandAll) { setExpandAll(false); setExpandedId(null); }
    else { positions.forEach((p) => { snapshotRef.current[p.id] = { ...p }; }); setExpandAll(true); }
  };

  return (
    <div id="task-1-name" className="space-y-3.5" onClick={() => { if (openMenuId) setOpenMenuId(null); }}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center">
          <h3 className="text-base sm:text-lg font-bold text-[var(--foreground)]">Danh sách vị trí việc làm của đơn vị ({positions.length} vị trí)</h3>
          <InfoTip title="Giải thích các ký hiệu chuyên môn">
            <p><strong>Biểu C1 (Danh mục VTVL):</strong> Khai báo tên cụ thể, mã vị trí và bậc nghề nghiệp tại đơn vị.</p>
            <p><strong>Biểu D1 (Nhân sự hiện có):</strong> Số viên chức, người lao động thực tế đang làm việc tại vị trí này.</p>
            <p><strong>Biểu C3 (Nhu cầu nhân sự):</strong> Số biên chế định mức (FTE) đơn vị đề xuất bố trí.</p>
          </InfoTip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--ink-subtle)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="search" aria-label="Tìm nhanh vị trí việc làm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm tên hoặc mã vị trí…" className="rounded-xl border border-[var(--border-subtle)] bg-[var(--sheet)] pl-8 pr-3 py-1.5 text-xs sm:text-sm w-48 sm:w-56" />
          </div>
          <button type="button" onClick={handleToggleExpandAll} className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl border border-[var(--border)] bg-[var(--sheet)] hover:border-[var(--primary)] text-xs font-bold text-[var(--foreground)] cursor-pointer transition-colors">
            {expandAll ? <><ChevronsDownUp className="w-3.5 h-3.5 text-[var(--primary)]" /><span>Thu gọn tất cả</span></> : <><ChevronsUpDown className="w-3.5 h-3.5 text-[var(--primary)]" /><span>Mở tất cả</span></>}
          </button>
        </div>
      </div>

      <datalist id="step1-ngach-datalist">{SUGGESTED_NGACH_OPTIONS.map((opt) => <option key={opt.code} value={opt.code}>{opt.label}</option>)}</datalist>

      <div className="space-y-3.5">
        {filteredPositions.map(({ pos, idx }) => {
          const isExpanded = expandAll || expandedId === pos.id;
          const check = isPositionRowValid(pos);
          const showErr = (touchedRows[pos.id] || forceShowErrors) && !check.valid;
          const st = rowStatus[pos.id] || 'idle';
          const numBadge = String(idx + 1).padStart(2, '0');
          const diffFte = Number((Number(pos.proposedFte || 0) - Number(pos.staffCount || 0)).toFixed(2));
          const isMenuOpen = openMenuId === pos.id;

          const statusPill = st !== 'idle' ? (
            <InlineStatus state={st} savedLabel="Đã cập nhật" onRetry={() => handleRetryRow(pos.id)} />
          ) : check.valid ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--ok-soft)] text-[var(--ok)] text-xs font-bold whitespace-nowrap"><CheckCircle2 className="w-3.5 h-3.5 shrink-0" /><span>Hợp lệ</span></span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--fix-soft)] text-[var(--fix)] text-xs font-bold whitespace-nowrap"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /><span>Cần bổ sung</span></span>
          );

          const moreMenu = (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button type="button" aria-label={`Tùy chọn thêm cho ${pos.specificName}`} aria-expanded={isMenuOpen} onClick={() => setOpenMenuId(isMenuOpen ? null : pos.id)} className="w-10 h-10 min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--sheet)] hover:border-[var(--primary)] text-[var(--ink-muted)] hover:text-[var(--foreground)] cursor-pointer"><MoreHorizontal className="w-4 h-4" /></button>
              {isMenuOpen && (
                <div role="menu" className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl border border-[var(--border)] bg-[var(--sheet)] p-1.5 shadow-lg space-y-1">
                  <button type="button" role="menuitem" onClick={() => { setOpenMenuId(null); onDuplicateRow(pos); }} className="w-full flex items-center gap-2 px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-tint)] hover:text-[var(--primary)] cursor-pointer text-left"><Copy className="w-3.5 h-3.5 text-[var(--primary)]" /><span>Sao chép vị trí</span></button>
                  <button type="button" role="menuitem" disabled={positions.length <= 1} onClick={() => { setOpenMenuId(null); onRequestRemoveRow(pos); }} className="w-full flex items-center gap-2 px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold text-[var(--fix)] hover:bg-[var(--fix-soft)] disabled:opacity-40 cursor-pointer text-left"><Trash2 className="w-3.5 h-3.5" /><span>Xóa vị trí</span></button>
                </div>
              )}
            </div>
          );

          if (!isExpanded) {
            return (
              <div key={pos.id} id={`vtvl-row-${pos.id}`} className={`rounded-2xl border px-4 py-3.5 bg-[var(--sheet)] transition-all duration-150 shadow-2xs ${st === 'saved' ? 'vtvl-row-saved' : showErr ? 'border-[var(--fix)] bg-[var(--fix-soft)]/20' : 'border-[var(--border-subtle)] hover:border-[var(--primary)]/45'}`}>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItemForEdit(pos); } }} onClick={() => openItemForEdit(pos)} className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer text-left">
                    <ChevronRight className="w-4 h-4 text-[var(--ink-subtle)] shrink-0" />
                    <span className="w-9 h-9 rounded-xl bg-[var(--surface-tint)] text-[var(--primary)] font-bold text-sm inline-flex items-center justify-center shrink-0 tabular-nums">{numBadge}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm sm:text-base font-bold text-[var(--foreground)] truncate">{pos.specificName || '(Chưa đặt tên vị trí)'}</div>
                      <div className="text-xs text-[var(--ink-muted)] truncate"><span className="font-semibold text-[var(--foreground)]">{unitCode}-{pos.vtvlSuffix}</span> · Khung Trường: {pos.frameworkTitle}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 sm:gap-4 shrink-0 pt-2.5 lg:pt-0 border-t lg:border-t-0 border-[var(--border-subtle)]">
                    <span className="text-xs sm:text-sm text-[var(--ink-muted)] lg:border-l lg:border-[var(--border-subtle)] lg:pl-4 whitespace-nowrap"><strong className="text-[var(--foreground)]">{pos.method}</strong> · {pos.standardHoursYear.toLocaleString('vi-VN')} giờ/năm</span>
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--foreground)] lg:border-l lg:border-[var(--border-subtle)] lg:pl-4 tabular-nums whitespace-nowrap" title="Hiện có (D1) → Đề xuất (C3)"><span>{pos.staffCount}</span><ArrowRight className="w-3.5 h-3.5 text-[var(--ink-subtle)]" /><span className="text-[var(--primary)]">{pos.proposedFte}</span></span>
                    <div className="lg:border-l lg:border-[var(--border-subtle)] lg:pl-4">{statusPill}</div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => openItemForEdit(pos)} className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl border border-[var(--border)] bg-[var(--sheet)] hover:bg-[var(--surface-tint)] hover:border-[var(--primary)]/50 text-xs sm:text-sm font-bold text-[var(--primary)] cursor-pointer transition-colors"><Edit3 className="w-3.5 h-3.5" /><span>Chỉnh sửa</span></button>
                      {moreMenu}
                    </div>
                  </div>
                </div>
                {showErr && <ValidationMessage id={`desk-err-${pos.id}`} message={check.reason} />}
              </div>
            );
          }

          return (
            <div key={pos.id} id={`vtvl-row-${pos.id}`} onBlur={() => setTouchedRows((p) => ({ ...p, [pos.id]: true }))} className={`rounded-2xl border bg-[var(--sheet)] shadow-sm transition-all duration-150 ${st === 'saved' ? 'vtvl-row-saved' : showErr ? 'border-[var(--fix)]' : 'border-[var(--primary)]/40'}`}>
              <div className="bg-[var(--surface-tint)]/80 px-4 sm:px-5 py-3.5 border-b border-[var(--border-subtle)] rounded-t-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-[var(--primary)]/15 text-[var(--primary)] font-bold text-sm inline-flex items-center justify-center shrink-0 tabular-nums">{numBadge}</span>
                  <span className="hidden sm:block h-8 w-[1px] bg-[var(--border)] shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-base sm:text-lg font-bold text-[var(--foreground)] leading-snug truncate">{pos.specificName || '(Chưa đặt tên vị trí)'}</h4>
                    <p className="text-xs text-[var(--ink-muted)] truncate"><span className="font-semibold text-[var(--foreground)]">{unitCode}-{pos.vtvlSuffix}</span> · Khung Trường: {pos.frameworkTitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {statusPill}
                  <button type="button" onClick={() => handleSaveAndCollapse(pos.id, null)} className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-xl border border-[var(--border)] bg-[var(--sheet)] hover:border-[var(--primary)] text-xs sm:text-sm font-bold text-[var(--foreground)] cursor-pointer"><ChevronUp className="w-4 h-4" /><span>Thu gọn</span></button>
                  {moreMenu}
                </div>
              </div>

              {pendingSwitchId && (
                <div role="alert" className="mx-4 mt-3 rounded-xl border border-[var(--warn)]/45 bg-[var(--warn-soft)] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                  <span className="font-semibold text-[var(--warn)]">Vị trí này có thay đổi vừa chỉnh sửa. Bạn muốn lưu hay hủy trước khi chuyển sang vị trí khác?</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => handleCancelEdit(pos.id, pendingSwitchId)} className="min-h-[34px] px-3 rounded-lg border border-[var(--border)] bg-[var(--sheet)] font-semibold text-[var(--foreground)] cursor-pointer">Hủy thay đổi</button>
                    <button type="button" onClick={() => handleSaveAndCollapse(pos.id, pendingSwitchId)} className="min-h-[34px] px-3 rounded-lg bg-[var(--primary)] text-white font-bold cursor-pointer">Lưu &amp; chuyển tiếp</button>
                  </div>
                </div>
              )}

              <div className="p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                  <div className="lg:col-span-2 flex items-center gap-2 rounded-xl bg-[var(--surface-secondary)] px-3.5 py-3 lg:min-h-[64px] text-xs font-bold uppercase tracking-wide text-[var(--foreground)]"><Info className="w-4 h-4 text-[var(--primary)] shrink-0" /><span>Thông tin vị trí</span></div>
                  <div className="lg:col-span-5"><label htmlFor={`desk-name-${pos.id}`} className="block text-xs font-bold text-[var(--foreground)] mb-1">Tên vị trí việc làm cụ thể tại đơn vị (Biểu C1) <span className="text-[var(--fix)]">*</span></label><TextInput id={`desk-name-${pos.id}`} state={showErr && !pos.specificName.trim() ? 'error' : 'default'} value={pos.specificName} onChange={(e) => triggerRowChange(pos.id, { specificName: e.target.value })} className="font-semibold" /></div>
                  <div className="lg:col-span-3"><label htmlFor={`desk-fw-${pos.id}`} className="block text-xs font-bold text-[var(--foreground)] mb-1">Khung Trường</label><Select id={`desk-fw-${pos.id}`} value={pos.frameworkId} onChange={(e) => { const fw = ND232_2026_VTVL_CATALOG.find((x) => x.maDanhMucNd232 === e.target.value); if (fw) triggerRowChange(pos.id, { frameworkId: fw.maDanhMucNd232, frameworkTitle: fw.positionName, vtvlGroup4: fw.vtvlGroup4, careerLevel: fw.careerLevel, allowedLevels: fw.allowedLevels }); }}>{ND232_2026_VTVL_CATALOG.map((fw) => <option key={fw.maDanhMucNd232} value={fw.maDanhMucNd232}>{fw.positionName}</option>)}</Select></div>
                  <div className="lg:col-span-2"><label htmlFor={`desk-code-${pos.id}`} className="block text-xs font-bold text-[var(--foreground)] mb-1">Mã vị trí đơn vị ({unitCode}-...) <span className="text-[var(--fix)]">*</span></label><div className="flex items-center gap-1.5"><span className="px-2.5 min-h-[44px] inline-flex items-center rounded-xl bg-[var(--surface-secondary)] text-xs font-bold text-[var(--ink-muted)] shrink-0">{unitCode}-</span><TextInput id={`desk-code-${pos.id}`} state={showErr && !pos.vtvlSuffix.trim() ? 'error' : 'default'} value={pos.vtvlSuffix} onChange={(e) => triggerRowChange(pos.id, { vtvlSuffix: e.target.value.toUpperCase() })} className="font-bold text-[var(--primary)]" /></div></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start pt-2 border-t border-[var(--border-subtle)]">
                  <div className="lg:col-span-2 flex items-center gap-2 rounded-xl bg-[var(--surface-secondary)] px-3.5 py-3 lg:min-h-[64px] text-xs font-bold uppercase tracking-wide text-[var(--foreground)]"><Layers className="w-4 h-4 text-[var(--primary)] shrink-0" /><span>Phân loại và định mức</span></div>
                  <div className="lg:col-span-4"><label htmlFor={`desk-ngach-${pos.id}`} className="block text-xs font-bold text-[var(--foreground)] mb-1">Mã ngạch <span className="font-normal text-[var(--ink-muted)]">(mã có sẵn là gợi ý — chọn hoặc tự gõ)</span></label><SearchableSelect id={`desk-ngach-${pos.id}`} value={pos.ngachCode} options={SUGGESTED_NGACH_OPTIONS} datalistId="step1-ngach-datalist" ariaLabelSelect={`Chọn mã ngạch cho vị trí ${pos.specificName}`} ariaLabelInput={`Mã ngạch thực tế của vị trí ${pos.specificName}`} onChange={(val) => triggerRowChange(pos.id, { ngachCode: val })} /></div>
                  <div className="lg:col-span-3"><label htmlFor={`desk-lvl-${pos.id}`} className="block text-xs font-bold text-[var(--foreground)] mb-1">Bậc nghề nghiệp (Phụ lục I)</label><Select id={`desk-lvl-${pos.id}`} data-task="task-1-level" value={pos.careerLevel} disabled={pos.allowedLevels.length <= 1} onChange={(e) => triggerRowChange(pos.id, { careerLevel: e.target.value })}>{pos.allowedLevels.map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}</Select></div>
                  <div className="lg:col-span-3"><label className="block text-xs font-bold text-[var(--foreground)] mb-1">Phương pháp (C3) &amp; Quỹ giờ năm</label><div className="grid grid-cols-2 gap-2"><Select id={`desk-method-${pos.id}`} data-task="task-1-params" value={pos.method} onChange={(e) => triggerRowChange(pos.id, { method: e.target.value as WorkforceMethod })} className="font-bold">{METHODS.map((m) => <option key={m.value} value={m.value}>{m.value}</option>)}</Select><Select id={`desk-hours-${pos.id}`} value={pos.standardHoursYear} onChange={(e) => { const h = Number(e.target.value); triggerRowChange(pos.id, { standardHoursYear: h, workingRegime: h === 1760 ? 'Đặc thù' : 'Phổ biến (40 giờ/tuần)' }); }}><option value={1904}>1.904 giờ/năm</option><option value={1760}>1.760 giờ/năm</option></Select></div></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center pt-2 border-t border-[var(--border-subtle)]">
                  <div className="lg:col-span-2 flex items-center gap-2 rounded-xl bg-[var(--surface-secondary)] px-3.5 py-3 lg:min-h-[64px] text-xs font-bold uppercase tracking-wide text-[var(--foreground)]"><Users className="w-4 h-4 text-[var(--primary)] shrink-0" /><span>Nhân sự</span></div>
                  <div className="lg:col-span-10 flex flex-wrap items-end gap-3 sm:gap-4">
                    <div className="w-28 sm:w-32"><label htmlFor={`desk-staff-${pos.id}`} className="block text-xs font-bold text-[var(--foreground)] mb-1">Hiện có (D1)</label><NumberInput id={`desk-staff-${pos.id}`} data-task="task-1-staff" min={0} max={200} value={pos.staffCount} onChange={(e) => triggerRowChange(pos.id, { staffCount: Math.max(0, parseInt(e.target.value || '0', 10)) })} className="text-center font-bold" /></div>
                    <ArrowRight className="w-4 h-4 text-[var(--ink-subtle)] mb-3.5 shrink-0" />
                    <div className="w-28 sm:w-32"><label htmlFor={`desk-fte-${pos.id}`} className="block text-xs font-bold text-[var(--foreground)] mb-1">Đề xuất (C3)</label><NumberInput id={`desk-fte-${pos.id}`} min={0.5} max={200} step="0.5" state={showErr && pos.proposedFte <= 0 ? 'error' : 'default'} value={pos.proposedFte} onChange={(e) => triggerRowChange(pos.id, { proposedFte: Math.max(0, parseFloat(e.target.value || '0')) })} className="text-center font-bold text-[var(--primary)]" /></div>
                    <span className="hidden sm:block h-10 w-[1px] bg-[var(--border-subtle)] mb-1" />
                    <div className="w-28 sm:w-32"><span className="block text-xs font-bold text-[var(--foreground)] mb-1">Chênh lệch</span><div className={`min-h-[44px] rounded-xl bg-[var(--surface-secondary)] px-3 flex items-center justify-center text-sm font-bold tabular-nums ${diffFte > 0 ? 'text-[var(--primary)]' : diffFte < 0 ? 'text-[var(--warn)]' : 'text-[var(--foreground)]'}`}>{diffFte > 0 ? `+${diffFte}` : diffFte}</div></div>
                  </div>
                </div>
              </div>

              <div className="px-4 sm:px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-secondary)]/45 rounded-b-2xl flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">{showErr && <ValidationMessage id={`desk-err-${pos.id}`} message={check.reason} />}</div>
                <div className="flex items-center gap-2 ml-auto">
                  <button type="button" onClick={() => handleCancelEdit(pos.id, null)} className="min-h-[40px] px-4 rounded-xl border border-[var(--border)] bg-[var(--sheet)] hover:bg-[var(--muted)] text-xs sm:text-sm font-bold text-[var(--foreground)] cursor-pointer">Hủy</button>
                  <button type="button" onClick={() => handleSaveAndCollapse(pos.id, null)} className="min-h-[40px] px-5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-deep)] text-white text-xs sm:text-sm font-bold shadow-2xs cursor-pointer transition-colors">Lưu thay đổi</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
