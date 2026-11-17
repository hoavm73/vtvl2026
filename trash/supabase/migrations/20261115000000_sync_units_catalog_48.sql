-- =============================================================================
-- MIGRATION: 20261115000000_sync_units_catalog_48.sql
-- Hệ thống: HCM-UTE VTVL 360 & S-Link (Trường ĐH Công nghệ Kỹ thuật TP.HCM)
-- Mục đích: Đồng bộ danh mục 48 đơn vị chính thức theo DS Don vi.xlsx (Sheet1)
--           Áp dụng an toàn trong Transaction, vô hiệu hóa/tái lập FK & triggers ĐỘNG
--           Lưu snapshot định nghĩa FK và trigger trước khi drop, phục hồi 100% sau đó
--           Cập nhật có cấu trúc các khóa định danh tiền tố: ma_vtvl, ma_nhiem_vu,
--           ma_cong_viec, ma_nguon_luc, workbook id và FK liên quan (không thay thế mù)
--           Cập nhật user_accounts.unit_name_vi, chèn TCKHGDKT nếu thiếu, xóa 4 mã thừa
--           Cập nhật customUnits JSON trong t_tien_do (TCNS) đủ 48 đơn vị
--           Preflight & Postflight assertions để tự động ROLLBACK nếu có bất thường
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- BƯỚC 1. BẢNG TẠM MAPPING 36 MÃ CŨ -> MÃ MỚI
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE unit_code_map (
  old_code text PRIMARY KEY,
  new_code text NOT NULL,
  new_name_vi text NOT NULL,
  new_name_en text NOT NULL,
  new_group text NOT NULL,
  new_domain text NOT NULL,
  head_vi text NOT NULL,
  head_en text NOT NULL,
  default_staff int NOT NULL
) ON COMMIT DROP;

INSERT INTO unit_code_map (old_code, new_code, new_name_vi, new_name_en, new_group, new_domain, head_vi, head_en, default_staff) VALUES
  ('FME', 'CK', 'Khoa Cơ khí', 'Faculty of Mechanical Engineering', 'khoa-vien', 'fme.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Mechanical Engineering', 78),
  ('FEET', 'GTNL', 'Khoa Giao thông năng lượng', 'Faculty of Vehicle and Energy Engineering', 'khoa-vien', 'feet.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Vehicle and Energy Engineering', 64),
  ('FEEE', 'DDT', 'Khoa Điện - Điện tử', 'Faculty of Electrical and Electronics Engineering', 'khoa-vien', 'feee.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Electrical and Electronics Engineering', 82),
  ('FIT', 'CNTT', 'Khoa Công nghệ Thông tin', 'Faculty of Information Technology', 'khoa-vien', 'fit.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Information Technology', 68),
  ('FCFT', 'HHKHSS', 'Khoa Hoá học và khoa học sự sống', 'Faculty of Chemical and Food Technology', 'khoa-vien', 'fcft.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Chemical and Food Technology', 46),
  ('FCE', 'XD', 'Khoa Xây dựng', 'Faculty of Civil Engineering', 'khoa-vien', 'fce.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Civil Engineering', 52),
  ('FE', 'KT', 'Khoa Kinh tế', 'Faculty of Economics', 'khoa-vien', 'fe.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Economics', 54),
  ('FAE', 'DTTT', 'Khoa Đào tạo Tiên tiến', 'Faculty of Advanced Education', 'khoa-vien', 'fae.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Advanced Education', 38),
  ('FGAM', 'MTTT', 'Khoa Mỹ thuật và Truyền thông', 'Faculty of Graphic Arts and Media', 'khoa-vien', 'fgam.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Graphic Arts and Media', 48),
  ('FPI', 'CTL', 'Khoa Chính trị và Luật', 'Faculty of Political Theory and Law', 'khoa-vien', 'fpi.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Political Theory and Law', 36),
  ('FAS', 'KHUD', 'Khoa Khoa học Ứng dụng', 'Faculty of Applied Sciences', 'khoa-vien', 'fas.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Applied Sciences', 44),
  ('FFL', 'NN', 'Khoa Ngoại ngữ', 'Faculty of Foreign Languages', 'khoa-vien', 'ffl.hcmute.edu.vn', 'Trưởng khoa', 'Dean of the Faculty of Foreign Languages', 42),
  ('ITE', 'VSPKT', 'Viện Sư phạm Kỹ thuật', 'Institute of Technical Education', 'khoa-vien', 'ite.hcmute.edu.vn', 'Viện trưởng', 'Director of the Institute of Technical Education', 30),
  ('IIE', 'VDTQT', 'Viện Đào tạo quốc tế', 'Institute of International Education', 'khoa-vien', 'iie.hcmute.edu.vn', 'Viện trưởng', 'Director of the Institute of International Education', 28),
  ('BMC', 'QTTHTT', 'Phòng Quản trị thương hiệu và Truyền thông', 'Office of Brand Management and Communications', 'phong-ban', 'bmc.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Office of Brand Management and Communications', 18),
  ('AAO', 'DT', 'Phòng Đào tạo', 'Academic Affairs Office', 'phong-ban', 'aao.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Academic Affairs Office', 26),
  ('OIA', 'QHQT', 'Phòng Quan hệ Quốc tế', 'International Affairs Office', 'phong-ban', 'oia.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Office of International Affairs', 12),
  ('ERO', 'QHDN', 'Phòng Quan hệ Doanh nghiệp', 'Enterprise Relations Office', 'phong-ban', 'pr.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Enterprise Relations Office', 12),
  ('FPO', 'KHTC', 'Phòng Kế hoạch Tài chính', 'Finance and Planning Office', 'phong-ban', 'fpo.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Finance and Planning Office', 22),
  ('STIAO', 'KHCN', 'Phòng Khoa học Công nghệ', 'Office of Science and Technology', 'phong-ban', 'stiao.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Office of Science and Technology', 14),
  ('OGA', 'HCTH', 'Phòng Hành chính - Tổng hợp', 'Office of General Administration', 'phong-ban', 'uteoffice.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Office of General Administration', 28),
  ('SAO', 'CTSV', 'Phòng Công tác Sinh viên', 'Office of Student Affairs', 'phong-ban', 'sao.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Office of Student Affairs', 20),
  ('QAO', 'KTDBCL', 'Phòng Khảo thí và Đảm bảo Chất lượng', 'Office of Testing and Quality Assurance', 'phong-ban', 'qao.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Office of Testing and Quality Assurance', 16),
  ('EMO', 'QTCSVC', 'Phòng Quản trị cơ sở vật chất', 'Office of Facilities Management', 'phong-ban', 'emo.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Office of Facilities Management', 32),
  ('CPM', 'QLDTXDDT', 'Phòng Quản lý đầu tư xây dựng và Đấu thầu', 'Office of Construction Project Management and Bidding', 'phong-ban', 'cpm.hcmute.edu.vn', 'Trưởng phòng', 'Director of the Office of Construction Project Management and Bidding', 14),
  ('CISAT', 'STKNCCCN', 'Trung tâm Sáng tạo, Khởi nghiệp và Chuyển giao công nghệ', 'Center of Innovation, Startup and Technology Transfer', 'trung-tam', 'cisat.hcmute.edu.vn', 'Giám đốc trung tâm', 'Director of the Center of Innovation, Startup and Technology Transfer', 14),
  ('INC', 'TTTTMT', 'Trung tâm Thông tin - Máy tính', 'Information and Computer Center', 'trung-tam', 'inc.hcmute.edu.vn', 'Giám đốc trung tâm', 'Director of the Information and Computer Center', 16),
  ('ITC', 'TTCNTT', 'Trung tâm Công nghệ thông tin', 'Information Technology Center', 'trung-tam', 'itc.hcmute.edu.vn', 'Giám đốc trung tâm', 'Director of the Information Technology Center', 14),
  ('STC', 'CNPM', 'Trung tâm Công nghệ phần mềm', 'Software Technology Center', 'trung-tam', 'stc.hcmute.edu.vn', 'Giám đốc trung tâm', 'Director of the Software Technology Center', 12),
  ('TPC', 'THKTTH', 'Trường Trung học Kỹ thuật thực hành', 'Technical Practice College', 'trung-tam', 'tpc.hcmute.edu.vn', 'Hiệu trưởng', 'Principal of the Technical Practice College', 24),
  ('CFL', 'TTNN', 'Trung tâm Ngoại ngữ', 'Center for Foreign Languages', 'trung-tam', 'cfl.hcmute.edu.vn', 'Giám đốc trung tâm', 'Director of the Center for Foreign Languages', 15),
  ('VGC', 'TTVD', 'Trung tâm Việt Đức', 'Vietnam - Germany Center', 'trung-tam', 'vgc.hcmute.edu.vn', 'Giám đốc trung tâm', 'Director of the Vietnam - Germany Center', 12),
  ('SRC', 'TTRBTM', 'Trung tâm Robot thông minh', 'Smart Robotic Center', 'trung-tam', 'src.hcmute.edu.vn', 'Giám đốc trung tâm', 'Director of the Smart Robotic Center', 10),
  ('ESC', 'TTKTTH', 'Trung tâm Kỹ thuật tổng hợp', 'Engineering Synthesis Center', 'trung-tam', 'esc.hcmute.edu.vn', 'Giám đốc trung tâm', 'Director of the Engineering Synthesis Center', 12),
  ('EETC', 'KTCNMT', 'Trung tâm Kỹ thuật và Công nghệ môi trường', 'Environmental Engineering and Technology Center', 'trung-tam', 'eetc.hcmute.edu.vn', 'Giám đốc trung tâm', 'Director of the Environmental Engineering and Technology Center', 10),
  ('CERAC', 'NCUDKTXD', 'Trung tâm Nghiên cứu và Ứng dụng kỹ thuật xây dựng', 'Civil Engineering Research and Application Center', 'trung-tam', 'cerac.hcmute.edu.vn', 'Giám đốc trung tâm', 'Director of the Civil Engineering Research and Application Center', 10);

