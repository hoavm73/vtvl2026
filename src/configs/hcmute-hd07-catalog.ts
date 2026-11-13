import {
  MissionTemplate,
  StandardProductItem,
  UnitGroupKind
} from '@/types/vtvl';

export const HD07_CONSTANTS = {
  STATISTICAL_PERIOD: '01/10/2025–30/9/2026',
  STAFF_CUTOFF_DATE: '30/9/2026',
  FORECAST_YEARS: [2027, 2028, 2029, 2030, 2031] as const,
  STANDARD_PP2_HOURS: 1904,
  LECTURER_SPECIAL_HOURS: 1760,
  DEFAULT_UNLOCK_PASS: 'VTVL2026',
  TEACHER_CIRCULAR_2026: 'Thông tư số 31/2026/TT-BGDĐT ngày 14/4/2026'
};

export const TT31_2026_EDUCATOR_CATALOG = [
  {
    level: 'Khoản 9 Điều 2 & Điều 14 — Giảng viên đại học',
    title: 'Giảng viên cao cấp',
    code: 'V.07.01.01',
    salaryClass: 'Loại A3, nhóm A3.1',
    salaryRange: '6,20 – 8,00',
    note: 'Bổ nhiệm từ GV cao cấp (hạng I) V.07.01.01; GS/PGS thực hiện theo khoản 3 Điều 14 & NĐ 93/2026/NĐ-CP'
  },
  {
    level: 'Khoản 9 Điều 2 & Điều 14 — Giảng viên đại học',
    title: 'Giảng viên chính',
    code: 'V.07.01.02',
    salaryClass: 'Loại A2, nhóm A2.1',
    salaryRange: '4,40 – 6,78',
    note: 'Bổ nhiệm từ GV chính (hạng II) V.07.01.02'
  },
  {
    level: 'Khoản 9 Điều 2 & Điều 14 — Giảng viên đại học',
    title: 'Giảng viên',
    code: 'V.07.01.03',
    salaryClass: 'Loại A1',
    salaryRange: '2,34 – 4,98',
    note: 'Bổ nhiệm từ GV (hạng III) V.07.01.03 hoặc từ Trợ giảng đủ chuẩn theo điểm a khoản 5 Điều 15'
  },
  {
    level: 'Khoản 5 Điều 15 — Chuyển tiếp Trợ giảng ĐH',
    title: 'Trợ giảng (diện chuyển tiếp điểm a, b khoản 5 Đ15)',
    code: 'V.07.01.23',
    salaryClass: 'Loại A1 (giữ nguyên)',
    salaryRange: '2,34 – 4,98',
    note: 'Trước 31/3/2026 đủ chuẩn GV (hạng III) thì xét sang V.07.01.03; tuyển dụng theo đề án phê duyệt trước 30/6/2026 (K1 Đ25 NĐ 93/2026) giữ nguyên đến khi có hướng dẫn mới'
  },
  {
    level: 'Khoản 8 Điều 2 & Điều 13 — Giảng viên cao đẳng',
    title: 'Giảng viên cao cấp / Giảng viên chính / Giảng viên (CĐ)',
    code: 'V.09.02.01 / 02 / 03',
    salaryClass: 'A3.1 / A2.1 / A1 (ĐH+) hoặc A0 (CĐ)',
    salaryRange: '6,20–8,00 / 4,40–6,78 / 2,34–4,98 (2,10–4,89)',
    note: 'Chuyển từ GV GDNN (V.09.02.01..04) hoặc GV CĐSP (V.07.08.20..22)'
  },
  {
    level: 'Khoản 7 Điều 2 & Điều 12 — Giáo viên trung cấp (TPC)',
    title: 'Giáo viên trung cấp hạng I / hạng II / hạng III',
    code: 'V.09.02.05 / 06 / 07',
    salaryClass: 'A3.2 / A2.1 / A1 (ĐH+) hoặc A0 (CĐ)',
    salaryRange: '5,75–7,55 / 4,40–6,78 / 2,34–4,98 (2,10–4,89)',
    note: 'Chuyển từ GV GDNN cao cấp V.09.02.05, chính V.09.02.06, lý thuyết V.09.02.07 (A1) & thực hành V.09.02.08 (A0)'
  },
  {
    level: 'Khoản 6 Điều 2 & Điều 11 — Giáo viên sơ cấp',
    title: 'Giáo viên sơ cấp hạng I / hạng II / hạng III',
    code: 'V.09.02.11 / 10 / 09',
    salaryClass: 'A2.2 / A1 / Loại B',
    salaryRange: '4,00–6,38 / 2,34–4,98 / 1,86–4,06',
    note: 'Hạng III (V.09.02.09) bổ nhiệm từ giáo viên GDNN (hạng IV) mã V.09.02.09'
  },
  {
    level: 'Khoản 4, 5 Điều 2 & Điều 9, 10 — THPT & Dự bị ĐH',
    title: 'GV THPT (V.07.05.13..15) · GV Dự bị ĐH (V.07.07.17..19)',
    code: 'V.07.05.* / V.07.07.*',
    salaryClass: 'Hạng I: A2.1 / Hạng II: A2.2 / Hạng III: A1',
    salaryRange: '4,40–6,78 / 4,00–6,38 / 2,34–4,98',
    note: 'Áp dụng tại Trường TH Kỹ thuật thực hành (TPC) và cơ sở dự bị đại học'
  },
  {
    level: 'Khoản 1, 2, 3 Điều 2 & Điều 6, 7, 8 — MN, Tiểu học, THCS',
    title: 'Mầm non (V.07.02.24..26) · Tiểu học (V.07.03.27..29) · THCS (V.07.04.30..32)',
    code: 'V.07.02.* / 03.* / 04.*',
    salaryClass: 'MN: A2.2/A1/A0 · TH & THCS: A2.1/A2.2/A1',
    salaryRange: 'MN: 2,10–6,38 · TH & THCS: 2,34–6,78',
    note: 'Chuyển tiếp trình độ chuẩn thực hiện theo khoản 1, 2, 3 Điều 15 (Luật Nhà giáo 73/2025/QH15 & NĐ 71/2020/NĐ-CP)'
  }
] as const;

