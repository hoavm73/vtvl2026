export type TechDocRoleId = 'staff' | 'unit_leader' | 'admin';

export interface TechDocFlowNode {
  id: string;
  label: string;
  sublabel: string;
  tone: 'main' | 'decision' | 'done';
  href: string;
}

export interface TechDocTaskItem {
  number: number;
  title: string;
  purpose: string;
  steps: string[];
  result: string;
  note?: string;
  actionHref: string;
  actionLabel: string;
}

export interface TechDocTroubleItem {
  situation: string;
  cause: string;
  solution: string;
}

export interface TechDocRoleGuide {
  id: TechDocRoleId;
  order: number;
  title: string;
  shortTitle: string;
  badge: string;
  description: string;
  quickAction: {
    entryPath: string;
    primaryHref: string;
    primaryLabel: string;
    secondaryHref: string;
    secondaryLabel: string;
    prerequisite: string;
    coreSteps: string[];
  };
  flowNodes: TechDocFlowNode[];
  tasks: TechDocTaskItem[];
  troubleshooting: TechDocTroubleItem[];
}

export const TECHDOC_META = {
  title: 'Tài liệu hướng dẫn nghiệp vụ Vị trí việc làm 360',
  subtitle: 'Áp dụng cho 3 vai trò theo Hướng dẫn số 07-HD/BTCTW, Nghị định số 232/2026/NĐ-CP và Thông tư số 31/2026/TT-BGDĐT.',
  status: 'Đã ban hành',
  version: 'v2.0',
  updatedAt: '18/11/2026',
  issuer: 'Phòng Tổ chức - Nhân sự · Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)'
};

