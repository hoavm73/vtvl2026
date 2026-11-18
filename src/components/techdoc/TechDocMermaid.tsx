'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ZoomIn, ZoomOut, Copy, Check, ArrowRight, ExternalLink } from 'lucide-react';
import { TechDocFlowNode } from '@/configs/hcmute-techdoc-types';

interface TechDocMermaidProps {
  caption: string;
  mermaidCode: string;
  flowNodes: TechDocFlowNode[];
  onSelectArticle: (docId: string) => void;
}

const NODE_STYLES: Record<TechDocFlowNode['tone'], { card: string; badge: string }> = {
  main: {
    card: 'bg-[#F0F9FF] border-[#0072BC] text-[#003D66] hover:bg-[#e1f2ff]',
    badge: 'bg-[#0072BC] text-white'
  },
  decision: {
    card: 'bg-[#FEF3C7] border-[#D97706] text-[#92400E] hover:bg-[#fde68a]/65',
    badge: 'bg-[#D97706] text-white'
  },
  done: {
    card: 'bg-[#F0FDF4] border-[#16A34A] text-[#15803D] hover:bg-[#dcfce7]',
    badge: 'bg-[#16A34A] text-white'
  }
};

export function TechDocMermaid({
  caption,
  mermaidCode,
  flowNodes,
  onSelectArticle
}: TechDocMermaidProps) {
  const [zoom, setZoom] = useState(100);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(mermaidCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <div className="rounded-[14px] border border-[#dbe8f5] bg-[#F8FAFC] p-3.5 sm:p-4 space-y-3">
      {/* Thanh điều khiển sơ đồ */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] pb-2.5">
        <span className="text-xs font-bold text-[#0072BC]">{caption}</span>
        <div className="flex items-center gap-1.5 print:hidden">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(70, z - 15))}
            aria-label="Thu nhỏ sơ đồ"
            className="min-w-[30px] min-h-[30px] rounded-md border border-[#cbd5e1] bg-white text-[#004776] inline-flex items-center justify-center cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-semibold text-[#476885] tabular-nums w-10 text-center">
            {zoom}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(130, z + 15))}
            aria-label="Phóng to sơ đồ"
            className="min-w-[30px] min-h-[30px] rounded-md border border-[#cbd5e1] bg-white text-[#004776] inline-flex items-center justify-center cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void handleCopyCode()}
            className="min-h-[30px] px-2.5 rounded-md border border-[#cbd5e1] bg-white hover:bg-[#eef6ff] text-[11px] font-semibold text-[#004776] inline-flex items-center gap-1 cursor-pointer"
          >
            {copiedCode ? <Check className="w-3 h-3 text-[#15803D]" /> : <Copy className="w-3 h-3 text-[#0072BC]" />}
            <span>{copiedCode ? 'Đã chép mã' : 'Sao chép mã'}</span>
          </button>
        </div>
      </div>

      {/* Các khối sơ đồ tương tác (bấm vào khối để chuyển bài hướng dẫn tương ứng) */}
      <div className="overflow-x-auto pb-1">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 min-w-0 transition-transform duration-150"
        >
          {flowNodes.map((node, index) => {
            const palette = NODE_STYLES[node.tone];
            const isLast = index === flowNodes.length - 1;
            return (
              <div key={node.id} className="relative flex items-stretch gap-1.5">
                <div className={`flex-1 rounded-[12px] border p-3 flex flex-col justify-between gap-2 transition-colors ${palette.card}`}>
                  <button
                    type="button"
                    onClick={() => onSelectArticle(node.targetDocId)}
                    className="text-left space-y-1 cursor-pointer focus:outline-none"
                    title={`Mở bài hướng dẫn ${node.targetDocId}`}
                  >
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${palette.badge}`}>
                      Mục {node.targetDocId}
                    </span>
                    <div className="text-xs font-bold leading-snug">{node.label}</div>
                    <div className="text-[11px] opacity-90">{node.sublabel}</div>
                  </button>

                  {node.systemHref && (
                    <Link
                      href={node.systemHref}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold underline-offset-2 hover:underline print:hidden"
                    >
                      <span>Mở tính năng</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </Link>
                  )}
                </div>

                {!isLast && (
                  <div aria-hidden="true" className="hidden lg:flex items-center text-[#0072BC] shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Nguồn Mermaid flowchart TD thu gọn */}
      <details className="text-[11px] text-[#476885] print:hidden">
        <summary className="cursor-pointer font-semibold hover:text-[#0072BC]">
          Xem mã sơ đồ Mermaid (flowchart TD)
        </summary>
        <pre className="mt-2 p-2.5 rounded-lg bg-white border border-[#e2e8f0] text-[11px] font-mono text-[#004776] overflow-x-auto">
          {mermaidCode}
        </pre>
      </details>
    </div>
  );
}
