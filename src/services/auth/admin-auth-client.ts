import { saveCurrentOperatorSession, clearCurrentOperatorSession, OperatorSession } from '@/services/telemetry/operator-session';
import { signOutGoogleSession } from './google-auth';

export const TCNS_ADMIN_EMAIL = 'tcns@hcmute.edu.vn';
export const TCNS_ADMIN_NAME = 'Phòng Tổ chức – Nhân sự';
export const TCNS_ADMIN_UNIT = 'TCNS';
export const TCNS_ADMIN_TITLE = 'Quản trị viên hệ thống';

export function loginAsAdminSession(): OperatorSession {
  return saveCurrentOperatorSession(
    TCNS_ADMIN_EMAIL,
    TCNS_ADMIN_UNIT,
    TCNS_ADMIN_TITLE,
    {
      displayName: TCNS_ADMIN_NAME,
      role: 'admin',
      hasSelectedUnit: true,
      authProvider: 'email'
    }
  );
}

export async function loginWithAdminPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = password.trim();
  if (!trimmed) {
    return { ok: false, error: 'Vui lòng nhập mật khẩu quản trị.' };
  }
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: trimmed })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error || 'Mật khẩu quản trị viên không chính xác.' };
    }
    loginAsAdminSession();
    return { ok: true };
  } catch {
    return { ok: false, error: 'Không thể kết nối đến máy chủ xác thực quản trị.' };
  }
}

export function logoutAdminSession(): void {
  signOutGoogleSession();
}
