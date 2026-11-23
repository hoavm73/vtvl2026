#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { execSync, execFileSync, spawnSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pg = require('pg');

const PG_PORT = 5441;
const PG_DB = 'utevtvl_db';
const DB_URL = `postgresql://127.0.0.1:${PG_PORT}/${PG_DB}?schema=public`;
const WORK_DIR = '/tmp/utevtvl_pg16_prod_exec_rehearsal';
const BACKUP_DIR = path.join(WORK_DIR, 'backup_out');
const REPORT_OUT = path.join(WORK_DIR, 'exec-report.json');
const MANIFEST_PATH = '/Users/macaz/.gemini/antigravity/brain/81db706b-34ca-418c-b50b-05ff52e7a46a/scratch/stage3-prep-manifest.json';

function resolvePgBinDir() {
  for (const brew of ['/opt/homebrew/bin/brew', '/usr/local/bin/brew']) {
    if (!fs.existsSync(brew)) continue;
    try { return path.join(execFileSync(brew, ['--prefix', 'postgresql@16'], { encoding: 'utf8' }).trim(), 'bin'); } catch {}
  }
  for (const dir of ['/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin']) {
    if (fs.existsSync(path.join(dir, 'initdb'))) return dir;
  }
  throw new Error('Không tìm thấy PostgreSQL 16 để chạy kiểm thử rehearsal.');
}

