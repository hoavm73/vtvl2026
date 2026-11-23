import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DEP_SHEET_KEYS } from './a1-c1-template-reference.mjs';
import { captureWorkbookStructureSnapshot, assertWorkbookStructureUnchanged, buildCleanupAuditLogEntry } from './a1-c1-structure-guard.mjs';
import { recalculateGridFormulas } from '../../src/components/excel-grid/excel-grid-formulas';
import { buildWorkbookRelationalPayload } from '../../src/services/storage/server-workbook-relational-sync';

export const RESTORE_ORDER_TABLES = [
  { name: 't_tien_do', unitCol: 'ma_don_vi', pk: ['ma_don_vi'], jsonCols: ['du_lieu_ho_so_json'] },
  { name: 'workbooks', unitCol: 'unit_id', pk: ['id'], jsonCols: ['data', 'touched_cells'] },
  { name: 'workbook_revisions', unitViaWb: true, pk: ['id'], jsonCols: ['data'] },
  { name: 'a1_nhiem_vu', unitCol: 'ma_don_vi', pk: ['ma_nhiem_vu'], jsonCols: [] },
  { name: 'c1_vtvl', unitCol: 'ma_don_vi', pk: ['ma_vtvl'], jsonCols: [] },
  { name: 'a2_cong_viec', unitCol: 'ma_don_vi', pk: ['ma_cong_viec'], jsonCols: [] },
  { name: 'b1_khoi_luong', unitCol: 'ma_don_vi', pk: ['ma_cong_viec'], jsonCols: [] },
  { name: 'b2_ct_tac_dong', unitCol: 'ma_don_vi', pk: ['id_tac_dong'], jsonCols: [] },
  { name: 'b2_thay_doi', unitCol: 'ma_don_vi', pk: ['ma_cong_viec'], jsonCols: [] },
  { name: 'can_cu_goi_y', unitCol: 'ma_don_vi', pk: ['ma_don_vi', 'ma_cong_viec'], jsonCols: [] },
  { name: 'c2_nang_luc', unitCol: 'ma_don_vi', pk: ['ma_vtvl'], jsonCols: [] },
  { name: 'c3_nhu_cau', unitCol: 'ma_don_vi', pk: ['ma_vtvl'], jsonCols: [] },
  { name: 'd1_nhan_luc', unitCol: 'ma_don_vi', pk: ['ma_nguon_luc'], jsonCols: [] },
  { name: 'du_bao_5_nam', unitCol: 'ma_don_vi', pk: ['ma_vtvl', 'nam_du_bao'], jsonCols: [] },
  { name: 'd2_phuong_an', unitCol: 'ma_don_vi', pk: ['ma_vtvl', 'nam_phuong_an'], jsonCols: [] },
  { name: 'sldv_phan_bo_ngach', unitCol: 'ma_don_vi', pk: ['id'], jsonCols: [] },
  { name: 'k_kiem_tra', unitCol: 'ma_don_vi', pk: ['ma_don_vi', 'stt_chi_tieu'], jsonCols: [] }
];

const norm = (v) => String(v ?? '').trim();
const upper = (v) => norm(v).toUpperCase();
const sha256Text = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

export function canonicalizeValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  if (Array.isArray(v)) return v.map(canonicalizeValue);
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (v[k] !== undefined) out[k] = canonicalizeValue(v[k]);
    }
    return out;
  }
  return v;
}

async function selectTableRows(pgClient, tbl, units) {
  if (units && units.length > 0) {
    if (tbl.unitViaWb) {
      return (await pgClient.query(
        `SELECT r.* FROM public.workbook_revisions r INNER JOIN public.workbooks w ON w.id = r.workbook_id WHERE UPPER(w.unit_id) = ANY($1)`,
        [units.map(upper)]
      )).rows;
    }
    return (await pgClient.query(
      `SELECT * FROM public.${tbl.name} WHERE UPPER(${tbl.unitCol}) = ANY($1)`,
      [units.map(upper)]
    )).rows;
  }
  return (await pgClient.query(`SELECT * FROM public.${tbl.name}`)).rows;
}

