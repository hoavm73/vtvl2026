---
name: hcmute-ui-system
description: Hệ thống thiết kế giao diện chuẩn HCM-UTE Design System V2.1 (S-Link & Flat Divider-First UI) — Header breadcrumb gióng thẳng Sidebar, cụm tài khoản cố định đáy Sidebar, cổng PageHeaderActions chống lặp tiêu đề, bảng màu #004776 / #0072BC / #006cee, thanh tab gạch chân #FD8C73, Skeleton Loading, bảng xem trước nhập Excel A1 toàn trang và chuẩn TechDoc 3 vai trò.
---

# Skill: Hệ thống thiết kế giao diện HCM-UTE (Design System V2.1 & Flat S-Link UI)

## A. Thông tin Skill

- **Tên Skill:** `hcmute-ui-system`
- **Mô tả chức năng:** Quy chuẩn toàn bộ hệ thống UI/UX của **HCM-UTE VTVL 360** kết hợp nhận diện **HCM-UTE S-Link** (`https://link.hcmute.edu.vn/`) và kiến trúc **Flat & Divider-First UI** (tối giản card lồng nhau, ưu tiên khoảng trắng, typography, đường phân cách `divide-y`/`divide-x`, thanh Header hợp nhất Breadcrumb + nút nghiệp vụ và cụm tài khoản cố định dưới đáy Sidebar).
- **Mục tiêu sử dụng:**
  1. Giữ vững nhận diện thương hiệu đại học: chữ nội dung xanh thẫm `rgb(0, 71, 118)` (`#004776`), tiêu đề khu vực/phân hệ xanh `#0072BC`, nút hành động chính xanh `#006cee`; cấm tuyệt đối `#000000`, `text-black`, `text-slate-900`, `text-gray-900`.
  2. Giao diện sắc nét, liền mạch, tối đa hóa không gian làm việc: tối đa 1 lớp card ngoài cho mỗi khu vực chính; dùng `divide-y` / `divide-x`; không lặp tiêu đề/bộ lọc giữa Header và thân trang; thanh lọc gọn 1 hàng ngang.
  3. Trải nghiệm tải và phản hồi tức thì: sử dụng **Skeleton Loading** (`src/components/ui/Skeleton.tsx`), cảnh báo lỗi nhập liệu trực tiếp từng ô (`ExcelDataCell`) kèm tự động cuộn tới ô lỗi đầu tiên, và xem trước toàn bảng trước khi nạp Excel.
  4. Chuẩn responsive hoàn chỉnh từ Mobile (`320px`–`390px`), Tablet (`640px`–`1024px`) tới Desktop (`1280px`–`1440px`), không tràn ngang (`overflowX === 0`), không lỗi React Hydration `#418`, đạt chuẩn Accessibility và in PDF A4 không trang trắng.
- **Điều kiện kích hoạt:** Kích hoạt khi xây dựng hoặc chỉnh sửa bất kỳ tệp giao diện nào trong `src/app/`, `src/components/` và `src/app/globals.css`.

---

## B. Quy trình thực hiện

### 1. Bảng màu chuẩn S-Link & HCM-UTE (Color Palette)
- **Màu tiêu đề trang & tiêu đề khu vực / phân hệ (`h1`, `h2`, `.section-title`, `.page-title`, mục cuối Breadcrumb trên Header và tiêu đề các biểu):** **`#0072BC`** (`--hcmute-blue`). Riêng chữ trên banner/modal nền xanh đậm giữ `#ffffff` (`text-white`), bản in hành chính A4 giữ thể thức chuẩn. Cỡ tiêu đề `h1, .page-title` và tiêu đề các biểu dùng **`21px` (`1.3125rem`)** trên desktop / **`16.5px` (`1.03125rem`)** trên mobile.
- **Màu chữ nội dung & bảng biểu (`--foreground`):** **`#004776`** (`rgb(0, 71, 118)`) cho văn bản (`p`, `span`, `li`, `td`, `th`), nhãn form và số liệu đậm. **Tuyệt đối cấm** `#000000`, `text-black`, `text-slate-900`, `text-gray-900`.
- **Màu hành động chính & pill bộ lọc đang chọn (`--primary-action`):** **`#006cee`** (hover: `#005ecc`), đồng bộ với tab active *"Bảng tính 10 biểu"* và icon mục đang chọn trên Breadcrumb. Dùng thống nhất cho toàn bộ nút CTA chính (`+ Thêm nhiệm vụ`, `Lưu & tiếp`, `Lưu và nộp`, `Duyệt phiếu`, `Xác nhận nạp`) và pill lọc đang chọn.
- **Màu chữ phụ:** `#20446c` và `#476885` cho chú thích, thời gian, thông tin thứ cấp.
- **Màu nền & đường kẻ phân cấp:**
  - Nền trang: `#f8fafc` / `#f8fbff`; nền vùng chứa chính: `#ffffff`.
  - Thanh công cụ / track segmented control: `#f8fafc`, `#e9f0f8`, `#f1f5f9`.
  - Mục đang chọn / active row: nền xanh rất nhạt `#eef6ff` (kết hợp `border-l-2`/`border-l-4 border-[#006cee]`, không dùng `ring-2` + `border-2` dày).
  - Đường gạch chân tab đang chọn (Active Tab Underline): màu cam san hô **`#FD8C73`** độ dày đồng nhất **`border-b-[1.8px]`** trên mọi thanh tab, **không dùng `-mb-[1px]`** trong vùng `overflow-x-auto`, ngưỡng hiển thị tab ngang dùng `sm:` (`>= 640px`).
  - Đường kẻ phân cách (hairline divider): `1px solid #e2e8f0` / `#d8e3ef`. Viền ô nhập liệu (`input`, `textarea`, `select`): `#cbd5e1`.
