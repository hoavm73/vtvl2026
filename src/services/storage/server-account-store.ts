import fs from 'fs';
import path from 'path';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import {
  normalizeEmail,
  syncServerWorkbooksFromSupabase,
  removeParticipantFromAllWorkbooks
} from './server-workbook-store';
import {
  UserRole,
  UserAccountRecord,
  VALID_ROLES,
  getRoleTitle,
  getRoleFromTitle,
  hashAccountPassword,
  verifyPasswordHash,
  stripAccountSensitiveFields
} from './account-crypto';
import {
  fetchAccountsFromSupabase,
  persistAccountToSupabase,
  deleteAccountFromSupabase,
  shadowSyncAccountsToTienDo
} from './server-account-db';

export type { UserRole, UserAccountRecord };
export { getRoleTitle, getRoleFromTitle, hashAccountPassword, verifyPasswordHash, stripAccountSensitiveFields };

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'server_accounts.json');
const DELETED_ACCOUNTS_FILE = path.join(DATA_DIR, 'deleted_accounts.json');

let memoryAccounts: Map<string, UserAccountRecord> | null = null;
let deletedAccountEmails: Set<string> | null = null;
let lastSupabaseSyncAt = 0;

function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && VALID_ROLES.includes(role as UserRole);
}

function loadDeletedAccountEmails(): Set<string> {
  if (deletedAccountEmails) return deletedAccountEmails;
  deletedAccountEmails = new Set();
  try {
    if (fs.existsSync(DELETED_ACCOUNTS_FILE)) {
      const list = JSON.parse(fs.readFileSync(DELETED_ACCOUNTS_FILE, 'utf8'));
      if (Array.isArray(list)) list.forEach((e) => deletedAccountEmails!.add(normalizeEmail(e)));
    }
  } catch { /* ignore */ }
  return deletedAccountEmails;
}

function persistDeletedAccountEmails(): void {
  if (!deletedAccountEmails) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DELETED_ACCOUNTS_FILE, JSON.stringify(Array.from(deletedAccountEmails)), 'utf8');
  } catch { /* ignore */ }
}

function normalizeRecord(item: Partial<UserAccountRecord> & { email: string }): UserAccountRecord {
  const email = normalizeEmail(item.email), unit = findHcmuteUnit(item.unitCode || 'CNTT'), now = new Date().toLocaleString('vi-VN');
  const isTcns = email === 'tcns@hcmute.edu.vn';
  const role: UserRole = isValidRole(item.role) ? item.role : (item.title ? getRoleFromTitle(item.title) : undefined) || (isTcns ? 'admin' : 'staff');
  return {
    email, displayName: (item.displayName || email.split('@')[0]).trim(), unitCode: unit.code, unitNameVi: unit.nameVi,
    title: getRoleTitle(role), role, authProvider: item.authProvider === 'google' ? 'google' : 'email',
    avatarUrl: item.avatarUrl, status: item.status === 'suspended' ? 'suspended' : 'active',
    hasSelectedUnit: item.hasSelectedUnit !== undefined ? Boolean(item.hasSelectedUnit) : (isTcns || role === 'admin' || role === 'unit_leader' || (Boolean(item.unitCode) && item.unitCode !== 'CNTT' && item.unitCode !== 'FIT')),
    passwordHash: item.passwordHash, createdAt: item.createdAt || now, lastActiveAt: item.lastActiveAt || now
  };
}

function seedFromWorkbooks(store: Map<string, UserAccountRecord>): boolean {
  const now = new Date().toLocaleString('vi-VN');
  const deleted = loadDeletedAccountEmails();
  if (!store.has('tcns@hcmute.edu.vn') && !deleted.has('tcns@hcmute.edu.vn')) {
    const envAdminPass = process.env.ADMIN_DEFAULT_PASSWORD || process.env.INITIAL_ADMIN_PASSWORD;
    store.set('tcns@hcmute.edu.vn', normalizeRecord({
      email: 'tcns@hcmute.edu.vn', displayName: 'Phòng Tổ chức – Nhân sự', unitCode: 'TCNS', role: 'admin',
      hasSelectedUnit: true, passwordHash: envAdminPass ? hashAccountPassword(envAdminPass) : undefined,
      createdAt: now, lastActiveAt: now
    }));
    return true;
  }
  return false;
}

function loadStore(): Map<string, UserAccountRecord> {
  if (memoryAccounts) return memoryAccounts;
  memoryAccounts = new Map();
  const deleted = loadDeletedAccountEmails();
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const email = normalizeEmail(item?.email || '');
          if (email && !deleted.has(email)) memoryAccounts.set(email, normalizeRecord({ ...item, email }));
        }
      }
    }
  } catch { /* ignore */ }
  if (seedFromWorkbooks(memoryAccounts)) persistLocalStore();
  return memoryAccounts;
}

function persistLocalStore(): void {
  if (!memoryAccounts) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(Array.from(memoryAccounts.values()), null, 2), 'utf8');
  } catch { /* ignore */ }
}

