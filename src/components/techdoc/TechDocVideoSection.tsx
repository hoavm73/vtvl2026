'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, PlayCircle, Video } from 'lucide-react';
import { getGuideVideosForArticle } from '@/configs/hcmute-guide-videos';

interface TechDocVideoSectionProps {
  articleId: string;
}

export function TechDocVideoSection({ articleId }: TechDocVideoSectionProps) {
  const videos = getGuideVideosForArticle(articleId);
  const [selectedId, setSelectedId] = useState<string>('');

  useEffect(() => {
    setSelectedId(videos[0]?.id || '');
  }, [articleId, videos]);

  if (videos.length === 0) return null;

  const activeVideo = videos.find((v) => v.id === selectedId) || videos[0];

  return (
    <section
      aria-label="Video hướng dẫn thực hành"
      className="space-y-3.5 pt-2 border-t border-[#e2e8f0] print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="sec-video-huong-dan"
          className="scroll-mt-24 text-base sm:text-lg font-bold !text-[#004776] flex items-center gap-2"
        >
          <Video className="w-4 h-4 text-[#0072BC] shrink-0" />
          <span>Video hướng dẫn thực hành</span>
          {videos.length > 1 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eef6ff] text-[#0072BC]">
              {videos.length} video
            </span>
          )}
        </h2>
        <Link
          href={activeVideo.relatedHref}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0072BC] hover:underline"
        >
          <span>{activeVideo.relatedLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {videos.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="tablist" aria-label="Chọn video hướng dẫn">
          {videos.map((video) => {
            const isActive = video.id === activeVideo.id;
            return (
              <button
                key={video.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedId(video.id)}
                className={`text-left p-2.5 rounded-[10px] border transition-colors cursor-pointer ${
                  isActive
                    ? 'border-[#006cee] bg-[#eef6ff] text-[#004776]'
                    : 'border-[#e2e8f0] bg-[#f8fafc] hover:bg-[#f0f7ff] text-[#004776]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 text-[11px] font-semibold">
                  <span className={isActive ? 'text-[#006cee]' : 'text-[#0072BC]'}>
                    Video {video.orderLabel}
                  </span>
                  <span className="text-[#476885] tabular-nums">{video.duration}</span>
                </div>
                <div className="text-xs font-bold text-[#004776] mt-1 line-clamp-2 leading-snug">
                  {video.title}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-[12px] border border-[#dbe8f5] bg-[#f8fbff] overflow-hidden">
        <div className="p-3 sm:p-4 bg-[#06243d]">
          <video
            key={activeVideo.id}
            src={activeVideo.src}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[460px] aspect-video rounded-[8px] bg-[#041a2d]"
          >
            Trình duyệt không hỗ trợ phát video MP4.
          </video>
        </div>
        <div className="p-3.5 sm:p-4 space-y-1.5 border-t border-[#dbe8f5]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#006cee] text-white">
              <PlayCircle className="w-3 h-3" />
              <span>Video {activeVideo.orderLabel}</span>
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eef6ff] text-[#0072BC] border border-[#cfe3fb]">
              {activeVideo.audience}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#476885] tabular-nums">
              <Clock className="w-3 h-3" />
              <span>{activeVideo.duration}</span>
            </span>
          </div>
          <h3 className="text-sm font-bold !text-[#004776] leading-snug">
            {activeVideo.title}
          </h3>
          <p className="text-xs sm:text-[13.5px] text-[#004776] leading-relaxed">
            {activeVideo.description}
          </p>
        </div>
      </div>
    </section>
  );
}
