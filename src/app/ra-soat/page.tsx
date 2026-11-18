'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UploadCloud, RefreshCw, Download, FlaskConical, AlertTriangle, CheckCircle2, FileText, Briefcase, ShieldCheck, AlertCircle, ChevronRight } from 'lucide-react';
import { WorkflowSidebar, InfoTip } from '@/components/layout/MilestonesBar';
import { AuditReportResult, HcmuteUnit } from '@/types/vtvl';
import { auditUnitWorkbooks, exportAuditReportToExcel } from '@/services/excel-audit/audit-engine';
import { generateUnitFiles } from '@/services/excel-split/workbook-builder';
import { HD07_CONSTANTS } from '@/configs/hcmute-hd07-catalog';
import { AuditResultTabs } from '@/components/ra-soat/AuditResultTabs';
import { HCMUTE_UNITS } from '@/configs/hcmute-units';
import { getActiveUnitDefinition, getActiveUnitSession, getRealtimeDateYYYYMMDD, getSessionFilesForUnit, recordActivity, saveActiveUnitSession, setSessionRootWorkbook } from '@/services/telemetry/activity-log';
import { syncAuditResultToSupabase } from '@/services/storage/vtvl-sync';

export default function RaSoatPage() {
  const [activeUnit, setActiveUnit] = useState<HcmuteUnit>(HCMUTE_UNITS[0]);
  const [auditing, setAuditing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [report, setReport] = useState<AuditReportResult | null>(null);
  const [checkedAtTime, setCheckedAtTime] = useState<string>('23:21');
  const isInternalSaveRef = useRef(false);
  const lastAuditedKeyRef = useRef('');

  const markInternalSave = () => {
    isInternalSaveRef.current = true;
    setTimeout(() => { isInternalSaveRef.current = false; }, 250);
  };

  const handleAuditActiveUnit = useCallback(async (unitToAudit: HcmuteUnit, asSampleDemo = false) => {
    setAuditing(true);
    try {
      const session = getActiveUnitSession();
      const cached = getSessionFilesForUnit(unitToAudit.code);
      let fileToAudit = !asSampleDemo ? cached.mergedFile || cached.rootFile : null;

      if (!fileToAudit) {
        const split = await generateUnitFiles({
          kind: unitToAudit.group, unitCode: asSampleDemo ? 'X99' : unitToAudit.code,
          unitNameVi: asSampleDemo ? 'Đơn vị giả định minh họa (X99)' : unitToAudit.nameVi, unitNameEn: unitToAudit.nameEn,
          period: HD07_CONSTANTS.STATISTICAL_PERIOD, exportDate: session.customDate || getRealtimeDateYYYYMMDD(), includeZipPerPosition: false,
          actorEmail: session.actorEmail, actorTitle: session.actorTitle, scaleMetrics: session.scaleMetrics, ngachAllocations: session.ngachAllocations,
          ngachOverrides: session.ngachOverrides, customPositionNames: session.customPositionNames, customCareerLevels: session.customCareerLevels, proposedPositions: session.proposedPositions
        });
        fileToAudit = new File([split.unitBlob], split.unitFileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        if (!asSampleDemo) {
          markInternalSave();
          setSessionRootWorkbook(unitToAudit.code, split.unitBlob, split.unitFileName);
        }
      }

      const res = await auditUnitWorkbooks([fileToAudit], asSampleDemo);
      if (asSampleDemo) {
        res.issues.unshift(
          { id: 'demo-fix-1', ruleId: 'R-TT31-40', fileName: fileToAudit.name, unitCode: 'X99', sheet: 'A2', cellRef: 'A2_CongViec!H5', severity: 'fix', title: '[Ví dụ minh họa] Căn cứ pháp lý còn dẫn chiếu Thông tư 40/2020/TT-BGDĐT đã hết hiệu lực theo khoản 2 Điều 17 TT 31/2026/TT-BGDĐT', currentValue: 'Thông tư 40/2020/TT-BGDĐT', suggestion: 'Thay bằng: Nghị định số 232/2026/NĐ-CP & Thông tư số 31/2026/TT-BGDĐT ngày 14/4/2026.' },
          { id: 'demo-fix-2', ruleId: 'R-D1-VUOTGIO', fileName: fileToAudit.name, unitCode: 'X99', sheet: 'D1', cellRef: 'D1_NhanLuc!E4', severity: 'fix', title: '[Ví dụ minh họa] VƯỢT QUỸ GIỜ: Tổng giờ phân bổ (2.120h) vượt quỹ giờ chuẩn năm (1.760h)', currentValue: '2.120h > 1.760h', suggestion: 'Điều chỉnh lại phân bổ giờ thực tế không vượt quá quỹ giờ chuẩn.' }
        );
        res.countsBySeverity.fix += 2;
        res.totalIssues += 2;
        if (res.unitSummaries[0]) res.unitSummaries[0].fixCount += 2;
      }
      const now = new Date();
      setCheckedAtTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setReport(res);
      if (!asSampleDemo) {
        lastAuditedKeyRef.current = `${unitToAudit.code}::${fileToAudit.name}`;
        markInternalSave();
        saveActiveUnitSession({ unitCode: unitToAudit.code, lastAuditFixCount: res.countsBySeverity.fix });
        void syncAuditResultToSupabase(res, unitToAudit.code);
      }
      recordActivity(unitToAudit.code, unitToAudit.nameVi, 'RA_SOAT', `Thẩm định tự động bộ biểu của đơn vị ${asSampleDemo ? 'X99 (Ví dụ minh họa)' : unitToAudit.code} (${res.countsBySeverity.fix} mục phải sửa)`);
    } finally {
      setAuditing(false);
    }
  }, []);

  useEffect(() => {
    const syncAndAudit = (force = false) => {
      if (!force && isInternalSaveRef.current) return;
      const u = getActiveUnitDefinition();
      const cached = getSessionFilesForUnit(u.code);
      const nextKey = `${u.code}::${cached.mergedFile?.name || cached.rootFile?.name || ''}`;
      if (!force && lastAuditedKeyRef.current === nextKey) return;
      lastAuditedKeyRef.current = nextKey;
      setActiveUnit(u);
      void handleAuditActiveUnit(u, false);
    };
    syncAndAudit(true);
    const onExternalSync = () => syncAndAudit(false);
    window.addEventListener('storage', onExternalSync);
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('hcmute_vtvl_realtime') : null;
    if (bc) bc.onmessage = onExternalSync;
    return () => {
      window.removeEventListener('storage', onExternalSync);
      bc?.close();
    };
  }, [handleAuditActiveUnit]);

  const handleFilesSelected = async (fileList: FileList | File[] | null) => {
    const files = Array.from(fileList || []).filter((f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xlsm'));
    if (files.length === 0) return;
    setAuditing(true);
    try {
      const res = await auditUnitWorkbooks(files, false);
      const now = new Date();
      setCheckedAtTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setReport(res);
      const targetCode = res.unitSummaries[0]?.unitCode || activeUnit.code;
      markInternalSave();
      saveActiveUnitSession({ unitCode: targetCode, lastAuditFixCount: res.countsBySeverity.fix });
      void syncAuditResultToSupabase(res, targetCode);
      recordActivity(targetCode, res.unitSummaries[0]?.unitName || activeUnit.nameVi, 'RA_SOAT', `Thẩm định gộp ${res.filesCount} tệp Excel (${res.countsBySeverity.fix} mục phải sửa)`);
    } finally {
      setAuditing(false);
    }
  };

  const handleLoadRealTcnsTemplate = async () => {
    setAuditing(true);
    try {
      const resp = await fetch('/mau/TCNS_HCMUTE_Bo_bieu_HD07.xlsx');
      const blob = await resp.blob();
      const tcnsFile = new File([blob], 'TCNS_HCMUTE_Bo_bieu_HD07.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      await handleFilesSelected([tcnsFile]);
    } finally {
      setAuditing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) void handleFilesSelected(e.dataTransfer.files);
  };

  const currentFileName = report?.unitSummaries[0]?.fileName || `${activeUnit.code}_K2526_v2.xlsx`;

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 lg:px-6 py-4 sm:py-6">
      <div className="flex flex-col lg:flex-row gap-5 items-start min-w-0">
        <WorkflowSidebar activeStep={8} unitCode={activeUnit.code} />

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="flex-1 w-full space-y-4 min-w-0"
        >
          <header className="space-y-1.5 pb-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#eef5ff] text-xs font-bold text-[#006cee]">
                Bước 8/8
              </span>
              <InfoTip title="Tự tính lại từ các cột nhập liệu & kết quả kiểm tra chéo">
                <p>Công cụ tự đọc các cột nhập liệu từ các tệp .xlsx để tự tính lại Giờ B1, đối chiếu Người quy đổi PP2 — Người C3 — Nhân sự D1.</p>
              </InfoTip>
            </div>
            <h1 className="page-title text-[#004776]">Kiểm tra và thẩm định hồ sơ</h1>
            <p className="text-xs sm:text-sm text-[#476885]">
              Biểu kiểm soát <strong className="text-[#004776]">K_KiemTra</strong> — Tự động đối chiếu chéo 9 biểu mẫu theo Hướng dẫn số 07-HD/BTCTW
            </p>
          </header>

          <div className={`bg-white rounded-[16px] border overflow-hidden transition-colors ${dragOver ? 'border-[#006cee] ring-2 ring-[#006cee]/25' : 'border-[#e2e8f0]'}`}>
            <section aria-label="Tệp và kiểm tra" className="bg-[#f8fafc] border-b border-[#e2e8f0] px-4 py-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#20446c]">Tệp và kiểm tra</span>
                <div className="inline-flex items-center gap-1.5 text-xs text-[#476885]">
                  <span className="w-5 h-5 rounded-[6px] bg-emerald-600 text-white font-semibold text-[10px] flex items-center justify-center shrink-0">X</span>
                  <span className="font-semibold text-[#004776] truncate max-w-[220px] sm:max-w-[320px]">{currentFileName}</span>
                  <span className="tabular-nums">· Lúc {checkedAtTime}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button id="task-5-run" type="button" onClick={() => void handleAuditActiveUnit(activeUnit, false)} disabled={auditing} className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-[10px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${auditing ? 'animate-spin' : ''}`} /><span>Kiểm tra lại</span>
                </button>
                <label htmlFor="audit-file-upload" className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-[10px] border border-dashed border-[#006cee]/50 bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] cursor-pointer transition-colors">
                  <input id="audit-file-upload" aria-label="Chọn tệp Excel .xlsx khác để kiểm tra" type="file" multiple accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void handleFilesSelected(e.target.files)} className="sr-only" />
                  <UploadCloud className="w-3.5 h-3.5 text-[#006cee]" /><span>Chọn tệp .xlsx</span>
                </label>
                {report && (
                  <button id="task-5-export" type="button" onClick={() => exportAuditReportToExcel(report, report.unitSummaries[0]?.unitCode || activeUnit.code)} className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-[10px] bg-white hover:bg-[#eef5ff] text-[#004776] font-semibold text-xs cursor-pointer transition-colors">
                    <Download className="w-3.5 h-3.5 text-[#006cee]" /><span>Tải báo cáo</span>
                  </button>
                )}
                <button type="button" onClick={() => void handleLoadRealTcnsTemplate()} disabled={auditing} className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-[10px] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] cursor-pointer transition-colors">
                  <Briefcase className="w-3.5 h-3.5 text-[#006cee]" /><span>Nạp mẫu TCNS</span>
                </button>
                <button type="button" onClick={() => void handleAuditActiveUnit(activeUnit, true)} disabled={auditing} className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-[10px] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] cursor-pointer transition-colors">
                  <FlaskConical className="w-3.5 h-3.5 text-[#006cee]" /><span>Xem ví dụ (X99)</span>
                </button>
              </div>
            </section>

            {report && (
              <>
                {report.isSampleDemo && (
                  <div role="status" className="border-b border-[#e2e8f0] bg-[#eef5ff] px-4 py-2.5 text-xs text-[#004776] flex flex-wrap items-center justify-between gap-2">
                    <span>Đang xem <strong>ví dụ minh họa (X99)</strong>.</span>
                    <button type="button" onClick={() => void handleAuditActiveUnit(activeUnit, false)} className="h-7 px-2.5 rounded-[8px] bg-[#006cee] text-white text-xs font-medium cursor-pointer">Quay về [{activeUnit.code}]</button>
                  </div>
                )}

                {report.countsBySeverity.fix > 0 ? (
                  <div className="border-b border-[#e2e8f0] bg-[var(--fix-soft)] px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-[var(--fix)] shrink-0" />
                      <div><div className="text-xs sm:text-sm font-semibold text-[var(--fix)]">Hồ sơ cần sửa lỗi bắt buộc</div><p className="text-xs text-[var(--foreground)] font-normal">Phát hiện <strong>{report.countsBySeverity.fix}</strong> mục phải sửa và <strong>{report.countsBySeverity.evidence}</strong> nội dung cần bổ sung căn cứ.</p></div>
                    </div>
                    <a href="#audit-results-panel" className="inline-flex items-center gap-1 h-8 px-3 rounded-[8px] bg-white/80 hover:bg-white text-xs font-semibold text-[var(--fix)]"><span>Xem {report.totalIssues} nội dung</span><ChevronRight className="w-3.5 h-3.5" /></a>
                  </div>
                ) : report.countsBySeverity.evidence > 0 ? (
                  <div className="border-b border-[#e2e8f0] bg-[var(--warn-soft)] px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-[var(--warn)] shrink-0" />
                      <div><div className="text-xs sm:text-sm font-semibold text-[var(--warn)]">Hồ sơ cần bổ sung căn cứ</div><p className="text-xs text-[var(--foreground)] font-normal"><strong>{report.countsBySeverity.evidence}</strong> nội dung cần bổ sung trước khi hoàn tất thẩm định.</p></div>
                    </div>
                    <a href="#audit-results-panel" className="inline-flex items-center gap-1 h-8 px-3 rounded-[8px] bg-white/80 hover:bg-white text-xs font-semibold text-[var(--warn)]"><span>Xem {report.countsBySeverity.evidence} nội dung</span><ChevronRight className="w-3.5 h-3.5" /></a>
                  </div>
                ) : (
                  <div className="border-b border-[#e2e8f0] bg-[var(--ok-soft)] px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-[var(--ok)] shrink-0" />
                      <div><div className="text-xs sm:text-sm font-semibold text-[var(--ok)]">Hồ sơ đạt yêu cầu thẩm định</div><p className="text-xs text-[var(--foreground)] font-normal">Đạt toàn bộ chỉ tiêu kiểm tra chéo và đầy đủ căn cứ.</p></div>
                    </div>
                  </div>
                )}

                <div className="border-b border-[#e2e8f0] bg-white grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-[#e2e8f0]">
                  <div className="px-3 py-3 flex items-center justify-center gap-1.5 text-xs"><ShieldCheck className={`w-4 h-4 shrink-0 ${report.countsBySeverity.fix > 0 ? 'text-[#b42318]' : 'text-[#13653f]'}`} /><strong className={`text-sm font-bold tabular-nums ${report.countsBySeverity.fix > 0 ? 'text-[#b42318]' : 'text-[#13653f]'}`}>{report.countsBySeverity.fix}</strong><span className="text-[#20446c]">Phải sửa</span></div>
                  <div className="px-3 py-3 flex items-center justify-center gap-1.5 text-xs"><FileText className="w-4 h-4 text-[#c2410c] shrink-0" /><strong className="text-sm font-bold text-[#c2410c] tabular-nums">{report.countsBySeverity.evidence}</strong><span className="text-[#20446c]">Cần bổ sung</span></div>
                  <div className="px-3 py-3 flex items-center justify-center gap-1.5 text-xs"><AlertCircle className="w-4 h-4 text-[#a16207] shrink-0" /><strong className="text-sm font-bold text-[#a16207] tabular-nums">{report.countsBySeverity.review}</strong><span className="text-[#20446c]">Nên xem lại</span></div>
                  <div className="px-3 py-3 flex items-center justify-center gap-1.5 text-xs"><CheckCircle2 className="w-4 h-4 text-[#13653f] shrink-0" /><strong className="text-sm font-bold text-[#13653f] tabular-nums">{report.countsBySeverity.fix === 0 && report.countsBySeverity.evidence === 0 ? '100%' : report.vtvlRecalcRows.length}</strong><span className="text-[#20446c]">{report.countsBySeverity.fix === 0 && report.countsBySeverity.evidence === 0 ? 'Đạt yêu cầu' : 'VTVL (C1)'}</span></div>
                  <div className="col-span-2 sm:col-span-1 px-3 py-3 flex items-center justify-center gap-1.5 text-xs"><Briefcase className="w-4 h-4 text-[#006cee] shrink-0" /><strong className="text-sm font-bold text-[#004776] tabular-nums">{report.templateFeedbackItems.length}</strong><span className="text-[#20446c]">Góp ý biểu mẫu</span></div>
                </div>

                <div id="audit-results-panel" className="p-4 sm:p-5">
                  <AuditResultTabs report={report} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
