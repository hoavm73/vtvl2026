import { HcmuteVtvlGroup4, JobTaskTemplate, MissionTemplate } from '@/types/vtvl';

export interface Pl1VtvlItem {
  pl1Code: string;
  stt: number;
  groupRoman: 'I' | 'II' | 'III';
  vtvlGroup4: HcmuteVtvlGroup4;
  positionName: string;
  titleOrRole: string;
  careerLevel: string;
  allowedLevels: string[];
  tt31OrNgachCode: string;
}

const G1: HcmuteVtvlGroup4 = 'I. Nhóm VTVL Quản lý';
const G2: HcmuteVtvlGroup4 = 'II. Nhóm VTVL Chuyên môn, nghiệp vụ';
const G3: HcmuteVtvlGroup4 = 'III. Nhóm VTVL Hỗ trợ';
const G4: HcmuteVtvlGroup4 = 'IV. Nhóm VTVL Phục vụ';
const NO_LVL = ['Không áp dụng bậc'];

const p = (
  pl1Code: string, stt: number, groupRoman: 'I' | 'II' | 'III', vtvlGroup4: HcmuteVtvlGroup4,
  positionName: string, titleOrRole: string, careerLevel: string, allowedLevels: string[], tt31OrNgachCode: string
): Pl1VtvlItem => ({
  pl1Code, stt, groupRoman, vtvlGroup4, positionName, titleOrRole, careerLevel, allowedLevels, tt31OrNgachCode
});

/**
 * PHỤ LỤC I: DANH MỤC VỊ TRÍ VIỆC LÀM VÀ BẬC NGHỀ NGHIỆP ĐƯỢC SỬ DỤNG TẠI HCM-UTE
 * (Trích nguyên bản từ docs/1. PL1 - danh muc VTVL - bac nghe nghiep.docx)
 */
