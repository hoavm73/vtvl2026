-- ==============================================================================
-- BẢN MIGRATION BẢO MẬT P0: KHÓA TOÀN DIỆN QUYỀN TRUY CẬP CÔNG KHAI SUPABASE
-- Căn cứ: Yêu cầu an toàn thông tin hệ thống VTVL HCM-UTE
-- Mục tiêu:
--   1. Bật RLS và khóa triệt để anonymous SELECT/INSERT/UPDATE/DELETE trên 23 bảng nghiệp vụ
--   2. Cấu hình READ-ONLY cho 4 bảng danh mục gốc dùng chung (dm_don_vi, dm_chuc_danh_tt31, dm_vtvl_khung_truong, dm_san_pham)
--   3. Cấp toàn quyền truy cập chỉ cho vai trò service_role (API máy chủ Next.js)
--   4. Làm sạch dữ liệu email người dùng đã ghép trong trường chi_tiet của bảng s_nhat_ky
-- ==============================================================================

DO $$
DECLARE
  tbl text;
  -- Danh sách 23 bảng nghiệp vụ nội bộ cần khóa triệt để
  operational_tables text[] := ARRAY[
    's_nhat_ky', 'c1_vtvl', 't_tien_do', 'a1_nhiem_vu', 'a2_cong_viec',
    'b1_khoi_luong', 'b2_ct_tac_dong', 'b2_thay_doi', 'c2_nang_luc',
    'c3_nhu_cau', 'd1_nhan_luc', 'du_bao_5_nam', 'd2_phuong_an',
    'k_kiem_tra', 'sldv_quy_mo_don_vi', 'sldv_phan_bo_ngach',
    'can_cu_goi_y', 'ra_soat_chua_du_can_cu',
    'workbooks', 'workbook_sessions', 'session_participants',
    'workbook_revisions', 'audit_logs'
  ];
  -- Danh mục dùng chung: cho phép đọc công khai (Read-only), cấm ghi/sửa/xóa từ anon
  master_catalogs text[] := ARRAY[
    'dm_don_vi', 'dm_chuc_danh_tt31', 'dm_vtvl_khung_truong', 'dm_san_pham'
  ];
BEGIN
  -- ----------------------------------------------------------------------------
  -- BƯỚC 1: KHÓA TRIỆT ĐỂ CÁC BẢNG NGHIỆP VỤ NỘI BỘ (KHÔNG CHO PHÉP ANON TRUY CẬP)
  -- ----------------------------------------------------------------------------
  FOREACH tbl IN ARRAY operational_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      -- 1.1. Bật RLS
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

      -- 1.2. Thu hồi toàn bộ quyền của anon trên bảng
      EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);

      -- 1.3. Cấp toàn quyền cho service_role trên backend máy chủ
      EXECUTE format('GRANT ALL ON public.%I TO service_role;', tbl);

      -- 1.4. Xóa bỏ tất cả các policy cũ cho phép anon/public truy cập
      EXECUTE format('DROP POLICY IF EXISTS "rls_select_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_insert_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_update_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_delete_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Cho phép đọc workbooks hợp lệ" ON public.%I;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Cho phép cập nhật workbooks qua API" ON public.%I;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Tra cứu participants theo email chuẩn hóa" ON public.%I;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Ghi nhận participant trong phiên" ON public.%I;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Đọc revisions của workbook" ON public.%I;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Ghi nhận revision mới" ON public.%I;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Chỉ cho phép thêm audit logs (Append-only)" ON public.%I;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Chỉ đọc audit logs" ON public.%I;', tbl);
    END IF;
  END LOOP;

  -- ----------------------------------------------------------------------------
  -- BƯỚC 2: CẤU HÌNH READ-ONLY CHO CÁC BẢNG DANH MỤC GỐC (DÙNG CHUNG TOÀN TRƯỜNG)
  -- ----------------------------------------------------------------------------
  FOREACH tbl IN ARRAY master_catalogs LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl);
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated;', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role;', tbl);

      EXECUTE format('DROP POLICY IF EXISTS "rls_select_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_insert_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_update_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_delete_%s" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "rls_read_only_%s" ON public.%I;', tbl, tbl);

      -- Chỉ cho phép SELECT công khai, cấm mọi thao tác INSERT/UPDATE/DELETE
      EXECUTE format('CREATE POLICY "rls_read_only_%s" ON public.%I FOR SELECT TO anon, authenticated USING (true);', tbl, tbl);
    END IF;
  END LOOP;

  -- Cấp quyền sequence cho service_role
  EXECUTE 'GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;';
END $$;

-- ------------------------------------------------------------------------------
-- BƯỚC 3: BẢO VỆ BẢNG AUDIT_LOGS VỚI SERVICE_ROLE (NẾU ĐÃ TẠO)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.audit_logs FROM anon;
    GRANT ALL ON public.audit_logs TO service_role;
    DROP POLICY IF EXISTS "audit_logs_insert_service" ON public.audit_logs;
    DROP POLICY IF EXISTS "audit_logs_select_service" ON public.audit_logs;
    CREATE POLICY "audit_logs_insert_service" ON public.audit_logs FOR INSERT TO service_role WITH CHECK (true);
    CREATE POLICY "audit_logs_select_service" ON public.audit_logs FOR SELECT TO service_role USING (true);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- BƯỚC 4: LÀM SẠCH CHUỖI "chi_tiet" CŨ ĐÃ GHÉP EMAIL TRONG S_NHAT_KY (NẾU CÓ)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 's_nhat_ky') THEN
    UPDATE public.s_nhat_ky
    SET chi_tiet = trim(regexp_replace(chi_tiet, '\s*\[Người thực hiện:\s*[^\]]+\]', '', 'g'))
    WHERE chi_tiet ~ '\[Người thực hiện:';
  END IF;
END $$;
