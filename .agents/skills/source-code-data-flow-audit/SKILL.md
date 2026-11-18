---
name: source-code-data-flow-audit
description: Kiểm toán toàn diện luồng dữ liệu mã nguồn (End-to-End Source-Code Data-Flow Audit) theo 8 bước khép kín từ Database (PostgreSQL 16) → Prisma ORM → Next.js API Route Handlers → Frontend Services/State → Giao diện (UI/DOM) → Test kết quả (Unit + Playwright E2E) → Reflection (Phân tích lỗ hổng/sai lệch liên tầng) → Sửa lỗi & Chạy test lại. Kích hoạt khi cần rà soát lỗi dữ liệu, kiểm tra tính nhất quán giữa DB/API/UI, hoặc nghiệm thu tính năng trước khi triển khai.
---

# Source-Code Data-Flow Audit (Kiểm toán luồng dữ liệu 8 bước khép kín)

Bộ quy trình chuẩn hóa kiểm toán mã nguồn từ tầng Cơ sở dữ liệu đến tận Giao diện người dùng và Kiểm thử tự động với **Prisma ORM** + **Playwright CLI**.

```
Database (PostgreSQL 16 & Migrations)
   ↓
Prisma (Schema, Client Types, Transactions & Adapters)
   ↓
API (Next.js Route Handlers, Auth Guard, RBAC/IDOR & JSON Contracts)
   ↓
Frontend (Client Services, Hooks, LocalStorage/Session & Realtime Sync)
   ↓
Giao diện (DOM Rendering, HCM-UTE Brand Guard #004776, Responsive & UX)
   ↓
Test kết quả (TypeScript, 7 Bộ Unit/Integration Test & Playwright Browser E2E)
   ↓
Reflection: Xem còn thiếu hoặc sai ở đâu (Cross-Layer Gap & Drift Matrix)
   ↓
Sửa lỗi → Chạy test lại (Closed-Loop Fix & Re-Verification)
```

---

## Khi nào sử dụng Skill này

1. Khi người dùng yêu cầu kiểm tra một tính năng hoặc con số trên giao diện có khớp với dữ liệu thực tế trong Database hay không.
2. Khi chuẩn bị nghiệm thu hoặc đẩy (`git push`) một luồng nghiệp vụ quan trọng (Phiếu khảo sát công việc, Bảng tính 10 biểu, Quản trị tài khoản/đơn vị, Thống kê toàn trường).
3. Khi phát hiện hiện tượng lệch trạng thái giữa các tầng (ví dụ: DB đã đổi nhưng UI còn giữ `localStorage` cũ, hoặc API trả về trường mới nhưng Frontend chưa đọc).

---

## Công cụ chạy tự động đi kèm

Chạy ngay kịch bản kiểm toán tự động 6 tầng tĩnh trước khi đi sâu vào từng luồng:

```bash
node ".agents/skills/source-code-data-flow-audit/scripts/audit-data-flow.mjs"
```

Tài liệu tham chiếu chuyên sâu trong thư mục skill:
- `references/prisma-audit-checklist.md`: Quy chuẩn kiểm toán Prisma ORM & PostgreSQL 16.
- `references/playwright-e2e-checklist.md`: Quy chuẩn kiểm thử giao diện & mạng thực tế bằng Playwright CLI (`pw.js`).

---

## Quy trình 8 Bước Kiểm toán Chi tiết

### Bước 1: Database (`PostgreSQL 16` & `prisma/migrations/`)
- **Mục tiêu:** Đảm bảo lược đồ vật lý trên PostgreSQL 16 khớp tuyệt đối với yêu cầu nghiệp vụ.
- **Danh mục kiểm tra:**
  1. **Zero Supabase Policy:** Không tồn tại kết nối hoặc biến môi trường `SUPABASE_*` trong mã nguồn hoạt động; mọi kết nối đi qua `DATABASE_URL` (`utevtvl_db`).
  2. **Ràng buộc khóa ngoại (FK) & Khóa chính (PK):**
     - Kiểm tra các bảng tham chiếu `public.dm_don_vi(ma_don_vi)` (39 đơn vị hoạt động).
     - Lưu ý các đơn vị ngoài danh mục thống kê 39 đơn vị (như `BGH` — Ban Giám hiệu): khi lưu vào bảng có FK cứng tới `dm_don_vi`, phải ánh xạ an toàn ở tầng DB Adapter (`unit_code` vật lý hợp lệ, `unit_name_vi: 'Ban Giám hiệu'`) để không vi phạm FK mà vẫn hiển thị đúng đơn vị công tác.
  3. **Tính bất biến lịch sử:** Các bảng lịch sử (`work_survey_versions`, `work_survey_status_history`, `audit_logs`) chỉ thêm mới (`INSERT`), không ghi đè mất lịch sử cũ.