export const TECHDOC_ROLE_GUIDES: TechDocRoleGuide[] = [
  {
    id: 'staff',
    order: 1,
    title: 'Vai trò 1: Cán bộ, giảng viên và nhân viên',
    shortTitle: 'Cán bộ & giảng viên',
    badge: 'Phiếu công việc · Biểu B1, B2_CT',
    description: 'Kê khai định mức thời gian, sản lượng công việc kỳ 01/10/2025–30/9/2026 và theo dõi phê duyệt trực tuyến.',
    quickAction: {
      entryPath: '/phieu-cong-viec',
      primaryHref: '/phieu-cong-viec',
      primaryLabel: 'Mở phiếu công việc cá nhân',
      secondaryHref: '/bang-tinh?sheet=B1',
      secondaryLabel: 'Xem bảng tính đơn vị',
      prerequisite: 'Đã đăng nhập bằng tài khoản @hcmute.edu.vn và được gán đúng đơn vị công tác.',
      coreSteps: [
        'Chọn nhiệm vụ (A1), vị trí việc làm chính (C1) và mô tả sản phẩm đầu ra.',
        'Nhập sản lượng thực tế trong năm (01/10/2025–30/9/2026), phút/SP và căn cứ kiểm chứng.',
        'Bấm Lưu và nộp để chuyển Lãnh đạo đơn vị xét duyệt; theo dõi phản hồi để bổ sung khi cần.'
      ]
    },
    flowNodes: [
      { id: 's1', label: '1. Kê khai phiếu công việc', sublabel: 'Chọn A1, C1 & sản lượng', tone: 'main', href: '/phieu-cong-viec' },
      { id: 's2', label: '2. Đối chiếu căn cứ & phút/SP', sublabel: 'Kiểm tra nguồn số liệu', tone: 'decision', href: '/phieu-cong-viec' },
      { id: 's3', label: '3. Lãnh đạo đơn vị duyệt', sublabel: 'Duyệt hoặc yêu cầu bổ sung', tone: 'decision', href: '/phieu-cong-viec?tab=my-tickets' },
      { id: 's4', label: '4. Tổng hợp vào Biểu A2/B1', sublabel: 'Lưu vào hồ sơ đơn vị', tone: 'done', href: '/bang-tinh?sheet=B1' }
    ],
    tasks: [
      {
        number: 1,
        title: 'Tác vụ 1: Kê khai và nộp phiếu công việc cá nhân',
        purpose: 'Ghi nhận đầy đủ đầu việc, sản phẩm đầu ra và quỹ thời gian thực hiện của từng viên chức trong kỳ thống kê.',
        steps: [
          'Mở mục Phiếu công việc cá nhân, chọn Mã nhiệm vụ (A1) và Mã VTVL chính (C1).',
          'Điền tên công việc cụ thể, sản phẩm đầu ra, tiêu chuẩn chất lượng, căn cứ pháp lý và nguồn số liệu kiểm chứng.',
          'Nhập sản lượng năm, phút/SP thực tế, công việc phối hợp (nếu có) rồi bấm Lưu nháp hoặc Lưu và nộp.'
        ],
        result: 'Hệ thống cấp mã công việc [ĐV].NVxx.CVxx, lưu phiên bản v1 và chuyển trạng thái Chờ duyệt.',
        note: 'Quý Thầy/Cô vẫn chỉnh sửa được phiếu đang Chờ duyệt trước khi Lãnh đạo đơn vị bấm Duyệt.',
        actionHref: '/phieu-cong-viec',
        actionLabel: 'Thực hiện kê khai'
      },
      {
        number: 2,
        title: 'Tác vụ 2: Giải trình và nộp lại khi có yêu cầu bổ sung',
        purpose: 'Hoàn thiện nội dung theo góp ý của Lãnh đạo đơn vị và lưu giữ minh bạch lịch sử từng lần chỉnh sửa.',
        steps: [
          'Kiểm tra thông báo lý do yêu cầu bổ sung ở đầu trang Phiếu công việc cá nhân.',
          'Cập nhật số liệu hoặc văn bản căn cứ còn thiếu và điền rõ nội dung giải trình thay đổi.',
          'Bấm Lưu và nộp lại để tạo phiên bản mới (v2, v3...) gửi lại Lãnh đạo đơn vị.'
        ],
        result: 'Phiếu chuyển sang trạng thái Đã nộp lại; các phiên bản cũ vẫn được bảo toàn để đối chiếu từng trường.',
        actionHref: '/phieu-cong-viec?tab=my-tickets',
        actionLabel: 'Xem phiếu của tôi'
      },
      {
        number: 3,
        title: 'Tác vụ 3: Tra cứu công việc phối hợp và xuất bản in A4',
        purpose: 'Đối soát các đầu việc có phối hợp liên đơn vị và lưu bản in hành chính phục vụ họp đơn vị.',
        steps: [
          'Mở tab Đề xuất phối hợp hoặc Quan hệ công việc để kiểm tra các đầu việc gắn với mã VTVL của Quý Thầy/Cô.',
          'Tại khung soạn thảo, chọn Xem trước bản in A4 để rà soát thể thức trước khi nộp.',
          'Bấm In / Xuất PDF A4 khi cần lưu hồ sơ giấy có chữ ký xác nhận.'
        ],
        result: 'Quý Thầy/Cô nắm rõ đầu việc phối hợp và có bản in A4 đúng chuẩn hành chính HCM-UTE.',
        actionHref: '/phieu-cong-viec?tab=coordination',
        actionLabel: 'Xem đề xuất phối hợp'
      }
    ],
    troubleshooting: [
      { situation: 'Tình huống 1: Hệ thống không cho nộp phiếu và báo thiếu trường bắt buộc', cause: 'Chưa nhập đủ Sản phẩm đầu ra, Nguồn số liệu kiểm chứng, Số sản phẩm hoặc Thời gian thực tế (phút/SP).', solution: 'Bổ sung đầy đủ các mục bắt buộc (*) và ghi rõ tên văn bản, báo cáo hoặc phần mềm xác thực số liệu.' },
      { situation: 'Tình huống 2: Chưa thấy mã VTVL phù hợp hoặc không sửa được phiếu đã duyệt', cause: 'Đơn vị chưa cập nhật đủ VTVL ở Biểu C1, hoặc phiếu đã được duyệt và gộp vào Biểu A2/B1.', solution: 'Liên hệ Tổ thư ký / Lãnh đạo đơn vị để bổ sung Biểu C1 hoặc thực hiện Thu hồi phê duyệt trước khi chỉnh sửa.' }
    ]
  },
  {
    id: 'unit_leader',
    order: 2,
    title: 'Vai trò 2: Lãnh đạo đơn vị và tổ thư ký',
    shortTitle: 'Lãnh đạo đơn vị',
    badge: 'Hồ sơ đơn vị · 10 biểu A1–D2',
    description: 'Chuẩn hóa danh mục nhiệm vụ và VTVL, xét duyệt phiếu công việc viên chức và kiểm tra chéo 10 biểu trước khi trình Phòng Tổ chức - Nhân sự.',
    quickAction: {
      entryPath: '/nghiep-vu-don-vi',
      primaryHref: '/nghiep-vu-don-vi',
      primaryLabel: 'Mở hồ sơ đơn vị',
      secondaryHref: '/phieu-don-vi',
      secondaryLabel: 'Duyệt & gộp phiếu đơn vị',
      prerequisite: 'Tài khoản có quyền Lãnh đạo đơn vị thuộc đúng đơn vị quản lý.',
      coreSteps: [
        'Rà soát Biểu A1 (Nhiệm vụ) và Biểu C1 (VTVL cụ thể, bậc nghề nghiệp 1–5) trên Bảng tính 10 biểu.',
        'Xét duyệt phiếu công việc viên chức tại Quản lý phiếu đơn vị để tự động tổng hợp vào A2/B1.',
        'Hoàn thiện D1, D2, kiểm tra Sơ đồ VTVL, Biểu đồ nhân lực và chạy K_KiemTra đạt 6/6 trước khi gửi.'
      ]
    },
    flowNodes: [
      { id: 'u1', label: '1. Chuẩn hóa A1 & C1', sublabel: 'Nhiệm vụ & VTVL đơn vị', tone: 'main', href: '/bang-tinh?sheet=C1' },
      { id: 'u2', label: '2. Duyệt & gộp phiếu', sublabel: 'Tổng hợp vào Biểu A2, B1', tone: 'decision', href: '/phieu-don-vi' },
      { id: 'u3', label: '3. Phân bổ D1, D2 & rà soát', sublabel: 'Đạt 6/6 chỉ tiêu K_KiemTra', tone: 'decision', href: '/nghiep-vu-don-vi?tab=check' },
      { id: 'u4', label: '4. Gửi hồ sơ lên Phòng TCNS', sublabel: 'Khóa phiên bản trình thẩm định', tone: 'done', href: '/nghiep-vu-don-vi?tab=overview' }
    ],
    tasks: [
      {
        number: 1,
        title: 'Tác vụ 1: Rà soát danh mục nhiệm vụ (A1) và vị trí việc làm (C1)',
        purpose: 'Bảo đảm toàn bộ công việc của đơn vị bám sát quyết định chức năng, nhiệm vụ và Phụ lục II Hướng dẫn 1907.',
        steps: [
          'Mở Bảng tính 10 biểu tại tab Biểu A1 để cập nhật đầy đủ nhiệm vụ thường xuyên của đơn vị.',
          'Chuyển sang Biểu C1, rà soát Tên VTVL cụ thể, Bậc nghề nghiệp (1–5) và chức danh nhà giáo theo Thông tư 31/2026/TT-BGDĐT.',
          'Bấm Lưu biểu để đồng bộ danh mục cho toàn bộ viên chức trong đơn vị chọn khi kê khai.'
        ],
        result: 'Danh mục A1 và C1 đồng nhất làm chuẩn đầu vào cho phiếu công việc cá nhân và sơ đồ đơn vị.',
        note: 'Thay đổi tại Biểu C1 sẽ đồng bộ tức thì sang màn hình Phiếu công việc của viên chức cùng đơn vị.',
        actionHref: '/bang-tinh?sheet=C1',
        actionLabel: 'Mở Biểu C1'
      },
      {
        number: 2,
        title: 'Tác vụ 2: Duyệt phiếu công việc và gộp vào Biểu A2/B1',
        purpose: 'Kiểm soát tính xác thực về sản lượng, thời gian định mức trước khi đưa số liệu vào bảng tính chính thức.',
        steps: [
          'Mở Quản lý phiếu đơn vị, lọc nhóm Chờ duyệt & yêu cầu bổ sung để xem chi tiết từng phiếu.',
          'Nếu số liệu chưa rõ căn cứ, chọn Yêu cầu bổ sung kèm lý do cụ thể; nếu đạt chuẩn, bấm Duyệt phiếu.',
          'Kiểm tra tab Đã duyệt & gộp B1/B2 để đối chiếu giờ công quy đổi trên Biểu A2, B1 và C3.'
        ],
        result: 'Số liệu của nhiều viên chức cùng một mã công việc được cộng hợp chính xác, không ghi đè mất kê khai.',
        actionHref: '/phieu-don-vi',
        actionLabel: 'Mở quản lý phiếu đơn vị'
      },
      {
        number: 3,
        title: 'Tác vụ 3: Kiểm tra sơ đồ, cơ cấu nhân lực và gửi Phòng TCNS',
        purpose: 'Bảo đảm cân đối quỹ giờ chuẩn (1.904 giờ/năm) trên D1/D2 và hoàn tất hồ sơ đạt 6/6 chỉ tiêu kiểm tra chéo.',
        steps: [
          'Mở Sơ đồ VTVL dự kiến và Biểu đồ cơ cấu nhân lực dưới mục Nghiệp vụ đơn vị để kiểm tra phân cấp và tỷ trọng C1–D2.',
          'Cập nhật nhân sự hiện có tại ngày 30/9/2026 ở Biểu D1 và phương án biên chế 5 năm ở Biểu D2.',
          'Vào tab Kiểm tra trước khi gửi chạy K_KiemTra; khi lỗi phải sửa bằng 0, bấm Gửi hồ sơ lên Phòng TCNS.'
        ],
        result: 'Hồ sơ đơn vị chuyển sang trạng thái Chờ thẩm định kèm nhật ký phiên bản đầy đủ.',
        actionHref: '/nghiep-vu-don-vi?tab=check',
        actionLabel: 'Kiểm tra trước khi gửi'
      }
    ],
    troubleshooting: [
      { situation: 'Tình huống 1: Biểu K_KiemTra báo vượt quỹ giờ chuẩn hoặc trùng mã nhân lực tại D1', cause: 'Một viên chức được nhập nhiều dòng tại D1_NhanLuc hoặc tổng giờ phân bổ vượt quá 1.904 giờ/người/năm.', solution: 'Gộp về 1 dòng duy nhất cho mỗi viên chức tại D1 và điều chỉnh lại tỷ lệ thời gian kiêm nhiệm cho cân đối.' },
      { situation: 'Tình huống 2: Đã lỡ duyệt nhầm hoặc cần sửa lại bảng tính phiên bản trước', cause: 'Phiếu đã duyệt được khóa chỉnh sửa trực tiếp để bảo vệ dữ liệu B1/B2.', solution: 'Dùng chức năng Thu hồi phê duyệt tại Quản lý phiếu đơn vị hoặc khôi phục phiên bản ở tab Lịch sử & khôi phục.' }
    ]
  },
  {
    id: 'admin',
    order: 3,
    title: 'Vai trò 3: Phòng Tổ chức - Nhân sự và quản trị hệ thống',
    shortTitle: 'Phòng TCNS & quản trị',
    badge: 'Thẩm định 39 đơn vị · Quản trị',
    description: 'Giám sát tiến độ toàn trường, thẩm định hồ sơ 10 biểu của 39 đơn vị, quản lý tài khoản và bảo toàn tính nhất quán dữ liệu trình Hiệu trưởng.',
    quickAction: {
      entryPath: '/admin/tham-dinh',
      primaryHref: '/admin/tham-dinh',
      primaryLabel: 'Mở thẩm định cấp trường',
      secondaryHref: '/?tab=unit-monitor',
      secondaryLabel: 'Theo dõi tiến độ 39 đơn vị',
      prerequisite: 'Đăng nhập bằng tài khoản quản trị thuộc Phòng Tổ chức - Nhân sự.',
      coreSteps: [
        'Theo dõi tỷ lệ hoàn thành, số phiếu chờ duyệt và nhật ký thời gian thực của 39 đơn vị tại Theo dõi đơn vị.',
        'Tiếp nhận hồ sơ đơn vị gửi lên tại Thẩm định cấp trường, kiểm tra 10 biểu và K_KiemTra.',
        'Ghi nhận xét, Yêu cầu bổ sung hoặc Xác nhận đạt; quản trị tài khoản và phân công VTVL tại Quản trị hệ thống.'
      ]
    },
    flowNodes: [
      { id: 'a1', label: '1. Theo dõi 39 đơn vị', sublabel: 'Tiến độ phiếu & hồ sơ toàn trường', tone: 'main', href: '/?tab=unit-monitor' },
      { id: 'a2', label: '2. Thẩm định hồ sơ đơn vị', sublabel: 'Kiểm tra chéo 10 biểu A1–D2', tone: 'decision', href: '/admin/tham-dinh' },
      { id: 'a3', label: '3. Nhận xét / yêu cầu bổ sung', sublabel: 'Phản hồi kèm vết phiên bản', tone: 'decision', href: '/admin/tham-dinh' },
      { id: 'a4', label: '4. Xác nhận đạt cấp trường', sublabel: 'Tổng hợp trình Hiệu trưởng phê duyệt', tone: 'done', href: '/admin/tham-dinh' }
    ],
    tasks: [
      {
        number: 1,
        title: 'Tác vụ 1: Giám sát tiến độ kê khai toàn trường',
        purpose: 'Nắm bắt tức thời đơn vị nào chưa kê khai, đang chờ duyệt hay đã sẵn sàng thẩm định trên phạm vi 39 đơn vị.',
        steps: [
          'Mở tab Theo dõi đơn vị trên thanh điều hướng để xem 6 nhóm chỉ số KPI trạng thái phiếu.',
          'Nhấp chọn thẻ trạng thái hoặc tìm nhanh theo mã đơn vị để xem chi tiết phiếu khảo sát và nhật ký hoạt động.',
          'Kiểm tra hồ sơ đơn vị cụ thể qua lối tắt Bảng 10 biểu hoặc Phiếu đơn vị.'
        ],
        result: 'Phòng Tổ chức - Nhân sự chủ động đôn đốc đúng đơn vị còn tồn đọng hoặc chưa gộp B1/B2.',
        actionHref: '/?tab=unit-monitor',
        actionLabel: 'Mở theo dõi đơn vị'
      },
      {
        number: 2,
        title: 'Tác vụ 2: Thẩm định cấp trường đối với hồ sơ đơn vị gửi lên',
        purpose: 'Đánh giá chất lượng thuyết minh, định mức và phương án biên chế 5 năm trước khi tổng hợp trình Hiệu trưởng (President).',
        steps: [
          'Mở phân hệ Thẩm định cấp trường để lọc các đơn vị có trạng thái Chờ thẩm định hoặc Đã gửi lại.',
          'Nhấp Thẩm định hồ sơ để rà soát Tổng quan, Kiểm tra K_KiemTra, xem toàn bộ 10 biểu và Lịch sử thay đổi.',
          'Chọn Bắt đầu thẩm định, nhập nhận xét rồi chọn Yêu cầu bổ sung hoặc Xác nhận đạt.'
        ],
        result: 'Kết quả thẩm định được đồng bộ tức thì về Hồ sơ đơn vị và lưu vết đầy đủ trong nhật ký.',
        actionHref: '/admin/tham-dinh',
        actionLabel: 'Mở thẩm định cấp trường'
      },
      {
        number: 3,
        title: 'Tác vụ 3: Quản trị tài khoản, phân công VTVL và danh mục đơn vị',
        purpose: 'Đảm bảo đúng người đúng đơn vị, kiểm soát mở khóa chỉnh sửa C1 và quản lý thay đổi mã đơn vị an toàn.',
        steps: [
          'Vào Quản trị hệ thống, chọn tab Tài khoản & phân quyền để cấp quyền Lãnh đạo đơn vị / Cán bộ hoặc gán mã VTVL.',
          'Khi điều chỉnh cơ cấu tổ chức, thao tác trong tab Đơn vị để tự động đồng bộ mã đơn vị sang toàn bộ phiếu và bảng tính.',
          'Kiểm tra tab Nhật ký hệ thống để giám sát thao tác khôi phục phiên bản và bảo mật.'
        ],
        result: 'Dữ liệu phân quyền 908+ tài khoản và 39 đơn vị vận hành đồng bộ, an toàn trên PostgreSQL.',
        actionHref: '/admin',
        actionLabel: 'Mở quản trị hệ thống'
      }
    ],
    troubleshooting: [
      { situation: 'Tình huống 1: Đơn vị đề nghị chỉnh sửa lại sau khi hồ sơ đã được Xác nhận đạt', cause: 'Hồ sơ đã đạt yêu cầu được khóa trạng thái thẩm định để chuẩn bị tổng hợp chung.', solution: 'Chuyên viên Phòng TCNS mở hồ sơ tại /admin/tham-dinh và bấm Mở lại hồ sơ kèm ghi chú lý do.' },
      { situation: 'Tình huống 2: Viên chức đăng nhập nhưng chưa thấy phiếu hoặc sai đơn vị công tác', cause: 'Tài khoản chưa được đồng bộ đơn vị hoặc chưa gán mã VTVL phối hợp trong cơ sở dữ liệu.', solution: 'Mở Quản trị hệ thống → Tài khoản & phân quyền, tìm theo email @hcmute.edu.vn để cập nhật đúng đơn vị và lưu.' }
    ]
  }
];
