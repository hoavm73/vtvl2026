# Từ điển dữ liệu (Data Dictionary) Phiếu công việc, Phiên bản & Lịch sử phê duyệt

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Ngày cập nhật: 15/11/2026  

---

## 1. Bảng `public.staff_work_tickets` (Phiếu khảo sát khối lượng công việc cá nhân)

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `id` | `VARCHAR(100)` | `PRIMARY KEY` | Mã định danh duy nhất của phiếu (`tkt-[MÃ_ĐV]-[TIMESTAMP]-[RAND]`) |
| `owner_id` | `VARCHAR(255)` | `REFERENCES user_accounts(email)` | Định danh cán bộ kê khai (canonical) |
| `owner_email` | `VARCHAR(255)` | `NOT NULL` | Email công vụ HCM-UTE của cán bộ kê khai |
| `owner_name` | `VARCHAR(255)` | `NOT NULL` | Họ và tên người kê khai |
| `owner_title` | `VARCHAR(100)` | `NOT NULL` | Chức danh / Vị trí công tác của người kê khai |
| `unit_id` | `VARCHAR(50)` | `REFERENCES dm_don_vi(ma_don_vi)` | Mã đơn vị trực thuộc (canonical) |
| `unit_code` | `VARCHAR(50)` | `NOT NULL` | Mã đơn vị công tác thuộc 39 đơn vị hoạt động (`CTL`, `CK`, `CNTT`, `SDH`, `QTTHTT`, `TCNS`, `BANTT`...) |
| `status` | `VARCHAR(50)` | `NOT NULL CHECK (status IN (...))` | 5 trạng thái chuẩn: `draft`, `submitted`, `changes_requested`, `resubmitted`, `approved` |
| `ma_nhiem_vu` | `VARCHAR(50)` | `NOT NULL` | Mã nhiệm vụ cha liên kết từ Biểu A1 |
| `ma_cong_viec` | `VARCHAR(100)` | `NOT NULL` | Mã công việc định mức (`[Mã NV].CVxx`) |
| `ten_cong_viec` | `TEXT` | `NOT NULL` | Tên công việc cụ thể |
| `ma_vtvl` | `VARCHAR(50)` | `NOT NULL` | Mã VTVL chính từ Biểu C1 |
| `ma_vtvl_phoi_hop` | `VARCHAR(50)` | Nullable | Mã VTVL phối hợp từ Biểu C1 (nếu có) |
| `san_pham` | `TEXT` | Default `''` | Sản phẩm đầu ra cụ thể |
| `chat_luong` | `TEXT` | Default `''` | Tiêu chuẩn chất lượng sản phẩm |
| `can_cu` | `TEXT` | Default `''` | Căn cứ pháp lý, văn bản, kế hoạch phân công |
| `so_sp_nam` | `NUMERIC` | `NOT NULL DEFAULT 0` | Số sản phẩm hoàn thành trong năm trong chu kỳ 1 năm (01/10/2025 đến 30/9/2026) |
| `nguon_so_lieu` | `TEXT` | Default `''` | Giải trình nguồn số liệu sản lượng |
| `phut_thuc_te` | `NUMERIC` | `NOT NULL DEFAULT 0` | Thời gian trung bình hoàn thành 1 sản phẩm (phút) |
| `gio_bo_sung` | `NUMERIC` | `NOT NULL DEFAULT 0` | Giờ bổ sung (Nếu có) |
| `coordinated_tasks` | `JSONB` | Default `'[]'` | Danh mục công việc phối hợp liên đơn vị (so sánh theo `id` ổn định) |
| `coordination_note` | `TEXT` | Nullable | Nội dung phối hợp ngắn kèm theo mã VTVL phối hợp (nếu có) |
| `coordinated_vtvls` | `JSONB` | Default `'[]'` | Danh sách mở rộng các mã VTVL phối hợp cùng/khác đơn vị |
| `current_version_no` | `INTEGER` | `NOT NULL DEFAULT 0` | Số phiên bản nộp hiện hành (`0` khi còn ở `draft`, tăng `1, 2, 3...` mỗi lần nộp/nộp lại) |
| `last_change_summary` | `TEXT` | Nullable | Giải trình nội dung cập nhật gần nhất khi nộp lại |
| `source_ticket_id` | `VARCHAR(100)` | Nullable | Khóa nguồn chống gộp trùng |
| `submitted_at` | `TIMESTAMPTZ` | Nullable | Thời điểm cán bộ nộp phiếu lần đầu |
| `resubmitted_at` | `TIMESTAMPTZ` | Nullable | Thời điểm cán bộ nộp lại gần nhất |
| `approved_at` | `TIMESTAMPTZ` | Nullable | Thời điểm phiếu được Lãnh đạo/Admin duyệt |
| `approved_by` | `VARCHAR(255)` | Nullable | Email người phê duyệt phiếu |
| `revision_reason` | `TEXT` | Nullable | Lý do Lãnh đạo/Admin yêu cầu bổ sung |
| `revision_requested_at` | `TIMESTAMPTZ` | Nullable | Thời điểm yêu cầu chỉnh sửa |
| `revision_requested_by` | `VARCHAR(255)` | Nullable | Email người yêu cầu chỉnh sửa |
| `is_merged_to_b1_b2` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Đánh dấu đã gộp vào hồ sơ biểu đơn vị |
| `a2_row_id` | `VARCHAR(100)` | Nullable | Khóa bản ghi sinh ra trong Biểu A2 (`a2-[id]`) |
| `b1_row_id` | `VARCHAR(100)` | Nullable | Khóa bản ghi sinh ra trong Biểu B1 (`b1-[id]`) |
| `b2_row_id` | `VARCHAR(100)` | Nullable | Khóa bản ghi sinh ra trong Biểu B2 (`NULL` nếu phiếu không có dữ liệu tác động B2) |
| `merged_at` | `TIMESTAMPTZ` | Nullable | Thời điểm gộp vào biểu |
| `merged_by` | `VARCHAR(255)` | Nullable | Người kích hoạt gộp dữ liệu |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm khởi tạo bản ghi |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm cập nhật bản ghi gần nhất |

