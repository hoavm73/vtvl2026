'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileSpreadsheet, FileText, Clock, CheckSquare, Home,
  Menu, X, ShieldCheck, Building2
} from 'lucide-react';
import { InfoTip } from './MilestonesBar';
import { UserProfilePopover } from '@/components/auth/UserProfilePopover';
import { getCurrentOperatorSession, OperatorSession } from '@/services/telemetry/operator-session';
import { findHcmuteUnit } from '@/configs/hcmute-units';

const MOBILE_NAV_ITEMS = [
  { href: '/', label: 'Tổng quan hệ thống', icon: Home },
  { href: '/phieu-cong-viec', label: 'Phiếu công việc cá nhân', icon: FileText },
  { href: '/bam-gio', label: 'Đo định mức thời gian', icon: Clock },
  { href: '/bang-tinh', label: 'Bảng tính 15 biểu', icon: FileSpreadsheet },
  { href: '/admin', label: 'Quản trị hệ thống', icon: ShieldCheck }
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState<OperatorSession | null>(null);

  useEffect(() => {
    const syncSession = () => {
      setSession(getCurrentOperatorSession());
    };
    syncSession();
    window.addEventListener('vtvl-operator-changed', syncSession);
    return () => window.removeEventListener('vtvl-operator-changed', syncSession);
  }, []);

  const isLoggedIn = Boolean(session);
  const isAdmin = Boolean(session?.role === 'admin' || session?.email === 'tcns@hcmute.edu.vn');
  const unitDef = session?.unitCode ? findHcmuteUnit(session.unitCode) : null;

  const mobileNavItems = !isLoggedIn
    ? []
    : isAdmin
    ? MOBILE_NAV_ITEMS
    : MOBILE_NAV_ITEMS.filter((item) => item.href !== '/admin');

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
      <div className="w-full px-3 sm:px-5 lg:px-6 flex h-16 items-center justify-between gap-3">
        {/* Nhận diện thương hiệu HCM-UTE bên trái */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/"
            aria-label="Trang chủ tổng quan Vị trí việc làm HCM-UTE"
            className="flex items-center gap-2.5 py-1 min-w-0 cursor-pointer"
          >
            <img
              src="/ute_logo.png"
              alt="HCM-UTE Logo"
              className="block h-8 w-auto md:hidden object-contain shrink-0"
            />
            <span className="md:hidden text-base font-bold text-[#004776] truncate">
              VTVL HCM-UTE
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

        {/* Tiện ích và Tài khoản bên phải (Sidebar là điều hướng chính trên desktop) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Huy hiệu đơn vị công tác hiện tại (chỉ hiển thị khi đã đăng nhập) */}
          {unitDef && (
            <div
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f0f6ff] border border-[#dbeafe] text-xs font-semibold text-[#004776] max-w-xs truncate"
              title={`[${unitDef.code}] ${unitDef.nameVi}`}
            >
              <Building2 className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
              <span className="truncate">[{unitDef.code}] {unitDef.nameVi}</span>
            </div>
          )}

          {/* Popover Hồ sơ người dùng */}
          <UserProfilePopover />

          {/* Nút mở Menu điều hướng di động / Drawer */}
          {mobileNavItems.length > 0 && (
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu điều hướng'}
              className="lg:hidden h-10 w-10 rounded-xl border border-[#d8e3ef] bg-white text-[#004776] flex items-center justify-center cursor-pointer hover:bg-[#f4f7fb]"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Drawer menu điều hướng trên thiết bị di động & máy tính bảng */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Danh mục điều hướng di động"
          className="lg:hidden fixed inset-0 z-[100] bg-[#004776]/35 backdrop-blur-xs flex justify-end"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="w-[min(22rem,88vw)] h-dvh bg-white border-l border-[#d8e3ef] p-5 flex flex-col justify-between shadow-2xl overflow-y-auto"
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
                      className={`flex items-center gap-3 px-3.5 min-h-[44px] rounded-xl text-sm transition-colors ${
                        active
                          ? 'bg-[#0072BC] text-white font-bold shadow-xs'
                          : 'text-[#004776] font-semibold hover:bg-[#eef5ff]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="pt-3 border-t border-[#e2ecf7] text-[11px] font-medium text-[#476885] leading-relaxed">
              Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
