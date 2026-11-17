-- ==============================================================================
-- HCM-UTE VTVL 360: Chuẩn hóa bảng Mối quan hệ công việc, Khóa ngoại staff_work_tickets
-- và RPC Giao dịch nguyên tử (Atomic Transaction) đồng bộ Snapshot + Bảng quan hệ
-- Trình tự chuẩn: Preflight -> Backup/Audit -> Backfill -> Constraints/RLS -> RPC -> Validate
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- PHASE 0: PREFLIGHT ASSERTIONS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dm_don_vi') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.dm_don_vi chưa tồn tại.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_accounts') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.user_accounts chưa tồn tại.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_work_tickets') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.staff_work_tickets chưa tồn tại.';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- PHASE 1: BẢNG SAO LƯU DỮ LIỆU & TRẠNG THÁI RLS TRƯỚC KHI CHỈNH SỬA
-- Bảo toàn 100% giá trị gốc trước khi chuẩn hóa email về NULL hoặc xử lý bản ghi mồ côi
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.migration_20261116210000_data_backup (
  backup_id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  old_data JSONB NOT NULL,
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mig_20261116210000_backup UNIQUE (table_name, record_id, action_taken)
);

ALTER TABLE public.migration_20261116210000_data_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_20261116210000_data_backup FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.migration_20261116210000_data_backup FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.migration_20261116210000_data_backup TO service_role;

DROP POLICY IF EXISTS "service_role_full_mig_20261116210000_backup" ON public.migration_20261116210000_data_backup;
CREATE POLICY "service_role_full_mig_20261116210000_backup" ON public.migration_20261116210000_data_backup
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Snapshot trạng thái RLS và các policy hiện có trên public.work_relationships (nếu bảng đã tồn tại trước đó)
DO $$
DECLARE
  v_table_existed BOOLEAN;
  v_rls_enabled BOOLEAN := FALSE;
  v_rls_forced BOOLEAN := FALSE;
  rec RECORD;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_relationships'
  ) INTO v_table_existed;

  IF v_table_existed THEN
    SELECT c.relrowsecurity, c.relforcerowsecurity
    INTO v_rls_enabled, v_rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'work_relationships';

    INSERT INTO public.migration_20261116210000_data_backup (table_name, record_id, action_taken, old_data)
    VALUES (
      'rls_table_flags',
      'public.work_relationships',
      'SNAPSHOT_RLS_FLAGS',
      jsonb_build_object('table_existed', TRUE, 'relrowsecurity', v_rls_enabled, 'relforcerowsecurity', v_rls_forced)
    )
    ON CONFLICT (table_name, record_id, action_taken) DO NOTHING;

    FOR rec IN
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'work_relationships'
    LOOP
      INSERT INTO public.migration_20261116210000_data_backup (table_name, record_id, action_taken, old_data)
      VALUES (
        'rls_policy_snapshot',
        rec.policyname,
        'SNAPSHOT_RLS_POLICY',
        jsonb_build_object(
          'policyname', rec.policyname,
          'permissive', rec.permissive,
          'roles', to_jsonb(rec.roles),
          'cmd', rec.cmd,
          'qual', rec.qual,
          'with_check', rec.with_check
        )
      )
      ON CONFLICT (table_name, record_id, action_taken) DO NOTHING;
    END LOOP;
  ELSE
    INSERT INTO public.migration_20261116210000_data_backup (table_name, record_id, action_taken, old_data)
    VALUES (
      'rls_table_flags',
      'public.work_relationships',
      'SNAPSHOT_RLS_FLAGS',
      jsonb_build_object('table_existed', FALSE, 'relrowsecurity', TRUE, 'relforcerowsecurity', TRUE)
    )
    ON CONFLICT (table_name, record_id, action_taken) DO NOTHING;
  END IF;
END $$;

