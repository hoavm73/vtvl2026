import { HcmuteUnit, UnitGroupKind } from '@/types/vtvl';

export const UNIT_GROUPS: {
  id: UnitGroupKind;
  label: string;
  shortDesc: string;
  sampleFrom: string;
  sampleTo: string;
  factsText: string;
  sourceRule: string;
}[] = [
  {
    id: 'khoa-vien',
    label: 'Khối Đơn vị đào tạo (Khoa & Viện)',
    shortDesc: '15 Khoa, Viện chuyên ngành và các đơn vị đào tạo trực thuộc HCM-UTE',
    sampleFrom: 'XXX-DT-GV-01',
    sampleTo: 'CK-DT-GV-01',
    factsText: '18 nhiệm vụ · 52 công việc · 14 VTVL chuẩn giảng dạy & nghiên cứu',
    sourceRule: 'Quy chế Tổ chức và Hoạt động Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)'
  },
  {
    id: 'phong-ban',
    label: 'Khối Đơn vị quản lý HC (Phòng ban)',
    shortDesc: '14 Phòng chức năng, Ban Quản lý Ký túc xá và Trạm Y tế trường',
    sampleFrom: 'XXX-HC-CV-01',
    sampleTo: 'QTTHTT-TT-CV-01',
    factsText: '15 nhiệm vụ · 44 công việc · 12 VTVL tham mưu & quản trị đại học',
    sourceRule: 'Đề án Vị trí việc làm khối hành chính – quản trị HCM-UTE'
  },
  {
    id: 'trung-tam',
    label: 'Khối Trung tâm chức năng & Phân hiệu',
    shortDesc: 'Phân hiệu Bình Phước, Tạp chí Khoa học và các Trung tâm đào tạo, chuyển giao (16 đơn vị)',
    sampleFrom: 'XXX-DV-KT-01',
    sampleTo: 'STKNCCCN-KN-CV-01',
    factsText: '14 nhiệm vụ · 38 công việc · 10 VTVL chuyển giao công nghệ & dịch vụ',
    sourceRule: 'Quy định chức năng nhiệm vụ các Trung tâm & Phân hiệu trực thuộc HCM-UTE'
  },
  {
    id: 'dang-doanthe',
    label: 'Khối Quản trị & Đảng – Đoàn thể',
    shortDesc: 'Văn phòng Đảng ủy, Công đoàn, Đoàn Thanh niên – Hội Sinh viên (3 đơn vị)',
    sampleFrom: 'XXX-CT-CV-01',
    sampleTo: 'VPDU-TC-CV-01',
    factsText: '12 nhiệm vụ · 32 công việc · 9 VTVL công tác Đảng, đoàn thể & quản trị',
    sourceRule: 'Quy định tổ chức bộ máy Đảng ủy, Hội đồng trường và Đoàn thể HCM-UTE'
  }
];

