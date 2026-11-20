# Kiến trúc chịu tải cao hệ thống VTVL 360 HCM-UTE (15.000–20.000 phiếu & 100.000 phiên bản)

Tài liệu này ghi nhận thiết kế kiến trúc và cấu hình vận hành của hệ thống **HCM-UTE VTVL 360** cho ngưỡng thiết kế:
- **15.000–20.000 phiếu công việc** (`public.staff_work_tickets`, bình quân 250–500 công việc/đơn vị trên 39 đơn vị).
- **60.000–100.000 bản ghi phiên bản và lịch sử trạng thái** (`public.work_survey_versions`, `public.work_survey_status_history`).
- **200–300 phiên người dùng hoạt động đồng thời**, lưu lượng **30–100 request/giây** giờ cao điểm và đợt dồn tải (Burst load) khi 39 đơn vị đồng thời nộp, duyệt, gộp hồ sơ.

---

## 1. Mười hai nguyên tắc kiến trúc đã triển khai

1. **PostgreSQL 16 là nguồn dữ liệu duy nhất trên Production:** Không sử dụng Redis, BullMQ hay microservices ngoài phạm vi; tận dụng tối đa khóa giao dịch, bộ đếm nguyên tử và hàng đợi `FOR UPDATE SKIP LOCKED` ngay trên PostgreSQL.
2. **Loại bỏ hoàn toàn ghi JSON đồng bộ (`fs.writeFileSync`) trên Production:** Tiện ích `src/services/storage/atomic-json-file.ts` tự động bỏ qua việc serialize và ghi tệp `.data/*.json` khi `isDatabaseConfigured() === true` (ngoài chế độ kiểm thử cô lập `VTVL_ISOLATED_LOCAL_STORE=true`). Ở chế độ local/test, tệp JSON được ghi qua tệp tạm (`*.tmp`) và `fs.renameSync` nguyên tử.
3. **GET API thuần đọc (Zero Write Side-Effects on GET):**
   - Đã loại bỏ `syncServerWorkbooksFromSupabase(true)`, `syncTicketsFromWorkbook` và `reconcileApprovedUnitTicketsToWorkbook` khỏi `GET /api/tickets` và `GET /api/workbooks/[id]`.
   - Khi mở bảng tính qua `GET /api/workbooks/[id]`, hệ thống sử dụng hàm chiếu chỉ-đọc `projectUnmergedApprovedTicketsReadOnly` trên bộ nhớ phản hồi mà không ghi xuống CSDL hay đĩa.
4. **Thống kê tổng quan bằng SQL Aggregate (`GET /api/admin/overview`):** Sử dụng `GROUP BY unit_code, status, is_merged_to_b1_b2` trực tiếp trên PostgreSQL kết hợp Single-flight cache (`forceSingleFlight: true`), giảm kích thước payload tổng quan xuống `< 6 KB`.
5. **Server-side Cursor Pagination & List DTO nhẹ (`GET /api/tickets?view=list&limit=50&cursor=...`):**
   - Phân trang ổn định theo `(updated_at DESC, id DESC)`.
   - `toTicketListDto` loại bỏ toàn bộ mảng `versions` (chứa snapshot JSON nặng), `mergeLinks` đầy đủ và rút gọn `statusHistory` chỉ giữ sự kiện mới nhất kèm `versionCount` và `historyCount`.
6. **Tải lười (Lazy-load) chi tiết phiên bản và lịch sử:**
   - `GET /api/tickets/[id]`
   - `GET /api/tickets/[id]/versions`
   - `GET /api/tickets/[id]/history`
