'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Building2, UserCog, Lock, FileSpreadsheet,
  Share2, FolderSync, Users, CheckSquare, FileText,
  Clock, BookOpen, Send, ArrowRight
} from 'lucide-react';
import { UserRole } from '@/services/auth/account-client';

interface OverviewRoleActionCardsProps {
  currentRole?: UserRole;
}

interface ActionCardItem {
  id: string;
  title: string;
  target: string;
  desc: string;
  href: string;
  btnLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
}

const ROLE_ACTIONS: Record<UserRole, { label: string; badge: string; subtitle: string; actions: ActionCardItem[] }> = {
  admin: {
    label: 'Quản trị viên hệ thống (TCNS)',
    badge: 'Quyền Quản trị viên',
    subtitle: 'Nhiệm vụ điều hành toàn diện danh mục đơn vị, phân quyền cán bộ và thẩm định đề án toàn trường',
    actions: [
      {
        id: 'admin-units',
        title: 'Quản lý danh mục 51 đơn vị & Cấu hình mã',
        target: 'Trang Quản trị · Danh mục đơn vị',
        desc: 'Thiết lập mã đơn vị, tên đơn vị, tự động đồng bộ liên thông sang 15 biểu, mã nhiệm vụ, công việc và công thức.',
        href: '/admin?tab=units',
        btnLabel: 'Quản lý 51 đơn vị',
        icon: Building2,
        tag: 'Cấu hình nền tảng'
      },
      {
        id: 'admin-accounts',
        title: 'Quản trị tài khoản & Phân quyền cán bộ',
        target: 'Trang Quản trị · Tài khoản & Phân quyền',
        desc: 'Khởi tạo tài khoản công vụ, phân công Lãnh đạo đơn vị cho 51 đơn vị, cấp quyền hoặc khóa tài khoản.',
        href: '/admin?tab=accounts',
        btnLabel: 'Quản trị phân quyền',
        icon: UserCog,
        tag: 'Bảo mật & Người dùng'
      },
      {
        id: 'admin-c1-lock',
        title: 'Kiểm soát & Khóa danh mục VTVL chuẩn (C1)',
        target: 'Biểu 3. C1_VTVL · Khóa Quản trị',
        desc: 'Khóa biểu C1_VTVL để bảo vệ danh mục vị trí việc làm toàn trường, mở khóa khi cần điều chỉnh danh mục bổ sung.',
        href: '/bang-tinh?sheet=C1',
        btnLabel: 'Mở biểu C1_VTVL',
        icon: Lock,
        tag: 'Bảo vệ khung danh mục'
      },
      {
        id: 'admin-audit',
        title: 'Giám sát tiến độ & Thẩm định đề án các đơn vị',
        target: 'Trang Rà soát · Báo cáo Thẩm định',
        desc: 'Theo dõi tiến độ nộp đề án của 51 đơn vị, kiểm tra chéo 6 chỉ tiêu K_KiemTra và xuất báo cáo thẩm định gửi BGH.',
        href: '/ra-soat',
        btnLabel: 'Thẩm định đề án',
        icon: ShieldCheck,
        tag: 'Thẩm định Đề án'
      }
    ]
  },
  unit_leader: {
    label: 'Lãnh đạo đơn vị (Trưởng/Phó Khoa, Phòng, Viện, TT)',
    badge: 'Quyền Lãnh đạo đơn vị',
    subtitle: 'Nhiệm vụ chủ trì lập, phát phiếu, gộp dữ liệu và thẩm định đề án VTVL của đơn vị',
    actions: [
      {
        id: 'lead-a1-a2',
        title: 'Rà soát danh mục nhiệm vụ & công việc (A1, A2)',
        target: 'Biểu 1. A1_NhiemVu · Biểu 2. A2_CongViec',
        desc: 'Kiểm tra chức năng nhiệm vụ đơn vị đã nạp từ QĐ 2266, phân rã công việc chi tiết và đối chiếu sản phẩm chuẩn.',
        href: '/bang-tinh?sheet=A1',
        btnLabel: 'Rà soát A1 & A2',
        icon: FileSpreadsheet,
        tag: 'Chuẩn hóa công việc'
      },
      {
        id: 'lead-share-form',
        title: 'Phát hành phiếu khảo sát & Mã QR',
        target: 'Phiếu công việc cá nhân · Chia sẻ mã QR',
        desc: 'Tạo mã QR và sao chép liên kết phát cho cán bộ, giảng viên, nhân viên trong đơn vị tự kê khai khối lượng công việc.',
        href: '/phieu-cong-viec',
        btnLabel: 'Phát hành phiếu',
        icon: Share2,
        tag: 'Khảo sát định mức'
      },
      {
        id: 'lead-merge-b1-b2',
        title: 'Kiểm duyệt, nạp & gộp phiếu công việc (B1, B2)',
        target: 'Biểu 4. B1_KhoiLuong · Biểu 6. B2_ThayDoi',
        desc: 'Tổng hợp số lượng sản phẩm/năm, tính tổng giờ công việc và đánh giá mức độ giảm giờ nhờ chuyển đổi số tại B2.',
        href: '/bang-tinh?sheet=B1',
        btnLabel: 'Nạp & Gộp Biểu B1',
        icon: FolderSync,
        tag: 'Lượng hóa định mức'
      },
      {
        id: 'lead-c3-d2',
        title: 'Lập phương án nhân lực 5 năm (C3, D1, D2)',
        target: 'Biểu 8. C3 · Biểu 9. D1 · Biểu 10. D2',
        desc: 'Tính số người cần thiết (FTE) theo PP1/PP2, rà soát thực trạng nhân sự D1 và lập phương án bố trí biên chế 2026–2030.',
        href: '/bang-tinh?sheet=D2',
        btnLabel: 'Lập phương án D2',
        icon: Users,
        tag: 'Phương án nhân lực'
      },
      {
        id: 'lead-review-submit',
        title: 'Kiểm tra chéo 6 chỉ tiêu & Xuất nộp hồ sơ',
        target: 'Biểu 13. K_KiemTra · Xuất 10 biểu gốc',
        desc: 'Rà soát toàn vẹn 6/6 chỉ tiêu kiểm tra, xuất tệp Excel hoàn chỉnh và gửi nộp hồ sơ về Phòng Tổ chức – Nhân sự.',
        href: '/ra-soat',
        btnLabel: 'Kiểm tra & Nộp đề án',
        icon: CheckSquare,
        tag: 'Hoàn tất đề án'
      }
    ]
  },
  staff: {
    label: 'Cán bộ – Giảng viên – Nhân viên',
    badge: 'Quyền Cán bộ – Giảng viên',
    subtitle: 'Nhiệm vụ trực tiếp kê khai phiếu mô tả công việc, bấm giờ đo đạc thời lượng và nộp hồ sơ',
    actions: [
      {
        id: 'staff-form',
        title: 'Kê khai phiếu công việc cá nhân',
        target: 'Phiếu công việc cá nhân · Biểu B2_CT',
        desc: 'Khai báo các công việc đảm nhận, mô tả sản phẩm đầu ra, chất lượng đạt chuẩn và công đoạn chịu tác động CĐS.',
        href: '/phieu-cong-viec',
        btnLabel: 'Mở phiếu công việc',
        icon: FileText,
        tag: 'Kê khai cá nhân'
      },
      {
        id: 'staff-timer',
        title: 'Bấm giờ đo định mức thời gian thực tế',
        target: 'Công cụ Bấm giờ đo định mức',
        desc: 'Bấm giờ trực tiếp trên hệ thống để đo lường số phút thực hiện mỗi sản phẩm/hồ sơ, ghi nhận số liệu khách quan.',
        href: '/bam-gio',
        btnLabel: 'Bấm giờ thực tế',
        icon: Clock,
        tag: 'Đo lường định mức'
      },
      {
        id: 'staff-catalog',
        title: 'Tra cứu danh mục sản phẩm chuẩn (DM_SP)',
        target: 'Biểu 11. DM_SAN_PHAM · Giờ chuẩn',
        desc: 'Tra cứu danh mục sản phẩm mẫu từ Nhóm I đến Nhóm VI và định mức thời gian chuẩn quy định tại HCM-UTE.',
        href: '/bang-tinh?sheet=DM_SP',
        btnLabel: 'Tra cứu sản phẩm',
        icon: BookOpen,
        tag: 'Định mức chuẩn'
      },
      {
        id: 'staff-submit',
        title: 'Nộp phiếu công việc cho Lãnh đạo đơn vị',
        target: 'Nộp phiếu trực tuyến & Xuất tệp cá nhân',
        desc: 'Hoàn thiện phiếu cá nhân, kiểm tra số giờ công việc và gửi phiếu để Lãnh đạo đơn vị kiểm duyệt và tích hợp.',
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
    <section className="bg-white rounded-3xl border border-[#d8e3ef] p-4 sm:p-7 shadow-[0_4px_20px_-4px_rgba(0,71,118,0.06)] space-y-4 sm:space-y-5">
      {/* Title & Role Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#e2ecf7] pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#004776]">
            Các việc có thể bạn cần làm theo từng nhóm quyền
          </h2>
          <p className="text-xs sm:text-sm text-[#476885] mt-1 font-medium">
            Chọn nhóm vai trò để xem các bước nghiệp vụ được khuyến nghị thực hiện
          </p>
        </div>

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

      {/* Role explanation */}
      <div className="p-3.5 rounded-2xl bg-[#f5f9ff] border border-[#d8e3ef] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-[#0072BC] uppercase tracking-wider block">
            {activeData.badge}
          </span>
          <p className="text-xs font-medium text-[#20446c] mt-0.5">
            {activeData.subtitle}
          </p>
        </div>
        <span className="text-[11px] font-bold text-[#476885] bg-white px-2.5 py-1 rounded-lg border border-[#d8e3ef] shrink-0 self-start sm:self-center">
          {activeData.actions.length} việc trọng tâm
        </span>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeData.actions.map((act, idx) => {
          const Icon = act.icon;
          return (
            <div
              key={act.id}
              className="p-4 sm:p-5 rounded-2xl border border-[#d8e3ef] bg-white hover:border-[#004776]/40 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#e1edf8] text-[#006cee] flex items-center justify-center shrink-0 border border-[#cbd5e1]/60">
                      <Icon className="w-5 h-5 text-[#006cee]" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-[#006cee]">Việc {idx + 1}</span>
                      <h3 className="text-sm font-bold text-[#004776] leading-snug">
                        {act.title}
                      </h3>
                    </div>
                  </div>
                  <span className="text-[10.5px] font-semibold text-[#20446c] bg-[#e1edf8] px-2 py-0.5 rounded-md border border-[#cbd5e1]/60 shrink-0">
                    {act.tag}
                  </span>
                </div>

                <div className="text-[11.5px] font-semibold text-[#004776] bg-[#e1edf8] px-2.5 py-1 rounded-lg border border-[#cbd5e1]/60">
                  Phạm vi: {act.target}
                </div>

                <p className="text-xs text-[#20446c] leading-relaxed">
                  {act.desc}
                </p>
              </div>

              <div className="pt-2 border-t border-[#f0f4f9] flex items-center justify-end">
                <Link
                  href={act.href}
                  className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-full bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <span>{act.btnLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
