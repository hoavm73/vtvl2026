import { TechDocChapter, TechDocFlowNode } from './hcmute-techdoc-types';

const FLOW_LEADER: TechDocFlowNode[] = [
  { id: 'c3-1', label: '1. Duyệt & gộp phiếu', sublabel: 'Tổng hợp A2, B1 tại đơn vị', tone: 'main', targetDocId: '3.1', systemHref: '/phieu-don-vi' },
  { id: 'c3-2', label: '2. Hoàn thiện 10 biểu', sublabel: 'Đối chiếu C1–D2 & sơ đồ', tone: 'main', targetDocId: '3.2', systemHref: '/bang-tinh?sheet=C1' },
  { id: 'c3-3', label: '3. Rà soát K_KiemTra', sublabel: 'Đạt 6/6 chỉ tiêu chuẩn', tone: 'decision', targetDocId: '3.3', systemHref: '/nghiep-vu-don-vi?tab=check' },
  { id: 'c3-4', label: '4. Gửi Phòng TCNS', sublabel: 'Khóa phiên bản thẩm định', tone: 'done', targetDocId: '4.1', systemHref: '/nghiep-vu-don-vi?tab=overview' }
];

const MERMAID_LEADER = `flowchart TD
  A["1. Duyệt phiếu công việc & gộp B1/B2"] --> B["2. Hoàn thiện 10 biểu A1–D2 & sơ đồ VTVL"]
  B --> C{"3. Kiểm tra K_KiemTra đạt 6/6?"}
  C -- "Chưa đạt" --> A
  C -- "Đạt" --> D["4. Gửi hồ sơ lên Phòng Tổ chức - Nhân sự"]`;

