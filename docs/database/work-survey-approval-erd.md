# Sơ đồ thực thể quan hệ (ERD) Quy trình duyệt, gộp và lịch sử phiên bản Phiếu công việc HCM-UTE VTVL 360

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Căn cứ: Nghị định số 232/2026/NĐ-CP, Hướng dẫn số 07-HD/BTCTW & Danh mục 39 đơn vị chuẩn  
Ngày cập nhật: 15/11/2026  

---

## 1. Sơ đồ thực thể quan hệ (Mermaid ERD)

```mermaid
erDiagram
    DM_DON_VI ||--o{ USER_ACCOUNTS : "contains"
    USER_ACCOUNTS ||--o{ STAFF_WORK_TICKETS : "owns"
    DM_DON_VI ||--o{ STAFF_WORK_TICKETS : "scopes"
    DM_DON_VI ||--o{ WORKBOOKS : "maintains"
    STAFF_WORK_TICKETS ||--o{ WORK_SURVEY_VERSIONS : "snapshots"
    STAFF_WORK_TICKETS ||--o{ WORK_SURVEY_STATUS_HISTORY : "tracks"
    STAFF_WORK_TICKETS ||--o{ WORK_SURVEY_MERGE_LINKS : "merges"
    USER_ACCOUNTS ||--o{ WORK_SURVEY_VERSIONS : "submits"
    USER_ACCOUNTS ||--o{ WORK_SURVEY_STATUS_HISTORY : "performs"
    USER_ACCOUNTS ||--o{ WORK_SURVEY_MERGE_LINKS : "performs"
    USER_ACCOUNTS ||--o{ AUDIT_LOGS : "records"
    USER_ACCOUNTS ||--o{ USER_VTVL_ASSIGNMENTS : "assigned_vtvl"
    DM_DON_VI ||--o{ USER_VTVL_ASSIGNMENTS : "scopes_vtvl"
    STAFF_WORK_TICKETS ||--o{ WORK_SURVEY_COORDINATED_VTVLS : "proposes"
    DM_DON_VI ||--o{ WORK_SURVEY_COORDINATED_VTVLS : "target_unit"

    DM_DON_VI {
        string ma_don_vi PK "Mã đơn vị: 39 đơn vị hoạt động chuẩn (CTL, CK, CNTT, SDH, QTTHTT, TCNS, BANTT...)"
        string ten_don_vi "Tên đơn vị tiếng Việt chính thức"
        string khoi_don_vi "Khoa - Viện | Phòng - Ban | Trung tâm - Phân hiệu - Tạp chí"
        boolean is_active "TRUE cho 39 đơn vị hoạt động; FALSE cho đơn vị ngoài danh mục"
    }

    USER_ACCOUNTS {
        string email PK "Email công vụ HCM-UTE"
        string user_id UK "Định danh người dùng canonical"
        string full_name "Họ và tên cán bộ / giảng viên"
        string role "admin | unit_leader | staff"
        string unit_id FK "Mã đơn vị trực thuộc (FK dm_don_vi)"
        boolean is_active "Trạng thái hoạt động"
    }

    STAFF_WORK_TICKETS {
        string id PK "Mã phiếu: tkt-UNIT-TIME-RAND"
        string owner_id FK "ID chủ sở hữu (user_accounts.email)"
        string owner_email "Email chủ sở hữu"
        string unit_id FK "ID đơn vị công tác (dm_don_vi.ma_don_vi)"
        string unit_code "Mã đơn vị"
        string status "draft | submitted | changes_requested | resubmitted | approved"
        string ma_nhiem_vu "Mã nhiệm vụ liên kết Biểu A1"
        string ma_cong_viec "Mã công việc [Mã NV].CVxx"
        string ten_cong_viec "Tên công việc cụ thể"
        string ma_vtvl "Mã vị trí việc làm Biểu C1"
        string ma_vtvl_phoi_hop "Mã VTVL phối hợp"
        string san_pham "Sản phẩm đầu ra"
        string chat_luong "Tiêu chuẩn chất lượng"
        string can_cu "Căn cứ pháp lý / tài liệu"
        numeric so_sp_nam "Số sản phẩm hoàn thành trong năm (01/10/2025 - 30/9/2026)"
        numeric phut_thuc_te "Phút thực tế / sản phẩm"
        numeric gio_bo_sung "Giờ bổ sung (Nếu có)"
        string nguon_so_lieu "Nguồn số liệu sản lượng"
        integer current_version_no "Số phiên bản nộp hiện hành (0 nếu draft, >=1 khi đã nộp)"
        string last_change_summary "Giải trình nội dung cập nhật gần nhất"
        string source_ticket_id "Mã phiếu nguồn"
        timestamp submitted_at "Thời điểm nộp phiếu lần đầu"
        timestamp resubmitted_at "Thời điểm nộp lại gần nhất"
        timestamp approved_at "Thời điểm phê duyệt"
        string approved_by "Người phê duyệt"
        string revision_reason "Lý do yêu cầu bổ sung"
        timestamp revision_requested_at "Thời điểm yêu cầu bổ sung"
        string revision_requested_by "Người yêu cầu bổ sung"
        boolean is_merged_to_b1_b2 "Đã gộp vào biểu đơn vị"
        string a2_row_id "Khóa dòng liên kết trong Biểu A2 (a2-[id])"
        string b1_row_id "Khóa dòng liên kết trong Biểu B1 (b1-[id])"
        string b2_row_id "Khóa dòng liên kết trong Biểu B2 (NULL nếu không có dữ liệu B2)"
        timestamp merged_at "Thời điểm gộp"
        string merged_by "Người thực hiện gộp"
    }

    WORK_SURVEY_VERSIONS {
        uuid id PK "Khóa chính UUID"
        string survey_id FK "Mã phiếu (FK staff_work_tickets.id)"
        integer version_no "Số phiên bản nguyên dương (1, 2, 3...) UNIQUE(survey_id, version_no)"
        jsonb snapshot "Snapshot bất biến (nội dung kê khai, mã+tên danh mục, coordinatedTasks)"
        string submitted_by "Email người nộp"
        timestamp submitted_at "Thời điểm nộp (NULL nếu bản ghi chuyển đổi không rõ ngày gốc)"
        string change_summary "Giải trình nội dung cập nhật"
        boolean is_migration_baseline "Đánh dấu bản ghi chuyển đổi dữ liệu cũ"
    }

    WORK_SURVEY_STATUS_HISTORY {
        uuid id PK "Khóa chính UUID"
        string survey_id FK "Mã phiếu liên kết"
        string from_status "Trạng thái trước thao tác"
        string to_status "Trạng thái sau thao tác"
        string action "SUBMIT | REQUEST_CHANGES | RESUBMIT | APPROVE | MERGE_TO_SHEETS"
        string reason "Lý do yêu cầu bổ sung hoặc giải trình nộp lại"
        string actor_id "Người thực hiện"
        string actor_role "Vai trò tại thời điểm thực hiện"
        string unit_id "Đơn vị liên quan"
        timestamp created_at "Thời điểm ghi nhận"
    }

    WORK_SURVEY_MERGE_LINKS {
        uuid id PK "Khóa chính UUID"
        string survey_id FK "Mã phiếu liên kết"
        string target_sheet "A2 | B1 | B2"
        string target_record_id "Khóa dòng trong biểu đích (a2-[id], b1-[id], b2-[id])"
        integer source_version "Phiên bản phiếu nguồn tại thời điểm gộp"
        string merged_by "Người thực hiện gộp"
        timestamp merged_at "Thời điểm gộp"
        timestamp updated_at "Thời điểm cập nhật"
    }

    USER_VTVL_ASSIGNMENTS {
        uuid id PK "Khóa chính UUID"
        string user_email FK "Email tài khoản (user_accounts.email)"
        string unit_code FK "Mã đơn vị (dm_don_vi.ma_don_vi)"
        string ma_vtvl "Mã VTVL phân công tường minh"
        boolean is_active "Đang hiệu lực"
    }

    WORK_SURVEY_COORDINATED_VTVLS {
        uuid id PK "Khóa chính UUID"
        string survey_id FK "Mã phiếu nguồn"
        integer version_no "Phiên bản đã nộp"
        string task_row_id "ID dòng công việc ổn định"
        string host_unit_code FK "Đơn vị chủ trì"
        string target_unit_code FK "Đơn vị phối hợp"
        string target_vtvl_code "Mã VTVL phối hợp"
        boolean is_latest_submitted "Chỉ đọc phiên bản đã nộp mới nhất"
    }
```

