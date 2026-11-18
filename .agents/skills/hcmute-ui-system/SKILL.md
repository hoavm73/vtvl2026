---
name: hcmute-ui-system
description: Hệ thống thiết kế giao diện chuẩn HCM-UTE Design System V2 (S-Link & Flat Divider-First UI) — Nội dung #004776, Tiêu đề khu vực #0072BC, Nút hành động chính #006cee, nền ẩn KPI dịu nhẹ, Skeleton Loading, tối ưu ảnh AVIF/WebP và chuẩn TechDoc 3 vai trò.
---

# Skill: Hệ thống thiết kế giao diện HCM-UTE (Design System V2 & Flat S-Link UI)

## A. Thông tin Skill

- **Tên Skill:** `hcmute-ui-system`
- **Mô tả chức năng:** Quy chuẩn toàn bộ hệ thống UI/UX của **HCM-UTE VTVL 360** kết hợp nhận diện **HCM-UTE S-Link** (`https://link.hcmute.edu.vn/`) và kiến trúc **Flat & Divider-First UI** (tối giản card lồng nhau, ưu tiên khoảng trắng, typography, đường phân cách `divide-y`/`divide-x` và nền ẩn chuyển sắc dịu nhẹ).
- **Mục tiêu sử dụng:**
  1. Giữ vững nhận diện thương hiệu đại học: chữ nội dung xanh thẫm `rgb(0, 71, 118)` (`#004776`), tiêu đề khu vực/phân hệ xanh `#0072BC`, nút hành động chính xanh `#006cee`; cấm tuyệt đối `#000000`, `text-black`, `text-slate-900`, `text-gray-900`.
  2. Giao diện sắc nét, liền mạch, thoáng sạch: tối đa 1 lớp card ngoài cho mỗi khu vực chính; dùng `divide-y` / `divide-x` thay cho khung viền kép hoặc bóng đổ nặng.
  3. Trải nghiệm tải và hiệu năng tối ưu: sử dụng **Skeleton Loading** (`src/components/ui/Skeleton.tsx`) thay cho chữ/spinner rời rạc và tối ưu ảnh qua `next/image` (AVIF/WebP).
  4. Chuẩn responsive hoàn chỉnh từ Mobile (`320px`–`390px`), Tablet (`640px`–`1024px`) tới Desktop (`1280px`–`1440px`), không tràn ngang (`overflowX === 0`), không lỗi React Hydration `#418`, đạt chuẩn Accessibility và in PDF A4 không trang trắng.
- **Điều kiện kích hoạt:** Kích hoạt khi xây dựng hoặc chỉnh sửa bất kỳ tệp giao diện nào trong `src/app/`, `src/components/` và `src/app/globals.css`.

---

## B. Quy trình thực hiện

### 1. Bảng màu chuẩn S-Link & HCM-UTE (Color Palette)
- **Màu tiêu đề trang & tiêu đề khu vực / phân hệ (`h1`, `h2`, `.section-title`, `.page-title`, tiêu đề các biểu và tiêu đề khối đồng cấp):** **`#0072BC`** (`--hcmute-blue`). Riêng chữ trên banner/modal nền xanh đậm giữ `#ffffff` (`text-white`), bản in hành chính A4 giữ thể thức chuẩn. Cỡ tiêu đề `h1, .page-title` và tiêu đề các biểu dùng **`21px` (`1.3125rem`)** trên desktop / **`16.5px` (`1.03125rem`)** trên mobile (75% mức `1.75rem` cũ).
- **Màu chữ nội dung & bảng biểu (`--foreground`):** **`#004776`** (`rgb(0, 71, 118)`) cho văn bản (`p`, `span`, `li`, `td`, `th`), nhãn form và số liệu đậm. **Tuyệt đối cấm** `#000000`, `text-black`, `text-slate-900`, `text-gray-900`.
- **Màu hành động chính & pill bộ lọc đang chọn (`--primary-action`):** **`#006cee`** (hover: `#005ecc`), đồng bộ với tab active *"Bảng tính 10 biểu"* trên thanh điều hướng. Dùng thống nhất cho toàn bộ nút CTA chính (kể cả `+ Thêm nhiệm vụ`, `Lưu & tiếp`, `Lưu và nộp`, `Duyệt phiếu`) và pill lọc đang chọn.
- **Màu chữ phụ:** `#20446c` và `#476885` cho chú thích, thời gian, thông tin thứ cấp.
- **Màu nền & đường kẻ phân cấp:**
  - Nền trang: `#f8fafc` / `#f8fbff`; nền vùng chứa chính: `#ffffff`.
  - Thanh công cụ / track segmented control: `#f8fafc`, `#e9f0f8`, `#f1f5f9`.
  - Mục đang chọn / active row: nền xanh rất nhạt `#eef6ff` (có thể kết hợp vạch trái `border-l-2` hoặc `border-l-4 border-[#006cee]`, không dùng `ring-2` + `border-2` dày).
  - Đường gạch chân tab đang chọn (Active Tab Underline): dùng màu cam san hô **`#FD8C73`** với độ dày tăng `110%` (`border-b-[2.2px]` cho thanh tab `2px` chuẩn và `border-b-[3.3px]` cho thanh tab bảng tính Excel `3px`), giữ nguyên màu chữ/biểu tượng xanh `#006cee` hoặc `#004776`.
  - Đường kẻ phân cách (hairline divider): `1px solid #e2e8f0` (`divide-[#e2e8f0]`, `border-[#e2e8f0]`). Viền ô nhập liệu (`input`, `textarea`, `select`): `#cbd5e1`.
