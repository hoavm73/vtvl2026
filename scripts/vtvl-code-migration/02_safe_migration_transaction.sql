-- =============================================================================
-- SCRIPT 2: CẬP NHẬT CẤU TRÚC MÃ VTVL CÓ TRANSACTION VÀ ROLLBACK
-- Mục đích: Chuyển đổi mã VTVL từ dạng HT{...} sang {MA_DON_VI}.HT{...}
--           bảo toàn toàn vẹn tham chiếu, không phát sinh dữ liệu mồ côi.
-- Cơ chế: TRANSACTION TOÀN PHẦN — Tự động ROLLBACK nếu có bất kỳ lỗi nào.
-- =============================================================================

BEGIN;

-- Đặt Savepoint để có thể quay lui nếu kiểm tra nội bộ không đạt
SAVEPOINT vtvl_migration_start;

-- -----------------------------------------------------------------------------
-- 1. TẠO BẢNG ÁNH XẠ TẠM THỜI (_tmp_vtvl_mapping)
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE _tmp_vtvl_mapping (
  ma_cu text PRIMARY KEY,
  ma_moi text NOT NULL,
  ma_don_vi text NOT NULL,
  can_cap_nhat boolean NOT NULL DEFAULT false
) ON COMMIT DROP;

-- Nạp quy tắc chuyển đổi vào bảng tạm
INSERT INTO _tmp_vtvl_mapping (ma_cu, ma_moi, ma_don_vi, can_cap_nhat)
SELECT
  c.ma_vtvl AS ma_cu,
  CASE
    -- Đã chuẩn dạng {MA_DON_VI}.HT... -> Giữ nguyên
    WHEN c.ma_vtvl ~* ('^' || c.ma_don_vi || '\.HT') THEN
      UPPER(TRIM(c.ma_vtvl))

    -- Có tiền tố dạng {MA_DON_VI}-HT... -> Đổi gạch ngang thành dấu chấm
    WHEN c.ma_vtvl ~* ('^' || c.ma_don_vi || '-HT') THEN
      UPPER(c.ma_don_vi) || '.' || UPPER(SUBSTRING(TRIM(c.ma_vtvl) FROM (LENGTH(c.ma_don_vi) + 2)))

    -- Dạng thuần HT... -> Thêm tiền tố {MA_DON_VI}.
    WHEN c.ma_vtvl ~* '^HT' THEN
      UPPER(c.ma_don_vi) || '.' || UPPER(TRIM(c.ma_vtvl))

    -- Dạng chứa HT ở giữa -> Chuẩn hóa về {MA_DON_VI}.HT...
    WHEN c.ma_vtvl ~* 'HT' AND c.ma_vtvl !~ ('^' || c.ma_don_vi || '\.') THEN
      UPPER(c.ma_don_vi) || '.' || UPPER(SUBSTRING(TRIM(c.ma_vtvl) FROM 'HT.*'))

    -- Không thuộc nhóm HT -> Giữ nguyên
    ELSE
      UPPER(TRIM(c.ma_vtvl))
  END AS ma_moi,
  c.ma_don_vi,
  (c.ma_vtvl <> CASE
    WHEN c.ma_vtvl ~* ('^' || c.ma_don_vi || '\.HT') THEN UPPER(TRIM(c.ma_vtvl))
    WHEN c.ma_vtvl ~* ('^' || c.ma_don_vi || '-HT') THEN UPPER(c.ma_don_vi) || '.' || UPPER(SUBSTRING(TRIM(c.ma_vtvl) FROM (LENGTH(c.ma_don_vi) + 2)))
    WHEN c.ma_vtvl ~* '^HT' THEN UPPER(c.ma_don_vi) || '.' || UPPER(TRIM(c.ma_vtvl))
    WHEN c.ma_vtvl ~* 'HT' AND c.ma_vtvl !~ ('^' || c.ma_don_vi || '\.') THEN UPPER(c.ma_don_vi) || '.' || UPPER(SUBSTRING(TRIM(c.ma_vtvl) FROM 'HT.*'))
    ELSE UPPER(TRIM(c.ma_vtvl))
  END) AS can_cap_nhat
FROM public.c1_vtvl c;

