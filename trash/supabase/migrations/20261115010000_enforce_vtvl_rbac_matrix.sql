-- ==============================================================================
-- BẢN MIGRATION: ENFORCE VTVL RBAC MATRIX & TICKET LIFECYCLE (4 TRẠNG THÁI)
-- Dự án: HCM-UTE VTVL 360 (Trường Đại học Công nghệ Kỹ thuật TP.HCM)
-- Ngày ban hành: 15/11/2026
-- Căn cứ: Ma trận phân quyền 3 nhóm: Admin (TCNS), Lãnh đạo đơn vị, Cán bộ
--
-- Ma trận quyền chốt:
-- 1. Admin: Toàn quyền xem, sửa 15 biểu, duyệt/trả phiếu, quản trị tài khoản & đơn vị toàn trường.
-- 2. Lãnh đạo đơn vị: Toàn quyền 15 biểu & C1 trong đơn vị mình, duyệt/trả phiếu đơn vị, quản trị tài khoản đơn vị.
-- 3. Cán bộ: Chế độ chỉ đọc 15 biểu đơn vị & danh sách phiếu đơn vị, kê khai & sửa phiếu của chính mình.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CẬP NHẬT CHECK CONSTRAINT TRẠNG THÁI PHIẾU CÔNG VIỆC: 4 TRẠNG THÁI
--    'Nháp' -> 'Đã nộp' -> 'Đã duyệt' | 'Trả lại'
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_work_tickets') THEN
    -- Gỡ bỏ check constraint cũ nếu có
    ALTER TABLE public.staff_work_tickets DROP CONSTRAINT IF EXISTS staff_work_tickets_status_check;
    ALTER TABLE public.staff_work_tickets DROP CONSTRAINT IF EXISTS chk_staff_work_tickets_status;

    -- Thiết lập constraint mới với đầy đủ 4 trạng thái chuẩn
    ALTER TABLE public.staff_work_tickets
      ADD CONSTRAINT chk_staff_work_tickets_status
      CHECK (status IN ('Nháp', 'Đã nộp', 'Đã duyệt', 'Trả lại'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CẬP NHẬT HÀM TIỆN ÍCH PHÂN QUYỀN TRÊN SUPABASE (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (SELECT role FROM public.user_accounts WHERE lower(email) = lower(public.get_current_user_email()) LIMIT 1),
    'staff'
  )::text;
$$;

-- ------------------------------------------------------------------------------
-- 3. SIẾT CHẶT RLS CHO BẢNG: public.staff_work_tickets
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_work_tickets') THEN
    ALTER TABLE public.staff_work_tickets ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_work_tickets TO authenticated;

    -- SELECT:
    -- Admin: Xem tất cả
    -- Lãnh đạo đơn vị: Xem tất cả phiếu trong đơn vị mình
    -- Cán bộ: Xem phiếu của mình (mọi trạng thái) HOẶC phiếu của đồng nghiệp trong đơn vị nếu đã nộp/duyệt/trả lại
    DROP POLICY IF EXISTS "rls_staff_tickets_select" ON public.staff_work_tickets;
    CREATE POLICY "rls_staff_tickets_select" ON public.staff_work_tickets
      FOR SELECT TO authenticated
      USING (
        public.is_admin_user()
        OR (
          unit_code = public.get_user_unit()
          AND (
            public.get_current_user_role() = 'unit_leader'
            OR lower(owner_email) = lower(public.get_current_user_email())
            OR status IN ('Đã nộp', 'Đã duyệt', 'Trả lại')
          )
        )
      );

    -- INSERT:
    -- Admin: Tạo phiếu cho bất kỳ ai
    -- Cán bộ & Lãnh đạo: Chỉ tạo phiếu cho chính mình trong đơn vị của mình
    DROP POLICY IF EXISTS "rls_staff_tickets_insert" ON public.staff_work_tickets;
    CREATE POLICY "rls_staff_tickets_insert" ON public.staff_work_tickets
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin_user()
        OR (
          lower(owner_email) = lower(public.get_current_user_email())
          AND unit_code = public.get_user_unit()
        )
      );

    -- UPDATE:
    -- Admin: Sửa mọi phiếu
    -- Lãnh đạo đơn vị: Duyệt hoặc trả lại phiếu thuộc đơn vị mình
    -- Cán bộ: Chỉ sửa phiếu của chính mình khi trạng thái là 'Nháp' hoặc 'Trả lại'
    DROP POLICY IF EXISTS "rls_staff_tickets_update" ON public.staff_work_tickets;
    CREATE POLICY "rls_staff_tickets_update" ON public.staff_work_tickets
      FOR UPDATE TO authenticated
      USING (
        public.is_admin_user()
        OR (
          unit_code = public.get_user_unit()
          AND public.get_current_user_role() = 'unit_leader'
        )
        OR (
          lower(owner_email) = lower(public.get_current_user_email())
          AND unit_code = public.get_user_unit()
          AND status IN ('Nháp', 'Trả lại')
        )
      )
      WITH CHECK (
        public.is_admin_user()
        OR (
          unit_code = public.get_user_unit()
          AND (
            public.get_current_user_role() = 'unit_leader'
            OR lower(owner_email) = lower(public.get_current_user_email())
          )
        )
      );

    -- DELETE:
    -- Admin: Xóa phiếu
    -- Cán bộ: Chỉ xóa phiếu nháp của chính mình
    DROP POLICY IF EXISTS "rls_staff_tickets_delete" ON public.staff_work_tickets;
    CREATE POLICY "rls_staff_tickets_delete" ON public.staff_work_tickets
      FOR DELETE TO authenticated
      USING (
        public.is_admin_user()
        OR (
          lower(owner_email) = lower(public.get_current_user_email())
          AND unit_code = public.get_user_unit()
          AND status = 'Nháp'
        )
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. SIẾT CHẶT RLS CHO BẢNG: public.workbooks (15 BIỂU)
--    Cán bộ: Chế độ CHỈ ĐỌC (không có quyền INSERT, UPDATE, DELETE)
--    Lãnh đạo đơn vị: Có quyền đọc/ghi hồ sơ của đơn vị mình
--    Admin: Toàn quyền
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workbooks') THEN
    ALTER TABLE public.workbooks ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbooks TO authenticated;

    DROP POLICY IF EXISTS "rls_workbooks_select" ON public.workbooks;
    CREATE POLICY "rls_workbooks_select" ON public.workbooks
      FOR SELECT TO authenticated
      USING (
        public.is_admin_user()
        OR unit_id = public.get_user_unit()
      );

    DROP POLICY IF EXISTS "rls_workbooks_insert" ON public.workbooks;
    CREATE POLICY "rls_workbooks_insert" ON public.workbooks
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin_user()
        OR (
          unit_id = public.get_user_unit()
          AND public.get_current_user_role() = 'unit_leader'
        )
      );

    DROP POLICY IF EXISTS "rls_workbooks_update" ON public.workbooks;
    CREATE POLICY "rls_workbooks_update" ON public.workbooks
      FOR UPDATE TO authenticated
      USING (
        public.is_admin_user()
        OR (
          unit_id = public.get_user_unit()
          AND public.get_current_user_role() = 'unit_leader'
        )
      )
      WITH CHECK (
        public.is_admin_user()
        OR (
          unit_id = public.get_user_unit()
          AND public.get_current_user_role() = 'unit_leader'
        )
      );

    DROP POLICY IF EXISTS "rls_workbooks_delete" ON public.workbooks;
    CREATE POLICY "rls_workbooks_delete" ON public.workbooks
      FOR DELETE TO authenticated
      USING (
        public.is_admin_user()
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. SIẾT CHẶT RLS CHO BẢNG: public.user_accounts
--    Admin: Toàn quyền xem, thêm, sửa, xóa
--    Lãnh đạo đơn vị: Xem và sửa tài khoản trong đơn vị mình, CẤM cấp quyền Admin
--    Cán bộ: Chỉ xem tài khoản trong đơn vị mình, CẤM quản trị tài khoản
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_accounts') THEN
    ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_accounts TO authenticated;

    DROP POLICY IF EXISTS "rls_user_accounts_select" ON public.user_accounts;
    CREATE POLICY "rls_user_accounts_select" ON public.user_accounts
      FOR SELECT TO authenticated
      USING (
        public.is_admin_user()
        OR unit_code = public.get_user_unit()
        OR lower(email) = lower(public.get_current_user_email())
      );

    DROP POLICY IF EXISTS "rls_user_accounts_insert" ON public.user_accounts;
    CREATE POLICY "rls_user_accounts_insert" ON public.user_accounts
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin_user()
        OR (
          public.get_current_user_role() = 'unit_leader'
          AND unit_code = public.get_user_unit()
          AND role IN ('unit_leader', 'staff')
        )
      );

    DROP POLICY IF EXISTS "rls_user_accounts_update" ON public.user_accounts;
    CREATE POLICY "rls_user_accounts_update" ON public.user_accounts
      FOR UPDATE TO authenticated
      USING (
        public.is_admin_user()
        OR (
          public.get_current_user_role() = 'unit_leader'
          AND unit_code = public.get_user_unit()
          AND role <> 'admin'
        )
      )
      WITH CHECK (
        public.is_admin_user()
        OR (
          public.get_current_user_role() = 'unit_leader'
          AND unit_code = public.get_user_unit()
          AND role IN ('unit_leader', 'staff')
        )
      );

    DROP POLICY IF EXISTS "rls_user_accounts_delete" ON public.user_accounts;
    CREATE POLICY "rls_user_accounts_delete" ON public.user_accounts
      FOR DELETE TO authenticated
      USING (
        public.is_admin_user()
        OR (
          public.get_current_user_role() = 'unit_leader'
          AND unit_code = public.get_user_unit()
          AND role <> 'admin'
          AND lower(email) <> 'tcns@hcmute.edu.vn'
        )
      );
  END IF;
END $$;
