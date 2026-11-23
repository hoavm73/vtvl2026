import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DEP_SHEET_KEYS } from './a1-c1-template-reference.mjs';
import { computeDatabaseTableDigests, createCleanupBackupBundle, insertPreCleanupWorkbookRevision } from './a1-c1-backup-plan.mjs';
import { captureWorkbookStructureSnapshot, assertWorkbookStructureUnchanged, buildCleanupAuditLogEntry } from './a1-c1-structure-guard.mjs';
import { recalculateGridFormulas } from '../../src/components/excel-grid/excel-grid-formulas';
import { buildWorkbookRelationalPayload } from '../../src/services/storage/server-workbook-relational-sync';

const norm = (v) => String(v ?? '').trim();
const upper = (v) => norm(v).toUpperCase();
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const FORBIDDEN_UNITS = new Set(['TCNS', 'FIT', 'GDQPAN']);
const MIN_BACKUP_BYTES = 50 * 1024 * 1024; // 50 MB
export const EXPECTED_SRC_DEPENDENCY_SHA256 = {
  'src/components/excel-grid/excel-sheet-metas-core.ts': '61cab1d430642e9c7c5cf7559ddd18daf74bb98380343369591ec0b5307af1cc',
  'src/components/excel-grid/excel-grid-formulas.ts': '17521eabab34cb597ab890f070c153512c3451ce3383c9a8ad2fc99103d96bd0'
};

export function verifySourceDependencyChecksums() {
  const actual = {};
  for (const [fp, expected] of Object.entries(EXPECTED_SRC_DEPENDENCY_SHA256)) {
    if (!fs.existsSync(fp)) throw new Error(`GATE_SRC_CHECKSUM_FAIL: Thiếu tệp nguồn bắt buộc "${fp}". Dừng trước backup/DELETE.`);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
    if (hash !== expected) {
      throw new Error(`GATE_SRC_CHECKSUM_FAIL: Tệp nguồn "${fp}" lệch SHA-256 (actual=${hash}, expected=${expected}). Dừng trước backup/DELETE.`);
    }
    actual[fp] = hash;
  }
  return actual;
}

function checkDiskSpace(backupDir) {
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(backupDir, 0o700);
  const stat = fs.statfsSync(backupDir);
  const availBytes = Number(stat.bavail) * Number(stat.bsize);
  if (availBytes < MIN_BACKUP_BYTES) {
    throw new Error(`GATE_12_FAIL: Không đủ dung lượng lưu backup (${Math.round(availBytes / 1048576)}MB < 50MB).`);
  }
  return availBytes;
}

export function validateDeleteSetAgainstGates(classifiedUnits, approvedManifest) {
  const approvedByUnit = new Map((approvedManifest.detailedRowIdManifest || []).map((u) => [upper(u.unitCode), u]));
  const plans = [];

  for (const u of classifiedUnits) {
    const uc = upper(u.rawUnitCode);
    const act = u.manifestRow?.Action;
    if (act !== 'CLEAN_ALL_TEMPLATE_INIT_EMPTY' && act !== 'CLEAN_TEMPLATE_ONLY_KEEP_REST') continue;
    if (FORBIDDEN_UNITS.has(uc)) throw new Error(`GATE_09_FAIL: Đơn vị bị cấm xuất hiện trong tập xóa: ${uc}`);
    const approved = approvedByUnit.get(uc);
    if (!approved) throw new Error(`GATE_09_FAIL: Đơn vị ${uc} không tồn tại trong Manifest đã phê duyệt.`);

    const approvedA1Set = new Set((approved.a1TemplateIds || []).map((x) => norm(x.id)));
    const approvedC1Set = new Set((approved.c1TemplateIds || []).map((x) => norm(x.id)));
    const a1Ids = u.a1Classified.filter((x) => x.label === 'SCHOOL_TEMPLATE' && approvedA1Set.has(norm(x.id)));
    const c1Ids = u.c1Classified.filter((x) => x.label === 'SCHOOL_TEMPLATE' && approvedC1Set.has(norm(x.id)));

    const forbiddenInA1 = a1Ids.filter((x) => ['TCNS_REAL', 'UNIT_REAL', 'UNKNOWN', 'REFERENCED'].includes(x.label));
    const forbiddenInC1 = c1Ids.filter((x) => ['TCNS_REAL', 'UNIT_REAL', 'UNKNOWN', 'REFERENCED'].includes(x.label));
    if (forbiddenInA1.length || forbiddenInC1.length) throw new Error(`GATE_10_FAIL: Phát hiện nhãn cấm trong tập xóa của ${uc}.`);

    const dupA1 = new Set(a1Ids.map((x) => x.id)).size !== a1Ids.length;
    const dupC1 = new Set(c1Ids.map((x) => x.id)).size !== c1Ids.length;
    if (dupA1 || dupC1) throw new Error(`GATE_11_FAIL: Phát hiện ID trùng lặp trong tập xóa của ${uc}.`);

    const depIdsBySheet = {};
    for (const k of DEP_SHEET_KEYS) {
      const appDepSet = new Set((approved.dependentTemplateIdsBySheet?.[k] || []).map(norm));
      const matched = (u.depBySheet[k] || []).filter((x) => x.label === 'TEMPLATE_DEPENDENT' && appDepSet.has(norm(x.id)));
      if (new Set(matched.map((x) => x.id)).size !== matched.length) throw new Error(`GATE_11_FAIL: Trùng ID phụ thuộc ${uc}.${k}`);
      depIdsBySheet[k] = matched;
    }

    if (a1Ids.length + c1Ids.length + Object.values(depIdsBySheet).reduce((s, a) => s + a.length, 0) > 0) {
      plans.push({ unit: u, unitCode: uc, workbookId: u.workbookId, a1Delete: a1Ids, c1Delete: c1Ids, depDeleteBySheet: depIdsBySheet });
    }
  }
  return plans;
}