-- -----------------------------------------------------------------------------
-- BƯỚC 2. PREFLIGHT ASSERTIONS & SNAPSHOT SỐ DÒNG CÁC BẢNG TRƯỚC MIGRATION
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE temp_row_counts_pre (
  table_name text PRIMARY KEY,
  row_count bigint
) ON COMMIT DROP;

DO $$
DECLARE
  v_ref_count int := 0;
  v_collision_count int := 0;
  t text;
  v_cnt bigint;
  tables text[] := ARRAY[
    'dm_don_vi', 'c1_vtvl', 'a1_nhiem_vu', 'a2_cong_viec', 'b1_khoi_luong',
    'b2_ct_tac_dong', 'b2_thay_doi', 'c2_nang_luc', 'c3_nhu_cau', 'd1_nhan_luc',
    'du_bao_5_nam', 'd2_phuong_an', 'k_kiem_tra', 't_tien_do', 's_nhat_ky',
    'sldv_quy_mo_don_vi', 'sldv_phan_bo_ngach', 'can_cu_goi_y', 'ra_soat_chua_du_can_cu',
    'workbooks', 'workbook_sessions', 'session_participants', 'workbook_revisions',
    'audit_logs', 'user_accounts', 'staff_work_tickets', 'coordinated_tasks'
  ];
BEGIN
  -- 2.1. Đảm bảo 4 mã thừa (IDDF, TRTC, HDT, BGH) không có tham chiếu dữ liệu trong schema
  SELECT count(*) INTO v_ref_count FROM (
    SELECT ma_don_vi FROM public.c1_vtvl WHERE ma_don_vi IN ('IDDF', 'TRTC', 'HDT', 'BGH')
    UNION ALL
    SELECT ma_don_vi FROM public.a1_nhiem_vu WHERE ma_don_vi IN ('IDDF', 'TRTC', 'HDT', 'BGH')
    UNION ALL
    SELECT ma_don_vi FROM public.a2_cong_viec WHERE ma_don_vi IN ('IDDF', 'TRTC', 'HDT', 'BGH')
    UNION ALL
    SELECT unit_id FROM public.workbooks WHERE unit_id IN ('IDDF', 'TRTC', 'HDT', 'BGH')
    UNION ALL
    SELECT unit_code FROM public.user_accounts WHERE unit_code IN ('IDDF', 'TRTC', 'HDT', 'BGH')
    UNION ALL
    SELECT unit_code FROM public.staff_work_tickets WHERE unit_code IN ('IDDF', 'TRTC', 'HDT', 'BGH')
    UNION ALL
    SELECT unit_code FROM public.coordinated_tasks WHERE unit_code IN ('IDDF', 'TRTC', 'HDT', 'BGH') OR target_unit_code IN ('IDDF', 'TRTC', 'HDT', 'BGH')
  ) sub;

  IF v_ref_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: Phát hiện % tham chiếu dữ liệu đến 4 mã thừa (IDDF, TRTC, HDT, BGH).', v_ref_count;
  END IF;

  -- 2.2. Kiểm tra xung đột dữ liệu: không cho phép mã mới đã có dữ liệu độc lập khác với mã cũ
  SELECT count(*) INTO v_collision_count
  FROM public.dm_don_vi d
  JOIN unit_code_map m ON d.ma_don_vi = m.new_code
  WHERE EXISTS (SELECT 1 FROM public.dm_don_vi WHERE ma_don_vi = m.old_code);

  IF v_collision_count > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT ABORT: Phát hiện % mã mới đã tồn tại đồng thời với mã cũ trong dm_don_vi.', v_collision_count;
  END IF;

  -- 2.3. Snapshot số dòng hiện tại của tất cả các bảng nghiệp vụ
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('SELECT count(*) FROM public.%I;', t) INTO v_cnt;
      INSERT INTO temp_row_counts_pre (table_name, row_count) VALUES (t, v_cnt);
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- BƯỚC 3. SNAPSHOT ĐỊNH NGHĨA FOREIGN KEYS & TRIGGERS VÀ TẠM DROP ĐỘNG
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE temp_fk_snapshot (
  child_schema text,
  child_table text,
  conname text,
  constraint_def text
) ON COMMIT DROP;

