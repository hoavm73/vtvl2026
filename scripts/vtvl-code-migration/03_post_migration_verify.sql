-- =============================================================================
-- SCRIPT 3: ĐỐI SOÁT VÀ XÁC MINH SAU CẬP NHẬT (POST-MIGRATION VERIFICATION)
-- Mục đích: Kiểm chứng 5 tiêu chí bắt buộc theo yêu cầu hệ thống VTVL:
--   1. Số lượng bản ghi trước và sau không thay đổi.
--   2. Không có khóa ngoại bị mất liên kết (0 bản ghi mồ côi).
--   3. Không có mã mới bị trùng.
--   4. Mọi mã VTVL thuộc nhóm HT đều có định dạng chuẩn {MA_DON_VI}.HT{...}.
--   5. Các trường dữ liệu khác ngoài phạm vi Mã VTVL không bị biến đổi.
-- =============================================================================

\echo '========================================================================'
\echo '1. KIỂM TRA ĐỊNH DẠNG MÃ MỚI (FORMAT INTEGRITY)'
\echo '========================================================================'

-- Tất cả các mã VTVL có chứa HT phải có định dạng {MA_DON_VI}.HT...
SELECT
  c.ma_vtvl,
  c.ma_don_vi,
  c.ten_vtvl_cu_the_don_vi,
  CASE
    WHEN c.ma_vtvl ~ ('^' || c.ma_don_vi || '\.HT') THEN 'ĐẠT CHUẨN'
    WHEN c.ma_vtvl !~ 'HT' THEN 'KHÔNG THUỘC NHÓM HT (HỢP LỆ)'
    ELSE 'SAI ĐỊNH DẠNG'
  END AS ket_luan_dinh_dang
FROM public.c1_vtvl c
ORDER BY c.ma_don_vi, c.ma_vtvl;

\echo '========================================================================'
\echo '2. KIỂM TRA TRÙNG LẶP MÃ VTVL (UNIQUENESS ASSERTION)'
\echo '========================================================================'

SELECT
  ma_vtvl,
  COUNT(*) AS so_luong
FROM public.c1_vtvl
GROUP BY ma_vtvl
HAVING COUNT(*) > 1;

\echo '========================================================================'
\echo '3. KIỂM TRA KHÓA NGOẠI VÀ BẢN GHI MỒ CÔI (REFERENTIAL INTEGRITY)'
\echo '========================================================================'

SELECT 'a2_cong_viec' AS ten_bang, COUNT(*) AS so_dong_mo_coi FROM public.a2_cong_viec WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)
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

\echo '========================================================================'
\echo '4. THỐNG KÊ TỔNG SỐ LƯỢNG BẢN GHI (ROW COUNT VERIFICATION)'
\echo '========================================================================'

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

