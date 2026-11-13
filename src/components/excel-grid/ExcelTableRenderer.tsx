'use client';

import React, { useState } from 'react';
import { ExcelSheetMeta, GenericGridRow } from './excel-grid-types';
import { ExcelDataCell } from './ExcelDataCell';
import { ExcelRowCardEditor } from './ExcelRowCardEditor';
import { TableDeleteConfirmModal } from './TableDeleteConfirmModal';
import { TableControlBar } from './TableControlBar';
import { ArrowUpDown, Plus, Trash2, Copy } from 'lucide-react';
import { useQueryFilter } from '@/services/query/use-query-filter';
import { ShadcnSelectOption } from '@/components/ui/ShadcnSelect';

interface ExcelTableRendererProps {
  meta: ExcelSheetMeta;
  rows: GenericGridRow[];
  dynamicOptionsMap?: Record<string, (string | ShadcnSelectOption)[]>;
  lastSaved?: string;
  lastSavedSheet?: string;
  isC1Unlocked?: boolean;
  touchedCells?: Set<string>;
  onCellTouch?: (cellKey: string) => void;
  onCellChange: (rowId: string, field: string, value: string | number) => void;
  onAddRow: () => void;
  onSplitRow?: (rowId: string) => void;
  onDeleteRow: (rowId: string | string[]) => void;
  onSaveSheet?: () => void;
  onSaveAndNext?: () => void;
  canNext?: boolean;
}

type TableQueryFilterParams = {
  q: string;
  filter: 'all' | 'touched' | 'incomplete';
  sort: string;
  order: 'asc' | 'desc';
};

