'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, ArrowLeft } from 'lucide-react';
import { AdminAuthGate } from '@/components/admin/AdminAuthGate';
import { TcnsReviewListPanel } from '@/components/admin/TcnsReviewListPanel';
import { TcnsReviewDetailPanel, TcnsDetailTabKey } from '@/components/admin/TcnsReviewDetailPanel';
import { AdminSkeletonLoading } from '@/components/admin/AdminSkeletonLoading';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { getCanonicalWorkbookId, syncContextQueryParams } from '@/services/context/workbook-context';

function parseSubTab(raw: string | null): TcnsDetailTabKey {
  if (raw === 'check' || raw === 'sheets' || raw === 'comments' || raw === 'history') return raw;
  return 'overview';
}

export default function AdminThamDinhPage() {
  const [authState, setAuthState] = useState<'loading' | 'allowed' | 'need_login' | 'forbidden'>('loading');
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [selectedWorkbookId, setSelectedWorkbookId] = useState<string | undefined>(undefined);
  const [activeSubTab, setActiveSubTab] = useState<TcnsDetailTabKey>('overview');

  const verifyAdminAccess = useCallback(async () => {
    const cur = getCurrentOperatorSession();
    if (cur && cur.role !== 'admin' && cur.unitCode?.toUpperCase() !== 'TCNS') {
      setAuthState('forbidden');
      return;
    }
    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      try {
        const tok = sessionStorage.getItem('hcmute_vtvl_admin_token') || '';
        if (tok) headers.Authorization = `Bearer ${tok}`;
      } catch { /* ignore */ }
    }
    if (!headers.Authorization && cur?.accessToken) headers.Authorization = `Bearer ${cur.accessToken}`;
    if (cur?.email) headers['x-actor-email'] = cur.email;

    try {
      const q = cur?.email ? `?email=${encodeURIComponent(cur.email)}` : '';
      const res = await fetch(`/api/admin/auth${q}`, { headers, cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.authenticated) {
        setAuthState('need_login');
        return;
      }
      if (json.role === 'admin' || cur?.role === 'admin' || cur?.unitCode?.toUpperCase() === 'TCNS') {
        setAuthState('allowed');
      } else {
        setAuthState('forbidden');
      }
    } catch {
      setAuthState('need_login');
    }
  }, []);

  useEffect(() => {
    void verifyAdminAccess();
  }, [verifyAdminAccess]);

  useEffect(() => {
    const syncFromUrl = () => {
      const p = new URLSearchParams(window.location.search);
      const u = p.get('unitCode') || p.get('unit');
      const wb = p.get('workbookId') || undefined;
      setSelectedUnit(u ? u.toUpperCase() : null);
      setSelectedWorkbookId(wb);
      setActiveSubTab(parseSubTab(p.get('tab')));
    };
    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const handleOpenUnit = (unitCode: string, workbookId: string) => {
    setSelectedUnit(unitCode);
    setSelectedWorkbookId(workbookId);
    setActiveSubTab('overview');
    syncContextQueryParams({ unitCode, workbookId, tab: 'overview' }, 'push');
  };

  const handleBackToList = () => {
    setSelectedUnit(null);
    setSelectedWorkbookId(undefined);
    syncContextQueryParams({ unitCode: null, workbookId: null, tab: null }, 'push');
  };

  const handleSelectSubTab = (tab: TcnsDetailTabKey) => {
    setActiveSubTab(tab);
    syncContextQueryParams({ unitCode: selectedUnit, workbookId: selectedWorkbookId || (selectedUnit ? getCanonicalWorkbookId(selectedUnit) : null), tab }, 'push');
  };

  if (authState === 'loading') return <AdminSkeletonLoading />;
  if (authState === 'need_login') return <AdminAuthGate redirectUrl="/login?redirect=/admin/tham-dinh&admin=true" />;
  if (authState === 'forbidden') {
    return (
      <div className="w-full max-w-[720px] mx-auto px-4 py-12">
        <div className="rounded-[14px] border border-[#e2e8f0] bg-white p-6 space-y-3 text-center">
          <Lock className="w-8 h-8 text-[#b42318] mx-auto" />
          <h1 className="text-base font-bold text-[#004776]">Khu vực thẩm định dành riêng cho Phòng TCNS &amp; Quản trị viên</h1>
          <p className="text-xs sm:text-sm text-[#476885]">
            Cán bộ và Lãnh đạo đơn vị vui lòng sử dụng khu vực Hồ sơ đơn vị để tự kiểm tra và gửi hồ sơ.
          </p>
          <div className="pt-1">
            <Link href="/nghiep-vu-don-vi" className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-[10px] bg-[#006cee] text-white text-xs font-semibold">
              <ArrowLeft className="w-4 h-4" /><span>Về Hồ sơ đơn vị</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1360px] mx-auto px-3.5 sm:px-5 lg:px-6 py-4 sm:py-6 space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#e2e8f0] pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006cee]">
            <ShieldCheck className="w-4 h-4" />
            <span>Thẩm định cấp trường — Phòng Tổ chức – Nhân sự</span>
          </div>
          <h1 className="page-title text-[#0072BC]">Thẩm định hồ sơ Đề án Vị trí việc làm</h1>
        </div>
        <Link href="/admin" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-xs font-semibold text-[#004776]">
          <span>Quản trị hệ thống</span>
        </Link>
      </header>

      {selectedUnit ? (
        <TcnsReviewDetailPanel
          unitCode={selectedUnit}
          workbookId={selectedWorkbookId}
          activeTab={activeSubTab}
          onSelectTab={handleSelectSubTab}
          onBack={handleBackToList}
        />
      ) : (
        <TcnsReviewListPanel onSelectUnit={handleOpenUnit} />
      )}
    </div>
  );
}
