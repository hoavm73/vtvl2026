'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { getCurrentOperatorSession, OperatorSession } from '@/services/telemetry/operator-session';
import { consumeGoogleOAuthCallback } from '@/services/auth/google-auth';
import { syncUnitsWithServer } from '@/services/units/unit-management';

const SIDEBAR_STORAGE_KEY = 'vtvl_sidebar_collapsed';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [session, setSession] = useState<OperatorSession | null>(() => {
    if (typeof window !== 'undefined') {
      return getCurrentOperatorSession();
    }
    return null;
  });

  // Khôi phục trạng thái thu gọn sidebar từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) {
        setCollapsed(saved === 'true');
      }
    } catch {
      // Bỏ qua lỗi truy cập storage
    }
  }, []);

  // Lấy và theo dõi phiên đăng nhập của người dùng
  const refreshSession = useCallback(() => {
    const oauth = consumeGoogleOAuthCallback();
    const cur = oauth || getCurrentOperatorSession();
    setSession(cur);
    return cur;
  }, []);

  useEffect(() => {
    syncUnitsWithServer();
    const cur = refreshSession();
    const hasHashAuth = typeof window !== 'undefined' && window.location.hash.includes('access_token=');
    if (!cur && !hasHashAuth && pathname !== '/login') {
      router.replace('/login');
    }

    const handleCustomChange = () => refreshSession();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vtvl_operator_session') {
        refreshSession();
      }
    };

    window.addEventListener('vtvl-operator-changed', handleCustomChange);
    window.addEventListener('storage', handleStorageChange);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('hcmute_vtvl_realtime');
        channel.onmessage = (event) => {
          if (event.data?.type === 'OPERATOR_CHANGED' || event.data?.type === 'UNIT_SYNC') {
            refreshSession();
          }
        };
      } catch {
        // Trình duyệt không hỗ trợ BroadcastChannel
      }
    }

    return () => {
      window.removeEventListener('vtvl-operator-changed', handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
      if (channel) {
        channel.close();
      }
    };
  }, [refreshSession, pathname, router]);

  const handleToggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Bỏ qua
      }
      return next;
    });
  };

  const isLoginPage = pathname === '/login';
  const isLoggedIn = Boolean(session);

  return (
    <div className="min-h-screen flex flex-col overflow-x-clip relative bg-[#f8fbff]">
      {!isLoginPage && isLoggedIn && <Header />}

      {isLoginPage ? (
        <main className="flex-1 flex flex-col min-h-screen">{children}</main>
      ) : !isLoggedIn ? (
        <main className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-[#d8e3ef] flex items-center justify-center mb-4">
            <img src="/ute_logo.png" alt="HCM-UTE Logo" className="w-10 h-10 object-contain" />
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#004776] mb-1">
            <span className="w-4 h-4 border-2 border-[#0072BC] border-t-transparent rounded-full animate-spin" />
            <span>Đang chuyển hướng đến Cổng đăng nhập...</span>
          </div>
          <p className="text-xs text-[#64748b]">
            Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)
          </p>
        </main>
      ) : (
        <div className="flex-1 flex w-full">
          <AppSidebar
            collapsed={collapsed}
            session={session}
            onToggle={handleToggleSidebar}
          />
          <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
            {children}
          </main>
        </div>
      )}

      {!isLoginPage && isLoggedIn && <Footer />}
    </div>
  );
}