export const HD07_SIX_PRODUCT_GROUPS = [
  {
    roman: 'I',
    name: 'Nhóm I — Văn bản chỉ đạo, quản lý, quy chế, đề án, kế hoạch chiến lược',
    examples: 'Nghị quyết, Quy chế tổ chức hoạt động, Đề án vị trí việc làm, Kế hoạch năm học'
  },
  {
    roman: 'II',
    name: 'Nhóm II — Báo cáo chuyên đề, thẩm định, kiểm tra, đánh giá chất lượng',
    examples: 'Báo cáo tự đánh giá AUN-QA/ABET, Hồ sơ thẩm định nghiệp vụ, Báo cáo tổng kết'
  },
  {
    roman: 'III',
    name: 'Nhóm III — Hoạt động đào tạo, giảng dạy, hướng dẫn và học liệu số',
    examples: 'Lớp học phần đại học/sau đại học, Giáo trình, Học liệu số UTEx, Đồ án/Luận văn'
  },
  {
    roman: 'IV',
    name: 'Nhóm IV — Nghiên cứu khoa học, chuyển giao công nghệ và hợp tác quốc tế',
    examples: 'Đề tài NCKH các cấp, Bài báo WoS/Scopus, Hợp đồng chuyển giao công nghệ'
  },
  {
    roman: 'V',
    name: 'Nhóm V — Giải quyết thủ tục hành chính, phục vụ người học và viên chức',
    examples: 'Hồ sơ bổ nhiệm chức danh & xếp lương TT 31/2026, Hồ sơ học vụ, Văn bản E-Office'
  },
  {
    roman: 'VI',
    name: 'Nhóm VI — Vận hành kỹ thuật phòng thí nghiệm, hạ tầng số và hỗ trợ phục vụ',
    examples: 'Ca thực hành an toàn, Biên bản bảo trì thiết bị, Quản trị máy chủ & cổng thông tin'
  }
] as const;

