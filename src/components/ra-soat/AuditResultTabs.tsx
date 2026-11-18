'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, AlertOctagon, AlertCircle, Eye, ExternalLink, CheckCircle2 } from 'lucide-react';
import { AuditReportResult, AuditSeverity } from '@/types/vtvl';
import { AUDIT_RULES_CATALOG } from '@/services/excel-audit/audit-engine';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { useQueryFilter } from '@/services/query/use-query-filter';

export type AuditTabKey = 'issues' | 'vtvl' | 'evidence' | 'template' | 'rules';

export const SEVERITY_META: Record<AuditSeverity, { label: string; badgeClass: string; chipClass: string; icon: React.ComponentType<{ className?: string }> }> = {
  fix: { label: 'Phải sửa', badgeClass: 'bg-[#fdeceb] text-[#b42318] border-[#f8b4af]', chipClass: 'bg-[#fdeceb] text-[#b42318] border-[#f8b4af]', icon: AlertOctagon },
  evidence: { label: 'Cần bổ sung', badgeClass: 'bg-[#ffedd5] text-[#c2410c] border-[#fdba74]', chipClass: 'bg-[#ffedd5] text-[#c2410c] border-[#fdba74]', icon: AlertCircle },
  review: { label: 'Nên xem lại', badgeClass: 'bg-[#fef9c3] text-[#a16207] border-[#fde047]', chipClass: 'bg-[#fef9c3] text-[#a16207] border-[#fde047]', icon: Eye }
};

interface Props {
  report: AuditReportResult;
}

