'use client';

import {
  OperatorSession,
  normalizeEmail,
  saveCurrentOperatorSession,
  clearCurrentOperatorSession,
  getCurrentOperatorSession
} from '@/services/telemetry/operator-session';

export interface GoogleLoginCheckResult {
  ok: boolean;
  reason?: 'PROVIDER_DISABLED' | 'MISSING_CONFIG' | 'NETWORK_ERROR';
  message?: string;
}

/**
 * Khởi chạy đăng nhập Google OAuth qua API máy chủ Next.js (/api/auth/google)
 * Giúp ẩn hoàn toàn khóa Supabase và cấu hình OAuth khỏi trình duyệt
 */
export async function startGoogleOAuthLogin(redirectPath = '/bang-tinh'): Promise<GoogleLoginCheckResult> {
  if (typeof window === 'undefined') {
    return { ok: false, reason: 'MISSING_CONFIG', message: 'Không thể đăng nhập ngoài trình duyệt.' };
  }

  try {
    const query = `redirect=${encodeURIComponent(redirectPath)}&origin=${encodeURIComponent(window.location.origin)}`;
    const res = await fetch(`/api/auth/google?${query}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok && data.authorizeUrl) {
      window.location.href = data.authorizeUrl;
      return { ok: true };
    }

    return {
      ok: false,
      reason: data.reason || 'NETWORK_ERROR',
      message: data.message || 'Không thể khởi tạo phiên đăng nhập Google từ máy chủ.'
    };
  } catch {
    return {
      ok: false,
      reason: 'NETWORK_ERROR',
      message: 'Lỗi kết nối đến máy chủ xác thực (/api/auth/google).'
    };
  }
}

/**
 * Xử lý token trả về từ Supabase (#access_token=...) hoặc Google OAuth (#id_token=...)
 */
export function consumeGoogleOAuthCallback(defaultUnitCode = 'TCNS'): OperatorSession | null {
  if (typeof window === 'undefined') return null;
  const rawHash = window.location.hash;
  if (!rawHash || (!rawHash.includes('access_token=') && !rawHash.includes('id_token='))) {
    return null;
  }

  const params = new URLSearchParams(rawHash.slice(1));
  const token = params.get('access_token') || params.get('id_token');
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join('')
    );
    const payload = JSON.parse(jsonStr);

    const email = normalizeEmail(payload.email || '');
    if (!email) return null;

    const existing = getCurrentOperatorSession();
    const unitCode = existing?.unitCode || defaultUnitCode;
    const title = existing?.title || 'Chuyên viên';
    const displayName =
      payload.user_metadata?.full_name ||
      payload.user_metadata?.name ||
      payload.name ||
      email.split('@')[0];
    const avatarUrl =
      payload.user_metadata?.avatar_url ||
      payload.user_metadata?.picture ||
      payload.picture ||
      '';

    const session = saveCurrentOperatorSession(email, unitCode, title, {
      displayName,
      avatarUrl,
      authProvider: 'google',
      accessToken: token
    });

    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return session;
  } catch {
    return null;
  }
}

export function signOutGoogleSession(): void {
  if (typeof window !== 'undefined') {
    if (window.location.hash && (window.location.hash.includes('access_token=') || window.location.hash.includes('id_token='))) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => {});
    fetch('/api/admin/c1-lock', { method: 'DELETE' }).catch(() => {});
  }
  clearCurrentOperatorSession();
}

