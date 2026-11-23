#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { buildDefaultGridWorkbook } from '../src/components/excel-grid/excel-grid-defaults';
import { classifyWorkbook, listAllCatalogUnits } from './lib/a1-c1-audit-classifier.mjs';
import { compareLocalAndPostgres } from './lib/a1-c1-postgres-diff.mjs';

const require = createRequire(import.meta.url);
const pg = require('pg');
const XLSX = require('xlsx');

const args = process.argv.slice(2);
if (args.some((a) => ['--execute', '--apply', '--delete', '--write'].includes(a))) {
  console.error('⛔ TỪ CHỐI: Không cho phép chạy/bổ sung --execute trong giai đoạn chuẩn bị Giai đoạn 3 (chỉ đọc & dry-run).');
  process.exit(1);
}
const jsonOutIdx = args.indexOf('--json-out');
const jsonOutPath = jsonOutIdx >= 0 ? args[jsonOutIdx + 1] : '';

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

function readJsonSafe(filePath, fallback) {
  try { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : fallback; }
  catch { return fallback; }
}

async function queryPostgresReadOnly(dbUrl) {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    await client.query('BEGIN TRANSACTION READ ONLY');
    const info = (await client.query(`SELECT current_database() AS db, current_setting('transaction_read_only') AS ro`)).rows[0];
    const fkRows = (await client.query(`
      SELECT conrelid::regclass::text AS child_table, confrelid::regclass::text AS parent_table,
             conname, pg_get_constraintdef(oid) AS def
      FROM pg_constraint WHERE contype = 'f'
        AND confrelid::regclass::text IN ('a1_nhiem_vu', 'c1_vtvl', 'public.a1_nhiem_vu', 'public.c1_vtvl')
      ORDER BY parent_table, child_table
    `)).rows;
    const tTienDo = (await client.query(`SELECT ma_don_vi, ten_don_vi, phien_ban, so_nhiem_vu_a1, so_vtvl_c1, updated_at, du_lieu_ho_so_json FROM public.t_tien_do`)).rows;
    const workbooks = (await client.query(`SELECT id, unit_id, status, current_revision, touched_cells, is_deleted, updated_at, data FROM public.workbooks`)).rows;
    const wbRevisions = (await client.query(`SELECT id, workbook_id, revision, actor_email, change_summary, created_at FROM public.workbook_revisions ORDER BY workbook_id, revision DESC`)).rows;
    const relA1 = (await client.query(`SELECT * FROM public.a1_nhiem_vu ORDER BY ma_don_vi, ma_nhiem_vu`)).rows;
    const relC1 = (await client.query(`SELECT * FROM public.c1_vtvl ORDER BY ma_don_vi, ma_vtvl`)).rows;
    const relA2D2Tables = ['a2_cong_viec', 'b1_khoi_luong', 'b2_ct_tac_dong', 'b2_thay_doi', 'c2_nang_luc', 'c3_nhu_cau', 'd1_nhan_luc', 'du_bao_5_nam', 'd2_phuong_an', 'can_cu_goi_y'];
    const relationalA2D2Counts = {};
    for (const tbl of relA2D2Tables) {
      relationalA2D2Counts[tbl] = (await client.query(`SELECT COUNT(*)::int AS cnt FROM public.${tbl}`)).rows[0]?.cnt ?? 0;
    }
    const tickets = (await client.query(`SELECT id, unit_code, owner_email, owner_name, status, ma_nhiem_vu, ma_cong_viec, ten_cong_viec, ma_vtvl, ma_vtvl_phoi_hop, is_test_data, is_archived FROM public.staff_work_tickets`)).rows;
    const surveyVersionsRows = (await client.query(`SELECT survey_id, version_no, snapshot, submitted_by, submitted_at FROM public.work_survey_versions ORDER BY survey_id, version_no ASC`)).rows;
    const mergeLinksRows = (await client.query(`SELECT survey_id, target_sheet, target_record_id, source_version, merged_by, merged_at FROM public.work_survey_merge_links`)).rows;
    const vtvlAssigns = (await client.query(`SELECT user_email, unit_code, ma_vtvl, is_active FROM public.user_vtvl_assignments WHERE is_active = true`)).rows;
    const sldvNgach = (await client.query(`SELECT id, ma_don_vi, ma_vtvl_xep_vao FROM public.sldv_phan_bo_ngach`)).rows;
    const workRels = (await client.query(`SELECT id, host_unit_code, host_vtvl_code, target_unit_code, target_vtvl_code, source_mission_code, source_survey_id FROM public.work_relationships`)).rows;
    const accounts = (await client.query(`SELECT email, role, unit_code, status FROM public.user_accounts`)).rows;
    const auditTotalRes = (await client.query(`SELECT COUNT(*)::int AS cnt FROM public.audit_logs`)).rows[0];
    const auditLogs = (await client.query(`SELECT unit_id, workbook_id, action, sheet_id, actor_email, new_values, created_at FROM public.audit_logs WHERE action NOT IN ('USER_LOGIN', 'USER_LOGOUT')`)).rows;
    await client.query('ROLLBACK');

    const surveyVersionsMap = {};
    for (const r of surveyVersionsRows) {
      if (!surveyVersionsMap[r.survey_id]) surveyVersionsMap[r.survey_id] = [];
      surveyVersionsMap[r.survey_id].push(r);
    }
    const mergeLinksMap = {};
    for (const r of mergeLinksRows) {
      if (!mergeLinksMap[r.survey_id]) mergeLinksMap[r.survey_id] = [];
      mergeLinksMap[r.survey_id].push(r);
    }
    return {
      available: true, info, fkRows, tTienDo, workbooks, wbRevisions, relA1, relC1, relationalA2D2Counts,
      tickets, surveyVersionsMap, mergeLinksRows, mergeLinksMap, vtvlAssigns, sldvNgach,
      workRels, accounts, auditLogs, auditLogsTotal: auditTotalRes?.cnt ?? auditLogs.length
    };
  } finally { await client.end(); }
}

