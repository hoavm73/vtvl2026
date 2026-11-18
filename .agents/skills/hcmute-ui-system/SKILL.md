---
name: hcmute-ui-system
description: Hệ thống thiết kế giao diện chuẩn HCM-UTE Design System V2 (S-Link & Flat Divider-First UI) — Xanh thẫm #004776, Xanh hành động #006cee, giảm card lồng nhau, phân cấp bằng khoảng trắng & divide-y/divide-x, responsive 320px–1440px và chuẩn accessibility.
---

# Skill: Hệ thống thiết kế giao diện HCM-UTE (Design System V2 & Flat S-Link UI)

## A. Thông tin Skill

- **Tên Skill:** `hcmute-ui-system`
- **Mô tả chức năng:** Quy chuẩn toàn bộ hệ thống UI/UX của **HCM-UTE VTVL 360** kết hợp nhận diện **HCM-UTE S-Link** (`https://link.hcmute.edu.vn/`) và kiến trúc **Flat & Divider-First UI** (tối giản card lồng nhau, ưu tiên khoảng trắng, typography và đường phân cách `divide-y` / `divide-x`).
- **Mục tiêu sử dụng:**
  1. Giữ vững nhận diện thương hiệu đại học: chữ xanh thẫm `rgb(0, 71, 118)` (`#004776`), không dùng màu đen thuần `#000000` hay xám đen (`text-black`, `text-slate-900`, `text-gray-900`).
  2. Giao diện sắc nét, liền mạch, thoáng sạch: tối đa 1 lớp card ngoài cho mỗi khu vực chính; dùng `divide-y` / `divide-x` thay cho khung viền kép hoặc bóng đổ nặng.
  3. Chuẩn responsive hoàn chỉnh từ Mobile (`320px`–`390px`), Tablet (`640px`–`1024px`) tới Desktop (`1280px`–`1440px`), không tràn ngang (`overflowX === 0`), không lỗi React Hydration `#418`, đạt chuẩn Accessibility.
- **Điều kiện kích hoạt:** Kích hoạt khi xây dựng hoặc chỉnh sửa bất kỳ tệp giao diện nào trong `src/app/`, `src/components/` và `src/app/globals.css`.

---

## B. Quy trình thực hiện

### 1. Bảng màu chuẩn S-Link & HCM-UTE (Color Palette)
- **Màu chữ chính (`--foreground`):** `#004776` (`rgb(0, 71, 118)`) cho toàn bộ Heading (`h1`–`h6`), nội dung (`p`, `span`, `td`, `th`), nhãn form và chữ đậm. **Tuyệt đối cấm** `#000000`, `text-black`, `text-slate-900`, `text-gray-900`.
- **Màu hành động chính (`--primary`):** `#006cee` (hover: `#005ecc`) và xanh thương hiệu `#0072BC`. Dùng cho nút CTA chính, tab active và trạng thái focus ring.
- **Màu chữ phụ:** `#20446c` và `#476885` cho chú thích, thời gian, thông tin thứ cấp.
- **Màu nền & đường kẻ phân cấp:**
  - Nền trang: `#f8fafc` / `#f8fbff`; nền vùng chứa chính: `#ffffff`.
  - Thanh công cụ / header phụ / track segmented control: `#f8fafc`, `#e9f0f8`, `#f1f5f9`.
  - Mục đang chọn / active row: nền xanh rất nhạt `#eef6ff` (có thể kết hợp vạch trái `border-l-2` hoặc `border-l-4 border-[#006cee]`, không dùng `ring-2` + `border-2` dày).
  - Đường kẻ phân cách (hairline divider): `1px solid #e2e8f0` (`divide-[#e2e8f0]`, `border-[#e2e8f0]`). Viền ô nhập liệu (`input`, `textarea`, `select`): `#cbd5e1`.
- **Màu trạng thái:**
  - Nghiêm trọng / Phải sửa / Xóa: `#f4212e` / `#b42318` (nền cảnh báo nhẹ `bg-red-50/45` hoặc `bg-[var(--fix-soft)]`).
  - Hoàn thành / Đạt: `#00b87a` / `#008f5d` / `#13653f`.
  - Cần xem lại / Yêu cầu sửa: `#f99c00` / `#b45309`.

### 2. Typography & Bolder 110%
- **Phông chữ:** `Inter, InterVariable, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` — hiển thị đầy đủ dấu thanh tiếng Việt Unicode; ô nhập (`input`, `select`, `textarea`) phải có chiều cao thoải mái (`min-h-[40px]`–`44px`, `leading-normal`) để không cắt dấu mũ tiếng Việt.
- **Thang độ đậm (Bolder 110%):**
  - Nội dung bảng & văn bản thường: `440`
  - Nhãn phụ, ngày tháng: `500`
  - Nút bấm, thanh công cụ, tiêu đề cột: `580`–`600` (`font-semibold`)
  - Tiêu đề khối, mã đơn vị, mã VTVL: `660`–`700` (`font-bold`)
  - Tiêu đề Hero, chỉ số KPI lớn: `715`–`800` (`font-extrabold`, `tabular-nums`, `tracking-tight`)
