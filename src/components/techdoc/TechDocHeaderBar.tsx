'use client';

import React, { useState } from 'react';
import {
  Copy, Check, ChevronDown, Printer, History, PanelLeft, X, FileCode2
} from 'lucide-react';
import {
  TechDocArticleData,
  TECHDOC_CHANGELOG,
  TECHDOC_PORTAL_META
} from '@/configs/hcmute-techdoc-types';
import { formatTechDocMarkdown } from '@/configs/hcmute-techdoc-roles';

interface TechDocHeaderBarProps {
  article: TechDocArticleData;
  onOpenMobileSidebar: () => void;
  onExportPdf: () => void;
}

export function TechDocHeaderBar({
  article,
  onOpenMobileSidebar,
  onExportPdf
}: TechDocHeaderBarProps) {
  const [copiedMd, setCopiedMd] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(formatTechDocMarkdown(article));
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    } catch { /* ignore clipboard errors in headless environments */ }
  };

  return (
    <div className="space-y-4">
      {/* 1. Nhãn chương (Eyebrow) */}
      <div className="space-y-2">
        <p className="text-xs sm:text-[13px] font-semibold text-[#0072BC] leading-snug">
          {article.chapterLabel}
        </p>

        {/* 2. Tiêu đề H1 + mô tả ngắn (rgb(0, 71, 118), weight 644) */}
        <h1 className="!text-[22px] sm:!text-[26px] !leading-[1.28] ![font-weight:644] !text-[#004776] tracking-tight">
          {article.title}
        </h1>
        <p className="text-sm text-[#004776]/85 leading-relaxed">
          {article.description}
        </p>
      </div>

      {/* 3. Thanh DocumentMetaBar (viền mảnh trên và dưới) */}
      <div className="border-y border-[#e2e8f0] py-2.5 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e8fbf2] border border-[#bbf7d0] font-semibold text-[#13653f]">
            <span className="w-2 h-2 rounded-full bg-[#16a34a] shadow-[0_0_6px_rgba(22,163,74,0.85)] animate-pulse" />
            <span>{TECHDOC_PORTAL_META.status}</span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#eef6ff] border border-[#cfe3fb] font-semibold text-[#0072BC] tabular-nums">
            {TECHDOC_PORTAL_META.version}
          </span>
          <span className="text-[#476885]">
            Ngày cập nhật:{' '}
            <strong className="font-semibold text-[#004776]">{TECHDOC_PORTAL_META.updatedAt}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowChangelog(true)}
          className="inline-flex items-center gap-1.5 min-h-[34px] px-2.5 rounded-[8px] border border-[#dbe8f5] bg-[#f8fbff] hover:bg-[#eef6ff] text-xs font-semibold text-[#0072BC] cursor-pointer transition-colors"
        >
          <History className="w-3.5 h-3.5 shrink-0" />
          <span>Lịch sử thay đổi</span>
        </button>
      </div>

      {/* 4. Thanh công cụ hành động (Action bar) */}
      <div className="relative flex flex-wrap items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={() => void handleCopyMarkdown()}
          className="min-h-[38px] px-3 rounded-[9px] border border-[#cbd5e1] bg-white hover:bg-[#eef6ff] text-xs font-semibold text-[#004776] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedMd ? <Check className="w-3.5 h-3.5 text-[#13653f]" /> : <Copy className="w-3.5 h-3.5 text-[#0072BC]" />}
          <span>{copiedMd ? 'Đã sao chép Markdown' : 'Sao chép Markdown'}</span>
        </button>

        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((v) => !v)}
          className="min-h-[38px] px-3 rounded-[9px] border border-[#cbd5e1] bg-white hover:bg-[#eef6ff] text-xs font-semibold text-[#004776] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <FileCode2 className="w-3.5 h-3.5 text-[#0072BC]" />
          <span>Xem chi tiết</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>

        <button
          type="button"
          onClick={onExportPdf}
          className="min-h-[38px] px-3.5 rounded-[9px] bg-[#0072BC] hover:bg-[#005ea3] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Xuất PDF</span>
        </button>

        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="md:hidden min-h-[38px] px-3 rounded-[9px] border border-[#0072BC]/35 bg-[#f0f9ff] text-xs font-semibold text-[#0072BC] inline-flex items-center gap-1.5 cursor-pointer ml-auto"
        >
          <PanelLeft className="w-3.5 h-3.5" />
          <span>Tổng quan mục lục</span>
        </button>

        {showDetails && (
          <div className="w-full rounded-[12px] border border-[#dbe8f5] bg-[#f8fbff] p-3.5 text-xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-[#0072BC]">Thông tin tài liệu (MDX / LLMs chuẩn)</span>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="text-[#476885] hover:text-[#004776] font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[#004776]">
              <div><span className="text-[#476885]">Mã bài:</span> <strong>{article.id}</strong></div>
              <div><span className="text-[#476885]">Đường dẫn hệ thống:</span> <code>{article.quickAction.entryPath}</code></div>
              <div><span className="text-[#476885]">Đơn vị ban hành:</span> Phòng Tổ chức - Nhân sự</div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Lịch sử thay đổi phiên bản */}
      {showChangelog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Lịch sử thay đổi tài liệu"
          className="fixed inset-0 z-50 bg-[#004776]/40 backdrop-blur-[1px] flex items-center justify-center p-4 print:hidden"
          onClick={() => setShowChangelog(false)}
        >
          <div
            className="w-full max-w-lg rounded-[16px] bg-white border border-[#e2e8f0] shadow-xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0072BC]">Lịch sử thay đổi phiên bản</h3>
                <p className="text-xs text-[#476885]">{TECHDOC_PORTAL_META.issuer}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowChangelog(false)}
                aria-label="Đóng lịch sử thay đổi"
                className="min-w-[36px] min-h-[36px] rounded-lg border border-[#cbd5e1] text-[#004776] inline-flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-[#dbe8f5]">
              {TECHDOC_CHANGELOG.map((entry, idx) => (
                <div key={entry.version} className="relative space-y-1">
                  <span
                    className={`absolute -left-5 top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                      idx === 0 ? 'bg-[#0072BC] ring-4 ring-[#eef6ff]' : 'bg-[#94a3b8]'
                    }`}
                  />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-[#eef6ff] text-[#0072BC] font-bold">{entry.version}</span>
                    <span className="text-[#476885] font-medium">{entry.date}</span>
                    <span className="font-bold text-[#004776]">{entry.title}</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-xs text-[#20446c]">
                    {entry.changes.map((c, i) => (<li key={i}>{c}</li>))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