export function AuditResultTabs({ report }: Props) {
  const [activeTab, setActiveTab] = useState<AuditTabKey>('issues');
  const [vtvlOnlyWithData, setVtvlOnlyWithData] = useState<boolean>(true);
  const [vtvlQuery, setVtvlQuery] = useState<string>('');

  const { params, setParam, data: filteredIssues } = useQueryFilter<
    typeof report.issues[number],
    { sev: string; sheet: string; file: string; aq: string }
  >({
    queryKey: ['audit-issues'],
    initialParams: { sev: 'all', sheet: 'all', file: 'all', aq: '' },
    data: report.issues,
    syncUrl: true,
    queryFn: ({ params: p, data }) =>
      data.filter((item) => {
        if (p.sev !== 'all' && item.severity !== p.sev) return false;
        if (p.sheet !== 'all' && item.sheet !== p.sheet) return false;
        if (p.file !== 'all' && item.fileName !== p.file) return false;
        if (p.aq.trim()) {
          const q = p.aq.toLowerCase();
          if (!`${item.unitCode} ${item.ruleId} ${item.cellRef} ${item.title} ${item.suggestion}`.toLowerCase().includes(q)) return false;
        }
        return true;
      })
  });
  const severityFilter = params.sev as 'all' | AuditSeverity;
  const sheetFilter = params.sheet;
  const fileFilter = params.file;
  const query = params.aq;
  const setSeverityFilter = (v: 'all' | AuditSeverity) => setParam('sev', v);
  const setSheetFilter = (v: string) => setParam('sheet', v);
  const setFileFilter = (v: string) => setParam('file', v);
  const setQuery = (v: string) => setParam('aq', v);

  const filteredVtvlRows = useMemo(() => {
    return report.vtvlRecalcRows.filter((r) => {
      if (vtvlOnlyWithData && !r.hasData) return false;
      if (vtvlQuery.trim()) {
        const q = vtvlQuery.toLowerCase();
        if (!`${r.vtvlCode} ${r.vtvlName} ${r.careerLevel}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [report.vtvlRecalcRows, vtvlOnlyWithData, vtvlQuery]);

  const tabs: { key: AuditTabKey; label: string; count?: number }[] = [
    { key: 'issues', label: '1. Cần xử lý', count: report.totalIssues },
    { key: 'vtvl', label: '2. Tổng hợp VTVL', count: report.vtvlRecalcRows.length },
    { key: 'evidence', label: '3. Chưa đủ căn cứ', count: report.evidenceItems.length },
    { key: 'template', label: '4. Lỗi của biểu mẫu', count: report.templateFeedbackItems.length },
    { key: 'rules', label: '5. Công cụ kiểm tra gì', count: AUDIT_RULES_CATALOG.length }
  ];

  return (
    <div className="space-y-4">
      {/* Chọn tab trên mobile + Dải 5 tab trên Desktop */}
      <div className="md:hidden">
        <label htmlFor="audit-mobile-tab-select" className="block text-xs font-semibold text-[#20446c] mb-1">Chế độ xem kết quả rà soát</label>
        <select id="audit-mobile-tab-select" aria-label="Chế độ xem kết quả rà soát" value={activeTab} onChange={(e) => setActiveTab(e.target.value as AuditTabKey)} className="w-full min-h-[44px] px-3 rounded-[10px] border border-[#cbd5e1] bg-white text-sm font-bold text-[#004776]">
          {tabs.map((t) => (<option key={t.key} value={t.key}>{t.label}{t.count !== undefined ? ` (${t.count})` : ''}</option>))}
        </select>
      </div>
      <nav role="tablist" aria-label="Sổ kết quả rà soát 5 thẻ" className="hidden md:flex items-center gap-1 border-b border-[#e2e8f0] overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const isSelected = activeTab === t.key;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={isSelected} onClick={() => setActiveTab(t.key)} className={`inline-flex items-center justify-center gap-1.5 h-10 px-3 text-xs xl:text-[13px] border-b-2 -mb-[1px] whitespace-nowrap cursor-pointer shrink-0 transition-colors ${isSelected ? 'border-[#004776] text-[#004776] font-semibold' : 'border-transparent text-[#476885] font-medium hover:text-[#004776]'}`}>
              <span>{t.label}</span>
              {t.count !== undefined && <span className={`px-1.5 py-0.5 rounded-full text-[11px] tabular-nums ${isSelected ? 'bg-[#006cee] text-white' : 'bg-[#e2e8f0] text-[#476885]'}`}>{t.count}</span>}
            </button>
          );
        })}
      </nav>

      {/* TAB 1: CẦN XỬ LÝ */}
      {activeTab === 'issues' && (
        <div role="tabpanel" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setSeverityFilter('all')} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-xs font-medium cursor-pointer transition-colors ${severityFilter === 'all' ? 'bg-[#006cee] text-white' : 'bg-[#f1f5f9] text-[#004776] hover:bg-[#e2e8f0]'}`}>
                <span>Tất cả</span>
                <span className="tabular-nums">({report.totalIssues})</span>
              </button>
              {(['fix', 'evidence', 'review'] as AuditSeverity[]).map((sev) => (
                <button key={sev} type="button" onClick={() => setSeverityFilter(sev)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-xs font-medium cursor-pointer transition-colors ${severityFilter === sev ? 'bg-[#006cee] text-white' : SEVERITY_META[sev].chipClass}`}>
                  <span>{SEVERITY_META[sev].label}</span>
                  <span className="tabular-nums">({report.countsBySeverity[sev]})</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {report.unitSummaries.length > 1 && (
                <div className="w-44">
                  <ShadcnSelect ariaLabel="Lọc theo tệp" value={fileFilter} onValueChange={setFileFilter} options={[{ value: 'all', label: `Mọi tệp (${report.unitSummaries.length})` }, ...report.unitSummaries.map((u) => ({ value: u.fileName, label: `[${u.unitCode}] ${u.fileName}` }))]} size="sm" />
                </div>
              )}
              <div className="w-40">
                <ShadcnSelect ariaLabel="Lọc theo biểu" value={sheetFilter} onValueChange={setSheetFilter} options={[{ value: 'all', label: 'Mọi biểu (A1–D2)' }, ...Object.keys(report.countsBySheet).map((sh) => ({ value: sh, label: `Biểu ${sh} (${report.countsBySheet[sh]})` }))]} size="sm" />
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94a3b8]" />
                <input id="task-5-filter" type="search" aria-label="Tìm mã hoặc nội dung" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm mã, nội dung…" className="h-8 rounded-[8px] border border-[#cbd5e1] bg-white pl-7 pr-2.5 text-xs w-44 sm:w-48" />
              </div>
            </div>
          </div>

          <div className="border-t border-[#e2e8f0] divide-y divide-[#e2e8f0]">
            {filteredIssues.length === 0 ? (
              <div className="py-6 text-center text-xs font-medium text-[#13653f] inline-flex items-center justify-center gap-1.5 w-full">
                <CheckCircle2 className="w-4 h-4 shrink-0" /><span>Đạt yêu cầu: Không có cảnh báo nào khớp với bộ lọc hiện tại.</span>
              </div>
            ) : (
              filteredIssues.map((issue) => {
                const meta = SEVERITY_META[issue.severity];
                const Icon = meta.icon;
                const sheetParam = encodeURIComponent((issue.sheet || 'A1').replace('_DATA', ''));
                return (
                  <div key={issue.id} className={`py-3 px-2 -mx-2 rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${issue.severity === 'fix' ? 'bg-red-50/45 hover:bg-red-50/70' : 'hover:bg-[#f8fafc]'}`}>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3 min-w-0 flex-1">
                      <span className={`inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 sm:min-w-[125px] ${meta.badgeClass}`}>
                        <Icon className="w-3.5 h-3.5 shrink-0" /><span>{meta.label}</span>
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-semibold text-[#004776]">{issue.unitCode} · Biểu {issue.sheet} · {issue.cellRef}</div>
                        <p className="text-xs text-[#004776] font-normal">{issue.title}</p>
                        <p className="text-xs text-[#20446c]">Hướng dẫn: {issue.suggestion}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 shrink-0">
                      <code title={issue.currentValue} className="text-xs bg-[#f1f5f9] px-2 py-0.5 rounded-[6px] max-w-[160px] truncate">{issue.currentValue}</code>
                      <Link href={`/bang-tinh?unit=${encodeURIComponent(issue.unitCode)}&sheet=${sheetParam}`} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[8px] hover:bg-[#eef5ff] text-xs font-semibold text-[#006cee] transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /><span>Mở biểu {issue.sheet}</span>
                      </Link>
                      <button type="button" onClick={() => setActiveTab(issue.severity === 'evidence' ? 'evidence' : 'rules')} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[8px] hover:bg-[#f1f5f9] text-xs font-medium text-[#476885] hover:text-[#004776] cursor-pointer transition-colors">
                        <span>{issue.severity === 'evidence' ? 'Bổ sung' : 'Quy tắc'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TỔNG HỢP VTVL */}
      {activeTab === 'vtvl' && (
        <div role="tabpanel" className="space-y-3">
          <div className="rounded-[10px] bg-[var(--surface-tint)] px-3.5 py-2.5 text-xs text-[var(--foreground)]">
            Đối chiếu 3 số liệu: <strong>Người quy đổi PP2</strong> (tính tự động từ B1 &amp; B2), <strong>Người cần bố trí (C3)</strong> và <strong>Nhân sự hiện có (D1)</strong>.
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--foreground)] cursor-pointer">
              <input type="checkbox" checked={vtvlOnlyWithData} onChange={(e) => setVtvlOnlyWithData(e.target.checked)} className="w-4 h-4 accent-[var(--primary)]" />
              <span>Chỉ hiện VTVL đã có số liệu ({filteredVtvlRows.length})</span>
            </label>
            <input type="search" aria-label="Tìm mã hoặc tên VTVL" value={vtvlQuery} onChange={(e) => setVtvlQuery(e.target.value)} placeholder="Tìm mã, tên VTVL…" className="h-8 rounded-[8px] border border-[#cbd5e1] bg-white px-2.5 text-xs w-52" />
          </div>
          <div className="overflow-x-auto rounded-[10px] border border-[#e2e8f0] max-h-96">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0] text-[#004776]">
                  <th className="py-2 px-3 text-left">Mã VTVL</th>
                  <th className="py-2 px-3 text-left">Tên VTVL</th>
                  <th className="py-2 px-2 text-left">Bậc</th>
                  <th className="py-2 px-2 text-left">PP</th>
                  <th className="py-2 px-2 text-right">Giờ B1</th>
                  <th className="py-2 px-2 text-right">Giờ ròng</th>
                  <th className="py-2 px-2.5 text-right">Quy đổi PP2</th>
                  <th className="py-2 px-2.5 text-right">Cần bố trí (C3)</th>
                  <th className="py-2 px-2.5 text-right">Hiện có (D1)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0] bg-white">
                {filteredVtvlRows.map((r) => (
                  <tr key={`${r.unitCode}-${r.vtvlCode}`} className="hover:bg-[#f8fafc]">
                    <td className="py-2 px-3 font-medium text-[var(--primary)]">{r.vtvlCode}</td>
                    <td className="py-2 px-3 font-medium text-[var(--foreground)]">{r.vtvlName}</td>
                    <td className="py-2 px-2 text-[var(--fix)] font-normal">{r.careerLevel}</td>
                    <td className="py-2 px-2">{r.method}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{r.recalcB1Hours}h</td>
                    <td className="py-2 px-2 text-right font-medium tabular-nums">{r.recalcNetHours}h</td>
                    <td className="py-2 px-2.5 text-right font-semibold text-[var(--primary)] tabular-nums">{r.recalcPp2Fte}</td>
                    <td className="py-2 px-2.5 text-right font-semibold text-[var(--fix)] tabular-nums">{r.c3ProposedFte}</td>
                    <td className="py-2 px-2.5 text-right font-medium tabular-nums">{r.d1CurrentStaff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CHƯA ĐỦ CĂN CỨ */}
      {activeTab === 'evidence' && (
        <div role="tabpanel" className="space-y-3">
          <div className="rounded-[10px] bg-[var(--warn-soft)] px-3.5 py-2.5 text-xs text-[var(--foreground)]">
            Danh sách nội dung chưa đủ căn cứ cần bổ sung trước khi hoàn tất thẩm định.
          </div>
          <div className="border-t border-[#e2e8f0] divide-y divide-[#e2e8f0]">
            {report.evidenceItems.map((ev, idx) => (
              <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-[var(--foreground)]"><span className="text-[var(--primary)]">[{ev.unitCode}] {ev.cellRef}</span> · {ev.refCode} — {ev.taskOrPositionName}</div>
                  <p className="text-xs text-[var(--ink-muted)]">Gợi ý nguyên nhân: {ev.reasonHint}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--warn-soft)] text-[var(--warn)] font-medium text-xs shrink-0">{ev.currentSourceText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LỖI CỦA BIỂU MẪU */}
      {activeTab === 'template' && (
        <div role="tabpanel" className="space-y-3">
          <div className="rounded-[10px] bg-[#f8fafc] px-3.5 py-2.5 text-xs text-[var(--foreground)]">
            Lưu ý cấu trúc biểu mẫu gốc, không tính là lỗi của đơn vị.
          </div>
          <div className="border-t border-[#e2e8f0] divide-y divide-[#e2e8f0]">
            {report.templateFeedbackItems.map((item, idx) => (
              <div key={idx} className="py-3 space-y-0.5 text-xs">
                <div className="font-semibold text-[var(--primary)]">[{item.unitCode}] {item.sheet} · {item.cellOrColumn}</div>
                <p className="text-[var(--foreground)]">{item.templateIssue}</p>
                <p className="text-xs text-[var(--ink-muted)]"><strong>Kiến nghị:</strong> {item.unitFeedbackSuggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: CÔNG CỤ KIỂM TRA GÌ */}
      {activeTab === 'rules' && (
        <div role="tabpanel" className="border-t border-[#e2e8f0] divide-y divide-[#e2e8f0]">
          {AUDIT_RULES_CATALOG.map((r) => (
            <div key={r.code} className="py-3 space-y-1 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--primary)]">{r.code} ({r.sheet})</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f1f5f9] text-[#004776]">{r.level}</span>
              </div>
              <p className="text-[var(--foreground)]">{r.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
