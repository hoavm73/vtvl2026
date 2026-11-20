import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createLockBusyError,
  formatScopedMetricMap,
  getOrCreateScopedMetricBucket,
  LockFileMeta,
  pushBoundedLatencySample,
  readLockMeta,
  recordCrossProcessInstance,
  sanitizeLockKey,
  ScopedMetricBucket,
  tryReclaimOrphanLock,
  writeLockHeartbeat
} from './file-lock-helpers';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const LOCKS_DIR = path.join(DATA_DIR, '.locks');
const CURRENT_HOSTNAME = os.hostname();
const PROCESS_INSTANCE_ID = `${process.pid}-${crypto.randomUUID().slice(0, 8)}`;

interface LockWaiter {
  settled: boolean;
  grant: () => void;
}
interface LockQueue {
  locked: boolean;
  waiters: LockWaiter[];
}

const lockGlobal = globalThis as unknown as {
  __uteVtvlFileLockQueues?: Map<string, LockQueue>;
  __uteVtvlActiveLockTokens?: Set<string>;
  __uteVtvlCacheInvalidators?: Array<(lockKey?: string) => void>;
  __uteVtvlLockTelemetry?: {
    timeoutsCount: number;
    queueFullCount: number;
    orphanRecoveriesCount: number;
    peakQueuedWaiters: number;
    byScope?: Map<string, ScopedMetricBucket>;
  };
};

const activeLocalTokens = lockGlobal.__uteVtvlActiveLockTokens || new Set<string>();
lockGlobal.__uteVtvlActiveLockTokens = activeLocalTokens;
const cacheInvalidators = lockGlobal.__uteVtvlCacheInvalidators || [];
lockGlobal.__uteVtvlCacheInvalidators = cacheInvalidators;
const inProcessQueues = lockGlobal.__uteVtvlFileLockQueues || new Map<string, LockQueue>();
lockGlobal.__uteVtvlFileLockQueues = inProcessQueues;
const lockTelemetry = lockGlobal.__uteVtvlLockTelemetry || {
  timeoutsCount: 0,
  queueFullCount: 0,
  orphanRecoveriesCount: 0,
  peakQueuedWaiters: 0,
  byScope: new Map<string, ScopedMetricBucket>()
};
if (!lockTelemetry.byScope) lockTelemetry.byScope = new Map<string, ScopedMetricBucket>();
lockGlobal.__uteVtvlLockTelemetry = lockTelemetry;

export interface CrossProcessLockOptions {
  waitTimeoutMs?: number;
  maxWaiters?: number;
  staleOrphanMs?: number;
}

export function getProcessInstanceId(): string {
  return PROCESS_INSTANCE_ID;
}

export function getLockTelemetry() {
  let queuedWaiters = 0;
  let activeInProcessLocks = 0;
  for (const q of inProcessQueues.values()) {
    if (q.locked) activeInProcessLocks += 1;
    queuedWaiters += q.waiters.filter((w) => !w.settled).length;
  }
  return {
    instanceId: PROCESS_INSTANCE_ID,
    activeInProcessLocks,
    queuedWaiters,
    peakQueuedWaiters: lockTelemetry.peakQueuedWaiters,
    timeoutsCount: lockTelemetry.timeoutsCount,
    queueFullCount: lockTelemetry.queueFullCount,
    orphanRecoveriesCount: lockTelemetry.orphanRecoveriesCount,
    byScope: formatScopedMetricMap(lockTelemetry.byScope!)
  };
}

export function resetLockTelemetry(): void {
  lockTelemetry.timeoutsCount = 0;
  lockTelemetry.queueFullCount = 0;
  lockTelemetry.orphanRecoveriesCount = 0;
  lockTelemetry.peakQueuedWaiters = 0;
  lockTelemetry.byScope?.clear();
}

export function registerCacheInvalidator(fn: (lockKey?: string) => void): void {
  if (!cacheInvalidators.includes(fn)) cacheInvalidators.push(fn);
}

