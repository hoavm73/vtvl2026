-- Cấp quyền Lãnh đạo đơn vị (unit_leader) cho 37 email chính thức của các Khoa, Viện, Phòng, Ban, Trung tâm, Phân hiệu & Tạp chí HCM-UTE
-- An toàn tuyệt đối: idempotent (ON CONFLICT), không hạ quyền tài khoản admin hiện có, bảo toàn mật khẩu/tên hiển thị nếu tài khoản đã tồn tại.

WITH official_unit_leaders(email, unit_code, default_display_name) AS (
  VALUES
    ('kctl@hcmute.edu.vn',               'CTL',      'Khoa Chính trị và Luật'),
    ('fme@hcmute.edu.vn',                'CK',       'Khoa Cơ khí'),
    ('feet@hcmute.edu.vn',               'GTNL',     'Khoa Giao thông và Năng lượng'),
    ('kcnhtp@hcmute.edu.vn',             'HHKHSS',   'Khoa Hóa học và Khoa học sự sống'),
    ('kcntt@hcmute.edu.vn',              'CNTT',     'Khoa Công nghệ Thông tin'),
    ('fae@hcmute.edu.vn',                'DTTT',     'Khoa Đào tạo Tiên tiến'),
    ('feee@hcmute.edu.vn',               'DDT',      'Khoa Điện - Điện tử'),
    ('kitt@hcmute.edu.vn',               'MTTT',     'Khoa Mỹ thuật và Truyền thông'),
    ('fas@hcmute.edu.vn',                'KHUD',     'Khoa Khoa học ứng dụng'),
    ('kkt@hcmute.edu.vn',                'KT',       'Khoa Kinh tế'),
    ('knn@hcmute.edu.vn',                'NN',       'Khoa Ngoại ngữ'),
    ('fce@hcmute.edu.vn',                'XD',       'Khoa Xây dựng'),
    ('vienspkt@hcmute.edu.vn',           'VSPKT',    'Viện Sư phạm kỹ thuật'),
    ('bqlktx@hcmute.edu.vn',             'KTX',      'Ban quản lý Ký túc xá'),
    ('p.cthssv@hcmute.edu.vn',           'CTSV',     'Phòng Công tác Sinh viên'),
    ('pdt@hcmute.edu.vn',                'DT',       'Phòng Đào tạo'),
    ('hcth@hcmute.edu.vn',               'HCTH',     'Phòng Hành chính - Tổng hợp'),
    ('phong.khtc@hcmute.edu.vn',         'KHTC',     'Phòng Kế hoạch Tài chính'),
    ('pdbcl@hcmute.edu.vn',              'KTDBCL',   'Phòng Khảo thí và Đảm bảo chất lượng'),
    ('khcn@hcmute.edu.vn',               'KHCN',     'Phòng Khoa học Công nghệ'),
    ('pr@hcmute.edu.vn',                 'QHDN',     'Phòng Quan hệ Doanh nghiệp'),
    ('oia@hcmute.edu.vn',                'QHQT',     'Phòng Quan hệ Quốc tế'),
    ('qldtxd.dt@hcmute.edu.vn',          'QLDTXDDT', 'Phòng Quản lý Đầu tư xây dựng và Đấu thầu'),
    ('quantricosovatchat@hcmute.edu.vn', 'QTCSVC',   'Phòng Quản trị Cơ sở vật chất'),
    ('bmc@hcmute.edu.vn',                'QTTHTT',   'Phòng Quản trị thương hiệu và Truyền thông'),
    ('tochucnhansu@hcmute.edu.vn',       'TCNS',     'Phòng Tổ chức - Nhân sự'),
    ('yte@hcmute.edu.vn',                'TYT',      'Trạm Y tế'),
    ('vanphong_danguy@hcmute.edu.vn',    'VPDU',     'Văn phòng Đảng ủy'),
    ('iie@hcmute.edu.vn',                'VDTQT',    'Viện Đào tạo Quốc tế'),
    ('saudaihoc@hcmute.edu.vn',          'SDH',      'Viện Sau Đại học'),
    ('thiemqv@hcmute.edu.vn',            'PHBP',     'Phân hiệu Trường ĐH CNKT TPHCM tại Bình Phước'),
    ('jte@hcmute.edu.vn',                'TCKHGDKT', 'Tạp chí Khoa học giáo dục kỹ thuật'),
    ('ttgdqpan@hcmute.edu.vn',           'GDQPAN',   'Trung tâm Giáo dục Quốc phòng và An ninh'),
    ('cped@hcmute.edu.vn',               'GDTC',     'Trung tâm Giáo dục Thể chất'),
    ('hldhs@hcmute.edu.vn',              'HLDHS',    'Trung tâm Học liệu và Dạy học số'),
    ('cisat@hcmute.edu.vn',              'STKNCCCN', 'Trung tâm Sáng tạo khởi nghiệp và Chuyển giao công nghệ'),
    ('iic@hcmute.edu.vn',                'TTTTMT',   'Trung tâm Thông tin - Máy tính')
)
INSERT INTO public.user_accounts (
  email,
  display_name,
  full_name,
  unit_code,
  unit_id,
  unit_name_vi,
  title,
  role,
  auth_provider,
  status,
  is_active,
  has_selected_unit,
  created_at,
  last_active_at,
  updated_at
)
SELECT
  LOWER(TRIM(v.email)),
  v.default_display_name,
  v.default_display_name,
  d.ma_don_vi,
  d.ma_don_vi,
  d.ten_don_vi_vi,
  'Lãnh đạo đơn vị',
  'unit_leader',
  'google',
  'active',
  true,
  true,
  NOW(),
  NOW(),
  NOW()
FROM official_unit_leaders v
JOIN public.dm_don_vi d ON d.ma_don_vi = v.unit_code
ON CONFLICT (email) DO UPDATE SET
  unit_code = EXCLUDED.unit_code,
  unit_id = EXCLUDED.unit_id,
  unit_name_vi = EXCLUDED.unit_name_vi,
  role = CASE
    WHEN public.user_accounts.role = 'admin' THEN 'admin'
    ELSE 'unit_leader'
  END,
  title = CASE
    WHEN public.user_accounts.role = 'admin' THEN public.user_accounts.title
    ELSE 'Lãnh đạo đơn vị'
  END,
  status = 'active',
  is_active = true,
  has_selected_unit = true,
  updated_at = NOW();
