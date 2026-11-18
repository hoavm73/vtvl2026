---
name: vtvl-performance-benchmark
description: Quy trình kiểm toán hiệu năng và chịu tải 8 bước khép kín cho hệ thống HCM-UTE VTVL 360: Audit mã nguồn → Tạo dữ liệu thử cô lập 20.000 phiếu (60.000–100.000 phiên bản/lịch sử) → Chạy k6 API load test → Chạy Playwright browser test → Đo PostgreSQL (EXPLAIN ANALYZE & Pool Budget) → Đo Lighthouse / Core Web Vitals → So sánh trước/sau → Xuất báo cáo Markdown và HTML trực quan.
---

# VTVL Performance Benchmark (Quy trình Đo kiểm Hiệu năng & Chịu tải 8 Bước)

Skill này tự động hóa quy trình kiểm định hiệu năng đầu-cuối (End-to-End Performance & Scalability Benchmark) cho hệ thống **HCM-UTE VTVL 360** ở quy mô thiết kế **15.000–20.000 phiếu công việc**, **60.000–100.000 phiên bản/lịch sử trạng thái**, **200–300 phiên đồng thời** và **39 đơn vị đồng thời nộp/duyệt/gộp hồ sơ**.

```
Audit mã nguồn
    ↓
Tạo dữ liệu thử 20.000 phiếu
    ↓
Chạy k6 API load test
    ↓
Chạy Playwright browser test
    ↓
Đo PostgreSQL
    ↓
Đo Lighthouse
    ↓
So sánh trước/sau
    ↓
Xuất báo cáo Markdown/HTML
```

> **NGUYÊN TẮC AN TOÀN TUYỆT ĐỐI:** Toàn bộ quy trình tạo dữ liệu thử 20.000 phiếu và bắn tải chỉ chạy trên môi trường cô lập (`VTVL_ISOLATED_LOCAL_STORE=true`, tự động sao lưu và khôi phục `.data/`), **tuyệt đối không ghi dữ liệu thử lên cơ sở dữ liệu Production**.

---

## 1. Cách Chạy Nhanh Toàn Bộ Chu Trình 8 Bước

Chạy một lệnh duy nhất để thực thi trọn gói 8 bước và sinh báo cáo Markdown + HTML tại thư mục `reports/`:

```bash
node ".agents/skills/vtvl-performance-benchmark/scripts/run-vtvl-benchmark-pipeline.mjs"
```

Sau khi chạy xong, hai tệp báo cáo được xuất tự động tại:
- **Báo cáo Markdown:** `reports/vtvl-performance-benchmark-report.md`
- **Báo cáo HTML trực quan (chuẩn HCM-UTE Design System V2):** `reports/vtvl-performance-benchmark-report.html`

---

## 2. Chi tiết 8 Bước Trong Pipeline

### Bước 1: Audit mã nguồn (`Source-Code Performance & Data-Flow Audit`)
- Kiểm tra tĩnh toàn bộ cây mã nguồn `src/` và `prisma/schema.prisma`:
  - Xác nhận các `GET` route (`/api/tickets`, `/api/workbooks/[id]`, `/api/admin/overview`) không chứa thao tác ghi dữ liệu, `syncTicketsFromWorkbook` hay `reconcileApprovedUnitTicketsToWorkbook`.
  - Xác nhận `shouldPersistLocalJson()` tắt hoàn toàn `fs.writeFileSync` khi kết nối PostgreSQL Production.
  - Xác nhận mọi tệp trong `src/` tuân thủ giới hạn `< 300 dòng` (`Rule 8`) và chuẩn màu thương hiệu `#004776`.
- **Lệnh độc lập:**
  ```bash
  node ".agents/skills/source-code-data-flow-audit/scripts/audit-data-flow.mjs"
  ```

