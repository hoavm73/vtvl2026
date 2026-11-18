'use client';

import React from 'react';
import {
  Search, Filter, SlidersHorizontal, Maximize2, Minimize2,
  X, Plus, Check, Trash2, Table2, LayoutGrid
} from 'lucide-react';
import { ExcelSheetMeta } from './excel-grid-types';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/Popover';

interface TableControlBarProps {
  meta: ExcelSheetMeta;
  rowsCount: number;
  selectedCount?: number;
  isC1Locked?: boolean;
  searchTerm: string;
  filterMode: 'all' | 'touched' | 'incomplete';
  density: 'compact' | 'comfortable';
  isFullscreen: boolean;
  mobileViewMode?: 'table' | 'cards';
  onMobileViewModeChange?: (mode: 'table' | 'cards') => void;
  onAddRow?: () => void;
  onDeleteSelected?: () => void;
  onSearchChange: (val: string) => void;
  onFilterModeChange: (mode: 'all' | 'touched' | 'incomplete') => void;
  onDensityChange: (density: 'compact' | 'comfortable') => void;
  onToggleFullscreen: () => void;
}

const FILTER_OPTIONS = [
  { id: 'all', label: 'Tất cả dòng' },
  { id: 'touched', label: 'Chỉ dòng đã sửa' },
  { id: 'incomplete', label: 'Chưa hoàn tất' }
] as const;

