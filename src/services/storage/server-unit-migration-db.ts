import { StaffWorkTicket, UserVtvlAssignment, WorkRelationshipItem, WorkSurveyVersion, toCanonicalStatus } from '@/types/staff-ticket';
import { HcmuteUnit } from '@/types/vtvl';
import { getDbTestHook, getPgPool, isDatabaseConfigured, withPgTransaction } from './prisma';
import { isIsolatedLocalMode } from './server-ticket-db';

export interface UnitMigrationDbPayload {
  oldCode: string;
  newCode: string;
  newNameVi?: string;
  targetUnitMeta?: Partial<HcmuteUnit>;
  ticketsToPersist: StaffWorkTicket[];
  assignmentsToPersist: UserVtvlAssignment[];
  relationshipsToPersist: WorkRelationshipItem[];
  oldRelationshipIdsToDelete: string[];
  versionsToPersist: WorkSurveyVersion[];
  simulateTxFailure?: boolean;
}

function buildSimulatedTxError(): Error {
  return Object.assign(
    new Error('SIMULATED_TX_FAILURE: Giao dịch chuyển mã đơn vị bị hủy giữa chừng, đã rollback toàn bộ dữ liệu.'),
    { code: 'SIMULATED_TX_FAILURE', status: 500 }
  );
}

function mapTicketToDbRow(t: StaffWorkTicket) {
  return {
    id: t.id,
    unit_code: t.unitCode,
    unit_id: t.unitId || t.unitCode,
    owner_email: t.ownerEmail,
    owner_name: t.ownerName,
    owner_title: t.ownerTitle,
    status: toCanonicalStatus(t.status),
    ma_nhiem_vu: t.maNhiemVu,
    ma_cong_viec: t.maCongViec,
    ten_cong_viec: t.tenCongViec,
    ma_vtvl: t.maVtvl,
    ma_vtvl_phoi_hop: t.maVtvlPhoiHop || '',
    coordinated_vtvls: t.coordinatedVtvls || [],
    coordinated_tasks: t.coordinatedTasks || [],
    updated_at: t.updatedAt
  };
}

function mapRelToDbRow(r: WorkRelationshipItem) {
  return {
    id: r.id,
    source_survey_id: r.sourceSurveyId,
    source_task_code: r.sourceTaskCode,
    source_task_name: r.sourceTaskName,
    source_mission_code: r.sourceMissionCode,
    host_unit_code: r.hostUnitCode,
    host_unit_name: r.hostUnitName,
    host_vtvl_code: r.hostVtvlCode,
    host_vtvl_name: r.hostVtvlName || '',
    target_unit_code: r.targetUnitCode,
    target_unit_name: r.targetUnitName,
    target_vtvl_code: r.targetVtvlCode,
    target_vtvl_name: r.targetVtvlName || '',
    coordination_note: r.coordinationNote || '',
    san_pham: r.sanPham || '',
    target_survey_id: r.targetDeclaredTicketId || null,
    target_task_code: r.targetDeclaredTicketCode || null,
    host_leader_approved: r.hostLeaderApproved,
    host_approved_by: r.hostApprovedBy || null,
    host_approved_at: r.hostApprovedAt || null,
    target_leader_approved: r.targetLeaderApproved,
    target_approved_by: r.targetApprovedBy || null,
    target_approved_at: r.targetApprovedAt || null,
    tcns_approved: r.tcnsApproved,
    tcns_approved_by: r.tcnsApprovedBy || null,
    tcns_approved_at: r.tcnsApprovedAt || null,
    relationship_status: r.approvalLevel,
    updated_at: r.updatedAt
  };
}

async function runViaTestHook(payload: UnitMigrationDbPayload): Promise<void> {
  const hook = getDbTestHook();
  if (!hook) return;
  if (hook.upsert) {
    if (payload.ticketsToPersist.length > 0) {
      const res = await hook.upsert('staff_work_tickets', payload.ticketsToPersist.map(mapTicketToDbRow), 'id');
      if (!res.ok) throw Object.assign(new Error(res.error || 'DB_TICKETS_TX_FAILED'), { code: 'DB_TX_FAILED', status: 500 });
    }
    if (payload.assignmentsToPersist.length > 0) {
      const rows = payload.assignmentsToPersist.map((a) => ({
        id: a.id, user_email: a.userEmail, unit_code: a.unitCode, ma_vtvl: a.maVtvl,
        ten_vtvl: a.tenVtvl || null, is_active: a.isActive, assigned_by: a.assignedBy || null, updated_at: a.updatedAt
      }));
      const res = await hook.upsert('user_vtvl_assignments', rows, 'user_email,unit_code,ma_vtvl');
      if (!res.ok) throw Object.assign(new Error(res.error || 'DB_ASSIGNMENTS_TX_FAILED'), { code: 'DB_TX_FAILED', status: 500 });
    }
    if (payload.relationshipsToPersist.length > 0) {
      const res = await hook.upsert('work_relationships', payload.relationshipsToPersist.map(mapRelToDbRow), 'id');
      if (!res.ok) throw Object.assign(new Error(res.error || 'DB_REL_TX_FAILED'), { code: 'DB_TX_FAILED', status: 500 });
    }
    if (payload.versionsToPersist.length > 0) {
      const rows = payload.versionsToPersist.map((v) => ({
        survey_id: v.surveyId, version_no: v.versionNo, snapshot: v.snapshot, submitted_by: v.submittedBy, submitted_at: v.submittedAt || null
      }));
      const res = await hook.upsert('work_survey_versions', rows, 'survey_id,version_no');
      if (!res.ok) throw Object.assign(new Error(res.error || 'DB_VERSIONS_TX_FAILED'), { code: 'DB_TX_FAILED', status: 500 });
    }
  }
  if (payload.simulateTxFailure) throw buildSimulatedTxError();
}

