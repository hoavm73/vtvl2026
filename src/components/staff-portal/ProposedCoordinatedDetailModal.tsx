'use client';

import React from 'react';
import { Building2, CalendarClock, FileText, Handshake, Layers, Lock, PackageCheck, UserCheck, X } from 'lucide-react';
import { ProposedCoordinatedTaskItem } from '@/types/staff-ticket';

interface ProposedCoordinatedDetailModalProps {
  item: ProposedCoordinatedTaskItem | null;
  onClose: () => void;
}

function formatViDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusBadgeClass(canonical: string): string {
  if (canonical === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (canonical === 'changes_requested') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (canonical === 'resubmitted') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-[#eff8ff] text-[#006cee] border-[#bfdbfe]';
}

export function ProposedCoordinatedDetailModal({ item, onClose }: ProposedCoordinatedDetailModalProps) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#004776]/40 backdrop-blur-xs p-3 sm:p-5 print:hidden">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-gradient-to-r from-[#eff6ff] to-[#f8fbff] border-b border-[#dbeafe]">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e1edf8] text-[#004776] text-[11px] font-bold">
                <Handshake className="w-3 h-3 text-[#006cee]" />
                <span>Đề xuất phối hợp · v{item.versionNo}</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${getStatusBadgeClass(item.canonicalStatus)}`}>
                {item.sourceStatus}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f1f5f9] border border-[#cbd5e1] text-[11px] font-semibold text-[#20446c]">
                <Lock className="w-3 h-3" />
                <span>Chỉ đọc</span>
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#004776] leading-snug break-words">
              {item.maCongViec} — {item.tenCongViec}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white text-[#20446c] hover:text-[#004776] transition-colors shrink-0 cursor-pointer"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-sm text-[#004776]">
          <div className="p-3.5 rounded-xl bg-[#f8fbff] border border-[#dbeafe] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#20446c]">
              <Layers className="w-3.5 h-3.5 text-[#006cee]" />
              <span>Nhiệm vụ nguồn</span>
            </div>
            <p className="font-bold text-[#004776]">
              {item.maNhiemVu}{item.tenNhiemVu ? ` — ${item.tenNhiemVu}` : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#20446c]">
                <Building2 className="w-3.5 h-3.5 text-[#006cee]" />
                <span>Đơn vị chủ trì</span>
              </div>
              <p className="font-bold text-[#004776]">{item.hostUnitCode} · {item.hostUnitName}</p>
            </div>

            <div className="p-3 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#20446c]">
                <UserCheck className="w-3.5 h-3.5 text-[#006cee]" />
                <span>Người đề xuất</span>
              </div>
              <p className="font-bold text-[#004776]">{item.proposerName}</p>
              {item.proposerTitle && <p className="text-xs text-[#476b8e]">{item.proposerTitle}</p>}
            </div>

            <div className="p-3 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
              <span className="text-xs font-bold text-[#20446c]">Mã VTVL chủ trì</span>
              <p className="font-bold text-[#004776]">
                {item.hostPrimaryVtvlCode}
                {item.hostPrimaryVtvlName ? ` — ${item.hostPrimaryVtvlName}` : ''}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#20446c]">
                <CalendarClock className="w-3.5 h-3.5 text-[#006cee]" />
                <span>Cập nhật phiên bản nộp</span>
              </div>
              <p className="font-semibold text-[#004776]">
                Phiên bản v{item.versionNo} · {formatViDateTime(item.submittedAt)}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[#bfdbfe] bg-[#eff8ff] space-y-2">
            <span className="text-xs font-bold text-[#004776]">VTVL phối hợp liên quan đến bạn</span>
            <div className="space-y-1.5">
              {item.matchedVtvls.map((mv, idx) => (
                <div
                  key={`${mv.targetUnitCode}-${mv.maVtvl}-${idx}`}
                  className="p-2.5 rounded-lg bg-white border border-[#dbeafe] text-xs space-y-1"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[#004776]">
                      {mv.maVtvl}{mv.tenVtvl ? ` — ${mv.tenVtvl}` : ''}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#e1edf8] text-[#20446c] font-semibold">
                      {mv.targetUnitCode} · {mv.targetUnitName}
                    </span>
                  </div>
                  {mv.note && <p className="text-[#20446c]">Nội dung riêng: {mv.note}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-[#e2e8f0] bg-white space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#20446c]">
              <PackageCheck className="w-3.5 h-3.5 text-[#006cee]" />
              <span>Sản phẩm đầu ra</span>
            </div>
            <p className="text-sm text-[#004776] whitespace-pre-wrap">{item.sanPham || '—'}</p>
          </div>

          {item.coordinationNote && (
            <div className="p-3.5 rounded-xl border border-[#e2e8f0] bg-[#fcfdff] space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#20446c]">
                <FileText className="w-3.5 h-3.5 text-[#006cee]" />
                <span>Nội dung đề xuất phối hợp</span>
              </div>
              <p className="text-sm text-[#004776] whitespace-pre-wrap">{item.coordinationNote}</p>
            </div>
          )}

          <div className="p-3 rounded-xl bg-[#f1f6fc] border border-[#cbd5e1] text-xs text-[#20446c] flex items-start gap-2">
            <Lock className="w-4 h-4 text-[#006cee] shrink-0 mt-0.5" />
            <span>
              Chế độ chỉ đọc: đề xuất phối hợp không tự tạo phiếu cá nhân, không tự cộng giờ công và không tự gộp vào biểu của bạn.
            </span>
          </div>
        </div>

        <div className="flex justify-end px-5 py-3.5 bg-[#f8fafc] border-t border-[#e2e8f0]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#004776] hover:bg-[#003559] text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
