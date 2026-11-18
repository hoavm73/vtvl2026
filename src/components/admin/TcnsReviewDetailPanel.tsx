'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, MessageSquare, History, FileSpreadsheet,
  ShieldCheck, LayoutDashboard, Play, RotateCcw, ExternalLink
} from 'lucide-react';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { getCanonicalWorkbookId } from '@/services/context/workbook-context';
import { UnitWorkbookCheckPanel } from '@/components/ra-soat/UnitWorkbookCheckPanel';
import { UnitWorkbookHistoryPanel } from '@/components/nghiep-vu-don-vi/UnitWorkbookHistoryPanel';
import { ExcelWorkbookViewer } from '@/components/excel-grid/ExcelWorkbookViewer';
import { UnitSummaryRow } from '@/components/overview/UnitMonitoringTypes';
import { WorkbookHistoryTimelineEvent, WorkbookReviewMeta } from '@/services/workbooks/workbook-history-service';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { InlineSkeleton } from '@/components/ui/Skeleton';

function buildTcnsAuthHeaders(includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  const op = getCurrentOperatorSession();
  let adminTok = '';
  if (typeof window !== 'undefined') {
    try { adminTok = sessionStorage.getItem('hcmute_vtvl_admin_token') || ''; } catch { /* ignore */ }
  }
  const token = adminTok || op?.accessToken || '';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (op?.email) headers['x-actor-email'] = op.email;
  return headers;
}

export type TcnsDetailTabKey = 'overview' | 'check' | 'sheets' | 'comments' | 'history';

interface TcnsReviewDetailPanelProps {
  unitCode: string;
  workbookId?: string;
  activeTab: TcnsDetailTabKey;
  onSelectTab: (tab: TcnsDetailTabKey) => void;
  onBack: () => void;
}

const SUB_TABS: { key: TcnsDetailTabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { key: 'check', label: 'Kết quả kiểm tra', icon: ShieldCheck },
  { key: 'sheets', label: 'Bảng biểu', icon: FileSpreadsheet },
  { key: 'comments', label: 'Nhận xét', icon: MessageSquare },
  { key: 'history', label: 'Lịch sử thẩm định', icon: History }
];