CREATE TEMP TABLE temp_trigger_snapshot (
  schema_name text,
  table_name text,
  trigger_name text,
  trigger_def text
) ON COMMIT DROP;

-- 3.1. Lưu snapshot chính xác tất cả FK trỏ đến các bảng có PK/tiền tố thay đổi
-- (dm_don_vi, c1_vtvl, a1_nhiem_vu, a2_cong_viec, workbooks)
INSERT INTO temp_fk_snapshot (child_schema, child_table, conname, constraint_def)
SELECT
  n.nspname AS child_schema,
  rel.relname AS child_table,
  c.conname,
  pg_get_constraintdef(c.oid, true) AS constraint_def
FROM pg_constraint c
JOIN pg_class rel ON rel.oid = c.conrelid
JOIN pg_namespace n ON n.oid = rel.relnamespace
JOIN pg_class parent_rel ON parent_rel.oid = c.confrelid
JOIN pg_namespace parent_n ON parent_n.oid = parent_rel.relnamespace
WHERE c.contype = 'f'
  AND n.nspname = 'public'
  AND parent_n.nspname = 'public'
  AND parent_rel.relname IN ('dm_don_vi', 'c1_vtvl', 'a1_nhiem_vu', 'a2_cong_viec', 'workbooks');

-- 3.2. Lưu snapshot chính xác các trigger kiểm soát tính nhất quán liên bảng
INSERT INTO temp_trigger_snapshot (schema_name, table_name, trigger_name, trigger_def)
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid, true) AS trigger_def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND n.nspname = 'public'
  AND (
    t.tgname IN ('trg_enforce_unit_consistency', 'trg_validate_c1_career_level')
    OR p.proname IN ('fn_enforce_unit_consistency', 'fn_validate_c1_career_level')
  );

-- 3.3. Tạm thời drop các trigger đã snapshot
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (SELECT * FROM temp_trigger_snapshot) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I;', rec.trigger_name, rec.schema_name, rec.table_name);
  END LOOP;
END $$;

-- 3.4. Tạm thời drop các foreign key đã snapshot
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN (SELECT * FROM temp_fk_snapshot) LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;', rec.child_schema, rec.child_table, rec.conname);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- BƯỚC 4. CẬP NHẬT DM_DON_VI & CHÈN TCKHGDKT NẾU THIẾU & XÓA 4 MÃ THỪA
-- -----------------------------------------------------------------------------
-- 4.1. Đảm bảo TCKHGDKT tồn tại
INSERT INTO public.dm_don_vi (
  ma_don_vi, ten_don_vi_vi, ten_don_vi_en, khoi_don_vi,
  chuc_danh_thu_truong_vi, chuc_danh_thu_truong_en, so_nhan_su_mac_dinh
) VALUES (
  'TCKHGDKT', 'Tạp chí Khoa học Giáo dục Kỹ thuật', 'Journal of Technical Education Science',
  'trung-tam', 'Tổng biên tập', 'Editor-in-Chief of the Journal of Technical Education Science', 8
) ON CONFLICT (ma_don_vi) DO UPDATE
SET ten_don_vi_vi = EXCLUDED.ten_don_vi_vi,
    ten_don_vi_en = EXCLUDED.ten_don_vi_en,
    khoi_don_vi = EXCLUDED.khoi_don_vi;

-- 4.2. Cập nhật 36 mã cũ sang mã mới trong dm_don_vi
UPDATE public.dm_don_vi d
SET ma_don_vi = m.new_code,
    ten_don_vi_vi = m.new_name_vi,
    ten_don_vi_en = m.new_name_en,
    khoi_don_vi = m.new_group,
    chuc_danh_thu_truong_vi = m.head_vi,
    chuc_danh_thu_truong_en = m.head_en,
    so_nhan_su_mac_dinh = m.default_staff
FROM unit_code_map m
WHERE d.ma_don_vi = m.old_code;

-- 4.3. Cập nhật tên tiếng Việt chuẩn hóa cho 12 mã giữ nguyên
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Viện Sau đại học' WHERE ma_don_vi = 'SDH';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Phòng Tổ chức - Nhân sự' WHERE ma_don_vi = 'TCNS';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Ban Quản lý Ký túc xá' WHERE ma_don_vi = 'KTX';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Trạm Y tế' WHERE ma_don_vi = 'TYT';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Phân hiệu Trường Đại học Công nghệ Kỹ thuật TP.HCM tại Bình Phước' WHERE ma_don_vi = 'PHBP';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Tạp chí Khoa học Giáo dục Kỹ thuật' WHERE ma_don_vi = 'TCKHGDKT';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Trung tâm Học liệu và Dạy học số' WHERE ma_don_vi = 'HLDHS';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Trung tâm Giáo dục Quốc phòng và An ninh' WHERE ma_don_vi = 'GDQPAN';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Trung tâm Giáo dục Thể chất' WHERE ma_don_vi = 'GDTC';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Văn phòng Đảng ủy' WHERE ma_don_vi = 'VPDU';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Công đoàn Trường' WHERE ma_don_vi = 'CDT';
UPDATE public.dm_don_vi SET ten_don_vi_vi = 'Đoàn Thanh niên - Hội Sinh viên' WHERE ma_don_vi = 'DTN';

-- 4.4. Xóa 4 mã không có trong Excel khỏi dm_don_vi
DELETE FROM public.dm_don_vi WHERE ma_don_vi IN ('IDDF', 'TRTC', 'HDT', 'BGH');

-- -----------------------------------------------------------------------------
-- BƯỚC 5. CHUYỂN ĐỔI CÓ CẤU TRÚC DỮ LIỆU CÁC BẢNG LIÊN QUAN TRONG SCHEMA
-- -----------------------------------------------------------------------------

-- 5.1. c1_vtvl (ma_don_vi, ma_vtvl)
UPDATE public.c1_vtvl t
SET ma_don_vi = m.new_code,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.2. a1_nhiem_vu (ma_don_vi, ma_nhiem_vu)
UPDATE public.a1_nhiem_vu t
SET ma_don_vi = m.new_code,
    ma_nhiem_vu = CASE
      WHEN left(t.ma_nhiem_vu, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_nhiem_vu, length(m.old_code) + 1)
      WHEN t.ma_nhiem_vu = m.old_code THEN m.new_code
      ELSE t.ma_nhiem_vu
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.3. a2_cong_viec (ma_don_vi, ma_nhiem_vu, ma_cong_viec, ma_vtvl)
UPDATE public.a2_cong_viec t
SET ma_don_vi = m.new_code,
    ma_nhiem_vu = CASE
      WHEN left(t.ma_nhiem_vu, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_nhiem_vu, length(m.old_code) + 1)
      WHEN t.ma_nhiem_vu = m.old_code THEN m.new_code
      ELSE t.ma_nhiem_vu
    END,
    ma_cong_viec = CASE
      WHEN left(t.ma_cong_viec, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_cong_viec, length(m.old_code) + 1)
      WHEN t.ma_cong_viec = m.old_code THEN m.new_code
      ELSE t.ma_cong_viec
    END,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.4. b1_khoi_luong (ma_don_vi, ma_cong_viec, ma_vtvl)
