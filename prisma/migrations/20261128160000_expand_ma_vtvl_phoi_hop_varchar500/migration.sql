-- Mở rộng cột ma_vtvl_phoi_hop của bảng staff_work_tickets từ VARCHAR(50) lên VARCHAR(500)
-- Thao tác chỉ cập nhật siêu dữ liệu cột trong PostgreSQL 16 (không viết lại bảng, bảo toàn 100% dữ liệu hiện có).
-- Hỗ trợ kê khai nhiều mã VTVL phối hợp trên cùng một phiếu công việc (đặc biệt vị trí lãnh đạo/phối hợp đa đơn vị).

ALTER TABLE public.staff_work_tickets
  ALTER COLUMN ma_vtvl_phoi_hop TYPE VARCHAR(500);
