import { PrismaClient } from '@prisma/client';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export interface DbTestHook {
  rpc?: (fnName: string, params: Record<string, unknown>) => Promise<{ ok: boolean; status: number; row?: unknown; errorText?: string }>;
  select?: (table: string, filter?: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  upsert?: (table: string, rows: Record<string, unknown>[], conflictCol?: string) => Promise<{ ok: boolean; status: number; error?: string }>;
}

const globalStore = globalThis as unknown as {
  __uteVtvlPrisma?: PrismaClient;
  __uteVtvlPgPool?: Pool;
  __uteVtvlTestHook?: DbTestHook | null;
};

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
 * Ngân sách kết nối PostgreSQL khuyến nghị cho PgBouncer (Transaction Mode):
 * - DATABASE_URL: `?pgbouncer=true&connection_limit=10` (mỗi instance giữ tối đa 10 kết nối Prisma)
 * - DIRECT_URL: kết nối trực tiếp để chạy Prisma Migrate / CREATE INDEX CONCURRENTLY
 * - pg.Pool (Raw SQL phụ trợ): giới hạn `max: 5` để không vượt ngưỡng `max_connections` của Postgres
 *   (ví dụ 4 worker instances × (10 Prisma + 5 pg.Pool) = 60 connections, an toàn dưới ngưỡng 100–200).
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
  return pool.query<T>(sql, params);
}

export async function withPgTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPgPool();
  if (!pool) {
    const err = new Error('[DB_SERVICE_UNAVAILABLE] Chưa cấu hình kết nối PostgreSQL DATABASE_URL.');
    (err as unknown as { status: number; code: string }).status = 503;
    (err as unknown as { status: number; code: string }).code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
  const client = await pool.connect();
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

export function toIsoString(val: Date | string | null | undefined): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

export default prisma;