UPDATE public.b1_khoi_luong t
SET ma_don_vi = m.new_code,
    ma_cong_viec = CASE
      WHEN left(t.ma_cong_viec, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_cong_viec, length(m.old_code) + 1)
      WHEN t.ma_cong_viec = m.old_code THEN m.new_code
      ELSE t.ma_cong_viec
    END,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.5. b2_ct_tac_dong (ma_don_vi, ma_cong_viec, ma_vtvl)
UPDATE public.b2_ct_tac_dong t
SET ma_don_vi = m.new_code,
    ma_cong_viec = CASE
      WHEN left(t.ma_cong_viec, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_cong_viec, length(m.old_code) + 1)
      WHEN t.ma_cong_viec = m.old_code THEN m.new_code
      ELSE t.ma_cong_viec
    END,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.6. b2_thay_doi (ma_don_vi, ma_cong_viec, ma_vtvl)
UPDATE public.b2_thay_doi t
SET ma_don_vi = m.new_code,
    ma_cong_viec = CASE
      WHEN left(t.ma_cong_viec, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_cong_viec, length(m.old_code) + 1)
      WHEN t.ma_cong_viec = m.old_code THEN m.new_code
      ELSE t.ma_cong_viec
    END,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.7. c2_nang_luc (ma_don_vi, ma_vtvl)
UPDATE public.c2_nang_luc t
SET ma_don_vi = m.new_code,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.8. c3_nhu_cau (ma_don_vi, ma_vtvl)
UPDATE public.c3_nhu_cau t
SET ma_don_vi = m.new_code,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.9. d1_nhan_luc (ma_don_vi, ma_vtvl, ma_nguon_luc)
UPDATE public.d1_nhan_luc t
SET ma_don_vi = m.new_code,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END,
    ma_nguon_luc = CASE
      WHEN left(t.ma_nguon_luc, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_nguon_luc, length(m.old_code) + 1)
      WHEN t.ma_nguon_luc = m.old_code THEN m.new_code
      ELSE t.ma_nguon_luc
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.10. du_bao_5_nam (ma_don_vi, ma_vtvl)
UPDATE public.du_bao_5_nam t
SET ma_don_vi = m.new_code,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.11. d2_phuong_an (ma_don_vi, ma_vtvl)
UPDATE public.d2_phuong_an t
SET ma_don_vi = m.new_code,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.12. k_kiem_tra (ma_don_vi)
UPDATE public.k_kiem_tra t
SET ma_don_vi = m.new_code
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.13. t_tien_do (ma_don_vi, ten_don_vi)
UPDATE public.t_tien_do t
SET ma_don_vi = m.new_code,
    ten_don_vi = m.new_name_vi
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.14. s_nhat_ky (ma_don_vi, ten_don_vi)
UPDATE public.s_nhat_ky t
SET ma_don_vi = m.new_code,
    ten_don_vi = m.new_name_vi
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.15. sldv_quy_mo_don_vi (ma_don_vi)
UPDATE public.sldv_quy_mo_don_vi t
SET ma_don_vi = m.new_code
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.16. sldv_phan_bo_ngach (ma_don_vi, ma_vtvl_xep_vao)
UPDATE public.sldv_phan_bo_ngach t
SET ma_don_vi = m.new_code,
    ma_vtvl_xep_vao = CASE
      WHEN left(t.ma_vtvl_xep_vao, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl_xep_vao, length(m.old_code) + 1)
      WHEN t.ma_vtvl_xep_vao = m.old_code THEN m.new_code
      ELSE t.ma_vtvl_xep_vao
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.17. can_cu_goi_y (ma_don_vi, ma_cong_viec, ma_vtvl)
UPDATE public.can_cu_goi_y t
SET ma_don_vi = m.new_code,
    ma_cong_viec = CASE
      WHEN left(t.ma_cong_viec, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_cong_viec, length(m.old_code) + 1)
      WHEN t.ma_cong_viec = m.old_code THEN m.new_code
      ELSE t.ma_cong_viec
    END,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.18. ra_soat_chua_du_can_cu (ma_don_vi, ma_tham_chieu)
UPDATE public.ra_soat_chua_du_can_cu t
SET ma_don_vi = m.new_code,
    ma_tham_chieu = CASE
      WHEN left(t.ma_tham_chieu, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_tham_chieu, length(m.old_code) + 1)
      WHEN t.ma_tham_chieu = m.old_code THEN m.new_code
      ELSE t.ma_tham_chieu
    END
FROM unit_code_map m
WHERE t.ma_don_vi = m.old_code;

-- 5.19. workbooks (unit_id, id: wb_<old_code>_...)
UPDATE public.workbooks t
SET unit_id = m.new_code,
    id = CASE
      WHEN left(t.id, length('wb_' || m.old_code || '_')) = ('wb_' || m.old_code || '_')
        THEN 'wb_' || m.new_code || substr(t.id, length('wb_' || m.old_code) + 1)
      WHEN t.id = ('wb_' || m.old_code) THEN 'wb_' || m.new_code
      ELSE t.id
    END
FROM unit_code_map m
WHERE t.unit_id = m.old_code;

-- 5.20. workbook_sessions (workbook_id)
UPDATE public.workbook_sessions t
SET workbook_id = CASE
      WHEN left(t.workbook_id, length('wb_' || m.old_code || '_')) = ('wb_' || m.old_code || '_')
        THEN 'wb_' || m.new_code || substr(t.workbook_id, length('wb_' || m.old_code) + 1)
      WHEN t.workbook_id = ('wb_' || m.old_code) THEN 'wb_' || m.new_code
      ELSE t.workbook_id
    END
FROM unit_code_map m
WHERE left(t.workbook_id, length('wb_' || m.old_code || '_')) = ('wb_' || m.old_code || '_') OR t.workbook_id = ('wb_' || m.old_code);

-- 5.21. session_participants (workbook_id)
UPDATE public.session_participants t
SET workbook_id = CASE
      WHEN left(t.workbook_id, length('wb_' || m.old_code || '_')) = ('wb_' || m.old_code || '_')
        THEN 'wb_' || m.new_code || substr(t.workbook_id, length('wb_' || m.old_code) + 1)
      WHEN t.workbook_id = ('wb_' || m.old_code) THEN 'wb_' || m.new_code
      ELSE t.workbook_id
    END
FROM unit_code_map m
WHERE left(t.workbook_id, length('wb_' || m.old_code || '_')) = ('wb_' || m.old_code || '_') OR t.workbook_id = ('wb_' || m.old_code);

-- 5.22. workbook_revisions (workbook_id)
UPDATE public.workbook_revisions t
SET workbook_id = CASE
      WHEN left(t.workbook_id, length('wb_' || m.old_code || '_')) = ('wb_' || m.old_code || '_')
        THEN 'wb_' || m.new_code || substr(t.workbook_id, length('wb_' || m.old_code) + 1)
      WHEN t.workbook_id = ('wb_' || m.old_code) THEN 'wb_' || m.new_code
      ELSE t.workbook_id
    END