export const HCMUTE_UNITS: HcmuteUnit[] = [
  { code: 'CK', nameVi: 'Khoa Cơ khí', nameEn: 'Faculty of Mechanical Engineering', group: 'khoa-vien', domain: 'fme.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Mechanical Engineering', defaultStaffCount: 78 },
  { code: 'GTNL', nameVi: 'Khoa Giao thông năng lượng', nameEn: 'Faculty of Vehicle and Energy Engineering', group: 'khoa-vien', domain: 'feet.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Vehicle and Energy Engineering', defaultStaffCount: 64 },
  { code: 'DDT', nameVi: 'Khoa Điện - Điện tử', nameEn: 'Faculty of Electrical and Electronics Engineering', group: 'khoa-vien', domain: 'feee.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Electrical and Electronics Engineering', defaultStaffCount: 82 },
  { code: 'CNTT', nameVi: 'Khoa Công nghệ Thông tin', nameEn: 'Faculty of Information Technology', group: 'khoa-vien', domain: 'fit.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Information Technology', defaultStaffCount: 68 },
  { code: 'HHKHSS', nameVi: 'Khoa Hoá học và khoa học sự sống', nameEn: 'Faculty of Chemical and Food Technology', group: 'khoa-vien', domain: 'fcft.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Chemical and Food Technology', defaultStaffCount: 46 },
  { code: 'XD', nameVi: 'Khoa Xây dựng', nameEn: 'Faculty of Civil Engineering', group: 'khoa-vien', domain: 'fce.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Civil Engineering', defaultStaffCount: 52 },
  { code: 'KT', nameVi: 'Khoa Kinh tế', nameEn: 'Faculty of Economics', group: 'khoa-vien', domain: 'fe.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Economics', defaultStaffCount: 54 },
  { code: 'DTTT', nameVi: 'Khoa Đào tạo Tiên tiến', nameEn: 'Faculty of Advanced Education', group: 'khoa-vien', domain: 'fae.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Advanced Education', defaultStaffCount: 38 },
  { code: 'MTTT', nameVi: 'Khoa Mỹ thuật và Truyền thông', nameEn: 'Faculty of Graphic Arts and Media', group: 'khoa-vien', domain: 'fgam.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Graphic Arts and Media', defaultStaffCount: 48 },
  { code: 'CTL', nameVi: 'Khoa Chính trị và Luật', nameEn: 'Faculty of Political Theory and Law', group: 'khoa-vien', domain: 'fpi.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Political Theory and Law', defaultStaffCount: 36 },
  { code: 'KHUD', nameVi: 'Khoa Khoa học Ứng dụng', nameEn: 'Faculty of Applied Sciences', group: 'khoa-vien', domain: 'fas.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Applied Sciences', defaultStaffCount: 44 },
  { code: 'NN', nameVi: 'Khoa Ngoại ngữ', nameEn: 'Faculty of Foreign Languages', group: 'khoa-vien', domain: 'ffl.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Foreign Languages', defaultStaffCount: 42 },
  { code: 'VSPKT', nameVi: 'Viện Sư phạm Kỹ thuật', nameEn: 'Institute of Technical Education', group: 'khoa-vien', domain: 'ite.hcmute.edu.vn', headTitleVi: 'Viện trưởng', headTitleEn: 'Director of the Institute of Technical Education', defaultStaffCount: 30 },
  { code: 'VDTQT', nameVi: 'Viện Đào tạo quốc tế', nameEn: 'Institute of International Education', group: 'khoa-vien', domain: 'iie.hcmute.edu.vn', headTitleVi: 'Viện trưởng', headTitleEn: 'Director of the Institute of International Education', defaultStaffCount: 28 },
  { code: 'SDH', nameVi: 'Viện Sau đại học', nameEn: 'Postgraduate School', group: 'khoa-vien', domain: 'sdh.hcmute.edu.vn', headTitleVi: 'Viện trưởng', headTitleEn: 'Director of the Postgraduate School', defaultStaffCount: 18 },
  { code: 'QTTHTT', nameVi: 'Phòng Quản trị thương hiệu và Truyền thông', nameEn: 'Office of Brand Management and Communications', group: 'phong-ban', domain: 'bmc.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Brand Management and Communications', defaultStaffCount: 18 },
  { code: 'TCNS', nameVi: 'Phòng Tổ chức - Nhân sự', nameEn: 'Office of Organization and Personnel', group: 'phong-ban', domain: 'tcns.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Organization and Personnel', defaultStaffCount: 16 },
  { code: 'DT', nameVi: 'Phòng Đào tạo', nameEn: 'Academic Affairs Office', group: 'phong-ban', domain: 'aao.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Academic Affairs Office', defaultStaffCount: 26 },
  { code: 'QHQT', nameVi: 'Phòng Quan hệ Quốc tế', nameEn: 'International Affairs Office', group: 'phong-ban', domain: 'oia.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of International Affairs', defaultStaffCount: 12 },
  { code: 'QHDN', nameVi: 'Phòng Quan hệ Doanh nghiệp', nameEn: 'Enterprise Relations Office', group: 'phong-ban', domain: 'pr.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Enterprise Relations Office', defaultStaffCount: 12 },
  { code: 'KHTC', nameVi: 'Phòng Kế hoạch Tài chính', nameEn: 'Finance and Planning Office', group: 'phong-ban', domain: 'fpo.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Finance and Planning Office', defaultStaffCount: 22 },
  { code: 'KHCN', nameVi: 'Phòng Khoa học Công nghệ', nameEn: 'Office of Science and Technology', group: 'phong-ban', domain: 'stiao.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Science and Technology', defaultStaffCount: 14 },
  { code: 'HCTH', nameVi: 'Phòng Hành chính - Tổng hợp', nameEn: 'Office of General Administration', group: 'phong-ban', domain: 'uteoffice.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of General Administration', defaultStaffCount: 28 },
  { code: 'CTSV', nameVi: 'Phòng Công tác Sinh viên', nameEn: 'Office of Student Affairs', group: 'phong-ban', domain: 'sao.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Student Affairs', defaultStaffCount: 20 },
  { code: 'KTDBCL', nameVi: 'Phòng Khảo thí và Đảm bảo Chất lượng', nameEn: 'Office of Testing and Quality Assurance', group: 'phong-ban', domain: 'qao.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Testing and Quality Assurance', defaultStaffCount: 16 },
  { code: 'QTCSVC', nameVi: 'Phòng Quản trị cơ sở vật chất', nameEn: 'Office of Facilities Management', group: 'phong-ban', domain: 'emo.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Facilities Management', defaultStaffCount: 32 },
  { code: 'QLDTXDDT', nameVi: 'Phòng Quản lý đầu tư xây dựng và Đấu thầu', nameEn: 'Office of Construction Project Management and Bidding', group: 'phong-ban', domain: 'cpm.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Construction Project Management and Bidding', defaultStaffCount: 14 },
  { code: 'KTX', nameVi: 'Ban Quản lý Ký túc xá', nameEn: 'Dormitory Management Office', group: 'phong-ban', domain: 'ktx.hcmute.edu.vn', headTitleVi: 'Trưởng ban', headTitleEn: 'Director of the Dormitory Management Office', defaultStaffCount: 24 },
  { code: 'TYT', nameVi: 'Trạm Y tế', nameEn: 'Health Care Office', group: 'phong-ban', domain: 'hd.hcmute.edu.vn', headTitleVi: 'Trưởng trạm', headTitleEn: 'Head of the Health Care Office', defaultStaffCount: 10 },
  { code: 'PHBP', nameVi: 'Phân hiệu Trường Đại học Công nghệ Kỹ thuật TP.HCM tại Bình Phước', nameEn: 'HCM-UTE Binh Phuoc Campus', group: 'trung-tam', subType: 'PHAN_HIEU', domain: 'binhphuoc.hcmute.edu.vn', headTitleVi: 'Giám đốc Phân hiệu', headTitleEn: 'Director of Binh Phuoc Campus', defaultStaffCount: 35 },
  { code: 'TCKHGDKT', nameVi: 'Tạp chí Khoa học Giáo dục Kỹ thuật', nameEn: 'Journal of Technical Education Science', group: 'trung-tam', subType: 'TAP_CHI', domain: 'jte.hcmute.edu.vn', headTitleVi: 'Tổng biên tập', headTitleEn: 'Editor-in-Chief of the Journal of Technical Education Science', defaultStaffCount: 8 },
  { code: 'HLDHS', nameVi: 'Trung tâm Học liệu và Dạy học số', nameEn: 'Center for Learning Resources and Digital Learning', group: 'trung-tam', subType: 'HOC_LIEU_SO', domain: 'lib.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Center for Learning Resources and Digital Learning', defaultStaffCount: 26 },
  { code: 'STKNCCCN', nameVi: 'Trung tâm Sáng tạo, Khởi nghiệp và Chuyển giao công nghệ', nameEn: 'Center of Innovation, Startup and Technology Transfer', group: 'trung-tam', subType: 'KHOI_NGHIEP', domain: 'cisat.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Center of Innovation, Startup and Technology Transfer', defaultStaffCount: 14 },
  { code: 'TTTTMT', nameVi: 'Trung tâm Thông tin - Máy tính', nameEn: 'Information and Computer Center', group: 'trung-tam', subType: 'HA_TANG_SO', domain: 'inc.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Information and Computer Center', defaultStaffCount: 16 },
  { code: 'TTCNTT', nameVi: 'Trung tâm Công nghệ thông tin', nameEn: 'Information Technology Center', group: 'trung-tam', subType: 'DAO_TAO_DV', domain: 'itc.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Information Technology Center', defaultStaffCount: 14 },
  { code: 'GDQPAN', nameVi: 'Trung tâm Giáo dục Quốc phòng và An ninh', nameEn: 'National Defense and Security Training Center', group: 'trung-tam', subType: 'DAO_TAO_CHUNG', domain: 'gdqp.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the National Defense and Security Training Center', defaultStaffCount: 20 },
  { code: 'GDTC', nameVi: 'Trung tâm Giáo dục Thể chất', nameEn: 'Physical Education Center', group: 'trung-tam', subType: 'DAO_TAO_CHUNG', domain: 'gdtc.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Physical Education Center', defaultStaffCount: 22 },
  { code: 'CNPM', nameVi: 'Trung tâm Công nghệ phần mềm', nameEn: 'Software Technology Center', group: 'trung-tam', subType: 'NGHIEN_CUU_CG', domain: 'stc.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Software Technology Center', defaultStaffCount: 12 },
  { code: 'THKTTH', nameVi: 'Trường Trung học Kỹ thuật thực hành', nameEn: 'Technical Practice College', group: 'trung-tam', subType: 'DAO_TAO_CHUNG', domain: 'tpc.hcmute.edu.vn', headTitleVi: 'Hiệu trưởng', headTitleEn: 'Principal of the Technical Practice College', defaultStaffCount: 24 },
  { code: 'TTNN', nameVi: 'Trung tâm Ngoại ngữ', nameEn: 'Center for Foreign Languages', group: 'trung-tam', subType: 'DAO_TAO_DV', domain: 'cfl.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Center for Foreign Languages', defaultStaffCount: 15 },
  { code: 'TTVD', nameVi: 'Trung tâm Việt Đức', nameEn: 'Vietnam - Germany Center', group: 'trung-tam', subType: 'HOP_TAC_QT', domain: 'vgc.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Vietnam - Germany Center', defaultStaffCount: 12 },
  { code: 'TTRBTM', nameVi: 'Trung tâm Robot thông minh', nameEn: 'Smart Robotic Center', group: 'trung-tam', subType: 'NGHIEN_CUU_CG', domain: 'src.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Smart Robotic Center', defaultStaffCount: 10 },
  { code: 'TTKTTH', nameVi: 'Trung tâm Kỹ thuật tổng hợp', nameEn: 'Engineering Synthesis Center', group: 'trung-tam', subType: 'NGHIEN_CUU_CG', domain: 'esc.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Engineering Synthesis Center', defaultStaffCount: 12 },
  { code: 'KTCNMT', nameVi: 'Trung tâm Kỹ thuật và Công nghệ môi trường', nameEn: 'Environmental Engineering and Technology Center', group: 'trung-tam', subType: 'NGHIEN_CUU_CG', domain: 'eetc.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Environmental Engineering and Technology Center', defaultStaffCount: 10 },
  { code: 'NCUDKTXD', nameVi: 'Trung tâm Nghiên cứu và Ứng dụng kỹ thuật xây dựng', nameEn: 'Civil Engineering Research and Application Center', group: 'trung-tam', subType: 'NGHIEN_CUU_CG', domain: 'cerac.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Civil Engineering Research and Application Center', defaultStaffCount: 10 },
  { code: 'VPDU', nameVi: 'Văn phòng Đảng ủy', nameEn: 'Office of University Party Committee', group: 'dang-doanthe', domain: 'danguy.hcmute.edu.vn', headTitleVi: 'Bí thư Đảng ủy', headTitleEn: 'Secretary of the Party Committee', defaultStaffCount: 8 },
  { code: 'CDT', nameVi: 'Công đoàn Trường', nameEn: 'University Trade Union', group: 'dang-doanthe', domain: 'congdoan.hcmute.edu.vn', headTitleVi: 'Chủ tịch Công đoàn Trường', headTitleEn: 'President of the University Trade Union', defaultStaffCount: 6 },
  { code: 'DTN', nameVi: 'Đoàn Thanh niên - Hội Sinh viên', nameEn: 'Ho Chi Minh Communist Youth Union & Students Association', group: 'dang-doanthe', domain: 'doanthanhnien.hcmute.edu.vn', headTitleVi: 'Bí thư Đoàn Thanh niên', headTitleEn: 'Secretary of the Ho Chi Minh Communist Youth Union', defaultStaffCount: 9 },
];

