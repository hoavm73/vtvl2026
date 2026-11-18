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
    <section className="bg-white rounded-3xl border border-[#d8e3ef] p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(0,71,118,0.06)] space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2ecf7] pb-3.5">
        <div className="space-y-0.5">
          <h2 className="text-base sm:text-lg font-bold text-[#004776]">
            Các con số trọng yếu về Đề án Vị trí việc làm HCM-UTE
          </h2>
          <p className="text-[11px] font-medium text-[#476885]">Giai đoạn 2026–2030</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Chỉ số 1: Đơn vị trực thuộc */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#f8fbff] to-[#eef6fc] border border-[#dbe8f5] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#20446c]">Đơn vị trực thuộc</span>
            <div className="w-7 h-7 rounded-xl bg-white/90 border border-[#d8e3ef] flex items-center justify-center text-[#0072BC]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#004776] tracking-tight tabular-nums">{stats.totalUnits}</span>
            <span className="text-xs font-semibold text-[#0072BC]">đơn vị trực thuộc</span>
          </div>
          <p className="text-[11px] text-[#476885]">39 đơn vị hoạt động thuộc Trường</p>
        </div>

        {/* Chỉ số 2: Vị trí việc làm cụ thể (Biểu C1) toàn trường */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#f8fbff] to-[#eef6fc] border border-[#dbe8f5] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#20446c]">Vị trí việc làm (Biểu C1)</span>
            <div className="w-7 h-7 rounded-xl bg-white/90 border border-[#d8e3ef] flex items-center justify-center text-[#0072BC]">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#004776] tracking-tight tabular-nums">{stats.totalPositions}</span>
            <span className="text-xs font-semibold text-[#0072BC]">vị trí cụ thể (Biểu C1)</span>
          </div>
          <p className="text-[11px] text-[#476885]">Tổng hợp thời gian thực từ Biểu C1 của 39 đơn vị</p>
        </div>

        {/* Chỉ số 3: Vị trí việc làm được áp dụng tại đơn vị */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#f6fcf8] to-[#edf9f1] border border-[#cbeed7] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800">Vị trí việc làm được áp dụng tại đơn vị</span>
            <div className="w-7 h-7 rounded-xl bg-white/90 border border-[#cbeed7] flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight tabular-nums">{stats.appliedPositions}</span>
            <span className="text-xs font-semibold text-emerald-600">vị trí được áp dụng</span>
          </div>
          <p className="text-[11px] font-medium text-emerald-800/80 tabular-nums">
            Tổng phiếu khảo sát toàn trường: <strong className="text-[#004776]">{stats.totalTickets}</strong> phiếu
          </p>
        </div>

        {/* Chỉ số 4: Phiếu đang chờ duyệt & Nháp */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#fffdf5] to-[#fef9e8] border border-[#fae8b2] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">Phiếu công việc</span>
            <div className="w-7 h-7 rounded-xl bg-white/90 border border-[#fae8b2] flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight tabular-nums">{stats.pendingPositions}</span>
              <span className="text-xs font-semibold text-amber-600 truncate">phiếu chờ duyệt</span>
            </div>
            <Link
              href="/phieu-don-vi?mode=pending"
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-[#0072BC] hover:bg-[#004776] active:scale-95 rounded-lg shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
            >
              <span>Duyệt</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold text-[#004776] tabular-nums">
            <span className="text-amber-700">Đang chờ duyệt: {stats.pendingPositions}</span>
            <span>•</span>
            <span className="text-emerald-700">Đã phê duyệt: {stats.approvedPositions}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-0.5 text-[#476885]">
              <FileText className="w-3 h-3" />
              <span>Nháp: {stats.draftPositions}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Phân bổ theo khối đơn vị */}
      <div className="pt-2 border-t border-[#e8f1fa] space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#0072BC]" />
          <h3 className="text-xs sm:text-sm font-bold text-[#004776]">
            Phân bổ theo khối đơn vị
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {unitGroupStats.map((group) => {
            const IconComponent = getGroupIcon(group.id);
            return (
              <div
                key={group.id}
                className="px-3.5 py-3 rounded-2xl bg-[#f8fbff] hover:bg-white border border-[#dbe8f5] hover:border-[#0072BC] transition-all shadow-2xs flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#e1edf8] flex items-center justify-center text-[#0072BC] shrink-0">
                    <IconComponent className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-[#004776] truncate">{group.label}</span>
                </div>
                <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-[#e1edf8] text-[#0072BC] shrink-0 tabular-nums">
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
