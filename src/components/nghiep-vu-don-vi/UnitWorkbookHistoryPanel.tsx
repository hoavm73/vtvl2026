'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { History, RotateCcw, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { getCanonicalWorkbookId } from '@/services/context/workbook-context';
import { WorkbookHistoryTimelineEvent, WorkbookReviewMeta } from '@/services/workbooks/workbook-history-service';
import { formatCompactTime } from '@/components/overview/UnitMonitoringTypes';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';

function buildHistoryAuthHeaders(includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  const op = getCurrentOperatorSession();
  let adminTok = '';
  if (typeof window !== 'undefined') {
    try { adminTok = sessionStorage.getItem('hcmute_vtvl_admin_token') || ''; } catch { /* ignore */ }
  }
  const token = op?.accessToken || adminTok;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (op?.email) headers['x-actor-email'] = op.email;
  return headers;
}

const SOURCE_DOT_COLOR: Record<WorkbookHistoryTimelineEvent['source'], string> = {
  review: 'bg-[#006cee] ring-[#e6f1ff]',
  revision: 'bg-[#00b87a] ring-[#e6f9f1]',
  s_nhat_ky: 'bg-[#0ea5e9] ring-[#e0f2fe]',
  ticket: 'bg-[#006cee] ring-[#e6f1ff]',
  audit: 'bg-[#7c3aed] ring-[#f3e8ff]'
};

interface HistoryApiResponse {
  workbookId: string;
  unitCode: string;
  unitNameVi: string;
  currentRevision: number;
  reviewMeta: WorkbookReviewMeta;
  timeline: WorkbookHistoryTimelineEvent[];
}

interface UnitWorkbookHistoryPanelProps {
  unitCode: string;
  workbookId?: string;
  userRole?: 'admin' | 'unit_leader' | 'staff';
  allowRollback?: boolean;
  onRestored?: () => void;
}

const SOURCE_OPTIONS = [
  { value: 'ALL', label: 'Tất cả nguồn' },
  { value: 'revision', label: 'Phiên bản bảng tính' },
  { value: 's_nhat_ky', label: 'Sheet 15. S_NhatKy' },
  { value: 'audit', label: 'Nhật ký hệ thống' },
  { value: 'ticket', label: 'Phiếu công việc' },
  { value: 'review', label: 'Thẩm định TCNS' }
] as const;

