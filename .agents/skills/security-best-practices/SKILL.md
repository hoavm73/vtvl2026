---
name: security-best-practices
description: Quy chuẩn bảo mật toàn diện (Security Best Practices) cho dự án HCM-UTE VTVL 360 trên kiến trúc Next.js 15 App Router + PostgreSQL 16 + Prisma ORM + NextAuth v4: kiểm soát xác thực (JWT/Session/OAuth), phân quyền RBAC 3 vai trò, chống IDOR/Actor Spoofing, Rate Limiting, giới hạn Payload, chống SQL Injection, bảo vệ bí mật môi trường và nhật ký Audit Log an toàn (Zero PII/Secret Leakage).
---

# Security Best Practices — HCM-UTE VTVL 360

Bộ quy chuẩn bảo mật bắt buộc áp dụng khi phát triển, rà soát mã nguồn và vận hành hệ thống **HCM-UTE VTVL 360** (`https://kekhaivtvl.hcmute.edu.vn`).

---

## 1. Xác thực & Quản lý Phiên (Authentication & Session Security)

1. **Xác thực tập trung tại máy chủ (`getCallerSession`):**
   - Mọi API Route trong `src/app/api/**` bắt buộc gọi `getCallerSession(req)` từ `src/services/storage/server-auth-guard.ts`.
   - Tuyệt đối **không tin cậy** header `x-actor-email`, `ownerEmail` hay `role` từ client gửi lên nếu không khớp với chữ ký HMAC-SHA256 của Bearer Token / Cookie phiên hoặc phiên NextAuth v4.
   - Khi phát hiện header/body giả mạo danh tính khác với token đã xác thực, trả về ngay HTTP `403` (`FORBIDDEN_ACTOR_SPOOFING` hoặc `FORBIDDEN_ROLE_SPOOFING`).
2. **Cookie & Token Hardening:**
   - Cookie phiên (`hcmute_vtvl_session_token`, `hcmute_vtvl_admin_token_v2`) bắt buộc đặt cờ `HttpOnly`, `SameSite=Lax`, `Path=/`, và `Secure` trên môi trường Production (`NODE_ENV === 'production'`).
   - Thời hạn sống (TTL) của token mặc định `168 giờ` (7 ngày), đồng bộ với `maxAge` của Cookie.
3. **Băm mật khẩu an toàn (`scrypt` + Salt ngẫu nhiên):**
   - Mật khẩu tài khoản nội bộ trong `public.user_accounts` phải được băm bằng `hashAccountPassword` (`scryptSync` với salt 16 bytes) và so sánh hằng thời gian bằng `timingSafeEqual`.
   - Khi trả dữ liệu tài khoản qua API, bắt buộc lọc bỏ `passwordHash` qua `stripAccountSensitiveFields`.

---

## 2. Phân quyền RBAC 3 Vai trò & Chống IDOR (Authorization)

| Vai trò | Phạm vi dữ liệu (`unitCode`) | Quyền hạn được phép | Hành vi bị chặn (`403 Forbidden`) |
| :--- | :--- | :--- | :--- |
| **`admin`** (Phòng TCNS / BGH) | Toàn bộ 39 đơn vị (`ALL` hoặc từng mã đơn vị) | Quản trị đơn vị/tài khoản, thẩm định hồ sơ, duyệt phiếu của Lãnh đạo đơn vị, gộp/đối soát toàn trường | Không sửa nội dung phiếu cá nhân của cán bộ khác (`FORBIDDEN_IDOR`) |
| **`unit_leader`** (Lãnh đạo đơn vị) | Chỉ đơn vị `caller.unitCode` | Duyệt/yêu cầu bổ sung/gộp phiếu của cán bộ trong đơn vị, chỉnh sửa bảng tính 10 biểu của đơn vị | Chặn truy cập đơn vị khác (`FORBIDDEN_CROSS_UNIT`); chặn tự duyệt phiếu của chính mình (`FORBIDDEN_SELF_REVIEW`) |
| **`staff`** (Cán bộ – Giảng viên) | Chỉ phiếu do `caller.email` sở hữu trong `caller.unitCode` | Tạo, sửa, nộp, nộp lại phiếu công việc cá nhân khi chưa duyệt và chưa gộp B1/B2 | Chặn sửa bảng tính đơn vị (`FORBIDDEN_VIEWER_WRITE`), chặn duyệt/gộp phiếu (`FORBIDDEN_STAFF_REVIEW`), chặn xem phiếu Nháp của người khác (`FORBIDDEN_DRAFT_ACCESS`) |

---

## 3. Chống Tấn công Từ chối Dịch vụ, Tương tranh & Toàn vẹn Dữ liệu

1. **Rate Limiting (`src/services/auth/rate-limiter.ts`):**
   - Áp dụng giới hạn tối đa `10 lần thử sai / 15 phút` trên các endpoint nhạy cảm (`/api/auth/login`, `/api/admin/auth`, `/api/admin/c1-lock`), trả về HTTP `429 RATE_LIMITED`.
2. **Giới hạn kích thước Payload (`checkPayloadSizeLimit`):**
   - Chặn các request có `Content-Length` vượt ngưỡng (`5 MB` đối với bảng tính workbook và `/api/sync/split`), trả về HTTP `413 PAYLOAD_TOO_LARGE`.
3. **Optimistic Concurrency & Idempotency:**
   - Kiểm tra `expectedVersionNo` / `baseRevision` trước khi cập nhật phiếu hoặc bảng tính; trả về HTTP `409 REVISION_CONFLICT` khi phát hiện ghi đè phiên bản cũ.
   - Hỗ trợ `Idempotency-Key` cho các thao tác nộp, duyệt, gộp để chống nhân đôi dữ liệu khi mạng chập chờn.

---

## 4. Bảo mật Cơ sở dữ liệu PostgreSQL 16 & Prisma ORM

1. **Chống SQL Injection:**
   - Mọi truy vấn Prisma dùng tham số hóa (`prisma.staff_work_tickets.findMany`, `prisma.$queryRaw` với Tagged Template Literals) hoặc `pgQuery(sql, [$1, $2])` với mảng tham số tách biệt. Tuyệt đối không nối chuỗi SQL thủ công từ input của người dùng.
2. **Bảo vệ Bí mật & Không rò rỉ PII trong Lỗi/Audit Log:**
   - Không bao giờ ghi `password`, `passwordHash`, `accessToken`, `DATABASE_URL`, `NEXTAUTH_SECRET` vào bảng `public.audit_logs` (`sanitizeAuditPayload`) hoặc thông báo lỗi trả về client.
   - Tuyệt đối không commit tệp `.env.local` lên Git.

---

## 5. Lệnh Kiểm định Bảo mật Tự động

Chạy đầy đủ bộ kiểm thử bảo mật và phân quyền trước mỗi đợt phát hành:

```bash
VTVL_ISOLATED_LOCAL_STORE=true npm run test:security
VTVL_ISOLATED_LOCAL_STORE=true npm run test:rbac
VTVL_ISOLATED_LOCAL_STORE=true npm run test:schema
```
