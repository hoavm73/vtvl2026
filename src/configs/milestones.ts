export interface MilestoneItem {
  id: string;
  dateStr: string;
  day: string;
  month: string;
  title: string;
  description: string;
  note: string;
  status: 'completed' | 'active' | 'upcoming';
  badgeText: string;
}

export interface StepSubTask { id: string; label: string; }
export interface SidebarStepItem {
  num: number;
  shortTitle: string;
  sheets: string;
  title: string;
  href: string;
  subTasks: StepSubTask[];
}

export const SIDEBAR_EIGHT_STEPS: SidebarStepItem[] = [
  { num: 1, shortTitle: 'Rà soát chức năng, nhiệm vụ', sheets: 'Biểu 1. A1_NhiemVu', title: 'Bước 1 — Rà soát chức năng, nhiệm vụ (A1)', href: '/tao-tep?step=1', subTasks: [{ id: 'task-1-unit', label: 'Chọn đơn vị & nhiệm vụ A1' }, { id: 'task-1-actor', label: 'Khai báo người thực hiện' }] },
  { num: 2, shortTitle: 'Xác định công việc & sản phẩm', sheets: 'Biểu 2. A2 · 11. DM_SP', title: 'Bước 2 — Công việc, công đoạn & sản phẩm (A2)', href: '/tao-tep?step=2', subTasks: [{ id: 'task-1-add', label: 'Phân rã công việc & sản phẩm chuẩn I–VI' }] },
  { num: 3, shortTitle: 'Số lượng SP & thời gian thực hiện', sheets: 'Biểu 4. B1_KhoiLuong', title: 'Bước 3 — Số lượng SP & thời gian thực hiện (B1)', href: '/bam-gio?step=3', subTasks: [{ id: 'task-3-vtvl', label: 'Chọn VTVL & công việc B1' }, { id: 'task-3-timer', label: 'Bấm giờ đo thực tế / nhập sản lượng' }] },
  { num: 4, shortTitle: 'Tác động CĐS, tự chủ, thuê dịch vụ', sheets: 'Biểu 5. B2_CT → 6. B2', title: 'Bước 4 — Thay đổi do CĐS, tự chủ, thuê DV (B2_CT → B2)', href: '/bam-gio?step=4', subTasks: [{ id: 'task-3-export', label: 'Kê khai công đoạn số hóa & xuất phiếu B1–B2' }] },
  { num: 5, shortTitle: 'Danh mục VTVL, mô tả & năng lực', sheets: 'Biểu 3. C1 · 7. C2', title: 'Bước 5 — Danh mục VTVL, bản mô tả & năng lực (C1, C2)', href: '/tao-tep?step=5', subTasks: [{ id: 'task-1-name', label: 'Tên VTVL cụ thể, Bậc 1–5 & Quỹ giờ PP2' }] },
  { num: 6, shortTitle: 'Xác định số người cần thiết (FTE)', sheets: 'Biểu 8. C3_NhuCau', title: 'Bước 6 — Xác định số người cần thiết PP1/PP2/PP3 (C3)', href: '/tao-tep?step=6', subTasks: [{ id: 'task-2-export', label: 'Tính nhu cầu C3 & Xuất bộ 10 biểu gốc (v1)' }] },
  { num: 7, shortTitle: 'Đối chiếu nhân lực & phương án biên chế', sheets: 'Biểu 9. D1 · 10. D2 · DU_BAO', title: 'Bước 7 — Đối chiếu nhân lực D1 & phương án biên chế D2', href: '/tao-tep?step=7', subTasks: [{ id: 'task-4-forms', label: 'Gộp phiếu khảo sát & lập phương án 2027–2031 (v2)' }] },
  { num: 8, shortTitle: 'Kiểm tra, xác nhận & gửi kết quả', sheets: 'Biểu 13. K · 14. T · 15. S', title: 'Bước 8 — Kiểm tra 10 biểu, xác nhận & gửi kết quả (K–T–S)', href: '/ra-soat', subTasks: [{ id: 'task-5-run', label: 'Kiểm tra chéo 6 chỉ tiêu K_KiemTra' }, { id: 'task-5-export', label: 'Xuất báo cáo thẩm định & Tờ trình' }] }
];

export const SIDEBAR_FIVE_STEPS = SIDEBAR_EIGHT_STEPS;

export const VTVL_MILESTONES: MilestoneItem[] = [
  {
    id: 'ms-1',
    dateStr: '2026-11-03',
    day: '03',
    month: 'tháng 11',
    title: 'Giai đoạn 1: Rà soát danh mục nhiệm vụ và vị trí việc làm',
    description: 'Khởi tạo tệp đơn vị (21 trang tính); chuẩn hóa biểu A1, A2, C1, C2 theo Nghị định số 232/2026/NĐ-CP và Thông tư số 31/2026/TT-BGDĐT.',
    note: 'Áp dụng đối với 51 đơn vị thuộc và trực thuộc Trường.',
    status: 'completed',
    badgeText: 'Đã hoàn thành'
  },
  {
    id: 'ms-2',
    dateStr: '2026-11-10',
    day: '10',
    month: 'tháng 11',
    title: 'Giai đoạn 2: Khảo sát sản lượng và đo định mức thời gian',
    description: 'Phân phối phiếu khảo sát theo vị trí việc làm, thực hiện đo định mức thời gian (phút/sản phẩm) và tích hợp số liệu vào biểu B1, B2, D1.',
    note: 'Tổng hợp tự động các phiếu khảo sát thành tệp đơn vị phiên bản v2.',
    status: 'active',
    badgeText: 'Đang triển khai'
  },
  {
    id: 'ms-3',
    dateStr: '2026-11-15',
    day: '15',
    month: 'tháng 11',
    title: 'Giai đoạn 3: Thẩm định chéo bộ biểu và trình ký hồ sơ',
    description: 'Kiểm tra chéo 6 chỉ tiêu tại biểu K_KiemTra, hoàn thiện phương án biên chế giai đoạn 2027–2031 (biểu D2) và gửi Phòng Tổ chức - Nhân sự.',
    note: 'Trình ký Tờ trình kèm tệp dữ liệu điện tử (.xlsx) qua hệ thống E-Office.',
    status: 'upcoming',
    badgeText: 'Sắp tới hạn'
  }
];
