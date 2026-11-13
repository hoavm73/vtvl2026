'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, CheckSquare, AlertTriangle, ArrowRight, Download, FileSpreadsheet, ListOrdered } from 'lucide-react';
import { InfoTip } from '@/components/layout/MilestonesBar';
import { HD07_12_STEP_ORDER, HD07_EIGHT_STEPS_PROCESS, HD07_OFFICIAL_DOCS } from '@/configs/hcmute-hd07-catalog';

const ROLE_CARDS = [
  {
    role: '1. Thủ trưởng đơn vị',
    sheets: 'A1 · C1 · C3 · D2',
    summary: 'Phê duyệt danh mục nhiệm vụ, tên VTVL cụ thể, bậc nghề nghiệp và ký Tờ trình gửi Phòng TCNS.',
    details: [
      'Phê duyệt danh mục nhiệm vụ (Biểu A1), Tên VTVL cụ thể tại đơn vị và Bậc nghề nghiệp theo Hướng dẫn số 02 (1907/HD-ĐHCNKT).',
      'Rà soát điều kiện chuyển tiếp đối với viên chức giữ chức danh Trợ giảng (V.07.01.23) theo khoản 5 Điều 15 Thông tư 31/2026/TT-BGDĐT.',
      'Thống nhất nhu cầu nhân lực năm cơ sở (Biểu C3) và ký Tờ trình đề nghị thẩm định.'
    ]
  },
  {
    role: '2. Tổ thư ký đơn vị',
    sheets: 'A2 · D1 · K_KiemTra · S_NhatKy',
    summary: 'Khởi tạo tệp gốc v1 (Giai đoạn 1–2), kê khai nhân sự D1, gộp phiếu khảo sát v2 (Giai đoạn 4) và thẩm định (Giai đoạn 5).',
    details: [
      'Khởi tạo bộ biểu gốc 22 trang tính (v1) và gói tệp nén (.zip) chứa phiếu khảo sát theo từng vị trí việc làm.',
      'Kê khai danh sách nhân sự hiện có của đơn vị chốt tại ngày 30/9/2026 trên biểu 9. D1_NhanLuc.',
      'Tổng hợp tự động các phiếu khảo sát (v1 → v2) và chạy kiểm tra chéo đạt 6/6 chỉ tiêu tại biểu 13. K_KiemTra.'
    ]
  },
  {
    role: '3. Giảng viên & Chuyên viên',
    sheets: 'B1 · B2_CT · C2',
    summary: 'Đo định mức thời gian (Giai đoạn 3), kê khai sản lượng năm học (Biểu B1) và công đoạn chuyển đổi số (Biểu B2_CT).',
    details: [
      'Thực hiện đo định mức thời gian xử lý công việc thực tế (Trung bình phút/sản phẩm) tại Giai đoạn 3 (/bam-gio).',
      'Kê khai sản lượng thực tế phát sinh trong kỳ 01/10/2025–30/9/2026 (Cột C biểu B1), ghi rõ nguồn xác thực (Cột H, I).',
      'Kê khai chi tiết các công đoạn đã ứng dụng chuyển đổi số tại biểu 5. B2_CT_TacDong.'
    ]
  }
];

const COMMON_PITFALLS = [
  { code: 'Lưu ý 1 (Biểu B1 - Cột H, I)', title: 'Chưa cập nhật nguồn văn bản xác thực sản lượng và thời gian', fix: 'Ghi rõ tên văn bản, báo cáo hoặc hệ thống quản trị thực tế của đơn vị.' },
  { code: 'Lưu ý 2 (Biểu B1 - Cột S)', title: 'Thời gian thực tế lệch trên 30% so với chuẩn nhưng chưa thuyết minh', fix: 'Nếu Trung bình phút/SP (Cột D) lệch trên 30% so với chuẩn, ghi rõ nguyên nhân đặc thù tại Cột S.' },
  { code: 'Lưu ý 3 (Phụ lục II HD 1907)', title: 'Đặt Tên VTVL cụ thể hoặc chọn Bậc nghề nghiệp vượt giới hạn', fix: 'Đặt tên theo công thức [Khung VTVL] + [lĩnh vực phụ trách / số thứ tự] và chọn bậc trong giới hạn quy định.' },
  { code: 'Lưu ý 4 (Biểu D1 - Cột A, E, F)', title: 'Kê khai trùng mã nguồn lực hoặc vượt quỹ giờ chuẩn năm', fix: 'Mỗi viên chức chỉ kê khai 1 dòng duy nhất tại biểu D1_NhanLuc; tổng giờ phân bổ không vượt quỹ giờ chuẩn.' }
];

