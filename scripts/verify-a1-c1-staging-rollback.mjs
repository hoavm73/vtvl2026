#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { execSync, execFileSync } from 'child_process';
import { createRequire } from 'module';
import {
  computeDatabaseTableDigests,
  createCleanupBackupBundle,
  insertPreCleanupWorkbookRevision,
  applyStagedRelationalCleanup,
  rollbackFromBackupManifest
} from './lib/a1-c1-backup-plan.mjs';

const require = createRequire(import.meta.url);
const pg = require('pg');

const PG_PORT = 5440;
const PG_DB = 'utevtvl_stage3_test';
const STAGING_URL = `postgresql://127.0.0.1:${PG_PORT}/${PG_DB}?schema=public`;
const DATA_DIR = '/tmp/utevtvl_pg16_stage3_test';
const ARTIFACT_SCRATCH = '/Users/macaz/.gemini/antigravity/brain/81db706b-34ca-418c-b50b-05ff52e7a46a/scratch';
const BACKUP_DIR = path.join(DATA_DIR, 'backup_bundle');
const AUDIT_JSON = path.join(DATA_DIR, 'staging-audit.json');
const PROOF_JSON = path.join(ARTIFACT_SCRATCH, 'stage3-staging-rollback-proof.json');

function resolvePgBinDir() {
  for (const brew of ['/opt/homebrew/bin/brew', '/usr/local/bin/brew']) {
    if (!fs.existsSync(brew)) continue;
    try { return path.join(execFileSync(brew, ['--prefix', 'postgresql@16'], { encoding: 'utf8' }).trim(), 'bin'); } catch {}
  }
  for (const dir of ['/opt/homebrew/opt/postgresql@16/bin', '/usr/local/opt/postgresql@16/bin', '/Applications/Postgres.app/Contents/Versions/16/bin']) {
    if (fs.existsSync(path.join(dir, 'initdb'))) return dir;
  }
  throw new Error('Không tìm thấy PostgreSQL 16 (initdb/pg_ctl) để chạy kiểm thử staging cô lập.');
}

