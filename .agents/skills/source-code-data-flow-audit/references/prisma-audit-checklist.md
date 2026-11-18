# Prisma & PostgreSQL 16 Data-Flow Audit Checklist

Tài liệu tham chiếu kiểm toán tầng **Database (PostgreSQL 16) ↔ Prisma ORM ↔ Server Memory/File Store** cho hệ thống HCM-UTE VTVL 360.

---

## 1. Quản lý kết nối & Singleton Pattern (`src/services/storage/prisma.ts`)

- **Quy tắc:** Trong Next.js App Router, tuyệt đối không khởi tạo `new PrismaClient()` rải rác trong các Route Handler.
- **Kiểm tra:**
  - `prisma` và `pg.Pool` phải được gắn vào `globalThis` (`__uteVtvlPrisma`, `__uteVtvlPgPool`).
  - Mọi truy vấn chỉ kích hoạt khi `isDatabaseConfigured()` trả về `true` và không ở chế độ cô lập kiểm thử (`process.env.VTVL_ISOLATED_LOCAL_STORE !== 'true'`).

---

## 2. Tính nguyên tử & Giao dịch (`prisma.$transaction` & Compensation)

- **Khi nào bắt buộc dùng Transaction hoặc Compensation:**
  1. **Nộp / Cập nhật / Nộp lại phiếu (`POST /api/tickets`, `PATCH /api/tickets`):**
     - Ghi phiếu (`staff_work_tickets`)
     - Tạo bản chụp phiên bản bất biến (`work_survey_versions`)
     - Ghi lịch sử chuyển trạng thái (`work_survey_status_history`)
     - Lưu mã công việc cũ đã thay thế khi đổi mã nhiệm vụ (`replaced_work_codes`)
     - Đồng bộ đề xuất phối hợp VTVL (`work_survey_coordinated_vtvls` & `work_relationships`)
  2. **Duyệt & Gộp phiếu vào Biểu A2/B1/B2 (`mergeApprovedTicketToUnitWorkbook`):**
     - Khóa theo đơn vị bằng `withUnitWorkbookLock(unitCode, ...)`
     - Cập nhật `workbooks` (Biểu A2, B1, B2_CT, tính lại công thức B2, C3, D2, K)
     - Ghi liên kết dòng gộp (`work_survey_merge_links`)
     - Cập nhật cờ `is_merged_to_b1_b2 = true` trên `staff_work_tickets`
  3. **Thu hồi duyệt / Xóa phiếu (`executeRevokeOrCancelTicket`):**
     - Gỡ chính xác dòng `a2-${ticket.id}` và `b1-${ticket.id}` khỏi bảng tính đơn vị mà không làm mất dòng của cán bộ khác có cùng mã công việc.

---

## 3. Đối chiếu ánh xạ trường (`snake_case` ↔ `camelCase`)

Khi thêm hoặc sửa bất kỳ trường nào trên phiếu khảo sát, tài khoản hoặc bảng tính, phải kiểm tra đủ 4 điểm chạm:

1. **`prisma/schema.prisma`**: Cột đã khai báo đúng kiểu (`String`, `Int`, `Boolean`, `Json`, `DateTime @db.Timestamptz(6)`) chưa?
2. **`src/services/storage/server-*-db.ts`**:
   - Hàm `fetch*FromSupabase()` có `select` và ánh xạ cột đó sang object kết quả không?
   - Hàm `persist*ToSupabase()` có đưa cột đó vào cả `create` và `update` trong `prisma.<table>.upsert()` không?
3. **`src/services/storage/server-*-store.ts`**:
   - Hàm `enrich*()` / `normalizeRecord()` có bảo toàn trường đó khi gộp với `existing` trong bộ nhớ không?
4. **Ràng buộc Khóa ngoại (`dm_don_vi`):**
   - Bảng `dm_don_vi` chỉ lưu **39 đơn vị hoạt động**.
   - Với 4 tài khoản thuộc **Ban Giám hiệu (`BGH`)** (`hientt@hcmute.edu.vn`, `haiqt@hcmute.edu.vn`, `gianglh@hcmute.edu.vn`, `chdthanh@hcmute.edu.vn`), khi ghi xuống bảng `user_accounts` (có FK `unit_code -> dm_don_vi.ma_don_vi`), phải lưu `unit_code: 'TCNS'` và `unit_name_vi: 'Ban Giám hiệu'`, sau đó khôi phục `unitCode: 'BGH'`, `unitNameVi: 'Ban Giám hiệu'` khi đọc lên để vừa bảo toàn FK vừa không tính `BGH` vào số liệu của 39 đơn vị.
