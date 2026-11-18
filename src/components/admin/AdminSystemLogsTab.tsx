'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { History, RefreshCw, Search } from 'lucide-react';
import { ServerAuditLog } from '@/services/storage/server-audit-store';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';

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

export function AdminSystemLogsTab() {
  const [logs, setLogs] = useState<ServerAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/audit-logs?limit=200', { headers: buildHeaders(), cache: 'no-store' });
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
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter((l) => `${l.unitCode} ${l.action} ${l.details} ${l.actorEmail}`.toLowerCase().includes(q));
  }, [logs, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#006cee]" />
          <div>
            <h2 className="text-sm font-bold text-[#004776]">Nhật ký hệ thống &amp; kiểm toán bảo mật</h2>
            <p className="text-xs text-[#476885]">Theo dõi thao tác quản trị, khôi phục phiên bản, thẩm định và sửa biểu trên toàn trường.</p>
          </div>
        </div>
        <button type="button" onClick={() => void loadLogs()} disabled={loading} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /><span>Làm mới</span>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94a3b8]" />
        <input type="search" aria-label="Tìm trong nhật ký hệ thống" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo đơn vị, hành động, email…" className="w-full h-9 pl-8 pr-3 rounded-[8px] border border-[#cbd5e1] bg-white text-xs text-[#004776]" />
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-[#476885]">Đang tải nhật ký hệ thống…</div>
      ) : error ? (
        <div className="p-4 rounded-[10px] bg-[#fdeceb] text-xs text-[#b42318] flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => void loadLogs()} className="h-8 px-3 rounded bg-white border border-[#f8b4af] font-semibold cursor-pointer">Thử lại</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#476885]">Chưa có sự kiện nào phù hợp bộ lọc.</div>
      ) : (
        <div className="divide-y divide-[#e2e8f0] border-t border-[#e2e8f0]">
          {filtered.map((l) => (
            <div key={l.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-[#eef5ff] text-[#006cee] font-bold">{l.unitCode}</span>
                  <span className="px-2 py-0.5 rounded bg-[#f1f5f9] font-semibold text-[#004776]">{l.action}</span>
                  <span className="text-[#476885]">· {l.actorEmail || 'system'}</span>
                </div>
                <div className="text-[#004776]">{l.details}</div>
              </div>
              <span className="text-[#64748b] tabular-nums shrink-0">{l.createdAt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
