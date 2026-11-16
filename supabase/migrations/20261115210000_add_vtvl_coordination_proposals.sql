-- ==============================================================================
-- MIGRATION: BỔ SUNG QUAN HỆ PHÂN CÔNG VTVL ↔ NGƯỜI DÙNG & ĐỀ XUẤT PHỐI HỢP VTVL
-- Hệ thống: HCM-UTE VTVL 360 (Trường Đại học Công nghệ Kỹ thuật TP.HCM)
-- Ngày ban hành: 15/11/2026
-- Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW
--
-- Phát hiện hiện trạng & Mục tiêu:
--   - Trước migration này, bảng public.user_accounts chỉ lưu email, role, unit_id/unit_code,
--     title, status; bảng d1_nhan_luc chỉ lưu hoTen và ma_vtvl (chưa có email/user_id).
--   - Hệ thống chưa có quan hệ tường minh người dùng <-> mã VTVL; không suy đoán theo tên,
--     email, vai trò hay đơn vị.
--   - Bổ sung:
--       1. public.user_vtvl_assignments: phân công tường minh (user_email, unit_code, ma_vtvl).
--       2. public.work_survey_coordinated_vtvls: bảng chiếu phiên bản đề xuất phối hợp theo
--          (survey_id, version_no, task_row_id, target_unit_code, target_vtvl_code), hỗ trợ nhiều
--          mã VTVL phối hợp/công việc và cô lập dữ liệu nháp chưa nộp lại.
--       3. RLS Policies nghiêm ngặt & Partial Indexes tối ưu hiệu năng truy vấn.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. PREFLIGHT ASSERTIONS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_accounts') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.user_accounts chưa tồn tại.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dm_don_vi') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.dm_don_vi chưa tồn tại.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_work_tickets') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.staff_work_tickets chưa tồn tại.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_survey_versions') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.work_survey_versions chưa tồn tại.';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. BẢNG PHÂN CÔNG VTVL TƯỜNG MINH: public.user_vtvl_assignments
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_vtvl_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL REFERENCES public.user_accounts(email) ON UPDATE CASCADE ON DELETE CASCADE,
  unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON UPDATE CASCADE ON DELETE RESTRICT,
  ma_vtvl VARCHAR(80) NOT NULL,
  ten_vtvl TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_user_vtvl_assignments_vtvl_nonempty CHECK (length(trim(ma_vtvl)) > 0),
  CONSTRAINT uq_user_vtvl_assignment UNIQUE (user_email, unit_code, ma_vtvl)
);

CREATE INDEX IF NOT EXISTS idx_user_vtvl_assignments_unit_vtvl
  ON public.user_vtvl_assignments (unit_code, ma_vtvl)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_vtvl_assignments_email
  ON public.user_vtvl_assignments (user_email)
  WHERE is_active = TRUE;

-- ------------------------------------------------------------------------------
-- 3. BẢNG ĐỀ XUẤT PHỐI HỢP THEO PHIÊN BẢN ĐÃ NỘP: public.work_survey_coordinated_vtvls
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_survey_coordinated_vtvls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id VARCHAR(100) NOT NULL REFERENCES public.staff_work_tickets(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no >= 1),
  task_row_id VARCHAR(120) NOT NULL,
  host_unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON UPDATE CASCADE ON DELETE RESTRICT,
  target_unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON UPDATE CASCADE ON DELETE RESTRICT,
  target_vtvl_code VARCHAR(80) NOT NULL,
  target_vtvl_name TEXT,
  coordination_note TEXT,
  is_latest_submitted BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_wscv_vtvl_nonempty CHECK (length(trim(target_vtvl_code)) > 0),
  CONSTRAINT uq_survey_ver_task_target_vtvl UNIQUE (survey_id, version_no, task_row_id, target_unit_code, target_vtvl_code)
);

CREATE INDEX IF NOT EXISTS idx_coord_vtvls_recipient_latest
  ON public.work_survey_coordinated_vtvls (target_unit_code, target_vtvl_code)
  WHERE is_latest_submitted = TRUE;

CREATE INDEX IF NOT EXISTS idx_coord_vtvls_survey_ver
  ON public.work_survey_coordinated_vtvls (survey_id, version_no DESC);

-- Bổ sung trường tùy chọn trên staff_work_tickets để đồng bộ thuận tiện (dữ liệu chính vẫn nằm trong snapshot)
ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS coordination_note TEXT;
ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS coordinated_vtvls JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ------------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY (RLS) CHO 2 BẢNG MỚI
-- ------------------------------------------------------------------------------
ALTER TABLE public.user_vtvl_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vtvl_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.work_survey_coordinated_vtvls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_survey_coordinated_vtvls FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_vtvl_assignments FROM PUBLIC, anon;
REVOKE ALL ON public.work_survey_coordinated_vtvls FROM PUBLIC, anon;

