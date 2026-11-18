'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import {
  clearCurrentOperatorSession,
  getCurrentOperatorSession,
  normalizeEmail,
  saveCurrentOperatorSession
} from '@/services/telemetry/operator-session';
import { markEmailAsOnboarded, UserAccountRecord } from '@/services/auth/account-client';
import { isLogoutInProgress } from '@/services/auth/google-auth';

interface AuthHydrationContextValue {
  isServerVerified: boolean;
  serverAuthenticated: boolean;
  refreshServerSession: () => Promise<void>;
}

const AuthHydrationContext = createContext<AuthHydrationContextValue>({
  isServerVerified: false,
  serverAuthenticated: false,
  refreshServerSession: async () => {}
});

export function useAuthHydration(): AuthHydrationContextValue {
  return useContext(AuthHydrationContext);
}

function CookieSessionSynchronizer({ children }: { children: React.ReactNode }) {
  const { data: nextAuthSession, status: nextAuthStatus } = useSession();
  const pathname = usePathname();
  const [isServerVerified, setIsServerVerified] = useState(false);
  const [serverAuthenticated, setServerAuthenticated] = useState(false);

  const verifyCookieSession = useCallback(async () => {
    if (isLogoutInProgress()) return;
    try {
      const res = await fetch('/api/auth/session-state', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });
      if (!res.ok || isLogoutInProgress()) {
        setIsServerVerified(true);
        return;
      }

      const data = await res.json();
      if (isLogoutInProgress()) return;

      if (data.authenticated && data.account) {
        const acc = data.account as UserAccountRecord;
        const existing = getCurrentOperatorSession();
        const isTcns = acc.email === 'tcns@hcmute.edu.vn';
        const effectiveUnit = isTcns ? 'TCNS' : acc.unitCode;
        const hasSelected = isTcns || Boolean(acc.hasSelectedUnit) || acc.role === 'admin' || acc.role === 'unit_leader';

        if (hasSelected) {
          markEmailAsOnboarded(acc.email);
        }

        if (
          !existing ||
          existing.email !== acc.email ||
          existing.role !== acc.role ||
          existing.unitCode !== effectiveUnit ||
          existing.hasSelectedUnit !== hasSelected ||
          (data.sessionToken && existing.accessToken !== data.sessionToken)
        ) {
          saveCurrentOperatorSession(acc.email, effectiveUnit, acc.title, {
            displayName: acc.displayName,
            avatarUrl: acc.avatarUrl || nextAuthSession?.user?.image || existing?.avatarUrl || '',
            authProvider: acc.authProvider || 'email',
            accessToken: data.sessionToken || existing?.accessToken,
            role: acc.role,
            hasSelectedUnit: hasSelected
          });
        }
        setServerAuthenticated(true);
      } else {
        // Cookie máy chủ không còn hợp lệ (đã đăng xuất / hết hạn / bị khóa) -> xóa phiên localStorage cũ
        setServerAuthenticated(false);
        if (getCurrentOperatorSession()) {
          clearCurrentOperatorSession();
        }
      }
    } catch {
      // Khi mất mạng tạm thời, giữ nguyên trạng thái hiện tại
    } finally {
      setIsServerVerified(true);
    }
  }, [nextAuthSession?.user?.image]);

  // Đồng bộ nhanh từ NextAuth khi vừa callback OAuth thành công
  useEffect(() => {
    if (isLogoutInProgress()) return;
    if (nextAuthStatus === 'authenticated' && nextAuthSession?.user?.email) {
      const email = normalizeEmail(nextAuthSession.user.email);
      const existing = getCurrentOperatorSession();
      if (!existing || existing.email !== email) {
        const isTcns = email === 'tcns@hcmute.edu.vn';
        const role = isTcns ? 'admin' : nextAuthSession.user.role || 'staff';
        const unitCode = isTcns ? 'TCNS' : nextAuthSession.user.unitCode || 'CNTT';
        const title = isTcns ? 'Phòng Tổ chức – Nhân sự' : nextAuthSession.user.title || 'Cán bộ – Giảng viên';
        const hasSelectedUnit = isTcns || Boolean(nextAuthSession.user.hasSelectedUnit);
        if (hasSelectedUnit) markEmailAsOnboarded(email);
        saveCurrentOperatorSession(email, unitCode, title, {
          displayName: nextAuthSession.user.name || email.split('@')[0],
          avatarUrl: nextAuthSession.user.image || '',
          authProvider: 'google',
          accessToken: nextAuthSession.user.sessionToken,
          role,
          hasSelectedUnit
        });
      }
      setServerAuthenticated(true);
    }
  }, [nextAuthSession, nextAuthStatus]);

  // Xác thực lại với HTTP-only cookie máy chủ khi tải trang (F5) hoặc đổi trang
  useEffect(() => {
    if (nextAuthStatus === 'loading') return;
    void verifyCookieSession();
  }, [pathname, nextAuthStatus, verifyCookieSession]);

  return (
    <AuthHydrationContext.Provider
      value={{
        isServerVerified,
        serverAuthenticated,
        refreshServerSession: verifyCookieSession
      }}
    >
      {children}
    </AuthHydrationContext.Provider>
  );
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <CookieSessionSynchronizer>{children}</CookieSessionSynchronizer>
    </SessionProvider>
  );
}
