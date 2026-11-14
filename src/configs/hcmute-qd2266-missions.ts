/**
 * src/configs/hcmute-qd2266-missions.ts
 * Bóc tách và quản lý Danh mục Nhiệm vụ (Biểu 1. A1_NhiemVu) từ Quyết định số 2266/QĐ-ĐHCNKT
 * ngày 23/6/2026 cho 28 đơn vị và toàn bộ các Khoa, Viện, Phòng ban thuộc HCM-UTE.
 */

import qd2266DataRaw from './hcmute-qd2266-missions.json';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { HCMUTE_UNITS, findHcmuteUnit } from './hcmute-units';

export interface Qd2266MissionRecord {
  maNhiemVu: string;
  tenNhiemVu: string;
  coQuan: string;
  canCu: string;
  ky: string;
  trangThai: string;
  nguon: string;
  plNum?: number;
  secNum?: string;
  bulletNum?: number;
}

export interface Qd2266UnitRecord {
  plNum: number;
  unitCode: string;
  unitName: string;
  missions: Qd2266MissionRecord[];
}

export const QD2266_UNITS_DATA = qd2266DataRaw as Record<string, Qd2266UnitRecord>;

export interface GroupedUnitOption {
  code: string;
  nameVi: string;
  plNum?: number;
  plLabel?: string;
}

export interface UnitGroupCategory {
  groupLabel: string;
  units: GroupedUnitOption[];
}

/**
 * Danh mục chuẩn đầy đủ các Khoa, Viện, Phòng ban, Trung tâm theo 4 khối của HCM-UTE
 */
