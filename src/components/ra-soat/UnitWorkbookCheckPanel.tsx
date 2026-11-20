'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { UploadCloud, RefreshCw, Download, FlaskConical, Briefcase, Send, ExternalLink } from 'lucide-react';
import { AuditReportResult, HcmuteUnit } from '@/types/vtvl';
import { auditUnitWorkbooks, exportAuditReportToExcel } from '@/services/excel-audit/audit-engine';
import { generateUnitFiles } from '@/services/excel-split/workbook-builder';
import { HD07_CONSTANTS } from '@/configs/hcmute-hd07-catalog';
import { AuditResultTabs } from '@/components/ra-soat/AuditResultTabs';
import { UnitCheckSummaryBar } from '@/components/ra-soat/UnitCheckSummaryBar';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import {
  getActiveUnitSession,
  getRealtimeDateYYYYMMDD,
  getSessionFilesForUnit,
  recordActivity,
  saveActiveUnitSession,
  setSessionRootWorkbook
} from '@/services/telemetry/activity-log';
import { syncAuditResultToSupabase } from '@/services/storage/vtvl-sync';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { getCanonicalWorkbookId, verifyWorkbookContextMatch } from '@/services/context/workbook-context';

interface UnitWorkbookCheckPanelProps {
  unitCode: string;
  workbookId?: string;
  revision?: number;
  mode?: 'unit' | 'tcns';
  userRole?: 'admin' | 'unit_leader' | 'staff';
  reviewStatusLabel?: string;
  onSubmittedToTcns?: () => void;
  onAuditCompleted?: (report: AuditReportResult) => void;
}

