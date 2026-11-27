---
name: vtvl-automated-testing
description: Quy trình kiểm thử tự động toàn diện (Automated Testing, Mocking & QA Verification) theo chuẩn Google Antigravity áp dụng cho toàn bộ phần mềm HCM-UTE VTVL 360 — bao gồm 6 tầng kiểm thử (Static/Brand, TypeScript/Prisma, Unit/Workflow, Security/RBAC/RLS, Concurrency/Flakiness, Browser-in-the-Loop E2E), vòng lặp tự động Test & Fix, cô lập dữ liệu 100% và chạy hồi quy định kỳ.
---

# Skill Kiểm thử Tự động Toàn diện — HCM-UTE VTVL 360

Skill này chuyển hóa mô hình **Google Antigravity Automated Testing, Mocking & QA Verification** thành quy trình kiểm thử khép kín 6 tầng cho toàn bộ hệ thống **HCM-UTE VTVL 360** (`Next.js 15 App Router + PostgreSQL 16 + Prisma ORM + NextAuth v4`).

---

## 1. Sáu trụ cột kiểm thử tự động (Antigravity Testing Architecture)

1. **Cô lập tuyệt đối & Mock xác định (Deterministic Mocking & Zero-Pollution):**
   - Mọi lượt chạy kiểm thử bắt buộc bật `VTVL_ISOLATED_LOCAL_STORE=true` để cách ly hoàn toàn khỏi PostgreSQL production và tệp `.data/` cục bộ.
   - Sử dụng `setDbTestHook` (trong `src/services/storage/prisma.ts`) để giả lập phản hồi DB/lỗi kết nối/xung đột transaction một cách xác định, không phụ thuộc mạng ngoài.
2. **Kiểm thử tĩnh, Thương hiệu & Biên dịch (Static Guard & Type Safety):**
   - Kiểm tra Rule 8 (`< 300` dòng cho mọi tệp trong `src/`), Zero-Supabase, màu chữ `#004776` (0 màu đen thuần), tên chính thức **HCM-UTE** / **Trường Đại học Công nghệ Kỹ thuật TP.HCM**.
   - Chạy `npx prisma generate` và `npm run typecheck` (`tsc --noEmit`).
3. **Kiểm thử Bảo mật, Phân quyền & CSDL (Security, RBAC & Schema):**
   - Thực thi `security-stress-rls.test.mjs` (25 vector tấn công + 50 yêu cầu song song), `rbac-matrix.test.mjs` (chống IDOR, Actor Spoofing, Cross-Unit, Direct Approval), `schema-reconciliation.test.mjs` (20 kịch bản đối chiếu lược đồ & 39 đơn vị).
4. **Kiểm thử Nghiệp vụ, Phiên bản & Phối hợp (Business & Edge-Case Suites):**
   - Toàn bộ luồng 8 bước: `vtvl-workflow.test.mjs`, `work-survey-lifecycle.test.mjs`, `work-survey-versioning.test.mjs` (18 kịch bản), `vtvl-coordinated-proposals.test.mjs` (12 kịch bản), `a1-excel-and-validation.test.mjs`, `c1-catalog-and-rename.test.mjs`, `workbook-review-lock.test.mjs`, `unit-filter-sync.test.mjs` (16 kịch bản).
5. **Phát hiện Flakiness & Đua đồng thời (Flakiness & Race Detection):**
   - Kiểm tra khóa liên tiến trình, Optimistic Concurrency (`409 REVISION_CONFLICT`), Idempotency (double submit / double approve / double merge), chống cache cũ ghi ngược (`409 STALE_CLIENT_REVISION`), chống mất dữ liệu C1:
   - Thực thi `unit-code-migration-p0.test.mjs`, `workbook-init-and-stale-cache.test.mjs`, `workbook-sync-and-a1-reorder.test.mjs`.
6. **Browser-in-the-Loop QA (Playwright / Chrome E2E & Visual Verification):**
   - Mở trực tiếp ứng dụng cục bộ (`http://localhost:3360`) qua Playwright hoặc subagent `browser`, chạy các luồng người dùng thật theo 3 vai trò (**Cán bộ – Giảng viên**, **Lãnh đạo đơn vị**, **Quản trị viên TCNS**), kiểm tra DOM, lỗi `console.error`, request mạng `4xx/5xx`, layout responsive Desktop/Mobile và chụp ảnh màn hình bằng chứng.

