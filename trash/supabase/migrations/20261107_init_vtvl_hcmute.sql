-- =============================================================================
-- HCM-UTE VTVL 360 — CƠ SỞ DỮ LIỆU QUAN HỆ (POSTGRESQL / SUPABASE)
-- Hệ 18 bảng quan hệ chuẩn hóa ánh xạ 21 trang tính VTVL
-- Căn cứ pháp lý:
--   1. Hướng dẫn số 07-HD/BTCTW của Ban Tổ chức Trung ương
--   2. Nghị định số 232/2026/NĐ-CP ngày 25/5/2026 của Chính phủ (Bậc nghề nghiệp 1–5)
--   3. Thông tư số 31/2026/TT-BGDĐT ngày 14/4/2026 của Bộ trưởng Bộ GD&ĐT
--   4. Hướng dẫn số 02 (1907/HD-ĐHCNKT ngày 17/6/2026) của Hiệu trưởng HCM-UTE
-- =============================================================================

-- =============================================================================
-- PHẦN I. NHÓM 04 BẢNG DANH MỤC GỐC TOÀN TRƯỜNG (MASTER REFERENCE TABLES)
-- =============================================================================

-- 1. BẢNG DM_DON_VI: Danh mục 51 đơn vị thuộc/trực thuộc HCM-UTE
CREATE TABLE IF NOT EXISTS public.dm_don_vi (
  ma_don_vi text PRIMARY KEY,
  ten_don_vi_vi text NOT NULL,
  ten_don_vi_en text NOT NULL,
  khoi_don_vi text NOT NULL CHECK (khoi_don_vi IN ('khoa-vien', 'phong-ban', 'trung-tam', 'dang-doanthe')),
  linh_vuc text,
  chuc_danh_thu_truong_vi text,
  chuc_danh_thu_truong_en text,
  so_nhan_su_mac_dinh integer NOT NULL DEFAULT 10 CHECK (so_nhan_su_mac_dinh >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. BẢNG DM_CHUC_DANH_TT31: Danh mục 28 mã số chức danh & xếp lương nhà giáo (TT 31/2026/TT-BGDĐT)
CREATE TABLE IF NOT EXISTS public.dm_chuc_danh_tt31 (
  ma_so_chuc_danh text PRIMARY KEY,
  ten_chuc_danh text NOT NULL,
  khoan_dieu_tt31 text NOT NULL,
  loai_vien_chuc text NOT NULL,
  khung_he_so_luong text NOT NULL,
  dien_chuyen_tiep boolean NOT NULL DEFAULT false,
  ghi_chu_bo_nhiem text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. BẢNG DM_VTVL_KHUNG_TRUONG: Khung 38 vị trí việc làm của Trường theo 04 nhóm (Phụ lục I - 1907/HD-ĐHCNKT)
CREATE TABLE IF NOT EXISTS public.dm_vtvl_khung_truong (
  ma_danh_muc_nd232 text PRIMARY KEY,
  tt_toan_truong integer NOT NULL,
  tt_trong_nhom integer NOT NULL,
  nhom_vtvl_4 text NOT NULL CHECK (
    nhom_vtvl_4 IN (
      'I. Nhóm VTVL Quản lý',
      'II. Nhóm VTVL Chuyên môn, nghiệp vụ',
      'III. Nhóm VTVL Hỗ trợ',
      'IV. Nhóm VTVL Phục vụ'
    )
  ),
  ten_khung_vtvl_truong text NOT NULL,
  gioi_han_bac_nghe_nghiep text NOT NULL,
  ds_bac_cho_phep jsonb NOT NULL DEFAULT '[]'::jsonb,
  cong_thuc_ten_cu_the text NOT NULL,
  ma_so_chuc_danh text,
  ky_hieu_goi_y text,
  pham_vi_ap_dung text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dm_vtvl_khung_nhom4 ON public.dm_vtvl_khung_truong(nhom_vtvl_4);

-- 4. BẢNG DM_SAN_PHAM: Danh mục sản phẩm chuẩn 6 nhóm La Mã I–VI (Biểu 11. DM_SAN_PHAM)
CREATE TABLE IF NOT EXISTS public.dm_san_pham (
  ma_sp_chuan text PRIMARY KEY,
  ten_loai_sp text NOT NULL,
  khoi_nganh_linh_vuc text NOT NULL,
  nhom_la_ma text NOT NULL CHECK (nhom_la_ma IN ('I', 'II', 'III', 'IV', 'V', 'VI')),
  phut_sp_chuan numeric(10,2) NOT NULL CHECK (phut_sp_chuan > 0),
  van_ban_xac_nhan text,
  trang_thai text NOT NULL DEFAULT 'Đã xác nhận',
  co_quan_xac_nhan text,
  ngay_hieu_luc text,
  pham_vi_ap_dung text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- PHẦN II. NHÓM 14 BẢNG DỮ LIỆU NGHIỆP VỤ QUAN HỆ THEO ĐƠN VỊ (UNIT TABLES)
-- =============================================================================

-- 5. BẢNG C1_VTVL: Danh mục VTVL cụ thể tại đơn vị (Biểu 6. C1_VTVL & Phụ lục II 1907/HD-ĐHCNKT)
CREATE TABLE IF NOT EXISTS public.c1_vtvl (
  ma_vtvl text PRIMARY KEY,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ma_danh_muc_nd232 text REFERENCES public.dm_vtvl_khung_truong(ma_danh_muc_nd232) ON DELETE SET NULL,
  nhom_vtvl_4 text NOT NULL,
  ten_khung_vtvl_truong text NOT NULL,
  ten_vtvl_cu_the_don_vi text NOT NULL,
  bac_nghe_nghiep_su_dung text NOT NULL,
  ma_ngach_chuc_danh text,
  loai_nhan_luc text NOT NULL DEFAULT 'Viên chức' CHECK (loai_nhan_luc IN ('Viên chức', 'Hợp đồng lao động', 'Hợp đồng khoán việc', 'Thuê dịch vụ')),
  che_do_lam_viec text NOT NULL DEFAULT 'Phổ biến (40 giờ/tuần)',
  gio_chuan_pp2 numeric(10,2) NOT NULL DEFAULT 1904 CHECK (gio_chuan_pp2 IN (1760, 1904)),
  phuong_phap text NOT NULL DEFAULT 'PP2' CHECK (phuong_phap IN ('PP1', 'PP2', 'PP3', 'PP1+PP2', 'PP1+PP3', 'PP2+PP3')),
  gio_b1_nam numeric(12,2) NOT NULL DEFAULT 0,
  gio_b2_tac_dong numeric(12,2) NOT NULL DEFAULT 0,
  gio_rong_nam numeric(12,2) NOT NULL DEFAULT 0,
  nhu_cau_fte numeric(10,2) NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_c1_vtvl_ma_don_vi ON public.c1_vtvl(ma_don_vi);
CREATE INDEX IF NOT EXISTS idx_c1_vtvl_ma_khung ON public.c1_vtvl(ma_danh_muc_nd232);

-- 6. BẢNG A1_NHIEM_VU: Danh mục nhiệm vụ của đơn vị (Biểu 1. A1_NhiemVu)
CREATE TABLE IF NOT EXISTS public.a1_nhiem_vu (
  ma_nhiem_vu text PRIMARY KEY,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ten_nhiem_vu text NOT NULL,
  can_cu_phap_ly text NOT NULL,
  ky_thong_ke text NOT NULL DEFAULT '01/10/2025–30/9/2026',
  trang_thai_nv text NOT NULL DEFAULT 'Tiếp tục thực hiện',
  nguon_nhiem_vu text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_a1_nhiem_vu_ma_don_vi ON public.a1_nhiem_vu(ma_don_vi);

-- 7. BẢNG A2_CONG_VIEC: Danh mục công việc và sản phẩm đầu ra (Biểu 2. A2_CongViec)
CREATE TABLE IF NOT EXISTS public.a2_cong_viec (
  ma_cong_viec text PRIMARY KEY,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ma_nhiem_vu text NOT NULL REFERENCES public.a1_nhiem_vu(ma_nhiem_vu) ON DELETE CASCADE,
  ma_vtvl text NOT NULL REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  ma_sp_chuan text REFERENCES public.dm_san_pham(ma_sp_chuan) ON DELETE SET NULL,
  ten_cong_viec text NOT NULL,
  ten_san_pham text NOT NULL,
  nhom_la_ma text NOT NULL CHECK (nhom_la_ma IN ('I', 'II', 'III', 'IV', 'V', 'VI')),
  don_vi_tinh text NOT NULL,
  yeu_cau_chat_luong text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_a2_cong_viec_ma_don_vi ON public.a2_cong_viec(ma_don_vi);
CREATE INDEX IF NOT EXISTS idx_a2_cong_viec_ma_nhiem_vu ON public.a2_cong_viec(ma_nhiem_vu);
CREATE INDEX IF NOT EXISTS idx_a2_cong_viec_ma_vtvl ON public.a2_cong_viec(ma_vtvl);

-- 8. BẢNG B1_KHOI_LUONG: Thống kê sản lượng & thời gian thực tế 19 cột A–S (Biểu 3. B1_KhoiLuong)
CREATE TABLE IF NOT EXISTS public.b1_khoi_luong (
  ma_cong_viec text PRIMARY KEY REFERENCES public.a2_cong_viec(ma_cong_viec) ON DELETE CASCADE,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ma_vtvl text NOT NULL REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  ma_sp_chuan text REFERENCES public.dm_san_pham(ma_sp_chuan) ON DELETE SET NULL,
  so_sp_nam numeric(12,2) NOT NULL DEFAULT 0 CHECK (so_sp_nam >= 0),
  phut_sp_do_thuc_te numeric(10,2) NOT NULL DEFAULT 0 CHECK (phut_sp_do_thuc_te >= 0),
  gio_bo_sung_nam numeric(10,2) NOT NULL DEFAULT 0 CHECK (gio_bo_sung_nam >= 0),
  gio_sp_tinh numeric(12,2) NOT NULL DEFAULT 0,
  gio_tong_tinh numeric(12,2) NOT NULL DEFAULT 0,
  nguon_so_luong text,
  nguon_thoi_gian text,
  trang_thai_can_cu_tg text NOT NULL DEFAULT 'Có định mức',
  ky_thong_ke text NOT NULL DEFAULT '01/10/2025–30/9/2026',
  phut_sp_chuan numeric(10,2) NOT NULL DEFAULT 0,
  phut_sp_dung_tinh numeric(10,2) NOT NULL DEFAULT 0,
  canh_bao_cot_r text NOT NULL DEFAULT 'ĐẠT',
  giai_trinh_cot_s text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_b1_khoi_luong_ma_don_vi ON public.b1_khoi_luong(ma_don_vi);
CREATE INDEX IF NOT EXISTS idx_b1_khoi_luong_ma_vtvl ON public.b1_khoi_luong(ma_vtvl);

-- 9. BẢNG B2_CT_TAC_DONG: Chi tiết tác động số hóa, tự chủ, thuê dịch vụ (Biểu 4. B2_CT_TacDong)
CREATE TABLE IF NOT EXISTS public.b2_ct_tac_dong (
  id_tac_dong text PRIMARY KEY,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ma_cong_viec text NOT NULL REFERENCES public.a2_cong_viec(ma_cong_viec) ON DELETE CASCADE,
  ma_vtvl text NOT NULL REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  loai_tac_dong text NOT NULL DEFAULT 'Số hóa' CHECK (loai_tac_dong IN ('Số hóa', 'Cải tiến quy trình', 'Thuê dịch vụ/đặt hàng', 'Tự chủ', 'Xã hội hóa', 'Công việc mới phát sinh')),
  khau_tac_dong text,
  so_sp_ap_dung numeric(12,2) NOT NULL DEFAULT 0,
  phut_truoc numeric(10,2) NOT NULL DEFAULT 0,
  phut_sau numeric(10,2) NOT NULL DEFAULT 0,
  gio_giam_hop_le numeric(12,2) NOT NULL DEFAULT 0,
  can_cu_minh_chung text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_b2_ct_ma_don_vi ON public.b2_ct_tac_dong(ma_don_vi);
CREATE INDEX IF NOT EXISTS idx_b2_ct_ma_cong_viec ON public.b2_ct_tac_dong(ma_cong_viec);

-- 10. BẢNG B2_THAY_DOI: Tổng hợp tác động ròng theo đầu việc (Biểu 5. B2_ThayDoi)
CREATE TABLE IF NOT EXISTS public.b2_thay_doi (
  ma_cong_viec text PRIMARY KEY REFERENCES public.a2_cong_viec(ma_cong_viec) ON DELETE CASCADE,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ma_vtvl text NOT NULL REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  gio_giam_so_hoa numeric(12,2) NOT NULL DEFAULT 0,
  gio_giam_thue_tc numeric(12,2) NOT NULL DEFAULT 0,
  gio_viec_moi numeric(12,2) NOT NULL DEFAULT 0,
  gio_tac_dong_rong numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_b2_thay_doi_ma_don_vi ON public.b2_thay_doi(ma_don_vi);
CREATE INDEX IF NOT EXISTS idx_b2_thay_doi_ma_vtvl ON public.b2_thay_doi(ma_vtvl);

-- 11. BẢNG C2_NANG_LUC: Bản mô tả công việc & Khung năng lực Bậc 1–5 (Biểu 7. C2_NangLuc)
CREATE TABLE IF NOT EXISTS public.c2_nang_luc (
  ma_vtvl text PRIMARY KEY REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  muc_tieu_vi_tri text NOT NULL,
  trach_nhiem_chinh text NOT NULL,
  khung_nang_luc_bac text NOT NULL,
  yeu_cau_trinh_do_chuyen_mon text NOT NULL,
  ma_chuc_danh_nghe_nghiep text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_c2_nang_luc_ma_don_vi ON public.c2_nang_luc(ma_don_vi);

-- 12. BẢNG C3_NHU_CAU: Xác định nhu cầu nhân lực theo PP1, PP2, PP3 (Biểu 8. C3_NhuCau)
CREATE TABLE IF NOT EXISTS public.c3_nhu_cau (
  ma_vtvl text PRIMARY KEY REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  phuong_phap text NOT NULL DEFAULT 'PP2' CHECK (phuong_phap IN ('PP1', 'PP2', 'PP3', 'PP1+PP2', 'PP1+PP3', 'PP2+PP3')),
  gio_b1_nam numeric(12,2) NOT NULL DEFAULT 0,
  gio_tac_dong_b2 numeric(12,2) NOT NULL DEFAULT 0,
  gio_rong_nam numeric(12,2) NOT NULL DEFAULT 0,
  gio_chuan_pp2 numeric(10,2) NOT NULL DEFAULT 1904,
  nguoi_quy_doi_pp2 numeric(10,2) NOT NULL DEFAULT 0,
  nguoi_dinh_bien_pp1 numeric(10,2) NOT NULL DEFAULT 0,
  nguoi_can_bo_tri numeric(10,2) NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_c3_nhu_cau_ma_don_vi ON public.c3_nhu_cau(ma_don_vi);

-- 13. BẢNG D1_NHAN_LUC: Nguồn nhân lực hiện có chốt tại 30/9/2026 (Biểu 9. D1_NhanLuc)
CREATE TABLE IF NOT EXISTS public.d1_nhan_luc (
  ma_nguon_luc text PRIMARY KEY,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ma_vtvl text NOT NULL REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  ho_va_ten text NOT NULL,
  chuc_danh_hien_giu text NOT NULL,
  ma_ngach_chuc_danh text NOT NULL,
  loai_nhan_luc text NOT NULL DEFAULT 'Viên chức' CHECK (loai_nhan_luc IN ('Viên chức', 'Hợp đồng lao động', 'Hợp đồng khoán việc', 'Thuê dịch vụ')),
  ty_le_phan_bo_chinh numeric(5,2) NOT NULL DEFAULT 100 CHECK (ty_le_phan_bo_chinh BETWEEN 0 AND 100),
  gio_quy_doi_nam numeric(10,2) NOT NULL DEFAULT 1904,
  canh_bao_d1 text NOT NULL DEFAULT 'ĐẠT',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_d1_nhan_luc_ma_don_vi ON public.d1_nhan_luc(ma_don_vi);
CREATE INDEX IF NOT EXISTS idx_d1_nhan_luc_ma_vtvl ON public.d1_nhan_luc(ma_vtvl);

-- 14. BẢNG DU_BAO_5_NAM: Dự báo thay đổi khối lượng công việc 2027–2031 (Biểu DU_BAO_5_NAM)
CREATE TABLE IF NOT EXISTS public.du_bao_5_nam (
  ma_vtvl text NOT NULL REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  nam_du_bao integer NOT NULL CHECK (nam_du_bao BETWEEN 2027 AND 2031),
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ty_le_thay_doi_kl_pct numeric(6,2) NOT NULL DEFAULT 0,
  nhu_cau_fte_du_kien numeric(10,2) NOT NULL DEFAULT 1,
  thuyet_minh_du_bao text,
  PRIMARY KEY (ma_vtvl, nam_du_bao)
);
CREATE INDEX IF NOT EXISTS idx_du_bao_5_nam_ma_don_vi ON public.du_bao_5_nam(ma_don_vi);

-- 15. BẢNG D2_PHUONG_AN: Phương án bố trí biên chế giai đoạn 2027–2031 (Biểu 10. D2_PhuongAn)
CREATE TABLE IF NOT EXISTS public.d2_phuong_an (
  ma_vtvl text NOT NULL REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  nam_phuong_an integer NOT NULL CHECK (nam_phuong_an BETWEEN 2027 AND 2031),
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  so_nguoi_can_bo_tri numeric(10,2) NOT NULL DEFAULT 1,
  so_nguoi_hien_co numeric(10,2) NOT NULL DEFAULT 1,
  chenh_lech numeric(10,2) NOT NULL DEFAULT 0,
  phuong_an_dieu_chinh text NOT NULL DEFAULT 'Giữ ổn định',
  PRIMARY KEY (ma_vtvl, nam_phuong_an)
);
CREATE INDEX IF NOT EXISTS idx_d2_phuong_an_ma_don_vi ON public.d2_phuong_an(ma_don_vi);

-- 16. BẢNG K_KIEM_TRA: Bảng kiểm soát chéo tự động 6 chỉ tiêu (Biểu 13. K_KiemTra)
CREATE TABLE IF NOT EXISTS public.k_kiem_tra (
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  stt_chi_tieu integer NOT NULL CHECK (stt_chi_tieu BETWEEN 1 AND 6),
  nhom_bieu_doi_soat text NOT NULL,
  noi_dung_kiem_tra text NOT NULL,
  so_dong_loi integer NOT NULL DEFAULT 0,
  ket_luan text NOT NULL DEFAULT 'ĐẠT',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ma_don_vi, stt_chi_tieu)
);

-- 17. BẢNG T_TIEN_DO: Tổng hợp tiến độ hoàn thiện bộ biểu đơn vị (Biểu 14. T_TienDo)
CREATE TABLE IF NOT EXISTS public.t_tien_do (
  ma_don_vi text PRIMARY KEY REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ten_don_vi text NOT NULL,
  phien_ban text NOT NULL DEFAULT 'v1',
  so_nhiem_vu_a1 integer NOT NULL DEFAULT 0,
  so_cong_viec_a2 integer NOT NULL DEFAULT 0,
  so_vtvl_c1 integer NOT NULL DEFAULT 0,
  tong_fte_c3 numeric(10,2) NOT NULL DEFAULT 0,
  email_nguoi_thuc_hien text,
  chuc_vu_nguoi_thuc_hien text,
  trang_thai_ra_soat text NOT NULL DEFAULT 'Đã khởi tạo trực tuyến',
  du_lieu_ho_so_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.t_tien_do ADD COLUMN IF NOT EXISTS email_nguoi_thuc_hien text;
ALTER TABLE public.t_tien_do ADD COLUMN IF NOT EXISTS chuc_vu_nguoi_thuc_hien text;

-- 18. BẢNG S_NHAT_KY: Nhật ký phiên bản và lịch sử cập nhật trực tuyến (Biểu 15. S_NhatKy)
CREATE TABLE IF NOT EXISTS public.s_nhat_ky (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ten_don_vi text NOT NULL,
  hanh_dong text NOT NULL,
  chi_tiet text NOT NULL,
  email_nguoi_thuc_hien text,
  chuc_vu_nguoi_thuc_hien text,
  phien_ban text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.s_nhat_ky ADD COLUMN IF NOT EXISTS email_nguoi_thuc_hien text;
ALTER TABLE public.s_nhat_ky ADD COLUMN IF NOT EXISTS chuc_vu_nguoi_thuc_hien text;
CREATE INDEX IF NOT EXISTS idx_s_nhat_ky_ma_don_vi ON public.s_nhat_ky(ma_don_vi);

-- 19. BẢNG SLDV_QUY_MO_DON_VI: Chỉ số quy mô đơn vị để nội suy số sản phẩm điền sẵn (Kỳ 01/10/2025–30/9/2026)
CREATE TABLE IF NOT EXISTS public.sldv_quy_mo_don_vi (
  ma_don_vi text PRIMARY KEY REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  so_sinh_vien_quy_doi integer NOT NULL DEFAULT 0,
  so_nganh_ctdt integer NOT NULL DEFAULT 0,
  so_lop_hoc_phan_nam integer NOT NULL DEFAULT 0,
  so_phong_tn_xuong integer NOT NULL DEFAULT 0,
  so_de_tai_nckh_nam integer NOT NULL DEFAULT 0,
  so_van_ban_ho_so_nam integer NOT NULL DEFAULT 0,
  he_so_quy_mo numeric(8,2) NOT NULL DEFAULT 1.00,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 20. BẢNG SLDV_PHAN_BO_NGACH: Bảng nhân sự theo mã ngạch đối chiếu bảng lương tháng 9/2026 (Hỗ trợ tách ngạch -> VTVL D1)
CREATE TABLE IF NOT EXISTS public.sldv_phan_bo_ngach (
  id text PRIMARY KEY,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ma_ngach text NOT NULL,
  ten_ngach text NOT NULL,
  so_nguoi integer NOT NULL DEFAULT 1 CHECK (so_nguoi >= 0),
  ma_vtvl_xep_vao text NOT NULL REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  la_dong_tach boolean NOT NULL DEFAULT false,
  ghi_chu text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sldv_phan_bo_ngach_ma_don_vi ON public.sldv_phan_bo_ngach(ma_don_vi);
CREATE INDEX IF NOT EXISTS idx_sldv_phan_bo_ngach_ma_vtvl ON public.sldv_phan_bo_ngach(ma_vtvl_xep_vao);

-- 21. BẢNG CAN_CU_GOI_Y: Ánh xạ với trang tính Can_cu_goi_y (Ô màu cam điền sẵn gợi ý & căn cứ tham khảo)
CREATE TABLE IF NOT EXISTS public.can_cu_goi_y (
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  ma_cong_viec text NOT NULL REFERENCES public.a2_cong_viec(ma_cong_viec) ON DELETE CASCADE,
  ma_vtvl text NOT NULL REFERENCES public.c1_vtvl(ma_vtvl) ON DELETE CASCADE,
  ten_cong_viec text NOT NULL,
  so_sp_goi_y numeric(12,2) NOT NULL DEFAULT 0,
  phut_sp_goi_y numeric(10,2) NOT NULL DEFAULT 0,
  muc_do_phuc_tap text NOT NULL DEFAULT 'Thông thường',
  nguon_can_cu_goi_y text NOT NULL,
  da_sua_thuc_te boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ma_don_vi, ma_cong_viec)
);
CREATE INDEX IF NOT EXISTS idx_can_cu_goi_y_ma_don_vi ON public.can_cu_goi_y(ma_don_vi);
CREATE INDEX IF NOT EXISTS idx_can_cu_goi_y_ma_vtvl ON public.can_cu_goi_y(ma_vtvl);

-- 22. BẢNG RA_SOAT_CHUA_DU_CAN_CU: Ánh xạ với trang tính Chua_du_can_cu và Gop_y_bieu_mau khi xuất kết quả rà soát
CREATE TABLE IF NOT EXISTS public.ra_soat_chua_du_can_cu (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ma_don_vi text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  loai_bang text NOT NULL DEFAULT 'Chua_du_can_cu',
  bieu_nguon text NOT NULL,
  toa_do_o text NOT NULL,
  ma_tham_chieu text NOT NULL,
  noi_dung_phat_hien text NOT NULL,
  nguyen_nhan text,
  thoi_han_bo_sung text,
  dau_moi_phu_trach text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ra_soat_chua_du_can_cu_ma_don_vi ON public.ra_soat_chua_du_can_cu(ma_don_vi);

-- =============================================================================
-- PHẦN III. VIEW TỔNG HỢP & TRIGGER KIỂM SOÁT GIỚI HẠN BẬC NGHỀ NGHIỆP
-- =============================================================================

-- View tổng hợp toàn Trường phục vụ Ban Đề án VTVL và Phòng TCNS
CREATE OR REPLACE VIEW public.v_tong_hop_vtvl_toan_truong AS
SELECT
  d.ma_don_vi,
  d.ten_don_vi_vi,
  d.khoi_don_vi,
  COALESCE(t.phien_ban, 'Chưa nộp') AS phien_ban,
  COALESCE(t.so_nhiem_vu_a1, 0) AS so_nhiem_vu_a1,
  COALESCE(t.so_cong_viec_a2, 0) AS so_cong_viec_a2,
  COALESCE(t.so_vtvl_c1, 0) AS so_vtvl_c1,
  COALESCE(t.tong_fte_c3, 0) AS tong_fte_c3,
  COALESCE(t.trang_thai_ra_soat, 'Chưa khởi tạo') AS trang_thai_ra_soat,
  t.updated_at
FROM public.dm_don_vi d
LEFT JOIN public.t_tien_do t ON t.ma_don_vi = d.ma_don_vi
ORDER BY d.khoi_don_vi, d.ma_don_vi;

-- Trigger tự động kiểm tra giới hạn Bậc nghề nghiệp theo Phụ lục I văn bản 1907/HD-ĐHCNKT
CREATE OR REPLACE FUNCTION public.fn_validate_c1_career_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed jsonb;
BEGIN
  IF NEW.ma_danh_muc_nd232 IS NOT NULL THEN
    SELECT ds_bac_cho_phep INTO v_allowed
    FROM public.dm_vtvl_khung_truong
    WHERE ma_danh_muc_nd232 = NEW.ma_danh_muc_nd232;

    IF v_allowed IS NOT NULL AND jsonb_array_length(v_allowed) > 0 THEN
      IF NOT (v_allowed ? NEW.bac_nghe_nghiep_su_dung) THEN
        RAISE EXCEPTION 'Bậc nghề nghiệp "%" vượt quá giới hạn cho phép của vị trí khung % (%)',
          NEW.bac_nghe_nghiep_su_dung, NEW.ten_khung_vtvl_truong, v_allowed::text;
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_c1_career_level ON public.c1_vtvl;
CREATE TRIGGER trg_validate_c1_career_level
BEFORE INSERT OR UPDATE ON public.c1_vtvl
FOR EACH ROW EXECUTE FUNCTION public.fn_validate_c1_career_level();

-- Trigger kiểm soát tính nhất quán mã đơn vị (ma_don_vi) giữa C1_VTVL và các bảng phụ thuộc
CREATE OR REPLACE FUNCTION public.fn_enforce_unit_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_vtvl text;
  v_parent_unit text;
BEGIN
  v_target_vtvl := COALESCE(to_jsonb(NEW)->>'ma_vtvl', to_jsonb(NEW)->>'ma_vtvl_xep_vao');
  IF v_target_vtvl IS NOT NULL THEN
    SELECT ma_don_vi INTO v_parent_unit
    FROM public.c1_vtvl
    WHERE ma_vtvl = v_target_vtvl;

    IF v_parent_unit IS NOT NULL AND v_parent_unit <> NEW.ma_don_vi THEN
      RAISE EXCEPTION 'Lỗi toàn vẹn liên bảng (%): ma_don_vi "%" không khớp với đơn vị "%" của vị trí việc làm "%"',
        TG_TABLE_NAME, NEW.ma_don_vi, v_parent_unit, v_target_vtvl;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_unit_consistency ON public.%I;', tbl);
    EXECUTE format('CREATE TRIGGER trg_enforce_unit_consistency BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_unit_consistency();', tbl);
  END LOOP;
END $$;

-- =============================================================================
-- PHẦN IV. BẢO MẬT ROW LEVEL SECURITY (RLS) CHO TOÀN BỘ 18 BẢNG
-- =============================================================================
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'dm_don_vi', 'dm_chuc_danh_tt31', 'dm_vtvl_khung_truong', 'dm_san_pham',
    'c1_vtvl', 'a1_nhiem_vu', 'a2_cong_viec', 'b1_khoi_luong',
    'b2_ct_tac_dong', 'b2_thay_doi', 'c2_nang_luc', 'c3_nhu_cau',
    'd1_nhan_luc', 'du_bao_5_nam', 'd2_phuong_an', 'k_kiem_tra',
    't_tien_do', 's_nhat_ky', 'sldv_quy_mo_don_vi', 'sldv_phan_bo_ngach',
    'can_cu_goi_y', 'ra_soat_chua_du_can_cu'
  ];
BEGIN
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_select_%s" ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "rls_select_%s" ON public.%I FOR SELECT TO anon, authenticated USING (true);', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_insert_%s" ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "rls_insert_%s" ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true);', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "rls_update_%s" ON public.%I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "rls_update_%s" ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);', tbl, tbl);
  END LOOP;
END $$;

-- =============================================================================
-- PHẦN V. DỮ LIỆU KHỞI TẠO KHUNG 38 VTVL CỦA TRƯỜNG (PHỤ LỤC I — 1907/HD-ĐHCNKT)
-- =============================================================================
INSERT INTO public.dm_vtvl_khung_truong (
  ma_danh_muc_nd232, tt_toan_truong, tt_trong_nhom, nhom_vtvl_4,
  ten_khung_vtvl_truong, gioi_han_bac_nghe_nghiep, ds_bac_cho_phep,
  cong_thuc_ten_cu_the, ma_so_chuc_danh, ky_hieu_goi_y, pham_vi_ap_dung
) VALUES
  ('HD1907-I-01', 1, 1, 'I. Nhóm VTVL Quản lý', 'Hiệu trưởng', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Hiệu trưởng Trường ĐH Công nghệ Kỹ thuật TP.HCM', 'V.07.01.01', 'QL-HT', 'Quản lý cấp trường'),
  ('HD1907-I-02', 2, 2, 'I. Nhóm VTVL Quản lý', 'Phó hiệu trưởng', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Phó hiệu trưởng + [lĩnh vực phụ trách]', 'V.07.01.01', 'QL-PHT', 'Quản lý cấp trường'),
  ('HD1907-I-03', 3, 3, 'I. Nhóm VTVL Quản lý', 'Trưởng khoa', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Trưởng khoa + [Tên Khoa]', 'V.07.01.01', 'QL-TK', 'Đơn vị chuyên môn'),
  ('HD1907-I-04', 4, 4, 'I. Nhóm VTVL Quản lý', 'Viện trưởng', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Viện trưởng + [Tên Viện]', 'V.07.01.01', 'QL-VT', 'Đơn vị chuyên môn/chức năng'),
  ('HD1907-I-05', 5, 5, 'I. Nhóm VTVL Quản lý', 'Trưởng phòng', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Trưởng phòng + [Tên Phòng]', '01.002', 'QL-TP', 'Đơn vị chức năng'),
  ('HD1907-I-06', 6, 6, 'I. Nhóm VTVL Quản lý', 'Giám đốc', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Giám đốc + [Tên Trung tâm / Phân hiệu]', 'V.07.01.02', 'QL-GD', 'Đơn vị chuyên môn/chức năng'),
  ('HD1907-I-07', 7, 7, 'I. Nhóm VTVL Quản lý', 'Chánh văn phòng', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Chánh văn phòng + [Tên Văn phòng]', '01.002', 'QL-CVP', 'Đơn vị chức năng'),
  ('HD1907-I-08', 8, 8, 'I. Nhóm VTVL Quản lý', 'Tổng biên tập', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Tổng biên tập Tạp chí', 'V.07.01.01', 'QL-TBT', 'Đơn vị chức năng'),
  ('HD1907-I-09', 9, 9, 'I. Nhóm VTVL Quản lý', 'Trưởng trạm', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Trưởng trạm Y tế', 'V.08.01.02', 'QL-TT', 'Đơn vị chức năng'),
  ('HD1907-I-10', 10, 10, 'I. Nhóm VTVL Quản lý', 'Phó Trưởng khoa', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Phó Trưởng khoa + [lĩnh vực phụ trách / số thứ tự]', 'V.07.01.02', 'QL-PTK', 'Đơn vị chuyên môn'),
  ('HD1907-I-11', 11, 11, 'I. Nhóm VTVL Quản lý', 'Phó Viện trưởng', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Phó Viện trưởng + [lĩnh vực phụ trách]', 'V.07.01.02', 'QL-PVT', 'Đơn vị chuyên môn/chức năng'),
  ('HD1907-I-12', 12, 12, 'I. Nhóm VTVL Quản lý', 'Phó Trưởng phòng', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Phó Trưởng phòng + [lĩnh vực phụ trách]', '01.002', 'QL-PTP', 'Đơn vị chức năng'),
  ('HD1907-I-13', 13, 13, 'I. Nhóm VTVL Quản lý', 'Phó Giám đốc', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Phó Giám đốc + [lĩnh vực phụ trách]', 'V.07.01.02', 'QL-PGD', 'Đơn vị chuyên môn/chức năng'),
  ('HD1907-I-14', 14, 14, 'I. Nhóm VTVL Quản lý', 'Phó Chánh văn phòng', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Phó Chánh văn phòng + [lĩnh vực phụ trách]', '01.003', 'QL-PCVP', 'Đơn vị chức năng'),
  ('HD1907-I-15', 15, 15, 'I. Nhóm VTVL Quản lý', 'Phó Tổng biên tập', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Phó Tổng biên tập Tạp chí', 'V.07.01.02', 'QL-PTBT', 'Đơn vị chức năng'),
  ('HD1907-I-16', 16, 16, 'I. Nhóm VTVL Quản lý', 'Phó Trưởng trạm', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Phó Trưởng trạm Y tế', 'V.08.01.03', 'QL-PTT', 'Đơn vị chức năng'),
  ('HD1907-I-17', 17, 17, 'I. Nhóm VTVL Quản lý', 'Trưởng Bộ môn', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Trưởng Bộ môn + [Tên Bộ môn]', 'V.07.01.02', 'QL-TBM', 'Đơn vị chuyên môn'),
  ('HD1907-I-18', 18, 18, 'I. Nhóm VTVL Quản lý', 'Trưởng Ngành', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Trưởng Ngành + [Tên Ngành]', 'V.07.01.02', 'QL-TN', 'Đơn vị chuyên môn'),
  ('HD1907-I-19', 19, 19, 'I. Nhóm VTVL Quản lý', 'Phó Trưởng Bộ môn', 'Không áp dụng bậc', '["Không áp dụng bậc"]', 'Phó Trưởng Bộ môn + [Tên Bộ môn]', 'V.07.01.02', 'QL-PTBM', 'Đơn vị chuyên môn'),
  ('HD1907-II-01', 20, 1, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Giảng viên', 'Bậc 3', '["Bậc 3"]', 'Giảng viên (giữ nguyên tên khung)', 'V.07.01.03', 'DT-GV-03', 'Đơn vị chuyên môn'),
  ('HD1907-II-02', 21, 2, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Giảng viên chính', 'Bậc 4', '["Bậc 4"]', 'Giảng viên chính (giữ nguyên tên khung)', 'V.07.01.02', 'DT-GV-02', 'Đơn vị chuyên môn'),
  ('HD1907-II-03', 22, 3, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Giảng viên cao cấp', 'Bậc 5', '["Bậc 5"]', 'Giảng viên cao cấp (giữ nguyên tên khung)', 'V.07.01.01', 'DT-GV-01', 'Đơn vị chuyên môn'),
  ('HD1907-II-04', 23, 4, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Trợ lý nghiên cứu (hạng IV)', 'Bậc 2', '["Bậc 2"]', 'Trợ lý nghiên cứu (hạng IV)', 'V.05.01.04', 'NC-TL-01', 'Đơn vị chuyên môn'),
  ('HD1907-II-05', 24, 5, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Nghiên cứu viên (hạng III)', 'Bậc 3', '["Bậc 3"]', 'Nghiên cứu viên (hạng III)', 'V.05.01.03', 'NC-NCV-01', 'Đơn vị chuyên môn'),
  ('HD1907-II-06', 25, 6, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Nghiên cứu viên chính (hạng II)', 'Bậc 4', '["Bậc 4"]', 'Nghiên cứu viên chính (hạng II)', 'V.05.01.02', 'NC-NCVC-01', 'Đơn vị chuyên môn'),
  ('HD1907-II-07', 26, 7, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Thư viện viên', 'Từ bậc 3 đến bậc 4', '["Từ bậc 3 đến bậc 4","Bậc 3","Bậc 4","Bậc 3, Bậc 4"]', 'Thư viện viên + [lĩnh vực phụ trách]', 'V.10.02.06', 'CM-TVV-01', 'Đơn vị chức năng'),
  ('HD1907-II-08', 27, 8, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Chuyên viên', 'Từ bậc 3 đến bậc 4', '["Từ bậc 3 đến bậc 4","Bậc 3","Bậc 4","Bậc 3, Bậc 4"]', 'Tại Khoa/Viện: Thư ký khoa · Tại Phòng/Ban: Chuyên viên + [lĩnh vực phụ trách]', '01.003', 'CM-CV-01', 'Đơn vị chuyên môn/chức năng'),
  ('HD1907-II-09', 30, 9, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Kế toán viên', 'Từ bậc 3 đến bậc 4', '["Từ bậc 3 đến bậc 4","Bậc 3","Bậc 4","Bậc 3, Bậc 4"]', 'Kế toán viên + [mảng kế toán]', '06.031', 'CM-KTV-01', 'Đơn vị chức năng'),
  ('HD1907-II-10', 31, 10, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Bác sĩ', 'Từ bậc 3 đến bậc 4', '["Từ bậc 3 đến bậc 4","Bậc 3","Bậc 4","Bậc 3, Bậc 4"]', 'Bác sĩ y tế trường học', 'V.08.01.03', 'CM-BS-01', 'Đơn vị chức năng'),
  ('HD1907-II-11', 32, 11, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Y sĩ', 'Bậc 2', '["Bậc 2"]', 'Y sĩ y tế trường học', 'V.08.03.07', 'CM-YS-01', 'Đơn vị chức năng'),
  ('HD1907-II-12', 33, 12, 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', 'Điều dưỡng', 'Từ bậc 2 đến bậc 4', '["Từ bậc 2 đến bậc 4","Bậc 2","Bậc 3","Bậc 4","Bậc 2, Bậc 3","Bậc 3, Bậc 4"]', 'Điều dưỡng y tế trường học', 'V.08.05.12', 'CM-DD-01', 'Đơn vị chức năng'),
  ('HD1907-III-01', 34, 1, 'III. Nhóm VTVL Hỗ trợ', 'Trợ giảng', 'Bậc 3', '["Bậc 3"]', 'Trợ giảng (giữ nguyên tên khung)', 'V.07.01.23', 'HT-TG-01', 'Đơn vị chuyên môn'),
  ('HD1907-III-02', 35, 2, 'III. Nhóm VTVL Hỗ trợ', 'Nhân sự phụ trách xưởng/phòng thí nghiệm', 'Bậc 2', '["Bậc 2"]', 'Nhân sự phụ trách phòng thí nghiệm + [Tên PTN/Xưởng]', 'V.05.02.07', 'HT-PTN-01', 'Đơn vị chuyên môn'),
  ('HD1907-III-03', 36, 3, 'III. Nhóm VTVL Hỗ trợ', 'Thủ quỹ', 'Bậc 2', '["Bậc 2"]', 'Thủ quỹ', '01.005', 'HT-TQ-01', 'Đơn vị chức năng'),
  ('HD1907-IV-01', 37, 1, 'IV. Nhóm VTVL Phục vụ', 'Nhân viên kỹ thuật', 'Từ bậc 1 đến bậc 2', '["Từ bậc 1 đến bậc 2","Bậc 1","Bậc 2","Bậc 1, Bậc 2"]', 'Nhân viên kỹ thuật + [điện, nước, hạ tầng...]', 'NV-KT', 'PV-KT-01', 'Đơn vị chức năng'),
  ('HD1907-IV-02', 38, 2, 'IV. Nhóm VTVL Phục vụ', 'Nhân viên lái xe', 'Từ bậc 1 đến bậc 2', '["Từ bậc 1 đến bậc 2","Bậc 1","Bậc 2","Bậc 1, Bậc 2"]', 'Nhân viên lái xe công vụ', 'NV-LX', 'PV-LX-01', 'Đơn vị chức năng'),
  ('HD1907-IV-03', 39, 3, 'IV. Nhóm VTVL Phục vụ', 'Nhân viên bảo vệ', 'Từ bậc 1 đến bậc 2', '["Từ bậc 1 đến bậc 2","Bậc 1","Bậc 2","Bậc 1, Bậc 2"]', 'Nhân viên bảo vệ an ninh trật tự', 'NV-BV', 'PV-BV-01', 'Đơn vị chức năng'),
  ('HD1907-IV-04', 40, 4, 'IV. Nhóm VTVL Phục vụ', 'Nhân viên lễ tân, phục vụ, tạp vụ', 'Từ bậc 1 đến bậc 2', '["Từ bậc 1 đến bậc 2","Bậc 1","Bậc 2","Bậc 1, Bậc 2"]', 'Nhân viên lễ tân, phục vụ, tạp vụ', 'NV-PV', 'PV-LT-01', 'Đơn vị chức năng')
ON CONFLICT (ma_danh_muc_nd232) DO UPDATE SET
  ten_khung_vtvl_truong = EXCLUDED.ten_khung_vtvl_truong,
  gioi_han_bac_nghe_nghiep = EXCLUDED.gioi_han_bac_nghe_nghiep,
  ds_bac_cho_phep = EXCLUDED.ds_bac_cho_phep,
  cong_thuc_ten_cu_the = EXCLUDED.cong_thuc_ten_cu_the;
