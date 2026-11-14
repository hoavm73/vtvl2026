'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  FileSpreadsheet,
  Clock,
  ShieldCheck,
  BookOpen,
  Home,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { OperatorSession } from '@/services/telemetry/operator-session';

interface NavItemDef {
  href: string;
  label: string;
  subLabel?: string;
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
        subLabel: 'Lộ trình 5 bước & Việc cần làm',
        icon: Home
      }
    ]
  },
  {
    groupTitle: 'Nghiệp vụ Cá nhân',
    items: [
      {
        href: '/phieu-cong-viec',
        label: 'Phiếu công việc cá nhân',
        subLabel: 'Kê khai, in PDF A4, gán phối hợp',
        icon: FileText,
        badge: 'Ưu tiên',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      },
      {
        href: '/bam-gio',
        label: 'Đo định mức thời gian',
        subLabel: 'Bấm giờ & nhập thời lượng thực tế',
        icon: Clock
      }
    ]
  },
  {
    groupTitle: 'Nghiệp vụ Đơn vị (VTVL 360)',
    items: [
      {
        href: '/bang-tinh',
        label: 'Bảng tính 15 biểu',
        subLabel: 'A1–A2–C1–B1–B2–C2–C3–D1–D2',
        icon: FileSpreadsheet
      }
    ]
  },
  {
    groupTitle: 'Hệ thống & Tra cứu',
    items: [
      {
        href: '/admin',
        label: 'Quản trị hệ thống',
        subLabel: 'Phân quyền, mở khóa C1, phiên làm việc',
        icon: ShieldCheck,
        roles: ['admin', 'unit_leader'],
        badge: 'Admin',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
      },
      {
        href: '/huong-dan',
        label: 'Hướng dẫn nghiệp vụ',
        subLabel: 'Văn bản pháp lý, định mức chuẩn',
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

  const isItemActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/bang-tinh') return pathname === '/bang-tinh';
    if (href === '/phieu-cong-viec') return pathname === '/phieu-cong-viec';
    return pathname.startsWith(href);
  };

  return (
    <aside
      aria-label="Thanh điều hướng nghiệp vụ chính"
      className={`hidden lg:flex flex-col shrink-0 bg-white border-r border-[#d8e3ef] shadow-[2px_0_12px_-4px_rgba(0,71,118,0.04)] transition-all duration-300 z-20 ${
        collapsed ? 'w-[72px]' : 'w-[272px]'
      }`}
    >
      {/* Header Sidebar: Tiêu đề & Nút thu gọn/mở rộng menu */}
      <div className={`p-3 border-b border-[#e2ecf7] flex items-center min-h-[54px] ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 pl-1">
            <span className="w-2 h-2 rounded-full bg-[#006cee]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#004776]">
              Menu Nghiệp vụ
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
                const targetHref = item.href === '/admin' && currentRole !== 'admin'
                  ? '/login?redirect=/admin&admin=true'
                  : item.href;

                return (
                  <Link
                    key={item.href}
                    href={targetHref}
                    title={`${item.label}${item.subLabel ? ` — ${item.subLabel}` : ''}`}
                    className={`flex items-center gap-2.5 rounded-xl transition-all group ${
                      collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5'
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
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
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
                        {item.subLabel && (
                          <div
                            className={`text-[11px] truncate leading-tight mt-0.5 ${
                              active ? 'text-white/90 font-medium' : 'text-[#20446c]'
                            }`}
                            title={item.subLabel}
                          >
                            {item.subLabel}
                          </div>
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
          <div className="text-[10px] text-[#476885]">Chuẩn Hướng dẫn số 07-HD/BTCTW</div>
        </div>
      )}
    </aside>
  );
}
