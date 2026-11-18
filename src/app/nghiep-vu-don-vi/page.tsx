'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Building2, LayoutDashboard, FileSpreadsheet, ClipboardList, History, ShieldCheck, ExternalLink } from 'lucide-react';
import { HCMUTE_UNITS, findHcmuteUnit, UNIT_GROUPS } from '@/configs/hcmute-units';
import { useOperatorSession } from '@/components/excel-grid/useOperatorSession';
import { ExcelWorkbookViewer } from '@/components/excel-grid/ExcelWorkbookViewer';
import { ExcelSheetKey } from '@/components/excel-grid/excel-grid-types';
import { UnitWorkbookHistoryPanel } from '@/components/nghiep-vu-don-vi/UnitWorkbookHistoryPanel';
import { UnitProfileOverviewPanel } from '@/components/nghiep-vu-don-vi/UnitProfileOverviewPanel';
import { UnitWorkspaceTicketsPanel } from '@/components/nghiep-vu-don-vi/UnitWorkspaceTicketsPanel';
import { UnitWorkbookCheckPanel } from '@/components/ra-soat/UnitWorkbookCheckPanel';
import { UnitSummaryRow } from '@/components/overview/UnitMonitoringTypes';
import { WorkbookHistoryTimelineEvent } from '@/services/workbooks/workbook-history-service';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { syncOperatorAccountWithServer } from '@/services/auth/account-client';
import {
  getCanonicalWorkbookId,
  persistUnitContextSelection,
  resolveSafeUnitCode,
  syncContextQueryParams
} from '@/services/context/workbook-context';
import { StaffWorkTicket } from '@/types/staff-ticket';

type UnitWorkspaceTabKey = 'overview' | 'workbook' | 'tickets' | 'history' | 'check';

const UNIT_TABS: { key: UnitWorkspaceTabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview', label: 'Tổng quan đơn vị', icon: LayoutDashboard },
  { key: 'workbook', label: 'Bảng tính 10 biểu', icon: FileSpreadsheet },
  { key: 'tickets', label: 'Phiếu đơn vị', icon: ClipboardList },
  { key: 'history', label: 'Lịch sử & khôi phục', icon: History },
  { key: 'check', label: 'Kiểm tra trước khi gửi', icon: ShieldCheck }
];

function parseTab(raw: string | null): UnitWorkspaceTabKey {
  if (raw === 'workbook' || raw === 'tickets' || raw === 'history' || raw === 'check') return raw;
  return 'overview';
}

