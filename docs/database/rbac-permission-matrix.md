# Ma trận phân quyền chuẩn (RBAC Permission Matrix) HCM-UTE VTVL 360

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Nguồn sự thật duy nhất (Single Source of Truth)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Ngày cập nhật: 15/11/2026  

---

## 1. Ma trận quyền nguồn sự thật duy nhất (Single Source of Truth)

| Chức năng | Admin (Phòng TCNS) | Lãnh đạo đơn vị (`unit_leader`) | Cán bộ – Giảng viên (`staff`) |
|---|:---:|:---:|:---:|
| **Xem dữ liệu mọi đơn vị** | Có | Không | Không |
| **Sửa 15 biểu của đơn vị** | Có | Có | Không |
| **Sửa biểu C1** | Có | Có | Không |
| **Kê khai phiếu cá nhân** | Có | Có | Có |
| **Xem phiếu toàn đơn vị** | Có | Có | Có |
| **Duyệt/trả lại phiếu** | Có | Có | Không |
| **Quản trị tài khoản, đơn vị** | Có | Có | Không |

---

## 2. Chi tiết phạm vi quyền theo từng vai trò

### 2.1 Quản trị viên hệ thống (Admin)
- **Xem và chỉnh sửa dữ liệu của tất cả đơn vị.**
- **Chỉnh sửa toàn bộ 15 biểu**, bao gồm biểu C1.
- **Xem, duyệt hoặc trả lại phiếu của mọi đơn vị.**
- **Quản trị toàn bộ tài khoản và danh mục đơn vị.**
- **Có quyền thay đổi đơn vị, vai trò và trạng thái tài khoản.**

### 2.2 Lãnh đạo đơn vị (`unit_leader`)
- **Chỉ xem và chỉnh sửa 15 biểu** của đơn vị được gán cho mình (`unit_id`).
- **Được sửa biểu C1** của đơn vị mình, không cần Admin mở khóa.
- **Xem tất cả phiếu cá nhân** thuộc đơn vị mình (từ trạng thái Đã nộp trở đi).
- **Được duyệt hoặc trả lại phiếu** thuộc đơn vị mình.
  - **Quy tắc chống xung đột lợi ích:** Lãnh đạo đơn vị **KHÔNG ĐƯỢC TỰ DUYỆT PHIẾU CỦA CHÍNH MÌNH** (mã lỗi `FORBIDDEN_SELF_REVIEW`). Phiếu của Lãnh đạo do Admin/TCNS phê duyệt.
- **Được quản lý tài khoản trong đơn vị mình** (chỉ các tài khoản có cùng `unit_id`).
- **Ràng buộc cấm:**
  - Không được xem hoặc quản trị dữ liệu của đơn vị khác.
  - Không được cấp quyền Admin.
  - Không được chuyển tài khoản sang đơn vị khác.
  - Không được sửa, khóa hoặc xóa tài khoản Admin.
  - Không được sửa mã đơn vị và thông tin hệ thống của đơn vị khác.

### 2.3 Cán bộ – Giảng viên (`staff`)
- **Chỉ truy cập dữ liệu thuộc đơn vị của mình.**
- **Được xem danh sách phiếu của toàn đơn vị ở chế độ chỉ đọc** (đối chiếu và học hỏi).
- **Chỉ được tạo, chỉnh sửa hoặc xóa phiếu do chính mình tạo** khi phiếu ở trạng thái `draft` hoặc `changes_requested`.
- **Sau khi nộp phiếu**, cán bộ không được tự sửa nội dung trừ khi có yêu cầu bổ sung từ Lãnh đạo hoặc Admin.
- **Xem 15 biểu của đơn vị ở chế độ chỉ đọc**, không có quyền chỉnh sửa, thêm dòng, xóa dòng hay lưu biểu.
- **Không có quyền duyệt hoặc trả lại phiếu** của bất kỳ ai.
- **Không truy cập các chức năng quản trị tài khoản và danh mục đơn vị.**
