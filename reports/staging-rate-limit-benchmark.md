# Báo cáo nghiệm thu & đo tải Phương án A (20.000 phiếu · 100.000 phiên bản/lịch sử · 250 phiên chung IP)

- Thời điểm đo: `2026-11-19T16:01:12.677Z` (Tổng thời lượng chạy benchmark 6 giai đoạn: `162.95s`)
- Thời lượng từng giai đoạn: GĐ1=`2.62s`, GĐ2=`10.71s`, GĐ3=`7.26s`, GĐ4=`133.49s`, GĐ5=`1.84s`, GĐ6=`7.05s`
- Cụm thử nghiệm: `PostgreSQL 16.16 (isolated local cluster port 5439)`, `nginx/1.31.9 (staging port 8360)`, `next build standalone (port 3369)`, `PG_POOL_MAX=5`
- Liveness / Readiness: `/api/health/live` -> `200` (`{"status":"ok"}`), `/api/health/ready` -> `200` (`{"status":"ready"}`).

## 1. Nghiệm thu toàn vẹn dữ liệu độc lập (Trước / Sau 10 đơn vị)
- Cách ly đồng nghiệp chung IP trường (login + C1 + duyệt): **ĐẠT**
- Timeout chờ khóa 8s (`429 LOCK_ACQUIRE_TIMEOUT`) & retry idempotent sau nhả khóa: **ĐẠT**
- Đua 2 người duyệt đồng thời (`Approve vs Approve` & `Approve vs RequestChanges`): **ĐẠT** (đúng 1 bên 200, 1 bên 400, 0 trùng lịch sử/dòng A2-B1)
- Tiến trình giữ khóa bị `SIGKILL` tự thu hồi khóa mồ côi (`ESRCH`): **ĐẠT**
- Đối soát tổng: `44` phiếu, `0` mã trùng, `46` phiên bản, `94` lịch sử, A2/B1 added `44/44`, tổng giờ SQL `564` vs Biểu B1 `564` (sai số `0`).

## 2. Đợt dồn tải 39 đơn vị trên nền 20.000 phiếu & 100.000 phiên bản/lịch sử
- Quy mô CSDL trước burst: `20000` phiếu, `60000` phiên bản + `40000` lịch sử (`100000` tổng).
- Kiểm tra cache nóng ngay sau seed SQL (không restart app): `BANTT` reconcile hợp nhất trực tiếp từ PostgreSQL `382` phiếu (`status=200`).
- Wave 1 (39 POST tạo phiếu + 39 POST gộp đồng thời): gộp `14588` phiếu, sót chưa gộp `0`, initial 429=`0` (retries=`0`), **5xx=`0`**, wall=`3051.86 ms`, DB Pool wait p95/max=`2.86/9.18 ms`.
- Wave 2 xả tải vượt hàng đợi (85 req đồng thời): OK `70`, 429 `15`, **5xx `0`**.

### Đối soát từng ID (`staff_work_tickets` ↔ `A2` ↔ `B1` ↔ `work_survey_merge_links`, 39 đơn vị)

| Mốc đối soát | Số ĐV | Tổng ID Đã duyệt | Khớp A2 | Khớp B1 | Khớp Merge Links | Cờ chưa gộp | Thiếu A2/B1 | Trùng / Mồ côi |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| stage2_afterChaos10Units | 39 | 44 | 44 | 44 | 44 | 0 | 0/0 | 0/0 |
| stage3_afterBurst39Units | 39 | 15014 | 15014 | 15014 | 15014 | 0 | 0/0 | 0/0 |
| stage4_afterHighLoad39Units | 39 | 15581 | 15581 | 15581 | 15581 | 0 | 0/0 | 0/0 |
| stage6_afterPgRestore39Units | 39 | 15581 | 15581 | 15581 | 15581 | 0 | 0/0 | 0/0 |

## 3. Đo tải 30 / 60 / 100 / 102×60s req/s & dò trần chịu tải 1 bản

