import { NextResponse } from 'next/server';
import {
  formatScopedMetricMap,
  getOrCreateScopedMetricBucket,
  pushBoundedLatencySample,
  ScopedMetricBucket
} from './file-lock-helpers';

export type HeavyMutationKind = 'workbook_save' | 'unit_reconcile' | 'ticket_mutation';
export type HeavyMutationOp = 'save_workbook' | 'submit_ticket' | 'review_ticket' | 'reconcile_unit';

export interface HeavyMutationContext {
  kind: HeavyMutationKind;
  op?: HeavyMutationOp;
  unitCode: string;
  actorEmail?: string;
}

interface HeavyWaiter {
  kind: HeavyMutationKind;
  unitCode: string;
  settled: boolean;
  grant: () => void;
}

interface HeavyGateState {
  waiters: HeavyWaiter[];
  queuedByUnit: Map<string, number>;
  activeTotal: number;
  activeBulk: number;
  peakActive: number;
  peakQueued: number;
  rejectedCount: number;
  timeoutCount: number;
  byKind?: Map<string, ScopedMetricBucket>;
  byOp?: Map<string, ScopedMetricBucket>;
}

const gateGlobal = globalThis as unknown as { __uteVtvlHeavyGate?: HeavyGateState };
const g: HeavyGateState = gateGlobal.__uteVtvlHeavyGate || {
  waiters: [],
  queuedByUnit: new Map<string, number>(),
  activeTotal: 0,
  activeBulk: 0,
  peakActive: 0,
  peakQueued: 0,
  rejectedCount: 0,
  timeoutCount: 0,
  byKind: new Map<string, ScopedMetricBucket>(),
  byOp: new Map<string, ScopedMetricBucket>()
};
if (!g.byKind) g.byKind = new Map<string, ScopedMetricBucket>();
if (!g.byOp) g.byOp = new Map<string, ScopedMetricBucket>();
gateGlobal.__uteVtvlHeavyGate = g;

function readPositiveEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function isBulkKind(kind: HeavyMutationKind): boolean {
  return kind === 'workbook_save' || kind === 'unit_reconcile';
}

function getLimits() {
  const maxConcurrent = readPositiveEnv('VTVL_HEAVY_MAX_CONCURRENT', 6);
  const rawBulk = readPositiveEnv('VTVL_BULK_SHEET_MAX_CONCURRENT', 2);
  const maxBulkConcurrent = maxConcurrent === 0 ? 0 : Math.min(maxConcurrent, Math.max(1, rawBulk));
  const maxQueueTotal = readPositiveEnv('VTVL_HEAVY_MAX_QUEUE', 60);
  const maxQueuePerUnit = readPositiveEnv('VTVL_HEAVY_MAX_UNIT_QUEUE', 20);
  const waitTimeoutMs = Math.max(50, readPositiveEnv('VTVL_HEAVY_WAIT_TIMEOUT_MS', 8000));
  return { maxConcurrent, maxBulkConcurrent, maxQueueTotal, maxQueuePerUnit, waitTimeoutMs };
}

function canGrantSlot(kind: HeavyMutationKind, maxConcurrent: number, maxBulkConcurrent: number): boolean {
  if (g.activeTotal >= maxConcurrent) return false;
  if (isBulkKind(kind) && g.activeBulk >= maxBulkConcurrent) return false;
  return true;
}

function bumpUnitQueue(unitKey: string, delta: number): void {
  const next = (g.queuedByUnit.get(unitKey) || 0) + delta;
  if (next <= 0) g.queuedByUnit.delete(unitKey);
  else g.queuedByUnit.set(unitKey, next);
}

function createBusyError(): Error {
  return Object.assign(
    new Error('Hệ thống đang xử lý nhiều thao tác lưu/gộp đồng thời. Vui lòng thử lại sau vài giây.'),
    { code: 'SERVER_BUSY_RETRY', status: 429, retryAfterSeconds: 3 }
  );
}

function dispatchEligibleWaiters(maxConcurrent: number, maxBulkConcurrent: number): void {
  for (let i = 0; i < g.waiters.length; ) {
    const w = g.waiters[i];
    if (w.settled) {
      g.waiters.splice(i, 1);
      continue;
    }
    if (canGrantSlot(w.kind, maxConcurrent, maxBulkConcurrent)) {
      g.waiters.splice(i, 1);
      w.settled = true;
      bumpUnitQueue(w.unitCode, -1);
      g.activeTotal += 1;
      if (isBulkKind(w.kind)) g.activeBulk += 1;
      if (g.activeTotal > g.peakActive) g.peakActive = g.activeTotal;
      w.grant();
    } else {
      i += 1;
    }
  }
}

function resolveOp(ctx: HeavyMutationContext): HeavyMutationOp {
  if (ctx.op) return ctx.op;
  if (ctx.kind === 'workbook_save') return 'save_workbook';
  if (ctx.kind === 'unit_reconcile') return 'reconcile_unit';
  return 'submit_ticket';
}

/**
 * Điều phối ngân sách tài nguyên dùng chung cho cả lượt lưu bảng tính, gộp hồ sơ và ghi phiếu nặng.
 * Đặt trần chạy đồng thời, trần hàng đợi toàn hệ thống & theo đơn vị, và timeout rút lui an toàn.
 */
