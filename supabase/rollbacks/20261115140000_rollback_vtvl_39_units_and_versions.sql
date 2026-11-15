-- ==============================================================================
-- BẢN ROLLBACK AN TOÀN (KHÔNG LÀM MẤT DỮ LIỆU):
-- Hoàn tác cấu hình RPC, trigger, policy của 20261115140000_reconcile_vtvl_39_units_and_versions.sql
--
-- PHẠM VI KHÔI PHỤC TỰ ĐỘNG:
-- 1. Gỡ các trigger chặn sửa/xóa bản ghi bất biến và trigger chuẩn hóa trạng thái.
-- 2. Gỡ các RPC mới (resolve_trusted_actor, rpc_submit_work_survey, rpc_resubmit_work_survey,
--    rpc_request_work_survey_changes, rpc_approve_work_survey, rpc_merge_work_survey_to_b1_b2).
-- 3. Khôi phục is_active = TRUE cho toàn bộ các dòng trong public.dm_don_vi.
--
-- GIỚI HẠN BẢO TOÀN DỮ LIỆU (KHÔNG TỰ ĐỘNG XÓA):
-- - KHÔNG DROP bảng dữ liệu (work_survey_versions, work_survey_status_history, work_survey_merge_links,
--   staff_work_tickets, audit_logs) và KHÔNG DROP các cột mới thêm để tránh mất mát lịch sử.
-- - Các trạng thái đã ánh xạ sang canonical ('draft', 'submitted', 'changes_requested',
--   'resubmitted', 'approved') vẫn tương thích ngược với constraint chk_staff_work_tickets_status.
-- ==============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_immutable_work_survey_versions ON public.work_survey_versions;
DROP TRIGGER IF EXISTS trg_immutable_work_survey_status_history ON public.work_survey_status_history;
DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON public.audit_logs;
DROP TRIGGER IF EXISTS trg_sanitize_audit_logs ON public.audit_logs;
DROP TRIGGER IF EXISTS trg_sync_staff_work_ticket_canonical ON public.staff_work_tickets;

DROP POLICY IF EXISTS "rls_work_survey_versions_select" ON public.work_survey_versions;
DROP POLICY IF EXISTS "rls_work_survey_versions_insert" ON public.work_survey_versions;
DROP POLICY IF EXISTS "rls_wssh_select" ON public.work_survey_status_history;
DROP POLICY IF EXISTS "rls_wsml_select" ON public.work_survey_merge_links;
DROP POLICY IF EXISTS "service_role_full_work_survey_versions" ON public.work_survey_versions;
DROP POLICY IF EXISTS "service_role_full_work_survey_status_history" ON public.work_survey_status_history;
DROP POLICY IF EXISTS "service_role_full_work_survey_merge_links" ON public.work_survey_merge_links;

DROP POLICY IF EXISTS "rls_staff_tickets_select" ON public.staff_work_tickets;
CREATE POLICY "staff_tickets_select_auth" ON public.staff_work_tickets
  FOR SELECT TO authenticated
  USING (
    public.is_tcns_admin()
    OR (owner_email)::text = public.current_auth_email()
    OR (
      (unit_code)::text = public.get_auth_unit()
      AND (public.get_auth_role() = 'unit_leader' OR (status)::text IN ('Đã nộp', 'submitted'))
    )
  );

DROP POLICY IF EXISTS "rls_staff_tickets_update" ON public.staff_work_tickets;
CREATE POLICY "staff_tickets_update_auth" ON public.staff_work_tickets
  FOR UPDATE TO authenticated
  USING (
    public.is_tcns_admin()
    OR (((unit_code)::text = public.get_auth_unit()) AND ((owner_email)::text = public.current_auth_email()))
  )
  WITH CHECK (
    public.is_tcns_admin()
    OR (((unit_code)::text = public.get_auth_unit()) AND ((owner_email)::text = public.current_auth_email()))
  );

DROP FUNCTION IF EXISTS public.rpc_merge_work_survey_to_b1_b2(TEXT, BOOLEAN, TEXT, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.rpc_merge_work_survey_to_b1_b2(TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.rpc_approve_work_survey(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_request_work_survey_changes(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_resubmit_work_survey(TEXT, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_submit_work_survey(TEXT, BOOLEAN, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.resolve_trusted_actor(TEXT);

-- Khôi phục trạng thái is_active = TRUE cho toàn bộ bảng dm_don_vi nếu cần hoàn tác danh mục
UPDATE public.dm_don_vi SET is_active = TRUE;

-- Xóa bản ghi lịch sử migration nếu bảng tồn tại
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261115140000';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