export const PL1_VTVL_CATALOG: Pl1VtvlItem[] = [
  // I. VỊ TRÍ VIỆC LÀM QUẢN LÝ (22 mã QL10 – QL60)
  p('QL10', 1, 'I', G1, 'Hiệu trưởng', 'Hiệu trưởng', 'Không áp dụng bậc', NO_LVL, 'V.07.01.01'),
  p('QL20', 2, 'I', G1, 'Phó Hiệu trưởng', 'Phó Hiệu trưởng', 'Không áp dụng bậc', NO_LVL, 'V.07.01.01'),
  p('QL31', 3, 'I', G1, 'Trưởng khoa', 'Trưởng khoa', 'Không áp dụng bậc', NO_LVL, 'V.07.01.02'),
  p('QL32', 4, 'I', G1, 'Viện trưởng', 'Viện trưởng', 'Không áp dụng bậc', NO_LVL, 'V.07.01.02'),
  p('QL33', 5, 'I', G1, 'Trưởng phòng', 'Trưởng phòng', 'Không áp dụng bậc', NO_LVL, '01.002'),
  p('QL34', 6, 'I', G1, 'Trưởng ban', 'Trưởng ban', 'Không áp dụng bậc', NO_LVL, '01.002'),
  p('QL35', 7, 'I', G1, 'Trưởng trạm Y tế', 'Trưởng trạm Y tế', 'Không áp dụng bậc', NO_LVL, 'V.08.01.03'),
  p('QL36', 8, 'I', G1, 'Giám đốc Trung tâm', 'Giám đốc Trung tâm', 'Không áp dụng bậc', NO_LVL, 'V.07.01.02'),
  p('QL37', 9, 'I', G1, 'Giám đốc Phân hiệu', 'Giám đốc Phân hiệu', 'Không áp dụng bậc', NO_LVL, 'V.07.01.02'),
  p('QL38', 10, 'I', G1, 'Chánh văn phòng Đảng ủy', 'Chánh văn phòng Đảng ủy', 'Không áp dụng bậc', NO_LVL, '01.002'),
  p('QL39', 11, 'I', G1, 'Tổng biên tập Tạp chí khoa học', 'Tổng biên tập Tạp chí khoa học', 'Không áp dụng bậc', NO_LVL, 'V.07.01.01'),
  p('QL41', 12, 'I', G1, 'Phó Trưởng khoa', 'Phó Trưởng khoa', 'Không áp dụng bậc', NO_LVL, 'V.07.01.02'),
  p('QL42', 13, 'I', G1, 'Phó Viện trưởng', 'Phó Viện trưởng', 'Không áp dụng bậc', NO_LVL, 'V.07.01.02'),
  p('QL43', 14, 'I', G1, 'Phó Trưởng phòng', 'Phó Trưởng phòng', 'Không áp dụng bậc', NO_LVL, '01.003'),
  p('QL44', 15, 'I', G1, 'Phó Trưởng ban', 'Phó Trưởng ban', 'Không áp dụng bậc', NO_LVL, '01.003'),
  p('QL45', 16, 'I', G1, 'Phó Trưởng trạm Y tế', 'Phó Trưởng trạm Y tế', 'Không áp dụng bậc', NO_LVL, 'V.08.01.03'),
  p('QL46', 17, 'I', G1, 'Phó Giám đốc Trung tâm', 'Phó Giám đốc Trung tâm', 'Không áp dụng bậc', NO_LVL, 'V.07.01.02'),
  p('QL47', 18, 'I', G1, 'Phó Giám đốc Phân hiệu', 'Phó Giám đốc Phân hiệu', 'Không áp dụng bậc', NO_LVL, 'V.07.01.02'),
  p('QL48', 19, 'I', G1, 'Phó Chánh văn phòng Đảng ủy', 'Phó Chánh văn phòng Đảng ủy', 'Không áp dụng bậc', NO_LVL, '01.003'),
  p('QL49', 20, 'I', G1, 'Phó Tổng biên tập Tạp chí khoa học', 'Phó Tổng biên tập Tạp chí khoa học', 'Không áp dụng bậc', NO_LVL, 'V.07.01.02'),
  p('QL50', 21, 'I', G1, 'Trưởng bộ môn', 'Trưởng bộ môn', 'Không áp dụng bậc', NO_LVL, 'V.07.01.02'),
  p('QL60', 22, 'I', G1, 'Phó trưởng bộ môn', 'Phó trưởng bộ môn', 'Không áp dụng bậc', NO_LVL, 'V.07.01.03'),

  // II. VỊ TRÍ VIỆC LÀM HOẠT ĐỘNG NGHỀ NGHIỆP (CM63 – CM113)
  p('CM76', 1, 'II', G2, 'Giảng viên đại học', 'Giảng viên / Giảng viên chính / Giảng viên cao cấp (GS, PGS)', 'Bậc 3, Bậc 4, Bậc 5', ['Bậc 3', 'Bậc 4', 'Bậc 5'], 'V.07.01.03'),
  p('CM79', 2, 'II', G2, 'Quản lý đào tạo', 'Quản lý chương trình đào tạo, tuyển sinh, học vụ', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '01.003'),
  p('CM80', 3, 'II', G2, 'Quản lý chất lượng giáo dục', 'Quản lý khảo thí, kiểm định và đảm bảo chất lượng', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '01.003'),
  p('CM63', 4, 'II', G2, 'Đổi mới sáng tạo', 'Tư vấn, hỗ trợ khởi nghiệp và đổi mới sáng tạo', 'Bậc 3', ['Bậc 3'], 'V.05.01.03'),
  p('CM64', 5, 'II', G2, 'Sở hữu trí tuệ', 'Quản lý tài sản trí tuệ và chuyển giao công nghệ', 'Bậc 3', ['Bậc 3'], 'V.05.01.03'),
  p('CM65', 6, 'II', G2, 'Quản lý khoa học, công nghệ', 'Quản lý đề tài, dự án nghiên cứu khoa học', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '01.003'),
  p('CM103', 7, 'II', G2, 'Thư viện viên', 'Thư viện viên quản trị học liệu và thông tin thư viện', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], 'V.10.02.06'),
  p('CM113', 8, 'II', G2, 'Biên tập viên', 'Biên tập viên tạp chí khoa học và xuất bản học thuật', 'Bậc 3', ['Bậc 3'], 'V.11.01.03'),

  // III. VỊ TRÍ VIỆC LÀM HỖ TRỢ, PHỤC VỤ (HT26 – HT62)
  p('HT26', 1, 'III', G3, 'Tư vấn học sinh, sinh viên', 'Tư vấn tâm lý, hướng nghiệp và hỗ trợ người học', 'Bậc 3', ['Bậc 3'], '01.003'),
  p('HT30', 2, 'III', G3, 'Trợ giảng', 'Trợ giảng', 'Bậc 3', ['Bậc 3'], 'V.07.01.23'),
  p('HT31', 3, 'III', G3, 'Nhân sự hỗ trợ giảng dạy', 'Nhân sự phụ trách phòng thí nghiệm / xưởng thực hành', 'Bậc 3', ['Bậc 2', 'Bậc 3'], 'V.05.02.07'),
  p('HT32', 4, 'III', G3, 'Quản lý đào tạo, bồi dưỡng', 'Hỗ trợ tổ chức các khóa đào tạo, bồi dưỡng ngắn hạn', 'Bậc 3', ['Bậc 3'], '01.003'),
  p('HT33', 5, 'III', G3, 'Quản lý học sinh, sinh viên', 'Quản lý công tác sinh viên, chế độ chính sách và nội trú', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '01.003'),
  p('HT34', 6, 'III', G3, 'Kết nối doanh nghiệp', 'Quan hệ doanh nghiệp, thực tập và việc làm sinh viên', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '01.003'),
  p('HT35', 7, 'III', G3, 'Hỗ trợ tổ chức hoạt động giáo dục', 'Giáo vụ khoa / hỗ trợ hoạt động giáo dục tại đơn vị', 'Bậc 3', ['Bậc 3'], '01.003'),
  p('HT37', 8, 'III', G3, 'Y tế trường học', 'Bác sĩ, Y sĩ, Điều dưỡng chăm sóc sức khỏe ban đầu', 'Bậc 2, Bậc 3', ['Bậc 2', 'Bậc 3', 'Bậc 2, Bậc 3'], 'V.08.05.12'),
  p('HT43', 9, 'III', G3, 'Hợp tác, hội nhập quốc tế', 'Quản lý hợp tác quốc tế, dự án và đoàn ra/đoàn vào', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '01.003'),
  p('HT44', 10, 'III', G3, 'Pháp chế', 'Tham mưu pháp chế, kiểm tra văn bản và thanh tra nội bộ', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '01.003'),
  p('HT45', 11, 'III', G3, 'Tổ chức cán bộ, thi đua khen thưởng', 'Tổ chức bộ máy, VTVL, nhân sự, chế độ chính sách, thi đua', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '01.003'),
  p('HT46', 12, 'III', G3, 'Ứng dụng công nghệ thông tin và chuyển đổi số', 'Quản trị mạng, hệ thống phần mềm, hạ tầng số', 'Bậc 2, Bậc 3, Bậc 4', ['Bậc 2', 'Bậc 3', 'Bậc 4', 'Bậc 2, Bậc 3, Bậc 4'], 'V.05.02.07'),
  p('HT47', 13, 'III', G3, 'Tiếp công dân, giải quyết khiếu nại, tố cáo', 'Tiếp công dân, xử lý đơn thư khiếu nại, tố cáo', 'Bậc 3', ['Bậc 3'], '01.003'),
  p('HT48', 14, 'III', G3, 'Phòng, chống tham nhũng, tiêu cực, lãng phí', 'Kê khai tài sản thu nhập và phòng chống tham nhũng', 'Bậc 3', ['Bậc 3'], '01.003'),
  p('HT49', 15, 'III', G3, 'Hành chính – Tổng hợp', 'Hành chính, tổng hợp, thư ký, lễ tân, đối ngoại nội vụ', 'Bậc 2, Bậc 3, Bậc 4', ['Bậc 2', 'Bậc 3', 'Bậc 4', 'Bậc 2, Bậc 3, Bậc 4'], '01.003'),
  p('HT50', 16, 'III', G3, 'Quản trị công sở', 'Quản trị cơ sở vật chất, giảng đường, ký túc xá, môi trường', 'Bậc 2, Bậc 3, Bậc 4', ['Bậc 2', 'Bậc 3', 'Bậc 4', 'Bậc 2, Bậc 3, Bậc 4'], '01.003'),
  p('HT51', 17, 'III', G3, 'Truyền thông', 'Quản trị thương hiệu, truyền thông số và sự kiện', 'Bậc 2, Bậc 3, Bậc 4', ['Bậc 2', 'Bậc 3', 'Bậc 4', 'Bậc 2, Bậc 3, Bậc 4'], '01.003'),
  p('HT52', 18, 'III', G3, 'Kế hoạch, đầu tư', 'Quản lý dự án đầu tư xây dựng, mua sắm và đấu thầu', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '01.003'),
  p('HT54', 19, 'III', G3, 'Tài chính', 'Quản lý kế hoạch tài chính, ngân sách và học phí', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '06.031'),
  p('HT55', 20, 'III', G3, 'Kế toán trưởng (Phụ trách kế toán)', 'Kế toán trưởng / Phụ trách kế toán', 'Không áp dụng bậc', NO_LVL, '06.030'),
  p('HT56', 21, 'III', G3, 'Kế toán', 'Kế toán viên tổng hợp và thanh quyết toán', 'Bậc 3, Bậc 4', ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], '06.031'),
  p('HT57', 22, 'III', G3, 'Thủ quỹ', 'Thủ quỹ quản lý tiền mặt và quỹ đơn vị', 'Bậc 3', ['Bậc 2', 'Bậc 3'], '01.005'),
  p('HT58', 23, 'III', G3, 'Văn thư', 'Văn thư quản lý công văn đi/đến và con dấu', 'Bậc 3', ['Bậc 2', 'Bậc 3'], '02.007'),
  p('HT59', 24, 'III', G3, 'Lưu trữ', 'Lưu trữ viên quản lý hồ sơ lưu trữ điện tử và kho lưu trữ', 'Bậc 3', ['Bậc 2', 'Bậc 3'], 'V.01.02.02'),
  p('HT61', 25, 'III', G4, 'Kỹ thuật', 'Nhân viên kỹ thuật vận hành điện, nước, thiết bị hạ tầng', 'Bậc 1, Bậc 2, Bậc 3', ['Bậc 1', 'Bậc 2', 'Bậc 3', 'Bậc 1, Bậc 2'], 'NV-KT'),
  p('HT62', 26, 'III', G2, 'Nghiên cứu viên', 'Nghiên cứu viên triển khai đề tài KHCN và ứng dụng', 'Bậc 3', ['Bậc 3'], 'V.05.01.03')
];

