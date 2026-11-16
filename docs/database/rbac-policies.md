# Chính sách Row-Level Security (RLS), Cầu nối danh tính & RPC HCM-UTE VTVL 360

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW  
Migration chuẩn: [`supabase/migrations/20261115140000_reconcile_vtvl_39_units_and_versions.sql`](file:///Users/macaz/Documents/0. App/VTVL /supabase/migrations/20261115140000_reconcile_vtvl_39_units_and_versions.sql)  
Ngày cập nhật: 15/11/2026  

---

## 1. Kiến trúc xác thực thực tế & Cầu nối danh tính đáng tin (`resolve_trusted_actor`)

Hệ thống HCM-UTE VTVL 360 vận hành kết hợp:
1. **Custom Session Token ký HMAC-SHA256** (`hcmute_vtvl_session`) tại tầng Next.js API Route (`resolveApiSession(request)`).
2. **Kết nối Supabase qua `service_role` hoặc Supabase JWT**.

Vì khi Backend gọi Supabase bằng `service_role`, hàm `auth.uid()` hoặc `auth.jwt() ->> 'email'` không tự động chứa email người dùng cuối, migration `20261115140000_reconcile_vtvl_39_units_and_versions.sql` thiết lập hàm cầu nối danh tính đáng tin `public.resolve_trusted_actor(p_trusted_actor_email)`:

```sql
CREATE OR REPLACE FUNCTION public.resolve_trusted_actor(
  p_trusted_actor_email TEXT DEFAULT NULL
)
RETURNS TABLE(
  actor_email TEXT,
  actor_role TEXT,
  actor_unit TEXT,
  actor_active BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
```

### Nguyên tắc bảo mật cốt lõi:
- **Khi gọi bằng JWT `authenticated`:** Hàm lấy email trực tiếp từ `auth.jwt() ->> 'email'`. Nếu tham số `p_trusted_actor_email` truyền vào khác với email trong JWT → lập tức chặn với lỗi `ACTOR_SPOOFING_DETECTED (42501)`. Client **không thể** truyền `actor` tùy ý để mạo danh.
- **Khi gọi từ Backend API đã xác thực HMAC Session (`service_role` / `postgres`):** Hàm tra cứu hồ sơ thật trong bảng `public.user_accounts`, kiểm tra `is_active = TRUE` và `status = 'active'`, lấy `role` và `unit_id` trực tiếp từ cơ sở dữ liệu (không tin payload từ client).
- **Giới hạn quyền thực thi RPC:** Toàn bộ RPC nghiệp vụ đều bị thu hồi quyền khỏi `PUBLIC` và `anon` (`REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon;`), chỉ cấp cho `authenticated` và `service_role`.
- **Ghim `search_path`:** Tất cả hàm `SECURITY DEFINER` đều khai báo `SET search_path = public, pg_temp`.

---

## 2. Chi tiết chính sách Row-Level Security (RLS) theo từng bảng

| Bảng dữ liệu | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `public.staff_work_tickets` | - Admin: toàn trường.<br>- Chủ sở hữu: mọi phiếu của mình (kể cả `draft`).<br>- Cùng đơn vị (`unit_leader`, `staff`): chỉ xem phiếu `status <> 'draft'`. | Chủ sở hữu tạo phiếu của mình (`owner_email = caller` & `unit = caller_unit`) hoặc Admin. | Chỉ chủ sở hữu khi `status IN ('draft', 'changes_requested')` (hoặc qua RPC duyệt/gộp). Không ai sửa nội dung kê khai của người khác. | Chỉ chủ sở hữu xóa phiếu `draft` của mình hoặc Admin. |
| `public.work_survey_versions` | - Admin: toàn trường.<br>- Chủ sở hữu: mọi phiên bản phiếu của mình.<br>- Cùng đơn vị: các phiên bản thuộc phiếu đã nộp (`status <> 'draft'`). | Chỉ tạo qua tiến trình nộp/nộp lại (`submit` / `resubmit`). | **CẤM TUYỆT ĐỐI** (Trigger `trg_work_survey_versions_immutable` chặn mọi `UPDATE`). | **CẤM TUYỆT ĐỐI** (Trigger chặn mọi `DELETE`). |
| `public.work_survey_status_history` | Admin, chủ sở hữu phiếu, hoặc thành viên cùng đơn vị (với phiếu không phải `draft`). | Chỉ ghi nhận từ hệ thống / RPC khi chuyển trạng thái. | **CẤM TUYỆT ĐỐI** (Trigger `trg_status_history_immutable`). | **CẤM TUYỆT ĐỐI** (Trigger `trg_status_history_immutable`). |
| `public.work_survey_merge_links` | Admin hoặc thành viên cùng đơn vị với phiếu. | Chỉ ghi nhận từ RPC / tiến trình gộp khi phiếu ở trạng thái `approved`. | Chỉ cập nhật `source_version`, `merged_by`, `updated_at` khi gộp lại idempotent. | Chỉ Admin. |
| `public.audit_logs` | Admin (toàn trường) hoặc Lãnh đạo đơn vị (`unit_id = caller_unit`). | Ghi nhận từ hệ thống, tự động lọc mật khẩu/token qua trigger `trg_sanitize_audit_logs`. | **CẤM TUYỆT ĐỐI** (Trigger `trg_audit_logs_immutable`). | **CẤM TUYỆT ĐỐI** (Trigger `trg_audit_logs_immutable`). |
| `public.workbooks` | Admin (toàn trường) hoặc thành viên cùng đơn vị (`unit_code = caller_unit`). | Admin hoặc Lãnh đạo đúng đơn vị. | Admin hoặc Lãnh đạo đúng đơn vị (`staff` bị chặn tuyệt đối). | Chỉ Admin. |
| `public.user_accounts` | Admin (toàn trường) hoặc thành viên cùng đơn vị. | Admin hoặc Lãnh đạo thêm `staff` trong đơn vị mình. | Admin hoặc Lãnh đạo quản lý `staff` trong đơn vị mình (không cấp Admin, không sửa Admin, không chuyển đơn vị). | Chỉ Admin. |
| `public.user_vtvl_assignments` | Admin (toàn trường), chính chủ, hoặc tra cứu theo đơn vị. | Admin hoặc Lãnh đạo đơn vị gán cho tài khoản thuộc đơn vị mình. | Admin hoặc Lãnh đạo đơn vị (trừ Admin). | Admin hoặc Lãnh đạo đơn vị. |
| `public.work_survey_coordinated_vtvls` | Admin hoặc tài khoản được gán đúng `(target_unit_code, target_vtvl_code)` với dòng `is_latest_submitted = TRUE` của phiếu đã nộp (không phải test/archived). | Chỉ ghi nhận đồng bộ khi nộp/nộp lại phiếu. | Chỉ cập nhật cờ `is_latest_submitted` khi nộp lại. | Cascade theo phiếu nguồn. |

---

## 3. Năm thủ tục RPC nguyên tử (Atomic Security Definer RPCs)

Tất cả 5 thao tác vòng đời phiếu đều thực thi nguyên tử trong một giao dịch: kiểm tra quyền → khóa dòng `FOR UPDATE` → cập nhật `staff_work_tickets` → tạo snapshot `work_survey_versions` (khi nộp/nộp lại) → ghi `work_survey_status_history` → ghi `audit_logs`:

1. **`public.rpc_submit_work_survey(p_ticket_id, p_snapshot, p_trusted_actor_email)`**
   - Chỉ chủ sở hữu phiếu thực hiện khi `status = 'draft'`.
   - Tăng `current_version_no = 1`, lưu snapshot `v1` bất biến vào `work_survey_versions`, chuyển trạng thái sang `submitted`.
   - Xử lý idempotent: nếu phiếu đã ở `submitted` và đã có snapshot hiện hành thì trả về `idempotent: true`, không sinh phiên bản trùng.
2. **`public.rpc_request_work_survey_changes(p_ticket_id, p_reason, p_trusted_actor_email)`**
   - Chỉ `admin` hoặc `unit_leader` cùng đơn vị thực hiện khi `status IN ('submitted', 'resubmitted')`.
   - Bắt buộc có lý do (`REVISION_REASON_REQUIRED`).
   - Chặn tự yêu cầu bổ sung trên phiếu của chính mình (`FORBIDDEN_SELF_REVIEW`).
3. **`public.rpc_resubmit_work_survey(p_ticket_id, p_snapshot, p_change_summary, p_trusted_actor_email)`**
   - Chỉ chủ sở hữu phiếu thực hiện khi `status = 'changes_requested'`.
   - Bắt buộc nhập giải trình cập nhật (`CHANGE_SUMMARY_REQUIRED`).
   - Tăng `current_version_no = v_next_ver` (`v2, v3...`), giữ nguyên các snapshot cũ, chuyển trạng thái sang `resubmitted`.
4. **`public.rpc_approve_work_survey(p_ticket_id, p_note, p_trusted_actor_email)`**
   - Chỉ `admin` hoặc `unit_leader` cùng đơn vị thực hiện khi `status IN ('submitted', 'resubmitted')`.
   - Chặn Lãnh đạo tự duyệt phiếu của chính mình (`FORBIDDEN_SELF_REVIEW`).
5. **`public.rpc_merge_work_survey_to_b1_b2(p_ticket_id, p_a2_row_id, p_b1_row_id, p_b2_row_id, p_trusted_actor_email)`**
   - Chỉ `admin` hoặc `unit_leader` cùng đơn vị thực hiện khi `status = 'approved'`.
   - Tạo liên kết chống trùng `UNIQUE(survey_id, target_sheet, target_record_id)` cho `A2` và `B1`; chỉ ghi liên kết `B2` khi có `p_b2_row_id` thực tế (không tự sinh số liệu B2 giả).