7. **Cấp mã công việc nguyên tử (`public.unit_mission_counters`):** Sử dụng `INSERT ... ON CONFLICT (unit_code, mission_code) DO UPDATE SET last_seq = GREATEST(last_seq, $3) + 1 RETURNING last_seq` kết hợp ràng buộc duy nhất `uq_staff_ticket_unit_task (unit_code, ma_cong_viec)`.
8. **Chống Lost Update bằng Optimistic Concurrency (`409 Conflict`):** Kiểm tra `expectedVersionNo` / `baseRevision` / `expectedUpdatedAt` trong `checkTicketOptimisticConcurrency` và trả về HTTP `409 REVISION_CONFLICT` khi dữ liệu đã bị thay đổi bởi phiên khác.
9. **Idempotency cho Submit, Approve, Merge và Reconcile (`public.idempotency_records`):** Hỗ trợ header `Idempotency-Key` hoặc trường `idempotencyKey` trong body để chống nhân đôi phiên bản, lịch sử trạng thái hoặc dòng biểu A2/B1 khi người dùng bấm đúp hoặc mạng retry.
10. **Batch Reconcile theo lô (`POST /api/tickets/reconcile`):** Hàm `batchReconcileUnitTickets` gom toàn bộ phiếu `approved` chưa gộp của đơn vị trong RAM, chỉ gọi `recalculateGridFormulas` **tối đa 1 lần** và ghi workbook **tối đa 1 lần** cho mỗi đơn vị, đồng thời cập nhật trạng thái phiếu theo giao dịch lô (`batchMarkTicketsMergedInDb`).
11. **Hàng đợi công việc nền trên PostgreSQL (`public.background_jobs`):** Hỗ trợ chế độ bất đồng bộ (`async: true`) sử dụng `SELECT ... FOR UPDATE SKIP LOCKED` với các trạng thái `queued`, `running`, `completed`, `failed` và cơ chế retry tự động.
12. **Tối ưu giao diện cho 200–500 dòng/đơn vị:**
    - `ExcelDataCell` được bọc `React.memo` để tránh re-render toàn bảng khi nhập liệu từng ô.
    - `ExcelTableRenderer` và `UnitTicketsReviewList` phân trang khung nhìn (25–50 dòng/trang), giữ số lượng DOM node luôn gọn nhẹ.

---

## 2. Cấu hình Ngân sách Kết nối PostgreSQL & PgBouncer

- **`DATABASE_URL` (Qua PgBouncer Transaction Mode):**
  `postgresql://user:pass@host:6432/utevtvl_db?pgbouncer=true&connection_limit=10&pool_timeout=15`
- **`DIRECT_URL` (Kết nối trực tiếp tới PostgreSQL 16 phục vụ Migration & `CREATE INDEX CONCURRENTLY`):**
  `postgresql://user:pass@host:5432/utevtvl_db`
- **Ngân sách kết nối trên mỗi Node.js Instance (`src/services/storage/prisma.ts`):**
  - `PrismaClient`: `connection_limit = 10`
  - **`pg.Pool` (`PG_POOL_MAX`):** `max = 5` (giảm từ `15` xuống `5`), `connectionTimeoutMillis = 5000`, `statement_timeout = 20000` (đo thời gian chờ lấy kết nối qua `getPgPoolMetrics()`).
- Tổng cộng tối đa `15 kết nối / instance` (với 4 instances = 60 kết nối, an toàn dưới ngưỡng `max_connections = 100–200` của PostgreSQL).

---

## 3. Chính sách tin cậy Proxy, Giới hạn tần suất & Dung lượng Payload (ĐX-1 & ĐX-2)

1. **Nhận diện IP thật qua Proxy (`src/services/auth/rate-limiter.ts`):**
   - `VTVL_TRUST_PROXY=nginx` (mặc định khi `utevtvl-app` chỉ bind `127.0.0.1` sau Nginx): ưu tiên đọc `X-Real-IP` do Nginx ghi đè từ `$remote_addr`; chỉ khi thiếu `X-Real-IP` mới lấy phần tử cuối cùng (bên phải) của `X-Forwarded-For`, chặn giả mạo phần tử đầu.
   - `VTVL_TRUST_PROXY=none`: bỏ qua toàn bộ header chuyển tiếp (khi Node.js đứng trực tiếp).
   - `VTVL_TRUST_PROXY=legacy`: khôi phục hành vi cũ khi cần rollback khẩn.