export const DELETED_UNIT_CODES = new Set(['IDDF', 'TRTC', 'HDT', 'BGH', 'FFT']);

export const UNIT_CODE_ALIASES: Record<string, string> = {
  FME: 'CK', FEET: 'GTNL', FEEE: 'DDT', FIT: 'CNTT', FCFT: 'HHKHSS',
  FCE: 'XD', FE: 'KT', FAE: 'DTTT', FGAM: 'MTTT', FPI: 'CTL',
  FAS: 'KHUD', FFL: 'NN', ITE: 'VSPKT', IIE: 'VDTQT', CISAT: 'STKNCCCN',
  INC: 'TTTTMT', ITC: 'TTCNTT', STC: 'CNPM', TPC: 'THKTTH', CFL: 'TTNN',
  VGC: 'TTVD', SRC: 'TTRBTM', ESC: 'TTKTTH', EETC: 'KTCNMT', CERAC: 'NCUDKTXD',
  BMC: 'QTTHTT', AAO: 'DT', OIA: 'QHQT', ERO: 'QHDN', FPO: 'KHTC',
  STIAO: 'KHCN', OGA: 'HCTH', SAO: 'CTSV', QAO: 'KTDBCL', EMO: 'QTCSVC',
  CPM: 'QLDTXDDT',
  PKHTC: 'KHTC', PDT: 'DT', PHCTH: 'HCTH', PKHCN: 'KHCN',
  PKTDBCL: 'KTDBCL', PCTSV: 'CTSV', PQTTH: 'QTTHTT', 'PQTTH&TT': 'QTTHTT',
  PQTCSVC: 'QTCSVC', PQLDTXDDT: 'QLDTXDDT', PQHQT: 'QHQT', PQHDN: 'QHDN',
  BQLKTX: 'KTX', BANTT: 'KTX', TTHLDHS: 'HLDHS',
  TTSTKN: 'STKNCCCN', 'TTSTKN&CGCN': 'STKNCCCN', TTCNPM: 'CNPM',
  TTGDQPAN: 'GDQPAN', TTGDTC: 'GDTC', VSDH: 'SDH',
  KDTTT: 'DTTT', FHQ: 'DTTT', KHOA: 'CK',
  FVE: 'GTNL', FGA: 'MTTT', FPT: 'CTL', FLLCT: 'CTL', FFD: 'HHKHSS', FTT: 'HHKHSS'
};