export function invalidateAllLocalCaches(lockKey?: string): void {
  for (const fn of cacheInvalidators) {
    try { fn(lockKey); } catch { /* ignore */ }
  }
}

async function acquireFileLock(
  lockName: string,
  deadlineMs: number,
  staleOrphanMs: number
): Promise<{ release: () => void; crossProcessChanged: boolean }> {
  try { if (!fs.existsSync(LOCKS_DIR)) fs.mkdirSync(LOCKS_DIR, { recursive: true }); } catch { /* ignore */ }
  const safeName = sanitizeLockKey(lockName);
  const lockFile = path.join(LOCKS_DIR, `${safeName}.lock`);
  const pidFile = path.join(LOCKS_DIR, `${safeName}.pid`);

  const activateHandle = (meta: LockFileMeta) => {
    activeLocalTokens.add(meta.lockToken);
    const crossProcessChanged = recordCrossProcessInstance(pidFile, PROCESS_INSTANCE_ID);
    const hbMs = Math.max(250, Math.min(2500, Math.floor(staleOrphanMs / 4)));
    const timer = setInterval(() => {
      if (activeLocalTokens.has(meta.lockToken)) writeLockHeartbeat(lockFile, meta, PROCESS_INSTANCE_ID);
    }, hbMs);
    timer.unref?.();

    return {
      crossProcessChanged,
      release: () => {
        clearInterval(timer);
        activeLocalTokens.delete(meta.lockToken);
        try {
          if (readLockMeta(lockFile)?.lockToken === meta.lockToken) fs.unlinkSync(lockFile);
        } catch { /* ignore */ }
      }
    };
  };

  while (true) {
    const now = Date.now();
    const meta: LockFileMeta = {
      pid: process.pid, hostname: CURRENT_HOSTNAME, instanceId: PROCESS_INSTANCE_ID,
      lockToken: crypto.randomUUID(), acquiredAt: now, heartbeatAt: now
    };
    try {
      const fd = fs.openSync(lockFile, 'wx');
      fs.writeFileSync(fd, JSON.stringify(meta), 'utf8');
      fs.closeSync(fd);
      return activateHandle(meta);
    } catch (err: unknown) {
      if ((err as { code?: string })?.code !== 'EEXIST') {
        return { crossProcessChanged: false, release: () => {} };
      }
      const recovered = tryReclaimOrphanLock({
        lockFile,
        meta: readLockMeta(lockFile),
        staleOrphanMs,
        instanceId: PROCESS_INSTANCE_ID,
        activeLocalTokens,
        onRecovered: () => { lockTelemetry.orphanRecoveriesCount += 1; }
      });
      if (recovered) return activateHandle(recovered);

      if (Date.now() >= deadlineMs) {
        lockTelemetry.timeoutsCount += 1;
        throw createLockBusyError('LOCK_ACQUIRE_TIMEOUT', 'Hết thời gian chờ khóa xử lý đơn vị. Vui lòng thử lại sau vài giây.');
      }
      await new Promise((r) => setTimeout(r, 15 + Math.floor(Math.random() * 20)));
    }
  }
}