function inspectExcelTemplates() {
  const results = [];
  for (const dir of ['public/mau', 'public/tai-ve']) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.xlsx')).sort()) {
      const fullPath = path.join(dir, name);
      const book = XLSX.readFile(fullPath);
      const sA1 = book.SheetNames.find((s) => s.includes('A1'));
      const sC1 = book.SheetNames.find((s) => s.includes('C1'));
      const nonEmpty = (sn) => sn ? XLSX.utils.sheet_to_json(book.Sheets[sn], { header: 1, defval: '' })
        .filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== '')) : [];
      results.push({ file: fullPath, sheetsCount: book.SheetNames.length, a1NonEmpty: nonEmpty(sA1).length, c1NonEmpty: nonEmpty(sC1).length });
    }
  }
  return results;
}

async function main() {
  loadEnvSilently();
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  const pgData = dbUrl
    ? await queryPostgresReadOnly(dbUrl)
    : { available: false, reason: 'Chưa cấu hình DATABASE_URL trong môi trường local (.env.local / .env); chỉ đọc được dữ liệu JSON cục bộ.' };

  const rawWbs = readJsonSafe('.data/server_workbooks.json', []);
  const localTickets = readJsonSafe('.data/staff_tickets.json', []);
  const localAuditLogs = readJsonSafe('.data/audit-logs.json', []);
  const localAccounts = readJsonSafe('.data/server_accounts.json', []);
  const workRelsObj = readJsonSafe('.data/work_relationships.json', {});
  const localWorkRels = Object.values(workRelsObj.relationships || {});
  const surveyVersions = readJsonSafe('.data/work_survey_versions.json', {});
  const mergeLinks = readJsonSafe('.data/work_survey_merge_links.json', {});

  const accountMap = new Map();
  for (const a of (pgData.available ? pgData.accounts : localAccounts)) accountMap.set(String(a.email || '').trim().toLowerCase(), a);

  const persistedResults = [];
  if (pgData.available) {
    const wbMap = new Map(pgData.workbooks.map((w) => [String(w.unit_id).toUpperCase(), w]));
    const revMap = new Map();
    for (const rv of pgData.wbRevisions || []) {
      if (!revMap.has(rv.workbook_id)) revMap.set(rv.workbook_id, []);
      revMap.get(rv.workbook_id).push(rv);
    }
    for (const row of pgData.tTienDo) {
      const uc = String(row.ma_don_vi).toUpperCase();
      const swb = row.du_lieu_ho_so_json?.serverWorkbook || wbMap.get(uc) || {};
      const wbId = swb.id || `wb_${uc}_2026`;
      persistedResults.push(classifyWorkbook({
        sourceKind: 'POSTGRES', workbookId: wbId, rawUnitCode: uc,
        status: swb.status || wbMap.get(uc)?.status || 'draft',
        currentRevision: Number(swb.currentRevision ?? wbMap.get(uc)?.current_revision ?? 1),
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        participants: swb.participants || [], revisions: revMap.get(wbId) || swb.revisions || [],
        touchedCells: swb.touchedCells || wbMap.get(uc)?.touched_cells || [],
        wbData: swb.data || wbMap.get(uc)?.data || {}, auditLogs: pgData.auditLogs, accountMap,
        tickets: pgData.tickets, surveyVersions: pgData.surveyVersionsMap, mergeLinks: pgData.mergeLinksMap,
        workRelationships: pgData.workRels, vtvlAssignments: pgData.vtvlAssigns, sldvNgach: pgData.sldvNgach
      }));
    }
  } else {
    for (const entry of rawWbs) {
      const wb = Array.isArray(entry) ? entry[1] : entry;
      if (!wb || wb.isDeleted) continue;
      persistedResults.push(classifyWorkbook({
        sourceKind: 'LOCAL_JSON', workbookId: wb.id, rawUnitCode: wb.unitId,
        status: wb.status || 'draft', currentRevision: Number(wb.currentRevision || 1), updatedAt: wb.updatedAt,
        participants: wb.participants || [], revisions: wb.revisions || [], touchedCells: wb.touchedCells || [],
        wbData: wb.data || {}, auditLogs: localAuditLogs, accountMap,
        tickets: localTickets, surveyVersions, mergeLinks, workRelationships: localWorkRels
      }));
    }
  }

  const savedRawSet = new Set(persistedResults.map((r) => r.rawUnitCode));
  const emptyInitCheck = listAllCatalogUnits()
    .filter((u) => !savedRawSet.has(u.code.toUpperCase()))
    .map((u) => {
      const initWb = buildDefaultGridWorkbook(u.code);
      return { unitCode: u.code, initA1: initWb.A1.length, initC1: initWb.C1.length };
    });

  const localVsPostgresDiff = compareLocalAndPostgres({
    local: { rawWbs, tickets: localTickets, surveyVersions, mergeLinks, auditLogs: localAuditLogs },
    pgData
  });

  const detailedRowIdManifest = persistedResults.map((r) => ({
    unitCode: r.rawUnitCode,
    workbookId: r.workbookId,
    currentRevision: r.currentRevision,
    action: r.manifestRow.Action,
    a1TemplateIds: r.a1Classified.filter((x) => x.label === 'SCHOOL_TEMPLATE').map((x) => ({ id: x.id, code: x.code })),
    c1TemplateIds: r.c1Classified.filter((x) => x.label === 'SCHOOL_TEMPLATE').map((x) => ({ id: x.id, code: x.code })),
    dependentTemplateIdsBySheet: Object.fromEntries(
      Object.entries(r.depBySheet).map(([k, arr]) => [k, arr.filter((x) => x.label === 'TEMPLATE_DEPENDENT').map((x) => x.id)])
    ),
    keptUnknownIds: [
      ...r.a1Classified.filter((x) => x.label === 'UNKNOWN').map((x) => ({ sheet: 'A1', id: x.id, code: x.code })),
      ...r.c1Classified.filter((x) => x.label === 'UNKNOWN').map((x) => ({ sheet: 'C1', id: x.id, code: x.code }))
    ],
    keptReferencedIds: [
      ...r.a1Classified.filter((x) => x.label === 'REFERENCED').map((x) => ({ sheet: 'A1', id: x.id, code: x.code })),
      ...r.c1Classified.filter((x) => x.label === 'REFERENCED').map((x) => ({ sheet: 'C1', id: x.id, code: x.code })),
      ...Object.entries(r.depBySheet).flatMap(([k, arr]) => arr.filter((x) => x.label === 'REFERENCED').map((x) => ({ sheet: k, id: x.id, code: x.maCongViec || x.maVtvl })))
    ]
  }));

  const manifest = {
    generatedAt: new Date().toISOString(),
    mode: 'BEGIN_READ_ONLY_STAGE3_PREP',
    postgresStatus: pgData.available ? pgData.info : { available: false, reason: pgData.reason },
    postgresForeignKeys: pgData.available ? pgData.fkRows : [],
    relationalA2D2Counts: pgData.available ? pgData.relationalA2D2Counts : null,
    persistedStorageCount: persistedResults.length,
    emptyInitVerifiedCount: emptyInitCheck.filter((x) => x.initA1 === 0 && x.initC1 === 0).length,
    finalManifestRows: persistedResults.map((r) => r.manifestRow),
    detailedRowIdManifest,
    localVsPostgresDiff,
    excelTemplates: inspectExcelTemplates(),
    persistedResults
  };

  if (jsonOutPath) {
    fs.mkdirSync(path.dirname(jsonOutPath), { recursive: true });
    fs.writeFileSync(jsonOutPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  console.log(`=== AUDIT STAGE 3 PREP (${pgData.available ? `PostgreSQL READ ONLY: ${pgData.info.db}` : 'LOCAL JSON ONLY — PG UNREACHABLE'}) ===`);
  console.table(manifest.finalManifestRows);
  console.log(`Chênh lệch Local vs PostgreSQL: ${localVsPostgresDiff.status}${localVsPostgresDiff.tableDrift?.length ? ` (${localVsPostgresDiff.tableDrift.length} đơn vị lệch)` : ''}`);
  if (jsonOutPath) console.log(`Manifest JSON: ${jsonOutPath}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
