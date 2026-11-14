import { cookies } from 'next/headers';
import crypto from 'crypto';
import {
  getUserAccountByEmail,
  syncAccountsFromSupabase,
  UserRole
} from './server-account-store';
import {
  verifyAdminToken,
  verifySupabaseAccessTokenEmail,
  isVerifiedAdminAccount
} from './server-admin-auth';
import { normalizeEmail } from './server-workbook-store';

export const USER_SESSION_COOKIE_NAME = 'hcmute_vtvl_session_token';
export const ADMIN_COOKIE_NAME = 'hcmute_vtvl_admin_token_v2';
const SERVER_AUTH_SECRET = process.env.ADMIN_SERVER_SECRET || 'hcmute_vtvl_admin_jwt_secret_2026_super_secure';

export interface UserSessionPayload {
  email: string;
  role: UserRole;
  unitCode: string;
  issuedAt: string;
  expiresAt: number;
}

export interface CallerAuthContext {
  isAuthenticated: boolean;
  isSuspended: boolean;
  email: string;
  role: UserRole;
  unitCode: string;
  isAdmin: boolean;
  isUnitLeader: boolean;
  isStaff: boolean;
}

export function generateUserSessionToken(payload: {
  email: string;
  role: UserRole;
  unitCode: string;
  ttlHours?: number;
}): string {
  const normEmail = normalizeEmail(payload.email);
  const ttl = payload.ttlHours || 24;
  const data: UserSessionPayload = {
    email: normEmail,
    role: payload.role,
    unitCode: payload.unitCode.toUpperCase(),
    issuedAt: new Date().toISOString(),
    expiresAt: Date.now() + ttl * 60 * 60 * 1000
  };
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto.createHmac('sha256', SERVER_AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyUserSessionToken(token: string): UserSessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [body, signature] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SERVER_AUTH_SECRET).update(body).digest('base64url');
  if (signature !== expectedSig) return null;

  try {
    const payload: UserSessionPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.email || Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setUserSessionCookie(token: string): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(USER_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60
    });
  } catch { /* ignore */ }
}

export async function clearUserSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(USER_SESSION_COOKIE_NAME);
  } catch { /* ignore */ }
}

function extractBearer(req?: Request | null): string | null {
  if (!req) return null;
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export async function getCallerSession(req?: Request | null): Promise<CallerAuthContext> {
  const unauthContext: CallerAuthContext = {
    isAuthenticated: false,
    isSuspended: false,
    email: '',
    role: 'staff',
    unitCode: '',
    isAdmin: false,
    isUnitLeader: false,
    isStaff: false
  };

  let tokenCandidate: string | null = extractBearer(req);

  // 1. Kiểm tra cookie nếu chưa có bearer token
  if (!tokenCandidate) {
    try {
      const cookieStore = await cookies();
      const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
      if (adminCookie) tokenCandidate = adminCookie;
      else {
        const sessionCookie = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
        if (sessionCookie) tokenCandidate = sessionCookie;
      }
    } catch { /* ignore */ }
  }

  // 2. Thử giải mã Admin Token
  if (tokenCandidate) {
    const adminPayload = verifyAdminToken(tokenCandidate);
    if (adminPayload && adminPayload.role === 'admin') {
      return {
        isAuthenticated: true,
        isSuspended: false,
        email: 'tcns@hcmute.edu.vn',
        role: 'admin',
        unitCode: 'TCNS',
        isAdmin: true,
        isUnitLeader: false,
        isStaff: false
      };
    }

    // 3. Thử giải mã User Session Token
    const userPayload = verifyUserSessionToken(tokenCandidate);
    if (userPayload) {
      await syncAccountsFromSupabase();
      const acc = getUserAccountByEmail(userPayload.email);
      if (acc && acc.status === 'suspended') {
        return { ...unauthContext, isSuspended: true, email: acc.email };
      }
      const effectiveRole = acc?.role || userPayload.role;
      const effectiveUnit = (acc?.unitCode || userPayload.unitCode).toUpperCase();
      const isAdmin = effectiveRole === 'admin' || userPayload.email === 'tcns@hcmute.edu.vn';
      return {
        isAuthenticated: true,
        isSuspended: false,
        email: userPayload.email,
        role: effectiveRole,
        unitCode: effectiveUnit,
        isAdmin,
        isUnitLeader: effectiveRole === 'unit_leader',
        isStaff: effectiveRole === 'staff'
      };
    }

    // 4. Thử xác thực Supabase OAuth JWT token (Bearer token Google)
    const verifiedGoogleEmail = await verifySupabaseAccessTokenEmail(tokenCandidate);
    if (verifiedGoogleEmail) {
      await syncAccountsFromSupabase();
      const acc = getUserAccountByEmail(verifiedGoogleEmail);
      if (acc && acc.status === 'suspended') {
        return { ...unauthContext, isSuspended: true, email: verifiedGoogleEmail };
      }
      const role = acc?.role || (verifiedGoogleEmail === 'tcns@hcmute.edu.vn' ? 'admin' : 'staff');
      const unitCode = (acc?.unitCode || 'FIT').toUpperCase();
      const isAdmin = role === 'admin' || verifiedGoogleEmail === 'tcns@hcmute.edu.vn';
      return {
        isAuthenticated: true,
        isSuspended: false,
        email: verifiedGoogleEmail,
        role,
        unitCode,
        isAdmin,
        isUnitLeader: role === 'unit_leader',
        isStaff: role === 'staff'
      };
    }
  }

  // 5. Kiểm tra tài khoản Quản trị qua cookie
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (adminToken && verifyAdminToken(adminToken) !== null) {
      return {
        isAuthenticated: true,
        isSuspended: false,
        email: 'tcns@hcmute.edu.vn',
        role: 'admin',
        unitCode: 'TCNS',
        isAdmin: true,
        isUnitLeader: false,
        isStaff: false
      };
    }
  } catch { /* ignore */ }

  return unauthContext;
}