/**
 * DỮ LIỆU MẪU THỰC TẾ PHÒNG TỔ CHỨC – NHÂN SỰ (TCNS_HCMUTE_Bo_bieu_HD07.xlsx)
 * (39 nhiệm vụ A1, 200 công việc A2/B1, 6 vị trí việc làm C1/C2/C3)
 */
export const TCNS_C2_PROFILES: Record<string, { responsibility: string; general: string; professional: string; leadership: string; basis: string; source: string }> = {
  'TCNS.QL33': {
    responsibility: 'Chịu trách nhiệm toàn diện về kế hoạch, tổ chức thực hiện và kết quả hoạt động của Phòng. Chỉ đạo tham mưu tổ chức bộ máy, nhân sự, chế độ, thi đua. Phân công, kiểm tra, quản lý đội ngũ và giải trình theo thẩm quyền.',
    general: 'Công tâm, liêm chính và trách nhiệm giải trình. Giao tiếp, phối hợp và xử lý tình huống quản lý. Chủ động đổi mới quy trình. Sử dụng dữ liệu, công cụ số và ngoại ngữ theo yêu cầu.',
    professional: 'Đáp ứng năng lực của VTVL chuyên môn, nghiệp vụ hoặc hỗ trợ gắn với chức vụ (Bậc 4). Phân tích chính sách, tham mưu giải pháp TCNS, kiểm soát chất lượng nghiệp vụ và vận dụng quy định quản trị đại học.',
    leadership: 'Định hướng và điều hành toàn Phòng. Quyết định trong thẩm quyền, phân công và phát triển đội ngũ. Quản trị nguồn lực, kiểm soát rủi ro, thúc đẩy cải tiến và giải trình.',
    basis: 'Điều 8 và PL IV NĐ 232/2026/NĐ-CP. PL18 QĐ 2266. BMTCV&KNL QL33. Số VTVL áp dụng theo PP1.',
    source: 'QL33_BMTCV VTVL Truong Phong.docx (Hồ sơ thẩm định VTVL 2026)'
  },
  'TCNS.QL43': {
    responsibility: 'Giúp Trưởng phòng lập kế hoạch và trực tiếp điều hành mảng TCNS được phân công. Điều phối, hướng dẫn, kiểm tra hồ sơ và tiến độ, báo cáo hoặc trình xử lý việc vượt phạm vi.',
    general: 'Trách nhiệm, công tâm và bảo mật. Giao tiếp, phối hợp và phản hồi kịp thời. Phát hiện bất cập, đề xuất cải tiến. Sử dụng dữ liệu, công cụ số và ngoại ngữ theo nhiệm vụ.',
    professional: 'Đáp ứng năng lực của VTVL chuyên môn, nghiệp vụ hoặc hỗ trợ gắn với chức vụ (Bậc 3, Bậc 4). Phân tích và tham mưu trong mảng được giao, hướng dẫn thực hiện và rà soát chất lượng hồ sơ.',
    leadership: 'Cụ thể hóa kế hoạch của Phòng thành nhiệm vụ của mảng phụ trách. Điều phối, kiểm soát kết quả, hướng dẫn đội ngũ, xử lý rủi ro và giải trình trong phạm vi được giao.',
    basis: 'Điều 8 và PL IV NĐ 232/2026/NĐ-CP. PL18 QĐ 2266. BMTCV&KNL QL43. Số VTVL áp dụng theo PP1.',
    source: 'QL43_BMTCV VTVL Pho Truong Phong.docx (Hồ sơ thẩm định VTVL 2026)'
  },
  'TCNS.HT45': {
    responsibility: 'Tham mưu tổ chức bộ máy, Đề án VTVL và phát triển đội ngũ. Xử lý hồ sơ cán bộ, tuyển dụng, sử dụng, chế độ, đào tạo và dữ liệu đánh giá. Tham mưu thi đua, khen thưởng, sáng kiến, kỷ luật và phối hợp bảo vệ chính trị nội bộ.',
    general: 'Công tâm, liêm chính, bảo mật hồ sơ nhân sự. Giao tiếp và hướng dẫn nghiệp vụ đúng thẩm quyền. Chuẩn hóa quy trình. Sử dụng công cụ nhân sự số và ngoại ngữ theo nhiệm vụ.',
    professional: 'Cấp độ 3 (Bậc 3): Vận dụng quy định, tham mưu và xử lý hồ sơ tổ chức, cán bộ, chế độ và thi đua. Cấp độ 4 (Bậc 4): Phân tích nhu cầu nhân lực, xử lý việc phức tạp liên đơn vị, kiểm soát hồ sơ và cải tiến nghiệp vụ.',
    leadership: 'Không áp dụng',
    basis: 'Điều 8 và PL IV NĐ 232/2026/NĐ-CP. PL18 QĐ 2266, mục II.1 đến II.5 và II.6. BMTCV&KNL HT45 và A2 v1.2.',
    source: 'HT45_BMTCV VTVL To chuc can bo TDKT.docx (Hồ sơ thẩm định VTVL 2026)'
  },
  'TCNS.HT47': {
    responsibility: 'Tổ chức tiếp công dân, tiếp nhận và phân loại đơn, tham mưu chuyển hoặc xử lý đúng đầu mối. Phối hợp xác minh, tham mưu giải quyết khiếu nại, tố cáo, kiến nghị, phản ánh.',
    general: 'Khách quan, thận trọng, bảo mật thông tin công dân. Lắng nghe, hướng dẫn và phối hợp trong tình huống nhạy cảm. Cải tiến luồng xử lý đơn.',
    professional: 'Cấp độ 3 (Bậc 3): Xác định loại đơn, điều kiện thụ lý, thẩm quyền và thời hạn. Đối chiếu chứng cứ, phối hợp xác minh, đối thoại và tham mưu phương án xử lý.',
    leadership: 'Không áp dụng',
    basis: 'Điều 8 và PL IV NĐ 232/2026/NĐ-CP. PL18 QĐ 2266, mục II.6 (tiếp công dân và xử lý đơn). BMTCV&KNL HT47.',
    source: 'HT47_BMTCV VTVL Tiep cong dan KN TC.docx (Hồ sơ thẩm định VTVL 2026)'
  },
  'TCNS.HT48': {
    responsibility: 'Tham mưu kế hoạch, theo dõi biện pháp phòng ngừa và tổng hợp báo cáo phòng, chống tham nhũng theo phân công. Tổ chức nghiệp vụ kê khai, công khai tài sản, thu nhập và phối hợp xác minh.',
    general: 'Liêm chính, tiết kiệm, phòng ngừa xung đột lợi ích và bảo mật hồ sơ. Giao tiếp thận trọng, phối hợp đúng phạm vi. Cải tiến biện pháp phòng ngừa.',
    professional: 'Cấp độ 3 (Bậc 3): Rà soát công khai, minh bạch, xung đột lợi ích và dấu hiệu lãng phí. Xác định đối tượng, kỳ kê khai, kiểm tra và bàn giao hồ sơ.',
    leadership: 'Không áp dụng',
    basis: 'Điều 8 và PL IV NĐ 232/2026/NĐ-CP. PL18 QĐ 2266, mục II.6 (phòng, chống tham nhũng và kê khai tài sản). BMTCV&KNL HT48.',
    source: 'HT48_BMTCV VTVL Phong chong tham nhung TN LP.docx (Hồ sơ thẩm định VTVL 2026)'
  },
  'TCNS.HT49': {
    responsibility: 'Quản lý lịch, điều phối yêu cầu, chuẩn bị hồ sơ trình, làm thư ký và theo dõi chỉ đạo. Tổng hợp thông tin điều hành, quản lý tài liệu công vụ, hậu cần họp và bàn giao hồ sơ công tác phí.',
    general: 'Trách nhiệm, chính xác, bảo mật thông tin lãnh đạo. Giao tiếp, lễ tân và phối hợp kịp thời. Chuẩn hóa và số hóa quy trình.',
    professional: 'Cấp độ 2 (Bậc 2): Tiếp nhận yêu cầu, cập nhật lịch, chuẩn bị tài liệu. Cấp độ 3 (Bậc 3): Điều phối lịch, làm thư ký, theo dõi chỉ đạo. Cấp độ 4 (Bậc 4): Điều phối hoạt động phức tạp liên đơn vị.',
    leadership: 'Không áp dụng',
    basis: 'Điều 8 và PL IV NĐ 232/2026/NĐ-CP. PL18 QĐ 2266, mục I. BMTCV&KNL HT49 và A2 v1.2.',
    source: 'HT49_BMTCV VTVL Hanh chinh Tong hop.docx (Hồ sơ thẩm định VTVL 2026)'
  }
};

