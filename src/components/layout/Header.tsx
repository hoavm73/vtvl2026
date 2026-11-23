'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileSpreadsheet, FileText, ClipboardCheck, Home, ChevronRight,
  Menu, X, ShieldCheck, Building2, BookOpen, Settings, Network, BarChart3
} from 'lucide-react';
import { InfoTip } from './MilestonesBar';
import { BreadcrumbIconKey, getDefaultBreadcrumbs, HEADER_ACTIONS_SLOT_ID, usePageBreadcrumbs } from './PageHeaderContext';

const BREADCRUMB_ICONS: Record<BreadcrumbIconKey, React.ComponentType<{ className?: string }>> = {
  home: Home,
  file: FileText,
  unit: Building2,
  sheet: FileSpreadsheet,
  tickets: ClipboardCheck,
  shield: ShieldCheck,
  settings: Settings,
  book: BookOpen,
  org: Network,
  chart: BarChart3
};
import { UserProfilePopover } from '@/components/auth/UserProfilePopover';
import { getCurrentOperatorSession, OperatorSession } from '@/services/telemetry/operator-session';

const MOBILE_NAV_ITEMS: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles?: ('admin' | 'unit_leader' | 'staff')[] }[] = [
  { href: '/', label: 'Tổng quan hệ thống', icon: Home },
  { href: '/phieu-cong-viec', label: 'Phiếu công việc cá nhân', icon: FileText },
  { href: '/nghiep-vu-don-vi', label: 'Hồ sơ đơn vị', icon: Building2, roles: ['admin', 'unit_leader'] },
  { href: '/bang-tinh', label: 'Bảng tính 10 biểu', icon: FileSpreadsheet },
  { href: '/phieu-don-vi', label: 'Quản lý phiếu đơn vị', icon: ClipboardCheck, roles: ['admin', 'unit_leader'] },
  { href: '/nghiep-vu-don-vi?tab=org-tree', label: 'Sơ đồ VTVL dự kiến', icon: Network },
  { href: '/nghiep-vu-don-vi?tab=workforce-chart', label: 'Biểu đồ cơ cấu nhân lực', icon: BarChart3 },
  { href: '/admin/tham-dinh', label: 'Thẩm định cấp trường', icon: ShieldCheck, roles: ['admin'] },
  { href: '/admin', label: 'Quản trị hệ thống', icon: Settings, roles: ['admin', 'unit_leader'] },
  { href: '/huong-dan', label: 'Hướng dẫn nghiệp vụ', icon: BookOpen }
];

