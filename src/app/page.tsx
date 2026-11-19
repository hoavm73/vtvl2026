'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, CheckCircle2, History, Clock, AlertTriangle, FileText, ArrowRight, BarChart3, LayoutDashboard
} from 'lucide-react';
import { OverviewWelcomeBanner } from '@/components/overview/OverviewWelcomeBanner';
import { SchoolOverviewDashboard } from '@/components/overview/SchoolOverviewDashboard';
import { OverviewRoleActionCards } from '@/components/overview/OverviewRoleActionCards';
import { UnitMonitoringDashboard } from '@/components/overview/UnitMonitoringDashboard';
import { UnitReviewStatusWidget } from '@/components/workbooks/UnitReviewStatusWidget';
import { PageWorkspaceSkeleton } from '@/components/ui/Skeleton';
import { SIDEBAR_FIVE_STEPS } from '@/components/layout/MilestonesBar';
import { validateStep1Data } from '@/components/tao-tep/Step1ReviewConfirm';
import {
  ActiveUnitSession, ActivityLogEntry, getActiveUnitDefinition,
  getActiveUnitSession, getActivityLogs
} from '@/services/telemetry/activity-log';
import { OperatorSession, getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { consumeGoogleOAuthCallback } from '@/services/auth/google-auth';
import { syncContextQueryParams } from '@/services/context/workbook-context';

export default function HomePage() {
  const router = useRouter();
  const [operator, setOperator] = useState<OperatorSession | null>(null);
  const [session, setSession] = useState<ActiveUnitSession>({
    unitCode: 'CK',
    kind: 'khoa-vien',
    customDate: '2026-06-17',
    actorEmail: '',
    actorTitle: 'Lãnh đạo đơn vị',
    activeStep: 1,
    wizardStage: 1,
    lastSavedAt: '',
    ngachOverrides: {},
    customPositionNames: {},
    customCareerLevels: {},
    proposedPositions: []
  });
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'unit-monitor'>('overview');

  const syncState = () => {
    const oauth = consumeGoogleOAuthCallback();
    const cur = oauth || getCurrentOperatorSession();
    setOperator(cur);
    setSession(getActiveUnitSession());
    setLogs(getActivityLogs());
    return cur;
  };

  useEffect(() => {
    const cur = syncState();
    const hasHash = typeof window !== 'undefined' && window.location.hash.includes('access_token=');
    if (!cur && !hasHash) {
      router.replace('/login');
    }
    const syncTabFromLocation = (ev?: Event) => {
      const custom = ev as CustomEvent<{ tab?: string }> | undefined;
      if (custom?.detail?.tab === 'unit-monitor' || custom?.detail?.tab === 'overview') {
        setActiveTab(custom.detail.tab);
        return;
      }
      if (typeof window !== 'undefined') {
        const tabParam = new URLSearchParams(window.location.search).get('tab');
        setActiveTab(tabParam === 'unit-monitor' ? 'unit-monitor' : 'overview');
      }
    };
    syncTabFromLocation();
    window.addEventListener('popstate', syncTabFromLocation);
    window.addEventListener('vtvl-home-tab-changed', syncTabFromLocation);
    window.addEventListener('vtvl-operator-changed', syncState);
    window.addEventListener('vtvl-unit-session-updated', syncState);
    window.addEventListener('vtvl-activity-updated', syncState);
    window.addEventListener('storage', syncState);

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('hcmute_vtvl_realtime');
      bc.onmessage = syncState;
    }
    return () => {
      window.removeEventListener('popstate', syncTabFromLocation);
      window.removeEventListener('vtvl-home-tab-changed', syncTabFromLocation);
      window.removeEventListener('vtvl-operator-changed', syncState);
      window.removeEventListener('vtvl-unit-session-updated', syncState);
      window.removeEventListener('vtvl-activity-updated', syncState);
      window.removeEventListener('storage', syncState);
      bc?.close();
    };
  }, []);

  const handleSwitchTab = (nextTab: 'overview' | 'unit-monitor') => {
    setActiveTab(nextTab);
    syncContextQueryParams({ tab: nextTab === 'unit-monitor' ? 'unit-monitor' : null }, 'push');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vtvl-home-tab-changed', { detail: { tab: nextTab } }));
    }
  };

  const activeUnit = getActiveUnitDefinition(operator?.unitCode || session.unitCode);
  const rawStep = session.activeStep || 1;
  const currentStepNum = rawStep === 2 ? 6 : rawStep === 4 ? 7 : rawStep === 5 ? 8 : rawStep === 1 ? (session.wizardStage === 3 ? 2 : session.wizardStage >= 4 ? 5 : 1) : rawStep;
  const currentStepInfo = SIDEBAR_FIVE_STEPS.find((s) => s.num === currentStepNum) || SIDEBAR_FIVE_STEPS[0];
  const hasOperator = Boolean(operator?.email || (session.actorEmail.trim() && session.actorTitle.trim()));
  const progressPercent = Math.min(100, Math.round((currentStepNum / 8) * 100));

  const validationErrors = validateStep1Data(
    activeUnit,
    operator?.email || session.actorEmail,
    operator?.title || session.actorTitle,
    session.proposedPositions
  );

  if (!operator) {
    return (
      <div className="w-full min-h-[60vh]">
        <PageWorkspaceSkeleton statusText="Đang chuyển hướng tới cổng đăng nhập HCM-UTE…" />
      </div>
    );
  }

  const isTcnsOrAdmin = Boolean(
    operator?.role === 'admin' ||
    operator?.unitCode?.toUpperCase() === 'TCNS' ||
    operator?.email?.toLowerCase() === 'tcns@hcmute.edu.vn'
  );

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 lg:px-6 py-5 space-y-6">
      {/* 1. Banner chào mừng cá nhân hóa */}
      <OverviewWelcomeBanner session={operator} />

      {/* Thanh chuyển đổi Tab phẳng (Segmented control) dành riêng cho Phòng TCNS & Admin */}
      {isTcnsOrAdmin && (
        <div
          role="tablist"
          aria-label="Chế độ xem tổng quan"
          className="inline-flex flex-wrap items-center gap-1 bg-[#e9f0f8] p-1 rounded-[10px]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            onClick={() => handleSwitchTab('overview')}
            className={`h-9 px-3.5 sm:px-4 rounded-[8px] text-xs sm:text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006cee] focus-visible:ring-offset-1 ${
              activeTab === 'overview'
                ? 'bg-white text-[#004776]'
                : 'text-[#20446c] hover:text-[#004776]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 stroke-[2] shrink-0" />
            <span>Tổng quan toàn trường</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'unit-monitor'}
            onClick={() => handleSwitchTab('unit-monitor')}
            className={`h-9 px-3.5 sm:px-4 rounded-[8px] text-xs sm:text-[13px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006cee] focus-visible:ring-offset-1 ${
              activeTab === 'unit-monitor'
                ? 'bg-white text-[#004776]'
                : 'text-[#20446c] hover:text-[#004776]'
            }`}
          >
            <BarChart3 className="w-4 h-4 stroke-[2] shrink-0" />
            <span>Theo dõi đơn vị</span>
          </button>
        </div>
      )}

      {isTcnsOrAdmin && activeTab === 'unit-monitor' ? (
        <UnitMonitoringDashboard />
      ) : (
        <>
          {/* 2. Dashboard gọn các con số của trường (ai cũng xem được, nằm dưới phần xin chào) */}
          <SchoolOverviewDashboard />

          {/* 3. Danh mục việc cần làm theo từng nhóm quyền */}
          <OverviewRoleActionCards currentRole={operator?.role || 'staff'} />

          {/* 4. Tiến độ đơn vị & Nhật ký thao tác (1 container ngoài, ngăn bằng divider) */}
          <section className="bg-white rounded-[16px] border border-[#e2e8f0] p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e8f0] pb-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#006cee] uppercase tracking-wider">
                  Hồ sơ đề án đang thực hiện
                </span>
                <div className="text-base sm:text-lg font-bold text-[#0072BC] flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#0072BC] shrink-0" />
                  <span>[{activeUnit.code}] {activeUnit.nameVi}</span>
                </div>
                <p className="text-xs text-[#20446c]">
                  {hasOperator
                    ? `Nhân sự phụ trách: ${operator?.displayName || session.actorTitle || 'Chuyên viên'} (${operator?.email || session.actorEmail})`
                    : 'Chưa kích hoạt phiên nhân sự'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <Link
                  href="/phieu-cong-viec"
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] hover:bg-[#eef5ff] text-[#004776] border border-[#cbd5e1] text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-[#006cee]" />
                  <span>Phiếu công việc cá nhân</span>
                </Link>
                <Link
                  href={operator?.role === 'staff' ? `/bang-tinh?unit=${encodeURIComponent(activeUnit.code)}` : `/nghiep-vu-don-vi?tab=overview&unitCode=${encodeURIComponent(activeUnit.code)}`}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-[10px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold transition-colors active:scale-[0.98] cursor-pointer"
                >
                  <span>{operator?.role === 'staff' ? 'Xem bảng tính đơn vị' : 'Mở hồ sơ đơn vị'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Thanh tiến độ thẩm định 4 bước của đơn vị */}
            <UnitReviewStatusWidget unitCode={activeUnit.code} />

            {/* Tiến độ chi tiết & Nhật ký chia cột bằng divider, không bọc card con */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#e2e8f0]">
              <div className="space-y-2.5 pb-4 md:pb-0 md:pr-6">
                <div className="flex items-center justify-between text-xs font-semibold text-[#20446c]">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#004776]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Tiến độ thực hiện ({progressPercent}%)</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#20446c]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{session.lastSavedAt || 'Vừa cập nhật'}</span>
                  </span>
                </div>
                <div className="text-sm font-bold text-[#004776]">
                  Bước {currentStepNum}/8 — {currentStepInfo.shortTitle}
                </div>
                <div className="w-full h-2 rounded-full bg-[#e2e8f0] overflow-hidden">
                  <div className="h-full bg-[#006cee] rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="flex items-center justify-between text-[11.5px] text-[#20446c] pt-1">
                  <span>{session.proposedPositions.length} vị trí việc làm</span>
                  {validationErrors.length > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{validationErrors.length} mục cần bổ sung</span>
                    </span>
                  ) : (
                    <span className="font-semibold text-emerald-700">Đủ điều kiện xuất biểu</span>
                  )}
                </div>
              </div>

              <div className="pt-4 md:pt-0 md:pl-6 space-y-2">
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-[#0072BC]" />
                    <h3 className="text-xs font-bold text-[#0072BC]">Nhật ký thao tác gần đây</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e6f9f1] text-[#008f5d] text-[10px] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00b87a] animate-pulse" /><span>Cập nhật liên tục</span>
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#476885]">{logs.length} bản ghi</span>
                </div>
                {logs.length === 0 ? (
                  <p className="text-xs text-[#476885] py-2">Chưa có bản ghi nhật ký nào.</p>
                ) : (
                  <div className="relative pl-4 space-y-2.5 max-h-32 overflow-y-auto pr-1">
                    <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-[#dbe8f5]" />
                    {logs.slice(0, 3).map((log, idx) => (
                      <div key={log.id} className="relative text-xs">
                        <span className={`absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full ring-3 bg-[#006cee] ring-[#e6f1ff] ${idx === 0 ? 'animate-pulse' : ''}`} />
                        <span className="font-bold text-[#004776] mr-1">[{log.unitCode}]</span>
                        <span className="text-[#335d84]">{log.details}</span>
                        <div className="text-[10.5px] text-[#476885] mt-0.5 tabular-nums">{log.timestamp}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
