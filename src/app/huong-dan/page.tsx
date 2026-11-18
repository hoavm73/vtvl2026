'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, Printer, Copy, Check, ArrowRight, CheckCircle2,
  AlertTriangle, FileSpreadsheet, Download, Layers, User, Building2, ShieldCheck
} from 'lucide-react';
import { HD07_OFFICIAL_DOCS } from '@/configs/hcmute-hd07-catalog';
import { TECHDOC_META, TECHDOC_ROLE_GUIDES, TechDocRoleId } from '@/configs/hcmute-techdoc-roles';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';

const ROLE_ICONS: Record<TechDocRoleId, React.ComponentType<{ className?: string }>> = {
  staff: User,
  unit_leader: Building2,
  admin: ShieldCheck
};

const FLOW_TONE_CLS = {
  main: 'bg-[#F0F9FF] border-[#0072BC] text-[#004776] hover:bg-[#e1f2ff]',
  decision: 'bg-[#FEF3C7] border-[#D97706] text-[#8f4f00] hover:bg-[#fde68a]/60',
  done: 'bg-[#F0FDF4] border-[#16A34A] text-[#13653f] hover:bg-[#dcfce7]'
} as const;

export default function HuongDanDonViPage() {
  const [selectedRole, setSelectedRole] = useState<TechDocRoleId>('staff');
  const [showAllRoles, setShowAllRoles] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const cur = getCurrentOperatorSession();
    if (cur?.role === 'admin' || cur?.role === 'unit_leader' || cur?.role === 'staff') {
      setSelectedRole(cur.role);
    }
  }, []);

  const visibleGuides = showAllRoles
    ? TECHDOC_ROLE_GUIDES
    : TECHDOC_ROLE_GUIDES.filter((g) => g.id === selectedRole);

  const handleCopySummary = async () => {
    const text = TECHDOC_ROLE_GUIDES.map(
      (g) => `${g.title}\n- Điều kiện: ${g.quickAction.prerequisite}\n${g.quickAction.coreSteps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`
    ).join('\n\n');
    try {
      await navigator.clipboard.writeText(`${TECHDOC_META.title} (${TECHDOC_META.version})\n\n${text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 lg:px-6 py-4 sm:py-6 space-y-5 text-[#004776] print:p-0 print:max-w-none print:space-y-4">
      {/* Tiêu ngữ hành chính chỉ hiển thị khi in PDF A4 */}
      <div className="hidden print:block border-b-2 border-[#004776] pb-3 mb-4 text-center space-y-0.5">
        <div className="text-xs font-medium uppercase">Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE) · Phòng Tổ chức - Nhân sự</div>
        <div className="text-base font-bold uppercase text-[#0072BC]">{TECHDOC_META.title}</div>
        <div className="text-[11px] text-[#476885]">Phiên bản {TECHDOC_META.version} · Ban hành ngày {TECHDOC_META.updatedAt}</div>
      </div>

      {/* Thanh tiêu đề & DocumentMetaBar */}
      <header className="bg-white rounded-[18px] border border-[#e2e8f0] p-4 sm:p-6 space-y-4 print:border-0 print:p-0">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e3f5ec] text-[#13653f] font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /><span>{TECHDOC_META.status}</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#eef5ff] text-[#0072BC] font-semibold">{TECHDOC_META.version}</span>
              <span className="text-[#476885]">Cập nhật: {TECHDOC_META.updatedAt}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0072BC] tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 shrink-0" /><span>{TECHDOC_META.title}</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#20446c] leading-relaxed">{TECHDOC_META.subtitle}</p>
            <p className="text-[11.5px] font-medium text-[#476885]">{TECHDOC_META.issuer}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
            <button
              type="button"
              onClick={() => setShowAllRoles((v) => !v)}
              className={`min-h-[44px] sm:min-h-[38px] px-3.5 rounded-[10px] border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                showAllRoles ? 'bg-[#0072BC] text-white border-[#0072BC]' : 'bg-white border-[#cbd5e1] text-[#004776] hover:bg-[#eef5ff]'
              }`}
            >
              <Layers className="w-4 h-4" /><span>{showAllRoles ? 'Xem 1 vai trò' : 'Xem tất cả 3 vai trò'}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleCopySummary()}
              className="min-h-[44px] sm:min-h-[38px] px-3.5 rounded-[10px] border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-[#13653f]" /> : <Copy className="w-4 h-4 text-[#0072BC]" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép tóm tắt'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[44px] sm:min-h-[38px] px-4 rounded-[10px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" /><span>In / Xuất PDF A4</span>
            </button>
          </div>
        </div>

        {/* Bộ chọn 3 vai trò */}
        <div role="tablist" aria-label="Chọn hướng dẫn theo vai trò" className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-[#e2e8f0] print:hidden">
          {TECHDOC_ROLE_GUIDES.map((g) => {
            const Icon = ROLE_ICONS[g.id];
            const isActive = !showAllRoles && selectedRole === g.id;
            return (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => { setShowAllRoles(false); setSelectedRole(g.id); }}
                className={`text-left min-h-[48px] p-3.5 rounded-[12px] border transition-all cursor-pointer flex items-start gap-3 ${
                  isActive
                    ? 'bg-[#eef6ff] border-[#0072BC] ring-1 ring-[#0072BC]/25'
                    : 'bg-[#f8fafc] border-[#e2e8f0] hover:bg-[#f0f7ff]'
                }`}
              >
                <span className={`w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 ${isActive ? 'bg-[#0072BC] text-white' : 'bg-white border border-[#dbe8f5] text-[#0072BC]'}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-xs sm:text-sm font-bold text-[#0072BC] leading-snug">{g.order}. {g.shortTitle}</span>
                  <span className="block text-[11px] font-medium text-[#476885]">{g.badge}</span>
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Nội dung TechDoc từng vai trò */}
      <div className="space-y-6">
        {visibleGuides.map((guide) => (
          <article key={guide.id} className="bg-white rounded-[18px] border border-[#e2e8f0] p-4 sm:p-6 space-y-6 print:border-[#cbd5e1] print:break-inside-avoid-page">
            {/* Tiêu đề vai trò */}
            <div className="border-b border-[#e2e8f0] pb-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#eef5ff] text-[#0072BC] text-[11px] font-semibold">{guide.badge}</span>
                <h2 className="text-lg sm:text-xl font-bold text-[#0072BC]">{guide.title}</h2>
                <p className="text-xs sm:text-sm text-[#20446c]">{guide.description}</p>
              </div>
              <span className="text-xs font-mono font-semibold text-[#476885] bg-[#f8fafc] border border-[#e2e8f0] px-2.5 py-1 rounded-lg self-start shrink-0">
                {guide.quickAction.entryPath}
              </span>
            </div>

            {/* Khối Callout Thao tác nhanh dành cho Quý Thầy/Cô */}
            <section aria-label="Thao tác nhanh" className="rounded-[14px] bg-[#F0F9FF] border border-[#0072BC]/35 p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[#0072BC]">Thao tác nhanh dành cho Quý Thầy/Cô</h3>
                <div className="flex flex-wrap gap-2 print:hidden">
                  <Link href={guide.quickAction.primaryHref} className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-[9px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold">
                    <span>{guide.quickAction.primaryLabel}</span><ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Link href={guide.quickAction.secondaryHref} className="inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-[9px] border border-[#0072BC]/35 bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776]">
                    <span>{guide.quickAction.secondaryLabel}</span>
                  </Link>
                </div>
              </div>
              <p className="text-xs text-[#20446c]"><strong>Điều kiện tiên quyết:</strong> {guide.quickAction.prerequisite}</p>
              <ol className="space-y-1.5 text-xs sm:text-[13px] text-[#004776] list-decimal pl-5 font-medium">
                {guide.quickAction.coreSteps.map((step, i) => (<li key={i}>{step}</li>))}
              </ol>
            </section>

            {/* Sơ đồ luồng tương tác chuẩn màu Mermaid HCM-UTE */}
            <section className="space-y-2.5">
              <h3 className="text-sm font-bold text-[#0072BC]">Sơ đồ luồng thực hiện (nhấp vào từng bước để mở nhanh)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                {guide.flowNodes.map((node) => (
                  <Link
                    key={node.id}
                    href={node.href}
                    className={`rounded-[12px] border p-3 transition-colors flex flex-col justify-between gap-1 ${FLOW_TONE_CLS[node.tone]}`}
                  >
                    <span className="text-xs font-bold leading-snug">{node.label}</span>
                    <span className="text-[11px] opacity-90">{node.sublabel}</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* Hướng dẫn chi tiết 3 tác vụ (Mục đích / Các bước / Kết quả / Lưu ý) */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-[#0072BC]">Quy trình thao tác chi tiết theo tác vụ</h3>
              <div className="divide-y divide-[#e2e8f0] border-y border-[#e2e8f0]">
                {guide.tasks.map((task) => (
                  <div key={task.number} className="py-4 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="text-sm sm:text-[15px] font-bold text-[#0072BC]">{task.title}</h4>
                      <Link href={task.actionHref} className="inline-flex items-center gap-1 text-xs font-semibold text-[#006cee] hover:underline shrink-0 print:hidden">
                        <span>{task.actionLabel}</span><ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs sm:text-[13px]">
                      <div className="lg:col-span-4 space-y-1.5">
                        <p><strong className="text-[#0072BC]">Mục đích:</strong> {task.purpose}</p>
                        <p><strong className="text-[#13653f]">Kết quả:</strong> {task.result}</p>
                        {task.note && (
                          <p className="rounded-lg bg-[#FEF3C7]/70 border border-[#D97706]/30 px-2.5 py-1.5 text-[#8f4f00]">
                            <strong>Lưu ý:</strong> {task.note}
                          </p>
                        )}
                      </div>
                      <div className="lg:col-span-8 rounded-[12px] bg-[#f8fafc] border border-[#e2e8f0] p-3">
                        <div className="font-bold text-[#004776] mb-1.5">Các bước thực hiện:</div>
                        <ol className="space-y-1 list-decimal pl-5 text-[#004776]">
                          {task.steps.map((s, idx) => (<li key={idx}>{s}</li>))}
                        </ol>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Các tình huống thường gặp và cách xử lý */}
            <section className="space-y-2.5">
              <h3 className="text-sm font-bold text-[#8f4f00] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" /><span>Các tình huống thường gặp và cách xử lý</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {guide.troubleshooting.map((item, idx) => (
                  <div key={idx} className="rounded-[12px] border border-[#e2e8f0] bg-[#fffaf0]/60 p-3.5 space-y-1 text-xs">
                    <div className="font-bold text-[#004776]">{item.situation}</div>
                    <p className="text-[#476885]"><strong>Nguyên nhân:</strong> {item.cause}</p>
                    <p className="text-[#13653f]"><strong>Cách xử lý:</strong> {item.solution}</p>
                  </div>
                ))}
              </div>
            </section>
          </article>
        ))}
      </div>

      {/* Kho tài liệu gốc Hướng dẫn 07-HD/BTCTW */}
      <section className="bg-white rounded-[18px] border border-[#e2e8f0] p-4 sm:p-5 space-y-3 print:hidden">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-[#0072BC]" />
          <h2 className="text-sm font-bold text-[#0072BC]">Tệp biểu mẫu gốc theo Hướng dẫn số 07-HD/BTCTW</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {HD07_OFFICIAL_DOCS.map((doc) => (
            <a key={doc.code} href={doc.href} download className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#eef5ff] p-3 flex items-center justify-between gap-2 transition-colors">
              <div className="min-w-0">
                <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-[#eef5ff] text-[#0072BC]">{doc.badge}</span>
                <span className="text-xs font-semibold text-[#004776] block mt-1 truncate">{doc.title}</span>
              </div>
              <Download className="w-4 h-4 text-[#0072BC] shrink-0" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
