# Playwright Browser & E2E Verification Checklist

Tài liệu tham chiếu kiểm thử đầu-cuối (End-to-End) cho tầng **API ↔ Frontend ↔ Giao diện (DOM)** sử dụng **Playwright CLI (`playwright-browser`)** và bộ kiểm thử E2E của dự án.

---

## 1. Nguyên tắc cốt lõi từ tài liệu Playwright chính thức

1. **Ưu tiên Locator hướng người dùng (User-Facing Locators):**
   - Ưu tiên số 1: `getByRole('button', { name: '...' })`, `getByRole('tab', { name: '...' })`, `getByRole('heading', { name: '...' })`.
   - Ưu tiên số 2: `getByLabel('...')`, `getByPlaceholder('...')`, `getByText('...')`.
   - Tránh phụ thuộc vào chuỗi class CSS dài hoặc XPath cấu trúc dễ gãy.
2. **Web-First Assertions & Không dùng `waitForTimeout` cố định:**
   - Luôn chờ phản hồi mạng (`waitForResponse`) hoặc chờ phần tử xuất hiện trên DOM thông qua cơ chế auto-retry của Playwright.
3. **Kết hợp kiểm tra DOM + Console + Network:**
   - Một màn hình chỉ được tính là đạt (`PASS`) khi:
     - DOM hiển thị đúng dữ liệu & nhãn tiếng Việt chuẩn.
     - `console` không có lỗi `Uncaught Error` hay `React Hydration Error`.
     - `network` không có request `/api/*` nào trả về `500`, `502`, `503` ngoài kịch bản test lỗi chủ đích.

---

## 2. Quy trình kiểm thử thực tế với `@playwright/cli` (`pw.js`)

Sử dụng wrapper đã cài đặt tại `~/.gemini/config/skills/playwright-browser/scripts/pw.js`:

```bash
SKILL_DIR="$HOME/.gemini/config/skills/playwright-browser"
ARTIFACT_DIR=$(node "$SKILL_DIR/scripts/artifact-dir.js")

# 1. Mở trang cần kiểm toán
node "$SKILL_DIR/scripts/pw.js" open http://localhost:3000

# 2. Chụp cây Accessibility / DOM Snapshot để lấy ref phần tử (e1, e2...)
node "$SKILL_DIR/scripts/pw.js" snapshot --filename "$ARTIFACT_DIR/home-snapshot.md"

# 3. Kiểm tra lỗi Console & Network
node "$SKILL_DIR/scripts/pw.js" console
node "$SKILL_DIR/scripts/pw.js" network

# 4. Chụp ảnh màn hình đối chứng
node "$SKILL_DIR/scripts/pw.js" screenshot --filename "$ARTIFACT_DIR/home-verified.png" --full-page

# 5. Đóng phiên trình duyệt sau khi hoàn tất
node "$SKILL_DIR/scripts/pw.js" close
```

---

## 3. Danh sách kịch bản E2E bắt buộc khi kiểm toán VTVL 360

1. **Trang chủ Tổng quan (`/`)**:
   - Kiểm tra 4 thẻ chỉ số trọng yếu:
     - `39 đơn vị trực thuộc`
     - `Vị trí việc làm (Biểu C1)` (`vị trí cụ thể (Biểu C1)`)
     - `Vị trí việc làm được áp dụng tại đơn vị` (`vị trí được áp dụng` + `Tổng phiếu khảo sát toàn trường`)
     - `Phiếu công việc` (`phiếu chờ duyệt` + chi tiết `Đang chờ duyệt` • `Đã phê duyệt` • `Nháp`)
   - Kiểm tra Sidebar nhóm **NGHIỆP VỤ ĐƠN VỊ** có đủ 2 mục: **Quản lý phiếu đơn vị** (`/phieu-don-vi`) và **Bảng tính 10 biểu** (`/bang-tinh`).
2. **Luồng Phiếu khảo sát công việc (`/phieu-cong-viec` & `/phieu-don-vi`)**:
   - Tạo nháp → Lưu & nộp (`Chờ duyệt`) → Mở lại chỉnh sửa khi đang `Chờ duyệt` (giữ nguyên mã CV nếu không đổi mã NV; cấp mã CV mới và lưu `replacedWorkCodes` nếu đổi mã NV) → Lãnh đạo/TCNS phê duyệt → Gộp vào Biểu A2/B1/B2.
3. **Luồng Phân quyền & Đơn vị công tác (`/admin`)**:
   - `tcns@hcmute.edu.vn` luôn hiển thị đơn vị **`[TCNS] Phòng Tổ chức - Nhân sự`**.
   - 4 tài khoản Ban Giám hiệu (`hientt`, `haiqt`, `gianglh`, `chdthanh`) hiển thị đơn vị **`[BGH] Ban Giám hiệu`** nhưng không cộng vào số liệu 39 đơn vị.
