'use client';

import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

interface MonitorSearchInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}

/**
 * Ô tìm kiếm kèm nút "Tìm" chuẩn HCM-UTE S-Link dùng chung cho các khung Dashboard theo dõi.
 */
export function MonitorSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className
}: MonitorSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`flex items-center gap-1.5 h-8.5 pl-3 pr-1 rounded-full border border-[#cbd5e1] bg-white focus-within:border-[#006cee] focus-within:ring-2 focus-within:ring-[#006cee]/15 transition-all ${className || ''}`}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) onChange('');
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="flex-1 min-w-0 bg-transparent !border-0 !outline-none !ring-0 !shadow-none !p-0 !rounded-none text-xs sm:!text-xs text-[#004776] placeholder:text-[#476885]"
      />
      {value && (
        <button
          type="button"
          aria-label="Xóa từ khóa tìm kiếm"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="p-0.5 rounded-full text-[#476885] hover:text-[#004776] hover:bg-[#eef5ff] cursor-pointer shrink-0 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className="inline-flex items-center gap-1 h-6.5 px-2.5 rounded-full bg-[#006cee] hover:bg-[#005ecc] text-white text-[11px] font-semibold shrink-0 cursor-pointer transition-colors"
      >
        <Search className="w-3 h-3 stroke-[2.2]" />
        <span>Tìm</span>
      </button>
    </div>
  );
}
