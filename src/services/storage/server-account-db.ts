import { UserAccountRecord } from './account-crypto';
import { normalizeEmail } from './server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
// Thao tác đặc quyền server-side: Bắt buộc duy nhất SUPABASE_SERVICE_ROLE_KEY ở mọi môi trường
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export function assertAccountDbConfigured(operation: string): boolean {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error(`[DB_SERVICE_UNAVAILABLE] Dịch vụ CSDL máy chủ chưa được cấu hình cho thao tác ${operation}.`);
      (err as unknown as { status: number; code: string }).status = 503;
      (err as unknown as { status: number; code: string }).code = 'SUPABASE_NOT_CONFIGURED';
      throw err;
    }
    return false;
  }
  return true;
}

function getServiceHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

export interface DbAccountRow {
  email: string;
  unit_code: string;
  unit_name_vi?: string;
  display_name: string;
  role: string;
  title: string;
  auth_provider: string;
  avatar_url?: string | null;
  status: string;
  has_selected_unit?: boolean;
  password_hash?: string | null;
  created_at?: string;
  last_active_at?: string;
}

export async function fetchAccountsFromSupabase(): Promise<DbAccountRow[] | null> {
  if (!assertAccountDbConfigured('fetchAccounts')) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_accounts?select=email,unit_code,unit_name_vi,display_name,role,title,auth_provider,avatar_url,status,has_selected_unit,password_hash,created_at,last_active_at`,
    { headers: getServiceHeaders(), cache: 'no-store' }
  );
  if (!res.ok) {
    const err = new Error(`[DB_ERROR] user_accounts query failed with status ${res.status}`);
    (err as unknown as { table: string; status: number; code: string }).table = 'user_accounts';
    (err as unknown as { table: string; status: number; code: string }).status = res.status;
    (err as unknown as { table: string; status: number; code: string }).code = 'DB_ERROR';
    throw err;
  }
  const rows = await res.json();
  return Array.isArray(rows) ? (rows as DbAccountRow[]) : [];
}

export async function persistAccountToSupabase(a: UserAccountRecord): Promise<boolean> {
  if (!assertAccountDbConfigured('persistAccount')) return false;

  const payload: DbAccountRow = {
    email: a.email,
    unit_code: a.unitCode,
    unit_name_vi: a.unitNameVi || findHcmuteUnit(a.unitCode).nameVi,
    display_name: a.displayName,
    role: a.role,
    title: a.title,
    auth_provider: a.authProvider,
    avatar_url: a.avatarUrl || null,
    status: a.status,
    has_selected_unit: Boolean(a.hasSelectedUnit),
    password_hash: a.passwordHash || null,
    last_active_at: new Date().toISOString()
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?on_conflict=email`, {
    method: 'POST',
    headers: { ...getServiceHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = new Error(`[DB_ERROR] user_accounts persist failed with status ${res.status}`);
    (err as unknown as { table: string; status: number; code: string }).table = 'user_accounts';
    (err as unknown as { table: string; status: number; code: string }).status = res.status;
    (err as unknown as { table: string; status: number; code: string }).code = 'DB_ERROR';
    throw err;
  }
  return true;
}

export async function deleteAccountFromSupabase(email: string): Promise<boolean> {
  if (!assertAccountDbConfigured('deleteAccount')) return false;
  const norm = normalizeEmail(email);
  if (!norm || norm === 'tcns@hcmute.edu.vn') return false;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_accounts?email=eq.${encodeURIComponent(norm)}`, {
    method: 'DELETE',
    headers: getServiceHeaders()
  });

  if (!res.ok) {
    const err = new Error(`[DB_ERROR] user_accounts delete failed with status ${res.status}`);
    (err as unknown as { table: string; status: number; code: string }).table = 'user_accounts';
    (err as unknown as { table: string; status: number; code: string }).status = res.status;
    (err as unknown as { table: string; status: number; code: string }).code = 'DB_ERROR';
    throw err;
  }
  return true;
}

export async function shadowSyncAccountsToTienDo(
  accounts: UserAccountRecord[],
  deletedEmails: string[]
): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/t_tien_do?ma_don_vi=eq.TCNS&select=du_lieu_ho_so_json,phien_ban,so_nhiem_vu_a1,so_cong_viec_a2,so_vtvl_c1,tong_fte_c3`,
      { headers: getServiceHeaders(), cache: 'no-store' }
    );
    const existingRow = existingRes.ok ? ((await existingRes.json())?.[0] || null) : null;
    const tcns = findHcmuteUnit('TCNS');
    await fetch(`${SUPABASE_URL}/rest/v1/t_tien_do?on_conflict=ma_don_vi`, {
      method: 'POST',
      headers: { ...getServiceHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
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
          userAccounts: accounts.map((a) => {
            const copy = { ...a };
            delete copy.passwordHash;
            return copy;
          }),
          deletedAccountEmails: deletedEmails,
          accountsUpdatedAt: new Date().toISOString()
        }
      })
    });
  } catch {
    /* Shadow sync ignored */
  }
}
