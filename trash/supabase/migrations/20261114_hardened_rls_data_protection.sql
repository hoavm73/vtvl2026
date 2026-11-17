-- ==============================================================================
-- BẢN MIGRATION BẢO MẬT P0: HARDENED ROW LEVEL SECURITY (RLS) & DATA ACCESS SHIELD
-- Dự án: HCM-UTE VTVL 360 (Trường Đại học Công nghệ Kỹ thuật TP.HCM)
-- Ngày ban hành: 14/11/2026
-- Mục tiêu:
--   1. Khóa hoàn toàn quyền truy cập của anon (public) trên mọi bảng nghiệp vụ & hồ sơ cá nhân.
--   2. Bật và siết chặt RLS trên staff_work_tickets, coordinated_tasks, user_accounts, workbooks, t_tien_do...
--   3. Xóa bỏ chính sách rls_google_hcmute_rw_% diện rộng cho phép đọc/ghi chéo giữa các đơn vị.
--   4. Thiết lập nguyên tắc cách ly dữ liệu đa đơn vị (Tenant Isolation):
--      - Cán bộ (staff): Chỉ đọc/sửa/xóa phiếu cá nhân của chính mình (Nháp).
--      - Lãnh đạo đơn vị (unit_leader): Chỉ truy cập hồ sơ và duyệt phiếu của đơn vị mình.
--      - Quản trị viên (admin - TCNS): Có toàn quyền giám sát và rà soát toàn trường.
--   5. Bảo đảm các bảng danh mục dùng chung (dm_*) luôn là READ-ONLY đối với người dùng.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HÀM TIỆN ÍCH HỖ TRỢ PHÂN QUYỀN TRONG POSTGRESQL (SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    auth.jwt() ->> 'email',
    ''
  )::text;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    lower(public.get_current_user_email()) = 'tcns@hcmute.edu.vn'
    OR EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE lower(email) = lower(public.get_current_user_email())
        AND role = 'admin'
        AND status = 'active'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_unit()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (SELECT unit_code FROM public.user_accounts WHERE lower(email) = lower(public.get_current_user_email()) LIMIT 1),
    ''
  )::text;
$$;

-- ------------------------------------------------------------------------------
-- 2. BẬT RLS VÀ THU HỒI TOÀN BỘ QUYỀN TRUY CẬP CỦA ANON TRÊN CÁC BẢNG DỮ LIỆU
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  all_data_tables text[] := ARRAY[
    'user_accounts', 'staff_work_tickets', 'coordinated_tasks',
    'workbooks', 'workbook_sessions', 'session_participants', 'workbook_revisions',
    't_tien_do', 's_nhat_ky', 'audit_logs',
    'a1_nhiem_vu', 'a2_cong_viec', 'b1_khoi_luong', 'b2_ct_tac_dong', 'b2_thay_doi',
    'c1_vtvl', 'c2_nang_luc', 'c3_nhu_cau', 'd1_nhan_luc', 'du_bao_5_nam', 'd2_phuong_an',
    'k_kiem_tra', 'sldv_quy_mo_don_vi', 'sldv_phan_bo_ngach', 'can_cu_goi_y', 'ra_soat_chua_du_can_cu'
  ];
