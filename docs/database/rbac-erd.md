# Sơ đồ quan hệ thực thể (ERD) & Mô hình phân quyền HCM-UTE VTVL 360

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Ngày cập nhật: 15/11/2026  

---

## 1. Sơ đồ thực thể quan hệ (Mermaid ERD)

```mermaid
erDiagram
    AUTH_USERS ||--|| USER_ACCOUNTS : "has (liên kết xác thực qua email/sub)"
    DM_DON_VI ||--o{ USER_ACCOUNTS : "contains (quản lý tài khoản thuộc đơn vị)"
    DM_DON_VI ||--o{ WORKBOOKS : "owns (sở hữu hồ sơ 15 biểu)"
    USER_ACCOUNTS ||--o{ STAFF_WORK_TICKETS : "creates (kê khai và sở hữu phiếu)"
    DM_DON_VI ||--o{ STAFF_WORK_TICKETS : "scopes (phạm vi đơn vị của phiếu)"
    STAFF_WORK_TICKETS ||--o{ WORK_SURVEY_VERSIONS : "snapshots (phiên bản bất biến v1, v2...)"
    STAFF_WORK_TICKETS ||--o{ WORK_SURVEY_STATUS_HISTORY : "has (lịch sử trạng thái vòng đời)"
    STAFF_WORK_TICKETS ||--o{ WORK_SURVEY_MERGE_LINKS : "merges (liên kết gộp chính thức A2/B1/B2)"
    USER_ACCOUNTS ||--o{ AUDIT_LOGS : "performs (người thực hiện thao tác)"
    DM_DON_VI ||--o{ AUDIT_LOGS : "scopes (phạm vi đơn vị bị tác động)"

    AUTH_USERS {
        uuid id PK "Khóa chính Supabase Auth"
        string email UK "Email công vụ @hcmute.edu.vn"
        timestamp created_at "Thời gian đăng ký"
    }

    USER_ACCOUNTS {
        string email PK "Email công vụ HCM-UTE"
        string user_id UK "Định danh người dùng canonical"
        string full_name "Họ và tên cán bộ / giảng viên"
        string role "Vai trò: admin | unit_leader | staff"
        string unit_id FK "Mã đơn vị canonical (FK dm_don_vi)"
        string unit_code "Mã đơn vị tương thích cũ"
        string unit_name_vi "Tên đầy đủ của đơn vị"
        string title "Chức vụ / Chức danh công tác"
        boolean is_active "Trạng thái hoạt động tài khoản"
        string status "active | suspended"
        string password_hash "Băm mật khẩu PBKDF2/Argon2 (Internal)"
        timestamp created_at "Thời điểm khởi tạo"
        timestamp updated_at "Thời điểm cập nhật gần nhất"
    }

    DM_DON_VI {
        string ma_don_vi PK "Mã định danh đơn vị (39 đơn vị hoạt động)"
        string ten_don_vi_vi "Tên đầy đủ đơn vị tiếng Việt"
        string ten_don_vi_en "Tên đơn vị tiếng Anh"
        string loai_don_vi "khoa-vien | phong-ban | trung-tam | dang-doanthe"
        boolean is_active "Đơn vị đang hoạt động (TRUE cho 39 đơn vị chuẩn)"
        timestamp updated_at "Thời điểm cập nhật"
    }

    WORKBOOKS {
        string unit_code PK "Mã đơn vị sở hữu hồ sơ 15 biểu"
        string unit_name "Tên đơn vị"
        string status "draft | submitted | approved | locked"
        jsonb data "Dữ liệu 15 biểu: A1, A2, B1, B2, C1, C2, C3, D1, D2..."
        boolean c1_locked "Khóa chỉnh sửa biểu C1 cơ cấu vị trí"
        string locked_by "Email người khóa C1"
        timestamp locked_at "Thời điểm khóa C1"
        integer current_revision "Phiên bản sửa đổi hiện tại"
        timestamp updated_at "Thời điểm cập nhật gần nhất"
    }

    STAFF_WORK_TICKETS {
        string id PK "Mã phiếu: tkt-UNIT-TIME-RAND"
        string owner_id FK "ID chủ sở hữu (user_accounts.user_id / email)"
        string owner_email "Email chủ sở hữu"
        string owner_name "Họ và tên người kê khai"
        string owner_title "Chức vụ / Chức danh"
        string unit_id FK "ID đơn vị công tác (dm_don_vi.ma_don_vi)"
        string unit_code "Mã đơn vị"
        string status "draft | submitted | changes_requested | resubmitted | approved"
        integer current_version_no "Số hiệu phiên bản đã nộp hiện hành (0, 1, 2...)"
        string last_change_summary "Giải trình nội dung đã cập nhật"
        string ma_nhiem_vu "Mã nhiệm vụ liên kết Biểu A1"
        string ma_cong_viec "Mã công việc [Mã NV].CVxx"
        string ten_cong_viec "Tên công việc cụ thể"
        string ma_vtvl "Mã vị trí việc làm Biểu C1"
        string ma_vtvl_phoi_hop "Mã VTVL phối hợp"
        string san_pham "Sản phẩm đầu ra"
        string chat_luong "Tiêu chuẩn chất lượng"
        string can_cu "Căn cứ pháp lý / tài liệu"
        numeric so_sp_nam "Số sản phẩm / năm"
        numeric phut_thuc_te "Phút thực tế / sản phẩm"
        numeric gio_bo_sung "Giờ bổ sung / năm"
        string nguon_so_lieu "Nguồn số liệu sản lượng"
        jsonb coordinated_tasks "Danh mục việc phối hợp liên đơn vị"
        string source_ticket_id "Liên kết nguồn chống gộp trùng"
        timestamp submitted_at "Thời điểm nộp phiếu"
        timestamp resubmitted_at "Thời điểm nộp lại"
        timestamp approved_at "Thời điểm phê duyệt"
        string approved_by "Người phê duyệt"
        string revision_reason "Lý do yêu cầu bổ sung"
        timestamp revision_requested_at "Thời điểm yêu cầu bổ sung"
        string revision_requested_by "Người yêu cầu bổ sung"
        boolean is_merged_to_b1_b2 "Đã gộp vào A2/B1/B2 chính thức"
        string a2_row_id "Khóa dòng liên kết trong Biểu A2"
        string b1_row_id "Khóa dòng liên kết trong Biểu B1"
        string b2_row_id "Khóa dòng liên kết trong Biểu B2 (NULL nếu không có tác động B2)"
        timestamp merged_at "Thời điểm gộp"
        string merged_by "Người thực hiện gộp"
        timestamp created_at "Thời điểm tạo phiếu"
        timestamp updated_at "Thời điểm sửa phiếu gần nhất"
    }

    WORK_SURVEY_VERSIONS {
        uuid id PK "Khóa chính UUID"
        string survey_id FK "Mã phiếu (UNIQUE survey_id, version_no)"
        integer version_no "Số hiệu phiên bản nguyên dương (1, 2, 3...)"
        jsonb snapshot "Snapshot JSONB đầy đủ, bất biến"
        string submitted_by "Email người nộp (NULL với baseline legacy)"
        timestamp submitted_at "Thời điểm nộp (NULL với baseline legacy)"
        string change_summary "Giải trình cập nhật / Bản ghi chuyển đổi dữ liệu"
        boolean is_legacy_baseline "Cờ đánh dấu bản ghi chuyển đổi dữ liệu lịch sử"
        timestamp created_at "Thời điểm tạo bản ghi"
    }

    WORK_SURVEY_STATUS_HISTORY {
        uuid id PK "Khóa chính UUID"
        string survey_id FK "Mã phiếu liên kết"
        string from_status "Trạng thái trước thao tác"
        string to_status "Trạng thái sau thao tác"
        string action "SUBMIT | REQUEST_CHANGES | RESUBMIT | APPROVE | MERGE"
        string reason "Lý do yêu cầu bổ sung"
        string actor_id FK "Người thực hiện (email/user_id)"
        string actor_role "Vai trò tại thời điểm thực hiện"
        string unit_id FK "Đơn vị liên quan"
        timestamp created_at "Thời điểm ghi nhận"
    }

    WORK_SURVEY_MERGE_LINKS {
        uuid id PK "Khóa chính UUID"
        string survey_id FK "Mã phiếu (UNIQUE survey_id, target_sheet, target_record_id)"
        string target_sheet "A2 | B1 | B2"
        string target_record_id "Khóa dòng đích trong biểu"
        integer source_version "Phiên bản nguồn lúc gộp"
        string merged_by FK "Người thực hiện gộp"
        timestamp merged_at "Thời điểm gộp"
        timestamp updated_at "Thời điểm cập nhật"
    }

    AUDIT_LOGS {
        uuid id PK "Khóa chính UUID"
        string actor_email "Email người thao tác"
        string actor_role "Vai trò: admin | unit_leader | staff"
        string unit_id "Mã đơn vị liên quan"
        string action "SUBMIT_TICKET | RESUBMIT_TICKET | APPROVE_TICKET | REQUEST_CHANGES_TICKET | MERGE_B1_B2 | UPDATE_15_SHEETS | ACCOUNT_ROLE_UNIT_CHANGE..."
        string target_id "Khóa của thực thể bị tác động"
        string target_entity "Bảng bị tác động (workbooks, staff_work_tickets, user_accounts...)"
        jsonb old_values "Dữ liệu trước khi chỉnh sửa (đã lọc secret)"
        jsonb new_values "Dữ liệu sau khi chỉnh sửa (đã lọc secret)"
        string ip_address "Địa chỉ IP client"
        string user_agent "Trình duyệt và thiết bị"
        timestamp created_at "Thời điểm ghi nhật ký"
    }
```

