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

export function verifyAdminToken(token: string): AdminSessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const secret = getAuthSecret();
  const [body, signature] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!safeCompareSignature(signature, expectedSig)) return null;

  try {
    const payload: AdminSessionPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.role !== 'admin' || Date.now() > payload.expiresAt) return null;
    return payload;
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
