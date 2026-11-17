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

/**
 * Khởi chạy đăng nhập Google OAuth qua NextAuth (/api/auth/signin/google)
 */
export async function startGoogleOAuthLogin(redirectPath = '/bang-tinh'): Promise<GoogleLoginCheckResult> {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'MISSING_CONFIG', message: 'Không thể đăng nhập ngoài trình duyệt.' };
  }

  try {
    const safePath = redirectPath.startsWith('/') ? redirectPath : '/bang-tinh';
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

export function signOutGoogleSession(): void {
  if (typeof window !== 'undefined') {
    fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => {});
    fetch('/api/admin/c1-lock', { method: 'DELETE' }).catch(() => {});
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    signOut({ redirect: false }).catch(() => {});
  }
  clearCurrentOperatorSession();
}