export const HD07_EIGHT_STEPS_PROCESS = [
  { step: 1, title: 'Bước 1 — Rà soát chức năng, nhiệm vụ và dữ liệu đã kê khai', appendix: 'Phụ lục I, V', sheets: '1. A1_NhiemVu (đối chiếu 3. C1_VTVL)', webStage: 'Giai đoạn 1–2 (/tao-tep)', result: 'Danh mục nhiệm vụ đơn vị đã loại bỏ chồng chéo, phân loại trạng thái tiếp tục / mới tiếp nhận / chuyển giao.', condition: 'Chỉ tính nhiệm vụ có căn cứ pháp lý còn hiệu lực (Quyết định chức năng nhiệm vụ đơn vị).' },
  { step: 2, title: 'Bước 2 — Xác định công việc, công đoạn và sản phẩm đầu ra', appendix: 'Phụ lục I, II, V', sheets: '2. A2_CongViec · 11. DM_SAN_PHAM', webStage: 'Giai đoạn 1–2 (/tao-tep)', result: 'Danh mục công việc gắn Mã nhiệm vụ, Mã VTVL và sản phẩm đầu ra phân nhóm I–VI có đơn vị tính đếm được.', condition: 'Mỗi công việc phải gắn sản phẩm cụ thể; nếu áp dụng định mức chuẩn phải khai trước tại 11. DM_SAN_PHAM.' },
  { step: 3, title: 'Bước 3 — Xác định số lượng sản phẩm và thời gian thực hiện', appendix: 'Phụ lục III, IV, V', sheets: '4. B1_KhoiLuong (19 cột A–S)', webStage: 'Giai đoạn 3 (/bam-gio) & Giai đoạn 4', result: 'Tổng giờ làm việc thực tế năm cơ sở (01/10/2025–30/9/2026) tính từ Số SP/năm × Phút/SP + Giờ bổ sung.', condition: 'Bắt buộc ghi rõ Nguồn SL (Cột H), Nguồn thời gian (Cột I) và giải trình tại Cột S nếu lệch chuẩn > 30%.' },
  { step: 4, title: 'Bước 4 — Xác định thay đổi do chuyển đổi số, tự chủ, thuê dịch vụ', appendix: 'Phụ lục III, IV, V', sheets: '5. B2_CT_TacDong → 6. B2_ThayDoi', webStage: 'Giai đoạn 3–4 (Phiếu khảo sát B2_CT)', result: 'Giờ giảm hợp lệ / giờ việc mới phát sinh được tổng hợp tự động sang Biểu 6. B2_ThayDoi.', condition: 'Chỉ nhập tại 5. B2_CT_TacDong khi có bằng chứng vận hành thực tế (UTEx LMS, E-Office...) và đã đối chiếu trùng.' },
  { step: 5, title: 'Bước 5 — Đối chiếu danh mục VTVL, bản mô tả và khung năng lực', appendix: 'Phụ lục II, V', sheets: '3. C1_VTVL · 7. C2_NangLuc', webStage: 'Giai đoạn 1–2 (/tao-tep)', result: 'Danh mục VTVL cụ thể gắn Khung 38 VTVL Trường, Bậc nghề nghiệp (Bậc 1–5) và Quỹ giờ chuẩn PP2 (1.904h / 1.760h).', condition: 'Không tách thêm VTVL mới nếu chỉ khác công cụ phần mềm hoặc tăng giảm khối lượng tạm thời.' },
  { step: 6, title: 'Bước 6 — Xác định số người cần thiết theo từng vị trí việc làm', appendix: 'Phụ lục III, IV, V', sheets: '8. C3_NhuCau (14 cột A–N)', webStage: 'Giai đoạn 2 & Giai đoạn 4', result: 'Số người cần bố trí (FTE) năm cơ sở theo phương pháp PP1, PP2 (Giờ ròng / Quỹ giờ chuẩn) hoặc kết hợp.', condition: 'Cảnh báo Cột M tại 8. C3_NhuCau phải ĐẠT và Số dòng B1 chưa đạt (Cột N) phải bằng 0.' },
  { step: 7, title: 'Bước 7 — Đối chiếu nhân lực hiện có và lập phương án biên chế 2027–2031', appendix: 'Phụ lục III, IV, V', sheets: '9. D1_NhanLuc · DU_BAO_5_NAM · 10. D2_PhuongAn', webStage: 'Giai đoạn 4 (/tao-tep?step=4)', result: 'Danh sách nhân sự chốt ngày 30/9/2026 tại D1, dự báo 5 năm và phương án biên chế từng năm 2027–2031 tại D2.', condition: 'Mỗi nhân sự 1 dòng tại D1; mỗi thay đổi nhân lực (± người) tại DU_BAO_5_NAM phải có căn cứ và được xác nhận.' },
  { step: 8, title: 'Bước 8 — Kiểm tra chéo 10 biểu, xác nhận và gửi kết quả thẩm định', appendix: 'Phụ lục VI, VII, VIII', sheets: '13. K_KiemTra · 14. T_TienDo · 15. S_NhatKy', webStage: 'Giai đoạn 5 (/ra-soat)', result: 'Bộ biểu 10 biểu nghiệp vụ (A1–D2) đạt 6/6 chỉ tiêu tại 13. K_KiemTra kèm Tờ trình gửi Phòng TCNS.', condition: 'Chỉ gửi thẩm định khi 13. K_KiemTra không còn lỗi Phải sửa và đã ghi vết phiên bản tại 15. S_NhatKy.' }
] as const;

