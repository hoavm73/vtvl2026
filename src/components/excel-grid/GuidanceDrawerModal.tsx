'use client';

import React from 'react';
import { ExcelSheetMeta } from './excel-grid-types';
import { X, BookOpen, ShieldCheck, Info } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';

interface GuidanceDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  meta: ExcelSheetMeta;
}

export function GuidanceDrawerModal({ isOpen, onClose, meta }: GuidanceDrawerModalProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] flex justify-end bg-[#004776]/30 backdrop-blur-xs select-none"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        tabIndex={-1}
      >
        <div
          className="relative w-full max-w-xl h-dvh bg-white shadow-2xl border-l border-[#cbd5e1] overflow-hidden flex flex-col animate-in slide-in-from-right duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 bg-[#f8fafc] border-b border-[#cbd5e1] shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#004776]/10 text-[#004776] flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-[#004776] truncate">
                  Hướng dẫn — {meta.sheetName}
                </h3>
                <p className="text-xs font-medium text-[#476885] truncate">
                  {meta.title} · Theo Hướng dẫn số 07-HD/BTCTW
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#476885] hover:text-[#004776] hover:bg-[#e2e8f0]/60 cursor-pointer shrink-0"
              aria-label="Đóng cửa sổ hướng dẫn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content body */}
          <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-4 text-[13px] text-[#004776]/90 leading-relaxed">
            {/* Căn cứ pháp lý */}
            <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#cbd5e1] space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#004776]">
                <ShieldCheck className="w-4 h-4 text-[#004776]" />
                <span>Căn cứ pháp lý hiện hành</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[#20446c]">
                <li><strong>Hướng dẫn số 07-HD/BTCTW</strong> của Ban Tổ chức Trung ương về việc xây dựng đề án vị trí việc làm.</li>
                <li><strong>Nghị định số 232/2026/NĐ-CP</strong> của Chính phủ về vị trí việc làm và cơ cấu viên chức theo chức danh nghề nghiệp.</li>
                <li><strong>Thông tư số 31/2026/TT-BGDĐT</strong> ngày 14/4/2026 của Bộ GD&amp;ĐT hướng dẫn vị trí việc làm và định mức giờ giảng dạy.</li>
                <li><strong>Quyết định số 2266/QĐ-ĐHCNKT</strong> ngày 30/12/2025 ban hành Quy định chức năng, nhiệm vụ của 51 đơn vị thuộc HCM-UTE.</li>
              </ul>
            </div>

            {/* Lưu ý nghiệp vụ cho sheet hiện tại */}
            <div className="p-4 rounded-xl bg-[#eef5ff] border border-[#004776]/20 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#004776]">
                <Info className="w-4 h-4 text-[#004776]" />
                <span>Lưu ý nhập liệu biểu {meta.sheetName}</span>
              </div>
              <p className="text-[#004776]">
                Biểu <strong>{meta.sheetName}</strong> gồm <strong>{meta.columns.length} cột</strong> chỉ tiêu.
                Các cột có ký hiệu <code>=fx</code> là cột công thức tự động tính toán, người dùng không cần nhập thủ công.
              </p>
            </div>

            {/* Danh sách cột & công thức */}
            <div className="space-y-2">
              <span className="font-bold text-[#004776] block">Danh mục các cột chỉ tiêu:</span>
              <div className="border border-[#cbd5e1] rounded-xl overflow-hidden">
                <table className="w-full text-xs divide-y divide-[#e2e8f0]">
                  <thead className="bg-[#f1f5f9] text-[#004776] font-bold">
                    <tr>
                      <th className="py-2 px-3 text-left w-12">Cột</th>
                      <th className="py-2 px-3 text-left">Tên chỉ tiêu</th>
                      <th className="py-2 px-3 text-left w-24">Tính chất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {meta.columns.map((col) => (
                      <tr key={col.field} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-[#004776]">{col.colLetter}</td>
                        <td className="py-2 px-3 font-medium">{col.headerName}</td>
                        <td className="py-2 px-3">
                          {col.isFormula ? (
                            <span className="text-[#004776] bg-[#eef5ff] px-1.5 py-0.5 rounded font-bold text-[11px]">Tự tính</span>
                          ) : col.readOnly ? (
                            <span className="text-[#476885] bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">Chỉ đọc</span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">Nhập tay</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-[#f8fafc] border-t border-[#cbd5e1] flex items-center justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#004776] text-white text-[13px] font-bold hover:bg-[#00365c] cursor-pointer shadow-2xs"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