export const QD2266_GROUPED_UNITS_CATALOG: UnitGroupCategory[] = [
  {
    groupLabel: 'Khối Đơn vị đào tạo (15 Khoa & Viện đào tạo)',
    units: [
      { code: 'CK', nameVi: 'Khoa Cơ khí', plNum: 1, plLabel: 'PL01' },
      { code: 'GTNL', nameVi: 'Khoa Giao thông năng lượng', plNum: 1, plLabel: 'PL01' },
      { code: 'DDT', nameVi: 'Khoa Điện - Điện tử', plNum: 1, plLabel: 'PL01' },
      { code: 'CNTT', nameVi: 'Khoa Công nghệ Thông tin', plNum: 1, plLabel: 'PL01' },
      { code: 'HHKHSS', nameVi: 'Khoa Hoá học và khoa học sự sống', plNum: 1, plLabel: 'PL01' },
      { code: 'XD', nameVi: 'Khoa Xây dựng', plNum: 1, plLabel: 'PL01' },
      { code: 'KT', nameVi: 'Khoa Kinh tế', plNum: 1, plLabel: 'PL01' },
      { code: 'DTTT', nameVi: 'Khoa Đào tạo Tiên tiến', plNum: 2, plLabel: 'PL02' },
      { code: 'MTTT', nameVi: 'Khoa Mỹ thuật và Truyền thông', plNum: 1, plLabel: 'PL01' },
      { code: 'CTL', nameVi: 'Khoa Chính trị và Luật', plNum: 1, plLabel: 'PL01' },
      { code: 'KHUD', nameVi: 'Khoa Khoa học Ứng dụng', plNum: 1, plLabel: 'PL01' },
      { code: 'NN', nameVi: 'Khoa Ngoại ngữ', plNum: 1, plLabel: 'PL01' },
      { code: 'VSPKT', nameVi: 'Viện Sư phạm Kỹ thuật', plNum: 1, plLabel: 'PL01' },
      { code: 'VDTQT', nameVi: 'Viện Đào tạo quốc tế', plNum: 25, plLabel: 'PL25' },
      { code: 'SDH', nameVi: 'Viện Sau đại học', plNum: 26, plLabel: 'PL26' }
    ]
  },
  {
    groupLabel: 'Khối Đơn vị quản lý hành chính (14 Phòng ban)',
    units: [
      { code: 'TCNS', nameVi: 'Phòng Tổ chức - Nhân sự', plNum: 18, plLabel: 'PL18' },
      { code: 'DT', nameVi: 'Phòng Đào tạo', plNum: 8, plLabel: 'PL08' },
      { code: 'HCTH', nameVi: 'Phòng Hành chính - Tổng hợp', plNum: 9, plLabel: 'PL09' },
      { code: 'KHTC', nameVi: 'Phòng Kế hoạch Tài chính', plNum: 11, plLabel: 'PL11' },
      { code: 'KHCN', nameVi: 'Phòng Khoa học Công nghệ', plNum: 12, plLabel: 'PL12' },
      { code: 'KTDBCL', nameVi: 'Phòng Khảo thí và Đảm bảo Chất lượng', plNum: 10, plLabel: 'PL10' },
      { code: 'CTSV', nameVi: 'Phòng Công tác Sinh viên', plNum: 7, plLabel: 'PL07' },
      { code: 'QTTHTT', nameVi: 'Phòng Quản trị thương hiệu và Truyền thông', plNum: 16, plLabel: 'PL16' },
      { code: 'QTCSVC', nameVi: 'Phòng Quản trị cơ sở vật chất', plNum: 17, plLabel: 'PL17' },
      { code: 'QLDTXDDT', nameVi: 'Phòng Quản lý đầu tư xây dựng và Đấu thầu', plNum: 13, plLabel: 'PL13' },
      { code: 'QHQT', nameVi: 'Phòng Quan hệ Quốc tế', plNum: 14, plLabel: 'PL14' },
      { code: 'QHDN', nameVi: 'Phòng Quan hệ Doanh nghiệp', plNum: 15, plLabel: 'PL15' },
      { code: 'KTX', nameVi: 'Ban Quản lý Ký túc xá', plNum: 6, plLabel: 'PL06' },
      { code: 'TYT', nameVi: 'Trạm Y tế', plNum: 19, plLabel: 'PL19' }
    ]
  },
  {
    groupLabel: 'Khối Trung tâm chức năng & Phân hiệu (16 đơn vị)',
    units: [
      { code: 'PHBP', nameVi: 'Phân hiệu Trường Đại học Công nghệ Kỹ thuật TP.HCM tại Bình Phước', plNum: 28, plLabel: 'PL28' },
      { code: 'TCKHGDKT', nameVi: 'Tạp chí Khoa học Giáo dục Kỹ thuật', plNum: 20, plLabel: 'PL20' },
      { code: 'HLDHS', nameVi: 'Trung tâm Học liệu và Dạy học số', plNum: 22, plLabel: 'PL22' },
      { code: 'STKNCCCN', nameVi: 'Trung tâm Sáng tạo, Khởi nghiệp và Chuyển giao công nghệ', plNum: 23, plLabel: 'PL23' },
      { code: 'TTTTMT', nameVi: 'Trung tâm Thông tin - Máy tính', plNum: 24, plLabel: 'PL24' },
      { code: 'TTCNTT', nameVi: 'Trung tâm Công nghệ thông tin', plNum: 21, plLabel: 'PL21' },
      { code: 'GDQPAN', nameVi: 'Trung tâm Giáo dục Quốc phòng và An ninh', plNum: 4, plLabel: 'PL04' },
      { code: 'GDTC', nameVi: 'Trung tâm Giáo dục Thể chất', plNum: 3, plLabel: 'PL03' },
      { code: 'CNPM', nameVi: 'Trung tâm Công nghệ phần mềm', plNum: 21, plLabel: 'PL21' },
      { code: 'THKTTH', nameVi: 'Trường Trung học Kỹ thuật thực hành', plNum: 1, plLabel: 'PL01' },
      { code: 'TTNN', nameVi: 'Trung tâm Ngoại ngữ', plNum: 1, plLabel: 'PL01' },
      { code: 'TTVD', nameVi: 'Trung tâm Việt Đức', plNum: 1, plLabel: 'PL01' },
      { code: 'TTRBTM', nameVi: 'Trung tâm Robot thông minh', plNum: 1, plLabel: 'PL01' },
      { code: 'TTKTTH', nameVi: 'Trung tâm Kỹ thuật tổng hợp', plNum: 1, plLabel: 'PL01' },
      { code: 'KTCNMT', nameVi: 'Trung tâm Kỹ thuật và Công nghệ môi trường', plNum: 1, plLabel: 'PL01' },
      { code: 'NCUDKTXD', nameVi: 'Trung tâm Nghiên cứu và Ứng dụng kỹ thuật xây dựng', plNum: 1, plLabel: 'PL01' }
    ]
  },
  {
    groupLabel: 'Khối Quản trị & Đảng - Đoàn thể (3 đơn vị)',
    units: [
      { code: 'VPDU', nameVi: 'Văn phòng Đảng ủy', plNum: 27, plLabel: 'PL27' },
      { code: 'CDT', nameVi: 'Công đoàn Trường' },
      { code: 'DTN', nameVi: 'Đoàn Thanh niên - Hội Sinh viên' }
    ]
  }
];

