-- ==============================================================================
-- BẢN MIGRATION ĐỐI SOÁT TỔNG HỢP: 39 ĐƠN VỊ CHUẨN, VÒNG ĐỜI PHIẾU & LỊCH SỬ PHIÊN BẢN
-- Hệ thống: HCM-UTE VTVL 360 (Trường Đại học Công nghệ Kỹ thuật TP.HCM)
-- Phiên bản migration: 20261115140000 (Duy nhất, có Transaction, Preflight, Backfill, Postflight)
-- Căn cứ: Nghị định số 232/2026/NĐ-CP, Hướng dẫn số 07-HD/BTCTW & Danh mục 39 đơn vị chuẩn
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PHẦN 0: PREFLIGHT CHECKS (KIỂM TRA TIỀN ĐIỀU KIỆN SCHEMA & KIỂU DỮ LIỆU)
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'dm_don_vi') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.dm_don_vi chưa tồn tại.' USING ERRCODE = '42P01';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_accounts') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.user_accounts chưa tồn tại.' USING ERRCODE = '42P01';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_work_tickets') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.staff_work_tickets chưa tồn tại.' USING ERRCODE = '42P01';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: Bảng public.audit_logs chưa tồn tại.' USING ERRCODE = '42P01';
  END IF;
END $$;

-- ==============================================================================
-- PHẦN 1: CHUẨN HÓA DANH MỤC 39 ĐƠN VỊ CHÍNH THỨC (public.dm_don_vi)
-- Nguồn chuẩn: v2DS phan quyen (1).xls - Cột G:I (Loại BGH, HDT, TTNN; giữ BANTT)
-- Bảo toàn khóa ngoại: Không xóa vật lý các dòng có tham chiếu FK, đánh dấu is_active = FALSE
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dm_don_vi' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.dm_don_vi ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  ELSIF (
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dm_don_vi' AND column_name = 'is_active'
  ) <> 'boolean' THEN
    ALTER TABLE public.dm_don_vi
      ALTER COLUMN is_active TYPE BOOLEAN USING (COALESCE(is_active::text, 'true') = 'true');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dm_don_vi' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.dm_don_vi ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Upsert chính xác 39 đơn vị hoạt động chuẩn (khớp đúng các cột thực tế của public.dm_don_vi)