export function TableControlBar({
  meta,
  rowsCount,
  selectedCount = 0,
  isC1Locked = false,
  searchTerm,
  filterMode,
  density,
  isFullscreen,
  mobileViewMode = 'cards',
  onMobileViewModeChange,
  onAddRow,
  onDeleteSelected,
  onSearchChange,
  onFilterModeChange,
  onDensityChange,
  onToggleFullscreen
}: TableControlBarProps) {
  const isFiltered = filterMode !== 'all';

  return (
    <div className="px-3 sm:px-5 py-2.5 min-h-[48px] bg-white border-b border-[#d8e3ef] flex flex-wrap items-center justify-between gap-2 min-w-0">
      {/* KHỐI TRÁI: Thêm dòng + Tổng số dòng (Desktop) & Xóa hàng loạt khi có chọn */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {!isC1Locked && onAddRow && (
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-1.5 h-9 px-3 font-bold text-xs sm:text-[13px] text-white bg-[#004776] hover:bg-[#00385c] rounded-xl cursor-pointer transition-colors shadow-2xs shrink-0"
            title="Thêm một dòng mới vào biểu hiện tại"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="sm:hidden">Thêm</span>
            <span className="hidden sm:inline">{meta.key === 'A1' ? 'Thêm nhiệm vụ' : 'Thêm dòng mới'}</span>
          </button>
        )}

        <span className="text-xs sm:text-[13px] font-medium text-[#476885] tabular-nums">
          Tổng: <strong className="font-bold text-[#004776]">{rowsCount}</strong> dòng
        </span>

        {selectedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#004776] bg-[#eef5ff] px-2 py-1 rounded-md">
              {selectedCount} đã chọn
            </span>
            {onDeleteSelected && !isC1Locked && (
              <button
                type="button"
                onClick={onDeleteSelected}
                className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer transition-colors shadow-2xs"
                title={`Xóa ${selectedCount} dòng đã chọn`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa {selectedCount}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* KHỐI PHẢI: Ô tìm kiếm + Menu Tùy chọn gọn (Mobile < 768px) / Nút công cụ đầy đủ (Desktop >= 768px) */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto min-w-0">
        <div className="relative flex-1 md:flex-initial min-w-0">
          <label htmlFor="excel-grid-search-input" className="sr-only">Tìm trong biểu hiện tại</label>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#476885]" aria-hidden="true" />
          <input
            id="excel-grid-search-input"
            type="text"
            aria-label="Tìm kiếm trong biểu hiện tại"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm trong biểu…"
            className="min-h-[40px] sm:h-9 pl-9 pr-8 text-[13.5px] font-medium rounded-xl border border-[#cbd5e1] bg-white text-[#004776] w-full md:w-52 lg:w-60 focus:ring-2 focus:ring-[#004776]/25 focus:border-[#004776] outline-hidden"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Xóa tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center text-[#476885] hover:text-[#004776] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Menu Tùy chọn thu gọn công cụ phụ trên điện thoại (< 768px) */}
        <div className="md:hidden shrink-0">
          <Popover>
            <PopoverTrigger ariaLabel="Tùy chọn lọc và chế độ hiển thị bảng tính">
              <span className={`min-h-[40px] px-3 inline-flex items-center gap-1 rounded-xl border text-xs font-semibold transition-colors ${isFiltered || mobileViewMode === 'table' ? 'bg-[#eef5ff] text-[#004776] border-[#006cee]' : 'border-[#d8e3ef] bg-white text-[#004776]'}`}>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Bộ lọc</span>
              </span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-2 space-y-1 z-40">
              <div className="px-2.5 py-1 text-[11px] font-bold text-[#476885] border-b border-[#e8eff7]">Lọc dòng dữ liệu</div>
              {FILTER_OPTIONS.map((m) => (
                <PopoverClose key={m.id} onClick={() => onFilterModeChange(m.id)}>
                  <div className={`w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between ${filterMode === m.id ? 'font-bold text-[#004776] bg-[#eef5ff]' : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'}`}>
                    <span>{m.label}</span>
                    {filterMode === m.id && <Check className="w-3.5 h-3.5 text-[#004776]" />}
                  </div>
                </PopoverClose>
              ))}

              {onMobileViewModeChange && (
                <>
                  <div className="px-2.5 pt-2 pb-1 text-[11px] font-bold text-[#476885] border-t border-[#e8eff7]">Chế độ hiển thị</div>
                  <PopoverClose onClick={() => onMobileViewModeChange('cards')}>
                    <div className={`w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between ${mobileViewMode === 'cards' ? 'font-bold text-[#004776] bg-[#eef5ff]' : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'}`}>
                      <span className="inline-flex items-center gap-2"><LayoutGrid className="w-3.5 h-3.5" /><span>Chế độ Phiếu (mặc định)</span></span>
                      {mobileViewMode === 'cards' && <Check className="w-3.5 h-3.5 text-[#004776]" />}
                    </div>
                  </PopoverClose>
                  <PopoverClose onClick={() => onMobileViewModeChange('table')}>
                    <div className={`w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between ${mobileViewMode === 'table' ? 'font-bold text-[#004776] bg-[#eef5ff]' : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'}`}>
                      <span className="inline-flex items-center gap-2"><Table2 className="w-3.5 h-3.5" /><span>Bảng ngang (nâng cao)</span></span>
                      {mobileViewMode === 'table' && <Check className="w-3.5 h-3.5 text-[#004776]" />}
                    </div>
                  </PopoverClose>
                </>
              )}

              {mobileViewMode === 'table' && (
                <>
                  <div className="px-2.5 pt-2 pb-1 text-[11px] font-bold text-[#476885] border-t border-[#e8eff7]">Bảng ngang nâng cao</div>
                  <PopoverClose onClick={() => onDensityChange(density === 'comfortable' ? 'compact' : 'comfortable')}>
                    <div className="w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between text-[#004776] hover:bg-[#f4f7fb]">
                      <span>Mật độ ô</span>
                      <span className="font-bold text-[#006cee]">{density === 'compact' ? 'Gọn' : 'Thoải mái'}</span>
                    </div>
                  </PopoverClose>
                  <PopoverClose onClick={onToggleFullscreen}>
                    <div className="w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between text-[#004776] hover:bg-[#f4f7fb]">
                      <span>{isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình'}</span>
                      {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </div>
                  </PopoverClose>
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Desktop (>= 768px): giữ nguyên Filter, Mật độ, Toàn màn hình */}
        <div className="hidden md:inline-flex items-center gap-2">
          <Popover>
            <PopoverTrigger ariaLabel="Lọc dữ liệu bảng tính">
              <span title="Lọc dòng: Tất cả / Đã sửa / Chưa hoàn tất" className={`w-9 h-9 inline-flex items-center justify-center rounded-xl border transition-colors relative ${isFiltered ? 'bg-[#eef5ff] text-[#004776] border-[#004776] font-bold' : 'border-[#d8e3ef] text-[#004776] hover:bg-[#f4f7fb]'}`}>
                <Filter className="w-4 h-4" />
                {isFiltered && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#004776]" />}
              </span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-2 space-y-0.5">
              <div className="px-3 py-1.5 text-xs font-bold text-[#476885] border-b border-[#e8eff7] mb-1">Bộ lọc dòng dữ liệu</div>
              {FILTER_OPTIONS.map((m) => (
                <PopoverClose key={m.id} onClick={() => onFilterModeChange(m.id)}>
                  <div className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between gap-2 ${filterMode === m.id ? 'font-bold text-[#004776] bg-[#eef5ff]' : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'}`}>
                    <span>{m.label}</span>
                    {filterMode === m.id && <Check className="w-4 h-4 text-[#004776] shrink-0" />}
                  </div>
                </PopoverClose>
              ))}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger ariaLabel="Tùy chỉnh mật độ hiển thị bảng">
              <span title="Tùy chỉnh mật độ: Thoải mái hoặc Gọn" className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-[#d8e3ef] text-[#004776] hover:bg-[#f4f7fb] transition-colors">
                <SlidersHorizontal className="w-4 h-4" />
              </span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52 p-2 space-y-0.5">
              <div className="px-3 py-1.5 text-xs font-bold text-[#476885] border-b border-[#e8eff7] mb-1">Mật độ hiển thị ô</div>
              <PopoverClose onClick={() => onDensityChange('comfortable')}>
                <div className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between gap-2 ${density === 'comfortable' ? 'font-bold text-[#004776] bg-[#eef5ff]' : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'}`}>
                  <span>Thoải mái</span>
                  {density === 'comfortable' && <Check className="w-4 h-4 text-[#004776] shrink-0" />}
                </div>
              </PopoverClose>
              <PopoverClose onClick={() => onDensityChange('compact')}>
                <div className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between gap-2 ${density === 'compact' ? 'font-bold text-[#004776] bg-[#eef5ff]' : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'}`}>
                  <span>Gọn nhiều dữ liệu</span>
                  {density === 'compact' && <Check className="w-4 h-4 text-[#004776] shrink-0" />}
                </div>
              </PopoverClose>
            </PopoverContent>
          </Popover>

          <button type="button" onClick={onToggleFullscreen} aria-label={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'} title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'} className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-[#d8e3ef] text-[#004776] hover:bg-[#f4f7fb] cursor-pointer transition-colors">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
