'use client';

import React from 'react';
import { Database, Gauge, Lock, ShieldCheck } from 'lucide-react';

export interface LoadMetricsPayload {
  ok: boolean;
  timestamp: string;
  pgPool: {
    configuredMax: number;
    isPgBouncer: boolean;
    liveTotalCount: number;
    liveIdleCount: number;
    liveWaitingCount: number;
    peakWaitingCount: number;
    peakTotalCount: number;
    totalAcquires: number;
    acquireErrors: number;
    avgWaitMs: number;
    p95WaitMs: number;
    p99WaitMs: number;
    maxWaitMs: number;
  };
  heavyGate: {
    maxConcurrent: number;
    maxBulkConcurrent: number;
    maxQueueTotal: number;
    maxQueuePerUnit: number;
    waitTimeoutMs: number;
    activeTotal: number;
    activeBulk: number;
    queuedTotal: number;
    peakActive: number;
    peakQueued: number;
    rejectedCount: number;
    timeoutCount: number;
  };
  fileLocks: {
    instanceId: string;
    activeInProcessLocks: number;
    queuedWaiters: number;
    peakQueuedWaiters: number;
    timeoutsCount: number;
    queueFullCount: number;
    orphanRecoveriesCount: number;
  };
  authRateLimiter: {
    trackedKeys: number;
    lockedKeys: number;
    maxKeys: number;
    overflowRejections: number;
    trustProxyMode: string;
  };
  apiRateLimiter: {
    enabled: boolean;
    activeBuckets: number;
    maxBuckets: number;
    totalBlocked: number;
  };
}

export interface ProbeStatus {
  ok: boolean;
  status: number;
  ms: number;
}

interface AdminSystemHealthCardsProps {
  metrics: LoadMetricsPayload | null;
  liveProbe: ProbeStatus | null;
  readyProbe: ProbeStatus | null;
}

