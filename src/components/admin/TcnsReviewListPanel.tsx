'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Search, ShieldCheck, AlertTriangle, ArrowRight } from 'lucide-react';
import { UNIT_GROUPS } from '@/configs/hcmute-units';
import { UnitSummaryRow } from '@/components/overview/UnitMonitoringTypes';
import { REVIEW_STATUS_LABELS, WorkbookReviewStatus } from '@/services/workbooks/workbook-history-service';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { getCanonicalWorkbookId } from '@/services/context/workbook-context';
import { TableRowsSkeleton } from '@/components/ui/Skeleton';
import { SchoolReviewProgressBar, SchoolReviewProgressStats } from '@/components/workbooks/SchoolReviewProgressBar';

interface TcnsReviewListPanelProps {
  onSelectUnit: (unitCode: string, workbookId: string) => void;
}

function buildAdminHeaders(): Record<string, string> {
  const cur = getCurrentOperatorSession();
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const tok = sessionStorage.getItem('hcmute_vtvl_admin_token') || '';
      if (tok) headers.Authorization = `Bearer ${tok}`;
    } catch { /* ignore */ }
  }
  if (!headers.Authorization && cur?.accessToken) headers.Authorization = `Bearer ${cur.accessToken}`;
  if (cur?.email) headers['x-actor-email'] = cur.email;
  return headers;
}

const STATUS_BADGE: Record<string, string> = {
  chua_gui: 'bg-[#f1f5f9] text-[#476885]',
  cho_tham_dinh: 'bg-[#eef5ff] text-[#006cee]',
  dang_tham_dinh: 'bg-[#fffbeb] text-[#a16207]',
  can_bo_sung: 'bg-[#fdeceb] text-[#b42318]',
  da_gui_lai: 'bg-[#fff7ed] text-[#c2410c]',
  dat_yeu_cau: 'bg-[#ecfdf5] text-[#13653f]',
  da_khoa: 'bg-[#004776] text-white'
};

