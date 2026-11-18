import { TechDocChapter, TechDocFlowNode } from './hcmute-techdoc-types';

const FLOW_OVERVIEW: TechDocFlowNode[] = [
  { id: 'f1', label: '1. Đăng nhập @hcmute.edu.vn', sublabel: 'Xác nhận đơn vị và kỳ báo cáo', tone: 'main', targetDocId: '1.1', systemHref: '/login' },
  { id: 'f2', label: '2. Vai trò 1: Kê khai phiếu', sublabel: 'Lập Biểu B1, B2_CT cá nhân', tone: 'main', targetDocId: '2.1', systemHref: '/phieu-cong-viec' },
  { id: 'f3', label: '3. Vai trò 2: Lãnh đạo duyệt', sublabel: 'Duyệt, gộp và rà soát 10 biểu', tone: 'decision', targetDocId: '3.1', systemHref: '/phieu-don-vi' },
  { id: 'f4', label: '4. Vai trò 3: TCNS thẩm định', sublabel: 'Tổng hợp trình Ban Giám hiệu', tone: 'done', targetDocId: '4.1', systemHref: '/admin/tham-dinh' }
];

const FLOW_MERMAID = `flowchart TD
  A["1. Đăng nhập @hcmute.edu.vn"] --> B["2. Cán bộ kê khai B1, B2_CT"]
  B --> C{"3. Lãnh đạo đơn vị xét duyệt"}
  C -- "Bổ sung" --> B
  C -- "Đạt" --> D["4. Tổng hợp A1–D2 gửi Phòng Tổ chức - Nhân sự"]`;

