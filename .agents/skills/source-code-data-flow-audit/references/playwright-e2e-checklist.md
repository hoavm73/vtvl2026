# Playwright Browser & E2E Data-Flow Verification Checklist

Tài liệu tham chiếu kiểm thử đầu-cuối (End-to-End Data-Flow Verification) cho tầng **API ↔ Frontend ↔ Giao diện (DOM)** dựa trên tài liệu chính thức của Playwright (`@playwright/test` & `@playwright/cli`).

---

## 1. Bốn nguyên tắc vàng khi kiểm thử luồng dữ liệu bằng Playwright

1. **User-Facing Locators (Định vị phần tử như người dùng thật):**
   - Ưu tiên 1: `page.getByRole('button', { name: '...' })`, `page.getByRole('tab', { name: '...' })`, `page.getByRole('heading', { name: '...' })`.
   - Ưu tiên 2: `page.getByLabel('...')`, `page.getByPlaceholder('...')`, `page.getByText('...')`.
2. **Bắt lỗi ngầm phía trình duyệt (`pageerror` & `console.error`):**
   - Luôn gắn listener `page.on('pageerror', ...)` và `page.on('console', ...)` để đảm bảo không có lỗi Runtime JavaScript hay lỗi React Hydration ẩn dưới giao diện.
3. **Đồng bộ thao tác UI với phản hồi API (`page.waitForResponse`):**
   - Khởi tạo `const resPromise = page.waitForResponse(r => r.url().includes('/api/...') && r.status() === 200)` **trước** khi gọi `click()` hoặc điều hướng, sau đó đối chiếu trực tiếp JSON của API với text hiển thị trên DOM.
4. **Đối chiếu chéo dữ liệu qua `APIRequestContext` (`request` fixture):**
   - Dùng `request.get('/api/stats/overview')` hoặc `request.get('/api/tickets?unitCode=ALL')` để lấy số liệu gốc từ tầng API/Prisma, sau đó kiểm tra con số render trên thẻ giao diện khớp 100% với JSON từ API.

---

## 2. Quy trình kiểm thử nhanh bằng `@playwright/cli` (`pw.js`)

```bash
SKILL_DIR="$HOME/.gemini/config/skills/playwright-browser"
ARTIFACT_DIR=$(node "$SKILL_DIR/scripts/artifact-dir.js")

# 1. Mở trang cần kiểm toán
node "$SKILL_DIR/scripts/pw.js" open http://localhost:3360

# 2. Chụp cây Accessibility / DOM Snapshot để đối chiếu nội dung
node "$SKILL_DIR/scripts/pw.js" snapshot --filename "$ARTIFACT_DIR/audit-snapshot.md"

# 3. Kiểm tra lỗi Console & Network
node "$SKILL_DIR/scripts/pw.js" console
node "$SKILL_DIR/scripts/pw.js" network

# 4. Chụp ảnh màn hình làm bằng chứng nghiệm thu
node "$SKILL_DIR/scripts/pw.js" screenshot --filename "$ARTIFACT_DIR/audit-verified.png" --full-page

# 5. Đóng trình duyệt
node "$SKILL_DIR/scripts/pw.js" close
```
