import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { PL1_VTVL_CATALOG, Pl1VtvlItem } from './hcmute-pl1-catalog';

/**
 * Tra cứu một mục VTVL trong Phụ lục I theo mã (hỗ trợ cả mã thuần như 'HT45' hoặc có tiền tố như 'TCNS.HT45')
 */
export function findPl1Item(codeOrPrefixed: string): Pl1VtvlItem | undefined {
  if (!codeOrPrefixed) return undefined;
  const parts = codeOrPrefixed.split('.');
  const rawCode = (parts[parts.length - 1] || codeOrPrefixed).toUpperCase().trim();
  return PL1_VTVL_CATALOG.find((item) => item.pl1Code.toUpperCase() === rawCode);
}

/**
 * Lấy Bậc nghề nghiệp sử dụng chuẩn theo Quyết định Phụ lục I
 */
export function getPl1CareerLevel(pl1Code: string): string {
  const item = findPl1Item(pl1Code);
  if (!item) return 'Bậc 3 (Chuyên viên)';
  if (item.pl1Code.startsWith('QL')) return 'Không áp dụng bậc riêng (theo VTVL gắn kèm)';
  if (item.pl1Code === 'CM76') return 'Bậc 3, Bậc 4, Bậc 5 (GV, GVC, GVCC)';
  if (item.pl1Code === 'HT55') return 'Giữ bậc VTVL đang giữ (*)';
  return item.careerLevel || 'Bậc 3';
}

/**
 * Sinh một dòng C1 từ mục Phụ lục I
 */
export function createC1RowFromPl1(unitCode: string, item: Pl1VtvlItem, index: number): GenericGridRow {
  const isQl = item.pl1Code.startsWith('QL');
  return {
    id: `c1-pl1-${index + 1}`,
    maVtvl: `${unitCode}.${item.pl1Code}`,
    tenVtvl: item.titleOrRole || item.positionName,
    loaiNhanLuc: 'Viên chức',
    quyetDinh: 'QĐ Hiệu trưởng / NĐ 232',
    gioChuanPp2: 1904,
    canCuQuyGio: isQl
      ? 'PP1 – theo cơ cấu và chức danh quản lý'
      : 'Mức chung 1.904 giờ – quy định về thời giờ làm việc',
    trangThai: 'Tiếp tục sử dụng',
    gioRieng: 0,
    xacNhanGioRieng: 'Không',
    cheDoLamViec: 'Phổ biến (40 giờ/tuần)',
    kiemTra: 'ĐẠT'
  };
}

/**
 * Sinh một dòng C2 từ mục Phụ lục I và dòng C1
 */
export function createC2RowFromPl1(c1Row: GenericGridRow, index: number): GenericGridRow {
  const maVtvl = String(c1Row.maVtvl || '');
  const item = findPl1Item(maVtvl);
  const isQl = item?.pl1Code.startsWith('QL') ?? maVtvl.includes('QL');

  return {
    id: `c2-pl1-${index + 1}`,
    maVtvl: c1Row.maVtvl,
    tenVtvl: c1Row.tenVtvl,
    bacNgheNghiep: getPl1CareerLevel(item?.pl1Code || maVtvl),
    nhomNangLuc: isQl
      ? 'Năng lực quản lý'
      : item?.groupRoman === 'II'
      ? 'Năng lực chuyên môn'
      : 'Năng lực chung',
    tenNangLuc: `Khung năng lực VTVL ${item?.titleOrRole || c1Row.tenVtvl}`,
    capDoYeuCau: isQl ? 'Cấp độ 4' : 'Cấp độ 3',
    moTaChiTiet: `Yêu cầu năng lực theo QĐ phê duyệt VTVL và Bậc nghề nghiệp sử dụng: ${getPl1CareerLevel(
      item?.pl1Code || maVtvl
    )}. Căn cứ Điều 8 & PL IV NĐ 232/2026/NĐ-CP.`
  };
}

/**
 * Nạp toàn bộ 56 VTVL chuẩn theo Phụ lục I vào Biểu 3. C1_VTVL
 */