- **Nền ẩn màu sắc dịu nhẹ (Subtle Pastel Gradient Wash) cho ô con số KPI nổi bật:**
  - Các ô thống kê trọng yếu giữ cấu trúc lưới phẳng `border-y border-[#e2e8f0] divide-x divide-y divide-[#e2e8f0]` và phủ nền chuyển sắc rất dịu theo ngữ nghĩa từng chỉ số: xanh dương `from-[#eef6ff] via-[#f5f9ff] to-white`, xanh lam `from-[#ecfeff]/85 via-[#f2f9ff] to-white`, xanh ngọc/đạt `from-[#e8fbf2] via-[#f3fcf8] to-white`, vàng hổ phách/chờ duyệt `from-[#fff6e5] via-[#fffaf0] to-white`, đỏ cảnh báo `from-[#fef2f2] via-[#fff7f7] to-white`, tím đã gộp `from-[#f3efff]/90 via-[#f9f7ff] to-white`.
- **Màu trạng thái:**
  - Nghiêm trọng / Phải sửa / Xóa: `#f4212e` / `#b42318` (nền cảnh báo nhẹ `bg-red-50/45` hoặc `bg-[var(--fix-soft)]`).
  - Hoàn thành / Đạt: `#00b87a` / `#008f5d` / `#13653f`.
  - Cần xem lại / Yêu cầu sửa: `#f99c00` / `#8f4f00`.