export const QD2266_28_UNITS_CATALOG: { plNum: number; code: string; nameVi: string }[] = [
  { plNum: 1, code: 'KHOA', nameVi: 'Các Khoa, Viện đào tạo' },
  { plNum: 2, code: 'KDTTT', nameVi: 'Khoa Đào tạo tiên tiến' },
  { plNum: 3, code: 'TTGDTC', nameVi: 'Trung tâm Giáo dục thể chất' },
  { plNum: 4, code: 'TTGDQPAN', nameVi: 'Trung tâm Giáo dục Quốc phòng và An ninh' },
  { plNum: 5, code: 'BANTT', nameVi: 'Ban An ninh trật tự' },
  { plNum: 6, code: 'BQLKTX', nameVi: 'Ban Quản lý ký túc xá' },
  { plNum: 7, code: 'PCTSV', nameVi: 'Phòng Công tác sinh viên' },
  { plNum: 8, code: 'PDT', nameVi: 'Phòng Đào tạo' },
  { plNum: 9, code: 'PHCTH', nameVi: 'Phòng Hành chính - Tổng hợp' },
  { plNum: 10, code: 'PKTDBCL', nameVi: 'Phòng Khảo thí và Đảm bảo chất lượng' },
  { plNum: 11, code: 'PKHTC', nameVi: 'Phòng Kế hoạch Tài chính' },
  { plNum: 12, code: 'PKHCN', nameVi: 'Phòng Khoa học Công nghệ' },
  { plNum: 13, code: 'PQLDTXDDT', nameVi: 'Phòng Quản lý đầu tư xây dựng và Đấu thầu' },
  { plNum: 14, code: 'PQHQT', nameVi: 'Phòng Quan hệ Quốc tế' },
  { plNum: 15, code: 'PQHDN', nameVi: 'Phòng Quan hệ Doanh nghiệp' },
  { plNum: 16, code: 'PQTTH&TT', nameVi: 'Phòng Quản trị thương hiệu và Truyền thông' },
  { plNum: 17, code: 'PQTCSVC', nameVi: 'Phòng Quản trị cơ sở vật chất' },
  { plNum: 18, code: 'TCNS', nameVi: 'Phòng Tổ chức - Nhân sự' },
  { plNum: 19, code: 'TYT', nameVi: 'Trạm Y tế' },
  { plNum: 20, code: 'TCKHGDKT', nameVi: 'Tạp chí Khoa học Giáo dục Kỹ thuật' },
  { plNum: 21, code: 'TTCNPM', nameVi: 'Trung tâm Công nghệ phần mềm' },
  { plNum: 22, code: 'TTHLDHS', nameVi: 'Trung tâm Học liệu và Dạy học số' },
  { plNum: 23, code: 'TTSTKN&CGCN', nameVi: 'Trung tâm Sáng tạo khởi nghiệp và Chuyển giao công nghệ' },
  { plNum: 24, code: 'TTTTMT', nameVi: 'Trung tâm Thông tin - Máy tính' },
  { plNum: 25, code: 'VDTQT', nameVi: 'Viện Đào tạo quốc tế' },
  { plNum: 26, code: 'VSDH', nameVi: 'Viện Sau đại học' },
  { plNum: 27, code: 'VPDU', nameVi: 'Văn phòng Đảng ủy' },
  { plNum: 28, code: 'PHBP', nameVi: 'Phân hiệu Trường ĐHCNKT TP.HCM tại Bình Phước' }
];

