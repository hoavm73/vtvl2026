'use client';

import { signIn, signOut } from 'next-auth/react';
import {
  OperatorSession,
  clearCurrentOperatorSession
} from '@/services/telemetry/operator-session';

export interface GoogleLoginCheckResult {
  ok: boolean;
  reason?: 'PROVIDER_DISABLED' | 'MISSING_CONFIG' | 'NETWORK_ERROR';
  message?: string;
}

let logoutInProgress = false;

export function isLogoutInProgress(): boolean {
  return logoutInProgress;
}

/**
 * Khởi chạy đăng nhập Google OAuth qua NextAuth (/api/auth/signin/google)
 */
export async function startGoogleOAuthLogin(redirectPath = '/'): Promise<GoogleLoginCheckResult> {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'MISSING_CONFIG', message: 'Không thể đăng nhập ngoài trình duyệt.' };
  }

  try {
    logoutInProgress = false;
    const safePath = redirectPath.startsWith('/') ? redirectPath : '/';
    const checkRes = await fetch(`/api/auth/google?redirect=${encodeURIComponent(safePath)}`, {
      cache: 'no-store'
    });
    const checkData = await checkRes.json().catch(() => ({}));

    if (!checkRes.ok || !checkData.ok) {
      return {
        ok: false,
        reason: checkData.reason || 'MISSING_CONFIG',
        message:
          checkData.message ||
          'Chưa cấu hình GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET trên máy chủ.'
      };
    }

    await signIn('google', { callbackUrl: safePath });
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: 'NETWORK_ERROR',
      message: 'Lỗi kết nối đến máy chủ xác thực NextAuth (/api/auth).'
    };
  }
}

export function consumeGoogleOAuthCallback(): OperatorSession | null {
  return null;
}

/**
 * Đăng xuất chuẩn Cookie-First: xóa đồng bộ toàn bộ HTTP-only cookies trên máy chủ
 * (NextAuth + Session Token + Admin Token), dọn localStorage/sessionStorage và điều hướng sạch.
 */
export async function performFullLogout(redirectTo = '/login'): Promise<void> {
  logoutInProgress = true;
  clearCurrentOperatorSession();

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('hcmute_vtvl_admin_token');
      sessionStorage.removeItem('vtvl_c1_unlocked');
      localStorage.removeItem('hcmute_vtvl_unit_session');
    } catch { /* ignore */ }

    await Promise.allSettled([
      fetch('/api/auth/logout', { method: 'POST', credentials: 'include', cache: 'no-store' }),
      fetch('/api/admin/c1-lock', { method: 'DELETE', credentials: 'include' }),
      signOut({ redirect: false })
    ]);

    window.location.replace(redirectTo);
  }
}

export function signOutGoogleSession(): void {
  void performFullLogout('/login');
}
