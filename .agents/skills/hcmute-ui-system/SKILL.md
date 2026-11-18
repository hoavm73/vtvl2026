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

### 4. Chuẩn bố cục 5 nhóm điều hướng, phân hệ trọng tâm & Thanh nút 1 hàng
- **Kiến trúc 5 nhóm điều hướng (`AppSidebar` & `Header`):**
  1. **Tổng quan (`/` & `/?tab=unit-monitor`):** Hero banner không bóng đổ; thanh segmented control phẳng; 4 KPI + phân bổ khối đơn vị dùng 1 lưới `divide-x`; tab *"Theo dõi đơn vị"* dùng chế độ tóm tắt `compactOverviewMode` 39 đơn vị (không lặp bảng lịch sử/duyệt phiếu chi tiết của `/admin`).
  2. **Nghiệp vụ cá nhân (`/phieu-cong-viec` & `/bam-gio`):** Gồm 4 tab cá nhân (`Phiếu của tôi`, `Tạo phiếu công việc`, `Công việc phối hợp với tôi`, `Mối quan hệ công việc`), tách hoàn toàn khỏi chức năng duyệt/gộp phiếu cấp đơn vị. `/bam-gio` giữ ngữ cảnh đo định mức thời gian B1/B2 liên kết thẳng về `/bang-tinh?sheet=B1`.
  3. **Nghiệp vụ đơn vị (`/nghiep-vu-don-vi`, `/bang-tinh`, `/phieu-don-vi`):**
     - `/nghiep-vu-don-vi`: 5 tab thống nhất (`Tổng quan đơn vị`, `Bảng tính 10 biểu`, `Phiếu đơn vị`, `Lịch sử & khôi phục`, `Kiểm tra trước khi gửi`), đồng bộ URL query qua `pushState` + `popstate` và khóa ngữ cảnh `unitCode` chặt theo vai trò.
     - `/bang-tinh`: Trình soạn thảo 10 biểu duy nhất; thanh lệnh dùng 1 nút phụ `Lưu` + 1 nút chính `Lưu & tiếp` + liên kết `Phiên bản: v*` (sang `?tab=history`) và `Kiểm tra dữ liệu` (sang `?tab=check`), menu `Công cụ` dẫn sang `/bam-gio` và `/tao-tep?mode=wizard`.
     - `/phieu-don-vi`: Duyệt phiếu, yêu cầu bổ sung, thu hồi/hủy và gộp phiếu vào B1/B2 với nút 1 hàng ngang từ `>= 768px` (`rows=1`, `ovfRow=0`).
  4. **Kiểm tra & thẩm định TCNS (`/admin/tham-dinh`):** Chỉ `admin`/TCNS truy cập; danh sách 39 đơn vị kèm trạng thái thẩm định (`chua_gui`..`da_khoa`) và màn hình thẩm định chi tiết 5 thẻ (`Tổng quan`, `Kết quả kiểm tra`, `Bảng biểu`, `Nhận xét`, `Lịch sử thẩm định`).
  5. **Quản trị & tra cứu (`/admin` & `/huong-dan`):** `/admin` chỉ giữ 7 tab quản trị cấp trường (`overview`, `sessions`, `review`, `accounts`, `units`, `session-control`, `system-logs`).
  - **Redirect tương thích URL cũ (không 404):** `/ra-soat` → `/nghiep-vu-don-vi?tab=check` (hoặc `/admin/tham-dinh?tab=check` khi `scope=tcns`); `/tao-tep` mặc định → `/bang-tinh` (chỉ mở wizard khi `?mode=wizard` / `?step=1|2|5|6|7`); `/gop-phieu` → `/phieu-don-vi?tab=approved`; `/phieu-cong-viec?tab=unit|pending|approved` → `/phieu-don-vi`.

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