export async function withHeavyMutationBudget<T>(
  ctx: HeavyMutationContext,
  fn: () => Promise<T>
): Promise<T> {
  const { maxConcurrent, maxBulkConcurrent, maxQueueTotal, maxQueuePerUnit, waitTimeoutMs } = getLimits();
  const kindBucket = getOrCreateScopedMetricBucket(g.byKind!, ctx.kind);
  const opBucket = getOrCreateScopedMetricBucket(g.byOp!, resolveOp(ctx));
  kindBucket.count += 1;
  opBucket.count += 1;
  const recordWait = (ms: number) => {
    pushBoundedLatencySample(kindBucket.waitSamples, ms);
    pushBoundedLatencySample(opBucket.waitSamples, ms);
  };
  const runMeasured = async () => {
    const holdT0 = performance.now();
    try {
      return await fn();
    } finally {
      const holdMs = performance.now() - holdT0;
      pushBoundedLatencySample(kindBucket.holdSamples, holdMs);
      pushBoundedLatencySample(opBucket.holdSamples, holdMs);
    }
  };
  if (maxConcurrent === 0) {
    recordWait(0);
    return runMeasured();
  }

  const unitKey = (ctx.unitCode || 'GLOBAL').trim().toUpperCase();
  const waitT0 = performance.now();
  if (canGrantSlot(ctx.kind, maxConcurrent, maxBulkConcurrent)) {
    g.activeTotal += 1;
    if (isBulkKind(ctx.kind)) g.activeBulk += 1;
    if (g.activeTotal > g.peakActive) g.peakActive = g.activeTotal;
    recordWait(performance.now() - waitT0);
  } else {
    const unitQueued = g.queuedByUnit.get(unitKey) || 0;
    if (g.waiters.length >= maxQueueTotal || unitQueued >= maxQueuePerUnit) {
      g.rejectedCount += 1;
      kindBucket.rejectedQueueFull += 1;
      opBucket.rejectedQueueFull += 1;
      throw createBusyError();
    }

    await new Promise<void>((resolve, reject) => {
      const waiter: HeavyWaiter = { kind: ctx.kind, unitCode: unitKey, settled: false, grant: () => {} };
      const timer = setTimeout(() => {
        if (waiter.settled) return;
        waiter.settled = true;
        const idx = g.waiters.indexOf(waiter);
        if (idx >= 0) g.waiters.splice(idx, 1);
        bumpUnitQueue(unitKey, -1);
        g.timeoutCount += 1;
        kindBucket.waitTimeouts += 1;
        opBucket.waitTimeouts += 1;
        recordWait(performance.now() - waitT0);
        reject(createBusyError());
      }, waitTimeoutMs);

      waiter.grant = () => {
        clearTimeout(timer);
        recordWait(performance.now() - waitT0);
        resolve();
      };

      g.waiters.push(waiter);
      bumpUnitQueue(unitKey, 1);
      if (g.waiters.length > g.peakQueued) g.peakQueued = g.waiters.length;
    });
  }

  try {
    return await runMeasured();
  } finally {
    g.activeTotal = Math.max(0, g.activeTotal - 1);
    if (isBulkKind(ctx.kind)) g.activeBulk = Math.max(0, g.activeBulk - 1);
    const latest = getLimits();
    dispatchEligibleWaiters(latest.maxConcurrent, latest.maxBulkConcurrent);
  }
}

export function getHeavyGateMetrics() {
  const limits = getLimits();
  return {
    ...limits,
    activeTotal: g.activeTotal,
    activeBulk: g.activeBulk,
    queuedTotal: g.waiters.length,
    peakActive: g.peakActive,
    peakQueued: g.peakQueued,
    rejectedCount: g.rejectedCount,
    timeoutCount: g.timeoutCount,
    byKind: formatScopedMetricMap(g.byKind!),
    byOp: formatScopedMetricMap(g.byOp!)
  };
}

export function resetHeavyGateMetrics(): void {
  g.peakActive = g.activeTotal;
  g.peakQueued = g.waiters.length;
  g.rejectedCount = 0;
  g.timeoutCount = 0;
  g.byKind?.clear();
  g.byOp?.clear();
}

export function toHeavyBusyResponse(err: unknown): NextResponse | null {
  const errObj = err as { code?: string; status?: number; retryAfterSeconds?: number; message?: string };
  if (
    errObj?.code === 'SERVER_BUSY_RETRY' ||
    errObj?.code === 'LOCK_ACQUIRE_TIMEOUT' ||
    errObj?.code === 'LOCK_QUEUE_FULL' ||
    errObj?.status === 429
  ) {
    const retryAfter = Math.max(1, Number(errObj?.retryAfterSeconds || 3));
    return NextResponse.json(
      {
        error: errObj?.message || 'Hệ thống đang bận xử lý thao tác đồng thời. Vui lòng thử lại sau vài giây.',
        code: errObj?.code || 'SERVER_BUSY_RETRY',
        retryAfterSeconds: retryAfter
      },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }
  return null;
}