INSERT INTO public.dm_don_vi (
  ma_don_vi, ten_don_vi_vi, ten_don_vi_en, khoi_don_vi, linh_vuc,
  chuc_danh_thu_truong_vi, chuc_danh_thu_truong_en, so_nhan_su_mac_dinh, is_active, updated_at
)
VALUES
  -- 1. Khối Khoa / Viện (15 đơn vị)
  ('CTL',      'Khoa Chính trị và Luật',                                       'Faculty of Political Theory and Law',                     'KHOA_VIEN',    'fpi.hcmute.edu.vn',        'Trưởng khoa',         'Dean of the Faculty of Political Theory and Law',                     36, TRUE, NOW()),
  ('CK',       'Khoa Cơ khí',                                                  'Faculty of Mechanical Engineering',                       'KHOA_VIEN',    'fme.hcmute.edu.vn',        'Trưởng khoa',         'Dean of the Faculty of Mechanical Engineering',                       78, TRUE, NOW()),
  ('CNTT',     'Khoa Công nghệ Thông tin',                                     'Faculty of Information Technology',                       'KHOA_VIEN',    'fit.hcmute.edu.vn',        'Trưởng khoa',         'Dean of the Faculty of Information Technology',                       68, TRUE, NOW()),
  ('DTTT',     'Khoa Đào tạo Tiên tiến',                                       'Faculty of Advanced Education',                           'KHOA_VIEN',    'fae.hcmute.edu.vn',        'Trưởng khoa',         'Dean of the Faculty of Advanced Education',                           38, TRUE, NOW()),
  ('DDT',      'Khoa Điện - Điện tử',                                          'Faculty of Electrical and Electronics Engineering',       'KHOA_VIEN',    'feee.hcmute.edu.vn',       'Trưởng khoa',         'Dean of the Faculty of Electrical and Electronics Engineering',       82, TRUE, NOW()),
  ('GTNL',     'Khoa Giao thông và Năng lượng',                                'Faculty of Vehicle and Energy Engineering',               'KHOA_VIEN',    'feet.hcmute.edu.vn',       'Trưởng khoa',         'Dean of the Faculty of Vehicle and Energy Engineering',               64, TRUE, NOW()),
  ('HHKHSS',   'Khoa Hóa học và Khoa học sự sống',                             'Faculty of Chemical and Food Technology',                 'KHOA_VIEN',    'fcft.hcmute.edu.vn',       'Trưởng khoa',         'Dean of the Faculty of Chemical and Food Technology',                 46, TRUE, NOW()),
  ('KHUD',     'Khoa Khoa học ứng dụng',                                       'Faculty of Applied Sciences',                             'KHOA_VIEN',    'fas.hcmute.edu.vn',        'Trưởng khoa',         'Dean of the Faculty of Applied Sciences',                             44, TRUE, NOW()),
  ('KT',       'Khoa Kinh tế',                                                 'Faculty of Economics',                                    'KHOA_VIEN',    'fe.hcmute.edu.vn',         'Trưởng khoa',         'Dean of the Faculty of Economics',                                    54, TRUE, NOW()),
  ('MTTT',     'Khoa Mỹ thuật và Truyền thông',                                'Faculty of Graphic Arts and Media',                       'KHOA_VIEN',    'fgam.hcmute.edu.vn',       'Trưởng khoa',         'Dean of the Faculty of Graphic Arts and Media',                       48, TRUE, NOW()),
  ('NN',       'Khoa Ngoại ngữ',                                               'Faculty of Foreign Languages',                            'KHOA_VIEN',    'ffl.hcmute.edu.vn',        'Trưởng khoa',         'Dean of the Faculty of Foreign Languages',                            42, TRUE, NOW()),
  ('XD',       'Khoa Xây dựng',                                                'Faculty of Civil Engineering',                            'KHOA_VIEN',    'fce.hcmute.edu.vn',        'Trưởng khoa',         'Dean of the Faculty of Civil Engineering',                            52, TRUE, NOW()),
  ('VSPKT',    'Viện Sư phạm kỹ thuật',                                        'Institute of Technical Education',                        'KHOA_VIEN',    'ite.hcmute.edu.vn',        'Viện trưởng',         'Director of the Institute of Technical Education',                    30, TRUE, NOW()),
  ('VDTQT',    'Viện Đào tạo Quốc tế',                                         'Institute of International Education',                    'KHOA_VIEN',    'iie.hcmute.edu.vn',        'Viện trưởng',         'Director of the Institute of International Education',                28, TRUE, NOW()),
  ('SDH',      'Viện Sau Đại học',                                             'Postgraduate School',                                     'KHOA_VIEN',    'sdh.hcmute.edu.vn',        'Viện trưởng',         'Director of the Postgraduate School',                                 18, TRUE, NOW()),
  -- 2. Khối Phòng / Ban & Đảng ủy (16 đơn vị)
  ('BANTT',    'Ban An ninh trật tự',                                          'Office of Campus Security and Order',                     'PHONG_BAN',    'bantt.hcmute.edu.vn',      'Trưởng ban',          'Director of the Office of Campus Security and Order',                 30, TRUE, NOW()),
  ('KTX',      'Ban quản lý Ký túc xá',                                        'Dormitory Management Office',                             'PHONG_BAN',    'ktx.hcmute.edu.vn',        'Trưởng ban',          'Director of the Dormitory Management Office',                         24, TRUE, NOW()),
  ('CTSV',     'Phòng Công tác Sinh viên',                                     'Office of Student Affairs',                               'PHONG_BAN',    'sao.hcmute.edu.vn',        'Trưởng phòng',        'Director of the Office of Student Affairs',                           20, TRUE, NOW()),
  ('DT',       'Phòng Đào tạo',                                                'Academic Affairs Office',                                 'PHONG_BAN',    'aao.hcmute.edu.vn',        'Trưởng phòng',        'Director of the Academic Affairs Office',                             26, TRUE, NOW()),
  ('HCTH',     'Phòng Hành chính - Tổng hợp',                                  'Office of General Administration',                        'PHONG_BAN',    'uteoffice.hcmute.edu.vn',  'Trưởng phòng',        'Director of the Office of General Administration',                    28, TRUE, NOW()),
  ('KHTC',     'Phòng Kế hoạch Tài chính',                                     'Finance and Planning Office',                             'PHONG_BAN',    'fpo.hcmute.edu.vn',        'Trưởng phòng',        'Director of the Finance and Planning Office',                         22, TRUE, NOW()),
  ('KTDBCL',   'Phòng Khảo thí và Đảm bảo chất lượng',                         'Office of Testing and Quality Assurance',                 'PHONG_BAN',    'qao.hcmute.edu.vn',        'Trưởng phòng',        'Director of the Office of Testing and Quality Assurance',             16, TRUE, NOW()),
  ('KHCN',     'Phòng Khoa học Công nghệ',                                     'Office of Science and Technology',                        'PHONG_BAN',    'stiao.hcmute.edu.vn',      'Trưởng phòng',        'Director of the Office of Science and Technology',                    14, TRUE, NOW()),
  ('QHDN',     'Phòng Quan hệ Doanh nghiệp',                                   'Enterprise Relations Office',                             'PHONG_BAN',    'pr.hcmute.edu.vn',         'Trưởng phòng',        'Director of the Enterprise Relations Office',                         12, TRUE, NOW()),
  ('QHQT',     'Phòng Quan hệ Quốc tế',                                        'International Affairs Office',                            'PHONG_BAN',    'oia.hcmute.edu.vn',        'Trưởng phòng',        'Director of the Office of International Affairs',                     12, TRUE, NOW()),
  ('QLDTXDDT', 'Phòng Quản lý Đầu tư xây dựng và Đấu thầu',                    'Office of Construction Project Management and Bidding',   'PHONG_BAN',    'cpm.hcmute.edu.vn',        'Trưởng phòng',        'Director of the Office of Construction Project Management and Bidding', 14, TRUE, NOW()),
  ('QTCSVC',   'Phòng Quản trị Cơ sở vật chất',                                'Office of Facilities Management',                         'PHONG_BAN',    'emo.hcmute.edu.vn',        'Trưởng phòng',        'Director of the Office of Facilities Management',                     32, TRUE, NOW()),
  ('QTTHTT',   'Phòng Quản trị thương hiệu và Truyền thông',                   'Office of Brand Management and Communications',           'PHONG_BAN',    'bmc.hcmute.edu.vn',        'Trưởng phòng',        'Director of the Office of Brand Management and Communications',       18, TRUE, NOW()),
  ('TCNS',     'Phòng Tổ chức - Nhân sự',                                      'Office of Organization and Personnel',                    'PHONG_BAN',    'tcns.hcmute.edu.vn',       'Trưởng phòng',        'Director of the Office of Organization and Personnel',                16, TRUE, NOW()),
  ('TYT',      'Trạm Y tế',                                                    'Health Care Office',                                      'PHONG_BAN',    'hd.hcmute.edu.vn',         'Trưởng trạm',         'Director of the Health Care Office',                                  10, TRUE, NOW()),
  ('VPDU',     'Văn phòng Đảng ủy',                                            'Office of University Party Committee',                    'DANG_DOANTHE', 'danguy.hcmute.edu.vn',     'Bí thư Đảng ủy',      'Secretary of the Party Committee',                                    8,  TRUE, NOW()),
  -- 3. Khối Trung tâm, Phân hiệu & Tạp chí (8 đơn vị)
  ('CNPM',     'Trung tâm Công nghệ phần mềm',                                 'Software Technology Center',                              'TRUNG_TAM',    'stc.hcmute.edu.vn',        'Giám đốc trung tâm',  'Director of the Software Technology Center',                          12, TRUE, NOW()),
  ('GDQPAN',   'Trung tâm Giáo dục Quốc phòng và An ninh',                     'National Defense and Security Training Center',           'TRUNG_TAM',    'gdqp.hcmute.edu.vn',       'Giám đốc trung tâm',  'Director of the National Defense and Security Training Center',       20, TRUE, NOW()),
  ('GDTC',     'Trung tâm Giáo dục Thể chất',                                  'Physical Education Center',                               'TRUNG_TAM',    'gdtc.hcmute.edu.vn',       'Giám đốc trung tâm',  'Director of the Physical Education Center',                           22, TRUE, NOW()),
  ('HLDHS',    'Trung tâm Học liệu và Dạy học số',                             'Center for Learning Resources and Digital Learning',      'TRUNG_TAM',    'lib.hcmute.edu.vn',        'Giám đốc trung tâm',  'Director of the Center for Learning Resources and Digital Learning',  26, TRUE, NOW()),
  ('STKNCCCN', 'Trung tâm Sáng tạo khởi nghiệp và Chuyển giao công nghệ',      'Center of Innovation, Startup and Technology Transfer',   'TRUNG_TAM',    'cisat.hcmute.edu.vn',      'Giám đốc trung tâm',  'Director of the Center of Innovation, Startup and Technology Transfer', 14, TRUE, NOW()),
  ('TTTTMT',   'Trung tâm Thông tin - Máy tính',                               'Information and Computer Center',                         'TRUNG_TAM',    'inc.hcmute.edu.vn',        'Giám đốc trung tâm',  'Director of the Information and Computer Center',                     16, TRUE, NOW()),
  ('PHBP',     'Phân hiệu Trường ĐH CNKT TPHCM tại Bình Phước',                'HCM-UTE Binh Phuoc Campus',                               'TRUNG_TAM',    'binhphuoc.hcmute.edu.vn',  'Giám đốc Phân hiệu',  'Director of Binh Phuoc Campus',                                       35, TRUE, NOW()),
  ('TCKHGDKT', 'Tạp chí Khoa học giáo dục kỹ thuật',                           'Journal of Technical Education Science',                  'TRUNG_TAM',    'jte.hcmute.edu.vn',        'Tổng biên tập',       'Editor-in-Chief of the Journal of Technical Education Science',       8,  TRUE, NOW())
ON CONFLICT (ma_don_vi) DO UPDATE SET
  ten_don_vi_vi           = EXCLUDED.ten_don_vi_vi,
  ten_don_vi_en           = EXCLUDED.ten_don_vi_en,
  khoi_don_vi             = EXCLUDED.khoi_don_vi,
  linh_vuc                = EXCLUDED.linh_vuc,
  chuc_danh_thu_truong_vi = EXCLUDED.chuc_danh_thu_truong_vi,
  chuc_danh_thu_truong_en = EXCLUDED.chuc_danh_thu_truong_en,
  so_nhan_su_mac_dinh     = EXCLUDED.so_nhan_su_mac_dinh,
  is_active               = TRUE,
  updated_at              = NOW();

-- Đánh dấu các đơn vị ngoài danh sách 39 là không hoạt động (is_active = FALSE), KHÔNG xóa dữ liệu
UPDATE public.dm_don_vi
SET is_active = FALSE, updated_at = NOW()
WHERE ma_don_vi NOT IN (
  'CTL','CK','CNTT','DTTT','DDT','GTNL','HHKHSS','KHUD','KT','MTTT','NN','XD','VSPKT','VDTQT','SDH',
  'BANTT','KTX','CTSV','DT','HCTH','KHTC','KTDBCL','KHCN','QHDN','QHQT','QLDTXDDT','QTCSVC','QTTHTT','TCNS','TYT','VPDU',
  'CNPM','GDQPAN','GDTC','HLDHS','STKNCCCN','TTTTMT','PHBP','TCKHGDKT'
);

