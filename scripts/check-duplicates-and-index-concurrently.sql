-- =========================================================================================
-- KỊCH BẢN KIỂM TRA TRÙNG DỮ LIỆU & ĐÁNH CHỈ MỤC KHÔNG KHÓA BẢNG (CONCURRENTLY)
-- Dự án: HCM-UTE VTVL 360
-- Hướng dẫn:
--   1) Chạy Phần 1 (Kiểm tra trùng) trước khi thêm Unique Index trên Production.
--   2) Chạy Phần 2 bằng `psql "$DIRECT_URL" -f scripts/check-duplicates-and-index-concurrently.sql`
--      (Lệnh CREATE INDEX CONCURRENTLY bắt buộc chạy ngoài transaction block).
-- =========================================================================================

-- =========================================================================================
-- PHẦN 1: TRUY VẤN KIỂM TRA DỮ LIỆU TRÙNG (READ-ONLY — KHÔNG XÓA DỮ LIỆU)
-- =========================================================================================

-- 1.1. Kiểm tra trùng mã công việc trong cùng đơn vị: (unit_code, ma_cong_viec)
SELECT
  unit_code,
  ma_cong_viec,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id ORDER BY created_at ASC) AS ticket_ids
FROM public.staff_work_tickets
WHERE is_archived = false
GROUP BY unit_code, ma_cong_viec
HAVING COUNT(*) > 1;

-- 1.2. Kiểm tra trùng số thứ tự phiên bản trên cùng phiếu khảo sát: (survey_id, version_no)
SELECT
  survey_id,
  version_no,
  COUNT(*) AS duplicate_count,
  ARRAY_AGG(id ORDER BY created_at ASC) AS version_ids
FROM public.work_survey_versions
GROUP BY survey_id, version_no
HAVING COUNT(*) > 1;

-- =========================================================================================
-- PHẦN 2: TẠO CHỈ MỤC KHÔNG KHÓA BẢNG (CREATE INDEX CONCURRENTLY)
-- =========================================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_unit_status_updated
  ON public.staff_work_tickets (unit_code, status, updated_at DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_owner_updated
  ON public.staff_work_tickets (owner_email, updated_at DESC, id DESC);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_versions_survey_version
  ON public.work_survey_versions (survey_id, version_no);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_status_history_survey_created
  ON public.work_survey_status_history (survey_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_pending_merge
  ON public.staff_work_tickets (unit_code, approved_at)
  WHERE status = 'approved' AND is_merged_to_b1_b2 = false AND is_archived = false;
