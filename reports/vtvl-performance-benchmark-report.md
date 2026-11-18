# Báo cáo Đo kiểm Hiệu năng & Chịu tải Hệ thống HCM-UTE VTVL 360

- **Thời điểm thực thi:** 00:37:56 19/11/2026
- **Môi trường:** Cô lập dữ liệu thử nghiệm (`VTVL_ISOLATED_LOCAL_STORE=true`, `VTVL_BENCHMARK_MEMORY_ONLY=true`, **0 tác động lên Production**)
- **Quy mô tập dữ liệu giả lập:** **20.000 phiếu công việc**, **100.000 snapshot phiên bản** (5 phiên bản/phiếu), **40.000 lịch sử trạng thái** trên **39 đơn vị HCM-UTE**

---

## 1. Bảng Kết quả Tải Thực Đạt, Độ trễ p50/p95/p99 và Tỷ lệ Lỗi

| Kịch bản chịu tải | Số request / Quy mô | Tải thực đạt (Throughput) | p50 (ms) | p95 (ms) | p99 (ms) | Tỷ lệ lỗi (%) | Payload / Ghi chú |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Trước nâng cấp: Tải danh sách phiếu 1 đơn vị (~513 phiếu + 5 versions)** | 30 lượt | 120.2 req/s | 7.78 ms | 11.32 ms | 11.55 ms | 0% | **2185.2 KB** (2.237.684 B) |
| **2. Sau nâng cấp: `GET /api/tickets?view=list&limit=50` (Cursor Pagination)** | 200 req (50 đồng thời) | **492.4 req/s** | **97.88 ms** | **107.14 ms** | **108.1 ms** | **0%** | **169.1 KB** (Giảm **92.3%**) |
| **3. Dashboard Tổng quan `GET /api/admin/overview`** | 200 req đồng thời | **12007.6 req/s** | **13.39 ms** | **14.72 ms** | **14.91 ms** | **0%** | **7.5 KB** (Single-flight + Aggregate) |
| **4. Cấp mã nguyên tử & Tạo phiếu `POST /api/tickets`** | 100 req đồng thời / 39 ĐV | **933.2 req/s** | **97.78 ms** | **103.51 ms** | **103.63 ms** | **0%** | **100/100 mã duy nhất** (0 trùng) |
| **5. Burst Load: 39 đơn vị đồng thời gộp 20.000 phiếu (`POST /api/tickets/reconcile`)** | 39 đơn vị × ~513 phiếu = **20.000 phiếu** | **32494.9 phiếu/giây** (63.4 đơn vị/s) | **613.64 ms** | **614.28 ms** | **614.6 ms** | **0%** | Tổng thời gian 39 ĐV: **615.48 ms** (39 lần tính công thức, 39 lần ghi) |

---

## 2. Kiểm tra Toàn vẹn Dữ liệu Sau Khi 39 Đơn vị Cùng Gộp 20.000 Phiếu

- **Tổng số phiếu Đã duyệt đưa vào gộp:** `20000` phiếu
- **Tổng số dòng thực tế trong Biểu A2 (39 đơn vị):** `20000` dòng
- **Tổng số dòng thực tế trong Biểu B1 (39 đơn vị):** `20000` dòng
- **Số phiếu bị mất (Missing Tickets):** `0` (**0 mất phiếu**)
- **Số dòng bị nhân đôi trong Biểu A2 (Duplicate A2 Rows):** `0` (**0 trùng dòng A2**)
- **Số dòng bị nhân đôi trong Biểu B1 (Duplicate B1 Rows):** `0` (**0 trùng dòng B1**)
- **Số mã công việc bị trùng trong đơn vị (Duplicate Task Codes):** `0` (**0 trùng mã**)
- **Số phiếu chưa bật cờ `isMergedToB1B2 = true`:** `0` (**0 sót cờ**)
- **Tổng số lần tính công thức (`recalculateGridFormulas`):** `39` lần (đúng **1 lần / đơn vị**, thay vì 20.000 lần trước nâng cấp)
- **Tổng số lần ghi workbook (`saveServerWorkbookAndPersist`):** `39` lần (đúng **1 lần / đơn vị**, thay vì 20.000 lần trước nâng cấp)
- **Kết luận đối soát toàn vẹn:** **`PASSED 100% (KHÔNG MẤT, KHÔNG TRÙNG)`**

---

## 3. Kiểm định Trình duyệt Playwright & PostgreSQL 16

- **Phiên bản Playwright:** `Version 1.65.1` (Chromium Headless: `READY`)
- **`ExcelDataCell` bọc `React.memo`:** `ĐẠT`
- **`ExcelTableRenderer` phân trang khung nhìn 50 dòng/trang:** `ĐẠT`
- **`UnitTicketsReviewList` phân trang 25–50 phiếu/trang + Skeleton:** `ĐẠT`
- **Ngân sách kết nối PostgreSQL mỗi Instance:** Tối đa **15 kết nối** (`PrismaClient = 10`, `pg.Pool = 5`).
