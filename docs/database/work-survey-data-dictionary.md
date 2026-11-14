# Từ điển dữ liệu (Data Dictionary) Phiếu công việc & Lịch sử phê duyệt

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Ngày cập nhật: 15/11/2026  

---

## 1. Bảng `public.staff_work_tickets` (Phiếu khảo sát khối lượng công việc cá nhân)

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `id` | `VARCHAR(100)` | `PRIMARY KEY` | Mã định danh duy nhất của phiếu (`tkt-[MÃ_ĐV]-[TIMESTAMP]-[RAND]`) |
| `owner_id` | `VARCHAR(255)` | `REFERENCES user_accounts(user_id)` | Định danh cán bộ kê khai (canonical) |
| `owner_email` | `VARCHAR(255)` | `NOT NULL` | Email công vụ HCM-UTE của cán bộ kê khai |
| `owner_name` | `VARCHAR(255)` | `NOT NULL` | Họ và tên người kê khai |
| `owner_title` | `VARCHAR(100)` | `NOT NULL` | Chức danh / Vị trí công tác của người kê khai |
| `unit_id` | `VARCHAR(50)` | `REFERENCES dm_don_vi(ma_don_vi)` | Mã đơn vị trực thuộc (canonical) |
| `unit_code` | `VARCHAR(50)` | `NOT NULL` | Mã đơn vị công tác (FIT, FME, SDH, TCNS...) |
| `status` | `VARCHAR(50)` | `NOT NULL CHECK (status IN (...))` | Trạng thái: `draft`, `submitted`, `changes_requested`, `resubmitted`, `approved` |
| `ma_nhiem_vu` | `VARCHAR(50)` | `NOT NULL` | Mã nhiệm vụ cha liên kết từ Biểu A1 |
| `ma_cong_viec` | `VARCHAR(100)` | `NOT NULL` | Mã công việc định mức (`[Mã NV].CVxx`) |
| `ten_cong_viec` | `TEXT` | `NOT NULL` | Tên công việc cụ thể |
| `ma_vtvl` | `VARCHAR(50)` | `NOT NULL` | Mã VTVL chính từ Biểu C1 |
| `ma_vtvl_phoi_hop` | `VARCHAR(50)` | Nullable | Mã VTVL phối hợp từ Biểu C1 (nếu có) |
| `san_pham` | `TEXT` | Default `''` | Sản phẩm đầu ra cụ thể |
| `chat_luong` | `TEXT` | Default `''` | Tiêu chuẩn chất lượng sản phẩm |
| `can_cu` | `TEXT` | Default `''` | Căn cứ pháp lý, văn bản, kế hoạch phân công |
| `so_sp_nam` | `NUMERIC` | `NOT NULL DEFAULT 0` | Số lượng sản phẩm tạo ra trong năm học |
| `nguon_so_lieu` | `TEXT` | Default `''` | Giải trình nguồn số liệu sản lượng |
| `phut_thuc_te` | `NUMERIC` | `NOT NULL DEFAULT 0` | Thời gian trung bình hoàn thành 1 sản phẩm (phút) |
| `gio_bo_sung` | `NUMERIC` | `NOT NULL DEFAULT 0` | Giờ định mức bổ sung trong năm |
| `coordinated_tasks`| `JSONB` | Default `'[]'` | Danh mục công việc phối hợp liên đơn vị |
| `source_ticket_id` | `VARCHAR(100)` | Nullable | Khóa nguồn chống gộp trùng vào B1/B2 |
| `submitted_at` | `TIMESTAMPTZ` | Nullable | Thời điểm cán bộ nộp phiếu lần đầu |
| `resubmitted_at` | `TIMESTAMPTZ` | Nullable | Thời điểm cán bộ nộp lại sau bổ sung |
| `approved_at` | `TIMESTAMPTZ` | Nullable | Thời điểm phiếu được Lãnh đạo/Admin duyệt |
| `approved_by` | `VARCHAR(255)` | Nullable | Email người phê duyệt phiếu |
| `revision_reason` | `TEXT` | Nullable | Lý do Lãnh đạo yêu cầu bổ sung |
| `revision_requested_at` | `TIMESTAMPTZ` | Nullable | Thời điểm yêu cầu chỉnh sửa |
| `revision_requested_by` | `VARCHAR(255)` | Nullable | Email người yêu cầu chỉnh sửa |
| `is_merged_to_b1_b2` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Đánh dấu đã gộp vào hồ sơ chính thức đơn vị |
| `b1_row_id` | `VARCHAR(100)` | Nullable | Khóa bản ghi sinh ra trong Biểu B1 |
| `b2_row_id` | `VARCHAR(100)` | Nullable | Khóa bản ghi sinh ra trong Biểu B2/A2 |
| `merged_at` | `TIMESTAMPTZ` | Nullable | Thời điểm gộp vào B1/B2 |
| `merged_by` | `VARCHAR(255)` | Nullable | Người kích hoạt gộp dữ liệu |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm khởi tạo bản ghi |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm cập nhật bản ghi gần nhất |

---

## 2. Bảng `public.work_survey_status_history` (Nhật ký lịch sử chuyển trạng thái)

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Khóa chính nhật ký |
| `survey_id` | `VARCHAR(100)` | `NOT NULL REFERENCES staff_work_tickets(id)` | Mã phiếu liên quan |
| `from_status` | `VARCHAR(50)` | Nullable | Trạng thái trước khi chuyển |
| `to_status` | `VARCHAR(50)` | `NOT NULL` | Trạng thái mới được xác lập |
| `action` | `VARCHAR(50)` | `NOT NULL` | Hành động: `CREATE`, `SUBMIT`, `REQUEST_CHANGES`, `RESUBMIT`, `APPROVE`, `MERGE` |
| `reason` | `TEXT` | Nullable | Ý kiến phản hồi / Lý do yêu cầu chỉnh sửa |
| `actor_id` | `VARCHAR(255)` | `NOT NULL` | Email hoặc User ID người thực hiện thao tác |
| `actor_role` | `VARCHAR(50)` | `NOT NULL` | Vai trò của người thực hiện (`admin`, `unit_leader`, `staff`) |
| `unit_id` | `VARCHAR(50)` | `NOT NULL` | Đơn vị liên quan |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm diễn ra thao tác |

---

## 3. Bảng `public.work_survey_merge_links` (Liên kết bản ghi gộp B1/B2)

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Khóa chính liên kết |
| `survey_id` | `VARCHAR(100)` | `NOT NULL REFERENCES staff_work_tickets(id)` | Mã phiếu nguồn |
| `target_sheet` | `VARCHAR(10)` | `NOT NULL CHECK (target_sheet IN ('B1', 'B2', 'A2'))` | Biểu nhận dữ liệu gộp |
| `target_record_id` | `VARCHAR(100)` | `NOT NULL` | Khóa bản ghi trong biểu nhận (`b1-[ticket_id]`, `a2-[ticket_id]`) |
| `source_version` | `INT` | `NOT NULL DEFAULT 1` | Phiên bản của phiếu tại thời điểm gộp |
| `merged_by` | `VARCHAR(255)` | `NOT NULL` | Email người thực hiện gộp |
| `merged_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm gộp lần đầu |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm cập nhật lại dữ liệu gộp |
| *(Ràng buộc Unique)* | - | `UNIQUE (survey_id, target_sheet)` | Ngăn chặn tuyệt đối việc tạo nhiều dòng trùng cho 1 phiếu |
