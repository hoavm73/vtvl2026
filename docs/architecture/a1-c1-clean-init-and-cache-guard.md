# Quyết định kiến trúc: Khởi tạo workbook trống sạch và cơ chế chống cache cũ ghi ngược (Giai đoạn 3)

## 1. Bối cảnh và mục tiêu

Trong giai đoạn đầu vận hành hệ thống **HCM-UTE VTVL 360** (**Trường Đại học Công nghệ Kỹ thuật TP.HCM**), hàm khởi tạo mặc định từng tự động nạp dữ liệu khung mẫu QĐ 2266 / Phụ lục I vào `A1_NhiemVu`, `C1_VTVL` và các bảng phụ thuộc `A2–D2` cho các đơn vị ngoài **Phòng Tổ chức – Nhân sự (`TCNS`)**. Điều này gây nguy cơ nhầm lẫn giữa dữ liệu mẫu và dữ liệu kê khai thực tế, đồng thời dễ phát sinh tình trạng trình duyệt lưu bản nháp cũ (`IndexedDB` / `localStorage`) tự động ghi ngược đè lên máy chủ sau khi làm sạch dữ liệu.

Tài liệu này ghi nhận các thay đổi kiến trúc đã triển khai ở bước chuẩn bị **Giai đoạn 3**:

1. Khởi tạo workbook trống hoàn toàn cho các đơn vị ngoài `TCNS`.
2. Bảo vệ phiên bản dữ liệu đa tầng (`PUT /api/workbooks/[id]`, `runtime-cache`, `IndexedDB v2`, `localStorage`).
3. Quy trình đối chứng, sao lưu, làm sạch theo thứ tự quan hệ và rollback nguyên tử trên PostgreSQL 16.

---

## 2. Cơ chế khởi tạo workbook mới (`unitCode !== "TCNS"`)

- **Phạm vi dữ liệu `TCNS`:** [excel-grid-defaults.ts](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/components/excel-grid/excel-grid-defaults.ts) chỉ giữ nguyên bộ dữ liệu thực tế (`39` dòng `A1`, `6` dòng `C1` và các biểu phụ thuộc) khi `unitCode === "TCNS"`.
- **Khởi tạo trống cho đơn vị khác:** Với mọi `unitCode !== "TCNS"`, `buildDefaultGridWorkbook(unitCode)` khởi tạo `A1: []`, `C1: []` và `A2..D2: []`, đồng thời bảo toàn cấu trúc cột, công thức tính lại, `DM_SP`, `6` dòng kiểm tra `K_KiemTra` (`soDongLoi = 0`), dòng tổng hợp `T_TienDo` và nhật ký khởi tạo `S_NhatKy`.
- **Chặn tạo hàng loạt và chặn nạp nhầm mẫu `TCNS`:**
  - [server-seed-workbooks.ts](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/services/storage/server-seed-workbooks.ts) chỉ khởi tạo sẵn bản ghi seed cho `TCNS` (`touchedCells: []`).
  - [excel-grid-state.ts](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/components/excel-grid/excel-grid-state.ts), [ExcelCommandToolsMenu.tsx](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/components/excel-grid/ExcelCommandToolsMenu.tsx) và [MobileWorkspaceHeader.tsx](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/components/excel-grid/MobileWorkspaceHeader.tsx) khóa tính năng khôi phục dữ liệu mẫu `TCNS` chỉ dành riêng cho `TCNS`.

---

## 3. Cơ chế chống cache cũ ghi ngược (`Stale-cache Upload Guard`)

1. **Khóa phiên bản ở tầng API (`409 STALE_CLIENT_REVISION`):**
   - [route.ts](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/app/api/workbooks/%5Bid%5D/route.ts) kiểm tra `baseRevision` đối với bảng tính đã tồn tại: mọi yêu cầu có `typeof baseRevision !== "number"` hoặc `baseRevision < existingWb.currentRevision` bị từ chối với HTTP `409`, mã lỗi `STALE_CLIENT_REVISION` và giá trị `serverRevision` hiện hành.
