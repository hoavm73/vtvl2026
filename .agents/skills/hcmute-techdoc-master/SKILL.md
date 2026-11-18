---
name: hcmute_techdoc_master
description: Skill tổng hợp quy chuẩn xây dựng cổng tài liệu kỹ thuật và hướng dẫn sử dụng (TechDoc) chuẩn Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE), bao gồm kiến trúc Next.js + Fumadocs SSG, Design system V2, chuẩn MDX, sơ đồ Mermaid tương tác, xuất PDF A4, tối ưu di động và từ điển thuật ngữ — sẵn sàng áp dụng cho web vị trí việc làm HCM-UTE.
---

# Quy chuẩn tổng hợp xây dựng TechDoc chuẩn HCM-UTE

Bộ skill này hợp nhất toàn bộ quy chuẩn về thương hiệu, giao diện, kiến trúc, bảo mật, biên tập MDX và sơ đồ khối của cổng `hcmute-tech-doc` để nhân bản nhanh cho các hệ thống mới của Trường (đặc biệt là **web vị trí việc làm HCM-UTE**).

---

## 1. Nhận diện, thuật ngữ và văn phong bắt buộc

1. **Tên trường và viết tắt (bắt buộc):**
   - Viết tắt chính thức: **HCM-UTE** (luôn có gạch nối `-`; tuyệt đối không dùng `HCMUTE`, `HCM UTE`).
   - Tiếng Việt: **Trường Đại học Công nghệ Kỹ thuật TP.HCM** (`TP.HCM` viết liền, không khoảng trắng sau dấu chấm; không dùng tên cũ *Trường Đại học Sư phạm Kỹ thuật TP.HCM*).
   - Tiếng Anh: **Ho Chi Minh City University of Technology and Engineering** (không dùng *HCMC University...*).
2. **Đơn vị và chức danh trọng tâm cho web vị trí việc làm:**
   - Đơn vị chủ quản nghiệp vụ: **Phòng Tổ chức - Nhân sự** (*Office of Organization and Personnel* — `tcns.hcmute.edu.vn`; không dùng tên gộp cũ).
   - **Hiệu trưởng:** *President* (không dùng *Rector*) · **Phó Hiệu trưởng:** *Vice President*.
   - **Trưởng phòng / Phó trưởng phòng:** *Director / Deputy Director of the Office of …* (không dùng *Head of...*).
   - **Trưởng khoa / Phó trưởng khoa:** *Dean / Vice Dean of the Faculty of …*.
   - **Viện trưởng / Giám đốc trung tâm:** *Director of the Institute of …* / *Director of the … Center*.
   - **Trưởng bộ môn:** *Head of the Department of …*.
3. **Văn phong và quy tắc viết hoa tiếng Việt (Sentence case):**
   - Xưng hô thân thiện, chuẩn mực: **"Quý Thầy/Cô"** hoặc **"Thầy/Cô"**.
   - Chỉ viết hoa chữ cái đầu câu/cụm từ và tên riêng/danh từ riêng được định nghĩa. Không viết hoa đầu mỗi từ (Title case).
   - *Sai:* "Quy Trình Quản Lý Vị Trí Việc Làm" → *Đúng:* "Quy trình quản lý vị trí việc làm".

---

## 2. Hệ thống thiết kế giao diện (Design system V2 & Blueprint grid)

### 2.1 Quy tắc màu chữ thương hiệu (Light theme)
- **Tuyệt đối không dùng màu đen thuần** (`#000000`, `text-black`, `text-slate-900`, `text-gray-900`) cho tiêu đề và nội dung trên nền sáng.
- **Màu chữ mặc định bắt buộc:** Xanh thẫm thương hiệu **`rgb(0, 71, 118)`** (`#004776`) áp dụng cho `h1-h6, p, li, span, strong, b, th, td, nav, header, aside` và `.prose`.