async function seedRehearsal(pgClient) {
  process.env.DATABASE_URL = DB_URL;
  process.env.VTVL_ISOLATED_LOCAL_STORE = 'false';
  const { syncWorkbookAtomicOrFallback } = await import('../src/services/storage/server-workbook-relational-sync');
  const rawWbs = JSON.parse(fs.readFileSync('.data/server_workbooks.json', 'utf8')).map((e) => (Array.isArray(e) ? e[1] : e)).filter((w) => w && !w.isDeleted);
  const tickets = JSON.parse(fs.readFileSync('.data/staff_tickets.json', 'utf8'));
  const svMap = JSON.parse(fs.readFileSync('.data/work_survey_versions.json', 'utf8'));
  const mlMap = JSON.parse(fs.readFileSync('.data/work_survey_merge_links.json', 'utf8'));

  for (const uc of new Set(['CNTT_NEW', ...rawWbs.map((w) => String(w.unitId).toUpperCase()), ...tickets.map((t) => String(t.unitCode).toUpperCase())])) {
    await pgClient.query(`INSERT INTO public.dm_don_vi (ma_don_vi, ten_don_vi_vi, ten_don_vi_en, khoi_don_vi, is_active) VALUES ($1,$2,$3,'phong-ban',true) ON CONFLICT (ma_don_vi) DO NOTHING`, [uc, uc, uc]);
  }
  for (const em of new Set(['tcns@hcmute.edu.vn', 'spkquangbinh@gmail.com', 'probe@hcmute.edu.vn', 'qa.staff.qth@hcmute.edu.vn', 'qa.leader.qth@hcmute.edu.vn'])) {
    await pgClient.query(`INSERT INTO public.user_accounts (email, display_name, unit_code, unit_name_vi, role, status) VALUES ($1,$2,'TCNS','Phòng TCNS','admin','active') ON CONFLICT (email) DO NOTHING`, [em, em.split('@')[0]]);
  }
  const byUnit = new Map();
  for (const wb of rawWbs) {
    const uc = String(wb.unitId).toUpperCase();
    const cur = byUnit.get(uc);
    if (!cur || Number(wb.currentRevision || 0) >= Number(cur.currentRevision || 0)) byUnit.set(uc, wb);
  }
  for (const wb of byUnit.values()) {
    await syncWorkbookAtomicOrFallback(wb, {
      ma_don_vi: wb.unitId, ten_don_vi: wb.unitNameVi || wb.unitId, phien_ban: `v${wb.currentRevision || 1}`,
      so_nhiem_vu_a1: (wb.data?.A1 || []).length, so_cong_viec_a2: (wb.data?.A2 || []).length,
      so_vtvl_c1: (wb.data?.C1 || []).length, tong_fte_c3: Number(wb.data?.T?.[0]?.tongFte || 0),
      trang_thai_ra_soat: wb.status || 'draft', du_lieu_ho_so_json: { serverWorkbook: wb }
    });
  }
  for (const t of tickets) {
    await pgClient.query(`INSERT INTO public.staff_work_tickets (id, unit_code, owner_email, owner_name, owner_title, status, ma_nhiem_vu, ma_cong_viec, ten_cong_viec, ma_vtvl, is_test_data, is_archived, current_version_no) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
      [t.id, String(t.unitCode).toUpperCase(), t.ownerEmail || 'tcns@hcmute.edu.vn', t.ownerName || 'CB', t.ownerTitle || 'CV', t.status || 'Nháp', t.maNhiemVu, t.maCongViec, t.tenCongViec, t.maVtvl, Boolean(t.isTestData), Boolean(t.isArchived), Number(t.currentVersionNo || 1)]);
  }
  for (const [sid, arr] of Object.entries(svMap)) {
    const first = arr[0] || {};
    const uc = String(first.snapshot?.unitCode || (sid.includes('QTTHTT') ? 'QTTHTT' : 'TCNS')).toUpperCase();
    await pgClient.query(`INSERT INTO public.staff_work_tickets (id, unit_code, owner_email, owner_name, owner_title, status, ma_nhiem_vu, ma_cong_viec, ten_cong_viec, ma_vtvl, is_test_data, is_archived) VALUES ($1,$2,$3,'Stub','CV','Nháp',$4,$5,$6,$7,true,true) ON CONFLICT (id) DO NOTHING`,
      [sid, uc, first.submittedBy || 'tcns@hcmute.edu.vn', first.snapshot?.maNhiemVu || `${uc}.NV01`, `stub-${sid}`, first.snapshot?.tenCongViec || 'stub', first.snapshot?.maVtvl || `${uc}.CV01`]);
    for (const v of arr) {
      await pgClient.query(`INSERT INTO public.work_survey_versions (survey_id, version_no, snapshot, submitted_by, submitted_at, is_migration_baseline) VALUES ($1,$2,$3::jsonb,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [sid, v.versionNo, JSON.stringify(v.snapshot || {}), v.submittedBy || 'tcns@hcmute.edu.vn', v.submittedAt || null, Boolean(v.isMigrationBaseline)]);
    }
  }
  for (const [sid, links] of Object.entries(mlMap)) {
    for (const l of links) {
      await pgClient.query(`INSERT INTO public.work_survey_merge_links (survey_id, target_sheet, target_record_id, source_version, merged_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [sid, l.targetSheet, l.targetRecordId, l.sourceVersion || 1, l.mergedBy || 'tcns@hcmute.edu.vn']);
    }
  }
}

async function main() {
  // 1. Verify Gate 1 halts cleanly without DATABASE_URL
  const noDbRes = spawnSync('npx', ['tsx', 'scripts/execute-a1-c1-template-cleanup.mjs', '--execute'], {
    env: { ...process.env, DATABASE_URL: '' }, encoding: 'utf8'
  });
  assert.notEqual(noDbRes.status, 0);
  assert(noDbRes.stderr.includes('GATE_01_FAIL'), 'Phải chặn tại GATE_01_FAIL khi thiếu DATABASE_URL');
  console.log('  ✓ [PASS] [PROD-GATE-01] Từ chối chạy khi thiếu DATABASE_URL (exit=1, 0 DELETE)');

  const binDir = resolvePgBinDir();
  const hadMigLog = fs.existsSync('migrations.log');
  const migLogBackup = hadMigLog ? fs.readFileSync('migrations.log', 'utf8') : null;
  let pgClient;
  try {
    execSync(`rm -rf ${WORK_DIR} && mkdir -p ${WORK_DIR}`);
    execFileSync(path.join(binDir, 'initdb'), ['-D', path.join(WORK_DIR, 'pgdata'), '-A', 'trust', '-U', process.env.USER || 'postgres'], { stdio: 'pipe' });
    execFileSync(path.join(binDir, 'pg_ctl'), ['-D', path.join(WORK_DIR, 'pgdata'), '-l', path.join(WORK_DIR, 'pg.log'), '-o', `-p ${PG_PORT} -k ${WORK_DIR}`, 'start'], { stdio: 'pipe' });
    execFileSync(path.join(binDir, 'createdb'), ['-h', '127.0.0.1', '-p', String(PG_PORT), PG_DB], { stdio: 'pipe' });
    execSync('node scripts/migrate-postgres.mjs', { env: { ...process.env, DATABASE_URL: DB_URL }, stdio: 'pipe' });

    pgClient = new pg.Client({ connectionString: DB_URL });
    await pgClient.connect();
    await seedRehearsal(pgClient);

    // 2. Run actual production execute CLI against isolated rehearsal utevtvl_db
    const execRes = spawnSync('npx', ['tsx', 'scripts/execute-a1-c1-template-cleanup.mjs', '--execute', '--manifest', MANIFEST_PATH, '--backup-dir', BACKUP_DIR, '--report-out', REPORT_OUT], {
      env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8'
    });
    if (execRes.status !== 0) throw new Error(`Execute CLI failed:\n${execRes.stdout}\n${execRes.stderr}`);
    const report = JSON.parse(fs.readFileSync(REPORT_OUT, 'utf8'));
    assert.equal(report.status, 'success');
    assert.equal(report.committed, true);
    assert.equal(report.gateResult, '12/12 PASS');
    assert.equal(report.rollbackRequired, false);
    assert.equal(report.deletedRows.unitsCleaned, 12);
    assert.equal(report.dbIdentity.db, 'utevtvl_db');
    assert.equal(report.unitReports.length, 12);
    assert.equal(report.tcnsBeforeSha256, report.tcnsAfterSha256);
    const auditCnt = (await pgClient.query(`SELECT COUNT(*)::int AS c FROM public.audit_logs WHERE action = 'REMOVE_A1_C1_SCHOOL_TEMPLATE'`)).rows[0].c;
    assert.equal(auditCnt, 12, 'Phải ghi đủ 12 bản ghi audit REMOVE_A1_C1_SCHOOL_TEMPLATE');
    console.log('  ✓ [PASS] [PROD-EXEC-02] execute-a1-c1-template-cleanup.mjs --execute đạt 12/12 chốt, COMMIT sạch 12 đơn vị, TCNS giữ nguyên, ghi 12 audit log');

    // 3. Run actual production rollback CLI
    const rbRes = spawnSync('npx', ['tsx', 'scripts/rollback-a1-c1-template-cleanup.mjs', '--backup-dir', BACKUP_DIR], {
      env: { ...process.env, DATABASE_URL: DB_URL }, encoding: 'utf8'
    });
    if (rbRes.status !== 0) throw new Error(`Rollback CLI failed:\n${rbRes.stdout}\n${rbRes.stderr}`);
    assert(rbRes.stdout.includes('"semanticMatchedAll17":true'));
    console.log('  ✓ [PASS] [PROD-RB-03] rollback-a1-c1-template-cleanup.mjs khôi phục khớp 17/17 bảng (Semantic SHA-256 100%)');
    console.log('\n✅ PROD EXECUTE & ROLLBACK CLI REHEARSAL PASSED: 3/3\n');
  } finally {
    try { await pgClient?.end(); } catch {}
    try { const { prisma, getPgPool } = await import('../src/services/storage/prisma'); await getPgPool()?.end(); await prisma.$disconnect(); } catch {}
    try { execFileSync(path.join(binDir, 'pg_ctl'), ['-D', path.join(WORK_DIR, 'pgdata'), 'stop', '-m', 'fast'], { stdio: 'ignore' }); } catch {}
    try { execSync(`rm -rf ${WORK_DIR}`); } catch {}
    if (hadMigLog && migLogBackup !== null) fs.writeFileSync('migrations.log', migLogBackup, 'utf8');
    else if (!hadMigLog && fs.existsSync('migrations.log')) fs.unlinkSync('migrations.log');
  }
}

main().catch((e) => { console.error('❌ PROD EXECUTE REHEARSAL FAILED:', e); process.exit(1); });
