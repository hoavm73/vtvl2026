'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  ShieldAlert
} from 'lucide-react';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import {
  AdminSystemHealthCards,
  LoadMetricsPayload,
  ProbeStatus
} from './AdminSystemHealthCards';

function buildAdminHeaders(): Record<string, string> {
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

async function timedProbe(url: string): Promise<ProbeStatus> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { cache: 'no-store' });
    return { ok: res.ok, status: res.status, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, status: 0, ms: Math.round(performance.now() - t0) };
  }
}

export function AdminSystemHealthView() {
  const [metrics, setMetrics] = useState<LoadMetricsPayload | null>(null);
  const [liveProbe, setLiveProbe] = useState<ProbeStatus | null>(null);
  const [readyProbe, setReadyProbe] = useState<ProbeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [resetting, setResetting] = useState(false);

  const loadHealth = useCallback(async (withReset = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = withReset ? '/api/admin/load-metrics?reset=true' : '/api/admin/load-metrics';
      const [live, ready, metricsRes] = await Promise.all([
        timedProbe('/api/health/live'),
        timedProbe('/api/health/ready'),
        fetch(url, { headers: buildAdminHeaders(), cache: 'no-store' })
      ]);
      setLiveProbe(live);
      setReadyProbe(ready);
      const json = await metricsRes.json().catch(() => ({}));
      if (!metricsRes.ok) {
        setMetrics(null);
        setError({
          status: metricsRes.status,
          message: json.error || 'Chỉ Quản trị viên (Phòng TCNS) mới được truy cập trang sức khỏe hệ thống.'
        });
        return;
      }
      setMetrics(json as LoadMetricsPayload);
    } catch {
      setError({ status: 0, message: 'Không thể kết nối máy chủ để tải chỉ số sức khỏe hệ thống.' });
    } finally {
      setLoading(false);
      setResetting(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth(false);
  }, [loadHealth]);

  useEffect(() => {
    if (!autoRefresh || error?.status === 401 || error?.status === 403) return;
    const timer = window.setInterval(() => {
      void loadHealth(false);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, error?.status, loadHealth]);

  const handleReset = () => {
    setResetting(true);
    void loadHealth(true);
  };

  if (error && !metrics) {
    return (
      <div className="max-w-lg mx-auto mt-10 rounded-[14px] border border-[#f5c2c7] bg-white p-6 text-center space-y-3">
        <div className="w-11 h-11 rounded-full bg-[#fdeceb] text-[#b42318] inline-flex items-center justify-center mx-auto">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h1 className="text-base font-bold text-[#004776]">Không có quyền truy cập trang sức khỏe hệ thống</h1>
        <p className="text-xs text-[#476885] leading-relaxed">{error.message}</p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <Link
            href="/login?redirect=/admin/suc-khoe&admin=true"
            className="h-9 px-4 rounded-[8px] bg-[#006cee] hover:bg-[#0055c4] text-white text-xs font-semibold inline-flex items-center"
          >
            Đăng nhập Quản trị viên
          </Link>
          <button
            type="button"
            onClick={() => void loadHealth(false)}
            className="h-9 px-3.5 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const isCritical =
    Boolean(liveProbe && !liveProbe.ok) ||
    Boolean(readyProbe && !readyProbe.ok) ||
    Boolean(metrics && (metrics.pgPool.acquireErrors > 0 || metrics.heavyGate.timeoutCount > 0));
  const isWarning =
    !isCritical &&
    Boolean(
      (readyProbe && readyProbe.ms > 800) ||
      (metrics &&
        (metrics.pgPool.liveWaitingCount > 0 ||
          metrics.heavyGate.queuedTotal > 0 ||
          metrics.heavyGate.rejectedCount > 0 ||
          metrics.fileLocks.timeoutsCount > 0))
    );

  const badgeClass = isCritical
    ? 'bg-[#fdeceb] text-[#b42318] border-[#f5c2c7]'
    : isWarning
      ? 'bg-[#fef3c7] text-[#92400e] border-[#fcd34d]'
      : 'bg-[#e6f9f1] text-[#008f5d] border-[#a7f3d0]';
  const badgeLabel = isCritical ? 'Cần kiểm tra lỗi / nghẽn' : isWarning ? 'Đang có tải cao' : 'Hệ thống ổn định';

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3 sm:px-6 py-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="w-5 h-5 text-[#0072BC]" />
            <h1 className="text-lg sm:text-xl font-bold text-[#004776]">Sức khỏe & tải hệ thống HCM-UTE VTVL 360</h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${badgeClass}`}>
              {isCritical ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{badgeLabel}</span>
            </span>
          </div>
          <p className="text-xs text-[#476885]">
            Đường dẫn quản trị độc lập · Cập nhật lúc:{' '}
            <strong className="text-[#004776] tabular-nums">
              {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleString('vi-VN', { hour12: false }) : 'Đang tải…'}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white text-xs font-medium text-[#004776] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-[#006cee]"
            />
            <span>Tự động làm mới (10 giây)</span>
          </label>
          <button
            type="button"
            onClick={handleReset}
            disabled={loading || resetting}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại bộ đếm</span>
          </button>
          <button
            type="button"
            onClick={() => void loadHealth(false)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] bg-[#006cee] hover:bg-[#0055c4] text-white text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới ngay</span>
          </button>
        </div>
      </div>

      <AdminSystemHealthCards metrics={metrics} liveProbe={liveProbe} readyProbe={readyProbe} />
    </div>
  );
}
