# Ma trận phân quyền chuẩn (RBAC Permission Matrix) HCM-UTE VTVL 360

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Nguồn sự thật duy nhất (Single Source of Truth)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Ngày cập nhật: 15/11/2026  

---

## 1. Tài khoản chuẩn của hệ thống

| Email | Vai trò (`role`) | Đơn vị (`unit_id` / `unit_code`) | Ghi chú |
|---|---|---|---|
| `tcns@hcmute.edu.vn` | `admin` | `TCNS` (Phòng Tổ chức – Nhân sự) | Quản trị viên toàn hệ thống |
| `minhhoavo73@gmail.com` | `unit_leader` | `SDH` (Khoa Đào tạo Sau đại học) | Lãnh đạo đơn vị chuẩn |
| `hoavm@hcmute.edu.vn` | `staff` | `QTTHTT` (Phòng Quản trị Thương hiệu và Truyền thông) | Cán bộ – Giảng viên chuẩn (`CK` chỉ là đơn vị từng dùng kiểm thử, tuyệt đối không đổi `hoavm` sang `CK`) |

---

## 2. Ma trận quyền nguồn sự thật duy nhất (Single Source of Truth)

| Chức năng | Admin (Phòng TCNS) | Lãnh đạo đơn vị (`unit_leader`) | Cán bộ – Giảng viên (`staff`) |
|---|:---:|:---:|:---:|
| **Xem dữ liệu mọi đơn vị (39 đơn vị hoạt động)** | Có | Không (chỉ đơn vị mình) | Không (chỉ đơn vị mình) |
| **Sửa 15 biểu của đơn vị** | Có | Có (đúng đơn vị mình) | Không (chỉ đọc) |
| **Sửa biểu C1** | Có | Có (đúng đơn vị mình) | Không |
| **Tạo & sửa nội dung phiếu cá nhân** | Chỉ chủ sở hữu sửa phiếu của mình ở `draft` / `changes_requested` | Chỉ chủ sở hữu sửa phiếu của mình ở `draft` / `changes_requested` | Chỉ chủ sở hữu sửa phiếu của mình ở `draft` / `changes_requested` |
| **Xem phiếu Nháp (`draft`)** | Có (toàn trường) | Chỉ phiếu Nháp của chính mình | Chỉ phiếu Nháp của chính mình |
| **Xem phiếu đã nộp của người khác cùng đơn vị** | Có (toàn trường) | Có (cùng đơn vị) | Có (cùng đơn vị, chỉ đọc) |
| **Xem lịch sử phiên bản & so sánh trường (`v1, v2...`)** | Có (toàn trường) | Có (phiếu đã nộp trong đơn vị mình) | Có (phiếu của mình + phiếu đã nộp cùng đơn vị, không xem bản nháp người khác) |
| **Duyệt / yêu cầu bổ sung phiếu** | Có (bao gồm phiếu của Lãnh đạo) | Có (cùng đơn vị, **trừ phiếu của chính mình**) | Không |
| **Gộp phiếu `approved` vào biểu A2/B1/B2** | Có | Có (cùng đơn vị) | Không |
| **Xem tab “Nhiệm vụ được đề xuất phối hợp” (chỉ đọc)** | Có (toàn trường hoặc VTVL được gán) | Chỉ các công việc đã nộp gắn đúng `(unit_code, ma_vtvl)` được gán cho mình | Chỉ các công việc đã nộp gắn đúng `(unit_code, ma_vtvl)` được gán cho mình |
| **Phân công mã VTVL (`user_vtvl_assignments`)** | Toàn hệ thống | Tài khoản cùng đơn vị (trừ Admin) | Không (chỉ xem phân công của chính mình) |
| **Quản trị tài khoản trong đơn vị** | Toàn hệ thống | Có (nội bộ đơn vị mình; không cấp Admin, không sửa Admin, không chuyển đơn vị) | Không |

---

## 3. Chi tiết phạm vi quyền theo từng vai trò

### 3.1 Quản trị viên hệ thống (`admin`)
- Toàn quyền xem và chỉnh sửa bảng tính 15 biểu (bao gồm biểu C1) của mọi đơn vị.
- Xem, phê duyệt, yêu cầu bổ sung và gộp phiếu của mọi đơn vị (bao gồm phê duyệt phiếu do Lãnh đạo đơn vị kê khai).
- Không sửa trực tiếp nội dung kê khai trong phiếu của người khác (`FORBIDDEN_NOT_OWNER`); nếu cần chỉnh sửa nội dung kê khai thì thực hiện thao tác **Yêu cầu bổ sung** (`request_changes`) để chủ sở hữu cập nhật và nộp lại thành phiên bản mới (`v2, v3...`).
- Quản trị toàn bộ tài khoản và danh mục 39 đơn vị hoạt động.

### 3.2 Lãnh đạo đơn vị (`unit_leader`)
- Quản lý đúng đơn vị được gán (`unit_id`); chỉnh sửa toàn bộ 15 biểu (bao gồm biểu C1) của đơn vị mình.
- Duyệt (`approve`), yêu cầu bổ sung (`request_changes`) và gộp (`merge`) các phiếu thuộc đơn vị mình.
- **Quy tắc không tự duyệt:** Lãnh đạo đơn vị **không được tự duyệt hoặc tự yêu cầu bổ sung phiếu của chính mình** (`FORBIDDEN_SELF_REVIEW`). Phiếu của Lãnh đạo do Admin phê duyệt.
- Quản lý tài khoản trong đơn vị mình, nhưng **bị chặn tuyệt đối**:
  - Không được cấp quyền `admin` (`FORBIDDEN_PROMOTE_ADMIN`).
  - Không được sửa hoặc khóa tài khoản `admin` (`FORBIDDEN_MODIFY_ADMIN`).
  - Không được chuyển tài khoản sang đơn vị khác (`FORBIDDEN_CHANGE_UNIT`).
  - Không ai được sửa trực tiếp nội dung kê khai phiếu của người khác (`FORBIDDEN_NOT_OWNER`).

### 3.3 Cán bộ – Giảng viên (`staff`)
- Xem bảng tính 15 biểu của đơn vị mình ở chế độ **chỉ đọc** (`FORBIDDEN_STAFF_EDIT_WORKBOOK` nếu gọi API ghi).
- Tạo phiếu của chính mình; chỉ chủ sở hữu mới được sửa nội dung phiếu khi phiếu ở trạng thái `draft` hoặc `changes_requested` (`LOCKED_TICKET_STATUS` khi ở `submitted`, `resubmitted`, `approved`).
- Xem phiếu đã nộp (`submitted`, `changes_requested`, `resubmitted`, `approved`) và lịch sử phiên bản đã nộp của đồng nghiệp cùng đơn vị để đối chiếu.
- Phiếu `draft` chỉ chủ sở hữu và Admin được xem (`FORBIDDEN_DRAFT_PRIVATE`).
- Không có quyền duyệt phiếu, gộp phiếu hoặc quản trị tài khoản.
