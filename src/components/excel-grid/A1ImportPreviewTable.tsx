'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { A1ImportParsedRow } from '@/services/a1/a1-excel-service';

interface A1ImportPreviewTableProps {
  rows: A1ImportParsedRow[];
  duplicateCount: number;
  duplicateDecisions: Record<number, 'skip' | 'add_new'>;
  onChangeDecision: (excelRow: number, decision: 'skip' | 'add_new') => void;
  onSetAllDuplicates: (decision: 'skip' | 'add_new') => void;
}

const ROW_BG: Record<A1ImportParsedRow['status'], string> = {
  new: 'bg-white hover:bg-[#f8fbff]',
  duplicate: 'bg-amber-50/45',
  unchanged: 'bg-[#f8fafc]/80',
  conflict: 'bg-amber-50/65',
  error: 'bg-[#fdeceb]/45'
};

export function A1ImportPreviewTable({
  rows,
  duplicateCount,
  duplicateDecisions,
  onChangeDecision,
  onSetAllDuplicates
}: A1ImportPreviewTableProps) {
  if (rows.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] text-center text-xs text-[#476885]">
        Sheet &ldquo;1. A1_NhiemVu&rdquo; trong tệp tải lên chưa có dòng dữ liệu nào để xem trước.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold text-[#004776]">
          Xem trước toàn bộ bảng Biểu A1 từ tệp tải lên ({rows.length} dòng)
        </div>
        {duplicateCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSetAllDuplicates('skip')}
              className="h-7 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[11px] font-semibold text-[#004776] cursor-pointer"
            >
              Bỏ qua tất cả trùng
            </button>
            <button
              type="button"
              onClick={() => onSetAllDuplicates('add_new')}
              className="h-7 px-2.5 rounded-lg border border-[#bcdcff] bg-[#eef5ff] hover:bg-[#dbeafe] text-[11px] font-semibold text-[#0058a3] cursor-pointer"
            >
              Thêm mới tất cả trùng
            </button>
          </div>
        )}
      </div>

      <div className="max-h-[52vh] overflow-auto rounded-xl border border-[#cbd5e1] shadow-2xs">
        <table className="w-full min-w-[920px] border-collapse text-left text-xs text-[#004776]">
          <thead className="sticky top-0 z-10 bg-[#f1f6fc] text-[#004776] border-b border-[#cbd5e1]">
            <tr>
              <th className="py-2.5 px-2.5 font-bold border-r border-[#e2e8f0] w-14 text-center">Dòng</th>
              <th className="py-2.5 px-2.5 font-bold border-r border-[#e2e8f0] w-32">Mã NV</th>
              <th className="py-2.5 px-2.5 font-bold border-r border-[#e2e8f0] min-w-[240px]">Tên nhiệm vụ được giao</th>
              <th className="py-2.5 px-2.5 font-bold border-r border-[#e2e8f0] w-40">Cơ quan / Đơn vị</th>
              <th className="py-2.5 px-2.5 font-bold border-r border-[#e2e8f0] min-w-[180px]">Căn cứ &amp; Nguồn</th>
              <th className="py-2.5 px-2.5 font-bold border-r border-[#e2e8f0] w-44">Kỳ &amp; Trạng thái</th>
              <th className="py-2.5 px-2.5 font-bold w-[215px]">Kiểm tra / Xác nhận</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {rows.map((r) => {
              const decision = duplicateDecisions[r.excelRow] || 'skip';
              return (
                <tr key={`a1-row-${r.excelRow}`} className={`${ROW_BG[r.status]} align-top transition-colors`}>
                  <td className="py-2.5 px-2.5 border-r border-[#e2e8f0] text-center font-mono font-semibold text-[#476885] tabular-nums">
                    #{r.excelRow}
                  </td>

                  <td className="py-2.5 px-2.5 border-r border-[#e2e8f0] whitespace-nowrap">
                    {r.maNhiemVu ? (
                      <span className="font-mono font-bold text-[#004776]">{r.maNhiemVu}</span>
                    ) : r.assignedCode ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#eef5ff] border border-[#bfe0fa] text-[11px] font-semibold text-[#0058a3]">
                        Tự cấp: {r.assignedCode}
                      </span>
                    ) : (
                      <span className="text-[#64748b]">—</span>
                    )}
                  </td>

                  <td className="py-2.5 px-2.5 border-r border-[#e2e8f0] space-y-1">
                    <div className="font-semibold text-[#004776] leading-snug break-words">
                      {r.tenNhiemVu || <span className="italic text-[#b42318]">(Chưa nhập tên nhiệm vụ)</span>}
                    </div>
                    {r.status === 'duplicate' && (
                      <div className="text-[11px] text-amber-800 bg-amber-100/70 border border-amber-200 rounded-md px-2 py-1 leading-snug">
                        Trùng với <strong>[{r.existingCode}]</strong> trên bảng: &ldquo;{r.existingTenNhiemVu}&rdquo;
                      </div>
                    )}
                    {r.messages && r.messages.length > 0 && (
                      <ul className={`text-[11px] list-disc pl-4 space-y-0.5 ${r.status === 'conflict' ? 'text-amber-900' : 'text-[#b42318]'}`}>
                        {r.messages.map((m, idx) => (
                          <li key={`msg-${r.excelRow}-${idx}`}>{m}</li>
                        ))}
                      </ul>
                    )}
                  </td>

                  <td className="py-2.5 px-2.5 border-r border-[#e2e8f0] text-[#004776] break-words">
                    {r.coQuan || '—'}
                  </td>

                  <td className="py-2.5 px-2.5 border-r border-[#e2e8f0] space-y-0.5 text-[11px] text-[#004776] break-words">
                    <div><span className="text-[#476885] font-medium">Căn cứ:</span> {r.canCu || '—'}</div>
                    <div><span className="text-[#476885] font-medium">Nguồn:</span> {r.nguon || '—'}</div>
                  </td>

                  <td className="py-2.5 px-2.5 border-r border-[#e2e8f0] space-y-1">
                    <div className="text-[11px] text-[#476885] tabular-nums">{r.ky || '—'}</div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#e8f3ff] text-[#0058a3] border border-[#bcdcff]">
                      {r.trangThai || 'Chưa chọn'}
                    </span>
                  </td>

                  <td className="py-2.5 px-2.5">
                    {r.status === 'new' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Hợp lệ · Sẽ nạp mới</span>
                      </span>
                    )}
                    {r.status === 'unchanged' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f1f5f9] text-[#476885] border border-[#cbd5e1]">
                        Đã có mã · Bỏ qua
                      </span>
                    )}
                    {r.status === 'conflict' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Xung đột mã · Chặn nạp</span>
                      </span>
                    )}
                    {r.status === 'error' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fdeceb] text-[#b42318] border border-[#f8b4af]">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Thiếu/sai dữ liệu</span>
                      </span>
                    )}
                    {r.status === 'duplicate' && (
                      <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Trùng dữ liệu đã nhập</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onChangeDecision(r.excelRow, 'skip')}
                            className={`h-7 px-2.5 rounded-md text-[11px] font-semibold border cursor-pointer transition-colors ${
                              decision === 'skip'
                                ? 'bg-[#004776] text-white border-[#004776]'
                                : 'bg-white text-[#004776] border-[#cbd5e1] hover:bg-[#f1f5f9]'
                            }`}
                          >
                            Bỏ qua
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeDecision(r.excelRow, 'add_new')}
                            className={`h-7 px-2.5 rounded-md text-[11px] font-semibold border cursor-pointer transition-colors ${
                              decision === 'add_new'
                                ? 'bg-[#006cee] text-white border-[#006cee]'
                                : 'bg-white text-[#004776] border-[#cbd5e1] hover:bg-[#eef5ff]'
                            }`}
                          >
                            Thêm mới
                          </button>
                        </div>
                      </div>
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