GRANT SELECT ON public.user_vtvl_assignments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_vtvl_assignments TO authenticated;
GRANT SELECT ON public.work_survey_coordinated_vtvls TO authenticated;
GRANT ALL ON public.user_vtvl_assignments, public.work_survey_coordinated_vtvls TO service_role;

DROP POLICY IF EXISTS "service_role_full_user_vtvl_assignments" ON public.user_vtvl_assignments;
CREATE POLICY "service_role_full_user_vtvl_assignments" ON public.user_vtvl_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_work_survey_coordinated_vtvls" ON public.work_survey_coordinated_vtvls;
CREATE POLICY "service_role_full_work_survey_coordinated_vtvls" ON public.work_survey_coordinated_vtvls
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Xem phân công VTVL: Admin xem toàn trường; chính chủ xem của mình; mọi tài khoản cùng đơn vị (hoặc tra cứu nhận phối hợp) có thể đọc danh sách phân công đang hoạt động theo đơn vị/mã VTVL
DROP POLICY IF EXISTS "rls_user_vtvl_assignments_select" ON public.user_vtvl_assignments;
CREATE POLICY "rls_user_vtvl_assignments_select" ON public.user_vtvl_assignments
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR lower(user_email) = lower(public.get_current_user_email())
    OR unit_code = public.get_current_user_unit()
  );

-- Chỉ Admin (toàn trường) hoặc Lãnh đạo đơn vị (đúng đơn vị mình, trừ tài khoản Admin) được phân công VTVL
DROP POLICY IF EXISTS "rls_user_vtvl_assignments_manage" ON public.user_vtvl_assignments;
CREATE POLICY "rls_user_vtvl_assignments_manage" ON public.user_vtvl_assignments
  FOR ALL TO authenticated
  USING (
    public.is_admin_user()
    OR (public.is_unit_leader() AND unit_code = public.get_current_user_unit())
  )
  WITH CHECK (
    public.is_admin_user()
    OR (
      public.is_unit_leader()
      AND unit_code = public.get_current_user_unit()
      AND EXISTS (
        SELECT 1 FROM public.user_accounts ua
        WHERE lower(ua.email) = lower(user_vtvl_assignments.user_email)
          AND COALESCE(NULLIF(ua.unit_id, ''), ua.unit_code) = public.get_current_user_unit()
          AND ua.role <> 'admin'
      )
    )
  );

-- Đọc đề xuất phối hợp:
-- 1. Admin xem toàn trường.
-- 2. Chủ sở hữu phiếu nguồn hoặc người cùng đơn vị chủ trì (đã nộp) xem theo phạm vi đơn vị.
-- 3. Người nhận phối hợp CHỈ ĐƯỢC XEM dòng thuộc phiên bản đã nộp mới nhất (is_latest_submitted = TRUE),
--    phiếu nguồn không ở draft, không phải test/archived, và khớp đồng thời (target_unit_code, target_vtvl_code) trong phân công của mình.
DROP POLICY IF EXISTS "rls_work_survey_coordinated_vtvls_select" ON public.work_survey_coordinated_vtvls;
CREATE POLICY "rls_work_survey_coordinated_vtvls_select" ON public.work_survey_coordinated_vtvls
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR (
      is_latest_submitted = TRUE
      AND EXISTS (
        SELECT 1
        FROM public.staff_work_tickets t
        WHERE t.id = work_survey_coordinated_vtvls.survey_id
          AND t.status IN ('submitted', 'changes_requested', 'resubmitted', 'approved', 'Đã nộp', 'Yêu cầu bổ sung', 'Đã nộp lại', 'Đã duyệt', 'Trả lại')
          AND COALESCE(t.is_test_data, FALSE) = FALSE
          AND COALESCE(t.is_archived, FALSE) = FALSE
      )
      AND EXISTS (
        SELECT 1
        FROM public.user_vtvl_assignments uva
        JOIN public.user_accounts ua ON lower(ua.email) = lower(uva.user_email)
        WHERE lower(uva.user_email) = lower(public.get_current_user_email())
          AND uva.is_active = TRUE
          AND COALESCE(ua.is_active, TRUE) = TRUE
          AND COALESCE(ua.status, 'active') = 'active'
          AND uva.unit_code = work_survey_coordinated_vtvls.target_unit_code
          AND upper(trim(uva.ma_vtvl)) = upper(trim(work_survey_coordinated_vtvls.target_vtvl_code))
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 5. POSTFLIGHT ASSERTIONS
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_vtvl_assignments') THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: Chưa tạo được bảng public.user_vtvl_assignments.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_survey_coordinated_vtvls') THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: Chưa tạo được bảng public.work_survey_coordinated_vtvls.';
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text NOT NULL PRIMARY KEY,
  statements text[],
  name text
);
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261115210000', 'add_vtvl_coordination_proposals')
ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;

NOTIFY pgrst, 'reload schema';

COMMIT;