2. **Định danh & Bảo vệ bộ đếm xác thực:**
   - `POST /api/auth/login`: đếm riêng theo `(IP, email)` (`10 lần sai / 15 phút`) và trần chống phun mật khẩu IP (`60 lần sai / 15 phút`), tránh đồng nghiệp cùng IP mạng trường khóa chéo nhau.
   - `POST /api/admin/c1-lock` & `POST /api/admin/auth`: khi đã có phiên xác thực (`caller.isAuthenticated && caller.email`), đếm theo `caller.email` + trần bảo vệ bí mật dùng chung toàn cục (`40 lần / 10 phút`). Khi chưa có phiên trên `admin/auth`, không tin cậy email từ body; đếm theo `admin_auth_anon:<IP>` (`10 lần / 10 phút`).
   - Bộ đếm giới hạn ở `VTVL_RATE_LIMIT_MAX_KEYS` (mặc định `4096`): thu hồi các mục ít lỗi chưa bị khóa, **ghim bảo vệ khóa đang bị chặn (`lockedUntilMs > now`)** và **fail-closed (`429 CAPACITY_OVERFLOW`)** nếu toàn bảng đều là khóa đang bị chặn. Bộ đếm lưu trong RAM nên được làm trống khi tiến trình Node.js khởi động lại.
3. **Ngưỡng kích thước JSON theo stream thực đọc (`src/services/auth/payload-limiter.ts`):**
   - Số đo hợp lệ tham chiếu: workbook mặc định `~63 KB`, đơn vị lớn `500` công việc `~681 KB`, cực đại `1.000` công việc `~1.23 MB`, phiếu công việc `~8 KB`.
   - Áp dụng `readBoundedJsonBody` đếm byte thực tế từng chunk stream (chặn cả `Transfer-Encoding: chunked` thiếu `Content-Length`) trước khi `JSON.parse`: `64 KB` cho Auth, `1 MB` cho API chuẩn, `5 MB` cho Workbook/Sync (`6 MB` tại Nginx).
4. **Cấu hình Nginx Staging (`deploy/nginx/staging/`):**
   - Dùng `$binary_remote_addr` (không dùng cookie thô làm khóa): `vtvl_auth_ip` (`10r/s burst=30`), `vtvl_api_ip` (`150r/s burst=300` phù hợp NAT trường 200–300 phiên), `vtvl_conn_ip` (`120–150`). Bật chế độ quan sát `limit_req_dry_run on;` trước khi chuyển `off`.
   - Chỉ cache `/_next/static/` (tên tệp gắn hash phiên bản); toàn bộ HTML/RSC, API phiếu và workbook đặt `proxy_no_cache 1; proxy_cache_bypass 1; Cache-Control: no-store`.

---

## 4. Ngân sách Tác vụ nặng, Toàn vẹn Khóa & Hoàn tác (ĐX-3/4)

1. **Giới hạn tần suất API theo danh tính đã xác thực (`src/services/auth/api-rate-limiter.ts`):**
   - Token-bucket theo `caller.email` hoặc `unitCode`: `read` (`180/60s, burst=60`), `ticket_write` (`45/60s, burst=15`), `ticket_review` (`90/60s, burst=25`), `unit_reconcile` (`12/60s, burst=4`), `workbook_write` (`24/60s, burst=6`). Kiểm tra RBAC/IDOR chạy trước limiter trên `tickets` để không che lỗi `403` bằng `429`.
2. **Ngân sách tài nguyên chung (`src/services/storage/heavy-mutation-gate.ts`):**
   - Lưu workbook, đối soát gộp lô và thao tác phiếu dùng chung trần `VTVL_HEAVY_MAX_CONCURRENT=6` (tối đa `2` tác vụ tính lại bảng tính nặng `VTVL_BULK_SHEET_MAX_CONCURRENT=2` để nhường Event Loop & PG Pool cho luồng ghi phiếu nhanh), hàng đợi tối đa `60` toàn cục / `20` mỗi đơn vị, hết thời gian chờ `8.000 ms` trả HTTP `429 SERVER_BUSY_RETRY` kèm header `Retry-After: 3`.
