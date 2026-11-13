'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CheckCircle2, History, FileText, Clock, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { SIDEBAR_FIVE_STEPS } from '@/components/layout/MilestonesBar';
import { Badge } from '@/components/ui/Badge';
import { HCMUTE_UNITS } from '@/configs/hcmute-units';
import { HD07_12_STEP_ORDER, HD07_CONSTANTS } from '@/configs/hcmute-hd07-catalog';
import { validateStep1Data } from '@/components/tao-tep/Step1ReviewConfirm';
import { ActiveUnitSession, ActivityLogEntry, getActiveUnitDefinition, getActiveUnitSession, getActivityLogs } from '@/services/telemetry/activity-log';

export default function HomePage() {
  const router = useRouter();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [session, setSession] = useState<ActiveUnitSession>(() => getActiveUnitSession());
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') !== 'overview') {
        setShouldRedirect(true);
        router.replace('/bang-tinh');
      }
    }
  }, [router]);

  useEffect(() => {
    const sync = () => {
      setSession(getActiveUnitSession());
      setLogs(getActivityLogs());
    };
    sync();
    window.addEventListener('vtvl-unit-session-updated', sync);
    window.addEventListener('vtvl-activity-updated', sync);
    window.addEventListener('storage', sync);
    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('hcmute_vtvl_realtime');
      bc.onmessage = sync;
    }
    return () => {
      window.removeEventListener('vtvl-unit-session-updated', sync);
      window.removeEventListener('vtvl-activity-updated', sync);
      window.removeEventListener('storage', sync);
      bc?.close();
    };
  }, []);

  const activeUnit = getActiveUnitDefinition(session.unitCode);
  const rawStep = session.activeStep || 1;
  const currentStepNum = rawStep === 2 ? 6 : rawStep === 4 ? 7 : rawStep === 5 ? 8 : rawStep === 1 ? (session.wizardStage === 3 ? 2 : session.wizardStage >= 4 ? 5 : 1) : rawStep;
  const currentStepInfo = SIDEBAR_FIVE_STEPS.find((s) => s.num === currentStepNum) || SIDEBAR_FIVE_STEPS[0];
  const hasOperator = Boolean(session.actorEmail.trim() && session.actorTitle.trim());

  const validationErrors = useMemo(
    () => validateStep1Data(activeUnit, session.actorEmail, session.actorTitle, session.proposedPositions),
    [activeUnit, session.actorEmail, session.actorTitle, session.proposedPositions]
  );

  const nextActionText = !hasOperator
    ? `Bước 1 (A1 & S_NhatKy): Khai báo Email công vụ và Chức vụ người thực hiện tại [${activeUnit.code}] ${activeUnit.nameVi}.`
    : currentStepNum <= 5 && rawStep === 1
      ? `Bước ${currentStepNum}/8 (${currentStepInfo.sheets}): Rà soát ${session.proposedPositions.length} vị trí việc làm đề xuất của [${activeUnit.code}].`
      : currentStepNum === 6
        ? `Bước 6/8 (C3_NhuCau): Tải bộ 10 biểu gốc (.xlsx) và gói phiếu khảo sát (.zip) của [${activeUnit.code}].`
        : currentStepNum === 3 || currentStepNum === 4
          ? `Bước 3 & 4/8 (B1 & B2_CT): Đo thời gian thực tế và kê khai tác động CĐS tại [${activeUnit.code}].`
          : currentStepNum === 7
            ? `Bước 7/8 (D1 & D2): Gộp phiếu khảo sát cá nhân và lập phương án biên chế của [${activeUnit.code}].`
            : `Bước 8/8 (K_KiemTra): Kiểm tra chéo 10 biểu và xuất báo cáo gửi Phòng TCNS.`;

  const continueHref = '/bang-tinh';
  const progressPercent = Math.min(100, Math.round((currentStepNum / 8) * 100));

  if (shouldRedirect) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#004776]/10 text-[#004776] text-sm font-semibold border border-[#004776]/20">
          <FileSpreadsheet className="w-4 h-4 animate-pulse" />
          <span>Đang chuyển đến Bảng tính Excel 15 sheet...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 lg:px-6 py-5 space-y-4">
      {/* Khối Workspace tổng quan hợp nhất */}
      <section className="bg-white rounded-2xl border border-[#d8e3ef] overflow-hidden shadow-[0_12px_32px_-8px_rgba(0,71,118,0.08)]">
        <div className="relative px-5 sm:px-7 py-5 bg-gradient-to-b from-[#eef6ff] via-[#f7faff] to-white border-b border-[#e2e8f0] overflow-hidden">
          <div className="flex items-start gap-4">
            <img
              src="/ute_logo.png"
              alt="Logo HCM-UTE"
              className="w-11 h-11 object-contain shrink-0 mt-0.5"
            />
            <div className="space-y-1.5 min-w-0">
              <Badge variant="slink">HCM-UTE · VTVL</Badge>
              <h1 className="text-xl sm:text-2xl font-bold text-[#004776] tracking-tight">
                Quy trình 08 bước lập đề án Vị trí việc làm
              </h1>
              <p className="text-sm text-[#476885]">
                Thực hiện đầy đủ 08 bước nghiệp vụ trên 10 biểu chuẩn từ A1_NhiemVu đến D2_PhuongAn theo Hướng dẫn số 07-HD/BTCTW.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7 flex flex-col gap-5">
          {/* Khối Việc cần làm tiếp theo */}
          <div className="bg-[#f4f8ff] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#004776]/15">
            <div className="space-y-1">
              <span className="text-[13px] font-bold text-[#004776]">
                Việc cần làm tiếp theo
              </span>
              <p className="text-sm sm:text-[15px] font-semibold text-[#004776]">
                {nextActionText}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/bang-tinh"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white hover:bg-[#eef5fc] text-[#004776] border border-[#cbd5e1] text-[13.5px] font-semibold transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#004776]" />
                <span>Bảng tính 15 sheet</span>
              </Link>
              <Link
                href={continueHref}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#004776] hover:bg-[#00365c] text-white text-[13.5px] font-bold shadow-xs transition-colors"
              >
                <span>Tiếp tục hồ sơ</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Bố cục 2 cột: Đơn vị & Tiến độ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 py-1 divide-y sm:divide-y-0 sm:divide-x divide-[#e2e8f0]">
            <div className="space-y-1.5 sm:pr-5">
              <div className="flex items-center justify-between text-[13.5px] font-semibold text-[#476885]">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#004776]" />
                  <span>Đơn vị đang thực hiện</span>
                </span>
                <span className="font-bold text-[#004776]">[{activeUnit.code}]</span>
              </div>
              <div className="text-base font-bold text-[#004776]">
                {activeUnit.nameVi}
              </div>
              <div className="text-sm text-[#476885]">
                {hasOperator
                  ? `Người thực hiện: ${session.actorTitle} — ${session.actorEmail}`
                  : 'Chưa khai báo email & chức vụ người thực hiện'}
              </div>
            </div>

            <div className="pt-4 sm:pt-0 sm:pl-5 space-y-2">
              <div className="flex items-center justify-between text-[13.5px] font-semibold text-[#476885]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Tiến độ hồ sơ ({progressPercent}%)</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[#476885] text-[13px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Lưu lúc {session.lastSavedAt}</span>
                </span>
              </div>
              <div className="text-sm sm:text-base font-bold text-[#004776]">
                Bước {currentStepNum}/8 — {currentStepInfo.shortTitle}
              </div>
              <div className="w-full h-2 rounded-full bg-[#e2e8f0] overflow-hidden" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-[#004776] rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px] text-[#476885]">
                <span>Đang đề xuất {session.proposedPositions.length} vị trí việc làm</span>
                {validationErrors.length > 0 ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{validationErrors.length} mục cần bổ sung</span>
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-700">Đủ điều kiện xuất 10 biểu gốc</span>
                )}
              </div>
            </div>
          </div>

          {/* Nhật ký thao tác gần đây */}
          <div className="border-t border-[#e2e8f0] pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#004776]" />
                <h2 className="text-sm sm:text-base font-bold text-[#004776]">
                  Nhật ký thao tác gần đây
                </h2>
              </div>
              <span className="text-[13px] font-medium text-[#476885] tabular-nums">
                {logs.length} bản ghi
              </span>
            </div>
            {logs.length === 0 ? (
              <p className="text-sm text-[#476885] py-1">
                Chưa có bản ghi thao tác nào.
              </p>
            ) : (
              <ul className="divide-y divide-[#eef3f8] max-h-52 overflow-y-auto pr-1">
                {logs.slice(0, 5).map((log) => (
                  <li key={log.id} className="py-2.5 text-[13.5px]">
                    <div className="font-medium text-[#004776]">
                      <span className="font-bold text-[#004776] mr-1.5">[{log.unitCode}]</span>
                      <span>{log.details}</span>
                    </div>
                    <div className="text-[12.5px] text-[#476885] mt-0.5">
                      {log.timestamp}
                      {(log.actorTitle || log.actorEmail) ? ` · ${log.actorTitle || 'Chưa khai báo'} — ${log.actorEmail}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Căn cứ pháp lý */}
      <details className="bg-white rounded-2xl border border-[#d8e3ef] overflow-hidden shadow-2xs">
        <summary className="cursor-pointer px-5 h-12 text-sm font-bold text-[#004776] flex items-center justify-between hover:bg-[#f8fbff] transition-colors">
          <span className="inline-flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#004776] shrink-0" />
            <span>Căn cứ pháp lý &amp; phạm vi {HCMUTE_UNITS.length} đơn vị</span>
          </span>
          <span className="text-[13px] font-semibold text-[#004776] shrink-0">Mở / Đóng</span>
        </summary>
        <div className="p-5 border-t border-[#e2e8f0] bg-white space-y-3 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-[#e2e8f0]">
            <div>
              <strong className="text-[#004776] block mb-0.5">Căn cứ pháp lý</strong>
              <p className="text-[#476885]">Hướng dẫn số 07-HD/BTCTW; Nghị định số 232/2026/NĐ-CP; Thông tư số 31/2026/TT-BGDĐT.</p>
            </div>
            <div>
              <strong className="text-[#004776] block mb-0.5">Kỳ thống kê</strong>
              <p className="text-[#476885]">Kỳ thống kê B1, B2_CT: {HD07_CONSTANTS.STATISTICAL_PERIOD}. Chốt nhân sự D1: {HD07_CONSTANTS.STAFF_CUTOFF_DATE}.</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] text-[#476885]">10 biểu nghiệp vụ A1–D2 ({HD07_12_STEP_ORDER.length} biểu liên kết)</span>
          </div>
        </div>
      </details>
    </div>
  );
}