---

## 2. Cơ chế ánh xạ (Mapping) thực tế từ Phiếu công việc sang các Biểu A2, B1, B2

| Biểu đích | Khóa dòng đích (`target_record_id`) | Trường trên `staff_work_tickets` | Quy tắc ánh xạ dữ liệu & Chống dữ liệu giả |
|---|---|---|---|
| **Biểu 2. A2_CongViec** | `a2-[ticket.id]` | `a2_row_id` | Ánh xạ danh mục công việc (`maCongViec`, `maNhiemVu`, `maVtvl`, `maVtvlPhoiHop`, `tenCongViec`, `sanPham`, `chatLuong`, `canCu`, `nguoiLapPhieu`) kèm `sourceVersion`. **Tuyệt đối không gọi biểu A2 là B2.** |
| **Biểu 4. B1_ThongKeSP** | `b1-[ticket.id]` | `b1_row_id` | Ánh xạ khối lượng sản phẩm và định mức thời gian (`maCongViec`, `maVtvl`, `soSpNam`, `phutThucTe`, `gioBoSung`, `nguonSoLieu`) kèm `sourceVersion`. Tự động tính lại công thức tổng giờ năm: \(\text{Tổng giờ} = \frac{\text{soSpNam} \times \text{phutThucTe}}{60} + \text{gioBoSung}\). |
| **Biểu 6. B2_DinhMuc** | `b2-[ticket.id]` *(chỉ khi có dữ liệu tác động B2)* | `b2_row_id` | Nếu phiếu cá nhân không có dữ liệu đo định mức tác động trực tiếp đến biểu B2, `b2_row_id` giữ giá trị `NULL` và **không tự sinh số liệu B2 giả**. |
| **Khóa chống trùng (`work_survey_merge_links`)** | `UNIQUE (survey_id, target_sheet, target_record_id)` | `is_merged_to_b1_b2` | Đảm bảo khi 1 phiếu sinh nhiều dòng hoặc được gộp lặp lại nhiều lần (re-merge), hệ thống cập nhật đúng dòng đích kèm `source_version` mới nhất mà không tạo bản ghi trùng lặp. |