---

## 2. Bảng `public.work_survey_versions` (Lịch sử phiên bản nộp bất biến của phiếu)

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Khóa chính phiên bản |
| `survey_id` | `VARCHAR(100)` | `NOT NULL REFERENCES staff_work_tickets(id) ON DELETE CASCADE` | Mã phiếu khảo sát công việc |
| `version_no` | `INTEGER` | `NOT NULL CHECK (version_no > 0)` | Số thứ tự phiên bản nguyên dương (`1, 2, 3...`) |
| `snapshot` | `JSONB` | `NOT NULL` | Snapshot bất biến chứa toàn bộ trường kê khai, mã + tên danh mục tại thời điểm nộp và `coordinatedTasks` (không chứa thông tin xác thực) |
| `submitted_by` | `VARCHAR(255)` | `NOT NULL` | Email người thực hiện nộp / nộp lại |
| `submitted_at` | `TIMESTAMPTZ` | Nullable | Thời điểm nộp chính thức (`NULL` nếu là bản ghi chuyển đổi dữ liệu cũ không rõ ngày nộp gốc) |
| `change_summary` | `TEXT` | Nullable | Nội dung giải trình cập nhật khi nộp lại (hoặc `"Bản ghi chuyển đổi dữ liệu"` đối với baseline) |
| `is_migration_baseline` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | Đánh dấu bản ghi chuyển đổi dữ liệu lịch sử |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm tạo bản ghi |
| *(Ràng buộc Unique)* | — | `UNIQUE (survey_id, version_no)` | Đảm bảo mỗi phiên bản của một phiếu là duy nhất |
| *(Trigger Bất biến)* | — | `BEFORE UPDATE OR DELETE` | Cấm tuyệt đối việc ghi đè hoặc xóa snapshot cũ |

