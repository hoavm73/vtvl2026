'use client';

import {
  OperatorSession,
  saveCurrentOperatorSession
} from '@/services/telemetry/operator-session';

export type UserRole = 'admin' | 'unit_leader' | 'staff';

export interface UserAccountRecord {
  email: string;
  displayName: string;
  unitCode: string;
  unitNameVi: string;
  title: string;
  role: UserRole;
  authProvider: 'google' | 'email';
  avatarUrl?: string;
  status: 'active' | 'suspended';
  hasSelectedUnit?: boolean;
  createdAt: string;
  lastActiveAt: string;
}

export const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Phòng Tổ chức – Nhân sự', description: 'Toàn quyền quản trị tất cả 48 đơn vị, mở khóa C1 và phân quyền tài khoản' },
  { value: 'unit_leader', label: 'Lãnh đạo đơn vị', description: 'Xem toàn bộ dữ liệu, phiếu công việc và toàn quyền chỉnh sửa trong đơn vị mình' },
  { value: 'staff', label: 'Cán bộ – Giảng viên', description: 'Tạo, quản lý Phiếu công việc cá nhân và xem bảng dữ liệu của đơn vị (chỉ đọc)' }
];

export const STANDARD_USER_TITLES = ['Lãnh đạo đơn vị', 'Cán bộ – Giảng viên'];
export const ADMIN_USER_TITLES = ['Phòng Tổ chức – Nhân sự', 'Lãnh đạo đơn vị', 'Cán bộ – Giảng viên'];

export function getRoleLabel(role?: UserRole): string {
  const found = ROLE_OPTIONS.find((item) => item.value === role);
  return found ? found.label : 'Cán bộ – Giảng viên';
}

export function getRoleFromTitle(title?: string): UserRole {
  const t = (title || '').trim().toLowerCase();
  if (t.includes('tổ chức') || t.includes('nhân sự') || t === 'admin') return 'admin';
  if (t.includes('lãnh đạo') || t.includes('trưởng') || t.includes('phó') || t === 'unit_leader') return 'unit_leader';
  return 'staff';
}

export function getRoleBadgeVariant(role?: UserRole): 'default' | 'secondary' | 'success' | 'warning' {
  if (role === 'admin') return 'warning';
  if (role === 'unit_leader') return 'success';
  return 'default';
}

const ONBOARDED_EMAILS_KEY = 'vtvl_onboarded_emails_v1';

export function isEmailAlreadyOnboarded(email: string): boolean {
  if (typeof window === 'undefined') return false;
  const norm = (email || '').trim().toLowerCase();
  if (!norm) return false;
  if (norm === 'tcns@hcmute.edu.vn') return true;
  try {
    const raw = localStorage.getItem(ONBOARDED_EMAILS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (list.includes(norm)) return true;
  } catch { /* ignore */ }
  return false;
}

export function markEmailAsOnboarded(email: string): void {
  if (typeof window === 'undefined') return;
  const norm = (email || '').trim().toLowerCase();
  if (!norm) return;
  try {
    const raw = localStorage.getItem(ONBOARDED_EMAILS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(norm)) {
      list.push(norm);
      localStorage.setItem(ONBOARDED_EMAILS_KEY, JSON.stringify(list));
    }
  } catch { /* ignore */ }
}

function buildAuthHeaders(session?: OperatorSession | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  if (session?.email) headers['x-actor-email'] = session.email;
  return headers;
}

export async function syncOperatorAccountWithServer(
  session: OperatorSession | null
): Promise<{ account: UserAccountRecord | null; isAdmin: boolean }> {
  if (!session?.email) return { account: null, isAdmin: false };
  try {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: buildAuthHeaders(session),
      body: JSON.stringify({
        email: session.email,
        displayName: session.displayName,
        unitCode: session.unitCode,
        title: session.title,
        avatarUrl: session.avatarUrl,
        authProvider: session.authProvider || 'email',
        hasSelectedUnit: session.hasSelectedUnit
      })
    });
    if (!res.ok) return { account: null, isAdmin: false };
    const json = await res.json();
    const account = json.account as UserAccountRecord | undefined;
    if (account) {
      if (account.hasSelectedUnit || account.role === 'unit_leader' || account.role === 'admin') {
        markEmailAsOnboarded(account.email);
      }
      const changed =
        account.role !== session.role ||
        (account.displayName && account.displayName !== session.displayName) ||
        account.unitCode !== session.unitCode ||
        account.title !== session.title ||
        account.hasSelectedUnit !== session.hasSelectedUnit;
      if (changed) {
        saveCurrentOperatorSession(account.email, account.unitCode, account.title, {
          displayName: account.displayName,
          avatarUrl: account.avatarUrl || session.avatarUrl,
          authProvider: session.authProvider,
          accessToken: session.accessToken,
          role: account.role,
          hasSelectedUnit: account.hasSelectedUnit ?? true
        });
      }
      return { account, isAdmin: Boolean(json.isAdmin) };
    }
    return { account: null, isAdmin: Boolean(json.isAdmin) };
  } catch {
    return { account: null, isAdmin: false };
  }
}

export async function updateMyAccountOnServer(
  session: OperatorSession,
  updates: {
    displayName?: string;
    unitCode?: string;
    title?: string;
    role?: UserRole;
    hasSelectedUnit?: boolean;
  }
): Promise<{ ok: boolean; account?: UserAccountRecord; error?: string }> {
  try {
    const resolvedRole = updates.role || (updates.title ? getRoleFromTitle(updates.title) : undefined);
    const resolvedTitle = updates.title || (resolvedRole ? getRoleLabel(resolvedRole) : undefined);
    const res = await fetch('/api/accounts', {
      method: 'PATCH',
      headers: buildAuthHeaders(session),
      body: JSON.stringify({
        email: session.email,
        displayName: updates.displayName,
        unitCode: updates.unitCode,
        title: resolvedTitle,
        role: resolvedRole,
        hasSelectedUnit: updates.hasSelectedUnit
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || 'Không thể cập nhật thông tin tài khoản.' };
    }
    const account = json.account as UserAccountRecord;
    markEmailAsOnboarded(account.email);
    saveCurrentOperatorSession(account.email, account.unitCode, account.title, {
      displayName: account.displayName,
      avatarUrl: account.avatarUrl || session.avatarUrl,
      authProvider: session.authProvider,
      accessToken: session.accessToken,
      role: account.role,
      hasSelectedUnit: true
    });
    return { ok: true, account };
  } catch {
    return { ok: false, error: 'Lỗi kết nối máy chủ khi cập nhật tài khoản.' };
  }
}

export async function adminUpdateUserRoleOnServer(
  payload: {
    email: string;
    role: UserRole;
    unitCode?: string;
    title?: string;
    displayName?: string;
    status?: 'active' | 'suspended';
  },
  actorSession?: OperatorSession | null
): Promise<{ ok: boolean; account?: UserAccountRecord; error?: string }> {
  try {
    const res = await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: buildAuthHeaders(actorSession),
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || 'Không thể cập nhật vai trò người dùng.' };
    }
    return { ok: true, account: json.account };
  } catch {
    return { ok: false, error: 'Lỗi kết nối máy chủ khi phân quyền.' };
  }
}

