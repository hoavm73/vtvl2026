'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet, UserCheck, Building2, AlertCircle, Users, BarChart3, ShieldCheck, History
} from 'lucide-react';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminStatusStrip } from '@/components/admin/AdminStatusStrip';
import { AdminSessionsTab } from '@/components/admin/AdminSessionsTab';
import { AdminAccountsTab } from '@/components/admin/AdminAccountsTab';
import { AdminSessionControlTab } from '@/components/admin/AdminSessionControlTab';
import { AdminUnitsTab } from '@/components/admin/AdminUnitsTab';
import { TcnsReviewListPanel } from '@/components/admin/TcnsReviewListPanel';
import { AdminSystemLogsTab } from '@/components/admin/AdminSystemLogsTab';
import { UnitMonitoringDashboard } from '@/components/overview/UnitMonitoringDashboard';
import { UnitOrgTreeModal } from '@/components/admin/UnitOrgTreeModal';
import { AdminSkeletonLoading } from '@/components/admin/AdminSkeletonLoading';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { loginAsAdminSession } from '@/services/auth/admin-auth-client';
import { performFullLogout } from '@/services/auth/google-auth';
import { getAdminUnits } from '@/services/units/unit-management';
import { syncContextQueryParams } from '@/services/context/workbook-context';

type AdminTabKey = 'overview' | 'sessions' | 'review' | 'accounts' | 'units' | 'session-control' | 'system-logs';

