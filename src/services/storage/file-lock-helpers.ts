import crypto from 'crypto';
import fs from 'fs';
import os from 'os';

const CURRENT_HOSTNAME = os.hostname();

export interface LockFileMeta {
  pid: number;
  hostname?: string;
  instanceId: string;
  lockToken: string;
  acquiredAt: number;
  heartbeatAt: number;
}

export function sanitizeLockKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export function createLockBusyError(code: 'LOCK_ACQUIRE_TIMEOUT' | 'LOCK_QUEUE_FULL', msg: string): Error {
  return Object.assign(new Error(msg), { code, status: 429, retryAfterSeconds: 3 });
}

function isLocalPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    return (err as { code?: string })?.code !== 'ESRCH';
  }
}

export function readLockMeta(lockFile: string): LockFileMeta | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(lockFile, 'utf8')) as Partial<LockFileMeta>;
    if (typeof parsed.lockToken === 'string' && typeof parsed.heartbeatAt === 'number') {
      return {
        pid: Number(parsed.pid) || 0,
        hostname: typeof parsed.hostname === 'string' ? parsed.hostname : undefined,
        instanceId: String(parsed.instanceId || ''),
        lockToken: parsed.lockToken,
        acquiredAt: Number(parsed.acquiredAt) || parsed.heartbeatAt,
        heartbeatAt: parsed.heartbeatAt
      };
    }
  } catch { /* ignore */ }
  return null;
}

export function writeLockHeartbeat(lockFile: string, meta: LockFileMeta, instanceId: string): void {
  const tmpFile = `${lockFile}.hb.${instanceId}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify({ ...meta, heartbeatAt: Date.now() }), 'utf8');
    if (readLockMeta(lockFile)?.lockToken === meta.lockToken) {
      fs.renameSync(tmpFile, lockFile);
    } else if (fs.existsSync(tmpFile)) {
      fs.unlinkSync(tmpFile);
    }
  } catch {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/** Phục hồi nguyên tử tệp `.lock` mồ côi khi tiến trình giữ khóa trước đó bị crash/kill (ESRCH hoặc mất heartbeat). */
export function tryReclaimOrphanLock(params: {
  lockFile: string;
  meta: LockFileMeta | null;
  staleOrphanMs: number;
  instanceId: string;
  activeLocalTokens: Set<string>;
  onRecovered: () => void;
}): LockFileMeta | null {
  const { lockFile, meta, staleOrphanMs, instanceId, activeLocalTokens, onRecovered } = params;
  if (meta && activeLocalTokens.has(meta.lockToken)) return null;

  let isOrphan = false;
  if (!meta) {
    try {
      isOrphan = Date.now() - fs.statSync(lockFile).mtimeMs > staleOrphanMs;
    } catch { return null; }
  } else if (meta.instanceId !== instanceId) {
    const sameHost = !meta.hostname || meta.hostname === CURRENT_HOSTNAME;
    const reusedOwnPid = sameHost && meta.pid > 0 && meta.pid === process.pid;
    const deadSameHostPid = sameHost && meta.pid > 1 && meta.pid !== process.pid && !isLocalPidAlive(meta.pid);
    isOrphan = reusedOwnPid || deadSameHostPid || (Date.now() - meta.heartbeatAt > staleOrphanMs);
  }
  if (!isOrphan) return null;

  const guardFile = `${lockFile}.reclaim`;
  const tmpFile = `${lockFile}.new.${instanceId}`;
  try {
    const fd = fs.openSync(guardFile, 'wx');
    fs.closeSync(fd);
  } catch {
    return null;
  }

  try {
    const current = readLockMeta(lockFile);
    if (current && current.lockToken !== meta?.lockToken) return null;
    const now = Date.now();
    const reclaimedMeta: LockFileMeta = {
      pid: process.pid,
      hostname: CURRENT_HOSTNAME,
      instanceId,
      lockToken: crypto.randomUUID(),
      acquiredAt: now,
      heartbeatAt: now
    };
    fs.writeFileSync(tmpFile, JSON.stringify(reclaimedMeta), 'utf8');
    fs.renameSync(tmpFile, lockFile);
    onRecovered();
    return reclaimedMeta;
  } catch {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    return null;
  } finally {
    try { if (fs.existsSync(guardFile)) fs.unlinkSync(guardFile); } catch { /* ignore */ }
  }
}

export function recordCrossProcessInstance(pidFile: string, instanceId: string): boolean {
  let changed = false;
  try {
    if (fs.existsSync(pidFile)) {
      const prev = fs.readFileSync(pidFile, 'utf8').trim();
      if (prev && prev !== instanceId) changed = true;
    }
    fs.writeFileSync(pidFile, instanceId, 'utf8');
  } catch { /* ignore */ }
  return changed;
}

export interface ScopedMetricBucket {
  count: number;
  rejectedQueueFull: number;
  waitTimeouts: number;
  waitSamples: number[];
  holdSamples: number[];
}

export interface TelemetryLatencyStats {
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
}

const MAX_LATENCY_SAMPLES = 1500;

export function getOrCreateScopedMetricBucket(map: Map<string, ScopedMetricBucket>, key: string): ScopedMetricBucket {
  let b = map.get(key);
  if (!b) {
    b = { count: 0, rejectedQueueFull: 0, waitTimeouts: 0, waitSamples: [], holdSamples: [] };
    map.set(key, b);
  }
  return b;
}

export function pushBoundedLatencySample(samples: number[], ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  if (samples.length >= MAX_LATENCY_SAMPLES) samples.shift();
  samples.push(ms);
}

export function summarizeLatencyDistribution(samples: number[]): TelemetryLatencyStats {
  if (samples.length === 0) return { avgMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const pick = (pct: number) => sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length))] || 0;
  return {
    avgMs: Number((sum / sorted.length).toFixed(2)),
    p50Ms: Number(pick(50).toFixed(2)),
    p95Ms: Number(pick(95).toFixed(2)),
    p99Ms: Number(pick(99).toFixed(2)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2))
  };
}

export function formatScopedMetricMap(map: Map<string, ScopedMetricBucket>) {
  const out: Record<string, {
    count: number;
    rejectedQueueFull: number;
    waitTimeouts: number;
    waitMs: TelemetryLatencyStats;
    holdMs: TelemetryLatencyStats;
  }> = {};
  for (const [k, b] of map.entries()) {
    out[k] = {
      count: b.count,
      rejectedQueueFull: b.rejectedQueueFull,
      waitTimeouts: b.waitTimeouts,
      waitMs: summarizeLatencyDistribution(b.waitSamples),
      holdMs: summarizeLatencyDistribution(b.holdSamples)
    };
  }
  return out;
}
