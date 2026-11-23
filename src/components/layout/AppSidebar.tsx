'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2, ClipboardCheck, FileSpreadsheet, FileText, ShieldCheck,
  BookOpen, Home, ChevronLeft, ChevronRight, ChevronDown, BarChart3, Network, Settings
} from 'lucide-react';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { SidebarTechDocTree } from './SidebarTechDocTree';
import { UserProfilePopover } from '@/components/auth/UserProfilePopover';

const GROUP_STATE_STORAGE_KEY = 'vtvl_sidebar_open_groups_v1';

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
    groupTitle: 'Tổng quan',
    items: [
      { href: '/', label: 'Trang chủ tổng quan', icon: Home },
      { href: '/?tab=unit-monitor', label: 'Theo dõi đơn vị', icon: BarChart3, roles: ['admin'] }
    ]
  },
  {
    groupTitle: 'Nghiệp vụ cá nhân',
    items: [
      { href: '/phieu-cong-viec', label: 'Phiếu công việc cá nhân', icon: FileText }
    ]
  },
  {
    groupTitle: 'Nghiệp vụ đơn vị',
    items: [
      { href: '/nghiep-vu-don-vi', label: 'Hồ sơ đơn vị', icon: Building2, roles: ['admin', 'unit_leader'] },
      { href: '/bang-tinh', label: 'Bảng tính 10 biểu', icon: FileSpreadsheet },
      { href: '/phieu-don-vi', label: 'Quản lý phiếu đơn vị', icon: ClipboardCheck, roles: ['admin', 'unit_leader'] },
      { href: '/nghiep-vu-don-vi?tab=org-tree', label: 'Sơ đồ VTVL dự kiến', icon: Network },
      { href: '/nghiep-vu-don-vi?tab=workforce-chart', label: 'Biểu đồ cơ cấu nhân lực', icon: BarChart3 }
    ]
  },
  {
    groupTitle: 'Kiểm tra & thẩm định TCNS',
    items: [
      { href: '/admin/tham-dinh', label: 'Thẩm định cấp trường', icon: ShieldCheck, roles: ['admin'] }
    ]
  },
  {
    groupTitle: 'Quản trị & tra cứu',
    items: [
      { href: '/admin', label: 'Quản trị hệ thống', icon: Settings, roles: ['admin', 'unit_leader'] },
      { href: '/huong-dan', label: 'Hướng dẫn nghiệp vụ', icon: BookOpen }
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
  const [activeQueryTab, setActiveQueryTab] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [techDocExpanded, setTechDocExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (pathname.startsWith('/huong-dan')) setTechDocExpanded(true);
  }, [pathname]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(GROUP_STATE_STORAGE_KEY);
      if (saved) setCollapsedGroups(JSON.parse(saved) as Record<string, boolean>);
    } catch { /* bỏ qua lỗi truy cập storage */ }
  }, []);

  const toggleGroup = (groupTitle: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupTitle]: !prev[groupTitle] };
      try { localStorage.setItem(GROUP_STATE_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    const syncTab = (ev?: Event) => {
      const custom = ev as CustomEvent<{ tab?: string }> | undefined;
      if (custom?.detail?.tab !== undefined) {
        setActiveQueryTab(custom.detail.tab === 'overview' ? '' : custom.detail.tab);
        return;
      }
      if (typeof window !== 'undefined') {
        setActiveQueryTab(new URLSearchParams(window.location.search).get('tab') || '');
      }
    };
    syncTab();
    window.addEventListener('popstate', syncTab);
    window.addEventListener('vtvl-home-tab-changed', syncTab);
    window.addEventListener('vtvl-unit-tab-changed', syncTab);
    return () => {
      window.removeEventListener('popstate', syncTab);
      window.removeEventListener('vtvl-home-tab-changed', syncTab);
      window.removeEventListener('vtvl-unit-tab-changed', syncTab);
    };
  }, [pathname]);

  const isItemActive = (href: string) => {
    if (href === '/') return pathname === '/' && activeQueryTab !== 'unit-monitor';
    if (href === '/?tab=unit-monitor') return pathname === '/' && activeQueryTab === 'unit-monitor';
    if (href === '/admin/tham-dinh') return pathname.startsWith('/admin/tham-dinh');
    if (href === '/admin') return pathname === '/admin';
    if (href === '/nghiep-vu-don-vi?tab=org-tree') return pathname.startsWith('/nghiep-vu-don-vi') && activeQueryTab === 'org-tree';
    if (href === '/nghiep-vu-don-vi?tab=workforce-chart') return pathname.startsWith('/nghiep-vu-don-vi') && activeQueryTab === 'workforce-chart';
    if (href === '/nghiep-vu-don-vi') return pathname.startsWith('/nghiep-vu-don-vi') && activeQueryTab !== 'org-tree' && activeQueryTab !== 'workforce-chart';
    if (href === '/phieu-don-vi') return pathname === '/phieu-don-vi';
    if (href === '/bang-tinh') return pathname === '/bang-tinh';
    if (href === '/phieu-cong-viec') return pathname === '/phieu-cong-viec';
    return pathname.startsWith(href);
  };

  return (
    <aside
      aria-label="Thanh điều hướng nghiệp vụ chính"
      className={`hidden lg:flex flex-col shrink-0 bg-white border-r border-[#d8e3ef] shadow-[2px_0_12px_-4px_rgba(0,71,118,0.04)] transition-all duration-300 z-20 print:hidden sticky top-16 h-[calc(100vh-4rem)] ${
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
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Mở rộng menu điều hướng' : 'Thu gọn menu điều hướng'}
          title={collapsed ? 'Mở rộng menu điều hướng' : 'Thu gọn menu điều hướng'}
          className="p-2 rounded-lg border border-[#e2ecf7] text-[#476885] hover:text-[#004776] hover:bg-[#f4f7fb] cursor-pointer shrink-0 transition-colors"
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
          const isGroupOpen = !collapsedGroups[group.groupTitle];

          return (
            <div key={group.groupTitle} className="space-y-1">
              {!collapsed && (
                <button
                  type="button"
                  aria-expanded={isGroupOpen}
                  onClick={() => toggleGroup(group.groupTitle)}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-[#f4f7fb] flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-[#20446c]/85 cursor-pointer transition-colors"
                >
                  <span className="truncate text-left">{group.groupTitle}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#476885] shrink-0 transition-transform duration-150 ${
                      isGroupOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
              )}

              {(collapsed || isGroupOpen) && visibleItems.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);
                const targetHref = item.href === '/admin' && currentRole !== 'admin' && currentRole !== 'unit_leader'
                  ? '/login?redirect=/admin&admin=true'
                  : item.href;

                const isTechDocItem = item.href === '/huong-dan';
                return (
                  <div key={item.href}>
                    <div className={`flex items-center gap-1 rounded-xl transition-all ${
                      active ? 'bg-[#006cee] text-white font-bold shadow-xs' : 'text-[#004776] hover:bg-[#e1edf8]'
                    }`}>
                      <Link
                        href={targetHref}
                        title={item.label}
                        onClick={() => {
                          if (isTechDocItem) setTechDocExpanded(true);
                          else if (item.href === '/' || item.href === '/?tab=unit-monitor') {
                            const nextTab = item.href === '/?tab=unit-monitor' ? 'unit-monitor' : 'overview';
                            setActiveQueryTab(nextTab === 'unit-monitor' ? 'unit-monitor' : '');
                            window.dispatchEvent(new CustomEvent('vtvl-home-tab-changed', { detail: { tab: nextTab } }));
                          } else if (item.href.startsWith('/nghiep-vu-don-vi')) {
                            const nextTab = item.href.includes('tab=org-tree') ? 'org-tree' : item.href.includes('tab=workforce-chart') ? 'workforce-chart' : 'overview';
                            setActiveQueryTab(nextTab === 'overview' ? '' : nextTab);
                            window.dispatchEvent(new CustomEvent('vtvl-unit-tab-changed', { detail: { tab: nextTab } }));
                          }
                        }}
                        className={`flex-1 min-w-0 flex items-center gap-2.5 min-h-[40px] group ${collapsed ? 'justify-center p-2.5' : 'pl-3 pr-2 py-2'}`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 transition-transform ${active ? 'text-white' : 'text-[#006cee] group-hover:scale-105'}`} />
                        {!collapsed && (
                          <div className="min-w-0 flex-1 flex items-center justify-between gap-1.5">
                            <span className={`text-[13px] truncate ${active ? 'font-bold text-white' : 'font-semibold text-[#004776]'}`}>{item.label}</span>
                            {item.badge && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${active ? 'bg-white/20 text-white border-white/30' : item.badgeColor || 'bg-blue-50 text-[#006cee] border-blue-200'}`}>
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </Link>
                      {!collapsed && isTechDocItem && (
                        <button
                          type="button"
                          aria-expanded={techDocExpanded}
                          aria-label={techDocExpanded ? 'Thu gọn danh mục hướng dẫn nghiệp vụ' : 'Xổ ra danh mục hướng dẫn nghiệp vụ'}
                          onClick={() => setTechDocExpanded((v) => !v)}
                          className={`mr-1.5 p-1.5 rounded-lg cursor-pointer transition-colors shrink-0 ${active ? 'hover:bg-white/20 text-white' : 'hover:bg-[#d3e4f7] text-[#476885]'}`}
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${techDocExpanded ? 'rotate-0' : '-rotate-90'}`} />
                        </button>
                      )}
                    </div>
                    {!collapsed && isTechDocItem && techDocExpanded && <SidebarTechDocTree userRole={currentRole} />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Cụm tài khoản cố định dưới đáy sidebar trái */}
      <div className={`border-t border-[#e2ecf7] bg-[#fafcff] shrink-0 ${collapsed ? 'p-2 flex justify-center' : 'p-2.5'}`}>
        <UserProfilePopover placement="sidebar" collapsed={collapsed} />
      </div>
    </aside>
  );
}
