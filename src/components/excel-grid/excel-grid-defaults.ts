import { ExcelSheetKey, GenericGridRow } from './excel-grid-types';
import { cleanMissionSuffix } from './excel-grid-code-helpers';
import { PL1_VTVL_CATALOG, TCNS_REAL_MISSIONS, TCNS_REAL_TASKS, TCNS_C2_PROFILES } from '@/configs/hcmute-pl1-catalog';
import { buildRecommendedC1Rows, createC2RowFromPl1 } from '@/configs/hcmute-pl1-builder';
import { HCMUTE_UNITS, findHcmuteUnit } from '@/configs/hcmute-units';
import { TASK_TEMPLATES_BY_GROUP } from '@/configs/hcmute-quotas';
import { getQd2266A1RowsForUnit } from '@/configs/hcmute-qd2266-missions';
import { UnitGroupKind } from '@/types/vtvl';

export const DM_SP_DEFAULT_ROWS: GenericGridRow[] = [
  { id: 'sp-1', maSpChuan: 'SP-I-01', tenSp: 'Kế hoạch / Đề án / Chiến lược năm', linhVuc: 'Hành chính / Quản lý', nhom: 'Nhóm I', phutChuan: 480, vanBan: 'HD 07 / QĐ 2266', trangThai: 'Đã xác nhận', coQuan: 'HCM-UTE' },
  { id: 'sp-2', maSpChuan: 'SP-II-01', tenSp: 'Báo cáo tổng kết / Thống kê số liệu chuyên sâu', linhVuc: 'Hành chính / Nhân sự', nhom: 'Nhóm II', phutChuan: 240, vanBan: 'HD 07 / QĐ 2266', trangThai: 'Đã xác nhận', coQuan: 'HCM-UTE' },
  { id: 'sp-3', maSpChuan: 'SP-III-01', tenSp: 'Hồ sơ tuyển dụng / Nâng ngạch / Bổ nhiệm', linhVuc: 'Tổ chức cán bộ', nhom: 'Nhóm III', phutChuan: 120, vanBan: 'HD 07 / QĐ 2266', trangThai: 'Đã xác nhận', coQuan: 'HCM-UTE' },
  { id: 'sp-4', maSpChuan: 'SP-IV-01', tenSp: 'Quyết định hành chính / Công văn hướng dẫn', linhVuc: 'Văn thư / Pháp chế', nhom: 'Nhóm IV', phutChuan: 90, vanBan: 'NĐ 30/2020 / HCM-UTE', trangThai: 'Đã xác nhận', coQuan: 'HCM-UTE' },
  { id: 'sp-5', maSpChuan: 'SP-V-01', tenSp: 'Hồ sơ xác nhận quá trình / Giải quyết thủ tục người học', linhVuc: 'Đào tạo / Dịch vụ', nhom: 'Nhóm V', phutChuan: 30, vanBan: 'Quy định HCM-UTE', trangThai: 'Đã xác nhận', coQuan: 'HCM-UTE' },
  { id: 'sp-6', maSpChuan: 'SP-VI-01', tenSp: 'Số hóa dữ liệu / Cập nhật phần mềm hệ thống', linhVuc: 'Chuyển đổi số', nhom: 'Nhóm VI', phutChuan: 15, vanBan: 'QĐ CĐS HCM-UTE', trangThai: 'Đã xác nhận', coQuan: 'HCM-UTE' }
];