### Bước 2: Prisma (`prisma/schema.prisma` & `src/services/storage/`)
- **Mục tiêu:** Đảm bảo tầng ORM truy vấn an toàn kiểu (Type-safe), không rò rỉ kết nối và đồng bộ Remote-First.
- **Danh mục kiểm tra (xem chi tiết tại `references/prisma-audit-checklist.md`):**
  1. **Singleton `PrismaClient`:** Khởi tạo duy nhất qua `globalThis` tại `src/services/storage/prisma.ts`, tránh cạn kiệt connection pool khi Next.js hot-reload.
  2. **Interactive Transactions (`prisma.$transaction`):** Các thao tác ghi nhiều bảng (ví dụ: lưu phiếu + tạo snapshot phiên bản + ghi lịch sử trạng thái + đồng bộ VTVL phối hợp) phải có cơ chế transaction hoặc compensation rollback khi một bước thất bại.
  3. **Remote-First Persistence:** Mọi hàm `upsert*` / `delete*` trong `src/services/storage/` bắt buộc `await persist*ToSupabase(...)` (ghi PostgreSQL qua Prisma) thành công **trước** khi cập nhật bộ nhớ RAM (`memoryStore`) và tệp `.data/*.json`.
  4. **Ánh xạ cột (`snake_case` ↔ `camelCase`):** Kiểm tra từng trường trong `server-*-db.ts` (`unit_code` ↔ `unitCode`, `unit_name_vi` ↔ `unitNameVi`, `is_merged_to_b1_b2` ↔ `isMergedToB1B2`, `current_version_no` ↔ `currentVersionNo`) để không bị rơi rớt trường khi đọc/ghi.

### Bước 3: API (`src/app/api/**/route.ts`)
- **Mục tiêu:** Đảm bảo mọi Route Handler xác thực đúng người dùng, kiểm soát chặt RBAC/IDOR và trả về JSON đúng hợp đồng.
- **Danh mục kiểm tra:**
  1. **Xác thực (`getCallerSession`):** Kiểm tra đầy đủ Bearer token, Cookie phiên (`hcmute_vtvl_session_token`, `hcmute_vtvl_admin_token_v2`) và phiên NextAuth v4.
  2. **Ma trận phân quyền (RBAC & Chống IDOR):**
     - `admin` (Phòng Tổ chức – Nhân sự): Toàn quyền truy cập và xử lý phiếu/bảng tính của cả 39 đơn vị (`unitCode=ALL` hoặc từng mã đơn vị); tài khoản gốc `tcns@hcmute.edu.vn` luôn cố định tại đơn vị `TCNS`.
     - `unit_leader` (Lãnh đạo đơn vị): Chỉ duyệt/xử lý phiếu và sửa bảng tính 10 biểu trong phạm vi `caller.unitCode`; không tự duyệt phiếu của chính mình (`FORBIDDEN_SELF_REVIEW`).
     - `staff` (Cán bộ – Giảng viên): Chỉ tạo/sửa/xóa phiếu của chính mình khi phiếu ở trạng thái `Nháp`, `Chờ duyệt` (chưa duyệt, chưa gộp B1/B2) hoặc `Yêu cầu bổ sung`; chặn `403` khi gọi API duyệt, gộp hoặc sửa bảng tính.
  3. **Chống tương tranh (Concurrency & Locking):** Sử dụng `withCrossProcessLock` / `withUnitWorkbookLock` cho các thao tác cấp mã công việc (`allocateNextTaskCode`), duyệt phiếu và gộp phiếu vào Biểu A2/B1/B2.
  4. **Cache-Control:** Các API dữ liệu động (`/api/tickets`, `/api/stats/overview`, `/api/admin/unit-monitor`) phải trả kèm header `Cache-Control: no-store`.

### Bước 4: Frontend (`src/services/`, `src/components/**/use*.ts`)
- **Mục tiêu:** Đảm bảo trạng thái phía trình duyệt đồng bộ tức thời với máy chủ và không bị kẹt dữ liệu cũ trong `localStorage`.
- **Danh mục kiểm tra:**
  1. **Đồng bộ phiên người dùng (`AuthSessionProvider`, `account-client`, `operator-session`):**
     - Không để giá trị cũ trong `localStorage` (`hcmute_vtvl_current_operator_v1`, `hcmute_vtvl_active_unit_session_v2`) ghi đè đơn vị gốc của tài khoản trên máy chủ (đặc biệt với `tcns@hcmute.edu.vn` luôn là `TCNS` và 4 tài khoản Ban Giám hiệu luôn là `BGH`).
     - Khi Admin chuyển đổi đơn vị đang xem trong `/bang-tinh` hoặc `/phieu-don-vi`, chỉ đổi `unitCode` của bảng tính/bộ lọc đang xem, tuyệt đối không ghi đè `session.unitCode` của người đang đăng nhập.
  2. **Realtime Sync:** Phát và lắng nghe sự kiện qua `BroadcastChannel('hcmute_vtvl_realtime')`, `window.addEventListener('focus', ...)` và `vtvl-activity-updated`.