CREATE INDEX IF NOT EXISTS idx_dm_don_vi_is_active ON public.dm_don_vi(is_active);

-- ==============================================================================
-- PHẦN 2: CHUẨN HÓA 3 TÀI KHOẢN CHUẨN TRONG public.user_accounts
-- - tcns@hcmute.edu.vn: admin / TCNS
-- - minhhoavo73@gmail.com: unit_leader / SDH
-- - hoavm@hcmute.edu.vn: staff / QTTHTT (Không đổi sang CK)
-- ==============================================================================
DO $$
BEGIN
  ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS unit_id VARCHAR(50);
  ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
  ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
END $$;

UPDATE public.user_accounts
SET unit_id = COALESCE(unit_id, unit_code),
    is_active = CASE WHEN status = 'suspended' THEN FALSE ELSE TRUE END
WHERE unit_id IS NULL;

UPDATE public.user_accounts
SET role = 'admin', unit_code = 'TCNS', unit_id = 'TCNS', unit_name_vi = 'Phòng Tổ chức - Nhân sự', status = 'active', is_active = TRUE, updated_at = NOW()
WHERE lower(email) = 'tcns@hcmute.edu.vn';

UPDATE public.user_accounts
SET role = 'unit_leader', unit_code = 'SDH', unit_id = 'SDH', unit_name_vi = 'Viện Sau Đại học', status = 'active', is_active = TRUE, updated_at = NOW()
WHERE lower(email) = 'minhhoavo73@gmail.com';

UPDATE public.user_accounts
SET role = 'staff', unit_code = 'QTTHTT', unit_id = 'QTTHTT', unit_name_vi = 'Phòng Quản trị thương hiệu và Truyền thông', status = 'active', is_active = TRUE, updated_at = NOW()
WHERE lower(email) = 'hoavm@hcmute.edu.vn';

-- ==============================================================================
-- PHẦN 3: HOÀN THIỆN SCHEMA BẢNG PHIẾU CÔNG VIỆC (public.staff_work_tickets)
-- Kiểm tra từng cột, kiểu dữ liệu, khóa ngoại, trạng thái và chỉ mục
-- ==============================================================================
DO $$
BEGIN
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS unit_id VARCHAR(50);
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS owner_id VARCHAR(255);
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS source_ticket_id VARCHAR(100);
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ;
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS revision_reason TEXT;
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMPTZ;
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS revision_requested_by VARCHAR(255);
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS merged_by VARCHAR(255);
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS a2_row_id VARCHAR(100);
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS b1_row_id VARCHAR(100);
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS b2_row_id VARCHAR(100);
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS is_merged_to_b1_b2 BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS current_version_no INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS last_change_summary TEXT;
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS is_test_data BOOLEAN NOT NULL DEFAULT FALSE;
  ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

  -- Gỡ constraint trạng thái cũ để chuẩn hóa dữ liệu
  ALTER TABLE public.staff_work_tickets DROP CONSTRAINT IF EXISTS staff_work_tickets_status_check;
  ALTER TABLE public.staff_work_tickets DROP CONSTRAINT IF EXISTS chk_staff_work_tickets_status;

  -- Backfill unit_id, owner_id, source_ticket_id (Không tự suy đoán submitted_at hay approved_by)
  UPDATE public.staff_work_tickets
  SET
    unit_id = COALESCE(unit_id, unit_code),
    owner_id = COALESCE(owner_id, owner_email),
    source_ticket_id = COALESCE(source_ticket_id, id)
  WHERE unit_id IS NULL OR owner_id IS NULL OR source_ticket_id IS NULL;

  -- Ánh xạ trạng thái tiếng Việt cũ sang 5 trạng thái chuẩn
  UPDATE public.staff_work_tickets
  SET status = CASE status
    WHEN 'Nháp'             THEN 'draft'
    WHEN 'Đã nộp'           THEN 'submitted'
    WHEN 'Yêu cầu bổ sung'  THEN 'changes_requested'
    WHEN 'Trả lại'          THEN 'changes_requested'
    WHEN 'Đã nộp lại'       THEN 'resubmitted'
    WHEN 'Đã duyệt'         THEN 'approved'
    ELSE status
  END
  WHERE status IN ('Nháp', 'Đã nộp', 'Yêu cầu bổ sung', 'Trả lại', 'Đã nộp lại', 'Đã duyệt');

  -- Đặt Check Constraint cho phép 5 trạng thái canonical (trigger sẽ tự chuẩn hóa nhãn tiếng Việt nếu có)
  ALTER TABLE public.staff_work_tickets
    ADD CONSTRAINT chk_staff_work_tickets_status
    CHECK (status IN (
      'draft', 'submitted', 'changes_requested', 'resubmitted', 'approved',
      'Nháp', 'Đã nộp', 'Yêu cầu bổ sung', 'Đã nộp lại', 'Đã duyệt', 'Trả lại'
    ));

  -- Khóa ngoại unit_id -> dm_don_vi(ma_don_vi)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'staff_work_tickets' AND constraint_name = 'fk_staff_work_tickets_unit_id'
  ) THEN
    ALTER TABLE public.staff_work_tickets
      ADD CONSTRAINT fk_staff_work_tickets_unit_id
      FOREIGN KEY (unit_id) REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE RESTRICT;
  END IF;

  -- Chỉ mục truy vấn
  CREATE INDEX IF NOT EXISTS idx_swt_owner_id ON public.staff_work_tickets(owner_id);
  CREATE INDEX IF NOT EXISTS idx_swt_unit_id ON public.staff_work_tickets(unit_id);
  CREATE INDEX IF NOT EXISTS idx_swt_status ON public.staff_work_tickets(status);
  CREATE INDEX IF NOT EXISTS idx_swt_submitted_at ON public.staff_work_tickets(submitted_at);
  CREATE INDEX IF NOT EXISTS idx_swt_approved_at ON public.staff_work_tickets(approved_at);
  CREATE INDEX IF NOT EXISTS idx_swt_unit_status ON public.staff_work_tickets(unit_code, status);
END $$;

-- Trigger đồng bộ trường canonical của staff_work_tickets
CREATE OR REPLACE FUNCTION public.sync_staff_work_ticket_canonical_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.unit_id := COALESCE(NULLIF(NEW.unit_id, ''), NEW.unit_code);
  NEW.unit_code := COALESCE(NULLIF(NEW.unit_code, ''), NEW.unit_id);
  NEW.owner_id := COALESCE(NULLIF(NEW.owner_id, ''), NEW.owner_email);
  NEW.owner_email := COALESCE(NULLIF(NEW.owner_email, ''), NEW.owner_id);
  NEW.source_ticket_id := COALESCE(NULLIF(NEW.source_ticket_id, ''), NEW.id);

  NEW.status := CASE NEW.status
    WHEN 'Nháp'             THEN 'draft'
    WHEN 'Đã nộp'           THEN 'submitted'
    WHEN 'Yêu cầu bổ sung'  THEN 'changes_requested'
    WHEN 'Trả lại'          THEN 'changes_requested'
    WHEN 'Đã nộp lại'       THEN 'resubmitted'
    WHEN 'Đã duyệt'         THEN 'approved'
    ELSE COALESCE(NEW.status, 'draft')
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_staff_work_ticket_canonical ON public.staff_work_tickets;
CREATE TRIGGER trg_sync_staff_work_ticket_canonical
  BEFORE INSERT OR UPDATE ON public.staff_work_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_staff_work_ticket_canonical_fields();

