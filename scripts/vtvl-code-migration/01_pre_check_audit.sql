-- =============================================================================
-- SCRIPT 1: KIỂM TRA TRƯỚC CẬP NHẬT (PRE-MIGRATION DRY-RUN AUDIT)
-- Mục đích: Phân tích hiện trạng, mô phỏng ánh xạ mã mới, phát hiện xung đột
--           và kiểm tra toàn vẹn khóa ngoại TRƯỚC KHI thực hiện bất kỳ thay đổi nào.
-- An toàn: CHỈ ĐỌC (READ-ONLY) — Không chỉnh sửa, không xóa dữ liệu.
-- =============================================================================

\echo '========================================================================'
\echo 'BƯỚC 1: KIỂM TRA TỔNG QUAN BẢNG C1_VTVL VÀ CÁC MÃ CẦN CHUYỂN ĐỔI'
\echo '========================================================================'

-- 1.1 Thống kê số lượng bản ghi C1_VTVL theo cấu trúc mã hiện tại
SELECT
  COUNT(*) AS tong_so_vtvl,
  COUNT(*) FILTER (WHERE ma_vtvl ~ '^HT') AS so_ma_thuan_ht,
  COUNT(*) FILTER (WHERE ma_vtvl ~* '^[A-Z0-9_-]+\.HT') AS so_ma_da_co_tien_to_cham,
  COUNT(*) FILTER (WHERE ma_vtvl ~* '^[A-Z0-9_-]+-HT') AS so_ma_co_tien_to_gach,
  COUNT(*) FILTER (WHERE ma_vtvl !~* 'HT') AS so_ma_khong_phai_ht
FROM public.c1_vtvl;

-- 1.2 Kiểm tra các bản ghi C1_VTVL có mã đơn vị (ma_don_vi) bị NULL hoặc không tồn tại trong dm_don_vi
SELECT
  c.ma_vtvl,
  c.ma_don_vi,
  c.ten_vtvl_cu_the_don_vi
FROM public.c1_vtvl c
LEFT JOIN public.dm_don_vi d ON d.ma_don_vi = c.ma_don_vi
WHERE c.ma_don_vi IS NULL OR d.ma_don_vi IS NULL;

\echo '========================================================================'
\echo 'BƯỚC 2: MÔ PHỎNG BẢNG ÁNH XẠ MÃ CŨ -> MÃ MỚI (MAPPING SIMULATION)'
\echo '========================================================================'

-- 2.1 Bảng ánh xạ thử nghiệm và quy tắc sinh mã mới
WITH simulated_mapping AS (
  SELECT
    c.ma_vtvl AS ma_cu,
    c.ma_don_vi,
    d.ten_don_vi_vi,
    TRIM(c.ma_vtvl) AS ma_cu_trimmed,
    CASE
      -- Trường hợp 1: Mã đã có tiền tố đơn vị đúng chuẩn (ví dụ PDT.HT001 hoặc AAO.HT001)
      WHEN c.ma_vtvl ~* ('^' || c.ma_don_vi || '\.HT') THEN
        UPPER(TRIM(c.ma_vtvl))

      -- Trường hợp 2: Mã có tiền tố đơn vị nối bằng dấu gạch ngang (ví dụ FME-HT-PTN-01)
      WHEN c.ma_vtvl ~* ('^' || c.ma_don_vi || '-HT') THEN
        UPPER(c.ma_don_vi) || '.' || UPPER(SUBSTRING(TRIM(c.ma_vtvl) FROM (LENGTH(c.ma_don_vi) + 2)))

      -- Trường hợp 3: Mã thuần HT{...} (ví dụ HT001, HT45)
      WHEN c.ma_vtvl ~* '^HT' THEN
        UPPER(c.ma_don_vi) || '.' || UPPER(TRIM(c.ma_vtvl))

      -- Trường hợp khác có chứa HT ở giữa nhưng chưa chuẩn hóa
      WHEN c.ma_vtvl ~* 'HT' AND c.ma_vtvl !~ ('^' || c.ma_don_vi || '\.') THEN
        UPPER(c.ma_don_vi) || '.' || UPPER(SUBSTRING(TRIM(c.ma_vtvl) FROM 'HT.*'))

      -- Giữ nguyên nếu không thuộc nhóm HT
      ELSE
        UPPER(TRIM(c.ma_vtvl))
    END AS ma_moi
  FROM public.c1_vtvl c
  JOIN public.dm_don_vi d ON d.ma_don_vi = c.ma_don_vi
)
SELECT
  ma_cu,
  ma_moi,
  ma_don_vi,
  ten_don_vi_vi,
  CASE
    WHEN ma_cu = ma_moi THEN 'GIỮ NGUYÊN (ĐÃ CHUẨN)'
    ELSE 'CẦN CHUYỂN ĐỔI'
  END AS trang_thai_anh_xa
FROM simulated_mapping
ORDER BY ma_don_vi, ma_cu;

\echo '========================================================================'
\echo 'BƯỚC 3: KIỂM TRA TRÙNG LẶP MÃ MỚI (DUPLICATE DETECTION)'
\echo '========================================================================'