- **Viết hoa tiếng Việt:** Chuẩn **Sentence case** (chỉ viết hoa chữ cái đầu cụm từ và danh từ riêng); viết tắt trường luôn là **HCM-UTE** (có gạch nối `-`).

### 3. Kiến trúc Phẳng & Phân cấp bằng Divider (Flat & Divider-First UI)
1. **Tối đa 1 cấp card ngoài cho mỗi khu vực:** Không bọc Page -> Outer Card -> Inner Card -> Stat Box. Đặt header trang và thanh tab trực tiếp trên nền trang (`#f8fafc` / `#f8fbff`); mỗi khối dữ liệu lớn bên dưới dùng tối đa 1 container `bg-white rounded-[14px]` hoặc `rounded-[16px] border border-[#e2e8f0]` (không đổ bóng nặng `shadow-sm`/`shadow-xs` chồng chéo).
2. **Tối đa 1–2 tín hiệu phân cấp trên cùng phần tử con:** Không kết hợp đồng thời `border + shadow + nền khác màu + bo góc lớn` cho từng hàng hoặc từng KPI nhỏ.
3. **Thay ô viền bằng khoảng trắng & `divide-y` / `divide-x`:**
   - Thẻ KPI đặt trong 1 container duy nhất dạng lưới `divide-x divide-y xl:divide-y-0 divide-[#e2e8f0]`.
   - Danh sách mobile (đơn vị, dòng Excel, tra cứu VTVL, đề xuất phối hợp, kết quả rà soát) là danh sách phẳng dùng `divide-y divide-[#e2e8f0]`, bỏ viền 4 cạnh ở từng hàng.
4. **Quy chuẩn bo góc & nút thao tác:**
   - Container chính: `rounded-[14px]` hoặc `rounded-[16px]` (riêng Hero Banner giữ `rounded-[24px]`).
   - Input, Select, Button, Segmented track: `rounded-[8px]` hoặc `rounded-[10px]`.
   - Badge / pill đếm số: `rounded-full`.
   - **Phân cấp nút:** Chỉ nút hành động chính (ví dụ: *Lưu & nộp*, *Lưu & tiếp*, *Tạo phiếu mới*) dùng nền solid `#006cee`; nút phụ/bảng dòng dùng kiểu ghost (`hover:bg-[#eef5ff]`) hoặc nền xám/xanh nhạt (`bg-[#f1f5f9]` / `bg-[#eef5ff]`) không viền; giữ viền cho `input`/`textarea`/`select`, modal/dialog, bảng dữ liệu, banner cảnh báo quan trọng và vùng kéo thả tệp `.xlsx`.

### 4. Chuẩn bố cục 5 màn hình trọng tâm & Thanh nút 1 hàng
- **Tổng quan (`/`):** Hero banner không bóng đổ; thanh chuyển tab dạng segmented control phẳng (`bg-[#e9f0f8] p-1 rounded-[10px]`); 4 KPI + phân bổ khối đơn vị nằm chung 1 container `divide-x`; tiến độ & nhật ký gần đây chia 2 cột bằng `divide-x`; tác vụ nhanh theo vai trò dạng danh sách `divide-y`.
- **Quản trị (`/admin`):** `AdminHeader`, dải thống kê phiên và thanh tab nằm phẳng trên nền trang (không bọc toàn trang trong 1 card lớn); `UnitMonitoringKpiStrip` dùng lưới 6 ô `divide-x` + footer thanh tiến trình `bg-[#f8fafc] border-t`; `UnitMonitoringTable` dùng bộ lọc phẳng `bg-[#f8fafc]`; `UnitMonitoringHistoryPanel` chia 2 cột trái/phải trong 1 container `rounded-[16px] border-[#e2e8f0]`.
- **Phiếu công việc (`/phieu-cong-viec`):**
  - Header (`StaffPortalHeaderBanner`) + `StaffTicketsTabBar` phẳng trực tiếp trên nền trang; form `#staff-ticket-form-card` là 1 container duy nhất gộp thanh chế độ + `StaffTicketToolbar` ở đầu (`rounded-t-[16px] bg-[#f8fafc] border-b`, **tránh** dùng `overflow-hidden` bọc `sticky top-14 sm:top-16` dưới `<main className="overflow-x-hidden">` để không đẩy thanh công cụ che mất tiêu đề mục 1). 3 nhóm trường dùng `divide-y` thay vì 3 card con.
  - **Duyệt & quản lý phiếu (`UnitTicketsReviewList` + `UnitTicketActionButtons`):** Cột danh sách chia 2 khối ở `xl:flex-row xl:items-stretch` (khối phải `xl:w-auto xl:min-w-[440px] shrink-0`) và giữ `flex-col` ở `<= 1024px` để cột thông tin không bị bóp hẹp chữ; thanh nút thao tác dùng `flex flex-wrap md:flex-nowrap items-center xl:justify-end gap-1.5 w-full` kèm `px-2.5 whitespace-nowrap shrink-0` cho mọi nút (*Xem chi tiết*, *In PDF*, *Phối hợp*, *Chỉnh sửa*, *Nộp lại*, *Yêu cầu bổ sung*, *Duyệt phiếu*, *Cập nhật gộp B1/B2*, *Thu hồi duyệt*, *Xóa phiếu*) để gom gọn trên **1 hàng ngang duy nhất** từ `768px` trở lên và tự xuống dòng an toàn ở `390px`–`640px`. Lưu ý riêng `StaffTicketToolbar.tsx`: không dùng class `flex-nowrap` để bảo toàn kiểm thử co giãn Ca 10.
