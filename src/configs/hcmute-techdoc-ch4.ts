import { TechDocChapter, TechDocFlowNode } from './hcmute-techdoc-types';

const FLOW_ADMIN: TechDocFlowNode[] = [
  { id: 'c4-1', label: '1. Theo dõi 39 đơn vị', sublabel: 'Giám sát KPI & nhật ký', tone: 'main', targetDocId: '4.1', systemHref: '/?tab=unit-monitor' },
  { id: 'c4-2', label: '2. Thẩm định 10 biểu', sublabel: 'Kiểm tra A1–D2 & K_KiemTra', tone: 'decision', targetDocId: '4.1', systemHref: '/admin/tham-dinh' },
  { id: 'c4-3', label: '3. Quản trị A1, C1 & User', sublabel: '908+ tài khoản & khóa C1', tone: 'main', targetDocId: '4.2', systemHref: '/admin' },
  { id: 'c4-4', label: '4. Báo cáo toàn Trường', sublabel: 'Trình Ban Giám hiệu duyệt', tone: 'done', targetDocId: '4.3', systemHref: '/' }
];

const MERMAID_ADMIN = `flowchart TD
  A["1. Giám sát tiến độ 39 đơn vị"] --> B["2. Thẩm định hồ sơ A1–D2"]
  B --> C{"3. Đạt chuẩn cấp trường?"}
  C -- "Chưa đạt" --> D["Yêu cầu bổ sung & mở lại hồ sơ"]
  C -- "Đạt chuẩn" --> E["4. Tổng hợp trình Ban Giám hiệu"]`;

