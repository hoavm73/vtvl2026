export interface GuideVideoItem {
  id: string;
  orderLabel: string;
  title: string;
  duration: string;
  audience: 'Lãnh đạo đơn vị' | 'Cán bộ, giảng viên';
  description: string;
  src: string;
  articleIds: string[];
  relatedHref: string;
  relatedLabel: string;
}

export const HCMUTE_GUIDE_VIDEOS: GuideVideoItem[] = [
  {
    id: 'vtvl-01-lanh-dao-a1-c1',
    orderLabel: '01',
    title: 'Lãnh đạo kê khai A1 và C1',
    duration: '1 phút 51 giây',
    audience: 'Lãnh đạo đơn vị',
    description:
      'Hướng dẫn hai cách nhập A1, xử lý dòng Excel trùng và khai danh mục vị trí việc làm ở C1.',
    src: '/videos/VTVL-01-Lanh-dao-khai-A1-C1-1.5x.mp4',
    articleIds: ['1.4', '3.2', '4.2'],
    relatedHref: '/nghiep-vu-don-vi',
    relatedLabel: 'Mở Bảng tính đơn vị (A1 & C1)'
  },
  {
    id: 'vtvl-02-can-bo-ke-khai',
    orderLabel: '02',
    title: 'Cán bộ, giảng viên kê khai phiếu khảo sát',
    duration: '1 phút 13 giây',
    audience: 'Cán bộ, giảng viên',
    description:
      'Người kê khai chọn mã nhiệm vụ A1 và mã VTVL C1 có sẵn của đơn vị, phù hợp với công việc đang khai. Tiếp đó là cách tham khảo đề xuất phối hợp, nộp phiếu và chỉnh sửa theo phản hồi.',
    src: '/videos/VTVL-02-Can-bo-giang-vien-ke-khai-1.5x.mp4',
    articleIds: ['1.4', '2.1', '2.3'],
    relatedHref: '/phieu-cong-viec',
    relatedLabel: 'Mở Phiếu công việc cá nhân'
  },
  {
    id: 'vtvl-03-lanh-dao-quan-ly-phieu',
    orderLabel: '03',
    title: 'Lãnh đạo tiếp nhận và quản lý phiếu',
    duration: '32 giây',
    audience: 'Lãnh đạo đơn vị',
    description:
      'Phần cuối minh họa kết quả sau khi duyệt: công việc được ghi vào A2_CongViec, kèm mã nhiệm vụ A1 và mã VTVL C1 tương ứng. Sản lượng và thời gian được liên kết ở B1 để đơn vị tổng hợp khối lượng công việc theo từng vị trí việc làm.',
    src: '/videos/VTVL-03-Lanh-dao-quan-ly-phieu-1.5x.mp4',
    articleIds: ['1.4', '3.1', '3.3'],
    relatedHref: '/phieu-don-vi',
    relatedLabel: 'Mở Quản lý phiếu đơn vị'
  }
];

export function getGuideVideosForArticle(articleId: string): GuideVideoItem[] {
  return HCMUTE_GUIDE_VIDEOS.filter((v) => v.articleIds.includes(articleId));
}