export default function HuongDanDonViPage() {
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({ 1: true, 2: true });
  const [checklistMode, setChecklistMode] = useState<'8buoc' | '12buoc'>('8buoc');
  const toggleStep = (step: number) => setCheckedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  const totalSteps = checklistMode === '8buoc' ? 8 : 12;
  const completedCount = Object.entries(checkedSteps).filter(([k, v]) => Number(k) <= totalSteps && v).length;

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 lg:px-6 py-4 space-y-4">
      {/* KHỐI WORKSPACE CHÍNH */}
      <section className="bg-white rounded-xl border border-[var(--border)] p-4 sm:p-6 space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3.5">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--primary)] shrink-0" />
            <h1 className="text-xl sm:text-2xl font-semibold text-[var(--foreground)]">
              Quy trình 08 bước, 10 biểu HD 07-HD/BTCTW &amp; phân công đơn vị
            </h1>
            <InfoTip title="Thành phần hồ sơ trình Phòng TCNS">
              <p>1. Tệp dữ liệu đơn vị (.xlsx) gồm 10 biểu nghiệp vụ (A1–D2) đạt 6/6 chỉ tiêu tại K_KiemTra.</p>
              <p>2. Tờ trình đề nghị thẩm định đề án vị trí việc làm trình ký qua E-Office.</p>
            </InfoTip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/tai-ve/so-do-quy-trinh-vtvl-hcmute.png"
              download="so-do-quy-trinh-vtvl-hcmute.png"
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-[#cbd5e1] bg-white text-[var(--foreground)] text-xs font-medium hover:bg-[#f8fafc]"
            >
              <Download className="w-4 h-4 text-[var(--primary)]" />
              <span>Tải Sơ đồ quy trình (.png)</span>
            </a>
            <Link href="/tao-tep?step=1" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[var(--primary)] text-white text-xs font-semibold shadow-2xs">
              <span>Bắt đầu Giai đoạn 1</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 3 NHÓM PHÂN CÔNG VAI TRÒ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ROLE_CARDS.map((card) => (
            <div key={card.role} className="bg-[#f8fafc] rounded-lg p-3.5 space-y-1.5 border border-[var(--border-subtle)]">
              <div className="flex items-start justify-between gap-1">
                <h2 className="text-xs sm:text-sm font-semibold text-[var(--foreground)] leading-snug">{card.role}</h2>
                <InfoTip title="Nhiệm vụ chi tiết" align="right">
                  <ul className="list-disc pl-3.5 space-y-1">
                    {card.details.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </InfoTip>
              </div>
              <div className="text-[11px] font-medium text-[var(--primary)] bg-white px-2 py-0.5 rounded border border-[#e2e8f0]">
                {card.sheets}
              </div>
              <p className="text-xs text-[var(--ink-muted)] leading-relaxed">{card.summary}</p>
            </div>
          ))}
        </div>

        {/* TÀI LIỆU GỐC TẢI VỀ */}
        <div className="border-t border-[var(--border-subtle)] pt-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[var(--primary)]" />
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Bộ tài liệu gốc Hướng dẫn số 07-HD/BTCTW
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {HD07_OFFICIAL_DOCS.map((doc) => (
              <a
                key={doc.code}
                href={doc.href}
                download
                className="rounded-lg border border-[var(--border-subtle)] bg-white hover:bg-[#f8fafc] p-2.5 flex items-center justify-between gap-2 transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-tint)] text-[var(--primary)] mr-1">{doc.badge}</span>
                  <span className="text-xs font-medium text-[var(--foreground)] block mt-0.5 truncate">{doc.title}</span>
                </div>
                <Download className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
              </a>
            ))}
          </div>
        </div>

        {/* TIẾN TRÌNH & LƯU Ý KIỂM TRA CHÉO */}
        <div className="border-t border-[var(--border-subtle)] pt-3.5 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  {checklistMode === '8buoc' ? 'Quy trình 08 bước HD 07' : '12 bước nhập Excel'}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setChecklistMode('8buoc')}
                  className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer inline-flex items-center gap-1 ${checklistMode === '8buoc' ? 'bg-[var(--primary)] text-white' : 'bg-[#f1f5f9] text-[var(--foreground)]'}`}
                >
                  <ListOrdered className="w-3 h-3" />
                  <span>08 bước</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistMode('12buoc')}
                  className={`px-2 py-0.5 rounded text-xs font-medium cursor-pointer ${checklistMode === '12buoc' ? 'bg-[var(--primary)] text-white' : 'bg-[#f1f5f9] text-[var(--foreground)]'}`}
                >
                  <span>12 bước</span>
                </button>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--surface-tint)] text-[var(--primary)] tabular-nums">
                  {completedCount}/{totalSteps}
                </span>
              </div>
            </div>
            <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-[#f8fafc] max-h-72 overflow-y-auto">
              {checklistMode === '8buoc'
                ? HD07_EIGHT_STEPS_PROCESS.map((s) => {
                    const done = Boolean(checkedSteps[s.step]);
                    return (
                      <label
                        key={s.step}
                        onClick={() => toggleStep(s.step)}
                        className={`cursor-pointer px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                          done ? 'bg-[var(--ok-soft)]/25' : 'bg-white hover:bg-[#f8fafc]'
                        }`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <input type="checkbox" checked={done} onChange={() => {}} className="w-3.5 h-3.5 accent-[var(--primary)] mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-medium text-[var(--foreground)] block leading-snug">{s.title}</span>
                            <span className="text-[11px] text-[var(--primary)]">{s.sheets}</span>
                          </div>
                        </div>
                        <InfoTip title={s.title} align="right">
                          <p><strong>Kết quả:</strong> {s.result}</p>
                          <p className="mt-1"><strong>Điều kiện:</strong> {s.condition}</p>
                        </InfoTip>
                      </label>
                    );
                  })
                : HD07_12_STEP_ORDER.map((s) => {
                    const done = Boolean(checkedSteps[s.step]);
                    return (
                      <label
                        key={s.step}
                        onClick={() => toggleStep(s.step)}
                        className={`cursor-pointer px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                          done ? 'bg-[var(--ok-soft)]/25' : 'bg-white hover:bg-[#f8fafc]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <input type="checkbox" checked={done} onChange={() => {}} className="w-3.5 h-3.5 accent-[var(--primary)]" />
                          <span className="font-medium text-[var(--foreground)] shrink-0">Bước {s.step}:</span>
                          <span className="text-[var(--primary)] truncate">{s.sheet}</span>
                        </div>
                        <InfoTip title={`Bước ${s.step}: ${s.sheet}`} align="right">
                          <p>{s.title}</p>
                        </InfoTip>
                      </label>
                    );
                  })}
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[var(--warn)]" />
              <h2 className="text-sm font-semibold text-[var(--foreground)]">4 lưu ý quan trọng khi kiểm tra chéo</h2>
            </div>
            <div className="divide-y divide-[var(--border-subtle)] rounded-lg border border-[var(--border-subtle)] bg-white overflow-hidden">
              {COMMON_PITFALLS.map((err) => (
                <div key={err.code} className="p-3 flex items-start justify-between gap-2 hover:bg-[#f8fafc] transition-colors">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-semibold text-[var(--fix)] block">{err.code}</span>
                    <strong className="text-xs text-[var(--foreground)] font-medium block">{err.title}</strong>
                  </div>
                  <InfoTip title="Cách khắc phục" align="right">
                    <p>{err.fix}</p>
                  </InfoTip>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
