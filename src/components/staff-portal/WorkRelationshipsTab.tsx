'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Clock, Network, Search, ShieldCheck } from 'lucide-react';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { normalizeCode } from '@/services/tickets/vtvl-coordination-helpers';
import { WorkRelationshipItem } from '@/types/staff-ticket';
import { TicketListSkeleton } from '@/components/ui/Skeleton';

type ApprovalFilterKey = 'all' | 'both_units' | 'tcns' | 'one_side';

interface WorkRelationshipsTabProps {
  relationships: WorkRelationshipItem[];
  unitCode: string;
  userRole: 'admin' | 'unit_leader' | 'staff';
  selectedVtvl?: string;
  loading?: boolean;
  onRefresh: () => void;
}

function getLevelPillClass(level: WorkRelationshipItem['approvalLevel']): string {
  if (level === 'both_units_and_tcns' || level === 'tcns_approved') return 'bg-emerald-600 text-white border-emerald-700';
  if (level === 'both_units_approved') return 'bg-[#008f5d] text-white border-emerald-700';
  if (level === 'one_unit_approved') return 'bg-amber-50 text-amber-800 border-amber-300';
  return 'bg-slate-100 text-[#476885] border-slate-300';
}

export function WorkRelationshipsTab({
  relationships,
  unitCode,
  userRole,
  selectedVtvl,
  loading,
  onRefresh
}: WorkRelationshipsTabProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ApprovalFilterKey>('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const normSel = normalizeCode(selectedVtvl);
  const normUnit = normalizeCode(unitCode);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = relationships.filter((r) => {
      if (filter === 'both_units' && !(r.hostLeaderApproved && r.targetLeaderApproved)) return false;
      if (filter === 'tcns' && !r.tcnsApproved) return false;
      if (filter === 'one_side' && r.approvalLevel !== 'one_unit_approved') return false;
      if (!q) return true;
      return [r.sourceTaskCode, r.sourceTaskName, r.hostUnitCode, r.hostUnitName, r.targetUnitCode, r.targetUnitName, r.targetVtvlCode, r.hostVtvlCode, r.proposerName]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    return [...list].sort((a, b) => {
      const aMatch = normSel && (normalizeCode(a.targetVtvlCode) === normSel || normalizeCode(a.hostVtvlCode) === normSel) ? 2 : 0;
      const bMatch = normSel && (normalizeCode(b.targetVtvlCode) === normSel || normalizeCode(b.hostVtvlCode) === normSel) ? 2 : 0;
      return (bMatch + (b.isDeclaredByTargetUnit ? 1 : 0)) - (aMatch + (a.isDeclaredByTargetUnit ? 1 : 0)) || b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [relationships, filter, search, normSel]);

  const handleConfirmApproval = async (rel: WorkRelationshipItem, side: 'host' | 'target' | 'tcns') => {
    setActionMsg('');
    setBusyKey(`${rel.id}-${side}`);
    try {
      const op = getCurrentOperatorSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (op?.email) headers['x-actor-email'] = op.email;
      if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;
      const res = await fetch('/api/tickets/coordinated', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ relationshipId: rel.id, side, approved: true })
      });
      if (res.ok) {
        setActionMsg(`Đã cập nhật xác nhận phê duyệt cho [${rel.sourceTaskCode}] ↔ [${rel.targetVtvlCode}].`);
        onRefresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setActionMsg(j.error || 'Không thể cập nhật trạng thái duyệt.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  const filterButtons: { key: ApprovalFilterKey; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'both_units', label: `Đã được lãnh đạo 2 đơn vị duyệt (${relationships.filter((r) => r.hostLeaderApproved && r.targetLeaderApproved).length})` },
    { key: 'tcns', label: `Phòng Tổ chức – Nhân sự duyệt (${relationships.filter((r) => r.tcnsApproved).length})` },
    { key: 'one_side', label: `Mới 1 bên lãnh đạo duyệt (${relationships.filter((r) => r.approvalLevel === 'one_unit_approved').length})` }
  ];

  return (
    <div
      role="tabpanel"
      aria-label="Mối quan hệ công việc phối hợp giữa các đơn vị"
      className="bg-white border border-t-0 border-[#cbd5e1] rounded-b-2xl p-4 sm:p-5 space-y-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#f8fbff] border border-[#dbeafe]">
        <p className="text-xs text-[#20446c]">
          Hiển thị các công việc phối hợp khi có ít nhất 1 trong 2 Lãnh đạo đơn vị hoặc Phòng Tổ chức – Nhân sự đã phê duyệt.
        </p>
        {selectedVtvl && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#006cee] text-white text-xs font-bold">
            VTVL: {selectedVtvl}
          </span>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {filterButtons.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setFilter(b.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                filter === b.key
                  ? 'bg-[#006cee] text-white border-[#006cee]'
                  : 'bg-[#f8fbff] text-[#004776] border-[#cbd5e1] hover:bg-[#eef5ff]'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 text-[#476b8e] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã công việc, VTVL, đơn vị..."
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] outline-hidden"
          />
        </div>
      </div>

      {actionMsg && (
        <div className="p-2.5 rounded-xl bg-[#eef5ff] border border-[#bfdbfe] text-xs font-semibold text-[#004776]">
          {actionMsg}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white overflow-hidden">
          <TicketListSkeleton rows={3} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fbff] space-y-1.5">
          <Network className="w-8 h-8 text-[#006cee] mx-auto opacity-75" />
          <p className="text-sm font-bold text-[#004776]">
            Chưa có mối quan hệ công việc nào được lãnh đạo ít nhất một bên hoặc Phòng Tổ chức – Nhân sự duyệt.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rel) => {
            const isHighlighted = Boolean(normSel && (normalizeCode(rel.targetVtvlCode) === normSel || normalizeCode(rel.hostVtvlCode) === normSel)) || rel.isDeclaredByTargetUnit;
            const canConfirmHost = (userRole === 'admin' || (userRole === 'unit_leader' && normUnit === rel.hostUnitCode)) && !rel.hostLeaderApproved;
            const canConfirmTarget = (userRole === 'admin' || (userRole === 'unit_leader' && normUnit === rel.targetUnitCode)) && !rel.targetLeaderApproved;
            const canConfirmTcns = userRole === 'admin' && !rel.tcnsApproved;

            return (
              <div
                key={rel.id}
                className={`p-4 rounded-2xl space-y-3 transition-all ${
                  isHighlighted
                    ? 'border-[1.3px] border-[#006cee] bg-[#eef6ff] ring-[1.3px] ring-[#006cee]/15 shadow-xs'
                    : 'border border-[#dbeafe] bg-[#fcfdff]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="px-2.5 py-0.5 rounded-md bg-white border border-[#bfdbfe] font-mono font-bold text-[#006cee]">
                      [{rel.hostUnitCode}] {rel.sourceTaskCode}
                    </span>
                    <ArrowRightLeft className="w-3.5 h-3.5 text-[#006cee]" />
                    <span className="px-2.5 py-0.5 rounded-md bg-[#e1edf8] border border-[#bfdbfe] font-bold text-[#004776]">
                      [{rel.targetUnitCode}] {rel.targetVtvlCode}{rel.targetVtvlName ? ` — ${rel.targetVtvlName}` : ''}
                    </span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${getLevelPillClass(rel.approvalLevel)}`}>
                    {rel.approvalLabel}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#004776]">{rel.sourceTaskName}</h4>
                  <p className="text-xs text-[#20446c]">
                    Người đề xuất: <strong>{rel.proposerName}</strong> ({rel.hostVtvlCode})
                    {rel.coordinationNote ? ` • Nội dung phối hợp: ${rel.coordinationNote}` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div className={`p-2.5 rounded-xl border ${rel.hostLeaderApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <div className="font-bold flex items-center gap-1">
                      {rel.hostLeaderApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      <span>1. Đơn vị đề xuất [{rel.hostUnitCode}]</span>
                    </div>
                    <div className="text-[11px] mt-0.5">{rel.hostApprovalLabel}</div>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${rel.targetLeaderApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <div className="font-bold flex items-center gap-1">
                      {rel.targetLeaderApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      <span>2. Đơn vị phối hợp [{rel.targetUnitCode}]</span>
                    </div>
                    <div className="text-[11px] mt-0.5">{rel.targetApprovalLabel}</div>
                  </div>

                  <div className={`p-2.5 rounded-xl border ${rel.tcnsApproved ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-[#f8fafc] border-[#cbd5e1] text-[#20446c]'}`}>
                    <div className="font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>3. Tổng hợp cấp trường (TCNS)</span>
                    </div>
                    <div className="text-[11px] mt-0.5">
                      {rel.tcnsApproved ? 'Phòng Tổ chức – Nhân sự đã duyệt' : 'Chờ Phòng Tổ chức – Nhân sự xác nhận'}
                    </div>
                  </div>
                </div>

                {(canConfirmHost || canConfirmTarget || canConfirmTcns) && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-[#e2e8f0]">
                    {canConfirmHost && (
                      <button type="button" disabled={busyKey === `${rel.id}-host`} onClick={() => handleConfirmApproval(rel, 'host')} className="h-8 px-3 rounded-lg bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
                        Lãnh đạo {rel.hostUnitCode} duyệt
                      </button>
                    )}
                    {canConfirmTarget && (
                      <button type="button" disabled={busyKey === `${rel.id}-target`} onClick={() => handleConfirmApproval(rel, 'target')} className="h-8 px-3 rounded-lg bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
                        Lãnh đạo {rel.targetUnitCode} duyệt
                      </button>
                    )}
                    {canConfirmTcns && (
                      <button type="button" disabled={busyKey === `${rel.id}-tcns`} onClick={() => handleConfirmApproval(rel, 'tcns')} className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50">
                        Phòng Tổ chức – Nhân sự duyệt
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