export const TCNS_REAL_MISSIONS: MissionTemplate[] = [
  { missionSuffix: 'NV01', missionName: 'Tham mưu xây dựng, rà soát, điều chỉnh cơ cấu tổ chức của Trường.', legalBasis: 'QĐ 2266, PL18, mục II.1, gạch 1', status: 'Tiếp tục thực hiện', source: 'PL18; danh mục đã thống nhất' },
  { missionSuffix: 'NV02', missionName: 'Tham mưu xây dựng, rà soát, điều chỉnh quy định chức năng, nhiệm vụ và quyền hạn của các đơn vị thuộc Trường.', legalBasis: 'QĐ 2266, PL18, mục II.1, gạch 1', status: 'Tiếp tục thực hiện', source: 'PL18; danh mục đã thống nhất' },
  { missionSuffix: 'NV03', missionName: 'Chủ trì tham mưu xây dựng, rà soát, điều chỉnh và tổ chức thực hiện Đề án vị trí việc làm, cơ cấu viên chức theo chức danh nghề nghiệp.', legalBasis: 'QĐ 2266, PL18, mục II.1, gạch 2', status: 'Tiếp tục thực hiện', source: 'PL18; danh mục đã thống nhất' },
  { missionSuffix: 'NV04', missionName: 'Tham mưu công tác quy hoạch, bổ nhiệm, bổ nhiệm lại, điều động, luân chuyển viên chức quản lý.', legalBasis: 'QĐ 2266, PL18, mục II.2', status: 'Tiếp tục thực hiện', source: 'PL18; danh mục đã thống nhất' },
  { missionSuffix: 'NV05', missionName: 'Tổ chức tuyển dụng, tiếp nhận, ký kết hợp đồng làm việc, bổ nhiệm chức danh nghề nghiệp và xếp lương theo TT 31/2026/TT-BGDĐT.', legalBasis: 'QĐ 2266, PL18, mục II.3 & TT 31/2026/TT-BGDĐT', status: 'Tiếp tục thực hiện', source: 'PL18; danh mục đã thống nhất' },
  { missionSuffix: 'NV06', missionName: 'Thực hiện chế độ, chính sách, nâng bậc lương, phụ cấp, BHXH, đào tạo bồi dưỡng và đánh giá xếp loại viên chức.', legalBasis: 'QĐ 2266, PL18, mục II.4 & II.5', status: 'Tiếp tục thực hiện', source: 'PL18; danh mục đã thống nhất' },
  { missionSuffix: 'NV07', missionName: 'Tham mưu công tác thi đua, khen thưởng, kỷ luật và phối hợp bảo vệ chính trị nội bộ.', legalBasis: 'QĐ 2266, PL18, mục II.5 & II.6', status: 'Tiếp tục thực hiện', source: 'PL18; danh mục đã thống nhất' },
  { missionSuffix: 'NV08', missionName: 'Tổ chức tiếp công dân, giải quyết khiếu nại, tố cáo, phòng chống tham nhũng, tiêu cực, kê khai tài sản thu nhập và hành chính tổng hợp.', legalBasis: 'QĐ 2266, PL18, mục I & II.6', status: 'Tiếp tục thực hiện', source: 'PL18; danh mục đã thống nhất' }
];

