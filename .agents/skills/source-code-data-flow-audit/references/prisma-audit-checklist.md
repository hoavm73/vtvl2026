# Prisma & PostgreSQL 16 Data-Flow Audit Checklist

Tài liệu tham chiếu kiểm toán tầng **Database (PostgreSQL 16) ↔ Prisma ORM ↔ Server Memory/File Store** dựa trên tài liệu chính thức của Prisma (`v6.19+`).

---

## 1. Quản lý kết nối & Singleton Pattern (`src/services/storage/prisma.ts`)

- **Quy tắc:** Trong Next.js App Router, tuyệt đối không khởi tạo `new PrismaClient()` rải rác trong các Route Handler.
- **Kiểm tra:**
  - `prisma` và `pg.Pool` phải được gắn vào `globalThis` (`__uteVtvlPrisma`, `__uteVtvlPgPool`).
  - Mọi truy vấn chỉ kích hoạt khi `isDatabaseConfigured()` trả về `true` và không ở chế độ cô lập kiểm thử (`process.env.VTVL_ISOLATED_LOCAL_STORE !== 'true'`).

---

## 2. Xử lý mã lỗi chuẩn của Prisma (`PrismaClientKnownRequestError`)

Không chỉ kiểm tra chuỗi thông báo lỗi thô; cần đối chiếu mã lỗi chuẩn của Prisma (`e.code`):
- **`P2002` (Unique constraint violation):** Vi phạm ràng buộc duy nhất (ví dụ: `uq_staff_ticket_unit_task` trên `(unit_code, ma_cong_viec)` hoặc `email` trên `user_accounts`). Phải trả về `409 Conflict` hoặc tự động cấp mã công việc tiếp theo thay vì trả `500`.
- **`P2003` (Foreign key constraint failed):** Vi phạm khóa ngoại (ví dụ: `unit_code` tham chiếu `dm_don_vi(ma_don_vi)`, hoặc `owner_email` / `approved_by` / `merged_by` / `revision_requested_by` tham chiếu `user_accounts(email)`).
- **`P2025` (Record not found):** Bản ghi cần `update` hoặc `delete` không tồn tại trên CSDL (dùng `deleteMany` / `updateMany` hoặc `upsert` để tránh crash).
- **`P2034` (Transaction write conflict / Deadlock):** Xung đột ghi đồng thời trong transaction; cần kết hợp `withCrossProcessLock` / `withUnitWorkbookLock` hoặc retry an toàn.

---

## 3. Kiểm tra độ lệch lược đồ (`prisma migrate diff`) & An toàn Raw SQL

- **Kiểm tra Schema Drift:**
  ```bash
  npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
  ```
- **Chống SQL Injection khi dùng Raw SQL:**
  - Ưu tiên dùng Tagged Template `prisma.$queryRaw\`SELECT ... WHERE email = ${email}\`` (tự động tham số hóa `$1`).
  - Nếu bắt buộc truyền tên bảng/cột động, phải kiểm tra qua **Whitelist cứng** trước khi đưa vào `Prisma.raw()`.

---

## 4. Tính nguyên tử, Đồng bộ 2 chiều & Đối chiếu ánh xạ trường (`snake_case` ↔ `camelCase`)

Khi kiểm toán một luồng dữ liệu qua Prisma, bắt buộc kiểm tra 5 điểm nghẽn thường gặp:

1. **Xóa bản ghi trên DB nhưng còn kẹt trong RAM (`sync*FromSupabase`):**
   - Khi đồng bộ toàn bộ (`unitCode === undefined`), phải đối chiếu `remoteIds = new Set(remote.map(r => r.id))` để loại bỏ các bản ghi trong bộ nhớ RAM đã bị xóa trên PostgreSQL.
2. **Rơi rớt trường mở rộng khi gộp lịch sử (`mergeTicketStatusHistory`):**
   - Bảng `work_survey_status_history` trên PostgreSQL lưu nội dung chi tiết trong cột `reason`. Khi đọc từ DB (`fetchStatusHistoryFromSupabase`) và gộp với `localList`, phải khôi phục hoặc bảo toàn các trường cấu trúc (`oldMissionCode`, `newMissionCode`, `oldWorkCode`, `newWorkCode`, `fromVersionNo`, `toVersionNo`).
3. **Đồng bộ bảng phụ (`work_survey_versions`):**
   - Khi mở chi tiết phiếu (`GET /api/tickets?id=...`) hoặc trang `/phieu-don-vi`, phải đảm bảo `syncVersionsCacheFromSupabase()` đã được gọi để khôi phục lịch sử phiên bản (`v1`, `v2`...) sau khi máy chủ khởi động lại.
4. **Remote-First Persistence & Cache Invalidation:**
   - Mọi hàm `upsert*` / `delete*` phải ghi PostgreSQL thành công trước khi cập nhật RAM, đồng thời gọi `invalidateCacheTags(...)` để xóa Runtime Cache ngay lập tức.
5. **Ràng buộc Khóa ngoại `dm_don_vi` (39 đơn vị) với tài khoản `BGH`:**
   - Bảng `dm_don_vi` chỉ lưu 39 đơn vị hoạt động. Với 4 tài khoản Ban Giám hiệu (`BGH`), lưu `unit_code: 'TCNS'`, `unit_name_vi: 'Ban Giám hiệu'` ở tầng vật lý PostgreSQL và ánh xạ lại `unitCode: 'BGH'`, `unitNameVi: 'Ban Giám hiệu'` ở tầng ứng dụng.