export const TECHDOC_CH1: TechDocChapter = {
  id: 'ch-1',
  order: 1,
  title: '1. Khởi động và tổng quan',
  articles: [
    {
      id: '1.1',
      chapterId: 'ch-1',
      chapterLabel: '1. Khởi động và tổng quan',
      title: '1.1 Đăng nhập và tổng quan hệ thống',
      description: 'Đăng nhập bằng tài khoản @hcmute.edu.vn, chọn kỳ thống kê 01/10/2025–30/9/2026 và làm quen cấu trúc 5 phân hệ.',
      intro: 'Hệ thống Vị trí việc làm 360 giúp viên chức, Lãnh đạo đơn vị và Phòng Tổ chức - Nhân sự thực hiện thống nhất đề án vị trí việc làm của Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE).',
      quickAction: {
        entryPath: '/login → /',
        prerequisite: 'Có tài khoản công vụ @hcmute.edu.vn thuộc danh sách 39 đơn vị HCM-UTE.',
        coreSteps: [
          'Đăng nhập bằng tài khoản Google công vụ @hcmute.edu.vn hoặc mật khẩu nội bộ.',
          'Kiểm tra đúng đơn vị công tác và kỳ thống kê 01/10/2025–30/9/2026.',
          'Chọn phân hệ phù hợp với vai trò trên thanh menu bên trái.'
        ],
        primaryHref: '/',
        primaryLabel: 'Mở trang chủ tổng quan',
        secondaryHref: '/phieu-cong-viec',
        secondaryLabel: 'Mở phiếu công việc cá nhân'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Đăng nhập và kiểm tra đơn vị công tác',
          purpose: 'Bảo đảm phiên làm việc gắn đúng email công vụ, đúng vai trò và đúng đơn vị trong 39 đơn vị HCM-UTE.',
          steps: [
            'Truy cập kekhaivtvl.hcmute.edu.vn và bấm Đăng nhập bằng Google (@hcmute.edu.vn).',
            'Kiểm tra tên đơn vị hiển thị tại thanh đầu trang hoặc mục Hồ sơ đơn vị.',
            'Liên hệ Phòng Tổ chức - Nhân sự nếu tài khoản hiển thị sai đơn vị hoặc vai trò.'
          ],
          result: 'Phiên đăng nhập hợp lệ được duy trì an toàn trong 7 ngày với đúng quyền hạn.',
          note: 'Không sử dụng email cá nhân ngoài tên miền @hcmute.edu.vn.',
          actionHref: '/login',
          actionLabel: 'Đi tới trang đăng nhập'
        },
        {
          number: 2,
          title: 'Tác vụ 2: Chọn kỳ thống kê và theo dõi tổng quan',
          purpose: 'Thống nhất mốc thời gian thu thập sản lượng công việc từ 01/10/2025 đến 30/9/2026.',
          steps: [
            'Tại trang Tổng quan, kiểm tra nhãn kỳ thống kê mặc định 01/10/2025–30/9/2026.',
            'Quan sát 4 chỉ số trọng yếu: đơn vị trực thuộc, vị trí việc làm, vị trí áp dụng và phiếu chờ duyệt.',
            'Mở tab Theo dõi đơn vị để xem chi tiết tiến độ 39 Khoa, Phòng, Viện, Trung tâm.'
          ],
          result: 'Quý Thầy/Cô nắm bắt tiến độ toàn Trường và điều hướng nhanh sang nghiệp vụ cần làm.',
          actionHref: '/',
          actionLabel: 'Xem trang tổng quan'
        }
      ],
      diagramCaption: 'Sơ đồ luồng khởi động và tham gia quy trình VTVL 360',
      mermaidCode: FLOW_MERMAID,
      flowNodes: FLOW_OVERVIEW,
      troubleshooting: [
        { situation: 'Tình huống 1: Đăng nhập Google báo không thuộc hệ thống', cause: 'Email được chọn là Gmail cá nhân hoặc chưa có trong danh mục cán bộ.', solution: 'Đăng xuất, chọn đúng email @hcmute.edu.vn hoặc báo Phòng Tổ chức - Nhân sự bổ sung.' },
        { situation: 'Tình huống 2: Hiển thị sai đơn vị sau sắp xếp cơ cấu', cause: 'Tài khoản còn lưu mã đơn vị cũ trước khi chuẩn hóa 39 đơn vị.', solution: 'Nhắn Tổ thư ký hoặc Phòng Tổ chức - Nhân sự cập nhật mã đơn vị chuẩn.' }
      ]
    },
    {
      id: '1.2',
      chapterId: 'ch-1',
      chapterLabel: '1. Khởi động và tổng quan',
      title: '1.2 Ba nhóm vai trò và phân quyền 360',
      description: 'Phân định rõ phạm vi dữ liệu và quyền thao tác của Cán bộ/giảng viên, Lãnh đạo đơn vị và Phòng Tổ chức - Nhân sự.',
      intro: 'Hệ thống áp dụng kiểm soát truy cập theo vai trò (RBAC) trên cả giao diện và PostgreSQL nhằm bảo vệ bản nháp cá nhân và tính toàn vẹn số liệu đơn vị.',
      quickAction: {
        entryPath: 'Menu nghiệp vụ (5 nhóm)',
        prerequisite: 'Tài khoản được cấp một trong các vai trò staff, unit_leader hoặc admin.',
        coreSteps: [
          'Vai trò 1 (Cán bộ, giảng viên): Kê khai, sửa và nộp phiếu công việc của bản thân.',
          'Vai trò 2 (Lãnh đạo đơn vị): Duyệt phiếu trong đơn vị, gộp B1/B2 và kiểm tra 10 biểu A1–D2.',
          'Vai trò 3 (Phòng Tổ chức - Nhân sự): Thẩm định 39 đơn vị, quản trị và tổng hợp trình Ban Giám hiệu.'
        ],
        primaryHref: '/phieu-cong-viec',
        primaryLabel: 'Mở nghiệp vụ cá nhân',
        secondaryHref: '/nghiep-vu-don-vi',
        secondaryLabel: 'Mở nghiệp vụ đơn vị'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Nhận diện phạm vi thao tác từng vai trò',
          purpose: 'Giúp Quý Thầy/Cô thực hiện đúng phần việc được phân công mà không nhầm phân hệ.',
          steps: [
            'Mở thanh menu trái, xác định nhóm Nghiệp vụ cá nhân, Nghiệp vụ đơn vị và Kiểm tra TCNS.',
            'Với bản nháp cá nhân, chỉ chủ sở hữu và quản trị viên được xem trước khi nộp.',
            'Với Bảng tính 10 biểu, cán bộ xem chỉ đọc; Lãnh đạo và Tổ thư ký mới được sửa và lưu.'
          ],
          result: 'Dữ liệu cá nhân và hồ sơ đơn vị tách bạch, rõ trách nhiệm phê duyệt.',
          actionHref: '/',
          actionLabel: 'Xem menu điều hướng'
        }
      ],
      diagramCaption: 'Phân cấp quyền hạn 3 nhóm vai trò VTVL 360',
      mermaidCode: FLOW_MERMAID,
      flowNodes: FLOW_OVERVIEW,
      troubleshooting: [
        { situation: 'Tình huống 1: Không thấy mục Thẩm định cấp trường', cause: 'Phân hệ này chỉ dành cho tài khoản Phòng Tổ chức - Nhân sự.', solution: 'Thao tác tại Nghiệp vụ cá nhân hoặc Nghiệp vụ đơn vị theo đúng quyền hiện tại.' },
        { situation: 'Tình huống 2: Bảng tính 10 biểu báo chỉ xem', cause: 'Tài khoản đang mang quyền cán bộ (staff).', solution: 'Nếu thuộc Tổ thư ký đơn vị, đề nghị Trưởng đơn vị hoặc Phòng TCNS nâng quyền unit_leader.' }
      ]
    },
    {
      id: '1.3',
      chapterId: 'ch-1',
      chapterLabel: '1. Khởi động và tổng quan',
      title: '1.3 Sơ đồ luồng tổng thể từ B1 đến A1–D2',
      description: 'Cơ chế liên kết dữ liệu một chiều từ phiếu công việc cá nhân (B1, B2_CT) sang bộ 10 biểu A1–D2 và K_KiemTra.',
      intro: 'Mọi số liệu định lượng trong hệ thống đều bắt nguồn từ phiếu công việc đã duyệt và liên thông tự động lên các bảng tổng hợp, hạn chế tối đa nhập tay trùng lặp.',
      quickAction: {
        entryPath: 'B2_CT / B1 → A2 → C1–C3 → D1–D2',
        prerequisite: 'Đơn vị đã có danh mục nhiệm vụ A1 và vị trí việc làm C1.',
        coreSteps: [
          'Viên chức kê khai công việc gắn mã A1 và mã VTVL tại C1.',
          'Lãnh đạo duyệt phiếu để cộng dồn giờ công vào A2, B1 và B2_CT.',
          'Hệ thống quy đổi biên chế trên C2/C3, đối chiếu D1/D2 và chấm điểm K_KiemTra.'
        ],
        primaryHref: '/bang-tinh?sheet=A1',
        primaryLabel: 'Mở bảng tính 10 biểu',
        secondaryHref: '/huong-dan?doc=5.1',
        secondaryLabel: 'Xem sơ đồ chi tiết'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Hiểu luồng liên thông từ phiếu sang bảng tính',
          purpose: 'Tránh sửa tay đè lên công thức tổng hợp gây sai lệch nguồn kiểm chứng.',
          steps: [
            'Chuẩn hóa danh mục gốc tại Biểu A1 (Nhiệm vụ) và Biểu C1 (VTVL cụ thể).',
            'Duyệt phiếu cá nhân (B2_CT) để hệ thống tự cộng giờ quy đổi vào Biểu A2 và B1.',
            'Rà soát cân đối quỹ giờ 1.904 giờ/năm trên D1, D2 và kiểm tra K_KiemTra đạt 6/6.'
          ],
          result: 'Số liệu 10 biểu đồng bộ tuyệt đối và truy xuất được ngược về từng phiếu gốc.',
          note: 'Thu hồi duyệt một phiếu sẽ tự động trừ phần giờ công tương ứng khỏi A2/B1.',
          actionHref: '/bang-tinh?sheet=A2',
          actionLabel: 'Mở Biểu A2_CongViec'
        }
      ],
      diagramCaption: 'Chuỗi liên kết dữ liệu khép kín từ phiếu B1/B2_CT sang 10 biểu A1–D2',
      mermaidCode: FLOW_MERMAID,
      flowNodes: FLOW_OVERVIEW,
      troubleshooting: [
        { situation: 'Tình huống 1: Đã duyệt phiếu nhưng A2/B1 chưa tăng giờ', cause: 'Chưa đồng bộ gộp phiếu hoặc đang xem bản cache cũ.', solution: 'Mở Quản lý phiếu đơn vị → tab Đã duyệt & gộp B1/B2 rồi bấm Gộp phiếu vào B1/B2.' },
        { situation: 'Tình huống 2: Lệch tổng giờ giữa Biểu B1 và Biểu D1', cause: 'Chưa phân bổ đủ tỷ trọng thời gian nhân sự trên D1.', solution: 'Kiểm tra lại từng dòng nhân sự ở D1_NhanLuc bảo đảm khớp quỹ giờ đơn vị.' }
      ]
    },
    {
      id: '1.4',
      chapterId: 'ch-1',
      chapterLabel: '1. Khởi động và tổng quan',
      title: '1.4 Hướng dẫn bắt đầu theo vai trò',
      description: 'Lối tắt giúp từng nhóm đối tượng mở đúng bài hướng dẫn trọng tâm ngay lần truy cập đầu tiên.',
      intro: 'Quý Thầy/Cô chọn đúng nhóm vai trò công tác hiện tại để thực hiện nhanh quy trình mà không mất thời gian tìm kiếm.',
      quickAction: {
        entryPath: 'Chọn đúng vai trò công tác',
        prerequisite: 'Xác định vai trò chính là Cán bộ kê khai, Lãnh đạo/Thư ký đơn vị hay Phòng TCNS.',
        coreSteps: [
          'Cán bộ, giảng viên: Đọc Chương 2 và mở ngay Phiếu công việc cá nhân.',
          'Lãnh đạo / Tổ thư ký: Đọc Chương 3 để duyệt phiếu và hoàn thiện 10 biểu.',
          'Phòng Tổ chức - Nhân sự: Đọc Chương 4 để theo dõi và thẩm định 39 đơn vị.'
        ],
        primaryHref: '/huong-dan?doc=2.1',
        primaryLabel: 'Xem hướng dẫn Vai trò 1',
        secondaryHref: '/huong-dan?doc=3.1',
        secondaryLabel: 'Xem hướng dẫn Vai trò 2'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Chọn lộ trình thao tác theo nhiệm vụ được giao',
          purpose: 'Đưa Quý Thầy/Cô tới đúng màn hình nghiệp vụ ngay lập tức.',
          steps: [
            'Mở bài 2.1 nếu Quý Thầy/Cô kê khai đầu việc cá nhân kỳ 2025–2026.',
            'Mở bài 3.1 nếu Quý Thầy/Cô duyệt phiếu và kiểm tra hồ sơ Khoa, Phòng.',
            'Mở bài 4.1 nếu Quý Thầy/Cô thẩm định hồ sơ 39 đơn vị cấp Trường.'
          ],
          result: 'Hoàn thành đúng quy trình từ bước đầu và hạn chế lỗi khi nộp hồ sơ.',
          actionHref: '/phieu-cong-viec',
          actionLabel: 'Bắt đầu thao tác ngay'
        }
      ],
      diagramCaption: 'Điều hướng nhanh tới quy trình 3 vai trò HCM-UTE',
      mermaidCode: FLOW_MERMAID,
      flowNodes: FLOW_OVERVIEW,
      troubleshooting: [
        { situation: 'Tình huống 1: Chưa rõ đơn vị đã mở danh mục VTVL chuẩn hay chưa', cause: 'Tổ thư ký đơn vị đang hoàn tất Biểu A1 và C1.', solution: 'Mở Tạo phiếu công việc để kiểm tra danh sách Mã VTVL hoặc hỏi Tổ thư ký đơn vị.' },
        { situation: 'Tình huống 2: Cần in tài liệu hướng dẫn để họp đơn vị', cause: 'Cần bản giấy đồng bộ cho buổi triển khai.', solution: 'Bấm Xuất PDF ngay trên thanh công cụ để tải/in bản A4 chuẩn HCM-UTE.' }
      ]
    }
  ]
};