export function AdminSystemHealthCards({
  metrics,
  liveProbe,
  readyProbe
}: AdminSystemHealthCardsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-[12px] border border-[#e2e8f0] bg-white p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#0072BC]">
            <span>Máy chủ & CSDL</span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-[#004776] tabular-nums">
            {readyProbe ? `${readyProbe.ms} ms` : '…'}
          </div>
          <div className="text-[11.5px] text-[#476885] space-y-0.5 tabular-nums">
            <div>Live: <strong className="text-[#004776]">{liveProbe ? `HTTP ${liveProbe.status} (${liveProbe.ms} ms)` : '…'}</strong></div>
            <div>Ready DB: <strong className="text-[#004776]">{readyProbe ? `HTTP ${readyProbe.status} (${readyProbe.ms} ms)` : '…'}</strong></div>
          </div>
        </div>

        <div className="rounded-[12px] border border-[#e2e8f0] bg-white p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#0072BC]">
            <span>Kết nối PostgreSQL</span>
            <Database className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-[#004776] tabular-nums">
            {metrics ? `${metrics.pgPool.liveTotalCount} / ${metrics.pgPool.configuredMax}` : '…'}
          </div>
          <div className="text-[11.5px] text-[#476885] space-y-0.5 tabular-nums">
            <div>Rảnh: <strong className="text-[#004776]">{metrics?.pgPool.liveIdleCount ?? 0}</strong> · Đang chờ: <strong className="text-[#004776]">{metrics?.pgPool.liveWaitingCount ?? 0}</strong></div>
            <div>Lỗi kết nối: <strong className={metrics?.pgPool.acquireErrors ? 'text-[#b42318]' : 'text-[#008f5d]'}>{metrics?.pgPool.acquireErrors ?? 0}</strong> · P95 chờ: <strong className="text-[#004776]">{metrics?.pgPool.p95WaitMs ?? 0} ms</strong></div>
          </div>
        </div>

        <div className="rounded-[12px] border border-[#e2e8f0] bg-white p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#0072BC]">
            <span>Cổng điều tiết ghi nặng</span>
            <Gauge className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-[#004776] tabular-nums">
            {metrics ? `${metrics.heavyGate.activeTotal} / ${metrics.heavyGate.maxConcurrent}` : '…'}
          </div>
          <div className="text-[11.5px] text-[#476885] space-y-0.5 tabular-nums">
            <div>Hàng đợi: <strong className="text-[#004776]">{metrics?.heavyGate.queuedTotal ?? 0}/{metrics?.heavyGate.maxQueueTotal ?? 0}</strong> · Đỉnh: <strong className="text-[#004776]">{metrics?.heavyGate.peakActive ?? 0}</strong></div>
            <div>Từ chối / Timeout: <strong className={(metrics?.heavyGate.rejectedCount || 0) + (metrics?.heavyGate.timeoutCount || 0) > 0 ? 'text-[#b42318]' : 'text-[#008f5d]'}>{metrics?.heavyGate.rejectedCount ?? 0} / {metrics?.heavyGate.timeoutCount ?? 0}</strong></div>
          </div>
        </div>

        <div className="rounded-[12px] border border-[#e2e8f0] bg-white p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-[#0072BC]">
            <span>Khóa hồ sơ & Rate Limit</span>
            <Lock className="w-4 h-4" />
          </div>
          <div className="text-xl font-bold text-[#004776] tabular-nums">
            {metrics ? `${metrics.apiRateLimiter.totalBlocked} chặn API` : '…'}
          </div>
          <div className="text-[11.5px] text-[#476885] space-y-0.5 tabular-nums">
            <div>Khóa tệp chạy / chờ: <strong className="text-[#004776]">{metrics?.fileLocks.activeInProcessLocks ?? 0} / {metrics?.fileLocks.queuedWaiters ?? 0}</strong></div>
            <div>Tài khoản tạm khóa login: <strong className="text-[#004776]">{metrics?.authRateLimiter.lockedKeys ?? 0}</strong> (theo dõi {metrics?.authRateLimiter.trackedKeys ?? 0})</div>
          </div>
        </div>
      </div>

      {metrics && (
        <div className="rounded-[12px] border border-[#e2e8f0] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fbff] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0072BC]">Chi tiết thông số vận hành theo phân hệ</h2>
            <span className="text-[11px] font-mono text-[#476885]">Instance: {metrics.fileLocks.instanceId}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-[#476885]">
                  <th className="py-2.5 px-4 font-semibold">Phân hệ</th>
                  <th className="py-2.5 px-4 font-semibold">Đang hoạt động</th>
                  <th className="py-2.5 px-4 font-semibold">Mức đỉnh đã ghi nhận</th>
                  <th className="py-2.5 px-4 font-semibold">Cảnh báo / Lỗi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-[#004776] tabular-nums">
                <tr>
                  <td className="py-2.5 px-4 font-semibold">PostgreSQL Pool</td>
                  <td className="py-2.5 px-4">{metrics.pgPool.liveTotalCount}/{metrics.pgPool.configuredMax} kết nối ({metrics.pgPool.totalAcquires} lượt cấp phát)</td>
                  <td className="py-2.5 px-4">Đỉnh kết nối: {metrics.pgPool.peakTotalCount} · Đỉnh chờ: {metrics.pgPool.peakWaitingCount} · Max wait: {metrics.pgPool.maxWaitMs} ms</td>
                  <td className="py-2.5 px-4">{metrics.pgPool.acquireErrors} lỗi cấp phát</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold">Heavy Mutation Gate</td>
                  <td className="py-2.5 px-4">{metrics.heavyGate.activeTotal}/{metrics.heavyGate.maxConcurrent} tác vụ (gộp/lưu lớn: {metrics.heavyGate.activeBulk}/{metrics.heavyGate.maxBulkConcurrent})</td>
                  <td className="py-2.5 px-4">Đỉnh chạy: {metrics.heavyGate.peakActive} · Đỉnh hàng đợi: {metrics.heavyGate.peakQueued}/{metrics.heavyGate.maxQueueTotal}</td>
                  <td className="py-2.5 px-4">{metrics.heavyGate.rejectedCount} từ chối · {metrics.heavyGate.timeoutCount} timeout</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold">Khóa đồng bộ hồ sơ</td>
                  <td className="py-2.5 px-4">{metrics.fileLocks.activeInProcessLocks} khóa giữ · {metrics.fileLocks.queuedWaiters} tiến trình chờ</td>
                  <td className="py-2.5 px-4">Đỉnh chờ khóa: {metrics.fileLocks.peakQueuedWaiters}</td>
                  <td className="py-2.5 px-4">{metrics.fileLocks.timeoutsCount} timeout · {metrics.fileLocks.queueFullCount} tràn hàng · {metrics.fileLocks.orphanRecoveriesCount} thu hồi mồ côi</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-4 font-semibold">Rate Limiter (API & Login)</td>
                  <td className="py-2.5 px-4">{metrics.apiRateLimiter.activeBuckets}/{metrics.apiRateLimiter.maxBuckets} bucket API ({metrics.apiRateLimiter.enabled ? 'Đang bật' : 'Đã tắt'})</td>
                  <td className="py-2.5 px-4">Proxy: {metrics.authRateLimiter.trustProxyMode} · {metrics.authRateLimiter.trackedKeys}/{metrics.authRateLimiter.maxKeys} khóa login</td>
                  <td className="py-2.5 px-4">{metrics.apiRateLimiter.totalBlocked} chặn API · {metrics.authRateLimiter.lockedKeys} đang khóa login</td>
                </tr>
              </tbody>
            </table>
          </div>
          <details className="border-t border-[#e2e8f0] px-4 py-2.5 bg-[#f8fafc]">
            <summary className="text-xs font-semibold text-[#0072BC] cursor-pointer select-none">
              Xem dữ liệu JSON gốc (/api/admin/load-metrics)
            </summary>
            <pre className="mt-2 p-3 rounded-[8px] bg-white border border-[#e2e8f0] text-[11px] text-[#004776] overflow-x-auto max-h-80">
              {JSON.stringify(metrics, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </>
  );
}
