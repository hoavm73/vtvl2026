import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';

const { Client } = pg;
const LOCK_ID = 20260731;

const PRIORITY_SQL_ORDER = [
  '00-supabase-compat.sql',
  '20261107_init_vtvl_hcmute.sql',
  '01-seed-initial-units.sql',
  '20261110_vtvl_server_workbooks.sql',
  '20261110_lockdown_supabase_rls.sql',
  '20261113_google_auth_rls_and_indexes.sql',
  '20261113_user_accounts_and_roles.sql',
  '20261114_add_rbac_and_tickets.sql',
  '20261114_hardened_rls_data_protection.sql',
  '20261114220000_reconcile_production_schema.sql',
  '20261115000000_sync_units_catalog_48.sql',
  '20261115010000_enforce_vtvl_rbac_matrix.sql',
  '20261115020000_hardened_rbac_database_erd.sql',
  '20261115030000_work_survey_lifecycle_erd.sql',
  '20261115140000_reconcile_vtvl_39_units_and_versions.sql',
  '20261115210000_add_vtvl_coordination_proposals.sql',
  '20261116210000_create_work_relationships.sql'
];

function collectPrismaMigrations(rootDir) {
  const dir = path.join(rootDir, 'prisma/migrations');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      migrationName: d.name,
      sqlPath: path.join(dir, d.name, 'migration.sql')
    }))
    .filter((m) => fs.existsSync(m.sqlPath))
    .sort((a, b) => a.migrationName.localeCompare(b.migrationName));
}

function collectSqlMigrations(rootDir) {
  const entries = [];
  for (const bootstrap of ['00-supabase-compat.sql', '01-seed-initial-units.sql']) {
    const fp = path.join(rootDir, 'deploy/postgres', bootstrap);
    if (fs.existsSync(fp)) entries.push({ filename: bootstrap, fullPath: fp });
  }

  for (const relDir of ['trash/supabase/migrations', 'db/migrations']) {
    const dir = path.join(rootDir, relDir);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      if (!entries.some((e) => e.filename === f)) {
        entries.push({ filename: f, fullPath: path.join(dir, f) });
      }
    }
  }

  return entries.sort((a, b) => {
    const ia = PRIORITY_SQL_ORDER.indexOf(a.filename);
    const ib = PRIORITY_SQL_ORDER.indexOf(b.filename);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.filename.localeCompare(b.filename);
  });
}

function stripExplicitTxWrapper(sql) {
  return sql
    .replace(/^\s*BEGIN\s*;/im, '-- [tx managed by runner] BEGIN;')
    .replace(/COMMIT\s*;\s*$/im, '-- [tx managed by runner] COMMIT;');
}