-- ==============================================================================
-- PHẦN 4: BẢNG LỊCH SỬ PHIÊN BẢN PHIẾU BẤT BIẾN (public.work_survey_versions)
-- Lưu snapshot đầy đủ mỗi lần Nộp / Nộp lại (v1, v2, v3...), UNIQUE(survey_id, version_no)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.work_survey_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id VARCHAR(100) NOT NULL REFERENCES public.staff_work_tickets(id) ON DELETE CASCADE,
  version_no INTEGER NOT NULL CHECK (version_no > 0),
  snapshot JSONB NOT NULL,
  submitted_by VARCHAR(255) NOT NULL,
  submitted_at TIMESTAMPTZ,
  change_summary TEXT,
  is_migration_baseline BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_work_survey_versions_survey_version UNIQUE (survey_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_wsv_survey_id ON public.work_survey_versions(survey_id, version_no DESC);
CREATE INDEX IF NOT EXISTS idx_wsv_submitted_by ON public.work_survey_versions(submitted_by);

-- Trigger chặn sửa/xóa snapshot phiên bản đã lưu
CREATE OR REPLACE FUNCTION public.prevent_immutable_record_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_RECORD_VIOLATION: Bản ghi lịch sử/phiên bản/kiểm toán tại bảng % là bất biến, không được phép sửa hoặc xóa.', TG_TABLE_NAME
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_work_survey_versions ON public.work_survey_versions;
CREATE TRIGGER trg_immutable_work_survey_versions
  BEFORE UPDATE OR DELETE ON public.work_survey_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_immutable_record_mutation();

-- Backfill baseline cho các phiếu đã nộp/duyệt từ trước nhưng chưa có bản ghi trong work_survey_versions
-- Ghi rõ "Bản ghi chuyển đổi dữ liệu", KHÔNG dùng ngày migration làm submitted_at gốc và KHÔNG tự bịa người nộp nếu thiếu submitted_at
INSERT INTO public.work_survey_versions (
  survey_id, version_no, snapshot, submitted_by, submitted_at, change_summary, is_migration_baseline
)
SELECT
  t.id,
  1,
  jsonb_build_object(
    'unitCode', COALESCE(t.unit_code, ''),
    'ownerEmail', COALESCE(t.owner_email, ''),
    'ownerName', COALESCE(t.owner_name, ''),
    'ownerTitle', COALESCE(t.owner_title, ''),
    'maNhiemVu', COALESCE(t.ma_nhiem_vu, ''),
    'maCongViec', COALESCE(t.ma_cong_viec, ''),
    'tenCongViec', COALESCE(t.ten_cong_viec, ''),
    'maVtvl', COALESCE(t.ma_vtvl, ''),
    'maVtvlPhoiHop', COALESCE(t.ma_vtvl_phoi_hop, ''),
    'sanPham', COALESCE(t.san_pham, ''),
    'chatLuong', COALESCE(t.chat_luong, ''),
    'canCu', COALESCE(t.can_cu, ''),
    'soSpNam', COALESCE(t.so_sp_nam, 0),
    'nguonSoLieu', COALESCE(t.nguon_so_lieu, ''),
    'phutThucTe', COALESCE(t.phut_thuc_te, 0),
    'gioBoSung', COALESCE(t.gio_bo_sung, 0),
    'coordinatedTasks', COALESCE(t.coordinated_tasks, '[]'::jsonb)
  ),
  CASE WHEN t.submitted_at IS NOT NULL THEN COALESCE(t.owner_email, '') ELSE '' END,
  t.submitted_at, -- Giữ nguyên NULL nếu phiếu cũ không có ngày nộp gốc
  'Bản ghi chuyển đổi dữ liệu',
  TRUE
FROM public.staff_work_tickets t
WHERE t.status IN ('submitted', 'changes_requested', 'resubmitted', 'approved')
  AND NOT EXISTS (
    SELECT 1 FROM public.work_survey_versions v WHERE v.survey_id = t.id
  );

UPDATE public.staff_work_tickets t
SET current_version_no = COALESCE(
  (SELECT MAX(v.version_no) FROM public.work_survey_versions v WHERE v.survey_id = t.id),
  0
)
WHERE current_version_no = 0;

-- ==============================================================================
-- PHẦN 5: HOÀN THIỆN LỊCH SỬ TRẠNG THÁI & LIÊN KẾT GỘP (work_survey_status_history & work_survey_merge_links)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.work_survey_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id VARCHAR(100) NOT NULL REFERENCES public.staff_work_tickets(id) ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  unit_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wssh_survey_id ON public.work_survey_status_history(survey_id);
CREATE INDEX IF NOT EXISTS idx_wssh_unit_id ON public.work_survey_status_history(unit_id);
CREATE INDEX IF NOT EXISTS idx_wssh_created_at ON public.work_survey_status_history(created_at DESC);

DROP TRIGGER IF EXISTS trg_immutable_work_survey_status_history ON public.work_survey_status_history;
CREATE TRIGGER trg_immutable_work_survey_status_history
  BEFORE UPDATE OR DELETE ON public.work_survey_status_history
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_immutable_record_mutation();

CREATE TABLE IF NOT EXISTS public.work_survey_merge_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id VARCHAR(100) NOT NULL REFERENCES public.staff_work_tickets(id) ON DELETE CASCADE,
  target_sheet VARCHAR(20) NOT NULL CHECK (target_sheet IN ('A2', 'B1', 'B2')),
  target_record_id VARCHAR(100) NOT NULL,
  source_version INTEGER NOT NULL DEFAULT 1 CHECK (source_version >= 1),
  merged_by VARCHAR(255) NOT NULL,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  -- Đổi khóa chống trùng để phân biệt cả target_sheet và target_record_id (hỗ trợ 1 phiếu sinh nhiều dòng)
  ALTER TABLE public.work_survey_merge_links DROP CONSTRAINT IF EXISTS uq_survey_target_sheet;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'work_survey_merge_links'
      AND constraint_name = 'uq_survey_target_sheet_record'
  ) THEN
    ALTER TABLE public.work_survey_merge_links
      ADD CONSTRAINT uq_survey_target_sheet_record UNIQUE (survey_id, target_sheet, target_record_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wsml_survey_id ON public.work_survey_merge_links(survey_id);
CREATE INDEX IF NOT EXISTS idx_wsml_target ON public.work_survey_merge_links(target_sheet, target_record_id);

-- ==============================================================================
-- PHẦN 6: HOÀN THIỆN AUDIT LOG BẤT BIẾN & LỌC BÍ MẬT (public.audit_logs)
-- ==============================================================================
DO $$
BEGIN
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS unit_id TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_id TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_entity TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_values JSONB;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_values JSONB;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;
  ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;

  CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_email);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_unit ON public.audit_logs(unit_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_entity, target_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
END $$;

CREATE OR REPLACE FUNCTION public.sanitize_audit_log_secrets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_secret_keys TEXT[] := ARRAY['password', 'password_hash', 'passwordHash', 'token', 'accessToken', 'access_token', 'refreshToken', 'refresh_token', 'secret', 'client_secret'];
BEGIN
  IF NEW.old_values IS NOT NULL AND jsonb_typeof(NEW.old_values) = 'object' THEN
    NEW.old_values := NEW.old_values - v_secret_keys;
  END IF;
  IF NEW.new_values IS NOT NULL AND jsonb_typeof(NEW.new_values) = 'object' THEN
    NEW.new_values := NEW.new_values - v_secret_keys;
  END IF;
  IF NEW.metadata IS NOT NULL AND jsonb_typeof(NEW.metadata) = 'object' THEN
    NEW.metadata := NEW.metadata - v_secret_keys;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_sanitize_audit_logs
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.sanitize_audit_log_secrets();

DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON public.audit_logs;
CREATE TRIGGER trg_immutable_audit_logs
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_immutable_record_mutation();

-- ==============================================================================
-- PHẦN 7: CẦU NỐI DANH TÍNH ĐÁNG TIN (TRUSTED IDENTITY BRIDGE) & RPC NGUYÊN TỬ
-- Giải quyết kiến trúc custom session + service_role:
--   - Khi gọi từ client JWT (role = 'authenticated'): Bắt buộc lấy email từ auth.jwt(),
--     chặn mọi nỗ lực truyền p_trusted_actor_email khác email trong JWT.
--   - Khi gọi từ Next.js Server qua service_role (đã xác thực cookie session phía server):
--     Cho phép nhận p_trusted_actor_email do server truyền xuống và đối soát trực tiếp bảng user_accounts.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.resolve_trusted_actor(
  p_trusted_actor_email TEXT DEFAULT NULL
)
RETURNS TABLE (
  actor_email TEXT,
  actor_role TEXT,
  actor_unit TEXT,
  actor_active BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT;
  v_jwt_email TEXT;
  v_app_actor_id TEXT;
  v_effective_email TEXT;
  v_account public.user_accounts%ROWTYPE;
BEGIN
  v_jwt_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (auth.jwt() ->> 'role'),
    ''
  );
  v_jwt_email := lower(trim(COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    (auth.jwt() ->> 'email'),
    ''
  )));
  v_app_actor_id := lower(trim(COALESCE(
    NULLIF(current_setting('app.actor_id', true), ''),
    ''
  )));

  IF v_jwt_role = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    v_effective_email := lower(trim(COALESCE(
      NULLIF(p_trusted_actor_email, ''),
      NULLIF(v_app_actor_id, ''),
      v_jwt_email
    )));
  ELSE
    -- Gọi trực tiếp bằng user JWT (role = authenticated / anon):
    -- Chặn tuyệt đối giả mạo qua p_trusted_actor_email hoặc session GUC app.actor_id
    IF p_trusted_actor_email IS NOT NULL
       AND trim(p_trusted_actor_email) <> ''
       AND lower(trim(p_trusted_actor_email)) <> v_jwt_email THEN
      RAISE EXCEPTION 'FORBIDDEN_ACTOR_SPOOFING: Không được phép mạo danh tài khoản khác qua tham số RPC.' USING ERRCODE = '42501';
    END IF;
    IF v_app_actor_id <> '' AND v_app_actor_id <> v_jwt_email THEN
      RAISE EXCEPTION 'FORBIDDEN_ACTOR_SPOOFING: Không được phép giả mạo ngữ cảnh app.actor_id.' USING ERRCODE = '42501';
    END IF;
    v_effective_email := v_jwt_email;
  END IF;

  IF v_effective_email IS NULL OR v_effective_email = '' THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Yêu cầu xác thực danh tính người dùng.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_account
  FROM public.user_accounts
  WHERE lower(email) = v_effective_email
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND: Tài khoản % không tồn tại trong hệ thống.', v_effective_email USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_account.is_active, TRUE) = FALSE OR COALESCE(v_account.status, 'active') = 'suspended' THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED: Tài khoản % đã bị tạm khóa.', v_effective_email USING ERRCODE = '42501';
  END IF;

  -- Thiết lập SET LOCAL (is_local = true) chỉ có hiệu lực trong phạm vi transaction hiện tại,
  -- tự động xóa khi COMMIT/ROLLBACK, đảm bảo không rò rỉ danh tính qua connection pool.
  PERFORM set_config('app.actor_id', lower(v_account.email), true);
  PERFORM set_config('app.current_user_email', lower(v_account.email), true);

  RETURN QUERY SELECT
    lower(v_account.email)::TEXT,
    COALESCE(v_account.role, 'staff')::TEXT,
    COALESCE(NULLIF(v_account.unit_id, ''), v_account.unit_code, '')::TEXT,
    TRUE;
