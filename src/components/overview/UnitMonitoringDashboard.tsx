'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { HCMUTE_UNITS } from '@/configs/hcmute-units';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import {
  UnitSummaryRow,
  MonitorTotals,
  MonitorTicketItem,
  MonitorHistoryItem
} from './UnitMonitoringTypes';
import { UnitMonitoringTable } from './UnitMonitoringTable';
import { UnitMonitoringHistoryPanel } from './UnitMonitoringHistoryPanel';

export function UnitMonitoringDashboard() {
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [includeTest, setIncludeTest] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
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

  return (
    <section className="bg-white rounded-3xl border border-[#d8e3ef] p-5 sm:p-6 shadow-[0_4px_20px_-4px_rgba(0,71,118,0.06)] space-y-5 text-[#004776]">
      {/* Header & Bộ lọc tổng hợp Toàn trường / Theo đơn vị */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#e2ecf7] pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-bold bg-[#e1edf8] text-[#004776]">
            <Layers className="w-3.5 h-3.5 text-[#0072BC]" />
            <span>Dành riêng cho Phòng Tổ chức - Nhân sự &amp; Quản trị viên</span>
          </div>
          <h2 className="text-base sm:text-xl font-bold text-[#004776]">
            Dashboard theo dõi tiến trình, số liệu phiếu và lịch sử đơn vị
          </h2>
          <p className="text-xs text-[#476885]">
            {activeUnitInfo
              ? `Đang lọc chi tiết: [${activeUnitInfo.code}] ${activeUnitInfo.nameVi}`
              : 'Đang xem tổng hợp toàn trường (39 đơn vị hoạt động chính thức)'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedUnit('ALL')}
            className={`h-10 px-3.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
              selectedUnit === 'ALL'
                ? 'bg-[#0072BC] text-white border-[#0072BC] shadow-xs'
                : 'bg-white text-[#004776] border-[#cbd5e1] hover:bg-[#eef5ff]'
            }`}
          >
            Tổng hợp toàn trường (39)
          </button>

          <select
            aria-label="Chọn đơn vị cần theo dõi"
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="h-10 px-3 rounded-xl border border-[#cbd5e1] bg-[#f8fbff] text-xs font-bold text-[#004776] outline-hidden focus:border-[#0072BC]"
          >
            <option value="ALL">-- Chọn lọc theo từng đơn vị (39 đơn vị) --</option>
            {HCMUTE_UNITS.map((u) => (
              <option key={u.code} value={u.code}>
                [{u.code}] {u.nameVi}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchMonitorData}
            className="h-10 px-3.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-bold text-[#004776] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0072BC] ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      <UnitMonitoringTable
        selectedUnit={selectedUnit}
        selectedGroup={selectedGroup}
        stageFilter={stageFilter}
        searchQuery={searchQuery}
        includeTest={includeTest}
        totals={totals}
        filteredUnitRows={filteredUnitRows}
        onSelectUnit={setSelectedUnit}
        onSelectGroup={setSelectedGroup}
        onChangeStageFilter={setStageFilter}
        onChangeSearch={setSearchQuery}
        onToggleIncludeTest={setIncludeTest}
      />

      <UnitMonitoringHistoryPanel
        selectedUnit={selectedUnit}
        tickets={tickets}
        history={history}
        onSelectUnit={setSelectedUnit}
      />
    </section>
  );
}
