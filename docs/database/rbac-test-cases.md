# Kế hoạch và Ma trận ca kiểm thử RBAC (RBAC Test Cases) HCM-UTE VTVL 360

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Ngày cập nhật: 15/11/2026  

---

## 1. Danh sách 11 ca kiểm thử vượt quyền trọng yếu (Privilege Escalation Test Cases)

| STT | Tên ca kiểm thử | Tác nhân thực hiện | Endpoint & Phương thức | Dữ liệu thử nghiệm (Payload / Params) | Cơ chế chặn & Kết quả kỳ vọng |
|:---:|---|---|---|---|---|
| **1** | **Cán bộ thử sửa bảng tính** | Cán bộ (`staff`, `CK`) | `POST /api/workbooks/CK`<br>`PUT /api/workbooks/CK` | `{ "workbook": { "data": { "A2": [...] } } }` | **HTTP 403 Forbidden** (`FORBIDDEN_STAFF_EDIT_WORKBOOK`). Cán bộ chỉ có quyền đọc `SELECT`. |
| **2** | **Cán bộ thử xóa dòng** | Cán bộ (`staff`, `CK`) | `POST /api/workbooks/CK` | `{ "action": "delete_row", "rowId": "a2-01" }` | **HTTP 403 Forbidden** (`FORBIDDEN_STAFF_EDIT_WORKBOOK`). Server từ chối mọi thao tác biến đổi cấu trúc. |
| **3** | **Cán bộ thử duyệt phiếu** | Cán bộ (`staff`, `CK`) | `PATCH /api/tickets` | `{ "ticketId": "tkt-01", "action": "approve" }` | **HTTP 403 Forbidden** (`FORBIDDEN_STAFF_REVIEW`). Chỉ Admin và Lãnh đạo đơn vị mới có quyền duyệt phiếu. |
| **4** | **Cán bộ thử truy cập `/admin`** | Cán bộ (`staff`, `CK`) | `GET /admin`<br>`GET /api/admin/accounts` | Request truy cập trang Quản trị hệ thống | **Chặn truy cập & Chuyển hướng về `/`**: API trả về **HTTP 403 Forbidden** (`FORBIDDEN_ADMIN_ONLY`). |
| **5** | **Cán bộ thử gửi `unit_id` của đơn vị khác** | Cán bộ (`staff`, `CK`) | `POST /api/tickets` | `{ "unitCode": "TCNS", "maNhiemVu": "TCNS.NV01" }` | **HTTP 403 Forbidden** (`FORBIDDEN_CROSS_UNIT`). Server ép chặt phạm vi đơn vị theo profile thật của phiên. |
| **6** | **Lãnh đạo thử mở dữ liệu đơn vị khác** | Lãnh đạo Khoa SĐH (`unit_leader`, `SDH`) | `GET /api/workbooks/CK`<br>`GET /api/tickets?unitCode=CK` | `unitCode=CK` (Khác đơn vị `SDH` được gán) | **HTTP 403 Forbidden** (`FORBIDDEN_CROSS_UNIT`). Lãnh đạo chỉ được xem và sửa dữ liệu của đơn vị mình. |
| **7** | **Lãnh đạo thử cấp quyền Admin** | Lãnh đạo Khoa SĐH (`unit_leader`, `SDH`) | `POST /api/admin/accounts` | `{ "email": "nv@hcmute.edu.vn", "role": "admin" }` | **HTTP 403 Forbidden** (`FORBIDDEN_ADMIN_ONLY` / `FORBIDDEN_CANNOT_PROMOTE_ADMIN`). Chỉ Admin mới có quyền cấp vai trò Admin. |
| **8** | **Lãnh đạo thử đổi đơn vị tài khoản** | Lãnh đạo Khoa SĐH (`unit_leader`, `SDH`) | `PATCH /api/admin/accounts` | `{ "email": "cb1@hcmute.edu.vn", "unitCode": "CK" }` | **HTTP 403 Forbidden** (`FORBIDDEN_CROSS_UNIT`). Lãnh đạo không được phép điều chuyển nhân sự sang đơn vị khác. |
| **9** | **Lãnh đạo thử duyệt phiếu của chính mình** | Lãnh đạo Khoa SĐH (`unit_leader`, `SDH`, `minhhoavo73@gmail.com`) | `PATCH /api/tickets` | `{ "ticketId": "tkt-SDH-LEAD-01", "action": "approve" }` | **HTTP 403 Forbidden** (`FORBIDDEN_SELF_REVIEW`). Quy tắc chống xung đột lợi ích: Phiếu lãnh đạo do Admin/TCNS phê duyệt. |
| **10** | **Người dùng thử đổi `role`, `owner_id`, `approved_by` trong request** | Bất kỳ người dùng nào qua DevTools | `POST /api/tickets`<br>`PATCH /api/tickets` | Gửi kèm `{ "role": "admin", "owner_id": "other@hcmute.edu.vn", "approved_by": "tcns" }` | **Server ghi đè (Sanitize)**: `role` và `owner_id` được trích xuất trực tiếp từ token xác thực; trường `approved_by` chỉ được gán qua RPC `rpc_approve_work_survey`. |
| **11** | **Admin kiểm tra quyền toàn hệ thống** | Admin (`admin`, `TCNS`, `tcns@hcmute.edu.vn`) | Mọi API: `/api/workbooks/*`, `/api/tickets`, `/api/admin/*` | Truy cập và chỉnh sửa dữ liệu cả 51 đơn vị | **HTTP 200 OK**. Admin có phạm vi toàn quyền trên toàn hệ thống trường HCM-UTE. |

---

## 2. Kết quả thực thi kiểm thử tự động

Toàn bộ 11 kịch bản kiểm thử bảo mật trên được tự động hóa trong bộ kịch bản kiểm thử:
- `tests/rbac-matrix.test.mjs` (16 ca kiểm thử)
- `tests/security-stress-rls.test.mjs` (25 vector tấn công)
- `tests/work-survey-lifecycle.test.mjs` (16 ca kiểm thử vòng đời phiếu)

**Kết quả kiểm tra:** Đạt 100% (Tất cả vector tấn công và kịch bản vượt quyền đều bị chặn triệt để tại tầng máy chủ và database RLS).
