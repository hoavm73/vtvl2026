# Sổ tay vận hành Migration, Sao lưu, Phục hồi & Kiểm tra sau triển khai (Migration Runbook)

Hệ thống: **HCM-UTE VTVL 360** (Trường Đại học Công nghệ Kỹ thuật TP.HCM)  
Phiên bản migration mục tiêu: `20261115140000_reconcile_vtvl_39_units_and_versions.sql`  
Kịch bản rollback tương ứng: `supabase/rollbacks/20261115140000_rollback_vtvl_39_units_and_versions.sql`  
Ngày cập nhật: 15/11/2026  

---

## 1. Cấu trúc thư mục Migration & Rollback đã chuẩn hóa

1. **`supabase/migrations/`** (Chỉ chứa các migration tiến tới — forward migrations):
   - `20261107_init_vtvl_hcmute.sql`
   - `20261107_seed_full_hcmute_catalogs.sql`
   - `20261114_add_rbac_and_tickets.sql`
   - `20261115010000_reconcile_rbac_security.sql`
   - `20261115020000_work_survey_lifecycle.sql`
   - `20261115140000_reconcile_vtvl_39_units_and_versions.sql` *(Migration hợp nhất & đối soát mới nhất)*
2. **`supabase/rollbacks/`** (Chứa các kịch bản hoàn tác không làm mất dữ liệu — non-destructive rollbacks):
   - `20261115020000_rollback_rbac_security.sql` *(đã tách khỏi `supabase/migrations/` để giải quyết xung đột tiền tố `20261115020000`)*
   - `20261115030000_rollback_work_survey_lifecycle.sql`
   - `20261115140000_rollback_vtvl_39_units_and_versions.sql`

> [!IMPORTANT]
> Tuyệt đối không sửa đổi lịch sử các migration đã áp dụng trước đó và không chạy lại mù quáng các migration cũ. Chỉ chạy duy nhất tệp `20261115140000_reconcile_vtvl_39_units_and_versions.sql`.

---

## 2. Quy trình Sao lưu (Backup) trước khi chạy Migration

Trước khi thực thi trên môi trường Staging hoặc Production, bắt buộc thực hiện sao lưu toàn bộ schema và dữ liệu:

```bash
# 1. Đặt biến môi trường kết nối PostgreSQL của Supabase (không lưu mật khẩu vào Git)
export SUPABASE_DB_URL="postgresql://postgres.<project-ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
export BACKUP_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p backups_private

# 2. Sao lưu toàn bộ schema + dữ liệu định dạng custom (.dump) và SQL thuần (.sql)
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --format=custom \
  --file="backups_private/vtvl_public_${BACKUP_TIMESTAMP}.dump"

pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --data-only \
  --table=public.dm_don_vi \
  --table=public.user_accounts \
  --table=public.staff_work_tickets \
  --table=public.workbooks \
  --table=public.work_survey_status_history \
  --table=public.work_survey_merge_links \
  --table=public.work_survey_versions \
  --table=public.audit_logs \
  --file="backups_private/vtvl_critical_data_${BACKUP_TIMESTAMP}.sql"
```

- **Bảo vệ dữ liệu cá nhân:** Thư mục `backups_private/` chứa thông tin nhân sự thật chỉ lưu cục bộ phục vụ vận hành, tuyệt đối không đưa vào Git.

---

## 3. Quy trình thực thi Migration (`20261115140000_reconcile_vtvl_39_units_and_versions.sql`)

Migration được bọc hoàn toàn trong `BEGIN; ... COMMIT;` và gồm 4 pha tự động:
1. **Preflight Checks:** Kiểm tra sự tồn tại của các bảng cốt lõi (`public.dm_don_vi`, `public.user_accounts`, `public.staff_work_tickets`) trước khi biến đổi.
2. **Reconciliation & Schema Evolution:**
   - Kiểm tra cả kiểu cột, constraint (`CHECK`, `UNIQUE`, `FOREIGN KEY`), index và RLS policy trong `pg_catalog` trước khi thêm/sửa.
   - Đồng bộ 39 đơn vị hoạt động (`is_active = TRUE`) và đánh dấu `is_active = FALSE` cho các mã ngoài danh mục 39 đơn vị (không xóa dòng nào để bảo toàn FK).
   - Chuẩn hóa 3 tài khoản chuẩn (`tcns@hcmute.edu.vn` → `admin`/`TCNS`, `minhhoavo73@gmail.com` → `unit_leader`/`SDH`, `hoavm@hcmute.edu.vn` → `staff`/`QTTHTT`).
   - Bổ sung đầy đủ cột vòng đời và phiên bản cho `staff_work_tickets`, tạo bảng `work_survey_versions`, chuẩn hóa `work_survey_status_history`, `work_survey_merge_links`, `audit_logs`.