export const HD07_OFFICIAL_DOCS = [
  { code: 'HD-07', title: 'Hướng dẫn số 07-HD/BTCTW (Bản ký chính thức PDF)', href: '/tai-ve/hd-07-btctw-2026.pdf', badge: 'PDF gốc' },
  { code: 'PL-01', title: 'Phụ lục I — Danh mục VTVL và Bậc nghề nghiệp HCM-UTE (QL10–QL60, CM63–CM113, HT26–HT62)', href: '/tai-ve/pl1-danh-muc-vtvl-bac-nghe-nghiep-hcmute.docx', badge: 'PL1 Chuẩn' },
  { code: 'MAU-TCNS', title: 'Bộ biểu thực tế Phòng Tổ chức – Nhân sự (TCNS_HCMUTE_Bo_bieu_HD07.xlsx — 39 nhiệm vụ, 200 công việc)', href: '/tai-ve/tcns-hcmute-bo-bieu-hd07.xlsx', badge: 'Mẫu thực tế' },
  { code: 'TL-01', title: '01. Hướng dẫn quy trình 08 bước xác định VTVL & định biên', href: '/tai-ve/01-huong-dan-vtvl.docx', badge: 'DOCX' },
  { code: 'TL-02', title: '02. Bộ Phụ lục I–VIII quy trình & phương pháp tính VTVL', href: '/tai-ve/02-bo-phu-luc.docx', badge: 'DOCX' },
  { code: 'TL-04', title: '04. Hướng dẫn điền bộ biểu VTVL Excel (10 biểu A1–D2)', href: '/tai-ve/04-huong-dan-dien-bieu.docx', badge: 'DOCX' },
  { code: 'TL-05', title: '05. Cẩm nang nghiệp vụ xây dựng Vị trí việc làm', href: '/tai-ve/05-cam-nang-vtvl.docx', badge: 'DOCX' },
  { code: 'TL-06', title: 'Hướng dẫn chuẩn nhập dữ liệu Bộ biểu VTVL (12 bước Excel)', href: '/tai-ve/huong-dan-chuan-nhap-du-lieu-bo-bieu-vtvl.docx', badge: 'DOCX' }
] as const;

