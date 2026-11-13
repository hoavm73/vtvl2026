'use client';

import React, { useState, useMemo } from 'react';
import { ExcelSheetMeta, GenericGridRow } from './excel-grid-types';
import {
  Pencil, Trash2, Copy, Plus, X, Search, ChevronRight,
  ArrowLeft, ArrowRight
} from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';

interface ExcelRowCardEditorProps {
  meta: ExcelSheetMeta;
  rows: GenericGridRow[];
  dynamicOptionsMap?: Record<string, string[]>;
  isC1Locked: boolean;
  touchedCells?: Set<string>;
  onCellTouch?: (cellKey: string) => void;
  onCellChange: (rowId: string, field: string, value: string | number) => void;
  onAddRow: () => void;
  onSplitRow?: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
}

export function ExcelRowCardEditor({
  meta, rows, dynamicOptionsMap, isC1Locked, touchedCells,
  onCellTouch, onCellChange, onAddRow, onSplitRow, onDeleteRow
}: ExcelRowCardEditorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(term)));
  }, [rows, searchTerm]);

  const editingRowIndex = useMemo(() => {
    if (!editingRowId) return -1;
    return rows.findIndex((r) => r.id === editingRowId);
  }, [rows, editingRowId]);

  const editingRow = useMemo(() => {
    if (editingRowIndex < 0) return null;
    return rows[editingRowIndex] || null;
  }, [rows, editingRowIndex]);

  const handlePrevRow = () => {
    if (editingRowIndex > 0) setEditingRowId(rows[editingRowIndex - 1].id);
  };

  const handleNextRow = () => {
    if (editingRowIndex < rows.length - 1) setEditingRowId(rows[editingRowIndex + 1].id);
  };

  const getPrimaryCode = (r: GenericGridRow) => String(r.maNhiemVu || r.maCongViec || r.maVtvl || r.maSpChuan || r.stt || '');
  const getPrimaryTitle = (r: GenericGridRow) => String(r.tenNhiemVu || r.tenCongViec || r.tenVtvl || r.tenSanPham || r.noiDung || '');
  const getSecondaryInfo = (r: GenericGridRow) => String(r.donViChuTri || r.sanPhamChuan || r.tenNgach || r.phuongAn2026 || r.canCu || '');

  return (
    <div className="w-full space-y-3">
      {/* Mobile Search & Add bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#64748b]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Tìm trong ${rows.length} dòng...`}
            className="w-full pl-9 pr-8 min-h-[44px] text-xs rounded-xl border border-[#cbd5e1] focus:ring-2 focus:ring-[#004776] outline-hidden text-[#004776] bg-white font-medium"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2.5 top-3 text-[#94a3b8] p-1">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {!isC1Locked && (
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-1 min-h-[44px] px-3.5 rounded-xl bg-[#004776] text-white text-xs font-bold shrink-0 hover:bg-[#00385c] active:scale-95 shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" /><span>Thêm</span>
          </button>
        )}
      </div>

      {/* Row Cards List */}
      <div className="space-y-2.5">
        {filteredRows.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-dashed border-[#cbd5e1] text-xs text-[#64748b]">
            {searchTerm ? 'Không tìm thấy dòng khớp.' : 'Chưa có dòng dữ liệu nào.'}
          </div>
        ) : (
          filteredRows.map((row) => {
            const rowNumber = rows.findIndex((r) => r.id === row.id) + 1;
            const primaryCode = getPrimaryCode(row);
            const primaryTitle = getPrimaryTitle(row);
            const secondary = getSecondaryInfo(row);

            return (
              <div key={row.id} className="bg-white rounded-xl border border-[#cbd5e1] hover:border-[#004776]/50 p-3.5 shadow-2xs space-y-2.5 transition-all">
                {/* Header card: Dòng X/{rows.length} + Mã + Action */}
                <div className="flex items-center justify-between gap-2 border-b border-[#f1f5f9] pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-[#004776]/10 text-[#004776]">
                      Dòng {rowNumber}/{rows.length}
                    </span>
                    {primaryCode && (
                      <span className="text-xs font-bold text-[#004776] bg-slate-100 px-2 py-0.5 rounded">
                        {primaryCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {meta.key === 'A1' && (
                      <button type="button" onClick={() => onSplitRow?.(row.id)} title="Tách nhiệm vụ" className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer">
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    {!isC1Locked && (
                      <button type="button" onClick={() => onDeleteRow(row.id)} title="Xóa dòng" className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 2-3 trường chính hiển thị trước */}
                <div className="cursor-pointer space-y-1" onClick={() => setEditingRowId(row.id)}>
                  <p className="text-xs font-bold text-[#004776] leading-snug line-clamp-3">
                    {primaryTitle || '(Chưa nhập tiêu đề)'}
                  </p>
                  {secondary && <p className="text-[11px] text-[#64748b] line-clamp-2">{secondary}</p>}
                </div>

                {/* Nút Xem thêm & Chỉnh sửa */}
                <div className="pt-1 flex items-center justify-between border-t border-[#f8fafc]">
                  <span className="text-[11px] text-[#94a3b8]">{meta.columns.length} trường</span>
                  <button
                    type="button"
                    onClick={() => setEditingRowId(row.id)}
                    className="inline-flex items-center gap-1 min-h-[44px] px-3.5 py-1 text-xs font-bold text-[#004776] bg-blue-50 hover:bg-[#004776] hover:text-white rounded-xl transition-all cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" /><span>Chỉnh sửa chi tiết</span><ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Mobile Detail Editor Drawer */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs select-none p-0 sm:p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl border border-[#cbd5e1] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header Drawer */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#005fa3] text-white border-b border-[#004776]">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-[#004776] text-white">
                  Dòng {editingRowIndex + 1}/{rows.length}
                </span>
                <h3 className="text-sm font-bold text-white truncate max-w-[180px]">
                  {meta.sheetName} — {getPrimaryCode(editingRow) || 'Chi tiết'}
                </h3>
              </div>
              <button type="button" onClick={() => setEditingRowId(null)} className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-[#004776] cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fields list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              {meta.columns.map((col) => {
                const val = editingRow[col.field];
                const cellKey = `${editingRow.id}_${col.field}`;
                const isTouched = touchedCells?.has(cellKey) ?? false;
                const isComputed = col.isFormula || col.readOnly || isC1Locked;
                const dynamicOpts = col.dynamicOptionsKey && dynamicOptionsMap?.[col.dynamicOptionsKey];
                const selectOpts = dynamicOpts && dynamicOpts.length > 0 ? dynamicOpts : (col.selectOptions || []);
                const inputCls = `w-full min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium text-[#004776] focus:ring-2 focus:ring-[#004776] outline-hidden ${isTouched ? 'border-amber-400 bg-amber-50/20' : 'border-[#cbd5e1] bg-white'}`;

                return (
                  <div key={col.field} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <label className="font-bold text-[#004776]">{col.headerName}</label>
                      {col.isFormula && <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">=fx tự tính</span>}
                    </div>

                    {isComputed ? (
                      <div className="p-2.5 rounded-xl bg-[#f8fafc] border border-[#cbd5e1] text-xs font-medium text-[#004776] break-words">
                        {val !== undefined && val !== '' ? String(val) : '—'}
                      </div>
                    ) : col.type === 'select' || selectOpts.length > 0 ? (
                      <ShadcnSelect
                        value={String(val ?? '')}
                        onValueChange={(v) => { onCellTouch?.(cellKey); onCellChange(editingRow.id, col.field, v); }}
                        options={[{ value: '', label: 'Chọn' }, ...selectOpts.map((opt) => ({ value: opt, label: opt }))]}
                        placeholder="Chọn"
                        size="md"
                      />
                    ) : col.type === 'number' ? (
                      <input
                        type="number"
                        value={val !== undefined && val !== '' ? String(val) : ''}
                        placeholder="Nhập nội dung"
                        onFocus={() => onCellTouch?.(cellKey)}
                        onChange={(e) => {
                          onCellTouch?.(cellKey);
                          const raw = e.target.value;
                          onCellChange(editingRow.id, col.field, raw === '' ? '' : Number(raw));
                        }}
                        className={`${inputCls} text-right placeholder:text-left placeholder:text-xs placeholder:text-[#94a3b8]`}
                      />
                    ) : (
                      <textarea rows={3} value={String(val ?? '')} onFocus={() => onCellTouch?.(cellKey)} onChange={(e) => { onCellTouch?.(cellKey); onCellChange(editingRow.id, col.field, e.target.value); }} className={inputCls} placeholder="Nhập nội dung" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer Drawer: Dòng trước, Dòng sau & Đóng */}
            <div className="p-3 bg-[#f8fafc] border-t border-[#cbd5e1] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevRow}
                  disabled={editingRowIndex <= 0}
                  className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-xl border border-[#cbd5e1] bg-white text-xs font-semibold text-[#004776] disabled:opacity-40 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /><span>Trước</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextRow}
                  disabled={editingRowIndex >= rows.length - 1}
                  className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-xl border border-[#cbd5e1] bg-white text-xs font-semibold text-[#004776] disabled:opacity-40 cursor-pointer"
                >
                  <span>Tiếp</span><ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setEditingRowId(null)}
                className="min-h-[44px] px-5 rounded-xl bg-[#004776] text-white text-xs font-bold hover:bg-[#00385c] cursor-pointer shadow-xs"
              >
                Xong &amp; Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
