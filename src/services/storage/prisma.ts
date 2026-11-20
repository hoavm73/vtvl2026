import { PrismaClient } from '@prisma/client';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export interface DbTestHook {
  rpc?: (fnName: string, params: Record<string, unknown>) => Promise<{ ok: boolean; status: number; row?: unknown; errorText?: string }>;
  select?: (table: string, filter?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  upsert?: (table: string, rows: Record<string, unknown>[], conflictCol?: string) => Promise<{ ok: boolean; status: number; error?: string }>;
}

interface PgPoolTelemetryState {
  waitSamplesMs: number[];
  totalAcquires: number;
  acquireErrors: number;
  peakWaitingCount: number;
  peakTotalCount: number;
  maxWaitMs: number;
}

const MAX_WAIT_SAMPLES = 2000;

const globalStore = globalThis as unknown as {
  __uteVtvlPrisma?: PrismaClient;
  __uteVtvlPgPool?: Pool;
  __uteVtvlTestHook?: DbTestHook | null;
  __uteVtvlPoolTelemetry?: PgPoolTelemetryState;
};

function getPoolTelemetryState(): PgPoolTelemetryState {
  if (!globalStore.__uteVtvlPoolTelemetry) {
    globalStore.__uteVtvlPoolTelemetry = {
      waitSamplesMs: [],
      totalAcquires: 0,
      acquireErrors: 0,
      peakWaitingCount: 0,
      peakTotalCount: 0,
      maxWaitMs: 0
    };
  }
  return globalStore.__uteVtvlPoolTelemetry;
}

export function setDbTestHook(hook: DbTestHook | null): void {
  globalStore.__uteVtvlTestHook = hook;
}

export function getDbTestHook(): DbTestHook | null {
  return globalStore.__uteVtvlTestHook || null;
}

export function isDatabaseConfigured(): boolean {
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true') return false;
  if (globalStore.__uteVtvlTestHook) return true;
  return Boolean((process.env.DATABASE_URL || '').trim());
}

export const prisma: PrismaClient =
  globalStore.__uteVtvlPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  });

globalStore.__uteVtvlPrisma = prisma;

/**
 * Ngân sách kết nối PostgreSQL hiện hành (giữ nguyên làm mốc đo trước khi đề xuất tăng):
 * - DATABASE_URL: dùng tham số của chuỗi kết nối (khuyến nghị `?pgbouncer=true&connection_limit=10`)
 * - pg.Pool (Raw SQL & Lock/Counter): `max = PG_POOL_MAX` (mặc định `5`, giới hạn `[1..10]`)
 */
export function getDatabaseConnectionBudget() {
  const pgPoolMax = Math.max(1, Math.min(10, Number(process.env.PG_POOL_MAX || 5)));
  const connUrl = (process.env.DATABASE_URL || '').trim();
  const isPgBouncer = connUrl.includes('pgbouncer=true');
  return {
    pgPoolMax,
    isPgBouncer,
    hasDirectUrl: Boolean((process.env.DIRECT_URL || '').trim()),
    recommendedPrismaLimitPerInstance: 10
  };
}

export function getPgPool(): Pool | null {
  const conn = (process.env.DATABASE_URL || '').trim();
  if (!conn || process.env.VTVL_ISOLATED_LOCAL_STORE === 'true') return null;

  if (!globalStore.__uteVtvlPgPool) {
    const { pgPoolMax } = getDatabaseConnectionBudget();
    globalStore.__uteVtvlPgPool = new Pool({
      connectionString: conn,
      max: pgPoolMax,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 5000,
      statement_timeout: 20000,
      application_name: 'hcmute-vtvl-360'
    });
    globalStore.__uteVtvlPgPool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err.message);
    });
  }
  return globalStore.__uteVtvlPgPool;
}