2. **Gỡ bỏ tự động ghi đè ở Client & cảnh báo tải lại:**
   - [useOperatorSession.ts](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/components/excel-grid/useOperatorSession.ts) đã loại bỏ nhánh tự động thử lại ghi đè khi gặp `409` và nhánh tự động đẩy bản lưu cục bộ khi `savedRev === 0`.
   - Khi phát hiện bản nháp cục bộ lạc hậu hơn `serverRevision`, hệ thống bật trạng thái `staleClientDetected` và [ExcelWorkbookViewer.tsx](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/components/excel-grid/ExcelWorkbookViewer.tsx) hiển thị thanh cảnh báo yêu cầu người dùng bấm **"Tải lại dữ liệu máy chủ"** (`reloadLatestFromServer`).
3. **Phân tách bộ nhớ đệm trình duyệt và vô hiệu hóa cache máy chủ:**
   - [indexeddb-storage.ts](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/services/storage/indexeddb-storage.ts) nâng cấp `DB_VERSION = 2`, phân tách khóa bản nháp theo `buildScopedDraftKey(unitCode, userId)` (`${UC}::${uid}`), bổ sung chỉ mục `unit_user` và hàm `purgeStaleLocalDrafts(unitCode, minServerRevision, userId?)`.
   - [operator-session.ts](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/services/telemetry/operator-session.ts) phân tách khóa `localStorage` theo `email::unitCode` (`getSessionStorageKey`) và bổ sung `clearUnitLocalGridCache(unitCode, email?)`.
   - [runtime-cache.ts](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/services/storage/runtime-cache.ts) và [server-workbook-store.ts](file:///Users/macaz/Documents/0.%20App/VTVL%20/src/services/storage/server-workbook-store.ts) đồng bộ vô hiệu hóa cache theo cả `unitCode` (`|u:${uc}`) và `workbookId` (`|wb:${wbId}`) qua `invalidateUnitMutationCache`.

---

## 4. Kế hoạch rà soát, thứ tự quan hệ, backup và rollback trên PostgreSQL 16

- **Phân loại và thứ tự phụ thuộc (`A2–D2`):**
  - [a1-c1-template-reference.mjs](file:///Users/macaz/Documents/0.%20App/VTVL%20/scripts/lib/a1-c1-template-reference.mjs) và [a1-c1-audit-classifier.mjs](file:///Users/macaz/Documents/0.%20App/VTVL%20/scripts/lib/a1-c1-audit-classifier.mjs) phân loại các dòng `A2–D2` thành `TEMPLATE_DEPENDENT`, `UNIT_REAL`, `REFERENCED` và `UNKNOWN`.
  - Theo luồng logic nghiệp vụ `A1 → A2 → B1/B2` và `C1 → C2/C3 → D1/D2`, mọi dòng `A1` hoặc `C1` chỉ được phép đưa vào tập xóa khi không còn dòng `A2–D2` nào được giữ lại hoặc phiếu/phân công (`staff_work_tickets`, `user_vtvl_assignments`, `sldv_phan_bo_ngach`, `work_relationships`) tham chiếu tới. Khi thực thi SQL trên PostgreSQL, lệnh `DELETE` chạy theo chiều ngược lại (từ bảng con tới bảng cha) trong một giao dịch `BEGIN ... COMMIT` để bảo đảm không vi phạm khóa ngoại và không phát sinh lỗi `K1, K2, K5, K6`.
- **Sao lưu và rollback đối chứng SHA-256 trên 17 bảng:**
  - [a1-c1-backup-plan.mjs](file:///Users/macaz/Documents/0.%20App/VTVL%20/scripts/lib/a1-c1-backup-plan.mjs) tạo gói `pg-pre-cleanup-backup.json` (dữ liệu quan hệ + snapshot JSONB của `t_tien_do` và `workbooks`), chèn revision dự phòng trước khi làm sạch vào `workbook_revisions` và sinh `rollback-manifest.json` chứa SHA-256 của toàn bộ 17 bảng.
  - Lưu ý về trigger CSDL: bảng `c1_vtvl` có trigger `trg_validate_c1_career_level` (`BEFORE INSERT OR UPDATE` qua `fn_validate_c1_career_level`) tự động cập nhật `NEW.updated_at := now()` mỗi lần ghi lại bản ghi; do đó bước kiểm chứng SHA-256 chuẩn hóa loại trừ trường `updated_at` trên riêng bảng `c1_vtvl` trong khi đối chiếu 100% giá trị và dấu thời gian trên 16 bảng còn lại.