FROM unit_code_map m
WHERE left(t.workbook_id, length('wb_' || m.old_code || '_')) = ('wb_' || m.old_code || '_') OR t.workbook_id = ('wb_' || m.old_code);

-- 5.23. audit_logs (workbook_id)
UPDATE public.audit_logs t
SET workbook_id = CASE
      WHEN left(t.workbook_id, length('wb_' || m.old_code || '_')) = ('wb_' || m.old_code || '_')
        THEN 'wb_' || m.new_code || substr(t.workbook_id, length('wb_' || m.old_code) + 1)
      WHEN t.workbook_id = ('wb_' || m.old_code) THEN 'wb_' || m.new_code
      ELSE t.workbook_id
    END
FROM unit_code_map m
WHERE left(t.workbook_id, length('wb_' || m.old_code || '_')) = ('wb_' || m.old_code || '_') OR t.workbook_id = ('wb_' || m.old_code);

-- 5.24. staff_work_tickets (unit_code, ma_nhiem_vu, ma_cong_viec, ma_vtvl)
UPDATE public.staff_work_tickets t
SET unit_code = m.new_code,
    ma_nhiem_vu = CASE
      WHEN left(t.ma_nhiem_vu, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_nhiem_vu, length(m.old_code) + 1)
      WHEN t.ma_nhiem_vu = m.old_code THEN m.new_code
      ELSE t.ma_nhiem_vu
    END,
    ma_cong_viec = CASE
      WHEN left(t.ma_cong_viec, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_cong_viec, length(m.old_code) + 1)
      WHEN t.ma_cong_viec = m.old_code THEN m.new_code
      ELSE t.ma_cong_viec
    END,
    ma_vtvl = CASE
      WHEN left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.ma_vtvl, length(m.old_code) + 1)
      WHEN t.ma_vtvl = m.old_code THEN m.new_code
      ELSE t.ma_vtvl
    END
FROM unit_code_map m
WHERE t.unit_code = m.old_code;

-- 5.25. coordinated_tasks (unit_code, target_unit_code, target_task_code)
UPDATE public.coordinated_tasks t
SET unit_code = m.new_code
FROM unit_code_map m
WHERE t.unit_code = m.old_code;