- **Bảng tính (`/bang-tinh`):** `ExcelRowCardEditor` hiển thị các dòng mobile thành 1 danh sách phẳng `divide-y divide-[#e2e8f0]` kèm phân trang chung ở đáy và nút ghost *"Chỉnh sửa chi tiết"*; `MobileStickyActionBar` giữ `border-t border-[#e2e8f0]` phẳng (không shadow nặng), chỉ nút *"Lưu & tiếp"* dùng nền `#006cee`.
- **Rà soát (`/ra-soat`):** Header `Bước 8/8` nằm trực tiếp trên nền trang; bên dưới là 1 container duy nhất chia tầng bởi `border-b`: thanh tệp `bg-[#f8fafc]` → banner trạng thái → dải 5 chỉ số `divide-x` → `AuditResultTabs` dạng danh sách phẳng `divide-y` (chỉ cảnh báo `'fix'` có nền đỏ nhạt; nút *"Mở biểu"* / *"Quy tắc"* dạng ghost không viền).

### 5. Quy chuẩn Hydration, Tailwind v4 & Accessibility
- **Chống React Hydration Error `#418`:** HTML render lần đầu giữa SSR và Client phải giống nhau 100%; mọi giá trị đọc từ `localStorage`, `sessionStorage`, `window`, `Date.now()` hoặc format thời gian động phải đưa vào `useEffect` (không dùng `suppressHydrationWarning` để che lỗi).
- **Tailwind v4 Display Specificity:** Không ghép class `hidden` với `inline-flex` / `flex` nếu chuỗi sau đè specificity trong v4; ưu tiên `!hidden md:!inline-flex` hoặc điều kiện tách biệt rõ ràng.
- **Accessibility:** Mọi `input`, `textarea`, `select`, `combobox` phải có `<label htmlFor>` hoặc `aria-label`; mọi nút chỉ có icon phải có `aria-label` hoặc `title`; mỗi trang có đúng 1 thẻ `<h1>`.

---

## C. Quy tắc kiểm tra

- **Kiểm tra thương hiệu & màu sắc:** Quét `src/` đảm bảo không còn `text-black`, `text-slate-900`, `text-gray-900`, dùng đúng `rgb(0, 71, 118)` (`#004776`), **HCM-UTE** (có gạch nối) và **Sentence case**.
- **Kiểm tra giới hạn dòng (Rule 8):** Chạy `node ".agents/skills/source-code-data-flow-audit/scripts/audit-data-flow.mjs"` và `npm test` — toàn bộ tệp `.ts`/`.tsx` trong `src/` phải `< 300` dòng (`6/6 PASS`).
- **Kiểm tra Responsive & DOM (Playwright):** Kiểm tra trên các độ rộng `320px`, `375px`, `390px`, `640px`, `768px`, `1024px`, `1440px` đảm bảo `hydr=0`, `ovfX=0`, `unlblIn=0`, `unlblBtn=0`, `h1=1`, và cụm nút duyệt phiếu hiển thị 1 hàng ở `>= 768px` (`rows=1`, `ovfRow=0`).

---

## D. Giới hạn

- **Không được thay đổi nghiệp vụ cốt lõi:** Skill UI chỉ điều chỉnh trình bày, bố cục và accessibility; không tự ý thay đổi Prisma schema, API contract, phân quyền RBAC, logic tính công thức 15 sheet hoặc dữ liệu XML Excel.
- **Bảo toàn chuỗi neo kiểm thử:** Không xóa hoặc đổi sai các chuỗi/class được kiểm thử tự động kiểm tra (ví dụ: `UnitMonitoringHistoryPanel` giữ đúng 2 `<MonitorSearchInput`, `StaffTicketToolbar` không dùng `flex-nowrap`, `StaffTicketInlineForm` giữ `grid-cols-2` và `Xem trước bản in A4`, `SchoolOverviewDashboard` giữ đầy đủ nhãn KPI chuẩn).
- **Hỏi ý kiến người dùng trước khi đổi nhận diện gốc:** Mọi thay đổi liên quan màu chủ đạo `#004776` / `#0072BC`, logo HCM-UTE hoặc cấu trúc điều hướng đa trang phải được xác nhận trước.
