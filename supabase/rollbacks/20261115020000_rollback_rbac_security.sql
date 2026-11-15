-- ==============================================================================
-- KỊCH BẢN ROLLBACK BẢO MẬT: ROLLBACK HARDENED DATABASE RBAC, RPC & AUDIT LOGS
-- Hệ thống: HCM-UTE VTVL 360 (Trường Đại học Công nghệ Kỹ thuật TP.HCM)
-- Migration mục tiêu để đảo ngược: 20261115020000_hardened_rbac_database_erd.sql
-- Cảnh báo an toàn: KHÔNG DROP DỮ LIỆU ĐÃ LƯU. Chỉ đảo ngược triggers, functions,
--                  constraints và hoàn nguyên RLS policies về phiên bản an toàn trước.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. GỠ BỎ RPC VÀ CÁC THỦ TỤC ĐẶC QUYỀN
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rpc_merge_approved_ticket_to_b1_b2(text);
DROP FUNCTION IF EXISTS public.rpc_review_staff_ticket(text, text, text);

-- ------------------------------------------------------------------------------
-- 2. GỠ BỎ TRIGGER ĐỒNG BỘ CANONICAL TRÊN user_accounts
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_user_account_canonical ON public.user_accounts;
DROP FUNCTION IF EXISTS public.sync_user_account_canonical_columns();

-- ------------------------------------------------------------------------------
-- 3. HOÀN NGUYÊN POLICIES RLS CHO staff_work_tickets
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "policy_staff_tickets_select" ON public.staff_work_tickets;
DROP POLICY IF EXISTS "policy_staff_tickets_insert" ON public.staff_work_tickets;
DROP POLICY IF EXISTS "policy_staff_tickets_update" ON public.staff_work_tickets;
DROP POLICY IF EXISTS "policy_staff_tickets_delete" ON public.staff_work_tickets;

-- Khôi phục policy cơ bản trước đó nếu bảng còn RLS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_work_tickets') THEN
    CREATE POLICY "staff_work_tickets_isolation_v1"
      ON public.staff_work_tickets
      FOR ALL
      TO authenticated
      USING (
        public.is_admin_user()
        OR unit_code = public.get_current_user_unit()
      )
      WITH CHECK (
        public.is_admin_user()
        OR unit_code = public.get_current_user_unit()
      );
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. HOÀN NGUYÊN POLICIES RLS CHO user_accounts
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "policy_user_accounts_select" ON public.user_accounts;
DROP POLICY IF EXISTS "policy_user_accounts_insert" ON public.user_accounts;
DROP POLICY IF EXISTS "policy_user_accounts_update" ON public.user_accounts;
DROP POLICY IF EXISTS "policy_user_accounts_delete" ON public.user_accounts;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_accounts') THEN
    CREATE POLICY "user_accounts_select_auth"
      ON public.user_accounts
      FOR SELECT
      TO authenticated
      USING (
        public.is_admin_user()
        OR lower(email) = lower(public.get_current_user_email())
        OR unit_code = public.get_current_user_unit()
      );

    CREATE POLICY "user_accounts_admin_full"
      ON public.user_accounts
      FOR ALL
      TO authenticated
      USING (public.is_admin_user())
      WITH CHECK (public.is_admin_user());
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. HOÀN NGUYÊN POLICIES RLS CHO workbooks & audit_logs
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "policy_workbooks_select" ON public.workbooks;
DROP POLICY IF EXISTS "policy_workbooks_insert" ON public.workbooks;
DROP POLICY IF EXISTS "policy_workbooks_update" ON public.workbooks;
DROP POLICY IF EXISTS "policy_workbooks_delete" ON public.workbooks;

DROP POLICY IF EXISTS "policy_audit_logs_select" ON public.audit_logs;
DROP POLICY IF EXISTS "policy_audit_logs_insert" ON public.audit_logs;
DROP POLICY IF EXISTS "policy_audit_logs_prevent_tamper" ON public.audit_logs;

-- ------------------------------------------------------------------------------
-- 6. GỠ BỎ HOẶC NỚI LỎNG CÁC CONSTRAINTS ĐÃ THÊM
-- ------------------------------------------------------------------------------
ALTER TABLE public.user_accounts DROP CONSTRAINT IF EXISTS fk_user_accounts_unit_id;
ALTER TABLE public.user_accounts DROP CONSTRAINT IF EXISTS chk_user_accounts_role;
-- Cho phép lại các vai trò cũ nếu có để không break ứng dụng phiên bản trước
ALTER TABLE public.user_accounts
  ADD CONSTRAINT chk_user_accounts_role
  CHECK (role IN ('admin', 'unit_leader', 'staff', 'lanh_dao', 'chuyen_vien', 'user'));

ALTER TABLE public.staff_work_tickets DROP CONSTRAINT IF EXISTS chk_staff_work_tickets_status;
ALTER TABLE public.staff_work_tickets
  ADD CONSTRAINT chk_staff_work_tickets_status
  CHECK (status IN ('Nháp', 'Đã nộp', 'Đã duyệt', 'Trả lại', 'draft', 'submitted', 'approved', 'changes_requested', 'pending', 'rejected'));
