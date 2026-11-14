'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet, UserCheck, Building2, ShieldCheck, RefreshCw, AlertCircle, Users
} from 'lucide-react';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminSessionsTab } from '@/components/admin/AdminSessionsTab';
import { AdminAccountsTab } from '@/components/admin/AdminAccountsTab';
import { AdminSessionControlTab } from '@/components/admin/AdminSessionControlTab';
import { AdminUnitsTab } from '@/components/admin/AdminUnitsTab';
import { UnitOrgTreeModal } from '@/components/admin/UnitOrgTreeModal';
import { AdminSkeletonLoading } from '@/components/admin/AdminSkeletonLoading';
import { getCurrentOperatorSession, clearCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { loginAsAdminSession } from '@/services/auth/admin-auth-client';
import { getAdminUnits } from '@/services/units/unit-management';

type AdminTabKey = 'sessions' | 'accounts' | 'session-control' | 'units';

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTabKey>('sessions');

  const [sessionCount, setSessionCount] = useState(0);
  const [accountCount, setAccountCount] = useState(0);
  const [activeUnitCode, setActiveUnitCode] = useState('Chưa kích hoạt');
  const [unitCount, setUnitCount] = useState(51);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOrgTreeModalOpen, setIsOrgTreeModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'accounts' || tabParam === 'sessions' || tabParam === 'session-control' || tabParam === 'units') {
      setActiveTab(tabParam);
    }
  }, []);

  const checkAuthAndLoadStats = useCallback(async () => {
    try {
      const cur = getCurrentOperatorSession();
      const headers: Record<string, string> = {};
      let adminToken = '';
      if (typeof window !== 'undefined') {
        try {
          adminToken = sessionStorage.getItem('hcmute_vtvl_admin_token') || '';
        } catch {
          // ignore
        }
      }
      if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
      } else if (cur?.accessToken) {
        headers.Authorization = `Bearer ${cur.accessToken}`;
      }
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

      setIsAuthenticated(true);
      setAuthError(null);

      let activeSession = cur;
      if (cur?.email !== 'tcns@hcmute.edu.vn' && cur?.role !== 'admin') {
        activeSession = loginAsAdminSession();
      }

      setActiveUnitCode(activeSession ? `[${activeSession.unitCode}] ${activeSession.email}` : 'Chưa kích hoạt');
      setUnitCount(getAdminUnits().length);

      const [sessRes, accRes] = await Promise.all([
        fetch('/api/admin/sessions', { headers }),
        fetch('/api/admin/accounts', { headers })
      ]);
      if (sessRes.ok) {
        const sessJson = await sessRes.json();
        setSessionCount(sessJson.total || 0);
      } else {
        setSessionCount(0);
      }
      if (accRes.ok) {
        const accJson = await accRes.json();
        setAccountCount(accJson.total || 0);
      }
    } catch {
      setIsAuthenticated(false);
      setAuthError('Không thể xác minh quyền quản trị do lỗi kết nối mạng.');
    }
  }, []);

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
    if (isAuthenticated === false) {
      router.replace('/login?redirect=/admin&admin=true');
    }
  }, [isAuthenticated, router]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await checkAuthAndLoadStats();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
    } catch { /* ignore */ }
    clearCurrentOperatorSession();
    setIsAuthenticated(false);
    setSessionCount(0);
    router.push('/login?redirect=/admin&admin=true');
  };

  if (isAuthenticated === null) {
    return <AdminSkeletonLoading />;
  }

  if (authError) {
    return (
      <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-red-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#004776]">Không thể xác minh quyền quản trị</h3>
            <p className="text-xs text-[#64748b] mt-1">{authError}</p>
          </div>
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

  return (
    <main className="min-h-screen bg-[#f8fafc] py-3 sm:py-5 px-3 sm:px-5 lg:px-6">
      <div className="max-w-[1680px] mx-auto min-w-0">
        <div className="bg-white rounded-[14px] border border-[#e2e8f0] shadow-2xs overflow-visible min-w-0 max-w-full">
          <AdminHeader
            onLogout={handleLogout}
            onOpenOrgTree={() => setIsOrgTreeModalOpen(true)}
          />

          <div className="px-4 sm:px-5 py-2.5 bg-slate-50/50 border-b border-[#f1f5f9] flex flex-wrap items-center gap-2 min-w-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-[#004776] border border-blue-200/70">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#004776] shrink-0" />
              <span>{sessionCount} hồ sơ</span>
              <button
                type="button"
                onClick={handleManualRefresh}
                title="Làm mới dữ liệu từ máy chủ"
                className="ml-1 text-[#004776]/70 hover:text-[#004776] transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-[#004776] border border-sky-200/70">
              <Users className="w-3.5 h-3.5 text-[#004776] shrink-0" />
              <span>{accountCount} tài khoản</span>
            </div>

            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70 max-w-[calc(100vw-3rem)] sm:max-w-md truncate min-w-0"
              title={activeUnitCode}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="truncate">Phiên: {activeUnitCode}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200/70">
              <Building2 className="w-3.5 h-3.5 text-purple-700 shrink-0" />
              <span>{unitCount} đơn vị</span>
            </div>
          </div>

          <div className="px-3 sm:px-6 border-b border-[#e2e8f0] flex items-center gap-1 sm:gap-2 bg-white overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`h-[50px] inline-flex items-center gap-2 text-xs sm:text-[13px] font-bold transition-all cursor-pointer border-b-[3px] -mb-[1px] px-3 sm:px-4 whitespace-nowrap ${
                activeTab === 'sessions'
                  ? 'text-[#004776] border-[#004776] bg-blue-50/40'
                  : 'text-[#64748b] border-transparent hover:text-[#004776] hover:bg-slate-50'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>1. Phiên &amp; Bảng biểu kết quả ({sessionCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('accounts')}
              className={`h-[50px] inline-flex items-center gap-2 text-xs sm:text-[13px] font-bold transition-all cursor-pointer border-b-[3px] -mb-[1px] px-3 sm:px-4 whitespace-nowrap ${
                activeTab === 'accounts'
                  ? 'text-[#004776] border-[#004776] bg-blue-50/40'
                  : 'text-[#64748b] border-transparent hover:text-[#004776] hover:bg-slate-50'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>2. Tài khoản &amp; Phân quyền ({accountCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('session-control')}
              className={`h-[50px] inline-flex items-center gap-2 text-xs sm:text-[13px] font-bold transition-all cursor-pointer border-b-[3px] -mb-[1px] px-3 sm:px-4 whitespace-nowrap ${
                activeTab === 'session-control'
                  ? 'text-[#004776] border-[#004776] bg-blue-50/40'
                  : 'text-[#64748b] border-transparent hover:text-[#004776] hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-4 h-4 shrink-0" />
              <span>3. Quản trị phiên làm việc</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('units')}
              className={`h-[50px] inline-flex items-center gap-2 text-xs sm:text-[13px] font-bold transition-all cursor-pointer border-b-[3px] -mb-[1px] px-3 sm:px-4 whitespace-nowrap ${
                activeTab === 'units'
                  ? 'text-[#004776] border-[#004776] bg-blue-50/40'
                  : 'text-[#64748b] border-transparent hover:text-[#004776] hover:bg-slate-50'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>4. Quản trị đơn vị &amp; Mã đơn vị ({unitCount})</span>
            </button>
          </div>

          <div className="p-4 sm:p-5">
            {activeTab === 'sessions' && <AdminSessionsTab />}
            {activeTab === 'accounts' && <AdminAccountsTab />}
            {activeTab === 'session-control' && <AdminSessionControlTab />}
            {activeTab === 'units' && <AdminUnitsTab />}
          </div>
        </div>

        <UnitOrgTreeModal
          isOpen={isOrgTreeModalOpen}
          onClose={() => setIsOrgTreeModalOpen(false)}
          defaultUnitCode={getCurrentOperatorSession()?.unitCode || 'FIT'}
        />
      </div>
    </main>
  );
}
