export interface TechDocFlowNode {
  id: string;
  label: string;
  sublabel: string;
  tone: 'main' | 'decision' | 'done';
  targetDocId: string;
  systemHref?: string;
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

export interface TechDocQuickAction {
  entryPath: string;
  prerequisite: string;
  coreSteps: string[];
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export interface TechDocArticleData {
  id: string;
  chapterId: string;
  chapterLabel: string;
  title: string;
  description: string;
  intro: string;
  quickAction: TechDocQuickAction;
  tasks: TechDocTaskItem[];
  diagramCaption: string;
  mermaidCode: string;
  flowNodes: TechDocFlowNode[];
  troubleshooting: TechDocTroubleItem[];
  showOfficialForms?: boolean;
}

export interface TechDocChapter {
  id: string;
  order: number;
  title: string;
  articles: TechDocArticleData[];
}

export interface TechDocChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export interface TechDocTocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export const TECHDOC_PORTAL_META = {
  title: 'Cổng tài liệu nghiệp vụ Vị trí việc làm 360',
  subtitle: 'Áp dụng cho 3 vai trò tại Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE) theo Hướng dẫn số 07-HD/BTCTW, Nghị định số 232/2026/NĐ-CP và Thông tư số 31/2026/TT-BGDĐT.',
  status: 'Đã ban hành',
  version: 'v2.0',
  updatedAt: '18/11/2026',
  issuer: 'Phòng Tổ chức - Nhân sự · Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)'
};

export const TECHDOC_CHANGELOG: TechDocChangelogEntry[] = [
  {
    version: 'v2.0',
    date: '18/11/2026',
    title: 'Chuẩn hóa cổng tài liệu 6 chương 3 cột & đồng bộ 10 biểu A1–D2',
    changes: [
      'Tách toàn bộ hướng dẫn theo 6 chương, 18 bài viết phục vụ 3 vai trò tại HCM-UTE.',
      'Bổ sung sơ đồ khối quy trình tương tác, xuất PDF A4 định danh và mục lục scroll-spy.',
      'Cập nhật quy trình gộp phiếu B1/B2_CT và kiểm tra chéo 6 chỉ tiêu K_KiemTra.'
    ]
  },
  {
    version: 'v1.5',
    date: '05/11/2026',
    title: 'Cập nhật luồng phiên bản phiếu công việc và đề xuất phối hợp',
    changes: [
      'Bổ sung quy trình nộp lại v2/v3, thu hồi phê duyệt và đối soát công việc phối hợp.',
      'Đồng bộ danh mục 39 đơn vị hoạt động và khung 38 vị trí việc làm chính thức.'
    ]
  },
  {
    version: 'v1.0',
    date: '20/10/2026',
    title: 'Ban hành tài liệu hướng dẫn VTVL 360 phiên bản đầu tiên',
    changes: [
      'Hướng dẫn đăng nhập @hcmute.edu.vn, kê khai phiếu cá nhân và thẩm định cấp trường.'
    ]
  }
];