---

## 3. Bảng `public.work_survey_status_history` (Nhật ký lịch sử chuyển trạng thái bất biến)

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Khóa chính nhật ký |
| `survey_id` | `VARCHAR(100)` | `NOT NULL REFERENCES staff_work_tickets(id) ON DELETE CASCADE` | Mã phiếu liên quan |
| `from_status` | `VARCHAR(50)` | Nullable | Trạng thái trước khi chuyển |
| `to_status` | `VARCHAR(50)` | `NOT NULL` | Trạng thái mới được xác lập |
| `action` | `VARCHAR(50)` | `NOT NULL` | Hành động: `SUBMIT`, `REQUEST_CHANGES`, `RESUBMIT`, `APPROVE`, `MERGE_TO_SHEETS` |
| `reason` | `TEXT` | Nullable | Lý do yêu cầu bổ sung hoặc giải trình nộp lại |
| `actor_id` | `VARCHAR(255)` | `NOT NULL` | Email người thực hiện thao tác |
| `actor_role` | `VARCHAR(50)` | `NOT NULL` | Vai trò tại thời điểm thực hiện (`admin`, `unit_leader`, `staff`) |
| `unit_id` | `VARCHAR(50)` | `NOT NULL` | Đơn vị liên quan |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm diễn ra thao tác |

---

