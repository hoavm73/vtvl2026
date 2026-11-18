import { TechDocChapter, TechDocFlowNode } from './hcmute-techdoc-types';

const FLOW_STAFF: TechDocFlowNode[] = [
  { id: 'c2-1', label: '1. Chọn A1 & C1', sublabel: 'Nhiệm vụ và VTVL chính', tone: 'main', targetDocId: '2.1', systemHref: '/phieu-cong-viec' },
  { id: 'c2-2', label: '2. Nhập sản lượng & phút/SP', sublabel: 'Đo định mức & căn cứ', tone: 'main', targetDocId: '2.2', systemHref: '/bam-gio' },
  { id: 'c2-3', label: '3. Lưu, nộp & bổ sung', sublabel: 'Theo dõi phản hồi v1/v2', tone: 'decision', targetDocId: '2.3', systemHref: '/phieu-cong-viec?tab=my-tickets' },
  { id: 'c2-4', label: '4. Duyệt & gộp B1/B2', sublabel: 'Chuyển sang hồ sơ đơn vị', tone: 'done', targetDocId: '3.1', systemHref: '/phieu-don-vi' }
];

const MERMAID_STAFF = `flowchart TD
  A["1. Chọn Nhiệm vụ A1 và VTVL chính C1"] --> B["2. Nhập sản lượng, phút/SP và căn cứ"]
  B --> C{"3. Lưu nháp hay Nộp duyệt?"}
  C -- "Lưu nháp" --> B
  C -- "Nộp duyệt" --> D["4. Chờ Lãnh đạo đơn vị xét duyệt"]`;