- **Nền ẩn màu sắc dịu nhẹ (Subtle Pastel Gradient Wash) cho ô con số KPI nổi bật:**
  - Giữ lưới phẳng `border-y border-[#e2e8f0] divide-x divide-y divide-[#e2e8f0]` và phủ nền chuyển sắc dịu theo ngữ nghĩa: xanh dương `from-[#eef6ff] via-[#f5f9ff] to-white`, xanh ngọc/đạt `from-[#e8fbf2] via-[#f3fcf8] to-white`, vàng hổ phách/chờ duyệt `from-[#fff6e5] via-[#fffaf0] to-white`, đỏ cảnh báo `from-[#fef2f2] via-[#fff7f7] to-white`, tím đã đưa vào biểu `from-[#f3efff]/90 via-[#f9f7ff] to-white`.
- **Màu trạng thái:**
  - Nghiêm trọng / Phải sửa / Xóa / Lỗi ô nhập: `#f4212e` / `#b42318` (nền cảnh báo nhẹ `bg-[#fdeceb]/45` hoặc `bg-red-50/45`).
  - Hoàn thành / Đạt / Đã đưa vào Biểu A2 & B1: `#00b87a` / `#008f5d` / `#13653f`.
  - Cần xem lại / Trùng nội dung / Yêu cầu bổ sung: `#f99c00` / `#8f4f00` / `bg-amber-50/45`.
  - Cột Trạng thái Biểu A1 (cả Excel & preview): nền xanh dương nhạt `#e8f3ff` / `#ebf6ff`, chữ `#0058a3`, viền `#bcdcff`.

### 2. Typography & Bolder 110%
- **Phông chữ:** `Be Vietnam Pro`, `Inter`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, sans-serif — hiển thị đầy đủ dấu thanh tiếng Việt Unicode; ô nhập (`input`, `select`, `textarea`) có chiều cao thoải mái (`min-h-[40px]`–`44px`, `leading-normal`) để không cắt dấu mũ tiếng Việt.
- **Thang độ đậm:** Văn bản thường `440`, nhãn phụ `500`, nút/cột bảng `600` (`font-semibold`), tiêu đề khối/mã `700` (`font-bold`), chỉ số KPI lớn `715`–`800` (`font-extrabold`, `tabular-nums`, `tracking-tight`).
- **Viết hoa tiếng Việt:** Chuẩn **Sentence case** (chỉ viết hoa chữ cái đầu cụm từ và danh từ riêng); viết tắt trường luôn là **HCM-UTE** (có gạch nối `-`).

