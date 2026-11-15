# Kế hoạch và Ma trận ca kiểm thử RBAC, Vòng đời & Phiên bản (Test Matrix) HCM-UTE VTVL 360

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Ngày cập nhật: 15/11/2026  

---

## 1. Phân biệt rõ 3 tầng kiểm thử (Source vs API vs Database)

Để đảm bảo tính trung thực kỹ thuật, hệ thống phân tách rõ ràng 3 cấp độ kiểm thử và **không dùng bài kiểm thử tìm chuỗi trong mã nguồn làm bằng chứng RLS production đã đạt**:

| Tầng kiểm thử | Tệp kịch bản | Cơ chế kiểm tra | Phạm vi chứng minh |
|---|---|---|---|
| **Tầng 1: Kiểm thử cấu trúc mã nguồn & SQL tĩnh (Static / Source Tests)** | `tests/vtvl-workflow.test.mjs`<br>`tests/schema-reconciliation.test.mjs` | Kiểm tra cấu trúc bảng/cột/trigger/policy trong tệp SQL migration, danh mục 39 đơn vị chuẩn từ `v2DS phan quyen (1).xls`, quy chuẩn thương hiệu HCM-UTE và giới hạn 300 dòng/tệp. | Chứng minh mã nguồn và tệp SQL migration tuân thủ đầy đủ thiết kế trước khi chạy. **Không** thay thế cho kiểm thử runtime/DB. |
| **Tầng 2: Kiểm thử thực thi API & Dịch vụ trong môi trường cô lập (Executable API & Service Integration Tests)** | `tests/rbac-matrix.test.mjs`<br>`tests/work-survey-lifecycle.test.mjs`<br>`tests/work-survey-versioning.test.mjs`<br>`tests/security-stress-rls.test.mjs` | Khởi tạo session token HMAC thật cho từng vai trò (`admin`, `unit_leader`, `staff`), gọi trực tiếp handler `/api/tickets`, `/api/workbooks/[unitCode]`, `/api/admin/accounts`, `/api/admin/units` trên kho dữ liệu cô lập (`VTVL_ISOLATED_LOCAL_STORE=true`). | Chứng minh logic phân quyền phía server, máy trạng thái, tạo snapshot `v1/v2`, so sánh từng trường, khóa cạnh tranh idempotency, rollback khi lỗi ghi snapshot và chặn vượt quyền hoạt động đúng ở runtime. |
| **Tầng 3: Kiểm thử Database / RLS trực tiếp trên PostgreSQL / Supabase (Database & RLS Verification)** | Preflight / Postflight trong `supabase/migrations/20261115140000_reconcile_vtvl_39_units_and_versions.sql` & truy vấn kiểm chứng trong `docs/database/migration-runbook.md` | Thực thi trong transaction PostgreSQL khi áp dụng migration trên môi trường Staging/Production và kiểm thử bằng JWT role tương ứng. | Chứng minh constraint, index, trigger bất biến và RLS policy thực thi trực tiếp trong engine PostgreSQL. |

---

## 2. Danh sách các ca kiểm thử RBAC & Vòng đời trọng yếu