UPDATE public.coordinated_tasks t
SET target_unit_code = m.new_code,
    target_task_code = CASE
      WHEN left(t.target_task_code, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')
        THEN m.new_code || substr(t.target_task_code, length(m.old_code) + 1)
      WHEN t.target_task_code = m.old_code THEN m.new_code
      ELSE t.target_task_code
    END
FROM unit_code_map m
WHERE t.target_unit_code = m.old_code;

-- 5.26. user_accounts (unit_code, unit_name_vi)
UPDATE public.user_accounts t
SET unit_code = m.new_code,
    unit_name_vi = m.new_name_vi
FROM unit_code_map m
WHERE t.unit_code = m.old_code;

-- Cập nhật đồng bộ lại unit_name_vi chính thức từ dm_don_vi cho tất cả tài khoản
UPDATE public.user_accounts u
SET unit_name_vi = d.ten_don_vi_vi
FROM public.dm_don_vi d
WHERE u.unit_code = d.ma_don_vi;

-- -----------------------------------------------------------------------------
-- BƯỚC 6. CẬP NHẬT CUSTOMUNITS JSON ĐỦ 48 ĐƠN VỊ TRONG T_TIEN_DO (TCNS)
-- -----------------------------------------------------------------------------
UPDATE public.t_tien_do
SET du_lieu_ho_so_json = jsonb_set(
  COALESCE(du_lieu_ho_so_json, '{}'::jsonb),
  '{customUnits}',
  '[{"code": "CK", "nameVi": "Khoa Cơ khí", "nameEn": "Faculty of Mechanical Engineering", "group": "khoa-vien", "domain": "fme.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Mechanical Engineering", "defaultStaffCount": 78}, {"code": "GTNL", "nameVi": "Khoa Giao thông năng lượng", "nameEn": "Faculty of Vehicle and Energy Engineering", "group": "khoa-vien", "domain": "feet.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Vehicle and Energy Engineering", "defaultStaffCount": 64}, {"code": "DDT", "nameVi": "Khoa Điện - Điện tử", "nameEn": "Faculty of Electrical and Electronics Engineering", "group": "khoa-vien", "domain": "feee.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Electrical and Electronics Engineering", "defaultStaffCount": 82}, {"code": "CNTT", "nameVi": "Khoa Công nghệ Thông tin", "nameEn": "Faculty of Information Technology", "group": "khoa-vien", "domain": "fit.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Information Technology", "defaultStaffCount": 68}, {"code": "HHKHSS", "nameVi": "Khoa Hoá học và khoa học sự sống", "nameEn": "Faculty of Chemical and Food Technology", "group": "khoa-vien", "domain": "fcft.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Chemical and Food Technology", "defaultStaffCount": 46}, {"code": "XD", "nameVi": "Khoa Xây dựng", "nameEn": "Faculty of Civil Engineering", "group": "khoa-vien", "domain": "fce.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Civil Engineering", "defaultStaffCount": 52}, {"code": "KT", "nameVi": "Khoa Kinh tế", "nameEn": "Faculty of Economics", "group": "khoa-vien", "domain": "fe.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Economics", "defaultStaffCount": 54}, {"code": "DTTT", "nameVi": "Khoa Đào tạo Tiên tiến", "nameEn": "Faculty of Advanced Education", "group": "khoa-vien", "domain": "fae.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Advanced Education", "defaultStaffCount": 38}, {"code": "MTTT", "nameVi": "Khoa Mỹ thuật và Truyền thông", "nameEn": "Faculty of Graphic Arts and Media", "group": "khoa-vien", "domain": "fgam.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Graphic Arts and Media", "defaultStaffCount": 48}, {"code": "CTL", "nameVi": "Khoa Chính trị và Luật", "nameEn": "Faculty of Political Theory and Law", "group": "khoa-vien", "domain": "fpi.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Political Theory and Law", "defaultStaffCount": 36}, {"code": "KHUD", "nameVi": "Khoa Khoa học Ứng dụng", "nameEn": "Faculty of Applied Sciences", "group": "khoa-vien", "domain": "fas.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Applied Sciences", "defaultStaffCount": 44}, {"code": "NN", "nameVi": "Khoa Ngoại ngữ", "nameEn": "Faculty of Foreign Languages", "group": "khoa-vien", "domain": "ffl.hcmute.edu.vn", "headTitleVi": "Trưởng khoa", "headTitleEn": "Dean of the Faculty of Foreign Languages", "defaultStaffCount": 42}, {"code": "VSPKT", "nameVi": "Viện Sư phạm Kỹ thuật", "nameEn": "Institute of Technical Education", "group": "khoa-vien", "domain": "ite.hcmute.edu.vn", "headTitleVi": "Viện trưởng", "headTitleEn": "Director of the Institute of Technical Education", "defaultStaffCount": 30}, {"code": "VDTQT", "nameVi": "Viện Đào tạo quốc tế", "nameEn": "Institute of International Education", "group": "khoa-vien", "domain": "iie.hcmute.edu.vn", "headTitleVi": "Viện trưởng", "headTitleEn": "Director of the Institute of International Education", "defaultStaffCount": 28}, {"code": "SDH", "nameVi": "Viện Sau đại học", "nameEn": "Postgraduate School", "group": "khoa-vien", "domain": "sdh.hcmute.edu.vn", "headTitleVi": "Viện trưởng", "headTitleEn": "Director of the Postgraduate School", "defaultStaffCount": 18}, {"code": "QTTHTT", "nameVi": "Phòng Quản trị thương hiệu và Truyền thông", "nameEn": "Office of Brand Management and Communications", "group": "phong-ban", "domain": "bmc.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Office of Brand Management and Communications", "defaultStaffCount": 18}, {"code": "TCNS", "nameVi": "Phòng Tổ chức - Nhân sự", "nameEn": "Office of Organization and Personnel", "group": "phong-ban", "domain": "tcns.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Office of Organization and Personnel", "defaultStaffCount": 16}, {"code": "DT", "nameVi": "Phòng Đào tạo", "nameEn": "Academic Affairs Office", "group": "phong-ban", "domain": "aao.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Academic Affairs Office", "defaultStaffCount": 26}, {"code": "QHQT", "nameVi": "Phòng Quan hệ Quốc tế", "nameEn": "International Affairs Office", "group": "phong-ban", "domain": "oia.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Office of International Affairs", "defaultStaffCount": 12}, {"code": "QHDN", "nameVi": "Phòng Quan hệ Doanh nghiệp", "nameEn": "Enterprise Relations Office", "group": "phong-ban", "domain": "pr.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Enterprise Relations Office", "defaultStaffCount": 12}, {"code": "KHTC", "nameVi": "Phòng Kế hoạch Tài chính", "nameEn": "Finance and Planning Office", "group": "phong-ban", "domain": "fpo.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Finance and Planning Office", "defaultStaffCount": 22}, {"code": "KHCN", "nameVi": "Phòng Khoa học Công nghệ", "nameEn": "Office of Science and Technology", "group": "phong-ban", "domain": "stiao.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Office of Science and Technology", "defaultStaffCount": 14}, {"code": "HCTH", "nameVi": "Phòng Hành chính - Tổng hợp", "nameEn": "Office of General Administration", "group": "phong-ban", "domain": "uteoffice.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Office of General Administration", "defaultStaffCount": 28}, {"code": "CTSV", "nameVi": "Phòng Công tác Sinh viên", "nameEn": "Office of Student Affairs", "group": "phong-ban", "domain": "sao.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Office of Student Affairs", "defaultStaffCount": 20}, {"code": "KTDBCL", "nameVi": "Phòng Khảo thí và Đảm bảo Chất lượng", "nameEn": "Office of Testing and Quality Assurance", "group": "phong-ban", "domain": "qao.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Office of Testing and Quality Assurance", "defaultStaffCount": 16}, {"code": "QTCSVC", "nameVi": "Phòng Quản trị cơ sở vật chất", "nameEn": "Office of Facilities Management", "group": "phong-ban", "domain": "emo.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Office of Facilities Management", "defaultStaffCount": 32}, {"code": "QLDTXDDT", "nameVi": "Phòng Quản lý đầu tư xây dựng và Đấu thầu", "nameEn": "Office of Construction Project Management and Bidding", "group": "phong-ban", "domain": "cpm.hcmute.edu.vn", "headTitleVi": "Trưởng phòng", "headTitleEn": "Director of the Office of Construction Project Management and Bidding", "defaultStaffCount": 14}, {"code": "KTX", "nameVi": "Ban Quản lý Ký túc xá", "nameEn": "Dormitory Management Office", "group": "phong-ban", "domain": "ktx.hcmute.edu.vn", "headTitleVi": "Trưởng ban", "headTitleEn": "Director of the Dormitory Management Office", "defaultStaffCount": 24}, {"code": "TYT", "nameVi": "Trạm Y tế", "nameEn": "Health Care Office", "group": "phong-ban", "domain": "hd.hcmute.edu.vn", "headTitleVi": "Trưởng trạm", "headTitleEn": "Head of the Health Care Office", "defaultStaffCount": 10}, {"code": "PHBP", "nameVi": "Phân hiệu Trường Đại học Công nghệ Kỹ thuật TP.HCM tại Bình Phước", "nameEn": "HCM-UTE Binh Phuoc Campus", "group": "trung-tam", "domain": "binhphuoc.hcmute.edu.vn", "headTitleVi": "Giám đốc Phân hiệu", "headTitleEn": "Director of Binh Phuoc Campus", "defaultStaffCount": 35, "subType": "PHAN_HIEU"}, {"code": "TCKHGDKT", "nameVi": "Tạp chí Khoa học Giáo dục Kỹ thuật", "nameEn": "Journal of Technical Education Science", "group": "trung-tam", "domain": "jte.hcmute.edu.vn", "headTitleVi": "Tổng biên tập", "headTitleEn": "Editor-in-Chief of the Journal of Technical Education Science", "defaultStaffCount": 8, "subType": "TAP_CHI"}, {"code": "HLDHS", "nameVi": "Trung tâm Học liệu và Dạy học số", "nameEn": "Center for Learning Resources and Digital Learning", "group": "trung-tam", "domain": "lib.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Center for Learning Resources and Digital Learning", "defaultStaffCount": 26, "subType": "HOC_LIEU_SO"}, {"code": "STKNCCCN", "nameVi": "Trung tâm Sáng tạo, Khởi nghiệp và Chuyển giao công nghệ", "nameEn": "Center of Innovation, Startup and Technology Transfer", "group": "trung-tam", "domain": "cisat.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Center of Innovation, Startup and Technology Transfer", "defaultStaffCount": 14, "subType": "KHOI_NGHIEP"}, {"code": "TTTTMT", "nameVi": "Trung tâm Thông tin - Máy tính", "nameEn": "Information and Computer Center", "group": "trung-tam", "domain": "inc.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Information and Computer Center", "defaultStaffCount": 16, "subType": "HA_TANG_SO"}, {"code": "TTCNTT", "nameVi": "Trung tâm Công nghệ thông tin", "nameEn": "Information Technology Center", "group": "trung-tam", "domain": "itc.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Information Technology Center", "defaultStaffCount": 14, "subType": "DAO_TAO_DV"}, {"code": "GDQPAN", "nameVi": "Trung tâm Giáo dục Quốc phòng và An ninh", "nameEn": "National Defense and Security Training Center", "group": "trung-tam", "domain": "gdqp.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the National Defense and Security Training Center", "defaultStaffCount": 20, "subType": "DAO_TAO_CHUNG"}, {"code": "GDTC", "nameVi": "Trung tâm Giáo dục Thể chất", "nameEn": "Physical Education Center", "group": "trung-tam", "domain": "gdtc.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Physical Education Center", "defaultStaffCount": 22, "subType": "DAO_TAO_CHUNG"}, {"code": "CNPM", "nameVi": "Trung tâm Công nghệ phần mềm", "nameEn": "Software Technology Center", "group": "trung-tam", "domain": "stc.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Software Technology Center", "defaultStaffCount": 12, "subType": "NGHIEN_CUU_CG"}, {"code": "THKTTH", "nameVi": "Trường Trung học Kỹ thuật thực hành", "nameEn": "Technical Practice College", "group": "trung-tam", "domain": "tpc.hcmute.edu.vn", "headTitleVi": "Hiệu trưởng", "headTitleEn": "Principal of the Technical Practice College", "defaultStaffCount": 24, "subType": "DAO_TAO_CHUNG"}, {"code": "TTNN", "nameVi": "Trung tâm Ngoại ngữ", "nameEn": "Center for Foreign Languages", "group": "trung-tam", "domain": "cfl.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Center for Foreign Languages", "defaultStaffCount": 15, "subType": "DAO_TAO_DV"}, {"code": "TTVD", "nameVi": "Trung tâm Việt Đức", "nameEn": "Vietnam - Germany Center", "group": "trung-tam", "domain": "vgc.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Vietnam - Germany Center", "defaultStaffCount": 12, "subType": "HOP_TAC_QT"}, {"code": "TTRBTM", "nameVi": "Trung tâm Robot thông minh", "nameEn": "Smart Robotic Center", "group": "trung-tam", "domain": "src.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Smart Robotic Center", "defaultStaffCount": 10, "subType": "NGHIEN_CUU_CG"}, {"code": "TTKTTH", "nameVi": "Trung tâm Kỹ thuật tổng hợp", "nameEn": "Engineering Synthesis Center", "group": "trung-tam", "domain": "esc.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Engineering Synthesis Center", "defaultStaffCount": 12, "subType": "NGHIEN_CUU_CG"}, {"code": "KTCNMT", "nameVi": "Trung tâm Kỹ thuật và Công nghệ môi trường", "nameEn": "Environmental Engineering and Technology Center", "group": "trung-tam", "domain": "eetc.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Environmental Engineering and Technology Center", "defaultStaffCount": 10, "subType": "NGHIEN_CUU_CG"}, {"code": "NCUDKTXD", "nameVi": "Trung tâm Nghiên cứu và Ứng dụng kỹ thuật xây dựng", "nameEn": "Civil Engineering Research and Application Center", "group": "trung-tam", "domain": "cerac.hcmute.edu.vn", "headTitleVi": "Giám đốc trung tâm", "headTitleEn": "Director of the Civil Engineering Research and Application Center", "defaultStaffCount": 10, "subType": "NGHIEN_CUU_CG"}, {"code": "VPDU", "nameVi": "Văn phòng Đảng ủy", "nameEn": "Office of University Party Committee", "group": "dang-doanthe", "domain": "danguy.hcmute.edu.vn", "headTitleVi": "Bí thư Đảng ủy", "headTitleEn": "Secretary of the Party Committee", "defaultStaffCount": 8}, {"code": "CDT", "nameVi": "Công đoàn Trường", "nameEn": "University Trade Union", "group": "dang-doanthe", "domain": "congdoan.hcmute.edu.vn", "headTitleVi": "Chủ tịch Công đoàn Trường", "headTitleEn": "President of the University Trade Union", "defaultStaffCount": 6}, {"code": "DTN", "nameVi": "Đoàn Thanh niên - Hội Sinh viên", "nameEn": "Ho Chi Minh Communist Youth Union & Students Association", "group": "dang-doanthe", "domain": "doanthanhnien.hcmute.edu.vn", "headTitleVi": "Bí thư Đoàn Thanh niên", "headTitleEn": "Secretary of the Ho Chi Minh Communist Youth Union", "defaultStaffCount": 9}]'::jsonb
)
WHERE ma_don_vi = 'TCNS';

-- -----------------------------------------------------------------------------
-- BƯỚC 7. TÁI LẬP ĐỘNG 100% FOREIGN KEYS VÀ TRIGGERS TỪ SNAPSHOT BAN ĐẦU
-- -----------------------------------------------------------------------------
-- 7.1. Phục hồi 100% Foreign Keys từ temp_fk_snapshot (bảo toàn nguyên vẹn ON DELETE, ON UPDATE)
DO $$
DECLARE
  rec RECORD;
  v_restored_fk int := 0;
BEGIN
  FOR rec IN (SELECT * FROM temp_fk_snapshot) LOOP
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s;',
                   rec.child_schema, rec.child_table, rec.conname, rec.constraint_def);
    v_restored_fk := v_restored_fk + 1;
  END LOOP;
