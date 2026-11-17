# Quy chuẩn CSDL & Xác thực (PostgreSQL + Prisma + NextAuth — Cấm Supabase)

1. **Tuyệt đối không sử dụng Supabase (Zero Supabase Policy):**
   - Hệ thống chạy 100% trên **PostgreSQL 16 nội bộ** (`utevtvl_db`) thông qua **Prisma ORM** (`prisma/schema.prisma`, `src/services/storage/prisma.ts`) và `pg` (`src/services/storage/postgres-rest-compat.ts`).
   - **Cấm tuyệt đối** cài đặt `@supabase/*`, gọi HTTP PostgREST `*.supabase.co`, đọc biến môi trường `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, hoặc tạo lại thư mục `supabase/`.
   - Thư mục `trash/supabase/` chỉ là bản lưu lịch sử cũ (chỉ đọc — read-only archive), không thêm mới hoặc chỉnh sửa.
2. **Quy trình thêm bảng / cột mới (Prisma Versioned Migrations):**
   - Bước 1: Cập nhật model trong `prisma/schema.prisma`.
   - Bước 2: Tạo tệp migration phiên bản mới tại `prisma/migrations/<YYYYMMDDHHMMSS>_<mo_ta>/migration.sql` (hoặc chạy `npm run prisma:migrate`) rồi chạy `npx prisma generate`.
   - Bước 3: Chạy `npm run typecheck && npm test` trước khi `git push origin main`. Khi push lên nhánh `main`, `scripts/migrate-postgres.mjs` sẽ tự động thực thi migration mới và ghi vết kiểm toán vào `public."_prisma_migrations"`, `public.schema_migrations` và `migrations.log`.
3. **Xác thực người dùng (NextAuth v4 + Phiên nội bộ):**
   - Đăng nhập Google sử dụng **NextAuth v4** (`GoogleProvider` + `PrismaAdapter(prisma)`) tại `src/services/auth/auth-options.ts` và `src/app/api/auth/[...nextauth]/route.ts`.
   - Người dùng mới đăng nhập Google lần đầu được tự động tạo tài khoản với vai trò an toàn `staff` trong `public.user_accounts`. Quản trị viên quản lý danh sách người dùng và phân quyền (`admin` / `unit_leader` / `staff`) tại giao diện bảng `/admin?tab=accounts`.