export function ExcelTableRenderer({
  meta, rows, dynamicOptionsMap,
  isC1Unlocked = false, touchedCells, onCellTouch, onCellChange,
  onAddRow, onSplitRow, onDeleteRow
}: ExcelTableRendererProps) {
  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lastDeletedCount, setLastDeletedCount] = useState<number>(0);
  const [deletedRowBackup, setDeletedRowBackup] = useState<{ row: GenericGridRow; index: number } | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<'table' | 'cards'>('table');

  const isC1Locked = false;

  const { params, setParam, setParams, data: processedRows } = useQueryFilter<GenericGridRow, TableQueryFilterParams>({
    queryKey: ['excel-sheet-rows', meta.key],
    initialParams: { q: '', filter: 'all', sort: '', order: 'asc' },
    data: rows,
    syncUrl: true,
    queryFn: ({ params: p, data }) => {
      let res = [...data];
      if (p.filter === 'touched') {
        res = res.filter((r) => meta.columns.some((c) => touchedCells?.has(`${r.id}_${c.field}`)));
      } else if (p.filter === 'incomplete') {
        res = res.filter((r) => meta.columns.some((c) => c.required && !String(r[c.field] ?? '').trim()));
      }
      if (p.q.trim()) {
        const term = p.q.trim().toLowerCase();
        res = res.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(term)));
      }
      if (p.sort) {
        res.sort((a, b) => {
          const valA = a[p.sort] ?? '';
          const valB = b[p.sort] ?? '';
          if (typeof valA === 'number' && typeof valB === 'number') {
            return p.order === 'asc' ? valA - valB : valB - valA;
          }
          return p.order === 'asc'
            ? String(valA).localeCompare(String(valB), 'vi')
            : String(valB).localeCompare(String(valA), 'vi');
        });
      }
      return res;
    }
  });

  const handleSort = (field: string) => {
    if (params.sort === field) {
      if (params.order === 'asc') setParam('order', 'desc');
      else setParams({ sort: '', order: 'asc' });
    } else {
      setParams({ sort: field, order: 'asc' });
    }
  };

  const allSelected = processedRows.length > 0 && processedRows.every((r) => selectedRowIds.has(r.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedRowIds(new Set());
    else setSelectedRowIds(new Set(processedRows.map((r) => r.id)));
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRowIds(next);
  };

  const handleDeleteRow = (rowId: string) => {
    if (selectedRowIds.size > 1 && selectedRowIds.has(rowId)) {
      setConfirmDeleteId('selected');
      return;
    }
    const idx = rows.findIndex((r) => r.id === rowId);
    if (idx >= 0) setDeletedRowBackup({ row: rows[idx], index: idx });
    setLastDeletedCount(1);
    onDeleteRow(rowId);
    if (selectedRowIds.has(rowId)) {
      const next = new Set(selectedRowIds);
      next.delete(rowId);
      setSelectedRowIds(next);
    }
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteId) return;
    const ids = Array.from(selectedRowIds);
    if (ids.length > 0) {
      onDeleteRow(ids);
      setLastDeletedCount(ids.length);
      setSelectedRowIds(new Set());
    }
    setConfirmDeleteId(null);
    setDeletedRowBackup(null);
  };

  return (
    <div className={`flex flex-col bg-white overflow-hidden w-full max-w-full min-w-0 transition-all ${isFullscreen ? 'fixed inset-2 z-50 rounded-xl border border-[#cbd5e1] shadow-xl' : 'h-full'}`}>
      <TableDeleteConfirmModal
        confirmDeleteId={confirmDeleteId} selectedCount={selectedRowIds.size}
        lastDeletedCount={lastDeletedCount} deletedRowBackup={deletedRowBackup}
        onCancel={() => setConfirmDeleteId(null)} onConfirm={handleConfirmDelete}
        onRestoreBackup={() => { onAddRow(); setDeletedRowBackup(null); }}
      />

      <TableControlBar
        meta={meta} rowsCount={processedRows.length} selectedCount={selectedRowIds.size}
        isC1Locked={isC1Locked} searchTerm={params.q} filterMode={params.filter}
        density={density} isFullscreen={isFullscreen} mobileViewMode={mobileViewMode}
        onMobileViewModeChange={setMobileViewMode} onAddRow={onAddRow}
        onDeleteSelected={() => setConfirmDeleteId('selected')}
        onSearchChange={(val) => setParam('q', val)} onFilterModeChange={(mode) => setParam('filter', mode)}
        onDensityChange={setDensity} onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
      />

      {/* MOBILE CARD MODE (Optional toggle on < 768px) */}
      {mobileViewMode === 'cards' && (
        <div className="block md:hidden p-3 bg-[#f8fafc]/50">
          <ExcelRowCardEditor
            meta={meta}
            rows={processedRows}
            dynamicOptionsMap={dynamicOptionsMap}
            isC1Locked={isC1Locked}
            touchedCells={touchedCells}
            onCellTouch={onCellTouch}
            onCellChange={onCellChange}
            onAddRow={onAddRow}
            onSplitRow={onSplitRow}
            onDeleteRow={(id) => handleDeleteRow(id)}
          />
        </div>
      )}

      {/* BẢNG DỮ LIỆU CHÍNH (Cuộn ngang trên mobile/tablet/desktop, giữ khả năng đối chiếu dòng/cột) */}
      <div className={`${mobileViewMode === 'cards' ? 'hidden md:block' : 'block'} flex-1 overflow-x-auto overflow-y-auto max-h-[650px] select-text w-full max-w-full`}>
        <table className="w-full text-[13.5px] border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#f8fafc] text-[#004776] border-b border-[#cbd5e1]">
              <th className="w-10 min-w-[40px] py-2.5 px-2 text-center border-r border-[#e2e8f0] sticky left-0 z-11 bg-[#f8fafc]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Chọn tất cả dòng"
                  className="rounded border-[#cbd5e1] text-[#004776] focus:ring-[#004776] cursor-pointer"
                />
              </th>
              <th
                onClick={() => handleSort('id')}
                className="w-12 min-w-[48px] py-2.5 px-1 text-center font-semibold border-r border-[#e2e8f0] cursor-pointer hover:bg-[#f1f5f9] select-none"
              >
                <div className="inline-flex items-center gap-1 justify-center">
                  <span>STT</span>
                  <ArrowUpDown className="w-3 h-3 text-[#94a3b8]" />
                </div>
              </th>
              {meta.columns.map((c) => (
                <th
                  key={c.field}
                  style={{ width: c.width || '150px', minWidth: c.width || '140px' }}
                  onClick={() => handleSort(c.field)}
                  className="py-2.5 px-2.5 text-left font-semibold border-r border-[#e2e8f0] align-middle cursor-pointer hover:bg-[#f1f5f9] select-none"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="leading-snug">
                      {c.headerName}
                      {c.required && <span className="text-[var(--fix)] ml-0.5">*</span>}
                    </span>
                    <ArrowUpDown className="w-3 h-3 text-[#94a3b8] shrink-0" />
                  </div>
                </th>
              ))}
              <th className="w-16 min-w-[64px] py-2.5 px-2 text-center font-semibold sticky right-0 z-11 bg-[#f8fafc] border-l border-[#e2e8f0] select-none text-[#476885]">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {processedRows.length === 0 ? (
              <tr><td colSpan={meta.columns.length + 3} className="py-12 text-center text-[#476885] bg-[#fafafa]">Không có dữ liệu phù hợp.</td></tr>
            ) : (
              processedRows.map((row, rIdx) => (
                <tr key={row.id} className="odd:bg-white even:bg-[#fafcff] hover:bg-[#f0f7ff] transition-colors group">
                  <td className="w-10 py-1.5 px-2 text-center border-r border-[#f1f5f9] sticky left-0 z-2 bg-inherit">
                    <input
                      type="checkbox"
                      checked={selectedRowIds.has(row.id)}
                      onChange={() => toggleSelectRow(row.id)}
                      aria-label={`Chọn dòng ${rIdx + 1}`}
                      className="rounded border-[#cbd5e1] text-[#004776] focus:ring-[#004776] cursor-pointer"
                    />
                  </td>
                  <td className="w-12 py-1.5 text-center font-normal tabular-nums text-[#476885] border-r border-[#f1f5f9] select-none">
                    {rIdx + 1}
                  </td>
                  {meta.columns.map((col) => (
                    <ExcelDataCell
                      key={col.field} col={col} val={row[col.field]} rowId={row.id}
                      isComputed={col.isFormula || col.readOnly || isC1Locked}
                      isTouched={touchedCells?.has(`${row.id}_${col.field}`) ?? false}
                      cellKey={`${row.id}_${col.field}`}
                      dynamicOptions={col.dynamicOptionsKey ? dynamicOptionsMap?.[col.dynamicOptionsKey] : undefined}
                      density={density} onCellTouch={onCellTouch} onCellChange={onCellChange}
                    />
                  ))}
                  <td className="w-16 py-1 px-1.5 text-center sticky right-0 z-2 bg-inherit border-l border-[#f1f5f9]">
                    <div className="flex items-center justify-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      {meta.key === 'A1' && (
                        <button
                          type="button"
                          onClick={() => onSplitRow?.(row.id)}
                          aria-label={`Tách nhiệm vụ dòng ${rIdx + 1}`}
                          title="Tách nhiệm vụ"
                          className="w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center text-[#004776] hover:bg-[#e6f0f8] rounded-md cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isC1Locked && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          aria-label={`Xóa dòng ${rIdx + 1}`}
                          title="Xóa dòng"
                          className="w-9 h-9 sm:w-8 sm:h-8 inline-flex items-center justify-center text-[var(--fix)] hover:bg-[var(--fix-soft)] rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER BẢNG */}
      <div className="px-4 py-2 bg-[#f8fafc] border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[#476885]">
        {!isC1Locked ? (
          <button
            type="button"
            onClick={onAddRow}
            className="inline-flex items-center gap-1.5 h-8 px-3 font-medium text-[#004776] bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-lg cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{meta.key === 'A1' ? 'Thêm nhiệm vụ' : 'Thêm dòng mới'}</span>
          </button>
        ) : <div />}

        <div className="tabular-nums">
          <span>Hiển thị <strong className="font-semibold text-[#004776]">{processedRows.length}</strong> / {rows.length} dòng</span>
        </div>
      </div>
    </div>
  );
}
