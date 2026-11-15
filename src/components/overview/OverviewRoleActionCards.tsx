'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Building2, UserCog, Lock, FileSpreadsheet,
  Share2, FolderSync, Users, CheckSquare, FileText,
  BookOpen, Send, ArrowRight
} from 'lucide-react';
import { UserRole } from '@/services/auth/account-client';

interface OverviewRoleActionCardsProps {
  currentRole?: UserRole;
}

interface ActionCardItem {
  id: string;
  title: string;
  href: string;
  btnLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}

const ROLE_ACTIONS: Record<UserRole, { label: string; actions: ActionCardItem[] }> = {
  admin: {
    label: 'Quản trị viên hệ thống (TCNS)',
    actions: [
      {
        id: 'admin-units',
        title: 'Quản lý danh mục 39 đơn vị & Cấu hình mã',
        href: '/admin?tab=units',
        btnLabel: 'Quản lý 39 đơn vị',
        icon: Building2,
        tag: 'Cấu hình nền tảng'
      },
      {
        id: 'admin-accounts',
        title: 'Quản trị tài khoản & Phân quyền cán bộ',
        href: '/admin?tab=accounts',
        btnLabel: 'Quản trị phân quyền',
        icon: UserCog,
        tag: 'Bảo mật & người dùng'
      },
      {
        id: 'admin-c1-lock',
        title: 'Kiểm soát & Khóa danh mục VTVL chuẩn (C1)',
        href: '/bang-tinh?sheet=C1',
        btnLabel: 'Mở biểu C1_VTVL',
        icon: Lock,
        tag: 'Khung danh mục'
      },
      {
        id: 'admin-audit',
        title: 'Giám sát tiến độ & Thẩm định đề án các đơn vị',
        href: '/ra-soat',
        btnLabel: 'Thẩm định đề án',
        icon: ShieldCheck,
        tag: 'Thẩm định đề án'
      }
    ]
  },
  unit_leader: {
    label: 'Lãnh đạo đơn vị (Trưởng/Phó Khoa, Phòng, Viện, TT)',
    actions: [
      {
        id: 'lead-a1-a2',
        title: 'Rà soát danh mục nhiệm vụ & công việc (A1, A2)',
        href: '/bang-tinh?sheet=A1',
        btnLabel: 'Rà soát A1 & A2',
        icon: FileSpreadsheet,
        tag: 'Chuẩn hóa công việc'
      },
      {
        id: 'lead-share-form',
        title: 'Phát hành phiếu khảo sát & Mã QR',
        href: '/phieu-cong-viec',
        btnLabel: 'Phát hành phiếu',
        icon: Share2,
        tag: 'Khảo sát định mức'
      },
      {
        id: 'lead-merge-b1-b2',
        title: 'Kiểm duyệt, nạp & gộp phiếu công việc (B1, B2)',
        href: '/bang-tinh?sheet=B1',
        btnLabel: 'Nạp & Gộp Biểu B1',
        icon: FolderSync,
        tag: 'Lượng hóa định mức'
      },
      {
        id: 'lead-c3-d2',
        title: 'Lập phương án nhân lực 5 năm (C3, D1, D2)',
        href: '/bang-tinh?sheet=D2',
        btnLabel: 'Lập phương án D2',
        icon: Users,
        tag: 'Phương án nhân lực'
      },
      {
        id: 'lead-review-submit',
        title: 'Kiểm tra chéo 6 chỉ tiêu & Xuất nộp hồ sơ',
        href: '/ra-soat',
        btnLabel: 'Kiểm tra & Nộp đề án',
        icon: CheckSquare,
        tag: 'Hoàn tất đề án'
      }
    ]
  },
  staff: {
    label: 'Cán bộ – Giảng viên – Nhân viên',
    actions: [
      {
        id: 'staff-form',
        title: 'Kê khai phiếu công việc cá nhân',
        href: '/phieu-cong-viec',
        btnLabel: 'Mở phiếu công việc',
        icon: FileText,
        tag: 'Kê khai cá nhân'
      },
      {
        id: 'staff-catalog',
        title: 'Tra cứu danh mục sản phẩm chuẩn (DM_SP)',
        href: '/bang-tinh?sheet=DM_SP',
        btnLabel: 'Tra cứu sản phẩm',
        icon: BookOpen,
        tag: 'Định mức chuẩn'
      },
      {
        id: 'staff-submit',
        title: 'Nộp phiếu công việc cho Lãnh đạo đơn vị',
        href: '/phieu-cong-viec',
        btnLabel: 'Gửi nộp phiếu',
        icon: Send,
        tag: 'Nộp kết quả'
      }
    ]
  }
};

export function OverviewRoleActionCards({ currentRole = 'staff' }: OverviewRoleActionCardsProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const activeData = ROLE_ACTIONS[selectedRole] || ROLE_ACTIONS.staff;

  return (
    <section className="bg-white rounded-3xl border border-[#d8e3ef] p-4 sm:p-6 shadow-[0_4px_20px_-4px_rgba(0,71,118,0.06)] space-y-4">
      {/* Title & Role Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#e2ecf7] pb-3.5">
        <h2 className="text-base sm:text-lg font-bold text-[#004776]">
          Tác vụ nhanh theo vai trò
        </h2>

        {/* Tab buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#f0f5fa] rounded-2xl border border-[#d8e3ef] self-start lg:self-center">
          {(Object.keys(ROLE_ACTIONS) as UserRole[]).map((r) => {
            const isSelected = selectedRole === r;
            const isUserOwnRole = currentRole === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#006cee] text-white shadow-xs'
                    : 'text-[#20446c] hover:text-[#004776] hover:bg-white/80'
                }`}
              >
                <span>{ROLE_ACTIONS[r].label.split('(')[0].trim()}</span>
                {isUserOwnRole && (
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-[#006cee]'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {activeData.actions.map((act) => {
          const Icon = act.icon;
          return (
            <div
              key={act.id}
              className="p-4 rounded-2xl border border-[#d8e3ef] bg-white hover:border-[#006cee]/40 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#e1edf8] text-[#006cee] flex items-center justify-center shrink-0 border border-[#cbd5e1]/60">
                  <Icon className="w-4.5 h-4.5 text-[#006cee]" />
                </div>
                <div className="min-w-0 space-y-1">
                  <span className="inline-block text-[10.5px] font-semibold text-[#20446c] bg-[#e1edf8] px-2 py-0.5 rounded-md">
                    {act.tag}
                  </span>
                  <h3 className="text-sm font-bold text-[#004776] leading-snug">
                    {act.title}
                  </h3>
                </div>
              </div>

              <Link
                href={act.href}
                className="inline-flex items-center justify-center gap-1.5 h-8.5 px-3.5 rounded-full bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all active:scale-[0.98] shrink-0 self-end sm:self-center whitespace-nowrap"
              >
                <span>{act.btnLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