---

## 2. Bảng đối chiếu thực thể tham khảo và thực tế

| Tên thực thể tham khảo | Bảng cơ sở dữ liệu thực tế | Chức năng nghiệp vụ |
|---|---|---|
| `AUTH_USERS` | `auth.users` | Quản lý định danh OAuth Supabase và email công vụ |
| `PROFILES` | `public.user_accounts` | Hồ sơ nhân sự, 3 vai trò cố định (`admin`, `unit_leader`, `staff`) và đơn vị trực thuộc |
| `UNITS` | `public.dm_don_vi` | Danh mục **39 đơn vị hoạt động chính thức** (`is_active = TRUE`) của Trường Đại học Công nghệ Kỹ thuật TP.HCM (cột G:I, tệp `v2DS phan quyen (1).xls`) |
| `WORKBOOKS` | `public.workbooks` | Hồ sơ 15 biểu của từng đơn vị theo Hướng dẫn 07-HD/BTCTW |
| `WORK_SURVEYS` | `public.staff_work_tickets` | Phiếu khảo sát khối lượng công việc cá nhân liên thông A1-A2-B1-C1 |
| `WORK_SURVEY_VERSIONS` | `public.work_survey_versions` | Bảng lưu snapshot phiên bản bất biến (`v1, v2, v3...`) phục vụ đối chiếu thay đổi từng trường |
| `WORK_SURVEY_STATUS_HISTORY` | `public.work_survey_status_history` | Nhật ký chuyển đổi 5 trạng thái vòng đời của phiếu cá nhân (bất biến) |
| `WORK_SURVEY_MERGE_LINKS` | `public.work_survey_merge_links` | Khóa liên kết nguồn idempotent `UNIQUE(survey_id, target_sheet, target_record_id)` ngăn chặn gộp trùng vào biểu A2/B1/B2 |
| `AUDIT_LOGS` | `public.audit_logs` | Nhật ký kiểm toán bảo mật bất biến, tự động lọc mật khẩu/token/secret |