export async function executeUnitMigrationDbTransaction(payload: UnitMigrationDbPayload): Promise<boolean> {
  const { oldCode, newCode } = payload;
  if (getDbTestHook()) {
    await runViaTestHook(payload);
    return true;
  }
  if (isIsolatedLocalMode() || !isDatabaseConfigured() || !getPgPool()) {
    if (payload.simulateTxFailure) throw buildSimulatedTxError();
    return false;
  }

  const meta = payload.targetUnitMeta;
  const nameVi = (payload.newNameVi || meta?.nameVi || newCode).trim();
  const nameEn = (meta?.nameEn || nameVi).trim();

  await withPgTransaction(async (client) => {
    // 1. Bảo đảm mã đơn vị mới tồn tại và đang hoạt động trong bảng danh mục dm_don_vi trước khi cập nhật khóa ngoại
    await client.query(
      `INSERT INTO public.dm_don_vi (
         ma_don_vi, ten_don_vi_vi, ten_don_vi_en, khoi_don_vi, linh_vuc,
         chuc_danh_thu_truong_vi, chuc_danh_thu_truong_en, so_nhan_su_mac_dinh, is_active, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now())
       ON CONFLICT (ma_don_vi) DO UPDATE SET
         ten_don_vi_vi = EXCLUDED.ten_don_vi_vi, ten_don_vi_en = EXCLUDED.ten_don_vi_en,
         is_active = true, updated_at = now()`,
      [
        newCode, nameVi, nameEn, meta?.group || 'phong-ban', meta?.domain || null,
        meta?.headTitleVi || 'Trưởng đơn vị', meta?.headTitleEn || 'Head of Department',
        Math.max(1, Number(meta?.defaultStaffCount) || 10)
      ]
    );

    // 2. Đồng bộ tài khoản thuộc đơn vị cũ sang mã mới
    await client.query(
      `UPDATE public.user_accounts
       SET unit_code = $2, unit_id = $2, unit_name_vi = COALESCE(NULLIF($3, ''), unit_name_vi), updated_at = now()
       WHERE UPPER(unit_code) = $1 OR UPPER(COALESCE(unit_id, '')) = $1`,
      [oldCode, newCode, nameVi]
    );

    // 3. Cập nhật phiếu công việc (cả phiếu trực thuộc đơn vị cũ và phiếu phối hợp trỏ tới đơn vị cũ)
    for (const t of payload.ticketsToPersist) {
      await client.query(
        `UPDATE public.staff_work_tickets
         SET unit_code = $1, unit_id = $2, ma_nhiem_vu = $3, ma_cong_viec = $4,
             ma_vtvl = $5, ma_vtvl_phoi_hop = $6, coordinated_vtvls = $7::jsonb,
             coordinated_tasks = $8::jsonb, updated_at = $9::timestamptz
         WHERE id = $10`,
        [
          t.unitCode, t.unitId || t.unitCode, t.maNhiemVu, t.maCongViec,
          t.maVtvl, t.maVtvlPhoiHop || '', JSON.stringify(t.coordinatedVtvls || []),
          JSON.stringify(t.coordinatedTasks || []), t.updatedAt, t.id
        ]
      );
    }

    // 4. Cập nhật phân công VTVL (loại bỏ trùng trước khi đổi mã)
    await client.query(`DELETE FROM public.user_vtvl_assignments WHERE UPPER(unit_code) = $1`, [oldCode]);
    for (const a of payload.assignmentsToPersist) {
      await client.query(
        `INSERT INTO public.user_vtvl_assignments (user_email, unit_code, ma_vtvl, ten_vtvl, is_active, assigned_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)
         ON CONFLICT (user_email, unit_code, ma_vtvl) DO UPDATE SET
           ten_vtvl = COALESCE(EXCLUDED.ten_vtvl, user_vtvl_assignments.ten_vtvl),
           is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at`,
        [a.userEmail, a.unitCode, a.maVtvl, a.tenVtvl || null, a.isActive, a.assignedBy || null, a.createdAt, a.updatedAt]
      );
    }

    // 5. Cập nhật quan hệ công việc (work_relationships)
    if (payload.oldRelationshipIdsToDelete.length > 0) {
      await client.query(`DELETE FROM public.work_relationships WHERE id = ANY($1::text[])`, [payload.oldRelationshipIdsToDelete]);
    }
    for (const r of payload.relationshipsToPersist) {
      const dbRow = mapRelToDbRow(r);
      await client.query(
        `INSERT INTO public.work_relationships (
           id, source_survey_id, source_task_code, source_task_name, source_mission_code,
           host_unit_code, host_unit_name, host_vtvl_code, host_vtvl_name,
           target_unit_code, target_unit_name, target_vtvl_code, target_vtvl_name,
           coordination_note, san_pham, target_survey_id, target_task_code,
           host_leader_approved, host_approved_by, host_approved_at,
           target_leader_approved, target_approved_by, target_approved_at,
           tcns_approved, tcns_approved_by, tcns_approved_at, relationship_status, updated_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::timestamptz,$21,$22,$23::timestamptz,$24,$25,$26::timestamptz,$27,$28::timestamptz
         )
         ON CONFLICT (id) DO UPDATE SET
           source_task_code = EXCLUDED.source_task_code, source_mission_code = EXCLUDED.source_mission_code,
           host_unit_code = EXCLUDED.host_unit_code, host_unit_name = EXCLUDED.host_unit_name, host_vtvl_code = EXCLUDED.host_vtvl_code,
           target_unit_code = EXCLUDED.target_unit_code, target_unit_name = EXCLUDED.target_unit_name, target_vtvl_code = EXCLUDED.target_vtvl_code,
           target_task_code = EXCLUDED.target_task_code, updated_at = EXCLUDED.updated_at`,
        [
          dbRow.id, dbRow.source_survey_id, dbRow.source_task_code, dbRow.source_task_name, dbRow.source_mission_code,
          dbRow.host_unit_code, dbRow.host_unit_name, dbRow.host_vtvl_code, dbRow.host_vtvl_name,
          dbRow.target_unit_code, dbRow.target_unit_name, dbRow.target_vtvl_code, dbRow.target_vtvl_name,
          dbRow.coordination_note, dbRow.san_pham, dbRow.target_survey_id, dbRow.target_task_code,
          dbRow.host_leader_approved, dbRow.host_approved_by, dbRow.host_approved_at,
          dbRow.target_leader_approved, dbRow.target_approved_by, dbRow.target_approved_at,
          dbRow.tcns_approved, dbRow.tcns_approved_by, dbRow.tcns_approved_at, dbRow.relationship_status, dbRow.updated_at
        ]
      );
    }

    // 6. Đồng bộ bảng phối hợp VTVL, phiên bản snapshot, lịch sử trạng thái và bảng legacy coordinated_tasks
    await client.query(
      `UPDATE public.work_survey_coordinated_vtvls
       SET host_unit_code = CASE WHEN UPPER(host_unit_code) = $1 THEN $2 ELSE host_unit_code END,
           target_unit_code = CASE WHEN UPPER(target_unit_code) = $1 THEN $2 ELSE target_unit_code END,
           target_vtvl_code = CASE
             WHEN UPPER(target_unit_code) = $1 AND UPPER(target_vtvl_code) LIKE $1 || '.%' THEN $2 || '.' || substring(target_vtvl_code from length($1) + 2)
             WHEN UPPER(target_unit_code) = $1 AND UPPER(target_vtvl_code) LIKE $1 || '-%' THEN $2 || '-' || substring(target_vtvl_code from length($1) + 2)
             ELSE target_vtvl_code
           END
       WHERE UPPER(host_unit_code) = $1 OR UPPER(target_unit_code) = $1`,
      [oldCode, newCode]
    );
    for (const v of payload.versionsToPersist) {
      await client.query(
        `UPDATE public.work_survey_versions SET snapshot = $1::jsonb WHERE survey_id = $2 AND version_no = $3`,
        [JSON.stringify(v.snapshot), v.surveyId, v.versionNo]
      );
    }
    await client.query(`UPDATE public.work_survey_status_history SET unit_id = $2 WHERE UPPER(unit_id) = $1`, [oldCode, newCode]);
    await client.query(
      `UPDATE public.coordinated_tasks
       SET unit_code = CASE WHEN UPPER(unit_code) = $1 THEN $2 ELSE unit_code END,
           target_unit_code = CASE WHEN UPPER(target_unit_code) = $1 THEN $2 ELSE target_unit_code END,
           target_task_code = CASE
             WHEN UPPER(target_unit_code) = $1 AND UPPER(target_task_code) LIKE $1 || '.%' THEN $2 || '.' || substring(target_task_code from length($1) + 2)
             ELSE target_task_code
           END
       WHERE UPPER(unit_code) = $1 OR UPPER(target_unit_code) = $1`,
      [oldCode, newCode]
    );

    if (payload.simulateTxFailure) {
      throw buildSimulatedTxError();
    }
  });

  return true;
}