export function buildDefaultGridWorkbook(unitCode: string): Record<ExcelSheetKey, GenericGridRow[]> {
  const unitDef = findHcmuteUnit(unitCode);
  const isTcns = unitCode === 'TCNS';
  const group = unitDef.group as UnitGroupKind;

  // 1. C1_VTVL — Nạp danh mục VTVL chuẩn theo Phụ lục I và loại hình đơn vị
  const c1Rows: GenericGridRow[] = isTcns
    ? [
        { id: 'c1-1', maVtvl: 'TCNS.HT45', tenVtvl: 'Tổ chức cán bộ, thi đua khen thưởng', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'Mức chung 1.904 giờ – quy định về thời giờ làm việc', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' },
        { id: 'c1-2', maVtvl: 'TCNS.HT47', tenVtvl: 'Tiếp công dân, giải quyết khiếu nại, tố cáo', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'Mức chung 1.904 giờ – quy định về thời giờ làm việc', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' },
        { id: 'c1-3', maVtvl: 'TCNS.HT48', tenVtvl: 'Phòng, chống tham nhũng, tiêu cực, lãng phí', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'Mức chung 1.904 giờ – quy định về thời giờ làm việc', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' },
        { id: 'c1-4', maVtvl: 'TCNS.HT49', tenVtvl: 'Hành chính – Tổng hợp', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'Mức chung 1.904 giờ – quy định về thời giờ làm việc', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' },
        { id: 'c1-5', maVtvl: 'TCNS.QL33', tenVtvl: 'Trưởng phòng Tổ chức - Nhân sự', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'PP1 – theo cơ cấu và chức danh quản lý', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' },
        { id: 'c1-6', maVtvl: 'TCNS.QL43', tenVtvl: 'Phó Trưởng phòng Tổ chức - Nhân sự', loaiNhanLuc: 'Viên chức', quyetDinh: 'Chờ quyết định', gioChuanPp2: 1904, canCuQuyGio: 'PP1 – theo cơ cấu và chức danh quản lý', trangThai: 'Tiếp tục sử dụng', gioRieng: 0, xacNhanGioRieng: 'Không', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', kiemTra: 'ĐẠT' }
      ]
    : buildRecommendedC1Rows(unitCode, group);

  // 2. A1_NhiemVu — Nạp tự động từ QĐ 2266 (28 Phụ lục) theo chuẩn ${unitCode}.NV01
  const a1Rows: GenericGridRow[] = getQd2266A1RowsForUnit(unitCode, unitDef.nameVi);

  // 3. A2_CongViec
  const taskSource = isTcns ? TCNS_REAL_TASKS : (TASK_TEMPLATES_BY_GROUP[group] || TASK_TEMPLATES_BY_GROUP['khoa-vien']);
  const missionTaskCounters: Record<string, number> = {};
  const a2Rows: GenericGridRow[] = taskSource.map((t, idx) => {
    const rawSuffix = cleanMissionSuffix(t.missionSuffix || (a1Rows[idx % a1Rows.length]?.maNhiemVu as string) || 'NV01');
    const mCode = `${unitCode}.${rawSuffix}`;
    missionTaskCounters[mCode] = (missionTaskCounters[mCode] || 0) + 1;
    const taskSeq = String(missionTaskCounters[mCode]).padStart(2, '0');
    const taskCode = `${mCode}.CV${taskSeq}`;
    const vtvl = t.vtvlSuffix ? (t.vtvlSuffix.startsWith('QL') || t.vtvlSuffix.startsWith('CM') || t.vtvlSuffix.startsWith('HT') ? t.vtvlSuffix : (c1Rows[idx % c1Rows.length]?.maVtvl as string)) : (c1Rows[idx % c1Rows.length]?.maVtvl as string) || 'CM63';
    return {
      id: `a2-${idx + 1}`,
      maCongViec: taskCode,
      maNhiemVu: mCode,
      maVtvl: vtvl,
      tenCongViec: t.taskName,
      sanPham: t.productName || 'Sản phẩm hoàn thành',
      dvt: 'Hồ sơ / Báo cáo',
      chatLuong: 'Đạt chuẩn quy định',
      canCu: 'QĐ 2266 & Mô tả công việc'
    };
  });

  // 5. B1_KhoiLuong
  const b1Rows: GenericGridRow[] = a2Rows.map((t, idx) => {
    const qty = 50 + (idx % 8) * 25;
    const minutes = 90 + (idx % 6) * 30;
    const hours = Math.round((qty * minutes / 60) * 10) / 10;
    return {
      id: `b1-${idx + 1}`,
      maCongViec: t.maCongViec,
      maVtvl: t.maVtvl,
      soSpNam: qty,
      phutThucTe: minutes,
      gioBoSung: 0,
      gioSp: hours,
      gioTong: hours,
      nguon: 'Hệ thống thông tin nội bộ & Sổ theo dõi 2025–2026',
      ppThucTe: 'nhật ký công việc',
      phutApDung: minutes,
      canhBao: 'ĐẠT'
    };
  });

  // 6. B2_CT_TacDong
  const b2CtRows: GenericGridRow[] = a2Rows.slice(0, 3).map((t, idx) => ({
    id: `b2ct-${idx + 1}`,
    maCongViec: t.maCongViec,
    maVtvl: t.maVtvl,
    congDoan: `Số hóa tiếp nhận và xử lý trực tuyến`,
    loaiTacDong: 'Số hóa',
    mucDo: 'Toàn phần',
    gioBienDong: -60 - idx * 30,
    vanBan: 'Kế hoạch CĐS HCM-UTE 2026–2030'
  }));

  // 7. B2_ThayDoi
  const b2Rows: GenericGridRow[] = a2Rows.map((t, idx) => {
    const b1Item = b1Rows.find((b) => b.maCongViec === t.maCongViec);
    const ctMatch = b2CtRows.filter((c) => c.maCongViec === t.maCongViec);
    const varHours = ctMatch.reduce((acc, c) => acc + (Number(c.gioBienDong) || 0), 0);
    const b1Hours = Number(b1Item?.gioTong) || 0;
    return {
      id: `b2-${idx + 1}`,
      maCongViec: t.maCongViec,
      maVtvl: t.maVtvl,
      gioB1: b1Hours,
      gioGiam: varHours,
      gioMoi: 0,
      gioSauTacDong: Math.max(0, b1Hours + varHours),
      tyLeThayDoi: b1Hours > 0 ? `${Math.round((varHours / b1Hours) * 100)}%` : '0%',
      trangThai: 'Đã kiểm chứng',
      doiChieuTrung: 'Đã đối chiếu'
    };
  });

  // 8. C2_NangLuc — Đồng bộ năng lực và Bậc nghề nghiệp sử dụng chuẩn Phụ lục I
  const c2Rows: GenericGridRow[] = c1Rows.map((c, idx) => {
    const prof = TCNS_C2_PROFILES[String(c.maVtvl)];
    if (prof) {
      return {
        id: `c2-${idx + 1}`,
        maVtvl: c.maVtvl,
        tenVtvl: c.tenVtvl,
        bacNgheNghiep: String(c.maVtvl).includes('QL') ? 'Không áp dụng bậc riêng' : 'Bậc 3 (Chuyên viên)',
        nhomNangLuc: 'Năng lực chuyên môn',
        tenNangLuc: prof.responsibility.slice(0, 45) + '...',
        capDoYeuCau: String(c.maVtvl).includes('QL') ? 'Cấp độ 4' : 'Cấp độ 3',
        moTaChiTiet: `${prof.general} | ${prof.professional}`
      };
    }
    return createC2RowFromPl1(c, idx);
  });

  // 9. D1_NhanLuc
  const d1Rows: GenericGridRow[] = c1Rows.map((c, idx) => ({
    id: `d1-${idx + 1}`,
    hoTen: `Cán bộ ${idx + 1} (${unitDef.nameVi})`,
    maVtvl: c.maVtvl,
    ngaySinh: '1985-05-15',
    gioiTinh: idx % 2 === 0 ? 'Nam' : 'Nữ',
    trinhDo: String(c.maVtvl).startsWith('QL') ? 'Tiến sĩ' : 'Thạc sĩ',
    ngachVienChuc: String(c.maVtvl).startsWith('QL') ? 'Chuyên viên chính' : 'Chuyên viên',
    maSoNgach: String(c.maVtvl).startsWith('QL') ? '01.002' : '01.003',
    heSoLuong: String(c.maVtvl).startsWith('QL') ? 4.74 : 3.0,
    loaiHopDong: 'Viên chức không thời hạn',
    ghiChu: 'Chốt ngày 30/9/2026'
  }));

  // 10. C3_NhuCau
  const c3Rows: GenericGridRow[] = c1Rows.map((c, idx) => {
    const vCode = String(c.maVtvl);
    const sumB1 = b1Rows.filter((b) => b.maVtvl === vCode).reduce((acc, b) => acc + (Number(b.gioTong) || 0), 0);
    const sumB2 = b2Rows.filter((b) => b.maVtvl === vCode).reduce((acc, b) => acc + (Number(b.gioGiam) || 0), 0);
    const netHours = Math.max(0, sumB1 + sumB2);
    const stdHours = Number(c.gioChuanPp2) || 1904;
    const isQl = vCode.includes('QL') || vCode.includes('LD') || String(c.canCuQuyGio).includes('PP1');
    const fteCalc = Math.round((netHours / stdHours) * 100) / 100;
    const qlPeople = vCode.includes('QL43') || vCode.includes('PTP') || vCode.includes('PTK') ? 2 : 1;
    const requiredPeople = isQl ? qlPeople : Math.max(1, Math.ceil(fteCalc));
    return {
      id: `c3-${idx + 1}`,
      maVtvl: vCode,
      phuongPhap: isQl ? 'PP1' : 'PP2',
      gioB1: isQl ? '' : Math.round(sumB1),
      gioB2: isQl ? 0 : Math.round(sumB2),
      gioRong: isQl ? '' : Math.round(netHours),
      gioPp2: stdHours,
      nguoiQuyDoi: isQl ? '' : fteCalc,
      nguoiPp1: isQl ? qlPeople : 0,
      nguoiCanBoTri: requiredPeople,
      trangThai: 'Đã kiểm chứng',
      nguonGiaiTrinh: isQl
        ? 'Định biên theo PP1; QĐ 2266, PL18 và BMTCV&KNL'
        : 'Kết quả đo lường khối lượng công việc tại Biểu B1 kỳ 01/10/2025–30/9/2026; quỹ giờ chuẩn 1.904 giờ theo C1',
      canhBao: 'ĐẠT'
    };
  });

  // 11. DU_BAO_5_NAM
  const duBaoRows: GenericGridRow[] = c1Rows.map((c, idx) => {
    const c3Item = c3Rows.find((r) => r.maVtvl === c.maVtvl);
    const baseCount = Number(c3Item?.nguoiCanBoTri) || 1;
    return {
      id: `dubao-${idx + 1}`,
      maVtvl: c.maVtvl,
      nam: '2027',
      bienDong: 0,
      noiDungThayDoi: 'Duy trì ổn định nhân lực theo đề án vị trí việc làm',
      canCuNguon: 'Chiến lược phát triển HCM-UTE 2026–2030',
      nguoiC3: baseCount,
      nguoiCanBoTriNam: baseCount,
      kiemTra: 'ĐẠT'
    };
  });

  // 12. D2_PhuongAn
  const d2Rows: GenericGridRow[] = c1Rows.map((c, idx) => {
    const c3Item = c3Rows.find((r) => r.maVtvl === c.maVtvl);
    const targetPeople = Number(c3Item?.nguoiCanBoTri) || 1;
    const currentPeople = d1Rows.filter((d) => d.maVtvl === c.maVtvl).length;
    return {
      id: `d2-${idx + 1}`,
      maVtvl: c.maVtvl,
      nam: '2027',
      soNguoiCanBoTri: targetPeople,
      soNguoiCoTheBoTri: currentPeople,
      bienCheGiao: currentPeople,
      deNghiDieuChinh: targetPeople - currentPeople,
      trangThai: 'Đã hoàn thành ở đơn vị',
      nguonGiaiTrinh: 'Phương án cân đối nhân sự 2027',
      canhBao: 'ĐẠT'
    };
  });

  // 13. K_KiemTra
  const kRows: GenericGridRow[] = [
    { id: 'k-1', stt: 1, nhomBieu: 'A2 ↔ A1', chiTieu: 'Mọi công việc A2 phải thuộc mã nhiệm vụ hợp lệ tại A1', bangNguon: '2. A2_CongViec', bangDich: '1. A1_NhiemVu', soDongLoi: 0, nguongChoPhep: '0', ketLuan: 'ĐẠT' },
    { id: 'k-2', stt: 2, nhomBieu: 'B1 ↔ C1', chiTieu: 'Mã VTVL tại B1 phải tồn tại và kích hoạt tại C1', bangNguon: '3. B1_KhoiLuong', bangDich: '6. C1_VTVL', soDongLoi: 0, nguongChoPhep: '0', ketLuan: 'ĐẠT' },
    { id: 'k-3', stt: 3, nhomBieu: 'B1 Cảnh báo', chiTieu: 'Khối lượng và thời gian làm việc phải lớn hơn 0', bangNguon: '3. B1_KhoiLuong', bangDich: 'Nội bộ B1', soDongLoi: 0, nguongChoPhep: '0', ketLuan: 'ĐẠT' },
    { id: 'k-4', stt: 4, nhomBieu: 'B2_CT ↔ B1', chiTieu: 'Mã công việc tác động phải khớp công việc đã khai tại B1', bangNguon: '4. B2_CT_TacDong', bangDich: '3. B1_KhoiLuong', soDongLoi: 0, nguongChoPhep: '0', ketLuan: 'ĐẠT' },
    { id: 'k-5', stt: 5, nhomBieu: 'D1 ↔ C1', chiTieu: 'Mã VTVL nhân sự đảm nhận phải khớp danh mục VTVL tại C1', bangNguon: '9. D1_NhanLuc', bangDich: '6. C1_VTVL', soDongLoi: 0, nguongChoPhep: '0', ketLuan: 'ĐẠT' },
    { id: 'k-6', stt: 6, nhomBieu: 'C3 ↔ D2', chiTieu: 'Nhu cầu nhân sự năm cơ sở phải liên thông với phương án D2', bangNguon: '8. C3_NhuCau', bangDich: '10. D2_PhuongAn', soDongLoi: 0, nguongChoPhep: '0', ketLuan: 'ĐẠT' }
  ];

  // 14. T_TienDo
  const tRows: GenericGridRow[] = [
    {
      id: 't-1',
      maDonVi: unitDef.code,
      tenDonVi: isTcns ? 'Phòng Tổ chức – Nhân sự (HCM-UTE)' : `${unitDef.nameVi} (HCM-UTE)`,
      soNhiemVu: a1Rows.length,
      soCongViec: a2Rows.length,
      soVtvl: c1Rows.length,
      tongFte: c3Rows.reduce((acc, c) => acc + (Number(c.nguoiCanBoTri) || 0), 0),
      trangThai: 'Đạt 6/6 chỉ tiêu kiểm tra'
    }
  ];

  // 15. S_NhatKy — Chuẩn 10 cột A–J ghi vết phiên bản
  const sRows: GenericGridRow[] = [
    {
      id: 's-1',
      ky: '01/10/2025–30/9/2026',
      bieu: '1. A1_NhiemVu',
      ma: unitDef.code,
      truong: 'Khởi tạo danh mục nhiệm vụ',
      giaTriCu: 'QĐ 2266/QĐ-ĐHCNKT',
      giaTriMoi: `Nạp tự động ${a1Rows.length} nhiệm vụ từ QĐ 2266 cho ${unitDef.nameVi}`,
      nguon: 'QĐ 2266/QĐ-ĐHCNKT ngày 23/6/2026',
      nguoiXacNhan: `Tổ công tác VTVL [${unitDef.code}]`,
      ngay: '09/11/2026',
      phienBan: 'v1.0'
    }
  ];

  return {
    C1: c1Rows,
    A1: a1Rows,
    A2: a2Rows,
    DM_SP: DM_SP_DEFAULT_ROWS,
    B1: b1Rows,
    B2_CT: b2CtRows,
    B2: b2Rows,
    C2: c2Rows,
    D1: d1Rows,
    C3: c3Rows,
    DU_BAO: duBaoRows,
    D2: d2Rows,
    K: kRows,
    T: tRows,
    S: sRows
  };
}