-- Tạo bảng public.work_relationships (nếu chưa có)
CREATE TABLE IF NOT EXISTS public.work_relationships (
  id TEXT PRIMARY KEY,
  source_survey_id TEXT NOT NULL,
  source_task_code TEXT NOT NULL,
  source_task_name TEXT NOT NULL,
  source_mission_code TEXT DEFAULT '',
  host_unit_code TEXT NOT NULL,
  host_unit_name TEXT DEFAULT '',
  host_vtvl_code TEXT NOT NULL,
  host_vtvl_name TEXT DEFAULT '',
  target_unit_code TEXT NOT NULL,
  target_unit_name TEXT DEFAULT '',
  target_vtvl_code TEXT NOT NULL,
  target_vtvl_name TEXT DEFAULT '',
  coordination_note TEXT DEFAULT '',
  san_pham TEXT DEFAULT '',
  target_survey_id TEXT DEFAULT NULL,
  target_task_code TEXT DEFAULT NULL,
  host_leader_approved BOOLEAN NOT NULL DEFAULT FALSE,
  host_approved_by TEXT DEFAULT NULL,
  host_approved_at TIMESTAMPTZ DEFAULT NULL,
  target_leader_approved BOOLEAN NOT NULL DEFAULT FALSE,
  target_approved_by TEXT DEFAULT NULL,
  target_approved_at TIMESTAMPTZ DEFAULT NULL,
  tcns_approved BOOLEAN NOT NULL DEFAULT FALSE,
  tcns_approved_by TEXT DEFAULT NULL,
  tcns_approved_at TIMESTAMPTZ DEFAULT NULL,
  relationship_status TEXT NOT NULL DEFAULT 'unapproved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_relationships_units
  ON public.work_relationships (host_unit_code, target_unit_code);

CREATE INDEX IF NOT EXISTS idx_work_relationships_target_vtvl
  ON public.work_relationships (target_unit_code, target_vtvl_code);

-- ------------------------------------------------------------------------------
-- PHASE 2: SAO LƯU & LÀM SẠCH EMAIL TÁC NHÂN TRÊN staff_work_tickets
-- ------------------------------------------------------------------------------
INSERT INTO public.migration_20261116210000_data_backup (table_name, record_id, action_taken, old_data)
SELECT
  'staff_work_tickets',
  t.id,
  'BACKUP_ACTOR_EMAILS',
  jsonb_build_object(
    'id', t.id,
    'approved_by', t.approved_by,
    'revision_requested_by', t.revision_requested_by,
    'merged_by', t.merged_by
  )
FROM public.staff_work_tickets t
WHERE
  (t.approved_by IS NOT NULL AND (
    btrim(t.approved_by) = ''
    OR NOT EXISTS (SELECT 1 FROM public.user_accounts ua WHERE lower(ua.email) = lower(btrim(t.approved_by)))
    OR EXISTS (SELECT 1 FROM public.user_accounts ua WHERE lower(ua.email) = lower(btrim(t.approved_by)) AND ua.email <> t.approved_by)
  ))
  OR (t.revision_requested_by IS NOT NULL AND (
    btrim(t.revision_requested_by) = ''
    OR NOT EXISTS (SELECT 1 FROM public.user_accounts ua WHERE lower(ua.email) = lower(btrim(t.revision_requested_by)))
    OR EXISTS (SELECT 1 FROM public.user_accounts ua WHERE lower(ua.email) = lower(btrim(t.revision_requested_by)) AND ua.email <> t.revision_requested_by)
  ))
  OR (t.merged_by IS NOT NULL AND (
    btrim(t.merged_by) = ''
    OR NOT EXISTS (SELECT 1 FROM public.user_accounts ua WHERE lower(ua.email) = lower(btrim(t.merged_by)))
    OR EXISTS (SELECT 1 FROM public.user_accounts ua WHERE lower(ua.email) = lower(btrim(t.merged_by)) AND ua.email <> t.merged_by)
  ))
ON CONFLICT (table_name, record_id, action_taken) DO NOTHING;

-- Chuẩn hóa chữ hoa/thường theo đúng user_accounts.email trước
UPDATE public.staff_work_tickets t
SET approved_by = ua.email
FROM public.user_accounts ua
WHERE t.approved_by IS NOT NULL
  AND lower(btrim(t.approved_by)) = lower(ua.email)
  AND t.approved_by <> ua.email;

UPDATE public.staff_work_tickets t
SET revision_requested_by = ua.email
FROM public.user_accounts ua
WHERE t.revision_requested_by IS NOT NULL
  AND lower(btrim(t.revision_requested_by)) = lower(ua.email)
  AND t.revision_requested_by <> ua.email;

UPDATE public.staff_work_tickets t
SET merged_by = ua.email
FROM public.user_accounts ua
WHERE t.merged_by IS NOT NULL
  AND lower(btrim(t.merged_by)) = lower(ua.email)
  AND t.merged_by <> ua.email;

-- Đưa các giá trị rỗng hoặc email mồ côi không tồn tại trong user_accounts về NULL (đã lưu bản gốc ở trên)
UPDATE public.staff_work_tickets
SET approved_by = NULL
WHERE approved_by IS NOT NULL
  AND (
    btrim(approved_by) = ''
    OR NOT EXISTS (SELECT 1 FROM public.user_accounts ua WHERE ua.email = public.staff_work_tickets.approved_by)
  );

UPDATE public.staff_work_tickets
SET revision_requested_by = NULL
WHERE revision_requested_by IS NOT NULL
  AND (
    btrim(revision_requested_by) = ''
    OR NOT EXISTS (SELECT 1 FROM public.user_accounts ua WHERE ua.email = public.staff_work_tickets.revision_requested_by)
  );

UPDATE public.staff_work_tickets
SET merged_by = NULL
WHERE merged_by IS NOT NULL
  AND (
    btrim(merged_by) = ''
    OR NOT EXISTS (SELECT 1 FROM public.user_accounts ua WHERE ua.email = public.staff_work_tickets.merged_by)
  );

-- ------------------------------------------------------------------------------
-- PHASE 3: BACKFILL work_relationships TỪ JSONB (t_tien_do & staff_work_tickets)
-- Giữ nguyên ID và trạng thái phê duyệt, chạy lại nhiều lần không tạo bản ghi trùng
-- ------------------------------------------------------------------------------

-- 3.1. Backfill từ snapshot JSONB trong t_tien_do (ma_don_vi = 'TCNS', du_lieu_ho_so_json->'workRelationships')
DO $$
DECLARE
  v_json JSONB;
  v_item JSONB;
  v_id TEXT;
  v_src_id TEXT;
  v_tgt_id TEXT;
  v_host_unit TEXT;
  v_target_unit TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_tien_do') THEN
    SELECT du_lieu_ho_so_json -> 'workRelationships'
    INTO v_json
    FROM public.t_tien_do
    WHERE ma_don_vi = 'TCNS'
    LIMIT 1;

    IF v_json IS NOT NULL AND jsonb_typeof(v_json) = 'array' THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_json)
      LOOP
        v_id := btrim(COALESCE(v_item->>'id', ''));
        v_src_id := btrim(COALESCE(v_item->>'sourceSurveyId', v_item->>'source_survey_id', ''));
        v_tgt_id := NULLIF(btrim(COALESCE(v_item->>'targetDeclaredTicketId', v_item->>'target_survey_id', '')), '');
        v_host_unit := upper(btrim(COALESCE(v_item->>'hostUnitCode', v_item->>'host_unit_code', '')));
        v_target_unit := upper(btrim(COALESCE(v_item->>'targetUnitCode', v_item->>'target_unit_code', '')));

        IF v_id <> ''
           AND EXISTS (SELECT 1 FROM public.staff_work_tickets t WHERE t.id = v_src_id)
           AND EXISTS (SELECT 1 FROM public.dm_don_vi d WHERE d.ma_don_vi = v_host_unit)
           AND EXISTS (SELECT 1 FROM public.dm_don_vi d WHERE d.ma_don_vi = v_target_unit)
        THEN
          IF v_tgt_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.staff_work_tickets t WHERE t.id = v_tgt_id) THEN
            v_tgt_id := NULL;
          END IF;

          INSERT INTO public.work_relationships (
            id, source_survey_id, source_task_code, source_task_name, source_mission_code,
            host_unit_code, host_unit_name, host_vtvl_code, host_vtvl_name,
            target_unit_code, target_unit_name, target_vtvl_code, target_vtvl_name,
            coordination_note, san_pham, target_survey_id, target_task_code,
            host_leader_approved, host_approved_by, host_approved_at,
            target_leader_approved, target_approved_by, target_approved_at,
            tcns_approved, tcns_approved_by, tcns_approved_at,
            relationship_status, updated_at
          ) VALUES (
            v_id,
            v_src_id,
            COALESCE(v_item->>'sourceTaskCode', v_item->>'source_task_code', ''),
            COALESCE(v_item->>'sourceTaskName', v_item->>'source_task_name', ''),
            COALESCE(v_item->>'sourceMissionCode', v_item->>'source_mission_code', ''),
            v_host_unit,
            COALESCE(v_item->>'hostUnitName', v_item->>'host_unit_name', ''),
            COALESCE(v_item->>'hostVtvlCode', v_item->>'host_vtvl_code', ''),
            COALESCE(v_item->>'hostVtvlName', v_item->>'host_vtvl_name', ''),
            v_target_unit,
            COALESCE(v_item->>'targetUnitName', v_item->>'target_unit_name', ''),
            COALESCE(v_item->>'targetVtvlCode', v_item->>'target_vtvl_code', ''),
            COALESCE(v_item->>'targetVtvlName', v_item->>'target_vtvl_name', ''),
            COALESCE(v_item->>'coordinationNote', v_item->>'coordination_note', ''),
            COALESCE(v_item->>'sanPham', v_item->>'san_pham', ''),
            v_tgt_id,
            NULLIF(COALESCE(v_item->>'targetDeclaredTicketCode', v_item->>'target_task_code', ''), ''),
            COALESCE((v_item->>'hostLeaderApproved')::boolean, (v_item->>'host_leader_approved')::boolean, FALSE),
            NULLIF(COALESCE(v_item->>'hostApprovedBy', v_item->>'host_approved_by', ''), ''),
            CASE WHEN NULLIF(COALESCE(v_item->>'hostApprovedAt', v_item->>'host_approved_at', ''), '') IS NOT NULL
                 THEN (COALESCE(v_item->>'hostApprovedAt', v_item->>'host_approved_at'))::timestamptz ELSE NULL END,
            COALESCE((v_item->>'targetLeaderApproved')::boolean, (v_item->>'target_leader_approved')::boolean, FALSE),
            NULLIF(COALESCE(v_item->>'targetApprovedBy', v_item->>'target_approved_by', ''), ''),
            CASE WHEN NULLIF(COALESCE(v_item->>'targetApprovedAt', v_item->>'target_approved_at', ''), '') IS NOT NULL
                 THEN (COALESCE(v_item->>'targetApprovedAt', v_item->>'target_approved_at'))::timestamptz ELSE NULL END,
            COALESCE((v_item->>'tcnsApproved')::boolean, (v_item->>'tcns_approved')::boolean, FALSE),
            NULLIF(COALESCE(v_item->>'tcnsApprovedBy', v_item->>'tcns_approved_by', ''), ''),
            CASE WHEN NULLIF(COALESCE(v_item->>'tcnsApprovedAt', v_item->>'tcns_approved_at', ''), '') IS NOT NULL
                 THEN (COALESCE(v_item->>'tcnsApprovedAt', v_item->>'tcns_approved_at'))::timestamptz ELSE NULL END,
            COALESCE(v_item->>'approvalLevel', v_item->>'relationship_status', 'unapproved'),
            NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            target_survey_id = COALESCE(EXCLUDED.target_survey_id, public.work_relationships.target_survey_id),
            target_task_code = COALESCE(EXCLUDED.target_task_code, public.work_relationships.target_task_code),
            host_leader_approved = public.work_relationships.host_leader_approved OR EXCLUDED.host_leader_approved,
            host_approved_by = COALESCE(public.work_relationships.host_approved_by, EXCLUDED.host_approved_by),
            host_approved_at = COALESCE(public.work_relationships.host_approved_at, EXCLUDED.host_approved_at),
            target_leader_approved = public.work_relationships.target_leader_approved OR EXCLUDED.target_leader_approved,
            target_approved_by = COALESCE(public.work_relationships.target_approved_by, EXCLUDED.target_approved_by),
            target_approved_at = COALESCE(public.work_relationships.target_approved_at, EXCLUDED.target_approved_at),
            tcns_approved = public.work_relationships.tcns_approved OR EXCLUDED.tcns_approved,
            tcns_approved_by = COALESCE(public.work_relationships.tcns_approved_by, EXCLUDED.tcns_approved_by),
            tcns_approved_at = COALESCE(public.work_relationships.tcns_approved_at, EXCLUDED.tcns_approved_at),
            relationship_status = CASE
              WHEN (public.work_relationships.tcns_approved OR EXCLUDED.tcns_approved)
                   AND (public.work_relationships.host_leader_approved OR EXCLUDED.host_leader_approved)
                   AND (public.work_relationships.target_leader_approved OR EXCLUDED.target_leader_approved)
                THEN 'both_units_and_tcns'
              WHEN (public.work_relationships.tcns_approved OR EXCLUDED.tcns_approved)
                THEN 'tcns_approved'
              WHEN (public.work_relationships.host_leader_approved OR EXCLUDED.host_leader_approved)
                   AND (public.work_relationships.target_leader_approved OR EXCLUDED.target_leader_approved)
                THEN 'both_units_approved'
              WHEN (public.work_relationships.host_leader_approved OR EXCLUDED.host_leader_approved)
                   OR (public.work_relationships.target_leader_approved OR EXCLUDED.target_leader_approved)
                THEN 'one_unit_approved'
              ELSE 'unapproved'
            END,
            updated_at = NOW();
        END IF;
      END LOOP;
    END IF;
  END IF;
END $$;

-- 3.2. Backfill từ JSONB staff_work_tickets.coordinated_vtvls (chạy lại idempotent theo khóa wrel-<id>-<unit>-<vtvl>)
INSERT INTO public.work_relationships (
  id, source_survey_id, source_task_code, source_task_name, source_mission_code,
  host_unit_code, host_unit_name, host_vtvl_code, host_vtvl_name,
  target_unit_code, target_unit_name, target_vtvl_code, target_vtvl_name,
  coordination_note, san_pham, target_survey_id, target_task_code,
  host_leader_approved, host_approved_by, host_approved_at,
  target_leader_approved, target_approved_by, target_approved_at,
  tcns_approved, tcns_approved_by, tcns_approved_at,
  relationship_status, updated_at
)
SELECT DISTINCT ON (rel_id)
  rel_id AS id,
  src.id AS source_survey_id,
  COALESCE(src.ma_cong_viec, '') AS source_task_code,
  COALESCE(src.ten_cong_viec, '') AS source_task_name,
  COALESCE(src.ma_nhiem_vu, '') AS source_mission_code,
  host_u.ma_don_vi AS host_unit_code,
  host_u.ten_don_vi_vi AS host_unit_name,
  COALESCE(src.ma_vtvl, '') AS host_vtvl_code,
  '' AS host_vtvl_name,
  tgt_u.ma_don_vi AS target_unit_code,
  tgt_u.ten_don_vi_vi AS target_unit_name,
  upper(btrim(COALESCE(elem->>'maVtvl', elem->>'target_vtvl_code', ''))) AS target_vtvl_code,
  COALESCE(elem->>'tenVtvl', elem->>'target_vtvl_name', '') AS target_vtvl_name,
  COALESCE(elem->>'note', src.coordination_note, '') AS coordination_note,
  COALESCE(src.san_pham, '') AS san_pham,
  tgt.id AS target_survey_id,
  tgt.ma_cong_viec AS target_task_code,
  (src.status IN ('approved', 'Đã duyệt')) AS host_leader_approved,
  CASE WHEN src.status IN ('approved', 'Đã duyệt') THEN src.approved_by ELSE NULL END AS host_approved_by,
  CASE WHEN src.status IN ('approved', 'Đã duyệt') THEN src.approved_at ELSE NULL END AS host_approved_at,
  COALESCE(tgt.status IN ('approved', 'Đã duyệt'), FALSE) AS target_leader_approved,
  CASE WHEN tgt.status IN ('approved', 'Đã duyệt') THEN tgt.approved_by ELSE NULL END AS target_approved_by,
  CASE WHEN tgt.status IN ('approved', 'Đã duyệt') THEN tgt.approved_at ELSE NULL END AS target_approved_at,
  (
    (src.status IN ('approved', 'Đã duyệt') AND lower(COALESCE(src.approved_by, '')) = 'tcns@hcmute.edu.vn')
    OR (COALESCE(tgt.status IN ('approved', 'Đã duyệt'), FALSE) AND lower(COALESCE(tgt.approved_by, '')) = 'tcns@hcmute.edu.vn')
  ) AS tcns_approved,
  CASE
    WHEN (src.status IN ('approved', 'Đã duyệt') AND lower(COALESCE(src.approved_by, '')) = 'tcns@hcmute.edu.vn')
      OR (COALESCE(tgt.status IN ('approved', 'Đã duyệt'), FALSE) AND lower(COALESCE(tgt.approved_by, '')) = 'tcns@hcmute.edu.vn')
    THEN 'tcns@hcmute.edu.vn'
    ELSE NULL
  END AS tcns_approved_by,
  CASE
    WHEN src.status IN ('approved', 'Đã duyệt') AND lower(COALESCE(src.approved_by, '')) = 'tcns@hcmute.edu.vn' THEN src.approved_at
    WHEN COALESCE(tgt.status IN ('approved', 'Đã duyệt'), FALSE) AND lower(COALESCE(tgt.approved_by, '')) = 'tcns@hcmute.edu.vn' THEN tgt.approved_at
    ELSE NULL
  END AS tcns_approved_at,
  CASE
    WHEN (
      (src.status IN ('approved', 'Đã duyệt') AND lower(COALESCE(src.approved_by, '')) = 'tcns@hcmute.edu.vn')
      OR (COALESCE(tgt.status IN ('approved', 'Đã duyệt'), FALSE) AND lower(COALESCE(tgt.approved_by, '')) = 'tcns@hcmute.edu.vn')
    ) AND (src.status IN ('approved', 'Đã duyệt')) AND COALESCE(tgt.status IN ('approved', 'Đã duyệt'), FALSE)
      THEN 'both_units_and_tcns'
    WHEN (src.status IN ('approved', 'Đã duyệt') AND lower(COALESCE(src.approved_by, '')) = 'tcns@hcmute.edu.vn')
      OR (COALESCE(tgt.status IN ('approved', 'Đã duyệt'), FALSE) AND lower(COALESCE(tgt.approved_by, '')) = 'tcns@hcmute.edu.vn')
      THEN 'tcns_approved'
    WHEN (src.status IN ('approved', 'Đã duyệt')) AND COALESCE(tgt.status IN ('approved', 'Đã duyệt'), FALSE)
      THEN 'both_units_approved'
    WHEN (src.status IN ('approved', 'Đã duyệt')) OR COALESCE(tgt.status IN ('approved', 'Đã duyệt'), FALSE)
      THEN 'one_unit_approved'
    ELSE 'unapproved'
  END AS relationship_status,
  GREATEST(src.updated_at, COALESCE(tgt.updated_at, src.updated_at)) AS updated_at
FROM public.staff_work_tickets src
JOIN public.dm_don_vi host_u ON host_u.ma_don_vi = upper(btrim(src.unit_code))
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(src.coordinated_vtvls) = 'array' THEN src.coordinated_vtvls ELSE '[]'::jsonb END
) AS elem
JOIN public.dm_don_vi tgt_u ON tgt_u.ma_don_vi = upper(btrim(COALESCE(NULLIF(elem->>'targetUnitCode', ''), NULLIF(elem->>'target_unit_code', ''), src.unit_code)))
LEFT JOIN LATERAL (
  SELECT t2.*
  FROM public.staff_work_tickets t2
  WHERE t2.id <> src.id
    AND COALESCE(t2.is_test_data, FALSE) = FALSE
    AND COALESCE(t2.is_archived, FALSE) = FALSE
    AND t2.status NOT IN ('draft', 'Nháp')
    AND upper(btrim(t2.unit_code)) = tgt_u.ma_don_vi
    AND upper(btrim(t2.ma_vtvl)) = upper(btrim(COALESCE(elem->>'maVtvl', elem->>'target_vtvl_code', '')))
  ORDER BY (CASE WHEN t2.status IN ('approved', 'Đã duyệt') THEN 1 ELSE 0 END) DESC, t2.updated_at DESC
  LIMIT 1
) tgt ON TRUE,
LATERAL (
  SELECT 'wrel-' || src.id || '-' || tgt_u.ma_don_vi || '-' || upper(btrim(COALESCE(elem->>'maVtvl', elem->>'target_vtvl_code', ''))) AS rel_id
) id_calc
WHERE COALESCE(src.is_test_data, FALSE) = FALSE
  AND COALESCE(src.is_archived, FALSE) = FALSE
  AND src.status NOT IN ('draft', 'Nháp')
  AND btrim(COALESCE(elem->>'maVtvl', elem->>'target_vtvl_code', '')) <> ''