export function Header({ sidebarCollapsed = false }: { sidebarCollapsed?: boolean }) {
  const pathname = usePathname();
  const customBreadcrumbs = usePageBreadcrumbs();
  const breadcrumbs = customBreadcrumbs || getDefaultBreadcrumbs(pathname);
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
  const currentRole = session?.role || (session?.email === 'tcns@hcmute.edu.vn' ? 'admin' : 'staff');

  const mobileNavItems = !isLoggedIn
    ? []
    : MOBILE_NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(currentRole));

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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#d8e3ef] shadow-[0_2px_12px_-4px_rgba(0,71,118,0.06)] print:hidden">
      <div className="w-full flex h-16 items-stretch justify-between">
        {/* Khu vực Logo HCM-UTE bên trái — gióng khớp chính xác bề rộng và đường kẻ dọc với Sidebar */}
        <div
          className={`flex items-center shrink-0 transition-all duration-300 px-3 sm:px-5 lg:border-r lg:border-[#d8e3ef] ${
            sidebarCollapsed ? 'lg:w-[72px] lg:justify-center lg:px-2' : 'lg:w-[272px] lg:justify-between lg:px-4'
          }`}
        >
          <Link
            href="/"
            aria-label="Trang chủ tổng quan Vị trí việc làm HCM-UTE"
            className="flex items-center gap-2.5 py-1 min-w-0 cursor-pointer"
          >
            <Image
              src="/ute_logo.png"
              alt="HCM-UTE Logo"
              width={36}
              height={36}
              sizes="36px"
              priority
              className={`block h-9 w-auto object-contain shrink-0 ${sidebarCollapsed ? '' : 'md:hidden'}`}
            />
            <span className="md:hidden text-base font-bold text-[#004776] truncate">
              VTVL HCM-UTE
            </span>
            {!sidebarCollapsed && (
              <Image
                src="/horizontal-ute-logo.png"
                alt="HCM-UTE Logo"
                width={180}
                height={44}
                sizes="180px"
                priority
                className="hidden h-9 w-auto md:block object-contain shrink-0"
              />
            )}
          </Link>

          {!sidebarCollapsed && (
            <div className="hidden sm:block shrink-0 ml-2">
              <InfoTip title="Căn cứ pháp lý & Cơ quan thường trực">
                <p><strong>Đơn vị chủ trì:</strong> Phòng Tổ chức - Nhân sự — Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE).</p>
                <p><strong>Căn cứ:</strong> Hướng dẫn số 07-HD/BTCTW; Nghị định số 232/2026/NĐ-CP; Thông tư số 31/2026/TT-BGDĐT; Hướng dẫn số 02 (1907/HD-ĐHCNKT ngày 17/6/2026).</p>
              </InfoTip>
            </div>
          )}
        </div>

        {/* Thanh Breadcrumb điều hướng nghiệp vụ ở giữa — phẳng, gọn, cùng hàng logo */}
        <div className="flex-1 flex items-center justify-between gap-3 min-w-0 px-3 sm:px-5 lg:px-6">
          <nav aria-label="Đường dẫn nghiệp vụ" className="hidden md:flex items-center gap-2 min-w-0 overflow-hidden">
            {breadcrumbs.map((item, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              const CrumbIcon = item.icon ? BREADCRUMB_ICONS[item.icon] : null;
              return (
                <React.Fragment key={`${item.label}-${idx}`}>
                  {idx > 0 && <ChevronRight className="w-4 h-4 text-[#004776]/50 shrink-0" aria-hidden="true" />}
                  {item.href && !isLast ? (
                    <Link
                      href={item.href}
                      className="text-[14.5px] font-medium text-[#004776]/85 hover:text-[#006cee] transition-colors whitespace-nowrap truncate"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[15px] whitespace-nowrap truncate ${
                        isLast ? 'font-bold text-[#0072BC]' : 'font-medium text-[#004776]/85'
                      }`}
                    >
                      {isLast && CrumbIcon && <CrumbIcon className="w-[18px] h-[18px] text-[#006cee] shrink-0" aria-hidden="true" />}
                      <span className="truncate">{item.label}</span>
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* Cụm nút / bộ lọc nghiệp vụ của trang đang mở (Desktop >= lg, vì tài khoản đã chuyển xuống đáy Sidebar) */}
          <div id={HEADER_ACTIONS_SLOT_ID} className="hidden lg:flex items-center gap-2 shrink-0 ml-auto" />

          {/* Tài khoản & Menu di động (chỉ hiển thị trên < lg khi Sidebar đang ẩn) */}
          <div className="flex lg:hidden items-center gap-2 sm:gap-3 shrink-0 ml-auto">
            <UserProfilePopover placement="header" />

            {mobileNavItems.length > 0 && (
              <button
                type="button"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-expanded={mobileOpen}
                aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu điều hướng'}
                className="lg:hidden h-11 w-11 rounded-xl border border-[#d8e3ef] bg-white text-[#004776] flex items-center justify-center cursor-pointer hover:bg-[#f4f7fb]"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
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
                  <Image src="/ute_logo.png" alt="HCM-UTE Logo" width={32} height={32} sizes="32px" className="h-8 w-auto object-contain shrink-0" />
                  <div className="min-w-0">
                    <div className="text-base font-bold text-[#004776]">VTVL HCM-UTE</div>
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
                  const currentTab = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('tab') || '') : '';
                  const active = item.href === '/bang-tinh'
                    ? pathname === '/bang-tinh'
                    : item.href === '/nghiep-vu-don-vi?tab=org-tree'
                      ? pathname.startsWith('/nghiep-vu-don-vi') && currentTab === 'org-tree'
                      : item.href === '/nghiep-vu-don-vi?tab=workforce-chart'
                        ? pathname.startsWith('/nghiep-vu-don-vi') && currentTab === 'workforce-chart'
                        : item.href === '/nghiep-vu-don-vi'
                          ? pathname.startsWith('/nghiep-vu-don-vi') && currentTab !== 'org-tree' && currentTab !== 'workforce-chart'
                          : item.href === '/admin/tham-dinh'
                            ? pathname.startsWith('/admin/tham-dinh')
                            : item.href === '/admin'
                              ? pathname === '/admin'
                              : item.href === '/'
                                ? pathname === '/'
                                : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setMobileOpen(false);
                        if (item.href.startsWith('/nghiep-vu-don-vi')) {
                          const nextTab = item.href.includes('tab=org-tree') ? 'org-tree' : item.href.includes('tab=workforce-chart') ? 'workforce-chart' : 'overview';
                          window.dispatchEvent(new CustomEvent('vtvl-unit-tab-changed', { detail: { tab: nextTab } }));
                        }
                      }}
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
