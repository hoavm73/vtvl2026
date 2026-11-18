#!/usr/bin/env node
/**
 * Post-Build & Post-Migration Table Verification Test (100% Read-Only)
 * Hệ thống: HCM-UTE VTVL 360 (PostgreSQL 16 + Prisma ORM)
 *
 * Tự động kiểm tra sau khi build & chạy migration trên Production:
 *   1. Đối soát 100% model khai báo trong prisma/schema.prisma đều đã có bảng thật trong PostgreSQL.
 *   2. Đối soát 100% thư mục prisma/migrations/<version>/migration.sql đã hoàn tất trong "_prisma_migrations".
 *   3. Kiểm tra không có bản ghi lỗi trong public.schema_migrations.
 *   4. Kiểm tra các chỉ mục chịu tải cao (pg_indexes) & chạy smoke-query chỉ đọc trên các bảng trọng yếu.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const ROOT = process.cwd();

function loadEnvIfNeeded() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parsePrismaModels(schemaPath) {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Không tìm thấy tệp lược đồ Prisma: ${schemaPath}`);
  }
  const content = fs.readFileSync(schemaPath, 'utf8');
  const models = [];
  const blockRe = /^model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)^\}/gm;
  let match;
  while ((match = blockRe.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];
    const mapMatch = body.match(/@@map\(\s*"([^"]+)"\s*\)/);
    models.push(mapMatch ? mapMatch[1] : modelName);
  }
  return models.sort();
}

function listExpectedPrismaMigrations(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(migrationsDir, d.name, 'migration.sql')))
    .map((d) => d.name)
    .sort();
}

async function main() {
  loadEnvIfNeeded();
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    console.error('❌ [VERIFY FAIL] Thiếu biến môi trường DATABASE_URL.');
    process.exit(1);
  }

  const expectedTables = parsePrismaModels(path.join(ROOT, 'prisma/schema.prisma'));
  const expectedMigrations = listExpectedPrismaMigrations(path.join(ROOT, 'prisma/migrations'));

  const client = new Client({ connectionString: dbUrl, statement_timeout: 15000 });
  await client.connect();

  const failures = [];
  try {
    console.log(`[${new Date().toISOString()}] 🧪 Bắt đầu kiểm thử hậu triển khai CSDL (${expectedTables.length} Prisma models, ${expectedMigrations.length} Prisma migrations)...`);

    // 1. Kiểm tra 100% bảng trong prisma/schema.prisma đã tồn tại trong public schema
    const tablesRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));
    const missingTables = expectedTables.filter((t) => !existingTables.has(t));
    if (missingTables.length > 0) {
      failures.push(`Thiếu ${missingTables.length} bảng trong PostgreSQL so với prisma/schema.prisma: ${missingTables.join(', ')}`);
    } else {
      console.log(`  ✓ [PASS] Bảng Prisma: ${expectedTables.length}/${expectedTables.length} bảng tồn tại đầy đủ trong public schema.`);
    }

    // 2. Kiểm tra 100% thư mục prisma/migrations/* đã hoàn tất trong "_prisma_migrations"
    const pmRes = await client.query(
      `SELECT migration_name, finished_at FROM public."_prisma_migrations"`
    );
    const appliedPrisma = new Map(pmRes.rows.map((r) => [r.migration_name, r.finished_at]));
    const missingMigrations = expectedMigrations.filter((m) => !appliedPrisma.get(m));
    if (missingMigrations.length > 0) {
      failures.push(`Chưa hoàn tất Prisma migration: ${missingMigrations.join(', ')}`);
    } else {
      console.log(`  ✓ [PASS] Sổ cái _prisma_migrations: ${expectedMigrations.length}/${expectedMigrations.length} phiên bản đã áp dụng thành công.`);
    }

    // 3. Kiểm tra không có migration lỗi trong schema_migrations
    const smRes = await client.query(
      `SELECT filename, status, error_message FROM public.schema_migrations WHERE status <> 'success'`
    );
    if (smRes.rows.length > 0) {
      failures.push(`Phát hiện migration lỗi trong schema_migrations: ${smRes.rows.map((r) => `${r.filename} (${r.status})`).join(', ')}`);
    } else {
      const totalSm = await client.query(`SELECT count(*)::int AS cnt FROM public.schema_migrations`);
      console.log(`  ✓ [PASS] Sổ cái schema_migrations: ${totalSm.rows[0].cnt} bản ghi hợp lệ (0 lỗi).`);
    }

    // 4. Kiểm tra các chỉ mục chịu tải cao
    const requiredIndexes = [
      'idx_idempotency_expires_at',
      'idx_bg_jobs_status_run_after',
      'idx_tickets_unit_status_updated',
      'idx_tickets_owner_updated',
      'idx_status_history_survey_created',
      'idx_tickets_pending_merge'
    ];
    const idxRes = await client.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [requiredIndexes]
    );
    const existingIdx = new Set(idxRes.rows.map((r) => r.indexname));
    const missingIdx = requiredIndexes.filter((idx) => !existingIdx.has(idx));
    if (missingIdx.length > 0) {
      failures.push(`Thiếu chỉ mục chịu tải cao: ${missingIdx.join(', ')}`);
    } else {
      console.log(`  ✓ [PASS] Chỉ mục chịu tải cao: ${requiredIndexes.length}/${requiredIndexes.length} index hoạt động.`);
    }

    // 5. Read-only smoke query kiểm tra khả năng truy vấn trực tiếp trên các bảng trọng yếu + 3 bảng chịu tải mới
    const smokeTables = [
      'dm_don_vi',
      'user_accounts',
      'staff_work_tickets',
      'unit_mission_counters',
      'idempotency_records',
      'background_jobs'
    ];
    const counts = [];
    for (const tbl of smokeTables) {
      if (!existingTables.has(tbl)) continue;
      const cRes = await client.query(`SELECT count(*)::int AS cnt FROM public."${tbl}"`);
      counts.push(`${tbl}=${cRes.rows[0].cnt}`);
    }
    console.log(`  ✓ [PASS] Smoke-test chỉ đọc (Read-Only): ${counts.join(', ')}.`);

    if (failures.length > 0) {
      console.error('❌ [VERIFY FAIL] Kiểm thử bảng hậu triển khai thất bại:');
      for (const f of failures) console.error(`   - ${f}`);
      process.exit(1);
    }

    console.log(`[${new Date().toISOString()}] ✅ Hậu kiểm bảng & migration PostgreSQL ĐẠT 100% (0 lỗi).`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('❌ [VERIFY ERROR]', err?.message || err);
  process.exit(1);
});
