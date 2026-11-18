'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlignLeft } from 'lucide-react';
import { TechDocTocItem } from '@/configs/hcmute-techdoc-types';

interface TechDocTocProps {
  articleId: string;
}

export function TechDocToc({ articleId }: TechDocTocProps) {
  const [items, setItems] = useState<TechDocTocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [readProgress, setReadProgress] = useState<number>(0);
  const clickLockUntilRef = useRef<number>(0);

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
      setReadProgress(extracted.length > 0 ? Math.round((1 / extracted.length) * 100) : 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [articleId]);

  useEffect(() => {
    if (items.length === 0) return;
    let rafId = 0;

    const updateProgressAndActive = () => {
      const scrollMax = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const pct = Math.min(100, Math.max(0, Math.round((window.scrollY / scrollMax) * 100)));
      setReadProgress(pct || Math.round((1 / items.length) * 100));

      if (Date.now() < clickLockUntilRef.current) return;

      const offset = 148;
      let current = items[0]?.id || '';
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset) {
          current = item.id;
        }
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 28) {
        current = items[items.length - 1]?.id || current;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateProgressAndActive);
    };

    updateProgressAndActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
    };
  }, [items]);

  const activeIndex = Math.max(0, items.findIndex((i) => i.id === activeId));
  const timelinePct =
    items.length <= 1 ? 100 : Math.min(100, Math.round((activeIndex / (items.length - 1)) * 100));

  const handleJump = (id: string, idx: number) => {
    clickLockUntilRef.current = Date.now() + 650;
    setActiveId(id);
    setReadProgress(items.length > 0 ? Math.round(((idx + 1) / items.length) * 100) : 0);
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
      <div className="bg-white rounded-[16px] border border-[#e2e8f0] p-4 space-y-3.5">
        {/* Đầu mục lục & Thanh tiến trình đọc mượt (hcmute-ui-system) */}
        <div className="space-y-2 pb-2.5 border-b border-[#e2e8f0]">
          <div className="flex items-center justify-between gap-2 text-[#004776]">
            <div className="flex items-center gap-2 min-w-0">
              <AlignLeft className="w-4 h-4 shrink-0 text-[#0072BC]" />
              <span className="text-[13px] font-semibold whitespace-nowrap">Mục lục bài viết</span>
            </div>
            <span className="text-[11px] font-bold text-[#0072BC] tabular-nums shrink-0">
              {readProgress}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Tiến trình đọc bài viết"
            aria-valuenow={readProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-1.5 rounded-full bg-[#e2e8f0] overflow-hidden"
          >
            <div
              className="h-full bg-[#0072BC] rounded-full transition-all duration-200 ease-out"
              style={{ width: `${Math.max(8, readProgress)}%` }}
            />
          </div>
        </div>

        {/* Trục tiến trình dọc (Vertical Progress Timeline) */}
        <nav aria-label="Điều hướng đề mục trong bài" className="relative">
          <div
            aria-hidden="true"
            className="absolute left-[7px] top-2.5 bottom-2.5 w-[2px] rounded-full bg-[#dbe8f5]"
          />
          <div
            aria-hidden="true"
            className="absolute left-[7px] top-2.5 w-[2px] rounded-full bg-[#0072BC] transition-all duration-300 ease-out"
            style={{ height: `calc((100% - 20px) * ${timelinePct / 100})` }}
          />

          <ul className="relative pl-5 space-y-1">
            {items.map((item, idx) => {
              const isActive = item.id === activeId;
              const isPassed = idx < activeIndex;
              const isH3 = item.level === 3;

              return (
                <li key={item.id} className="relative">
                  <span
                    aria-hidden="true"
                    className={`absolute transition-all duration-200 rounded-full ${
                      isActive
                        ? '-left-[17px] top-[9px] w-2.5 h-2.5 bg-[#0072BC] ring-4 ring-[#dbeafe]'
                        : isPassed
                          ? '-left-[16px] top-[10px] w-2 h-2 bg-[#0072BC]/75 ring-2 ring-white'
                          : '-left-[16px] top-[10px] w-2 h-2 bg-[#cbd5e1] ring-2 ring-white'
                    }`}
                  />

                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleJump(item.id, idx);
                    }}
                    className={`block py-1.5 px-2.5 rounded-[8px] whitespace-normal break-words leading-[1.45] transition-colors duration-150 ${
                      isH3 ? 'pl-4 text-[11.5px]' : 'text-xs'
                    } ${
                      isActive
                        ? 'bg-[#eef6ff] text-[#0072BC] font-semibold'
                        : isPassed
                          ? 'text-[#004776] font-medium hover:bg-[#f8fafc] hover:text-[#0072BC]'
                          : isH3
                            ? 'text-[#476885] hover:bg-[#f8fafc] hover:text-[#0072BC]'
                            : 'text-[#004776] font-medium hover:bg-[#f8fafc] hover:text-[#0072BC]'
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
