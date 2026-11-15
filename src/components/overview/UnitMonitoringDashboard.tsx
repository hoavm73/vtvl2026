'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { HCMUTE_UNITS } from '@/configs/hcmute-units';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import {
  UnitSummaryRow,
  MonitorTotals,
  MonitorTicketItem,
  MonitorHistoryItem,
  StageFilterKey
} from './UnitMonitoringTypes';
import { UnitMonitoringKpiStrip } from './UnitMonitoringKpiStrip';
import { UnitMonitoringTable } from './UnitMonitoringTable';
import { UnitMonitoringHistoryPanel } from './UnitMonitoringHistoryPanel';

const STAGE_TO_TICKET_TAB: Record<StageFilterKey, string> = {
  ALL: 'ALL',
  has_draft: 'draft',
  has_pending: 'pending',
  has_changes: 'changes_requested',
  has_approved: 'approved',
  has_merged: 'merged',
  empty: 'ALL'
};

/**
 * Dashboard theo dõi tiến trình, số liệu kê khai & lịch sử đơn vị dành cho Phòng TCNS và Quản trị viên.
 */
export function UnitMonitoringDashboard() {
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<StageFilterKey>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeTest, setIncludeTest] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [totals, setTotals] = useState<MonitorTotals>({
    totalUnits: 39,
    unitsWithTickets: 0,
    unitsWithApproved: 0,
    totalTickets: 0,
    draftCount: 0,
    submittedCount: 0,
    resubmittedCount: 0,
    changesRequestedCount: 0,
    approvedCount: 0,
    mergedCount: 0,
    testTicketCount: 0,
    totalAccounts: 0
  });
  const [unitSummaries, setUnitSummaries] = useState<UnitSummaryRow[]>([]);
  const [tickets, setTickets] = useState<MonitorTicketItem[]>([]);
  const [history, setHistory] = useState<MonitorHistoryItem[]>([]);

  const fetchMonitorData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const cur = getCurrentOperatorSession();
      const headers: Record<string, string> = {};
      let adminToken = '';
      if (typeof window !== 'undefined') {
        try {
          adminToken = sessionStorage.getItem('hcmute_vtvl_admin_token') || '';
        } catch {
          /* ignore */
        }
      }
      if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
      else if (cur?.accessToken) headers.Authorization = `Bearer ${cur.accessToken}`;
      if (cur?.email) headers['x-actor-email'] = cur.email;

      const params = new URLSearchParams();
      if (selectedUnit !== 'ALL') params.set('unitCode', selectedUnit);
      if (includeTest) params.set('includeTest', 'true');

      const res = await fetch(`/api/admin/unit-monitor?${params.toString()}`, {
        headers,
        cache: 'no-store'
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || 'Không thể tải dữ liệu theo dõi đơn vị.');
        return;
      }
      const data = await res.json();
      if (data.totals) setTotals(data.totals);
      setUnitSummaries(data.unitSummaries || []);
      setTickets(data.tickets || []);
      setHistory(data.history || []);
      const now = new Date();
      setLastSyncedTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    } catch {
      setError('Lỗi kết nối máy chủ khi tải Dashboard theo dõi đơn vị.');
    } finally {
      setLoading(false);
    }
  }, [selectedUnit, includeTest]);

  useEffect(() => {
    fetchMonitorData();
  }, [fetchMonitorData]);

  const filteredUnitRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return unitSummaries.filter((u) => {
      if (selectedUnit !== 'ALL' && u.unitCode !== selectedUnit) return false;
      if (selectedGroup !== 'ALL' && u.group !== selectedGroup) return false;
      if (stageFilter === 'has_pending' && u.submittedCount === 0) return false;
      if (stageFilter === 'has_draft' && u.draftCount === 0) return false;
      if (stageFilter === 'has_changes' && u.changesRequestedCount === 0) return false;
      if (stageFilter === 'has_approved' && u.approvedCount === 0) return false;
      if (stageFilter === 'has_merged' && u.mergedCount === 0) return false;
      if (stageFilter === 'empty' && u.totalTickets > 0) return false;
      if (q && !u.unitCode.toLowerCase().includes(q) && !u.unitNameVi.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [unitSummaries, selectedUnit, selectedGroup, stageFilter, searchQuery]);

  const activeUnitInfo = useMemo(
    () => (selectedUnit === 'ALL' ? null : HCMUTE_UNITS.find((u) => u.code === selectedUnit)),
    [selectedUnit]
  );

  const activeUnitRow = useMemo(
    () => (selectedUnit === 'ALL' ? null : unitSummaries.find((u) => u.unitCode === selectedUnit) || null),
    [selectedUnit, unitSummaries]
  );

  const isInitialSkeleton = loading && unitSummaries.length === 0;

  return (
    <section className="space-y-4 text-[#004776]">
      {/* Khối Header điều hành & Dải KPI chuẩn S-Link */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#dbe8f5] p-4 sm:p-5 shadow-[0_2px_16px_-4px_rgba(0,71,118,0.06)] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 border-b border-[#e8eff7] pb-4">
          <div className="space-y-1 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-[#e1edf8] text-[#004776]">
              <Layers className="w-3.5 h-3.5 text-[#006cee]" />
              <span>Không gian điều hành · Phòng Tổ chức - Nhân sự &amp; Quản trị viên</span>
            </div>
            <h2 className="text-base sm:text-xl font-bold tracking-tight text-[#004776]">
              Dashboard theo dõi đơn vị
            </h2>
            <p className="text-xs text-[#20446c]">
              {activeUnitInfo
                ? `Đang xem chi tiết đơn vị [${activeUnitInfo.code}] ${activeUnitInfo.nameVi}`
                : 'Tổng hợp tiến trình kê khai phiếu, biểu mẫu và nhật ký hoạt động 39 đơn vị HCM-UTE'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedUnit('ALL')}
              className={`h-9.5 px-4 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                selectedUnit === 'ALL'
                  ? 'bg-[#006cee] hover:bg-[#005ecc] text-white shadow-xs'
                  : 'bg-[#e1edf8] hover:bg-[#d5e5f6] text-[#004776]'
              }`}
            >
              Toàn trường (39)
            </button>

            <select
              aria-label="Chọn đơn vị cần theo dõi"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="h-9.5 px-3.5 rounded-full border border-[#cbd5e1] bg-[#f8fbff] text-xs font-semibold text-[#004776] leading-normal outline-none focus:border-[#006cee] focus:ring-2 focus:ring-[#006cee]/15 max-w-[260px]"
            >
              <option value="ALL">Lọc theo từng đơn vị…</option>
              {HCMUTE_UNITS.map((u) => (
                <option key={u.code} value={u.code}>
                  [{u.code}] {u.nameVi}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={fetchMonitorData}
              className="h-9.5 px-3.5 rounded-full border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#006cee] ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
              {lastSyncedTime && (
                <span className="text-[11px] font-medium text-[#20446c]/75 tabular-nums">
                  {lastSyncedTime}
                </span>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-[#f4212e]">
            {error}
          </div>
        )}

        {isInitialSkeleton ? (
          <div className="space-y-3 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-[88px] rounded-2xl bg-[#f1f6fc] border border-[#e2ecf7]" />
              ))}
            </div>
            <div className="h-10 rounded-xl bg-[#f4f8fc]" />
          </div>
        ) : (
          <UnitMonitoringKpiStrip
            selectedUnit={selectedUnit}
            activeUnitRow={activeUnitRow}
            stageFilter={stageFilter}
            totals={totals}
            onSelectStageFilter={setStageFilter}
            onClearUnit={() => setSelectedUnit('ALL')}
          />
        )}
      </div>

      {isInitialSkeleton ? (
        <div className="h-72 rounded-2xl bg-white border border-[#dbe8f5] p-5 animate-pulse space-y-3">
          <div className="h-9 rounded-full bg-[#f1f6fc] w-2/3" />
          <div className="h-44 rounded-xl bg-[#f8fbff]" />
        </div>
      ) : (
        <>
          <UnitMonitoringTable
            selectedUnit={selectedUnit}
            selectedGroup={selectedGroup}
            stageFilter={stageFilter}
            searchQuery={searchQuery}
            includeTest={includeTest}
            filteredUnitRows={filteredUnitRows}
            onSelectUnit={setSelectedUnit}
            onSelectGroup={setSelectedGroup}
            onResetStageFilter={() => setStageFilter('ALL')}
            onChangeSearch={setSearchQuery}
            onToggleIncludeTest={setIncludeTest}
          />

          <UnitMonitoringHistoryPanel
            selectedUnit={selectedUnit}
            tickets={tickets}
            history={history}
            externalStatusSync={STAGE_TO_TICKET_TAB[stageFilter]}
            onSelectUnit={setSelectedUnit}
          />
        </>
      )}
    </section>
  );
}
