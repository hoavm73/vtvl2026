# Chính sách Row-Level Security (RLS) & Hàm bảo mật RPC HCM-UTE VTVL 360

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Ngày cập nhật: 15/11/2026  

---

## 1. Các hàm cơ sở Security Definer (Phòng chống Search Path Hijacking)

Tất cả hàm phân quyền Security Definer đều được ghim cố định `SET search_path = public, pg_temp` để chống tấn công leo thang đặc quyền qua schema giả mạo.

```sql
-- 1. Lấy email người dùng từ JWT hoặc session
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    auth.jwt() ->> 'email',
    ''
  )::text;
$$;

-- 2. Lấy vai trò canonical từ bảng user_accounts
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (SELECT role FROM public.user_accounts WHERE lower(email) = lower(public.get_current_user_email()) LIMIT 1),
    'staff'
  )::text;
$$;

-- 3. Lấy đơn vị công tác canonical
CREATE OR REPLACE FUNCTION public.get_current_user_unit()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (SELECT COALESCE(unit_id, unit_code) FROM public.user_accounts WHERE lower(email) = lower(public.get_current_user_email()) LIMIT 1),
    ''
  )::text;
$$;

-- 4. Xác minh quyền Quản trị viên hệ thống (Admin)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    lower(public.get_current_user_email()) = 'tcns@hcmute.edu.vn'
    OR public.get_current_user_role() = 'admin'
  );
$$;
```

---

## 2. Chi tiết chính sách Row-Level Security (RLS) theo từng bảng

### 2.1 Bảng `public.staff_work_tickets` (Phiếu khảo sát khối lượng công việc)

Phân định độc lập 4 thao tác (SELECT, INSERT, UPDATE, DELETE):

| Thao tác | Đối tượng được phép | Điều kiện RLS |
|---|---|---|
| **SELECT** | - Admin<br>- Chủ sở hữu<br>- Cán bộ / Lãnh đạo cùng đơn vị | - Admin: xem mọi phiếu của toàn trường.<br>- Chủ sở hữu: xem mọi phiếu của chính mình (kể cả trạng thái Nháp).<br>- Đồng nghiệp & Lãnh đạo cùng đơn vị: **CHỈ xem được các phiếu từ trạng thái ĐÃ NỘP trở đi** (`status <> 'Nháp' AND status <> 'draft'`). Cấm tuyệt đối xem phiếu Nháp của người khác. |
| **INSERT** | - Admin<br>- Chủ sở hữu | - Cán bộ / Lãnh đạo chỉ được tạo phiếu cho chính mình (`owner_email = get_current_user_email()`) và đúng đơn vị mình (`unit_code = get_current_user_unit()`).<br>- Trạng thái khởi tạo chỉ được là `'Nháp'` hoặc `'Đã nộp'`. |
| **UPDATE** | - Admin<br>- Chủ sở hữu | - Cán bộ chỉ được cập nhật phiếu của mình khi còn ở trạng thái `'Nháp'` hoặc `'Trả lại'`. Khi đã nộp hoặc đã duyệt, phiếu bị khóa sửa đổi.<br>- Duyệt/trả lại phiếu phải thông qua RPC `rpc_review_staff_ticket`. |
| **DELETE** | - Admin<br>- Chủ sở hữu | - Chủ sở hữu chỉ được xóa phiếu Nháp của chính mình. Cấm xóa phiếu đã nộp/duyệt. |

### 2.2 Bảng `public.user_accounts` (Tài khoản & Hồ sơ nhân sự)

- **SELECT**:
  - `admin`: Xem toàn bộ danh sách tài khoản của 51 đơn vị.
  - `unit_leader` & `staff`: Xem tài khoản cá nhân của mình hoặc danh sách nhân sự thuộc đơn vị công tác của mình (`unit_code = get_current_user_unit()`).
  - Cột `password_hash` bị loại trừ hoàn toàn khỏi API công khai và chỉ lưu trữ trên tầng máy chủ bảo mật.
