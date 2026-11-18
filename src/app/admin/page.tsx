'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet, UserCheck, Building2, AlertCircle, Users, RefreshCw, BarChart3
} from 'lucide-react';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSessionsTab } from '@/components/admin/AdminSessionsTab';
import { AdminAccountsTab } from '@/components/admin/AdminAccountsTab';
import { AdminSessionControlTab } from '@/components/admin/AdminSessionControlTab';
import { AdminUnitsTab } from '@/components/admin/AdminUnitsTab';
import { UnitMonitoringDashboard } from '@/components/overview/UnitMonitoringDashboard';
import { UnitOrgTreeModal } from '@/components/admin/UnitOrgTreeModal';
import { AdminSkeletonLoading } from '@/components/admin/AdminSkeletonLoading';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { loginAsAdminSession } from '@/services/auth/admin-auth-client';
import { performFullLogout } from '@/services/auth/google-auth';
import { getAdminUnits } from '@/services/units/unit-management';

type AdminTabKey = 'unit-monitor' | 'sessions' | 'accounts' | 'session-control' | 'units';

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<'admin' | 'unit_leader' | 'staff'>('admin');
  const [activeTab, setActiveTab] = useState<AdminTabKey>('unit-monitor');

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
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'unit-monitor' || tabParam === 'accounts' || tabParam === 'sessions' || tabParam === 'session-control' || tabParam === 'units') {
      setActiveTab(tabParam);
    }
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
            className="w-full py-2.5 px-4 bg-[#004776] hover:bg-[#00385c] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
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
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabKey);
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const sessBadge = sessionCount === null ? '…' : sessionCount;
  const accBadge = accountCount === null ? '…' : accountCount;
  const isLeader = currentRole === 'unit_leader';
  const tabs: { key: AdminTabKey; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = isLeader
    ? [{ key: 'accounts', label: `Quản trị tài khoản đơn vị (${accBadge})`, shortLabel: `Tài khoản ĐV (${accBadge})`, icon: Users }]
    : [
        { key: 'unit-monitor', label: 'Dashboard theo dõi đơn vị', shortLabel: 'Theo dõi ĐV', icon: BarChart3 },
        { key: 'sessions', label: `1. Phiên & Bảng biểu (${sessBadge})`, shortLabel: `1. Hồ sơ (${sessBadge})`, icon: FileSpreadsheet },
        { key: 'accounts', label: `2. Tài khoản & Phân quyền (${accBadge})`, shortLabel: `2. Tài khoản (${accBadge})`, icon: Users },
        { key: 'session-control', label: '3. Quản trị phiên', shortLabel: '3. Phiên', icon: UserCheck },
        { key: 'units', label: `4. Quản trị đơn vị (${unitCount})`, shortLabel: `4. Đơn vị (${unitCount})`, icon: Building2 }
      ];

  return (
    <div className="w-full max-w-full min-w-0 bg-[#f8fafc] py-4 sm:py-6 px-3 sm:px-6 overflow-x-hidden">
      <div className="max-w-[1680px] mx-auto w-full min-w-0 space-y-4">
        <header className="space-y-3 min-w-0">
          <AdminHeader
            onLogout={handleLogout}
            onOpenOrgTree={isLeader ? undefined : () => setIsOrgTreeModalOpen(true)}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-1 text-xs font-semibold text-[#20446c] min-w-0">
            {!isLeader && (
              <div className="inline-flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
                <span className="text-[#004776]">{sessionCount === null ? 'Đang tải hồ sơ…' : `${sessionCount} hồ sơ`}</span>
                <button type="button" onClick={handleManualRefresh} aria-label="Làm mới dữ liệu từ máy chủ" title="Làm mới dữ liệu từ máy chủ" className="ml-0.5 text-[#004776]/70 hover:text-[#004776] cursor-pointer">
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
              <span className="text-[#004776]">{accountCount === null ? 'Đang tải tài khoản…' : `${accountCount} tài khoản ${isLeader ? 'thuộc đơn vị' : ''}`}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 max-w-full sm:max-w-md truncate min-w-0" title={activeUnitCode}>
              <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="truncate text-emerald-800">Phiên: {activeUnitCode}</span>
            </div>
            {!isLeader && (
              <div className="inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
                <span className="text-[#004776]">{unitCount} đơn vị</span>
              </div>
            )}
            {!isLeader && migrationSummary && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#e9f0f8] text-[#004776]">{migrationSummary}</span>
            )}
            {statsError && (
              <button type="button" onClick={handleManualRefresh} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-50 text-[#b42318] cursor-pointer">
                <AlertCircle className="w-3.5 h-3.5" /><span>{statsError} Thử lại</span>
              </button>
            )}
          </div>

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
                <button key={tab.key} type="button" role="tab" aria-selected={isActive} onClick={() => selectAdminTab(tab.key)} className={`h-11 inline-flex items-center gap-2 text-[13px] font-bold transition-colors cursor-pointer border-b-2 -mb-[1px] px-4 whitespace-nowrap shrink-0 ${isActive ? 'text-[#004776] border-[#004776]' : 'text-[#476885] border-transparent hover:text-[#004776]'}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </header>

        <div className="w-full max-w-full min-w-0">
          {activeTab === 'unit-monitor' && !isLeader && <UnitMonitoringDashboard />}
          {activeTab === 'sessions' && !isLeader && <AdminSessionsTab />}
          {activeTab === 'accounts' && <AdminAccountsTab />}
          {activeTab === 'session-control' && !isLeader && <AdminSessionControlTab />}
          {activeTab === 'units' && !isLeader && <AdminUnitsTab />}
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