END;
$$;

-- 7.1 RPC NỘP / NỘP LẠI PHIẾU NGUYÊN TỬ (Cập nhật phiếu + Tạo snapshot v1..vN + History + Audit Log)
CREATE OR REPLACE FUNCTION public.rpc_submit_work_survey(
  p_ticket_id TEXT,
  p_is_resubmit BOOLEAN DEFAULT FALSE,
  p_snapshot JSONB DEFAULT NULL,
  p_change_summary TEXT DEFAULT NULL,
  p_trusted_actor_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_ticket public.staff_work_tickets%ROWTYPE;
  v_old_status TEXT;
  v_new_status TEXT;
  v_action TEXT;
  v_next_version INTEGER;
  v_final_snapshot JSONB;
BEGIN
  SELECT * INTO v_actor FROM public.resolve_trusted_actor(p_trusted_actor_email);

  -- Khóa dòng chống bấm đúp / race condition sinh trùng phiên bản
  SELECT * INTO v_ticket
  FROM public.staff_work_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND: Không tìm thấy phiếu %', p_ticket_id USING ERRCODE = 'P0002';
  END IF;

  -- Chỉ chủ sở hữu phiếu mới được nộp / nộp lại phiếu của mình
  IF lower(COALESCE(v_ticket.owner_email, v_ticket.owner_id)) <> v_actor.actor_email THEN
    RAISE EXCEPTION 'FORBIDDEN_NOT_OWNER: Chỉ chủ sở hữu phiếu mới được phép nộp hoặc nộp lại phiếu kê khai.' USING ERRCODE = '42501';
  END IF;

  IF v_actor.actor_role <> 'admin' AND COALESCE(v_ticket.unit_code, v_ticket.unit_id) <> v_actor.actor_unit THEN
    RAISE EXCEPTION 'FORBIDDEN_CROSS_UNIT: Không được phép nộp phiếu khác đơn vị.' USING ERRCODE = '42501';
  END IF;

  v_old_status := v_ticket.status;

  -- Idempotency: nếu request trùng khi phiếu vừa chuyển sang submitted/resubmitted thì trả về kết quả hiện hành
  IF (NOT p_is_resubmit AND v_old_status = 'submitted') OR (p_is_resubmit AND v_old_status = 'resubmitted') THEN
    RETURN to_jsonb(v_ticket);
  END IF;

  IF p_is_resubmit THEN
    IF v_old_status NOT IN ('changes_requested', 'Yêu cầu bổ sung', 'Trả lại') THEN
      RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Chỉ phiếu đang ở trạng thái Yêu cầu bổ sung mới được nộp lại.' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(trim(COALESCE(p_change_summary, '')), '') IS NULL THEN
      RAISE EXCEPTION 'MISSING_CHANGE_SUMMARY: Khi nộp lại phiếu sau yêu cầu bổ sung, bắt buộc nhập nội dung giải trình / tóm tắt chỉnh sửa.' USING ERRCODE = '22023';
    END IF;
    v_new_status := 'resubmitted';
    v_action := 'RESUBMIT';
  ELSE
    IF v_old_status NOT IN ('draft', 'Nháp') THEN
      RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Chỉ phiếu Nháp mới được nộp lần đầu.' USING ERRCODE = '22023';
    END IF;
    v_new_status := 'submitted';
    v_action := 'SUBMIT';
  END IF;

  SELECT COALESCE(MAX(version_no), 0) + 1
  INTO v_next_version
  FROM public.work_survey_versions
  WHERE survey_id = p_ticket_id;

  v_final_snapshot := COALESCE(
    p_snapshot,
    jsonb_build_object(
      'unitCode', COALESCE(v_ticket.unit_code, ''),
      'ownerEmail', COALESCE(v_ticket.owner_email, ''),
      'ownerName', COALESCE(v_ticket.owner_name, ''),
      'ownerTitle', COALESCE(v_ticket.owner_title, ''),
      'maNhiemVu', COALESCE(v_ticket.ma_nhiem_vu, ''),
      'maCongViec', COALESCE(v_ticket.ma_cong_viec, ''),
      'tenCongViec', COALESCE(v_ticket.ten_cong_viec, ''),
      'maVtvl', COALESCE(v_ticket.ma_vtvl, ''),
      'maVtvlPhoiHop', COALESCE(v_ticket.ma_vtvl_phoi_hop, ''),
      'sanPham', COALESCE(v_ticket.san_pham, ''),
      'chatLuong', COALESCE(v_ticket.chat_luong, ''),
      'canCu', COALESCE(v_ticket.can_cu, ''),
      'soSpNam', COALESCE(v_ticket.so_sp_nam, 0),
      'nguonSoLieu', COALESCE(v_ticket.nguon_so_lieu, ''),
      'phutThucTe', COALESCE(v_ticket.phut_thuc_te, 0),
      'gioBoSung', COALESCE(v_ticket.gio_bo_sung, 0),
      'coordinatedTasks', COALESCE(v_ticket.coordinated_tasks, '[]'::jsonb)
    )
  );

  INSERT INTO public.work_survey_versions (
    survey_id, version_no, snapshot, submitted_by, submitted_at, change_summary, is_migration_baseline
  ) VALUES (
    p_ticket_id,
    v_next_version,
    v_final_snapshot,
    v_actor.actor_email,
    NOW(),
    NULLIF(trim(COALESCE(p_change_summary, '')), ''),
    FALSE
  );

  UPDATE public.staff_work_tickets
  SET
    status = v_new_status,
    submitted_at = CASE WHEN NOT p_is_resubmit THEN COALESCE(submitted_at, NOW()) ELSE submitted_at END,
    resubmitted_at = CASE WHEN p_is_resubmit THEN NOW() ELSE resubmitted_at END,
    current_version_no = v_next_version,
    last_change_summary = NULLIF(trim(COALESCE(p_change_summary, '')), ''),
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  INSERT INTO public.work_survey_status_history (
    survey_id, from_status, to_status, action, reason, actor_id, actor_role, unit_id
  ) VALUES (
    v_ticket.id, v_old_status, v_new_status, v_action,
    NULLIF(trim(COALESCE(p_change_summary, '')), ''),
    v_actor.actor_email, v_actor.actor_role, v_ticket.unit_code
  );

  INSERT INTO public.audit_logs (
    workbook_id, actor_email, actor_role, unit_id, action, target_id, target_entity,
    old_values, new_values, metadata, created_at
  ) VALUES (
    'wb_' || v_ticket.unit_code || '_2026',
    v_actor.actor_email,
    v_actor.actor_role,
    v_ticket.unit_code,
    v_action,
    v_ticket.id,
    'staff_work_tickets',
    jsonb_build_object('status', v_old_status, 'versionNo', v_next_version - 1),
    jsonb_build_object('status', v_new_status, 'versionNo', v_next_version, 'changeSummary', p_change_summary),
    jsonb_build_object('ownerEmail', v_ticket.owner_email),
    NOW()
  );

  RETURN to_jsonb(v_ticket);
END;
$$;

-- Wrapper riêng cho thao tác resubmit
CREATE OR REPLACE FUNCTION public.rpc_resubmit_work_survey(
  p_ticket_id TEXT,
  p_snapshot JSONB DEFAULT NULL,
  p_change_summary TEXT DEFAULT NULL,
  p_trusted_actor_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.rpc_submit_work_survey(p_ticket_id, TRUE, p_snapshot, p_change_summary, p_trusted_actor_email);
END;
$$;

-- 7.2 RPC YÊU CẦU BỔ SUNG PHIẾU (Lãnh đạo đơn vị / Admin)
CREATE OR REPLACE FUNCTION public.rpc_request_work_survey_changes(
  p_ticket_id TEXT,
  p_reason TEXT,
  p_trusted_actor_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_ticket public.staff_work_tickets%ROWTYPE;
  v_old_status TEXT;
  v_clean_reason TEXT;
BEGIN
  SELECT * INTO v_actor FROM public.resolve_trusted_actor(p_trusted_actor_email);
  v_clean_reason := trim(COALESCE(p_reason, ''));

  IF v_actor.actor_role = 'staff' THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Cán bộ không có quyền yêu cầu bổ sung phiếu.' USING ERRCODE = '42501';
  END IF;

  IF v_clean_reason = '' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: Lý do yêu cầu bổ sung là bắt buộc.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ticket
  FROM public.staff_work_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND: Không tìm thấy phiếu %', p_ticket_id USING ERRCODE = 'P0002';
  END IF;

  IF v_actor.actor_role <> 'admin' AND v_ticket.unit_code <> v_actor.actor_unit THEN
    RAISE EXCEPTION 'FORBIDDEN_CROSS_UNIT: Lãnh đạo chỉ thao tác trên phiếu thuộc đơn vị mình.' USING ERRCODE = '42501';
  END IF;

  IF v_actor.actor_role <> 'admin' AND lower(v_ticket.owner_email) = v_actor.actor_email THEN
    RAISE EXCEPTION 'FORBIDDEN_SELF_REVIEW: Lãnh đạo đơn vị không được tự xét duyệt phiếu của chính mình.' USING ERRCODE = '42501';
  END IF;

  v_old_status := v_ticket.status;
  IF v_old_status NOT IN ('submitted', 'resubmitted', 'Đã nộp', 'Đã nộp lại') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Chỉ phiếu Đã nộp hoặc Đã nộp lại mới có thể yêu cầu bổ sung.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.staff_work_tickets
  SET
    status = 'changes_requested',
    revision_reason = v_clean_reason,
    revision_requested_at = NOW(),
    revision_requested_by = v_actor.actor_email,
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  INSERT INTO public.work_survey_status_history (
    survey_id, from_status, to_status, action, reason, actor_id, actor_role, unit_id
  ) VALUES (
    v_ticket.id, v_old_status, 'changes_requested', 'REQUEST_CHANGES', v_clean_reason,
    v_actor.actor_email, v_actor.actor_role, v_ticket.unit_code
  );

  INSERT INTO public.audit_logs (
    workbook_id, actor_email, actor_role, unit_id, action, target_id, target_entity,
    old_values, new_values, metadata, created_at
  ) VALUES (
    'wb_' || v_ticket.unit_code || '_2026',
    v_actor.actor_email,
    v_actor.actor_role,
    v_ticket.unit_code,
    'REQUEST_CHANGES',
    v_ticket.id,
    'staff_work_tickets',
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'changes_requested', 'revisionReason', v_clean_reason),
    jsonb_build_object('ownerEmail', v_ticket.owner_email),
    NOW()
  );

  RETURN to_jsonb(v_ticket);
END;
$$;

-- 7.3 RPC DUYỆT PHIẾU (Chặn Lãnh đạo tự duyệt phiếu mình)
CREATE OR REPLACE FUNCTION public.rpc_approve_work_survey(
  p_ticket_id TEXT,
  p_trusted_actor_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_ticket public.staff_work_tickets%ROWTYPE;
  v_old_status TEXT;
BEGIN
  SELECT * INTO v_actor FROM public.resolve_trusted_actor(p_trusted_actor_email);

  IF v_actor.actor_role = 'staff' THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Cán bộ không có quyền phê duyệt phiếu.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ticket
  FROM public.staff_work_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND: Không tìm thấy phiếu %', p_ticket_id USING ERRCODE = 'P0002';
  END IF;

  IF v_actor.actor_role <> 'admin' AND v_ticket.unit_code <> v_actor.actor_unit THEN
    RAISE EXCEPTION 'FORBIDDEN_CROSS_UNIT: Lãnh đạo đơn vị chỉ có quyền duyệt phiếu thuộc đơn vị của mình.' USING ERRCODE = '42501';
  END IF;

  IF v_actor.actor_role <> 'admin' AND lower(v_ticket.owner_email) = v_actor.actor_email THEN
    RAISE EXCEPTION 'FORBIDDEN_SELF_REVIEW: Lãnh đạo đơn vị không thể tự duyệt phiếu của chính mình. Vui lòng chuyển Quản trị viên (TCNS) phê duyệt.' USING ERRCODE = '42501';
  END IF;

  v_old_status := v_ticket.status;
  IF v_old_status NOT IN ('submitted', 'resubmitted', 'Đã nộp', 'Đã nộp lại') THEN
    RAISE EXCEPTION 'INVALID_STATE_TRANSITION: Chỉ phiếu Đã nộp hoặc Đã nộp lại mới có thể phê duyệt.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.staff_work_tickets
  SET
    status = 'approved',
    approved_by = v_actor.actor_email,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  INSERT INTO public.work_survey_status_history (
    survey_id, from_status, to_status, action, actor_id, actor_role, unit_id
  ) VALUES (
    v_ticket.id, v_old_status, 'approved', 'APPROVE',
    v_actor.actor_email, v_actor.actor_role, v_ticket.unit_code
  );

  INSERT INTO public.audit_logs (
    workbook_id, actor_email, actor_role, unit_id, action, target_id, target_entity,
    old_values, new_values, metadata, created_at
  ) VALUES (
    'wb_' || v_ticket.unit_code || '_2026',
    v_actor.actor_email,
    v_actor.actor_role,
    v_ticket.unit_code,
    'APPROVE_TICKET',
    v_ticket.id,
    'staff_work_tickets',
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', 'approved', 'approvedBy', v_actor.actor_email),
    jsonb_build_object('ownerEmail', v_ticket.owner_email, 'versionNo', v_ticket.current_version_no),
    NOW()
  );

  RETURN to_jsonb(v_ticket);
END;
$$;

-- 7.4 RPC GỘP PHIẾU ĐÃ DUYỆT VÀO BIỂU A2 / B1 / B2 (Idempotent, khóa đồng thời cả phiếu và workbook trong cùng transaction)
CREATE OR REPLACE FUNCTION public.rpc_merge_work_survey_to_b1_b2(
  p_ticket_id TEXT,
  p_has_b2_impact BOOLEAN DEFAULT FALSE,
  p_trusted_actor_email TEXT DEFAULT NULL,
  p_expected_wb_revision INTEGER DEFAULT NULL,
  p_updated_wb_data JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor RECORD;
  v_ticket public.staff_work_tickets%ROWTYPE;
  v_wb public.workbooks%ROWTYPE;
  v_source_version INTEGER;
  v_a2_row_id TEXT;
  v_b1_row_id TEXT;
  v_b2_row_id TEXT;
BEGIN
  SELECT * INTO v_actor FROM public.resolve_trusted_actor(p_trusted_actor_email);

  IF v_actor.actor_role = 'staff' THEN
    RAISE EXCEPTION 'FORBIDDEN_ROLE: Cán bộ không có quyền gộp phiếu vào biểu của đơn vị.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ticket
  FROM public.staff_work_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND: Không tìm thấy phiếu %', p_ticket_id USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(v_ticket.is_test_data, FALSE) = TRUE OR COALESCE(v_ticket.is_archived, FALSE) = TRUE THEN
    RAISE EXCEPTION 'FORBIDDEN_TEST_OR_ARCHIVED_MERGE: Phiếu dữ liệu thử nghiệm hoặc lưu trữ không được gộp vào biểu chính thức.' USING ERRCODE = '22023';
  END IF;

  IF v_actor.actor_role <> 'admin' AND v_ticket.unit_code <> v_actor.actor_unit THEN
    RAISE EXCEPTION 'FORBIDDEN_CROSS_UNIT: Lãnh đạo chỉ được gộp phiếu thuộc đơn vị mình.' USING ERRCODE = '42501';
  END IF;

  IF v_ticket.status NOT IN ('approved', 'Đã duyệt') THEN
    RAISE EXCEPTION 'FORBIDDEN_UNAPPROVED_MERGE: Chỉ phiếu Đã duyệt mới được phép gộp vào biểu đơn vị.' USING ERRCODE = '22023';
  END IF;

  -- Nếu truyền dữ liệu cập nhật workbook trong cùng transaction, khóa dòng workbook và kiểm tra base_revision
  IF p_updated_wb_data IS NOT NULL THEN
    SELECT * INTO v_wb
    FROM public.workbooks
    WHERE unit_id = v_ticket.unit_code AND COALESCE(is_deleted, FALSE) = FALSE
    ORDER BY updated_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      IF p_expected_wb_revision IS NOT NULL AND p_expected_wb_revision > 0 AND v_wb.current_revision <> p_expected_wb_revision THEN
        RAISE EXCEPTION 'REVISION_CONFLICT: Xung đột phiên bản bảng tính đơn vị (expected %, actual %).', p_expected_wb_revision, v_wb.current_revision USING ERRCODE = '40001';
      END IF;

      UPDATE public.workbooks
      SET
        data = p_updated_wb_data,
        current_revision = COALESCE(v_wb.current_revision, 1) + 1,
        updated_at = NOW()
      WHERE id = v_wb.id;
    END IF;
  END IF;

  v_source_version := GREATEST(COALESCE(v_ticket.current_version_no, 1), 1);
  v_a2_row_id := 'a2-' || v_ticket.id;
  v_b1_row_id := 'b1-' || v_ticket.id;
  v_b2_row_id := CASE WHEN p_has_b2_impact THEN 'b2-' || v_ticket.id ELSE NULL END;

  UPDATE public.staff_work_tickets
  SET
    is_merged_to_b1_b2 = TRUE,
    merged_by = v_actor.actor_email,
    merged_at = NOW(),
    a2_row_id = v_a2_row_id,
    b1_row_id = v_b1_row_id,
    b2_row_id = v_b2_row_id,
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  -- Liên kết gộp vào A2 và B1 (chống trùng theo (survey_id, target_sheet, target_record_id))
  INSERT INTO public.work_survey_merge_links (
    survey_id, target_sheet, target_record_id, source_version, merged_by, merged_at, updated_at
  ) VALUES
    (v_ticket.id, 'A2', v_a2_row_id, v_source_version, v_actor.actor_email, NOW(), NOW()),
    (v_ticket.id, 'B1', v_b1_row_id, v_source_version, v_actor.actor_email, NOW(), NOW())
  ON CONFLICT (survey_id, target_sheet, target_record_id)
  DO UPDATE SET
    source_version = EXCLUDED.source_version,
    merged_by = EXCLUDED.merged_by,
    updated_at = NOW();

  -- Chỉ ghi liên kết B2 khi thực sự có dữ liệu tác động B2
  IF p_has_b2_impact AND v_b2_row_id IS NOT NULL THEN
    INSERT INTO public.work_survey_merge_links (
      survey_id, target_sheet, target_record_id, source_version, merged_by, merged_at, updated_at
    ) VALUES (
      v_ticket.id, 'B2', v_b2_row_id, v_source_version, v_actor.actor_email, NOW(), NOW()
    )
    ON CONFLICT (survey_id, target_sheet, target_record_id)
    DO UPDATE SET
      source_version = EXCLUDED.source_version,
      merged_by = EXCLUDED.merged_by,
      updated_at = NOW();
  END IF;

  INSERT INTO public.work_survey_status_history (
    survey_id, from_status, to_status, action, actor_id, actor_role, unit_id
  ) VALUES (
    v_ticket.id, v_ticket.status, v_ticket.status, 'MERGE_TO_SHEETS',
    v_actor.actor_email, v_actor.actor_role, v_ticket.unit_code
  );

  INSERT INTO public.audit_logs (
    workbook_id, actor_email, actor_role, unit_id, action, target_id, target_entity,
    old_values, new_values, metadata, created_at
  ) VALUES (
    'wb_' || v_ticket.unit_code || '_2026',
    v_actor.actor_email,
    v_actor.actor_role,
    v_ticket.unit_code,
    'MERGE_TICKET',
    v_ticket.id,
    'staff_work_tickets',
    jsonb_build_object('isMerged', FALSE),
    jsonb_build_object(
      'isMerged', TRUE,
      'sourceVersion', v_source_version,
      'a2RowId', v_a2_row_id,
      'b1RowId', v_b1_row_id,
      'b2RowId', v_b2_row_id
    ),
    jsonb_build_object('ownerEmail', v_ticket.owner_email),
    NOW()
  );

  RETURN to_jsonb(v_ticket);
END;
$$;

-- Giới hạn quyền EXECUTE của các RPC nhạy cảm
REVOKE EXECUTE ON FUNCTION public.resolve_trusted_actor(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_submit_work_survey(TEXT, BOOLEAN, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_resubmit_work_survey(TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_request_work_survey_changes(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_approve_work_survey(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_merge_work_survey_to_b1_b2(TEXT, BOOLEAN, TEXT, INTEGER, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.resolve_trusted_actor(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_submit_work_survey(TEXT, BOOLEAN, JSONB, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_resubmit_work_survey(TEXT, JSONB, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_request_work_survey_changes(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_approve_work_survey(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_merge_work_survey_to_b1_b2(TEXT, BOOLEAN, TEXT, INTEGER, JSONB) TO authenticated, service_role;

-- ==============================================================================
-- PHẦN 8: CHÍNH SÁCH RLS CHO work_survey_versions, history, merge_links, tickets, audit_logs
-- Định nghĩa các hàm helper RLS dùng chung (tương thích với current_auth_email/get_auth_unit/is_tcns_admin)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT lower(trim(COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    (auth.jwt() ->> 'email'),
    NULLIF(current_setting('app.actor_id', true), ''),
    ''
  )));
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_unit()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(NULLIF(u.unit_id, ''), u.unit_code)
      FROM public.user_accounts u
      WHERE lower(u.email) = public.get_current_user_email()
        AND COALESCE(u.is_active, TRUE) = TRUE
        AND COALESCE(u.status, 'active') = 'active'
      LIMIT 1
    ),
    (auth.jwt() -> 'user_metadata' ->> 'unit_code'),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_accounts u
    WHERE lower(u.email) = public.get_current_user_email()
      AND u.role = 'admin'
      AND COALESCE(u.is_active, TRUE) = TRUE
      AND COALESCE(u.status, 'active') = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_unit_leader()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_accounts u
    WHERE lower(u.email) = public.get_current_user_email()
      AND u.role = 'unit_leader'
      AND COALESCE(u.is_active, TRUE) = TRUE
      AND COALESCE(u.status, 'active') = 'active'
  );
$$;

ALTER TABLE public.work_survey_versions ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON public.work_survey_versions FROM authenticated, anon;
GRANT SELECT, INSERT ON public.work_survey_versions TO authenticated;

DROP POLICY IF EXISTS "rls_work_survey_versions_select" ON public.work_survey_versions;
CREATE POLICY "rls_work_survey_versions_select" ON public.work_survey_versions
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.staff_work_tickets t
      WHERE t.id = work_survey_versions.survey_id
        AND t.unit_code = public.get_current_user_unit()
        AND (
          lower(t.owner_email) = lower(public.get_current_user_email())
          OR t.status IN ('submitted', 'changes_requested', 'resubmitted', 'approved', 'Đã nộp', 'Yêu cầu bổ sung', 'Đã nộp lại', 'Đã duyệt', 'Trả lại')
        )
    )
  );

DROP POLICY IF EXISTS "rls_work_survey_versions_insert" ON public.work_survey_versions;
CREATE POLICY "rls_work_survey_versions_insert" ON public.work_survey_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    lower(submitted_by) = lower(public.get_current_user_email())
    AND EXISTS (
      SELECT 1 FROM public.staff_work_tickets t
      WHERE t.id = work_survey_versions.survey_id
        AND lower(t.owner_email) = lower(public.get_current_user_email())
        AND t.unit_code = public.get_current_user_unit()
    )
  );

-- Cập nhật RLS select cho staff_work_tickets:
-- Phiếu Nháp chỉ chủ sở hữu và Admin được xem; phiếu đã nộp xem trong cùng đơn vị hoặc Admin
DROP POLICY IF EXISTS "rls_staff_tickets_select" ON public.staff_work_tickets;
CREATE POLICY "rls_staff_tickets_select" ON public.staff_work_tickets
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR lower(owner_email) = lower(public.get_current_user_email())
    OR (
      unit_code = public.get_current_user_unit()
      AND status IN ('submitted', 'changes_requested', 'resubmitted', 'approved', 'Đã nộp', 'Yêu cầu bổ sung', 'Đã nộp lại', 'Đã duyệt', 'Trả lại')
    )
  );

-- Chỉ chủ sở hữu được sửa nội dung phiếu ở trạng thái draft hoặc changes_requested;
-- KHÔNG AI (kể cả Admin/Lãnh đạo) được sửa trực tiếp nội dung kê khai của người khác
DROP POLICY IF EXISTS "rls_staff_tickets_update" ON public.staff_work_tickets;
CREATE POLICY "rls_staff_tickets_update" ON public.staff_work_tickets
  FOR UPDATE TO authenticated
  USING (
    unit_code = public.get_current_user_unit()
    AND lower(owner_email) = lower(public.get_current_user_email())
    AND status IN ('draft', 'changes_requested', 'Nháp', 'Yêu cầu bổ sung', 'Trả lại')
  )
  WITH CHECK (
    unit_code = public.get_current_user_unit()
    AND lower(owner_email) = lower(public.get_current_user_email())
    AND status IN ('draft', 'changes_requested', 'Nháp', 'Yêu cầu bổ sung', 'Trả lại')
  );

ALTER TABLE public.work_survey_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_survey_merge_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_wssh_select" ON public.work_survey_status_history;
CREATE POLICY "rls_wssh_select" ON public.work_survey_status_history
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR unit_id = public.get_current_user_unit()
  );

DROP POLICY IF EXISTS "rls_wsml_select" ON public.work_survey_merge_links;
CREATE POLICY "rls_wsml_select" ON public.work_survey_merge_links
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.staff_work_tickets t
      WHERE t.id = work_survey_merge_links.survey_id
        AND t.unit_code = public.get_current_user_unit()
    )
  );

REVOKE UPDATE, DELETE ON public.work_survey_status_history FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.work_survey_merge_links FROM authenticated, anon;
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;

-- ==============================================================================
-- PHẦN 9: POSTFLIGHT ASSERTIONS (KIỂM TRA ĐỐI SOÁT SAU KHI CHẠY MIGRATION)
-- ==============================================================================
DO $$
DECLARE
  v_active_unit_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_active_unit_count FROM public.dm_don_vi WHERE is_active = TRUE;
  IF v_active_unit_count <> 39 THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: Số lượng đơn vị hoạt động (is_active = TRUE) là %, yêu cầu đúng 39 đơn vị.', v_active_unit_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_survey_versions'
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: Bảng public.work_survey_versions chưa được tạo.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'work_survey_versions'
      AND constraint_name = 'uq_work_survey_versions_survey_version'
  ) THEN
    RAISE EXCEPTION 'POSTFLIGHT_FAILED: Thiếu UNIQUE(survey_id, version_no) trên work_survey_versions.';
  END IF;
END $$;

COMMIT;
