'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet, QrCode, Timer, GitMerge, CheckSquare,
  BookOpen, ExternalLink, ChevronDown, ChevronUp, FileText, ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

const VTVL_FIVE_STEPS = [
  {
    step: 1,
    title: 'Khởi tạo tệp đơn vị',
    sheets: '1. A1_NhiemVu · 2. A2_CongViec',
    icon: FileSpreadsheet,
    desc: 'Nạp chức năng, nhiệm vụ chuẩn hóa từ Quyết định số 2266/QĐ-ĐHCNKT (28 Phụ lục) của 51 đơn vị, phân rã công việc và gán mã chuẩn [MÃ_ĐV].NVxx.',
    href: '/bang-tinh?sheet=A1',
    color: 'from-blue-600 to-sky-600'
  },
  {
    step: 2,
    title: 'Phát phiếu khảo sát & Mã QR',
    sheets: '5. B2_CT_TacDong · Mã QR',
    icon: QrCode,
    desc: 'Tạo mã QR và liên kết trực tuyến cho từng vị trí việc làm. Cán bộ – giảng viên quét mã để mở phiếu cá nhân trên điện thoại hoặc máy tính.',
    href: '/phieu-cong-viec',
    color: 'from-sky-600 to-cyan-600'
  },
  {
    step: 3,
    title: 'Bấm giờ đo định mức thời gian',
    sheets: '11. DM_SAN_PHAM · Bấm giờ',
    icon: Timer,
    desc: 'Sử dụng đồng hồ bấm giờ tích hợp để đo đạc thời gian thực hiện công việc thực tế, đối chiếu định mức phút chuẩn (SP-I đến SP-VI).',
    href: '/bam-gio',
    color: 'from-teal-600 to-emerald-600'
  },
  {
    step: 4,
    title: 'Nạp & Gộp phiếu công việc cá nhân',
    sheets: '4. B1_KhoiLuong · 6. B2_ThayDoi',
    icon: GitMerge,
    desc: 'Tổng hợp số lượng sản phẩm/năm, tính tổng giờ công việc tại Biểu B1 và lượng hóa biến động giờ do chuyển đổi số tại Biểu B2.',
    href: '/bang-tinh?sheet=B1',
    color: 'from-amber-600 to-orange-600'
  },
  {
    step: 5,
    title: 'Thẩm định 15 biểu & Hoàn tất đề án',
    sheets: '8. C3 · 10. D2 · 13. K_KiemTra',
    icon: CheckSquare,
    desc: 'Xác định số người cần thiết (FTE), lập phương án biên chế 5 năm 2026–2030, kiểm tra chéo 6 chỉ tiêu đạt chuẩn và xuất tệp nộp về Phòng TCNS.',
    href: '/ra-soat',
    color: 'from-emerald-600 to-green-700'
  }
];

const LEGAL_DOCUMENTS = [
  {
    code: 'Hướng dẫn 07-HD/BTCTW',
    date: '15/12/2023',
    issuer: 'Ban Tổ chức Trung ương',
    title: 'Hướng dẫn xây dựng vị trí việc làm trong cơ quan, tổ chức hành chính, đơn vị sự nghiệp công lập',
    highlight: 'Căn cứ nền tảng của hệ thống 10 biểu mẫu chuẩn A1, A2, B1, B2, C1, C2, C3, D1, D2, K_KiemTra.'
  },
  {
    code: 'Nghị định 232/2026/NĐ-CP',
    date: '02/2026',
    issuer: 'Chính phủ',
    title: 'Nghị định quy định về vị trí việc làm và cơ cấu viên chức theo chức danh nghề nghiệp',
    highlight: 'Khung 38 vị trí việc làm chia 04 nhóm: Lãnh đạo quản lý, Chuyên môn dùng chung, Chuyên môn dùng riêng, Hỗ trợ phục vụ.'
  },
  {
    code: 'Thông tư 31/2026/TT-BGDĐT',
    date: '14/4/2026',
    issuer: 'Bộ Giáo dục và Đào tạo',
    title: 'Quy định tiêu chuẩn chức danh nghề nghiệp và định mức giờ làm việc đối với nhà giáo trong cơ sở giáo dục đại học',
    highlight: 'Định mức 1.904 giờ chuẩn/năm, chế độ làm việc 40 giờ/tuần và khung năng lực Bậc 1 đến Bậc 5.'
  },
  {
    code: 'Quyết định 2266/QĐ-ĐHCNKT',
    date: '23/6/2026',
    issuer: 'Trường ĐH Công nghệ Kỹ thuật TP.HCM',
    title: 'Quy định chức năng, nhiệm vụ của 51 đơn vị thuộc và trực thuộc Trường (28 Phụ lục)',
    highlight: 'Nguồn chuẩn hóa tự động danh mục nhiệm vụ A1 và phân rã công việc A2 cho từng đơn vị.'
  },
  {
    code: 'Hướng dẫn 02 (1907/HD-ĐHCNKT)',
    date: '17/6/2026',
    issuer: 'Ban Giám hiệu HCM-UTE',
    title: 'Hướng dẫn triển khai xây dựng Đề án Vị trí việc làm và cơ cấu viên chức giai đoạn 2026–2030',
    highlight: 'Kế hoạch hành động, phân công trách nhiệm của Lãnh đạo đơn vị và lộ trình thẩm định tại Trường.'
  }
];

