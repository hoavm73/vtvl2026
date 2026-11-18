import { Prisma } from '@prisma/client';
import { UserAccountRecord } from './account-crypto';
import { normalizeEmail } from './server-workbook-store';
import { findHcmuteUnit, BGH_ACCOUNT_EMAILS } from '@/configs/hcmute-units';
import { isDatabaseConfigured, prisma, toIsoString } from './prisma';

const getDbUrl = () => (process.env.DATABASE_URL || '').trim();

export function assertAccountDbConfigured(operation: string): boolean {
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true') return false;
  if (!getDbUrl() && !isDatabaseConfigured()) {
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
  try {
    const rows = await prisma.user_accounts.findMany({
      select: {
        email: true,
        unit_code: true,
        unit_name_vi: true,
        display_name: true,
        role: true,
        title: true,
        auth_provider: true,
        avatar_url: true,
        status: true,
        has_selected_unit: true,
        password_hash: true,
        created_at: true,
        last_active_at: true
      }
    });
    return rows.map((r) => {
      const email = normalizeEmail(r.email);
      const isBgh = BGH_ACCOUNT_EMAILS.has(email) || (r.unit_name_vi || '').trim().toLowerCase() === 'ban giám hiệu' || (r.unit_code || '').trim().toUpperCase() === 'BGH';
      return {
        email: r.email,
        unit_code: isBgh ? 'BGH' : r.unit_code,
        unit_name_vi: isBgh ? 'Ban Giám hiệu' : r.unit_name_vi,
        display_name: r.display_name,
        role: r.role,
        title: r.title,
        auth_provider: r.auth_provider,
        avatar_url: r.avatar_url,
        status: r.status,
        has_selected_unit: Boolean(r.has_selected_unit),
        password_hash: r.password_hash,
        created_at: toIsoString(r.created_at),
        last_active_at: toIsoString(r.last_active_at)
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(`[DB_ERROR] user_accounts query failed: ${msg}`);
    (err as unknown as { table: string; status: number; code: string }).table = 'user_accounts';
    (err as unknown as { table: string; status: number; code: string }).status = 500;
    (err as unknown as { table: string; status: number; code: string }).code = 'DB_ERROR';
    throw err;
  }
}

export async function persistAccountToSupabase(a: UserAccountRecord): Promise<boolean> {
  if (!assertAccountDbConfigured('persistAccount')) return false;

  const normEmail = normalizeEmail(a.email);
  const isBgh = BGH_ACCOUNT_EMAILS.has(normEmail) || (a.unitCode || '').trim().toUpperCase() === 'BGH';
  const data = {
    email: normEmail,
    unit_code: isBgh ? 'TCNS' : a.unitCode,
    unit_name_vi: a.unitNameVi || (isBgh ? 'Ban Giám hiệu' : findHcmuteUnit(a.unitCode).nameVi),
    display_name: a.displayName,
    role: a.role,
    title: a.title,
    auth_provider: a.authProvider,
    avatar_url: a.avatarUrl || null,
    status: a.status,
    has_selected_unit: Boolean(a.hasSelectedUnit),
    password_hash: a.passwordHash || null,
    last_active_at: new Date(),
    updated_at: new Date()
  };

  try {
    await prisma.user_accounts.upsert({
      where: { email: data.email },
      update: data,
      create: data
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(`[DB_ERROR] user_accounts persist failed: ${msg}`);
    (err as unknown as { table: string; status: number; code: string }).table = 'user_accounts';
    (err as unknown as { table: string; status: number; code: string }).status = 500;
    (err as unknown as { table: string; status: number; code: string }).code = 'DB_ERROR';
    throw err;
  }
}

export async function deleteAccountFromSupabase(email: string): Promise<boolean> {
  if (!assertAccountDbConfigured('deleteAccount')) return false;
  const norm = normalizeEmail(email);
  if (!norm || norm === 'tcns@hcmute.edu.vn') return false;

  try {
    await prisma.user_accounts.deleteMany({ where: { email: norm } });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const err = new Error(`[DB_ERROR] user_accounts delete failed: ${msg}`);
    (err as unknown as { table: string; status: number; code: string }).table = 'user_accounts';
    (err as unknown as { table: string; status: number; code: string }).status = 500;
    (err as unknown as { table: string; status: number; code: string }).code = 'DB_ERROR';
    throw err;
  }
}

export async function shadowSyncAccountsToTienDo(
  accounts: UserAccountRecord[],
  deletedEmails: string[]
): Promise<void> {
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !isDatabaseConfigured()) return;
  try {
    const existingRow = await prisma.t_tien_do.findUnique({ where: { ma_don_vi: 'TCNS' } });
    const tcns = findHcmuteUnit('TCNS');
    const prevJson = (existingRow?.du_lieu_ho_so_json as Record<string, unknown>) || {};
    const nextJson: Prisma.InputJsonValue = {
      ...prevJson,
      userAccounts: accounts.map((a) => {
        const copy = { ...a };
        delete copy.passwordHash;
        return copy;
      }),
      deletedAccountEmails: deletedEmails,
      accountsUpdatedAt: new Date().toISOString()
    } as unknown as Prisma.InputJsonValue;

    await prisma.t_tien_do.upsert({
      where: { ma_don_vi: tcns.code },
      update: {
        ten_don_vi: tcns.nameVi,
        trang_thai_ra_soat: 'Đã đồng bộ danh mục tài khoản',
        du_lieu_ho_so_json: nextJson,
        updated_at: new Date()
      },
      create: {
        ma_don_vi: tcns.code,
        ten_don_vi: tcns.nameVi,
        phien_ban: existingRow?.phien_ban || 'v1',
        so_nhiem_vu_a1: existingRow?.so_nhiem_vu_a1 || 0,
        so_cong_viec_a2: existingRow?.so_cong_viec_a2 || 0,
        so_vtvl_c1: existingRow?.so_vtvl_c1 || 0,
        tong_fte_c3: existingRow?.tong_fte_c3 || 0,
        trang_thai_ra_soat: 'Đã đồng bộ danh mục tài khoản',
        du_lieu_ho_so_json: nextJson
      }
    });
  } catch {
    /* Shadow sync ignored */
  }
}