3. **Backfill Trung thực:**
   - Ánh xạ trạng thái tiếng Việt cũ sang 5 trạng thái chuẩn (`draft`, `submitted`, `changes_requested`, `resubmitted`, `approved`) mà không bịa ngày nộp hay người duyệt.
   - Tạo bản ghi baseline `v1` (`change_summary = 'Bản ghi chuyển đổi dữ liệu'`, `is_legacy_baseline = TRUE`, `submitted_at = NULL`, `submitted_by = NULL`) cho các phiếu đã nộp trong lịch sử nhưng chưa có `v1`.
4. **Postflight Assertions:**
   - Tự động kiểm tra `count(*) WHERE is_active = TRUE` trên `public.dm_don_vi` phải bằng đúng **39** (nếu lệch sẽ `RAISE EXCEPTION` và rollback toàn bộ giao dịch).
   - Kiểm tra sự tồn tại của bảng `work_survey_versions`, ràng buộc `uq_work_survey_versions_survey_ver`, `uq_merge_links_survey_sheet_record` và tài khoản `hoavm@hcmute.edu.vn` thuộc `QTTHTT`.

### Cách chạy qua psql hoặc Supabase SQL Editor:
```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261115140000_reconcile_vtvl_39_units_and_versions.sql
```

---

## 4. Kiểm tra sau triển khai (Post-Deployment Verification Queries)

Sau khi chạy migration, thực thi các truy vấn kiểm chứng sau:

```sql
-- 1. Xác nhận đúng 39 đơn vị đang hoạt động (is_active = TRUE)
SELECT count(*) AS active_units_count
FROM public.dm_don_vi
WHERE is_active = TRUE;
-- Kỳ vọng: 39

-- 2. Xác nhận 3 tài khoản chuẩn
SELECT email, role, unit_id, unit_code, is_active, status
FROM public.user_accounts
WHERE lower(email) IN ('tcns@hcmute.edu.vn', 'minhhoavo73@gmail.com', 'hoavm@hcmute.edu.vn');
-- Kỳ vọng:
-- tcns@hcmute.edu.vn     | admin       | TCNS   | TCNS   | true | active
-- minhhoavo73@gmail.com  | unit_leader | SDH    | SDH    | true | active
-- hoavm@hcmute.edu.vn    | staff       | QTTHTT | QTTHTT | true | active

-- 3. Xác nhận không còn trạng thái ngoài 5 trạng thái chuẩn trên staff_work_tickets
SELECT status, count(*)
FROM public.staff_work_tickets
GROUP BY status;

-- 4. Xác nhận mọi phiếu đã nộp đều có ít nhất phiên bản v1 trong work_survey_versions
SELECT t.id, t.status, t.current_version_no, count(v.id) AS version_rows
FROM public.staff_work_tickets t
LEFT JOIN public.work_survey_versions v ON v.survey_id = t.id
WHERE t.status <> 'draft'
GROUP BY t.id, t.status, t.current_version_no
HAVING count(v.id) = 0;
-- Kỳ vọng: 0 dòng

-- 5. Kiểm tra quyền EXECUTE của RPC (anon không có quyền gọi)
SELECT routine_name, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name LIKE 'rpc_%'
ORDER BY routine_name, grantee;
```

---

## 5. Phương án Phục hồi (Rollback / Restore) không làm mất dữ liệu

### 5.1 Rollback mềm bằng SQL (Bảo toàn 100% bảng & dữ liệu đã ghi)
Nếu cần gỡ bỏ các trigger khóa bất biến, hạ cấp RPC hoặc mở lại cờ `is_active` cho danh mục đơn vị cũ mà **không xóa bất kỳ cột hay dữ liệu lịch sử phiên bản nào**:
```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/rollbacks/20261115140000_rollback_vtvl_39_units_and_versions.sql
```

### 5.2 Khôi phục từ bản sao lưu (Point-in-Time / Dump Restore)
Trong trường hợp khẩn cấp cần khôi phục nguyên trạng từ file dump trước khi chạy migration:
```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname="$SUPABASE_DB_URL" \
  "backups_private/vtvl_public_${BACKUP_TIMESTAMP}.dump"
```

---

## 6. Báo cáo kiểm kê dữ liệu ngoài danh mục 39 đơn vị cần rà soát chuyển đơn vị

Theo quy tắc **không tự xóa dữ liệu thật** và **không tự đoán đơn vị tiếp nhận**, dưới đây là danh sách toàn bộ bản ghi trên database đang gắn với các mã đơn vị ngoài danh mục 39 đơn vị hoạt động (được giữ nguyên trong DB với `dm_don_vi.is_active = FALSE` cho đến khi có quyết định điều chuyển chính thức của Phòng TCNS):