export function TcnsReviewListPanel({ onSelectUnit }: TcnsReviewListPanelProps) {
  const [units, setUnits] = useState<UnitSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [reviewerFilter, setReviewerFilter] = useState('ALL');
  const [onlyErrors, setOnlyErrors] = useState(false);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/unit-monitor', { headers: buildAdminHeaders(), cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Không thể tải danh sách hồ sơ đơn vị để thẩm định.');
        return;
      }
      setUnits(Array.isArray(json.unitSummaries) ? json.unitSummaries : []);
    } catch {
      setError('Lỗi kết nối khi tải danh sách hồ sơ thẩm định.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnits();
    const onUpdated = () => void loadUnits();
    window.addEventListener('vtvl-unit-session-updated', onUpdated);
    return () => window.removeEventListener('vtvl-unit-session-updated', onUpdated);
  }, [loadUnits]);

  const reviewers = useMemo(() => {
    const s = new Set<string>();
    for (const u of units) if (u.reviewerEmail) s.add(u.reviewerEmail);
    return Array.from(s).sort();
  }, [units]);

  const filtered = useMemo(() => {
    return units.filter((u) => {
      if (groupFilter !== 'ALL' && u.group !== groupFilter) return false;
      const st = u.reviewStatus || 'chua_gui';
      if (statusFilter === 'STEP_SUBMITTED') {
        if (st !== 'cho_tham_dinh' && st !== 'da_gui_lai') return false;
      } else if (statusFilter === 'STEP_APPROVED') {
        if (st !== 'dat_yeu_cau' && st !== 'da_khoa') return false;
      } else if (statusFilter !== 'ALL' && st !== statusFilter) {
        return false;
      }
      if (reviewerFilter !== 'ALL' && (u.reviewerEmail || '') !== reviewerFilter) return false;
      if (onlyErrors && (u.errorCount ?? 0) === 0) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!`${u.unitCode} ${u.unitNameVi} ${u.reviewerEmail || ''}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [units, groupFilter, statusFilter, reviewerFilter, onlyErrors, search]);

  const countWithErr = loading || error ? '—' : String(units.filter((u) => (u.errorCount ?? 0) > 0).length);

  const schoolProgress = useMemo<SchoolReviewProgressStats>(() => {
    const total = units.length || 39;
    let chuaGui = 0, daGuiTcns = 0, dangThamDinh = 0, canBoSung = 0, datVaKhoa = 0;
    for (const u of units) {
      const st = u.reviewStatus || 'chua_gui';
      if (st === 'dat_yeu_cau' || st === 'da_khoa') datVaKhoa++;
      else if (st === 'can_bo_sung') canBoSung++;
      else if (st === 'dang_tham_dinh') dangThamDinh++;
      else if (st === 'cho_tham_dinh' || st === 'da_gui_lai') daGuiTcns++;
      else chuaGui++;
    }
    return {
      totalUnits: total,
      chuaGui,
      daGuiTcns,
      dangThamDinh,
      canBoSung,
      datVaKhoa,
      approvedPercent: total > 0 ? Math.round((datVaKhoa / total) * 100) : 0
    };
  }, [units]);

  return (
    <div className="space-y-4">
      <SchoolReviewProgressBar
        progress={schoolProgress}
        loading={loading || Boolean(error)}
        hideHeader={true}
        activeFilter={statusFilter}
        onSelectFilter={(st) => setStatusFilter((prev) => (prev === st ? 'ALL' : st))}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94a3b8]" />
          <input type="search" aria-label="Tìm đơn vị cần thẩm định" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã hoặc tên đơn vị…" className="w-full h-9 pl-8 pr-3 rounded-[8px] border border-[#cbd5e1] bg-white text-xs text-[#004776]" />
        </div>
        <select aria-label="Lọc theo nhóm đơn vị" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="h-9 px-2.5 rounded-[8px] border border-[#cbd5e1] bg-white text-xs font-medium text-[#004776]">
          <option value="ALL">Mọi nhóm đơn vị</option>
          {UNIT_GROUPS.map((g) => (<option key={g.id} value={g.id}>{g.label}</option>))}
        </select>
        <select aria-label="Lọc theo trạng thái thẩm định" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-2.5 rounded-[8px] border border-[#cbd5e1] bg-white text-xs font-medium text-[#004776]">
          <option value="ALL">Mọi trạng thái thẩm định</option>
          <option value="STEP_SUBMITTED">Đã gửi TCNS (Chờ / Gửi lại)</option>
          <option value="STEP_APPROVED">Đạt &amp; khóa (Đạt / Đã khóa)</option>
          {(Object.keys(REVIEW_STATUS_LABELS) as WorkbookReviewStatus[]).map((st) => (
            <option key={st} value={st}>{REVIEW_STATUS_LABELS[st]}</option>
          ))}
        </select>
        {reviewers.length > 0 && (
          <select aria-label="Lọc theo người thẩm định" value={reviewerFilter} onChange={(e) => setReviewerFilter(e.target.value)} className="h-9 px-2.5 rounded-[8px] border border-[#cbd5e1] bg-white text-xs font-medium text-[#004776]">
            <option value="ALL">Mọi chuyên viên TCNS</option>
            {reviewers.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        )}
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#004776] cursor-pointer px-2">
          <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} className="accent-[#006cee]" />
          <span>Chỉ đơn vị có lỗi ({countWithErr})</span>
        </label>
        <button type="button" onClick={() => void loadUnits()} disabled={loading} className="inline-flex items-center gap-1 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span>Làm mới</span>
        </button>
      </div>

      {loading ? (
        <TableRowsSkeleton rows={5} />
      ) : error ? (
        <div className="p-4 rounded-[10px] bg-[#fdeceb] border border-[#f8b4af] flex items-center justify-between gap-2 text-xs text-[#b42318]">
          <span>{error}</span>
          <button type="button" onClick={() => void loadUnits()} className="h-8 px-3 rounded-[8px] bg-white border border-[#f8b4af] font-semibold cursor-pointer">Thử lại</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#476885]">Không có hồ sơ đơn vị nào khớp bộ lọc.</div>
      ) : (
        <div className="overflow-x-auto border-t border-[#e2e8f0]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-[#20446c] bg-[#f8fafc]">
                <th className="py-2.5 px-3 text-left font-bold">Đơn vị</th>
                <th className="py-2.5 px-3 text-left font-bold">Phiên bản</th>
                <th className="py-2.5 px-3 text-left font-bold">Trạng thái thẩm định</th>
                <th className="py-2.5 px-3 text-right font-bold">Cảnh báo</th>
                <th className="py-2.5 px-3 text-left font-bold">Người thẩm định / Ngày gửi</th>
                <th className="py-2.5 px-3 text-right font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filtered.map((u) => {
                const st = u.reviewStatus || 'chua_gui';
                const err = u.errorCount ?? 0;
                return (
                  <tr key={u.unitCode} className="hover:bg-[#f8fafc]">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-[#004776]">[{u.unitCode}] {u.unitNameVi}</div>
                      <div className="text-[11px] text-[#476885]">{u.groupLabel} · {u.populatedSheetsCount}/10 biểu</div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#004776] tabular-nums">v{u.workbookRevision || 1}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_BADGE[st] || STATUS_BADGE.chua_gui}`}>
                        {u.reviewStatusLabel || 'Chưa gửi'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {err > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#b42318]"><AlertTriangle className="w-3.5 h-3.5" />{err}</span>
                      ) : (
                        <span className="font-semibold text-[#13653f]">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#476885]">
                      <div>{u.reviewerEmail || 'Chưa phân công'}</div>
                      <div className="text-[11px] tabular-nums">{u.submittedAt || u.lastUpdatedAt || '—'}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectUnit(u.unitCode, getCanonicalWorkbookId(u.unitCode))}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-[8px] bg-[#006cee] hover:bg-[#005ecc] text-white font-semibold cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /><span>Thẩm định</span><ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