END $$;

-- 7.2. Phục hồi 100% Triggers từ temp_trigger_snapshot
DO $$
DECLARE
  rec RECORD;
  v_restored_trg int := 0;
BEGIN
  FOR rec IN (SELECT * FROM temp_trigger_snapshot) LOOP
    EXECUTE rec.trigger_def;
    v_restored_trg := v_restored_trg + 1;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- BƯỚC 8. POSTFLIGHT ASSERTIONS (KIỂM TRA CHẶT CHẼ TOÀN BỘ KẾT QUẢ ĐỒNG BỘ)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_final_count int;
  v_legacy_count int;
  v_deleted_count int;
  v_missing_codes text[];
  v_expected_codes text[] := ARRAY['CK', 'GTNL', 'DDT', 'CNTT', 'HHKHSS', 'XD', 'KT', 'DTTT', 'MTTT', 'CTL', 'KHUD', 'NN', 'VSPKT', 'VDTQT', 'SDH', 'QTTHTT', 'TCNS', 'DT', 'QHQT', 'QHDN', 'KHTC', 'KHCN', 'HCTH', 'CTSV', 'KTDBCL', 'QTCSVC', 'QLDTXDDT', 'KTX', 'TYT', 'PHBP', 'TCKHGDKT', 'HLDHS', 'STKNCCCN', 'TTTTMT', 'TTCNTT', 'GDQPAN', 'GDTC', 'CNPM', 'THKTTH', 'TTNN', 'TTVD', 'TTRBTM', 'TTKTTH', 'KTCNMT', 'NCUDKTXD', 'VPDU', 'CDT', 'DTN'];
  v_code text;
  rec RECORD;
  v_post_cnt bigint;
  v_snap_fk_count int;
  v_restored_fk_count int;
  v_snap_trg_count int;
  v_restored_trg_count int;
  v_legacy_refs bigint := 0;
  legacy_all text[] := ARRAY['FME', 'FEET', 'FEEE', 'FIT', 'FCFT', 'FCE', 'FE', 'FAE', 'FGAM', 'FPI', 'FAS', 'FFL', 'ITE', 'IIE', 'CISAT', 'INC', 'ITC', 'STC', 'TPC', 'CFL', 'VGC', 'SRC', 'ESC', 'EETC', 'CERAC', 'BMC', 'AAO', 'OIA', 'ERO', 'FPO', 'STIAO', 'OGA', 'SAO', 'QAO', 'EMO', 'CPM', 'IDDF', 'TRTC', 'HDT', 'BGH'];
