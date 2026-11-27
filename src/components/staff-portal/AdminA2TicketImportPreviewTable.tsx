'use client';

import React from 'react';
import { ParsedA2TicketRow, UnitAccountLite } from '@/services/tickets/a2-ticket-excel-service';

interface AdminA2TicketImportPreviewTableProps {
  rows: ParsedA2TicketRow[];
  unitAccounts: UnitAccountLite[];
  ownerOverrides: Record<number, string>;
  duplicateDecisions: Record<number, 'skip' | 'add_new'>;
  onChangeOwner: (rowIndex: number, email: string) => void;
  onChangeDuplicate: (rowIndex: number, decision: 'skip' | 'add_new') => void;
}

export function AdminA2TicketImportPreviewTable({
  rows,
  unitAccounts,
  ownerOverrides,
  duplicateDecisions,
  onChangeOwner,
  onChangeDuplicate
}: AdminA2TicketImportPreviewTableProps) {
  return (
    <div className="rounded-[10px] border border-[#cbd5e1] overflow-hidden bg-white">
      <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
        <table className="w-full text-xs text-left border-collapse min-w-[940px]">
          <thead className="sticky top-0 z-10 bg-[#f1f6fc] text-[#004776] border-b border-[#cbd5e1]">
            <tr>
              <th className="py-2 px-2.5 font-bold w-12">Dòng</th>
              <th className="py-2 px-2.5 font-bold w-28">Mã NV (A1)</th>
              <th className="py-2 px-2.5 font-bold w-28">Mã VTVL (C1)</th>
              <th className="py-2 px-2.5 font-bold min-w-[220px]">Tên công việc cụ thể</th>
              <th className="py-2 px-2.5 font-bold min-w-[150px]">Sản phẩm đầu ra</th>
              <th className="py-2 px-2.5 font-bold min-w-[210px]">Cán bộ sở hữu phiếu *</th>
              <th className="py-2 px-2.5 font-bold w-40">Trạng thái nạp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0] text-[#004776]">
            {rows.map((r) => {
              const effectiveOwner = ownerOverrides[r.rowIndex] ?? r.ownerEmail;
              const dupDecision = duplicateDecisions[r.rowIndex] || 'skip';
              const missingOwner = !effectiveOwner;
              const hasHardError = r.errors.length > 0 || missingOwner;
              const rowBg = hasHardError
                ? 'bg-[#fff5f5]'
                : r.isDuplicate
                  ? dupDecision === 'add_new'
                    ? 'bg-[#f0fdf4]'
                    : 'bg-[#fffbeb]'
                  : 'bg-white';

              return (
                <tr key={r.rowIndex} className={rowBg}>
                  <td className="py-2 px-2.5 font-mono text-[11px] text-[#476885] tabular-nums">
                    {r.rowIndex}
                  </td>
                  <td className="py-2 px-2.5 font-semibold whitespace-nowrap">{r.maNhiemVu || '—'}</td>
                  <td className="py-2 px-2.5 font-semibold whitespace-nowrap">{r.maVtvl || '—'}</td>
                  <td className="py-2 px-2.5">
                    <div className="font-medium leading-snug">{r.tenCongViec || '—'}</div>
                    {r.errors.length > 0 && (
                      <div className="text-[11px] text-[#b42318] font-medium mt-0.5">
                        {r.errors.join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2.5 text-[#476885]">{r.sanPham || '—'}</td>
                  <td className="py-2 px-2.5">
                    <select
                      aria-label={`Chọn cán bộ cho dòng ${r.rowIndex}`}
                      value={effectiveOwner}
                      onChange={(e) => onChangeOwner(r.rowIndex, e.target.value)}
                      className={`w-full h-8 px-2 rounded-md border text-[11.5px] font-medium bg-white outline-none ${
                        missingOwner
                          ? 'border-[#f4212e] text-[#b42318]'
                          : 'border-[#cbd5e1] text-[#004776] focus:border-[#006cee]'
                      }`}
                    >
                      <option value="">
                        {r.rawOwner ? `Chưa khớp: "${r.rawOwner}" — Chọn cán bộ` : '— Chọn cán bộ thuộc đơn vị —'}
                      </option>
                      {unitAccounts.map((acc) => (
                        <option key={acc.email} value={acc.email}>
                          {acc.displayName} ({acc.email})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2.5">
                    {hasHardError ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-[#fdeceb] text-[#b42318] text-[11px] font-semibold">
                        {missingOwner ? 'Thiếu cán bộ' : 'Thiếu dữ liệu'}
                      </span>
                    ) : r.isDuplicate ? (
                      <div className="space-y-1">
                        <div className="text-[10.5px] font-semibold text-[#92400e]">
                          Trùng {r.duplicateCode || 'phiếu đã có'}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onChangeDuplicate(r.rowIndex, 'skip')}
                            className={`px-2 py-0.5 rounded text-[10.5px] font-semibold cursor-pointer ${
                              dupDecision === 'skip'
                                ? 'bg-[#004776] text-white'
                                : 'bg-white border border-[#cbd5e1] text-[#004776]'
                            }`}
                          >
                            Bỏ qua
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeDuplicate(r.rowIndex, 'add_new')}
                            className={`px-2 py-0.5 rounded text-[10.5px] font-semibold cursor-pointer ${
                              dupDecision === 'add_new'
                                ? 'bg-[#006cee] text-white'
                                : 'bg-white border border-[#cbd5e1] text-[#004776]'
                            }`}
                          >
                            Thêm mới
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-[#e6f9f1] text-[#008f5d] text-[11px] font-semibold">
                        Sẵn sàng nạp
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
