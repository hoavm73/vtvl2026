'use client';

import React from 'react';
import { Users, Briefcase, Scale } from 'lucide-react';
import { CombinedWorkforceItem } from './workforce-chart-helpers';

export interface WorkforceChartStats {
  totalPositions: number;
  totalRequired: number;
  totalAvailable: number;
  totalAdjustment: number;
  maxHeadcount: number;
  byGroup: { key: string; label: string; color: string; count: number; people: number; pct: number }[];
  laborTypes: { label: string; count: number; pct: number; color: string }[];
}

interface WorkforceChartBodyProps {
  stats: WorkforceChartStats;
  filteredItems: CombinedWorkforceItem[];
}

export function WorkforceChartBody({ stats, filteredItems }: WorkforceChartBodyProps) {
  const kpiItems = [
    {
      label: 'Tổng vị trí (Biểu C1)',
      value: String(stats.totalPositions),
      unit: 'vị trí việc làm',
      desc: 'Danh mục VTVL hiện hành của đơn vị',
      bg: 'bg-gradient-to-br from-[#eef6ff] via-[#f5f9ff] to-white',
      labelCls: 'text-[#20446c]',
      numCls: 'text-[#004776]',
      unitCls: 'text-[#006cee]',
      icon: <Briefcase className="w-4 h-4 text-[#006cee] shrink-0" />
    },
    {
      label: 'Nhu cầu cần bố trí (D2)',
      value: String(stats.totalRequired),
      unit: 'người',
      desc: 'Tổng biên chế cần bố trí theo Cột C',
      bg: 'bg-gradient-to-br from-[#ecfeff]/85 via-[#f2f9ff] to-white',
      labelCls: 'text-[#20446c]',
      numCls: 'text-[#004776]',
      unitCls: 'text-[#0072BC]',
      icon: <Users className="w-4 h-4 text-[#0072BC] shrink-0" />
    },
    {
      label: 'Hiện có có thể bố trí (D2)',
      value: String(stats.totalAvailable),
      unit: 'người',
      desc: 'Nhân lực hiện có đáp ứng theo Cột D',
      bg: 'bg-gradient-to-br from-[#e8fbf2] via-[#f3fcf8] to-white',
      labelCls: 'text-[#13653f]',
      numCls: 'text-[#13653f]',
      unitCls: 'text-[#13653f]',
      icon: <Users className="w-4 h-4 text-[#13653f] shrink-0" />
    },
    {
      label: 'Đề nghị điều chỉnh (D2)',
      value: stats.totalAdjustment > 0 ? `+${stats.totalAdjustment}` : String(stats.totalAdjustment),
      unit: 'người',
      desc: stats.totalAdjustment > 0 ? 'Cần bổ sung thêm nhân lực' : stats.totalAdjustment < 0 ? 'Có nhân lực dôi dư cần điều chuyển' : 'Đang cân đối với nhu cầu',
      bg: stats.totalAdjustment > 0
        ? 'bg-gradient-to-br from-[#fef2f2] via-[#fff7f7] to-white'
        : stats.totalAdjustment < 0
          ? 'bg-gradient-to-br from-[#fff6e5] via-[#fffaf0] to-white'
          : 'bg-gradient-to-br from-[#f1f5f9] via-[#f8fafc] to-white',
      labelCls: stats.totalAdjustment > 0 ? 'text-[#b42318]' : stats.totalAdjustment < 0 ? 'text-[#8f4f00]' : 'text-[#20446c]',
      numCls: stats.totalAdjustment > 0 ? 'text-[#b42318]' : stats.totalAdjustment < 0 ? 'text-[#8f4f00]' : 'text-[#004776]',
      unitCls: stats.totalAdjustment > 0 ? 'text-[#b42318]' : stats.totalAdjustment < 0 ? 'text-[#8f4f00]' : 'text-[#476885]',
      icon: <Scale className={`w-4 h-4 shrink-0 ${stats.totalAdjustment > 0 ? 'text-[#b42318]' : stats.totalAdjustment < 0 ? 'text-[#8f4f00]' : 'text-[#476885]'}`} />
    }
  ];

  return (
    <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 min-h-0 bg-white">
      {/* Dải 4 KPI nền gradient pastel đồng bộ Các con số trọng yếu */}
      <div className="border-y border-[#e2e8f0] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-[#e2e8f0]">
        {kpiItems.map((s) => (
          <div key={s.label} className={`p-3.5 sm:p-4 space-y-1.5 ${s.bg}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-medium ${s.labelCls}`}>{s.label}</span>
              {s.icon}
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${s.numCls}`}>{s.value}</span>
              <span className={`text-xs font-semibold ${s.unitCls}`}>{s.unit}</span>
            </div>
            <p className="text-[11px] text-[#476885] leading-snug">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* 1 & 2. Cơ cấu theo nhóm chức danh & loại nhân lực — chia 2 cột bằng divider */}
      <div className="border-y border-[#e2e8f0] grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#e2e8f0]">
        <div className="py-4 lg:pr-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-[#0072BC]">1. Cơ cấu VTVL theo 03 nhóm chức danh (Biểu C1)</h3>
            <span className="text-xs font-semibold text-[#476885] tabular-nums">{stats.totalPositions} vị trí</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#e2e8f0] overflow-hidden flex">
            {stats.byGroup.map((g) => g.pct > 0 && <div key={g.key} style={{ width: `${g.pct}%`, backgroundColor: g.color }} title={`${g.label}: ${g.count} VTVL (${g.pct}%)`} className="h-full transition-all" />)}
          </div>
          <div className="divide-y divide-[#e2e8f0]">
            {stats.byGroup.map((g) => (
              <div key={g.key} className="py-2 flex items-center justify-between text-xs gap-2">
                <span className="flex items-center gap-2 font-medium text-[#004776]"><span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: g.color }} /><span>{g.label}</span></span>
                <span className="tabular-nums text-[#476885] shrink-0"><strong className="text-[#004776]">{g.count}</strong> VTVL · <strong style={{ color: g.color }}>{g.people}</strong> người ({g.pct}%)</span>
              </div>
            ))}
          </div>
        </div>

        <div className="py-4 lg:pl-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-[#0072BC]">2. Cơ cấu theo loại nhân lực (Biểu C1)</h3>
            <span className="text-xs font-medium text-[#476885]">Chuẩn danh mục C1</span>
          </div>
          <div className="space-y-2.5">
            {stats.laborTypes.map((lt) => (
              <div key={lt.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs"><span className="font-medium text-[#004776]">{lt.label}</span><span className="tabular-nums text-[#476885]"><strong className="text-[#004776]">{lt.count}</strong> VTVL ({lt.pct}%)</span></div>
                <div className="w-full h-2 rounded-full bg-[#e2e8f0] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(lt.count > 0 ? 6 : 0, lt.pct)}%`, backgroundColor: lt.color }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Đối chiếu nhu cầu và nhân lực theo từng VTVL — danh sách phẳng divide-y */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] pb-2.5">
          <h3 className="text-xs sm:text-sm font-bold text-[#0072BC]">3. Đối chiếu nhu cầu cần bố trí và nhân lực có thể bố trí theo từng VTVL (Biểu D2 ↔ C1)</h3>
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-[#004776] font-medium"><span className="w-2.5 h-2.5 rounded-xs bg-[#0072BC]" /> Cần bố trí (D2.C)</span>
            <span className="inline-flex items-center gap-1.5 text-[#004776] font-medium"><span className="w-2.5 h-2.5 rounded-xs bg-[#004776]" /> Có thể bố trí (D2.D)</span>
            <span className="inline-flex items-center gap-1.5 text-[#004776] font-medium"><span className="w-2.5 h-2.5 rounded-xs bg-[#ED1C24]" /> Điều chỉnh / thiếu hụt (D2.G)</span>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#476885]">Không có vị trí việc làm nào khớp điều kiện lọc.</div>
        ) : (
          <div className="divide-y divide-[#e2e8f0] border-b border-[#e2e8f0]">
            {filteredItems.map((item) => {
              const bars = [
                { label: 'Cần bố trí', val: item.canBoTri, pct: Math.round((item.canBoTri / stats.maxHeadcount) * 100), color: 'bg-[#0072BC]', text: 'text-[#0072BC]', h: 'h-2' },
                { label: 'Có thể bố trí', val: item.coTheBoTri, pct: Math.round((item.coTheBoTri / stats.maxHeadcount) * 100), color: 'bg-[#004776]', text: 'text-[#004776]', h: 'h-2' },
                { label: 'Biên chế giao', val: item.bienCheGiao, pct: Math.round((item.bienCheGiao / stats.maxHeadcount) * 100), color: 'bg-[#94a3b8]', text: 'text-[#476885]', h: 'h-1.5' }
              ];
              const adjBadgeCls = item.deNghiDieuChinh > 0
                ? 'bg-[#fdeceb] text-[#b42318] border border-[#f8b4af]'
                : item.deNghiDieuChinh < 0
                  ? 'bg-[#fff6e5] text-[#8f4f00] border border-[#fcd34d]'
                  : 'bg-[#e8fbf2] text-[#13653f] border border-[#a7f3d0]';
              return (
                <div key={item.maVtvl} className="py-3 px-2 hover:bg-[#f8fafc] transition-colors space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-2 py-0.5 rounded-full bg-[#eef5ff] text-[#0072BC] font-bold text-[11px] shrink-0 tabular-nums">{item.maVtvl}</span>
                      <span className="font-bold text-[#004776] truncate" title={item.tenVtvl}>{item.tenVtvl}</span>
                      <span className="text-[#476885] hidden sm:inline text-[11px]">· {item.loaiNhanLuc}</span>
                    </div>
                    <div className="flex items-center gap-2.5 tabular-nums shrink-0 text-xs">
                      <span className="text-[#476885]">Cần: <strong className="text-[#0072BC]">{item.canBoTri}</strong> · Có: <strong className="text-[#004776]">{item.coTheBoTri}</strong></span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${adjBadgeCls}`}>
                        {item.deNghiDieuChinh > 0 ? `+${item.deNghiDieuChinh} bổ sung` : item.deNghiDieuChinh < 0 ? `${item.deNghiDieuChinh} dôi dư` : 'Cân đối (0)'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {bars.map((b) => (
                      <div key={b.label} className="flex items-center gap-2">
                        <span className="w-24 text-[#476885] shrink-0">{b.label}</span>
                        <div className={`flex-1 ${b.h} bg-[#f1f5f9] rounded-full overflow-hidden`}>
                          <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${Math.max(b.val > 0 ? 6 : 0, b.pct)}%` }} />
                        </div>
                        <span className={`w-7 text-right font-bold ${b.text} tabular-nums`}>{b.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
