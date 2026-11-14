'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
}

export function OverviewWelcomeBanner({ session }: OverviewWelcomeBannerProps) {
  const isGuest = !session;
  const role = session?.role || 'staff';
  const label = session?.displayName || (session?.email ? session.email.split('@')[0] : 'Cán bộ HCM-UTE');
  const initials = label.slice(0, 2).toUpperCase();
  const unitDef = session ? findHcmuteUnit(session.unitCode) : null;
  const unitCode = unitDef?.code || session?.unitCode || 'TCNS';
  const unitNameVi = unitDef?.nameVi || session?.unitNameVi || 'Trường Đại học Công nghệ Kỹ thuật TP.HCM';

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#073B63] via-[#094875] to-[#075985] text-white shadow-xl shadow-[#073B63]/25 border border-white/20 select-none">
      {/* 1. Điểm nhấn orbital line & cyan ambient glow nhẹ nhàng đồng bộ với trang /login */}
      <div className="absolute -top-28 -right-28 w-96 h-96 rounded-full border border-[#5ED4F4]/20 pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-64 rounded-full bg-[#5ED4F4]/[0.08] blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-blue-400/[0.08] blur-3xl pointer-events-none" />

      {/* 2. Watermark line-art cổng trường HCM-UTE nền trong suốt (opacity 8-14%, không méo, không che tương tác) */}
      <div className="absolute right-0 bottom-0 top-0 w-2/3 sm:w-1/2 md:w-5/12 max-w-[460px] pointer-events-none overflow-hidden select-none flex items-end justify-end z-0">
        <Image
          src="/assets/login/hcmute-gate-line-art-transparent.png"
          alt=""
          width={1774}
          height={887}
          priority={false}
          className="w-full h-auto max-h-[88%] object-contain object-bottom opacity-[0.11] drop-shadow-sm"
        />
      </div>

      <div className="relative z-10 p-5 sm:p-7 space-y-4 sm:space-y-5">
        {/* Header title row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/20 pb-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <img
              src="/ute_logo.png"
              alt="HCM-UTE Logo"
              className="w-11 h-11 sm:w-13 sm:h-13 object-contain shrink-0 bg-white/15 p-1 rounded-xl sm:rounded-2xl backdrop-blur-xs border border-white/25 shadow-xs"
            />
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-[#5ED4F4]/40 text-[11px] font-semibold text-[#D4E8F8] mb-1">
                <Sparkles className="w-3 h-3 text-[#5ED4F4] shrink-0" />
                <span className="truncate">Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
                Hệ thống Vị trí việc làm 360
              </h1>
              <p className="text-[11.5px] sm:text-xs text-white/85 font-medium mt-0.5 truncate">
                Chuẩn hóa danh mục, đo định mức giờ và lập đề án giai đoạn 2026–2030 theo Hướng dẫn 07-HD/BTCTW
              </p>
            </div>
          </div>
        </div>

        {/* Identity & Status Card */}
        {isGuest ? (
          <div className="rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#5ED4F4]">
                Phiên khách vãng lai
              </span>
              <p className="text-sm sm:text-base font-bold text-white">
                Chào mừng bạn đến với Cổng thông tin Vị trí việc làm HCM-UTE
              </p>
              <p className="text-xs text-white/85 leading-relaxed max-w-xl">
                Đăng nhập tài khoản công vụ @hcmute.edu.vn hoặc đăng nhập Quản trị viên để bắt đầu kê khai công việc, phát phiếu khảo sát hoặc thẩm định đề án.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập ngay</span>
              </Link>
              <Link
                href="/login?redirect=/admin&admin=true"
                className="inline-flex items-center gap-2 h-10 px-3.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Quản trị viên</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl sm:rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-4 sm:p-5">
            {/* Bố cục Grid 2 cột cân đối: Thông tin người dùng & Cụm thao tác */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-center">
              {/* Cột 1: Thông tin người dùng (Rõ nét, tương phản WCAG AA) */}
              <div className="xl:col-span-7 flex items-start sm:items-center gap-3.5 min-w-0">
                {session.avatarUrl ? (
                  <img
                    src={session.avatarUrl}
                    alt={label}
                    className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover shrink-0 border border-white/40 shadow-xs"
                  />
                ) : (
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white text-[#004776] font-extrabold text-base flex items-center justify-center shrink-0 shadow-sm border border-white/30">
                    {initials}
                  </div>
                )}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base sm:text-lg font-bold text-white truncate max-w-xs sm:max-w-md">
                      Xin chào, {label}!
                    </span>
                    <Badge variant={getRoleBadgeVariant(role)} className="text-[11px] px-2 py-0.5 shrink-0 shadow-2xs font-bold">
                      {getRoleLabel(role)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/90">
                    <span className="inline-flex items-center gap-1 font-semibold truncate max-w-sm">
                      <Building2 className="w-3.5 h-3.5 text-[#5ED4F4] shrink-0" />
                      <span className="truncate">[{unitCode}] {unitNameVi}</span>
                    </span>
                    <span className="text-white/40">·</span>
                    <span className="inline-flex items-center gap-1 shrink-0">
                      <User className="w-3.5 h-3.5 text-[#5ED4F4] shrink-0" />
                      <span>{session.title || 'Chuyên viên'}</span>
                    </span>
                  </div>
                  <p className="text-xs text-white/85 leading-relaxed pt-0.5 line-clamp-2">
                    {role === 'admin'
                      ? 'Quyền Quản trị viên — Điều hành danh mục 51 đơn vị, phân quyền & thẩm định đề án toàn trường.'
                      : role === 'unit_leader'
                      ? 'Quyền Lãnh đạo đơn vị — Quản lý hồ sơ VTVL đơn vị, phát phiếu khảo sát và tổng hợp 15 biểu.'
                      : 'Quyền Cán bộ – Giảng viên — Kê khai phiếu mô tả công việc, đo định mức giờ và nộp hồ sơ cá nhân.'}
                  </p>
                </div>
              </div>

              {/* Cột 2: Cụm thao tác nhanh (Phân cấp rõ: Phiếu công việc là Primary trắng nổi bật, Bấm giờ là Glass) */}
              <div className="xl:col-span-5 flex flex-wrap items-center gap-2 xl:justify-end pt-3 xl:pt-0 border-t xl:border-t-0 border-white/15">
                {role === 'admin' && (
                  <Link
                    href="/admin"
                    className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3.5 rounded-full bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold shadow-xs hover:shadow-sm border border-white/20 transition-all active:scale-[0.98] whitespace-nowrap"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Trang Quản trị</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                  </Link>
                )}

                {/* Nút Primary: Phiếu công việc (Nổi bật, nền trắng, chữ xanh đậm thương hiệu) */}
                <Link
                  href="/phieu-cong-viec"
                  className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-4 rounded-full bg-white hover:bg-sky-50 text-[#004776] text-xs font-bold shadow-sm hover:shadow-md transition-all active:scale-[0.98] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-white"
                >
                  <FileText className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
                  <span>Phiếu công việc</span>
                </Link>

                {/* Nút Secondary: Bấm giờ (Secondary glass) */}
                <Link
                  href="/bam-gio"
                  className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold border border-white/25 backdrop-blur-xs transition-all active:scale-[0.98] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-white"
                >
                  <Clock className="w-3.5 h-3.5 text-[#5ED4F4] shrink-0" />
                  <span>Bấm giờ</span>
                </Link>

                {role !== 'staff' && (
                  <Link
                    href="/bang-tinh"
                    className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold border border-white/25 backdrop-blur-xs transition-colors whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-sky-200 shrink-0" />
                    <span>Bảng tính 15 biểu</span>
                  </Link>
                )}

                {role !== 'staff' && (
                  <Link
                    href="/ra-soat"
                    className="inline-flex items-center gap-1.5 h-9 sm:h-10 px-3.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold border border-white/25 backdrop-blur-xs transition-colors whitespace-nowrap"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-sky-200 shrink-0" />
                    <span>Rà soát</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