export function UnitWorkbookHistoryPanel({
  unitCode,
  workbookId,
  userRole = 'staff',
  allowRollback = false,
  onRestored
}: UnitWorkbookHistoryPanelProps) {
  const canonicalWbId = workbookId || getCanonicalWorkbookId(unitCode || 'TCNS');
  const [data, setData] = useState<HistoryApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [confirmRev, setConfirmRev] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workbooks/${encodeURIComponent(canonicalWbId)}/history`, {
        headers: buildHistoryAuthHeaders(),
        cache: 'no-store'
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Không thể tải lịch sử hồ sơ.');
        return;
      }
      setData(json as HistoryApiResponse);
    } catch {
      setError('Lỗi kết nối khi tải lịch sử thay đổi.');
    } finally {
      setLoading(false);
    }
  }, [canonicalWbId]);

  useEffect(() => {
    void loadHistory();
    const onUpdated = () => void loadHistory();
    window.addEventListener('vtvl-unit-session-updated', onUpdated);
    return () => window.removeEventListener('vtvl-unit-session-updated', onUpdated);
  }, [loadHistory]);

  const filteredEvents = useMemo(() => {
    const items = data?.timeline || [];
    return items.filter((ev) => {
      if (sourceFilter !== 'ALL' && ev.source !== sourceFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${ev.title} ${ev.details} ${ev.actorEmail} ${ev.sheet || ''} ${ev.action}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, sourceFilter, query]);

  const handleRestore = async (targetRevision: number) => {
    setRestoring(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/workbooks/${encodeURIComponent(canonicalWbId)}/revisions`, {
        method: 'POST',
        headers: buildHistoryAuthHeaders(true),
        body: JSON.stringify({ targetRevision, reason: `Khôi phục phiên bản v${targetRevision} từ trang lịch sử đơn vị` })
      });
      const json = await res.json();
      if (!res.ok) {
        setActionMsg({ ok: false, text: json.error || 'Khôi phục phiên bản thất bại.' });
        return;
      }
      setConfirmRev(null);
      setActionMsg({ ok: true, text: `Đã khôi phục hồ sơ về phiên bản v${targetRevision} (tạo phiên bản mới v${json.currentRevision}).` });
      window.dispatchEvent(new Event('vtvl-unit-session-updated'));
      await loadHistory();
      onRestored?.();
    } catch {
      setActionMsg({ ok: false, text: 'Lỗi kết nối máy chủ khi khôi phục.' });
    } finally {
      setRestoring(false);
    }
  };

  const canRollback = allowRollback && (userRole === 'unit_leader' || userRole === 'admin');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] pb-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <History className="w-4 h-4 text-[#006cee]" />
            <h2 className="text-sm font-bold text-[#004776]">Lịch sử thay đổi, S_NhatKy & thẩm định [{unitCode}]</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e6f9f1] text-[#008f5d] text-[10.5px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00b87a] animate-pulse" /><span>Cập nhật liên tục</span>
            </span>
          </div>
          {data && (
            <p className="text-xs text-[#476885]">
              Phiên bản hiện tại: <strong className="text-[#004776]">v{data.currentRevision}</strong> · Trạng thái TCNS:{' '}
              <strong className="text-[#004776]">{data.reviewMeta.statusLabel}</strong>
              {data.reviewMeta.reviewerEmail ? ` · Người thẩm định: ${data.reviewMeta.reviewerEmail}` : ''}
            </p>
          )}
        </div>
        <button type="button" onClick={() => void loadHistory()} disabled={loading} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] cursor-pointer disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span>Làm mới</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="history-source-filter" className="sr-only">Lọc theo nguồn lịch sử</label>
        <select id="history-source-filter" aria-label="Lọc theo nguồn lịch sử" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white text-xs font-medium text-[#004776]">
          {SOURCE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94a3b8]" />
          <input type="search" aria-label="Tìm trong lịch sử thay đổi" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo người sửa, biểu, nội dung…" className="w-full h-9 pl-8 pr-3 rounded-[8px] border border-[#cbd5e1] bg-white text-xs text-[#004776]" />
        </div>
      </div>

      {actionMsg && (
        <div role="status" className={`rounded-[10px] px-3.5 py-2.5 text-xs font-medium ${actionMsg.ok ? 'bg-[#ecfdf5] text-[#13653f] border border-[#a7f3d0]' : 'bg-[#fdeceb] text-[#b42318] border border-[#f8b4af]'}`}>
          {actionMsg.text}
        </div>
      )}

      {confirmRev !== null && (
        <div role="alertdialog" aria-label="Xác nhận khôi phục phiên bản" className="rounded-[10px] bg-[#fffbeb] border border-[#fde68a] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#004776]">
          <span>Xác nhận khôi phục bảng tính về phiên bản <strong>v{confirmRev}</strong>? Thao tác sẽ tạo phiên bản mới ghi nhận trạng thái cũ.</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setConfirmRev(null)} disabled={restoring} className="h-8 px-3 rounded-[8px] border border-[#cbd5e1] bg-white text-xs font-medium cursor-pointer">Hủy</button>
            <button type="button" onClick={() => void handleRestore(confirmRev)} disabled={restoring} className="h-8 px-3 rounded-[8px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
              {restoring ? 'Đang khôi phục…' : `Xác nhận khôi phục v${confirmRev}`}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-xs text-[#476885]">Đang tải dữ liệu lịch sử từ máy chủ…</div>
      ) : error ? (
        <div className="py-6 px-4 rounded-[10px] bg-[#fdeceb] text-xs text-[#b42318] flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => void loadHistory()} className="h-8 px-3 rounded-[8px] bg-white border border-[#f8b4af] text-xs font-semibold cursor-pointer">Thử lại</button>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#476885]">Chưa có sự kiện nào khớp bộ lọc hiện tại.</div>
      ) : (
        <div className="border-t border-[#e2e8f0] pt-4">
          <div className="relative pl-5 space-y-4">
            <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-[#dbe8f5]" />
            {filteredEvents.map((ev, idx) => (
              <div key={ev.id} className="relative pb-3 border-b border-[#f1f5f9] last:border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className={`absolute -left-5 top-1.5 w-3 h-3 rounded-full ring-4 ${SOURCE_DOT_COLOR[ev.source] || 'bg-[#006cee] ring-[#e6f1ff]'} ${idx === 0 ? 'animate-pulse' : ''}`} />
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${ev.source === 'review' ? 'bg-[#eef5ff] text-[#006cee]' : ev.source === 'revision' ? 'bg-[#ecfdf5] text-[#13653f]' : 'bg-[#f1f5f9] text-[#20446c]'}`}>
                      {ev.source === 'review' && <ShieldCheck className="w-3 h-3 inline mr-1" />}{ev.sourceLabel}
                    </span>
                    {ev.revision ? <span className="px-1.5 py-0.5 rounded bg-[#f8fafc] border border-[#e2e8f0] font-semibold text-[#004776] tabular-nums">v{ev.revision}</span> : null}
                    {ev.sheet ? <span className="text-[#476885]">· Biểu {ev.sheet}</span> : null}
                    <span className="text-[#476885]">· {ev.actorEmail}</span>
                    <span className="text-[#64748b] tabular-nums">· {formatCompactTime(ev.timestamp)}</span>
                  </div>
                  <div className="text-xs font-semibold text-[#004776]">{ev.title}</div>
                  {ev.details && <p className="text-xs text-[#476885] break-words">{ev.details}</p>}
                </div>
                {canRollback && ev.source === 'revision' && ev.revision && data && ev.revision !== data.currentRevision && (
                  <button type="button" onClick={() => setConfirmRev(ev.revision!)} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] shrink-0 cursor-pointer">
                    <RotateCcw className="w-3.5 h-3.5" /><span>Khôi phục v{ev.revision}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