### Bước 5: Giao diện (`src/app/`, `src/components/`)
- **Mục tiêu:** Đảm bảo giao diện hiển thị chính xác con số, đúng thuật ngữ và tuân thủ tuyệt đối Quy chuẩn thương hiệu HCM-UTE.
- **Danh mục kiểm tra:**
  1. **Thương hiệu & Thuật ngữ HCM-UTE:**
     - Luôn viết **`HCM-UTE`** (có gạch nối), **`Trường Đại học Công nghệ Kỹ thuật TP.HCM`**.
     - Nhãn bộ biểu chuẩn hóa thống nhất là **`10 biểu`** (không còn `"15 biểu"`).
  2. **Màu chữ Light Theme:** Bắt buộc dùng màu xanh thẫm thương hiệu **`#004776`** (`rgb(0, 71, 118)`). Cấm sử dụng `#000000`, `text-black`, `text-slate-900`, `text-gray-900`.
  3. **Giới hạn độ dài tệp (Rule 8):** Mọi tệp `.ts` / `.tsx` trong `src/` phải **dưới 300 dòng**.
  4. **Trực quan & Tinh gọn:** Không lạm dụng badge rườm rà hoặc icon trang trí thừa (`Sparkles`); nhãn con số phải phản ánh đúng bản chất dữ liệu (ví dụ: phân biệt rõ *Vị trí việc làm cụ thể Biểu C1*, *Vị trí việc làm được áp dụng tại đơn vị* và *Phiếu khảo sát công việc*).

### Bước 6: Test kết quả (Unit/Integration + Playwright Browser E2E)
- **Mục tiêu:** Xác minh bằng bằng chứng thực thi tự động ở cả tầng code lẫn trình duyệt thực tế.
- **Thực thi bắt buộc:**
  1. Kiểm toán luồng dữ liệu tĩnh:
     ```bash
     node ".agents/skills/source-code-data-flow-audit/scripts/audit-data-flow.mjs"
     ```
  2. Kiểm tra biên dịch TypeScript & Prisma:
     ```bash
     npx prisma generate && npm run typecheck
     ```
  3. Chạy toàn bộ 7 bộ kiểm thử tự động:
     ```bash
     npm test
     ```
  4. Kiểm thử E2E trên trình duyệt Chromium bằng Playwright CLI (`references/playwright-e2e-checklist.md`):
     ```bash
     SKILL_DIR="$HOME/.gemini/config/skills/playwright-browser"
     node "$SKILL_DIR/scripts/pw.js" open http://localhost:3000
     node "$SKILL_DIR/scripts/pw.js" snapshot --filename /tmp/audit-snapshot.md
     node "$SKILL_DIR/scripts/pw.js" console
     node "$SKILL_DIR/scripts/pw.js" network
     ```

### Bước 7: Reflection — Xem còn thiếu hoặc sai ở đâu
Sau khi thu thập kết quả từ Bước 1 → Bước 6, lập **Bảng Đối chiếu Liên tầng (Cross-Layer Reflection Matrix)**:

| Tầng kiểm toán | Dữ liệu kỳ vọng | Dữ liệu thực tế | Điểm lệch / Rủi ro phát hiện |
|---|---|---|---|
| **1. Database** | Giá trị cột trong bảng PostgreSQL | Kết quả truy vấn thực tế | Có thiếu cột, sai kiểu hoặc vướng FK không? |
| **2. Prisma** | Model & hàm `fetch*` / `persist*` | Object trả về từ Store | Có trường nào bị rơi khi map `snake_case` → `camelCase` không? |
| **3. API** | Payload JSON & HTTP Status | Response từ Route Handler | Có thiếu kiểm tra quyền, thiếu `no-store` hoặc sai số thống kê không? |
| **4. Frontend** | State / Hook / `localStorage` | Giá trị trong React state | Có bị cache cũ trong `localStorage` đè lên dữ liệu mới từ API không? |
| **5. Giao diện** | Nhãn văn bản, con số, nút bấm | DOM render trên màn hình | Nhãn đơn vị tính có khớp ý nghĩa con số không? Có vi phạm Rule 8 / màu `#004776` không? |
| **6. Test** | Kịch bản kiểm thử bảo vệ | Kết quả chạy `npm test` & Playwright | Đã có bài test tự động chặn lỗi này tái diễn chưa? |

### Bước 8: Sửa lỗi → Chạy test lại (Closed-Loop Remediation)
1. Sửa tận gốc tại đúng tầng phát sinh lỗi (không vá tạm ở tầng giao diện nếu lỗi nằm ở tầng API hoặc Prisma Store).
2. Bổ sung hoặc cập nhật assertion trong `tests/` để khóa chặt hành vi đúng.
3. Chạy lại chu trình kiểm tra:
   - `node ".agents/skills/source-code-data-flow-audit/scripts/audit-data-flow.mjs"`
   - `npm run typecheck && npm test`
4. Chỉ kết thúc nhiệm vụ khi **100% kiểm tra đạt `PASS` (0 lỗi)**.