### Bước 2: Tạo dữ liệu thử cô lập 20.000 phiếu (`20,000 Tickets & 100,000 Versions/History`)
- Sao lưu nguyên trạng thư mục `.data/` vào bộ nhớ đệm và khôi phục 100% sau khi kết thúc.
- Sinh tập dữ liệu thử chuẩn hóa phân bổ đều trên **39 đơn vị HCM-UTE**:
  - **20.000 phiếu công việc** (`~512 phiếu/đơn vị`).
  - **60.000 bản ghi phiên bản** (`v1`, `v2`, `v3` với đầy đủ JSON snapshot).
  - **40.000 bản ghi lịch sử trạng thái** (`SUBMIT`, `APPROVE`, `MERGE_TO_SHEETS`).

### Bước 3: Chạy k6 API Load Test (`k6` hoặc Node.js Load Runner tương đương)
- Kịch bản k6 chuẩn nằm tại `.agents/skills/vtvl-performance-benchmark/scripts/k6-api-load-test.js`.
- Nếu máy trạm đã cài `k6` và máy chủ dev đang mở tại `http://localhost:3360`, pipeline kích hoạt `k6 run`; nếu chạy offline/CI, pipeline tự động thực thi bộ bắn tải in-process tương đương trên tập 20.000 phiếu để đo chính xác `p50`, `p95`, `p99`, `errorRate` và `payloadBytes` cho:
  1. `GET /api/admin/overview?unitCode=ALL` (100 request đồng thời — Single-flight + SQL Aggregate).
  2. `GET /api/tickets?unitCode=CNTT&view=list&limit=50` (Cursor Pagination + List DTO nhẹ).
  3. `POST /api/tickets` (50 request tạo phiếu & cấp mã nguyên tử đồng thời).
  4. `POST /api/tickets/reconcile` (Batch Reconcile 460 phiếu đã duyệt của 1 đơn vị với đúng `1` lần tính công thức và `1` lần ghi workbook).

### Bước 4: Chạy Playwright Browser Test (`DOM Size & UI Responsiveness`)
- Kiểm tra trình duyệt Chromium bằng `@playwright/test` (`1.65.1`) và kiểm định cấu trúc phân trang/memoization trên giao diện:
  - Xác nhận `ExcelDataCell` được bọc `React.memo`.
  - Xác nhận `ExcelTableRenderer` (`/bang-tinh`) và `UnitTicketsReviewList` (`/phieu-don-vi`) giới hạn số dòng DOM hiển thị mỗi trang (`25–50 dòng/trang`) ngay cả khi đơn vị có `500 công việc`.

### Bước 5: Đo PostgreSQL (`Pool Budget, Indexes & Query Plan`)
- Kiểm tra ngân sách kết nối (`getDatabaseConnectionBudget()`): `pg.Pool` giới hạn `max = 5`, `PrismaClient` qua PgBouncer `connection_limit = 10` (`<= 15 connections/instance`).
- Kiểm tra sự tồn tại của 3 bảng chịu tải (`unit_mission_counters`, `idempotency_records`, `background_jobs`) và 5 chỉ mục hiệu năng cao (`idx_tickets_unit_status_updated`, `idx_tickets_owner_updated`, `uq_versions_survey_version`, `idx_status_history_survey_created`, `idx_tickets_pending_merge`).

### Bước 6: Đo Lighthouse & Web Vitals (`Bundle Size & Rendering Metrics`)
- Phân tích kích thước First Load JS của các tuyến trang trọng yếu từ bản build Production (`/`, `/phieu-cong-viec`, `/phieu-don-vi`, `/bang-tinh`, `/admin`, `/huong-dan`) và đo thời gian phản hồi TTFB/FCP khi máy chủ hoạt động.

### Bước 7: So sánh Trước / Sau (`Before vs After Delta Analysis`)
- Tự động tính toán tỷ lệ cải thiện (`% giảm dung lượng payload`, `số lần giảm tính toán công thức/ghi workbook`, `số lượt giảm gọi fs.writeFileSync` và `p50/p95/p99 latency`).

### Bước 8: Xuất Báo cáo Markdown & HTML (`Report Generation`)
- Xuất báo cáo tổng hợp ra `reports/vtvl-performance-benchmark-report.md` và `reports/vtvl-performance-benchmark-report.html` với bảng số liệu định lượng, biểu đồ thanh so sánh trực quan và kết luận nghiệm thu.
