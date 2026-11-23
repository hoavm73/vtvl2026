import { ExcelSheetKey, ExcelSheetMeta } from './excel-grid-types';

export const EVAL_EXCEL_SHEET_METAS: Record<
  'C2' | 'C3' | 'D1' | 'D2' | 'DM_SP' | 'DU_BAO' | 'K' | 'T' | 'S',
  ExcelSheetMeta
> = {
  C2: {
    key: 'C2',
    stepNum: 7,
    sheetNumberPrefix: '7',
    sheetName: '7. C2_NangLuc',
    shortLabel: '7. C2_NangLuc',
    title: 'Biểu C2_ Mô tả năng lực (Bản mô tả VTVL & Khung năng lực theo chuẩn HD07)',
    guideDesc: 'Biểu 7 (Bước 5 nghiệp vụ): Mỗi VTVL khai đúng 1 dòng gồm 7 cột chuẩn HD07: Mã VTVL, Trách nhiệm, Năng lực chung, Chuyên môn, Lãnh đạo, Căn cứ và Nguồn bản mô tả.',
    ruleHint: 'Mỗi Mã VTVL tại Biểu 3. C1_VTVL tương ứng 1 dòng mô tả tại Biểu 7. C2_NangLuc (ghi rõ Bậc nghề nghiệp 1–5 tại cột Chuyên môn theo NĐ 232/2026/NĐ-CP).',
    columns: [
      { colLetter: 'A', field: 'maVtvl', headerName: 'Mã VTVL', width: '140px', type: 'select', required: true, dynamicOptionsKey: 'vtvlList' },
      { colLetter: 'B', field: 'trachNhiem', headerName: 'Trách nhiệm', width: '300px', required: true },
      { colLetter: 'C', field: 'nangLucChung', headerName: 'Năng lực chung', width: '260px', required: true },
      { colLetter: 'D', field: 'chuyenMon', headerName: 'Chuyên môn', width: '300px', required: true },
      { colLetter: 'E', field: 'lanhDao', headerName: 'Lãnh đạo', width: '240px', required: true },
      { colLetter: 'F', field: 'canCu', headerName: 'Căn cứ', width: '240px', required: true },
      { colLetter: 'G', field: 'nguonBanMoTa', headerName: 'Nguồn bản mô tả', width: '240px', required: true }
    ]
  },
  C3: {
    key: 'C3',
    stepNum: 8,
    sheetNumberPrefix: '8',
    sheetName: '8. C3_NhuCau',
    shortLabel: '8. C3_NhuCau',
    title: 'Biểu C3_ Nhu cầu (Xác định số người cần thiết theo phương pháp PP1, PP2)',
    guideDesc: 'Biểu 8 (Bước 6 nghiệp vụ): Tự động tổng hợp giờ làm việc từ B1/B2, chia cho Quỹ giờ chuẩn PP2 (C1) để xác định số người FTE (Cột G & Cột J).',
    ruleHint: 'Phương pháp PP1 (1 người quản lý), PP2 (Tổng giờ ròng / 1.904h), làm tròn lên số người cần bố trí (Cột J).',
    columns: [
      { colLetter: 'A', field: 'maVtvl', headerName: 'Mã VTVL', width: '130px', type: 'select', required: true, dynamicOptionsKey: 'vtvlList' },
      { colLetter: 'B', field: 'phuongPhap', headerName: 'Phương pháp', width: '110px', type: 'select', required: true, selectOptions: ['PP1', 'PP2', 'PP3', 'PP1+PP2', 'PP1+PP3', 'PP2+PP3'] },
      { colLetter: 'C', field: 'gioB1', headerName: 'Giờ B1', width: '110px', isFormula: true, formulaHint: '=SUMIFS(B1!G,...)' },
      { colLetter: 'D', field: 'gioB2', headerName: 'Giờ tác động B2', width: '120px', isFormula: true, formulaHint: '=SUMIFS(B2!F,...)' },
      { colLetter: 'E', field: 'gioRong', headerName: 'Giờ ròng', width: '110px', isFormula: true, formulaHint: '=C+D' },
      { colLetter: 'F', field: 'gioPp2', headerName: 'Giờ chuẩn (từ C1)', width: '120px', isFormula: true, formulaHint: '=INDEX(C1!E,...)' },
      { colLetter: 'G', field: 'nguoiQuyDoi', headerName: 'Người quy đổi PP2', width: '130px', isFormula: true, formulaHint: '=ROUND(E/F,2)' },
      { colLetter: 'H', field: 'nguoiPp1', headerName: 'Người PP1', width: '90px', required: true },
      { colLetter: 'J', field: 'nguoiCanBoTri', headerName: 'Người cần bố trí', width: '130px', isFormula: true, formulaHint: '=ROUNDUP(G,0)' },
      { colLetter: 'K', field: 'nguonGiaiTrinh', headerName: 'Nguồn / Giải trình', width: '220px', required: true },
      { colLetter: 'M', field: 'canhBao', headerName: 'Cảnh báo C3', width: '100px', type: 'status' },
      { colLetter: 'N', field: 'trangThai', headerName: 'Trạng thái', width: '150px', type: 'select', required: true, selectOptions: ['Tính thử', 'Chưa đủ dữ liệu', 'Đã kiểm chứng', 'Không áp dụng'] }
    ]
  },
  D1: {
    key: 'D1',
    stepNum: 9,
    sheetNumberPrefix: '9',
    sheetName: '9. D1_NhanLuc',
    shortLabel: '9. D1_NhanLuc',
    title: 'Biểu D1_ Nhân lực (Phân bổ mã nguồn lực & quỹ giờ chốt ngày 30/9/2026)',
    guideDesc: 'Biểu 9 (Bước 7 nghiệp vụ): Kê khai phân bổ nguồn lực theo Mã nguồn lực (11 cột chuẩn HD07), tự động đối chiếu quỹ giờ chuẩn năm từ C1 và cảnh báo vượt quỹ giờ.',
    ruleHint: 'Mỗi cá nhân chốt ngày 30/9/2026 dùng một Mã nguồn lực duy nhất; tổng Giờ dành cho VTVL (Cột E) + Giờ việc khác (Cột F) không được vượt Giờ quy đổi/năm (Cột D).',
    columns: [
      { colLetter: 'A', field: 'maNguonLuc', headerName: 'Mã nguồn lực', width: '150px', required: true },
      { colLetter: 'B', field: 'maVtvl', headerName: 'Mã VTVL', width: '140px', type: 'select', required: true, dynamicOptionsKey: 'vtvlList' },
      { colLetter: 'C', field: 'loaiNhanLuc', headerName: 'Loại nhân lực', width: '150px', type: 'select', required: true, selectOptions: ['Viên chức', 'Hợp đồng lao động', 'Hợp đồng khoán việc', 'Thuê dịch vụ'] },
      { colLetter: 'D', field: 'gioQuyDoiNam', headerName: 'Giờ quy đổi/năm (tự lấy)', width: '140px', type: 'number', isFormula: true, formulaHint: '=IF(ISNUMBER(K),K,INDEX(C1!E,MATCH(B,C1!A,0)))' },
      { colLetter: 'E', field: 'gioChoVtvl', headerName: 'Giờ dành cho VTVL', width: '130px', type: 'number', required: true },
      { colLetter: 'F', field: 'gioViecKhac', headerName: 'Giờ việc khác', width: '120px', type: 'number', required: true },
      { colLetter: 'G', field: 'noiTinhBc', headerName: 'Nơi tính BC', width: '200px', required: true },
      { colLetter: 'H', field: 'nguon', headerName: 'Nguồn', width: '220px', required: true },
      { colLetter: 'I', field: 'trangThai', headerName: 'Trạng thái', width: '150px', type: 'select', required: true, selectOptions: ['Đã kiểm chứng', 'Chưa kiểm chứng', 'Đang rà soát'] },
      { colLetter: 'J', field: 'canhBao', headerName: 'Cảnh báo', width: '150px', type: 'status', isFormula: true, formulaHint: '=IF(A="","",IF(COUNTIF(A:A,A)>1,"TRÙNG MÃ NGUỒN LỰC",IF(G="","THIẾU NƠI TÍNH BIÊN CHẾ",IF(OR(D="",E="",F="",H="",I<>"Đã kiểm chứng"),"Chưa đủ căn cứ",IF(E+F>D,"Vượt quỹ giờ","Đạt")))))' },
      { colLetter: 'K', field: 'gioRieng', headerName: 'Giờ riêng theo chế độ', width: '140px', type: 'number' }
    ]
  },
  DU_BAO: {
    key: 'DU_BAO',
    stepNum: 10,
    sheetNumberPrefix: '10',
    sheetName: '10. DU_BAO_5_NAM',
    shortLabel: '10. DU_BAO_5_NAM',
    title: 'Biểu 10. DU_BAO_5_NAM — Dự báo thay đổi khối lượng công việc 2027–2031',
    guideDesc: 'Biểu 10 (Bước 7 nghiệp vụ): Dự báo biến động nhu cầu nhân lực từng năm giai đoạn 2027–2031 so với năm cơ sở (C3).',
    ruleHint: 'Mỗi thay đổi tăng/giảm (+/- người) phải có căn cứ rõ ràng và được lãnh đạo xác nhận.',
    columns: [
      { colLetter: 'A', field: 'maVtvl', headerName: 'Mã VTVL', width: '130px', type: 'select', required: true, dynamicOptionsKey: 'vtvlList' },
      { colLetter: 'B', field: 'nam', headerName: 'Năm dự báo', width: '100px', required: true },
      { colLetter: 'C', field: 'bienDong', headerName: 'Biến động (+/- người, 0 nếu không đổi)', width: '160px', type: 'number', required: true },
      { colLetter: 'D', field: 'noiDungThayDoi', headerName: 'Nội dung thay đổi', width: '260px', required: true },
      { colLetter: 'E', field: 'canCuNguon', headerName: 'Căn cứ nguồn', width: '200px', required: true },
      { colLetter: 'G', field: 'nguoiC3', headerName: 'Người C3 năm cơ sở', width: '130px', isFormula: true, formulaHint: '=INDEX(C3!J,...)' },
      { colLetter: 'H', field: 'nguoiCanBoTriNam', headerName: 'Người cần bố trí trong năm', width: '160px', isFormula: true, formulaHint: '=G+C' },
      { colLetter: 'I', field: 'kiemTra', headerName: 'Kiểm tra, đối chiếu', width: '180px', type: 'status' }
    ]
  },
  D2: {
    key: 'D2',
    stepNum: 11,
    sheetNumberPrefix: '11',
    sheetName: '11. D2_PhuongAn',
    shortLabel: '11. D2_PhuongAn',
    title: 'Biểu 11. D2_PhuongAn — Lập phương án biên chế từng năm 2027–2031',
    guideDesc: 'Biểu 11 (Bước 7 nghiệp vụ): So sánh số người cần bố trí (Cột C, lấy từ 10. DU_BAO_5_NAM) với số người có thể bố trí (Cột D, đếm từ D1_NhanLuc).',
    ruleHint: 'Đề nghị điều chỉnh (Cột G) = Cột C - Cột D. Bắt buộc nhập số nguyên (nhập 0 nếu không đổi).',
    columns: [
      { colLetter: 'A', field: 'maVtvl', headerName: 'Mã VTVL', width: '130px', type: 'select', required: true, dynamicOptionsKey: 'vtvlList' },
      { colLetter: 'B', field: 'nam', headerName: 'Năm phương án', width: '110px', required: true },
      { colLetter: 'C', field: 'soNguoiCanBoTri', headerName: 'Người cần bố trí trong năm', width: '160px', isFormula: true, formulaHint: '=SUMIFS(DU_BAO!H,...)' },
      { colLetter: 'D', field: 'soNguoiCoTheBoTri', headerName: 'Người có thể bố trí', width: '140px', isFormula: true, formulaHint: '=COUNTIFS(D1!B,A)' },
      { colLetter: 'E', field: 'bienCheGiao', headerName: 'Biên chế được giao', width: '130px', type: 'number', required: true },
      { colLetter: 'G', field: 'deNghiDieuChinh', headerName: 'Đề nghị điều chỉnh (0 nếu không đổi)', width: '160px', type: 'number', required: true },
      { colLetter: 'H', field: 'nguonGiaiTrinh', headerName: 'Nguồn / Giải trình', width: '220px', required: true },
      { colLetter: 'J', field: 'canhBao', headerName: 'Cảnh báo D2', width: '180px', type: 'status' },
      { colLetter: 'K', field: 'trangThai', headerName: 'Trạng thái', width: '180px', type: 'select', required: true, selectOptions: ['Đang xây dựng', 'Đã hoàn thành ở đơn vị', 'Đã thẩm định', 'Đã được quyết định'] }
    ]
  },
  DM_SP: {
    key: 'DM_SP',
    stepNum: 12,
    sheetNumberPrefix: '12',
    sheetName: '12. DM_SAN_PHAM',
    shortLabel: '12. DM_SAN_PHAM',
    title: 'Biểu 12. DM_SAN_PHAM — Danh mục 06 nhóm sản phẩm chuẩn và định mức',
    guideDesc: 'Biểu 12: Tra cứu sản phẩm chuẩn phân nhóm I–VI và thời gian định mức (phút/SP) được HCM-UTE xác nhận.',
    ruleHint: 'Nếu sử dụng mã sản phẩm chuẩn thì B1_KhoiLuong sẽ tự động tra cứu định mức chuẩn.',
    columns: [
      { colLetter: 'A', field: 'maSpChuan', headerName: 'Mã SP chuẩn', width: '120px', required: true },
      { colLetter: 'B', field: 'tenSp', headerName: 'Tên / Loại sản phẩm', width: '280px', required: true },
      { colLetter: 'C', field: 'linhVuc', headerName: 'Khối / Ngành / Lĩnh vực', width: '180px', required: true },
      { colLetter: 'D', field: 'nhom', headerName: 'Nhóm I–VI', width: '90px', required: true },
      { colLetter: 'E', field: 'phutChuan', headerName: 'Phút/SP chuẩn', width: '110px', required: true },
      { colLetter: 'F', field: 'vanBan', headerName: 'Văn bản / Nguồn xác nhận', width: '220px', required: true },
      { colLetter: 'G', field: 'trangThai', headerName: 'Trạng thái chuẩn', width: '130px', type: 'select', required: true, selectOptions: ['Đã xác nhận', 'Đang thẩm định'] },
      { colLetter: 'H', field: 'coQuan', headerName: 'Cơ quan xác nhận', width: '160px', required: true }
    ]
  },
  K: {
    key: 'K',
    stepNum: 13,
    sheetNumberPrefix: '13',
    sheetName: '13. K_KiemTra',
    shortLabel: '13. K_KiemTra',
    title: 'Biểu 13. K_KiemTra — Bảng kiểm soát chéo tự động bộ biểu VTVL',
    guideDesc: 'Bảng kiểm soát chéo 6 chỉ tiêu tự động giữa các sheet: A2 ↔ A1, B1 ↔ C1, B1 cảnh báo, B2_CT ↔ B1, D1 ↔ C1, C3 ↔ D2.',
    ruleHint: 'Hồ sơ chỉ đủ điều kiện nộp thẩm định khi Số dòng lỗi = 0 trên toàn bộ 6 chỉ tiêu.',
    columns: [
      { colLetter: 'A', field: 'stt', headerName: 'STT', width: '60px', type: 'number', isFormula: true },
      { colLetter: 'B', field: 'nhomBieu', headerName: 'Nhóm biểu đối chiếu', width: '140px', isFormula: true },
      { colLetter: 'C', field: 'chiTieu', headerName: 'Chỉ tiêu kiểm tra chéo', width: '320px', isFormula: true },
      { colLetter: 'D', field: 'bangNguon', headerName: 'Bảng nguồn', width: '160px', isFormula: true },
      { colLetter: 'E', field: 'bangDich', headerName: 'Bảng đích', width: '160px', isFormula: true },
      { colLetter: 'F', field: 'soDongLoi', headerName: 'Số dòng lỗi', width: '100px', type: 'number', isFormula: true },
      { colLetter: 'G', field: 'nguongChoPhep', headerName: 'Ngưỡng cho phép', width: '130px', isFormula: true },
      { colLetter: 'H', field: 'ketLuan', headerName: 'Kết luận', width: '110px', type: 'status', isFormula: true }
    ]
  },
  T: {
    key: 'T',
    stepNum: 14,
    sheetNumberPrefix: '14',
    sheetName: '14. T_TienDo',
    shortLabel: '14. T_TienDo',
    title: 'Biểu 14. T_TienDo — Theo dõi tiến độ kê khai và thẩm định',
    guideDesc: 'Biểu 14: Nhật ký xác nhận tiến độ kê khai qua từng bước theo đúng lịch trình triển khai của Trường.',
    ruleHint: 'Cập nhật trạng thái từng bước: Đang thực hiện / Hoàn thành / Chờ thẩm định.',
    columns: [
      { colLetter: 'A', field: 'buoc', headerName: 'Bước thực hiện', width: '220px', required: true },
      { colLetter: 'B', field: 'bieuApDung', headerName: 'Biểu áp dụng', width: '180px', required: true },
      { colLetter: 'C', field: 'nguoiThucHien', headerName: 'Người thực hiện', width: '180px', required: true },
      { colLetter: 'D', field: 'ngayBatDau', headerName: 'Ngày bắt đầu', width: '120px', required: true },
      { colLetter: 'E', field: 'ngayHoanThanh', headerName: 'Ngày hoàn thành', width: '130px', required: true },
      { colLetter: 'F', field: 'trangThai', headerName: 'Trạng thái tiến độ', width: '150px', type: 'select', required: true, selectOptions: ['Chưa bắt đầu', 'Đang thực hiện', 'Hoàn thành', 'Chờ phê duyệt'] },
      { colLetter: 'G', field: 'ghiChu', headerName: 'Ghi chú', width: '200px' }
    ]
  },
  S: {
    key: 'S',
    stepNum: 15,
    sheetNumberPrefix: '15',
    sheetName: '15. S_NhatKy',
    shortLabel: '15. S_NhatKy',
    title: 'Biểu 15. S_NhatKy — Lịch sử chỉnh sửa và thẩm định dữ liệu',
    guideDesc: 'Biểu 15: Tự động ghi lại nhật ký mọi thao tác thêm, sửa, xóa hoặc thẩm định trên toàn bộ 15 trang tính.',
    ruleHint: 'Bảo đảm tính toàn vẹn và minh bạch của hồ sơ VTVL đơn vị.',
    columns: [
      { colLetter: 'A', field: 'thoiGian', headerName: 'Thời gian', width: '160px', isFormula: true },
      { colLetter: 'B', field: 'nguoiThaoTac', headerName: 'Người thao tác', width: '160px', isFormula: true },
      { colLetter: 'C', field: 'bieuThayDoi', headerName: 'Biểu thay đổi', width: '160px', isFormula: true },
      { colLetter: 'D', field: 'noiDungThayDoi', headerName: 'Nội dung thay đổi', width: '340px', isFormula: true },
      { colLetter: 'E', field: 'canCuThayDoi', headerName: 'Căn cứ thay đổi', width: '200px', isFormula: true }
    ]
  }
};