async function runMigrations() {
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    console.error('❌ [MIGRATE] Thiếu biến môi trường DATABASE_URL.');
    process.exit(1);
  }

  const rootDir = process.cwd();
  const gitCommit = (process.env.GIT_COMMIT || '').trim() || null;
  const sqlFiles = collectSqlMigrations(rootDir);
  const prismaFolders = collectPrismaMigrations(rootDir);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  const tsNow = () => new Date().toISOString();

  console.log(
    `[${tsNow()}] 🗄️  Kiểm tra PostgreSQL & Prisma Migrations (${sqlFiles.length} SQL + ${prismaFolders.length} Prisma)...`
  );

  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_ID]);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id serial PRIMARY KEY,
        filename text NOT NULL UNIQUE,
        checksum_sha256 text NOT NULL,
        execution_ms integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
        applied_by text NOT NULL DEFAULT current_user,
        git_commit text,
        error_message text,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const appliedSqlRes = await client.query(
      `SELECT filename FROM public.schema_migrations WHERE status = 'success'`
    );
    const appliedSqlSet = new Set(appliedSqlRes.rows.map((r) => r.filename));

    const appliedPrismaRes = await client.query(
      `SELECT migration_name FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
    );
    const appliedPrismaSet = new Set(appliedPrismaRes.rows.map((r) => r.migration_name));

    let appliedCount = 0;
    let skippedCount = 0;

    for (const item of sqlFiles) {
      const rawSql = fs.readFileSync(item.fullPath, 'utf8');
      const sha256 = crypto.createHash('sha256').update(rawSql).digest('hex');

      if (appliedSqlSet.has(item.filename)) {
        skippedCount += 1;
        console.log(`  ✓ [SKIP SQL] ${item.filename}`);
        continue;
      }

      if (item.filename === '01-seed-initial-units.sql') {
        const cntRes = await client.query(`SELECT count(*)::int AS c FROM public.dm_don_vi`);
        if ((cntRes.rows[0]?.c || 0) > 0) {
          await client.query(
            `INSERT INTO public.schema_migrations (filename, checksum_sha256, execution_ms, status, git_commit)
             VALUES ($1, $2, 0, 'success', $3) ON CONFLICT (filename) DO NOTHING`,
            [item.filename, sha256, gitCommit]
          );
          skippedCount += 1;
          console.log(`  ✓ [SKIP SQL] ${item.filename} (dm_don_vi đã có dữ liệu)`);
          continue;
        }
      }

      const t0 = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(stripExplicitTxWrapper(rawSql));
        const execMs = Date.now() - t0;
        await client.query(
          `INSERT INTO public.schema_migrations (
             filename, checksum_sha256, execution_ms, status, git_commit, error_message, applied_at
           ) VALUES ($1, $2, $3, 'success', $4, NULL, now())
           ON CONFLICT (filename) DO UPDATE SET
             checksum_sha256 = EXCLUDED.checksum_sha256,
             execution_ms = EXCLUDED.execution_ms,
             status = 'success',
             git_commit = EXCLUDED.git_commit,
             error_message = NULL,
             applied_at = now()`,
          [item.filename, sha256, execMs, gitCommit]
        );
        await client.query('COMMIT');
        appliedCount += 1;
        console.log(`  🚀 [APPLIED SQL] ${item.filename} (${execMs} ms | sha256:${sha256.slice(0, 12)})`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const execMs = Date.now() - t0;
        const errMsg = err instanceof Error ? err.message : String(err);
        await client
          .query(
            `INSERT INTO public.schema_migrations (
               filename, checksum_sha256, execution_ms, status, git_commit, error_message, applied_at
             ) VALUES ($1, $2, $3, 'failed', $4, $5, now())
             ON CONFLICT (filename) DO UPDATE SET
               status = 'failed', execution_ms = EXCLUDED.execution_ms,
               error_message = EXCLUDED.error_message, applied_at = now()`,
            [item.filename, sha256, execMs, gitCommit, errMsg]
          )
          .catch(() => {});
        console.error(`  ❌ [FAILED SQL] ${item.filename}: ${errMsg}`);
        throw err;
      }
    }

    for (const pm of prismaFolders) {
      const rawSql = fs.readFileSync(pm.sqlPath, 'utf8');
      const sha256 = crypto.createHash('sha256').update(rawSql).digest('hex');
      const tag = `prisma:${pm.migrationName}`;

      if (appliedPrismaSet.has(pm.migrationName)) {
        skippedCount += 1;
        console.log(`  ✓ [SKIP PRISMA] ${pm.migrationName}`);
        continue;
      }

      const migId = crypto.randomUUID();
      const startedAt = new Date();
      const t0 = Date.now();
      try {
        await client.query('BEGIN');
        await client.query(stripExplicitTxWrapper(rawSql));
        const execMs = Date.now() - t0;
        await client.query(
          `INSERT INTO public."_prisma_migrations" (
             id, checksum, started_at, finished_at, migration_name, logs, applied_steps_count
           ) VALUES ($1, $2, $3, now(), $4, NULL, 1)`,
          [migId, sha256, startedAt, pm.migrationName]
        );
        await client.query(
          `INSERT INTO public.schema_migrations (
             filename, checksum_sha256, execution_ms, status, git_commit, error_message, applied_at
           ) VALUES ($1, $2, $3, 'success', $4, NULL, now())
           ON CONFLICT (filename) DO UPDATE SET
             checksum_sha256 = EXCLUDED.checksum_sha256,
             execution_ms = EXCLUDED.execution_ms,
             status = 'success',
             git_commit = EXCLUDED.git_commit,
             error_message = NULL,
             applied_at = now()`,
          [tag, sha256, execMs, gitCommit]
        );
        await client.query('COMMIT');
        appliedCount += 1;
        console.log(`  🚀 [APPLIED PRISMA] ${pm.migrationName} (${execMs} ms | sha256:${sha256.slice(0, 12)})`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const errMsg = err instanceof Error ? err.message : String(err);
        await client
          .query(
            `INSERT INTO public."_prisma_migrations" (
               id, checksum, started_at, migration_name, logs, applied_steps_count
             ) VALUES ($1, $2, $3, $4, $5, 0)`,
            [migId, sha256, startedAt, pm.migrationName, errMsg]
          )
          .catch(() => {});
        console.error(`  ❌ [FAILED PRISMA] ${pm.migrationName}: ${errMsg}`);
        throw err;
      }
    }

    const summaryRes = await client.query(
      `SELECT
         (SELECT count(*)::int FROM public.schema_migrations WHERE status = 'success') AS sql_ok,
         (SELECT count(*)::int FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL) AS prisma_ok`
    );
    const { sql_ok, prisma_ok } = summaryRes.rows[0] || { sql_ok: 0, prisma_ok: 0 };
    console.log(
      `[${tsNow()}] ✅ Hoàn tất Migration: mới áp dụng ${appliedCount}, bỏ qua ${skippedCount} (schema_migrations=${sql_ok}, _prisma_migrations=${prisma_ok}).`
    );
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]).catch(() => {});
    await client.end().catch(() => {});
  }
}

runMigrations().catch((err) => {
  console.error('❌ [MIGRATE FATAL]', err instanceof Error ? err.message : err);
  process.exit(1);
});