### 2.2 Bảng màu OKLCH và nhận diện HCM-UTE
| Token | Light mode | Dark mode | Mục đích |
| :--- | :--- | :--- | :--- |
| `--primary` / Brand blue | `oklch(0.5505 0.2485 262.5896)` / `#0072BC` | `oklch(0.6357 0.1959 260.1213)` | Liên kết, nút chính, tiêu đề nhấn |
| `--destructive` / Brand red | `oklch(0.6207 0.2306 24.9164)` / `#ED1C24` | `oklch(0.6188 0.2376 25.7658)` | Cảnh báo, lỗi, hành động xóa |
| `--background` | `oklch(0.992 0.004 88)` | `oklch(0.1621 0.0472 251.0579)` | Nền toàn trang |
| `--foreground` | `rgb(0, 71, 118)` (`#004776`) | `oklch(0.9411 0.019 248.0297)` | Màu chữ chính |
| `--muted-foreground` | `oklch(0.42 0.08 250)` | `oklch(0.7211 0.0295 248.2358)` | Chữ phụ trợ, ghi chú |
| `--border` | `oklch(0.925 0.015 250)` | `oklch(0.2991 0.0399 250.6425)` | Đường viền mảnh |

### 2.3 Typography, độ đậm 92% và lưới Blueprint
- **Font stack:** `--font-sans: Inter, ui-sans-serif, sans-serif`; `--font-mono: JetBrains Mono, monospace`.
- **Giảm độ đậm còn 92%** để chữ có dấu tiếng Việt thanh thoát: `--font-weight-semibold: 550`, `--font-weight-bold: 644` (áp cho `b, strong, th`), `--font-weight-extrabold: 736`, `--font-weight-black: 828`.
- **Chống cắt dấu tiếng Việt trong ô nhập liệu:**
  ```css
  input, textarea, select { line-height: 2.05 !important; overflow: visible !important; }
  ```
- **Hệ thống lưới Blueprint & Card:** Nền lưới kỹ thuật 24x24px `.ute-blueprint-grid` (`rgba(0, 114, 188, 0.08)`), thẻ nội dung `.ute-card-blueprint` bo góc `1.25rem` (`20px`), mặt nạ mờ `.ute-mask-fade-br`, thanh TOC `#nd-toc` rộng `268px` trên màn hình `>= 1280px`.

---

## 3. Kiến trúc kỹ thuật, cấu trúc mã nguồn và bảo mật

### 3.1 Tech stack và lệnh gói
- **Bắt buộc dùng `pnpm`** (không dùng `npm`): Next.js App Router, `fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`, Tailwind CSS v4 (cần `postinstall: "node scripts/patch-fumadocs.mjs"` xử lý `@apply` trong `base.css` nếu dùng Tailwind v4), `mermaid`, `lucide-react`.
- **Cấu trúc thư mục chuẩn:**
  - `content/docs/<nhom-tai-lieu>/`: Bài viết `.mdx` và `meta.json` sắp xếp thứ tự.
  - `src/app/docs/[[...slug]]/`: Engine hiển thị tài liệu tĩnh SSG.
  - `src/app/llms.txt/` & `src/app/llms-full.txt/`: API cung cấp nội dung Markdown cho trợ lý AI (`docsLlms` trong `src/lib/source.ts`).
  - `src/configs/` (`app.config.ts`, `layout.config.tsx`): Cấu hình tên cổng, `basePath`, logo, menu điều hướng.
  - `src/components/`, `src/models/`, `src/services/`, `prompts/`, `skills/`.

### 3.2 Quy tắc mã nguồn và bảo mật bất biến
1. **Giữ `/docs/**` thuần Static Site Generation (SSG):** Tuyệt đối không gọi `cookies()`, `headers()` hay truy vấn dữ liệu người dùng riêng tư trong layout chung hoặc trang tài liệu công khai.
2. **Bảo mật phân hệ quản trị (nếu có `/admin`):** Xác thực qua Supabase Auth (`@supabase/ssr`), bắt buộc bật **Row Level Security (RLS)** trên mọi bảng dữ liệu riêng tư (mặc định DENY, tách policy `SELECT/INSERT/UPDATE/DELETE`), dùng file migration tại `supabase/migrations/YYYYMMDDHHMMSS_<action>.sql`.
3. **Không tin dữ liệu client và không lộ khóa mật:** Cấm dùng `localStorage`/`sessionStorage` làm quyền hạn chính thức, cấm đưa khóa mật hoặc `service_role` vào client hoặc biến `NEXT_PUBLIC_*`.
4. **Giới hạn kích thước file:** Giữ mọi file mã nguồn **dưới 300 dòng** (tách module/component nhỏ theo đơn nhiệm).

