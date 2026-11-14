'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { getCurrentOperatorSession, OperatorSession } from '@/services/telemetry/operator-session';

const SIDEBAR_STORAGE_KEY = 'vtvl_sidebar_collapsed';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [session, setSession] = useState<OperatorSession | null>(null);

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
    setSession(getCurrentOperatorSession());
  }, []);

  useEffect(() => {
    refreshSession();

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
          if (event.data?.type === 'OPERATOR_CHANGED') {
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
  }, [refreshSession]);

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

  return (
    <div className="min-h-screen flex flex-col overflow-x-clip relative">
      <Header />
      {isLoginPage ? (
        <main className="flex-1 flex flex-col">{children}</main>
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
      <Footer />
    </div>
  );
}