export const UNIT_ALIAS_TO_QD2266: Record<string, string> = {
  // Phòng ban chức năng
  DT: 'PDT', AAO: 'PDT', PDT: 'PDT',
  QTTHTT: 'PQTTH&TT', BMC: 'PQTTH&TT', PQTTH: 'PQTTH&TT', 'PQTTH&TT': 'PQTTH&TT',
  TCNS: 'TCNS',
  QHQT: 'PQHQT', OIA: 'PQHQT', PQHQT: 'PQHQT',
  QHDN: 'PQHDN', ERO: 'PQHDN', PQHDN: 'PQHDN',
  KHTC: 'PKHTC', FPO: 'PKHTC', PKHTC: 'PKHTC',
  KHCN: 'PKHCN', STIAO: 'PKHCN', PKHCN: 'PKHCN',
  HCTH: 'PHCTH', OGA: 'PHCTH', PHCTH: 'PHCTH',
  CTSV: 'PCTSV', SAO: 'PCTSV', PCTSV: 'PCTSV',
  KTDBCL: 'PKTDBCL', QAO: 'PKTDBCL', PKTDBCL: 'PKTDBCL',
  QTCSVC: 'PQTCSVC', EMO: 'PQTCSVC', PQTCSVC: 'PQTCSVC',
  QLDTXDDT: 'PQLDTXDDT', CPM: 'PQLDTXDDT', PQLDTXDDT: 'PQLDTXDDT',
  KTX: 'BQLKTX', BQLKTX: 'BQLKTX', BANTT: 'BANTT',
  TYT: 'TYT',
  // Trung tâm & Phân hiệu
  PHBP: 'PHBP',
  HLDHS: 'TTHLDHS', TTHLDHS: 'TTHLDHS',
  STKNCCCN: 'TTSTKN&CGCN', CISAT: 'TTSTKN&CGCN', 'TTSTKN&CGCN': 'TTSTKN&CGCN', TTSTKN: 'TTSTKN&CGCN',
  TTTTMT: 'TTTTMT', INC: 'TTTTMT',
  TTCNTT: 'TTCNPM', ITC: 'TTCNPM',
  CNPM: 'TTCNPM', STC: 'TTCNPM', TTCNPM: 'TTCNPM',
  GDQPAN: 'TTGDQPAN', TTGDQPAN: 'TTGDQPAN',
  GDTC: 'TTGDTC', TTGDTC: 'TTGDTC',
  TCKHGDKT: 'TCKHGDKT',
  VPDU: 'VPDU',
  // Viện & Khoa đặc thù
  VDTQT: 'VDTQT', IIE: 'VDTQT',
  SDH: 'VSDH', VSDH: 'VSDH',
  DTTT: 'KDTTT', FAE: 'KDTTT', KDTTT: 'KDTTT', FHQ: 'KDTTT',
  // Khối Khoa chung (PL1) & các Trung tâm đào tạo
  CK: 'KHOA', FME: 'KHOA', GTNL: 'KHOA', FEET: 'KHOA', FVE: 'KHOA',
  DDT: 'KHOA', FEEE: 'KHOA', CNTT: 'KHOA', FIT: 'KHOA',
  HHKHSS: 'KHOA', FCFT: 'KHOA', XD: 'KHOA', FCE: 'KHOA',
  KT: 'KHOA', FE: 'KHOA', MTTT: 'KHOA', FGAM: 'KHOA', FGA: 'KHOA',
  CTL: 'KHOA', FPI: 'KHOA', FPT: 'KHOA', FLLCT: 'KHOA',
  KHUD: 'KHOA', FAS: 'KHOA', NN: 'KHOA', FFL: 'KHOA',
  VSPKT: 'KHOA', ITE: 'KHOA', THKTTH: 'KHOA', TPC: 'KHOA',
  TTNN: 'KHOA', CFL: 'KHOA', TTVD: 'KHOA', VGC: 'KHOA',
  TTRBTM: 'KHOA', SRC: 'KHOA', TTKTTH: 'KHOA', ESC: 'KHOA',
  KTCNMT: 'KHOA', EETC: 'KHOA', NCUDKTXD: 'KHOA', CERAC: 'KHOA',
  KHOA: 'KHOA'
};

export function getQd2266A1RowsForUnit(unitCode: string, unitNameVi?: string): GenericGridRow[] {
  const normCode = unitCode.toUpperCase().trim();
  const targetPlKey = UNIT_ALIAS_TO_QD2266[normCode] || 'KHOA';
  const unitRecord = QD2266_UNITS_DATA[targetPlKey] || QD2266_UNITS_DATA['KHOA'];
  if (!unitRecord) return [];

  const actualUnitDef = findHcmuteUnit(normCode);
  const agencyName = unitNameVi || actualUnitDef?.nameVi || unitRecord.unitName;

  if (normCode === 'TCNS' || targetPlKey === 'TCNS') {
    return unitRecord.missions.map((m, idx) => ({
      id: `a1-${idx + 1}`,
      maNhiemVu: m.maNhiemVu,
      tenNhiemVu: m.tenNhiemVu,
      coQuan: 'Phòng Tổ chức - Nhân sự',
      canCu: m.canCu,
      ky: '01/10/2025–30/9/2026',
      trangThai: m.trangThai || 'Tiếp tục thực hiện',
      nguon: m.nguon
    }));
  }

  return unitRecord.missions.map((m, idx) => {
    const seq = String(idx + 1).padStart(2, '0');
    return {
      id: `a1-${idx + 1}`,
      maNhiemVu: `${normCode}.NV${seq}`,
      tenNhiemVu: m.tenNhiemVu,
      coQuan: agencyName,
      canCu: m.canCu,
      ky: '01/10/2025–30/9/2026',
      trangThai: 'Tiếp tục thực hiện',
      nguon: m.nguon
    };
  });
}
