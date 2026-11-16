'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { getFlatHcmuteUnitOptions } from '@/configs/hcmute-units';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import {
  CoordinatedVtvlEntry,
  CoordinatedVtvlRecipientPreview
} from '@/types/staff-ticket';
import {
  makeCompositeVtvlKey,
  makeStableCoordinatedVtvlId,
  resolveUnitCodeSafe,
  resolveUnitNameSafe
} from '@/services/tickets/vtvl-coordination-helpers';
import { CoordinatedVtvlPreviewCards } from './CoordinatedVtvlPreviewCards';

interface CoordinatedVtvlPreviewPanelProps {
  unitCode: string;
  maVtvlPhoiHop: string;
  coordinationNote: string;
  coordinatedVtvls: CoordinatedVtvlEntry[];
  vtvlOptions: { value: string; label: string }[];
  onChangeCoordinationNote: (val: string) => void;
  onChangeCoordinatedVtvls: (items: CoordinatedVtvlEntry[]) => void;
}

export function CoordinatedVtvlPreviewPanel({
  unitCode,
  maVtvlPhoiHop,
  coordinationNote,
  coordinatedVtvls,
  vtvlOptions,
  onChangeCoordinationNote,
  onChangeCoordinatedVtvls
}: CoordinatedVtvlPreviewPanelProps) {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [extraUnitCode, setExtraUnitCode] = useState(resolveUnitCodeSafe(unitCode));
  const [extraVtvlCode, setExtraVtvlCode] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [extraCatalog, setExtraCatalog] = useState<{ maVtvl: string; tenVtvl: string }[]>([]);
  const [previews, setPreviews] = useState<CoordinatedVtvlRecipientPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const unitOptions = useMemo(() => getFlatHcmuteUnitOptions(), []);

  useEffect(() => {
    setExtraUnitCode(resolveUnitCodeSafe(unitCode));
  }, [unitCode]);

  const effectiveTargets = useMemo(() => {
    const map = new Map<string, { targetUnitCode: string; maVtvl: string; tenVtvl?: string; note?: string }>();
    const cleanHost = resolveUnitCodeSafe(unitCode);
    if (maVtvlPhoiHop.trim() && cleanHost) {
      const optLabel = vtvlOptions.find((v) => v.value === maVtvlPhoiHop)?.label || '';
      const dashIdx = optLabel.indexOf('—');
      const ten = dashIdx >= 0 ? optLabel.slice(dashIdx + 1).trim() : '';
      map.set(makeCompositeVtvlKey(cleanHost, maVtvlPhoiHop), {
        targetUnitCode: cleanHost,
        maVtvl: maVtvlPhoiHop.trim(),
        tenVtvl: ten || undefined,
        note: coordinationNote.trim() || undefined
      });
    }
    for (const item of coordinatedVtvls) {
      const key = makeCompositeVtvlKey(item.targetUnitCode, item.maVtvl);
      if (!key) continue;
      map.set(key, {
        targetUnitCode: resolveUnitCodeSafe(item.targetUnitCode),
        maVtvl: item.maVtvl,
        tenVtvl: item.tenVtvl,
        note: item.note
      });
    }
    return Array.from(map.values());
  }, [unitCode, maVtvlPhoiHop, coordinationNote, coordinatedVtvls, vtvlOptions]);

  useEffect(() => {
    if (!showAddPanel) return;
    const cleanTarget = resolveUnitCodeSafe(extraUnitCode);
    if (!cleanTarget) return;
    if (cleanTarget === resolveUnitCodeSafe(unitCode) && vtvlOptions.length > 0) {
      setExtraCatalog(
        vtvlOptions
          .filter((o) => Boolean(o.value))
          .map((o) => {
            const idx = o.label.indexOf('—');
            return { maVtvl: o.value, tenVtvl: idx >= 0 ? o.label.slice(idx + 1).trim() : o.label };
          })
      );
      return;
    }
    const op = getCurrentOperatorSession();
    const headers: Record<string, string> = {};
    if (op?.email) headers['x-actor-email'] = op.email;
    if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;
    fetch(`/api/vtvl-assignments?mode=unit-catalog&unitCode=${encodeURIComponent(cleanTarget)}`, { headers })
      .then((r) => (r.ok ? r.json() : { options: [] }))
      .then((j) => setExtraCatalog(Array.isArray(j.options) ? j.options : []))
      .catch(() => setExtraCatalog([]));
  }, [showAddPanel, extraUnitCode, unitCode, vtvlOptions]);

  useEffect(() => {
    if (effectiveTargets.length === 0) {
      setPreviews([]);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    const queryTargets = effectiveTargets.map((t) => `${t.targetUnitCode}::${t.maVtvl}`).join(',');
    const op = getCurrentOperatorSession();
    const headers: Record<string, string> = {};
    if (op?.email) headers['x-actor-email'] = op.email;
    if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;

    fetch(`/api/vtvl-assignments?mode=preview&targets=${encodeURIComponent(queryTargets)}`, { headers })
      .then((r) => (r.ok ? r.json() : { previews: [] }))
      .then((j) => {
        if (!cancelled) setPreviews(Array.isArray(j.previews) ? j.previews : []);
      })
      .catch(() => {
        if (!cancelled) setPreviews([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveTargets]);

  const handleAddExtra = () => {
    if (!extraUnitCode || !extraVtvlCode) return;
    const targetUnit = resolveUnitCodeSafe(extraUnitCode);
    const key = makeCompositeVtvlKey(targetUnit, extraVtvlCode);
    if (key === makeCompositeVtvlKey(unitCode, maVtvlPhoiHop)) return;
    if (coordinatedVtvls.some((e) => makeCompositeVtvlKey(e.targetUnitCode, e.maVtvl) === key)) return;
    const found = extraCatalog.find((c) => c.maVtvl === extraVtvlCode);
    const next: CoordinatedVtvlEntry = {
      id: makeStableCoordinatedVtvlId(targetUnit, extraVtvlCode),
      targetUnitCode: targetUnit,
      targetUnitName: resolveUnitNameSafe(targetUnit),
      maVtvl: extraVtvlCode,
      tenVtvl: found?.tenVtvl,
      note: extraNote.trim() || undefined
    };
    onChangeCoordinatedVtvls([...coordinatedVtvls, next]);
    setExtraVtvlCode('');
    setExtraNote('');
  };

  const extraVtvlOptions = useMemo(
    () =>
      extraCatalog.map((c) => ({
        value: c.maVtvl,
        label: c.tenVtvl ? `${c.maVtvl} — ${c.tenVtvl}` : c.maVtvl
      })),
    [extraCatalog]
  );

  return (
    <div className="sm:col-span-12 space-y-2.5 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowAddPanel((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006cee] hover:text-[#004776] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showAddPanel ? 'Thu gọn thêm VTVL phối hợp' : 'Thêm VTVL phối hợp khác (cùng hoặc khác đơn vị)'}</span>
        </button>
      </div>

      {(maVtvlPhoiHop.trim() || coordinatedVtvls.length > 0) && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#20446c]">Nội dung phối hợp đề xuất (nếu có)</label>
          <input
            type="text"
            value={coordinationNote}
            onChange={(e) => onChangeCoordinationNote(e.target.value)}
            placeholder="Ví dụ: Phối hợp rà soát đối chiếu số liệu nhân sự trước ngày 20 hằng tháng..."
            className="w-full h-9 px-3 text-xs rounded-xl border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] focus:ring-2 focus:ring-[#006cee]/20 outline-hidden"
          />
        </div>
      )}

      {showAddPanel && (
        <div className="p-3 rounded-xl border border-[#dbeafe] bg-[#f8fbff] space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-5 space-y-1">
              <label className="text-[11px] font-bold text-[#004776]">Đơn vị phối hợp</label>
              <ShadcnSelect
                value={extraUnitCode}
                options={unitOptions}
                searchable={true}
                size="sm"
                onChange={(val) => {
                  setExtraUnitCode(val);
                  setExtraVtvlCode('');
                }}
              />
            </div>
            <div className="sm:col-span-7 space-y-1">
              <label className="text-[11px] font-bold text-[#004776]">Mã VTVL phối hợp (Biểu C1)</label>
              <ShadcnSelect
                value={extraVtvlCode}
                options={extraVtvlOptions}
                placeholder="Chọn mã VTVL..."
                size="sm"
                onChange={setExtraVtvlCode}
              />
            </div>
            <div className="sm:col-span-9 space-y-1">
              <label className="text-[11px] font-semibold text-[#20446c]">Ghi chú riêng cho VTVL này (nếu có)</label>
              <input
                type="text"
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                placeholder="Nội dung phối hợp cụ thể cho VTVL được chọn..."
                className="w-full h-9 px-3 text-xs rounded-lg border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] outline-hidden"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="button"
                disabled={!extraUnitCode || !extraVtvlCode}
                onClick={handleAddExtra}
                className="w-full h-9 px-3 rounded-lg bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm mã</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {coordinatedVtvls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {coordinatedVtvls.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e1edf8] border border-[#bfdbfe] text-[11px] font-semibold text-[#004776]"
            >
              <span>
                [{item.targetUnitCode}] {item.maVtvl}
                {item.tenVtvl ? ` — ${item.tenVtvl}` : ''}
                {item.note ? ` (${item.note})` : ''}
              </span>
              <button
                type="button"
                onClick={() => onChangeCoordinatedVtvls(coordinatedVtvls.filter((c) => c.id !== item.id))}
                className="text-[#20446c] hover:text-red-600 cursor-pointer"
                title="Gỡ mã VTVL phối hợp"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <CoordinatedVtvlPreviewCards
        effectiveTargets={effectiveTargets}
        previews={previews}
        loadingPreview={loadingPreview}
      />
    </div>
  );
}