---

## 4. Quy chuẩn biên soạn tài liệu MDX

### 4.1 Frontmatter mở rộng (`src/lib/source.ts`)
```yaml
---
title: Tên bài viết theo chuẩn Sentence case
description: Mô tả ngắn gọn 1–2 câu về phạm vi nghiệp vụ và đối tượng sử dụng.
order: 1
status: đã ban hành
version: v1.0
updatedAt: 18/11/2026
changelog:
  - version: v1.0
    date: 18/11/2026
    description: Khởi tạo tài liệu hướng dẫn quy trình nghiệp vụ.
---
```

### 4.2 Cấu trúc chuẩn một bài hướng dẫn nghiệp vụ
1. **Mở đầu và thao tác nhanh:** Lời chào Thầy/Cô và khối `<Callout type="info" title="Thao tác nhanh (Dành cho Thầy/Cô)">` tóm tắt URL truy cập, 3 bước cốt lõi và điều kiện tiên quyết.
2. **Thân bài theo từng tác vụ:** Chia thành `## Tác vụ 1: ...`, `## Tác vụ 2: ...`, mỗi tác vụ bắt buộc đủ 4 mục con:
   - `### Mục đích`
   - `### Các bước thực hiện` (liệt kê đánh số hoặc dùng `<Steps><Step>...</Step></Steps>`)
   - `### Kết quả`
   - `### Lưu ý nếu có` (hoặc dùng `<Callout type="warn">`)
3. **Minh họa trực quan và tương tác:** Dùng `<Mermaid caption="...">`, `<Tabs>/<Tab>`, `<Accordion>/<Accordions>`, `<Diagram src="..." caption="..." />`.
4. **Cuối bài:** Mục `## ⚠️ Các tình huống thường gặp và cách xử lý` trình bày dạng `### Tình huống N: ...` kèm **Nguyên nhân** và **Cách xử lý**.

---

## 5. Quy chuẩn sơ đồ khối Mermaid tương tác (`<Mermaid />`)

- **Cấu trúc luồng chuẩn:** `[Nguồn / Vai trò] --> [Hành động / Thao tác] --> [Điều kiện rẽ nhánh: CÓ / KHÔNG] --> [Đích / Kết quả]`.
- **Màu sắc chuẩn HCM-UTE (cấu hình trong `src/components/Mermaid.tsx`):**
  - Khối chính: nền `#F0F9FF`, viền `#0072BC`, chữ `#003D66`.
  - Khối quyết định / lưu ý: nền `#FEF3C7`, viền `#D97706`, chữ `#92400E`.
  - Khối hoàn tất: nền `#F0FDF4`, viền `#16A34A`, chữ `#15803D`.
  - Khối nhóm (`subgraph`): nền `#F8FAFC`, viền `#0072BC`.
- **Liên kết nhấp chuột mở bài viết (`click`):** Dùng cú pháp trong MDX để biến sơ đồ thành bản đồ điều hướng:
  ```mdx
  <Mermaid caption="Quy trình quản lý vị trí việc làm (Bấm vào khối để mở hướng dẫn)">{`flowchart TD
      A["1. Phòng Tổ chức - Nhân sự<br/>Mở đợt rà soát"] --> B{"Đạt chuẩn?"}
      B -- "Có" --> C["2. Trình Ban Giám hiệu duyệt"]
      click A href "/docs/02-luong-a/01-khoi-tao-dot" "Mở hướng dẫn" _self
  `}</Mermaid>
  ```
- **Tiện ích đi kèm component:** Thanh thu phóng ngoài trang (50%–200%), phóng to toàn màn hình (50%–300%) hỗ trợ kéo rê, nút sao chép mã và tự động tắt gạch chân link.

---

## 6. Tiện ích tài liệu và tối ưu di động (Mobile-first)