export const TECHDOC_CH4: TechDocChapter = {
  id: 'ch-4',
  order: 4,
  title: '4. Vai trò 3: Phòng Tổ chức - Nhân sự và quản trị',
  articles: [
    {
      id: '4.1',
      chapterId: 'ch-4',
      chapterLabel: '4. Vai trò 3: Phòng Tổ chức - Nhân sự và quản trị',
      title: '4.1 Thẩm định hồ sơ 39 đơn vị',
      description: 'Giám sát tiến độ nộp phiếu và hồ sơ 39 đơn vị theo thời gian thực, thẩm định chi tiết 5 thẻ và phản hồi trực tuyến.',
      intro: 'Phòng Tổ chức - Nhân sự sử dụng màn hình Theo dõi đơn vị và Thẩm định cấp trường để kiểm soát chất lượng hồ sơ của toàn bộ 39 đơn vị thuộc HCM-UTE.',
      quickAction: {
        entryPath: '/?tab=unit-monitor → /admin/tham-dinh',
        prerequisite: 'Đăng nhập tài khoản quản trị thuộc Phòng Tổ chức - Nhân sự (admin).',
        coreSteps: [
          'Mở tab Theo dõi đơn vị để lọc trạng thái 39 đơn vị và theo dõi nhật ký hoạt động.',
          'Mở Thẩm định cấp trường (/admin/tham-dinh), chọn đơn vị Chờ thẩm định hoặc Đã gửi lại.',
          'Rà soát đủ 5 thẻ thẩm định, nhập nhận xét rồi chọn Yêu cầu bổ sung hoặc Xác nhận đạt.'
        ],
        primaryHref: '/admin/tham-dinh',
        primaryLabel: 'Mở thẩm định cấp trường',
        secondaryHref: '/?tab=unit-monitor',
        secondaryLabel: 'Theo dõi 39 đơn vị'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Giám sát tiến độ kê khai trên phạm vi 39 đơn vị',
          purpose: 'Nắm bắt kịp thời các đơn vị chưa kê khai, còn phiếu chờ duyệt hoặc chưa hoàn tất gộp B1/B2.',
          steps: [
            'Mở Tổng quan → Theo dõi đơn vị để xem 6 nhóm chỉ số KPI toàn trường.',
            'Tìm nhanh theo mã đơn vị, từ khóa có dấu hoặc không dấu tại bảng đơn vị và nhật ký lịch sử.',
            'Truy cập thẳng Bảng 10 biểu hoặc Phiếu đơn vị của từng đơn vị khi cần đối chiếu nguồn.'
          ],
          result: 'Phòng Tổ chức - Nhân sự đôn đốc chính xác tiến độ của từng Khoa, Phòng, Viện, Trung tâm.',
          actionHref: '/?tab=unit-monitor',
          actionLabel: 'Mở theo dõi đơn vị'
        },
        {
          number: 2,
          title: 'Tác vụ 2: Thẩm định chi tiết 5 thẻ và xác nhận đạt',
          purpose: 'Bảo đảm hồ sơ 10 biểu có đầy đủ căn cứ pháp lý và cân đối định mức trước khi tổng hợp toàn Trường.',
          steps: [
            'Vào Thẩm định cấp trường, nhấp Thẩm định hồ sơ tại đơn vị cần kiểm tra.',
            'Xem đủ 5 thẻ: Tổng quan, Kiểm tra K_KiemTra, Bảng 10 biểu, Phiếu đơn vị và Lịch sử.',
            'Chọn Bắt đầu thẩm định, nhập nhận xét chi tiết rồi chọn Yêu cầu bổ sung hoặc Xác nhận đạt.'
          ],
          result: 'Kết quả thẩm định đồng bộ ngay về Hồ sơ đơn vị kèm dấu thời gian trên PostgreSQL.',
          actionHref: '/admin/tham-dinh',
          actionLabel: 'Thực hiện thẩm định'
        }
      ],
      diagramCaption: 'Luồng theo dõi và thẩm định hồ sơ 39 đơn vị',
      mermaidCode: MERMAID_ADMIN,
      flowNodes: FLOW_ADMIN,
      troubleshooting: [
        { situation: 'Tình huống 1: Đơn vị báo đã làm xong nhưng chưa thấy trong Chờ thẩm định', cause: 'Lãnh đạo đơn vị mới chạy kiểm tra K_KiemTra mà chưa bấm Gửi hồ sơ lên Phòng TCNS.', solution: 'Hướng dẫn đơn vị vào tab Tổng quan đơn vị và bấm Gửi hồ sơ lên Phòng TCNS.' },
        { situation: 'Tình huống 2: Cần chỉnh sửa lại hồ sơ đã bấm Xác nhận đạt', cause: 'Phát sinh điều chỉnh cơ cấu hoặc nhân sự mới.', solution: 'Mở chi tiết đơn vị tại /admin/tham-dinh và chọn Mở lại hồ sơ kèm ghi chú lý do.' }
      ]
    },
    {
      id: '4.2',
      chapterId: 'ch-4',
      chapterLabel: '4. Vai trò 3: Phòng Tổ chức - Nhân sự và quản trị',
      title: '4.2 Quản trị danh mục nhiệm vụ A1, vị trí C1 và định mức',
      description: 'Quản lý khóa/mở Biểu C1, phân quyền 908+ tài khoản, phân công VTVL và đồng bộ đổi mã đơn vị an toàn trên PostgreSQL.',
      intro: 'Phân hệ Quản trị hệ thống cho phép Phòng Tổ chức - Nhân sự kiểm soát thống nhất cấu trúc danh mục, phân quyền người dùng và lịch sử thay đổi toàn Trường.',
      quickAction: {
        entryPath: '/admin',
        prerequisite: 'Tài khoản có quyền Quản trị viên hệ thống (admin).',
        coreSteps: [
          'Mở Quản trị hệ thống → tab Tài khoản & phân quyền để cập nhật vai trò, đơn vị và VTVL.',
          'Điều khiển trạng thái khóa/mở chỉnh sửa Biểu C1 theo từng đợt rà soát.',
          'Quản lý đổi mã đơn vị và giám sát tab Nhật ký hệ thống.'
        ],
        primaryHref: '/admin',
        primaryLabel: 'Mở quản trị hệ thống',
        secondaryHref: '/admin?tab=system-logs',
        secondaryLabel: 'Xem nhật ký hệ thống'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Quản trị tài khoản và phân công vị trí việc làm',
          purpose: 'Đảm bảo đúng người đúng đơn vị để cán bộ nhận đầy đủ đề xuất phối hợp công việc.',
          steps: [
            'Chọn tab Tài khoản & phân quyền tại trang Quản trị hệ thống.',
            'Tìm theo email @hcmute.edu.vn để gán vai trò (staff, unit_leader, admin) và mã VTVL.',
            'Đối chiếu danh sách tài khoản từng đơn vị với Biểu D1_NhanLuc để không bỏ sót viên chức.'
          ],
          result: 'Dữ liệu 908+ tài khoản vận hành đồng bộ giữa Google OAuth và PostgreSQL.',
          actionHref: '/admin?tab=accounts',
          actionLabel: 'Mở quản lý tài khoản'
        },
        {
          number: 2,
          title: 'Tác vụ 2: Kiểm soát khóa Biểu C1 và đổi mã đơn vị nguyên tử',
          purpose: 'Bảo vệ danh mục VTVL chuẩn và tự động đồng bộ mã đơn vị sang toàn bộ bảng liên quan.',
          steps: [
            'Bật hoặc tắt khóa chỉnh sửa Biểu C1 toàn trường theo thông báo tiến độ của Phòng TCNS.',
            'Khi có quyết định đổi tên/mã đơn vị, thực hiện tại tab Đơn vị để tự cập nhật sang phiếu và bảng tính.',
            'Theo dõi tab Nhật ký hệ thống để kiểm tra mọi thao tác khôi phục phiên bản.'
          ],
          result: 'Không phát sinh mồ côi phiếu hay sai lệch quan hệ phối hợp khi thay đổi đơn vị.',
          actionHref: '/admin?tab=units',
          actionLabel: 'Mở quản lý đơn vị'
        }
      ],
      diagramCaption: 'Chu trình quản trị danh mục, tài khoản và khóa C1 toàn trường',
      mermaidCode: MERMAID_ADMIN,
      flowNodes: FLOW_ADMIN,
      troubleshooting: [
        { situation: 'Tình huống 1: Đổi mã đơn vị báo lỗi 409 Trùng mã', cause: 'Mã mới muốn đổi đã tồn tại trong danh sách 39 đơn vị hoạt động.', solution: 'Kiểm tra danh sách hiện hành tại tab Đơn vị và chọn mã chưa sử dụng.' },
        { situation: 'Tình huống 2: Nhân sự mới chưa đăng nhập được bằng email trường', cause: 'Tài khoản chưa được thêm vào bảng user_accounts.', solution: 'Thêm mới tài khoản với email @hcmute.edu.vn và đúng mã đơn vị tại Quản trị hệ thống.' }
      ]
    },
    {
      id: '4.3',
      chapterId: 'ch-4',
      chapterLabel: '4. Vai trò 3: Phòng Tổ chức - Nhân sự và quản trị',
      title: '4.3 Tổng hợp báo cáo toàn Trường trình Ban Giám hiệu',
      description: 'Tổng hợp số liệu Đề án VTVL toàn Trường, đối chiếu 4 nhóm VTVL và xuất hồ sơ trình Hiệu trưởng (President) phê duyệt.',
      intro: 'Sau khi 39 đơn vị hoàn tất thẩm định đạt chuẩn, Phòng Tổ chức - Nhân sự tổng hợp số liệu cấp Trường phục vụ Ban Giám hiệu phê duyệt Đề án Vị trí việc làm giai đoạn 2026–2030.',
      quickAction: {
        entryPath: '/ & /admin/tham-dinh',
        prerequisite: 'Các đơn vị trực thuộc đã hoàn tất bước thẩm định đạt.',
        coreSteps: [
          'Kiểm tra tỷ lệ 39/39 đơn vị đạt trạng thái Đã thẩm định đạt tại Thẩm định cấp trường.',
          'Đối chiếu tổng hợp 4 nhóm VTVL, biên chế hiện có (D1) và dự báo 5 năm (D2).',
          'Xuất bộ biểu tổng hợp chuẩn Nghị định 232/2026/NĐ-CP trình Hiệu trưởng (President).'
        ],
        primaryHref: '/',
        primaryLabel: 'Xem dashboard toàn trường',
        secondaryHref: '/admin/tham-dinh',
        secondaryLabel: 'Kiểm tra 39 đơn vị'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Đối soát tổng hợp chỉ tiêu VTVL toàn Trường',
          purpose: 'Bảo đảm tổng chỉ tiêu quy đổi từ các đơn vị phù hợp định hướng tinh gọn bộ máy HCM-UTE.',
          steps: [
            'Mở Trang chủ tổng quan xem phân bổ 4 khối đơn vị và 4 chỉ số trọng yếu.',
            'Đối chiếu từng đơn vị đã thẩm định đạt tại Thẩm định cấp trường.',
            'Xuất các gói tệp Excel và báo cáo PDF A4 phục vụ họp Hội đồng thẩm định Trường.'
          ],
          result: 'Hồ sơ đề án cấp Trường hoàn chỉnh, có căn cứ định lượng truy xuất ngược tới từng đầu việc.',
          actionHref: '/',
          actionLabel: 'Xem tổng hợp toàn trường'
        }
      ],
      diagramCaption: 'Quy trình tổng hợp hồ sơ Đề án cấp Trường trình Hiệu trưởng',
      mermaidCode: MERMAID_ADMIN,
      flowNodes: FLOW_ADMIN,
      troubleshooting: [
        { situation: 'Tình huống 1: Số liệu Dashboard chưa phản ánh đơn vị vừa duyệt', cause: 'Trình duyệt giữ dữ liệu phiên cũ.', solution: 'Bấm Làm mới dữ liệu để tải số liệu mới nhất từ PostgreSQL.' },
        { situation: 'Tình huống 2: Thiếu số liệu dự báo 5 năm của một đơn vị', cause: 'Đơn vị còn trống cột dự báo giai đoạn 2026–2030 trên Biểu D2.', solution: 'Chuyển trạng thái Yêu cầu bổ sung tại /admin/tham-dinh để đơn vị hoàn thiện Biểu D2.' }
      ]
    }
  ]
};