export const TECHDOC_CH2: TechDocChapter = {
  id: 'ch-2',
  order: 2,
  title: '2. Vai trò 1: Cán bộ, giảng viên và nhân viên',
  articles: [
    {
      id: '2.1',
      chapterId: 'ch-2',
      chapterLabel: '2. Vai trò 1: Cán bộ, giảng viên và nhân viên',
      title: '2.1 Kê khai phiếu công việc (Biểu B1, B2_CT)',
      description: 'Chọn nhiệm vụ A1, vị trí việc làm chính C1, mô tả sản phẩm đầu ra và đầu việc phối hợp theo kỳ 01/10/2025–30/9/2026.',
      intro: 'Kê khai phiếu công việc cá nhân là bước tạo dữ liệu gốc cho Biểu B1 và B2_CT. Mỗi đầu việc phải gắn đúng một nhiệm vụ tại Biểu A1 và vị trí việc làm chính tại Biểu C1.',
      quickAction: {
        entryPath: '/phieu-cong-viec',
        prerequisite: 'Đã đăng nhập @hcmute.edu.vn và đơn vị đã thiết lập danh mục A1, C1.',
        coreSteps: [
          'Mở Nghiệp vụ cá nhân → Phiếu công việc cá nhân → tab Tạo phiếu công việc.',
          'Chọn Mã nhiệm vụ (A1), Mã VTVL chính (C1), nhập Tên công việc và Mô tả sản phẩm đầu ra.',
          'Gắn Mã VTVL phối hợp (nếu có sự tham gia từ vị trí hoặc đơn vị khác).'
        ],
        primaryHref: '/phieu-cong-viec',
        primaryLabel: 'Mở phiếu công việc cá nhân',
        secondaryHref: '/bang-tinh?sheet=B1',
        secondaryLabel: 'Xem bảng tính đơn vị'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Chọn nhiệm vụ A1 và vị trí việc làm chính C1',
          purpose: 'Liên kết đúng công việc cá nhân vào chức năng nhiệm vụ chung và VTVL đang đảm nhiệm.',
          steps: [
            'Mở tab Tạo phiếu công việc tại trang Phiếu công việc cá nhân.',
            'Chọn Mã nhiệm vụ (A1) tương ứng với mảng công việc được phân công.',
            'Chọn Mã VTVL chính (C1) đúng với vị trí việc làm của Quý Thầy/Cô trong đơn vị.'
          ],
          result: 'Hệ thống tự cấp tiền tố mã công việc chuẩn [ĐV].NVxx và hiển thị đầy đủ các trường kê khai.',
          note: 'Nếu một nhiệm vụ có nhiều đầu việc độc lập khác sản phẩm đầu ra, cần tách thành các phiếu riêng.',
          actionHref: '/phieu-cong-viec',
          actionLabel: 'Thực hiện kê khai ngay'
        },
        {
          number: 2,
          title: 'Tác vụ 2: Mô tả sản phẩm đầu ra và đầu việc phối hợp',
          purpose: 'Làm rõ kết quả đầu ra đếm được và minh bạch các vị trí cùng tham gia thực hiện.',
          steps: [
            'Đặt Tên công việc bắt đầu bằng động từ hành động cụ thể, ngắn gọn.',
            'Ghi rõ Sản phẩm đầu ra gắn đơn vị tính cụ thể (báo cáo, hồ sơ, quyết định, tiết chuẩn...).',
            'Chọn Mã VTVL phối hợp (nếu có) để hệ thống gửi thông báo tham chiếu sang tab Công việc phối hợp với tôi.'
          ],
          result: 'Sản phẩm đầu ra rõ ràng, không trùng lặp và sẵn sàng cho bước nhập định mức.',
          actionHref: '/phieu-cong-viec?tab=coordination',
          actionLabel: 'Xem việc phối hợp'
        }
      ],
      diagramCaption: 'Quy trình kê khai phiếu công việc Biểu B1, B2_CT',
      mermaidCode: MERMAID_STAFF,
      flowNodes: FLOW_STAFF,
      troubleshooting: [
        { situation: 'Tình huống 1: Không tìm thấy tên VTVL của bản thân trong danh sách C1', cause: 'Đơn vị chưa bổ sung đủ vị trí ở Biểu C1 trên Bảng tính 10 biểu.', solution: 'Đề nghị Tổ thư ký hoặc Lãnh đạo đơn vị thêm vị trí vào Biểu C1 và bấm Lưu biểu.' },
        { situation: 'Tình huống 2: Người phối hợp chưa nhìn thấy phiếu đề xuất', cause: 'Phiếu đang ở trạng thái Lưu nháp hoặc gắn nhầm mã đơn vị của VTVL phối hợp.', solution: 'Kiểm tra lại đơn vị phối hợp và bấm Lưu và nộp để hiển thị công khai.' }
      ]
    },
    {
      id: '2.2',
      chapterId: 'ch-2',
      chapterLabel: '2. Vai trò 1: Cán bộ, giảng viên và nhân viên',
      title: '2.2 Nhập sản lượng, phút/SP và căn cứ kiểm chứng',
      description: 'Xác định sản lượng thực tế kỳ 01/10/2025–30/9/2026, đo phút/sản phẩm bằng Bấm giờ định mức và ghi nguồn kiểm chứng.',
      intro: 'Số lượng sản phẩm và thời gian trung bình cho 1 sản phẩm (phút/SP) quyết định trực tiếp đến tổng giờ công quy đổi và nhu cầu biên chế của đơn vị.',
      quickAction: {
        entryPath: '/phieu-cong-viec & /bam-gio',
        prerequisite: 'Tổng hợp số liệu thực tế phát sinh từ 01/10/2025 đến 30/9/2026.',
        coreSteps: [
          'Nhập Sản lượng thực tế năm phản ánh đúng khối lượng hoàn thành trong 12 tháng.',
          'Nhập Phút/SP thực tế hoặc dùng công cụ Bấm giờ định mức để đo trực tiếp.',
          'Ghi rõ Căn cứ pháp lý và Nguồn số liệu kiểm chứng lưu trữ tại đơn vị.'
        ],
        primaryHref: '/bam-gio',
        primaryLabel: 'Mở công cụ bấm giờ định mức',
        secondaryHref: '/phieu-cong-viec',
        secondaryLabel: 'Quay lại phiếu công việc'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Nhập sản lượng năm và đo thời gian phút/SP',
          purpose: 'Tính đúng tổng giờ quy đổi theo công thức (Sản lượng × Phút/SP) / 60.',
          steps: [
            'Nhập tổng số sản phẩm hoàn thành trong kỳ 01/10/2025–30/9/2026.',
            'Nếu chưa có định mức chuẩn, mở Bấm giờ định mức để đo thời gian thực của từng thao tác.',
            'Kiểm tra lại Tổng giờ/năm tự tính bên dưới để tránh nhầm giữa phút và giờ.'
          ],
          result: 'Số liệu định lượng phản ánh trung thực khối lượng lao động của viên chức.',
          actionHref: '/bam-gio',
          actionLabel: 'Mở Bấm giờ định mức'
        },
        {
          number: 2,
          title: 'Tác vụ 2: Bổ sung căn cứ pháp lý và nguồn số liệu kiểm chứng',
          purpose: 'Đáp ứng yêu cầu kiểm tra của Lãnh đạo đơn vị và Hội đồng thẩm định Trường.',
          steps: [
            'Ghi số/tên văn bản quy định nhiệm vụ hoặc quy chế nội bộ liên quan.',
            'Ghi cụ thể nơi lưu bằng chứng (phần mềm quản lý, sổ giao nhận, báo cáo tổng kết năm học).',
            'Chọn Xem trước bản in A4 để kiểm tra đầy đủ các cột căn cứ trước khi nộp.'
          ],
          result: 'Hồ sơ phiếu đầy đủ chứng cứ xác thực, giảm tối đa yêu cầu giải trình bổ sung.',
          actionHref: '/phieu-cong-viec',
          actionLabel: 'Cập nhật căn cứ phiếu'
        }
      ],
      diagramCaption: 'Luồng nhập định mức thời gian và kiểm chứng số liệu cá nhân',
      mermaidCode: MERMAID_STAFF,
      flowNodes: FLOW_STAFF,
      troubleshooting: [
        { situation: 'Tình huống 1: Tổng giờ quy đổi của 1 đầu việc vượt quá 1.904 giờ', cause: 'Nhập nhầm đơn vị giờ thay vì số phút vào ô Phút/SP.', solution: 'Quy đổi về số phút thực hiện cho 1 sản phẩm và kiểm tra lại kết quả tổng giờ.' },
        { situation: 'Tình huống 2: Công việc hành chính lặp lại không có quyết định riêng', cause: 'Công việc phát sinh theo phân công thường xuyên.', solution: 'Dẫn nguồn là Bảng phân công nhiệm vụ đơn vị, lịch trực hoặc nhật ký email công vụ.' }
      ]
    },
    {
      id: '2.3',
      chapterId: 'ch-2',
      chapterLabel: '2. Vai trò 1: Cán bộ, giảng viên và nhân viên',
      title: '2.3 Lưu, nộp và theo dõi phản hồi phê duyệt',
      description: 'Phân biệt Lưu nháp và Lưu và nộp, cập nhật phiếu theo yêu cầu bổ sung kèm đối chiếu lịch sử phiên bản.',
      intro: 'Mỗi lần nộp hoặc nộp lại phiếu đều tạo một phiên bản bất biến (v1, v2, v3...), bảo đảm minh bạch toàn bộ quá trình xét duyệt giữa viên chức và Lãnh đạo đơn vị.',
      quickAction: {
        entryPath: '/phieu-cong-viec?tab=my-tickets',
        prerequisite: 'Đã điền đủ thông tin phiếu hoặc có bản nháp cần hoàn tất.',
        coreSteps: [
          'Chọn Lưu nháp nếu chưa sẵn sàng nộp (bản nháp được bảo mật riêng tư).',
          'Chọn Lưu và nộp để tạo bản v1 và chuyển trạng thái Chờ duyệt.',
          'Nếu nhận Yêu cầu bổ sung, sửa nội dung, ghi giải trình rồi bấm Nộp lại để tạo v2.'
        ],
        primaryHref: '/phieu-cong-viec?tab=my-tickets',
        primaryLabel: 'Mở danh sách phiếu của tôi',
        secondaryHref: '/phieu-cong-viec?tab=relationships',
        secondaryLabel: 'Xem quan hệ công việc'
      },
      tasks: [
        {
          number: 1,
          title: 'Tác vụ 1: Lưu nháp, nộp phiếu và chỉnh sửa trước duyệt',
          purpose: 'Kiểm soát chặt thời điểm dữ liệu được gửi chính thức lên Lãnh đạo đơn vị.',
          steps: [
            'Bấm Lưu nháp nếu cần đối chiếu thêm số liệu; người khác trong đơn vị sẽ chưa thấy bản nháp.',
            'Khi hoàn tất mọi trường có dấu sao (*), bấm Lưu và nộp để phát hành phiên bản v1.',
            'Nếu Lãnh đạo chưa duyệt, vẫn mở lại sửa được nội dung phiếu đang Chờ duyệt.'
          ],
          result: 'Phiếu mang mã [ĐV].NVxx.CVxx xuất hiện ngay trên hàng đợi xét duyệt của Lãnh đạo đơn vị.',
          actionHref: '/phieu-cong-viec?tab=my-tickets',
          actionLabel: 'Xem phiếu của tôi'
        },
        {
          number: 2,
          title: 'Tác vụ 2: Giải trình yêu cầu bổ sung và xuất bản in A4',
          purpose: 'Hoàn thiện phiếu đúng góp ý của Lãnh đạo và xuất bản cứng khi cần lưu hồ sơ giấy.',
          steps: [
            'Mở phiếu trạng thái Yêu cầu bổ sung để đọc rõ lý do cần điều chỉnh.',
            'Cập nhật số liệu mới, điền tóm tắt nội dung giải trình thay đổi rồi bấm Lưu và nộp lại.',
            'Mở nút In PDF (A4) khi cần lưu bản giấy có đầy đủ khung ký xác nhận.'
          ],
          result: 'Hệ thống giữ nguyên bản v1, lưu bản v2 mới và hiển thị lịch sử thay đổi để duyệt lại.',
          actionHref: '/phieu-cong-viec?tab=my-tickets',
          actionLabel: 'Xử lý phiếu cần bổ sung'
        }
      ],
      diagramCaption: 'Vòng đời trạng thái phiếu và quản lý phiên bản v1/v2',
      mermaidCode: MERMAID_STAFF,
      flowNodes: FLOW_STAFF,
      troubleshooting: [
        { situation: 'Tình huống 1: Nút Sửa không khả dụng trên phiếu đã nộp', cause: 'Phiếu đã được Lãnh đạo duyệt và gộp vào Biểu A2/B1.', solution: 'Đề nghị Lãnh đạo đơn vị chọn Thu hồi phê duyệt trước khi chỉnh sửa và nộp lại.' },
        { situation: 'Tình huống 2: Xuất PDF A4 bị lẹm chữ hoặc sinh trang trắng', cause: 'Trình duyệt đặt lề quá rộng hoặc tỷ lệ thu phóng sai.', solution: 'Chọn in trực tiếp từ nút In PDF (A4) với khổ A4 dọc và tắt Header/Footer mặc định.' }
      ]
    }
  ]
};