export async function syncAccountsFromSupabase(force = false): Promise<void> {
  const store = loadStore();
  const now = Date.now();
  if (!force && now - lastSupabaseSyncAt < 2000) return;
  lastSupabaseSyncAt = now;
  try {
    await syncServerWorkbooksFromSupabase();
    if (seedFromWorkbooks(store)) persistLocalStore();
  } catch { /* ignore */ }

  const rows = await fetchAccountsFromSupabase();
  if (rows === null) return; // Dev chưa config Supabase: bảo lưu local

  const deleted = loadDeletedAccountEmails();
  const remoteEmails = new Set<string>();

  for (const r of rows) {
    const email = normalizeEmail(r.email);
    if (!email || deleted.has(email)) continue;
    remoteEmails.add(email);
    store.set(email, normalizeRecord({
      email, displayName: r.display_name, unitCode: r.unit_code, role: r.role as UserRole,
      title: r.title, authProvider: r.auth_provider as 'google' | 'email', avatarUrl: r.avatar_url || undefined,
      status: r.status as 'active' | 'suspended', hasSelectedUnit: r.has_selected_unit,
      passwordHash: r.password_hash || undefined, createdAt: r.created_at, lastActiveAt: r.last_active_at
    }));
  }

  // Authoritative snapshot: loại bỏ account local không còn trên remote
  for (const email of Array.from(store.keys())) {
    if (!remoteEmails.has(email) && email !== 'tcns@hcmute.edu.vn') {
      store.delete(email);
    }
  }
  seedFromWorkbooks(store);
  persistLocalStore();
}

export function getAllUserAccounts(): UserAccountRecord[] {
  const roleWeight: Record<UserRole, number> = { admin: 0, unit_leader: 1, staff: 2 };
  return Array.from(loadStore().values()).sort((a, b) => roleWeight[a.role] - roleWeight[b.role] || a.email.localeCompare(b.email));
}

export async function verifyUserPassword(email: string, password: string): Promise<UserAccountRecord | null> {
  const acc = getUserAccountByEmail(email);
  if (!acc || acc.status === 'suspended' || !acc.passwordHash) return null;
  const isMatch = verifyPasswordHash(password, acc.passwordHash);
  if (!isMatch) return null;

  if (!acc.passwordHash.startsWith('scrypt:')) {
    const newHash = hashAccountPassword(password);
    const updated = { ...acc, passwordHash: newHash };
    await upsertUserAccount(updated, true);
    return updated;
  }
  return acc;
}

export function getUserAccountByEmail(email: string): UserAccountRecord | null {
  const norm = normalizeEmail(email);
  return norm ? loadStore().get(norm) || null : null;
}

export async function upsertUserAccount(
  input: Partial<UserAccountRecord> & { email: string },
  allowRoleOverride = false
): Promise<UserAccountRecord> {
  const store = loadStore(), norm = normalizeEmail(input.email);
  const existing = store.get(norm);
  const targetRole = isValidRole(input.role) ? input.role : (input.title ? getRoleFromTitle(input.title) : undefined);
  const isFirstTime = !existing || !existing.hasSelectedUnit;
  const resolvedRole: UserRole = (allowRoleOverride || isFirstTime) && targetRole
    ? targetRole : existing?.role || (norm === 'tcns@hcmute.edu.vn' ? 'admin' : targetRole || 'staff');

  const nextRecord = normalizeRecord({
    ...existing, ...input, email: norm, role: resolvedRole,
    createdAt: existing?.createdAt || new Date().toLocaleString('vi-VN'),
    lastActiveAt: new Date().toLocaleString('vi-VN')
  });

  // Single-record upsert: persist remote TRƯỚC khi commit memory/local (Source of Truth)
  await persistAccountToSupabase(nextRecord);

  const deleted = loadDeletedAccountEmails();
  if (deleted.has(norm)) {
    deleted.delete(norm);
    persistDeletedAccountEmails();
  }
  store.set(norm, nextRecord);
  persistLocalStore();
  void shadowSyncAccountsToTienDo(getAllUserAccounts(), Array.from(deleted));
  return nextRecord;
}

export async function updateUserAccountRole(
  email: string, role: UserRole, updates?: Partial<Pick<UserAccountRecord, 'unitCode' | 'title' | 'displayName' | 'status' | 'hasSelectedUnit'>>
): Promise<UserAccountRecord | null> {
  const norm = normalizeEmail(email);
  return !isValidRole(role) || !norm ? null : await upsertUserAccount({ email: norm, role, hasSelectedUnit: true, ...updates }, true);
}

export async function deleteUserAccount(email: string): Promise<boolean> {
  const store = loadStore(), norm = normalizeEmail(email);
  if (!norm || norm === 'tcns@hcmute.edu.vn') return false;

  // Remote DELETE trên Supabase trước bằng service role
  await deleteAccountFromSupabase(norm);

  const deleted = loadDeletedAccountEmails();
  deleted.add(norm);
  persistDeletedAccountEmails();
  const removed = store.delete(norm);
  removeParticipantFromAllWorkbooks(norm);
  persistLocalStore();
  void shadowSyncAccountsToTienDo(getAllUserAccounts(), Array.from(deleted));
  return removed;
}