BEGIN
  FOREACH tbl IN ARRAY all_data_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role;', tbl);

      -- Xóa tất cả các policy cũ cấp quyền rộng hoặc không an toàn
      EXECUTE format('DROP POLICY IF EXISTS "rls_google_hcmute_rw_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_all_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_select_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_insert_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_update_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_delete_%s" ON public.%I;', tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. CHÍNH SÁCH BẢO MẬT CHO BẢNG: public.staff_work_tickets
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_work_tickets') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_work_tickets TO authenticated;

    DROP POLICY IF EXISTS "rls_staff_tickets_select" ON public.staff_work_tickets;
    CREATE POLICY "rls_staff_tickets_select" ON public.staff_work_tickets
      FOR SELECT TO authenticated
      USING (
        public.is_admin_user()
        OR lower(owner_email) = lower(public.get_current_user_email())
        OR (
          unit_code = public.get_user_unit()
          AND (
            status = 'Đã nộp'
            OR EXISTS (
              SELECT 1 FROM public.user_accounts
              WHERE lower(email) = lower(public.get_current_user_email()) AND role = 'unit_leader'
            )
          )
        )
      );

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

    DROP POLICY IF EXISTS "rls_staff_tickets_update" ON public.staff_work_tickets;
    CREATE POLICY "rls_staff_tickets_update" ON public.staff_work_tickets
      FOR UPDATE TO authenticated
      USING (
        public.is_admin_user()
        OR (lower(owner_email) = lower(public.get_current_user_email()) AND status = 'Nháp')
        OR (
          unit_code = public.get_user_unit()
          AND EXISTS (
            SELECT 1 FROM public.user_accounts
            WHERE lower(email) = lower(public.get_current_user_email()) AND role = 'unit_leader'
          )
        )
      )
      WITH CHECK (
        public.is_admin_user()
        OR (lower(owner_email) = lower(public.get_current_user_email()) AND unit_code = public.get_user_unit())
      );

    DROP POLICY IF EXISTS "rls_staff_tickets_delete" ON public.staff_work_tickets;
    CREATE POLICY "rls_staff_tickets_delete" ON public.staff_work_tickets
      FOR DELETE TO authenticated
      USING (
        public.is_admin_user()
        OR (lower(owner_email) = lower(public.get_current_user_email()) AND status = 'Nháp')
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. CHÍNH SÁCH BẢO MẬT CHO BẢNG: public.user_accounts
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_accounts') THEN
    GRANT SELECT, INSERT, UPDATE ON public.user_accounts TO authenticated;

    DROP POLICY IF EXISTS "rls_user_accounts_select" ON public.user_accounts;
    CREATE POLICY "rls_user_accounts_select" ON public.user_accounts
      FOR SELECT TO authenticated
      USING (
        public.is_admin_user()
        OR lower(email) = lower(public.get_current_user_email())
        OR unit_code = public.get_user_unit()
      );

    DROP POLICY IF EXISTS "rls_user_accounts_insert" ON public.user_accounts;
    CREATE POLICY "rls_user_accounts_insert" ON public.user_accounts
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_admin_user()
        OR (lower(email) = lower(public.get_current_user_email()) AND role <> 'admin')
      );

    DROP POLICY IF EXISTS "rls_user_accounts_update" ON public.user_accounts;
    CREATE POLICY "rls_user_accounts_update" ON public.user_accounts
      FOR UPDATE TO authenticated
      USING (
        public.is_admin_user()
        OR lower(email) = lower(public.get_current_user_email())
      )
      WITH CHECK (
        public.is_admin_user()
        OR (lower(email) = lower(public.get_current_user_email()) AND role <> 'admin')
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. CHÍNH SÁCH BẢO MẬT CHO BẢNG: public.coordinated_tasks
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'coordinated_tasks') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.coordinated_tasks TO authenticated;

    DROP POLICY IF EXISTS "rls_coordinated_tasks_select" ON public.coordinated_tasks;
    CREATE POLICY "rls_coordinated_tasks_select" ON public.coordinated_tasks
      FOR SELECT TO authenticated
      USING (
        public.is_admin_user()
        OR unit_code = public.get_user_unit()
        OR target_unit_code = public.get_user_unit()
        OR EXISTS (
          SELECT 1 FROM public.staff_work_tickets t
          WHERE t.id = ticket_id AND lower(t.owner_email) = lower(public.get_current_user_email())
        )
      );

    DROP POLICY IF EXISTS "rls_coordinated_tasks_modify" ON public.coordinated_tasks;
    CREATE POLICY "rls_coordinated_tasks_modify" ON public.coordinated_tasks
      FOR ALL TO authenticated
      USING (
        public.is_admin_user()
        OR EXISTS (
          SELECT 1 FROM public.staff_work_tickets t
          WHERE t.id = ticket_id AND lower(t.owner_email) = lower(public.get_current_user_email())
        )
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. CHÍNH SÁCH BẢO MẬT CHO: workbooks, workbook_revisions & t_tien_do
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 't_tien_do') THEN
    GRANT SELECT, INSERT, UPDATE ON public.t_tien_do TO authenticated;

    DROP POLICY IF EXISTS "rls_t_tien_do_select" ON public.t_tien_do;
    CREATE POLICY "rls_t_tien_do_select" ON public.t_tien_do
      FOR SELECT TO authenticated
      USING (
        public.is_admin_user()
        OR ma_don_vi = public.get_user_unit()
      );

    DROP POLICY IF EXISTS "rls_t_tien_do_modify" ON public.t_tien_do;
    CREATE POLICY "rls_t_tien_do_modify" ON public.t_tien_do
      FOR ALL TO authenticated
      USING (
        public.is_admin_user()
        OR (
          ma_don_vi = public.get_user_unit()
          AND EXISTS (
            SELECT 1 FROM public.user_accounts
            WHERE lower(email) = lower(public.get_current_user_email()) AND role = 'unit_leader'
          )
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'workbooks') THEN
    GRANT SELECT, INSERT, UPDATE ON public.workbooks TO authenticated;

    DROP POLICY IF EXISTS "rls_workbooks_select" ON public.workbooks;
    CREATE POLICY "rls_workbooks_select" ON public.workbooks
      FOR SELECT TO authenticated
      USING (
        public.is_admin_user()
        OR unit_id = public.get_user_unit()
      );

    DROP POLICY IF EXISTS "rls_workbooks_modify" ON public.workbooks;
    CREATE POLICY "rls_workbooks_modify" ON public.workbooks
      FOR ALL TO authenticated
      USING (
        public.is_admin_user()
        OR (
          unit_id = public.get_user_unit()
          AND EXISTS (
            SELECT 1 FROM public.user_accounts
            WHERE lower(email) = lower(public.get_current_user_email()) AND role = 'unit_leader'
          )
        )
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. KHÓA READ-ONLY CHO CÁC BẢNG DANH MỤC GỐC (DÙNG CHUNG TOÀN TRƯỜNG)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  cat_tbl text;
  catalogs text[] := ARRAY['dm_don_vi', 'dm_chuc_danh_tt31', 'dm_vtvl_khung_truong', 'dm_san_pham'];
BEGIN
  FOREACH cat_tbl IN ARRAY catalogs LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = cat_tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', cat_tbl);
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated;', cat_tbl);
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated;', cat_tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_read_only_%s" ON public.%I;', cat_tbl, cat_tbl);
      EXECUTE format('CREATE POLICY "rls_read_only_%s" ON public.%I FOR SELECT TO anon, authenticated USING (true);', cat_tbl, cat_tbl);
    END IF;
  END LOOP;
END $$;