### 3. Kiến trúc AppShell, Header Breadcrumb & Sidebar cố định (V2.1)
1. **Header gióng thẳng tuyệt đối với Sidebar (`Header.tsx` & `AppSidebar.tsx`):**
   - Khối logo HCM-UTE bên trái Header (`h-16`) có bề rộng và thời gian chuyển động đồng bộ 100% với Sidebar (`lg:w-[272px]` khi mở rộng, `lg:w-[72px]` hiển thị biểu trưng tròn căn giữa khi thu gọn, `duration-300`) kèm đường kẻ dọc xuyên suốt `lg:border-r lg:border-[#d8e3ef]`.
   - Vùng giữa Header hiển thị thanh **Breadcrumb 1 hàng** (`Tổng quan > ... > [icon] Mục hiện tại`) qua `PageHeaderContext` (`useSetPageBreadcrumbs` & `getDefaultBreadcrumbs`): mục cuối nổi bật bằng chữ đậm `#0072BC` + icon `#006cee`.
   - Góc phải Header (`>= lg`) đặt cổng portal `#vtvl-header-actions-slot` (`<PageHeaderActions>`) để gom bộ chọn đơn vị và cụm nút thao tác chính của trang lên thanh trên cùng; đồng thời **ẩn khối tiêu đề lặp** trong thân trang trên desktop (`lg:hidden`, chỉ giữ trên mobile `< lg`).
2. **Cụm tài khoản cố định dưới đáy Sidebar trái (`AppSidebar.tsx` + `UserProfilePopover.tsx` + `Popover.tsx`):**
   - `AppSidebar` dùng `sticky top-16 h-[calc(100vh-4rem)]`, vùng danh mục cuộn độc lập (`flex-1 overflow-y-auto`), còn cụm `<UserProfilePopover placement="sidebar" collapsed={collapsed} />` được ghim cố định ở đáy Sidebar khi cuộn trang.
   - Khi ở đáy Sidebar, `PopoverContent` dùng `side="top" align="start"` để menu tài khoản xổ ngược lên trên không bị khuất màn hình; trên mobile (`< lg`), `UserProfilePopover` giữ nguyên ở góc phải Header cạnh nút mở Drawer.
3. **Kiến trúc Phẳng, Nút Tonal 3 cấp, Vertical Timeline & Skeleton Loading:**
   - Tối đa 1 cấp card ngoài cho mỗi khu vực (`bg-white rounded-[14px]`/`rounded-[16px] border border-[#e2e8f0]`); dùng `divide-y` / `divide-x` thay viền kép.
   - Hệ thống nút Tonal 3 cấp: Nút chính solid `#006cee` (`text-white`), nút phụ outline mảnh (`border-[#cbd5e1] bg-white hover:bg-[#eef5ff]`), nút phụ trợ ghost (`hover:bg-[#eef5ff] text-[#004776]`).
   - Dòng thời gian dọc (Vertical Timeline): trục dọc `w-px bg-[#dbe8f5]`, chấm tròn trạng thái `ring-4` (`animate-pulse` ở mục mới nhất) và huy hiệu *"Cập nhật liên tục"*.
   - **Skeleton Loading (`src/components/ui/Skeleton.tsx`):** Cấm hiện `"Đang tải..."` trơn; dùng đúng `PageWorkspaceSkeleton`, `TicketListSkeleton`, `TimelineListSkeleton`, `TableRowsSkeleton`, `InlineSkeleton`.
   - **Tối ưu ảnh & In PDF A4:** `next/image` (`formats: ['image/avif', 'image/webp']`); in PDF A4 ẩn nền qua `print:hidden` và đặt khối in `print:static print:overflow-visible print:min-h-0`.

