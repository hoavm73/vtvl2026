import { TechDocChapter, TechDocFlowNode } from './hcmute-techdoc-types';

const FLOW_DIAGRAM_ALL: TechDocFlowNode[] = [
  { id: 'c5-1', label: '1. Khởi động & phân quyền', sublabel: 'Mục 1.1 · Đăng nhập', tone: 'main', targetDocId: '1.1', systemHref: '/login' },
  { id: 'c5-2', label: '2. Kê khai B1, B2_CT', sublabel: 'Mục 2.1 · Vai trò 1', tone: 'main', targetDocId: '2.1', systemHref: '/phieu-cong-viec' },
  { id: 'c5-3', label: '3. Duyệt & 10 biểu A1–D2', sublabel: 'Mục 3.1 · Vai trò 2', tone: 'decision', targetDocId: '3.1', systemHref: '/phieu-don-vi' },
  { id: 'c5-4', label: '4. Thẩm định 39 đơn vị', sublabel: 'Mục 4.1 · Vai trò 3', tone: 'done', targetDocId: '4.1', systemHref: '/admin/tham-dinh' }
];

const MERMAID_FULL = `flowchart TD
  S1["1. Đăng nhập @hcmute.edu.vn"] --> S2["2. Cán bộ lập phiếu B1, B2_CT"]
  S2 --> S3{"3. Lãnh đạo duyệt?"}
  S3 -- "Yêu cầu bổ sung" --> S2
  S3 -- "Đạt" --> S4["4. Tổng hợp 10 biểu A1–D2"]
  S4 --> S5{"5. K_KiemTra đạt 6/6?"}
  S5 -- "Đạt" --> S6["6. Phòng TCNS thẩm định & trình Hiệu trưởng"]`;

