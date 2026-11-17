-- =============================================================================
-- MIGRATION: 20261113_user_accounts_and_roles.sql
-- Mô tả: Bảng quản lý tài khoản người dùng đăng nhập và phân quyền hệ thống
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_accounts (
  email text PRIMARY KEY,
  display_name text NOT NULL DEFAULT 'Cán bộ HCM-UTE',
  unit_code text NOT NULL DEFAULT 'FIT' REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE RESTRICT,
  unit_name_vi text NOT NULL DEFAULT 'Khoa Công nghệ thông tin',
  title text NOT NULL DEFAULT 'Chuyên viên',
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'unit_leader', 'editor', 'viewer')),
  auth_provider text NOT NULL DEFAULT 'google' CHECK (auth_provider IN ('google', 'email')),
  avatar_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_unit_code ON public.user_accounts(unit_code);
CREATE INDEX IF NOT EXISTS idx_user_accounts_role ON public.user_accounts(role);

ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.user_accounts TO authenticated;
GRANT ALL ON public.user_accounts TO service_role;

DROP POLICY IF EXISTS "rls_user_accounts_hcmute_read" ON public.user_accounts;
CREATE POLICY "rls_user_accounts_hcmute_read" ON public.user_accounts
  FOR SELECT TO authenticated
  USING (coalesce(auth.jwt() ->> 'email', '') ILIKE '%@hcmute.edu.vn');

DROP POLICY IF EXISTS "rls_user_accounts_self_upsert" ON public.user_accounts;
CREATE POLICY "rls_user_accounts_self_upsert" ON public.user_accounts
  FOR ALL TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email))
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = lower(email));

