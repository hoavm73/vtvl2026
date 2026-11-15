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

DROP FUNCTION IF EXISTS public.rpc_merge_work_survey_to_b1_b2(TEXT, BOOLEAN, TEXT, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.rpc_merge_work_survey_to_b1_b2(TEXT, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.rpc_approve_work_survey(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_request_work_survey_changes(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_resubmit_work_survey(TEXT, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.rpc_submit_work_survey(TEXT, BOOLEAN, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.resolve_trusted_actor(TEXT);

-- Khôi phục trạng thái is_active = TRUE cho toàn bộ bảng dm_don_vi nếu cần hoàn tác danh mục
UPDATE public.dm_don_vi SET is_active = TRUE;

COMMIT;
