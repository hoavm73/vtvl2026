'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Building2, User, FileSpreadsheet, FileText,
  Clock, CheckSquare, ArrowRight, Sparkles, LogIn
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { getRoleLabel, getRoleBadgeVariant } from '@/services/auth/account-client';
import { findHcmuteUnit } from '@/configs/hcmute-units';

interface OverviewWelcomeBannerProps {
  session: OperatorSession | null;
  onOpenAdminLogin?: () => void;
}

export function OverviewWelcomeBanner({ session, onOpenAdminLogin }: OverviewWelcomeBannerProps) {
  const isGuest = !session;
  const role = session?.role || 'staff';
  const label = session?.displayName || (session?.email ? session.email.split('@')[0] : 'Cán bộ HCM-UTE');
  const initials = label.slice(0, 2).toUpperCase();
  const unitDef = session ? findHcmuteUnit(session.unitCode) : null;
  const unitCode = unitDef?.code || session?.unitCode || 'TCNS';
  const unitNameVi = unitDef?.nameVi || session?.unitNameVi || 'Trường Đại học Công nghệ Kỹ thuật TP.HCM';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#00385d] via-[#004776] to-[#00609c] text-white shadow-xl border border-[#005a96]">
      {/* Background ambient lighting */}
      <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-sky-400/15 blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-blue-300/10 blur-3xl pointer-events-none" />

      <div className="relative p-6 sm:p-8 space-y-6">
        {/* Header title row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/15 pb-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <img
              src="/ute_logo.png"
              alt="HCM-UTE Logo"
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0 bg-white/10 p-1.5 rounded-2xl backdrop-blur-xs border border-white/20"
            />
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold text-sky-200 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)</span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Hệ thống Vị trí việc làm 360
              </h1>
              <p className="text-xs sm:text-sm text-sky-100 font-medium mt-1">
                Chuẩn hóa danh mục, định mức giờ công việc và lập đề án giai đoạn 2026–2030 theo Hướng dẫn 07-HD/BTCTW
              </p>
            </div>
          </div>
        </div>

        {/* Identity & Status Card */}
        {isGuest ? (
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-wider font-bold text-sky-200">
                Phiên khách vãng lai
              </span>
              <p className="text-base font-bold text-white">
                Chào mừng bạn đến với Cổng thông tin Vị trí việc làm HCM-UTE
              </p>
              <p className="text-xs text-sky-100/90 leading-relaxed max-w-xl">
                Đăng nhập tài khoản công vụ @hcmute.edu.vn hoặc đăng nhập Quản trị viên để bắt đầu kê khai công việc, phát phiếu khảo sát hoặc thẩm định đề án.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-[#004776] text-xs font-bold hover:bg-sky-50 transition-colors shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập ngay</span>
              </Link>
              {onOpenAdminLogin && (
                <button
                  type="button"
                  onClick={onOpenAdminLogin}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#002f50] border border-white/25 text-white text-xs font-bold hover:bg-[#002540] transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-300" />
                  <span>Quản trị viên</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start sm:items-center gap-3.5">
              {session.avatarUrl ? (
                <img
                  src={session.avatarUrl}
                  alt={label}
                  className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-white/30"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-white text-[#004776] font-extrabold text-base flex items-center justify-center shrink-0 shadow-sm">
                  {initials}
                </div>
              )}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-white">
                    Xin chào, {label}!
                  </span>
                  <Badge variant={getRoleBadgeVariant(role)} className="text-xs px-2.5 py-0.5">
                    {getRoleLabel(role)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-100">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Building2 className="w-3.5 h-3.5 text-sky-300" />
                    <span>[{unitCode}] {unitNameVi}</span>
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-sky-300" />
                    <span>{session.title || 'Chuyên viên'}</span>
                  </span>
                </div>
                <p className="text-xs text-sky-200/90 pt-0.5">
                  {role === 'admin'
                    ? 'Quyền Quản trị viên hệ thống — Điều hành danh mục 51 đơn vị, tài khoản & thẩm định đề án.'
                    : role === 'unit_leader'
                    ? 'Quyền Lãnh đạo đơn vị — Quản lý hồ sơ VTVL đơn vị, phát phiếu khảo sát và tổng hợp 15 biểu.'
                    : 'Quyền Cán bộ – Giảng viên — Kê khai phiếu mô tả công việc, đo định mức giờ và nộp hồ sơ.'}
                </p>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 shrink-0 border-t lg:border-t-0 border-white/15">
              {role === 'admin' && (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-[#004776] text-xs font-bold hover:bg-sky-50 transition-colors shadow-sm"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Trang Quản trị</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
              {role !== 'staff' && (
                <Link
                  href="/bang-tinh"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Bảng tính 15 biểu</span>
                </Link>
              )}
              <Link
                href="/phieu-cong-viec"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>Phiếu công việc</span>
              </Link>
              <Link
                href="/bam-gio"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 transition-colors"
              >
                <Clock className="w-4 h-4" />
                <span>Bấm giờ định mức</span>
              </Link>
              {role !== 'staff' && (
                <Link
                  href="/ra-soat"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold border border-white/30 transition-colors"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Rà soát đề án</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
