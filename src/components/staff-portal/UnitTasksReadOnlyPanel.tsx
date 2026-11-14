'use client';

import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';

interface UnitTasksReadOnlyPanelProps {
  unitCode: string;
  unitA2Tasks: GenericGridRow[];
  unitB1Volumes: GenericGridRow[];
}

export function UnitTasksReadOnlyPanel({
  unitCode,
  unitA2Tasks,
  unitB1Volumes
}: UnitTasksReadOnlyPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const b1Map = new Map(unitB1Volumes.map((b) => [String(b.maCongViec || ''), b]));

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return unitA2Tasks;
    return unitA2Tasks.filter((row) => {
      const taskCode = String(row.maCongViec || '').toLowerCase();
      const taskName = String(row.tenCongViec || '').toLowerCase();
      const vtvl = String(row.maVtvl || '').toLowerCase();
      const sanPham = String(row.sanPham || '').toLowerCase();
      return taskCode.includes(q) || taskName.includes(q) || vtvl.includes(q) || sanPham.includes(q);
    });
  }, [unitA2Tasks, searchQuery]);

  return (
    <div className="xl:col-span-5 bg-white rounded-2xl border border-[#cbd5e1] shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 bg-[#f8fafc] border-b border-[#e2e8f0] space-y-2.5">
        <div>
          <h2 className="text-base font-bold text-[#004776]">
            Danh sách công việc của đơn vị ({searchQuery ? `${filteredTasks.length}/${unitA2Tasks.length}` : unitA2Tasks.length})
          </h2>
          <p className="text-xs text-[#64748b]">
            Dữ liệu tổng hợp từ Biểu A2 & B1 [{unitCode}] (chế độ chỉ đọc tham chiếu).
          </p>
        </div>

        {/* Ô tìm kiếm công việc đơn vị */}
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-[#64748b] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên công việc, mã CV, mã VTVL..."
            className="w-full h-9 pl-9 pr-8 text-xs rounded-xl border border-[#cbd5e1] bg-white text-[#004776] placeholder:text-[#94a3b8] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 p-1 text-[#64748b] hover:text-[#004776] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-[640px] overflow-y-auto divide-y divide-[#f1f5f9]">
        {unitA2Tasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748b]">Đơn vị chưa có danh sách công việc.</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748b]">
            Không tìm thấy công việc nào khớp với &quot;{searchQuery}&quot;.
          </div>
        ) : (
          filteredTasks.map((row, idx) => {
            const b1 = b1Map.get(String(row.maCongViec || ''));
            const statusLabel = String(row.trangThaiPhieu || 'Đã nộp');
            return (
              <div key={`${row.id || idx}`} className="p-3.5 text-xs space-y-1 hover:bg-[#f8fafc] transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-[#0072BC] bg-[#eef5ff] px-1.5 py-0.5 rounded-sm shrink-0">
                      {String(row.maCongViec || '')}
                    </span>
                    <span className="text-[#64748b] truncate">• {String(row.maVtvl || '')}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                      statusLabel === 'Nháp'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div className="text-[#004776] font-medium leading-snug">{String(row.tenCongViec || '')}</div>
                {b1 && (
                  <div className="text-[11px] text-[#64748b]">
                    SL: <strong>{String(b1.soSpNam ?? 0)}</strong> SP • Tổng: <strong>{String(b1.gioTong ?? 0)}</strong> giờ/năm
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