-- 3.1 Kiểm tra xem có mã mới nào bị trùng sau khi ghép {ma_don_vi}.HT{...} không
WITH simulated_mapping AS (
  SELECT
    c.ma_vtvl AS ma_cu,
    c.ma_don_vi,
    CASE
      WHEN c.ma_vtvl ~* ('^' || c.ma_don_vi || '\.HT') THEN UPPER(TRIM(c.ma_vtvl))
      WHEN c.ma_vtvl ~* ('^' || c.ma_don_vi || '-HT') THEN UPPER(c.ma_don_vi) || '.' || UPPER(SUBSTRING(TRIM(c.ma_vtvl) FROM (LENGTH(c.ma_don_vi) + 2)))
      WHEN c.ma_vtvl ~* '^HT' THEN UPPER(c.ma_don_vi) || '.' || UPPER(TRIM(c.ma_vtvl))
      WHEN c.ma_vtvl ~* 'HT' AND c.ma_vtvl !~ ('^' || c.ma_don_vi || '\.') THEN UPPER(c.ma_don_vi) || '.' || UPPER(SUBSTRING(TRIM(c.ma_vtvl) FROM 'HT.*'))
      ELSE UPPER(TRIM(c.ma_vtvl))
    END AS ma_moi
  FROM public.c1_vtvl c
  JOIN public.dm_don_vi d ON d.ma_don_vi = c.ma_don_vi
)
SELECT
  ma_moi,
  COUNT(*) AS so_lan_xuat_hien,
  string_agg(ma_cu, ', ') AS cac_ma_cu_bi_trung
FROM simulated_mapping
GROUP BY ma_moi
HAVING COUNT(*) > 1;

\echo '========================================================================'
\echo 'BƯỚC 4: THỐNG KÊ SỐ LƯỢNG BẢN GHI TRÊN 11 BẢNG PHỤ THUỘC (BASELINE COUNTS)'
\echo '========================================================================'

-- 4.1 Thống kê bản ghi trước khi chạy để làm mốc đối soát sau cập nhật
SELECT 'c1_vtvl' AS ten_bang, COUNT(*) AS tong_so_dong FROM public.c1_vtvl
UNION ALL
SELECT 'a2_cong_viec', COUNT(*) FROM public.a2_cong_viec
UNION ALL
SELECT 'b1_khoi_luong', COUNT(*) FROM public.b1_khoi_luong
UNION ALL
SELECT 'b2_ct_tac_dong', COUNT(*) FROM public.b2_ct_tac_dong
UNION ALL
SELECT 'b2_thay_doi', COUNT(*) FROM public.b2_thay_doi
UNION ALL
SELECT 'c2_nang_luc', COUNT(*) FROM public.c2_nang_luc
UNION ALL
SELECT 'c3_nhu_cau', COUNT(*) FROM public.c3_nhu_cau
UNION ALL
SELECT 'd1_nhan_luc', COUNT(*) FROM public.d1_nhan_luc
UNION ALL
SELECT 'du_bao_5_nam', COUNT(*) FROM public.du_bao_5_nam
UNION ALL
SELECT 'd2_phuong_an', COUNT(*) FROM public.d2_phuong_an
UNION ALL
SELECT 'sldv_phan_bo_ngach', COUNT(*) FROM public.sldv_phan_bo_ngach
UNION ALL
SELECT 'can_cu_goi_y', COUNT(*) FROM public.can_cu_goi_y;

\echo '========================================================================'
\echo 'BƯỚC 5: KIỂM TRA BẢN GHI MỒ CÔI (ORPHAN RECORDS) HIỆN TẠI'
\echo '========================================================================'

-- 5.1 Kiểm tra các bảng con có chứa ma_vtvl mà không tồn tại trong c1_vtvl
SELECT 'a2_cong_viec' AS bang, COUNT(*) AS so_dong_mo_coi FROM public.a2_cong_viec WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
UNION ALL
SELECT 'b1_khoi_luong', COUNT(*) FROM public.b1_khoi_luong WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
UNION ALL
SELECT 'b2_ct_tac_dong', COUNT(*) FROM public.b2_ct_tac_dong WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
UNION ALL
SELECT 'b2_thay_doi', COUNT(*) FROM public.b2_thay_doi WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
UNION ALL
SELECT 'c2_nang_luc', COUNT(*) FROM public.c2_nang_luc WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
UNION ALL
SELECT 'c3_nhu_cau', COUNT(*) FROM public.c3_nhu_cau WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
UNION ALL
SELECT 'd1_nhan_luc', COUNT(*) FROM public.d1_nhan_luc WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
UNION ALL
SELECT 'du_bao_5_nam', COUNT(*) FROM public.du_bao_5_nam WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
UNION ALL
SELECT 'd2_phuong_an', COUNT(*) FROM public.d2_phuong_an WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
UNION ALL
SELECT 'sldv_phan_bo_ngach', COUNT(*) FROM public.sldv_phan_bo_ngach WHERE ma_vtvl_xep_vao NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
UNION ALL
SELECT 'can_cu_goi_y', COUNT(*) FROM public.can_cu_goi_y WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl);

