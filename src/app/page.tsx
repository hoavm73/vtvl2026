'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, CheckCircle2, History, Clock, AlertTriangle, FileSpreadsheet, ArrowRight
} from 'lucide-react';
import { OverviewWelcomeBanner } from '@/components/overview/OverviewWelcomeBanner';
import { OverviewProcessAndLegal } from '@/components/overview/OverviewProcessAndLegal';
import { OverviewRoleActionCards } from '@/components/overview/OverviewRoleActionCards';
import { AdminLoginModal } from '@/components/auth/AdminLoginModal';
import { SIDEBAR_FIVE_STEPS } from '@/components/layout/MilestonesBar';
import { validateStep1Data } from '@/components/tao-tep/Step1ReviewConfirm';
import {
  ActiveUnitSession, ActivityLogEntry, getActiveUnitDefinition,
  getActiveUnitSession, getActivityLogs
} from '@/services/telemetry/activity-log';
import { OperatorSession, getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { consumeGoogleOAuthCallback } from '@/services/auth/google-auth';

export default function HomePage() {
  const router = useRouter();
  const [operator, setOperator] = useState<OperatorSession | null>(() => {
    if (typeof window !== 'undefined') {
      return getCurrentOperatorSession();
    }
    return null;
  });
  const [session, setSession] = useState<ActiveUnitSession>(() => getActiveUnitSession());
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

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
      window.removeEventListener('vtvl-operator-changed', syncState);
      window.removeEventListener('vtvl-unit-session-updated', syncState);
      window.removeEventListener('vtvl-activity-updated', syncState);
      window.removeEventListener('storage', syncState);
      bc?.close();
    };
  }, []);

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
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="w-10 h-10 border-3 border-[#006cee] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-[#004776]">Đang chuyển hướng tới cổng đăng nhập HCM-UTE…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 lg:px-6 py-5 space-y-6">
      {/* 1. Banner chào mừng cá nhân hóa */}
      <OverviewWelcomeBanner
        session={operator}
        onOpenAdminLogin={() => setIsAdminModalOpen(true)}
      />

      {/* 2. Danh mục việc cần làm theo từng nhóm quyền */}
      <OverviewRoleActionCards currentRole={operator?.role || 'staff'} />

      {/* 3. Giới thiệu quy trình 5 bước & Căn cứ pháp lý */}
      <OverviewProcessAndLegal />

      {/* 4. Tiến độ đơn vị & Nhật ký thao tác */}
      <section className="bg-white rounded-3xl border border-[#d8e3ef] p-6 sm:p-7 shadow-[0_4px_20px_-4px_rgba(0,71,118,0.06)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2ecf7] pb-4">
          <div className="space-y-1">
            <span className="text-xs font-bold text-[#006cee] uppercase tracking-wider">
              Hồ sơ đề án đang thực hiện
            </span>
            <div className="text-lg font-bold text-[#004776] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#004776]" />
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
              href="/bang-tinh"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-[#e1edf8] hover:bg-[#e3ecf6] text-[#004776] border border-[#d8e3ef] text-xs font-semibold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#004776]" />
              <span>Bảng tính 15 biểu</span>
            </Link>
            <Link
              href="/bang-tinh"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Mở hồ sơ đơn vị</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Tiến độ chi tiết */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
          <div className="space-y-2 p-4 rounded-2xl bg-[#f8fbff] border border-[#dbe8f5]">
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
            <div className="w-full h-2.5 rounded-full bg-[#e2e8f0] overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#006cee] to-[#00b87a] rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
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

          {/* Nhật ký thao tác gần đây */}
          <div className="p-4 rounded-2xl bg-[#f8fbff] border border-[#dbe8f5] space-y-2">
            <div className="flex items-center justify-between border-b border-[#e2ecf7] pb-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#004776]" />
                <h3 className="text-xs font-bold text-[#004776]">Nhật ký thao tác gần đây</h3>
              </div>
              <span className="text-[11px] font-semibold text-[#476885]">{logs.length} bản ghi</span>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-[#476885] py-2">Chưa có bản ghi nhật ký nào.</p>
            ) : (
              <ul className="divide-y divide-[#eef3f8] max-h-28 overflow-y-auto pr-1">
                {logs.slice(0, 3).map((log) => (
                  <li key={log.id} className="py-1.5 text-xs">
                    <span className="font-bold text-[#004776] mr-1">[{log.unitCode}]</span>
                    <span className="text-[#335d84]">{log.details}</span>
                    <div className="text-[10.5px] text-[#476885] mt-0.5">{log.timestamp}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={() => syncState()}
      />
    </div>
  );
}