-- -----------------------------------------------------------------------------
-- 2. KIỂM TRA ĐIỀU KIỆN TIÊN QUYẾT (PRE-CONDITIONS ASSERTION)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_dup_count integer;
  v_null_unit_count integer;
BEGIN
  -- 2.1 Kiểm tra trùng lặp mã mới
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT ma_moi FROM _tmp_vtvl_mapping GROUP BY ma_moi HAVING COUNT(*) > 1
  ) sub;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Phát hiện mã mới bị trùng lặp sau khi ghép tiền tố đơn vị.';
  END IF;

  -- 2.2 Kiểm tra đơn vị không hợp lệ
  SELECT COUNT(*) INTO v_null_unit_count
  FROM _tmp_vtvl_mapping m
  LEFT JOIN public.dm_don_vi d ON d.ma_don_vi = m.ma_don_vi
  WHERE m.ma_don_vi IS NULL OR d.ma_don_vi IS NULL;

  IF v_null_unit_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION ABORTED: Phát hiện bản ghi có ma_don_vi không tồn tại trong dm_don_vi.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3. TẠM THỜI TẮT TRIGGER KIỂM SOÁT TÍNH NHẤT QUÁN ĐƠN VỊ ĐỂ CHUYỂN TIẾP DỮ LIỆU
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  dependent_tables text[] := ARRAY[
    'a2_cong_viec', 'b1_khoi_luong', 'b2_ct_tac_dong', 'b2_thay_doi',
    'c2_nang_luc', 'c3_nhu_cau', 'd1_nhan_luc', 'du_bao_5_nam',
    'd2_phuong_an', 'sldv_phan_bo_ngach', 'can_cu_goi_y'
  ];
BEGIN
  FOREACH tbl IN ARRAY dependent_tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER trg_enforce_unit_consistency;', tbl);
    EXCEPTION WHEN undefined_table THEN
      -- Bỏ qua nếu bảng chưa được khởi tạo trên môi trường hiện tại
      NULL;
    END;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 4. BƯỚC THỰC THI CHÍNH: CHIẾN LƯỢC SAO CHÉP -> CHUYỂN LIÊN KẾT -> XÓA MÃ CŨ
-- -----------------------------------------------------------------------------

-- 4.1 Thêm bản ghi mới vào C1_VTVL với mã mới
INSERT INTO public.c1_vtvl (
  ma_vtvl, ma_don_vi, ma_danh_muc_nd232, nhom_vtvl_4, ten_khung_vtvl_truong,
  ten_vtvl_cu_the_don_vi, bac_nghe_nghiep_su_dung, ma_ngach_chuc_danh,
  loai_nhan_luc, che_do_lam_viec, gio_chuan_pp2, phuong_phap,
  gio_b1_nam, gio_b2_tac_dong, gio_rong_nam, nhu_cau_fte, updated_at
)
SELECT
  m.ma_moi, c.ma_don_vi, c.ma_danh_muc_nd232, c.nhom_vtvl_4, c.ten_khung_vtvl_truong,
  c.ten_vtvl_cu_the_don_vi, c.bac_nghe_nghiep_su_dung, c.ma_ngach_chuc_danh,
  c.loai_nhan_luc, c.che_do_lam_viec, c.gio_chuan_pp2, c.phuong_phap,
  c.gio_b1_nam, c.gio_b2_tac_dong, c.gio_rong_nam, c.nhu_cau_fte, now()
FROM public.c1_vtvl c
JOIN _tmp_vtvl_mapping m ON m.ma_cu = c.ma_vtvl
WHERE m.can_cap_nhat = true;