export default function NghiepVuDonViPage() {
  const { session } = useOperatorSession();
  const isAdmin = session?.role === 'admin';
  const userRole = session?.role || 'staff';

  const [activeTab, setActiveTab] = useState<UnitWorkspaceTabKey>('overview');
  const [selectedUnitCode, setSelectedUnitCode] = useState<string>('TCNS');
  const [sheetParam, setSheetParam] = useState<ExcelSheetKey | undefined>(undefined);
  const [summary, setSummary] = useState<UnitSummaryRow | null>(null);
  const [recentEvents, setRecentEvents] = useState<WorkbookHistoryTimelineEvent[]>([]);
  const [unitTickets, setUnitTickets] = useState<StaffWorkTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSyncingTokenRef = useRef(false);

  useEffect(() => {
    const applyFromUrl = () => {
      const p = new URLSearchParams(window.location.search);
      setActiveTab(parseTab(p.get('tab')));
      const reqUnit = p.get('unitCode') || p.get('unit');
      setSelectedUnitCode(resolveSafeUnitCode(session, reqUnit));
      const sh = p.get('sheet') as ExcelSheetKey | null;
      setSheetParam(sh || undefined);
    };
    applyFromUrl();
    window.addEventListener('popstate', applyFromUrl);
    return () => window.removeEventListener('popstate', applyFromUrl);
  }, [session]);

  const canonicalWbId = getCanonicalWorkbookId(selectedUnitCode);
  const activeUnit = findHcmuteUnit(selectedUnitCode);
  const groupLabel = UNIT_GROUPS.find((g) => g.id === activeUnit.group)?.label || activeUnit.group;

  const loadUnitWorkspaceData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const curOp = session || getCurrentOperatorSession();
      let activeToken = curOp?.accessToken || '';
      if (curOp && !activeToken && !isSyncingTokenRef.current) {
        isSyncingTokenRef.current = true;
        try {
          await syncOperatorAccountWithServer(curOp);
          const refreshed = getCurrentOperatorSession();
          if (refreshed?.accessToken) activeToken = refreshed.accessToken;
        } finally {
          isSyncingTokenRef.current = false;
        }
      }
      const headers: Record<string, string> = {};
      if (curOp?.email) headers['x-actor-email'] = curOp.email;
      if (activeToken) headers.Authorization = `Bearer ${activeToken}`;

      const [histRes, ticketRes] = await Promise.all([
        fetch(`/api/workbooks/${encodeURIComponent(canonicalWbId)}/history`, { headers, cache: 'no-store' }),
        fetch(`/api/tickets?unitCode=${encodeURIComponent(selectedUnitCode)}`, { headers, cache: 'no-store' })
      ]);
      const histJson = await histRes.json();
      if (!histRes.ok) {
        setError(histJson.error || 'Không thể tải thông tin hồ sơ đơn vị.');
      } else {
        setSummary(histJson.unitSummary || null);
        setRecentEvents(Array.isArray(histJson.timeline) ? histJson.timeline : []);
      }
      if (ticketRes.ok) {
        const tJson = await ticketRes.json();
        const list = Array.isArray(tJson.unitTickets)
          ? tJson.unitTickets
          : Array.isArray(tJson.tickets)
            ? tJson.tickets
            : [];
        setUnitTickets(list);
      }
    } catch {
      setError('Lỗi kết nối khi đồng bộ dữ liệu hồ sơ đơn vị.');
    } finally {
      setLoading(false);
    }
  }, [canonicalWbId, selectedUnitCode, session]);

  useEffect(() => {
    void loadUnitWorkspaceData();
    const onSync = () => void loadUnitWorkspaceData();
    window.addEventListener('vtvl-unit-session-updated', onSync);
    return () => window.removeEventListener('vtvl-unit-session-updated', onSync);
  }, [loadUnitWorkspaceData]);

  const handleSelectTab = (tab: UnitWorkspaceTabKey) => {
    setActiveTab(tab);
    syncContextQueryParams({ tab, unitCode: selectedUnitCode, workbookId: canonicalWbId }, 'push');
  };

  const handleUnitChange = (nextUnit: string) => {
    const safe = resolveSafeUnitCode(session, nextUnit);
    setSelectedUnitCode(safe);
    persistUnitContextSelection(safe);
    syncContextQueryParams({ tab: activeTab, unitCode: safe, workbookId: getCanonicalWorkbookId(safe) }, 'push');
  };

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 lg:px-6 py-4 sm:py-6 space-y-5 print:p-0 print:m-0 print:max-w-none print:space-y-0">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#e2e8f0] pb-4 print:hidden">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006cee]">
            <Building2 className="w-4 h-4" />
            <span>Hồ sơ Vị trí việc làm theo đơn vị</span>
          </div>
          <h1 className="page-title text-[#004776]">Hồ sơ &amp; nghiệp vụ đơn vị [{activeUnit.code}]</h1>
          <p className="text-xs sm:text-sm text-[#476885]">{activeUnit.nameVi}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <div className="flex items-center gap-2">
              <label htmlFor="unit-workspace-select" className="text-xs font-semibold text-[#20446c] whitespace-nowrap">Đơn vị:</label>
              <select
                id="unit-workspace-select"
                aria-label="Chọn đơn vị để xem hồ sơ"
                value={selectedUnitCode}
                onChange={(e) => handleUnitChange(e.target.value)}
                className="h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white text-xs font-semibold text-[#004776] max-w-[260px]"
              >
                {HCMUTE_UNITS.map((u) => (
                  <option key={u.code} value={u.code}>[{u.code}] {u.nameVi}</option>
                ))}
              </select>
            </div>
          )}
          <Link href={`/bang-tinh?unit=${encodeURIComponent(selectedUnitCode)}`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776]">
            <ExternalLink className="w-3.5 h-3.5 text-[#006cee]" /><span>Mở bảng tính toàn trang</span>
          </Link>
        </div>
      </header>

      <div className="md:hidden print:hidden">
        <label htmlFor="unit-workspace-mobile-tab" className="block text-xs font-semibold text-[#20446c] mb-1">Phân hệ hồ sơ đơn vị</label>
        <select
          id="unit-workspace-mobile-tab"
          aria-label="Chọn phân hệ hồ sơ đơn vị"
          value={activeTab}
          onChange={(e) => handleSelectTab(parseTab(e.target.value))}
          className="w-full min-h-[44px] px-3 rounded-[10px] border border-[#cbd5e1] bg-white text-sm font-bold text-[#004776]"
        >
          {UNIT_TABS.map((t) => (<option key={t.key} value={t.key}>{t.label}</option>))}
        </select>
      </div>

      <nav role="tablist" aria-label="Phân hệ hồ sơ đơn vị" className="hidden md:flex items-center gap-1 border-b border-[#e2e8f0] overflow-x-auto no-scrollbar print:hidden">
        {UNIT_TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleSelectTab(t.key)}
              className={`inline-flex items-center gap-1.5 h-10 px-3.5 text-xs sm:text-[13px] border-b-2 -mb-[1px] whitespace-nowrap cursor-pointer transition-colors ${active ? 'border-[#004776] text-[#004776] font-semibold' : 'border-transparent text-[#476885] hover:text-[#004776]'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === 'overview' && (
        <UnitProfileOverviewPanel
          unitCode={activeUnit.code}
          unitNameVi={activeUnit.nameVi}
          groupLabel={groupLabel}
          summary={summary}
          loading={loading}
          error={error}
          recentEvents={recentEvents}
          onSelectTab={(t) => handleSelectTab(t)}
        />
      )}

      {activeTab === 'workbook' && (
        <div className="space-y-3">
          <ExcelWorkbookViewer
            initialUnitCode={selectedUnitCode}
            requestedUnitCode={isAdmin ? selectedUnitCode : undefined}
            initialSheet={sheetParam}
          />
        </div>
      )}

      {activeTab === 'tickets' && (
        <UnitWorkspaceTicketsPanel
          unitCode={selectedUnitCode}
          unitNameVi={activeUnit.nameVi}
          tickets={unitTickets}
          loading={loading}
          session={session || getCurrentOperatorSession()}
          onRefresh={() => void loadUnitWorkspaceData()}
        />
      )}

      {activeTab === 'history' && (
        <UnitWorkbookHistoryPanel
          unitCode={selectedUnitCode}
          workbookId={canonicalWbId}
          userRole={userRole}
          allowRollback={userRole !== 'staff'}
          onRestored={() => void loadUnitWorkspaceData()}
        />
      )}

      {activeTab === 'check' && (
        <UnitWorkbookCheckPanel
          unitCode={selectedUnitCode}
          workbookId={canonicalWbId}
          revision={summary?.workbookRevision || 1}
          mode="unit"
          userRole={userRole}
          reviewStatusLabel={summary?.reviewStatusLabel}
          onSubmittedToTcns={() => void loadUnitWorkspaceData()}
        />
      )}
    </div>
  );
}
