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
    label: 'Khối Đơn vị quản lý HC (Phòng & Ban)',
    shortDesc: '15 Phòng, Ban chức năng, Ban quản lý Ký túc xá, Ban An ninh trật tự và Trạm Y tế',
    sampleFrom: 'XXX-HC-CV-01',
    sampleTo: 'QTTHTT-TT-CV-01',
    factsText: '15 nhiệm vụ · 44 công việc · 12 VTVL tham mưu & quản trị đại học',
    sourceRule: 'Đề án Vị trí việc làm khối hành chính – quản trị HCM-UTE'
  },
  {
    id: 'trung-tam',
    label: 'Khối Trung tâm, Phân hiệu & Tạp chí',
    shortDesc: '06 Trung tâm chức năng, Phân hiệu tại Bình Phước và Tạp chí Khoa học giáo dục kỹ thuật (08 đơn vị)',
    sampleFrom: 'XXX-DV-KT-01',
    sampleTo: 'STKNCCCN-KN-CV-01',
    factsText: '14 nhiệm vụ · 38 công việc · 10 VTVL chuyển giao công nghệ & dịch vụ',
    sourceRule: 'Quy định chức năng nhiệm vụ các Trung tâm, Phân hiệu & Tạp chí trực thuộc HCM-UTE'
  },
  {
    id: 'dang-doanthe',
    label: 'Khối Quản trị & Đảng – Đoàn thể',
    shortDesc: 'Văn phòng Đảng ủy trực thuộc Trường Đại học Công nghệ Kỹ thuật TP.HCM (01 đơn vị)',
    sampleFrom: 'XXX-CT-CV-01',
    sampleTo: 'VPDU-TC-CV-01',
    factsText: '12 nhiệm vụ · 32 công việc · 9 VTVL công tác Đảng & quản trị',
    sourceRule: 'Quy định tổ chức bộ máy Đảng ủy Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)'
  }
];

/**
 * Danh mục chính thức 39 đơn vị hoạt động của Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)
 * Đối chiếu chính xác theo nguồn chuẩn: v2DS phan quyen (1).xls (cột G:I, dòng 2..40).
 * Đã loại bỏ BGH, HDT, TTNN và các trung tâm/đoàn thể ngoài danh mục hoạt động; giữ Ban An ninh trật tự (BANTT).
 */
