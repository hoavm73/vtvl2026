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
    desc: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    bg: string;
    labelCls: string;
    numCls: string;
    unitCls: string;
    iconCls: string;
  }[] = [
    {
      key: 'chua_gui',
      label: 'Bước 1 · Chưa gửi',
      desc: 'Đang hoàn thiện 10 biểu',
      count: progress.chuaGui,
      icon: FileEdit,
      bg: 'bg-gradient-to-br from-[#f1f5f9] via-[#f8fafc] to-white',
      labelCls: 'text-[#20446c]',
      numCls: 'text-[#004776]',
      unitCls: 'text-[#476885]',
      iconCls: 'text-[#476885]'
    },
    {
      key: 'cho_tham_dinh',
      label: 'Bước 2 · Đã gửi TCNS',
      desc: 'Chờ Phòng TCNS tiếp nhận',
      count: progress.daGuiTcns,
      icon: Send,
      bg: 'bg-gradient-to-br from-[#eef6ff] via-[#f5f9ff] to-white',
      labelCls: 'text-[#20446c]',
      numCls: 'text-[#004776]',
      unitCls: 'text-[#006cee]',
      iconCls: 'text-[#006cee]'
    },
    {
      key: 'dang_tham_dinh',
      label: 'Bước 3 · Đang thẩm định',
      desc: 'Phòng TCNS đang rà soát',
      count: progress.dangThamDinh,
      icon: SearchCheck,
      bg: 'bg-gradient-to-br from-[#ecfeff]/85 via-[#f2f9ff] to-white',
      labelCls: 'text-[#20446c]',
      numCls: 'text-[#004776]',
      unitCls: 'text-[#0072BC]',
      iconCls: 'text-[#0072BC]'
    },
    {
      key: 'can_bo_sung',
      label: 'Bước 3 · Cần bổ sung',
      desc: 'Trả lại đơn vị hoàn thiện',
      count: progress.canBoSung,
      icon: AlertTriangle,
      bg: 'bg-gradient-to-br from-[#fff6e5] via-[#fffaf0] to-white',
      labelCls: 'text-[#8f4f00]',
      numCls: 'text-[#8f4f00]',
      unitCls: 'text-[#8f4f00]',
      iconCls: 'text-[#8f4f00]'
    },
    {
      key: 'dat_yeu_cau',
      label: 'Bước 4 · Đạt & khóa',
      desc: 'Đã chốt số liệu, khóa sửa',
      count: progress.datVaKhoa,
      icon: Lock,
      bg: 'bg-gradient-to-br from-[#e8fbf2] via-[#f3fcf8] to-white',
      labelCls: 'text-[#13653f]',
      numCls: 'text-[#13653f]',
      unitCls: 'text-[#13653f]',
      iconCls: 'text-[#13653f]'
    }
  ];

  return (
    <div aria-label="Tiến độ thẩm định chung toàn trường" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#006cee] shrink-0" />
          <h3 className="text-xs sm:text-sm font-bold text-[#0072BC]">
            Tiến độ thẩm định chung toàn trường ({progress.totalUnits} đơn vị)
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tabular-nums">
          <span className="text-[#476885]">
            Đã gửi: <strong className="text-[#004776]">{loading ? '—' : submittedOrBeyond}/{progress.totalUnits}</strong>
          </span>
          <span className="text-[#cbd5e1]">·</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e8fbf2] border border-[#a7f3d0] text-[#13653f]">
            <Lock className="w-3 h-3" />
            <span>Đạt &amp; khóa: {loading ? '—' : `${progress.datVaKhoa}/${progress.totalUnits} (${progress.approvedPercent}%)`}</span>
          </span>
        </div>
      </div>

      {/* Thanh tiến độ phân đoạn ngang */}
      <div
        role="progressbar"
        aria-valuenow={progress.approvedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Tỷ lệ đơn vị đạt thẩm định và khóa hồ sơ: ${progress.approvedPercent}%`}
        className="w-full h-2 rounded-full bg-[#e2e8f0] overflow-hidden flex"
      >
        {pctLocked > 0 && <div className="h-full bg-[#13653f] transition-all" style={{ width: `${pctLocked}%` }} title={`Đạt & khóa: ${progress.datVaKhoa} đơn vị`} />}
        {pctReviewing > 0 && <div className="h-full bg-[#006cee] transition-all" style={{ width: `${pctReviewing}%` }} title={`Đang thẩm định: ${progress.dangThamDinh} đơn vị`} />}
        {pctSubmitted > 0 && <div className="h-full bg-[#60a5fa] transition-all" style={{ width: `${pctSubmitted}%` }} title={`Đã gửi TCNS: ${progress.daGuiTcns} đơn vị`} />}
        {pctNeedFix > 0 && <div className="h-full bg-[#f59e0b] transition-all" style={{ width: `${pctNeedFix}%` }} title={`Cần bổ sung: ${progress.canBoSung} đơn vị`} />}
      </div>

      {/* Dải 5 khối phẳng ngăn bằng divider, nền gradient pastel đồng bộ với Các con số trọng yếu */}
      <div className="border-y border-[#e2e8f0] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y lg:divide-y-0 divide-x divide-[#e2e8f0]">
        {tiles.map((t) => {
          const Icon = t.icon;
          const clickable = Boolean(onSelectFilter);
          return (
            <button
              key={t.key}
              type="button"
              disabled={!clickable}
              onClick={() => onSelectFilter?.(t.key)}
              className={`text-left p-3.5 sm:p-4 space-y-1.5 transition-colors ${t.bg} ${clickable ? 'cursor-pointer hover:brightness-[0.98]' : 'cursor-default'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-medium truncate ${t.labelCls}`}>{t.label}</span>
                <Icon className={`w-4 h-4 shrink-0 ${t.iconCls}`} />
              </div>
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${t.numCls}`}>
                  {loading ? '—' : t.count}
                </span>
                <span className={`text-xs font-semibold ${t.unitCls}`}>đơn vị</span>
              </div>
              <p className="text-[11px] text-[#476885] leading-snug">{t.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
