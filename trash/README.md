# Thư mục lưu trữ lịch sử cũ (Legacy Archive — KHÔNG SỬ DỤNG SUPABASE)

> **CẢNH BÁO DÀNH CHO DEVELOPER & AI AGENT:**
> - Hệ thống **HCM-UTE VTVL 360** đã ngừng sử dụng hoàn toàn Supabase và chuyển 100% sang **PostgreSQL 16 độc lập (`utevtvl_db`) + Prisma ORM + NextAuth v4**.
> - Thư mục `trash/supabase/` chỉ được giữ lại trong Git làm hồ sơ đối soát lịch sử các bản vá SQL giai đoạn đầu.
> - **TUYỆT ĐỐI KHÔNG** đặt tệp migration mới vào `trash/supabase/`, không tạo lại thư mục `supabase/` ở gốc dự án, và không sử dụng các biến môi trường `SUPABASE_*`.
> - Mọi thay đổi lược đồ CSDL mới bắt buộc thực hiện tại `prisma/schema.prisma` và tạo phiên bản trong `prisma/migrations/<YYYYMMDDHHMMSS>_<mo_ta>/migration.sql`.

