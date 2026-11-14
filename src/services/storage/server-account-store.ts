import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import {
  normalizeEmail,
  syncServerWorkbooksFromSupabase,
  removeParticipantFromAllWorkbooks
} from './server-workbook-store';

export type UserRole = 'admin' | 'unit_leader' | 'staff';

export interface UserAccountRecord {
  email: string; displayName: string; unitCode: string; unitNameVi: string; title: string;
  role: UserRole; authProvider: 'google' | 'email'; avatarUrl?: string; status: 'active' | 'suspended';
  hasSelectedUnit?: boolean; passwordHash?: string; createdAt: string; lastActiveAt: string;
}

const VALID_ROLES: UserRole[] = ['admin', 'unit_leader', 'staff'];

export function getRoleTitle(role: UserRole): string {
  return role === 'admin' ? 'Phòng Tổ chức – Nhân sự' : role === 'unit_leader' ? 'Lãnh đạo đơn vị' : 'Cán bộ – Giảng viên';
}

export function getRoleFromTitle(title?: string): UserRole {
  const t = (title || '').trim().toLowerCase();
  if (t.includes('tổ chức') || t.includes('nhân sự') || t === 'admin') return 'admin';
  return (t.includes('lãnh đạo') || t.includes('trưởng') || t.includes('phó') || t === 'unit_leader') ? 'unit_leader' : 'staff';
}

export function hashAccountPassword(password: string): string {
  return crypto.createHash('sha256').update(`hcmute_vtvl_${password}`).digest('hex');
}

export function stripAccountSensitiveFields(acc: UserAccountRecord): UserAccountRecord {
  const { passwordHash: _ignored, ...safe } = acc;
  return safe;
}

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'server_accounts.json');
const DELETED_ACCOUNTS_FILE = path.join(DATA_DIR, 'deleted_accounts.json');
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

let memoryAccounts: Map<string, UserAccountRecord> | null = null;
let deletedAccountEmails: Set<string> | null = null;
let lastSupabaseSyncAt = 0;

function getSupabaseHeaders(): Record<string, string> {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
}

function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && VALID_ROLES.includes(role as UserRole);
}

function loadDeletedAccountEmails(): Set<string> {
  if (deletedAccountEmails) return deletedAccountEmails;
  deletedAccountEmails = new Set();
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
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
  const email = normalizeEmail(item.email), unit = findHcmuteUnit(item.unitCode || 'FIT'), now = new Date().toLocaleString('vi-VN');
  const isTcns = email === 'tcns@hcmute.edu.vn';
  const inferredRole = item.title ? getRoleFromTitle(item.title) : undefined;
  const role: UserRole = isValidRole(item.role) ? item.role : inferredRole || (isTcns ? 'admin' : 'staff');
  return {
    email, displayName: (item.displayName || email.split('@')[0]).trim(), unitCode: unit.code, unitNameVi: unit.nameVi,
    title: getRoleTitle(role), role, authProvider: item.authProvider === 'google' ? 'google' : 'email',
    avatarUrl: item.avatarUrl, status: item.status === 'suspended' ? 'suspended' : 'active',
    hasSelectedUnit: item.hasSelectedUnit !== undefined ? Boolean(item.hasSelectedUnit) : isTcns,
    passwordHash: item.passwordHash, createdAt: item.createdAt || now, lastActiveAt: item.lastActiveAt || now
  };
}