export const HCMUTE_UNITS: HcmuteUnit[] = [
  // 1. Khối Khoa / Viện (15 đơn vị)
  { code: 'CTL', nameVi: 'Khoa Chính trị và Luật', nameEn: 'Faculty of Political Theory and Law', group: 'khoa-vien', domain: 'fpi.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Political Theory and Law', defaultStaffCount: 36 },
  { code: 'CK', nameVi: 'Khoa Cơ khí', nameEn: 'Faculty of Mechanical Engineering', group: 'khoa-vien', domain: 'fme.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Mechanical Engineering', defaultStaffCount: 78 },
  { code: 'CNTT', nameVi: 'Khoa Công nghệ Thông tin', nameEn: 'Faculty of Information Technology', group: 'khoa-vien', domain: 'fit.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Information Technology', defaultStaffCount: 68 },
  { code: 'DTTT', nameVi: 'Khoa Đào tạo Tiên tiến', nameEn: 'Faculty of Advanced Education', group: 'khoa-vien', domain: 'fae.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Advanced Education', defaultStaffCount: 38 },
  { code: 'DDT', nameVi: 'Khoa Điện - Điện tử', nameEn: 'Faculty of Electrical and Electronics Engineering', group: 'khoa-vien', domain: 'feee.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Electrical and Electronics Engineering', defaultStaffCount: 82 },
  { code: 'GTNL', nameVi: 'Khoa Giao thông và Năng lượng', nameEn: 'Faculty of Vehicle and Energy Engineering', group: 'khoa-vien', domain: 'feet.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Vehicle and Energy Engineering', defaultStaffCount: 64 },
  { code: 'HHKHSS', nameVi: 'Khoa Hóa học và Khoa học sự sống', nameEn: 'Faculty of Chemical and Food Technology', group: 'khoa-vien', domain: 'fcft.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Chemical and Food Technology', defaultStaffCount: 46 },
  { code: 'KHUD', nameVi: 'Khoa Khoa học ứng dụng', nameEn: 'Faculty of Applied Sciences', group: 'khoa-vien', domain: 'fas.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Applied Sciences', defaultStaffCount: 44 },
  { code: 'KT', nameVi: 'Khoa Kinh tế', nameEn: 'Faculty of Economics', group: 'khoa-vien', domain: 'fe.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Economics', defaultStaffCount: 54 },
  { code: 'MTTT', nameVi: 'Khoa Mỹ thuật và Truyền thông', nameEn: 'Faculty of Graphic Arts and Media', group: 'khoa-vien', domain: 'fgam.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Graphic Arts and Media', defaultStaffCount: 48 },
  { code: 'NN', nameVi: 'Khoa Ngoại ngữ', nameEn: 'Faculty of Foreign Languages', group: 'khoa-vien', domain: 'ffl.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Foreign Languages', defaultStaffCount: 42 },
  { code: 'XD', nameVi: 'Khoa Xây dựng', nameEn: 'Faculty of Civil Engineering', group: 'khoa-vien', domain: 'fce.hcmute.edu.vn', headTitleVi: 'Trưởng khoa', headTitleEn: 'Dean of the Faculty of Civil Engineering', defaultStaffCount: 52 },
  { code: 'VSPKT', nameVi: 'Viện Sư phạm kỹ thuật', nameEn: 'Institute of Technical Education', group: 'khoa-vien', domain: 'ite.hcmute.edu.vn', headTitleVi: 'Viện trưởng', headTitleEn: 'Director of the Institute of Technical Education', defaultStaffCount: 30 },
  { code: 'VDTQT', nameVi: 'Viện Đào tạo Quốc tế', nameEn: 'Institute of International Education', group: 'khoa-vien', domain: 'iie.hcmute.edu.vn', headTitleVi: 'Viện trưởng', headTitleEn: 'Director of the Institute of International Education', defaultStaffCount: 28 },
  { code: 'SDH', nameVi: 'Viện Sau Đại học', nameEn: 'Postgraduate School', group: 'khoa-vien', domain: 'sdh.hcmute.edu.vn', headTitleVi: 'Viện trưởng', headTitleEn: 'Director of the Postgraduate School', defaultStaffCount: 18 },

  // 2. Khối Phòng / Ban (15 đơn vị hành chính + 1 Văn phòng Đảng ủy = 16 đơn vị P/B theo bảng chuẩn)
  { code: 'BANTT', nameVi: 'Ban An ninh trật tự', nameEn: 'Office of Campus Security and Order', group: 'phong-ban', domain: 'bantt.hcmute.edu.vn', headTitleVi: 'Trưởng ban', headTitleEn: 'Director of the Office of Campus Security and Order', defaultStaffCount: 30 },
  { code: 'KTX', nameVi: 'Ban quản lý Ký túc xá', nameEn: 'Dormitory Management Office', group: 'phong-ban', domain: 'ktx.hcmute.edu.vn', headTitleVi: 'Trưởng ban', headTitleEn: 'Director of the Dormitory Management Office', defaultStaffCount: 24 },
  { code: 'CTSV', nameVi: 'Phòng Công tác Sinh viên', nameEn: 'Office of Student Affairs', group: 'phong-ban', domain: 'sao.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Student Affairs', defaultStaffCount: 20 },
  { code: 'DT', nameVi: 'Phòng Đào tạo', nameEn: 'Academic Affairs Office', group: 'phong-ban', domain: 'aao.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Academic Affairs Office', defaultStaffCount: 26 },
  { code: 'HCTH', nameVi: 'Phòng Hành chính - Tổng hợp', nameEn: 'Office of General Administration', group: 'phong-ban', domain: 'uteoffice.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of General Administration', defaultStaffCount: 28 },
  { code: 'KHTC', nameVi: 'Phòng Kế hoạch Tài chính', nameEn: 'Finance and Planning Office', group: 'phong-ban', domain: 'fpo.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Finance and Planning Office', defaultStaffCount: 22 },
  { code: 'KTDBCL', nameVi: 'Phòng Khảo thí và Đảm bảo chất lượng', nameEn: 'Office of Testing and Quality Assurance', group: 'phong-ban', domain: 'qao.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Testing and Quality Assurance', defaultStaffCount: 16 },
  { code: 'KHCN', nameVi: 'Phòng Khoa học Công nghệ', nameEn: 'Office of Science and Technology', group: 'phong-ban', domain: 'stiao.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Science and Technology', defaultStaffCount: 14 },
  { code: 'QHDN', nameVi: 'Phòng Quan hệ Doanh nghiệp', nameEn: 'Enterprise Relations Office', group: 'phong-ban', domain: 'pr.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Enterprise Relations Office', defaultStaffCount: 12 },
  { code: 'QHQT', nameVi: 'Phòng Quan hệ Quốc tế', nameEn: 'International Affairs Office', group: 'phong-ban', domain: 'oia.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of International Affairs', defaultStaffCount: 12 },
  { code: 'QLDTXDDT', nameVi: 'Phòng Quản lý Đầu tư xây dựng và Đấu thầu', nameEn: 'Office of Construction Project Management and Bidding', group: 'phong-ban', domain: 'cpm.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Construction Project Management and Bidding', defaultStaffCount: 14 },
  { code: 'QTCSVC', nameVi: 'Phòng Quản trị Cơ sở vật chất', nameEn: 'Office of Facilities Management', group: 'phong-ban', domain: 'emo.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Facilities Management', defaultStaffCount: 32 },
  { code: 'QTTHTT', nameVi: 'Phòng Quản trị thương hiệu và Truyền thông', nameEn: 'Office of Brand Management and Communications', group: 'phong-ban', domain: 'bmc.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Brand Management and Communications', defaultStaffCount: 18 },
  { code: 'TCNS', nameVi: 'Phòng Tổ chức - Nhân sự', nameEn: 'Office of Organization and Personnel', group: 'phong-ban', domain: 'tcns.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director of the Office of Organization and Personnel', defaultStaffCount: 16 },
  { code: 'TYT', nameVi: 'Trạm Y tế', nameEn: 'Health Care Office', group: 'phong-ban', domain: 'hd.hcmute.edu.vn', headTitleVi: 'Trưởng trạm', headTitleEn: 'Director of the Health Care Office', defaultStaffCount: 10 },
  { code: 'VPDU', nameVi: 'Văn phòng Đảng ủy', nameEn: 'Office of University Party Committee', group: 'dang-doanthe', domain: 'danguy.hcmute.edu.vn', headTitleVi: 'Bí thư Đảng ủy', headTitleEn: 'Secretary of the Party Committee', defaultStaffCount: 8 },

  // 3. Khối Trung tâm, Phân hiệu & Tạp chí (8 đơn vị)
  { code: 'CNPM', nameVi: 'Trung tâm Công nghệ phần mềm', nameEn: 'Software Technology Center', group: 'trung-tam', subType: 'NGHIEN_CUU_CG', domain: 'stc.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Software Technology Center', defaultStaffCount: 12 },
  { code: 'GDQPAN', nameVi: 'Trung tâm Giáo dục Quốc phòng và An ninh', nameEn: 'National Defense and Security Training Center', group: 'trung-tam', subType: 'DAO_TAO_CHUNG', domain: 'gdqp.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the National Defense and Security Training Center', defaultStaffCount: 20 },
  { code: 'GDTC', nameVi: 'Trung tâm Giáo dục Thể chất', nameEn: 'Physical Education Center', group: 'trung-tam', subType: 'DAO_TAO_CHUNG', domain: 'gdtc.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Physical Education Center', defaultStaffCount: 22 },
  { code: 'HLDHS', nameVi: 'Trung tâm Học liệu và Dạy học số', nameEn: 'Center for Learning Resources and Digital Learning', group: 'trung-tam', subType: 'HOC_LIEU_SO', domain: 'lib.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Center for Learning Resources and Digital Learning', defaultStaffCount: 26 },
  { code: 'STKNCCCN', nameVi: 'Trung tâm Sáng tạo khởi nghiệp và Chuyển giao công nghệ', nameEn: 'Center of Innovation, Startup and Technology Transfer', group: 'trung-tam', subType: 'KHOI_NGHIEP', domain: 'cisat.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Center of Innovation, Startup and Technology Transfer', defaultStaffCount: 14 },
  { code: 'TTTTMT', nameVi: 'Trung tâm Thông tin - Máy tính', nameEn: 'Information and Computer Center', group: 'trung-tam', subType: 'HA_TANG_SO', domain: 'inc.hcmute.edu.vn', headTitleVi: 'Giám đốc trung tâm', headTitleEn: 'Director of the Information and Computer Center', defaultStaffCount: 16 },
  { code: 'PHBP', nameVi: 'Phân hiệu Trường ĐH CNKT TPHCM tại Bình Phước', nameEn: 'HCM-UTE Binh Phuoc Campus', group: 'trung-tam', subType: 'PHAN_HIEU', domain: 'binhphuoc.hcmute.edu.vn', headTitleVi: 'Giám đốc Phân hiệu', headTitleEn: 'Director of Binh Phuoc Campus', defaultStaffCount: 35 },
  { code: 'TCKHGDKT', nameVi: 'Tạp chí Khoa học giáo dục kỹ thuật', nameEn: 'Journal of Technical Education Science', group: 'trung-tam', subType: 'TAP_CHI', domain: 'jte.hcmute.edu.vn', headTitleVi: 'Tổng biên tập', headTitleEn: 'Editor-in-Chief of the Journal of Technical Education Science', defaultStaffCount: 8 }
];

