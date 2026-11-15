import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getUserAccountByEmail, syncAccountsFromSupabase } from './server-account-store';
import { verifyPasswordHash, getAuthSecret, safeCompareSignature } from './account-crypto';
import { normalizeEmail } from './server-workbook-store';

const ADMIN_COOKIE_NAME = 'hcmute_vtvl_admin_token_v2';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_PUBLIC_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim();

export interface AdminSessionPayload {
  role: 'admin';
  authenticatedAt: string;
  expiresAt: number;
}

export function hashStringSha256(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;
  const trimmed = password.trim();

  // 1. Kiểm tra mật khẩu quản trị từ biến môi trường (nếu có)
  const envAdminPassword = (process.env.ADMIN_DEFAULT_PASSWORD || '').trim();
  if (envAdminPassword && trimmed === envAdminPassword) {
    return true;
  }

  // 2. Đối soát an toàn với tài khoản tcns@hcmute.edu.vn từ bảng user_accounts
  try {
    const acc = getUserAccountByEmail('tcns@hcmute.edu.vn');
    if (acc?.passwordHash && verifyPasswordHash(trimmed, acc.passwordHash)) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function generateAdminToken(): string {
  const secret = getAuthSecret();
  const payload: AdminSessionPayload = {
    role: 'admin',
    authenticatedAt: new Date().toISOString(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

/**
 * Chuẩn hóa mốc hết hạn token về mili-giây (Unix Epoch ms).
 * - expiresAt: định dạng nội bộ HCM-UTE VTVL 360 (mili-giây, >= 1e12).
 * - exp: chuẩn JWT RFC 7519 (giây, 1e9..1e11) hoặc mili-giây (>= 1e12).
 * Từ chối mọi giá trị không phải number hữu hạn, <= 0, hoặc vượt quá 366 ngày kể từ hiện tại.
 */
export function normalizeTokenExpirationMs(rawPayload: Record<string, unknown>, nowMs = Date.now()): number | null {
  const hasExpiresAt = rawPayload.expiresAt !== undefined && rawPayload.expiresAt !== null;
  const hasExp = rawPayload.exp !== undefined && rawPayload.exp !== null;
  if (!hasExpiresAt && !hasExp) return null;

  const rawVal = hasExpiresAt ? rawPayload.expiresAt : rawPayload.exp;
  if (typeof rawVal !== 'number' || !Number.isFinite(rawVal) || rawVal <= 0) {
    return null;
  }

  // Nếu dùng trường exp chuẩn JWT (đơn vị giây: 1_000_000_000 .. 99_999_999_999), đổi sang mili-giây
  const expMs = !hasExpiresAt && rawVal >= 1_000_000_000 && rawVal < 100_000_000_000
    ? Math.trunc(rawVal * 1000)
    : Math.trunc(rawVal);

  const minValidEpochMs = 1_577_836_800_000; // 2020-01-01T00:00:00Z
  const maxValidEpochMs = nowMs + 366 * 24 * 60 * 60 * 1000; // Tối đa 1 năm kể từ hiện tại
  if (expMs < minValidEpochMs || expMs > maxValidEpochMs) {
    return null;
  }
  return expMs;
}

export function verifyAdminToken(token: string): AdminSessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, signature] = parts;
  const secret = getAuthSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!safeCompareSignature(signature, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const payload = parsed as Record<string, unknown>;
    if (payload.role !== 'admin') return null;
    const nowMs = Date.now();
    const expTime = normalizeTokenExpirationMs(payload, nowMs);
    if (expTime === null || nowMs >= expTime) return null;
    return {
      role: 'admin',
      authenticatedAt: typeof payload.authenticatedAt === 'string' ? payload.authenticatedAt : new Date(nowMs).toISOString(),
      expiresAt: expTime
    };
  } catch {
    return null;
  }
}

export async function verifySupabaseAccessTokenEmail(token?: string | null): Promise<string | null> {
  if (!token || !SUPABASE_URL || !SUPABASE_PUBLIC_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_PUBLIC_KEY,
        Authorization: `Bearer ${token.trim()}`
      },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const user = await res.json();
    const email = normalizeEmail(user?.email || '');
    return email || null;
  } catch {
    return null;
  }
}

export async function isVerifiedAdminAccount(email?: string | null, accessToken?: string | null): Promise<boolean> {
  if (!email) return false;
  const verifiedEmail = await verifySupabaseAccessTokenEmail(accessToken);
  if (!verifiedEmail || verifiedEmail !== normalizeEmail(email)) return false;
  await syncAccountsFromSupabase();
  const acc = getUserAccountByEmail(verifiedEmail);
  return Boolean(acc && acc.role === 'admin' && acc.status === 'active');
}

export async function getServerAdminAuth(reqEmail?: string, accessToken?: string | null): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (token && verifyAdminToken(token) !== null) return true;
  } catch { /* ignore */ }

  if (reqEmail && accessToken) {
    return isVerifiedAdminAccount(reqEmail, accessToken);
  }
  return false;
}

export async function setServerAdminCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60
  });
}

export async function clearServerAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