export const HD07_12_STEP_ORDER = [
  { step: 1, sheet: '3. C1_VTVL', title: 'Khai danh mục VTVL, mã chức danh TT 31/2026 & quỹ giờ chuẩn PP2 (1.904h / 1.760h)' },
  { step: 2, sheet: '1. A1_NhiemVu', title: 'Rà soát nhiệm vụ theo quy định chức năng, nhiệm vụ được giao' },
  { step: 3, sheet: '2. A2_CongViec', title: 'Phân rã nhiệm vụ thành công việc, sản phẩm, ĐVT và gắn Mã VTVL' },
  { step: 4, sheet: '11. DM_SAN_PHAM', title: 'Tra cứu / đăng ký sản phẩm chuẩn phân nhóm I–VI và định mức chuẩn' },
  { step: 5, sheet: '4. B1_KhoiLuong', title: 'Nhập sản lượng kỳ 01/10/2025–30/9/2026 và thời gian thực hiện' },
  { step: 6, sheet: '5. B2_CT_TacDong', title: 'Kê khai chi tiết tác động số hóa, cải tiến quy trình, tự chủ, thuê dịch vụ' },
  { step: 7, sheet: '6. B2_ThayDoi', title: 'Tự động tổng hợp giờ giảm hợp lệ / giờ việc mới sang bảng B2_ThayDoi' },
  { step: 8, sheet: '7. C2_NangLuc', title: 'Hoàn thiện bản mô tả vị trí việc làm và khung năng lực' },
  { step: 9, sheet: '9. D1_NhanLuc', title: 'Kê khai nguồn nhân lực hiện có chốt tại 30/9/2026 (rà soát chuyển tiếp Trợ giảng)' },
  { step: 10, sheet: '8. C3_NhuCau', title: 'Xác định nhu cầu nhân lực năm cơ sở theo PP1, PP2, PP3' },
  { step: 11, sheet: '10. DU_BAO_5_NAM', title: 'Dự báo thay đổi khối lượng công việc giai đoạn 2027–2031' },
  { step: 12, sheet: '11. D2_PhuongAn', title: 'Lập phương án biên chế từng năm giai đoạn 2027–2031 và kiểm tra K_KiemTra' }
] as const;

export const STANDARD_PRODUCTS_CATALOG: StandardProductItem[] = [
  {
    productCode: 'SP-I-01', productName: 'Đề án / Quy chế / Kế hoạch cấp Trường hoặc cấp Đơn vị',
    sector: 'Quản trị đại học & Tham mưu tổng hợp', romanGroup: 'I', standardMinutes: 1800,
    approvalDoc: 'Quy chế Tổ chức và Hoạt động HCM-UTE', status: 'Đã xác nhận',
    authority: 'Hội đồng trường / Hiệu trưởng HCM-UTE', effectiveDate: '2025-10-01',
    scopeNote: 'Áp dụng cho vị trí lãnh đạo, quản lý và chuyên viên chính'
  },
  {
    productCode: 'SP-II-01', productName: 'Báo cáo tự đánh giá kiểm định / Hồ sơ thẩm định chuyên đề',
    sector: 'Đảm bảo chất lượng & Thẩm định nghiệp vụ', romanGroup: 'II', standardMinutes: 960,
    approvalDoc: 'Quy định ĐBCL & Quy trình ISO nội bộ HCM-UTE', status: 'Đã xác nhận',
    authority: 'Hiệu trưởng HCM-UTE', effectiveDate: '2025-10-01',
    scopeNote: 'Áp dụng cho Khoa/Viện và Phòng chức năng'
  },
  {
    productCode: 'SP-III-01', productName: 'Học phần giảng dạy đại học / sau đại học & công bố khoa học',
    sector: 'Đào tạo & Nghiên cứu học thuật', romanGroup: 'III', standardMinutes: 2550,
    approvalDoc: 'Thông tư 31/2026/TT-BGDĐT, Thông tư 20/2020/TT-BGDĐT & Quy định HCM-UTE', status: 'Đã xác nhận',
    authority: 'Bộ GD&ĐT / HCM-UTE', effectiveDate: '2026-04-14',
    scopeNote: 'Áp dụng cho Giảng viên cao cấp (V.07.01.01), Giảng viên chính (V.07.01.02), Giảng viên (V.07.01.03)'
  },
  {
    productCode: 'SP-IV-01', productName: 'Khóa bồi dưỡng ngắn hạn / Dự án ươm tạo / Hợp đồng chuyển giao KHCN',
    sector: 'Khoa học công nghệ & Dịch vụ đào tạo', romanGroup: 'IV', standardMinutes: 1200,
    approvalDoc: 'Quy chế hoạt động KHCN và chuyển giao công nghệ HCM-UTE', status: 'Đã xác nhận',
    authority: 'Hiệu trưởng HCM-UTE', effectiveDate: '2025-10-01',
    scopeNote: 'Áp dụng cho các Viện nghiên cứu và Trung tâm'
  },
  {
    productCode: 'SP-V-01', productName: 'Hồ sơ nghiệp vụ giải quyết thủ tục / Học vụ / Nhân sự / Tài chính',
    sector: 'Hành chính – Quản trị – Phục vụ người học', romanGroup: 'V', standardMinutes: 90,
    approvalDoc: 'Quy trình giải quyết công việc trên hệ thống E-Office HCM-UTE', status: 'Đã xác nhận',
    authority: 'Hiệu trưởng HCM-UTE', effectiveDate: '2025-10-01',
    scopeNote: 'Áp dụng cho chuyên viên nghiệp vụ các Phòng/Khoa/Trung tâm'
  },
  {
    productCode: 'SP-V-02', productName: 'Văn bản đi/đến số hóa và hồ sơ lưu trữ điện tử',
    sector: 'Văn thư – Lưu trữ', romanGroup: 'V', standardMinutes: 20,
    approvalDoc: 'Nghị định 30/2020/NĐ-CP & Quy chế văn thư lưu trữ HCM-UTE', status: 'Đã xác nhận',
    authority: 'Chính phủ / HCM-UTE', effectiveDate: '2025-10-01',
    scopeNote: 'Áp dụng cho vị trí Văn thư viên, Giáo vụ khoa'
  },
  {
    productCode: 'SP-VI-01', productName: 'Ca thực hành phòng thí nghiệm / Xưởng & Biên bản bảo trì thiết bị',
    sector: 'Kỹ thuật thực hành & Hạ tầng số', romanGroup: 'VI', standardMinutes: 180,
    approvalDoc: 'Quy chế quản lý Phòng thí nghiệm và Xưởng thực hành HCM-UTE', status: 'Đã xác nhận',
    authority: 'Hiệu trưởng HCM-UTE', effectiveDate: '2025-10-01',
    scopeNote: 'Áp dụng cho Kỹ sư, Kỹ thuật viên thực hành và Quản trị hạ tầng'
  }
];