export const DELETED_UNIT_CODES = new Set([
  'IDDF', 'TRTC', 'HDT', 'BGH', 'FFT',
  'TTNN', 'TTVD', 'TTRBTM', 'TTKTTH', 'KTCNMT', 'NCUDKTXD', 'THKTTH', 'TTCNTT', 'CDT', 'DTN'
]);

/**
 * Danh mục lưu trữ các đơn vị lịch sử đã ngừng hoạt động trong danh mục 39 đơn vị
 * để tra cứu tên hiển thị cho dữ liệu cũ mà không đưa vào danh sách đơn vị hoạt động.
 */
export const INACTIVE_HISTORICAL_UNITS: Record<string, string> = {
  BGH: 'Ban Giám hiệu (Ngoài danh mục 39 đơn vị)',
  HDT: 'Hội đồng trường (Đã giải thể / Ngoài danh mục)',
  TTNN: 'Trung tâm Ngoại ngữ (Ngoài danh mục 39 đơn vị)',
  TTVD: 'Trung tâm Việt Đức',
  TTRBTM: 'Trung tâm Robot thông minh',
  TTKTTH: 'Trung tâm Kỹ thuật tổng hợp',
  KTCNMT: 'Trung tâm Kỹ thuật và Công nghệ môi trường',
  NCUDKTXD: 'Trung tâm Nghiên cứu và Ứng dụng kỹ thuật xây dựng',
  THKTTH: 'Trường Trung học Kỹ thuật thực hành',
  TTCNTT: 'Trung tâm Công nghệ thông tin',
  CDT: 'Công đoàn Trường',
  DTN: 'Đoàn Thanh niên - Hội Sinh viên'
};

