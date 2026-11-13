'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search } from 'lucide-react';

export interface ShadcnSelectOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}

export interface ShadcnSelectProps {
  id?: string;
  value: string;
  options: ShadcnSelectOption[];
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  size?: 'sm' | 'md' | 'cell-compact' | 'cell-comfortable';
  className?: string;
  searchable?: boolean;
  searchableThreshold?: number;
  displayValue?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

export function ShadcnSelect({
  id,
  value,
  options,
  onChange,
  onValueChange,
  placeholder = 'Chọn giá trị...',
  disabled = false,
  hasError = false,
  ariaLabel,
  ariaDescribedBy,
  size = 'md',
  className = '',
  searchable,
  searchableThreshold = 8,
  displayValue = false,
  onBlur,
  onFocus
}: ShadcnSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; openUpward: boolean }>({
    top: 0,
    left: 0,
    width: 0,
    openUpward: false
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value || (Boolean(value) && value.endsWith(`.${o.value}`))),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, search]);

  const updateCoords = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenUpward = spaceBelow < 250 && spaceAbove > spaceBelow;

    const targetWidth = Math.max(rect.width, 240);
    const maxWidth = Math.min(targetWidth, Math.min(420, window.innerWidth - 16));

    let left = rect.left;
    if (left + maxWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - maxWidth - 8);
    }
    if (left < 8) left = 8;

    setCoords({
      top: shouldOpenUpward ? rect.top - 6 : rect.bottom + 6,
      left,
      width: maxWidth,
      openUpward: shouldOpenUpward
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateCoords();

    const handleScrollOrResize = () => updateCoords();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isInsideContainer = containerRef.current && containerRef.current.contains(target);
      const isInsideMenu = menuRef.current && menuRef.current.contains(target);
      if (!isInsideContainer && !isInsideMenu) {
        setOpen(false);
        setSearch('');
        onBlur?.();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
        onBlur?.();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open, onBlur]);

  const sizeClass =
    size === 'cell-compact'
      ? 'h-8 px-2 text-[13px] rounded-md'
      : size === 'cell-comfortable'
        ? 'h-9 px-2.5 text-[13px] rounded-md'
        : size === 'sm'
          ? 'h-9 px-3 text-xs rounded-lg'
          : 'h-11 sm:h-10 px-3 text-base sm:text-sm rounded-lg';

  const borderClass = hasError
    ? 'border-[var(--fix)] bg-[var(--fix-soft)] text-[var(--fix)] focus:ring-2 focus:ring-[var(--fix)]/25'
    : open
      ? 'border-[#004776] ring-2 ring-[#004776]/20 bg-white text-[#004776]'
      : 'border-[#cbd5e1] bg-white hover:border-[#004776]/50 text-[#004776]';

  const showSearch = searchable ?? options.length >= searchableThreshold;

  const handleToggle = () => {
    if (disabled) return;
    if (!open) {
      onFocus?.();
      updateCoords();
    }
    setOpen((prev) => !prev);
  };

  const menuDropdown = open && (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={ariaLabel || placeholder}
      style={{
        position: 'fixed',
        left: `${coords.left}px`,
        ...(coords.openUpward
          ? { bottom: `${Math.max(8, window.innerHeight - coords.top)}px` }
          : { top: `${coords.top}px` }),
        width: `${coords.width}px`,
        zIndex: 99999
      }}
      className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xl py-1 max-h-60 flex flex-col animate-in fade-in-50 zoom-in-95 duration-100"
    >
      {showSearch && (
        <div className="px-2 pb-1 pt-0.5 border-b border-[#f1f5f9]">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm lựa chọn..."
              autoFocus
              className="w-full h-8 pl-7 pr-2 text-xs rounded-md border border-[#cbd5e1] bg-[#f8fafc] text-[#004776] focus:border-[#004776] outline-hidden"
            />
          </div>
        </div>
      )}
      <div className="overflow-y-auto py-0.5 max-h-52">
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-2 text-xs text-[#64748b] text-center">Không có kết quả</div>
        ) : (
          filteredOptions.map((opt) => {
            const isSelected = opt.value === value || (Boolean(value) && value.endsWith(`.${opt.value}`));
            return (
              <button
                key={`${opt.value}-${opt.label}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onClick={() => {
                  onChange?.(opt.value);
                  onValueChange?.(opt.value);
                  setOpen(false);
                  setSearch('');
                  onBlur?.();
                }}
                className={`w-full text-left px-2.5 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#eef5ff] text-[#004776] font-semibold'
                    : 'text-[#004776] hover:bg-[#f8fafc] font-normal'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#004776] shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative w-full min-w-0 ${className}`}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-invalid={hasError || undefined}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full inline-flex items-center justify-between gap-1.5 border font-normal transition-all outline-hidden cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClass} ${borderClass}`}
        title={selectedOption?.label || value || placeholder}
      >
        <span className={`truncate text-left ${value !== '' ? 'text-[#004776]' : 'text-[#64748b]'}`}>
          {displayValue ? (value || placeholder) : (selectedOption ? selectedOption.label : value || placeholder)}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#64748b] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {mounted && typeof document !== 'undefined' && createPortal(menuDropdown, document.body)}
    </div>
  );
}
