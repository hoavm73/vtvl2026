'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  Clock,
  GripVertical,
  Play,
  RotateCcw,
  Video
} from 'lucide-react';
import { GuideVideoItem, HCMUTE_GUIDE_VIDEOS } from '@/configs/hcmute-guide-videos';

interface FloatingVideoGuidePanelProps {
  panelPos: { x: number; y: number };
  panelWidth: number;
  activeVideo: GuideVideoItem;
  isCustomPos: boolean;
  isDragging: boolean;
  onSelectVideo: (id: string) => void;
  onCollapse: () => void;
  onResetPosition: () => void;
  onHeaderPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onHeaderPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onHeaderPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
}

export function FloatingVideoGuidePanel({
  panelPos,
  panelWidth,
  activeVideo,
  isCustomPos,
  isDragging,
  onSelectVideo,
  onCollapse,
  onResetPosition,
  onHeaderPointerDown,
  onHeaderPointerMove,
  onHeaderPointerUp
}: FloatingVideoGuidePanelProps) {
  return (
    <aside
      aria-label="Popup video hướng dẫn nghiệp vụ"
      style={{ left: panelPos.x, top: panelPos.y, width: panelWidth }}
      className="fixed z-50 rounded-[14px] border border-[#cbd5e1] bg-white shadow-[0_16px_44px_rgba(0,71,118,0.22)] overflow-hidden flex flex-col max-h-[calc(100vh-24px)]"
    >
      {/* Thanh tiêu đề cho phép kéo di chuyển popup */}
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        className={`px-3.5 py-2.5 bg-[#004776] text-white flex items-center justify-between gap-2 select-none touch-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-white/70 shrink-0" />
          <Video className="w-4 h-4 text-[#7dd3fc] shrink-0" />
          <span className="text-xs font-bold truncate">Video hướng dẫn nghiệp vụ</span>
          <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full bg-white/15 text-white tabular-nums shrink-0">
            {HCMUTE_GUIDE_VIDEOS.length}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isCustomPos && (
            <button
              type="button"
              data-no-drag="true"
              onClick={onResetPosition}
              title="Đưa về góc phải bên dưới"
              aria-label="Đưa về góc phải bên dưới"
              className="w-7 h-7 rounded-md hover:bg-white/15 inline-flex items-center justify-center text-white/85 hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            data-no-drag="true"
            onClick={onCollapse}
            title="Thu gọn"
            aria-label="Thu gọn popup video hướng dẫn"
            className="h-7 px-2 rounded-md hover:bg-white/15 inline-flex items-center gap-1 text-[11px] font-semibold text-white cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Thu gọn</span>
          </button>
        </div>
      </div>

      {/* Trình phát video đang chọn */}
      <div className="p-3 bg-[#f8fbff] border-b border-[#e2e8f0] space-y-2 overflow-y-auto">
        <video
          key={activeVideo.id}
          src={activeVideo.src}
          controls
          playsInline
          preload="metadata"
          className="w-full aspect-video rounded-[8px] bg-[#06243d]"
        >
          Trình duyệt không hỗ trợ phát video MP4.
        </video>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-[#eef6ff] text-[#0072BC] border border-[#cfe3fb]">
              {activeVideo.audience}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#476885] tabular-nums">
              <Clock className="w-3 h-3" />
              <span>{activeVideo.duration}</span>
            </span>
          </div>
          <div className="text-[13px] font-bold text-[#004776] leading-snug">
            {activeVideo.title}
          </div>
          <p className="text-[11.5px] text-[#476885] leading-relaxed">
            {activeVideo.description}
          </p>
        </div>
      </div>

      {/* Danh sách chọn nhanh 3 video */}
      <div className="divide-y divide-[#e2e8f0] bg-white overflow-y-auto">
        {HCMUTE_GUIDE_VIDEOS.map((video) => {
          const active = video.id === activeVideo.id;
          return (
            <button
              key={video.id}
              type="button"
              onClick={() => onSelectVideo(video.id)}
              className={`w-full text-left px-3.5 py-2.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                active ? 'bg-[#eef6ff]' : 'hover:bg-[#f8fafc]'
              }`}
            >
              <span
                className={`mt-0.5 w-5 h-5 rounded-full text-[10.5px] font-bold inline-flex items-center justify-center shrink-0 ${
                  active ? 'bg-[#006cee] text-white' : 'bg-[#eef5ff] text-[#0072BC]'
                }`}
              >
                {active ? <Play className="w-2.5 h-2.5 fill-current" /> : video.orderLabel}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-xs font-semibold leading-snug ${
                    active ? 'text-[#006cee]' : 'text-[#004776]'
                  }`}
                >
                  {video.title}
                </div>
                <div className="text-[11px] text-[#476885] mt-0.5">
                  {video.audience} · {video.duration}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Chân popup dẫn nhanh tới Cổng hướng dẫn đầy đủ */}
      <div className="px-3.5 py-2 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-[#476885]">Kéo thanh tiêu đề để di chuyển</span>
        <Link
          href="/huong-dan?doc=1.4"
          onClick={onCollapse}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#0072BC] hover:underline"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Xem hướng dẫn chi tiết</span>
        </Link>
      </div>
    </aside>
  );
}