export function TcnsReviewDetailPanel({ unitCode, workbookId, activeTab, onSelectTab, onBack }: TcnsReviewDetailPanelProps) {
  const unit = findHcmuteUnit(unitCode);
  const canonicalWbId = workbookId || getCanonicalWorkbookId(unit.code);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRevision, setCurrentRevision] = useState(1);
  const [reviewMeta, setReviewMeta] = useState<WorkbookReviewMeta | null>(null);
  const [summary, setSummary] = useState<UnitSummaryRow | null>(null);
  const [timeline, setTimeline] = useState<WorkbookHistoryTimelineEvent[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workbooks/${encodeURIComponent(canonicalWbId)}/history`, {
        headers: buildTcnsAuthHeaders(),
        cache: 'no-store'
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Không thể tải thông tin chi tiết hồ sơ.');
        return;
      }
      setCurrentRevision(json.currentRevision || 1);
      setReviewMeta(json.reviewMeta || null);
      setSummary(json.unitSummary || null);
      setTimeline(Array.isArray(json.timeline) ? json.timeline : []);
    } catch {
      setError('Lỗi kết nối máy chủ khi tải hồ sơ.');
    } finally {
      setLoading(false);
    }
  }, [canonicalWbId]);

  useEffect(() => {
    void loadDetail();
    const onUpdated = () => void loadDetail();
    window.addEventListener('vtvl-unit-session-updated', onUpdated);
    return () => window.removeEventListener('vtvl-unit-session-updated', onUpdated);
  }, [loadDetail]);

  const handleReviewAction = async (action: 'tcns_start_review' | 'tcns_comment' | 'tcns_request_changes' | 'tcns_approve' | 'tcns_reopen') => {
    if ((action === 'tcns_request_changes' || action === 'tcns_comment') && !noteInput.trim()) {
      setActionMsg({ ok: false, text: 'Vui lòng nhập nội dung nhận xét / lý do yêu cầu bổ sung trước khi gửi.' });
      return;
    }
    setSubmitting(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/workbooks/${encodeURIComponent(canonicalWbId)}/history`, {
        method: 'POST',
        headers: buildTcnsAuthHeaders(true),
        body: JSON.stringify({
          action,
          unitCode: unit.code,
          expectedRevision: currentRevision,
          note: noteInput.trim() || undefined
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setActionMsg({ ok: false, text: json.error || 'Không thể thực hiện thao tác thẩm định.' });
        return;
      }
      setNoteInput('');
      setActionMsg({ ok: true, text: 'Đã cập nhật trạng thái thẩm định và lưu vào nhật ký hồ sơ.' });
      window.dispatchEvent(new Event('vtvl-unit-session-updated'));
      await loadDetail();
    } catch {
      setActionMsg({ ok: false, text: 'Lỗi kết nối khi lưu kết quả thẩm định.' });
    } finally {
      setSubmitting(false);
    }
  };

  const reviewComments = timeline.filter((t) => t.source === 'review' || t.action.includes('THAM_DINH') || t.action === 'GUI_TCNS');

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#e2e8f0] pb-4">
        <div className="space-y-1">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-xs font-semibold text-[#006cee] hover:underline cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /><span>Quay lại danh sách hồ sơ 39 đơn vị</span>
          </button>
          <h2 className="text-base sm:text-lg font-bold text-[#0072BC]">Hồ sơ [{unit.code}] {unit.nameVi} — phiên bản v{currentRevision}</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#476885]">
            <span className="px-2 py-0.5 rounded-full bg-[#eef5ff] text-[#004776] font-semibold">
              {loading && !reviewMeta ? <InlineSkeleton className="h-3.5 w-20" /> : (reviewMeta?.statusLabel || 'Chưa gửi')}
            </span>
            {reviewMeta?.submittedBy && <span>Người nộp: {reviewMeta.submittedBy} ({reviewMeta.submittedAt})</span>}
            {reviewMeta?.reviewerEmail && <span>· Phụ trách: {reviewMeta.reviewerEmail}</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void handleReviewAction('tcns_request_changes')} disabled={submitting} className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-[10px] border border-[#f8b4af] bg-[#fdeceb] hover:bg-[#fad2cf] text-[#b42318] text-xs font-semibold cursor-pointer disabled:opacity-50">
            <AlertTriangle className="w-3.5 h-3.5" /><span>Yêu cầu bổ sung</span>
          </button>
          <button type="button" onClick={() => void handleReviewAction('tcns_approve')} disabled={submitting} className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-[10px] bg-[#13653f] hover:bg-[#0e4f31] text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
            <CheckCircle2 className="w-3.5 h-3.5" /><span>Xác nhận đạt</span>
          </button>
          <button type="button" onClick={() => void handleReviewAction('tcns_start_review')} disabled={submitting} className="inline-flex items-center gap-1 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-medium text-[#004776] cursor-pointer">
            <Play className="w-3.5 h-3.5 text-[#006cee]" /><span>Bắt đầu thẩm định</span>
          </button>
          <button type="button" onClick={() => void handleReviewAction('tcns_reopen')} disabled={submitting} className="inline-flex items-center gap-1 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-medium text-[#004776] cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" /><span>Mở lại hồ sơ</span>
          </button>
          <Link href={`/nghiep-vu-don-vi?unitCode=${encodeURIComponent(unit.code)}&tab=overview`} className="inline-flex items-center gap-1 h-9 px-2.5 text-xs font-semibold text-[#006cee] hover:underline">
            <ExternalLink className="w-3.5 h-3.5" /><span>Hồ sơ đơn vị</span>
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="tcns-review-note" className="block text-xs font-semibold text-[#20446c]">Ghi chú / Nhận xét thẩm định của Phòng TCNS</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="tcns-review-note"
            type="text"
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            placeholder="Nhập nhận xét chi tiết hoặc lý do yêu cầu bổ sung (dùng cho Nhận xét / Yêu cầu bổ sung / Xác nhận đạt)…"
            className="flex-1 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white text-xs text-[#004776]"
          />
          <button type="button" onClick={() => void handleReviewAction('tcns_comment')} disabled={submitting} className="h-9 px-3.5 rounded-[8px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 shrink-0">
            Lưu nhận xét
          </button>
        </div>
      </div>

      {actionMsg && (
        <div role="status" className={`rounded-[10px] px-3.5 py-2.5 text-xs font-medium ${actionMsg.ok ? 'bg-[#ecfdf5] text-[#13653f] border border-[#a7f3d0]' : 'bg-[#fdeceb] text-[#b42318] border border-[#f8b4af]'}`}>
          {actionMsg.text}
        </div>
      )}

      <nav role="tablist" aria-label="Thẻ chi tiết thẩm định TCNS" className="flex items-center gap-1 border-b border-[#e2e8f0] overflow-x-auto no-scrollbar">
        {SUB_TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button key={t.key} type="button" role="tab" aria-selected={active} onClick={() => onSelectTab(t.key)} className={`inline-flex items-center gap-1.5 h-10 px-3.5 text-xs border-b-2 -mb-[1px] whitespace-nowrap cursor-pointer transition-colors ${active ? 'border-[#004776] text-[#004776] font-semibold' : 'border-transparent text-[#476885] hover:text-[#004776]'}`}>
              <Icon className="w-3.5 h-3.5" /><span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {error && <div className="p-3 rounded-[10px] bg-[#fdeceb] text-xs text-[#b42318]">{error}</div>}

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="border-y border-[#e2e8f0] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-[#e2e8f0]">
            <div className="p-3.5 bg-gradient-to-br from-[#eef6ff] via-[#f5f9ff] to-white"><div className="text-xs text-[#476885]">Biểu có dữ liệu</div><div className="text-lg font-bold text-[#004776] tabular-nums">{loading ? <InlineSkeleton className="h-6 w-12 mt-0.5" /> : `${summary?.populatedSheetsCount ?? 0}/10`}</div></div>
            <div className={`p-3.5 bg-gradient-to-br ${(summary?.errorCount ?? 0) > 0 ? 'from-[#fef2f2] via-[#fff7f7] to-white' : 'from-[#e8fbf2] via-[#f3fcf8] to-white'}`}><div className="text-xs text-[#476885]">Cảnh báo kiểm tra</div><div className={`text-lg font-bold tabular-nums ${(summary?.errorCount ?? 0) > 0 ? 'text-[#b42318]' : 'text-[#13653f]'}`}>{loading ? <InlineSkeleton className="h-6 w-10 mt-0.5" /> : String(summary?.errorCount ?? 0)}</div></div>
            <div className="p-3.5 bg-gradient-to-br from-[#fff6e5] via-[#fffaf0] to-white"><div className="text-xs text-[#476885]">Phiếu công việc</div><div className="text-lg font-bold text-[#004776] tabular-nums">{loading ? <InlineSkeleton className="h-6 w-10 mt-0.5" /> : String(summary?.totalTickets ?? 0)}</div></div>
            <div className="p-3.5 bg-gradient-to-br from-[#ecfeff]/85 via-[#f2f9ff] to-white"><div className="text-xs text-[#476885]">Tiến độ đơn vị</div><div className="text-lg font-bold text-[#006cee] tabular-nums">{loading ? <InlineSkeleton className="h-6 w-12 mt-0.5" /> : `${summary?.progressPercent ?? 0}%`}</div></div>
          </div>
          {reviewMeta?.reviewNote && (
            <div className="rounded-[10px] bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 text-xs text-[#004776]">
              <strong>Nhận xét gần nhất:</strong> {reviewMeta.reviewNote}
            </div>
          )}
        </div>
      )}

      {activeTab === 'check' && (
        <UnitWorkbookCheckPanel unitCode={unit.code} workbookId={canonicalWbId} revision={currentRevision} mode="tcns" userRole="admin" reviewStatusLabel={reviewMeta?.statusLabel} />
      )}

      {activeTab === 'sheets' && (
        <ExcelWorkbookViewer initialUnitCode={unit.code} requestedUnitCode={unit.code} />
      )}

      {activeTab === 'comments' && (
        <div className="divide-y divide-[#e2e8f0] border-t border-[#e2e8f0]">
          {reviewComments.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#476885]">Chưa có ghi nhận thẩm định hoặc nhận xét nào.</div>
          ) : (
            reviewComments.map((c) => (
              <div key={c.id} className="py-3 space-y-0.5 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-[#476885]">
                  <span className="font-semibold text-[#004776]">{c.title}</span>
                  <span>· {c.actorEmail}</span>
                  <span className="tabular-nums">· {c.timestamp}</span>
                </div>
                <p className="text-[#20446c]">{c.details}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <UnitWorkbookHistoryPanel unitCode={unit.code} workbookId={canonicalWbId} userRole="admin" allowRollback={true} onRestored={() => void loadDetail()} />
      )}
    </div>
  );
}
