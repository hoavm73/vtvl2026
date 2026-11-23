'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { ServerAuditLog } from '@/services/storage/server-audit-store';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { formatCompactTime } from '@/components/overview/UnitMonitoringTypes';
import { TimelineListSkeleton } from '@/components/ui/Skeleton';

type LogCategory = 'all' | 'auth' | 'workload' | 'review';

const AUTH_ACTIONS = new Set([
  'ĐĂNG_NHẬP',
  'ĐĂNG_NHẬP_GOOGLE',
  'ĐĂNG_NHẬP_THẤT_BẠI',
  'XÁC_THỰC_QUẢN_TRỊ',
  'ĐĂNG_XUẤT'
]);

const REVIEW_ACTIONS = new Set([
  'GUI_TCNS',
  'GUI_LAI_TCNS',
  'BAT_DAU_THAM_DINH',
  'THAM_DINH_YEU_CAU_BO_SUNG',
  'THAM_DINH_DAT',
  'MO_LAI_HO_SO',
  'KHOA_HO_SO',
  'NHAN_XET_THAM_DINH'
]);

const CATEGORY_TABS: Array<{ key: LogCategory; label: string }> = [
  { key: 'all', label: 'Tất cả sự kiện' },
  { key: 'auth', label: 'Đăng nhập & xác thực' },
  { key: 'workload', label: 'Phiếu & bảng biểu' },
  { key: 'review', label: 'Quản trị & thẩm định' }
];

function buildHeaders(): Record<string, string> {
  const cur = getCurrentOperatorSession();
  const h: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const tok = sessionStorage.getItem('hcmute_vtvl_admin_token') || '';
      if (tok) h.Authorization = `Bearer ${tok}`;
    } catch { /* ignore */ }
  }
  if (!h.Authorization && cur?.accessToken) h.Authorization = `Bearer ${cur.accessToken}`;
  if (cur?.email) h['x-actor-email'] = cur.email;
  return h;
}

function getRoleLabel(role?: string): string {
  if (!role) return '';
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'unit_leader') return 'Lãnh đạo đơn vị';
  if (role === 'staff') return 'Cán bộ';
  if (role === 'guest') return 'Khách';
  return role;
}

function getTimelineDotClass(action: string): string {
  if (action === 'ĐĂNG_NHẬP' || action === 'ĐĂNG_NHẬP_GOOGLE' || action === 'XÁC_THỰC_QUẢN_TRỊ') {
    return 'bg-[#00b87a] ring-[#e6f9f1]';
  }
  if (action === 'ĐĂNG_NHẬP_THẤT_BẠI') {
    return 'bg-[#f4212e] ring-[#fdeceb]';
  }
  if (action === 'ĐĂNG_XUẤT') {
    return 'bg-[#64748b] ring-[#f1f5f9]';
  }
  return 'bg-[#7c3aed] ring-[#f3e8ff]';
}

function getActionBadgeClass(action: string): string {
  if (action === 'ĐĂNG_NHẬP_THẤT_BẠI') return 'bg-[#fdeceb] text-[#b42318]';
  if (AUTH_ACTIONS.has(action)) return 'bg-[#e6f9f1] text-[#008f5d]';
  return 'bg-[#f1f5f9] text-[#004776]';
}

function formatExactTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { hour12: false });
}

