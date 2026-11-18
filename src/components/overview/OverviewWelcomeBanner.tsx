'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldCheck,
  FileText,
  LayoutGrid,
  ArrowRight,
  LogIn
} from 'lucide-react';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { getRoleLabel } from '@/services/auth/account-client';
import { findHcmuteUnit } from '@/configs/hcmute-units';

interface OverviewWelcomeBannerProps {
  session: OperatorSession | null;
}

function computeAvatarInitials(rawName: string, isDuplicateOfUnit: boolean): string {
  const clean = rawName.trim();
  if (!clean) return 'UT';
  if (isDuplicateOfUnit) return clean.slice(0, 2).toUpperCase();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export function OverviewWelcomeBanner({ session }: OverviewWelcomeBannerProps) {
  const isGuest = !session;
  const role = session?.role || 'staff';
  const unitDef = session ? findHcmuteUnit(session.unitCode) : null;
  const unitCode = (unitDef?.code || session?.unitCode || '').trim();
  const unitNameVi = (unitDef?.nameVi || session?.unitNameVi || '').trim();
  const rawName = (
    session?.displayName ||
    (session?.email ? session.email.split('@')[0] : '') ||
    'Cán bộ HCM-UTE'
  ).trim();

  const lowerName = rawName.toLowerCase();
  const isDuplicateOfUnit = Boolean(
    (unitNameVi && lowerName === unitNameVi.toLowerCase()) ||
    (unitCode && lowerName === unitCode.toLowerCase()) ||
    lowerName === 'phòng tổ chức – nhân sự' ||
    lowerName === 'phòng tổ chức - nhân sự'
  );

  const greetingName = isDuplicateOfUnit
    ? role === 'admin'
      ? 'Quản trị viên'
      : role === 'unit_leader'
        ? 'Lãnh đạo đơn vị'
        : session?.email?.split('@')[0] || 'Thầy/Cô'
    : rawName;

  const initials = computeAvatarInitials(rawName, isDuplicateOfUnit);
  const roleBadgeLabel = role === 'admin' ? 'Quản trị viên' : getRoleLabel(role);

  const baseActionCls =
    'inline-flex items-center justify-center gap-2 min-h-[44px] sm:h-[46px] px-3.5 sm:px-[18px] rounded-[12px] text-[13px] sm:text-sm font-semibold whitespace-nowrap cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#004776] aria-disabled:opacity-50 aria-disabled:pointer-events-none active:scale-[0.99]';
  const whiteBtnCls = 'bg-white hover:bg-[#eef6fc] text-[#004776] font-bold shadow-xs';
  const outlineBtnCls =
    'bg-transparent hover:bg-white/12 text-white border border-white/40 hover:border-white/65';

  return (
    <section
      id="overview-welcome-banner"
      aria-label="Thông tin tổng quan Hệ thống Vị trí việc làm 360"
      className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(100deg,#004776_0%,#005792_52%,#0068ad_100%)] text-white px-3.5 py-3.5 sm:px-5 sm:py-5 lg:p-[28px] select-none"
    >
      {/* Bộ lọc SVG tạo viền trắng sắc nét quanh logo HCM-UTE trên nền xanh thẫm */}
      <svg aria-hidden="true" className="sr-only" width="0" height="0">
        <defs>
          <filter id="hcmute-banner-logo-outline" x="-8%" y="-8%" width="116%" height="116%">
            <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="1.8" />
            <feFlood floodColor="#FFFFFF" floodOpacity="0.96" result="WHITE" />
            <feComposite in="WHITE" in2="DILATED" operator="in" result="OUTLINE" />
            <feMerge>
              <feMergeNode in="OUTLINE" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Điểm nhấn ánh sáng xanh dịu phía sau cổng bên phải */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_78%_34%,rgba(94,212,244,0.16),transparent_55%)]"
      />

      {/* Phần trên: Logo + đường phân cách dọc + 3 dòng nhận diện bên trái, ảnh cổng HCM-UTE bên phải */}
      <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4 lg:gap-6 pb-3 sm:pb-5">
        <div className="flex items-center gap-3 sm:gap-5 lg:gap-6 min-w-0 flex-1">
          <Image
            src="/ute_logo.png"
            alt="Logo HCM-UTE"
            width={82}
            height={82}
            sizes="(max-width: 640px) 44px, (max-width: 1024px) 64px, 82px"
            priority
            className="w-11 h-11 sm:w-16 sm:h-16 lg:w-[82px] lg:h-[82px] object-contain shrink-0 select-none"
            style={{ filter: 'url(#hcmute-banner-logo-outline)' }}
          />
          <div className="h-10 sm:h-15 lg:h-[76px] w-px bg-white/25 shrink-0" aria-hidden="true" />
          <div className="min-w-0 space-y-0.5 sm:space-y-1">
            <p className="!text-[12px] sm:!text-[14px] lg:!text-[15px] !font-medium text-[#D6EAF7] !leading-snug">
              Đề án vị trí việc làm 2026–2030
            </p>
            <h1 className="!text-[22px] sm:!text-[27px] lg:!text-[34px] xl:!text-[38px] ![font-weight:800] tracking-tight text-white !leading-[1.18] break-words">
              Hệ thống Vị trí việc làm 360
            </h1>
            <p className="hidden sm:block !text-[14px] lg:!text-[15.5px] !font-normal text-[#E4F2FC] !leading-snug break-words">
              Trường Đại học Công nghệ Kỹ thuật TP. Hồ Chí Minh (HCM-UTE)
            </p>
            <p className="sm:hidden !text-[12px] !font-normal text-[#E4F2FC] !leading-snug line-clamp-1">
              ĐH Công nghệ Kỹ thuật TP.HCM (HCM-UTE)
            </p>
          </div>
        </div>

        <div className="hidden md:flex md:w-[240px] lg:w-[320px] xl:w-[440px] 2xl:w-[470px] shrink-0 self-end items-end justify-end pointer-events-none select-none -mb-3.5 sm:-mb-4 lg:-mt-4">
          <Image
            src="/assets/login/hcmute-gate-line-art-transparent.png"
            alt=""
            aria-hidden="true"
            width={940}
            height={470}
            sizes="(max-width: 767px) 160px, (max-width: 1023px) 240px, (max-width: 1279px) 320px, 470px"
            priority
            className="w-full h-auto max-h-[120px] lg:max-h-[160px] xl:max-h-[205px] object-contain object-right-bottom pointer-events-none select-none opacity-95 [mask-image:linear-gradient(to_right,transparent_0%,black_14%,black_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_14%,black_100%)]"
          />
        </div>
      </div>

      {/* Đường phân cách ngang trắng mờ giữa phần nhận diện và phần chào */}
      <div className="relative z-10 border-t border-white/20 mb-3 sm:mb-4 lg:mb-5" aria-hidden="true" />

      {/* Phần dưới: Lời chào & nhóm nút thao tác trực tiếp trên nền banner */}
      {isGuest ? (
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-y-3 gap-x-6">
          <div className="space-y-0.5 min-w-0 flex-1 basis-[240px]">
            <p className="text-[15px] sm:text-[19px] font-bold text-white leading-snug">
              Chào mừng bạn đến với Hệ thống Vị trí việc làm 360
            </p>
            <p className="!text-[12px] sm:!text-[14px] !font-medium text-[#D6EAF7] !leading-snug break-words">
              Trường Đại học Công nghệ Kỹ thuật TP. Hồ Chí Minh · HCM-UTE
            </p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto min-w-0 max-w-full [--primary:#ffffff]">
            <Link href="/login" className={`${baseActionCls} ${whiteBtnCls}`}>
              <LogIn className="w-4 h-4 stroke-[2] shrink-0" />
              <span>Đăng nhập ngay</span>
            </Link>
            <Link href="/login?redirect=/admin&admin=true" className={`${baseActionCls} ${outlineBtnCls}`}>
              <ShieldCheck className="w-4 h-4 stroke-[2] shrink-0" />
              <span>Quản trị viên</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-y-3 sm:gap-y-4 gap-x-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 basis-[240px]">
            {session.avatarUrl ? (
              <img
                src={session.avatarUrl}
                alt={rawName}
                width={52}
                height={52}
                loading="lazy"
                decoding="async"
                className="w-10 h-10 sm:w-[52px] sm:h-[52px] rounded-[12px] sm:rounded-[14px] object-cover shrink-0 border border-white/30 shadow-xs"
              />
            ) : (
              <div className="w-10 h-10 sm:w-[52px] sm:h-[52px] rounded-[12px] sm:rounded-[14px] bg-white text-[#004776] font-extrabold text-sm sm:text-lg flex items-center justify-center shrink-0 shadow-xs">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[15px] sm:text-[19px] font-bold text-white leading-snug break-words">
                  Xin chào, {greetingName}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#c2410c]/85 text-[#fff7ed] border border-[#fdba74]/55 leading-tight shrink-0">
                  {roleBadgeLabel}
                </span>
              </div>
              <p className="!text-[12px] sm:!text-[14px] !font-medium text-[#D6EAF7] !leading-snug line-clamp-1 sm:line-clamp-none break-words">
                {unitNameVi}
                {unitCode ? ` · ${unitCode}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full md:w-auto min-w-0 max-w-full [--primary:#ffffff]">
            <div className={`grid ${role !== 'staff' ? 'grid-cols-2' : 'grid-cols-1'} sm:flex sm:flex-wrap items-center gap-2 sm:gap-3`}>
              {role === 'admin' && (
                <Link href="/admin" className={`${baseActionCls} ${whiteBtnCls}`}>
                  <ShieldCheck className="w-4 h-4 stroke-[2] shrink-0" />
                  <span>Trang quản trị</span>
                  <ArrowRight className="w-4 h-4 stroke-[2] shrink-0 hidden sm:inline" />
                </Link>
              )}

              <Link
                href="/phieu-cong-viec"
                className={`${baseActionCls} ${role === 'admin' ? outlineBtnCls : whiteBtnCls}`}
              >
                <FileText className="w-4 h-4 stroke-[2] shrink-0" />
                <span>Phiếu công việc</span>
              </Link>

              {role !== 'staff' && (
                <Link
                  href="/bang-tinh"
                  className={`${baseActionCls} ${outlineBtnCls} ${role === 'admin' ? '!hidden md:!inline-flex' : ''}`}
                >
                  <LayoutGrid className="w-4 h-4 stroke-[2] shrink-0" />
                  <span>Bảng tính 10 biểu</span>
                </Link>
              )}
            </div>

            {role === 'admin' && (
              <Link
                href="/bang-tinh"
                className="md:hidden inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[#D6EAF7] hover:text-white underline underline-offset-4 py-0.5"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Mở nhanh Bảng tính 10 biểu</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