async function connectWithTelemetry(pool: Pool): Promise<PoolClient> {
  const state = getPoolTelemetryState();
  if (pool.waitingCount > state.peakWaitingCount) state.peakWaitingCount = pool.waitingCount;
  if (pool.totalCount > state.peakTotalCount) state.peakTotalCount = pool.totalCount;

  const t0 = performance.now();
  try {
    const client = await pool.connect();
    const waitMs = performance.now() - t0;
    state.totalAcquires += 1;
    if (waitMs > state.maxWaitMs) state.maxWaitMs = waitMs;
    if (state.waitSamplesMs.length >= MAX_WAIT_SAMPLES) state.waitSamplesMs.shift();
    state.waitSamplesMs.push(waitMs);
    if (pool.waitingCount > state.peakWaitingCount) state.peakWaitingCount = pool.waitingCount;
    if (pool.totalCount > state.peakTotalCount) state.peakTotalCount = pool.totalCount;
    return client;
  } catch (err) {
    state.acquireErrors += 1;
    throw err;
  }
}

export async function pgQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const pool = getPgPool();
  if (!pool) {
    const err = new Error('[DB_SERVICE_UNAVAILABLE] Chưa cấu hình kết nối PostgreSQL DATABASE_URL.');
    (err as unknown as { status: number; code: string }).status = 503;
    (err as unknown as { status: number; code: string }).code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
  const client = await connectWithTelemetry(pool);
  try {
    return await client.query<T>(sql, params);
  } finally {
    client.release();
  }
}

export async function withPgTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPgPool();
  if (!pool) {
    const err = new Error('[DB_SERVICE_UNAVAILABLE] Chưa cấu hình kết nối PostgreSQL DATABASE_URL.');
    (err as unknown as { status: number; code: string }).status = 503;
    (err as unknown as { status: number; code: string }).code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
  const client = await connectWithTelemetry(pool);
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL request.jwt.claim.role = 'service_role'");
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function getPgPoolMetrics() {
  const state = getPoolTelemetryState();
  const pool = globalStore.__uteVtvlPgPool || null;
  const sorted = [...state.waitSamplesMs].sort((a, b) => a - b);
  const pick = (pct: number) => sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length))] || 0;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const budget = getDatabaseConnectionBudget();
  return {
    configuredMax: budget.pgPoolMax,
    isPgBouncer: budget.isPgBouncer,
    liveTotalCount: pool?.totalCount ?? 0,
    liveIdleCount: pool?.idleCount ?? 0,
    liveWaitingCount: pool?.waitingCount ?? 0,
    peakWaitingCount: state.peakWaitingCount,
    peakTotalCount: state.peakTotalCount,
    totalAcquires: state.totalAcquires,
    acquireErrors: state.acquireErrors,
    avgWaitMs: sorted.length ? Number((sum / sorted.length).toFixed(2)) : 0,
    p95WaitMs: Number(pick(95).toFixed(2)),
    p99WaitMs: Number(pick(99).toFixed(2)),
    maxWaitMs: Number(state.maxWaitMs.toFixed(2))
  };
}

export function resetPgPoolMetrics(): void {
  const state = getPoolTelemetryState();
  state.waitSamplesMs = [];
  state.totalAcquires = 0;
  state.acquireErrors = 0;
  state.peakWaitingCount = 0;
  state.peakTotalCount = 0;
  state.maxWaitMs = 0;
}

export function toIsoString(val: Date | string | null | undefined): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

/** Kiểm tra nhanh khả năng kết nối PostgreSQL cho /api/health/ready với timeout ngắn. */
export async function checkPostgresReadiness(timeoutMs = 1500): Promise<boolean> {
  if (process.env.VTVL_SIMULATE_DB_UNREADY === 'true') return false;
  const safeMs = Math.max(100, Math.min(3000, Number(process.env.VTVL_READINESS_TIMEOUT_MS || timeoutMs) || timeoutMs));

  const hook = getDbTestHook();
  if (hook?.select) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race<boolean>([
        hook.select('__readiness__').then(() => true).catch(() => false),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), safeMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const pool = getPgPool();
  if (!pool) return false;

  let client: PoolClient | null = null;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const probe = (async (): Promise<boolean> => {
    try {
      client = await pool.connect();
      if (timedOut) return false;
      await client.query('SELECT 1 AS ok');
      return !timedOut;
    } catch {
      timedOut = true;
      return false;
    } finally {
      if (client) {
        try { client.release(timedOut); } catch { /* ignore */ }
        client = null;
      }
    }
  })();

  try {
    return await Promise.race<boolean>([
      probe,
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve(false);
        }, safeMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default prisma;