| Chế độ | Mốc (req/s) | Thời lượng (cấu hình / thực tế) | Xả hàng đợi (ms) | Thực đạt tổng / 2xx (req/s) | p50 / p95 / p99 (ms) | 2xx (%) | 429 (%) | 5xx (%) | Chặn nhầm | DB Pool p95 / max (ms) | Đỉnh chờ Pool |
|---|---:|---|---:|---:|---|---:|---:|---:|---:|---|---:|
| nginx_dry_run_on | 30 | 6s / 6.05s | 80.52 | 29.7 / 29.75 | 7.57 / 28.86 / 96.81 | 100% (180/180) | 0% | 0% | 0 | 0.04 / 0.79 | 1 |
| nginx_dry_run_on | 60 | 6s / 6.1s | 111.41 | 59 / 59.02 | 6.98 / 221.2 / 393.28 | 100% (360/360) | 0% | 0% | 0 | 0.04 / 0.42 | 1 |
| nginx_dry_run_on | 100 | 8s / 8.08s | 87.12 | 99 / 98.95 | 6.92 / 33.22 / 94.01 | 100% (800/800) | 0% | 0% | 0 | 0.03 / 0.3 | 1 |
| nginx_enforced | 30 | 6s / 5.99s | 11.76 | 30.1 / 30.07 | 6.88 / 32.64 / 97.07 | 100% (180/180) | 0% | 0% | 0 | 0.03 / 0.64 | 1 |
| nginx_enforced | 60 | 6s / 6s | 9.87 | 60 / 60.04 | 6.57 / 27.61 / 85.34 | 100% (360/360) | 0% | 0% | 0 | 0.02 / 0.3 | 1 |
| nginx_enforced | 100 | 8s / 8.08s | 78.07 | 99.1 / 99.07 | 6.85 / 29.36 / 86.77 | 100% (800/800) | 0% | 0% | 0 | 0.03 / 0.31 | 1 |
| nginx_enforced | 102 | 60s / 60.07s | 77.01 | 101.9 / 101.88 | 6.95 / 53.41 / 98.99 | 100% (6120/6120) | 0% | 0% | 0 | 0.02 / 43.86 | 1 |
| ceiling_nginx_1ip | 150 | 6s / 6s | 8.38 | 149.9 / 149.88 | 9.09 / 72.56 / 130.66 | 100% (900/900) | 0% | 0% | 0 | 0.03 / 0.28 | 1 |
| ceiling_nginx_1ip | 200 | 6s / 6.08s | 80.62 | 197.4 / 197.37 | 17.18 / 90.25 / 182 | 100% (1200/1200) | 0% | 0% | 0 | 0.42 / 17.37 | 1 |
| ceiling_direct_multi_ip | 150 | 5s / 5.02s | 24.25 | 149.3 / 149.28 | 11.28 / 80.57 / 162.71 | 100% (750/750) | 0% | 0% | 0 | 0.03 / 0.51 | 1 |
| ceiling_direct_multi_ip | 220 | 5s / 5.12s | 121.71 | 214.7 / 214.65 | 34 / 226.1 / 489.97 | 100% (1100/1100) | 0% | 0% | 0 | 1.25 / 40.45 | 3 |
| ceiling_direct_multi_ip | 300 | 5s / 5.89s | 876.68 | 254.7 / 216.52 | 128.45 / 2632.05 / 3409.68 | 85% (1275/1500) | 15% | 0% | 225 | 21.89 / 123.47 | 6 |

### Chi tiết mốc 102 req/s × 60s (Tính cả xả hàng đợi)
- Thông lượng thực (gồm xả hàng đợi `77.01 ms`): `6120/6120` (`100%`) trên `wallTimeSec=60.07s` => **`achieved2xxRps = 101.88 req/s`**, `429=0` (`policyBlocked=0`, `overload=0`), `5xx=0`.
- Phân rã 429 theo mã: `{}`; theo API: `{}`; theo vai trò: `{}`.

| Thao tác (HeavyGate / Lock) | Số lượt | Chờ p50 / p95 / max (ms) | Giữ slot/khóa avg / p95 / max (ms) | Từ chối queue / Timeout |
|---|---:|---|---|---|
| Gate: submit_ticket | 1260 | 0 / 0 / 1.52 | 7.08 / 18.36 / 128.83 | 0 / 0 |
| Gate: review_ticket | 270 | 0 / 0 / 0 | 7.05 / 13.83 / 81.89 | 0 / 0 |
| Gate: save_workbook | 102 | 0 / 0 / 0.62 | 84.85 / 101.67 / 116.58 | 0 / 0 |
| Gate: reconcile_unit | 204 | 0 / 0 / 0.02 | 61.88 / 97.39 / 373.75 | 0 / 0 |
| FileLock: ticket_unit | 1530 | 0.39 / 0.58 / 8.73 | 6.38 / 16.7 / 128.2 | 0 / 0 |
| FileLock: unit_wb | 306 | 0.38 / 0.56 / 2.27 | 68.82 / 100.79 / 372.13 | 0 / 0 |

| Nhóm Rate Limit | Khóa đếm | Tổng req | Số đối tượng | Max req / đối tượng | Trần 60s (Burst) | Đạt chính sách |
|---|---|---:|---:|---:|---|---|
| read | email | 4284 | 250 | 25 | 180 (60) | Có |
| ticket_write | email | 1260 | 153 | 13 | 45 (15) | Có |
| ticket_review | email | 270 | 25 | 13 | 90 (25) | Có |
| unit_reconcile | unitCode | 204 | 25 | 9 | 12 (4) | Có |
| workbook_write | unitCode | 102 | 25 | 5 | 24 (6) | Có |

## 4. Thời gian phục hồi đo thực tế khi bản duy nhất dừng
- **SIGTERM (restart sạch):** Nginx trả `502/503` khi app dừng (`true`), khởi động lại tới `/api/health/live` = `721.5 ms`, tới `/api/health/ready` = `949.7 ms`, tổng thời gian từ lúc dừng tới sẵn sàng = `1037.7 ms`, tới truy vấn 20k phiếu = `1046.2 ms`.
- **SIGKILL (crash đột ngột khi đang giữ .lock):** tổng thời gian từ lúc kill tới `/api/health/ready` = `614.4 ms`, tới thu hồi khóa mồ côi & gộp 200 = `715.7 ms`.

## 5. Thử sao lưu (pg_dump) & khôi phục (pg_restore) trên CSDL thử riêng
- Tệp sao lưu `postgresql_custom_compressed (-Fc)`: dung lượng `21.22 MB`, thời gian dump `2498.4 ms`, thời gian restore vào `utevtvl_restore_verify_db` `2849.8 ms`, app khởi động sẵn sàng `600 ms`.
- Đối chiếu CSDL sau restore: phiếu `22847` (hoạt động `22847`, đã gộp `15581`), phiên bản `61502`, lịch sử `42069`, `t_tien_do=39`, tài khoản `251`, sai số tổng giờ `0` (**KHỚP 100%**).