export const QD2266_UNIT_NAMES: Record<string, string> = {
  CK: 'Khoa Cơ khí', FME: 'Khoa Cơ khí',
  GTNL: 'Khoa Giao thông năng lượng', FEET: 'Khoa Giao thông năng lượng',
  DDT: 'Khoa Điện - Điện tử', FEEE: 'Khoa Điện - Điện tử',
  CNTT: 'Khoa Công nghệ Thông tin', FIT: 'Khoa Công nghệ Thông tin',
  HHKHSS: 'Khoa Hoá học và khoa học sự sống', FCFT: 'Khoa Hoá học và khoa học sự sống',
  XD: 'Khoa Xây dựng', FCE: 'Khoa Xây dựng',
  KT: 'Khoa Kinh tế', FE: 'Khoa Kinh tế',
  DTTT: 'Khoa Đào tạo Tiên tiến', FAE: 'Khoa Đào tạo Tiên tiến', KDTTT: 'Khoa Đào tạo Tiên tiến',
  MTTT: 'Khoa Mỹ thuật và Truyền thông', FGAM: 'Khoa Mỹ thuật và Truyền thông',
  CTL: 'Khoa Chính trị và Luật', FPI: 'Khoa Chính trị và Luật',
  KHUD: 'Khoa Khoa học Ứng dụng', FAS: 'Khoa Khoa học Ứng dụng',
  NN: 'Khoa Ngoại ngữ', FFL: 'Khoa Ngoại ngữ',
  VSPKT: 'Viện Sư phạm Kỹ thuật', ITE: 'Viện Sư phạm Kỹ thuật',
  VDTQT: 'Viện Đào tạo quốc tế', IIE: 'Viện Đào tạo quốc tế',
  SDH: 'Viện Sau đại học', VSDH: 'Viện Sau đại học',
  QTTHTT: 'Phòng Quản trị thương hiệu và Truyền thông', BMC: 'Phòng Quản trị thương hiệu và Truyền thông',
  PQTTH: 'Phòng Quản trị thương hiệu và Truyền thông', 'PQTTH&TT': 'Phòng Quản trị thương hiệu và Truyền thông',
  TCNS: 'Phòng Tổ chức - Nhân sự',
  DT: 'Phòng Đào tạo', AAO: 'Phòng Đào tạo', PDT: 'Phòng Đào tạo',
  QHQT: 'Phòng Quan hệ Quốc tế', OIA: 'Phòng Quan hệ Quốc tế', PQHQT: 'Phòng Quan hệ Quốc tế',
  QHDN: 'Phòng Quan hệ Doanh nghiệp', ERO: 'Phòng Quan hệ Doanh nghiệp', PQHDN: 'Phòng Quan hệ Doanh nghiệp',
  KHTC: 'Phòng Kế hoạch Tài chính', FPO: 'Phòng Kế hoạch Tài chính', PKHTC: 'Phòng Kế hoạch Tài chính',
  KHCN: 'Phòng Khoa học Công nghệ', STIAO: 'Phòng Khoa học Công nghệ', PKHCN: 'Phòng Khoa học Công nghệ',
  HCTH: 'Phòng Hành chính - Tổng hợp', OGA: 'Phòng Hành chính - Tổng hợp', PHCTH: 'Phòng Hành chính - Tổng hợp',
  CTSV: 'Phòng Công tác Sinh viên', SAO: 'Phòng Công tác Sinh viên', PCTSV: 'Phòng Công tác Sinh viên',
  KTDBCL: 'Phòng Khảo thí và Đảm bảo Chất lượng', QAO: 'Phòng Khảo thí và Đảm bảo Chất lượng', PKTDBCL: 'Phòng Khảo thí và Đảm bảo Chất lượng',
  QTCSVC: 'Phòng Quản trị cơ sở vật chất', EMO: 'Phòng Quản trị cơ sở vật chất', PQTCSVC: 'Phòng Quản trị cơ sở vật chất',
  QLDTXDDT: 'Phòng Quản lý đầu tư xây dựng và Đấu thầu', CPM: 'Phòng Quản lý đầu tư xây dựng và Đấu thầu', PQLDTXDDT: 'Phòng Quản lý đầu tư xây dựng và Đấu thầu',
  KTX: 'Ban Quản lý Ký túc xá', BQLKTX: 'Ban Quản lý Ký túc xá', BANTT: 'Ban An ninh trật tự',
  TYT: 'Trạm Y tế',
  PHBP: 'Phân hiệu Trường Đại học Công nghệ Kỹ thuật TP.HCM tại Bình Phước',
  TCKHGDKT: 'Tạp chí Khoa học Giáo dục Kỹ thuật',
  HLDHS: 'Trung tâm Học liệu và Dạy học số', TTHLDHS: 'Trung tâm Học liệu và Dạy học số',
  STKNCCCN: 'Trung tâm Sáng tạo, Khởi nghiệp và Chuyển giao công nghệ', CISAT: 'Trung tâm Sáng tạo, Khởi nghiệp và Chuyển giao công nghệ',
  TTSTKN: 'Trung tâm Sáng tạo, Khởi nghiệp và Chuyển giao công nghệ', 'TTSTKN&CGCN': 'Trung tâm Sáng tạo, Khởi nghiệp và Chuyển giao công nghệ',
  TTTTMT: 'Trung tâm Thông tin - Máy tính', INC: 'Trung tâm Thông tin - Máy tính',
  TTCNTT: 'Trung tâm Công nghệ thông tin', ITC: 'Trung tâm Công nghệ thông tin',
  GDQPAN: 'Trung tâm Giáo dục Quốc phòng và An ninh', TTGDQPAN: 'Trung tâm Giáo dục Quốc phòng và An ninh',
  GDTC: 'Trung tâm Giáo dục Thể chất', TTGDTC: 'Trung tâm Giáo dục Thể chất',
  CNPM: 'Trung tâm Công nghệ phần mềm', STC: 'Trung tâm Công nghệ phần mềm', TTCNPM: 'Trung tâm Công nghệ phần mềm',
  THKTTH: 'Trường Trung học Kỹ thuật thực hành', TPC: 'Trường Trung học Kỹ thuật thực hành',
  TTNN: 'Trung tâm Ngoại ngữ', CFL: 'Trung tâm Ngoại ngữ',
  TTVD: 'Trung tâm Việt Đức', VGC: 'Trung tâm Việt Đức',
  TTRBTM: 'Trung tâm Robot thông minh', SRC: 'Trung tâm Robot thông minh',
  TTKTTH: 'Trung tâm Kỹ thuật tổng hợp', ESC: 'Trung tâm Kỹ thuật tổng hợp',
  KTCNMT: 'Trung tâm Kỹ thuật và Công nghệ môi trường', EETC: 'Trung tâm Kỹ thuật và Công nghệ môi trường',
  NCUDKTXD: 'Trung tâm Nghiên cứu và Ứng dụng kỹ thuật xây dựng', CERAC: 'Trung tâm Nghiên cứu và Ứng dụng kỹ thuật xây dựng',
  VPDU: 'Văn phòng Đảng ủy', CDT: 'Công đoàn Trường', DTN: 'Đoàn Thanh niên - Hội Sinh viên'
};

