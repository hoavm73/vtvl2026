-- =============================================================================
-- MIGRATION: 20261113_google_auth_rls_and_indexes.sql
-- Mô tả: Tối ưu truy vấn & cấp quyền RLS an toàn cho tài khoản Google @hcmute.edu.vn
--        và service_role phía máy chủ Next.js
-- =============================================================================

-- 1. Chỉ mục tối ưu truy vấn bảng t_tien_do & audit_logs
CREATE INDEX IF NOT EXISTS idx_t_tien_do_ma_don_vi ON public.t_tien_do(ma_don_vi);
CREATE INDEX IF NOT EXISTS idx_t_tien_do_updated_at ON public.t_tien_do(updated_at DESC);

-- 2. Bảo đảm service_role luôn có toàn quyền truy cập phía máy chủ
DO $$
DECLARE
  tbl text;
  operational_tables text[] := ARRAY[
    't_tien_do', 's_nhat_ky', 'c1_vtvl', 'a1_nhiem_vu', 'a2_cong_viec',
    'b1_khoi_luong', 'b2_ct_tac_dong', 'b2_thay_doi', 'c2_nang_luc',
    'c3_nhu_cau', 'd1_nhan_luc', 'du_bao_5_nam', 'd2_phuong_an',
    'k_kiem_tra', 'sldv_quy_mo_don_vi', 'sldv_phan_bo_ngach',
    'workbooks', 'workbook_sessions', 'session_participants',
    'workbook_revisions', 'audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY operational_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated;', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role;', tbl);

      EXECUTE format('DROP POLICY IF EXISTS "rls_google_hcmute_rw_%s" ON public.%I;', tbl, tbl);
      EXECUTE format(
        'CREATE POLICY "rls_google_hcmute_rw_%s" ON public.%I FOR ALL TO authenticated ' ||
        'USING (coalesce(auth.jwt() ->> ''email'', '''') ILIKE ''%%@hcmute.edu.vn'') ' ||
        'WITH CHECK (coalesce(auth.jwt() ->> ''email'', '''') ILIKE ''%%@hcmute.edu.vn'');',
        tbl, tbl
      );
    END IF;
  END LOOP;
END $$;

-- 3. Ghi chú thiết lập Google OAuth trên Supabase Dashboard:
-- - Vào Authentication -> Providers -> Google -> Enable
-- - Google Cloud Console -> Authorized redirect URI:
--   https://qhjodwlvwzlaasvpkhkr.supabase.co/auth/v1/callback