3. **Toàn vẹn khóa & Phục hồi khóa mồ côi (`src/services/storage/server-file-lock.ts` & `file-lock-helpers.ts`):**
   - Gắn `instanceId = <pid>-<uuid>` + `lockToken` + heartbeat `250–2500 ms`. Waiter hết `waitTimeoutMs` hoặc hàng đợi vượt `maxWaiters=25` sẽ tự rút lui trả `429` và **tuyệt đối không xóa `.lock` của tác vụ đang chạy**. Giải phóng khóa kiểm tra khớp `lockToken`.
   - Chỉ thu hồi `.lock` khi tiến trình nắm khóa đã chết trên cùng OS (`ESRCH`) hoặc mất heartbeat quá `VTVL_LOCK_STALE_ORPHAN_MS` (`20.000 ms`), sau đó kích hoạt `invalidateAllLocalCaches()`.
4. **Cơ chế hoàn tác tức thời (Rollback không cần sửa mã):**
   - **ĐX-1:** `VTVL_TRUST_PROXY=legacy` (khôi phục nhận diện IP cũ) hoặc `VTVL_DISABLE_RATE_LIMIT=true`.
   - **ĐX-3/4:** `VTVL_API_RATE_LIMIT_ENABLED=false` (tắt token bucket API); `VTVL_HEAVY_MAX_CONCURRENT=0` (mở bỏ trần concurrency) hoặc đặt lại `VTVL_HEAVY_MAX_CONCURRENT=4` & `VTVL_BULK_SHEET_MAX_CONCURRENT=3`.
   - **ĐX-2 (Nginx):** đổi `limit_req_dry_run on;` (quay lại chỉ quan sát), bỏ `limit_req`/`limit_conn` hoặc gỡ `keepalive_timeout 4s;` trong `deploy/nginx/staging/vtvl-http-zones.conf` rồi chạy `nginx -t && systemctl reload nginx`.
   - **Đảo mã nguồn khi cần:** `git checkout -- src/ deploy/nginx/staging/` hoặc revert commit tương ứng và biên dịch lại bản standalone.

---

## 5. Tách Liveness / Readiness, Tối ưu 1 Bản & Kết quả Nghiệm thu Staging (Phương án A)

1. **Tách tín hiệu Liveness & Readiness và phân công giám sát cho 1 backend:**
   - **`GET/HEAD /api/health/live`** (`src/app/api/health/live/route.ts`): không truy vấn DB, luôn trả `200 {"status":"ok"}` với `Cache-Control: no-store`.
   - **`GET/HEAD /api/health/ready`** (`src/app/api/health/ready/route.ts`): gọi `checkPostgresReadiness(1500)` (chạy `SELECT 1 AS ok` trên `pg.Pool` với deadline ngắn 1,5s và hủy an toàn `client.release(timedOut)` nếu timeout), trả tối giản `200 {"status":"ready"}` hoặc `503 {"status":"unavailable"}` (không rò rỉ chuỗi lỗi/DSN, `Cache-Control: no-store`).
   - **Hệ thống đọc tín hiệu & đầu mối nhận cảnh báo khi chỉ có 1 backend:**
     - **Docker Engine / Container runtime** (`deploy/nginx/staging/docker-compose.healthcheck.sample.yml`): cấu hình `HEALTHCHECK` thăm dò `/api/health/live` (mỗi 15s, `restart: unless-stopped`) để đánh dấu container không phản hồi là unhealthy. Với Docker Compose độc lập, restart policy chỉ khởi động lại khi tiến trình thoát; việc xử lý container bị treo cần cơ chế giám sát riêng.
     - **Nginx + Watchdog ngoài** (`systemd` timer / cron hoặc Uptime Kuma / Prometheus Blackbox): thăm dò `/api/health/ready` mỗi 10s qua `https://kekhaivtvl.hcmute.edu.vn/api/health/ready` (bên cạnh giám sát TCP cổng `5432` của PostgreSQL 16).
     - **Đầu mối nhận cảnh báo:** vì Phương án A chỉ có 1 backend `utevtvl-app` nên khi `/api/health/ready` trả `502`/`503` quá 2 chu kỳ liên tiếp (20s), hệ thống cảnh báo phải gửi trực tiếp (Telegram/Zalo/Email/SMS Pager) tới **Kỹ thuật viên trực hạ tầng VPS (TTTT-MT / QTTHTT)** và **Người phụ trách vận hành kỹ thuật VTVL 360** để kiểm tra log container & kết nối PostgreSQL ngay.