BEGIN
  -- 8.1. Khẳng định số lượng đơn vị trong dm_don_vi phải đúng 48
  SELECT count(*) INTO v_final_count FROM public.dm_don_vi;
  IF v_final_count <> 48 THEN
    RAISE EXCEPTION 'POSTFLIGHT ABORT: Số lượng đơn vị dm_don_vi không đúng 48 (hiện có % đơn vị).', v_final_count;
  END IF;

  -- 8.2. Khẳng định không còn bất kỳ mã cũ nào trong dm_don_vi
  SELECT count(*) INTO v_legacy_count
  FROM public.dm_don_vi
  WHERE ma_don_vi IN ('FME', 'FEET', 'FEEE', 'FIT', 'FCFT', 'FCE', 'FE', 'FAE', 'FGAM', 'FPI', 'FAS', 'FFL', 'ITE', 'IIE', 'CISAT', 'INC', 'ITC', 'STC', 'TPC', 'CFL', 'VGC', 'SRC', 'ESC', 'EETC', 'CERAC', 'BMC', 'AAO', 'OIA', 'ERO', 'FPO', 'STIAO', 'OGA', 'SAO', 'QAO', 'EMO', 'CPM');
  IF v_legacy_count > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT ABORT: Vẫn còn % mã cũ tồn tại trong dm_don_vi.', v_legacy_count;
  END IF;

  -- 8.3. Khẳng định không còn bất kỳ mã thừa nào (IDDF, TRTC, HDT, BGH)
  SELECT count(*) INTO v_deleted_count
  FROM public.dm_don_vi
  WHERE ma_don_vi IN ('IDDF', 'TRTC', 'HDT', 'BGH');
  IF v_deleted_count > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT ABORT: Vẫn còn % mã thừa (IDDF/TRTC/HDT/BGH) tồn tại trong dm_don_vi.', v_deleted_count;
  END IF;

  -- 8.4. Khẳng định đủ chính xác 48 mã đơn vị kỳ vọng
  FOREACH v_code IN ARRAY v_expected_codes LOOP
    IF NOT EXISTS (SELECT 1 FROM public.dm_don_vi WHERE ma_don_vi = v_code) THEN
      v_missing_codes := array_append(v_missing_codes, v_code);
    END IF;
  END LOOP;

  IF array_length(v_missing_codes, 1) > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT ABORT: Thiếu các mã đơn vị bắt buộc sau: %', array_to_string(v_missing_codes, ', ');
  END IF;

  -- 8.5. Khẳng định không có bất kỳ bảng nghiệp vụ nào bị mất hay biến động số dòng (ngoại trừ dm_don_vi 51 -> 48)
  FOR rec IN (SELECT * FROM temp_row_counts_pre) LOOP
    EXECUTE format('SELECT count(*) FROM public.%I;', rec.table_name) INTO v_post_cnt;
    IF rec.table_name = 'dm_don_vi' THEN
      IF v_post_cnt <> 48 THEN
        RAISE EXCEPTION 'POSTFLIGHT ABORT: dm_don_vi có % dòng, không đúng 48.', v_post_cnt;
      END IF;
    ELSE
      IF v_post_cnt <> rec.row_count THEN
        RAISE EXCEPTION 'POSTFLIGHT ABORT: Bảng % bị thay đổi số dòng! Trước: %, Sau: %',
          rec.table_name, rec.row_count, v_post_cnt;
      END IF;
    END IF;
  END LOOP;

  -- 8.6. Khẳng định 100% Foreign Keys đã được phục hồi đầy đủ
  SELECT count(*) INTO v_snap_fk_count FROM temp_fk_snapshot;
  SELECT count(*) INTO v_restored_fk_count
  FROM pg_constraint c
  JOIN pg_class rel ON rel.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN temp_fk_snapshot s ON s.child_schema = n.nspname AND s.child_table = rel.relname AND s.conname = c.conname;

  IF v_restored_fk_count <> v_snap_fk_count THEN
    RAISE EXCEPTION 'POSTFLIGHT ABORT: Số lượng Foreign Key phục hồi (%) không khớp với snapshot (%).',
      v_restored_fk_count, v_snap_fk_count;
  END IF;

  -- 8.7. Khẳng định 100% Triggers đã được phục hồi đầy đủ
  SELECT count(*) INTO v_snap_trg_count FROM temp_trigger_snapshot;
  SELECT count(*) INTO v_restored_trg_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN temp_trigger_snapshot s ON s.schema_name = n.nspname AND s.table_name = c.relname AND s.trigger_name = t.tgname;

  IF v_restored_trg_count <> v_snap_trg_count THEN
    RAISE EXCEPTION 'POSTFLIGHT ABORT: Số lượng Trigger phục hồi (%) không khớp với snapshot (%).',
      v_restored_trg_count, v_snap_trg_count;
  END IF;

  -- 8.8. Khẳng định tuyệt đối không còn bất kỳ mã cũ/mã thừa nào trong các cột mã đơn vị
  SELECT count(*) INTO v_legacy_refs FROM (
    SELECT ma_don_vi FROM public.dm_don_vi WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.c1_vtvl WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.a1_nhiem_vu WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.a2_cong_viec WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.b1_khoi_luong WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.b2_ct_tac_dong WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.b2_thay_doi WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.c2_nang_luc WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.c3_nhu_cau WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.d1_nhan_luc WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.du_bao_5_nam WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.d2_phuong_an WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.k_kiem_tra WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.t_tien_do WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.s_nhat_ky WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.sldv_quy_mo_don_vi WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.sldv_phan_bo_ngach WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.can_cu_goi_y WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT ma_don_vi FROM public.ra_soat_chua_du_can_cu WHERE ma_don_vi = ANY(legacy_all)
    UNION ALL
    SELECT unit_id FROM public.workbooks WHERE unit_id = ANY(legacy_all)
    UNION ALL
    SELECT unit_code FROM public.user_accounts WHERE unit_code = ANY(legacy_all)
    UNION ALL
    SELECT unit_code FROM public.staff_work_tickets WHERE unit_code = ANY(legacy_all)
    UNION ALL
    SELECT unit_code FROM public.coordinated_tasks WHERE unit_code = ANY(legacy_all)
    UNION ALL
    SELECT target_unit_code FROM public.coordinated_tasks WHERE target_unit_code = ANY(legacy_all)
  ) sub;

  IF v_legacy_refs > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT ABORT: Vẫn còn % tham chiếu mã cũ/mã thừa trong các cột mã đơn vị.', v_legacy_refs;
  END IF;

  RAISE NOTICE 'SUCCESS: Đồng bộ danh mục 48 đơn vị chính thức HCM-UTE hoàn tất và đạt 100%% tiêu chuẩn toàn vẹn.';
END $$;

COMMIT;
