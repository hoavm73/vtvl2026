# Kiến trúc chịu tải cao hệ thống VTVL 360 HCM-UTE (15.000–20.000 phiếu & 100.000 phiên bản)

Tài liệu này ghi nhận thiết kế kiến trúc và cấu hình vận hành của hệ thống **HCM-UTE VTVL 360** cho ngưỡng thiết kế:
- **15.000–20.000 phiếu công việc** (`public.staff_work_tickets`, bình quân 250–500 công việc/đơn vị trên 39 đơn vị).
- **60.000–100.000 bản ghi phiên bản và lịch sử trạng thái** (`public.work_survey_versions`, `public.work_survey_status_history`).
- **200–300 phiên người dùng hoạt động đồng thời**, lưu lượng **30–100 request/giây** giờ cao điểm và đợt dồn tải (Burst load) khi 39 đơn vị đồng thời nộp, duyệt, gộp hồ sơ.

---

## 1. Mười hai nguyên tắc kiến trúc đã triển khai

1. **PostgreSQL 16 là nguồn dữ liệu duy nhất trên Production:** Không sử dụng Redis, BullMQ hay microservices ngoài phạm vi; tận dụng tối đa khóa giao dịch, bộ đếm nguyên tử và hàng đợi `FOR UPDATE SKIP LOCKED` ngay trên PostgreSQL.
2. **Loại bỏ hoàn toàn ghi JSON đồng bộ (`fs.writeFileSync`) trên Production:** Tiện ích `src/services/storage/atomic-json-file.ts` tự động bỏ qua việc serialize và ghi tệp `.data/*.json` khi `isDatabaseConfigured() === true` (ngoài chế độ kiểm thử cô lập `VTVL_ISOLATED_LOCAL_STORE=true`). Ở chế độ local/test, tệp JSON được ghi qua tệp tạm (`*.tmp`) và `fs.renameSync` nguyên tử.
3. **GET API thuần đọc (Zero Write Side-Effects on GET):**
   - Đã loại bỏ `syncServerWorkbooksFromSupabase(true)`, `syncTicketsFromWorkbook` và `reconcileApprovedUnitTicketsToWorkbook` khỏi `GET /api/tickets` và `GET /api/workbooks/[id]`.
   - Khi mở bảng tính qua `GET /api/workbooks/[id]`, hệ thống sử dụng hàm chiếu chỉ-đọc `projectUnmergedApprovedTicketsReadOnly` trên bộ nhớ phản hồi mà không ghi xuống CSDL hay đĩa.
4. **Thống kê tổng quan bằng SQL Aggregate (`GET /api/admin/overview`):** Sử dụng `GROUP BY unit_code, status, is_merged_to_b1_b2` trực tiếp trên PostgreSQL kết hợp Single-flight cache (`forceSingleFlight: true`), giảm kích thước payload tổng quan xuống `< 6 KB`.
5. **Server-side Cursor Pagination & List DTO nhẹ (`GET /api/tickets?view=list&limit=50&cursor=...`):**
   - Phân trang ổn định theo `(updated_at DESC, id DESC)`.
   - `toTicketListDto` loại bỏ toàn bộ mảng `versions` (chứa snapshot JSON nặng), `mergeLinks` đầy đủ và rút gọn `statusHistory` chỉ giữ sự kiện mới nhất kèm `versionCount` và `historyCount`.
6. **Tải lười (Lazy-load) chi tiết phiên bản và lịch sử:**
   - `GET /api/tickets/[id]`
   - `GET /api/tickets/[id]/versions`
   - `GET /api/tickets/[id]/history`
7. **Cấp mã công việc nguyên tử (`public.unit_mission_counters`):** Sử dụng `INSERT ... ON CONFLICT (unit_code, mission_code) DO UPDATE SET last_seq = GREATEST(last_seq, $3) + 1 RETURNING last_seq` kết hợp ràng buộc duy nhất `uq_staff_ticket_unit_task (unit_code, ma_cong_viec)`.
8. **Chống Lost Update bằng Optimistic Concurrency (`409 Conflict`):** Kiểm tra `expectedVersionNo` / `baseRevision` / `expectedUpdatedAt` trong `checkTicketOptimisticConcurrency` và trả về HTTP `409 REVISION_CONFLICT` khi dữ liệu đã bị thay đổi bởi phiên khác.
9. **Idempotency cho Submit, Approve, Merge và Reconcile (`public.idempotency_records`):** Hỗ trợ header `Idempotency-Key` hoặc trường `idempotencyKey` trong body để chống nhân đôi phiên bản, lịch sử trạng thái hoặc dòng biểu A2/B1 khi người dùng bấm đúp hoặc mạng retry.
10. **Batch Reconcile theo lô (`POST /api/tickets/reconcile`):** Hàm `batchReconcileUnitTickets` gom toàn bộ phiếu `approved` chưa gộp của đơn vị trong RAM, chỉ gọi `recalculateGridFormulas` **tối đa 1 lần** và ghi workbook **tối đa 1 lần** cho mỗi đơn vị, đồng thời cập nhật trạng thái phiếu theo giao dịch lô (`batchMarkTicketsMergedInDb`).
11. **Hàng đợi công việc nền trên PostgreSQL (`public.background_jobs`):** Hỗ trợ chế độ bất đồng bộ (`async: true`) sử dụng `SELECT ... FOR UPDATE SKIP LOCKED` với các trạng thái `queued`, `running`, `completed`, `failed` và cơ chế retry tự động.
12. **Tối ưu giao diện cho 200–500 dòng/đơn vị:**
    - `ExcelDataCell` được bọc `React.memo` để tránh re-render toàn bảng khi nhập liệu từng ô.
    - `ExcelTableRenderer` và `UnitTicketsReviewList` phân trang khung nhìn (25–50 dòng/trang), giữ số lượng DOM node luôn gọn nhẹ.

---

## 2. Cấu hình Ngân sách Kết nối PostgreSQL & PgBouncer

- **`DATABASE_URL` (Qua PgBouncer Transaction Mode):**
  `postgresql://user:pass@host:6432/utevtvl_db?pgbouncer=true&connection_limit=10&pool_timeout=15`
- **`DIRECT_URL` (Kết nối trực tiếp tới PostgreSQL 16 phục vụ Migration & `CREATE INDEX CONCURRENTLY`):**
  `postgresql://user:pass@host:5432/utevtvl_db`
- **Ngân sách kết nối trên mỗi Node.js Instance (`src/services/storage/prisma.ts`):**
  - `PrismaClient`: `connection_limit = 10`
  - `pg.Pool` (`PG_POOL_MAX`): `max = 5` (giảm từ `15` xuống `5`)
  - Tổng cộng tối đa `15 kết nối / instance` (với 4 instances = 60 kết nối, an toàn dưới ngưỡng `max_connections = 100–200` của PostgreSQL).
