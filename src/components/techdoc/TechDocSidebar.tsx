'use client';

import React, { useMemo, useState } from 'react';
import {
  Search, ChevronDown, ChevronRight, FolderOpen, FileText,
  ChevronsDownUp, X, Layers
} from 'lucide-react';
import { TechDocChapter } from '@/configs/hcmute-techdoc-types';

interface TechDocSidebarProps {
  chapters: TechDocChapter[];
  activeDocId: string;
  activeChapterId: string;
  mobileOpen: boolean;
  onSelectArticle: (docId: string) => void;
  onCloseMobile: () => void;
}

export function TechDocSidebar({
  chapters,
  activeDocId,
  activeChapterId,
  mobileOpen,
  onSelectArticle,
  onCloseMobile
}: TechDocSidebarProps) {
  const [query, setQuery] = useState('');
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({
    [activeChapterId]: true
  });

  const normalizedQuery = query.trim().toLowerCase();
  const allExpanded = chapters.every((ch) => Boolean(expandedMap[ch.id]));

  const filteredChapters = useMemo(() => {
    if (!normalizedQuery) return chapters;
    return chapters
      .map((ch) => {
        const chapterMatch = ch.title.toLowerCase().includes(normalizedQuery);
        const matchedArticles = chapterMatch
          ? ch.articles
          : ch.articles.filter(
              (a) =>
                a.title.toLowerCase().includes(normalizedQuery) ||
                a.description.toLowerCase().includes(normalizedQuery)
            );
        return { ...ch, articles: matchedArticles };
      })
      .filter((ch) => ch.articles.length > 0);
  }, [chapters, normalizedQuery]);

  if (!mobileOpen) return null;

  const handleToggleAll = () => {
    const nextValue = !allExpanded;
    const next: Record<string, boolean> = {};
    for (const ch of chapters) next[ch.id] = nextValue;
    setExpandedMap(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden bg-[#004776]/35 backdrop-blur-[1px] flex print:hidden"
      onClick={onCloseMobile}
    >
      <aside
        aria-label="Mục lục chương hướng dẫn trên di động"
        className="w-[min(86vw,320px)] h-full bg-white border-r border-[#e2e8f0] p-4 flex flex-col gap-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
          <span className="text-xs font-bold text-[#0072BC]">Tổng quan mục lục</span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Đóng bảng mục lục"
            className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg border border-[#cbd5e1] text-[#004776] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SidebarOverviewBanner */}
        <div
          data-testid="sidebar-overview-banner"
          className="rounded-[12px] border border-[#dbe8f5] bg-gradient-to-br from-[#eef6ff] via-[#f6faff] to-white p-3 space-y-1"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0072BC] bg-white border border-[#cfe3fb] px-2 py-0.5 rounded-full">
              <Layers className="w-3 h-3 shrink-0" /><span>HCM-UTE VTVL 360</span>
            </span>
            <span className="text-[11px] font-semibold text-[#476885] tabular-nums">6 chương</span>
          </div>
          <div className="text-xs font-bold text-[#004776]">Sổ tay hướng dẫn nghiệp vụ</div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#476885] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm bài hướng dẫn..."
              aria-label="Tìm kiếm tài liệu hướng dẫn"
              className="w-full min-h-[38px] pl-8 pr-8 rounded-[10px] border border-[#cbd5e1] bg-white text-xs text-[#004776] outline-hidden focus:border-[#0072BC]"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Xóa từ khóa tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#476885] cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggleAll}
            className="w-full min-h-[36px] px-3 rounded-[9px] border border-[#dbe8f5] bg-[#f8fbff] hover:bg-[#eef6ff] text-xs font-semibold text-[#0072BC] flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5"><ChevronsDownUp className="w-3.5 h-3.5" /><span>{allExpanded ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}</span></span>
            <span className="text-[11px] text-[#476885] tabular-nums">18 bài</span>
          </button>
        </div>

        <nav aria-label="Cây thư mục tài liệu di động" className="flex-1 overflow-y-auto space-y-1.5">
          {filteredChapters.map((ch) => {
            const isOpen = Boolean(normalizedQuery) || (expandedMap[ch.id] ?? ch.id === activeChapterId);
            return (
              <div key={ch.id} className="space-y-0.5">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setExpandedMap((p) => ({ ...p, [ch.id]: !isOpen }))}
                  className="w-full min-h-[36px] px-2 py-1.5 rounded-[9px] hover:bg-[#f1f6fc] text-left flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <FolderOpen className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
                    <span className="text-xs font-bold text-[#004776] leading-snug break-words">{ch.title}</span>
                  </span>
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-[#476885] shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-[#476885] shrink-0" />}
                </button>
                {isOpen && (
                  <div className="ml-2.5 pl-2 border-l border-[#dbe8f5] space-y-0.5 py-0.5">
                    {ch.articles.map((art) => {
                      const isActive = art.id === activeDocId;
                      return (
                        <button
                          key={art.id}
                          type="button"
                          data-doc-id={art.id}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => { onSelectArticle(art.id); onCloseMobile(); }}
                          className={`w-full text-left px-2.5 py-2 rounded-r-[8px] border-l-2 -ml-[9px] pl-[10px] text-xs leading-[1.45] flex items-start gap-2 cursor-pointer ${
                            isActive ? 'border-[#0072BC] bg-[#eef6ff] text-[#0072BC] font-semibold' : 'border-transparent text-[#004776] hover:bg-[#f8fafc]'
                          }`}
                        >
                          <FileText className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? 'text-[#0072BC]' : 'text-[#476885]'}`} />
                          <span className="break-words">{art.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
