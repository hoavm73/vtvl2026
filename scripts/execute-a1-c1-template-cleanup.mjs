#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import { classifyWorkbook } from './lib/a1-c1-audit-classifier.mjs';
import { executeProductionCleanup } from './lib/a1-c1-prod-executor.mjs';

const require = createRequire(import.meta.url);
const pg = require('pg');

const args = process.argv.slice(2);
const hasExecute = args.includes('--execute');
const getArg = (flag, fallback = '') => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const manifestPath = getArg('--manifest', '/Users/macaz/.gemini/antigravity/brain/81db706b-34ca-418c-b50b-05ff52e7a46a/scratch/stage3-prep-manifest.json');
const backupDir = getArg('--backup-dir', `/var/backups/utevtvl-stage3-${Date.now()}`);
const reportOut = getArg('--report-out', path.join(backupDir, 'execution-report.json'));
const actorEmail = getArg('--actor', 'tcns@hcmute.edu.vn');

function loadEnvSilently() {
  for (const envFile of ['.env.local', '.env']) {
    if (!fs.existsSync(envFile)) continue;
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  }
}

async function loadLiveClassificationSnapshot(client) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const tTienDo = (await client.query(`SELECT ma_don_vi, ten_don_vi, phien_ban, updated_at, du_lieu_ho_so_json FROM public.t_tien_do`)).rows;
    const workbooks = (await client.query(`SELECT id, unit_id, status, current_revision, touched_cells, is_deleted, updated_at, data FROM public.workbooks`)).rows;
    const wbRevisions = (await client.query(`SELECT id, workbook_id, revision, actor_email, change_summary, created_at FROM public.workbook_revisions ORDER BY workbook_id, revision DESC`)).rows;
    const tickets = (await client.query(`SELECT id, unit_code, owner_email, owner_name, status, ma_nhiem_vu, ma_cong_viec, ten_cong_viec, ma_vtvl, ma_vtvl_phoi_hop, is_test_data, is_archived FROM public.staff_work_tickets`)).rows;
    const surveyVersionsRows = (await client.query(`SELECT survey_id, version_no, snapshot, submitted_by, submitted_at FROM public.work_survey_versions ORDER BY survey_id, version_no ASC`)).rows;
    const mergeLinksRows = (await client.query(`SELECT survey_id, target_sheet, target_record_id, source_version, merged_by, merged_at FROM public.work_survey_merge_links`)).rows;
    const vtvlAssigns = (await client.query(`SELECT user_email, unit_code, ma_vtvl, is_active FROM public.user_vtvl_assignments WHERE is_active = true`)).rows;
    const sldvNgach = (await client.query(`SELECT id, ma_don_vi, ma_vtvl_xep_vao FROM public.sldv_phan_bo_ngach`)).rows;
    const workRels = (await client.query(`SELECT id, host_unit_code, host_vtvl_code, target_unit_code, target_vtvl_code, source_mission_code, source_survey_id FROM public.work_relationships`)).rows;
    const accounts = (await client.query(`SELECT email, role, unit_code, status FROM public.user_accounts`)).rows;
    const auditLogs = (await client.query(`SELECT unit_id, workbook_id, action, sheet_id, actor_email, new_values, created_at FROM public.audit_logs WHERE action NOT IN ('USER_LOGIN', 'USER_LOGOUT')`)).rows;
    await client.query('COMMIT');

    const accountMap = new Map(accounts.map((a) => [String(a.email || '').trim().toLowerCase(), a]));
    const wbMap = new Map(workbooks.map((w) => [String(w.unit_id).toUpperCase(), w]));
    const revMap = new Map();
    for (const rv of wbRevisions) {
      if (!revMap.has(rv.workbook_id)) revMap.set(rv.workbook_id, []);
      revMap.get(rv.workbook_id).push(rv);
    }
    const svMap = {};
    for (const r of surveyVersionsRows) { (svMap[r.survey_id] ||= []).push(r); }
    const mlMap = {};
    for (const r of mergeLinksRows) { (mlMap[r.survey_id] ||= []).push(r); }

    return tTienDo.map((row) => {
      const uc = String(row.ma_don_vi).toUpperCase();
      const swb = row.du_lieu_ho_so_json?.serverWorkbook || wbMap.get(uc) || {};
      const wbId = swb.id || wbMap.get(uc)?.id || `wb_${uc}_2026`;
      return classifyWorkbook({
        sourceKind: 'POSTGRES', workbookId: wbId, rawUnitCode: uc,
        status: swb.status || wbMap.get(uc)?.status || 'draft',
        currentRevision: Number(swb.currentRevision ?? wbMap.get(uc)?.current_revision ?? 1),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        participants: swb.participants || [], revisions: revMap.get(wbId) || swb.revisions || [],
        touchedCells: swb.touchedCells || wbMap.get(uc)?.touched_cells || [],
        wbData: wbMap.get(uc)?.data || swb.data || {}, auditLogs, accountMap,
        tickets, surveyVersions: svMap, mergeLinks: mlMap, workRelationships: workRels,
        vtvlAssignments: vtvlAssigns, sldvNgach
      });
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

async function main() {
  loadEnvSilently();
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl) {
    console.error('❌ GATE_01_FAIL: Thiếu biến môi trường DATABASE_URL tới utevtvl_db. Dừng ngay, không thực thi DELETE.');
    process.exit(1);
  }
  if (!fs.existsSync(manifestPath)) {
    console.error(`❌ GATE_00_FAIL: Không tìm thấy Manifest đã phê duyệt tại ${manifestPath}. Dừng ngay.`);
    process.exit(1);
  }
  const approvedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const classifiedUnits = await loadLiveClassificationSnapshot(client);
    const result = await executeProductionCleanup(client, {
      classifiedUnits, approvedManifest, backupDir, actorEmail, manifestId: path.basename(manifestPath)
    });
    fs.mkdirSync(path.dirname(reportOut), { recursive: true });
    fs.writeFileSync(reportOut, JSON.stringify(result, null, 2), { encoding: 'utf8', mode: 0o600 });
    console.log('✅ EXECUTE PRODUCTION COMMITTED:', JSON.stringify({
      db: result.dbIdentity.db, backupId: result.backupId, backupSha256: result.backupSha256,
      unitsCleaned: result.unitReports.length, reportOut
    }));
  } finally {
    await client.end().catch(() => {});
  }
}

function writeReportSafe(filePath, payload) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(filePath, 0o600);
  } catch { /* ignore if backupDir unwritable */ }
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  if (!hasExecute) {
    console.error('⛔ Thiếu cờ --execute. Script chỉ thực thi khi có cờ --execute tường minh kèm --manifest.');
    process.exit(1);
  }
  main().catch((err) => {
    const msg = err?.message || String(err);
    writeReportSafe(reportOut, {
      status: 'failed',
      committed: false,
      gateResult: msg.match(/GATE_\d+_FAIL|AUTO_ROLLBACK/)?.[0] || 'FAILED',
      deletedRows: { unitsCleaned: 0, a1: 0, c1: 0, relationalByTable: {} },
      rollbackRequired: false,
      failedAt: new Date().toISOString(),
      error: msg
    });
    console.error('❌ EXECUTE PRODUCTION ABORTED (0 CHANGES COMMITTED):', msg);
    process.exit(1);
  });
}