export function getActiveHcmuteUnits(): HcmuteUnit[] {
  let list: HcmuteUnit[] | null = null;
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('hcmute_vtvl_custom_units_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      }
    } catch { /* fallback */ }
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getServerUnits } = require('@/services/storage/server-unit-store');
      const sUnits = getServerUnits();
      if (Array.isArray(sUnits) && sUnits.length > 0) list = sUnits;
    } catch { /* fallback */ }
  }
  if (!list || list.length === 0) return HCMUTE_UNITS;
  const filtered = list.filter((u) => u && u.code && !DELETED_UNIT_CODES.has(u.code.toUpperCase()));
  return filtered.length > 0 ? filtered : HCMUTE_UNITS;
}

export function findHcmuteUnit(codeOrName?: string): HcmuteUnit {
  const units = getActiveHcmuteUnits();
  if (!codeOrName) return units[0] || HCMUTE_UNITS[0];
  const query = codeOrName.trim().toUpperCase();
  const canonicalCode = UNIT_CODE_ALIASES[query] || query;
  const direct = units.find((u) => u.code.toUpperCase() === canonicalCode) || units.find((u) => u.code.toUpperCase() === query);
  if (direct) {
    const customName = QD2266_UNIT_NAMES[query] || direct.nameVi;
    return Object.assign({}, direct, { nameVi: customName });
  }
  const byName = units.find((u) =>
    u.nameVi.toUpperCase().includes(query) || query.includes(u.nameVi.toUpperCase())
  );
  return byName || units[0] || HCMUTE_UNITS[0];
}

export interface GroupedUnitCategory {
  groupLabel: string;
  units: HcmuteUnit[];
}

export function getGroupedHcmuteUnits(): GroupedUnitCategory[] {
  const units = getActiveHcmuteUnits();
  const groupMeta: { id: UnitGroupKind; label: string }[] = [
    { id: 'khoa-vien', label: 'Khối Đơn vị đào tạo (15 Khoa & Viện)' },
    { id: 'phong-ban', label: 'Khối Đơn vị quản lý hành chính (14 Phòng ban)' },
    { id: 'trung-tam', label: 'Khối Trung tâm chức năng & Phân hiệu (16 đơn vị)' },
    { id: 'dang-doanthe', label: 'Khối Quản trị & Đảng – Đoàn thể (3 đơn vị)' }
  ];
  return groupMeta.map((g) => ({
    groupLabel: g.label,
    units: units.filter((u) => u.group === g.id)
  }));
}

export function getFlatHcmuteUnitOptions(): { value: string; label: string; description?: string }[] {
  return getGroupedHcmuteUnits().flatMap((g) =>
    g.units.map((u) => ({
      value: u.code,
      label: `[${u.code}] ${u.nameVi}`,
      description: g.groupLabel
    }))
  );
}
