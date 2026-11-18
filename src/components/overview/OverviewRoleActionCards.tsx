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
        href: '/admin/tham-dinh',
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
        title: 'Quản lý, duyệt & gộp phiếu công việc đơn vị',
        href: '/phieu-don-vi',
        btnLabel: 'Quản lý phiếu ĐV',
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
        title: 'Kiểm tra chéo 6 chỉ tiêu & Gửi hồ sơ TCNS',
        href: '/nghiep-vu-don-vi?tab=check',
        btnLabel: 'Kiểm tra & Gửi TCNS',
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
    <section className="bg-white rounded-[16px] border border-[#e2e8f0] p-4 sm:p-6 space-y-3">
      {/* Tiêu đề & Segmented Tabs vai trò phẳng */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#e2e8f0] pb-3.5">
        <h2 className="text-base sm:text-lg font-bold text-[#0072BC]">
          Tác vụ nhanh theo vai trò
        </h2>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#f1f5f9] rounded-[10px] self-start lg:self-center">
          {(Object.keys(ROLE_ACTIONS) as UserRole[]).map((r) => {
            const isSelected = selectedRole === r;
            const isUserOwnRole = currentRole === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-white text-[#004776]'
                    : 'text-[#476885] hover:text-[#004776]'
                }`}
              >
                <span>{ROLE_ACTIONS[r].label.split('(')[0].trim()}</span>
                {isUserOwnRole && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006cee]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Danh sách tác vụ phẳng ngăn bằng divider: icon + tiêu đề + mô tả + mũi tên */}
      <div className="divide-y divide-[#e2e8f0]">
        {activeData.actions.map((act) => {
          const Icon = act.icon;
          return (
            <Link
              key={act.id}
              href={act.href}
              className="py-3 px-2 -mx-2 rounded-[10px] hover:bg-[#f8fbff] transition-colors flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className="w-5 h-5 text-[#006cee] shrink-0" />
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-semibold text-[#004776] group-hover:text-[#006cee] transition-colors leading-snug">
                    {act.title}
                  </div>
                  <div className="text-xs text-[#476885]">
                    {act.tag} · {act.btnLabel}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-[#476885] group-hover:text-[#006cee] group-hover:translate-x-0.5 transition-all shrink-0" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