export function AdminSystemLogsTab() {
  const [logs, setLogs] = useState<ServerAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<LogCategory>('all');

  const loadLogs = useCallback(async (cat: LogCategory = category) => {
    setLoading(true);
    setError(null);
    try {
      const url = cat === 'auth' ? '/api/audit-logs?category=auth&limit=200' : '/api/audit-logs?limit=300';
      const res = await fetch(url, { headers: buildHeaders(), cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Không thể tải nhật ký hệ thống.');
        return;
      }
      setLogs(Array.isArray(json.logs) ? json.logs : []);
    } catch {
      setError('Lỗi kết nối khi tải nhật ký kiểm toán hệ thống.');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void loadLogs(category);
  }, [category, loadLogs]);

  const filtered = useMemo(() => {
    let list = logs;
    if (category === 'auth') {
      list = list.filter((l) => AUTH_ACTIONS.has(l.action));
    } else if (category === 'review') {
      list = list.filter((l) => REVIEW_ACTIONS.has(l.action) || /TÀI_KHOẢN|ĐƠN_VỊ|QUẢN_TRỊ|C1_LOCK/.test(l.action));
    } else if (category === 'workload') {
      list = list.filter((l) => !AUTH_ACTIONS.has(l.action) && !REVIEW_ACTIONS.has(l.action));
    }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((l) =>
      `${l.unitCode} ${l.action} ${l.details} ${l.actorEmail || ''} ${l.ipAddress || ''} ${l.actorRole || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [logs, search, category]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#e2e8f0] pb-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#476885]" />
            <input
              type="search"
              aria-label="Tìm trong nhật ký hệ thống"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo đơn vị, hành động, email, IP…"
              className="w-full h-9 pl-8 pr-3 rounded-[8px] border border-[#cbd5e1] bg-white text-xs text-[#004776]"
            />
          </div>
          {!loading && (
            <span className="text-xs font-medium text-[#476885] whitespace-nowrap tabular-nums">
              {filtered.length} sự kiện
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e6f9f1] text-[#008f5d] text-[10.5px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00b87a] animate-pulse" />
            <span>Cập nhật liên tục</span>
          </span>
          <button
            type="button"
            onClick={() => void loadLogs(category)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc nhóm nhật ký hệ thống">
        {CATEGORY_TABS.map((t) => {
          const active = category === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setCategory(t.key)}
              aria-pressed={active}
              className={`h-8 px-3 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#006cee] text-white'
                  : 'bg-[#f8fafc] border border-[#cbd5e1] text-[#004776] hover:bg-[#eef5ff]'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="pt-1">
          <TimelineListSkeleton rows={4} />
        </div>
      ) : error ? (
        <div className="p-4 rounded-[10px] bg-[#fdeceb] text-xs text-[#b42318] flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => void loadLogs(category)} className="h-8 px-3 rounded bg-white border border-[#f8b4af] font-semibold cursor-pointer">Thử lại</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#476885]">Chưa có sự kiện nào phù hợp bộ lọc.</div>
      ) : (
        <div className="pt-1">
          <div className="relative pl-5 space-y-3.5">
            <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-[#dbe8f5]" />
            {filtered.map((l, idx) => {
              const roleLabel = getRoleLabel(l.actorRole);
              const exactTime = formatExactTime(l.createdAt);
              return (
                <div key={l.id} className="relative pb-2.5 border-b border-[#f1f5f9] last:border-b-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className={`absolute -left-5 top-1.5 w-3 h-3 rounded-full ring-4 ${getTimelineDotClass(l.action)} ${idx === 0 ? 'animate-pulse' : ''}`} />
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-[#eef5ff] text-[#006cee] font-bold">{l.unitCode}</span>
                      <span className={`px-2 py-0.5 rounded font-semibold ${getActionBadgeClass(l.action)}`}>{l.action}</span>
                      <span className="font-medium text-[#004776]">· {l.actorEmail || 'system'}</span>
                      {roleLabel && (
                        <span className="px-1.5 py-0.5 rounded bg-[#f8fafc] border border-[#e2e8f0] text-[10.5px] font-medium text-[#476885]">
                          {roleLabel}
                        </span>
                      )}
                      {l.ipAddress && (
                        <span className="px-1.5 py-0.5 rounded bg-[#eef6ff] text-[10.5px] font-medium text-[#0072BC] tabular-nums">
                          IP: {l.ipAddress}
                        </span>
                      )}
                    </div>
                    <div className="text-[#004776]">{l.details}</div>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="text-[#476885] font-medium tabular-nums">{formatCompactTime(l.createdAt)}</div>
                    {exactTime && <div className="text-[10.5px] text-[#476885]/80 tabular-nums">{exactTime}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