-- 4.2 Cập nhật các bảng con có khóa ngoại tham chiếu đến C1_VTVL
DO $$
BEGIN
  -- A2_CONG_VIEC
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'a2_cong_viec') THEN
    UPDATE public.a2_cong_viec a
    SET ma_vtvl = m.ma_moi, updated_at = now()
    FROM _tmp_vtvl_mapping m
    WHERE a.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;
  END IF;

  -- B1_KHOI_LUONG
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'b1_khoi_luong') THEN
    UPDATE public.b1_khoi_luong b
    SET ma_vtvl = m.ma_moi, updated_at = now()
    FROM _tmp_vtvl_mapping m
    WHERE b.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;
  END IF;

  -- B2_CT_TAC_DONG
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'b2_ct_tac_dong') THEN
    UPDATE public.b2_ct_tac_dong b
    SET ma_vtvl = m.ma_moi, updated_at = now()
    FROM _tmp_vtvl_mapping m
    WHERE b.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;
  END IF;

  -- B2_THAY_DOI
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'b2_thay_doi') THEN
    UPDATE public.b2_thay_doi b
    SET ma_vtvl = m.ma_moi, updated_at = now()
    FROM _tmp_vtvl_mapping m
    WHERE b.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;
  END IF;

  -- D1_NHAN_LUC
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'd1_nhan_luc') THEN
    UPDATE public.d1_nhan_luc d
    SET ma_vtvl = m.ma_moi, updated_at = now()
    FROM _tmp_vtvl_mapping m
    WHERE d.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;
  END IF;

  -- SLDV_PHAN_BO_NGACH (cột ma_vtvl_xep_vao)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sldv_phan_bo_ngach') THEN
    UPDATE public.sldv_phan_bo_ngach s
    SET ma_vtvl_xep_vao = m.ma_moi, updated_at = now()
    FROM _tmp_vtvl_mapping m
    WHERE s.ma_vtvl_xep_vao = m.ma_cu AND m.can_cap_nhat = true;
  END IF;

  -- CAN_CU_GOI_Y
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'can_cu_goi_y') THEN
    UPDATE public.can_cu_goi_y c
    SET ma_vtvl = m.ma_moi, updated_at = now()
    FROM _tmp_vtvl_mapping m
    WHERE c.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;
  END IF;

  -- C2_NANG_LUC (ma_vtvl là PK -> sao chép sang mã mới rồi xóa mã cũ)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'c2_nang_luc') THEN
    INSERT INTO public.c2_nang_luc (ma_vtvl, ma_don_vi, muc_tieu_vi_tri, trach_nhiem_chinh, khung_nang_luc_bac, yeu_cau_trinh_do_chuyen_mon, ma_chuc_danh_nghe_nghiep, updated_at)
    SELECT m.ma_moi, c.ma_don_vi, c.muc_tieu_vi_tri, c.trach_nhiem_chinh, c.khung_nang_luc_bac, c.yeu_cau_trinh_do_chuyen_mon, c.ma_chuc_danh_nghe_nghiep, now()
    FROM public.c2_nang_luc c
    JOIN _tmp_vtvl_mapping m ON m.ma_cu = c.ma_vtvl
    WHERE m.can_cap_nhat = true;

    DELETE FROM public.c2_nang_luc c
    USING _tmp_vtvl_mapping m
    WHERE c.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;
  END IF;

  -- C3_NHU_CAU (ma_vtvl là PK -> sao chép sang mã mới rồi xóa mã cũ)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'c3_nhu_cau') THEN
    INSERT INTO public.c3_nhu_cau (ma_vtvl, ma_don_vi, phuong_phap, gio_b1_nam, gio_tac_dong_b2, gio_rong_nam, gio_chuan_pp2, nguoi_quy_doi_pp2, nguoi_dinh_bien_pp1, nguoi_can_bo_tri, updated_at)
    SELECT m.ma_moi, c.ma_don_vi, c.phuong_phap, c.gio_b1_nam, c.gio_tac_dong_b2, c.gio_rong_nam, c.gio_chuan_pp2, c.nguoi_quy_doi_pp2, c.nguoi_dinh_bien_pp1, c.nguoi_can_bo_tri, now()
    FROM public.c3_nhu_cau c
    JOIN _tmp_vtvl_mapping m ON m.ma_cu = c.ma_vtvl
    WHERE m.can_cap_nhat = true;

    DELETE FROM public.c3_nhu_cau c
    USING _tmp_vtvl_mapping m
    WHERE c.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;
  END IF;

  -- DU_BAO_5_NAM (ma_vtvl thuộc PK -> sao chép sang mã mới rồi xóa mã cũ)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'du_bao_5_nam') THEN
    INSERT INTO public.du_bao_5_nam (ma_vtvl, nam_du_bao, ma_don_vi, ty_le_thay_doi_kl_pct, nhu_cau_fte_du_kien, thuyet_minh_du_bao)
    SELECT m.ma_moi, d.nam_du_bao, d.ma_don_vi, d.ty_le_thay_doi_kl_pct, d.nhu_cau_fte_du_kien, d.thuyet_minh_du_bao
    FROM public.du_bao_5_nam d
    JOIN _tmp_vtvl_mapping m ON m.ma_cu = d.ma_vtvl
    WHERE m.can_cap_nhat = true;

    DELETE FROM public.du_bao_5_nam d
    USING _tmp_vtvl_mapping m
    WHERE d.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;
  END IF;

  -- D2_PHUONG_AN (ma_vtvl thuộc PK -> sao chép sang mã mới rồi xóa mã cũ)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'd2_phuong_an') THEN
    INSERT INTO public.d2_phuong_an (ma_vtvl, nam_phuong_an, ma_don_vi, so_nguoi_can_bo_tri, so_nguoi_hien_co, chenh_lech, phuong_an_dieu_chinh)
    SELECT m.ma_moi, d.nam_phuong_an, d.ma_don_vi, d.so_nguoi_can_bo_tri, d.so_nguoi_hien_co, d.chenh_lech, d.phuong_an_dieu_chinh
    FROM public.d2_phuong_an d
    JOIN _tmp_vtvl_mapping m ON m.ma_cu = d.ma_vtvl
    WHERE m.can_cap_nhat = true;

    DELETE FROM public.d2_phuong_an d
    USING _tmp_vtvl_mapping m
    WHERE d.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;
  END IF;