- **INSERT / UPDATE / DELETE**:
  - `admin`: Có toàn quyền quản trị, thêm mới, phân quyền, đổi đơn vị và khóa tài khoản (`is_active = false`).
  - `unit_leader`: Được cấp quyền thêm cán bộ mới trong nội bộ đơn vị mình (với role bắt buộc là `'staff'` và `unit_code` đúng đơn vị mình). Không được đổi quyền tài khoản thành Admin.
  - `staff`: Chỉ được cập nhật thông tin cá nhân cơ bản (`full_name`, `display_name`). Cấm sửa `role` hoặc `unit_code`.

### 2.3 Bảng `public.workbooks` (15 Biểu vị trí việc làm đơn vị)

- **SELECT**:
  - `admin`: Xem hồ sơ 15 biểu của toàn bộ 51 đơn vị trường HCM-UTE.
  - `unit_leader` & `staff`: Chỉ xem hồ sơ biểu mẫu của đơn vị mình phụ trách (`unit_code = get_current_user_unit()`).
- **UPDATE**:
  - `admin`: Cập nhật mọi biểu của mọi đơn vị.
  - `unit_leader`: Cập nhật toàn bộ 15 biểu của đơn vị mình, bao gồm cả biểu C1 mà không cần Admin mở khóa.
  - `staff`: **CẤM sửa đổi trực tiếp 15 biểu của đơn vị** (trả về lỗi HTTP 403 `FORBIDDEN_STAFF_EDIT_WORKBOOK`). Không được thêm dòng, xóa dòng, tách nhiệm vụ hoặc lưu biểu.

### 2.4 Bảng `public.audit_logs` (Nhật ký kiểm toán)

- **Bất biến dữ liệu:** Bật RLS và **CẤM toàn bộ lệnh UPDATE và DELETE**.
- **SELECT**: Chỉ Admin được xem toàn bộ nhật ký kiểm toán hệ thống. Lãnh đạo đơn vị được xem nhật ký thao tác thuộc đơn vị mình (`unit_id = get_current_user_unit()`).
- **INSERT**: Cho phép ghi nhận từ các phiên người dùng hợp lệ hoặc qua hệ thống Backend Service Role.

---

## 3. Thủ tục lưu trữ bảo mật (Security Definer RPC)

### 3.1 Thủ tục duyệt / trả lại phiếu: `rpc_review_staff_ticket`

```sql
CREATE OR REPLACE FUNCTION public.rpc_review_staff_ticket(
  p_ticket_id text,
  p_action text, -- 'approve' | 'return'
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
-- Quy tắc kiểm tra then chốt:
-- 1. Cán bộ (staff) không có quyền duyệt phiếu (ErrCode 42501).
-- 2. Lãnh đạo đơn vị (unit_leader) KHÔNG ĐƯỢC TỰ DUYỆT PHIẾU CỦA CHÍNH MÌNH (FORBIDDEN_SELF_REVIEW).
--    Nếu owner_email = caller_email, bắt buộc chuyển cấp trên (Admin/TCNS) phê duyệt.
-- 3. Lãnh đạo không được duyệt phiếu của đơn vị khác (ErrCode 42501).
-- 4. Trạng thái phiếu phải đang là 'Đã nộp' (hoặc 'submitted') mới được duyệt.
-- 5. Tự động ghi nhật ký vào public.audit_logs.
...
$$;
```

### 3.2 Thủ tục gộp phiếu đã duyệt vào B1/B2: `rpc_merge_approved_ticket_to_b1_b2`

```sql
CREATE OR REPLACE FUNCTION public.rpc_merge_approved_ticket_to_b1_b2(
  p_ticket_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
-- Quy tắc kiểm tra then chốt:
-- 1. Chỉ phiếu có trạng thái 'Đã duyệt' ('approved') mới được phép gộp.
-- 2. Kiểm tra cờ is_merged_to_b1_b2 = TRUE để chống gộp lặp lại.
-- 3. Ghi nhận source_ticket_id làm căn cứ nguồn gốc.
-- 4. Cán bộ không có quyền kích hoạt gộp (Chỉ Admin hoặc Lãnh đạo đơn vị).
...
$$;
```
