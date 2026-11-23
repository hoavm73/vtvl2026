'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthHydration } from '@/components/auth/AuthSessionProvider';
import { Header } from '@/components/layout/Header';
import { PageHeaderProvider } from '@/components/layout/PageHeaderContext';
import { Footer } from '@/components/layout/Footer';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { PageWorkspaceSkeleton } from '@/components/ui/Skeleton';
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
  const { isServerVerified, serverAuthenticated } = useAuthHydration();
  const [collapsed, setCollapsed] = useState(false);
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

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
    setSessionChecked(true);
    if (isServerVerified && !serverAuthenticated && !cur && pathname !== '/login') {
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
  }, [refreshSession, pathname, router, isServerVerified, serverAuthenticated]);

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
    <PageHeaderProvider>
    <div className="min-h-screen w-full max-w-full flex flex-col overflow-x-clip relative bg-[#f8fbff] print:block print:overflow-visible print:min-h-0 print:bg-white">
      {!isLoginPage && isLoggedIn && <Header sidebarCollapsed={collapsed} />}

      {isLoginPage ? (
        <main className="flex-1 w-full max-w-full flex flex-col min-h-screen print:block print:overflow-visible print:min-h-0">{children}</main>
      ) : !isLoggedIn ? (
        <main className="flex-1 w-full max-w-full min-h-screen bg-[#f8fafc] py-4 sm:py-6">
          <PageWorkspaceSkeleton
            statusText={sessionChecked ? 'Đang chuyển hướng đến Cổng đăng nhập HCM-UTE…' : 'Đang khởi tạo phiên làm việc…'}
          />
        </main>
      ) : (
        <div className="flex-1 flex w-full max-w-full min-w-0 print:block print:overflow-visible">
          <AppSidebar
            collapsed={collapsed}
            session={session}
            onToggle={handleToggleSidebar}
          />
          <main className="flex-1 w-full max-w-full min-w-0 flex flex-col overflow-x-clip print:block print:overflow-visible">
            {children}
          </main>
        </div>
      )}

      {!isLoginPage && isLoggedIn && <Footer />}
    </div>
    </PageHeaderProvider>
  );
}
