'use client';

import React from 'react';
import { Search, Filter, SlidersHorizontal, Maximize2, Minimize2, X, Plus, Check, Trash2 } from 'lucide-react';
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

export function TableControlBar({
  meta,
  rowsCount,
  selectedCount = 0,
  isC1Locked = false,
  searchTerm,
  filterMode,
  density,
  isFullscreen,
  mobileViewMode = 'table',
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
    <div className="px-3.5 sm:px-5 py-2 min-h-[48px] bg-white border-b border-[#d8e3ef] flex flex-wrap items-center justify-between gap-2.5">
      {/* KHỐI TRÁI: Nút thêm dòng & Tổng số dòng */}
      <div className="flex flex-wrap items-center gap-3">
        {!isC1Locked && onAddRow && (
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 font-bold text-[13px] text-white bg-[#004776] hover:bg-[#00385c] rounded-xl cursor-pointer transition-colors shadow-2xs"
            title="Thêm một dòng mới vào biểu hiện tại"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{meta.key === 'A1' ? 'Thêm nhiệm vụ' : 'Thêm dòng mới'}</span>
          </button>
        )}

        <span className="text-[13px] font-medium text-[#476885]">
          Tổng số: <strong className="font-bold text-[#004776] tabular-nums">{rowsCount}</strong> dòng
        </span>

        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#004776] bg-[#eef5ff] px-2 py-1 rounded-md">
              {selectedCount} đã chọn
            </span>
            {onDeleteSelected && !isC1Locked && (
              <button
                type="button"
                onClick={onDeleteSelected}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer transition-colors shadow-2xs"
                title={`Xóa ${selectedCount} dòng đã chọn`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa {selectedCount} dòng đã chọn</span>
              </button>
            )}
          </div>
        )}

        {onMobileViewModeChange && (
          <div className="inline-flex md:hidden items-center rounded-xl border border-[#d8e3ef] bg-[#f4f7fb] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => onMobileViewModeChange('table')}
              className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                mobileViewMode === 'table' ? 'bg-[#004776] text-white font-bold' : 'text-[#004776]'
              }`}
            >
              Bảng
            </button>
            <button
              type="button"
              onClick={() => onMobileViewModeChange('cards')}
              className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                mobileViewMode === 'cards' ? 'bg-[#004776] text-white font-bold' : 'text-[#004776]'
              }`}
            >
              Phiếu
            </button>
          </div>
        )}
      </div>

      {/* KHỐI PHẢI: Ô tìm kiếm + Popover Lọc, Popover Mật độ, Toàn màn hình */}
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#476885]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm trong biểu…"
            className="h-9 pl-9 pr-8 text-[13.5px] font-medium rounded-xl border border-[#cbd5e1] bg-white text-[#004776] w-full sm:w-52 lg:w-60 focus:ring-2 focus:ring-[#004776]/25 focus:border-[#004776] outline-hidden"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Xóa tìm kiếm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#476885] hover:text-[#004776] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 1. Popover Lọc */}
        <Popover>
          <PopoverTrigger>
            <span
              aria-label="Lọc dữ liệu"
              title="Lọc dòng: Tất cả / Đã sửa / Chưa hoàn tất"
              className={`w-9 h-9 inline-flex items-center justify-center rounded-xl border transition-colors relative ${
                isFiltered
                  ? 'bg-[#eef5ff] text-[#004776] border-[#004776] font-bold'
                  : 'border-[#d8e3ef] text-[#004776] hover:bg-[#f4f7fb]'
              }`}
            >
              <Filter className="w-4 h-4" />
              {isFiltered && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#004776]" />
              )}
            </span>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-52 p-2 space-y-0.5">
            <div className="px-3 py-1.5 text-xs font-bold text-[#476885] border-b border-[#e8eff7] mb-1">
              Bộ lọc dòng dữ liệu
            </div>
            {(['all', 'touched', 'incomplete'] as const).map((m) => (
              <PopoverClose key={m} onClick={() => onFilterModeChange(m)}>
                <div
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between gap-2 ${
                    filterMode === m
                      ? 'font-bold text-[#004776] bg-[#eef5ff]'
                      : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'
                  }`}
                >
                  <span>{m === 'all' ? 'Tất cả dòng' : m === 'touched' ? 'Chỉ dòng đã sửa' : 'Chưa hoàn tất'}</span>
                  {filterMode === m && <Check className="w-4 h-4 text-[#004776] shrink-0" />}
                </div>
              </PopoverClose>
            ))}
          </PopoverContent>
        </Popover>

        {/* 2. Popover Mật độ */}
        <Popover>
          <PopoverTrigger>
            <span
              aria-label="Tùy chỉnh mật độ hiển thị bảng"
              title="Tùy chỉnh mật độ: Thoải mái hoặc Gọn"
              className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-[#d8e3ef] text-[#004776] hover:bg-[#f4f7fb] transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </span>
          </PopoverTrigger>

          <PopoverContent align="end" className="w-52 p-2 space-y-0.5">
            <div className="px-3 py-1.5 text-xs font-bold text-[#476885] border-b border-[#e8eff7] mb-1">
              Mật độ hiển thị ô
            </div>
            <PopoverClose onClick={() => onDensityChange('comfortable')}>
              <div
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between gap-2 ${
                  density === 'comfortable'
                    ? 'font-bold text-[#004776] bg-[#eef5ff]'
                    : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'
                }`}
              >
                <span>Thoải mái</span>
                {density === 'comfortable' && <Check className="w-4 h-4 text-[#004776] shrink-0" />}
              </div>
            </PopoverClose>
            <PopoverClose onClick={() => onDensityChange('compact')}>
              <div
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center justify-between gap-2 ${
                  density === 'compact'
                    ? 'font-bold text-[#004776] bg-[#eef5ff]'
                    : 'text-[#004776] font-medium hover:bg-[#f4f7fb]'
                }`}
              >
                <span>Gọn nhiều dữ liệu</span>
                {density === 'compact' && <Check className="w-4 h-4 text-[#004776] shrink-0" />}
              </div>
            </PopoverClose>
          </PopoverContent>
        </Popover>

        {/* 3. Toàn màn hình */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
          title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
          className="w-9 h-9 inline-flex items-center justify-center rounded-xl border border-[#d8e3ef] text-[#004776] hover:bg-[#f4f7fb] cursor-pointer transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
