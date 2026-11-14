-- ==============================================================================
-- RECONCILIATION MIGRATION: 30 TABLES FULL CANONICAL SCHEMA, RLS HARDENING & AUDIT FIX
-- Timestamp: 20261114220000_reconcile_production_schema.sql
-- Hệ thống: HCM-UTE VTVL 360 (Nghị định 232/2026/NĐ-CP & Thông tư 31/2026/TT-BGDĐT)
-- ==============================================================================
-- NGUYÊN TẮC:
-- 1. ADDITIVE ONLY: Không DROP TABLE, không xóa cột, không truncate s_nhat_ky.
-- 2. CANONICAL EXACT: 15 bảng nghiệp vụ khớp 100% định nghĩa gốc 20261107_init_vtvl_hcmute.sql
--    và coordinated_tasks khớp 20261114_add_rbac_and_tickets.sql.
-- 3. CAMELCASE BACKFILL: jsonb_to_recordset đọc chính xác camelCase JSON cũ và passwordHash.
-- 4. BẢO MẬT RLS USER_ACCOUNTS: Không GRANT SELECT toàn bảng, loại bỏ hoàn toàn password_hash
--    khỏi danh sách cột được SELECT; policy SELECT không dùng USING(true).
-- 5. PHÂN QUYỀN RLS THEO VAI TRÒ: Helper get_auth_role & can_write_unit_data;
--    workbooks INSERT/UPDATE chỉ admin/unit_leader; staff_work_tickets cách ly bản nháp.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- PHẦN 1: NÂNG CẤP 3 BẢNG HIỆN HÀNH TRÊN PRODUCTION
-- ------------------------------------------------------------------------------

-- 1.1. Nâng cấp c1_vtvl: bổ sung ma_danh_muc_nd232
ALTER TABLE IF EXISTS public.c1_vtvl
  ADD COLUMN IF NOT EXISTS ma_danh_muc_nd232 TEXT,
  ADD COLUMN IF NOT EXISTS nhom_vtvl_4 TEXT,
  ADD COLUMN IF NOT EXISTS ten_khung_vtvl_truong TEXT,
  ADD COLUMN IF NOT EXISTS ten_vtvl_cu_the_don_vi TEXT,
  ADD COLUMN IF NOT EXISTS bac_nghe_nghiep_su_dung TEXT,
  ADD COLUMN IF NOT EXISTS ma_ngach_chuc_danh TEXT,
  ADD COLUMN IF NOT EXISTS loai_nhan_luc TEXT,
  ADD COLUMN IF NOT EXISTS che_do_lam_viec TEXT,
  ADD COLUMN IF NOT EXISTS gio_chuan_pp2 NUMERIC,
  ADD COLUMN IF NOT EXISTS phuong_phap TEXT,
  ADD COLUMN IF NOT EXISTS gio_b1_nam NUMERIC,
  ADD COLUMN IF NOT EXISTS gio_b2_tac_dong NUMERIC,
  ADD COLUMN IF NOT EXISTS gio_rong_nam NUMERIC,
  ADD COLUMN IF NOT EXISTS nhu_cau_fte NUMERIC,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_c1_vtvl_ma_nd232 ON public.c1_vtvl(ma_danh_muc_nd232);

-- 1.2. Nâng cấp t_tien_do: bổ sung thông tin định danh người thực hiện
ALTER TABLE IF EXISTS public.t_tien_do
  ADD COLUMN IF NOT EXISTS email_nguoi_thuc_hien TEXT,
  ADD COLUMN IF NOT EXISTS chuc_vu_nguoi_thuc_hien TEXT;

-- 1.3. Nâng cấp s_nhat_ky: bổ sung người thực hiện và tạo index (KHÔNG TRUNCATE)
ALTER TABLE IF EXISTS public.s_nhat_ky
  ADD COLUMN IF NOT EXISTS email_nguoi_thuc_hien TEXT,
  ADD COLUMN IF NOT EXISTS chuc_vu_nguoi_thuc_hien TEXT,
  ADD COLUMN IF NOT EXISTS bieu_cap_nhat TEXT,
  ADD COLUMN IF NOT EXISTS gia_tri_cu TEXT,
  ADD COLUMN IF NOT EXISTS gia_tri_moi TEXT,
  ADD COLUMN IF NOT EXISTS phien_ban TEXT;