## 4. Bảng `public.work_survey_merge_links` (Liên kết bản ghi gộp A2/B1/B2)

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Khóa chính liên kết |
| `survey_id` | `VARCHAR(100)` | `NOT NULL REFERENCES staff_work_tickets(id) ON DELETE CASCADE` | Mã phiếu nguồn |
| `target_sheet` | `VARCHAR(20)` | `NOT NULL CHECK (target_sheet IN ('A2', 'B1', 'B2'))` | Biểu nhận dữ liệu gộp |
| `target_record_id` | `VARCHAR(100)` | `NOT NULL` | Khóa dòng đích trong biểu nhận (`a2-[ticket_id]`, `b1-[ticket_id]`, `b2-[ticket_id]`) |
| `source_version` | `INTEGER` | `NOT NULL DEFAULT 1 CHECK (source_version >= 1)` | Số phiên bản của phiếu tại thời điểm được gộp |
| `merged_by` | `VARCHAR(255)` | `NOT NULL` | Email người thực hiện gộp |
| `merged_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm gộp lần đầu |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm cập nhật lại dữ liệu gộp |
| *(Ràng buộc Unique)* | — | `UNIQUE (survey_id, target_sheet, target_record_id)` | Khóa chống trùng phân biệt từng dòng đích trên từng biểu |

---

## 5. Bảng `public.audit_logs` (Nhật ký kiểm toán bảo mật bất biến)

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Khóa chính nhật ký kiểm toán |
| `workbook_id` | `TEXT` | Nullable | Định danh bảng tính đơn vị (`wb_[UNIT]_2026`) |
| `actor_email` | `TEXT` | `NOT NULL` | Email người thực hiện thao tác |
| `actor_role` | `TEXT` | Nullable | Vai trò người thực hiện (`admin`, `unit_leader`, `staff`) |
| `unit_id` | `TEXT` | Nullable | Mã đơn vị liên quan |
| `action` | `TEXT` | `NOT NULL` | Tên hành động (`NỘP_PHIẾU`, `NỘP_LẠI_PHIẾU`, `DUYỆT_PHIẾU`, `YÊU_CẦU_BỔ_SUNG_PHIẾU`, `GỘP_PHIẾU_A2_B1`, `THAY_ĐỔI_TÀI_KHOẢN`, `SAVE_WORKBOOK`...) |
| `target_id` | `TEXT` | Nullable | Định danh bản ghi đích bị tác động |
| `target_entity` | `TEXT` | Nullable | Tên bảng/thực thể đích (`staff_work_tickets`, `user_accounts`, `workbooks`) |
| `old_values` | `JSONB` | Nullable | Giá trị trước thay đổi (đã lọc bỏ mật khẩu, token, secret) |
| `new_values` | `JSONB` | Nullable | Giá trị sau thay đổi (đã lọc bỏ mật khẩu, token, secret) |
| `metadata` | `JSONB` | Default `'{}'` | Thông tin ngữ cảnh bổ sung |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm ghi nhận nhật ký |

---

## 6. Bảng `public.user_vtvl_assignments` (Phân công tường minh Tài khoản ↔ Mã VTVL)

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Khóa chính phân công |
| `user_email` | `VARCHAR(255)` | `NOT NULL REFERENCES user_accounts(email) ON DELETE CASCADE` | Email tài khoản cán bộ được phân công |
| `unit_code` | `VARCHAR(50)` | `NOT NULL REFERENCES dm_don_vi(ma_don_vi)` | Đơn vị chứa mã VTVL (chống trùng mã giữa 2 đơn vị) |
| `ma_vtvl` | `VARCHAR(80)` | `NOT NULL CHECK (length(trim(ma_vtvl)) > 0)` | Mã VTVL từ Biểu C1 của đơn vị |
| `ten_vtvl` | `TEXT` | Nullable | Tên VTVL tại thời điểm phân công |
| `is_active` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | Cờ hiệu lực phân công |
| `assigned_by` | `VARCHAR(255)` | Nullable | Email Admin / Lãnh đạo thực hiện phân công |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm phân công |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm cập nhật |
| *(Ràng buộc Unique)* | — | `UNIQUE (user_email, unit_code, ma_vtvl)` | Cho phép gán nhiều VTVL/người và nhiều người/VTVL mà không trùng lặp |

---

## 7. Bảng `public.work_survey_coordinated_vtvls` (Đề xuất phối hợp theo phiên bản đã nộp)

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Khóa chính bản ghi đề xuất |
| `survey_id` | `VARCHAR(100)` | `NOT NULL REFERENCES staff_work_tickets(id) ON DELETE CASCADE` | Mã phiếu khảo sát nguồn |
| `version_no` | `INTEGER` | `NOT NULL CHECK (version_no >= 1)` | Phiên bản đã nộp (`v1`, `v2`...) |
| `task_row_id` | `VARCHAR(120)` | `NOT NULL` | Định danh dòng công việc ổn định (`sourceTicketId || ticket.id`) |
| `host_unit_code` | `VARCHAR(50)` | `NOT NULL REFERENCES dm_don_vi(ma_don_vi)` | Đơn vị chủ trì đề xuất phối hợp |
| `target_unit_code` | `VARCHAR(50)` | `NOT NULL REFERENCES dm_don_vi(ma_don_vi)` | Đơn vị chứa mã VTVL phối hợp |
| `target_vtvl_code` | `VARCHAR(80)` | `NOT NULL CHECK (length(trim(target_vtvl_code)) > 0)` | Mã VTVL nhận đề xuất phối hợp |
| `target_vtvl_name` | `TEXT` | Nullable | Tên VTVL tại thời điểm nộp |
| `coordination_note` | `TEXT` | Nullable | Nội dung phối hợp đề xuất (nếu có) |
| `is_latest_submitted` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` | Đánh dấu phiên bản đã nộp mới nhất (danh sách hiện hành chỉ đọc cờ `TRUE`, cô lập bản nháp đang sửa) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Thời điểm ghi nhận đề xuất |
| *(Ràng buộc Unique)* | — | `UNIQUE (survey_id, version_no, task_row_id, target_unit_code, target_vtvl_code)` | Khóa chống trùng lặp quan hệ phối hợp theo phiên bản |