function sortRowsByPk(rows, pk) {
  const keyOf = (r) => pk.map((c) => String(r[c] ?? '')).join('::');
  return [...rows].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
}

export async function computeDatabaseTableDigests(pgClient, filterUnits = null) {
  const tables = {};
  const fullTables = {};
  for (const tbl of RESTORE_ORDER_TABLES) {
    const rows = sortRowsByPk(await selectTableRows(pgClient, tbl, filterUnits), tbl.pk);
    const fullNormalized = rows.map(canonicalizeValue);
    // Bảng c1_vtvl có trigger BEFORE INSERT/UPDATE (fn_validate_c1_career_level) tự gán updated_at := now()
    const semanticNormalized = fullNormalized.map((c) => {
      if (tbl.name !== 'c1_vtvl') return c;
      const copy = { ...c };
      delete copy.updated_at;
      return copy;
    });
    const semanticSha = sha256Text(JSON.stringify(semanticNormalized));
    const fullSha = sha256Text(JSON.stringify(fullNormalized));
    tables[tbl.name] = { count: rows.length, sha256: semanticSha, semanticSha256: semanticSha, fullSha256: fullSha };
    fullTables[tbl.name] = { count: rows.length, fullSha256: fullSha };
  }
  const overallSha256 = sha256Text(JSON.stringify(Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, { count: v.count, sha256: v.sha256 }]))));
  const fullOverallSha256 = sha256Text(JSON.stringify(fullTables));
  return { tables, overallSha256, semanticOverallSha256: overallSha256, fullOverallSha256 };
}

export async function assertIsolatedStagingPort(pgClient, options) {
  if (!options || options.allowStagingTest !== true) {
    throw new Error('REFUSED: Staging lock missing allowStagingTest=true.');
  }
  const r = (await pgClient.query(`SELECT inet_server_port()::int AS port, current_database() AS db`)).rows[0];
  const host = String(pgClient.host || '').toLowerCase();
  const isLocal = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  if (!isLocal || Number(r?.port) !== 5440 || String(r?.db || '').toLowerCase().includes('prod')) {
    throw new Error(`REFUSED: Locked exclusively to local staging (127.0.0.1:5440), got ${host}:${r?.port}/${r?.db}`);
  }
}

