'use client';

import React, { useState, useMemo } from 'react';
import { ExcelSheetMeta, GenericGridRow } from './excel-grid-types';
import {
  Pencil, Trash2, Copy, X, ChevronRight, ArrowLeft, ArrowRight
} from 'lucide-react';
import { ShadcnSelect, ShadcnSelectOption } from '@/components/ui/ShadcnSelect';
import { ListPaginationBar } from '@/components/ui/ListPaginationBar';
import { usePersistedListState } from '@/services/query/use-persisted-list-state';

interface ExcelRowCardEditorProps {
  meta: ExcelSheetMeta;
  rows: GenericGridRow[];
  dynamicOptionsMap?: Record<string, (string | ShadcnSelectOption)[]>;
  isC1Locked: boolean;
  touchedCells?: Set<string>;
  onCellTouch?: (cellKey: string) => void;
  onCellChange: (rowId: string, field: string, value: string | number) => void;
  onAddRow?: () => void;
  onSplitRow?: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
}

const getPrimaryCode = (r: GenericGridRow) => String(r.maNhiemVu || r.maCongViec || r.maVtvl || r.maSpChuan || r.stt || '');
const getPrimaryTitle = (r: GenericGridRow) => String(r.tenNhiemVu || r.tenCongViec || r.tenVtvl || r.tenSanPham || r.noiDung || '');
const getSecondaryInfo = (r: GenericGridRow) => String(r.donViChuTri || r.sanPhamChuan || r.tenNgach || r.phuongAn2026 || r.canCu || '');