END $$;

-- 4.3 Xóa các bản ghi cũ khỏi C1_VTVL
DELETE FROM public.c1_vtvl c
USING _tmp_vtvl_mapping m
WHERE c.ma_vtvl = m.ma_cu AND m.can_cap_nhat = true;

-- -----------------------------------------------------------------------------
-- 5. BẬT LẠI CÁC TRIGGER RÀNG BUỘC
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  dependent_tables text[] := ARRAY[
    'a2_cong_viec', 'b1_khoi_luong', 'b2_ct_tac_dong', 'b2_thay_doi',
    'c2_nang_luc', 'c3_nhu_cau', 'd1_nhan_luc', 'du_bao_5_nam',
    'd2_phuong_an', 'sldv_phan_bo_ngach', 'can_cu_goi_y'
  ];
BEGIN
  FOREACH tbl IN ARRAY dependent_tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER trg_enforce_unit_consistency;', tbl);
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 6. KIỂM TRA ĐỐI SOÁT CUỐI CÙNG TRONG TRANSACTION (POST-CHECKS)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_orphan_count integer;
  v_old_remaining integer;
BEGIN
  -- 6.1 Kiểm tra không còn mã cũ trong C1_VTVL
  SELECT COUNT(*) INTO v_old_remaining
  FROM public.c1_vtvl c
  JOIN _tmp_vtvl_mapping m ON m.ma_cu = c.ma_vtvl
  WHERE m.can_cap_nhat = true;

  IF v_old_remaining > 0 THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Vẫn còn % mã cũ trong c1_vtvl sau khi cập nhật.', v_old_remaining;
  END IF;

  -- 6.2 Kiểm tra toàn vẹn khóa ngoại (0 bản ghi mồ côi)
  SELECT
    (SELECT COUNT(*) FROM public.a2_cong_viec WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)) +
    (SELECT COUNT(*) FROM public.b1_khoi_luong WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)) +
    (SELECT COUNT(*) FROM public.c2_nang_luc WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl)) +
    (SELECT COUNT(*) FROM public.c3_nhu_cau WHERE ma_vtvl NOT IN (SELECT ma_vtvl FROM public.c1_vtvl))
  INTO v_orphan_count;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION FAILED: Phát hiện % bản ghi mồ côi sau cập nhật. Tiến hành rollback.', v_orphan_count;
  END IF;

  RAISE NOTICE 'CẬP NHẬT THÀNH CÔNG: Toàn bộ kiểm tra toàn vẹn đạt 100%%.';
END $$;

COMMIT;