export async function createCleanupBackupBundle(pgClient, targetUnits, backupDir) {
  const units = Array.from(new Set((targetUnits || []).map(upper))).sort();
  fs.mkdirSync(backupDir, { recursive: true });
  const tables = {};
  for (const tbl of RESTORE_ORDER_TABLES) {
    tables[tbl.name] = sortRowsByPk(await selectTableRows(pgClient, tbl, units), tbl.pk).map(canonicalizeValue);
  }
  const backupBundle = {
    createdAt: new Date().toISOString(),
    targetUnits: units,
    jsonbSnapshots: {
      tTienDo: tables.t_tien_do.map((r) => ({ ma_don_vi: r.ma_don_vi, du_lieu_ho_so_json: r.du_lieu_ho_so_json })),
      workbooks: tables.workbooks.map((w) => ({ id: w.id, unit_id: w.unit_id, current_revision: w.current_revision, data: w.data, touched_cells: w.touched_cells }))
    },
    tables
  };
  const backupJson = JSON.stringify(backupBundle, null, 2);
  const backupPath = path.join(backupDir, 'pg-pre-cleanup-backup.json');
  fs.writeFileSync(backupPath, backupJson, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(backupPath, 0o600);
  // Kiểm tra đọc ngược tệp backup ngay sau khi ghi (Mục XIII)
  const verifiedRead = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  if (!verifiedRead?.tables?.workbooks) throw new Error('Backup readback verification failed.');

  const targetDigests = await computeDatabaseTableDigests(pgClient, units);
  const allUnitsDigests = await computeDatabaseTableDigests(pgClient, null);
  const backupId = `bkp_${Date.now()}`;
  const manifest = {
    backupId,
    createdAt: backupBundle.createdAt,
    targetUnits: units,
    backupFile: backupPath,
    backupFileSha256: sha256Text(backupJson),
    restoreOrder: RESTORE_ORDER_TABLES.map((t) => t.name),
    targetTableDigests: targetDigests,
    allUnitsTableDigests: allUnitsDigests
  };
  const manifestPath = path.join(backupDir, 'rollback-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(manifestPath, 0o600);
  return { backupId, backupPath, manifestPath, manifest };
}

export async function insertPreCleanupWorkbookRevision(pgClient, unitCode, actorEmail = 'tcns@hcmute.edu.vn') {
  const uc = upper(unitCode);
  const wbRes = await pgClient.query(`SELECT id, current_revision, data FROM public.workbooks WHERE UPPER(unit_id) = $1 AND is_deleted = false ORDER BY updated_at DESC LIMIT 1`, [uc]);
  if (!wbRes.rows.length) return null;
  const wb = wbRes.rows[0];
  const maxRes = await pgClient.query(`SELECT COALESCE(MAX(revision), 0)::int AS max_rev FROM public.workbook_revisions WHERE workbook_id = $1`, [wb.id]);
  const nextRev = Math.max(Number(wb.current_revision || 1), Number(maxRes.rows[0]?.max_rev || 0)) + 1;
  await pgClient.query(
    `INSERT INTO public.workbook_revisions (id, workbook_id, revision, data, checksum, actor_email, actor_title, change_summary) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
    [`rev_${wb.id}_${nextRev}_pre_cleanup`, wb.id, nextRev, JSON.stringify(wb.data || {}), sha256Text(JSON.stringify(wb.data || {})), actorEmail, 'Cơ chế backup Giai đoạn 3', 'Pre-cleanup snapshot before Stage 3 A1/C1 template purge']
  );
  return { unitCode: uc, workbookId: wb.id, preCleanupRevision: nextRev };
}

function buildCleanedWorkbookData(wbData, cls) {
  const keepA1 = new Set(cls.a1Classified.filter((x) => x.label !== 'SCHOOL_TEMPLATE').map((x) => x.id));
  const keepC1 = new Set(cls.c1Classified.filter((x) => x.label !== 'SCHOOL_TEMPLATE').map((x) => x.id));
  const next = { ...wbData };
  next.A1 = (wbData.A1 || []).filter((r) => keepA1.has(norm(r.id) || upper(r.maNhiemVu)));
  next.C1 = (wbData.C1 || []).filter((r) => keepC1.has(norm(r.id) || upper(r.maVtvl)));
  for (const key of DEP_SHEET_KEYS) {
    const keepIds = new Set((cls.depBySheet[key] || []).filter((x) => x.label !== 'TEMPLATE_DEPENDENT').map((x) => x.id));
    next[key] = (wbData[key] || []).filter((r) => keepIds.has(norm(r.id) || upper(r.maCongViec || r.maVtvl)));
  }
  return recalculateGridFormulas(next, cls.rawUnitCode, cls.unitNameVi);
}

async function deleteNotInList(pgClient, table, unitCode, colExpr, keepArr) {
  if (!keepArr.length) {
    await pgClient.query(`DELETE FROM public.${table} WHERE UPPER(ma_don_vi) = $1`, [unitCode]);
  } else {
    await pgClient.query(`DELETE FROM public.${table} WHERE UPPER(ma_don_vi) = $1 AND NOT ((${colExpr}) = ANY($2::text[]))`, [unitCode, keepArr]);
  }
}

export async function applyStagedRelationalCleanup(pgClient, classifiedUnits, preCleanupRevs, options) {
  await assertIsolatedStagingPort(pgClient, options);
  const targets = (classifiedUnits || []).filter((u) => ['CLEAN_ALL_TEMPLATE_INIT_EMPTY', 'CLEAN_TEMPLATE_ONLY_KEEP_REST'].includes(u.manifestRow?.Action));
  const results = [];
  await pgClient.query('BEGIN');
  try {
    for (const u of targets) {
      const uc = upper(u.rawUnitCode);
      if (uc === 'TCNS' || uc === 'GDQPAN' || uc === 'FIT') throw new Error(`Protected unit cannot be cleaned: ${uc}`);
      const wbRow = (await pgClient.query(`SELECT * FROM public.workbooks WHERE id = $1 LIMIT 1`, [u.workbookId])).rows[0];
      if (!wbRow) throw new Error(`Missing staging workbook row ${u.workbookId}`);
      const structBefore = captureWorkbookStructureSnapshot(wbRow.data || {});
      const cleanedData = buildCleanedWorkbookData(wbRow.data || {}, u);
      assertWorkbookStructureUnchanged(structBefore, captureWorkbookStructureSnapshot(cleanedData), uc);
      const rel = buildWorkbookRelationalPayload({ id: wbRow.id, unitId: uc, unitNameVi: u.unitNameVi, reportingPeriod: wbRow.reporting_period, status: wbRow.status, currentRevision: wbRow.current_revision, data: cleanedData, touchedCells: wbRow.touched_cells || [] });
      const keepA1 = rel.activeKeys.a1, keepC1 = rel.activeKeys.c1;
      const ngachRef = (await pgClient.query(`SELECT COUNT(*)::int AS c FROM public.sldv_phan_bo_ngach WHERE UPPER(ma_don_vi) = $1 AND NOT (ma_vtvl_xep_vao = ANY($2::text[]))`, [uc, keepC1])).rows[0].c;
      const assignRef = (await pgClient.query(`SELECT COUNT(*)::int AS c FROM public.user_vtvl_assignments WHERE UPPER(unit_code) = $1 AND is_active = true AND NOT (UPPER(ma_vtvl) = ANY($2::text[]))`, [uc, keepC1.map(upper)])).rows[0].c;
      const tktRef = (await pgClient.query(`SELECT COUNT(*)::int AS c FROM public.staff_work_tickets WHERE UPPER(unit_code) = $1 AND COALESCE(is_test_data, false) = false AND COALESCE(is_archived, false) = false AND (NOT (UPPER(ma_nhiem_vu) = ANY($2::text[])) OR NOT (UPPER(ma_vtvl) = ANY($3::text[])))`, [uc, keepA1.map(upper), keepC1.map(upper)])).rows[0].c;
      if (ngachRef + assignRef + tktRef > 0) throw new Error(`Aborted cleanup on ${uc}: active FK/ticket reference (${ngachRef}/${assignRef}/${tktRef})`);

      await deleteNotInList(pgClient, 'b2_ct_tac_dong', uc, 'id_tac_dong', rel.activeKeys.b2_ct);
      await deleteNotInList(pgClient, 'b2_thay_doi', uc, 'ma_cong_viec', rel.activeKeys.b2);
      await deleteNotInList(pgClient, 'b1_khoi_luong', uc, 'ma_cong_viec', rel.activeKeys.b1);
      await deleteNotInList(pgClient, 'can_cu_goi_y', uc, 'ma_cong_viec', rel.activeKeys.a2);
      await deleteNotInList(pgClient, 'c2_nang_luc', uc, 'ma_vtvl', rel.activeKeys.c2);
      await deleteNotInList(pgClient, 'c3_nhu_cau', uc, 'ma_vtvl', rel.activeKeys.c3);
      await deleteNotInList(pgClient, 'd1_nhan_luc', uc, 'ma_nguon_luc', rel.activeKeys.d1);
      await deleteNotInList(pgClient, 'du_bao_5_nam', uc, `ma_vtvl || '::' || nam_du_bao::text`, rel.activeKeys.du_bao);
      await deleteNotInList(pgClient, 'd2_phuong_an', uc, `ma_vtvl || '::' || nam_phuong_an::text`, rel.activeKeys.d2);
      await deleteNotInList(pgClient, 'a2_cong_viec', uc, 'ma_cong_viec', rel.activeKeys.a2);
      await deleteNotInList(pgClient, 'a1_nhiem_vu', uc, 'ma_nhiem_vu', keepA1);
      await deleteNotInList(pgClient, 'c1_vtvl', uc, 'ma_vtvl', keepC1);
      for (const c3 of rel.c3_nhu_cau) {
        await pgClient.query(`INSERT INTO public.c3_nhu_cau (ma_vtvl, ma_don_vi, phuong_phap, gio_b1_nam, gio_tac_dong_b2, gio_rong_nam, gio_chuan_pp2, nguoi_quy_doi_pp2, nguoi_dinh_bien_pp1, nguoi_can_bo_tri, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT (ma_vtvl) DO UPDATE SET phuong_phap=EXCLUDED.phuong_phap, gio_b1_nam=EXCLUDED.gio_b1_nam, gio_tac_dong_b2=EXCLUDED.gio_tac_dong_b2, gio_rong_nam=EXCLUDED.gio_rong_nam, gio_chuan_pp2=EXCLUDED.gio_chuan_pp2, nguoi_quy_doi_pp2=EXCLUDED.nguoi_quy_doi_pp2, nguoi_dinh_bien_pp1=EXCLUDED.nguoi_dinh_bien_pp1, nguoi_can_bo_tri=EXCLUDED.nguoi_can_bo_tri, updated_at=NOW()`, [c3.ma_vtvl, uc, c3.phuong_phap, c3.gio_b1_nam, c3.gio_tac_dong_b2, c3.gio_rong_nam, c3.gio_chuan_pp2, c3.nguoi_quy_doi_pp2, c3.nguoi_dinh_bien_pp1, c3.nguoi_can_bo_tri]);
      }
      for (const k of rel.k_kiem_tra) {
        await pgClient.query(`INSERT INTO public.k_kiem_tra (ma_don_vi, stt_chi_tieu, nhom_bieu_doi_soat, noi_dung_kiem_tra, so_dong_loi, ket_luan, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (ma_don_vi, stt_chi_tieu) DO UPDATE SET so_dong_loi = EXCLUDED.so_dong_loi, ket_luan = EXCLUDED.ket_luan, updated_at = NOW()`, [uc, k.stt_chi_tieu, k.nhom_bieu_doi_soat, k.noi_dung_kiem_tra, k.so_dong_loi, k.ket_luan]);
      }
      const nextRev = Math.max(Number(wbRow.current_revision || 1), Number(preCleanupRevs.get(uc)?.preCleanupRevision || 1)) + 1;
      await pgClient.query(`UPDATE public.workbooks SET data = $1::jsonb, current_revision = $2, updated_at = NOW() WHERE id = $3`, [JSON.stringify(cleanedData), nextRev, wbRow.id]);
      const tdRow = (await pgClient.query(`SELECT du_lieu_ho_so_json FROM public.t_tien_do WHERE UPPER(ma_don_vi) = $1`, [uc])).rows[0];
      const nextTdJson = { ...(tdRow?.du_lieu_ho_so_json || {}), serverWorkbook: { ...(tdRow?.du_lieu_ho_so_json?.serverWorkbook || wbRow), currentRevision: nextRev, data: cleanedData } };
      await pgClient.query(`UPDATE public.t_tien_do SET so_nhiem_vu_a1 = $1, so_cong_viec_a2 = $2, so_vtvl_c1 = $3, tong_fte_c3 = $4, du_lieu_ho_so_json = $5::jsonb, updated_at = NOW() WHERE UPPER(ma_don_vi) = $6`, [cleanedData.A1.length, cleanedData.A2.length, cleanedData.C1.length, cleanedData.T?.[0]?.tongFte || 0, JSON.stringify(nextTdJson), uc]);
      const auditEntry = buildCleanupAuditLogEntry({
        unitCode: uc, workbookId: wbRow.id, revBefore: wbRow.current_revision, revAfter: nextRev,
        a1Cleaned: u.manifestRow.A1Template, c1Cleaned: u.manifestRow.C1Template,
        dependentCleanedByTable: Object.fromEntries(Object.entries(u.depBySheet || {}).map(([k, arr]) => [k, arr.filter((x) => x.label === 'TEMPLATE_DEPENDENT').length])),
        backupId: options.backupId || 'staging-backup', manifestId: options.manifestId || 'staging-manifest'
      });
      results.push({ unitCode: uc, workbookId: wbRow.id, revBefore: wbRow.current_revision, newRevision: nextRev, a1After: cleanedData.A1.length, c1After: cleanedData.C1.length, structureVerified: true, auditEntry });
    }
    await pgClient.query('COMMIT');
    return results;
  } catch (err) {
    await pgClient.query('ROLLBACK');
    throw err;
  }
}

async function restoreRowUpsert(pgClient, tbl, row) {
  const cols = Object.keys(row);
  const vals = cols.map((c) => (tbl.jsonCols.includes(c) ? JSON.stringify(row[c] ?? {}) : row[c]));
  const ph = cols.map((c, i) => `$${i + 1}${tbl.jsonCols.includes(c) ? '::jsonb' : ''}`);
  const conflict = tbl.pk.length === 1 ? tbl.pk[0] : tbl.pk.join(', ');
  const updates = cols.filter((c) => !tbl.pk.includes(c)).map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  await pgClient.query(`INSERT INTO public.${tbl.name} (${cols.join(', ')}) VALUES (${ph.join(', ')}) ON CONFLICT (${conflict}) DO UPDATE SET ${updates}`, vals);
}

export async function rollbackFromBackupManifest(pgClient, backupDir, options) {
  await assertIsolatedStagingPort(pgClient, options);
  const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'rollback-manifest.json'), 'utf8'));
  const backupRaw = fs.readFileSync(manifest.backupFile, 'utf8');
  if (sha256Text(backupRaw) !== manifest.backupFileSha256) throw new Error('Rollback aborted: backup SHA-256 mismatch!');
  const backup = JSON.parse(backupRaw);
  const units = (manifest.targetUnits || []).map(upper);

  await pgClient.query('BEGIN');
  try {
    for (const tbl of [...RESTORE_ORDER_TABLES].reverse()) {
      if (tbl.unitViaWb) {
        const wbIds = (backup.tables.workbooks || []).map((w) => w.id);
        if (wbIds.length) await pgClient.query(`DELETE FROM public.workbook_revisions WHERE workbook_id = ANY($1::text[])`, [wbIds]);
      } else if (tbl.name !== 'workbooks' && tbl.name !== 't_tien_do') {
        await pgClient.query(`DELETE FROM public.${tbl.name} WHERE UPPER(${tbl.unitCol}) = ANY($1::text[])`, [units]);
      }
    }
    for (const tbl of RESTORE_ORDER_TABLES) {
      for (const row of backup.tables[tbl.name] || []) await restoreRowUpsert(pgClient, tbl, row);
    }
    await pgClient.query('COMMIT');
  } catch (err) {
    await pgClient.query('ROLLBACK');
    throw err;
  }
  const postDigests = await computeDatabaseTableDigests(pgClient, null);
  const semanticMatchedAll = postDigests.semanticOverallSha256 === manifest.allUnitsTableDigests.semanticOverallSha256;
  const fullMatchedAll = postDigests.fullOverallSha256 === manifest.allUnitsTableDigests.fullOverallSha256;
  const fullDiffTables = RESTORE_ORDER_TABLES.filter((t) => postDigests.tables[t.name]?.fullSha256 !== manifest.allUnitsTableDigests.tables[t.name]?.fullSha256).map((t) => t.name);
  return {
    matchedAll: semanticMatchedAll,
    semanticMatchedAll,
    fullMatchedAll,
    fullDiffTables,
    expectedSha256: manifest.allUnitsTableDigests.semanticOverallSha256,
    actualSha256: postDigests.semanticOverallSha256,
    expectedFullSha256: manifest.allUnitsTableDigests.fullOverallSha256,
    actualFullSha256: postDigests.fullOverallSha256,
    tableDiffs: RESTORE_ORDER_TABLES.filter((t) => postDigests.tables[t.name]?.sha256 !== manifest.allUnitsTableDigests.tables[t.name]?.sha256).map((t) => t.name)
  };
}
