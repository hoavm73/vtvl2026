# Sơ đồ thực thể quan hệ (ERD) Quy trình duyệt và gộp Phiếu công việc HCM-UTE VTVL 360

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Ngày cập nhật: 15/11/2026  

---

## 1. Sơ đồ thực thể quan hệ (Mermaid ERD)

```mermaid
erDiagram
    DM_DON_VI ||--o{ USER_ACCOUNTS : "contains"
    USER_ACCOUNTS ||--o{ STAFF_WORK_TICKETS : "owns"
    DM_DON_VI ||--o{ STAFF_WORK_TICKETS : "scopes"
    DM_DON_VI ||--o{ WORKBOOKS : "maintains"
    STAFF_WORK_TICKETS ||--o{ WORK_SURVEY_STATUS_HISTORY : "tracks"
    STAFF_WORK_TICKETS ||--o{ WORK_SURVEY_MERGE_LINKS : "merges"
    USER_ACCOUNTS ||--o{ WORK_SURVEY_STATUS_HISTORY : "performs"
    USER_ACCOUNTS ||--o{ WORK_SURVEY_MERGE_LINKS : "performs"

    DM_DON_VI {
        string ma_don_vi PK "Mã đơn vị: FIT, FME, TCNS..."
        string ten_don_vi_vi "Tên đơn vị tiếng Việt"
        string loai_don_vi "Khoa | Phòng | Viện | Trung tâm"
    }

    USER_ACCOUNTS {
        string email PK "Email công vụ HCM-UTE"
        string user_id UK "Định danh người dùng canonical"
        string full_name "Họ và tên cán bộ / giảng viên"
        string role "admin | unit_leader | staff"
        string unit_id FK "Mã đơn vị trực thuộc"
        boolean is_active "Trạng thái hoạt động"
    }

    STAFF_WORK_TICKETS {
        string id PK "Mã phiếu: tkt-UNIT-TIME-RAND"
        string owner_id FK "ID chủ sở hữu (user_accounts.user_id)"
        string owner_email "Email chủ sở hữu"
        string unit_id FK "ID đơn vị công tác (dm_don_vi.ma_don_vi)"
        string unit_code "Mã đơn vị"
        string status "draft | submitted | changes_requested | resubmitted | approved"
        string ma_nhiem_vu "Mã nhiệm vụ liên kết Biểu A1"
        string ma_cong_viec "Mã công việc [Mã NV].CVxx"
        string ten_cong_viec "Tên công việc cụ thể"
        string ma_vtvl "Mã vị trí việc làm Biểu C1"
        string ma_vtvl_phoi_hop "Mã VTVL phối hợp"
        string sanPham "Sản phẩm đầu ra"
        string chatLuong "Tiêu chuẩn chất lượng"
        string canCu "Căn cứ pháp lý / tài liệu"
        numeric so_sp_nam "Số sản phẩm / năm"
        numeric phut_thuc_te "Phút thực tế / sản phẩm"
        numeric gio_bo_sung "Giờ bổ sung / năm"
        string nguon_so_lieu "Nguồn số liệu sản lượng"
        timestamp submitted_at "Thời điểm nộp phiếu"
        timestamp resubmitted_at "Thời điểm nộp lại"
        timestamp approved_at "Thời điểm phê duyệt"
        string approved_by "Người phê duyệt"
        string revision_reason "Lý do yêu cầu bổ sung"
        timestamp revision_requested_at "Thời điểm yêu cầu bổ sung"
        string revision_requested_by "Người yêu cầu bổ sung"
        boolean is_merged_to_b1_b2 "Đã gộp vào B1/B2"
        string b1_row_id "Khóa dòng liên kết trong Biểu B1"
        string b2_row_id "Khóa dòng liên kết trong Biểu B2/A2"
        timestamp merged_at "Thời điểm gộp"
        string merged_by "Người thực hiện gộp"
    }

    WORK_SURVEY_STATUS_HISTORY {
        uuid id PK "Khóa chính UUID"
        string survey_id FK "Mã phiếu liên kết"
        string from_status "Trạng thái trước thao tác"
        string to_status "Trạng thái sau thao tác"
        string action "SUBMIT | REQUEST_CHANGES | RESUBMIT | APPROVE | MERGE"
        string reason "Lý do bổ sung (nếu có)"
        string actor_id FK "Người thực hiện (email/user_id)"
        string actor_role "Vai trò tại thời điểm thực hiện"
        string unit_id FK "Đơn vị liên quan"
        timestamp created_at "Thời điểm ghi nhận"
    }

    WORK_SURVEY_MERGE_LINKS {
        uuid id PK "Khóa chính UUID"
        string survey_id FK "Mã phiếu liên kết"
        string target_sheet "B1 | B2 | A2"
        string target_record_id "Khóa dòng trong biểu"
        integer source_version "Phiên bản nguồn lúc gộp"
        string merged_by FK "Người thực hiện gộp"
        timestamp merged_at "Thời điểm gộp"
        timestamp updated_at "Thời điểm cập nhật"
    }

    WORKBOOKS {
        string unit_code PK "Mã đơn vị sở hữu"
        jsonb data "Dữ liệu 15 biểu (A1, A2, B1, B2, C1...)"
        integer current_revision "Phiên bản hiện tại"
    }
```

---

## 2. So sánh kiến trúc CSDL trước và sau Migration

| Hạng mục | Trước Migration (`20261114`) | Sau Migration (`20261115030000`) |
|---|---|---|
| **Bảng phiếu công việc** | `staff_work_tickets` chỉ có các trường cơ bản về kê khai khối lượng. | Bổ sung đầy đủ 14 trường quản lý vòng đời: `submitted_at`, `resubmitted_at`, `approved_at`, `approved_by`, `revision_reason`, `revision_requested_at`, `revision_requested_by`, `merged_at`, `merged_by`, `b1_row_id`, `b2_row_id`, `is_merged_to_b1_b2`, `unit_id`, `owner_id`. |
| **Trạng thái phiếu** | Chỉ nhận 2 trạng thái: `Nháp` và `Đã nộp`. | Chuẩn hóa 5 trạng thái: `draft`, `submitted`, `changes_requested`, `resubmitted`, `approved` (kèm alias tiếng Việt tương thích ngược). |
| **Lịch sử phê duyệt** | Ghi nhận chung vào `audit_logs`. | Có bảng chuyên biệt `work_survey_status_history` lưu vết từng bước chuyển trạng thái, người duyệt, vai trò và lý do yêu cầu bổ sung. |
| **Gộp biểu B1/B2** | Lưu trực tiếp vào JSON của `workbooks`, chưa có bảng mapping độc lập. | Bảng `work_survey_merge_links` với `UNIQUE (survey_id, target_sheet)` đảm bảo không bao giờ sinh dòng trùng khi gộp nhiều lần. |
| **Bảo vệ Lãnh đạo tự duyệt** | Kiểm tra phân quyền ở API. | Bảo vệ 3 lớp: UI ẩn nút Duyệt, API trả mã `FORBIDDEN_SELF_REVIEW`, Database RPC kích hoạt Exception `ERRCODE = 42501`. |