CREATE INDEX IF NOT EXISTS idx_s_nhat_ky_ma_don_vi_created
  ON public.s_nhat_ky (ma_don_vi, created_at DESC);

-- ------------------------------------------------------------------------------
-- PHẦN 2: TẠO 15 BẢNG NGHIỆP VỤ CANONICAL THEO 20261107_INIT_VTVL_HCMUTE.SQL
-- ------------------------------------------------------------------------------

-- 2.1. a1_nhiem_vu: Biểu 1 - Danh mục nhiệm vụ của đơn vị
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

-- 2.2. a2_cong_viec: Biểu 2 - Danh mục công việc và sản phẩm đầu ra
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

-- 2.3. b1_khoi_luong: Biểu 3 - Thống kê sản lượng & thời gian thực tế 19 cột A–S
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

-- 2.4. b2_ct_tac_dong: Biểu 4 - Chi tiết tác động số hóa, tự chủ, thuê dịch vụ
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

-- 2.5. b2_thay_doi: Biểu 5 - Tổng hợp tác động ròng theo đầu việc
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

-- 2.6. c2_nang_luc: Biểu 7 - Bản mô tả công việc & Khung năng lực Bậc 1–5
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

-- 2.7. c3_nhu_cau: Biểu 8 - Xác định nhu cầu nhân lực theo PP1, PP2, PP3
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

-- 2.8. d1_nhan_luc: Biểu 9 - Nguồn nhân lực hiện có chốt tại 30/9/2026
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

-- 2.9. du_bao_5_nam: Biểu 10 - Dự báo thay đổi khối lượng công việc 2027–2031
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

-- 2.10. d2_phuong_an: Biểu 11 - Phương án bố trí biên chế giai đoạn 2027–2031
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

-- 2.11. k_kiem_tra: Biểu 13 - Kiểm soát chéo tự động 6 chỉ tiêu K_KiemTra
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

-- 2.12. sldv_quy_mo_don_vi: Chỉ số quy mô đơn vị để nội suy số sản phẩm điền sẵn
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

-- 2.13. sldv_phan_bo_ngach: Bảng nhân sự theo mã ngạch đối chiếu bảng lương
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

-- 2.14. can_cu_goi_y: Ô màu cam điền sẵn gợi ý & căn cứ tham khảo (Composite PK)
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

-- 2.15. ra_soat_chua_du_can_cu: Ánh xạ với trang tính Chua_du_can_cu (Identity PK)
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

-- ------------------------------------------------------------------------------
-- PHẦN 3: TẠO CÁC BẢNG RBAC, TICKETS, COORDINATED TASKS & WORKBOOKS
-- ------------------------------------------------------------------------------

-- 3.1. user_accounts: Danh mục tài khoản người dùng & phân quyền RBAC
CREATE TABLE IF NOT EXISTS public.user_accounts (
  email VARCHAR(255) PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE RESTRICT,
  unit_name_vi VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'unit_leader', 'staff')),
  title VARCHAR(100) NOT NULL,
  auth_provider VARCHAR(50) NOT NULL DEFAULT 'email' CHECK (auth_provider IN ('google', 'email')),
  avatar_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  has_selected_unit BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Xử lý trường hợp bảng đã tồn tại một phần: bổ sung cột an toàn (không NOT NULL khi chưa backfill)
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS unit_code VARCHAR(50) REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE RESTRICT;
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS unit_name_vi VARCHAR(255);
ALTER TABLE public.user_accounts ALTER COLUMN unit_name_vi DROP DEFAULT;
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS has_selected_unit BOOLEAN DEFAULT FALSE;
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Cập nhật chuẩn hóa unit_name_vi từ dm_don_vi cho các dòng đã tồn tại
UPDATE public.user_accounts u
SET unit_name_vi = d.ten_don_vi_vi
FROM public.dm_don_vi d
WHERE u.unit_code = d.ma_don_vi;

