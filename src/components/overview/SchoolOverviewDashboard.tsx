'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2, Briefcase, CheckCircle2, Clock,
  ShieldCheck, Layers, Landmark, GraduationCap, Building, ArrowRight, FileText
} from 'lucide-react';
import { HCMUTE_UNITS, UNIT_GROUPS } from '@/configs/hcmute-units';
import { buildRecommendedC1Rows } from '@/configs/hcmute-pl1-builder';

interface OverviewStats {
  totalUnits: number;
  totalPositions: number;
  appliedPositions: number;
  approvedPositions: number;
  pendingPositions: number;
  draftPositions: number;
  totalTickets: number;
}

const DEFAULT_C1_TOTAL = HCMUTE_UNITS.reduce(
  (sum, u) => sum + buildRecommendedC1Rows(u.code, u.group).length,
  0
);

export function SchoolOverviewDashboard() {
  const [stats, setStats] = useState<OverviewStats>({
    totalUnits: HCMUTE_UNITS.length,
    totalPositions: DEFAULT_C1_TOTAL,
    appliedPositions: 0,
    approvedPositions: 0,
    pendingPositions: 0,
    draftPositions: 0,
    totalTickets: 0
  });

  const fetchRealtimeStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats/overview', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setStats({
          totalUnits: data.totalUnits || HCMUTE_UNITS.length,
          totalPositions: data.totalPositions || DEFAULT_C1_TOTAL,
          appliedPositions: data.appliedPositions ?? data.approvedPositions ?? 0,
          approvedPositions: data.approvedPositions ?? 0,
          pendingPositions: data.pendingPositions ?? 0,
          draftPositions: data.draftPositions ?? 0,
          totalTickets: data.totalTickets ?? ((data.approvedPositions ?? 0) + (data.pendingPositions ?? 0) + (data.draftPositions ?? 0))
        });
      }
    } catch {
      // ignore network error
    }
  }, []);

  useEffect(() => {
    fetchRealtimeStats();
    const timer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchRealtimeStats();
      }
    }, 10000);

    const onRefresh = () => { void fetchRealtimeStats(); };
    window.addEventListener('focus', onRefresh);
    window.addEventListener('vtvl-activity-updated', onRefresh);
    window.addEventListener('vtvl-operator-changed', onRefresh);
    window.addEventListener('storage', onRefresh);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('hcmute_vtvl_realtime');
      bc.onmessage = onRefresh;
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onRefresh);
      window.removeEventListener('vtvl-activity-updated', onRefresh);
      window.removeEventListener('vtvl-operator-changed', onRefresh);
      window.removeEventListener('storage', onRefresh);
      bc?.close();
    };
  }, [fetchRealtimeStats]);

  const unitGroupStats = UNIT_GROUPS.map((g) => ({
    ...g,
    count: HCMUTE_UNITS.filter((u) => u.group === g.id).length
  }));

  const getGroupIcon = (id: string) => {
    switch (id) {
      case 'khoa-vien':
        return GraduationCap;
      case 'phong-ban':
        return Landmark;
      case 'trung-tam':
        return Building2;
      default:
        return Building;
    }
  };

  return (
    <section className="bg-white rounded-[16px] border border-[#e2e8f0] p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div className="space-y-0.5">
          <h2 className="text-base sm:text-lg font-bold text-[#004776]">
            Các con số trọng yếu về Đề án Vị trí việc làm HCM-UTE
          </h2>
          <p className="text-xs font-medium text-[#476885]">Giai đoạn 2026–2030</p>
        </div>
      </div>

      {/* Vùng thống kê chung ngăn bằng divider: 2 cột (mobile) / 4 cột (desktop), có nền ẩn màu sắc dịu nhẹ */}
      <div className="border-y border-[#e2e8f0] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-[#e2e8f0]">
        <div className="p-3.5 sm:p-4 space-y-1.5 bg-gradient-to-br from-[#eef6ff] via-[#f5f9ff] to-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#20446c]">Đơn vị trực thuộc</span>
            <Building2 className="w-4 h-4 text-[#006cee] shrink-0" />
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#004776] tracking-tight tabular-nums">{stats.totalUnits}</span>
            <span className="text-xs font-semibold text-[#006cee]">đơn vị trực thuộc</span>
          </div>
          <p className="text-[11px] text-[#476885]">39 đơn vị hoạt động thuộc Trường</p>
        </div>

        <div className="p-3.5 sm:p-4 space-y-1.5 bg-gradient-to-br from-[#ecfeff]/85 via-[#f2f9ff] to-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#20446c]">Vị trí việc làm (Biểu C1)</span>
            <Briefcase className="w-4 h-4 text-[#006cee] shrink-0" />
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#004776] tracking-tight tabular-nums">{stats.totalPositions}</span>
            <span className="text-xs font-semibold text-[#006cee]">vị trí cụ thể</span>
          </div>
          <p className="text-[11px] text-[#476885]">Tổng hợp từ Biểu C1 của 39 đơn vị</p>
        </div>

        <div className="p-3.5 sm:p-4 space-y-1.5 bg-gradient-to-br from-[#e8fbf2] via-[#f3fcf8] to-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#13653f]">Vị trí việc làm được áp dụng tại đơn vị</span>
            <CheckCircle2 className="w-4 h-4 text-[#13653f] shrink-0" />
          </div>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#13653f] tracking-tight tabular-nums">{stats.appliedPositions}</span>
            <span className="text-xs font-semibold text-[#13653f]">vị trí được áp dụng</span>
          </div>
          <p className="text-[11px] font-medium text-[#20446c] tabular-nums">
            Tổng phiếu khảo sát toàn trường: <strong className="text-[#004776]">{stats.totalTickets}</strong> phiếu
          </p>
        </div>

        <div className="p-3.5 sm:p-4 space-y-1.5 bg-gradient-to-br from-[#fff6e5] via-[#fffaf0] to-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#8f4f00]">Phiếu công việc</span>
            <Clock className="w-4 h-4 text-[#8f4f00] shrink-0" />
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#8f4f00] tracking-tight tabular-nums">{stats.pendingPositions}</span>
              <span className="text-xs font-semibold text-[#8f4f00]">chờ duyệt</span>
            </div>
            <Link
              href="/phieu-don-vi?mode=pending"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#006cee] hover:bg-[#eef5ff] rounded-[8px] transition-colors shrink-0"
            >
              <span>Duyệt</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[#004776] tabular-nums">
            <span className="text-[#8f4f00]">Chờ: {stats.pendingPositions}</span>
            <span>·</span>
            <span className="text-[#13653f]">Duyệt: {stats.approvedPositions}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5 text-[#476885]">
              <FileText className="w-3 h-3" />
              <span>Nháp: {stats.draftPositions}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Phân bổ theo khối đơn vị: danh sách phẳng ngăn bằng divider */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#006cee]" />
          <h3 className="text-xs sm:text-sm font-bold text-[#004776]">
            Phân bổ theo khối đơn vị
          </h3>
        </div>

        <div className="border-y border-[#e2e8f0] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 sm:divide-x divide-[#e2e8f0]">
          {unitGroupStats.map((group) => {
            const IconComponent = getGroupIcon(group.id);
            return (
              <div
                key={group.id}
                className="px-3.5 py-2.5 bg-gradient-to-r from-[#f4f9ff]/90 via-[#f9fcff] to-white hover:from-[#eaf3ff] transition-colors flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <IconComponent className="w-4 h-4 text-[#006cee] shrink-0" />
                  <span className="text-xs font-semibold text-[#004776] truncate">{group.label}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#eef5ff] text-[#004776] shrink-0 tabular-nums">
                  {group.count} đơn vị
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