async function acquireInProcessSlot(lockKey: string, deadlineMs: number, maxWaiters: number): Promise<() => void> {
  let queue = inProcessQueues.get(lockKey);
  if (!queue) {
    queue = { locked: false, waiters: [] };
    inProcessQueues.set(lockKey, queue);
  }

  if (queue.locked) {
    const activeWaiters = queue.waiters.filter((w) => !w.settled).length;
    if (activeWaiters >= maxWaiters) {
      lockTelemetry.queueFullCount += 1;
      throw createLockBusyError('LOCK_QUEUE_FULL', 'Hàng đợi thao tác của đơn vị đang đầy. Vui lòng thử lại sau vài giây.');
    }
    const remaining = deadlineMs - Date.now();
    if (remaining <= 0) {
      lockTelemetry.timeoutsCount += 1;
      throw createLockBusyError('LOCK_ACQUIRE_TIMEOUT', 'Hết thời gian chờ khóa xử lý đơn vị. Vui lòng thử lại sau vài giây.');
    }
    await new Promise<void>((resolve, reject) => {
      const waiter: LockWaiter = { settled: false, grant: () => {} };
      const timer = setTimeout(() => {
        if (waiter.settled) return;
        waiter.settled = true;
        const idx = queue!.waiters.indexOf(waiter);
        if (idx >= 0) queue!.waiters.splice(idx, 1);
        lockTelemetry.timeoutsCount += 1;
        reject(createLockBusyError('LOCK_ACQUIRE_TIMEOUT', 'Hết thời gian chờ khóa xử lý đơn vị. Vui lòng thử lại sau vài giây.'));
      }, remaining);
      waiter.grant = () => {
        if (waiter.settled) return;
        waiter.settled = true;
        clearTimeout(timer);
        resolve();
      };
      queue!.waiters.push(waiter);
      const totalQueued = Array.from(inProcessQueues.values()).reduce((s, q) => s + q.waiters.length, 0);
      if (totalQueued > lockTelemetry.peakQueuedWaiters) lockTelemetry.peakQueuedWaiters = totalQueued;
    });
  } else {
    queue.locked = true;
  }

  return () => {
    const q = inProcessQueues.get(lockKey);
    if (!q) return;
    while (q.waiters.length > 0) {
      const next = q.waiters.shift()!;
      if (!next.settled) { next.grant(); return; }
    }
    q.locked = false;
    inProcessQueues.delete(lockKey);
  };
}

/**
 * Điều phối khóa tuần tự an toàn cả trong tiến trình lẫn liên tiến trình,
 * có trần hàng đợi, timeout rút lui an toàn và phục hồi khóa mồ côi khi tiến trình chết.
 */
function resolveLockScope(lockKey: string): 'ticket_unit' | 'unit_wb' | 'other' {
  if (lockKey.startsWith('ticket_unit_')) return 'ticket_unit';
  if (lockKey.startsWith('unit_wb_')) return 'unit_wb';
  return 'other';
}

export async function withCrossProcessLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  options?: CrossProcessLockOptions
): Promise<T> {
  const waitTimeoutMs = Math.max(50, Number(options?.waitTimeoutMs ?? process.env.VTVL_LOCK_WAIT_TIMEOUT_MS ?? 8000));
  const maxWaiters = Math.max(1, Number(options?.maxWaiters ?? process.env.VTVL_LOCK_MAX_WAITERS ?? 25));
  const staleOrphanMs = Math.max(200, Number(options?.staleOrphanMs ?? process.env.VTVL_LOCK_STALE_ORPHAN_MS ?? 20000));
  const deadlineMs = Date.now() + waitTimeoutMs;
  const bucket = getOrCreateScopedMetricBucket(lockTelemetry.byScope!, resolveLockScope(lockKey));
  bucket.count += 1;
  const waitT0 = performance.now();

  let releaseSlot: (() => void) | null = null;
  let releaseFile: (() => void) | null = null;
  try {
    releaseSlot = await acquireInProcessSlot(lockKey, deadlineMs, maxWaiters);
    const fileHandle = await acquireFileLock(lockKey, deadlineMs, staleOrphanMs);
    releaseFile = fileHandle.release;
    pushBoundedLatencySample(bucket.waitSamples, performance.now() - waitT0);
    if (fileHandle.crossProcessChanged && process.env.VTVL_BENCHMARK_MEMORY_ONLY !== 'true') {
      invalidateAllLocalCaches(lockKey);
    }
    const holdT0 = performance.now();
    try {
      return await fn();
    } finally {
      pushBoundedLatencySample(bucket.holdSamples, performance.now() - holdT0);
    }
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === 'LOCK_QUEUE_FULL') bucket.rejectedQueueFull += 1;
    else if (code === 'LOCK_ACQUIRE_TIMEOUT') {
      bucket.waitTimeouts += 1;
      pushBoundedLatencySample(bucket.waitSamples, performance.now() - waitT0);
    }
    throw err;
  } finally {
    if (releaseFile) releaseFile();
    if (releaseSlot) releaseSlot();
  }
}