function parseAdminTab(raw: string | null): AdminTabKey {
  if (raw === 'unit-monitor' || raw === 'overview') return 'overview';
  if (raw === 'sessions' || raw === 'review' || raw === 'accounts' || raw === 'units' || raw === 'session-control' || raw === 'system-logs') return raw;
  return 'overview';
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<'admin' | 'unit_leader' | 'staff'>('admin');
  const [activeTab, setActiveTab] = useState<AdminTabKey>('overview');

  const [sessionCount, setSessionCount] = useState<number | null>(null);
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [activeUnitCode, setActiveUnitCode] = useState('Chưa kích hoạt');
  const [unitCount, setUnitCount] = useState(51);
  const [migrationSummary, setMigrationSummary] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOrgTreeModalOpen, setIsOrgTreeModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromUrl = () => setActiveTab(parseAdminTab(new URLSearchParams(window.location.search).get('tab')));
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const checkAuthAndLoadStats = useCallback(async () => {
    try {
      const cur = getCurrentOperatorSession();
      if (cur?.role === 'staff') {
        router.replace('/?notice=forbidden_staff_admin');
        return;
      }

      const headers: Record<string, string> = {};
      let adminToken = '';
      if (typeof window !== 'undefined') {
        try {
          adminToken = sessionStorage.getItem('hcmute_vtvl_admin_token') || '';
        } catch { /* ignore */ }
      }
      if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
      else if (cur?.accessToken) headers.Authorization = `Bearer ${cur.accessToken}`;
      if (cur?.email) headers['x-actor-email'] = cur.email;

      const authQuery = cur?.email ? `?email=${encodeURIComponent(cur.email)}` : '';
      const authRes = await fetch(`/api/admin/auth${authQuery}`, { headers, cache: 'no-store' });
      if (!authRes.ok) {
        setIsAuthenticated(false);
        setAuthError(null);
        return;
      }

      const authJson = await authRes.json();
      if (!authJson.authenticated) {
        setIsAuthenticated(false);
        setAuthError(null);
        return;
      }

      const isLeader = authJson.role === 'unit_leader' || cur?.role === 'unit_leader';
      const role = isLeader ? 'unit_leader' : 'admin';
      setCurrentRole(role);
      setIsAuthenticated(true);
      setAuthError(null);

      let activeSession = cur;
      if (role === 'admin' && cur?.email !== 'tcns@hcmute.edu.vn' && cur?.role !== 'admin') {
        activeSession = loginAsAdminSession();
      }

      setActiveUnitCode(activeSession ? `[${activeSession.unitCode}] ${activeSession.email}` : 'Chưa kích hoạt');
      setUnitCount(getAdminUnits().length);
      setStatsError(null);

      if (role === 'unit_leader') {
        setActiveTab('accounts');
        const accRes = await fetch('/api/admin/accounts', { headers });
        if (accRes.ok) {
          const accJson = await accRes.json();
          setAccountCount(accJson.total ?? (accJson.accounts?.length ?? 0));
        } else {
          setStatsError('Không thể tải số liệu tài khoản.');
        }
      } else {
        const [sessRes, accRes, migRes] = await Promise.all([
          fetch('/api/admin/sessions', { headers }),
          fetch('/api/admin/accounts', { headers }),
          fetch('/api/admin/migrations', { headers })
        ]);
        if (sessRes.ok) { const sessJson = await sessRes.json(); setSessionCount(sessJson.total ?? 0); }
        if (accRes.ok) { const accJson = await accRes.json(); setAccountCount(accJson.total ?? 0); }
        if (!sessRes.ok || !accRes.ok) setStatsError('Không thể tải đủ số liệu tổng hợp.');
        if (migRes.ok) {
          const migJson = await migRes.json();
          if (migJson?.ok) setMigrationSummary(`Đã đồng bộ CSDL (${migJson.sqlMigrations?.length || 0} SQL / ${migJson.prismaMigrations?.length || 0} Prisma)`);
        }
      }
    } catch {
      setIsAuthenticated(false);
      setAuthError('Không thể xác minh quyền quản trị do lỗi kết nối mạng.');
    }
  }, [router]);

  useEffect(() => {
    checkAuthAndLoadStats();
    const handleUpdate = () => checkAuthAndLoadStats();
    window.addEventListener('vtvl-operator-changed', handleUpdate);
    window.addEventListener('vtvl-units-updated', handleUpdate);
    return () => {
      window.removeEventListener('vtvl-operator-changed', handleUpdate);
      window.removeEventListener('vtvl-units-updated', handleUpdate);
    };
  }, [checkAuthAndLoadStats]);

  useEffect(() => {
    if (isAuthenticated === false && currentRole !== 'staff') {
      router.replace('/login?redirect=/admin&admin=true');
    }
  }, [isAuthenticated, currentRole, router]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await checkAuthAndLoadStats();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    setIsAuthenticated(false);
    setSessionCount(0);
    await performFullLogout('/login?redirect=/admin&admin=true');
  };

  if (isAuthenticated === null) return <AdminSkeletonLoading />;

  if (authError) {
    return (
      <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-red-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#004776]">Không thể xác minh quyền quản trị</h3>
          <p className="text-xs text-[#64748b] mt-1">{authError}</p>
          <button
            type="button"
            onClick={checkAuthAndLoadStats}
            className="w-full py-2.5 px-4 bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Thử lại
          </button>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#f8fafc] py-10 px-4">
        <AdminAuthGate />
      </main>
    );
  }

  const selectAdminTab = (tabKey: AdminTabKey) => {
    setActiveTab(tabKey);
    syncContextQueryParams({ tab: tabKey }, 'push');
  };

  const sessBadge = sessionCount === null ? '…' : sessionCount;
  const accBadge = accountCount === null ? '…' : accountCount;
  const isLeader = currentRole === 'unit_leader';
  const tabs: { key: AdminTabKey; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = isLeader
    ? [{ key: 'accounts', label: `Quản trị tài khoản đơn vị (${accBadge})`, shortLabel: `Tài khoản ĐV (${accBadge})`, icon: Users }]
    : [
        { key: 'overview', label: '1. Tổng quan theo dõi ĐV', shortLabel: 'Tổng quan', icon: BarChart3 },
        { key: 'sessions', label: `2. Phiên & Bảng biểu (${sessBadge})`, shortLabel: `Hồ sơ (${sessBadge})`, icon: FileSpreadsheet },
        { key: 'review', label: '3. Thẩm định cấp trường', shortLabel: 'Thẩm định', icon: ShieldCheck },
        { key: 'accounts', label: `4. Tài khoản & Phân quyền (${accBadge})`, shortLabel: `Tài khoản (${accBadge})`, icon: Users },
        { key: 'units', label: `5. Đơn vị (${unitCount})`, shortLabel: `Đơn vị (${unitCount})`, icon: Building2 },
        { key: 'session-control', label: '6. Quản trị phiên', shortLabel: 'Phiên', icon: UserCheck },
        { key: 'system-logs', label: '7. Nhật ký hệ thống', shortLabel: 'Nhật ký', icon: History }
      ];

  return (
    <div className="w-full max-w-full min-w-0 bg-[#f8fafc] py-4 sm:py-6 px-3 sm:px-6 overflow-x-hidden">
      <div className="max-w-[1680px] mx-auto w-full min-w-0 space-y-4">
        <header className="space-y-3 min-w-0">
          <AdminHeader
            onLogout={handleLogout}
            onOpenOrgTree={isLeader ? undefined : () => setIsOrgTreeModalOpen(true)}
          />

          <AdminStatusStrip
            isLeader={isLeader}
            sessionCount={sessionCount}
            accountCount={accountCount}
            activeUnitCode={activeUnitCode}
            unitCount={unitCount}
            migrationSummary={migrationSummary}
            statsError={statsError}
            isRefreshing={isRefreshing}
            onRefresh={handleManualRefresh}
          />

          <div className="sm:hidden">
            <label htmlFor="admin-mobile-view-select" className="sr-only">Chế độ xem quản trị</label>
            <select
              id="admin-mobile-view-select"
              aria-label="Chế độ xem quản trị"
              value={activeTab}
              onChange={(e) => selectAdminTab(e.target.value as AdminTabKey)}
              className="w-full min-h-[44px] px-3 rounded-[10px] border border-[#cbd5e1] bg-white text-sm font-bold text-[#004776]"
            >
              {tabs.map((tab) => (<option key={tab.key} value={tab.key}>{tab.label}</option>))}
            </select>
          </div>

          <div role="tablist" aria-label="Phân hệ quản trị" className="hidden sm:flex w-full max-w-full min-w-0 border-b border-[#e2e8f0] items-center gap-1 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} type="button" role="tab" aria-selected={isActive} onClick={() => selectAdminTab(tab.key)} className={`h-11 inline-flex items-center gap-2 text-[13px] font-bold transition-colors cursor-pointer border-b-[2.2px] -mb-[1px] px-4 whitespace-nowrap shrink-0 ${isActive ? 'text-[#004776] border-[#FD8C73]' : 'text-[#476885] border-transparent hover:text-[#004776]'}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="w-full max-w-full min-w-0">
          {activeTab === 'overview' && !isLeader && <UnitMonitoringDashboard />}
          {activeTab === 'sessions' && !isLeader && <AdminSessionsTab />}
          {activeTab === 'review' && !isLeader && (
            <TcnsReviewListPanel onSelectUnit={(u, wb) => router.push(`/admin/tham-dinh?unitCode=${encodeURIComponent(u)}&workbookId=${encodeURIComponent(wb)}`)} />
          )}
          {activeTab === 'accounts' && <AdminAccountsTab />}
          {activeTab === 'units' && !isLeader && <AdminUnitsTab />}
          {activeTab === 'session-control' && !isLeader && <AdminSessionControlTab />}
          {activeTab === 'system-logs' && !isLeader && <AdminSystemLogsTab />}
        </div>

        {!isLeader && (
          <UnitOrgTreeModal
            isOpen={isOrgTreeModalOpen}
            onClose={() => setIsOrgTreeModalOpen(false)}
            defaultUnitCode={getCurrentOperatorSession()?.unitCode || 'CNTT'}
          />
        )}
      </div>
    </div>
  );
}