### 2. Typography & Bolder 110%
- **Phông chữ:** `Be Vietnam Pro`, `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, sans-serif — hiển thị đầy đủ dấu thanh tiếng Việt Unicode; ô nhập (`input`, `select`, `textarea`) phải có chiều cao thoải mái (`min-h-[40px]`–`44px`, `leading-normal`) để không cắt dấu mũ tiếng Việt.
- **Thang độ đậm:** Văn bản thường `440`, nhãn phụ `500`, nút/cột bảng `600` (`font-semibold`), tiêu đề khối/mã `700` (`font-bold`), chỉ số KPI lớn `715`–`800` (`font-extrabold`, `tabular-nums`, `tracking-tight`).
- **Viết hoa tiếng Việt:** Chuẩn **Sentence case** (chỉ viết hoa chữ cái đầu cụm từ và danh từ riêng); viết tắt trường luôn là **HCM-UTE** (có gạch nối `-`).

### 3. Kiến trúc Phẳng, Vertical Timeline & Skeleton Loading
1. **Tối đa 1 cấp card ngoài cho mỗi khu vực:** Không bọc Page -> Outer Card -> Inner Card -> Stat Box. Đặt header trang và thanh tab trực tiếp trên nền trang; mỗi khối dữ liệu dùng 1 container `bg-white rounded-[14px]` hoặc `rounded-[16px] border border-[#e2e8f0]`.
2. **Thay ô viền bằng khoảng trắng & `divide-y` / `divide-x`:** Thẻ KPI và danh sách mobile (`UnitMonitoringMobileCards`, bảng dữ liệu, kết quả rà soát) dùng phân cách hairline `divide-[#e2e8f0]`.
3. **Hệ thống nút Tonal (Phương án 2 — 3 cấp rõ ràng):**
   - Nút chính duy nhất mỗi thanh công cụ dùng nền solid `#006cee` (`text-white`, ví dụ `Lưu & tiếp`, `Tạo phiếu mới`, `+ Thêm nhiệm vụ`).
   - Nút phụ quan trọng dùng outline mảnh (`border-[#cbd5e1] bg-white hover:bg-[#eef5ff]`, ví dụ `Lưu`, `Công cụ`).
   - Nút phụ trợ / tra cứu dùng ghost (`hover:bg-[#eef5ff] text-[#004776]`, ví dụ `Kiểm tra dữ liệu`, `Phiên bản`).
   - Thanh đầu trang Bảng tính (`/bang-tinh`) gom gọn đúng 3 tầng: Tầng 1 điều hướng nhanh + tiêu đề biểu (`H1`); Tầng 2 thông tin ngữ cảnh + nhóm nút thao tác bên phải; Tầng 3 dải tab 10 biểu.
4. **Dòng thời gian dọc (Vertical Timeline) cho Nhật ký & Lịch sử:**
   - Mọi danh sách lịch sử (`UnitMonitoringHistoryPanel`, `UnitWorkbookHistoryPanel`, `AdminSystemLogsTab`, khối Nhật ký trang chủ, `UnitProfileOverviewPanel`) trình bày dạng trục dọc `w-px bg-[#dbe8f5]`, chấm tròn trạng thái `ring-4` (`animate-pulse` ở mục mới nhất) và huy hiệu *"Cập nhật liên tục"*.
5. **Skeleton Loading chuẩn (`src/components/ui/Skeleton.tsx`):**
   - Cấm hiển thị dòng chữ `"Đang tải..."` hoặc vòng xoay trơn đơn điệu. Dùng đúng component: `PageWorkspaceSkeleton` (khởi tạo trang/Suspense), `TicketListSkeleton` (danh sách phiếu/phối hợp), `TimelineListSkeleton` (dòng thời gian nhật ký), `TableRowsSkeleton` (bảng 39 đơn vị) và `InlineSkeleton` (số liệu KPI/badge).
6. **Tối ưu hình ảnh (`next/image` + AVIF/WebP) & In PDF A4:**
   - `next.config.mjs` bật tối ưu ảnh `formats: ['image/avif', 'image/webp']`, `deviceSizes` & `imageSizes`; toàn bộ ảnh tĩnh thương hiệu dùng `<Image>` kèm `width`, `height`, `sizes`, `priority` / `loading="lazy"`.
   - Khi in PDF A4 từ modal hoặc inline preview, ẩn nội dung nền qua `print:hidden`, đặt khối in `print:static print:overflow-visible print:min-h-0` để tuyệt đối không sinh trang trắng.

### 4. Chuẩn bố cục 5 nhóm điều hướng, phân hệ trọng tâm & TechDoc 3 vai trò
- **Kiến trúc 5 nhóm điều hướng (`AppSidebar` & `Header`):**
  1. **Tổng quan (`/` & `/?tab=unit-monitor`):** Hero banner không bóng đổ; thanh segmented control phẳng; 4 KPI nền pastel + phân bổ khối đơn vị `divide-x`; tab *"Theo dõi đơn vị"* dùng chế độ `compactOverviewMode` 39 đơn vị (bao gồm khối `UnitMonitoringHistoryPanel` kèm 2 `<MonitorSearchInput>`).
  2. **Nghiệp vụ cá nhân (`/phieu-cong-viec` & `/bam-gio`):** Gồm 4 tab cá nhân (`Phiếu của tôi`, `Tạo phiếu công việc`, `Công việc phối hợp với tôi`, `Mối quan hệ công việc`), tách hoàn toàn khỏi duyệt/gộp đơn vị.
  3. **Nghiệp vụ đơn vị (`/nghiep-vu-don-vi`, `/bang-tinh`, `/phieu-don-vi`):**
     - Sidebar nhóm `Nghiệp vụ đơn vị` hiển thị 5 lối vào trực tiếp: `Hồ sơ đơn vị`, `Bảng tính 10 biểu`, `Quản lý phiếu đơn vị`, `Sơ đồ VTVL dự kiến` (`/nghiep-vu-don-vi?tab=org-tree`), và `Biểu đồ cơ cấu nhân lực` (`/nghiep-vu-don-vi?tab=workforce-chart`).
     - `/nghiep-vu-don-vi`: 7 tab (`overview`, `workbook`, `tickets`, `org-tree`, `workforce-chart`, `history`, `check`), trong đó `org-tree` và `workforce-chart` hiển thị trực tiếp (`inline`) từ `UnitOrgTreeModal` và `WorkforceStructureChartModal`.
     - `/bang-tinh`: Trình soạn thảo 10 biểu với đầu trang 3 tầng tinh gọn (đã chuyển Sơ đồ VTVL & Biểu đồ nhân lực khỏi menu `Công cụ` ra Nghiệp vụ đơn vị).
     - `/phieu-don-vi`: Duyệt phiếu, yêu cầu bổ sung, thu hồi/hủy và gộp phiếu vào B1/B2 với nút 1 hàng ngang từ `>= 768px` (`rows=1`, `ovfRow=0`).
  4. **Kiểm tra & thẩm định TCNS (`/admin/tham-dinh`):** Chỉ `admin`/TCNS truy cập; danh sách 39 đơn vị kèm trạng thái thẩm định và màn hình thẩm định chi tiết 5 thẻ.
  5. **Quản trị & tra cứu (`/admin` & `/huong-dan`):**
     - `/admin` giữ 7 tab quản trị cấp trường (`overview`, `sessions`, `review`, `accounts`, `units`, `session-control`, `system-logs`).
     - `/huong-dan` trình bày **TechDoc 3 vai trò** (`src/configs/hcmute-techdoc-roles.ts`) theo chuẩn `hcmute_techdoc_master`: văn phong hành chính công vụ ngắn gọn, sơ đồ luồng 4 bước (`#F0F9FF` / `#FEF3C7` / `#F0FDF4`), tác vụ chuẩn 4 mục (*Mục đích / Các bước / Kết quả / Lưu ý*), xử lý tình huống và nút in/xuất PDF A4.
  - **Redirect tương thích URL cũ (không 404):** `/ra-soat` → `/nghiep-vu-don-vi?tab=check` (hoặc `/admin/tham-dinh?tab=check` khi `scope=tcns`); `/tao-tep` mặc định → `/bang-tinh`; `/gop-phieu` → `/phieu-don-vi?tab=approved`; `/phieu-cong-viec?tab=unit|pending|approved` → `/phieu-don-vi`.

### 5. Quy chuẩn Hydration, Tailwind v4 & Accessibility
- **Chống React Hydration Error `#418`:** HTML SSR và Client phải khớp 100%; giá trị đọc từ `localStorage`, `sessionStorage`, `window` phải đặt trong `useEffect`.
- **Tailwind v4 Display Specificity:** Không ghép class `hidden` với `inline-flex` / `flex` xung đột; ưu tiên `!hidden md:!inline-flex` hoặc điều kiện tách biệt.
- **Accessibility:** Mọi `input`, `textarea`, `select` có `<label htmlFor>` hoặc `aria-label`; nút chỉ có icon có `aria-label` hoặc `title`; Skeleton có `aria-busy="true"`; mỗi trang có đúng 1 `<h1>`.

---

## C. Quy tắc kiểm tra

- **Kiểm tra thương hiệu & màu sắc:** Quét `src/` đảm bảo không còn `text-black`, `text-slate-900`, `text-gray-900`, dùng đúng `#004776`, tiêu đề `#0072BC`, nút chính `#006cee`, **HCM-UTE** (có gạch nối) và **Sentence case**.
- **Kiểm tra giới hạn dòng (Rule 8):** Chạy `node ".agents/skills/source-code-data-flow-audit/scripts/audit-data-flow.mjs"` và `npm test` — toàn bộ tệp `.ts`/`.tsx` trong `src/` phải `< 300` dòng (`6/6 PASS`).
- **Kiểm tra Responsive, Ảnh & DOM (Playwright):** Kiểm tra trên `390px`–`1440px` đảm bảo `hydr=0`, `ovfX=0`, ảnh tĩnh qua `/_next/image` trả về `image/avif` hoặc `image/webp`, in PDF A4 không có trang trắng, và các nút duyệt phiếu hiển thị 1 hàng ở `>= 768px`.

---

## D. Giới hạn

- **Không được thay đổi nghiệp vụ cốt lõi:** Skill UI chỉ điều chỉnh trình bày, bố cục, tải khung xương, tối ưu ảnh và accessibility; không tự ý thay đổi Prisma schema, API contract, phân quyền RBAC hoặc công thức dữ liệu Excel.
- **Bảo toàn chuỗi neo kiểm thử:** Không xóa hoặc đổi sai các chuỗi/class được kiểm thử tự động kiểm tra (như `UnitMonitoringHistoryPanel` giữ 2 `<MonitorSearchInput`, `StaffTicketToolbar` không dùng `flex-nowrap`, `StaffTicketInlineForm` giữ `grid-cols-2` và `Xem trước bản in A4`, `SchoolOverviewDashboard` giữ đầy đủ nhãn KPI chuẩn, `OverviewWelcomeBanner` giữ `/assets/login/hcmute-gate-line-art-transparent.png`, `object-contain`, `pointer-events-none`, `alt=""`).
- **Hỏi ý kiến người dùng trước khi đổi nhận diện gốc:** Mọi thay đổi liên quan bảng màu thương hiệu `#004776` / `#0072BC` / `#006cee`, logo HCM-UTE hoặc cấu trúc điều hướng đa trang phải được xác nhận trước.
