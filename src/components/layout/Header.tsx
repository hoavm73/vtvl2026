'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileSpreadsheet,
  FileText,
  Clock,
  CheckSquare,
  Home,
  Menu,
  X,
  ShieldCheck
} from 'lucide-react';
import { InfoTip } from './MilestonesBar';
import { UserProfilePopover } from '@/components/auth/UserProfilePopover';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';

const NAV_ITEMS = [
  { href: '/phieu-cong-viec', label: 'Phiếu công việc', icon: FileText },
  { href: '/bang-tinh', label: 'Bảng tính 15 biểu', icon: FileSpreadsheet },
  { href: '/', label: 'Tổng quan', icon: Home },
  { href: '/admin', label: 'Quản trị hệ thống', icon: ShieldCheck }
];

const MOBILE_NAV_ITEMS = [
  { href: '/phieu-cong-viec', label: 'Phiếu công việc cá nhân', icon: FileText },
  { href: '/bam-gio', label: 'Đo định mức thời gian', icon: Clock },
  { href: '/bang-tinh', label: 'Bảng tính 15 biểu', icon: FileSpreadsheet },
  { href: '/ra-soat', label: 'Rà soát & Thẩm định', icon: CheckSquare },
  { href: '/admin', label: 'Quản trị hệ thống', icon: ShieldCheck },
  { href: '/', label: 'Tổng quan lộ trình', icon: Home }
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkRole = () => {
      const cur = getCurrentOperatorSession();
      setIsAdmin(Boolean(cur?.email === 'tcns@hcmute.edu.vn' && cur?.role === 'admin'));
    };
    checkRole();
    window.addEventListener('vtvl-operator-changed', checkRole);
    return () => window.removeEventListener('vtvl-operator-changed', checkRole);
  }, []);

  const navItems = isAdmin
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item.href !== '/admin');

  const mobileNavItems = isAdmin
    ? MOBILE_NAV_ITEMS
    : MOBILE_NAV_ITEMS.filter((item) => item.href !== '/admin');

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#d8e3ef] shadow-[0_2px_12px_-4px_rgba(0,71,118,0.06)]">
      <div className="w-full max-w-none px-3 sm:px-5 lg:px-7 flex h-16 items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <Link
            href="/bang-tinh"
            aria-label="Bảng tính 15 biểu Vị trí việc làm HCM-UTE"
            className="flex items-center gap-2.5 py-1 min-w-0 cursor-pointer"
          >
            <img
              src="/ute_logo.png"
              alt="HCM-UTE Logo"
              className="block h-8 w-auto md:hidden object-contain shrink-0"
            />
            <span className="md:hidden text-base font-bold text-[#004776] truncate">
              Vị trí việc làm
            </span>
            <img
              src="/horizontal-ute-logo.png"
              alt="HCM-UTE Logo"
              className="hidden h-9 lg:h-10 w-auto md:block object-contain shrink-0"
            />
          </Link>
          <InfoTip title="Căn cứ pháp lý & Cơ quan thường trực">
            <p><strong>Đơn vị chủ trì:</strong> Phòng Tổ chức - Nhân sự — Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE).</p>
            <p><strong>Căn cứ:</strong> Hướng dẫn số 07-HD/BTCTW; Nghị định số 232/2026/NĐ-CP; Thông tư số 31/2026/TT-BGDĐT; Hướng dẫn số 02 (1907/HD-ĐHCNKT ngày 17/6/2026).</p>
          </InfoTip>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <nav aria-label="Điều hướng quy trình nghiệp vụ" className="hidden lg:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === '/bang-tinh'
                ? pathname === '/bang-tinh' || pathname === '/tao-tep'
                : item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 px-3.5 h-10 rounded-xl text-[14px] whitespace-nowrap transition-all border ${
                    active
                      ? 'bg-[#004776] text-white border-[#004776] font-bold shadow-xs'
                      : 'text-[#004776] border-transparent font-semibold hover:bg-[#f4f7fb] hover:border-[#d8e3ef]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Link
            href="/bang-tinh"
            className="hidden sm:inline-flex lg:hidden items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold bg-[#004776] text-white whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span>Bảng tính 15 biểu</span>
          </Link>

          <UserProfilePopover />

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Đóng danh mục điều hướng' : 'Mở danh mục điều hướng'}
            className="lg:hidden h-10 w-10 rounded-xl border border-[#d8e3ef] bg-white text-[#004776] flex items-center justify-center cursor-pointer hover:bg-[#f4f7fb]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Danh mục điều hướng"
          className="lg:hidden fixed inset-0 z-[100] bg-[#004776]/35 backdrop-blur-xs flex justify-end"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-[min(21rem,88vw)] h-dvh bg-white border-l border-[#d8e3ef] p-5 flex flex-col justify-between shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2ecf7]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img src="/ute_logo.png" alt="HCM-UTE Logo" className="h-8 w-auto object-contain shrink-0" />
                  <div className="min-w-0">
                    <div className="text-base font-bold text-[#004776]">VTVL HCM-UTE</div>
                    <div className="text-xs font-medium text-[#476885] truncate">Điều hướng nghiệp vụ</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Đóng menu"
                  className="h-10 w-10 rounded-xl border border-[#d8e3ef] text-[#004776] inline-flex items-center justify-center cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav aria-label="Menu di động" className="space-y-1.5">
                {mobileNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.href === '/bang-tinh'
                    ? pathname === '/bang-tinh' || pathname === '/tao-tep'
                    : item.href === '/phieu-cong-viec'
                      ? pathname === '/phieu-cong-viec'
                      : item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 min-h-[46px] rounded-xl text-[15px] ${
                        active ? 'bg-[#004776] text-white font-bold' : 'text-[#004776] font-semibold hover:bg-[#eef5ff]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="pt-3 border-t border-[#e2ecf7] text-xs font-medium text-[#476885]">
              Phòng Tổ chức - Nhân sự · Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
