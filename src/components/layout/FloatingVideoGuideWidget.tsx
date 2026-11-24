'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, Video } from 'lucide-react';
import { HCMUTE_GUIDE_VIDEOS } from '@/configs/hcmute-guide-videos';
import { FloatingVideoGuidePanel } from './FloatingVideoGuidePanel';

const POS_STORAGE_KEY = 'vtvl_video_guide_pos_v1';
const VIEWPORT_PAD = 12;
const PILL_WIDTH = 176;
const PILL_HEIGHT = 44;
const PANEL_WIDTH = 392;
const PANEL_HEIGHT = 490;

interface Position {
  x: number;
  y: number;
}

function clampPos(x: number, y: number, w: number, h: number): Position {
  if (typeof window === 'undefined') return { x, y };
  const maxX = Math.max(VIEWPORT_PAD, window.innerWidth - w - VIEWPORT_PAD);
  const maxY = Math.max(VIEWPORT_PAD, window.innerHeight - h - VIEWPORT_PAD);
  return {
    x: Math.min(Math.max(VIEWPORT_PAD, x), maxX),
    y: Math.min(Math.max(VIEWPORT_PAD, y), maxY)
  };
}

function getDefaultPos(): Position {
  if (typeof window === 'undefined') return { x: 20, y: 20 };
  return clampPos(
    window.innerWidth - PILL_WIDTH - 20,
    window.innerHeight - PILL_HEIGHT - 20,
    PILL_WIDTH,
    PILL_HEIGHT
  );
}

export function FloatingVideoGuideWidget() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState(HCMUTE_GUIDE_VIDEOS[0].id);
  const [pos, setPos] = useState<Position>({ x: 20, y: 20 });
  const [isCustomPos, setIsCustomPos] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
    width: number;
    height: number;
    isPanel: boolean;
  } | null>(null);

  const activeVideo =
    HCMUTE_GUIDE_VIDEOS.find((v) => v.id === activeId) || HCMUTE_GUIDE_VIDEOS[0];

  useEffect(() => {
    let initial = getDefaultPos();
    let custom = false;
    try {
      const raw = localStorage.getItem(POS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Position>;
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          initial = clampPos(parsed.x, parsed.y, PILL_WIDTH, PILL_HEIGHT);
          custom = true;
        }
      }
    } catch {
      // Bỏ qua lỗi đọc localStorage
    }
    setPos(initial);
    setIsCustomPos(custom);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const onResize = () => {
      setPos((prev) =>
        isCustomPos ? clampPos(prev.x, prev.y, PILL_WIDTH, PILL_HEIGHT) : getDefaultPos()
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mounted, isCustomPos]);

  const toAnchorPos = useCallback(
    (nextX: number, nextY: number, width: number, height: number, isPanel: boolean): Position => {
      const clamped = clampPos(nextX, nextY, width, height);
      if (!isPanel) return clamped;
      return clampPos(
        clamped.x + width - PILL_WIDTH,
        clamped.y + height - PILL_HEIGHT,
        PILL_WIDTH,
        PILL_HEIGHT
      );
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, width: number, height: number, origin: Position, isPanel: boolean) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest('button[data-no-drag="true"], a')) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: origin.x,
        origY: origin.y,
        moved: false,
        width,
        height,
        isPanel
      };
      setIsDragging(true);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const state = dragRef.current;
      if (!state) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (!state.moved && Math.hypot(dx, dy) >= 6) {
        state.moved = true;
      }
      if (state.moved) {
        setPos(toAnchorPos(state.origX + dx, state.origY + dy, state.width, state.height, state.isPanel));
      }
    },
    [toAnchorPos]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>, toggleOnClick: boolean) => {
      const state = dragRef.current;
      dragRef.current = null;
      setIsDragging(false);
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      if (!state) return;
      if (state.moved) {
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        const next = toAnchorPos(state.origX + dx, state.origY + dy, state.width, state.height, state.isPanel);
        setPos(next);
        setIsCustomPos(true);
        try {
          localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Bỏ qua lỗi ghi localStorage
        }
      } else if (toggleOnClick) {
        setIsOpen((prev) => !prev);
      }
    },
    [toAnchorPos]
  );

  const handleResetPosition = () => {
    setPos(getDefaultPos());
    setIsCustomPos(false);
    try {
      localStorage.removeItem(POS_STORAGE_KEY);
    } catch {
      // Bỏ qua
    }
  };

  if (!mounted) return null;

  const panelW =
    typeof window !== 'undefined' ? Math.min(PANEL_WIDTH, window.innerWidth - 24) : PANEL_WIDTH;
  const panelPos = clampPos(
    pos.x + PILL_WIDTH - panelW,
    pos.y + PILL_HEIGHT - PANEL_HEIGHT,
    panelW,
    PANEL_HEIGHT
  );

  return (
    <div className="print:hidden">
      {!isOpen ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Mở popup video hướng dẫn nghiệp vụ (có thể kéo để di chuyển)"
          aria-expanded={false}
          style={{ left: pos.x, top: pos.y }}
          onPointerDown={(e) => handlePointerDown(e, PILL_WIDTH, PILL_HEIGHT, pos, false)}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => handlePointerUp(e, true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          className={`fixed z-50 h-11 pl-2.5 pr-3.5 rounded-full bg-[#006cee] hover:bg-[#0055c4] text-white shadow-[0_8px_24px_rgba(0,71,118,0.28)] border border-white/25 inline-flex items-center gap-2 select-none touch-none transition-colors ${
            isDragging ? 'cursor-grabbing scale-[1.02]' : 'cursor-grab'
          }`}
        >
          <GripVertical className="w-3.5 h-3.5 text-white/70 shrink-0" />
          <Video className="w-4 h-4 shrink-0" />
          <span className="text-xs font-semibold whitespace-nowrap">Video hướng dẫn</span>
          <span className="w-5 h-5 rounded-full bg-white text-[#006cee] text-[11px] font-bold inline-flex items-center justify-center shrink-0 tabular-nums">
            {HCMUTE_GUIDE_VIDEOS.length}
          </span>
        </div>
      ) : (
        <FloatingVideoGuidePanel
          panelPos={panelPos}
          panelWidth={panelW}
          activeVideo={activeVideo}
          isCustomPos={isCustomPos}
          isDragging={isDragging}
          onSelectVideo={setActiveId}
          onCollapse={() => setIsOpen(false)}
          onResetPosition={handleResetPosition}
          onHeaderPointerDown={(e) => handlePointerDown(e, panelW, PANEL_HEIGHT, panelPos, true)}
          onHeaderPointerMove={handlePointerMove}
          onHeaderPointerUp={(e) => handlePointerUp(e, false)}
        />
      )}
    </div>
  );
}
