-- ==============================================================================
-- KỊCH BẢN ROLLBACK: ROLLBACK WORK SURVEY LIFECYCLE & AUDIT HISTORY
-- Hệ thống: HCM-UTE VTVL 360 (Trường Đại học Công nghệ Kỹ thuật TP.HCM)
-- Migration mục tiêu để đảo ngược: 20261115030000_work_survey_lifecycle_erd.sql
-- Cảnh báo an toàn: KHÔNG DROP DỮ LIỆU ĐÃ LƯU TRONG staff_work_tickets.
--                  Chỉ gỡ bỏ RPC functions, bảng liên kết gộp và bảng lịch sử trạng thái phụ trợ.
-- ==============================================================================

-- 1. GỠ BỎ CÁC HÀM RPC ĐẶC QUYỀN
DROP FUNCTION IF EXISTS public.rpc_merge_work_survey_to_b1_b2(text);
DROP FUNCTION IF EXISTS public.rpc_approve_work_survey(text);
DROP FUNCTION IF EXISTS public.rpc_request_work_survey_changes(text, text);
DROP FUNCTION IF EXISTS public.rpc_submit_work_survey(text, boolean);

-- 2. GỠ BỎ BẢNG LIÊN KẾT GỘP VÀ LỊCH SỬ TRẠNG THÁI
DROP TABLE IF EXISTS public.work_survey_merge_links CASCADE;
DROP TABLE IF EXISTS public.work_survey_status_history CASCADE;

-- 3. KHÔI PHỤC RÀNG BUỘC TRẠNG THÁI CŨ NẾU CẦN
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_work_tickets') THEN
    ALTER TABLE public.staff_work_tickets DROP CONSTRAINT IF EXISTS chk_staff_work_tickets_status;
    ALTER TABLE public.staff_work_tickets
      ADD CONSTRAINT chk_staff_work_tickets_status
      CHECK (status IN ('Nháp', 'Đã nộp', 'Đã duyệt', 'Trả lại', 'draft', 'submitted', 'approved', 'changes_requested'));
  END IF;
END $$;