export function OverviewProcessAndLegal() {
  const [legalOpen, setLegalOpen] = useState(true);

  return (
    <div className="space-y-6">
      {/* 1. Giới thiệu quy trình 5 bước */}
      <section className="bg-white rounded-3xl border border-[#d8e3ef] p-4 sm:p-7 shadow-[0_4px_20px_-4px_rgba(0,71,118,0.06)] space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2ecf7] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="slink">Chu trình 5 bước</Badge>
              <h2 className="text-lg sm:text-xl font-bold text-[#004776]">
                Quy trình lập đề án Vị trí việc làm 360
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#476885] mt-1 font-medium">
              Chu trình khép kín từ nạp chức năng nhiệm vụ đến thẩm định 15 biểu theo Hướng dẫn 07-HD/BTCTW
            </p>
          </div>
          <Link
            href="/huong-dan"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0072BC] hover:underline self-start sm:self-center"
          >
            <span>Xem tài liệu hướng dẫn chi tiết</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {VTVL_FIVE_STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="group relative rounded-2xl border border-[#d8e3ef] p-4 bg-gradient-to-b from-[#fafcff] to-white hover:border-[#004776]/40 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className={`w-8 h-8 rounded-xl bg-gradient-to-br ${s.color} text-white text-xs font-extrabold flex items-center justify-center shadow-xs`}>
                      {s.step}
                    </span>
                    <span className="text-[11px] font-bold text-[#476885]">Bước {s.step}</span>
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#004776] leading-snug group-hover:text-[#0072BC] transition-colors">
                      {s.title}
                    </h3>
                    <p className="text-[11px] font-semibold text-[#0072BC] mt-0.5">{s.sheets}</p>
                  </div>
                  <p className="text-[11.5px] text-[#476885] leading-relaxed line-clamp-4">
                    {s.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#edf3f9] mt-3">
                  <Link
                    href={s.href}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#004776] hover:text-[#0072BC] transition-colors"
                  >
                    <span>Mở thao tác</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Căn cứ pháp lý & Văn bản hướng dẫn */}
      <section className="bg-white rounded-3xl border border-[#d8e3ef] p-4 sm:p-7 shadow-[0_4px_20px_-4px_rgba(0,71,118,0.06)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#eef6ff] text-[#004776] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#004776]">
                Hệ thống văn bản chỉ đạo &amp; Căn cứ pháp lý
              </h2>
              <p className="text-xs text-[#476885] font-medium">
                Khung pháp lý bắt buộc áp dụng cho toàn bộ 51 đơn vị tại HCM-UTE
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLegalOpen(!legalOpen)}
            className="text-xs font-bold text-[#004776] hover:bg-[#f0f7fd] px-3 py-1.5 rounded-lg border border-[#d8e3ef] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>{legalOpen ? 'Thu gọn' : 'Xem toàn bộ'}</span>
            {legalOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {legalOpen && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
            {LEGAL_DOCUMENTS.map((doc, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-[#f8fbff] border border-[#dbe8f5] hover:border-[#0072BC]/40 space-y-2 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-xs text-[#004776] inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
                    <span>{doc.code}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-[#476885] shrink-0 bg-white px-2 py-0.5 rounded-md border border-[#e2ecf7]">
                    {doc.date}
                  </span>
                </div>
                <div className="text-xs font-bold text-[#004776] leading-snug">
                  {doc.title}
                </div>
                <div className="text-[11px] font-medium text-[#476885]">
                  Cơ quan ban hành: <strong className="text-[#004776]">{doc.issuer}</strong>
                </div>
                <div className="p-2 rounded-xl bg-white text-[11px] text-[#20446c] border border-[#e2ecf7] leading-relaxed">
                  {doc.highlight}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