2. **Các tối ưu hiệu năng & bảo toàn dữ liệu cho 1 bản chạy nền 20.000 phiếu:**
   - **Đồng bộ bảng tính theo đơn vị & kiểm tra nhanh phiên bản (`phien_ban`):** `syncUnitWorkbookIfRevisionChanged` (`server-ticket-merge-helpers.ts`) kiểm tra nhanh `t_tien_do.phien_ban` và `workbooks.status` trước khi tải JSONB `1,5 MB`; `fetchUnitWorkbookFromSupabase(unitCode, forceRefresh)` truy vấn đơn dòng `t_tien_do` và cập nhật `upsertWorkbookInSupabaseCache(wb)`. `PUT /api/workbooks/[id]` tuần tự hóa qua `withUnitWorkbookLock`, bỏ lưu bất đồng bộ trùng lặp (`skipAsyncPersist: true`), và dùng `saveWorkbookWithPendingApprovedTicketsUnlocked` gộp phiếu mới trong **1 lần tính công thức + 1 lần ghi DB**.
   - **Nạp delta phiếu đã duyệt & chặn `remote === null` im lặng:** `batchReconcileUnitTicketsUnlocked` (`server-ticket-merge.ts`) kiểm tra nhanh qua `tryFastVerifyNoPendingReconcile`, khi cần gộp chỉ kéo delta `pendingIds` qua `syncPendingApprovedTicketsDelta` (hoặc rơi về `syncUnitTicketsAuthoritative` nếu có bản ghi mồ côi). `assertAuthoritativeRemoteTickets` (`server-ticket-history-db.ts`) ném `503 DB_SYNC_UNAVAILABLE` nếu truy vấn DB trả về `null`. Bộ đếm `bumpTicketMutationWatermark` + `syncSingleTicketFromSupabase` ngăn preload `ALL` ghi đè hoặc quét thừa đơn vị.
   - **Tối ưu đọc/ghi từng phiếu & kiểm tra khóa bảng tính:** `queryTicketsFromPostgresPaginated` (`ticket-query-service.ts`) dùng `cacheGetOrSet` (TTL `3.000 ms`, cô lập theo đơn vị/email/bộ lọc/cursor) và truy vấn tuần tự `findMany -> count` (chỉ giữ 1 kết nối Pool mỗi lượt). `checkUnitWorkbookApprovedLock` (`workbook-lock-guard.ts`) dùng SQL gọn `SELECT status ... LIMIT 1` kèm cache TTL `15.000 ms` (xóa tức thì khi ghi/đóng/mở khóa). `upsertTicketAndSyncUnit` dùng UUID 8 ký tự, `.create()` cho phiếu mới (fallback `upsert` khi `P2002`) và bỏ truy vấn `fetchTicketVersionsFromSupabase` khi tạo `v1` (`currentVersionNo === 0`).
   - **Cô lập phạm vi xóa cache & loại bỏ full-scan phối hợp:** `invalidateUnitMutationCache(lockKey/unitCode)` (`runtime-cache.ts`, `MAX_CACHE_ENTRIES=2000`) chỉ xóa cache của đúng đơn vị bị ghi và giữ nguyên `'coord:sources:sync'` khi đơn vị không phối hợp ghi phiếu. `resolveUnitCodeSafe` dùng tập `CANONICAL_UNIT_CODES` tra cứu $O(1)$; `getCoordinatedCandidateTickets()` (`server-coordination-store.ts`) lưu snapshot theo thế hệ `(seq, verSyncAt, coordSyncAt)` và `GET /api/tickets/coordinated` dùng TTL `15.000 ms` + `skipPersist = true`.
   - **Kích hoạt RPC nguyên tử `rpc_sync_workbook_atomic` & Nginx Staging Keep-Alive:** `pgCallSurveyRpc` ép kiểu `::jsonb` đồng bộ 16 bảng trong 1 transaction; `deploy/nginx/staging/vtvl-http-zones.conf` đặt `keepalive 128;`, `keepalive_timeout 4s;` (< Node `5s` `keepAliveTimeout`) và `keepalive_requests 10000;` để loại bỏ hoàn toàn `502 Bad Gateway` khi tái sử dụng socket cho `POST`/`PATCH`.