export const TECHDOC_CH3: TechDocChapter = {
  id: 'ch-3',
  order: 3,
  title: '3. Vai trò 2: Lãnh đạo đơn vị',
  articles: [
    {
      id: '3.1',
      chapterId: 'ch-3',
      chapterLabel: '3. Vai trò 2: Lãnh đạo đơn vị',
      title: '3.1 Xét duyệt phiếu công việc cấp đơn vị',
      description: 'Thẩm tra, duyệt, yêu cầu bổ sung, thu hồi phê duyệt và gộp phiếu cá nhân vào Biểu A2, B1 của đơn vị.',
      intro: 'Lãnh đạo đơn vị và Tổ thư ký kiểm soát tính chính xác của từng phiếu công việc trước khi số liệu được cộng hợp vào bộ bảng tính chính thức của đơn vị.',
      quickAction: {
        entryPath: '/phieu-don-vi',
        prerequisite: 'Đăng nhập tài khoản quyền Lãnh đạo đơn vị (unit_leader) hoặc Admin.',
        coreSteps: [
          'Mở Quản lý phiếu đơn vị → chọn tab Chờ duyệt & yêu cầu bổ sung.',
          'Xem chi tiết phiếu, so sánh thay đổi giữa các phiên bản và đối chiếu căn cứ kiểm chứng.',
          'Bấm Duyệt phiếu để tự động cộng vào A2/B1 hoặc Yêu cầu bổ sung kèm lý do cụ thể.'
        ],
        primaryHref: '/phieu-don-vi',
        primaryLabel: 'Mở quản lý phiếu đơn vị',
        secondaryHref: '/nghiep-vu-don-vi',
        secondaryLabel: 'Mở hồ sơ đơn vị'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Thẩm tra và phê duyệt phiếu đạt chuẩn',
          purpose: 'Kiểm soát sản lượng, định mức thời gian trước khi tổng hợp vào Biểu B1.',
          steps: [
            'Lọc nhóm Chờ duyệt & yêu cầu bổ sung trên màn hình Quản lý phiếu đơn vị.',
            'Mở từng phiếu, kiểm tra phần Thay đổi so với bản trước (nếu có) và nguồn số liệu.',
            'Chọn Duyệt phiếu khi đạt chuẩn hoặc Yêu cầu bổ sung để viên chức chỉnh sửa.'
          ],
          result: 'Số liệu giờ công tự động cộng dồn vào đúng mã công việc trên Biểu A2 và B1.',
          note: 'Nhiều viên chức cùng làm một mã công việc sẽ được cộng dồn an toàn, không ghi đè.',
          actionHref: '/phieu-don-vi?tab=pending',
          actionLabel: 'Xem phiếu chờ duyệt'
        },
        {
          number: 2,
          title: 'Tác vụ 2: Thu hồi phê duyệt hoặc đồng bộ gộp B1/B2',
          purpose: 'Xử lý kịp thời trường hợp duyệt nhầm hoặc cần điều chỉnh lại phiếu đã tổng hợp.',
          steps: [
            'Mở tab Đã duyệt & gộp B1/B2 để rà soát các phiếu đã chốt.',
            'Khi cần sửa, bấm Thu hồi duyệt trên chi tiết phiếu để tự động trừ phần giờ đã cộng khỏi A2/B1.',
            'Dùng nút Gộp phiếu vào B1/B2 để bảo đảm toàn bộ phiếu đã duyệt khớp 100% với bảng tính.'
          ],
          result: 'Trạng thái phiếu và dữ liệu bảng tính B1/B2 luôn đồng bộ nhất quán.',
          actionHref: '/phieu-don-vi?tab=approved',
          actionLabel: 'Xem phiếu đã duyệt'
        }
      ],
      diagramCaption: 'Luồng xét duyệt, thu hồi và gộp phiếu B1/B2 cấp đơn vị',
      mermaidCode: MERMAID_LEADER,
      flowNodes: FLOW_LEADER,
      troubleshooting: [
        { situation: 'Tình huống 1: Không bấm được nút duyệt phiếu của chính bản thân Lãnh đạo', cause: 'Hệ thống áp dụng nguyên tắc kiểm soát chéo, cấm tự phê duyệt.', solution: 'Cấp phó trong đơn vị hoặc Quản trị viên Phòng TCNS duyệt phiếu của Trưởng đơn vị.' },
        { situation: 'Tình huống 2: Bảng B1 chưa cập nhật sau khi thu hồi phiếu', cause: 'Trình duyệt đang giữ bản cache bảng tính trước thao tác thu hồi.', solution: 'Mở lại trang Bảng tính 10 biểu hoặc bấm Làm mới tại Quản lý phiếu đơn vị.' }
      ]
    },
    {
      id: '3.2',
      chapterId: 'ch-3',
      chapterLabel: '3. Vai trò 2: Lãnh đạo đơn vị',
      title: '3.2 Đối chiếu bảng tính tổng hợp và 10 biểu A1–D2',
      description: 'Hoàn thiện A1, C1, B1, B2, C2, C3, D1, D2, xem Sơ đồ VTVL dự kiến và Biểu đồ cơ cấu nhân lực.',
      intro: 'Bảng tính 10 biểu lưu trữ toàn bộ số liệu đề án của đơn vị và liên kết trực tiếp tới Sơ đồ VTVL dự kiến và Biểu đồ cơ cấu nhân lực dưới mục Nghiệp vụ đơn vị.',
      quickAction: {
        entryPath: '/bang-tinh & /nghiep-vu-don-vi',
        prerequisite: 'Các phiếu công việc chính của đơn vị đã được duyệt.',
        coreSteps: [
          'Mở Bảng tính 10 biểu để rà soát lần lượt Biểu A1, A2, B1, B2, C1–C3, D1, D2.',
          'Cập nhật danh sách nhân sự tại 30/9/2026 trên D1 (mỗi người 1 dòng) và dự báo 5 năm trên D2.',
          'Kiểm tra Sơ đồ VTVL dự kiến và Biểu đồ cơ cấu nhân lực để đối chiếu trực quan.'
        ],
        primaryHref: '/bang-tinh?sheet=A1',
        primaryLabel: 'Mở bảng tính 10 biểu',
        secondaryHref: '/nghiep-vu-don-vi?tab=org-tree',
        secondaryLabel: 'Xem sơ đồ VTVL dự kiến'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Rà soát C1 và phân bổ nhân lực D1, D2',
          purpose: 'Khớp nối giữa nhu cầu vị trí việc làm quy đổi (C2, C3) và nhân lực hiện có/dự kiến (D1, D2).',
          steps: [
            'Mở Biểu A1 và C1 để đối soát tên nhiệm vụ, tên VTVL cụ thể và bậc nghề nghiệp (1–5).',
            'Kiểm tra số người cần thiết ở C2, C3 và nhập nhân sự thực tế tại D1_NhanLuc.',
            'Điền kế hoạch biên chế giai đoạn 2026–2030 tại D2 rồi bấm Lưu & tiếp.'
          ],
          result: 'Đầy đủ 10 biểu hợp lệ và cân đối tổng quỹ giờ 1.904 giờ/người/năm.',
          actionHref: '/bang-tinh?sheet=D1',
          actionLabel: 'Mở Biểu D1_NhanLuc'
        },
        {
          number: 2,
          title: 'Tác vụ 2: Xem Sơ đồ VTVL dự kiến và Biểu đồ cơ cấu nhân lực',
          purpose: 'Phát hiện sớm VTVL chưa có người phụ trách hoặc mất cân đối tỷ trọng giữa 4 nhóm VTVL.',
          steps: [
            'Chọn Sơ đồ VTVL dự kiến tại nhóm Nghiệp vụ đơn vị để xem cây cơ cấu vị trí của đơn vị.',
            'Chọn tiếp Biểu đồ cơ cấu nhân lực để xem tỷ lệ biên chế hiện có so với nhu cầu đề xuất.',
            'Quay lại Bảng tính 10 biểu chỉnh sửa ngay nếu phát hiện chênh lệch chỉ tiêu.'
          ],
          result: 'Sơ đồ và biểu đồ khớp 100% số liệu bảng tính chuẩn bị cho báo cáo đề án.',
          actionHref: '/nghiep-vu-don-vi?tab=workforce-chart',
          actionLabel: 'Xem biểu đồ nhân lực'
        }
      ],
      diagramCaption: 'Luồng hoàn thiện 10 biểu và kiểm tra sơ đồ nhân lực đơn vị',
      mermaidCode: MERMAID_LEADER,
      flowNodes: FLOW_LEADER,
      troubleshooting: [
        { situation: 'Tình huống 1: Biểu C1 bị khóa không chỉnh sửa được', cause: 'Phòng TCNS đang khóa cấu trúc danh mục VTVL chuẩn toàn trường.', solution: 'Kiểm tra chỉ báo khóa trên thanh công cụ và liên hệ Phòng TCNS nếu cần mở khóa bổ sung.' },
        { situation: 'Tình huống 2: Sơ đồ VTVL chưa cập nhật vị trí mới thêm', cause: 'Quên bấm Lưu sau khi thêm dòng mới trên Biểu C1 hoặc D1.', solution: 'Quay lại Bảng tính bấm Lưu và mở lại tab Sơ đồ VTVL dự kiến.' }
      ]
    },
    {
      id: '3.3',
      chapterId: 'ch-3',
      chapterLabel: '3. Vai trò 2: Lãnh đạo đơn vị',
      title: '3.3 Yêu cầu bổ sung và khóa hồ sơ đơn vị',
      description: 'Chạy bộ kiểm tra 6 chỉ tiêu K_KiemTra, gửi hồ sơ lên Phòng Tổ chức - Nhân sự và khôi phục phiên bản khi cần.',
      intro: 'Trước khi gửi hồ sơ cấp đơn vị lên Phòng Tổ chức - Nhân sự, Lãnh đạo đơn vị phải kiểm tra chéo K_KiemTra bảo đảm không còn lỗi nghiêm trọng.',
      quickAction: {
        entryPath: '/nghiep-vu-don-vi?tab=check',
        prerequisite: 'Hoàn tất duyệt phiếu và lưu đầy đủ 10 biểu A1–D2.',
        coreSteps: [
          'Mở Hồ sơ đơn vị → tab Kiểm tra trước khi gửi để rà soát 6 chỉ tiêu K_KiemTra.',
          'Khắc phục hết cảnh báo Phải sửa và yêu cầu bổ sung các phiếu thiếu căn cứ.',
          'Bấm Gửi hồ sơ lên Phòng Tổ chức - Nhân sự để chuyển trạng thái Chờ thẩm định.'
        ],
        primaryHref: '/nghiep-vu-don-vi?tab=check',
        primaryLabel: 'Mở kiểm tra trước khi gửi',
        secondaryHref: '/nghiep-vu-don-vi?tab=history',
        secondaryLabel: 'Xem lịch sử & khôi phục'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Xử lý cảnh báo rà soát chéo 6 chỉ tiêu K_KiemTra',
          purpose: 'Loại bỏ hoàn toàn lỗi mã nhiệm vụ, vượt quỹ giờ 1.904 giờ/năm hoặc trùng nhân sự D1.',
          steps: [
            'Mở tab Kiểm tra trước khi gửi để xem danh sách lỗi phân loại theo 3 mức độ.',
            'Xử lý dứt điểm toàn bộ mục Phải sửa và bổ sung đầy đủ căn cứ văn bản ở mức Cần bổ sung.',
            'Quay lại tab Kiểm tra xác nhận đạt 6/6 chỉ tiêu xanh.'
          ],
          result: 'Hồ sơ đơn vị đạt chuẩn kỹ thuật, đủ điều kiện chuyển thẩm định.',
          actionHref: '/nghiep-vu-don-vi?tab=check',
          actionLabel: 'Chạy kiểm tra K_KiemTra'
        },
        {
          number: 2,
          title: 'Tác vụ 2: Gửi hồ sơ thẩm định và quản lý khôi phục phiên bản',
          purpose: 'Chốt mốc phiên bản nộp chính thức và an toàn trước mọi sai sót chỉnh sửa bảng tính.',
          steps: [
            'Mở tab Tổng quan đơn vị và bấm Gửi hồ sơ lên Phòng Tổ chức - Nhân sự.',
            'Theo dõi nhận xét thẩm định tại Hồ sơ đơn vị; nếu có Yêu cầu bổ sung thì sửa và gửi lại.',
            'Khi cần quay về số liệu cũ, vào tab Lịch sử & khôi phục chọn mốc phiên bản tương ứng.'
          ],
          result: 'Hồ sơ được lưu vết toàn bộ qua từng lần gửi và không bao giờ mất dữ liệu cũ.',
          actionHref: '/nghiep-vu-don-vi?tab=history',
          actionLabel: 'Xem lịch sử khôi phục'
        }
      ],
      diagramCaption: 'Quy trình kiểm tra chéo K_KiemTra và khóa nộp hồ sơ đơn vị',
      mermaidCode: MERMAID_LEADER,
      flowNodes: FLOW_LEADER,
      troubleshooting: [
        { situation: 'Tình huống 1: Hệ thống chặn không cho bấm Gửi hồ sơ', cause: 'Vẫn còn lỗi mức Phải sửa trên K_KiemTra hoặc còn phiếu chưa xử lý.', solution: 'Mở tab Kiểm tra trước khi gửi, xử lý hết mục đỏ rồi kiểm tra lại.' },
        { situation: 'Tình huống 2: Đơn vị muốn bổ sung số liệu sau khi đã gửi', cause: 'Hồ sơ đang được khóa ở trạng thái Chờ thẩm định.', solution: 'Liên hệ chuyên viên Phòng Tổ chức - Nhân sự bấm Yêu cầu bổ sung để mở lại.' }
      ]
    }
  ]
};
