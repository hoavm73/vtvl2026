'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, AlertTriangle, Download, FileSpreadsheet } from 'lucide-react';
import { HD07_OFFICIAL_DOCS } from '@/configs/hcmute-hd07-catalog';
import { TechDocArticleData, TECHDOC_PORTAL_META } from '@/configs/hcmute-techdoc-types';
import { TechDocHeaderBar } from './TechDocHeaderBar';
import { TechDocMermaid } from './TechDocMermaid';

interface TechDocArticleProps {
  article: TechDocArticleData;
  prevArticle: TechDocArticleData | null;
  nextArticle: TechDocArticleData | null;
  userEmail: string;
  onSelectArticle: (docId: string) => void;
  onOpenMobileSidebar: () => void;
}

export function TechDocArticle({
  article,
  prevArticle,
  nextArticle,
  userEmail,
  onSelectArticle,
  onOpenMobileSidebar
}: TechDocArticleProps) {
  return (
    <div className="flex-1 min-w-0">
      {/* Watermark HCM-UTE mờ 10% khi xuất PDF A4 */}
      <div
        aria-hidden="true"
        className="pdf-watermark-overlay hidden print:flex fixed inset-0 pointer-events-none items-center justify-center z-0 opacity-10 -rotate-45 select-none"
      >
        <span className="text-[76px] font-black tracking-widest text-[#0072BC]">HCM-UTE</span>
      </div>

      {/* Tiêu ngữ hành chính chỉ hiển thị khi in PDF A4 */}
      <div className="hidden print:block border-b-2 border-[#004776] pb-3 mb-4 text-center space-y-0.5 relative z-10">
        <div className="text-xs font-medium uppercase text-[#004776]">
          Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE) · Phòng Tổ chức - Nhân sự
        </div>
        <div className="text-base font-bold uppercase text-[#0072BC]">{TECHDOC_PORTAL_META.title}</div>
        <div className="text-[11px] text-[#476885]">
          Phiên bản {TECHDOC_PORTAL_META.version} · Cập nhật ngày {TECHDOC_PORTAL_META.updatedAt}
        </div>
      </div>

      <article className="relative z-10 bg-white rounded-[16px] border border-[#e2e8f0] p-4 sm:p-6 lg:p-7 space-y-6 print:border-0 print:p-0 print:bg-transparent">
        <TechDocHeaderBar
          article={article}
          onOpenMobileSidebar={onOpenMobileSidebar}
          onExportPdf={() => window.print()}
        />

        {/* Nội dung bài viết dùng cho Mục lục (#nd-toc) quét H2 và H3 */}
        <div id="techdoc-article-content" className="space-y-7 text-[#004776]">
          <p className="text-sm sm:text-[15px] text-[#004776] leading-[1.65]">{article.intro}</p>

          {/* Khối Callout Thao tác nhanh (Dành cho Thầy/Cô) */}
          <section
            aria-label="Thao tác nhanh"
            className="rounded-[12px] border border-[#cfe3fb] border-l-4 border-l-[#0072BC] bg-[#F0F9FF] p-4 sm:p-5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="w-5 h-5 rounded-full bg-[#0072BC] text-white inline-flex items-center justify-center text-xs font-bold shrink-0">
                  i
                </span>
                <span className="text-sm font-bold text-[#004776]">Thao tác nhanh (Dành cho Thầy/Cô)</span>
              </div>
              <span className="text-[11px] font-mono font-semibold text-[#0072BC] bg-white border border-[#cfe3fb] px-2 py-0.5 rounded-md">
                {article.quickAction.entryPath}
              </span>
            </div>

            <p className="text-xs sm:text-[13px] text-[#004776]">
              <strong>Điều kiện tiên quyết:</strong> {article.quickAction.prerequisite}
            </p>
            <ol className="space-y-1.5 list-decimal pl-5 text-xs sm:text-[13.5px] text-[#004776] font-medium">
              {article.quickAction.coreSteps.map((step, i) => (<li key={i}>{step}</li>))}
            </ol>

            <div className="flex flex-wrap gap-2 pt-1 print:hidden">
              <Link
                href={article.quickAction.primaryHref}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-[9px] bg-[#0072BC] hover:bg-[#005ea3] text-white text-xs font-semibold transition-colors"
              >
                <span>{article.quickAction.primaryLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              {article.quickAction.secondaryHref && article.quickAction.secondaryLabel && (
                <Link
                  href={article.quickAction.secondaryHref}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-[9px] border border-[#0072BC]/35 bg-white hover:bg-[#eef6ff] text-xs font-semibold text-[#004776] transition-colors"
                >
                  <span>{article.quickAction.secondaryLabel}</span>
                </Link>
              )}
            </div>
          </section>

          {/* Các đề mục tác vụ chi tiết (H2 -> H3) */}
          {article.tasks.map((task) => {
            const baseId = `sec-tac-vu-${task.number}`;
            return (
              <section key={task.number} className="space-y-3 pt-2 border-t border-[#e2e8f0]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id={baseId} className="scroll-mt-24 text-base sm:text-lg font-bold !text-[#004776] leading-snug">
                    {task.title}
                  </h2>
                  <Link href={task.actionHref} className="inline-flex items-center gap-1 text-xs font-semibold text-[#0072BC] hover:underline print:hidden">
                    <span>{task.actionLabel}</span><ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-2.5 pl-1">
                  <h3 id={`${baseId}-muc-dich`} className="scroll-mt-24 text-sm font-bold !text-[#0072BC]">Mục đích</h3>
                  <p className="text-xs sm:text-sm text-[#004776] leading-relaxed">{task.purpose}</p>

                  <h3 id={`${baseId}-buoc`} className="scroll-mt-24 text-sm font-bold !text-[#0072BC] pt-1">Các bước thực hiện</h3>
                  <ol className="relative pl-6 space-y-2.5 before:content-[''] before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-[#cfe3fb]">
                    {task.steps.map((step, sIdx) => (
                      <li key={sIdx} className="relative text-xs sm:text-sm text-[#004776] leading-relaxed">
                        <span className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-[#0072BC] text-white text-[11px] font-bold inline-flex items-center justify-center">
                          {sIdx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>

                  <h3 id={`${baseId}-ket-qua`} className="scroll-mt-24 text-sm font-bold !text-[#0072BC] pt-1">Kết quả</h3>
                  <p className="text-xs sm:text-sm text-[#13653f] bg-[#f0fdf4] border border-[#bbf7d0] rounded-[10px] px-3.5 py-2.5">
                    {task.result}
                  </p>

                  {task.note && (
                    <>
                      <h3 id={`${baseId}-luu-y`} className="scroll-mt-24 text-sm font-bold !text-[#8f4f00] pt-1">Lưu ý</h3>
                      <p className="text-xs sm:text-sm text-[#8f4f00] bg-[#FEF3C7]/70 border border-[#D97706]/30 rounded-[10px] px-3.5 py-2.5">
                        {task.note}
                      </p>
                    </>
                  )}
                </div>
              </section>
            );
          })}

          {/* Sơ đồ khối tương tác Mermaid */}
          <section className="space-y-3 pt-2 border-t border-[#e2e8f0]">
            <h2 id="sec-so-do-nghiep-vu" className="scroll-mt-24 text-base sm:text-lg font-bold !text-[#004776]">
              Sơ đồ quy trình nghiệp vụ
            </h2>
            <TechDocMermaid
              caption={article.diagramCaption}
              mermaidCode={article.mermaidCode}
              flowNodes={article.flowNodes}
              onSelectArticle={onSelectArticle}
            />
          </section>

          {/* Kho tệp biểu mẫu gốc Hướng dẫn 07 (bật ở mục 5.2) */}
          {article.showOfficialForms && (
            <section className="space-y-3 pt-2 border-t border-[#e2e8f0] print:hidden">
              <h2 id="sec-bieu-mau-goc" className="scroll-mt-24 text-base sm:text-lg font-bold !text-[#004776] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#0072BC]" />
                <span>Danh mục tệp biểu mẫu gốc theo Hướng dẫn số 07-HD/BTCTW</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {HD07_OFFICIAL_DOCS.map((doc) => (
                  <a key={doc.code} href={doc.href} download className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#eef6ff] p-3 flex items-center justify-between gap-2 transition-colors">
                    <div className="min-w-0">
                      <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-[#eef6ff] text-[#0072BC]">{doc.badge}</span>
                      <span className="text-xs font-semibold text-[#004776] block mt-1 truncate">{doc.title}</span>
                    </div>
                    <Download className="w-4 h-4 text-[#0072BC] shrink-0" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Mục cuối bài bắt buộc: Các tình huống thường gặp và cách xử lý */}
          <section className="space-y-3 pt-2 border-t border-[#e2e8f0]">
            <h2 id="sec-tinh-huong-thuong-gap" className="scroll-mt-24 text-base sm:text-lg font-bold !text-[#004776] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#ED1C24] shrink-0" />
              <span>⚠️ Các tình huống thường gặp và cách xử lý</span>
            </h2>
            <div className="space-y-3">
              {article.troubleshooting.map((item, idx) => (
                <div key={idx} className="rounded-[12px] border border-[#e2e8f0] bg-[#fffaf0]/65 p-3.5 sm:p-4 space-y-1.5">
                  <h3 id={`sec-tinh-huong-${idx + 1}`} className="scroll-mt-24 text-sm font-bold !text-[#004776]">{item.situation}</h3>
                  <p className="text-xs sm:text-[13px] text-[#476885]"><strong>Nguyên nhân:</strong> {item.cause}</p>
                  <p className="text-xs sm:text-[13px] text-[#13653f]"><strong>Cách xử lý:</strong> {item.solution}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Điều hướng bài trước / tiếp theo */}
        <div className="pt-4 border-t border-[#e2e8f0] grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
          {prevArticle ? (
            <button type="button" onClick={() => onSelectArticle(prevArticle.id)} className="text-left p-3 rounded-[12px] border border-[#e2e8f0] hover:border-[#0072BC] hover:bg-[#f8fbff] cursor-pointer transition-colors">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#476885]"><ArrowLeft className="w-3 h-3" /><span>Bài trước</span></span>
              <span className="block text-xs sm:text-[13px] font-bold text-[#0072BC] mt-0.5">{prevArticle.title}</span>
            </button>
          ) : (<div />)}
          {nextArticle && (
            <button type="button" onClick={() => onSelectArticle(nextArticle.id)} className="text-right p-3 rounded-[12px] border border-[#e2e8f0] hover:border-[#0072BC] hover:bg-[#f8fbff] cursor-pointer transition-colors">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#476885]"><span>Bài tiếp theo</span><ArrowRight className="w-3 h-3" /></span>
              <span className="block text-xs sm:text-[13px] font-bold text-[#0072BC] mt-0.5">{nextArticle.title}</span>
            </button>
          )}
        </div>

        {/* Khối chứng thực & chân trang in A4 */}
        <div className="pdf-signature-block hidden print:grid grid-cols-2 gap-6 pt-6 mt-6 border-t border-[#cbd5e1] text-xs text-[#004776]">
          <div>
            <div className="font-bold">Đơn vị ban hành chuyên môn</div>
            <div>Phòng Tổ chức - Nhân sự (HCM-UTE)</div>
            <div className="text-[11px] text-[#476885] mt-1">Email: tcns@hcmute.edu.vn</div>
          </div>
          <div className="text-right">
            <div className="font-bold">Xác thực tài liệu tra cứu điện tử</div>
            <div>Người xuất bản in: {userEmail}</div>
            <div className="text-[11px] text-[#476885] mt-1">Phiên bản {TECHDOC_PORTAL_META.version} · {TECHDOC_PORTAL_META.updatedAt}</div>
          </div>
        </div>
      </article>

      <div className="pdf-running-footer hidden print:flex items-center justify-between border-t border-[#cbd5e1] pt-2 mt-4 text-[10.5px] text-[#476885]">
        <span>HCM-UTE VTVL 360 · {article.title}</span>
        <span>Định danh xuất bản in: {userEmail}</span>
      </div>
    </div>
  );
}