-- Chuẩn hóa role editor/viewer -> staff
UPDATE public.user_accounts SET role = 'staff' WHERE role IN ('editor', 'viewer');

-- Nâng cấp check constraint role an toàn có guard
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_accounts_role_check') THEN
    ALTER TABLE public.user_accounts DROP CONSTRAINT user_accounts_role_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_accounts_role_check') THEN
    ALTER TABLE public.user_accounts ADD CONSTRAINT user_accounts_role_check CHECK (role IN ('admin', 'unit_leader', 'staff'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_accounts_unit ON public.user_accounts(unit_code);
CREATE INDEX IF NOT EXISTS idx_user_accounts_role ON public.user_accounts(role);
CREATE INDEX IF NOT EXISTS idx_user_accounts_status ON public.user_accounts(status);

-- 3.2. staff_work_tickets: Phiếu công việc cá nhân liên thông A1-A2-B1-C1
CREATE TABLE IF NOT EXISTS public.staff_work_tickets (
  id VARCHAR(100) PRIMARY KEY,
  unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  owner_email VARCHAR(255) NOT NULL REFERENCES public.user_accounts(email) ON DELETE CASCADE,
  owner_name VARCHAR(255) NOT NULL,
  owner_title VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'Nháp' CHECK (status IN ('Nháp', 'Đã nộp')),
  ma_nhiem_vu VARCHAR(50) NOT NULL,
  ma_cong_viec VARCHAR(100) NOT NULL,
  ten_cong_viec TEXT NOT NULL,
  ma_vtvl VARCHAR(50) NOT NULL,
  ma_vtvl_phoi_hop VARCHAR(50) DEFAULT '',
  san_pham TEXT DEFAULT '',
  chat_luong TEXT DEFAULT '',
  can_cu TEXT DEFAULT '',
  so_sp_nam NUMERIC NOT NULL DEFAULT 0,
  nguon_so_lieu TEXT DEFAULT '',
  phut_thuc_te NUMERIC NOT NULL DEFAULT 0,
  gio_bo_sung NUMERIC NOT NULL DEFAULT 0,
  coordinated_tasks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_staff_ticket_unit_task UNIQUE (unit_code, ma_cong_viec)
);

ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS unit_code VARCHAR(50);
ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS coordinated_tasks JSONB DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_staff_ticket_unit_task'
  ) THEN
    ALTER TABLE public.staff_work_tickets
      ADD CONSTRAINT uq_staff_ticket_unit_task UNIQUE (unit_code, ma_cong_viec);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_tickets_owner ON public.staff_work_tickets(owner_email);
CREATE INDEX IF NOT EXISTS idx_staff_tickets_unit ON public.staff_work_tickets(unit_code);
CREATE INDEX IF NOT EXISTS idx_staff_tickets_status ON public.staff_work_tickets(status);
CREATE INDEX IF NOT EXISTS idx_staff_tickets_task ON public.staff_work_tickets(ma_cong_viec);

-- 3.3. coordinated_tasks: Công việc phối hợp liên đơn vị (khớp 20261114_add_rbac_and_tickets.sql)
CREATE TABLE IF NOT EXISTS public.coordinated_tasks (
  id VARCHAR(100) PRIMARY KEY,
  ticket_id VARCHAR(100) NOT NULL REFERENCES public.staff_work_tickets(id) ON DELETE CASCADE,
  unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  target_unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
  target_task_code VARCHAR(100),
  target_task_name TEXT,
  role_in_task VARCHAR(100),
  estimated_hours NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.coordinated_tasks ADD COLUMN IF NOT EXISTS target_task_name TEXT;
ALTER TABLE public.coordinated_tasks ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_coord_ticket ON public.coordinated_tasks(ticket_id);
CREATE INDEX IF NOT EXISTS idx_coord_units ON public.coordinated_tasks(unit_code, target_unit_code);

-- 3.4. workbooks: Quản lý hồ sơ dữ liệu 15 biểu trực tuyến (tương thích 20261110)
CREATE TABLE IF NOT EXISTS public.workbooks (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE RESTRICT,
  reporting_period TEXT NOT NULL DEFAULT '01/10/2025–30/9/2026',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved', 'archived')),
  current_revision INT NOT NULL DEFAULT 1 CHECK (current_revision >= 1),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  touched_cells JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_session TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_session TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.workbooks ADD COLUMN IF NOT EXISTS created_by_session TEXT;
ALTER TABLE public.workbooks ADD COLUMN IF NOT EXISTS updated_by_session TEXT;
ALTER TABLE public.workbooks ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_workbooks_unit_period'
  ) THEN
    ALTER TABLE public.workbooks
      ADD CONSTRAINT uq_workbooks_unit_period UNIQUE (unit_id, reporting_period);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workbooks_unit_period ON public.workbooks(unit_id, reporting_period);
CREATE INDEX IF NOT EXISTS idx_workbooks_updated_at ON public.workbooks(updated_at DESC);

-- 3.5. workbook_sessions: Quản lý phiên làm việc cộng tác trực tiếp (tương thích 20261110)
CREATE TABLE IF NOT EXISTS public.workbook_sessions (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  access_scope TEXT NOT NULL DEFAULT 'editor' CHECK (access_scope IN ('editor', 'viewer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  revoked_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workbook_sessions_wb ON public.workbook_sessions(workbook_id);
CREATE INDEX IF NOT EXISTS idx_workbook_sessions_active ON public.workbook_sessions(last_active_at DESC);

-- 3.6. session_participants: Danh sách cán bộ tham gia phiên (tương thích 20261110)
CREATE TABLE IF NOT EXISTS public.session_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES public.workbook_sessions(id) ON DELETE CASCADE,
  workbook_id TEXT NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  role_label TEXT NOT NULL DEFAULT 'Chuyên viên',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participants_email_norm ON public.session_participants(email_normalized);
CREATE INDEX IF NOT EXISTS idx_participants_wb ON public.session_participants(workbook_id);

-- 3.7. workbook_revisions: Lịch sử từng lần ghi snapshot và commit (tương thích 20261110)
CREATE TABLE IF NOT EXISTS public.workbook_revisions (
  id TEXT PRIMARY KEY,
  workbook_id TEXT NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  revision INT NOT NULL,
  data JSONB NOT NULL,
  checksum TEXT,
  actor_email TEXT NOT NULL,
  actor_title TEXT,
  session_id TEXT,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_workbook_revisions_wb_rev'
  ) THEN
    ALTER TABLE public.workbook_revisions
      ADD CONSTRAINT uq_workbook_revisions_wb_rev UNIQUE (workbook_id, revision);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_revisions_wb_rev ON public.workbook_revisions(workbook_id, revision DESC);

-- 3.8. audit_logs: Nhật ký kiểm toán bảo mật append-only (tương thích 20261110)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  workbook_id TEXT,
  session_id TEXT,
  actor_email TEXT,
  action TEXT NOT NULL,
  sheet_id TEXT,
  record_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_wb ON public.audit_logs(workbook_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- PHẦN 4: BACKFILL DỮ LIỆU TỪ T_TIEN_DO SANG USER_ACCOUNTS & WORKBOOKS
-- ------------------------------------------------------------------------------

-- 4.1. Backfill user_accounts từ t_tien_do (hỗ trợ camelCase JSON cũ, passwordHash & unit_name_vi)
DO $$
DECLARE
  v_inserted INT := 0;
  v_skipped INT := 0;
  r RECORD;
  v_mapped_unit TEXT;
  v_unit_name_vi TEXT;
  v_unit_exists BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 't_tien_do') THEN
    FOR r IN
      SELECT
        LOWER(TRIM(acc.email)) AS email,
        COALESCE(acc."displayName", acc.display_name) AS display_name,
        UPPER(TRIM(COALESCE(acc."unitCode", acc.unit_code))) AS raw_unit_code,
        COALESCE(acc.title, 'Chuyên viên') AS title,
        COALESCE(acc.role, 'staff') AS role,
        COALESCE(acc."authProvider", acc.auth_provider, 'google') AS auth_provider,
        COALESCE(acc."avatarUrl", acc.avatar_url) AS avatar_url,
        COALESCE(acc.status, 'active') AS status,
        COALESCE(acc."hasSelectedUnit", acc.has_selected_unit, FALSE) AS has_selected_unit,
        COALESCE(acc."passwordHash", acc.password_hash) AS password_hash
      FROM public.t_tien_do t,
      jsonb_to_recordset(t.du_lieu_ho_so_json->'userAccounts') AS acc(
        email TEXT,
        "displayName" TEXT,
        display_name TEXT,
        "unitCode" TEXT,
        unit_code TEXT,
        title TEXT,
        role TEXT,
        "authProvider" TEXT,
        auth_provider TEXT,
        "avatarUrl" TEXT,
        avatar_url TEXT,
        status TEXT,
        "hasSelectedUnit" BOOLEAN,
        has_selected_unit BOOLEAN,
        "passwordHash" TEXT,
        password_hash TEXT
      )
      WHERE t.ma_don_vi = 'TCNS'
        AND t.du_lieu_ho_so_json ? 'userAccounts'
        AND acc.email IS NOT NULL
        AND acc.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    LOOP
      -- Map CK -> FME nếu đơn vị FME tồn tại
      v_mapped_unit := r.raw_unit_code;
      IF v_mapped_unit = 'CK' AND EXISTS (SELECT 1 FROM public.dm_don_vi WHERE ma_don_vi = 'FME') THEN
        v_mapped_unit := 'FME';
      END IF;

      -- Lấy tên đơn vị tiếng Việt chính thức từ dm_don_vi
      SELECT EXISTS (SELECT 1 FROM public.dm_don_vi WHERE ma_don_vi = v_mapped_unit),
             COALESCE((SELECT ten_don_vi_vi FROM public.dm_don_vi WHERE ma_don_vi = v_mapped_unit LIMIT 1), 'Đơn vị HCM-UTE')
      INTO v_unit_exists, v_unit_name_vi;

      IF r.email = 'tcns@hcmute.edu.vn' THEN
        INSERT INTO public.user_accounts (
          email, unit_code, unit_name_vi, display_name, role, title, auth_provider, avatar_url, status, has_selected_unit, password_hash
        ) VALUES (
          r.email, 'TCNS',
          COALESCE((SELECT ten_don_vi_vi FROM public.dm_don_vi WHERE ma_don_vi = 'TCNS' LIMIT 1), 'Phòng Tổ chức – Nhân sự'),
          COALESCE(r.display_name, 'Phòng Tổ chức – Nhân sự'), 'admin',
          COALESCE(r.title, 'Quản trị viên'), COALESCE(r.auth_provider, 'email'),
          r.avatar_url, 'active', TRUE, r.password_hash
        )
        ON CONFLICT (email) DO UPDATE SET
          role = 'admin',
          unit_code = 'TCNS',
          unit_name_vi = EXCLUDED.unit_name_vi,
          status = 'active',
          password_hash = COALESCE(public.user_accounts.password_hash, EXCLUDED.password_hash);
        v_inserted := v_inserted + 1;
      ELSIF v_unit_exists THEN
        INSERT INTO public.user_accounts (
          email, unit_code, unit_name_vi, display_name, role, title, auth_provider, avatar_url, status, has_selected_unit, password_hash
        ) VALUES (
          r.email,
          v_mapped_unit,
          v_unit_name_vi,
          COALESCE(r.display_name, split_part(r.email, '@', 1)),
          CASE WHEN r.role IN ('admin', 'unit_leader') THEN r.role ELSE 'staff' END,
          COALESCE(r.title, 'Chuyên viên'),
          COALESCE(r.auth_provider, 'google'),
          r.avatar_url,
          COALESCE(r.status, 'active'),
          COALESCE(r.has_selected_unit, FALSE),
          r.password_hash
        )
        ON CONFLICT (email) DO UPDATE SET
          unit_name_vi = EXCLUDED.unit_name_vi,
          password_hash = COALESCE(public.user_accounts.password_hash, EXCLUDED.password_hash);
        v_inserted := v_inserted + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END LOOP;

    IF v_skipped > 0 THEN
      RAISE WARNING 'Backfill user_accounts: Bỏ qua % tài khoản do unit_code không tồn tại trong dm_don_vi.', v_skipped;
    END IF;
  END IF;

  -- Bảo đảm luôn tồn tại tài khoản quản trị viên gốc tcns@hcmute.edu.vn
  INSERT INTO public.user_accounts (
    email, display_name, unit_code, unit_name_vi, role, title, auth_provider, status, has_selected_unit, created_at, last_active_at
  )
  VALUES (
    'tcns@hcmute.edu.vn', 'Phòng Tổ chức – Nhân sự', 'TCNS',
    COALESCE((SELECT ten_don_vi_vi FROM public.dm_don_vi WHERE ma_don_vi = 'TCNS' LIMIT 1), 'Phòng Tổ chức – Nhân sự'),
    'admin', 'Phòng Tổ chức – Nhân sự', 'email', 'active', TRUE, NOW(), NOW()
  )
  ON CONFLICT (email) DO NOTHING;
END $$;

-- 4.2. Backfill workbooks từ t_tien_do có serverWorkbook hoặc data
DO $$
BEGIN
  INSERT INTO public.workbooks (
    id, unit_id, reporting_period, status, current_revision, data, touched_cells, created_at, updated_at
  )
  SELECT
    COALESCE(du_lieu_ho_so_json->'serverWorkbook'->>'id', 'wb_' || ma_don_vi || '_2026'),
    ma_don_vi,
    '01/10/2025–30/9/2026',
    COALESCE(du_lieu_ho_so_json->'serverWorkbook'->>'status', 'draft'),
    COALESCE(NULLIF((du_lieu_ho_so_json->'serverWorkbook'->>'currentRevision'), '')::INT, 1),
    COALESCE(du_lieu_ho_so_json->'serverWorkbook'->'data', du_lieu_ho_so_json->'data', '{}'::jsonb),
    COALESCE(du_lieu_ho_so_json->'serverWorkbook'->'touchedCells', '[]'::jsonb),
    COALESCE(t.updated_at, NOW()),
    COALESCE(t.updated_at, NOW())
  FROM public.t_tien_do t
  WHERE du_lieu_ho_so_json IS NOT NULL
    AND (du_lieu_ho_so_json ? 'serverWorkbook' OR du_lieu_ho_so_json ? 'data')
  ON CONFLICT (unit_id, reporting_period) DO NOTHING;
END $$;

-- ------------------------------------------------------------------------------
-- PHẦN 5: HÀM TIỆN ÍCH PHÂN QUYỀN RLS (SECURITY DEFINER CHUẨN)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_auth_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT LOWER(COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    auth.jwt() ->> 'email',
    ''
  ));
$$;

REVOKE EXECUTE ON FUNCTION public.current_auth_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_auth_email() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_tcns_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    public.current_auth_email() = 'tcns@hcmute.edu.vn'
    OR EXISTS (
      SELECT 1 FROM public.user_accounts
      WHERE email = public.current_auth_email()
        AND role = 'admin'
        AND status = 'active'
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_tcns_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_tcns_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_auth_unit()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT unit_code FROM public.user_accounts WHERE email = public.current_auth_email() LIMIT 1),
    ''
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_auth_unit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_unit() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_accounts WHERE email = public.current_auth_email() LIMIT 1),
    'staff'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_write_unit_data(p_unit_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    public.is_tcns_admin()
    OR (
      p_unit_code = public.get_auth_unit()
      AND public.get_auth_role() = 'unit_leader'
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_write_unit_data(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_unit_data(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- PHẦN 6: SIẾT CHẶT TOÀN DIỆN ROW LEVEL SECURITY (RLS) & DỌN DẸP POLICIES QUA PG_POLICIES
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  master_tables text[] := ARRAY['dm_don_vi', 'dm_chuc_danh_tt31', 'dm_vtvl_khung_truong', 'dm_san_pham'];
  business_tables text[] := ARRAY[
    'user_accounts', 'staff_work_tickets', 'coordinated_tasks',
    'workbooks', 'workbook_sessions', 'session_participants', 'workbook_revisions',
    't_tien_do', 's_nhat_ky', 'audit_logs',
    'a1_nhiem_vu', 'a2_cong_viec', 'b1_khoi_luong', 'b2_ct_tac_dong', 'b2_thay_doi',
    'c1_vtvl', 'c2_nang_luc', 'c3_nhu_cau', 'd1_nhan_luc', 'du_bao_5_nam', 'd2_phuong_an',
    'k_kiem_tra', 'sldv_quy_mo_don_vi', 'sldv_phan_bo_ngach', 'can_cu_goi_y', 'ra_soat_chua_du_can_cu'
  ];
  tbl text;
  pol record;
BEGIN
  -- 6.1. Bật RLS và dọn dẹp TOÀN BỘ policy cũ cho 4 master catalogs
  FOREACH tbl IN ARRAY master_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', tbl);
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated;', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role;', tbl);

      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
      END LOOP;

      EXECUTE format('CREATE POLICY "master_catalog_read" ON public.%I FOR SELECT TO anon, authenticated USING (true);', tbl);
      EXECUTE format('CREATE POLICY "service_role_all_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', tbl, tbl);
    END IF;
  END LOOP;

  -- 6.2. Bật RLS, REVOKE ALL anon và authenticated, dọn dẹp TOÀN BỘ policy cũ cho 26 business tables
  FOREACH tbl IN ARRAY business_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role;', tbl);

      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
      END LOOP;

      EXECUTE format('CREATE POLICY "service_role_full_%s" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', tbl, tbl);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- PHẦN 7: CẤP QUYỀN CHỌN LỌC THEO CỘT VÀ THIẾT LẬP POLICIES AN TOÀN
-- ------------------------------------------------------------------------------

-- (A) Bảng user_accounts:
-- TUYỆT ĐỐI KHÔNG CẤP TOÀN BẢNG. Chỉ GRANT SELECT theo danh sách cột an toàn, loại trừ password_hash.
GRANT SELECT (email, display_name, unit_code, unit_name_vi, title, role, auth_provider, avatar_url, status, has_selected_unit, created_at, last_active_at)
  ON public.user_accounts TO authenticated;

-- Chỉ cho phép cập nhật display_name và avatar_url qua client auth
GRANT UPDATE (display_name, avatar_url) ON public.user_accounts TO authenticated;

-- Policy SELECT: Chỉ admin hoặc chính chủ xem được thông tin tài khoản (KHÔNG USING true)
CREATE POLICY "user_accounts_select_auth" ON public.user_accounts
  FOR SELECT TO authenticated
  USING (
    public.is_tcns_admin()
    OR email = public.current_auth_email()
  );

-- Policy UPDATE: Tự sửa thông tin của chính mình (chỉ cập nhật display_name/avatar_url do column-level grant)
CREATE POLICY "user_accounts_self_update" ON public.user_accounts
  FOR UPDATE TO authenticated
  USING (email = public.current_auth_email())
  WITH CHECK (email = public.current_auth_email());

-- (B) Bảng staff_work_tickets:
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_work_tickets TO authenticated;

-- SELECT: Admin, chủ sở hữu, hoặc nếu cùng đơn vị thì unit_leader xem hết, còn staff khác CHỈ xem vé 'Đã nộp'
CREATE POLICY "staff_tickets_select_auth" ON public.staff_work_tickets
  FOR SELECT TO authenticated
  USING (
    public.is_tcns_admin()
    OR owner_email = public.current_auth_email()
    OR (
      unit_code = public.get_auth_unit()
      AND (public.get_auth_role() = 'unit_leader' OR status = 'Đã nộp')
    )
  );

CREATE POLICY "staff_tickets_insert_auth" ON public.staff_work_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tcns_admin()
    OR (
      unit_code = public.get_auth_unit()
      AND owner_email = public.current_auth_email()
    )
  );

CREATE POLICY "staff_tickets_update_auth" ON public.staff_work_tickets
  FOR UPDATE TO authenticated
  USING (
    public.is_tcns_admin()
    OR (
      unit_code = public.get_auth_unit()
      AND owner_email = public.current_auth_email()
    )
  )
  WITH CHECK (
    public.is_tcns_admin()
    OR (
      unit_code = public.get_auth_unit()
      AND owner_email = public.current_auth_email()
    )
  );

CREATE POLICY "staff_tickets_delete_auth" ON public.staff_work_tickets
  FOR DELETE TO authenticated
  USING (
    public.is_tcns_admin()
    OR (
      unit_code = public.get_auth_unit()
      AND owner_email = public.current_auth_email()
    )
  );

-- (C) Bảng workbooks:
GRANT SELECT, INSERT, UPDATE ON public.workbooks TO authenticated;

-- Staff xem cùng đơn vị; Admin xem toàn bộ
CREATE POLICY "workbooks_select_auth" ON public.workbooks
  FOR SELECT TO authenticated
  USING (
    public.is_tcns_admin()
    OR (unit_id = public.get_auth_unit() AND is_deleted = false)
  );

-- Ghi workbook: Chỉ Admin hoặc Lãnh đạo đơn vị (unit_leader) của đơn vị đó
CREATE POLICY "workbooks_insert_auth" ON public.workbooks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_write_unit_data(unit_id)
  );

CREATE POLICY "workbooks_update_auth" ON public.workbooks
  FOR UPDATE TO authenticated
  USING (
    public.can_write_unit_data(unit_id)
  )
  WITH CHECK (
    public.can_write_unit_data(unit_id)
  );

-- ------------------------------------------------------------------------------
-- PHẦN 8: KIỂM TOÁN TỰ ĐỘNG XÁC NHẬN ĐỦ 30 BẢNG SAU KHI RECONCILE
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  v_table_count INT;
  v_missing_tables TEXT := '';
  expected_tables text[] := ARRAY[
    'dm_don_vi', 'dm_chuc_danh_tt31', 'dm_vtvl_khung_truong', 'dm_san_pham',
    'c1_vtvl', 't_tien_do', 's_nhat_ky',
    'user_accounts', 'staff_work_tickets', 'coordinated_tasks',
    'workbooks', 'workbook_sessions', 'session_participants', 'workbook_revisions',
    'audit_logs', 'a1_nhiem_vu', 'a2_cong_viec', 'b1_khoi_luong', 'b2_ct_tac_dong',
    'b2_thay_doi', 'c2_nang_luc', 'c3_nhu_cau', 'd1_nhan_luc', 'du_bao_5_nam',
    'd2_phuong_an', 'k_kiem_tra', 'sldv_quy_mo_don_vi', 'sldv_phan_bo_ngach',
    'can_cu_goi_y', 'ra_soat_chua_du_can_cu'
  ];
  t text;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = ANY(expected_tables);

  FOREACH t IN ARRAY expected_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      v_missing_tables := v_missing_tables || ' ' || t;
    END IF;
  END LOOP;

  IF v_table_count < 30 THEN
    RAISE EXCEPTION 'RECONCILIATION CHƯA ĐỦ: Chỉ có %/30 bảng. Các bảng thiếu:%', v_table_count, v_missing_tables;
  ELSE
    RAISE NOTICE 'RECONCILIATION THÀNH CÔNG: Đủ 30/30 bảng CSDL theo chuẩn VTVL 360 & Hướng dẫn 07-HD/BTCTW.';
  END IF;
END $$;

COMMIT;