ORDER BY rel_id, src.updated_at DESC
ON CONFLICT (id) DO UPDATE SET
  target_survey_id = COALESCE(EXCLUDED.target_survey_id, public.work_relationships.target_survey_id),
  target_task_code = COALESCE(EXCLUDED.target_task_code, public.work_relationships.target_task_code),
  host_leader_approved = public.work_relationships.host_leader_approved OR EXCLUDED.host_leader_approved,
  host_approved_by = COALESCE(public.work_relationships.host_approved_by, EXCLUDED.host_approved_by),
  host_approved_at = COALESCE(public.work_relationships.host_approved_at, EXCLUDED.host_approved_at),
  target_leader_approved = public.work_relationships.target_leader_approved OR EXCLUDED.target_leader_approved,
  target_approved_by = COALESCE(public.work_relationships.target_approved_by, EXCLUDED.target_approved_by),
  target_approved_at = COALESCE(public.work_relationships.target_approved_at, EXCLUDED.target_approved_at),
  tcns_approved = public.work_relationships.tcns_approved OR EXCLUDED.tcns_approved,
  tcns_approved_by = COALESCE(public.work_relationships.tcns_approved_by, EXCLUDED.tcns_approved_by),
  tcns_approved_at = COALESCE(public.work_relationships.tcns_approved_at, EXCLUDED.tcns_approved_at),
  updated_at = NOW();