3. **Chẩn đoán & đối chiếu Trước / Sau ở mốc trọng điểm `102 req/s × 60s` (`6.120` yêu cầu, `250` phiên chung 1 IP NAT):**
   - **Trước tối ưu — lượt độc lập (`/private/tmp/vtvl-release.5dFtFS/release-check-2.log`, `gate=4, bulk=3`):** đạt `100,4 rps` tổng, `5.355/6.120` `2xx` (`87,50%`), `765` `429` (`12,50%`), `0` `5xx`, `p95 = 3.586,75 ms`, `p99 = 7.639,29 ms`.
   - **Trước tối ưu — lượt đo chẩn đoán baseline (`diag-102rps-before-fix.json`, `gate=4, bulk=3`):** `wallTimeSec = 60,7s` (`drain = 705,07 ms`), `achieved2xxRps = 91,02 req/s` (`5.525/6.120` = `90,28%`), **`429 = 595` (`100%` mã `SERVER_BUSY_RETRY`: `policyBlockedCount = 0`, `overloadFalsePositiveCount = 595`)**, `5xx = 0`, `p95 = 3.434,85 ms`, `p99 = 6.389,31 ms`. Phân rã `429` theo API: `POST submit=189`, `POST draft=187`, `POST reconcile=93`, `PATCH approve=89`, `PUT workbook=37` (rải đều `39/39` đơn vị; `staff=376`, `unit_leader=219`; toàn bộ `read/ticket_write/ticket_review/unit_reconcile/workbook_write` đều nằm dưới trần chính sách `RATE_LIMIT_POLICY`, nên `100%` lỗi `429` đến từ nghẽn hàng đợi `HeavyMutationGate` chờ lưu/gộp lâu, không phải chặn chính sách IP/tài khoản).
   - **Sau tối ưu — bản cuối (`reports/staging-rate-limit-benchmark.json`, `gate=6, bulk=2`):**
     - `wallTimeSec = 60,07s` (gồm `drainTailMs = 77,01 ms`), **`6.120/6.120` `2xx` (`100%`), `achieved2xxRps = 101,88 req/s`** (vượt mục tiêu `>= 100,0 req/s`), **`429 = 0`, `5xx = 0`**, `p50 = 6,95 ms`, `p95 = 53,41 ms`, `p99 = 98,99 ms`.
     - Độ trễ từng luồng ở `102×60s`: `read_tickets_list` (`p95 = 18,41 ms`), `read_overview_coord` (`p95 = 22,88 ms`), `read_workbook` (`p95 = 37,47 ms`), `write_submit_review` (`p95 = 29,16 ms`, `avg` giảm từ `1.867,32 ms -> 10,95 ms`), `heavy_reconcile_save` (`p95 = 107,96 ms`, `avg` giảm từ `1.619,61 ms -> 73,95 ms`).
     - Thời gian chờ & giữ khóa ở `102×60s`: `HeavyGate` (`peakActive = 6`, `peakQueued = 1`, `rejected = 0`, `timeouts = 0`): `submit_ticket` `hold avg/p95 = 7,08/18,36 ms`, `review_ticket` `7,05/13,83 ms`, `save_workbook` `84,85/101,67 ms`, `reconcile_unit` `61,88/97,39 ms`; `FileLock`: `ticket_unit` `wait p95 = 0,58 ms`, `hold avg/p95 = 6,38/16,7 ms`, `unit_wb` `wait p95 = 0,56 ms`, `hold avg/p95 = 68,82/100,79 ms`; `pg.Pool` (`max = 5`): `totalAcquires = 6.460`, `avgWaitMs = 0,01 ms`, `p95WaitMs = 0,02 ms`, `maxWaitMs = 43,86 ms`, `peakWaitingCount = 1`, `acquireErrors = 0`.
     - Phân bố tải đều trong `RATE_LIMIT_POLICY`: `read` max `25 <= 180` (`250` actors), `ticket_write` max `13 <= 45` (`153` actors), `ticket_review` max `13 <= 90` (`25` actors), `unit_reconcile` max `9 <= 12` (`25` units), `workbook_write` max `5 <= 24` (`25` units).