async function seedStagingData(pgClient) {
  process.env.DATABASE_URL = STAGING_URL;
  process.env.VTVL_ISOLATED_LOCAL_STORE = 'false';
  const { syncWorkbookAtomicOrFallback } = await import('../src/services/storage/server-workbook-relational-sync');

  const rawWbs = JSON.parse(fs.readFileSync('.data/server_workbooks.json', 'utf8')).map((e) => (Array.isArray(e) ? e[1] : e)).filter((w) => w && !w.isDeleted);
  const tickets = JSON.parse(fs.readFileSync('.data/staff_tickets.json', 'utf8'));
  const svMap = JSON.parse(fs.readFileSync('.data/work_survey_versions.json', 'utf8'));
  const mlMap = JSON.parse(fs.readFileSync('.data/work_survey_merge_links.json', 'utf8'));

  const unitCodes = new Set(['KT', 'CNTT_NEW', ...rawWbs.map((w) => String(w.unitId).toUpperCase()), ...tickets.map((t) => String(t.unitCode).toUpperCase())]);
  for (const uc of unitCodes) {
    await pgClient.query(`INSERT INTO public.dm_don_vi (ma_don_vi, ten_don_vi_vi, ten_don_vi_en, khoi_don_vi, is_active) VALUES ($1,$2,$3,'phong-ban',true) ON CONFLICT (ma_don_vi) DO NOTHING`, [uc, uc === 'KT' ? 'Phòng Kế hoạch - Tài chính' : uc, uc]);
  }
  const emails = new Set(['tcns@hcmute.edu.vn', 'spkquangbinh@gmail.com', 'probe@hcmute.edu.vn', 'qa.staff.qth@hcmute.edu.vn', 'qa.leader.qth@hcmute.edu.vn', 'kt.staff@hcmute.edu.vn']);
  for (const t of tickets) {
    if (t.ownerEmail) emails.add(t.ownerEmail);
    if (t.approvedBy) emails.add(t.approvedBy);
    if (t.mergedBy) emails.add(t.mergedBy);
  }
  for (const em of emails) {
    await pgClient.query(`INSERT INTO public.user_accounts (email, display_name, unit_code, unit_name_vi, role, status) VALUES ($1,$2,'TCNS','Phòng TCNS','admin','active') ON CONFLICT (email) DO NOTHING`, [em, em.split('@')[0]]);
  }

  const byUnit = new Map();
  for (const wb of rawWbs) {
    const uc = String(wb.unitId).toUpperCase();
    const cur = byUnit.get(uc);
    if (!cur || Number(wb.currentRevision || 0) >= Number(cur.currentRevision || 0)) byUnit.set(uc, wb);
  }
  const ktWb = {
    id: 'wb_KT_pg_only_2026', unitId: 'KT', unitNameVi: 'Phòng Kế hoạch - Tài chính', reportingPeriod: '01/10/2025–30/9/2026',
    status: 'draft', currentRevision: 3, touchedCells: ['A1:a1-kt-1:tenNhiemVu'], participants: [{ email: 'kt.staff@hcmute.edu.vn', displayName: 'Chuyên viên KT' }],
    data: {
      A1: [{ id: 'a1-kt-1', maNhiemVu: 'KT.NV01', tenNhiemVu: 'Lập dự toán ngân sách tự chủ 2026', canCu: 'QĐ tài chính HCM-UTE', ky: '01/10/2025–30/9/2026', trangThai: 'Tiếp tục thực hiện' }],
      C1: [{ id: 'c1-kt-1', maVtvl: 'KT.KT01', nhomVtvl4: 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', tenKhung: 'Kế toán viên', tenVtvl: 'Kế toán tổng hợp ngân sách', bacNgheNghiep: 'Bậc 3', maNgach: '06.031', loaiNhanLuc: 'Viên chức', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', gioChuanPp2: 1904, phuongPhap: 'PP2' }],
      A2: [], B1: [], B2_CT: [], B2: [], C2: [], C3: [], D1: [], DU_BAO: [], D2: [], DM_SP: [], K: [], T: [], S: []
    },
    revisions: [{ id: 'rev_wb_KT_3', revision: 3, data: {}, actorEmail: 'kt.staff@hcmute.edu.vn', changeSummary: 'Lưu thực tế tại PG' }]
  };
  byUnit.set('KT', ktWb);

  for (const wb of byUnit.values()) {
    const t0 = wb.data?.T?.[0] || {};
    await syncWorkbookAtomicOrFallback(wb, {
      ma_don_vi: wb.unitId, ten_don_vi: wb.unitNameVi || wb.unitId, phien_ban: `v${wb.currentRevision || 1}`,
      so_nhiem_vu_a1: (wb.data?.A1 || []).length, so_cong_viec_a2: (wb.data?.A2 || []).length,
      so_vtvl_c1: (wb.data?.C1 || []).length, tong_fte_c3: Number(t0.tongFte || 0),
      trang_thai_ra_soat: wb.status || 'draft', du_lieu_ho_so_json: { serverWorkbook: wb }
    });
  }

  for (const t of tickets) {
    await pgClient.query(
      `INSERT INTO public.staff_work_tickets (id, unit_code, owner_email, owner_name, owner_title, status, ma_nhiem_vu, ma_cong_viec, ten_cong_viec, ma_vtvl, is_test_data, is_archived, current_version_no) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (id) DO NOTHING`,
      [t.id, String(t.unitCode).toUpperCase(), t.ownerEmail || 'tcns@hcmute.edu.vn', t.ownerName || 'Cán bộ', t.ownerTitle || 'Chuyên viên', t.status || 'Nháp', t.maNhiemVu, t.maCongViec, t.tenCongViec, t.maVtvl, Boolean(t.isTestData), Boolean(t.isArchived), Number(t.currentVersionNo || 1)]
    );
  }
  for (const [sid, arr] of Object.entries(svMap)) {
    const first = arr[0] || {};
    const uc = String(first.snapshot?.unitCode || (sid.includes('QTTHTT') ? 'QTTHTT' : 'TCNS')).toUpperCase();
    await pgClient.query(
      `INSERT INTO public.staff_work_tickets (id, unit_code, owner_email, owner_name, owner_title, status, ma_nhiem_vu, ma_cong_viec, ten_cong_viec, ma_vtvl, is_test_data, is_archived) VALUES ($1,$2,$3,'Stub','Chuyên viên','Nháp',$4,$5,$6,$7,true,true) ON CONFLICT (id) DO NOTHING`,
      [sid, uc, first.submittedBy || 'tcns@hcmute.edu.vn', first.snapshot?.maNhiemVu || `${uc}.NV01`, `stub-${sid}`, first.snapshot?.tenCongViec || 'stub', first.snapshot?.maVtvl || `${uc}.CV01`]
    );
    for (const v of arr) {
      await pgClient.query(
        `INSERT INTO public.work_survey_versions (survey_id, version_no, snapshot, submitted_by, submitted_at, is_migration_baseline) VALUES ($1,$2,$3::jsonb,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [sid, v.versionNo, JSON.stringify(v.snapshot || {}), v.submittedBy || 'tcns@hcmute.edu.vn', v.submittedAt || null, Boolean(v.isMigrationBaseline)]
      );
    }
  }
  for (const [sid, links] of Object.entries(mlMap)) {
    for (const l of links) {
      await pgClient.query(
        `INSERT INTO public.work_survey_merge_links (survey_id, target_sheet, target_record_id, source_version, merged_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
        [sid, l.targetSheet, l.targetRecordId, l.sourceVersion || 1, l.mergedBy || 'tcns@hcmute.edu.vn']
      );
    }
  }
  await pgClient.query(`INSERT INTO public.user_vtvl_assignments (user_email, unit_code, ma_vtvl, ten_vtvl, assigned_by) VALUES ('kt.staff@hcmute.edu.vn','KT','KT.KT01','Kế toán tổng hợp ngân sách','tcns@hcmute.edu.vn') ON CONFLICT DO NOTHING`);
  await pgClient.query(`INSERT INTO public.audit_logs (unit_id, workbook_id, actor_email, action, sheet_id) VALUES ('KT','wb_KT_pg_only_2026','kt.staff@hcmute.edu.vn','WORKBOOK_SAVE','A1')`);
}

async function main() {
  const binDir = resolvePgBinDir();
  const hadMigLog = fs.existsSync('migrations.log');
  const migLogBackup = hadMigLog ? fs.readFileSync('migrations.log', 'utf8') : null;
  let pgClient;
  const startedAt = Date.now();
  try {
    execSync(`rm -rf ${DATA_DIR} && mkdir -p ${DATA_DIR}`);
    execFileSync(path.join(binDir, 'initdb'), ['-D', path.join(DATA_DIR, 'pgdata'), '-A', 'trust', '-U', process.env.USER || 'postgres'], { stdio: 'pipe' });
    execFileSync(path.join(binDir, 'pg_ctl'), ['-D', path.join(DATA_DIR, 'pgdata'), '-l', path.join(DATA_DIR, 'pg.log'), '-o', `-p ${PG_PORT} -k ${DATA_DIR}`, 'start'], { stdio: 'pipe' });
    execFileSync(path.join(binDir, 'createdb'), ['-h', '127.0.0.1', '-p', String(PG_PORT), PG_DB], { stdio: 'pipe' });
    execSync('node scripts/migrate-postgres.mjs', { env: { ...process.env, DATABASE_URL: STAGING_URL }, stdio: 'pipe' });

    pgClient = new pg.Client({ connectionString: STAGING_URL });
    await pgClient.connect();
    await seedStagingData(pgClient);

    execSync(`npx tsx scripts/audit-a1-c1-templates.mjs --dry-run --json-out ${AUDIT_JSON}`, { env: { ...process.env, DATABASE_URL: STAGING_URL }, stdio: 'pipe' });
    const audit = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf8'));
    assert.equal(audit.mode, 'BEGIN_READ_ONLY_STAGE3_PREP');
    assert.equal(audit.postgresStatus.ro, 'on');
    const ktDiff = audit.localVsPostgresDiff.unitDiffs.find((u) => u.unitCode === 'KT');
    assert(ktDiff && ktDiff.drifts.includes('ONLY_IN_POSTGRES'), 'KT must be detected as ONLY_IN_POSTGRES');
    const ktRow = audit.finalManifestRows.find((r) => r.UnitCode === 'KT');
    assert.equal(ktRow.A1Template + ktRow.C1Template + ktRow.DependentTemplate, 0, 'KT template delete must be 0');
    assert(ktRow.Real + ktRow.Referenced >= 2, 'KT UNIT_REAL + REFERENCED must be protected');
    const cleanUnits = audit.persistedResults.filter((u) => ['CLEAN_ALL_TEMPLATE_INIT_EMPTY', 'CLEAN_TEMPLATE_ONLY_KEEP_REST'].includes(u.manifestRow.Action));
    const targetUnitCodes = cleanUnits.map((u) => u.rawUnitCode);
    assert.equal(targetUnitCodes.length, 12, `Expected 12 cleanable units in staging, got ${targetUnitCodes.join(',')}`);

    const baselineDigests = await computeDatabaseTableDigests(pgClient, null);
    const backup = await createCleanupBackupBundle(pgClient, targetUnitCodes, BACKUP_DIR);
    const preCleanupRevs = new Map();
    for (const uc of targetUnitCodes) preCleanupRevs.set(uc, await insertPreCleanupWorkbookRevision(pgClient, uc));

    const protectedUnits = ['TCNS', 'GDQPAN', 'FIT', 'KT', 'CNTT'];
    const protectedBefore = await computeDatabaseTableDigests(pgClient, protectedUnits);
    const cleaned = await applyStagedRelationalCleanup(pgClient, cleanUnits, preCleanupRevs, { allowStagingTest: true, backupId: backup.backupId, manifestId: 'staging-manifest' });
    const protectedAfter = await computeDatabaseTableDigests(pgClient, protectedUnits);
    assert.equal(protectedAfter.overallSha256, protectedBefore.overallSha256, 'Protected units must stay 100% untouched');

    for (const res of cleaned) {
      assert.equal(res.structureVerified, true, `${res.unitCode} structure/formulas must remain unchanged`);
      assert.equal(res.auditEntry?.action, 'REMOVE_A1_C1_SCHOOL_TEMPLATE', `${res.unitCode} must emit REMOVE_A1_C1_SCHOOL_TEMPLATE audit entry`);
      assert(res.newRevision > (preCleanupRevs.get(res.unitCode)?.preCleanupRevision || 0), 'currentRevision must bump');
      const kErr = (await pgClient.query(`SELECT stt_chi_tieu, so_dong_loi FROM public.k_kiem_tra WHERE UPPER(ma_don_vi) = $1 AND stt_chi_tieu IN (1,2,5,6) AND so_dong_loi > 0`, [res.unitCode])).rows;
      assert.equal(kErr.length, 0, `${res.unitCode} must have 0 K1/K2/K5/K6 errors after cleanup`);
    }
    const sdhAfter = cleaned.find((x) => x.unitCode === 'SDH');
    const ckAfter = cleaned.find((x) => x.unitCode === 'CK');
    const qthAfter = cleaned.find((x) => x.unitCode === 'QTTHTT');
    assert.deepEqual([sdhAfter.a1After, sdhAfter.c1After], [1, 1]);
    assert.deepEqual([ckAfter.a1After, ckAfter.c1After], [2, 3]);
    assert.deepEqual([qthAfter.a1After, qthAfter.c1After], [1, 0]);

    const rollbackRes = await rollbackFromBackupManifest(pgClient, BACKUP_DIR, { allowStagingTest: true });
    assert.equal(rollbackRes.semanticMatchedAll, true, `Rollback semantic SHA-256 mismatch on tables: ${rollbackRes.tableDiffs.join(',')}`);
    assert(rollbackRes.fullDiffTables.every((t) => t === 'c1_vtvl'), `Unexpected full checksum diff outside triggered c1_vtvl: ${rollbackRes.fullDiffTables.join(',')}`);

    const summary = {
      testedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, port: PG_PORT, db: PG_DB, backupId: backup.backupId,
      stagingRoMode: audit.postgresStatus, localVsPostgresStatus: audit.localVsPostgresDiff.status, ktDrifts: ktDiff.drifts,
      cleanedUnitsCount: cleaned.length, structureFormulaGuardPassed: cleaned.every((x) => x.structureVerified),
      cleanedSummary: cleaned.map(({ auditEntry: _a, ...rest }) => rest), sampleAuditEntry: cleaned[0]?.auditEntry || null,
      protectedUnitsVerified: protectedUnits,
      baselineSemanticSha256: baselineDigests.semanticOverallSha256, postRollbackSemanticSha256: rollbackRes.actualSha256,
      baselineFullSha256: rollbackRes.expectedFullSha256, postRollbackFullSha256: rollbackRes.actualFullSha256,
      semanticMatchedAll17Tables: rollbackRes.semanticMatchedAll, fullMatched16NonTriggerTables: rollbackRes.fullDiffTables.every((t) => t === 'c1_vtvl'),
      fullDiffTablesDueToTrigger: rollbackRes.fullDiffTables,
      tableCountsBaseline: Object.fromEntries(Object.entries(baselineDigests.tables).map(([k, v]) => [k, v.count]))
    };
    fs.mkdirSync(ARTIFACT_SCRATCH, { recursive: true });
    fs.writeFileSync(PROOF_JSON, JSON.stringify(summary, null, 2), 'utf8');
    console.log('✅ STAGING ROLLBACK PROOF PASSED 100%:', JSON.stringify({ cleanedUnits: cleaned.length, semanticMatchedAll17: rollbackRes.semanticMatchedAll, fullDiffTriggerTables: rollbackRes.fullDiffTables, semanticSha256: rollbackRes.actualSha256, durationMs: summary.durationMs }));
  } finally {
    try { await pgClient?.end(); } catch {}
    try { const { prisma, getPgPool } = await import('../src/services/storage/prisma'); await getPgPool()?.end(); await prisma.$disconnect(); } catch {}
    try { execFileSync(path.join(binDir, 'pg_ctl'), ['-D', path.join(DATA_DIR, 'pgdata'), 'stop', '-m', 'fast'], { stdio: 'ignore' }); } catch {}
    try { execSync(`rm -rf ${DATA_DIR}`); } catch {}
    if (hadMigLog && migLogBackup !== null) fs.writeFileSync('migrations.log', migLogBackup, 'utf8');
    else if (!hadMigLog && fs.existsSync('migrations.log')) fs.unlinkSync('migrations.log');
  }
}

main().catch((err) => { console.error('❌ STAGING VERIFICATION FAILED:', err); process.exit(1); });
