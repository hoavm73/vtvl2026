'use client';

import React, { useMemo, useState } from 'react';
import { Building2, Handshake, Layers, Lock, Search, ShieldAlert } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { ProposedCoordinatedTaskItem } from '@/types/staff-ticket';
import {
  PROPOSED_TAB_EMPTY_MESSAGE,
  UNASSIGNED_VIEWER_HINT
} from '@/services/tickets/vtvl-coordination-helpers';
import { ProposedCoordinatedDetailModal } from './ProposedCoordinatedDetailModal';
import { ProposedCoordinatedTaskCard } from './ProposedCoordinatedTaskCard';

interface ViewerVtvlBadge {
  id: string;
  unitCode: string;
  maVtvl: string;
  tenVtvl?: string;
}

interface ProposedCoordinatedTasksTabProps {
  items: ProposedCoordinatedTaskItem[];
  myAssignments: ViewerVtvlBadge[];
  loading: boolean;
}

export function ProposedCoordinatedTasksTab({
  items,
  myAssignments,
  loading
}: ProposedCoordinatedTasksTabProps) {
  const [search, setSearch] = useState('');
  const [hostUnitFilter, setHostUnitFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detailItem, setDetailItem] = useState<ProposedCoordinatedTaskItem | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState('');

  const hostUnitOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (!map.has(item.hostUnitCode)) {
        map.set(item.hostUnitCode, `${item.hostUnitCode} · ${item.hostUnitName}`);
      }
    }
    return [
      { value: '', label: 'Tất cả đơn vị chủ trì' },
      ...Array.from(map.entries()).map(([code, label]) => ({ value: code, label }))
    ];
  }, [items]);

  const statusOptions = useMemo(() => {
    const unique = Array.from(new Set(items.map((i) => i.sourceStatus).filter(Boolean)));
    return [
      { value: '', label: 'Tất cả trạng thái phiếu' },
      ...unique.map((st) => ({ value: st, label: st }))
    ];
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (hostUnitFilter && item.hostUnitCode !== hostUnitFilter) return false;
      if (statusFilter && item.sourceStatus !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        item.maNhiemVu,
        item.tenNhiemVu,
        item.maCongViec,
        item.tenCongViec,
        item.proposerName,
        item.hostUnitCode,
        item.hostUnitName
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, hostUnitFilter, statusFilter]);

  const groupedByUnit = useMemo(() => {
    const unitMap = new Map<
      string,
      {
        hostUnitCode: string;
        hostUnitName: string;
        missions: Map<string, { maNhiemVu: string; tenNhiemVu: string; tasks: ProposedCoordinatedTaskItem[] }>;
      }
    >();

    for (const item of filtered) {
      let unitGroup = unitMap.get(item.hostUnitCode);
      if (!unitGroup) {
        unitGroup = {
          hostUnitCode: item.hostUnitCode,
          hostUnitName: item.hostUnitName,
          missions: new Map()
        };
        unitMap.set(item.hostUnitCode, unitGroup);
      }
      const mKey = `${item.hostUnitCode}::${item.maNhiemVu}`;
      let missionGroup = unitGroup.missions.get(mKey);
      if (!missionGroup) {
        missionGroup = {
          maNhiemVu: item.maNhiemVu,
          tenNhiemVu: item.tenNhiemVu || '',
          tasks: []
        };
        unitGroup.missions.set(mKey, missionGroup);
      }
      missionGroup.tasks.push(item);
    }

    return Array.from(unitMap.values()).map((u) => ({
      hostUnitCode: u.hostUnitCode,
      hostUnitName: u.hostUnitName,
      missions: Array.from(u.missions.values())
    }));
  }, [filtered]);

  const handleOpenDetail = async (item: ProposedCoordinatedTaskItem) => {
    setDetailError('');
    setDetailLoadingId(item.proposalKey);
    try {
      const op = getCurrentOperatorSession();
      const headers: Record<string, string> = {};
      if (op?.email) headers['x-actor-email'] = op.email;
      if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;
      const res = await fetch(
        `/api/tickets/coordinated?surveyId=${encodeURIComponent(item.surveyId)}&taskRowId=${encodeURIComponent(item.taskRowId)}`,
        { headers }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.item) {
        setDetailError(json.error || 'Không có quyền xem chi tiết công việc phối hợp này.');
        return;
      }
      setDetailItem(json.item);
    } catch {
      setDetailError('Lỗi kết nối máy chủ khi tải chi tiết công việc phối hợp.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  return (
    <div className="bg-white border border-t-0 border-[#cbd5e1] rounded-b-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#f8fbff] border border-[#dbeafe]">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#004776]">
            <Lock className="w-3.5 h-3.5 text-[#006cee]" />
            <span>Vị trí việc làm được phân công của bạn (Chế độ chỉ đọc)</span>
          </div>
          {myAssignments.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {myAssignments.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e1edf8] border border-[#bfdbfe] text-[11px] font-bold text-[#004776]"
                >
                  <span>[{a.unitCode}] {a.maVtvl}{a.tenVtvl ? ` — ${a.tenVtvl}` : ''}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-700 font-semibold">{UNASSIGNED_VIEWER_HINT}</p>
          )}
        </div>
        <span className="text-[11px] font-semibold text-[#20446c] bg-white px-2.5 py-1 rounded-full border border-[#dbeafe]">
          Hiển thị {filtered.length}/{items.length} đề xuất
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 text-[#476b8e] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo mã/tên nhiệm vụ, công việc, người đề xuất..."
            className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm rounded-xl border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] focus:ring-2 focus:ring-[#006cee]/20 outline-hidden"
          />
        </div>
        <div className="md:col-span-3">
          <ShadcnSelect value={hostUnitFilter} options={hostUnitOptions} onChange={setHostUnitFilter} searchable size="md" />
        </div>
        <div className="md:col-span-3">
          <ShadcnSelect value={statusFilter} options={statusOptions} onChange={setStatusFilter} size="md" />
        </div>
      </div>

      {detailError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{detailError}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-[#476b8e] font-semibold">
          Đang tải danh sách nhiệm vụ được đề xuất phối hợp...
        </div>
      ) : groupedByUnit.length === 0 ? (
        <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fbff] space-y-2">
          <Handshake className="w-8 h-8 text-[#006cee] mx-auto opacity-80" />
          <p className="text-sm font-bold text-[#004776]">{PROPOSED_TAB_EMPTY_MESSAGE}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByUnit.map((unitGrp) => (
            <div key={unitGrp.hostUnitCode} className="rounded-2xl border border-[#cbd5e1] overflow-hidden bg-white">
              <div className="px-4 py-2.5 bg-[#e1edf8]/60 border-b border-[#cbd5e1] flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#004776]">
                  <Building2 className="w-4 h-4 text-[#006cee]" />
                  <span>Đơn vị chủ trì: {unitGrp.hostUnitCode} · {unitGrp.hostUnitName}</span>
                </span>
                <span className="text-[11px] font-bold text-[#20446c]">
                  {unitGrp.missions.reduce((sum, m) => sum + m.tasks.length, 0)} công việc
                </span>
              </div>

              <div className="divide-y divide-[#e2e8f0]">
                {unitGrp.missions.map((mission) => (
                  <div key={`${unitGrp.hostUnitCode}-${mission.maNhiemVu}`} className="p-3.5 sm:p-4 space-y-3">
                    <div className="flex items-start gap-2 text-xs sm:text-[13px] font-bold text-[#004776]">
                      <Layers className="w-4 h-4 text-[#006cee] shrink-0 mt-0.5" />
                      <span>{mission.maNhiemVu}{mission.tenNhiemVu ? ` — ${mission.tenNhiemVu}` : ''}</span>
                    </div>

                    <div className="space-y-2.5 pl-0 sm:pl-4">
                      {mission.tasks.map((task) => (
                        <ProposedCoordinatedTaskCard
                          key={task.proposalKey}
                          task={task}
                          loadingDetail={detailLoadingId === task.proposalKey}
                          onOpenDetail={handleOpenDetail}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProposedCoordinatedDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
    </div>
  );
}