export const TCNS_REAL_TASKS: JobTaskTemplate[] = [
  { stt: 1, vtvlSuffix: 'HT45', vtvlName: 'Tổ chức cán bộ, thi đua khen thưởng', frameworkTitle: 'Tổ chức cán bộ, thi đua khen thưởng', vtvlGroup4: G3, defaultCareerLevel: 'Bậc 3, Bậc 4', allowedCareerLevels: ['Bậc 3', 'Bậc 4', 'Bậc 3, Bậc 4'], ngachCode: '01.003', method: 'PP2', missionSuffix: 'NV01', taskSuffix: 'NV01.CV01', taskName: 'Rà soát hiện trạng cơ cấu tổ chức, xây dựng Đề án VTVL, quy hoạch, bổ nhiệm, tuyển dụng, chế độ lương TT 31/2026 và thi đua khen thưởng.', productName: 'Báo cáo rà soát tổ chức, Đề án VTVL & Hồ sơ nhân sự', productCode: 'SP-V-01', romanGroup: 'V', unitName: 'Hồ sơ / Báo cáo', qualityRequirement: 'Có sơ đồ, danh mục đối chiếu văn bản tổ chức và hồ sơ nhân sự chuẩn xác', sourceHint: 'Sản lượng đề xuất theo QĐ 2266, PL18 mục II.1–II.6 (200 đầu việc)', defaultQtyPerYear: 265, defaultMinutesPerProduct: 960, extraRelatedHoursYear: 59.97, timeBasisStatus: 'Kiểm đếm, ước lượng thực tế', legalBasisHint: 'PL18 QĐ 2266, mục II.1 đến II.6 & NĐ 232/2026/NĐ-CP (HT45)', competencyLevel: 'Bậc 3, Bậc 4 (HT45 — Tổ chức cán bộ, thi đua khen thưởng)' },
  { stt: 2, vtvlSuffix: 'HT47', vtvlName: 'Tiếp công dân, giải quyết khiếu nại, tố cáo', frameworkTitle: 'Tiếp công dân, giải quyết khiếu nại, tố cáo', vtvlGroup4: G3, defaultCareerLevel: 'Bậc 3', allowedCareerLevels: ['Bậc 3'], ngachCode: '01.003', method: 'PP2', missionSuffix: 'NV08', taskSuffix: 'NV35.CV01', taskName: 'Tổ chức tiếp công dân, tiếp nhận, phân loại đơn thư và phối hợp xác minh, tham mưu giải quyết khiếu nại, tố cáo, kiến nghị, phản ánh.', productName: 'Hồ sơ tiếp công dân & Văn bản xử lý đơn thư', productCode: 'SP-V-01', romanGroup: 'V', unitName: 'Hồ sơ', qualityRequirement: 'Đúng thẩm quyền, trình tự và thời hạn luật định', sourceHint: 'Sản lượng đề xuất theo PL18 QĐ 2266, mục II.6', defaultQtyPerYear: 15, defaultMinutesPerProduct: 900, extraRelatedHoursYear: 10.77, timeBasisStatus: 'Kiểm đếm, ước lượng thực tế', legalBasisHint: 'PL18 QĐ 2266, mục II.6 & NĐ 232/2026/NĐ-CP (HT47)', competencyLevel: 'Bậc 3 (HT47 — Tiếp công dân, giải quyết khiếu nại, tố cáo)' },
  { stt: 3, vtvlSuffix: 'HT48', vtvlName: 'Phòng, chống tham nhũng, tiêu cực, lãng phí', frameworkTitle: 'Phòng, chống tham nhũng, tiêu cực, lãng phí', vtvlGroup4: G3, defaultCareerLevel: 'Bậc 3', allowedCareerLevels: ['Bậc 3'], ngachCode: '01.003', method: 'PP2', missionSuffix: 'NV08', taskSuffix: 'NV36.CV01', taskName: 'Tham mưu kế hoạch phòng, chống tham nhũng, tiêu cực; tổ chức kê khai, công khai bản kê khai tài sản, thu nhập hằng năm.', productName: 'Kế hoạch PCTN & Hồ sơ kê khai tài sản thu nhập', productCode: 'SP-V-01', romanGroup: 'V', unitName: 'Bộ hồ sơ', qualityRequirement: 'Đúng đối tượng, kỳ kê khai và quy định công khai minh bạch', sourceHint: 'Sản lượng đề xuất theo PL18 QĐ 2266, mục II.6', defaultQtyPerYear: 10, defaultMinutesPerProduct: 600, extraRelatedHoursYear: 3.83, timeBasisStatus: 'Kiểm đếm, ước lượng thực tế', legalBasisHint: 'PL18 QĐ 2266, mục II.6 & NĐ 232/2026/NĐ-CP (HT48)', competencyLevel: 'Bậc 3 (HT48 — Phòng, chống tham nhũng, tiêu cực, lãng phí)' },
  { stt: 4, vtvlSuffix: 'HT49', vtvlName: 'Hành chính – Tổng hợp', frameworkTitle: 'Hành chính – Tổng hợp', vtvlGroup4: G3, defaultCareerLevel: 'Bậc 2, Bậc 3, Bậc 4', allowedCareerLevels: ['Bậc 2', 'Bậc 3', 'Bậc 4', 'Bậc 2, Bậc 3, Bậc 4'], ngachCode: '01.003', method: 'PP2', missionSuffix: 'NV08', taskSuffix: 'NV38.CV01', taskName: 'Quản lý lịch, điều phối yêu cầu, chuẩn bị hồ sơ trình, làm thư ký, tổng hợp thông tin điều hành, quản lý tài liệu công vụ và hậu cần họp.', productName: 'Lịch công tác, Biên bản họp & Hồ sơ hành chính', productCode: 'SP-V-02', romanGroup: 'V', unitName: 'Hồ sơ / Văn bản', qualityRequirement: 'Chính xác, kịp thời, bảo mật thông tin điều hành', sourceHint: 'Sản lượng đề xuất theo PL18 QĐ 2266, mục I', defaultQtyPerYear: 420, defaultMinutesPerProduct: 90, extraRelatedHoursYear: 17.83, timeBasisStatus: 'Kiểm đếm, ước lượng thực tế', legalBasisHint: 'PL18 QĐ 2266, mục I & NĐ 232/2026/NĐ-CP (HT49)', competencyLevel: 'Bậc 2, Bậc 3, Bậc 4 (HT49 — Hành chính – Tổng hợp)' }
];

