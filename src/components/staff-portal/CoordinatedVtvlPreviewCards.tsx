'use client';

import React from 'react';
import { AlertCircle, Building2, Eye, Users } from 'lucide-react';
import { CoordinatedVtvlRecipientPreview } from '@/types/staff-ticket';
import {
  makeCompositeVtvlKey,
  resolveUnitNameSafe,
  UNASSIGNED_VTVL_MESSAGE
} from '@/services/tickets/vtvl-coordination-helpers';

export interface PreviewTargetItem {
  targetUnitCode: string;
  maVtvl: string;
  tenVtvl?: string;
  note?: string;
}

interface CoordinatedVtvlPreviewCardsProps {
  effectiveTargets: PreviewTargetItem[];
  previews: CoordinatedVtvlRecipientPreview[];
  loadingPreview: boolean;
}

export function CoordinatedVtvlPreviewCards({
  effectiveTargets,
  previews,
  loadingPreview
}: CoordinatedVtvlPreviewCardsProps) {
  if (effectiveTargets.length === 0) return null;

  return (
    <div className="p-3 rounded-xl border border-[#bfdbfe] bg-[#eff8ff] space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#004776]">
        <span className="inline-flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-[#006cee]" />
          <span>Xem trước người nhận đề xuất phối hợp ({effectiveTargets.length} VTVL)</span>
        </span>
        {loadingPreview && <span className="text-[11px] font-medium text-[#20446c]">Đang đối chiếu...</span>}
      </div>

      <div className="space-y-1.5">
        {effectiveTargets.map((target) => {
          const p = previews.find(
            (item) =>
              makeCompositeVtvlKey(item.targetUnitCode, item.maVtvl) ===
              makeCompositeVtvlKey(target.targetUnitCode, target.maVtvl)
          );
          const unitLabel = p?.targetUnitName || resolveUnitNameSafe(target.targetUnitCode);
          const vtvlName = p?.tenVtvl || target.tenVtvl || '';

          return (
            <div
              key={`${target.targetUnitCode}-${target.maVtvl}`}
              className="p-2.5 rounded-lg bg-white border border-[#dbeafe] text-xs space-y-1"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[#004776]">
                  {target.maVtvl}
                  {vtvlName ? ` — ${vtvlName}` : ''}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#20446c] bg-[#f1f6fc] px-2 py-0.5 rounded-full">
                  <Building2 className="w-3 h-3 text-[#006cee]" />
                  <span>
                    {target.targetUnitCode} · {unitLabel}
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {p && p.recipients.length > 0 ? (
                  <>
                    <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-[11px] font-semibold text-[#20446c]">Người nhận:</span>
                    {p.recipients.map((rec, i) => (
                      <span
                        key={`${rec.displayName}-${i}`}
                        className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold"
                      >
                        {rec.displayName}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{p?.emptyMessage || UNASSIGNED_VTVL_MESSAGE}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-[#20446c]">
        Lưu nháp chỉ hiển thị xem trước cho người lập; đề xuất chỉ xuất hiện ở tab của người nhận sau khi nộp phiếu thành công.
      </p>
    </div>
  );
}
