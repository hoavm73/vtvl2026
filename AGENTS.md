# Quy tắc vận hành AI cho dự án HCM-UTE VTVL 360 & S-Link

Tệp này định nghĩa các nguyên tắc bắt buộc dành cho mọi Developer và AI Agent làm việc trong dự án **HCM-UTE VTVL 360** (Hệ thống Vị trí việc làm 360 và Công cụ S-Link & QR Code dành cho Trường Đại học Công nghệ Kỹ thuật TP.HCM — kho mã nguồn chính thức: `https://github.com/hoavm73/vtvl2026`, tên miền vận hành: `https://kekhaivtvl.hcmute.edu.vn`).

> **NGUYÊN TẮC CỐT LÕI (ZERO SUPABASE):** Dự án đã ngừng sử dụng hoàn toàn Supabase và vận hành 100% trên **PostgreSQL 16 độc lập (`utevtvl_db`) + Prisma ORM + NextAuth v4**. Tuyệt đối không cài đặt `@supabase/*`, không gọi `*.supabase.co`, không dùng biến `SUPABASE_*` và không tạo lại thư mục `supabase/`. Toàn bộ SQL lịch sử cũ đã được niêm phong tại `trash/supabase/` (chỉ đọc).

## 1. Mười quy tắc vận hành cốt lõi (Operational rules)

1. **Đọc tài liệu trước khi hành động:** Luôn đọc tài liệu trong `docs/`, `.agents/rules/` và các tệp quy chuẩn trong `.agents/skills/` trước khi thực hiện nhiệm vụ.
2. **Hiểu rõ mục tiêu nghiệp vụ:** Nắm vững luồng 5 bước của Vị trí việc làm 360 (Tạo tệp đơn vị → Phát phiếu → Bấm giờ đo định mức → Nạp & gộp phiếu → Rà soát 9 biểu) và tính năng S-Link & QR Code trước khi sinh mã nguồn.
3. **Lựa chọn đúng Skill chuyên biệt:** Kích hoạt đúng Skill trong `.agents/skills/` tương ứng với từng nhóm nhiệm vụ (Thuật ngữ, Giao diện, Lõi Excel, Rà soát 9 biểu, Kiểm thử chất lượng).
4. **Không tự ý thay đổi cấu trúc dự án:** Giữ nguyên sự phân tách giữa `.agents/`, `docs/`, `assets/`, `public/`, `prisma/`, `src/app/`, `src/components/`, `src/services/`, `src/configs/`, `scripts/`, `tests/` và `trash/` (thư mục lưu trữ lịch sử chỉ đọc).
5. **Bảo toàn dữ liệu quan trọng & quản lý phiên bản Migration (Prisma + PostgreSQL + NextAuth):**
   - Hệ thống kết nối CSDL duy nhất qua `DATABASE_URL` (`PrismaClient` tại `src/services/storage/prisma.ts`) và xác thực Google OAuth qua **NextAuth v4** (`GoogleProvider` + `PrismaAdapter` tại `src/services/auth/auth-options.ts`), song song với đăng nhập Email/Mật khẩu nội bộ (`/api/auth/login`).
   - Không xóa hoặc ghi đè dữ liệu mẫu gốc, dữ liệu 908+ tài khoản cán bộ (`public.user_accounts`) hoặc tài nguyên thương hiệu khi chưa được phép. Khi xử lý tệp `.xlsx` của đơn vị, phải bảo toàn định dạng XML và ghi lịch sử vào sheet `15. S_NhatKy`.
   - Mọi thay đổi lược đồ CSDL mới bắt buộc cập nhật `prisma/schema.prisma` và tạo phiên bản migration có đánh số thời gian trong `prisma/migrations/<YYYYMMDDHHMMSS>_<mo_ta>/migration.sql` (**tuyệt đối không thêm tệp vào `trash/supabase/`**). Khi `git push origin main`, bộ máy `scripts/migrate-postgres.mjs` sẽ tự động áp dụng và ghi nhật ký vào `public."_prisma_migrations"`, `public.schema_migrations` và tệp `migrations.log`.
6. **Không cài đặt công cụ thừa:** Chỉ sử dụng các thư viện thiết yếu đã được phê duyệt trong `package.json` (`next`, `react`, `prisma`, `@prisma/client`, `pg`, `next-auth`, `@next-auth/prisma-adapter`, `jszip`, `xlsx`, `qrcode`, `lucide-react`, `tailwindcss`).
7. **Chống phân mảnh phiên bản tệp:** Không tạo các tệp trùng lặp như `page-v2.tsx`, `temp-test.ts`, `old-component.tsx` trong cây mã nguồn.
8. **Tuân thủ quy chuẩn đặt tên & giới hạn dòng:**
   - Tên thư mục và tệp tài liệu: `kebab-case`.
   - Tên React Component: `PascalCase`.
   - Tên hàm và biến: `camelCase`.
   - **Giới hạn độ dài:** Mỗi tệp mã nguồn trong `src/` phải dưới `300 dòng` để dễ bảo trì.
9. **Ghi nhận quyết định kỹ thuật:** Mọi thay đổi về quy tắc tách tệp, gộp phiếu, xác thực NextAuth hoặc lược đồ Prisma/PostgreSQL phải được cập nhật đồng bộ trong `docs/architecture/`.
10. **Kiểm tra thực tế trước khi báo cáo:** Luôn kiểm tra `npx prisma generate`, `npm run typecheck`, chạy toàn bộ bộ kiểm thử `npm test` và xác minh giao diện hoạt động trước khi báo cáo hoàn thành.

## 2. Quy chuẩn thương hiệu HCM-UTE bắt buộc

- **Tên viết tắt chính thức:** Luôn viết **HCM-UTE** (có dấu gạch nối `-`). Tuyệt đối không viết `HCMUTE` hoặc `HCM UTE` trong giao diện hiển thị.
- **Tên tiếng Việt chính thức:** **Trường Đại học Công nghệ Kỹ thuật TP.HCM** (hoặc *Trường Đại học Công nghệ Kỹ thuật Thành phố Hồ Chí Minh*). Tuyệt đối không dùng tên cũ *Trường Đại học Sư phạm Kỹ thuật TP.HCM*.
- **Tên tiếng Anh chính thức:** **Ho Chi Minh City University of Technology and Engineering**.
- **Màu chữ thương hiệu (Light Theme):** Tuyệt đối không dùng màu đen thuần (`#000000`, `text-black`, `text-slate-900`, `text-gray-900`). Bắt buộc sử dụng màu xanh thẫm thương hiệu **`rgb(0, 71, 118)`** (`#004776`).
- **Quy tắc viết hoa tiếng Việt:** Tuân thủ quy tắc Sentence case (chỉ viết hoa chữ cái đầu câu và danh từ riêng, không viết hoa tràn lan từng từ kiểu Title Case).