export const MISSIONS_BY_GROUP: Record<UnitGroupKind, MissionTemplate[]> = {
  'khoa-vien': [
    { missionSuffix: 'NV01', missionName: 'Quản lý, điều hành chiến lược phát triển học thuật và rà soát VTVL nhà giáo theo Điều 16 TT 31/2026/TT-BGDĐT', legalBasis: 'Luật Nhà giáo 73/2025/QH15, TT 31/2026/TT-BGDĐT & Quy chế HCM-UTE', status: 'Tiếp tục thực hiện', source: 'Quyết định chức năng nhiệm vụ Khoa/Viện thuộc HCM-UTE' },
    { missionSuffix: 'NV02', missionName: 'Tổ chức giảng dạy đại học, sau đại học, phát triển chương trình và nghiên cứu khoa học', legalBasis: 'Luật Giáo dục đại học, NĐ 93/2026/NĐ-CP & TT 31/2026/TT-BGDĐT', status: 'Tiếp tục thực hiện', source: 'Kế hoạch đào tạo và KHCN năm học 2025–2026' },
    { missionSuffix: 'NV03', missionName: 'Quản lý, vận hành hệ thống phòng thí nghiệm, xưởng thực hành và an toàn thiết bị', legalBasis: 'Quy chế quản lý phòng thí nghiệm & xưởng thực hành HCM-UTE', status: 'Tiếp tục thực hiện', source: 'Danh mục phòng thí nghiệm được giao quản lý' },
    { missionSuffix: 'NV04', missionName: 'Thực hiện công tác giáo vụ, hỗ trợ người học, văn thư lưu trữ và truyền thông học thuật', legalBasis: 'Quy định công tác giáo vụ và hành chính đơn vị HCM-UTE', status: 'Tiếp tục thực hiện', source: 'Quy trình E-Office và cổng thông tin đơn vị' }
  ],
  'phong-ban': [
    { missionSuffix: 'NV01', missionName: 'Tham mưu chiến lược, xây dựng quy chế, đề án VTVL và điều phối hoạt động quản trị toàn trường', legalBasis: 'Hướng dẫn 07-HD/BTCTW, TT 31/2026/TT-BGDĐT & Quy chế HCM-UTE', status: 'Tiếp tục thực hiện', source: 'Quyết định quy định chức năng, nhiệm vụ của Phòng/Ban' },
    { missionSuffix: 'NV02', missionName: 'Tổ chức thực hiện nghiệp vụ chuyên môn, bổ nhiệm chức danh và xếp lương nhà giáo, viên chức', legalBasis: 'Nghị định 93/2026/NĐ-CP, Thông tư 31/2026/TT-BGDĐT & NĐ 106/2020/NĐ-CP', status: 'Tiếp tục thực hiện', source: 'Hệ thống quy trình ISO và phần mềm nghiệp vụ HCM-UTE' },
    { missionSuffix: 'NV03', missionName: 'Công tác văn thư, số hóa hồ sơ lưu trữ và quản trị hành chính đơn vị', legalBasis: 'Nghị định 30/2020/NĐ-CP về công tác văn thư', status: 'Tiếp tục thực hiện', source: 'Hệ thống quản lý văn bản điều hành E-Office' }
  ],
  'trung-tam': [
    { missionSuffix: 'NV01', missionName: 'Quản lý, điều hành hoạt động dịch vụ đào tạo, nghiên cứu ứng dụng và tự chủ tài chính', legalBasis: 'Quy chế tổ chức và hoạt động các Trung tâm/Phân hiệu HCM-UTE', status: 'Tiếp tục thực hiện', source: 'Quyết định thành lập và giao quyền tự chủ đơn vị' },
    { missionSuffix: 'NV02', missionName: 'Triển khai khóa bồi dưỡng kỹ năng, ươm tạo khởi nghiệp và chuyển giao công nghệ', legalBasis: 'Thông tư 31/2026/TT-BGDĐT & Quy định hoạt động KHCN HCM-UTE', status: 'Tiếp tục thực hiện', source: 'Kế hoạch hoạt động chuyên môn kỳ 2025–2026' },
    { missionSuffix: 'NV03', missionName: 'Vận hành hạ tầng kỹ thuật, học liệu số và điều phối dịch vụ hỗ trợ người học', legalBasis: 'Quy chế quản trị hạ tầng số và học liệu HCM-UTE', status: 'Tiếp tục thực hiện', source: 'Hệ thống quản trị học liệu và dịch vụ người học' }
  ],
  'dang-doanthe': [
    { missionSuffix: 'NV01', missionName: 'Lãnh đạo, chỉ đạo xây dựng nghị quyết, chương trình công tác và giám sát thực hiện', legalBasis: 'Điều lệ Đảng, Luật Nhà giáo 73/2025/QH15 & Quy chế HCM-UTE', status: 'Tiếp tục thực hiện', source: 'Chương trình công tác năm của Đảng ủy / Hội đồng trường / Đoàn thể' },
    { missionSuffix: 'NV02', missionName: 'Tham mưu công tác tổ chức, văn phòng cấp ủy, bảo vệ chính trị nội bộ và phục vụ kỳ họp', legalBasis: 'Quy định công tác văn phòng cấp ủy và Hội đồng trường HCM-UTE', status: 'Tiếp tục thực hiện', source: 'Hệ thống hồ sơ nghiệp vụ Đảng – Đoàn thể' },
    { missionSuffix: 'NV03', missionName: 'Tổ chức phong trào thi đua, chăm lo đời sống viên chức và hoạt động rèn luyện sinh viên', legalBasis: 'Quy chế phối hợp giữa Nhà trường và các tổ chức đoàn thể HCM-UTE', status: 'Tiếp tục thực hiện', source: 'Kế hoạch hoạt động năm học 2025–2026' }
  ]
};
