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
  { value: 'admin', label: 'Phòng Tổ chức – Nhân sự', description: 'Toàn quyền quản trị tất cả 51 đơn vị, mở khóa C1 và phân quyền tài khoản' },
  { value: 'unit_leader', label: 'Lãnh đạo đơn vị', description: 'Xem toàn bộ dữ liệu, phiếu công việc và toàn quyền chỉnh sửa trong đơn vị mình' },
  { value: 'staff', label: 'Cán bộ – Giảng viên', description: 'Tạo, quản lý Phiếu công việc cá nhân và xem bảng dữ liệu của đơn vị (chỉ đọc)' }
];

export const STANDARD_USER_TITLES = ['Lãnh đạo đơn vị', 'Cán bộ – Giảng viên'];
export const ADMIN_USER_TITLES = ['Phòng Tổ chức – Nhân sự', 'Lãnh đạo đơn vị', 'Cán bộ – Giảng viên'];

export function getRoleLabel(role?: UserRole): string {
  const found = ROLE_OPTIONS.find((item) => item.value === role);
  return found ? found.label : 'Cán bộ – Giảng viên';
}

export function getRoleBadgeVariant(role?: UserRole): 'default' | 'secondary' | 'success' | 'warning' {
  if (role === 'admin') return 'warning';
  if (role === 'unit_leader') return 'success';
  return 'default';
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
          hasSelectedUnit: account.hasSelectedUnit
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
    const res = await fetch('/api/accounts', {
      method: 'PATCH',
      headers: buildAuthHeaders(session),
      body: JSON.stringify({
        email: session.email,
        displayName: updates.displayName,
        unitCode: updates.unitCode,
        title: updates.title,
        role: updates.role,
        hasSelectedUnit: updates.hasSelectedUnit
      })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || 'Không thể cập nhật thông tin tài khoản.' };
    }
    const account = json.account as UserAccountRecord;
    saveCurrentOperatorSession(account.email, account.unitCode, account.title, {
      displayName: account.displayName,
      avatarUrl: account.avatarUrl || session.avatarUrl,
      authProvider: session.authProvider,
      accessToken: session.accessToken,
      role: account.role,
      hasSelectedUnit: account.hasSelectedUnit
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

