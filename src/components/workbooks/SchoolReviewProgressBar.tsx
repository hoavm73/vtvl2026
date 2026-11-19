'use client';

import React from 'react';
import { ShieldCheck, Lock, Send, SearchCheck, AlertTriangle, FileEdit } from 'lucide-react';

export interface SchoolReviewProgressStats {
  totalUnits: number;
  chuaGui: number;
  daGuiTcns: number;
  dangThamDinh: number;
  canBoSung: number;
  datVaKhoa: number;
  approvedPercent: number;
}

interface SchoolReviewProgressBarProps {
  progress: SchoolReviewProgressStats;
  loading?: boolean;
  onSelectFilter?: (filter: 'ALL' | 'chua_gui' | 'cho_tham_dinh' | 'dang_tham_dinh' | 'can_bo_sung' | 'dat_yeu_cau') => void;
}

export function SchoolReviewProgressBar({ progress, loading, onSelectFilter }: SchoolReviewProgressBarProps) {
  const total = Math.max(1, progress.totalUnits || 39);
  const pctLocked = Math.round((progress.datVaKhoa / total) * 100);
  const pctReviewing = Math.round((progress.dangThamDinh / total) * 100);
  const pctSubmitted = Math.round((progress.daGuiTcns / total) * 100);
  const pctNeedFix = Math.round((progress.canBoSung / total) * 100);
  const submittedOrBeyond = progress.daGuiTcns + progress.dangThamDinh + progress.canBoSung + progress.datVaKhoa;

  const tiles: {
    key: 'chua_gui' | 'cho_tham_dinh' | 'dang_tham_dinh' | 'can_bo_sung' | 'dat_yeu_cau';
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
    dot: string;
  }[] = [
    {
      key: 'chua_gui',
      label: 'Bước 1 · Chưa gửi',
      count: progress.chuaGui,
      icon: FileEdit,
      tone: 'border-[#e2e8f0] bg-[#f8fafc] text-[#476885]',
      dot: 'bg-[#cbd5e1]'
    },
    {
      key: 'cho_tham_dinh',
      label: 'Bước 2 · Đã gửi TCNS',
      count: progress.daGuiTcns,
      icon: Send,
      tone: 'border-[#bfdbfe] bg-[#eef5ff]/75 text-[#006cee]',
      dot: 'bg-[#60a5fa]'
    },
    {
      key: 'dang_tham_dinh',
      label: 'Bước 3 · Đang thẩm định',
      count: progress.dangThamDinh,
      icon: SearchCheck,
      tone: 'border-[#93c5fd] bg-[#eff6ff] text-[#0072BC]',
      dot: 'bg-[#006cee]'
    },
    {
      key: 'can_bo_sung',
      label: 'Bước 3 · Cần bổ sung',
      count: progress.canBoSung,
      icon: AlertTriangle,
      tone: 'border-[#fcd34d] bg-[#fffbeb] text-[#b45309]',
      dot: 'bg-[#f59e0b]'
    },
    {
      key: 'dat_yeu_cau',
      label: 'Bước 4 · Đạt & khóa hồ sơ',
      count: progress.datVaKhoa,
      icon: Lock,
      tone: 'border-[#86efac] bg-[#ecfdf5] text-[#13653f]',
      dot: 'bg-[#13653f]'
    }
  ];

  return (
    <div
      aria-label="Tiến độ thẩm định chung toàn trường"
      className="rounded-[12px] border border-[#e2e8f0] bg-white px-4 py-3.5 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0072BC] shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-[#0072BC]">
            Tiến độ thẩm định chung toàn trường ({progress.totalUnits} đơn vị)
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
          <span className="text-[#476885]">
            Đã gửi: <strong className="text-[#004776]">{loading ? '—' : submittedOrBeyond}/{progress.totalUnits}</strong>
          </span>
          <span className="text-[#cbd5e1]">·</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ecfdf5] border border-[#a7f3d0] text-[#13653f]">
            <Lock className="w-3 h-3" />
            <span>Đạt &amp; khóa: {loading ? '—' : `${progress.datVaKhoa}/${progress.totalUnits} (${progress.approvedPercent}%)`}</span>
          </span>
        </div>
      </div>

      {/* Thanh tiến độ phân đoạn theo 4 bước thẩm định */}
      <div
        role="progressbar"
        aria-valuenow={progress.approvedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Tỷ lệ đơn vị đạt thẩm định và khóa hồ sơ: ${progress.approvedPercent}%`}
        className="w-full h-2.5 rounded-full bg-[#e2e8f0] overflow-hidden flex"
      >
        {pctLocked > 0 && <div className="h-full bg-[#13653f] transition-all" style={{ width: `${pctLocked}%` }} title={`Đạt & khóa: ${progress.datVaKhoa} đơn vị`} />}
        {pctReviewing > 0 && <div className="h-full bg-[#006cee] transition-all" style={{ width: `${pctReviewing}%` }} title={`Đang thẩm định: ${progress.dangThamDinh} đơn vị`} />}
        {pctSubmitted > 0 && <div className="h-full bg-[#60a5fa] transition-all" style={{ width: `${pctSubmitted}%` }} title={`Đã gửi TCNS: ${progress.daGuiTcns} đơn vị`} />}
        {pctNeedFix > 0 && <div className="h-full bg-[#f59e0b] transition-all" style={{ width: `${pctNeedFix}%` }} title={`Cần bổ sung: ${progress.canBoSung} đơn vị`} />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          const clickable = Boolean(onSelectFilter);
          return (
            <button
              key={t.key}
              type="button"
              disabled={!clickable}
              onClick={() => onSelectFilter?.(t.key)}
              className={`text-left rounded-[10px] border px-3 py-2 flex items-center justify-between gap-2 transition-colors ${t.tone} ${clickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${t.dot}`} />
                  <span className="truncate">{t.label}</span>
                </div>
                <div className="text-base font-extrabold text-[#004776] tabular-nums mt-0.5">
                  {loading ? '—' : t.count} <span className="text-[11px] font-medium text-[#476885]">đơn vị</span>
                </div>
              </div>
              <Icon className="w-4 h-4 shrink-0 opacity-80" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