### 6.1 Các dòng trong `public.dm_don_vi` được chuyển sang `is_active = FALSE` (11 mã trên DB hiện tại)
- `BGH` (Ban Giám hiệu)
- `TTNN` (Trung tâm Ngoại ngữ)
- `TTVD` (Trung tâm Việt – Đức)
- `TTRBTM` (Trung tâm Robot thông minh)
- `TTKTTH` (Trung tâm Kỹ thuật tổng hợp)
- `KTCNMT` (Viện Kỹ thuật Công nghệ Môi trường)
- `NCUDKTXD` (Trung tâm Nghiên cứu ứng dụng Kỹ thuật Xây dựng)
- `THKTTH` (Trường Trung học Kỹ thuật Thực hành)
- `TTCNTT` (Trung tâm Công nghệ Thông tin)
- `CDT` (Công đoàn Trường)
- `DTN` (Đoàn Thanh niên – Hội Sinh viên)
*(Lưu ý: Mã `HDT` — Hội đồng trường không có dòng trong `dm_don_vi` trên DB hiện tại và đã được đưa vào danh sách `INACTIVE_HISTORICAL_UNITS`).*

### 6.2 Các tài khoản trong `public.user_accounts` thuộc đơn vị ngoài danh mục 39 đơn vị (07 tài khoản)
| STT | Email | Họ và tên | Vai trò hiện tại | Đơn vị hiện tại (`unit_code`) | Trạng thái bảo toàn |
|:---:|---|---|---|---|---|
| 1 | `hientt@hcmute.edu.vn` | Trương Thị Hiền | `admin` | `BGH` | Giữ nguyên, chờ quyết định chuyển đơn vị (ví dụ về `TCNS` hoặc đơn vị quản lý tương ứng) |
| 2 | `haiqt@hcmute.edu.vn` | Quách Thanh Hải | `admin` | `BGH` | Giữ nguyên, chờ quyết định chuyển đơn vị |
| 3 | `gianglh@hcmute.edu.vn` | Lê Hiếu Giang | `admin` | `BGH` | Giữ nguyên, chờ quyết định chuyển đơn vị |
| 4 | `chdthanh@hcmute.edu.vn` | Châu Đình Thành | `admin` | `BGH` | Giữ nguyên, chờ quyết định chuyển đơn vị |
| 5 | `thaont@hcmute.edu.vn` | Nguyễn Thị Thảo | `staff` | `TTNN` | Giữ nguyên, chờ quyết định chuyển đơn vị tiếp nhận |
| 6 | `minhtrilk@hcmute.edu.vn` | Lê Khai Minh Trí | `staff` | `TTNN` | Giữ nguyên, chờ quyết định chuyển đơn vị tiếp nhận |
| 7 | `ntuduyen@hcmute.edu.vn` | Nguyễn Thị Út Duyên | `staff` | `TTNN` | Giữ nguyên, chờ quyết định chuyển đơn vị tiếp nhận |

### 6.3 Bảng tiến độ & Phiếu khảo sát liên quan
- **`public.t_tien_do`**: Có **01 dòng** mang mã `ma_don_vi = 'DTN'` (chưa có dữ liệu biểu chi tiết). Được giữ nguyên để không vi phạm khóa ngoại.
- **`public.staff_work_tickets`**: Không có phiếu nào thuộc 11 mã đơn vị không hoạt động nêu trên. Tuy nhiên, có **03 phiếu kiểm thử lịch sử** do `hoavm@hcmute.edu.vn` tạo khi thử nghiệm tại đơn vị `CK` (`tkt-CK-mo012qbe-z9i`, `tkt-CK-mo00v4a7-dco`, `tkt-CK-mo000838-67p`) trong khi tài khoản chuẩn `hoavm@hcmute.edu.vn` thuộc đơn vị `QTTHTT`. Các phiếu này được giữ nguyên và không tự ý xóa.
- **Các bảng phụ thuộc FK tới `public.dm_don_vi(ma_don_vi)`**: `user_accounts`, `staff_work_tickets`, `coordinated_tasks`, `c1_vtvl`, `a1_nhiem_vu`, `a2_cong_viec`, `b1_khoi_luong`, `b2_ct_tac_dong`, `b2_thay_doi`, `c2_nang_luc`, `c3_nhu_cau`, `d1_nhan_luc`, `du_bao_5_nam`, `d2_phuong_an`, `k_kiem_tra`, `t_tien_do`, `s_nhat_ky`, `sldv_quy_mo_don_vi`, `sldv_phan_bo_ngach`, `can_cu_goi_y`, `ra_soat_chua_du_can_cu`. Do đó việc đánh dấu `is_active = FALSE` thay vì `DELETE FROM public.dm_don_vi` đảm bảo an toàn khóa ngoại tuyệt đối.
