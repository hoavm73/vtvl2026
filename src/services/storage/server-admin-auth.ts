import { cookies } from 'next/headers';
import crypto from 'crypto';
import { getUserAccountByEmail, syncAccountsFromSupabase } from './server-account-store';
import { verifyPasswordHash, getAuthSecret, safeCompareSignature } from './account-crypto';
import { normalizeEmail } from './server-workbook-store';

const ADMIN_COOKIE_NAME = 'hcmute_vtvl_admin_token_v2';

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

  const envAdminPassword = (process.env.ADMIN_DEFAULT_PASSWORD || '').trim();
  if (envAdminPassword && trimmed === envAdminPassword) {
    return true;
  }

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

export function normalizeTokenExpirationMs(rawPayload: Record<string, unknown>, nowMs = Date.now()): number | null {
  const hasExpiresAt = rawPayload.expiresAt !== undefined && rawPayload.expiresAt !== null;
  const hasExp = rawPayload.exp !== undefined && rawPayload.exp !== null;
  if (!hasExpiresAt && !hasExp) return null;

  const rawVal = hasExpiresAt ? rawPayload.expiresAt : rawPayload.exp;
  if (typeof rawVal !== 'number' || !Number.isFinite(rawVal) || rawVal <= 0) {
    return null;
  }

  const expMs = !hasExpiresAt && rawVal >= 1_000_000_000 && rawVal < 100_000_000_000
    ? Math.trunc(rawVal * 1000)
    : Math.trunc(rawVal);

  const minValidEpochMs = 1_577_836_800_000;
  const maxValidEpochMs = nowMs + 366 * 24 * 60 * 60 * 1000;
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
  if (!token) return null;
  try {
    const parts = token.trim().split('.');
    if (parts.length === 2 && parts[0] && parts[1]) {
      const secret = getAuthSecret();
      const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest('base64url');
      if (safeCompareSignature(parts[1], expected)) {
        const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Record<string, unknown>;
        const expMs = normalizeTokenExpirationMs(payload);
        if (expMs && Date.now() < expMs && typeof payload.email === 'string') {
          return normalizeEmail(payload.email) || null;
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function isVerifiedAdminAccount(email?: string | null, accessToken?: string | null): Promise<boolean> {
  if (!email) return false;
  const normReq = normalizeEmail(email);
  let verifiedEmail = await verifySupabaseAccessTokenEmail(accessToken);
  if (!verifiedEmail) {
    try {
      const { getServerSession } = await import('next-auth');
      const { getAuthOptions } = await import('@/services/auth/auth-options');
      const sess = await getServerSession(getAuthOptions());
      if (sess?.user?.email) verifiedEmail = normalizeEmail(sess.user.email);
    } catch { /* ignore */ }
  }
  if (!verifiedEmail || verifiedEmail !== normReq) return false;
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

  try {
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/services/auth/auth-options');
    const sess = await getServerSession(authOptions);
    if (sess?.user?.email) {
      await syncAccountsFromSupabase();
      const acc = getUserAccountByEmail(sess.user.email);
      if (acc && acc.role === 'admin' && acc.status === 'active') return true;
    }
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