export const TECHDOC_CH5_TO_6: TechDocChapter[] = [
  {
    id: 'ch-5',
    order: 5,
    title: '5. Sơ đồ quy trình và biểu mẫu',
    articles: [
      {
        id: '5.1',
        chapterId: 'ch-5',
        chapterLabel: '5. Sơ đồ quy trình và biểu mẫu',
        title: '5.1 Tổng hợp sơ đồ khối quy trình nghiệp vụ',
        description: 'Bản đồ luồng nghiệp vụ khép kín 3 vai trò; hỗ trợ thu phóng và bấm vào từng khối để mở bài hướng dẫn tương ứng.',
        intro: 'Sơ đồ khối tổng hợp giúp Quý Thầy/Cô theo dõi trực quan toàn bộ chu trình từ khâu lập phiếu công việc đến lúc trình Ban Giám hiệu phê duyệt Đề án VTVL.',
        quickAction: {
          entryPath: '/huong-dan?doc=5.1',
          prerequisite: 'Mọi tài khoản HCM-UTE đều truy cập và điều hướng được.',
          coreSteps: [
            'Phân biệt màu khối chuẩn HCM-UTE: Xanh dương (thao tác chính), Vàng (xét duyệt), Xanh lá (hoàn tất).',
            'Nhấp chuột trực tiếp vào từng khối bên dưới để mở đúng bài hướng dẫn tương ứng.',
            'Dùng nút Thu/Phóng hoặc Sao chép mã Mermaid khi cần trình chiếu họp đơn vị.'
          ],
          primaryHref: '/bang-tinh',
          primaryLabel: 'Mở bảng tính 10 biểu',
          secondaryHref: '/phieu-cong-viec',
          secondaryLabel: 'Mở phiếu công việc'
        },
        tasks: [
          {
            number: 1,
            title: 'Tác vụ 1: Điều hướng trực quan bằng sơ đồ Mermaid',
            purpose: 'Giúp tìm nhanh quy định ở từng điểm chuyển giao trách nhiệm giữa 3 vai trò.',
            steps: [
              'Đọc luồng xử lý từ trên xuống dưới theo chiều mũi tên.',
              'Bấm vào khối rẽ nhánh màu vàng khi muốn xem quy trình xử lý Yêu cầu bổ sung.',
              'Dùng thanh thu phóng 50%–200% để quan sát rõ trên màn hình di động hoặc máy chiếu.'
            ],
            result: 'Nắm trọn kiến trúc quy trình VTVL 360 chỉ trong một sơ đồ duy nhất.',
            actionHref: '/huong-dan?doc=5.2',
            actionLabel: 'Xem danh mục biểu mẫu'
          }
        ],
        diagramCaption: 'Sơ đồ khối quy trình VTVL 360 toàn Trường (Bấm vào từng khối để mở hướng dẫn)',
        mermaidCode: MERMAID_FULL,
        flowNodes: FLOW_DIAGRAM_ALL,
        troubleshooting: [
          { situation: 'Tình huống 1: Khung sơ đồ hơi nhỏ khi xem trên điện thoại', cause: 'Chiều rộng màn hình di động dưới 640px.', solution: 'Dùng nút phóng to (+) ngay góc trên sơ đồ hoặc xoay ngang màn hình.' },
          { situation: 'Tình huống 2: Cần đưa sơ đồ vào báo cáo Word của Khoa/Phòng', cause: 'Đơn vị tổ chức tập huấn kê khai phiếu.', solution: 'Bấm Sao chép mã Mermaid hoặc Xuất PDF ngay trên thanh công cụ.' }
        ]
      },
      {
        id: '5.2',
        chapterId: 'ch-5',
        chapterLabel: '5. Sơ đồ quy trình và biểu mẫu',
        title: '5.2 Danh mục hệ thống biểu mẫu A1–D2 và B1, B2_CT',
        description: 'Giải thích vai trò từng bảng tính trong bộ 10 biểu chuẩn Hướng dẫn số 07-HD/BTCTW và cung cấp tệp mẫu tải về.',
        intro: 'Hệ thống tổ chức đầy đủ các biểu A1, A2, B1, B2_CT, B2, C1, C2, C3, D1, D2, DM_SAN_PHAM, DU_BAO_5_NAM và K_KiemTra bảo đảm tính liên kết tự động.',
        quickAction: {
          entryPath: '/bang-tinh',
          prerequisite: 'Nắm rõ biểu nào nhập dữ liệu gốc, biểu nào tự động tổng hợp.',
          coreSteps: [
            'Nhóm A (A1, A2) và C1: Lưu danh mục gốc nhiệm vụ, công việc và VTVL cụ thể của đơn vị.',
            'Nhóm B (B1, B2_CT, B2): Lưu phiếu công việc cá nhân và tổng hợp khối lượng định mức.',
            'Nhóm C2–C3, D1–D2 và K_KiemTra: Tính quy đổi biên chế, phân bổ nhân lực và kiểm tra chéo 6 chỉ tiêu.'
          ],
          primaryHref: '/bang-tinh',
          primaryLabel: 'Mở bảng tính 10 biểu',
          secondaryHref: '/nghiep-vu-don-vi?tab=check',
          secondaryLabel: 'Xem kiểm tra K_KiemTra'
        },
        tasks: [
          {
            number: 1,
            title: 'Tác vụ 1: Phân biệt chức năng từng nhóm biểu mẫu chuẩn',
            purpose: 'Thao tác đúng sheet, tránh sửa đè vào các ô tính công thức tổng hợp.',
            steps: [
              'Biểu A1 và C1 là danh mục gốc; Biểu A2 và B1 nhận số liệu gộp từ phiếu cá nhân (B2_CT).',
              'Biểu C2, C3 tự động tính số người làm việc cần thiết theo chuẩn 1.904 giờ/năm.',
              'Biểu D1, D2 đối chiếu nhân sự hiện có ngày 30/9/2026 và kế hoạch 5 năm; K_KiemTra kiểm soát chéo.'
            ],
            result: 'Hồ sơ Excel và cơ sở dữ liệu PostgreSQL luôn nhất quán 100%.',
            actionHref: '/bang-tinh',
            actionLabel: 'Đi tới Bảng tính 10 biểu'
          }
        ],
        diagramCaption: 'Liên kết phân tầng 10 biểu A1–D2 và K_KiemTra',
        mermaidCode: MERMAID_FULL,
        flowNodes: FLOW_DIAGRAM_ALL,
        troubleshooting: [
          { situation: 'Tình huống 1: Tải file Excel về bị lỗi định dạng công thức', cause: 'Phần mềm đọc file trên máy cài phiên bản quá cũ.', solution: 'Thao tác trực tiếp trên Bảng tính 10 biểu của hệ thống hoặc dùng Excel bản mới.' },
          { situation: 'Tình huống 2: Nhầm lẫn giữa Biểu B1 và Biểu B2_CT', cause: 'B2_CT là phiếu chi tiết cá nhân, B1 là bảng tổng hợp cấp đơn vị.', solution: 'Viên chức nhập tại Phiếu công việc cá nhân để hệ thống tự tổng hợp vào B1.' }
        ],
        showOfficialForms: true
      }
    ]
  },
  {
    id: 'ch-6',
    order: 6,
    title: '6. Trợ lý thao tác và xử lý sự cố',
    articles: [
      {
        id: '6.1',
        chapterId: 'ch-6',
        chapterLabel: '6. Trợ lý thao tác và xử lý sự cố',
        title: '6.1 Checklist nghiệm thu trước khi nộp hồ sơ',
        description: 'Bộ tiêu chí tự kiểm tra giúp đơn vị rà soát đủ 6 điều kiện trước khi gửi hồ sơ lên Phòng Tổ chức - Nhân sự.',
        intro: 'Thực hiện đầy đủ 6 bước rà soát dưới đây giúp hồ sơ của đơn vị đạt chuẩn ngay từ lần thẩm định đầu tiên.',
        quickAction: {
          entryPath: '/nghiep-vu-don-vi?tab=check',
          prerequisite: 'Đơn vị đã duyệt xong phiếu và nhập đủ 10 biểu.',
          coreSteps: [
            '100% phiếu hợp lệ đã duyệt và gộp vào B1/B2 (không còn phiếu chờ duyệt tồn đọng).',
            'Biểu D1 khớp nhân sự ngày 30/9/2026 và không có viên chức vượt quỹ 1.904 giờ/năm.',
            'Tab Kiểm tra trước khi gửi đạt 6/6 chỉ tiêu, lỗi Phải sửa bằng 0.'
          ],
          primaryHref: '/nghiep-vu-don-vi?tab=check',
          primaryLabel: 'Mở kiểm tra K_KiemTra',
          secondaryHref: '/phieu-don-vi',
          secondaryLabel: 'Kiểm tra phiếu đơn vị'
        },
        tasks: [
          {
            number: 1,
            title: 'Tác vụ 1: Đối soát 6 tiêu chí nghiệm thu hồ sơ đơn vị',
            purpose: 'Ngăn chặn sớm sai sót dữ liệu trước khi khóa phiên bản gửi Phòng Tổ chức - Nhân sự.',
            steps: [
              'Kiểm tra tab Chờ duyệt tại Quản lý phiếu đơn vị bảo đảm đã xử lý hết phiếu mới.',
              'Mở Sơ đồ VTVL dự kiến và Biểu đồ cơ cấu nhân lực để kiểm tra độ phủ nhân sự.',
              'Chạy K_KiemTra xử lý sạch cảnh báo đỏ và bổ sung nguồn văn bản ở cảnh báo vàng.'
            ],
            result: 'Hồ sơ đơn vị hoàn chỉnh và đủ điều kiện bấm Gửi hồ sơ lên Phòng TCNS.',
            actionHref: '/nghiep-vu-don-vi?tab=check',
            actionLabel: 'Kiểm tra nghiệm thu ngay'
          }
        ],
        diagramCaption: 'Lộ trình kiểm tra chất lượng trước khi gửi thẩm định',
        mermaidCode: MERMAID_FULL,
        flowNodes: FLOW_DIAGRAM_ALL,
        troubleshooting: [
          { situation: 'Tình huống 1: Còn phiếu của viên chức nằm ở trạng thái Nháp', cause: 'Viên chức quên bấm Lưu và nộp sau khi soạn.', solution: 'Nhắc viên chức mở lại phiếu Nháp và bấm Lưu và nộp.' },
          { situation: 'Tình huống 2: Bỏ trống số liệu dự báo 2026–2030', cause: 'Mới hoàn thiện nhân sự hiện tại ở D1 nhưng chưa nhập Biểu D2.', solution: 'Mở tab D2 trong Bảng tính 10 biểu để bổ sung phương án 5 năm và lưu lại.' }
        ]
      },
      {
        id: '6.2',
        chapterId: 'ch-6',
        chapterLabel: '6. Trợ lý thao tác và xử lý sự cố',
        title: '6.2 Trung tâm xử lý tình huống thường gặp',
        description: 'Tổng hợp nhanh nguyên nhân và giải pháp cho các vướng mắc khi kê khai, gộp phiếu, xung đột phiên bản và xuất PDF.',
        intro: 'Khi gặp thông báo cảnh báo hoặc trở ngại thao tác, Quý Thầy/Cô tra cứu bảng tình huống dưới đây để tự xử lý nhanh.',
        quickAction: {
          entryPath: 'Hỗ trợ kỹ thuật HCM-UTE',
          prerequisite: 'Ghi nhận rõ thông báo hiển thị trên màn hình và mã đơn vị/mã phiếu.',
          coreSteps: [
            'Kiểm tra kết nối mạng và tài khoản @hcmute.edu.vn đang đăng nhập.',
            'Đối chiếu nhanh tình huống tương ứng bên dưới (lưu dữ liệu, xung đột phiên bản, in PDF).',
            'Liên hệ Phòng Tổ chức - Nhân sự (tcns@hcmute.edu.vn) nếu cần mở khóa hoặc cấp lại quyền.'
          ],
          primaryHref: '/phieu-cong-viec',
          primaryLabel: 'Mở phiếu công việc',
          secondaryHref: '/nghiep-vu-don-vi?tab=history',
          secondaryLabel: 'Mở lịch sử khôi phục'
        },
        tasks: [
          {
            number: 1,
            title: 'Tác vụ 1: Khắc phục sự cố đồng bộ và khôi phục dữ liệu',
            purpose: 'An toàn hóa dữ liệu khi nhiều người cùng xem bảng tính hoặc sửa nhầm dòng.',
            steps: [
              'Khi thấy cảnh báo Xung đột phiên bản, bấm Làm mới để tải phiên bản mới nhất trên máy chủ.',
              'Nếu lỡ xóa hoặc sửa nhầm bảng tính, mở Hồ sơ đơn vị → Lịch sử & khôi phục để chọn bản trước.',
              'Xóa cache trình duyệt bằng Ctrl+Shift+R (Cmd+Shift+R) nếu không thấy nút mới cập nhật.'
            ],
            result: 'Khôi phục trạng thái làm việc ổn định và bảo toàn toàn bộ số liệu đã lưu.',
            actionHref: '/nghiep-vu-don-vi?tab=history',
            actionLabel: 'Xem lịch sử & khôi phục'
          }
        ],
        diagramCaption: 'Sơ đồ định tuyến hỗ trợ và khôi phục dữ liệu',
        mermaidCode: MERMAID_FULL,
        flowNodes: FLOW_DIAGRAM_ALL,
        troubleshooting: [
          { situation: 'Tình huống 1: Trình duyệt vẫn hiển thị giao diện cũ sau đợt nâng cấp', cause: 'Bộ nhớ đệm trình duyệt lưu bản tài nguyên cũ.', solution: 'Nhấn Ctrl+Shift+R (Windows) hoặc Cmd+Shift+R (Mac) để tải mới hoàn toàn.' },
          { situation: 'Tình huống 2: Bản in PDF thiếu màu nền hoặc vạch kẻ', cause: 'Hộp thoại in trình duyệt đang tắt tùy chọn Background graphics.', solution: 'Bật Background graphics trong phần More settings của cửa sổ Print.' }
        ]
      },
      {
        id: '6.3',
        chapterId: 'ch-6',
        chapterLabel: '6. Trợ lý thao tác và xử lý sự cố',
        title: '6.3 Tra cứu thuật ngữ và phím tắt',
        description: 'Chuẩn hóa thuật ngữ HCM-UTE theo Nghị định số 232/2026/NĐ-CP, Thông tư số 31/2026/TT-BGDĐT và các phím tắt thao tác.',
        intro: 'Dùng đúng tên gọi đơn vị, chức danh, quy ước mã hóa và phím tắt giúp soạn thảo văn bản thuyết minh và thao tác bảng tính chuẩn xác toàn Trường.',
        quickAction: {
          entryPath: 'Chuẩn thuật ngữ HCM-UTE',
          prerequisite: 'Áp dụng thống nhất trong mọi tài liệu, phiếu công việc và bảng tính HCM-UTE.',
          coreSteps: [
            'Tên trường: Trường Đại học Công nghệ Kỹ thuật TP.HCM · viết tắt: HCM-UTE (có dấu gạch nối).',
            'Đơn vị chủ quản: Phòng Tổ chức - Nhân sự (tcns@hcmute.edu.vn).',
            'Chức danh tiếng Anh chuẩn: President (Hiệu trưởng), Dean (Trưởng khoa), Director of the Office of... (Trưởng phòng).'
          ],
          primaryHref: '/huong-dan?doc=5.2',
          primaryLabel: 'Xem danh mục biểu mẫu',
          secondaryHref: '/bang-tinh',
          secondaryLabel: 'Mở bảng tính 10 biểu'
        },
        tasks: [
          {
            number: 1,
            title: 'Tác vụ 1: Áp dụng quy ước mã hóa và phím tắt thao tác nhanh',
            purpose: 'Thống nhất mã nhiệm vụ, mã công việc, quỹ giờ chuẩn và thao tác bàn phím thông dụng.',
            steps: [
              'Mã nhiệm vụ chuẩn: [MÃ_ĐV].NVxx; Mã công việc chuẩn: [MÃ_NV].CVxx (tự tăng dần).',
              'Chuẩn định mức thời gian: 1.904 giờ chuẩn/người/năm (114.240 phút/năm) theo bậc nghề nghiệp 1–5.',
              'Phím tắt: Cmd/Ctrl + P để xuất PDF A4; Ctrl/Cmd + F để tìm nhanh trong trang; bấm tab TOC để cuộn mượt.'
            ],
            result: 'Văn bản hành chính và bảng tính của đơn vị tuân thủ 100% quy chuẩn HCM-UTE.',
            actionHref: '/',
            actionLabel: 'Quay về trang chủ'
          }
        ],
        diagramCaption: 'Áp dụng chuẩn thuật ngữ trong toàn bộ quy trình VTVL 360',
        mermaidCode: MERMAID_FULL,
        flowNodes: FLOW_DIAGRAM_ALL,
        troubleshooting: [
          { situation: 'Tình huống 1: Tài liệu cũ vẫn viết HCMUTE không gạch nối hoặc dùng tên Trường cũ', cause: 'Sao chép nguyên văn từ hồ sơ các năm trước.', solution: 'Cập nhật toàn bộ sang "HCM-UTE" và "Trường Đại học Công nghệ Kỹ thuật TP.HCM".' },
          { situation: 'Tình huống 2: Viết hoa tiêu đề tiếng Việt tràn lan kiểu Title Case', cause: 'Thói quen soạn thảo cũ.', solution: 'Chuyển sang chuẩn Sentence case (chỉ viết hoa chữ cái đầu câu và danh từ riêng).' }
        ]
      }
    ]
  }
];
