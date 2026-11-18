'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronsDownUp, FileText, FolderOpen } from 'lucide-react';
import { TECHDOC_CHAPTERS, getDefaultDocIdForRole } from '@/configs/hcmute-techdoc-roles';

interface SidebarTechDocTreeProps {
  userRole?: string;
}

export function SidebarTechDocTree({ userRole }: SidebarTechDocTreeProps) {
  const pathname = usePathname();
  const [activeDocId, setActiveDocId] = useState<string>('');
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const syncActive = (ev?: Event) => {
      const custom = ev as CustomEvent<{ doc?: string }> | undefined;
      if (custom?.detail?.doc) {
        setActiveDocId(custom.detail.doc);
        const owner = TECHDOC_CHAPTERS.find((c) => c.articles.some((a) => a.id === custom.detail.doc));
        if (owner) setExpandedChapters((p) => ({ ...p, [owner.id]: true }));
        return;
      }
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/huong-dan')) {
        const paramDoc = new URLSearchParams(window.location.search).get('doc') || getDefaultDocIdForRole(userRole);
        setActiveDocId(paramDoc);
        const owner = TECHDOC_CHAPTERS.find((c) => c.articles.some((a) => a.id === paramDoc));
        if (owner) setExpandedChapters((p) => ({ ...p, [owner.id]: true }));
      } else {
        setActiveDocId('');
      }
    };

    syncActive();
    window.addEventListener('popstate', syncActive);
    window.addEventListener('vtvl-techdoc-changed', syncActive);
    return () => {
      window.removeEventListener('popstate', syncActive);
      window.removeEventListener('vtvl-techdoc-changed', syncActive);
    };
  }, [pathname, userRole]);

  const allExpanded = TECHDOC_CHAPTERS.every((c) => Boolean(expandedChapters[c.id]));

  const toggleAllChapters = () => {
    const nextVal = !allExpanded;
    const nextMap: Record<string, boolean> = {};
    for (const c of TECHDOC_CHAPTERS) nextMap[c.id] = nextVal;
    setExpandedChapters(nextMap);
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }));
  };

  return (
    <div
      data-testid="sidebar-techdoc-tree"
      className="ml-3 mt-1 pl-2 border-l border-[#dbe8f5] space-y-1 py-0.5"
    >
      <button
        type="button"
        onClick={toggleAllChapters}
        className="w-full px-2 py-1 rounded-md text-[11px] font-semibold text-[#0072BC] hover:bg-[#eef6ff] flex items-center justify-between gap-1.5 cursor-pointer transition-colors"
      >
        <span className="inline-flex items-center gap-1">
          <ChevronsDownUp className="w-3 h-3 shrink-0" />
          <span>{allExpanded ? 'Thu gọn chương' : 'Mở rộng tất cả'}</span>
        </span>
        <span className="text-[10.5px] text-[#476885] tabular-nums">6 chương</span>
      </button>

      {TECHDOC_CHAPTERS.map((ch) => {
        const isOpen = Boolean(expandedChapters[ch.id]);
        return (
          <div key={ch.id} className="space-y-0.5">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggleChapter(ch.id)}
              className="w-full px-2 py-1.5 rounded-lg hover:bg-[#f4f7fb] text-left flex items-center justify-between gap-1.5 cursor-pointer transition-colors"
            >
              <span className="flex items-start gap-1.5 min-w-0">
                <FolderOpen className="w-3.5 h-3.5 text-[#0072BC] mt-0.5 shrink-0" />
                <span className="text-[11.5px] font-semibold text-[#004776] leading-snug break-words">
                  {ch.title}
                </span>
              </span>
              <ChevronDown
                className={`w-3 h-3 text-[#476885] shrink-0 transition-transform duration-150 ${
                  isOpen ? 'rotate-0' : '-rotate-90'
                }`}
              />
            </button>

            {isOpen && (
              <div className="ml-2 pl-2 border-l border-[#e2ecf7] space-y-0.5">
                {ch.articles.map((art) => {
                  const isActive = pathname.startsWith('/huong-dan') && activeDocId === art.id;
                  return (
                    <Link
                      key={art.id}
                      href={`/huong-dan?doc=${encodeURIComponent(art.id)}`}
                      data-doc-id={art.id}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        setActiveDocId(art.id);
                        window.dispatchEvent(
                          new CustomEvent('vtvl-techdoc-changed', { detail: { doc: art.id } })
                        );
                      }}
                      className={`flex items-start gap-1.5 px-2 py-1.5 rounded-r-md border-l-2 -ml-[9px] pl-[10px] text-[11.5px] leading-[1.4] transition-colors ${
                        isActive
                          ? 'border-[#0072BC] bg-[#eef6ff] text-[#0072BC] font-semibold'
                          : 'border-transparent text-[#20446c] hover:bg-[#f8fafc] hover:text-[#0072BC]'
                      }`}
                    >
                      <FileText
                        className={`w-3 h-3 mt-0.5 shrink-0 ${
                          isActive ? 'text-[#0072BC]' : 'text-[#476885]'
                        }`}
                      />
                      <span className="break-words">{art.title}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