4. **Kết quả toàn bộ 6 giai đoạn Staging mới nhất (PostgreSQL 16.16 + Nginx 1.31.9 + Next Standalone, tổng thời lượng `162,95s`):**
   - **Nghiệm thu toàn vẹn độc lập (10 đơn vị, GĐ2=`10,71s`):** `44` phiếu, `0` mã công việc trùng, `46` phiên bản, `94` lịch sử, A2/B1 added `44/44`, tổng giờ SQL `564` vs Biểu B1 `564` (`hoursDiff = 0`). Đua 2 người duyệt đồng thời (`1` bên `200`, `1` bên `400`), timeout chờ khóa `8s` (`429`) + bấm lại giữ nguyên idempotency, và thu hồi khóa `SIGKILL` (`ESRCH`) đều đạt `100%`.
   - **Đợt dồn tải 39 đơn vị trên nền 20.000 phiếu & 100.000 phiên bản/lịch sử (GĐ3=`7,26s`):** kiểm tra cache nóng ngay sau seed SQL trên `BANTT` (không restart app) hợp nhất trực tiếp từ DB `382` phiếu (`200 OK`); Wave 1 gộp tiếp `14.588` phiếu đồng thời trên 38 đơn vị còn lại trong `3.051,86 ms` (`remainingUnmergedApproved = 0`, `initial429 = 0`, `5xx = 0`); Wave 2 (`85` request xả hàng đợi) `70` `200`, `15` `429`, `0` `5xx`.
   - **Đo tải định tốc (`nginx_enforced`, 250 phiên chung 1 IP NAT, GĐ4 tổng=`133,49s`):**
     - **30 req/s (`6s` / thực tế `5,99s`, `drain=11,76 ms`):** `30,07 rps` (`2xx`), `p95 = 32,64 ms`, `p99 = 97,07 ms`, **`2xx = 100%` (`180/180`)**, `429 = 0`, `5xx = 0`.
     - **60 req/s (`6s` / thực tế `6,00s`, `drain=9,87 ms`):** `60,04 rps` (`2xx`), `p95 = 27,61 ms`, `p99 = 85,34 ms`, **`2xx = 100%` (`360/360`)**, `429 = 0`, `5xx = 0`.
     - **100 req/s (`8s` / thực tế `8,08s`, `drain=78,07 ms`):** `99,07 rps` (`2xx`), `p95 = 29,36 ms`, `p99 = 86,77 ms`, **`2xx = 100%` (`800/800`)**, `429 = 0`, `5xx = 0`.
     - **102 req/s (`60s` / thực tế `60,07s`, `drain=77,01 ms`):** **`101,88 rps` (`2xx`)**, `p95 = 53,41 ms`, `p99 = 98,99 ms`, **`2xx = 100%` (`6.120/6.120`)**, `429 = 0`, `5xx = 0`.
   - **Dò trần 1 bản (`150–300 req/s`):**
     - **Qua Nginx 1 IP (`ceiling_nginx_1ip`):** ở `150 req/s` đạt `149,88 rps` (`900/900 = 100%` `2xx`, `p95 = 72,56 ms`, `0` `5xx`); ở `200 req/s` đạt `197,37 rps` (`1.200/1.200 = 100%` `2xx`, `p95 = 90,25 ms`, `0` `5xx`).
     - **Đánh thẳng backend bỏ qua Nginx (`ceiling_direct_multi_ip`):** `150 req/s` đạt `100%` (`750/750`, `p95 = 80,57 ms`); `220 req/s` đạt `100%` (`1.100/1.100`, `214,65 rps` `2xx`, `p95 = 226,1 ms`); `300 req/s` đạt `1.275/1.500 = 85%` `2xx` (`216,52 rps` `2xx`), `225` `429` (`15%`), **`5xx = 0%`** (bắt đầu chạm ngưỡng bảo vệ `HeavyGate` một cách an toàn).
   - **Đối soát từng ID trên cả 39 đơn vị (`staff_work_tickets` ↔ `A2` ↔ `B1` ↔ `work_survey_merge_links`):** `44/44` (GĐ2 Mốc 1), `15.014/15.014` (GĐ3 Mốc 2), `15.581/15.581` (GĐ4 Mốc 3) và `15.581/15.581` (GĐ6 Mốc 4 trên `utevtvl_restore_verify_db`) — **0 phiếu thiếu, 0 trùng lặp, 0 mồ côi**.
   - **Thời gian phục hồi khi bản duy nhất dừng (GĐ5=`1,84s`):**
     - Restart sạch (`SIGTERM`): `stop -> ready = 1.037,7 ms`, `stop -> traffic 20k = 1.046,2 ms` (Nginx trả `502/503` trong ~1,0s app dừng).
     - Crash đột ngột (`SIGKILL` khi đang giữ `.lock`): `kill -> ready = 614,4 ms`, `kill -> thu hồi khóa mồ côi & gộp 200 OK = 715,7 ms`.
   - **Kiểm chứng sao lưu & khôi phục (`pg_dump -Fc` -> `pg_restore` sang `utevtvl_restore_verify_db`, GĐ6=`7,05s`):** dump `21,22 MB` trong `2.498,4 ms`, restore `2.849,8 ms`, app khởi động sẵn sàng `600 ms`, đối soát `22.847` phiếu / `61.502` phiên bản / `42.069` lịch sử / `15.581` phiếu đã gộp / `224.207,75` giờ công (**`hoursDiff = 0`, khớp 100%**).

