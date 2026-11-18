'use client';

import React, { useEffect, useState } from 'react';
import { AlignLeft } from 'lucide-react';
import { TechDocTocItem } from '@/configs/hcmute-techdoc-types';

interface TechDocTocProps {
  articleId: string;
}

export function TechDocToc({ articleId }: TechDocTocProps) {
  const [items, setItems] = useState<TechDocTocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const container = document.getElementById('techdoc-article-content');
      if (!container) return;
      const headings = Array.from(container.querySelectorAll('h2, h3')) as HTMLElement[];
      const extracted: TechDocTocItem[] = headings
        .filter((el) => Boolean(el.id))
        .map((el) => ({
          id: el.id,
          text: el.textContent?.trim() || '',
          level: el.tagName === 'H3' ? 3 : 2
        }));
      setItems(extracted);
      setActiveId(extracted[0]?.id || '');
    });
    return () => cancelAnimationFrame(raf);
  }, [articleId]);

  useEffect(() => {
    if (items.length === 0) return;

    const handleScroll = () => {
      const offset = 136;
      let current = items[0]?.id || '';
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= offset) {
          current = item.id;
        }
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 24) {
        current = items[items.length - 1]?.id || current;
      }
      setActiveId(current);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [items]);

  const handleJump = (id: string) => {
    setActiveId(id);
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <aside
      id="nd-toc"
      aria-label="Mục lục bài viết"
      className="hidden xl:block w-[268px] shrink-0 self-start sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto print:hidden"
    >
      <div className="bg-white rounded-[16px] border border-[#e2e8f0] p-4 space-y-3">
        <div className="flex items-center gap-2 text-[#004776]">
          <AlignLeft className="w-4 h-4 shrink-0" />
          <span className="text-[13px] font-semibold whitespace-nowrap">Mục lục bài viết</span>
        </div>

        <nav aria-label="Điều hướng đề mục trong bài" className="relative">
          <ul className="relative border-l border-[#dbe8f5] ml-1.5 space-y-1">
            {items.map((item) => {
              const isActive = item.id === activeId;
              const isH3 = item.level === 3;
              return (
                <li key={item.id} className="relative">
                  {/* Vạch dọc & chấm tròn xanh #0072BC khi mục đang hoạt động */}
                  {isActive && (
                    <>
                      <span
                        aria-hidden="true"
                        className="absolute -left-[1.5px] top-1 bottom-1 w-[2.5px] rounded-full bg-[#0072BC]"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute -left-[4.5px] top-2.5 w-2 h-2 rounded-full bg-[#0072BC] ring-2 ring-white"
                      />
                    </>
                  )}

                  {/* Đường kẻ nhánh bậc thang nối cấp H2 sang H3 */}
                  {isH3 && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-0 w-3.5 h-3.5 border-b border-l border-[#cbd5e1] rounded-bl-[4px]"
                    />
                  )}

                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleJump(item.id);
                    }}
                    className={`block py-1 pr-1.5 text-xs whitespace-normal break-words leading-[1.45] transition-colors ${
                      isH3 ? 'pl-6' : 'pl-3.5'
                    } ${
                      isActive
                        ? 'text-[#0072BC] font-semibold'
                        : isH3
                          ? 'text-[#476885] hover:text-[#0072BC]'
                          : 'text-[#004776] font-medium hover:text-[#0072BC]'
                    }`}
                  >
                    {item.text}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