export function buildFullPl1C1Rows(unitCode: string): GenericGridRow[] {
  return PL1_VTVL_CATALOG.map((item, idx) => createC1RowFromPl1(unitCode, item, idx));
}

/**
 * Nạp toàn bộ 56 bản mô tả năng lực tương ứng vào Biểu 7. C2_NangLuc
 */
export function buildFullPl1C2Rows(c1Rows: GenericGridRow[]): GenericGridRow[] {
  return c1Rows.map((c, idx) => createC2RowFromPl1(c, idx));
}

/**
 * Nạp danh mục VTVL chuẩn theo nhóm/loại hình đơn vị tại HCM-UTE
 */
export function buildRecommendedC1Rows(unitCode: string, groupKind: string): GenericGridRow[] {
  if (unitCode === 'TCNS') {
    return [
      { id: 'c1-1', maVtvl: 'TCNS.HT45', tenVtvl: 'Tổ chức cán bộ, thi đua khen thưởng', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'Mức chung 1.904 giờ – quy định về thời giờ làm việc', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' },
      { id: 'c1-2', maVtvl: 'TCNS.HT47', tenVtvl: 'Tiếp công dân, giải quyết khiếu nại, tố cáo', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'Mức chung 1.904 giờ – quy định về thời giờ làm việc', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' },
      { id: 'c1-3', maVtvl: 'TCNS.HT48', tenVtvl: 'Phòng, chống tham nhũng, tiêu cực, lãng phí', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'Mức chung 1.904 giờ – quy định về thời giờ làm việc', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' },
      { id: 'c1-4', maVtvl: 'TCNS.HT49', tenVtvl: 'Hành chính – Tổng hợp', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'Mức chung 1.904 giờ – quy định về thời giờ làm việc', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' },
      { id: 'c1-5', maVtvl: 'TCNS.QL33', tenVtvl: 'Trưởng phòng Tổ chức - Nhân sự', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'PP1 – theo cơ cấu và chức danh quản lý', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' },
      { id: 'c1-6', maVtvl: 'TCNS.QL43', tenVtvl: 'Phó Trưởng phòng Tổ chức - Nhân sự', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'PP1 – theo cơ cấu và chức danh quản lý', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' }
    ];
  }

  // Danh sách mã VTVL gợi ý theo loại hình
  let codes: string[] = [];

  if (unitCode === 'BGH' || unitCode === 'TRUONG') {
    codes = ['QL10', 'QL20', 'HT49', 'HT45', 'HT44'];
  } else if (unitCode === 'TYT') {
    codes = ['QL35', 'QL45', 'HT37', 'HT49'];
  } else if (unitCode.startsWith('VIEN')) {
    codes = ['QL32', 'QL42', 'CM76', 'HT62', 'HT31', 'HT49'];
  } else if (groupKind === 'khoa-vien') {
    // Các Khoa đào tạo
    codes = ['QL31', 'QL41', 'QL50', 'QL60', 'CM76', 'HT30', 'HT31', 'HT35', 'HT49'];
  } else if (groupKind === 'trung-tam') {
    codes = ['QL36', 'QL46', 'CM79', 'HT46', 'HT49'];
  } else if (unitCode === 'KHTC') {
    codes = ['QL33', 'QL43', 'HT52', 'HT54', 'HT55', 'HT56', 'HT57', 'HT49'];
  } else if (unitCode === 'DT') {
    codes = ['QL33', 'QL43', 'CM79', 'HT32', 'HT33', 'HT49'];
  } else if (unitCode === 'KHCN') {
    codes = ['QL33', 'QL43', 'CM63', 'CM64', 'CM65', 'HT62', 'HT49'];
  } else {
    // Các Phòng ban chức năng khác
    codes = ['QL33', 'QL43', 'CM63', 'HT46', 'HT49'];
  }

  const items = codes
    .map((c) => findPl1Item(c))
    .filter((item): item is Pl1VtvlItem => Boolean(item));

  return items.map((item, idx) => createC1RowFromPl1(unitCode, item, idx));
}