function seedFromWorkbooks(store: Map<string, UserAccountRecord>): boolean {
  const now = new Date().toLocaleString('vi-VN');
  const deleted = loadDeletedAccountEmails();
  if (!store.has('tcns@hcmute.edu.vn') && !deleted.has('tcns@hcmute.edu.vn')) {
    store.set('tcns@hcmute.edu.vn', normalizeRecord({
      email: 'tcns@hcmute.edu.vn', displayName: 'Phòng Tổ chức – Nhân sự', unitCode: 'TCNS', role: 'admin',
      hasSelectedUnit: true, passwordHash: hashAccountPassword('Hcmute@2026'), createdAt: now, lastActiveAt: now
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

async function persistAccountsToSupabase(accounts: UserAccountRecord[]): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/t_tien_do?ma_don_vi=eq.TCNS&select=du_lieu_ho_so_json,phien_ban,so_nhiem_vu_a1,so_cong_viec_a2,so_vtvl_c1,tong_fte_c3`,
      { headers: getSupabaseHeaders(), cache: 'no-store' }
    );
    const existingRows = existingRes.ok ? await existingRes.json() : [];
    const existingRow = Array.isArray(existingRows) && existingRows[0] ? existingRows[0] : null;
    const tcns = findHcmuteUnit('TCNS');
    const res = await fetch(`${SUPABASE_URL}/rest/v1/t_tien_do?on_conflict=ma_don_vi`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        ma_don_vi: tcns.code,
        ten_don_vi: tcns.nameVi,
        phien_ban: existingRow?.phien_ban || 'v1',
        so_nhiem_vu_a1: existingRow?.so_nhiem_vu_a1 || 0,
        so_cong_viec_a2: existingRow?.so_cong_viec_a2 || 0,
        so_vtvl_c1: existingRow?.so_vtvl_c1 || 0,
        tong_fte_c3: existingRow?.tong_fte_c3 || 0,
        trang_thai_ra_soat: 'Đã đồng bộ danh mục tài khoản',
        du_lieu_ho_so_json: {
          ...(existingRow?.du_lieu_ho_so_json || {}),
          userAccounts: accounts,
          deletedAccountEmails: Array.from(loadDeletedAccountEmails()),
          accountsUpdatedAt: new Date().toISOString()
        }
      })
    });
    return res.ok;
  } catch {
    return false;
  }
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

  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/t_tien_do?ma_don_vi=eq.TCNS&select=du_lieu_ho_so_json`, {
      headers: getSupabaseHeaders(), cache: 'no-store'
    });
    if (!res.ok) return;
    const rows = await res.json();
    const duLieu = rows?.[0]?.du_lieu_ho_so_json;
    const deleted = loadDeletedAccountEmails();
    if (Array.isArray(duLieu?.deletedAccountEmails)) {
      duLieu.deletedAccountEmails.forEach((e: string) => {
        const norm = normalizeEmail(e);
        if (norm) deleted.add(norm);
      });
      persistDeletedAccountEmails();
    }
    for (const d of deleted) {
      if (store.has(d)) store.delete(d);
    }
    const remoteList = duLieu?.userAccounts;
    if (Array.isArray(remoteList)) {
      let merged = false;
      for (const item of remoteList) {
        const email = normalizeEmail(item?.email || '');
        if (email && !deleted.has(email) && !store.has(email)) {
          store.set(email, normalizeRecord({ ...item, email }));
          merged = true;
        }
      }
      if (merged) persistLocalStore();
    }
  } catch { /* ignore */ }
}

export function getAllUserAccounts(): UserAccountRecord[] {
  const roleWeight: Record<UserRole, number> = { admin: 0, unit_leader: 1, staff: 2 };
  return Array.from(loadStore().values()).sort((a, b) => roleWeight[a.role] - roleWeight[b.role] || a.email.localeCompare(b.email));
}

export function verifyUserPassword(email: string, password: string): UserAccountRecord | null {
  const acc = getUserAccountByEmail(email);
  return acc && acc.status !== 'suspended' && acc.passwordHash === hashAccountPassword(password) ? acc : null;
}

export function getUserAccountByEmail(email: string): UserAccountRecord | null {
  const norm = normalizeEmail(email);
  return norm ? loadStore().get(norm) || null : null;
}

export function upsertUserAccount(
  input: Partial<UserAccountRecord> & { email: string },
  allowRoleOverride = false
): UserAccountRecord {
  const store = loadStore();
  const norm = normalizeEmail(input.email);
  const deleted = loadDeletedAccountEmails();
  if (deleted.has(norm)) {
    deleted.delete(norm);
    persistDeletedAccountEmails();
  }
  const existing = store.get(norm);
  const inferredRole = input.title ? getRoleFromTitle(input.title) : undefined;
  const targetRole = isValidRole(input.role) ? input.role : inferredRole;
  const isFirstTime = !existing || !existing.hasSelectedUnit;
  const resolvedRole: UserRole =
    (allowRoleOverride || isFirstTime) && targetRole
      ? targetRole
      : existing?.role || (norm === 'tcns@hcmute.edu.vn' ? 'admin' : targetRole || 'staff');

  const record = normalizeRecord({
    ...existing, ...input, email: norm, role: resolvedRole,
    createdAt: existing?.createdAt || new Date().toLocaleString('vi-VN'),
    lastActiveAt: new Date().toLocaleString('vi-VN')
  });

  store.set(norm, record);
  persistLocalStore();
  persistAccountsToSupabase(getAllUserAccounts()).catch(() => {});
  return record;
}

export function updateUserAccountRole(
  email: string, role: UserRole, updates?: Partial<Pick<UserAccountRecord, 'unitCode' | 'title' | 'displayName' | 'status' | 'hasSelectedUnit'>>
): UserAccountRecord | null {
  const norm = normalizeEmail(email);
  return !isValidRole(role) || !norm ? null : upsertUserAccount({ email: norm, role, hasSelectedUnit: true, ...updates }, true);
}

export async function deleteUserAccount(email: string): Promise<boolean> {
  const store = loadStore();
  const norm = normalizeEmail(email);
  if (!norm || norm === 'tcns@hcmute.edu.vn') return false;
  const deleted = loadDeletedAccountEmails();
  deleted.add(norm);
  persistDeletedAccountEmails();
  const removed = store.delete(norm);
  removeParticipantFromAllWorkbooks(norm);
  persistLocalStore();
  await persistAccountsToSupabase(getAllUserAccounts());
  return removed;
}