export function UnitWorkbookCheckPanel({
  unitCode,
  workbookId,
  revision,
  mode = 'unit',
  userRole = 'staff',
  reviewStatusLabel,
  onSubmittedToTcns,
  onAuditCompleted
}: UnitWorkbookCheckPanelProps) {
  const activeUnit: HcmuteUnit = findHcmuteUnit(unitCode || 'TCNS');
  const canonicalWbId = workbookId || getCanonicalWorkbookId(activeUnit.code);

  const [auditing, setAuditing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [report, setReport] = useState<AuditReportResult | null>(null);
  const [checkedAtTime, setCheckedAtTime] = useState<string>('--:--');
  const [contextError, setContextError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle' | 'submitting' | 'ok' | 'err'; msg?: string }>({ status: 'idle' });
  const mountedAuditRef = useRef<string>('');

  const handleAuditActiveUnit = useCallback(async (unitToAudit: HcmuteUnit, asSampleDemo = false) => {
    setAuditing(true);
    setContextError(null);
    try {
      const session = getActiveUnitSession();
      const op = getCurrentOperatorSession();
      const sessionUnit = (op?.unitCode || session.unitCode || '').toUpperCase();
      const isOwnSessionUnit = !asSampleDemo && sessionUnit === unitToAudit.code.toUpperCase();
      const cached = getSessionFilesForUnit(unitToAudit.code);
      let fileToAudit = !asSampleDemo ? cached.mergedFile || cached.rootFile : null;

      if (!fileToAudit) {
        const split = await generateUnitFiles({
          kind: unitToAudit.group,
          unitCode: asSampleDemo ? 'X99' : unitToAudit.code,
          unitNameVi: asSampleDemo ? 'Đơn vị giả định minh họa (X99)' : unitToAudit.nameVi,
          unitNameEn: unitToAudit.nameEn,
          period: HD07_CONSTANTS.STATISTICAL_PERIOD,
          exportDate: (isOwnSessionUnit ? session.customDate : '') || getRealtimeDateYYYYMMDD(),
          includeZipPerPosition: false,
          actorEmail: op?.email || session.actorEmail,
          actorTitle: op?.title || session.actorTitle,
          scaleMetrics: isOwnSessionUnit ? session.scaleMetrics : undefined,
          ngachAllocations: isOwnSessionUnit ? session.ngachAllocations : undefined,
          ngachOverrides: isOwnSessionUnit ? session.ngachOverrides : {},
          customPositionNames: isOwnSessionUnit ? session.customPositionNames : undefined,
          customCareerLevels: isOwnSessionUnit ? session.customCareerLevels : undefined,
          proposedPositions: isOwnSessionUnit ? session.proposedPositions : undefined
        });
        fileToAudit = new File([split.unitBlob], split.unitFileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        if (!asSampleDemo) setSessionRootWorkbook(unitToAudit.code, split.unitBlob, split.unitFileName);
      }

      const res = await auditUnitWorkbooks([fileToAudit], asSampleDemo);
      if (asSampleDemo) {
        res.issues.unshift(
          {
            id: 'demo-fix-1', ruleId: 'R-TT31-40', fileName: fileToAudit.name, unitCode: 'X99', sheet: 'A2', cellRef: 'A2_CongViec!H5',
            severity: 'fix', title: '[Ví dụ minh họa] Căn cứ pháp lý còn dẫn chiếu Thông tư 40/2020/TT-BGDĐT đã hết hiệu lực theo khoản 2 Điều 17 TT 31/2026/TT-BGDĐT',
            currentValue: 'Thông tư 40/2020/TT-BGDĐT', suggestion: 'Thay bằng: Nghị định số 232/2026/NĐ-CP & Thông tư số 31/2026/TT-BGDĐT ngày 14/4/2026.'
          },
          {
            id: 'demo-fix-2', ruleId: 'R-D1-VUOTGIO', fileName: fileToAudit.name, unitCode: 'X99', sheet: 'D1', cellRef: 'D1_NhanLuc!E4',
            severity: 'fix', title: '[Ví dụ minh họa] VƯỢT QUỸ GIỜ: Tổng giờ phân bổ (2.120h) vượt quỹ giờ chuẩn năm (1.760h)',
            currentValue: '2.120h > 1.760h', suggestion: 'Điều chỉnh lại phân bổ giờ thực tế không vượt quá quỹ giờ chuẩn.'
          }
        );
        res.countsBySeverity.fix += 2;
        res.totalIssues += 2;
        if (res.unitSummaries[0]) res.unitSummaries[0].fixCount += 2;
      }

      const now = new Date();
      setCheckedAtTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setReport(res);
      onAuditCompleted?.(res);

      if (!asSampleDemo && mode !== 'tcns') {
        if (isOwnSessionUnit) saveActiveUnitSession({ unitCode: unitToAudit.code, lastAuditFixCount: res.countsBySeverity.fix });
        void syncAuditResultToSupabase(res, unitToAudit.code);
        recordActivity(unitToAudit.code, unitToAudit.nameVi, 'RA_SOAT', `Kiểm tra chéo bộ biểu [${unitToAudit.code}] (${res.countsBySeverity.fix} mục phải sửa)`);
      } else if (asSampleDemo) {
        recordActivity(unitToAudit.code, unitToAudit.nameVi, 'RA_SOAT', `Xem ví dụ kiểm tra [X99] (${res.countsBySeverity.fix} mục phải sửa)`);
      }
    } finally {
      setAuditing(false);
    }
  }, [mode, onAuditCompleted]);

  useEffect(() => {
    const key = `${activeUnit.code}::${canonicalWbId}`;
    if (mountedAuditRef.current === key) return;
    mountedAuditRef.current = key;
    void handleAuditActiveUnit(activeUnit, false);
  }, [activeUnit, canonicalWbId, handleAuditActiveUnit]);

  const handleFilesSelected = async (fileList: FileList | File[] | null, allowDemoTcns = false) => {
    const files = Array.from(fileList || []).filter((f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xlsm'));
    if (files.length === 0) return;
    setAuditing(true);
    setContextError(null);
    try {
      const res = await auditUnitWorkbooks(files, false);
      const mismatch = !allowDemoTcns
        ? res.unitSummaries
            .map((s) => verifyWorkbookContextMatch({ expectedUnitCode: activeUnit.code, fileUnitCode: s.unitCode, auditUnitCode: s.unitCode }))
            .find((check) => !check.valid)
        : undefined;

      if (mismatch) {
        setContextError(mismatch.message || `Tệp tải lên không thuộc đơn vị [${activeUnit.code}]. Đã chặn nạp và đồng bộ chéo đơn vị.`);
        return;
      }

      const now = new Date();
      setCheckedAtTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setReport(res);
      onAuditCompleted?.(res);
      if (!allowDemoTcns || activeUnit.code === 'TCNS') {
        const curOp = getCurrentOperatorSession();
        if (!curOp || curOp.unitCode?.toUpperCase() === activeUnit.code.toUpperCase()) {
          saveActiveUnitSession({ unitCode: activeUnit.code, lastAuditFixCount: res.countsBySeverity.fix });
        }
        void syncAuditResultToSupabase(res, activeUnit.code);
        recordActivity(activeUnit.code, activeUnit.nameVi, 'RA_SOAT', `Kiểm tra ${res.filesCount} tệp Excel cho [${activeUnit.code}] (${res.countsBySeverity.fix} mục phải sửa)`);
      }
    } finally {
      setAuditing(false);
    }
  };

  const handleLoadRealTcnsTemplate = async () => {
    setAuditing(true);
    try {
      const resp = await fetch('/mau/TCNS_HCMUTE_Bo_bieu_HD07.xlsx');
      const blob = await resp.blob();
      const tcnsFile = new File([blob], 'TCNS_HCMUTE_Bo_bieu_HD07.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      await handleFilesSelected([tcnsFile], true);
    } finally {
      setAuditing(false);
    }
  };

  const handleSubmitToTcns = async () => {
    if (!report || report.countsBySeverity.fix > 0) return;
    setSubmitState({ status: 'submitting' });
    try {
      const op = getCurrentOperatorSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;
      if (op?.email) headers['x-actor-email'] = op.email;
      const res = await fetch(`/api/workbooks/${encodeURIComponent(canonicalWbId)}/history`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'submit_to_tcns',
          unitCode: activeUnit.code,
          expectedRevision: revision,
          note: `Đơn vị gửi hồ sơ sau khi rà soát (${report.countsBySeverity.fix} lỗi phải sửa, ${report.countsBySeverity.evidence} mục bổ sung).`
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitState({ status: 'err', msg: json.error || 'Không thể gửi hồ sơ cho Phòng TCNS.' });
        return;
      }
      setSubmitState({ status: 'ok', msg: 'Đã gửi hồ sơ thành công cho Phòng Tổ chức – Nhân sự.' });
      window.dispatchEvent(new Event('vtvl-unit-session-updated'));
      onSubmittedToTcns?.();
    } catch {
      setSubmitState({ status: 'err', msg: 'Lỗi kết nối máy chủ khi gửi hồ sơ.' });
    }
  };

  const currentFileName = report?.unitSummaries[0]?.fileName || `${activeUnit.code}_Bo_bieu_HD07.xlsx`;
  const canSubmit = mode === 'unit' && (userRole === 'unit_leader' || userRole === 'admin');
  const fixCount = report?.countsBySeverity.fix ?? 0;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) void handleFilesSelected(e.dataTransfer.files); }}
      className={`space-y-4 transition-colors ${dragOver ? 'ring-2 ring-[#006cee]/30 rounded-[12px]' : ''}`}
    >
      <section aria-label="Công cụ kiểm tra hồ sơ" className="border-b border-[#e2e8f0] pb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#476885]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-[#004776]">Đơn vị: [{activeUnit.code}] {activeUnit.nameVi}</span>
            <span>·</span>
            <span className="tabular-nums">Phiên bản: v{revision || 1}</span>
            {reviewStatusLabel && <span className="px-2 py-0.5 rounded-full bg-[#eef5ff] text-[#004776] font-semibold">{reviewStatusLabel}</span>}
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span className="font-semibold text-[#004776] truncate max-w-[200px] sm:max-w-[300px]">{currentFileName}</span>
            <span className="tabular-nums">· Lúc {checkedAtTime}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button id="task-5-run" type="button" onClick={() => void handleAuditActiveUnit(activeUnit, false)} disabled={auditing} className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-[10px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${auditing ? 'animate-spin' : ''}`} /><span>Kiểm tra lại</span>
          </button>
          <label htmlFor="audit-file-upload" className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-[10px] border border-dashed border-[#006cee]/50 bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] cursor-pointer transition-colors">
            <input id="audit-file-upload" aria-label="Chọn tệp Excel .xlsx để kiểm tra" type="file" multiple accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => void handleFilesSelected(e.target.files)} className="sr-only" />
            <UploadCloud className="w-3.5 h-3.5 text-[#006cee]" /><span>Chọn tệp .xlsx</span>
          </label>
          {report && (
            <button id="task-5-export" type="button" onClick={() => exportAuditReportToExcel(report, activeUnit.code)} className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-[10px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-[#004776] font-semibold text-xs cursor-pointer transition-colors">
              <Download className="w-3.5 h-3.5 text-[#006cee]" /><span>Tải báo cáo</span>
            </button>
          )}
          <button type="button" onClick={() => void handleLoadRealTcnsTemplate()} disabled={auditing} className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-[10px] hover:bg-[#eef5ff] text-xs font-medium text-[#004776] cursor-pointer transition-colors">
            <Briefcase className="w-3.5 h-3.5 text-[#006cee]" /><span>Nạp mẫu TCNS</span>
          </button>
          <button type="button" onClick={() => void handleAuditActiveUnit(activeUnit, true)} disabled={auditing} className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-[10px] hover:bg-[#eef5ff] text-xs font-medium text-[#004776] cursor-pointer transition-colors">
            <FlaskConical className="w-3.5 h-3.5 text-[#006cee]" /><span>Xem ví dụ (X99)</span>
          </button>
          {canSubmit && (
            <button type="button" onClick={() => void handleSubmitToTcns()} disabled={auditing || submitState.status === 'submitting' || fixCount > 0} className="sm:ml-auto inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-[10px] bg-[#13653f] hover:bg-[#0e4f31] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors" title={fixCount > 0 ? 'Xử lý hết mục Phải sửa trước khi gửi TCNS' : 'Gửi hồ sơ chính thức cho Phòng TCNS'}>
              <Send className="w-3.5 h-3.5" /><span>{submitState.status === 'submitting' ? 'Đang gửi…' : 'Gửi hồ sơ cho Phòng TCNS'}</span>
            </button>
          )}
          <Link href={`/bang-tinh?unit=${encodeURIComponent(activeUnit.code)}&sheet=K`} className="inline-flex items-center gap-1 min-h-[38px] px-2.5 text-xs font-medium text-[#006cee] hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /><span>Mở biểu K_KiemTra</span>
          </Link>
        </div>

        {contextError && (
          <div role="alert" className="rounded-[10px] bg-[#fdeceb] border border-[#f8b4af] px-3.5 py-2.5 text-xs font-medium text-[#b42318]">
            {contextError}
          </div>
        )}
        {submitState.status !== 'idle' && submitState.msg && (
          <div role="status" className={`rounded-[10px] px-3.5 py-2.5 text-xs font-medium ${submitState.status === 'ok' ? 'bg-[#ecfdf5] text-[#13653f] border border-[#a7f3d0]' : 'bg-[#fdeceb] text-[#b42318] border border-[#f8b4af]'}`}>
            {submitState.msg}
          </div>
        )}
      </section>

      {report && (
        <>
          {report.isSampleDemo && (
            <div role="status" className="rounded-[10px] bg-[#eef5ff] px-4 py-2.5 text-xs text-[#004776] flex flex-wrap items-center justify-between gap-2">
              <span>Đang xem <strong>ví dụ minh họa (X99)</strong> (chỉ xem, không lưu vào hồ sơ [{activeUnit.code}]).</span>
              <button type="button" onClick={() => void handleAuditActiveUnit(activeUnit, false)} className="h-7 px-2.5 rounded-[8px] bg-[#006cee] text-white text-xs font-medium cursor-pointer">Quay về [{activeUnit.code}]</button>
            </div>
          )}

          <UnitCheckSummaryBar report={report} />

          <div id="audit-results-panel" className="pt-1">
            <AuditResultTabs report={report} />
          </div>
        </>
      )}
    </div>
  );
}