5. **Các hạng mục vẫn cần quản trị VPS / nhà cung cấp xác minh trước khi chuyển Production:**
   - Cấu hình thực chạy trên VPS của `/etc/nginx/nginx.conf`, TLS/HTTP2, thư mục `/var/cache/nginx/vtvl_static`, và chính sách tin cậy `VTVL_TRUST_PROXY` khớp chính xác IP proxy đứng ngay trước container/app.
   - Bảo vệ DDoS L3/L4 thượng nguồn và Load Balancer / CDN / WAF (nếu có trước VPS) để bảo đảm không làm lệch `X-Real-IP` hoặc nuốt mất IP thật khi áp dụng ngưỡng NAT trường (`150 r/s burst=300`).
   - Hệ thống giám sát & cảnh báo bên ngoài thực tế đọc `/api/health/ready` và người trực vận hành VPS cho cấu hình 1 backend Phương án A.

6. **Tiêu chí chuyển từ Phương án A sang Phương án B (2+ instances):**
   - Triển khai **Phương án B** khi hệ thống đạt một trong các ngưỡng: (i) nhu cầu bảo trì/nâng cấp **Zero-Downtime** (loại bỏ cửa sổ `~1,0s` gián đoạn `502` khi restart); (ii) lưu lượng giờ cao điểm duy trì vượt vùng chịu tải 1 bản (`> 200 req/s` hoặc `HeavyGate` bắt đầu xả `429` như mốc `300 req/s`); hoặc (iii) nâng chuẩn sẵn sàng (HA) chống lỗi đơn điểm tiến trình Node.js (lưu ý khi lên Phương án B cần chuyển rate-limit/heavy-lock toàn cục sang PostgreSQL hoặc bảng dùng chung nếu cân bằng tải round-robin).
