import { ExcelSheetKey, ExcelSheetMeta } from './excel-grid-types';

export const CORE_EXCEL_SHEET_METAS: Record<
  'A1' | 'A2' | 'B1' | 'B2_CT' | 'B2' | 'C1',
  ExcelSheetMeta
> = {
  A1: {
    key: 'A1',
    stepNum: 1,
    sheetNumberPrefix: '1',
    sheetName: '1. A1_NhiemVu',
    shortLabel: '1. A1_NhiemVu',
    title: 'Biểu A1_ Nhiệm vụ (Rà soát nhiệm vụ theo Quyết định 2266/QĐ-ĐHCNKT)',
    guideDesc: 'Biểu 1 (Bước 1 nghiệp vụ): Rà soát chức năng, nhiệm vụ được giao theo QĐ chức năng nhiệm vụ (QĐ 2266, Phụ lục 18) và phân loại tiếp tục thực hiện.',
    ruleHint: 'Mã nhiệm vụ chuẩn: [MÃ_ĐV].NV[01..99] (ví dụ: TCNS.NV01). Mỗi nhiệm vụ có một mã riêng, tự động tăng dần khi thêm mới.',
    columns: [
      { colLetter: 'A', field: 'maNhiemVu', headerName: 'Mã nhiệm vụ ([ĐV].NVxx)', width: '170px' },
      { colLetter: 'B', field: 'tenNhiemVu', headerName: 'Tên nhiệm vụ được giao', width: '480px' },
      { colLetter: 'C', field: 'coQuan', headerName: 'Cơ quan / Đơn vị thực hiện', width: '250px' },
      { colLetter: 'D', field: 'canCu', headerName: 'Căn cứ giao nhiệm vụ (QĐ 2266)', width: '280px' },
      { colLetter: 'E', field: 'ky', headerName: 'Kỳ số liệu', width: '160px' },
      { colLetter: 'F', field: 'trangThai', headerName: 'Trạng thái', width: '170px', type: 'select', selectOptions: ['Tiếp tục thực hiện', 'Mới tiếp nhận', 'Đã chuyển giao', 'Không còn thực hiện'] },
      { colLetter: 'G', field: 'nguon', headerName: 'Nguồn dữ liệu / Quyết định', width: '260px' }
    ]
  },
  A2: {
    key: 'A2',
    stepNum: 2,
    sheetNumberPrefix: '2',
    sheetName: '2. A2_CongViec',
    shortLabel: '2. A2_CongViec',
    title: 'Biểu A2_ Công việc (Phân rã công việc gắn Mã nhiệm vụ & Mã VTVL)',
    guideDesc: 'Biểu 2 (Bước 2 nghiệp vụ): Phân rã nhiệm vụ thành từng công việc, xác định sản phẩm đầu ra, đơn vị tính, chất lượng và gán trực tiếp Mã VTVL chịu trách nhiệm.',
    ruleHint: 'Mã công việc chuẩn: [Mã nhiệm vụ].CV[01..99] (ví dụ: TCNS.NV01.CV01). Tự động kế thừa mã nhiệm vụ và tăng dần theo từng nhiệm vụ.',
    columns: [
      { colLetter: 'A', field: 'maCongViec', headerName: 'Mã công việc ([NV].CVxx)', width: '170px' },
      { colLetter: 'B', field: 'maNhiemVu', headerName: 'Mã nhiệm vụ (A1)', width: '140px', type: 'select', dynamicOptionsKey: 'missionList' },
      { colLetter: 'C', field: 'maVtvl', headerName: 'Mã VTVL (từ C1)', width: '130px', type: 'select', dynamicOptionsKey: 'vtvlList' },
      { colLetter: 'D', field: 'tenCongViec', headerName: 'Tên công việc cụ thể', width: '420px' },
      { colLetter: 'E', field: 'sanPham', headerName: 'Sản phẩm đầu ra', width: '250px' },
      { colLetter: 'F', field: 'dvt', headerName: 'Đơn vị tính', width: '130px' },
      { colLetter: 'G', field: 'chatLuong', headerName: 'Yêu cầu chất lượng', width: '250px' },
      { colLetter: 'H', field: 'canCu', headerName: 'Căn cứ (nguồn tài liệu)', width: '240px' },
      { colLetter: 'I', field: 'maVtvlPhoiHop', headerName: 'Mã VTVL phối hợp', width: '150px', type: 'select', dynamicOptionsKey: 'vtvlList' },
      { colLetter: 'J', field: 'trangThaiPhieu', headerName: 'Trạng thái phiếu', width: '120px', type: 'select', selectOptions: ['Đã nộp', 'Nháp'] }
    ]
  },
  C1: {
    key: 'C1',
    stepNum: 3,
    sheetNumberPrefix: '3',
    sheetName: '3. C1_VTVL',
    shortLabel: '3. C1_VTVL',
    title: 'Biểu C1_ Vị trí việc làm (Khai danh mục VTVL & Quỹ giờ chuẩn PP2)',
    guideDesc: 'Biểu 3 (Bước 3 nghiệp vụ): Khai danh mục VTVL của đơn vị, chọn chế độ làm việc và xác định quỹ giờ chuẩn PP2 (1.904h hoặc 1.760h).',
    ruleHint: 'Áp dụng mã Phụ lục I (QL10–QL60, CM63–CM113, HT26–HT62) theo quy định HCM-UTE.',
    columns: [
      { colLetter: 'A', field: 'maVtvl', headerName: 'Mã VTVL (Phụ lục I)', width: '160px', type: 'select', dynamicOptionsKey: 'pl1VtvlList' },
      { colLetter: 'B', field: 'tenVtvl', headerName: 'Tên VTVL cụ thể tại đơn vị', width: '260px' },
      { colLetter: 'C', field: 'loaiNhanLuc', headerName: 'Loại nhân lực', width: '130px', type: 'select', selectOptions: ['Viên chức', 'Hợp đồng lao động', 'Hợp đồng khoán việc', 'Thuê dịch vụ'] },
      { colLetter: 'D', field: 'quyetDinh', headerName: 'Quyết định / Căn cứ VTVL', width: '200px' },
      { colLetter: 'E', field: 'gioChuanPp2', headerName: 'Giờ chuẩn PP2', width: '110px', isFormula: true, formulaHint: '=IF(J="Đặc thù",1760,1904)' },
      { colLetter: 'F', field: 'canCuQuyGio', headerName: 'Căn cứ xác định quỹ giờ', width: '220px' },
      { colLetter: 'G', field: 'trangThai', headerName: 'Trạng thái', width: '150px', type: 'select', selectOptions: ['Tiếp tục sử dụng', 'Cần cập nhật', 'Đề nghị bổ sung', 'Đề nghị sửa đổi', 'Đề nghị bãi bỏ'] },
      { colLetter: 'H', field: 'gioRieng', headerName: 'Giờ riêng được xác nhận', width: '110px' },
      { colLetter: 'I', field: 'xacNhanGioRieng', headerName: 'Xác nhận giờ riêng', width: '130px' },
      { colLetter: 'J', field: 'cheDoLamViec', headerName: 'Chế độ làm việc', width: '170px', type: 'select', selectOptions: ['Phổ biến (40 giờ/tuần)', 'Đặc thù'] },
      { colLetter: 'K', field: 'kiemTra', headerName: 'Kiểm tra quỹ giờ', width: '100px', type: 'status', isFormula: true, formulaHint: '=IF(E>0,"ĐẠT","LỖI")' }
    ]
  },
  B1: {
    key: 'B1',
    stepNum: 4,
    sheetNumberPrefix: '4',
    sheetName: '4. B1_KhoiLuong',
    shortLabel: '4. B1_KhoiLuong',
    title: 'Biểu B1_ Khối lượng (Khối lượng sản phẩm & thời gian thực tế kỳ 2025–2026)',
    guideDesc: 'Biểu 4 (Bước 4 nghiệp vụ): Kê khai sản lượng thực tế trong 12 tháng (Cột C), số phút đo thực tế (Cột D), công thức tự tính Giờ SP và Giờ tổng.',
    ruleHint: 'Mã VTVL (Cột B) tự lấy từ A2; Giờ SP (Cột F) = Cột C × Cột P / 60; Giờ tổng (Cột G) = F + E.',
    columns: [
      { colLetter: 'A', field: 'maCongViec', headerName: 'Mã công việc', width: '160px', type: 'select', dynamicOptionsKey: 'taskList' },
      { colLetter: 'B', field: 'maVtvl', headerName: 'Mã VTVL', width: '120px', isFormula: true, formulaHint: '=INDEX(A2!C,MATCH(A,A2!A,0))' },
      { colLetter: 'C', field: 'soSpNam', headerName: 'Số SP/năm', width: '100px', type: 'number' },
      { colLetter: 'D', field: 'phutThucTe', headerName: 'Phút/SP (thực tế)', width: '120px', type: 'number' },
      { colLetter: 'E', field: 'gioBoSung', headerName: 'Giờ bổ sung', width: '110px', type: 'number' },
      { colLetter: 'F', field: 'gioSp', headerName: 'Giờ SP (công thức)', width: '130px', isFormula: true, formulaHint: '=ROUND(C*P/60,2)' },
      { colLetter: 'G', field: 'gioTong', headerName: 'Giờ tổng (công thức)', width: '130px', isFormula: true, formulaHint: '=ROUND(F+E,2)' },
      { colLetter: 'H', field: 'nguon', headerName: 'Nguồn số liệu sản lượng', width: '200px' },
      { colLetter: 'I', field: 'ppThucTe', headerName: 'PP đo thực tế', width: '120px', type: 'select', selectOptions: ['bấm giờ', 'nhật ký công việc', 'ước lượng chuyên gia'] },
      { colLetter: 'P', field: 'phutApDung', headerName: 'Phút/SP áp dụng', width: '120px', isFormula: true, formulaHint: '=IF(D>0,D,INDEX(DM_SP!E,...))' },
      { colLetter: 'R', field: 'canhBao', headerName: 'Cảnh báo dữ liệu', width: '160px', type: 'status', isFormula: true, formulaHint: '=IF(AND(S<>"",LEFT(S,12)<>"Đã xác nhận:"),"CHỜ XÁC NHẬN KHÁC CHUẨN",IF(G>0,"ĐẠT","CHƯA ĐẠT"))' },
      { colLetter: 'S', field: 'giaiTrinhKhacChuan', headerName: 'Giải trình khác chuẩn (Cột S)', width: '260px' },
      { colLetter: 'T', field: 'trangThaiPhieu', headerName: 'Trạng thái phiếu', width: '120px', type: 'select', selectOptions: ['Đã nộp', 'Nháp'] }
    ]
  },
  B2_CT: {
    key: 'B2_CT',
    stepNum: 5,
    sheetNumberPrefix: '5',
    sheetName: '5. B2_CT_TacDong',
    shortLabel: '5. B2_CT_TacDong',
    title: 'Biểu B2_CT_ Chi tiết tác động (Chuyển đổi số, tự chủ, thuê dịch vụ)',
    guideDesc: 'Biểu 5 (Bước 5 nghiệp vụ): Kê khai các công đoạn được số hóa (phần mềm quản trị, ERP...), ứng dụng AI hoặc chuyển giao giúp tăng năng suất/giảm thời gian.',
    ruleHint: 'Giờ biến động (Cột F) âm khi giảm thời gian nhờ CĐS, dương khi phát sinh nhiệm vụ mới.',
    columns: [
      { colLetter: 'A', field: 'maCongViec', headerName: 'Mã công việc', width: '160px', type: 'select', dynamicOptionsKey: 'taskList' },
      { colLetter: 'B', field: 'maVtvl', headerName: 'Mã VTVL', width: '120px', isFormula: true, formulaHint: '=INDEX(A2!C,MATCH(A,A2!A,0))' },
      { colLetter: 'C', field: 'congDoan', headerName: 'Công đoạn / Quy trình tác động', width: '240px' },
      { colLetter: 'D', field: 'loaiTacDong', headerName: 'Loại tác động', width: '160px', type: 'select', selectOptions: ['Số hóa', 'Cải tiến quy trình', 'Thuê dịch vụ/đặt hàng', 'Tự chủ', 'Xã hội hóa', 'Công việc mới phát sinh'] },
      { colLetter: 'E', field: 'mucDo', headerName: 'Mức độ', width: '100px', type: 'select', selectOptions: ['Toàn phần', 'Một phần'] },
      { colLetter: 'F', field: 'gioBienDong', headerName: 'Giờ biến động (– giảm, + tăng) (h/năm)', width: '140px', type: 'number' },
      { colLetter: 'G', field: 'vanBan', headerName: 'Văn bản / Đề án căn cứ', width: '220px' }
    ]
  },
  B2: {
    key: 'B2',
    stepNum: 6,
    sheetNumberPrefix: '6',
    sheetName: '6. B2_ThayDoi',
    shortLabel: '6. B2_ThayDoi',
    title: 'Biểu B2_ Thay đổi (Tổng hợp giờ tăng/giảm tự động từ Biểu 5. B2_CT)',
    guideDesc: 'Biểu 6: Bảng tổng hợp tự động giờ tăng/giảm bằng công thức SUMIFS từ Biểu 5. B2_CT theo từng Mã công việc và Mã VTVL.',
    ruleHint: 'Giờ tổng sau tác động (Cột F) = Giờ B1 (Cột C) + Giờ biến động (Cột D) + Giờ mới (Cột E).',
    columns: [
      { colLetter: 'A', field: 'maCongViec', headerName: 'Mã công việc', width: '150px' },
      { colLetter: 'B', field: 'maVtvl', headerName: 'Mã VTVL', width: '120px', isFormula: true, formulaHint: '=INDEX(B1!B,MATCH(A,B1!A,0))' },
      { colLetter: 'C', field: 'gioB1', headerName: 'Giờ B1 gốc', width: '110px', isFormula: true, formulaHint: '=INDEX(B1!G,MATCH(A,B1!A,0))' },
      { colLetter: 'D', field: 'gioGiam', headerName: 'Giờ biến động (– giảm, + tăng) (h/năm) (SUMIFS)', width: '130px', isFormula: true, formulaHint: '=SUMIFS(B2_CT!F,A,B2_CT!A)' },
      { colLetter: 'E', field: 'gioMoi', headerName: 'Giờ việc mới', width: '110px', type: 'number' },
      { colLetter: 'F', field: 'gioSauTacDong', headerName: 'Giờ sau tác động', width: '140px', isFormula: true, formulaHint: '=ROUND(C+D+E,2)' },
      { colLetter: 'G', field: 'tyLeThayDoi', headerName: 'Tỷ lệ thay đổi', width: '110px', isFormula: true, formulaHint: '=ROUND(D/C*100,1)&"%"' },
      { colLetter: 'H', field: 'trangThai', headerName: 'Trạng thái', width: '150px', type: 'select', selectOptions: ['Đã kiểm chứng', 'Chưa kiểm chứng', 'Ước lượng tham khảo'] },
      { colLetter: 'I', field: 'doiChieuTrung', headerName: 'Đối chiếu trùng/phạm vi', width: '160px', type: 'select', selectOptions: ['Đã đối chiếu', 'Chờ đối chiếu'] }
    ]
  }
};