-- 3.3. Sao lưu trước khi xử lý các bản ghi mồ côi trên work_relationships (nếu có dữ liệu cũ không khớp FK)
INSERT INTO public.migration_20261116210000_data_backup (table_name, record_id, action_taken, old_data)
SELECT
  'work_relationships',
  wr.id,
  'NULLIFY_ORPHAN_TARGET_SURVEY',
  to_jsonb(wr)
FROM public.work_relationships wr
WHERE wr.target_survey_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.staff_work_tickets t WHERE t.id = wr.target_survey_id)
ON CONFLICT (table_name, record_id, action_taken) DO NOTHING;

UPDATE public.work_relationships wr
SET target_survey_id = NULL
WHERE wr.target_survey_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.staff_work_tickets t WHERE t.id = wr.target_survey_id);

INSERT INTO public.migration_20261116210000_data_backup (table_name, record_id, action_taken, old_data)
SELECT
  'work_relationships',
  wr.id,
  'QUARANTINE_ORPHAN_WORK_REL',
  to_jsonb(wr)
FROM public.work_relationships wr
WHERE NOT EXISTS (SELECT 1 FROM public.staff_work_tickets t WHERE t.id = wr.source_survey_id)
   OR NOT EXISTS (SELECT 1 FROM public.dm_don_vi d WHERE d.ma_don_vi = wr.host_unit_code)
   OR NOT EXISTS (SELECT 1 FROM public.dm_don_vi d WHERE d.ma_don_vi = wr.target_unit_code)
ON CONFLICT (table_name, record_id, action_taken) DO NOTHING;

DELETE FROM public.work_relationships wr
WHERE NOT EXISTS (SELECT 1 FROM public.staff_work_tickets t WHERE t.id = wr.source_survey_id)
   OR NOT EXISTS (SELECT 1 FROM public.dm_don_vi d WHERE d.ma_don_vi = wr.host_unit_code)
   OR NOT EXISTS (SELECT 1 FROM public.dm_don_vi d WHERE d.ma_don_vi = wr.target_unit_code);

-- ------------------------------------------------------------------------------
-- PHASE 4: BỔ SUNG & XÁC THỰC (VALIDATE) CẢ 7 KHÓA NGOẠI (FOREIGN KEYS) & RLS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_rel_source_survey') THEN
    ALTER TABLE public.work_relationships
      ADD CONSTRAINT fk_work_rel_source_survey
      FOREIGN KEY (source_survey_id) REFERENCES public.staff_work_tickets(id) ON DELETE CASCADE;
  END IF;
  ALTER TABLE public.work_relationships VALIDATE CONSTRAINT fk_work_rel_source_survey;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_rel_target_survey') THEN
    ALTER TABLE public.work_relationships
      ADD CONSTRAINT fk_work_rel_target_survey
      FOREIGN KEY (target_survey_id) REFERENCES public.staff_work_tickets(id) ON DELETE SET NULL;
  END IF;
  ALTER TABLE public.work_relationships VALIDATE CONSTRAINT fk_work_rel_target_survey;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_rel_host_unit') THEN
    ALTER TABLE public.work_relationships
      ADD CONSTRAINT fk_work_rel_host_unit
      FOREIGN KEY (host_unit_code) REFERENCES public.dm_don_vi(ma_don_vi) ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  ALTER TABLE public.work_relationships VALIDATE CONSTRAINT fk_work_rel_host_unit;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_work_rel_target_unit') THEN
    ALTER TABLE public.work_relationships
      ADD CONSTRAINT fk_work_rel_target_unit
      FOREIGN KEY (target_unit_code) REFERENCES public.dm_don_vi(ma_don_vi) ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  ALTER TABLE public.work_relationships VALIDATE CONSTRAINT fk_work_rel_target_unit;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_approved_by') THEN
    ALTER TABLE public.staff_work_tickets
      ADD CONSTRAINT fk_tickets_approved_by
      FOREIGN KEY (approved_by) REFERENCES public.user_accounts(email) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
  ALTER TABLE public.staff_work_tickets VALIDATE CONSTRAINT fk_tickets_approved_by;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_revision_requested_by') THEN
    ALTER TABLE public.staff_work_tickets
      ADD CONSTRAINT fk_tickets_revision_requested_by
      FOREIGN KEY (revision_requested_by) REFERENCES public.user_accounts(email) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
  ALTER TABLE public.staff_work_tickets VALIDATE CONSTRAINT fk_tickets_revision_requested_by;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tickets_merged_by') THEN
    ALTER TABLE public.staff_work_tickets
      ADD CONSTRAINT fk_tickets_merged_by
      FOREIGN KEY (merged_by) REFERENCES public.user_accounts(email) ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
  ALTER TABLE public.staff_work_tickets VALIDATE CONSTRAINT fk_tickets_merged_by;