### 4. Chuẩn bố cục 5 nhóm điều hướng, phân hệ trọng tâm & TechDoc 3 vai trò
- **Kiến trúc 5 nhóm điều hướng (`AppSidebar`):** Mỗi nhóm (`Tổng quan`, `Nghiệp vụ cá nhân`, `Nghiệp vụ đơn vị`, `Kiểm tra & thẩm định TCNS`, `Quản trị & tra cứu`) hỗ trợ thu gọn/xổ ra lưu `localStorage`.
  1. **Tổng quan (`/` & `/?tab=unit-monitor`):** Hero banner không bóng đổ; 4 KPI nền pastel + phân bổ khối đơn vị `divide-x`; tab *"Theo dõi đơn vị"* dùng `compactOverviewMode` 39 đơn vị (kèm 2 `<MonitorSearchInput>` trong `UnitMonitoringHistoryPanel`).
  2. **Nghiệp vụ cá nhân (`/phieu-cong-viec` & `/bam-gio`):** Tiêu đề trên Header là **`Phiếu khảo sát khối lượng công việc cá nhân`** (nút `Bảng tính toàn đơn vị`, `+ Tạo phiếu mới`, đăng xuất đẩy lên `PageHeaderActions`); 4 tab cá nhân (`Phiếu của tôi`, `Tạo phiếu công việc`, `Công việc phối hợp với tôi`, `Mối quan hệ công việc`).
  3. **Nghiệp vụ đơn vị (`/nghiep-vu-don-vi`, `/bang-tinh`, `/phieu-don-vi`):**
     - Sidebar hiển thị 5 lối vào trực tiếp: `Hồ sơ đơn vị`, `Bảng tính 10 biểu`, `Quản lý phiếu đơn vị`, `Sơ đồ VTVL dự kiến`, `Biểu đồ cơ cấu nhân lực`.
     - `/nghiep-vu-don-vi`: 7 tab (`overview`, `workbook`, `tickets`, `org-tree`, `workforce-chart`, `history`, `check`). Thanh **Tiến độ thẩm định hồ sơ đơn vị** (`WorkbookReviewProgressStepper`) **chỉ hiển thị trong tab `overview` (Tổng quan đơn vị)**, ẩn khỏi các tab làm việc khác. Bộ chọn đơn vị + nút `Mở bảng tính toàn trang` nằm trên `PageHeaderActions`.
     - `/bang-tinh`: Breadcrumb tự đổi theo biểu đang mở + bộ chọn đơn vị trên `PageHeaderActions`; menu **Công cụ** đã ẩn hoàn toàn 2 nút nạp dữ liệu mẫu nguy hiểm (*Khôi phục dữ liệu mẫu TCNS*, *Nạp gợi ý VTVL chuẩn theo Đề án*). Khi nhập Excel Biểu A1 (`A1ImportModal` `max-w-6xl`), `A1ImportPreviewTable` hiển thị **toàn bộ bảng A1 đọc từ tệp** với 2 nút xác nhận trực tiếp (`Bỏ qua` / `Thêm mới`) trên từng dòng trùng + nút xác nhận cuối **`Xác nhận nạp`**; cột `Cơ quan / Đơn vị thực hiện` mặc định là **tên tiếng Việt đầy đủ không viết tắt**. Toàn bộ ô nhập liệu/dropdown bắt buộc kiểm tra lỗi trực tiếp trên ô trước khi lưu.
     - `/phieu-don-vi`: Gồm **4 tab** (`Toàn bộ phiếu đơn vị`, `Chờ duyệt & Yêu cầu bổ sung`, `Đã duyệt & đưa vào Biểu A2 & B1`, `Phiếu lưu nháp`). Dùng thống nhất nhãn chính xác **`Đưa vào Biểu A2 & B1`** / **`Đã đưa vào Biểu A2 & B1`** (không dùng `B1/B2` trên nút/nhãn phiếu), ẩn nút gộp thừa khi phiếu đã tự động đưa vào xong lúc duyệt; Lãnh đạo đơn vị có đủ nút duyệt/thu hồi duyệt/xóa cả trên phiếu cá nhân của mình sau khi nộp; cụm lọc đơn vị + nút tác vụ đẩy lên `PageHeaderActions`.
  4. **Kiểm tra & thẩm định TCNS (`/admin/tham-dinh`):** Chỉ `admin`/TCNS truy cập; trang duy nhất cho thẩm định cấp trường (không lặp tab trong `/admin`), nút `Quản trị hệ thống` nằm trên `PageHeaderActions`.
  5. **Quản trị & tra cứu (`/admin` & `/huong-dan`):**
     - `/admin` gồm **6 tab** gọn sạch (`1. Tổng quan theo dõi ĐV`, `2. Phiên & Bảng biểu`, `3. Tài khoản & Phân quyền`, `4. Đơn vị`, `5. Quản trị phiên`, `6. Nhật ký hệ thống`; URL cũ `/admin?tab=review` tự chuyển sang `/admin/tham-dinh`). Huy hiệu đồng bộ CSDL ghi gọn **`Đã đồng bộ CSDL`**.
     - `AdminAccountsTab`: chỉ giữ 1 dropdown lọc vai trò kèm số lượng từng nhóm + `Google OAuth (n)` (không lặp hàng nút pill phía trên).
     - `AdminSystemLogsTab`: đặt ô tìm kiếm, 4 nút lọc nhóm sự kiện (`Tất cả sự kiện`, `Đăng nhập & xác thực`, `Phiếu & bảng biểu`, `Quản trị & thẩm định`), bộ đếm và nút `Làm mới` trên **cùng 1 hàng ngang**.
     - `/huong-dan`: TechDoc 6 chương / 18 bài tích hợp cây mục lục trong `AppSidebar` (`SidebarTechDocTree`), cột giữa có Eyebrow `#0072BC`, `DocumentMetaBar`, `<Mermaid />` tương tác, cột phải `#nd-toc` `268px` (`>= 1280px`) hiển thị thanh tiến trình đọc (%) + Vertical Progress Timeline.
  - **Redirect tương thích URL cũ (không 404):** `/ra-soat` → `/nghiep-vu-don-vi?tab=check`; `/tao-tep` mặc định → `/bang-tinh`; `/gop-phieu` → `/phieu-don-vi?tab=approved`; `/phieu-cong-viec?tab=unit|pending|approved` → `/phieu-don-vi`; `/admin?tab=review` → `/admin/tham-dinh`.