- **Thanh tiện ích bài viết:** `DocumentMetaBar` (trạng thái/phiên bản/lịch sử), `MarkdownCopyButton`, `ViewOptionsPopover`, `ExportPdfButton`, `ArticleFeedback`.
- **Xuất PDF chuẩn A4 hành chính:** Định dạng `@page { size: A4 portrait; margin: 15mm 15mm 18mm 15mm; }`, ẩn sidebar/navbar/TOC khi in, hiển thị watermark chéo thương hiệu 10% (`.pdf-watermark-overlay`), chân trang lặp lại (`.pdf-running-footer`) và khối chứng thực cuối bài (`.pdf-signature-block`).
- **Sổ tay bỏ túi (`/pocket-guide`):** Bản tóm tắt cô đọng 2 trang A4 in nhanh cho cán bộ.
- **Tối ưu di động (`skills/responsive`):**
  - Breakpoints `xs: 320px`, `sm: 480px`, `md: 768px`; chống tràn ngang với `overflow-x: clip` trên `html, body`.
  - Vùng chạm nút/link tối thiểu `44px–48px` (`h-11` / `h-12`), khoảng cách giữa các phần tử `>= 8px`.
  - Chữ nội dung di động `>= 14px–16px`, `line-height >= 1.5`, `H1 <= 24px`; mọi bảng phức tạp bọc `overflow-x-auto`.

---

## 7. Gợi ý cấu trúc TechDoc cho web vị trí việc làm HCM-UTE

Khi khởi tạo kho `content/docs/` cho **Cổng tài liệu hướng dẫn hệ thống vị trí việc làm HCM-UTE**, tổ chức thành 6 nhóm thư mục đánh số thứ tự:

1. `01-khoi-dong-va-tong-quan/`: Đăng nhập email `@hcmute.edu.vn`, kiểm tra đơn vị công tác, phân vai trò (chuyên viên Phòng Tổ chức - Nhân sự, trưởng đơn vị, lãnh đạo Trường, cán bộ/giảng viên) và mô hình dữ liệu đề án vị trí việc làm.
2. `02-luong-a-danh-muc-va-khung-nang-luc/`: Danh mục vị trí việc làm theo nhóm (quản lý, chuyên môn dùng chung, nghề nghiệp chuyên ngành, hỗ trợ phục vụ), chuẩn khung năng lực và bậc trình độ.
3. `03-luong-b-mo-ta-cong-viec-va-dinh-muc/`: Soạn thảo bản mô tả công việc (BMT), xác định định mức khối lượng công việc, tỷ trọng thời gian và gắn ngạch/hạng chức danh nghề nghiệp.
4. `04-luong-c-ra-soat-phe-duyet-va-bao-cao/`: Quy trình rà soát định kỳ tại Khoa/Phòng, thẩm định của Phòng Tổ chức - Nhân sự, trình Hiệu trưởng (*President*) phê duyệt và xuất biểu mẫu báo cáo tổng hợp.
5. `05-so-do-nghiep-vu-va-bieu-mau/`: Tổng hợp sơ đồ khối Mermaid tương tác toàn quy trình và kho biểu mẫu/tiêu chí chuẩn.
6. `06-tro-ly-va-xu-ly-su-co/`: Checklist nghiệm thu hồ sơ vị trí việc làm, tra cứu thuật ngữ nhân sự và trung tâm xử lý lỗi thường gặp.

---

## 8. Danh sách kiểm tra nghiệm thu trước khi bàn giao

- [ ] Tất cả tên gọi dùng đúng **HCM-UTE**, **Trường Đại học Công nghệ Kỹ thuật TP.HCM**, **Phòng Tổ chức - Nhân sự** (không lẫn tên cũ).
- [ ] Toàn bộ tiêu đề, nhãn UI và nội dung tiếng Việt tuân thủ **Sentence case** (không viết hoa bừa bãi đầu mỗi từ).
- [ ] Light mode không còn màu đen thuần (`#000000` / `text-black`), dùng đồng nhất `rgb(0, 71, 118)`.
- [ ] Toàn bộ route `/docs/**` build tĩnh SSG thành công, không phụ thuộc cookie/session.
- [ ] Sơ đồ `<Mermaid>` render sạch, không bị cắt chữ ở node/subgraph và bấm điều hướng đúng đường dẫn.
- [ ] Giao diện di động (`< 768px`) không tràn ngang, bảng cuộn ngang mượt và in thử PDF A4 không vỡ khối.