END $$;

ALTER TABLE public.work_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_relationships FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.work_relationships FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.work_relationships TO authenticated;
GRANT ALL ON public.work_relationships TO service_role;

DROP POLICY IF EXISTS "service_role_full_work_relationships" ON public.work_relationships;
CREATE POLICY "service_role_full_work_relationships" ON public.work_relationships
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rls_work_relationships_select" ON public.work_relationships;
CREATE POLICY "rls_work_relationships_select" ON public.work_relationships
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR host_unit_code = public.get_current_user_unit()
    OR target_unit_code = public.get_current_user_unit()
  );

DROP POLICY IF EXISTS "rls_work_relationships_manage" ON public.work_relationships;
CREATE POLICY "rls_work_relationships_manage" ON public.work_relationships
  FOR ALL TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.is_unit_leader()
      AND (host_unit_code = public.get_current_user_unit() OR target_unit_code = public.get_current_user_unit())
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR (
      public.is_unit_leader()
      AND (host_unit_code = public.get_current_user_unit() OR target_unit_code = public.get_current_user_unit())
    )
  );

-- ------------------------------------------------------------------------------
-- PHASE 5: RPC GIAO DỊCH NGUYÊN TỬ (ATOMIC TRANSACTION) CHO SNAPSHOT + BẢNG QUAN HỆ
-- Toàn bộ thao tác ghi t_tien_do + 13 bảng biểu + workbooks/sessions/participants/revisions
-- nằm trong 1 hàm PL/pgSQL duy nhất: lỗi bất kỳ bước nào sẽ ROLLBACK toàn bộ!
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_sync_workbook_atomic(
  p_unit_code TEXT,
  p_snapshot JSONB,
  p_relational JSONB,
  p_simulate_error BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_unit TEXT := upper(btrim(COALESCE(p_unit_code, '')));
BEGIN
  IF v_unit = '' THEN
    RAISE EXCEPTION 'INVALID_UNIT_CODE: Thiếu mã đơn vị khi đồng bộ bảng tính.' USING ERRCODE = '22023';
  END IF;

  -- 1. Bảo đảm mã đơn vị tồn tại trong dm_don_vi (nếu đơn vị tùy chỉnh mới thêm)
  IF p_relational ? 'unitRow' AND jsonb_typeof(p_relational->'unitRow') = 'object' THEN
    INSERT INTO public.dm_don_vi (
      ma_don_vi, ten_don_vi_vi, ten_don_vi_en, khoi_don_vi, is_active, updated_at
    ) VALUES (
      v_unit,
      COALESCE(p_relational->'unitRow'->>'ten_don_vi_vi', v_unit),
      COALESCE(p_relational->'unitRow'->>'ten_don_vi_en', v_unit),
      COALESCE(p_relational->'unitRow'->>'khoi_don_vi', 'phong-ban'),
      TRUE,
      NOW()
    )
    ON CONFLICT (ma_don_vi) DO NOTHING;
  END IF;

  -- 2. Ghi snapshot t_tien_do trong cùng transaction
  IF p_snapshot IS NOT NULL AND jsonb_typeof(p_snapshot) = 'object' THEN
    INSERT INTO public.t_tien_do (
      ma_don_vi, ten_don_vi, phien_ban, so_nhiem_vu_a1, so_cong_viec_a2, so_vtvl_c1,
      tong_fte_c3, trang_thai_ra_soat, updated_at, email_nguoi_thuc_hien,
      chuc_vu_nguoi_thuc_hien, du_lieu_ho_so_json
    ) VALUES (
      v_unit,
      COALESCE(p_snapshot->>'ten_don_vi', v_unit),
      COALESCE(p_snapshot->>'phien_ban', 'v1'),
      COALESCE((p_snapshot->>'so_nhiem_vu_a1')::int, 0),
      COALESCE((p_snapshot->>'so_cong_viec_a2')::int, 0),
      COALESCE((p_snapshot->>'so_vtvl_c1')::int, 0),
      COALESCE((p_snapshot->>'tong_fte_c3')::numeric, 0),
      COALESCE(p_snapshot->>'trang_thai_ra_soat', 'Đang cập nhật trực tuyến'),
      NOW(),
      p_snapshot->>'email_nguoi_thuc_hien',
      p_snapshot->>'chuc_vu_nguoi_thuc_hien',
      COALESCE(p_snapshot->'du_lieu_ho_so_json', '{}'::jsonb)
    )
    ON CONFLICT (ma_don_vi) DO UPDATE SET
      ten_don_vi = EXCLUDED.ten_don_vi,
      phien_ban = EXCLUDED.phien_ban,
      so_nhiem_vu_a1 = EXCLUDED.so_nhiem_vu_a1,
      so_cong_viec_a2 = EXCLUDED.so_cong_viec_a2,
      so_vtvl_c1 = EXCLUDED.so_vtvl_c1,
      tong_fte_c3 = EXCLUDED.tong_fte_c3,
      trang_thai_ra_soat = EXCLUDED.trang_thai_ra_soat,
      updated_at = NOW(),
      email_nguoi_thuc_hien = EXCLUDED.email_nguoi_thuc_hien,
      chuc_vu_nguoi_thuc_hien = EXCLUDED.chuc_vu_nguoi_thuc_hien,
      du_lieu_ho_so_json = EXCLUDED.du_lieu_ho_so_json;
  END IF;

  -- 3. Dọn các dòng đã bị xóa trên lưới theo thứ tự con -> cha (chỉ trong phạm vi v_unit)
  DELETE FROM public.b2_ct_tac_dong WHERE ma_don_vi = v_unit AND NOT (id_tac_dong = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'b2_ct', '[]'::jsonb)))));
  DELETE FROM public.b2_thay_doi WHERE ma_don_vi = v_unit AND NOT (ma_cong_viec = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'b2', '[]'::jsonb)))));
  DELETE FROM public.b1_khoi_luong WHERE ma_don_vi = v_unit AND NOT (ma_cong_viec = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'b1', '[]'::jsonb)))));
  DELETE FROM public.can_cu_goi_y WHERE ma_don_vi = v_unit AND NOT (ma_cong_viec = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'can_cu_goi_y', '[]'::jsonb)))));
  DELETE FROM public.c2_nang_luc WHERE ma_don_vi = v_unit AND NOT (ma_vtvl = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'c2', '[]'::jsonb)))));
  DELETE FROM public.c3_nhu_cau WHERE ma_don_vi = v_unit AND NOT (ma_vtvl = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'c3', '[]'::jsonb)))));
  DELETE FROM public.d1_nhan_luc WHERE ma_don_vi = v_unit AND NOT (ma_nguon_luc = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'d1', '[]'::jsonb)))));
  DELETE FROM public.du_bao_5_nam WHERE ma_don_vi = v_unit AND NOT ((ma_vtvl || '::' || nam_du_bao::text) = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'du_bao', '[]'::jsonb)))));
  DELETE FROM public.d2_phuong_an WHERE ma_don_vi = v_unit AND NOT ((ma_vtvl || '::' || nam_phuong_an::text) = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'d2', '[]'::jsonb)))));
  DELETE FROM public.a2_cong_viec WHERE ma_don_vi = v_unit AND NOT (ma_cong_viec = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'a2', '[]'::jsonb)))));
  DELETE FROM public.a1_nhiem_vu WHERE ma_don_vi = v_unit AND NOT (ma_nhiem_vu = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'a1', '[]'::jsonb)))));
  DELETE FROM public.c1_vtvl WHERE ma_don_vi = v_unit AND NOT (ma_vtvl = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_relational->'activeKeys'->'c1', '[]'::jsonb)))));

  -- 4. Upsert theo thứ tự cha -> con: A1, C1 -> A2 -> B1, B2_CT, B2, C2, C3, D1, DU_BAO_5_NAM, D2, K_KiemTra, Can_cu_goi_y
  INSERT INTO public.a1_nhiem_vu (ma_nhiem_vu, ma_don_vi, ten_nhiem_vu, can_cu_phap_ly, ky_thong_ke, trang_thai_nv, nguon_nhiem_vu, updated_at)
  SELECT r->>'ma_nhiem_vu', v_unit, r->>'ten_nhiem_vu', r->>'can_cu_phap_ly', r->>'ky_thong_ke', r->>'trang_thai_nv', r->>'nguon_nhiem_vu', NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'a1_nhiem_vu', '[]'::jsonb)) AS r
  ON CONFLICT (ma_nhiem_vu) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, ten_nhiem_vu = EXCLUDED.ten_nhiem_vu, can_cu_phap_ly = EXCLUDED.can_cu_phap_ly,
    ky_thong_ke = EXCLUDED.ky_thong_ke, trang_thai_nv = EXCLUDED.trang_thai_nv, nguon_nhiem_vu = EXCLUDED.nguon_nhiem_vu, updated_at = NOW();

  INSERT INTO public.c1_vtvl (ma_vtvl, ma_don_vi, nhom_vtvl_4, ten_khung_vtvl_truong, ten_vtvl_cu_the_don_vi, bac_nghe_nghiep_su_dung, ma_ngach_chuc_danh, loai_nhan_luc, che_do_lam_viec, gio_chuan_pp2, phuong_phap, updated_at)
  SELECT r->>'ma_vtvl', v_unit, r->>'nhom_vtvl_4', r->>'ten_khung_vtvl_truong', r->>'ten_vtvl_cu_the_don_vi', r->>'bac_nghe_nghiep_su_dung', r->>'ma_ngach_chuc_danh', r->>'loai_nhan_luc', r->>'che_do_lam_viec', COALESCE((r->>'gio_chuan_pp2')::numeric, 1904), r->>'phuong_phap', NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'c1_vtvl', '[]'::jsonb)) AS r
  ON CONFLICT (ma_vtvl) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, nhom_vtvl_4 = EXCLUDED.nhom_vtvl_4, ten_khung_vtvl_truong = EXCLUDED.ten_khung_vtvl_truong,
    ten_vtvl_cu_the_don_vi = EXCLUDED.ten_vtvl_cu_the_don_vi, bac_nghe_nghiep_su_dung = EXCLUDED.bac_nghe_nghiep_su_dung,
    ma_ngach_chuc_danh = EXCLUDED.ma_ngach_chuc_danh, loai_nhan_luc = EXCLUDED.loai_nhan_luc, che_do_lam_viec = EXCLUDED.che_do_lam_viec,
    gio_chuan_pp2 = EXCLUDED.gio_chuan_pp2, phuong_phap = EXCLUDED.phuong_phap, updated_at = NOW();

  INSERT INTO public.a2_cong_viec (ma_cong_viec, ma_don_vi, ma_nhiem_vu, ma_vtvl, ten_cong_viec, ten_san_pham, nhom_la_ma, don_vi_tinh, yeu_cau_chat_luong, updated_at)
  SELECT r->>'ma_cong_viec', v_unit, r->>'ma_nhiem_vu', r->>'ma_vtvl', r->>'ten_cong_viec', r->>'ten_san_pham', r->>'nhom_la_ma', r->>'don_vi_tinh', r->>'yeu_cau_chat_luong', NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'a2_cong_viec', '[]'::jsonb)) AS r
  ON CONFLICT (ma_cong_viec) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, ma_nhiem_vu = EXCLUDED.ma_nhiem_vu, ma_vtvl = EXCLUDED.ma_vtvl,
    ten_cong_viec = EXCLUDED.ten_cong_viec, ten_san_pham = EXCLUDED.ten_san_pham, nhom_la_ma = EXCLUDED.nhom_la_ma,
    don_vi_tinh = EXCLUDED.don_vi_tinh, yeu_cau_chat_luong = EXCLUDED.yeu_cau_chat_luong, updated_at = NOW();

  -- Kiểm thử lỗi giữa giao dịch: nếu p_simulate_error = TRUE, hủy toàn bộ transaction sau khi đã ghi t_tien_do, A1, C1, A2
  IF p_simulate_error THEN
    RAISE EXCEPTION 'TX_ABORTED_MIDWAY: Lỗi giả lập giữa giao dịch để kiểm chứng tính nguyên tử (rollback toàn bộ snapshot và bảng quan hệ).' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.b1_khoi_luong (ma_cong_viec, ma_don_vi, ma_vtvl, so_sp_nam, phut_sp_do_thuc_te, gio_bo_sung_nam, gio_sp_tinh, gio_tong_tinh, nguon_so_luong, nguon_thoi_gian, canh_bao_cot_r, giai_trinh_cot_s, updated_at)
  SELECT r->>'ma_cong_viec', v_unit, r->>'ma_vtvl', COALESCE((r->>'so_sp_nam')::numeric, 0), COALESCE((r->>'phut_sp_do_thuc_te')::numeric, 0), COALESCE((r->>'gio_bo_sung_nam')::numeric, 0), COALESCE((r->>'gio_sp_tinh')::numeric, 0), COALESCE((r->>'gio_tong_tinh')::numeric, 0), r->>'nguon_so_luong', r->>'nguon_thoi_gian', COALESCE(r->>'canh_bao_cot_r', 'ĐẠT'), r->>'giai_trinh_cot_s', NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'b1_khoi_luong', '[]'::jsonb)) AS r
  ON CONFLICT (ma_cong_viec) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, ma_vtvl = EXCLUDED.ma_vtvl, so_sp_nam = EXCLUDED.so_sp_nam,
    phut_sp_do_thuc_te = EXCLUDED.phut_sp_do_thuc_te, gio_bo_sung_nam = EXCLUDED.gio_bo_sung_nam,
    gio_sp_tinh = EXCLUDED.gio_sp_tinh, gio_tong_tinh = EXCLUDED.gio_tong_tinh,
    nguon_so_luong = EXCLUDED.nguon_so_luong, nguon_thoi_gian = EXCLUDED.nguon_thoi_gian,
    canh_bao_cot_r = EXCLUDED.canh_bao_cot_r, giai_trinh_cot_s = EXCLUDED.giai_trinh_cot_s, updated_at = NOW();

  INSERT INTO public.b2_ct_tac_dong (id_tac_dong, ma_don_vi, ma_cong_viec, ma_vtvl, loai_tac_dong, khau_tac_dong, gio_giam_hop_le, can_cu_minh_chung, updated_at)
  SELECT r->>'id_tac_dong', v_unit, r->>'ma_cong_viec', r->>'ma_vtvl', r->>'loai_tac_dong', r->>'khau_tac_dong', COALESCE((r->>'gio_giam_hop_le')::numeric, 0), r->>'can_cu_minh_chung', NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'b2_ct_tac_dong', '[]'::jsonb)) AS r
  ON CONFLICT (id_tac_dong) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, ma_cong_viec = EXCLUDED.ma_cong_viec, ma_vtvl = EXCLUDED.ma_vtvl,
    loai_tac_dong = EXCLUDED.loai_tac_dong, khau_tac_dong = EXCLUDED.khau_tac_dong,
    gio_giam_hop_le = EXCLUDED.gio_giam_hop_le, can_cu_minh_chung = EXCLUDED.can_cu_minh_chung, updated_at = NOW();

  INSERT INTO public.b2_thay_doi (ma_cong_viec, ma_don_vi, ma_vtvl, gio_giam_so_hoa, gio_viec_moi, gio_tac_dong_rong, updated_at)
  SELECT r->>'ma_cong_viec', v_unit, r->>'ma_vtvl', COALESCE((r->>'gio_giam_so_hoa')::numeric, 0), COALESCE((r->>'gio_viec_moi')::numeric, 0), COALESCE((r->>'gio_tac_dong_rong')::numeric, 0), NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'b2_thay_doi', '[]'::jsonb)) AS r
  ON CONFLICT (ma_cong_viec) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, ma_vtvl = EXCLUDED.ma_vtvl, gio_giam_so_hoa = EXCLUDED.gio_giam_so_hoa,
    gio_viec_moi = EXCLUDED.gio_viec_moi, gio_tac_dong_rong = EXCLUDED.gio_tac_dong_rong, updated_at = NOW();

  INSERT INTO public.c2_nang_luc (ma_vtvl, ma_don_vi, muc_tieu_vi_tri, trach_nhiem_chinh, khung_nang_luc_bac, yeu_cau_trinh_do_chuyen_mon, updated_at)
  SELECT r->>'ma_vtvl', v_unit, r->>'muc_tieu_vi_tri', r->>'trach_nhiem_chinh', r->>'khung_nang_luc_bac', r->>'yeu_cau_trinh_do_chuyen_mon', NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'c2_nang_luc', '[]'::jsonb)) AS r
  ON CONFLICT (ma_vtvl) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, muc_tieu_vi_tri = EXCLUDED.muc_tieu_vi_tri,
    trach_nhiem_chinh = EXCLUDED.trach_nhiem_chinh, khung_nang_luc_bac = EXCLUDED.khung_nang_luc_bac,
    yeu_cau_trinh_do_chuyen_mon = EXCLUDED.yeu_cau_trinh_do_chuyen_mon, updated_at = NOW();

  INSERT INTO public.c3_nhu_cau (ma_vtvl, ma_don_vi, phuong_phap, gio_b1_nam, gio_tac_dong_b2, gio_rong_nam, gio_chuan_pp2, nguoi_quy_doi_pp2, nguoi_dinh_bien_pp1, nguoi_can_bo_tri, updated_at)
  SELECT r->>'ma_vtvl', v_unit, r->>'phuong_phap', COALESCE((r->>'gio_b1_nam')::numeric, 0), COALESCE((r->>'gio_tac_dong_b2')::numeric, 0), COALESCE((r->>'gio_rong_nam')::numeric, 0), COALESCE((r->>'gio_chuan_pp2')::numeric, 1904), COALESCE((r->>'nguoi_quy_doi_pp2')::numeric, 0), COALESCE((r->>'nguoi_dinh_bien_pp1')::numeric, 0), COALESCE((r->>'nguoi_can_bo_tri')::numeric, 0), NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'c3_nhu_cau', '[]'::jsonb)) AS r
  ON CONFLICT (ma_vtvl) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, phuong_phap = EXCLUDED.phuong_phap, gio_b1_nam = EXCLUDED.gio_b1_nam,
    gio_tac_dong_b2 = EXCLUDED.gio_tac_dong_b2, gio_rong_nam = EXCLUDED.gio_rong_nam,
    gio_chuan_pp2 = EXCLUDED.gio_chuan_pp2, nguoi_quy_doi_pp2 = EXCLUDED.nguoi_quy_doi_pp2,
    nguoi_dinh_bien_pp1 = EXCLUDED.nguoi_dinh_bien_pp1, nguoi_can_bo_tri = EXCLUDED.nguoi_can_bo_tri, updated_at = NOW();

  INSERT INTO public.d1_nhan_luc (ma_nguon_luc, ma_don_vi, ma_vtvl, ho_va_ten, chuc_danh_hien_giu, ma_ngach_chuc_danh, loai_nhan_luc, ty_le_phan_bo_chinh, updated_at)
  SELECT r->>'ma_nguon_luc', v_unit, r->>'ma_vtvl', r->>'ho_va_ten', r->>'chuc_danh_hien_giu', r->>'ma_ngach_chuc_danh', r->>'loai_nhan_luc', COALESCE((r->>'ty_le_phan_bo_chinh')::numeric, 100), NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'d1_nhan_luc', '[]'::jsonb)) AS r
  ON CONFLICT (ma_nguon_luc) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, ma_vtvl = EXCLUDED.ma_vtvl, ho_va_ten = EXCLUDED.ho_va_ten,
    chuc_danh_hien_giu = EXCLUDED.chuc_danh_hien_giu, ma_ngach_chuc_danh = EXCLUDED.ma_ngach_chuc_danh,
    loai_nhan_luc = EXCLUDED.loai_nhan_luc, ty_le_phan_bo_chinh = EXCLUDED.ty_le_phan_bo_chinh, updated_at = NOW();

  INSERT INTO public.du_bao_5_nam (ma_vtvl, nam_du_bao, ma_don_vi, ty_le_thay_doi_kl_pct, nhu_cau_fte_du_kien, thuyet_minh_du_bao)
  SELECT r->>'ma_vtvl', (r->>'nam_du_bao')::int, v_unit, COALESCE((r->>'ty_le_thay_doi_kl_pct')::numeric, 0), COALESCE((r->>'nhu_cau_fte_du_kien')::numeric, 1), r->>'thuyet_minh_du_bao'
  FROM jsonb_array_elements(COALESCE(p_relational->'du_bao_5_nam', '[]'::jsonb)) AS r
  ON CONFLICT (ma_vtvl, nam_du_bao) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, ty_le_thay_doi_kl_pct = EXCLUDED.ty_le_thay_doi_kl_pct,
    nhu_cau_fte_du_kien = EXCLUDED.nhu_cau_fte_du_kien, thuyet_minh_du_bao = EXCLUDED.thuyet_minh_du_bao;

  INSERT INTO public.d2_phuong_an (ma_vtvl, nam_phuong_an, ma_don_vi, so_nguoi_can_bo_tri, so_nguoi_hien_co, chenh_lech, phuong_an_dieu_chinh)
  SELECT r->>'ma_vtvl', (r->>'nam_phuong_an')::int, v_unit, COALESCE((r->>'so_nguoi_can_bo_tri')::numeric, 0), COALESCE((r->>'so_nguoi_hien_co')::numeric, 0), COALESCE((r->>'chenh_lech')::numeric, 0), r->>'phuong_an_dieu_chinh'
  FROM jsonb_array_elements(COALESCE(p_relational->'d2_phuong_an', '[]'::jsonb)) AS r
  ON CONFLICT (ma_vtvl, nam_phuong_an) DO UPDATE SET
    ma_don_vi = EXCLUDED.ma_don_vi, so_nguoi_can_bo_tri = EXCLUDED.so_nguoi_can_bo_tri,
    so_nguoi_hien_co = EXCLUDED.so_nguoi_hien_co, chenh_lech = EXCLUDED.chenh_lech, phuong_an_dieu_chinh = EXCLUDED.phuong_an_dieu_chinh;

  INSERT INTO public.k_kiem_tra (ma_don_vi, stt_chi_tieu, nhom_bieu_doi_soat, noi_dung_kiem_tra, so_dong_loi, ket_luan, updated_at)
  SELECT v_unit, (r->>'stt_chi_tieu')::int, r->>'nhom_bieu_doi_soat', r->>'noi_dung_kiem_tra', COALESCE((r->>'so_dong_loi')::int, 0), r->>'ket_luan', NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'k_kiem_tra', '[]'::jsonb)) AS r
  ON CONFLICT (ma_don_vi, stt_chi_tieu) DO UPDATE SET
    nhom_bieu_doi_soat = EXCLUDED.nhom_bieu_doi_soat, noi_dung_kiem_tra = EXCLUDED.noi_dung_kiem_tra,
    so_dong_loi = EXCLUDED.so_dong_loi, ket_luan = EXCLUDED.ket_luan, updated_at = NOW();

  INSERT INTO public.can_cu_goi_y (ma_don_vi, ma_cong_viec, ma_vtvl, ten_cong_viec, so_sp_goi_y, phut_sp_goi_y, muc_do_phuc_tap, nguon_can_cu_goi_y, da_sua_thuc_te, updated_at)
  SELECT v_unit, r->>'ma_cong_viec', r->>'ma_vtvl', r->>'ten_cong_viec', COALESCE((r->>'so_sp_goi_y')::numeric, 0), COALESCE((r->>'phut_sp_goi_y')::numeric, 0), COALESCE(r->>'muc_do_phuc_tap', 'Thông thường'), COALESCE(r->>'nguon_can_cu_goi_y', 'QĐ 2266/QĐ-ĐHCNKT'), COALESCE((r->>'da_sua_thuc_te')::boolean, FALSE), NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'can_cu_goi_y', '[]'::jsonb)) AS r
  ON CONFLICT (ma_don_vi, ma_cong_viec) DO UPDATE SET
    ma_vtvl = EXCLUDED.ma_vtvl, ten_cong_viec = EXCLUDED.ten_cong_viec, so_sp_goi_y = EXCLUDED.so_sp_goi_y,
    phut_sp_goi_y = EXCLUDED.phut_sp_goi_y, muc_do_phuc_tap = EXCLUDED.muc_do_phuc_tap,
    nguon_can_cu_goi_y = EXCLUDED.nguon_can_cu_goi_y, da_sua_thuc_te = EXCLUDED.da_sua_thuc_te, updated_at = NOW();

  -- 5. Đồng bộ workbooks, workbook_sessions, session_participants và workbook_revisions
  IF p_relational ? 'workbook' AND jsonb_typeof(p_relational->'workbook') = 'object' THEN
    INSERT INTO public.workbooks (id, unit_id, reporting_period, status, current_revision, data, touched_cells, is_deleted, updated_at)
    VALUES (
      p_relational->'workbook'->>'id',
      v_unit,
      COALESCE(p_relational->'workbook'->>'reporting_period', '01/10/2025–30/9/2026'),
      COALESCE(p_relational->'workbook'->>'status', 'draft'),
      GREATEST(COALESCE((p_relational->'workbook'->>'current_revision')::int, 1), 1),
      COALESCE(p_relational->'workbook'->'data', '{}'::jsonb),
      COALESCE(p_relational->'workbook'->'touched_cells', '[]'::jsonb),
      COALESCE((p_relational->'workbook'->>'is_deleted')::boolean, FALSE),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status, current_revision = EXCLUDED.current_revision,
      data = EXCLUDED.data, touched_cells = EXCLUDED.touched_cells,
      is_deleted = EXCLUDED.is_deleted, updated_at = NOW();
  END IF;

  INSERT INTO public.workbook_sessions (id, workbook_id, access_scope, last_active_at)
  SELECT r->>'id', r->>'workbook_id', COALESCE(r->>'access_scope', 'editor'), NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'workbook_sessions', '[]'::jsonb)) AS r
  ON CONFLICT (id) DO UPDATE SET last_active_at = NOW();

  INSERT INTO public.session_participants (id, session_id, workbook_id, display_name, email, email_normalized, role_label, updated_at)
  SELECT r->>'id', r->>'session_id', r->>'workbook_id', r->>'display_name', r->>'email', r->>'email_normalized', COALESCE(r->>'role_label', 'Chuyên viên'), NOW()
  FROM jsonb_array_elements(COALESCE(p_relational->'session_participants', '[]'::jsonb)) AS r
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name, role_label = EXCLUDED.role_label, updated_at = NOW();

  INSERT INTO public.workbook_revisions (id, workbook_id, revision, data, actor_email, actor_title, change_summary)
  SELECT r->>'id', r->>'workbook_id', GREATEST(COALESCE((r->>'revision')::int, 1), 1), COALESCE(r->'data', '{}'::jsonb), COALESCE(r->>'actor_email', 'tcns@hcmute.edu.vn'), r->>'actor_title', r->>'change_summary'
  FROM jsonb_array_elements(COALESCE(p_relational->'workbook_revisions', '[]'::jsonb)) AS r
  ON CONFLICT (id) DO UPDATE SET
    data = EXCLUDED.data, actor_email = EXCLUDED.actor_email,
    actor_title = EXCLUDED.actor_title, change_summary = EXCLUDED.change_summary;

  RETURN jsonb_build_object('success', TRUE, 'unit_code', v_unit, 'atomic_tx', TRUE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_sync_workbook_atomic(TEXT, JSONB, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_sync_workbook_atomic(TEXT, JSONB, JSONB, BOOLEAN) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- PHASE 6: VALIDATE & POSTFLIGHT ASSERTIONS (KIỂM TRA ĐỊNH NGHĨA & CONVALIDATED = TRUE)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_con TEXT;
  v_validated BOOLEAN;
  v_def TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_relationships') THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: Chưa tạo được bảng public.work_relationships.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'migration_20261116210000_data_backup') THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: Chưa tạo được bảng sao lưu public.migration_20261116210000_data_backup.';
  END IF;

  FOREACH v_con IN ARRAY ARRAY[
    'fk_work_rel_source_survey',
    'fk_work_rel_target_survey',
    'fk_work_rel_host_unit',
    'fk_work_rel_target_unit',
    'fk_tickets_approved_by',
    'fk_tickets_revision_requested_by',
    'fk_tickets_merged_by'
  ] LOOP
    SELECT c.convalidated, pg_get_constraintdef(c.oid)
    INTO v_validated, v_def
    FROM pg_constraint c
    WHERE c.conname = v_con AND c.contype = 'f';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POSTFLIGHT_FAILED: Thiếu khóa ngoại % sau migration.', v_con;
    END IF;

    IF v_validated IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'POSTFLIGHT_FAILED: Khóa ngoại % chưa được xác thực (convalidated = %). Định nghĩa: %', v_con, v_validated, v_def;
    END IF;
  END LOOP;
END $$;

CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text NOT NULL PRIMARY KEY,
  statements text[],
  name text
);
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261116210000', 'create_work_relationships')
ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;

NOTIFY pgrst, 'reload schema';

COMMIT;