export const UNIT_CODE_ALIASES: Record<string, string> = {
  FME: 'CK', FEET: 'GTNL', FEEE: 'DDT', FIT: 'CNTT', FCFT: 'HHKHSS',
  FCE: 'XD', FE: 'KT', FAE: 'DTTT', FGAM: 'MTTT', FPI: 'CTL',
  FAS: 'KHUD', FFL: 'NN', ITE: 'VSPKT', IIE: 'VDTQT', CISAT: 'STKNCCCN',
  INC: 'TTTTMT', STC: 'CNPM', BMC: 'QTTHTT', AAO: 'DT', OIA: 'QHQT',
  ERO: 'QHDN', FPO: 'KHTC', STIAO: 'KHCN', OGA: 'HCTH', SAO: 'CTSV',
  QAO: 'KTDBCL', EMO: 'QTCSVC', CPM: 'QLDTXDDT',
  PKHTC: 'KHTC', PDT: 'DT', PHCTH: 'HCTH', PKHCN: 'KHCN',
  PKTDBCL: 'KTDBCL', PCTSV: 'CTSV', PQTTH: 'QTTHTT', 'PQTTH&TT': 'QTTHTT',
  PQTCSVC: 'QTCSVC', PQLDTXDDT: 'QLDTXDDT', PQHQT: 'QHQT', PQHDN: 'QHDN',
  BQLKTX: 'KTX', BANTT: 'BANTT', TTHLDHS: 'HLDHS',
  TTSTKN: 'STKNCCCN', 'TTSTKN&CGCN': 'STKNCCCN', TTCNPM: 'CNPM',
  TTGDQPAN: 'GDQPAN', TTGDTC: 'GDTC', VSDH: 'SDH',
  KDTTT: 'DTTT', FHQ: 'DTTT', KHOA: 'CK',
  FVE: 'GTNL', FGA: 'MTTT', FPT: 'CTL', FLLCT: 'CTL', FFD: 'HHKHSS', FTT: 'HHKHSS',
  'BAN AN NINH TRẬT TỰ': 'BANTT',
  'KHOA GIAO THÔNG VÀ NĂNG LƯỢNG': 'GTNL',
  'KHOA HÓA HỌC VÀ KHOA HỌC SỰ SỐNG': 'HHKHSS',
  'PHÂN HIỆU TRƯỜNG ĐH CNKT TPHCM TẠI BÌNH PHƯỚC': 'PHBP',
  'TRUNG TÂM SÁNG TẠO KHỞI NGHIỆP VÀ CHUYỂN GIAO CÔNG NGHỆ': 'STKNCCCN'
};

export const QD2266_UNIT_NAMES: Record<string, string> = Object.fromEntries([
  ...HCMUTE_UNITS.map((u) => [u.code, u.nameVi]),
  ...Object.entries(UNIT_CODE_ALIASES).map(([alias, code]) => {
    const found = HCMUTE_UNITS.find((u) => u.code === code);
    return [alias, found ? found.nameVi : code];
  }),
  ...Object.entries(INACTIVE_HISTORICAL_UNITS)
]);

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
  const activeSet = new Set(HCMUTE_UNITS.map((u) => u.code));
  const filtered = list.filter((u) => u && u.code && activeSet.has(u.code.toUpperCase()) && !DELETED_UNIT_CODES.has(u.code.toUpperCase()));
  return filtered.length === HCMUTE_UNITS.length ? filtered : HCMUTE_UNITS;
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
    { id: 'phong-ban', label: 'Khối Đơn vị quản lý hành chính (15 Phòng & Ban)' },
    { id: 'trung-tam', label: 'Khối Trung tâm, Phân hiệu & Tạp chí (08 đơn vị)' },
    { id: 'dang-doanthe', label: 'Khối Quản trị & Đảng – Đoàn thể (01 đơn vị)' }
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