export function ExcelRowCardEditor({
  meta, rows, dynamicOptionsMap, isC1Locked, touchedCells,
  onCellTouch, onCellChange, onSplitRow, onDeleteRow
}: ExcelRowCardEditorProps) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const { state: listState, setField, highlightedId, saveScrollAnchor, restoreAnchorNow } = usePersistedListState(
    `excel-cards-${meta.key}`,
    { limit: 10 },
    { readyToScroll: rows.length > 0 }
  );

  const visibleRows = useMemo(() => rows.slice(0, listState.limit), [rows, listState.limit]);
  const editingRowIndex = useMemo(() => (editingRowId ? rows.findIndex((r) => r.id === editingRowId) : -1), [rows, editingRowId]);
  const editingRow = editingRowIndex >= 0 ? rows[editingRowIndex] || null : null;

  const openRowEditor = (rowId: string) => {
    saveScrollAnchor(rowId);
    setEditingRowId(rowId);
  };

  const closeRowEditor = () => {
    const targetId = editingRowId || undefined;
    setEditingRowId(null);
    restoreAnchorNow(targetId);
  };

  const handlePrevRow = () => {
    if (editingRowIndex > 0) setEditingRowId(rows[editingRowIndex - 1].id);
  };

  const handleNextRow = () => {
    if (editingRowIndex < rows.length - 1) setEditingRowId(rows[editingRowIndex + 1].id);
  };

  return (
    <div className="w-full space-y-2.5">
      {visibleRows.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-dashed border-[#cbd5e1] text-xs text-[#476885]">
          Không có dữ liệu phù hợp trong biểu này.
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleRows.map((row, idx) => {
            const primaryCode = getPrimaryCode(row);
            const primaryTitle = getPrimaryTitle(row);
            const secondary = getSecondaryInfo(row);
            const isHighlighted = highlightedId === row.id;

            return (
              <div
                key={row.id}
                data-row-anchor={row.id}
                style={{ contentVisibility: 'auto' }}
                className={`rounded-xl border p-3.5 shadow-2xs space-y-2.5 transition-all ${
                  isHighlighted ? 'bg-[#e6f1ff] border-[#006cee] ring-2 ring-[#006cee]/40' : 'bg-white border-[#cbd5e1] hover:border-[#004776]/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#f1f5f9] pb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#004776]/10 text-[#004776] tabular-nums shrink-0">
                      Dòng {idx + 1}/{rows.length}
                    </span>
                    {primaryCode && (
                      <span className="text-xs font-bold text-[#004776] bg-slate-100 px-2 py-0.5 rounded truncate">
                        {primaryCode}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {meta.key === 'A1' && !isC1Locked && (
                      <button type="button" onClick={() => onSplitRow?.(row.id)} aria-label={`Tách nhiệm vụ dòng ${idx + 1}`} title="Tách nhiệm vụ" className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer">
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    {!isC1Locked && (
                      <button type="button" onClick={() => onDeleteRow(row.id)} aria-label={`Xóa dòng ${idx + 1} ${primaryCode}`} title="Xóa dòng" className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="cursor-pointer space-y-1" onClick={() => openRowEditor(row.id)}>
                  <p className="text-[13px] font-bold text-[#004776] leading-snug line-clamp-3">
                    {primaryTitle || '(Chưa nhập tiêu đề)'}
                  </p>
                  {secondary && <p className="text-[11px] text-[#476885] line-clamp-2">{secondary}</p>}
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-[#f8fafc]">
                  <span className="text-[11px] text-[#476885]">{meta.columns.length} trường dữ liệu</span>
                  <button
                    type="button"
                    onClick={() => openRowEditor(row.id)}
                    className="inline-flex items-center gap-1 min-h-[40px] px-3.5 py-1 text-xs font-bold text-[#004776] bg-blue-50 hover:bg-[#004776] hover:text-white rounded-xl transition-all cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{isC1Locked ? 'Xem chi tiết' : 'Chỉnh sửa chi tiết'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-[#e2e8f0] bg-white">
        <ListPaginationBar
          totalCount={rows.length}
          visibleCount={listState.limit}
          step={10}
          unitLabel="dòng"
          onChangeVisibleCount={(n) => setField('limit', n)}
        />
      </div>

      {/* Mobile Detail Editor Drawer */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#004776]/55 backdrop-blur-xs select-none p-0 sm:p-4" role="dialog" aria-modal="true" onClick={closeRowEditor}>
          <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl border border-[#cbd5e1] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 bg-[#005fa3] text-white border-b border-[#004776]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-[#004776] text-white shrink-0">
                  Dòng {editingRowIndex + 1}/{rows.length}
                </span>
                <h3 className="text-sm font-bold text-white truncate">
                  {meta.sheetName} — {getPrimaryCode(editingRow) || 'Chi tiết'}
                </h3>
              </div>
              <button type="button" onClick={closeRowEditor} aria-label="Đóng" className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-[#004776] cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

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
                        options={[{ value: '', label: 'Chọn' }, ...selectOpts.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt))]}
                        placeholder="Chọn"
                        allowCustom={Boolean(col.allowCustom)}
                        displayValue={col.field === 'maVtvl'}
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
                        className={`${inputCls} text-right placeholder:text-left placeholder:text-xs placeholder:text-[#476885]`}
                      />
                    ) : (
                      <textarea rows={3} value={String(val ?? '')} onFocus={() => onCellTouch?.(cellKey)} onChange={(e) => { onCellTouch?.(cellKey); onCellChange(editingRow.id, col.field, e.target.value); }} className={inputCls} placeholder="Nhập nội dung" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-[#f8fafc] border-t border-[#cbd5e1] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={handlePrevRow} disabled={editingRowIndex <= 0} className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-xl border border-[#cbd5e1] bg-white text-xs font-semibold text-[#004776] disabled:opacity-40 cursor-pointer">
                  <ArrowLeft className="w-3.5 h-3.5" /><span>Trước</span>
                </button>
                <button type="button" onClick={handleNextRow} disabled={editingRowIndex >= rows.length - 1} className="inline-flex items-center gap-1 min-h-[44px] px-3 rounded-xl border border-[#cbd5e1] bg-white text-xs font-semibold text-[#004776] disabled:opacity-40 cursor-pointer">
                  <span>Tiếp</span><ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <button type="button" onClick={closeRowEditor} className="min-h-[44px] px-5 rounded-xl bg-[#004776] text-white text-xs font-bold hover:bg-[#00385c] cursor-pointer shadow-xs">
                Xong &amp; Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