### 5. Quy chuẩn Hydration, Tailwind v4, Chống mã thừa & Accessibility
- **Chống React Hydration Error `#418`:** HTML SSR và Client phải khớp 100%; dữ liệu từ `localStorage`, `sessionStorage`, `window`, `document.getElementById` (như portal `PageHeaderActions`) phải chạy trong `useEffect`.
- **Tailwind v4 Display Specificity:** Không ghép class `hidden` với `inline-flex` / `flex` xung đột; tách rõ breakpoint (`flex lg:hidden` vs `hidden lg:flex`).
- **Chống component mồ côi & Giới hạn 300 dòng:** Khi thay thế một component UI cũ, xóa ngay tệp cũ không còn import để tránh rác mã nguồn; mọi tệp trong `src/` bắt buộc `< 300` dòng.
- **Accessibility:** Mọi `input`, `textarea`, `select` có `<label htmlFor>` hoặc `aria-label`; nút chỉ có icon có `aria-label` hoặc `title`; Skeleton có `aria-busy="true"`; mỗi trang hiển thị đúng 1 `<h1>` có nghĩa.

---

## C. Quy tắc kiểm tra

- **Kiểm tra thương hiệu & màu sắc:** Quét `src/` đảm bảo không còn `text-black`, `text-slate-900`, `text-gray-900`, dùng đúng `#004776`, tiêu đề `#0072BC`, nút chính `#006cee`, **HCM-UTE** (có gạch nối) và **Sentence case**.
- **Kiểm tra giới hạn dòng & bộ kiểm thử tự động:** Chạy `npm run typecheck`, `node tests/vtvl-workflow.test.mjs` (Rule 8 `< 300` dòng), `node tests/unit-filter-sync.test.mjs`, `node tests/work-survey-lifecycle.test.mjs`, `node tests/a1-excel-and-validation.test.mjs` và `node tests/workbook-init-and-stale-cache.test.mjs` — toàn bộ phải PASS.
- **Kiểm tra Responsive, Ảnh & DOM:** Kiểm tra trên `390px`–`1440px` đảm bảo `hydr=0`, `ovfX=0`, đường kẻ dọc Header khớp Sidebar, cụm tài khoản cố định đáy Sidebar xổ ngược lên trên không bị cắt, ảnh qua `/_next/image` trả `avif`/`webp` và in PDF A4 không có trang trắng.

---

## D. Giới hạn

- **Không tự ý thay đổi nghiệp vụ cốt lõi hay CSDL:** Skill UI chỉ điều chỉnh trình bày, bố cục, phản hồi tương tác, tải khung xương, tối ưu ảnh và accessibility; không tự ý thay đổi Prisma schema, API contract, phân quyền RBAC hoặc công thức dữ liệu Excel.
- **Bảo toàn chuỗi neo kiểm thử:** Không xóa hoặc đổi sai các chuỗi/class được kiểm thử tự động kiểm tra (như `UnitMonitoringHistoryPanel` giữ 2 `<MonitorSearchInput`, `StaffTicketMergePreviewModal` giữ nhãn chuẩn `Đưa vào Biểu A2 & B1`, `StaffTicketInlineForm` giữ `grid-cols-2` và `Xem trước bản in A4`, `OverviewWelcomeBanner` giữ `/assets/login/hcmute-gate-line-art-transparent.png`, `object-contain`, `pointer-events-none`, `alt=""`).
- **Hỏi ý kiến người dùng trước khi đổi nhận diện gốc:** Mọi thay đổi liên quan bảng màu thương hiệu `#004776` / `#0072BC` / `#006cee`, logo HCM-UTE hoặc cấu trúc điều hướng đa trang phải được xác nhận trước.