async function deleteExplicitIds(pgClient, table, unitCode, colExpr, ids) {
  if (!ids || ids.length === 0) return 0;
  const r = await pgClient.query(`DELETE FROM public.${table} WHERE UPPER(ma_don_vi) = $1 AND (${colExpr}) = ANY($2::text[])`, [unitCode, ids]);
  return r.rowCount || 0;
}

export async function executeProductionCleanup(pgClient, params) {
  const { classifiedUnits, approvedManifest, backupDir, actorEmail = 'tcns@hcmute.edu.vn', manifestId = 'approved-stage3-manifest' } = params;

  // Gate 0 (Bắt buộc trước backup/DELETE): Khóa SHA-256 2 tệp nguồn src/ mà executor đọc trực tiếp
  const sourceDependencyChecksums = verifySourceDependencyChecksums();

  // Gate 1 & 2: Xác nhận đúng database utevtvl_db và ghi nhận identity
  const idRow = (await pgClient.query(`SELECT current_database() AS db, current_user AS usr, inet_server_addr()::text AS addr, inet_server_port()::int AS port, NOW() AS ts`)).rows[0];
  if (idRow?.db !== 'utevtvl_db') {
    throw new Error(`GATE_01_FAIL: Đang kết nối database "${idRow?.db}", bắt buộc phải là "utevtvl_db". Dừng ngay.`);
  }
  const availBytes = checkDiskSpace(backupDir);

  // Gate 9, 10, 11: Xác thực tập ID tường minh
  const plans = validateDeleteSetAgainstGates(classifiedUnits, approvedManifest);
  if (plans.length === 0) throw new Error('GATE_11_FAIL: Tập kế hoạch xóa rỗng sau khi giao với Manifest phê duyệt.');
  const targetUnits = plans.map((p) => p.unitCode);
  const allDbUnits = (await pgClient.query(`SELECT DISTINCT UPPER(ma_don_vi) AS u FROM public.t_tien_do`)).rows.map((r) => r.u);
  const protectedUnits = allDbUnits.filter((u) => !targetUnits.includes(u));
  if (!protectedUnits.includes('TCNS')) throw new Error('GATE_09_FAIL: Không tìm thấy TCNS trong tập đơn vị bảo vệ.');

  // Gate 3, 4, 5, 7, 8: Consistent backup bundle + readback SHA-256 verification
  const backup = await createCleanupBackupBundle(pgClient, targetUnits, backupDir);
  const readbackRaw = fs.readFileSync(backup.backupPath, 'utf8');
  if (sha256(readbackRaw) !== backup.manifest.backupFileSha256) {
    throw new Error('GATE_08_FAIL: SHA-256 kiểm tra đọc lại backup không khớp.');
  }
  const protectedBefore = await computeDatabaseTableDigests(pgClient, protectedUnits);
  const tcnsBefore = await computeDatabaseTableDigests(pgClient, ['TCNS']);

  const unitReports = [];
  await pgClient.query('BEGIN');
  try {
    for (const plan of plans) {
      const uc = plan.unitCode;
      const wbRow = (await pgClient.query(`SELECT * FROM public.workbooks WHERE id = $1 LIMIT 1`, [plan.workbookId])).rows[0];
      if (!wbRow) throw new Error(`Không tìm thấy workbook ${plan.workbookId} trên utevtvl_db.`);
      const wbData = wbRow.data || {};
      const structBefore = captureWorkbookStructureSnapshot(wbData);

      // Gate 6: Chèn revision dự phòng trong transaction
      const preRevInfo = await insertPreCleanupWorkbookRevision(pgClient, uc, actorEmail);
      if (!preRevInfo) throw new Error(`GATE_06_FAIL: Không thể tạo revision dự phòng cho ${uc}.`);

      // Kiểm tra mỗi ID tồn tại đúng 1 lần trong JSONB
      const a1DelIdSet = new Set(plan.a1Delete.map((x) => norm(x.id)));
      const c1DelIdSet = new Set(plan.c1Delete.map((x) => norm(x.id)));
      const a1MatchCount = (wbData.A1 || []).filter((r) => a1DelIdSet.has(norm(r.id) || upper(r.maNhiemVu))).length;
      const c1MatchCount = (wbData.C1 || []).filter((r) => c1DelIdSet.has(norm(r.id) || upper(r.maVtvl))).length;
      if (a1MatchCount !== a1DelIdSet.size || c1MatchCount !== c1DelIdSet.size) {
        throw new Error(`GATE_11_FAIL: Số dòng khớp trong JSONB của ${uc} khác Manifest (A1 ${a1MatchCount}/${a1DelIdSet.size}, C1 ${c1MatchCount}/${c1DelIdSet.size}).`);
      }

      const nextData = { ...wbData };
      nextData.A1 = (wbData.A1 || []).filter((r) => !a1DelIdSet.has(norm(r.id) || upper(r.maNhiemVu)));
      nextData.C1 = (wbData.C1 || []).filter((r) => !c1DelIdSet.has(norm(r.id) || upper(r.maVtvl)));
      for (const k of DEP_SHEET_KEYS) {
        const depDelSet = new Set((plan.depDeleteBySheet[k] || []).map((x) => norm(x.id)));
        nextData[k] = (wbData[k] || []).filter((r) => !depDelSet.has(norm(r.id) || upper(r.maCongViec || r.maVtvl)));
      }
      const cleanedData = recalculateGridFormulas(nextData, uc, plan.unit.unitNameVi);
      assertWorkbookStructureUnchanged(structBefore, captureWorkbookStructureSnapshot(cleanedData), uc);

      const relBefore = buildWorkbookRelationalPayload({ id: wbRow.id, unitId: uc, unitNameVi: plan.unit.unitNameVi, reportingPeriod: wbRow.reporting_period, status: wbRow.status, currentRevision: wbRow.current_revision, data: wbData, touchedCells: wbRow.touched_cells || [] });
      const relAfter = buildWorkbookRelationalPayload({ id: wbRow.id, unitId: uc, unitNameVi: plan.unit.unitNameVi, reportingPeriod: wbRow.reporting_period, status: wbRow.status, currentRevision: wbRow.current_revision, data: cleanedData, touchedCells: wbRow.touched_cells || [] });
      const diffKeys = (beforeArr, afterArr) => { const s = new Set(afterArr); return beforeArr.filter((x) => !s.has(x)); };

      const delCounts = {
        b2_ct_tac_dong: await deleteExplicitIds(pgClient, 'b2_ct_tac_dong', uc, 'id_tac_dong', diffKeys(relBefore.activeKeys.b2_ct, relAfter.activeKeys.b2_ct)),
        b2_thay_doi: await deleteExplicitIds(pgClient, 'b2_thay_doi', uc, 'ma_cong_viec', diffKeys(relBefore.activeKeys.b2, relAfter.activeKeys.b2)),
        b1_khoi_luong: await deleteExplicitIds(pgClient, 'b1_khoi_luong', uc, 'ma_cong_viec', diffKeys(relBefore.activeKeys.b1, relAfter.activeKeys.b1)),
        can_cu_goi_y: await deleteExplicitIds(pgClient, 'can_cu_goi_y', uc, 'ma_cong_viec', diffKeys(relBefore.activeKeys.a2, relAfter.activeKeys.a2)),
        c2_nang_luc: await deleteExplicitIds(pgClient, 'c2_nang_luc', uc, 'ma_vtvl', diffKeys(relBefore.activeKeys.c2, relAfter.activeKeys.c2)),
        c3_nhu_cau: await deleteExplicitIds(pgClient, 'c3_nhu_cau', uc, 'ma_vtvl', diffKeys(relBefore.activeKeys.c3, relAfter.activeKeys.c3)),
        d1_nhan_luc: await deleteExplicitIds(pgClient, 'd1_nhan_luc', uc, 'ma_nguon_luc', diffKeys(relBefore.activeKeys.d1, relAfter.activeKeys.d1)),
        du_bao_5_nam: await deleteExplicitIds(pgClient, 'du_bao_5_nam', uc, `ma_vtvl || '::' || nam_du_bao::text`, diffKeys(relBefore.activeKeys.du_bao, relAfter.activeKeys.du_bao)),
        d2_phuong_an: await deleteExplicitIds(pgClient, 'd2_phuong_an', uc, `ma_vtvl || '::' || nam_phuong_an::text`, diffKeys(relBefore.activeKeys.d2, relAfter.activeKeys.d2)),
        a2_cong_viec: await deleteExplicitIds(pgClient, 'a2_cong_viec', uc, 'ma_cong_viec', diffKeys(relBefore.activeKeys.a2, relAfter.activeKeys.a2)),
        a1_nhiem_vu: await deleteExplicitIds(pgClient, 'a1_nhiem_vu', uc, 'ma_nhiem_vu', plan.a1Delete.map((x) => x.code)),
        c1_vtvl: await deleteExplicitIds(pgClient, 'c1_vtvl', uc, 'ma_vtvl', plan.c1Delete.map((x) => x.code))
      };

      for (const c3 of relAfter.c3_nhu_cau) {
        await pgClient.query(`INSERT INTO public.c3_nhu_cau (ma_vtvl, ma_don_vi, phuong_phap, gio_b1_nam, gio_tac_dong_b2, gio_rong_nam, gio_chuan_pp2, nguoi_quy_doi_pp2, nguoi_dinh_bien_pp1, nguoi_can_bo_tri, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()) ON CONFLICT (ma_vtvl) DO UPDATE SET phuong_phap=EXCLUDED.phuong_phap, gio_b1_nam=EXCLUDED.gio_b1_nam, gio_tac_dong_b2=EXCLUDED.gio_tac_dong_b2, gio_rong_nam=EXCLUDED.gio_rong_nam, gio_chuan_pp2=EXCLUDED.gio_chuan_pp2, nguoi_quy_doi_pp2=EXCLUDED.nguoi_quy_doi_pp2, nguoi_dinh_bien_pp1=EXCLUDED.nguoi_dinh_bien_pp1, nguoi_can_bo_tri=EXCLUDED.nguoi_can_bo_tri, updated_at=NOW()`, [c3.ma_vtvl, uc, c3.phuong_phap, c3.gio_b1_nam, c3.gio_tac_dong_b2, c3.gio_rong_nam, c3.gio_chuan_pp2, c3.nguoi_quy_doi_pp2, c3.nguoi_dinh_bien_pp1, c3.nguoi_can_bo_tri]);
      }
      for (const k of relAfter.k_kiem_tra) {
        await pgClient.query(`INSERT INTO public.k_kiem_tra (ma_don_vi, stt_chi_tieu, nhom_bieu_doi_soat, noi_dung_kiem_tra, so_dong_loi, ket_luan, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT (ma_don_vi, stt_chi_tieu) DO UPDATE SET so_dong_loi = EXCLUDED.so_dong_loi, ket_luan = EXCLUDED.ket_luan, updated_at = NOW()`, [uc, k.stt_chi_tieu, k.nhom_bieu_doi_soat, k.noi_dung_kiem_tra, k.so_dong_loi, k.ket_luan]);
      }

      const nextRev = Math.max(Number(wbRow.current_revision || 1), preRevInfo.preCleanupRevision) + 1;
      await pgClient.query(`UPDATE public.workbooks SET data = $1::jsonb, current_revision = $2, updated_at = NOW() WHERE id = $3`, [JSON.stringify(cleanedData), nextRev, wbRow.id]);
      const tdRow = (await pgClient.query(`SELECT du_lieu_ho_so_json FROM public.t_tien_do WHERE UPPER(ma_don_vi) = $1`, [uc])).rows[0];
      const nextTdJson = { ...(tdRow?.du_lieu_ho_so_json || {}), serverWorkbook: { ...(tdRow?.du_lieu_ho_so_json?.serverWorkbook || wbRow), currentRevision: nextRev, data: cleanedData } };
      await pgClient.query(`UPDATE public.t_tien_do SET so_nhiem_vu_a1 = $1, so_cong_viec_a2 = $2, so_vtvl_c1 = $3, tong_fte_c3 = $4, du_lieu_ho_so_json = $5::jsonb, updated_at = NOW() WHERE UPPER(ma_don_vi) = $6`, [cleanedData.A1.length, cleanedData.A2.length, cleanedData.C1.length, cleanedData.T?.[0]?.tongFte || 0, JSON.stringify(nextTdJson), uc]);

      // Hậu kiểm trong transaction: K1, K2, K5, K6 = 0 & JSONB khớp bảng quan hệ
      const kErr = (await pgClient.query(`SELECT stt_chi_tieu FROM public.k_kiem_tra WHERE UPPER(ma_don_vi) = $1 AND stt_chi_tieu IN (1,2,5,6) AND so_dong_loi > 0`, [uc])).rows;
      if (kErr.length > 0) throw new Error(`AUTO_ROLLBACK: ${uc} phát sinh lỗi K${kErr.map((x) => x.stt_chi_tieu).join(',K')}`);
      const relA1Now = (await pgClient.query(`SELECT COUNT(*)::int AS c FROM public.a1_nhiem_vu WHERE UPPER(ma_don_vi) = $1`, [uc])).rows[0].c;
      const relC1Now = (await pgClient.query(`SELECT COUNT(*)::int AS c FROM public.c1_vtvl WHERE UPPER(ma_don_vi) = $1`, [uc])).rows[0].c;
      if (relA1Now !== cleanedData.A1.length || relC1Now !== cleanedData.C1.length) {
        throw new Error(`AUTO_ROLLBACK: JSONB (${cleanedData.A1.length}/${cleanedData.C1.length}) lệch bảng quan hệ (${relA1Now}/${relC1Now}) tại ${uc}`);
      }

      const auditEntry = buildCleanupAuditLogEntry({
        unitCode: uc, workbookId: wbRow.id, revBefore: wbRow.current_revision, revAfter: nextRev,
        a1Cleaned: plan.a1Delete.length, c1Cleaned: plan.c1Delete.length, dependentCleanedByTable: delCounts,
        actorEmail, backupId: backup.backupId, manifestId
      });
      await pgClient.query(
        `INSERT INTO public.audit_logs (unit_id, workbook_id, actor_email, actor_role, action, sheet_id, target_entity, target_id, new_values) VALUES ($1,$2,$3,'admin',$4,'A1_C1','workbook',$5,$6::jsonb)`,
        [uc, wbRow.id, actorEmail, auditEntry.action, wbRow.id, JSON.stringify(auditEntry)]
      );
      unitReports.push({ unitCode: uc, workbookId: wbRow.id, revBefore: wbRow.current_revision, preCleanupRevision: preRevInfo.preCleanupRevision, revAfter: nextRev, a1DeletedIds: plan.a1Delete, c1DeletedIds: plan.c1Delete, relDeletedCounts: delCounts, a1After: cleanedData.A1.length, c1After: cleanedData.C1.length, structureGuardPassed: true });
    }

    // Xác minh TCNS & mọi đơn vị ngoài Manifest không hề thay đổi trước khi COMMIT
    const protectedAfter = await computeDatabaseTableDigests(pgClient, protectedUnits);
    const tcnsAfter = await computeDatabaseTableDigests(pgClient, ['TCNS']);
    if (protectedAfter.semanticOverallSha256 !== protectedBefore.semanticOverallSha256 || tcnsAfter.fullOverallSha256 !== tcnsBefore.fullOverallSha256) {
      throw new Error('AUTO_ROLLBACK: Phát hiện thay đổi trên TCNS hoặc đơn vị ngoài Manifest!');
    }
    await pgClient.query('COMMIT');
    const deletedRows = {
      unitsCleaned: unitReports.length,
      a1: unitReports.reduce((s, r) => s + r.a1DeletedIds.length, 0),
      c1: unitReports.reduce((s, r) => s + r.c1DeletedIds.length, 0),
      relationalByTable: unitReports.reduce((acc, r) => {
        for (const [k, v] of Object.entries(r.relDeletedCounts || {})) acc[k] = (acc[k] || 0) + Number(v || 0);
        return acc;
      }, {})
    };
    return {
      status: 'success', committed: true, gateResult: '12/12 PASS', rollbackRequired: false,
      deletedRows, sourceDependencyChecksums, dbIdentity: idRow, backupId: backup.backupId, backupPath: backup.backupPath,
      manifestPath: backup.manifestPath, backupSha256: backup.manifest.backupFileSha256,
      availBackupBytes: availBytes, tcnsBeforeSha256: tcnsBefore.fullOverallSha256, tcnsAfterSha256: tcnsAfter.fullOverallSha256,
      protectedUnitsVerified: protectedUnits, unitReports
    };
  } catch (err) {
    await pgClient.query('ROLLBACK');
    throw err;
  }
}
