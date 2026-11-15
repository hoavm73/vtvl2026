'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2, Briefcase, CheckCircle2, Clock,
  ShieldCheck, Layers, Landmark, GraduationCap, Building, ArrowRight
} from 'lucide-react';
import { HCMUTE_UNITS, UNIT_GROUPS } from '@/configs/hcmute-units';
import { ND232_2026_VTVL_CATALOG } from '@/configs/hcmute-nd232-catalog';

interface OverviewStats {
  totalUnits: number;
  totalPositions: number;
  approvedPositions: number;
  pendingPositions: number;
  draftPositions?: number;
  totalTickets?: number;
}

export function SchoolOverviewDashboard() {
  const [stats, setStats] = useState<OverviewStats>({
    totalUnits: HCMUTE_UNITS.length,
    totalPositions: ND232_2026_VTVL_CATALOG.length,
    approvedPositions: 0,
    pendingPositions: 2
  });

  useEffect(() => {
    let isMounted = true;
    fetch('/api/stats/overview', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && isMounted) {
          setStats({
            totalUnits: data.totalUnits || HCMUTE_UNITS.length,
            totalPositions: data.totalPositions || ND232_2026_VTVL_CATALOG.length,
            approvedPositions: data.approvedPositions ?? 0,
            pendingPositions: data.pendingPositions ?? 0,
            draftPositions: data.draftPositions,
            totalTickets: data.totalTickets
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

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
      {/* Tiêu đề & huy hiệu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2ecf7] pb-3.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#e1edf8] text-[#004776]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0072BC]" />
              Số liệu chuẩn hóa toàn trường
            </span>
            <span className="text-[11px] font-medium text-[#476885]">Giai đoạn 2026–2030</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[#004776]">
            Các con số trọng yếu về Đề án Vị trí việc làm HCM-UTE
          </h2>
        </div>
      </div>

      {/* Lưới 4 chỉ số chính theo yêu cầu */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Chỉ số 1: Đơn vị trực thuộc */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#f8fbff] to-[#eef6fc] border border-[#dbe8f5] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#20446c]">Đơn vị trực thuộc</span>
            <div className="w-7 h-7 rounded-xl bg-white/90 border border-[#d8e3ef] flex items-center justify-center text-[#0072BC]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#004776] tracking-tight">{stats.totalUnits}</span>
            <span className="text-xs font-semibold text-[#0072BC]">đơn vị trực thuộc</span>
          </div>
          <p className="text-[11px] text-[#476885] leading-tight">
            15 Khoa/Viện · 14 Phòng ban · 19 TT & Đoàn thể
          </p>
        </div>

        {/* Chỉ số 2: Vị trí việc làm Toàn trường */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#f8fbff] to-[#eef6fc] border border-[#dbe8f5] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#20446c]">Vị trí việc làm</span>
            <div className="w-7 h-7 rounded-xl bg-white/90 border border-[#d8e3ef] flex items-center justify-center text-[#0072BC]">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#004776] tracking-tight">{stats.totalPositions}</span>
            <span className="text-xs font-semibold text-[#0072BC]">vị trí toàn trường</span>
          </div>
          <p className="text-[11px] text-[#476885] leading-tight">
            Khung 04 nhóm chức danh NĐ 232/2026/NĐ-CP
          </p>
        </div>

        {/* Chỉ số 3: Vị trí đã phê duyệt */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#f6fcf8] to-[#edf9f1] border border-[#cbeed7] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800">Đã phê duyệt</span>
            <div className="w-7 h-7 rounded-xl bg-white/90 border border-[#cbeed7] flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight">{stats.approvedPositions}</span>
            <span className="text-xs font-semibold text-emerald-600">vị trí đã phê duyệt</span>
          </div>
          <p className="text-[11px] text-emerald-700 leading-tight">
            Đã thẩm định và xác nhận vào hồ sơ đề án
          </p>
        </div>

        {/* Chỉ số 4: Vị trí đang chờ duyệt */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-[#fffdf5] to-[#fef9e8] border border-[#fae8b2] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">Đang chờ duyệt</span>
            <div className="w-7 h-7 rounded-xl bg-white/90 border border-[#fae8b2] flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight">{stats.pendingPositions}</span>
            <span className="text-xs font-semibold text-amber-600">vị trí đang chờ duyệt</span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <p className="text-[11px] text-amber-700 leading-tight">
              Đang chờ Lãnh đạo hoặc Admin phê duyệt
            </p>
            <Link
              href="/phieu-cong-viec?tab=pending"
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-[#0072BC] hover:bg-[#004776] active:scale-95 rounded-lg shadow-sm hover:shadow transition-all shrink-0 cursor-pointer"
            >
              <span>Duyệt</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Thống kê số lượng và mô tả ngắn gọn từng khối đơn vị */}
      <div className="pt-2 border-t border-[#e8f1fa] space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#0072BC]" />
          <h3 className="text-xs sm:text-sm font-bold text-[#004776]">
            Thống kê số lượng và mô tả ngắn gọn từng khối đơn vị
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {unitGroupStats.map((group) => {
            const IconComponent = getGroupIcon(group.id);
            return (
              <div
                key={group.id}
                className="p-3.5 rounded-2xl bg-[#f8fbff] hover:bg-white border border-[#dbe8f5] hover:border-[#0072BC] transition-all space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-[#e1edf8] flex items-center justify-center text-[#0072BC] shrink-0">
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-[#004776] truncate">{group.label}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-[#e1edf8] text-[#0072BC] shrink-0">
                    {group.count} đơn vị
                  </span>
                </div>
                <p className="text-[11px] text-[#476885] leading-relaxed line-clamp-2">
                  {group.shortDesc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
