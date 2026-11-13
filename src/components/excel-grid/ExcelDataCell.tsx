'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ExcelColumnDef } from './excel-grid-types';
import { FunctionSquare, AlertCircle } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';

interface ExcelDataCellProps {
  col: ExcelColumnDef;
  val: string | number | boolean | undefined;
  rowId: string;
  isComputed: boolean;
  isTouched: boolean;
  cellKey: string;
  dynamicOptions?: string[];
  density?: 'compact' | 'comfortable';
  onCellTouch?: (key: string) => void;
  onCellChange: (rowId: string, field: string, val: string | number) => void;
}

export function ExcelDataCell({
  col,
  val,
  rowId,
  isComputed,
  isTouched,
  cellKey,
  dynamicOptions,
  density = 'comfortable',
  onCellTouch,
  onCellChange
}: ExcelDataCellProps) {
  const [, setIsFocused] = useState(false);
  const [hasBlurred, setHasBlurred] = useState(false);

  const strVal = val !== undefined && val !== null ? String(val) : '';
  const isEmptyRequired = hasBlurred && Boolean(col.required) && !strVal.trim();
  const errorId = `${cellKey}-err`;

  const cellStyle = isEmptyRequired
    ? 'border-[var(--fix)] bg-[var(--fix-soft)] text-[var(--fix)] focus:ring-2 focus:ring-[var(--fix)]/25 focus:border-[var(--fix)]'
    : isTouched
      ? 'border-[#005fa3]/50 bg-[#f8fbff] text-[#004776] focus:ring-2 focus:ring-[#005fa3]/20 focus:border-[#005fa3]'
      : 'border-[#cbd5e1] bg-white hover:border-[#94a3b8] text-[#004776] focus:ring-2 focus:ring-[#005fa3]/20 focus:border-[#005fa3] transition-colors';

  const colStyle = {
    minWidth: col.width || '150px',
    width: col.width || '150px'
  };

  const isCompact = density === 'compact';
  const uniformHeightClass = isCompact ? 'h-8' : 'h-9';
  const minHeightClass = isCompact ? 'min-h-[32px]' : 'min-h-[36px]';

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minH = isCompact ? 32 : 36;
    el.style.height = `${Math.max(el.scrollHeight, minH)}px`;
  }, [strVal, isCompact]);

  // 1. Trạng thái Status (ĐẠT / CHƯA ĐẠT)
  if (col.type === 'status') {
    const isOk = val === 'ĐẠT' || val === 'Hoàn thành';
    return (
      <td style={colStyle} className="py-1 px-1.5 border-r border-[#f1f5f9] text-center align-middle">
        <span
          className={`inline-flex items-center justify-center px-2.5 h-7 text-xs font-medium rounded-md leading-tight ${
            isOk ? 'bg-[var(--ok-soft)] text-[var(--ok)] border border-[var(--ok)]/30' : 'bg-[var(--fix-soft)] text-[var(--fix)] border border-[var(--fix)]/30'
          }`}
        >
          {strVal || 'CHƯA ĐẠT'}
        </span>
      </td>
    );
  }

  // 2. Ô tính toán / Công thức / Chỉ đọc (=fx)
  if (isComputed) {
    return (
      <td
        style={colStyle}
        className="py-1 px-1.5 border-r border-[#f1f5f9] bg-[#f8fafc] font-normal text-[#004776] align-middle"
        title={col.formulaHint || strVal}
      >
        <div className={`w-full ${uniformHeightClass} px-2.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between gap-1`}>
          <span className={`truncate text-[13px] text-[#004776] ${col.type === 'number' ? 'tabular-nums text-right w-full' : ''}`}>
            {strVal !== '' ? strVal : '—'}
          </span>
          {col.formulaHint && (
            <FunctionSquare className="w-3.5 h-3.5 text-[#94a3b8] shrink-0 opacity-60 group-hover:opacity-100" />
          )}
        </div>
      </td>
    );
  }

  // 3. Shadcn Dropdown / Select cell
  if (col.type === 'select' || (dynamicOptions && dynamicOptions.length > 0)) {
    const rawOptions = dynamicOptions && dynamicOptions.length > 0 ? dynamicOptions : (col.selectOptions || []);
    const shadcnOptions = [
      { value: '', label: 'Chọn' },
      ...rawOptions.map((opt) => ({ value: opt, label: opt }))
    ];
    return (
      <td style={colStyle} className="py-1 px-1.5 border-r border-[#f1f5f9] align-middle relative">
        <ShadcnSelect
          value={strVal}
          options={shadcnOptions}
          ariaLabel={col.headerName}
          hasError={isEmptyRequired}
          ariaDescribedBy={isEmptyRequired ? errorId : undefined}
          size={isCompact ? 'cell-compact' : 'cell-comfortable'}
          placeholder="Chọn"
          onFocus={() => { setIsFocused(true); onCellTouch?.(cellKey); }}
          onBlur={() => { setIsFocused(false); setHasBlurred(true); }}
          onChange={(nextVal) => {
            onCellTouch?.(cellKey);
            onCellChange(rowId, col.field, nextVal);
          }}
        />
        {isEmptyRequired && (
          <span id={errorId} className="text-[11px] text-[var(--fix)] mt-0.5 px-1 font-medium flex items-center gap-0.5">
            <AlertCircle className="w-3 h-3 shrink-0" /> Bắt buộc chọn
          </span>
        )}
      </td>
    );
  }

  // 4. Number input cell (Uniform height h-9 / h-8)
  if (col.type === 'number') {
    return (
      <td style={colStyle} className="py-1 px-1.5 border-r border-[#f1f5f9] align-middle relative">
        <input
          type="number"
          value={strVal}
          aria-label={col.headerName}
          aria-invalid={isEmptyRequired || undefined}
          aria-describedby={isEmptyRequired ? errorId : undefined}
          onFocus={() => { setIsFocused(true); onCellTouch?.(cellKey); }}
          onBlur={() => { setIsFocused(false); setHasBlurred(true); }}
          onChange={(e) => {
            onCellTouch?.(cellKey);
            onCellChange(rowId, col.field, Number(e.target.value));
          }}
          className={`w-full ${uniformHeightClass} px-2.5 rounded-md border text-[13px] font-normal text-right outline-hidden tabular-nums ${cellStyle}`}
        />
        {isEmptyRequired && (
          <span id={errorId} className="text-[11px] text-[var(--fix)] mt-0.5 px-1 font-medium flex items-center gap-0.5">
            <AlertCircle className="w-3 h-3 shrink-0" /> Bắt buộc nhập
          </span>
        )}
      </td>
    );
  }

  // 5. Text & Code textarea cell — Tự động giãn chiều cao (auto-resize) & xuống dòng đầy đủ
  return (
    <td style={colStyle} className="py-1 px-1.5 border-r border-[#f1f5f9] align-middle relative">
      <textarea
        ref={textareaRef}
        rows={1}
        value={strVal}
        title={strVal}
        aria-label={col.headerName}
        aria-invalid={isEmptyRequired || undefined}
        aria-describedby={isEmptyRequired ? errorId : undefined}
        onFocus={() => { setIsFocused(true); onCellTouch?.(cellKey); }}
        onBlur={() => { setIsFocused(false); setHasBlurred(true); }}
        onChange={(e) => {
          onCellTouch?.(cellKey);
          onCellChange(rowId, col.field, e.target.value);
          e.target.style.height = 'auto';
          const minH = isCompact ? 32 : 36;
          e.target.style.height = `${Math.max(e.target.scrollHeight, minH)}px`;
        }}
        className={`w-full ${minHeightClass} py-1.5 px-2.5 rounded-md border text-[13px] font-normal leading-relaxed resize-none overflow-hidden whitespace-normal break-words outline-hidden ${cellStyle}`}
        placeholder="Nhập nội dung"
      />
      {isEmptyRequired && (
        <span id={errorId} className="text-[11px] text-[var(--fix)] mt-0.5 px-1 font-medium flex items-center gap-0.5">
          <AlertCircle className="w-3 h-3 shrink-0" /> Bắt buộc nhập
        </span>
      )}
    </td>
  );
}
