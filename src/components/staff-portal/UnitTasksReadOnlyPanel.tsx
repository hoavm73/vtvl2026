'use client';

import React from 'react';
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
  const b1Map = new Map(unitB1Volumes.map((b) => [String(b.maCongViec || ''), b]));

  return (
    <div className="xl:col-span-5 bg-white rounded-2xl border border-[#cbd5e1] shadow-xs overflow-hidden">
      <div className="px-5 py-3.5 bg-[#f8fafc] border-b border-[#e2e8f0]">
        <h2 className="text-base font-bold text-[#004776]">
          Danh sách công việc của đơn vị ({unitA2Tasks.length})
        </h2>
        <p className="text-xs text-[#64748b]">
          Dữ liệu tổng hợp từ Biểu A2 & B1 [{unitCode}] (chế độ chỉ đọc tham chiếu).
        </p>
      </div>

      <div className="max-h-[640px] overflow-y-auto divide-y divide-[#f1f5f9]">
        {unitA2Tasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#64748b]">Đơn vị chưa có danh sách công việc.</div>
        ) : (
          unitA2Tasks.map((row, idx) => {
            const b1 = b1Map.get(String(row.maCongViec || ''));
            const statusLabel = String(row.trangThaiPhieu || 'Đã nộp');
            return (
              <div key={`${row.id || idx}`} className="p-3.5 text-xs space-y-1 hover:bg-[#f8fafc]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[#004776]">{String(row.maCongViec || '')}</span>
                    <span className="text-[#64748b]">• {String(row.maVtvl || '')}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
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
                    SL: {String(b1.soSpNam ?? 0)} SP • Tổng: {String(b1.gioTong ?? 0)} giờ/năm
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