| Mã ca | Tên ca kiểm thử | Tác nhân & Đơn vị | Thao tác / Endpoint | Kết quả kỳ vọng |
|:---:|---|---|---|---|
| **RBAC-01** | Cán bộ thử sửa bảng tính 15 biểu | `staff` (`hoavm@hcmute.edu.vn`, `QTTHTT`) | `PUT /api/workbooks/QTTHTT` | **HTTP 403** (`FORBIDDEN_STAFF_EDIT_WORKBOOK`) |
| **RBAC-02** | Cán bộ thử duyệt phiếu | `staff` (`hoavm@hcmute.edu.vn`, `QTTHTT`) | `PATCH /api/tickets` (`action: 'approve'`) | **HTTP 403** (`FORBIDDEN_ROLE`) |
| **RBAC-03** | Cán bộ thử quản trị tài khoản | `staff` (`hoavm@hcmute.edu.vn`, `QTTHTT`) | `GET /api/admin/accounts` | **HTTP 403** (`FORBIDDEN`) |
| **RBAC-04** | Lãnh đạo truy cập chéo sang đơn vị khác | `unit_leader` (`minhhoavo73@gmail.com`, `SDH`) | `GET /api/workbooks/QTTHTT`<br>`GET /api/tickets?unitCode=QTTHTT` | **HTTP 403** (`FORBIDDEN_CROSS_UNIT`) |
| **RBAC-05** | Lãnh đạo thử cấp quyền Admin | `unit_leader` (`minhhoavo73@gmail.com`, `SDH`) | `POST /api/admin/accounts` (`role: 'admin'`) | **HTTP 403** (`FORBIDDEN_PROMOTE_ADMIN`) |
| **RBAC-06** | Lãnh đạo thử sửa tài khoản Admin | `unit_leader` (`minhhoavo73@gmail.com`, `SDH`) | `PATCH /api/admin/accounts` (`email: 'tcns@hcmute.edu.vn'`) | **HTTP 403** (`FORBIDDEN_MODIFY_ADMIN`) |
| **RBAC-07** | Lãnh đạo thử đổi đơn vị tài khoản | `unit_leader` (`minhhoavo73@gmail.com`, `SDH`) | `PATCH /api/admin/accounts` (`unitCode: 'QTTHTT'`) | **HTTP 403** (`FORBIDDEN_CHANGE_UNIT`) |
| **RBAC-08** | Lãnh đạo thử tự duyệt phiếu của chính mình | `unit_leader` (`minhhoavo73@gmail.com`, `SDH`) | `PATCH /api/tickets` (`action: 'approve'` trên phiếu của `minhhoavo73`) | **HTTP 403** (`FORBIDDEN_SELF_REVIEW`) |
| **RBAC-09** | Người khác thử xem phiếu Nháp (`draft`) của đồng nghiệp | `staff` / `unit_leader` cùng đơn vị | `GET /api/tickets?id=<draft_id>` | **HTTP 403** (`FORBIDDEN_DRAFT_PRIVATE`) |
| **RBAC-10** | Người khác (kể cả Lãnh đạo/Admin) thử sửa trực tiếp nội dung kê khai | `unit_leader` / `admin` | `POST /api/tickets` với `id` phiếu của cán bộ khác | **HTTP 403** (`FORBIDDEN_NOT_OWNER`) |
| **VER-01** | Lưu nháp không sinh phiên bản nộp mới | Chủ sở hữu (`staff`, `SDH`) | `POST /api/tickets` (`status: 'draft'`) | `currentVersionNo = 0`, `versions.length = 0` |
| **VER-02** | Nộp lần đầu sinh đúng `v1` | Chủ sở hữu (`staff`, `SDH`) | `PATCH /api/tickets` (`action: 'submit'`) | `status = 'submitted'`, `currentVersionNo = 1`, `v1` bất biến |
| **VER-03** | Bấm nộp 2 lần liên tiếp (idempotency / khóa cạnh tranh) | Chủ sở hữu (`staff`, `SDH`) | Gọi song song 2 lệnh `submit` | Chỉ sinh đúng 1 phiên bản `v1`, không sinh bản trùng |
| **VER-04** | Yêu cầu bổ sung → Sửa & nộp lại sinh `v2`, giữ nguyên `v1` | Lãnh đạo (`SDH`) → Chủ sở hữu (`SDH`) | `request_changes` → sửa trường → `resubmit` kèm `changeSummary` | `currentVersionNo = 2`, `v1` không bị ghi đè, `v2` lưu `changeSummary` |
| **VER-05** | So sánh từng trường giữa `v1` và `v2` | Chủ sở hữu / Lãnh đạo cùng đơn vị | `computeTicketVersionDiff(v1, v2)` | Phát hiện chính xác trường `added`, `modified`, `deleted` (`"Đã xóa nội dung"`), `12` vs `12.0` là `unchanged`, đối chiếu `coordinatedTasks` theo ID ổn định |
| **VER-06** | Lỗi tạo snapshot làm rollback toàn bộ thao tác nộp | Chủ sở hữu (`staff`, `SDH`) | Giả lập lỗi ghi `work_survey_versions` khi `submit` | Giao dịch bị hủy, phiếu giữ nguyên trạng thái `draft`, không báo thành công giả |
| **VER-07** | Gộp phiếu `approved` vào A2/B1 và gộp lại lần 2 idempotent | Lãnh đạo (`SDH`) | `PATCH /api/tickets` (`action: 'merge'`) × 2 lần | Gộp đúng vào A2 & B1 (`b2RowId = undefined` khi không có dữ liệu B2), lần 2 không tạo dòng trùng |
| **VER-08** | Phiếu lịch sử đã nộp chưa có `v1` tạo bản ghi chuyển đổi trung thực | Migration / Backfill | Chuẩn hóa phiếu legacy | `change_summary = 'Bản ghi chuyển đổi dữ liệu'`, `submitted_at = NULL`, `submitted_by = NULL` |
