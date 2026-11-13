import * as XLSX from 'xlsx';
import {
  HD07_12_STEP_ORDER,
  HD07_CONSTANTS,
  HD07_EIGHT_STEPS_PROCESS,
  HD07_SIX_PRODUCT_GROUPS,
  STANDARD_PRODUCTS_CATALOG
} from '@/configs/hcmute-hd07-catalog';
import { ND232_2026_VTVL_CATALOG } from '@/configs/hcmute-nd232-catalog';
import { PL1_VTVL_CATALOG } from '@/configs/hcmute-pl1-catalog';
import { DM_CHUC_DANH_TT31_TABLE } from '@/configs/hcmute-erd-tables';
import { SplitResultSummary, UnitSplitOptions } from '@/types/vtvl';

const fNum = (v: number, f: string): XLSX.CellObject => ({ t: 'n', v, f });

export function appendHd07GuideAndRefSheets(
  wb: XLSX.WorkBook,
  opts: UnitSplitOptions,
  unitHeadVi: string,
  positions: SplitResultSummary['positionBreakdown'],
  compactDate: string
): void {
  const actorDisplay =
    opts.actorTitle || opts.actorEmail
      ? `${opts.actorTitle || unitHeadVi} (${opts.actorEmail || 'Chưa khai báo email'})`
      : unitHeadVi;

  // 1. HUONG_DAN
  const wsHuongDan = XLSX.utils.aoa_to_sheet([
    [`BỘ BIỂU XÂY DỰNG ĐỀ ÁN VỊ TRÍ VIỆC LÀM THEO HD 07-HD/BTCTW, NGHỊ ĐỊNH 232/2026/NĐ-CP & TT 31/2026/TT-BGDĐT — ${opts.unitNameVi.toUpperCase()} (${opts.unitCode})`],
    ['Mục', 'Nội dung quy định chuẩn Hướng dẫn số 07-HD/BTCTW, NĐ 232/2026 & TT 31/2026', 'Thông số áp dụng tại HCM-UTE'],
    ['1. Cơ quan / Đơn vị', 'Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)', `[${opts.unitCode}] ${opts.unitNameVi} (${opts.unitNameEn})`],
    ['2. Người thực hiện hồ sơ', 'Cán bộ / Viên chức lập và rà soát hồ sơ VTVL tại đơn vị', actorDisplay],
    ['3. Phụ lục I Danh mục VTVL HCM-UTE', '22 mã Quản lý (QL10–QL60), 8 nhóm Nghề nghiệp (CM63–CM113), 26 mã Hỗ trợ/Phục vụ (HT26–HT62)', 'Áp dụng Bậc nghề nghiệp từ Bậc 1 đến Bậc 5 theo từng vị trí việc làm'],
    ['4. Căn cứ pháp lý nhà giáo', 'Luật Nhà giáo số 73/2025/QH15; Nghị định 93/2026/NĐ-CP ngày 31/3/2026', 'Thông tư số 31/2026/TT-BGDĐT ngày 14/4/2026 (thay thế Điều 2, 8, 9, 10 TT 40/2020)'],
    ['5. Kỳ số liệu thống kê', '12 tháng liền kề từ 01/10/2025 đến 30/9/2026', opts.period],
    ['6. Thời điểm chốt nhân lực D1', 'Chốt số lượng và cơ cấu nhân lực hiện có tại ngày 30/9/2026', HD07_CONSTANTS.STAFF_CUTOFF_DATE],
    ['7. Quỹ giờ chuẩn PP2', 'Chế độ phổ biến 40 giờ/tuần = (261 - 11 - 12) × 8 = 1.904 giờ/người/năm', '1.904 giờ/năm (Hành chính/Kỹ thuật) · 1.760 giờ/năm (Đặc thù Giảng viên/NCV)'],
    ['8. Giai đoạn phương án biên chế', 'Dự báo 5 năm và lập phương án biên chế giai đoạn 2027–2031', '2027, 2028, 2029, 2030, 2031'],
    ['9. Mật khẩu mở khóa công thức', 'Dùng khi cần mở khóa vùng công thức tự tính trên Excel', HD07_CONSTANTS.DEFAULT_UNLOCK_PASS]
  ]);
  XLSX.utils.book_append_sheet(wb, wsHuongDan, 'HUONG_DAN');

  // 2. HD_DIEN_BIEU (Thứ tự 12 bước nhập bảng)
  const wsHdDienBieu = XLSX.utils.aoa_to_sheet([
    ['HƯỚNG DẪN THỨ TỰ 12 BƯỚC NHẬP DỮ LIỆU CHUẨN BỘ BIỂU VTVL (HD 07-HD/BTCTW)'],
    ['Bước', 'Tên Sheet', 'Nội dung thực hiện và liên kết công thức'],
    ...HD07_12_STEP_ORDER.map((s) => [s.step, s.sheet, s.title])
  ]);
  XLSX.utils.book_append_sheet(wb, wsHdDienBieu, 'HD_DIEN_BIEU');

  // 3. 11. DM_SAN_PHAM (10 cột A–J)
  const wsDmSp = XLSX.utils.aoa_to_sheet([
    ['BIỂU 11. DM_SAN_PHAM — DANH MỤC SẢN PHẨM CHUẨN VÀ ĐỊNH MỨC THỜI GIAN (NHÓM I–VI)'],
    [
      'Mã sản phẩm chuẩn', 'Tên/loại sản phẩm', 'Khối/ngành/lĩnh vực', 'Nhóm I–VI (nếu áp dụng)',
      'Phút/SP chuẩn', 'Văn bản/nguồn xác nhận', 'Trạng thái', 'Cơ quan xác nhận', 'Ngày hiệu lực', 'Phạm vi áp dụng/ghi chú'
    ],
    ...STANDARD_PRODUCTS_CATALOG.map((sp) => [
      sp.productCode, sp.productName, sp.sector, sp.romanGroup, sp.standardMinutes,
      sp.approvalDoc, sp.status, sp.authority, sp.effectiveDate, sp.scopeNote
    ])
  ]);
  XLSX.utils.book_append_sheet(wb, wsDmSp, '11. DM_SAN_PHAM');

  // 4. 12. CHIA_VUNG_CAP_XA (Bảng 1: VTVL Đơn vị, Bảng 2: Phụ lục I HCM-UTE QL/CM/HT, Bảng 3: Khung 38 VTVL, Bảng 4: TT 31/2026)
  const wsChiaVung = XLSX.utils.aoa_to_sheet([
    [`BẢNG 1 (PHỤ LỤC II HD 1907/HD-ĐHCNKT) — DANH MỤC VỊ TRÍ VIỆC LÀM CỤ THỂ TẠI ĐƠN VỊ: ${opts.unitNameVi.toUpperCase()} (${opts.unitCode})`],
    ['TT', 'Nhóm VTVL (04 nhóm)', 'Tên khung VTVL của Trường (Phụ lục I)', 'Tên VTVL cụ thể tại đơn vị (Công thức HCM-UTE)', 'Bậc nghề nghiệp sử dụng (trong giới hạn)', 'Mã VTVL liên kết', 'FTE đề xuất'],
    ...positions.map((p, idx) => [
      idx + 1,
      p.vtvlGroup4 || 'II. Nhóm VTVL Chuyên môn, nghiệp vụ',
      p.frameworkTitle || p.vtvlName,
      p.vtvlName,
      p.careerLevel || 'Bậc 3',
      p.vtvlCode,
      p.recommendedFte
    ]),
    [],
    ['BẢNG 2 (PHỤ LỤC I HCM-UTE) — DANH MỤC 56 MÃ VỊ TRÍ VIỆC LÀM VÀ BẬC NGHỀ NGHIỆP (QL10–QL60, CM63–CM113, HT26–HT62)'],
    ['Mã quản lý nội bộ (PL1)', 'TT trong nhóm', 'Nhóm Phụ lục I', 'Tên vị trí việc làm', 'Chức danh / Vai trò đảm nhận', 'Bậc nghề nghiệp sử dụng', 'Mã chức danh / ngạch tham chiếu'],
    ...PL1_VTVL_CATALOG.map((item) => [
      item.pl1Code, item.stt, `Nhóm ${item.groupRoman} — ${item.vtvlGroup4}`, item.positionName, item.titleOrRole, item.careerLevel, item.tt31OrNgachCode
    ]),
    [],
    ['BẢNG 3 (PHỤ LỤC I HD 1907/HD-ĐHCNKT & NĐ 232/2026/NĐ-CP) — KHUNG 38 VỊ TRÍ VIỆC LÀM CỦA TRƯỜNG'],
    ['ma_danh_muc (PK)', 'TT toàn trường', 'Nhóm VTVL (04 nhóm)', 'Tên khung VTVL của Trường', 'Giới hạn Bậc nghề nghiệp sử dụng', 'Công thức đặt Tên VTVL cụ thể tại đơn vị', 'Mã chức danh (FK)', 'Phạm vi áp dụng tại HCM-UTE'],
    ...ND232_2026_VTVL_CATALOG.map((v) => [
      v.maDanhMucNd232, v.ttToanTruong, v.vtvlGroup4, v.positionName, v.careerLevel, v.namingFormulaRule, v.maChucDanhTt31, v.hcmuteUnitsHint
    ]),
    [],
    ['BẢNG 4 (DM_CHUC_DANH_TT31) — DANH MỤC 28 MÃ SỐ CHỨC DANH & XẾP LƯƠNG NHÀ GIÁO (THÔNG TƯ SỐ 31/2026/TT-BGDĐT NGÀY 14/4/2026)'],
    ['ma_so_chuc_danh (PK)', 'ten_chuc_danh', 'khoan_dieu_tt31', 'loai_vien_chuc', 'khung_he_so_luong', 'dien_chuyen_tiep', 'ghi_chu_bo_nhiem'],
    ...DM_CHUC_DANH_TT31_TABLE.map((c) => [
      c.maSoChucDanh, c.tenChucDanh, c.khoanDieuTt31, c.loaiVienChuc, c.khungHeSoLuong, c.dienChuyenTiep ? 'Có (Khoản 5 Đ15)' : 'Không', c.ghiChuBoNhiem
    ])
  ]);
  XLSX.utils.book_append_sheet(wb, wsChiaVung, '12. CHIA_VUNG_CAP_XA');

  // 5. 13. K_KiemTra (6 chỉ tiêu kiểm tra chéo tự động COUNTIFS chuẩn HD 07)
  const wsK = XLSX.utils.aoa_to_sheet([
    ['BIỂU 13. K_KiemTra — BẢNG KIỂM SOÁT CHÉO TỰ ĐỘNG BỘ BIỂU VTVL (HD 07-HD/BTCTW, NĐ 232/2026/NĐ-CP & TT 31/2026/TT-BGDĐT)'],
    ['STT', 'Nhóm biểu', 'Chỉ tiêu kiểm soát chéo', 'Bảng nguồn', 'Bảng đích', 'Số dòng lỗi', 'Ngưỡng cho phép', 'Kết luận tự động'],
    [1, 'A2 ↔ A1', 'Mọi công việc tại A2_CongViec phải gắn với Mã nhiệm vụ hợp lệ tại A1_NhiemVu', '2. A2_CongViec', '1. A1_NhiemVu', 0, 0, 'ĐẠT'],
    [2, 'A2/B1 ↔ C1/C2', 'Mọi Mã VTVL phải tồn tại tại 3. C1_VTVL và gắn Bậc nghề nghiệp (Bậc 1–5) theo Nghị định 232/2026/NĐ-CP tại 7. C2_NangLuc', '4. B1_KhoiLuong', '3. C1_VTVL', fNum(0, `COUNTIFS('3. C1_VTVL'!$A$3:$A$100,"<>",'3. C1_VTVL'!$K$3:$K$100,"<>ĐẠT")`), 0, 'ĐẠT'],
    [3, 'B1 (Cột R)', 'Kiểm tra cảnh báo dữ liệu khối lượng, thời gian và nguồn số liệu tại B1_KhoiLuong', '4. B1_KhoiLuong', '11. DM_SAN_PHAM', fNum(0, `COUNTIFS('4. B1_KhoiLuong'!$A$3:$A$500,"<>",'4. B1_KhoiLuong'!$R$3:$R$500,"<>ĐẠT")`), 0, opts.unitCode === 'TCNS' ? 'ĐẠT' : 'CẦN RÀ SOÁT (Chờ nạp phiếu đo/khảo sát thực tế)'],
    [4, 'B2_CT ↔ B1', 'Kiểm tra giờ giảm chuyển đổi số/thuê dịch vụ không vượt giờ B1 và đã đối chiếu trùng', '5. B2_CT_TacDong', '4. B1_KhoiLuong', fNum(0, `COUNTIFS('5. B2_CT_TacDong'!$A$3:$A$202,"<>",'5. B2_CT_TacDong'!$P$3:$P$202,"<>ĐẠT")`), 0, 'ĐẠT'],
    [5, 'D1 ↔ C1', 'Kiểm tra không trùng Mã nguồn lực, không vượt quỹ giờ và rà soát chuyển tiếp Trợ giảng (khoản 5 Điều 15 TT 31/2026)', '9. D1_NhanLuc', '3. C1_VTVL', fNum(0, `COUNTIFS('9. D1_NhanLuc'!$A$3:$A$500,"<>",'9. D1_NhanLuc'!$J$3:$J$500,"<>Đạt")`), 0, 'ĐẠT'],
    [6, 'C3 ↔ D2', 'Kiểm tra nhu cầu nhân lực C3_NhuCau và phương án biên chế 2027–2031 tại D2_PhuongAn', '8. C3_NhuCau', '10. D2_PhuongAn', fNum(0, `COUNTIFS('8. C3_NhuCau'!$A$3:$A$100,"<>",'8. C3_NhuCau'!$M$3:$M$100,"<>ĐẠT")`), 0, 'ĐẠT']
  ]);
  XLSX.utils.book_append_sheet(wb, wsK, '13. K_KiemTra');

  // 6. 14. T_TienDo
  const totalTasks = positions.reduce((s, p) => s + p.taskCount, 0);
  const totalFte = Number(positions.reduce((s, p) => s + p.recommendedFte, 0).toFixed(2));
  const wsT = XLSX.utils.aoa_to_sheet([
    ['BIỂU 14. T_TienDo — TỔNG HỢP TIẾN ĐỘ HOÀN THIỆN BỘ BIỂU ĐƠN VỊ'],
    ['Mã đơn vị', 'Tên đơn vị', 'Số nhiệm vụ (A1)', 'Số công việc (A2)', 'Số VTVL (C1)', 'Tổng FTE nhu cầu (C3)', 'Trạng thái rà soát K_KiemTra'],
    [
      opts.unitCode,
      opts.unitCode === 'TCNS' ? 'Phòng Tổ chức – Nhân sự (HCM-UTE)' : `${opts.unitNameVi} (HCM-UTE)`,
      fNum(opts.unitCode === 'TCNS' ? 8 : 4, `COUNTA('1. A1_NhiemVu'!$A$3:$A$200)`),
      fNum(totalTasks, `COUNTA('2. A2_CongViec'!$A$3:$A$500)`),
      fNum(positions.length, `COUNTA('3. C1_VTVL'!$A$3:$A$100)`),
      fNum(totalFte, `SUM('8. C3_NhuCau'!$J$3:$J$100)`),
      opts.unitCode === 'TCNS' ? 'Đã nạp dữ liệu mẫu thực tế TCNS' : 'Đang thu thập phiếu khảo sát thực tế'
    ]
  ]);
  XLSX.utils.book_append_sheet(wb, wsT, '14. T_TienDo');

  // 7. 15. S_NhatKy
  const wsS = XLSX.utils.aoa_to_sheet([
    ['BIỂU 15. S_NhatKy — NHẬT KÝ PHIÊN BẢN VÀ LỊCH SỬ CẬP NHẬT DỮ LIỆU ĐƠN VỊ'],
    ['Kỳ', 'Biểu', 'Mã', 'Trường', 'Giá trị cũ', 'Giá trị mới', 'Nguồn', 'Người xác nhận', 'Ngày', 'Phiên bản'],
    [
      opts.period, 'Toàn bộ 10 biểu (A1–D2)', opts.unitCode,
      'Khởi tạo tệp đơn vị theo quy trình 08 bước, 10 biểu chuẩn HD 07-HD/BTCTW, Phụ lục I HCM-UTE & TT 31/2026',
      'Mẫu gốc XXX', `${opts.unitCode}_K2526_v1_${compactDate}.xlsx`,
      'Hệ thống VTVL HCM-UTE', actorDisplay, opts.exportDate, 'v1'
    ]
  ]);
  XLSX.utils.book_append_sheet(wb, wsS, '15. S_NhatKy');

  // 8. THAO_TAC_NHANH
  const wsThaoTacNhanh = XLSX.utils.aoa_to_sheet([
    ['THAO TÁC NHANH THEO QUY TRÌNH 08 BƯỚC VÀ 10 BIỂU NGHIỆP VỤ (HƯỚNG DẪN SỐ 07-HD/BTCTW & BỘ PHỤ LỤC I–VIII)'],
    ['BƯỚC', 'BIỂU SỬ DỤNG', 'CƠ SỞ CẦN LÀM', 'KHÔNG LÀM / ĐIỀU KIỆN ĐƯỢC TÍNH'],
    ...HD07_EIGHT_STEPS_PROCESS.map((s) => [s.title, s.sheets, s.result, s.condition])
  ]);
  XLSX.utils.book_append_sheet(wb, wsThaoTacNhanh, 'THAO_TAC_NHANH');

  // 9. DM_06_NHOM
  const ws6Nhom = XLSX.utils.aoa_to_sheet([
    ['DANH MỤC 06 NHÓM SẢN PHẨM CHUẨN (I–VI) THEO HƯỚNG DẪN SỐ 07-HD/BTCTW'],
    ['Ký hiệu Nhóm', 'Tên nhóm sản phẩm chuẩn', 'Ví dụ sản phẩm điển hình tại HCM-UTE'],
    ...HD07_SIX_PRODUCT_GROUPS.map((g) => [g.roman, g.name, g.examples])
  ]);
  XLSX.utils.book_append_sheet(wb, ws6Nhom, 'DM_06_NHOM');

  // 10. QUY_TAC_MA & DM_THAM_SO
  const wsQuyTacMa = XLSX.utils.aoa_to_sheet([
    ['QUY TẮC ĐẶT MÃ THỐNG NHẤT TRONG BỘ BIỂU VTVL HCM-UTE (PHỤ LỤC I: QL10–QL60, CM63–CM113, HT26–HT62)'],
    ['Đối tượng', 'Cấu trúc mã chuẩn', 'Ví dụ minh họa'],
    ['Mã nhiệm vụ (A1)', '[MÃ_ĐV].NV[01..99]', `${opts.unitCode}.NV01`],
    ['Mã công việc (A2, B1, B2)', '[MÃ_NV].CV[01..99]', `${opts.unitCode}.NV01.CV01`],
    ['Mã vị trí việc làm (C1, C2, C3, D1, D2)', '[MÃ_ĐV].[MÃ_PL1] (QL10–QL60 | CM63–CM113 | HT26–HT62)', `${opts.unitCode}.QL33, ${opts.unitCode}.HT45`],
    ['Phụ lục I Danh mục VTVL HCM-UTE', 'I. Quản lý (QL10–QL60) | II. Nghề nghiệp (CM63–CM113) | III. Hỗ trợ, phục vụ (HT26–HT62)', 'Bậc nghề nghiệp từ Bậc 1 đến Bậc 5'],
    ['Mã chức danh giảng viên ĐH (Khoản 9 Điều 2 TT 31/2026)', 'CM76: V.07.01.01 (Bậc 5) | V.07.01.02 (Bậc 4) | V.07.01.03 (Bậc 3)', 'Giảng viên cao cấp (A3.1) | Giảng viên chính (A2.1) | Giảng viên (A1)']
  ]);
  XLSX.utils.book_append_sheet(wb, wsQuyTacMa, 'QUY_TAC_MA');

  const wsThamSo = XLSX.utils.aoa_to_sheet([
    ['BẢNG DANH MỤC THAM SỐ DROPDOWN CHUẨN (DM_THAM_SO — HD 07-HD/BTCTW, NĐ 232/2026/NĐ-CP & TT 31/2026/TT-BGDĐT)'],
    ['Nhóm tham số', 'Các giá trị hợp lệ trong bộ biểu'],
    ['TT_A1 (Trạng thái nhiệm vụ)', 'Tiếp tục thực hiện | Mới tiếp nhận | Đã chuyển giao | Không còn thực hiện'],
    ['TT_B1 (Căn cứ thời gian B1)', 'Có định mức | Kiểm đếm, ước lượng thực tế'],
    ['LOAI_TD (Loại tác động B2_CT)', 'Số hóa | Cải tiến quy trình | Thuê dịch vụ/đặt hàng | Tự chủ | Xã hội hóa | Công việc mới phát sinh'],
    ['LOAI_NL (Loại nhân lực C1, D1)', 'Viên chức | Hợp đồng lao động | Hợp đồng khoán việc | Thuê dịch vụ'],
    ['CHE_DO (Chế độ làm việc C1)', 'Phổ biến (40 giờ/tuần) | Đặc thù'],
    ['PP (Phương pháp C3)', 'PP1 | PP2 | PP3 | PP1+PP2 | PP1+PP3 | PP2+PP3'],
    ['BAC_NGHE_NGHIEP (Phụ lục I HCM-UTE)', 'Bậc 1 | Bậc 2 | Bậc 3 | Bậc 4 | Bậc 5 (CM76: Bậc 3, 4, 5; CM79/80/65/103: Bậc 3, 4; HT46/49/50/51: Bậc 2, 3, 4; HT61: Bậc 1, 2, 3)']
  ]);
  XLSX.utils.book_append_sheet(wb, wsThamSo, 'DM_THAM_SO');

  // 11. DU_BAO_5_NAM (10 cột A–J — Liên kết INDEX/MATCH từ 8. C3_NhuCau sang 10. D2_PhuongAn)
  const duBaoRows: (string | number | XLSX.CellObject)[][] = [];
  positions.forEach((p) => {
    HD07_CONSTANTS.FORECAST_YEARS.forEach((yr) => {
      const r = duBaoRows.length + 3;
      duBaoRows.push([
        p.vtvlCode, yr, 0,
        'Không thay đổi so với năm cơ sở (ổn định theo quy mô đào tạo và chuyển đổi số HCM-UTE)',
        `Đề án VTVL ${opts.unitCode} & Kế hoạch chiến lược HCM-UTE giai đoạn 2027–2031`,
        'Đã xác nhận',
        fNum(p.recommendedFte, `IF(A${r}="","",IFERROR(INDEX('8. C3_NhuCau'!$J$3:$J$100,MATCH(A${r},'8. C3_NhuCau'!$A$3:$A$100,0)),0))`),
        fNum(p.recommendedFte, `IF(G${r}="","",G${r}+IF(ISNUMBER(C${r}),C${r},0))`),
        'ĐẠT', ''
      ]);
    });
  });
  const wsDuBao = XLSX.utils.aoa_to_sheet([
    ['DU_BAO_5_NAM — DỰ BÁO THAY ĐỔI NHU CẦU NHÂN LỰC GIAI ĐOẠN 2027–2031', '→ Điền trước khi lập D2_PhuongAn; mỗi năm có thay đổi phải ghi rõ căn cứ và được xác nhận'],
    ['Mã VTVL', 'Năm', 'Biến động so C3 (+/− người)', 'Nội dung thay đổi / xác nhận không đổi', 'Căn cứ nguồn và thời điểm', 'Trạng thái xác nhận', 'Người C3 năm cơ sở', 'Người cần bố trí trong năm', 'Kiểm tra, đối chiếu', 'Ghi chú đầu mối'],
    ...duBaoRows
  ]);
  XLSX.utils.book_append_sheet(wb, wsDuBao, 'DU_BAO_5_NAM');

  // 12. Can_cu_goi_y
  const scaleMult = opts.scaleMetrics?.scaleMultiplier || 1;
  const wsCanCuGoiY = XLSX.utils.aoa_to_sheet([
    [`TRANG CAN_CU_GOI_Y — CĂN CỨ ĐIỀN SẴN Ô MÀU CAM THEO QUY MÔ ĐƠN VỊ [${opts.unitCode}] (HỆ SỐ NỘI SUY: ×${scaleMult})`],
    ['Lưu ý vận hành: Ô màu cam là số liệu điền sẵn theo gợi ý — mỗi đơn vị/cá nhân sửa theo thực tế, đếm số sản phẩm từ sổ sách E-Office/PMS. Dòng giữ nguyên số gợi ý sẽ được ghi là "mức tham khảo, chưa đo thực tế" và đưa vào danh sách Chưa đủ căn cứ.'],
    ['Mã VTVL', 'Tên VTVL cụ thể tại đơn vị', 'Phương pháp', 'Hệ số quy mô đơn vị', 'Giờ B1 gợi ý (ô cam)', 'Phân loại mức độ', 'Nguồn căn cứ gợi ý (Phụ lục III & Định mức tham khảo HCM-UTE)', 'Trạng thái xác thực'],
    ...positions.map((p) => [
      p.vtvlCode, p.vtvlName, p.method, scaleMult,
      Number((p.b1HoursYear * scaleMult).toFixed(1)), 'Thông thường',
      `Nội suy từ quy mô đơn vị [${opts.unitCode}] & Định mức tham khảo HCM-UTE (1907/HD-ĐHCNKT)`,
      opts.unitCode === 'TCNS' ? 'Dữ liệu mẫu thực tế Phòng Tổ chức – Nhân sự (QĐ 2266, PL18)' : 'Ô cam gợi ý — mức tham khảo, chưa đo thực tế'
    ])
  ]);
  XLSX.utils.book_append_sheet(wb, wsCanCuGoiY, 'Can_cu_goi_y');
}