---

## 2. Lệnh chạy kiểm thử tổng lực 1 chạm

Chạy toàn bộ 13 bộ kiểm thử tự động cốt lõi (Static + Typecheck + Security + Business + Race/Sync) trong môi trường cô lập:

```bash
node ".agents/skills/vtvl-automated-testing/scripts/run-full-test-suite.mjs"
```

Các cờ mở rộng:
- `--with-build`: chạy thêm `npm run build` (xác minh biên dịch production Next.js 15).
- `--with-browser`: chạy thêm `tests/browser-e2e-lifecycle.test.mjs` (yêu cầu máy chủ local `http://localhost:3360` đang chạy).

---

## 3. Vòng lặp tự động Kiểm thử & Sửa lỗi (Iterative Test & Fix Loop)

Khi chạy kiểm thử mà có bất kỳ bộ nào `FAIL`, AI Agent **bắt buộc** thực hiện đủ 5 bước:
1. **Đọc stack trace & phân loại nhóm lỗi:** Tách rõ lỗi do *mã nguồn ứng dụng*, *thiếu dữ liệu mock/fixture*, *rò rỉ trạng thái dùng chung (shared state leak)*, hay *vi phạm Rule 8 / Brand Guard*.
2. **Truy vết nguyên nhân gốc rễ (Root Cause Analysis):** Mở đúng tệp mã nguồn liên quan ở cả tầng DB/Store → API → Frontend, không sửa kiểu che giấu triệu chứng hay tắt assertion.
3. **Áp dụng bản vá gọn sạch:** Tuân thủ giới hạn `< 300` dòng/tệp, bảo toàn tương thích ngược.
4. **Chạy lại đúng bộ test vừa lỗi** để xác nhận hết lỗi.
5. **Chạy lại toàn bộ suite tổng lực** để đảm bảo không sinh lỗi hồi quy (regression) ở phân hệ khác.

---

## 4. Kịch bản kiểm thử Browser-in-the-Loop theo 3 vai trò

Khi kích hoạt kiểm thử trình duyệt (Playwright CLI hoặc subagent `browser`), luôn kiểm tra đủ 5 hành trình cốt lõi:
1. **Đăng nhập & Phiên (`/login`):** Xác thực đăng nhập Email/Mật khẩu và nút Google OAuth, kiểm tra chuyển hướng đúng vai trò, 0 lỗi console/hydration.
2. **Cán bộ – Giảng viên (`/phieu-cong-viec`):** Tạo phiếu Nháp → chỉnh sửa → nộp phiếu (v1) → xem Đề xuất phối hợp → nộp lại (v2) khi có Yêu cầu bổ sung.
3. **Lãnh đạo đơn vị (`/nghiep-vu-don-vi`, `/phieu-don-vi`):** Nhập/xem trước Excel Biểu A1 (cả trường hợp dòng trùng) → thêm/lưu Biểu C1 (kiểm tra không mất dữ liệu, không 409) → duyệt phiếu tự động đưa vào Biểu A2 & B1.
4. **Quản trị viên TCNS (`/admin`, `/admin/tham-dinh`, `/admin/suc-khoe`):** Lọc tài khoản theo vai trò, xem Nhật ký hệ thống theo 4 nhóm (không trùng tab), dùng nút **Nhập Excel A2** thay mặt cán bộ, kiểm tra trang `/admin/suc-khoe`.
5. **Tài liệu & Video hướng dẫn (`/huong-dan?doc=1.4`):** Kiểm tra 3 video MP4 tải được (`200 OK`), nút popup **Video hướng dẫn** kéo thả ở góc phải dưới mở/thu gọn mượt mà.

---

## 5. Kiểm thử hồi quy định kỳ (Scheduled / Overnight Regression)

- Khuyến nghị chạy bộ `run-full-test-suite.mjs --with-build` trước mọi đợt phát hành lớn hoặc thiết lập chạy định kỳ qua lệnh `/schedule` để nhận báo cáo tổng hợp vào đầu ngày.
- Kết quả báo cáo luôn trình bày theo **Bảng điểm 6 tầng** (Số lượng PASS/FAIL, thời gian chạy từng bộ, danh sách lỗi gốc nếu có và trạng thái sẵn sàng triển khai).
