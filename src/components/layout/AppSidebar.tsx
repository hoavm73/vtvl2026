'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  FileSpreadsheet,
  ShieldCheck,
  BookOpen,
  Home,
  ChevronLeft,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { OperatorSession } from '@/services/telemetry/operator-session';

interface NavItemDef {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  roles?: ('admin' | 'unit_leader' | 'staff')[];
}

interface NavGroupDef {
  groupTitle: string;
  items: NavItemDef[];
}

const SIDEBAR_GROUPS: NavGroupDef[] = [
  {
    groupTitle: 'Tổng quan hệ thống',
    items: [
      {
        href: '/',
        label: 'Trang chủ tổng quan',
        icon: Home
      },
      {
        href: '/?tab=unit-monitor',
        label: 'Theo dõi đơn vị',
        icon: BarChart3,
        roles: ['admin'],
        badge: 'TCNS',
        badgeColor: 'bg-blue-50 text-[#0072BC] border-blue-200'
      }
    ]
  },
  {
    groupTitle: 'Nghiệp vụ cá nhân',
    items: [
      {
        href: '/phieu-cong-viec',
        label: 'Phiếu công việc cá nhân',
        icon: FileText,
        badge: 'Ưu tiên',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      }
    ]
  },
  {
    groupTitle: 'Nghiệp vụ đơn vị',
    items: [
      {
        href: '/bang-tinh',
        label: 'Bảng tính 15 biểu',
        icon: FileSpreadsheet
      }
    ]
  },
  {
    groupTitle: 'Hệ thống & tra cứu',
    items: [
      {
        href: '/admin',
        label: 'Quản trị hệ thống',
        icon: ShieldCheck,
        roles: ['admin', 'unit_leader'],
        badge: 'Admin',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
      },
      {
        href: '/huong-dan',
        label: 'Hướng dẫn nghiệp vụ',
        icon: BookOpen
      }
    ]
  }
];

interface AppSidebarProps {
  collapsed: boolean;
  session: OperatorSession | null;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, session, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const currentRole = session?.role || 'staff';
  const [isMonitorTab, setIsMonitorTab] = useState(false);

  useEffect(() => {
    const syncTab = (ev?: Event) => {
      const custom = ev as CustomEvent<{ tab?: string }> | undefined;
      if (custom?.detail?.tab) {
        setIsMonitorTab(custom.detail.tab === 'unit-monitor');
        return;
      }
      if (typeof window !== 'undefined') {
        const tabParam = new URLSearchParams(window.location.search).get('tab');
        setIsMonitorTab(window.location.pathname === '/' && tabParam === 'unit-monitor');
      }
    };
    syncTab();
    window.addEventListener('popstate', syncTab);
    window.addEventListener('vtvl-home-tab-changed', syncTab);
    return () => {
      window.removeEventListener('popstate', syncTab);
      window.removeEventListener('vtvl-home-tab-changed', syncTab);
    };
  }, [pathname]);

  const isItemActive = (href: string) => {
    if (href === '/') return pathname === '/' && !isMonitorTab;
    if (href === '/?tab=unit-monitor') return pathname === '/' && isMonitorTab;
    if (href === '/bang-tinh') return pathname === '/bang-tinh';
    if (href === '/phieu-cong-viec') return pathname === '/phieu-cong-viec';
    return pathname.startsWith(href);
  };

  return (
    <aside
      aria-label="Thanh điều hướng nghiệp vụ chính"
      className={`hidden lg:flex flex-col shrink-0 bg-white border-r border-[#d8e3ef] shadow-[2px_0_12px_-4px_rgba(0,71,118,0.04)] transition-all duration-300 z-20 print:hidden ${
        collapsed ? 'w-[72px]' : 'w-[272px]'
      }`}
    >
      {/* Header Sidebar: Tiêu đề & Nút thu gọn/mở rộng menu */}
      <div className={`p-3 border-b border-[#e2ecf7] flex items-center min-h-[54px] ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 pl-1">
            <span className="w-2 h-2 rounded-full bg-[#006cee]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#004776]">
              Menu nghiệp vụ
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? 'Mở rộng menu điều hướng' : 'Thu gọn menu điều hướng'}
          className="p-1.5 rounded-lg border border-[#e2ecf7] text-[#476885] hover:text-[#004776] hover:bg-[#f4f7fb] cursor-pointer shrink-0 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Danh sách các nhóm nghiệp vụ chính */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {SIDEBAR_GROUPS.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || item.roles.includes(currentRole)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.groupTitle} className="space-y-1">
              {!collapsed && (
                <div className="px-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#20446c]/80">
                  {group.groupTitle}
                </div>
              )}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);
                const targetHref = item.href === '/admin' && currentRole !== 'admin' && currentRole !== 'unit_leader'
                  ? '/login?redirect=/admin&admin=true'
                  : item.href;

                return (
                  <Link
                    key={item.href}
                    href={targetHref}
                    title={item.label}
                    onClick={() => {
                      if (item.href === '/' || item.href === '/?tab=unit-monitor') {
                        const nextTab = item.href === '/?tab=unit-monitor' ? 'unit-monitor' : 'overview';
                        setIsMonitorTab(nextTab === 'unit-monitor');
                        window.dispatchEvent(new CustomEvent('vtvl-home-tab-changed', { detail: { tab: nextTab } }));
                      }
                    }}
                    className={`flex items-center gap-2.5 min-h-[40px] rounded-xl transition-all group ${
                      collapsed ? 'justify-center p-2.5' : 'px-3 py-2'
                    } ${
                      active
                        ? 'bg-[#006cee] text-white font-bold shadow-xs'
                        : 'text-[#004776] hover:bg-[#e1edf8] hover:text-[#004776]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        active ? 'text-white' : 'text-[#006cee] group-hover:scale-105'
                      }`}
                    />

                    {!collapsed && (
                      <div className="min-w-0 flex-1 flex items-center justify-between gap-1.5">
                        <span className={`text-[13px] truncate ${active ? 'font-bold text-white' : 'font-semibold text-[#004776]'}`}>
                          {item.label}
                        </span>
                        {item.badge && (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${
                              active ? 'bg-white/20 text-white border-white/30' : item.badgeColor || 'bg-blue-50 text-[#006cee] border-blue-200'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer nhỏ dưới đáy sidebar */}
      {!collapsed && (
        <div className="p-3 border-t border-[#e2ecf7] text-[11px] text-[#20446c] text-center bg-[#fafcff]">
          <div className="font-semibold text-[#004776]">HCM-UTE VTVL 360</div>
        </div>
      )}
    </aside>
  );
}
