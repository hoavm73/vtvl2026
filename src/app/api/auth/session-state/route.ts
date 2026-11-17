import { NextRequest, NextResponse } from 'next/server';
import {
  getCallerSession,
  generateUserSessionToken,
  USER_SESSION_COOKIE_NAME
} from '@/services/storage/server-auth-guard';
import {
  getUserAccountByEmail,
  stripAccountSensitiveFields,
  syncAccountsFromSupabase
} from '@/services/storage/server-account-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);

  if (!caller.isAuthenticated || caller.isSuspended) {
    return NextResponse.json(
      {
        authenticated: false,
        isSuspended: caller.isSuspended
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  }

  await syncAccountsFromSupabase();
  const rawAcc = getUserAccountByEmail(caller.email);
  const unit = findHcmuteUnit(rawAcc?.unitCode || caller.unitCode || 'CNTT');

  const account = rawAcc
    ? stripAccountSensitiveFields(rawAcc)
    : {
        email: caller.email,
        displayName: caller.email === 'tcns@hcmute.edu.vn' ? 'Phòng Tổ chức – Nhân sự' : caller.email.split('@')[0],
        unitCode: unit.code,
        unitNameVi: unit.nameVi,
        title: caller.isAdmin ? 'Phòng Tổ chức – Nhân sự' : 'Cán bộ – Giảng viên',
        role: caller.role,
        authProvider: 'email' as const,
        status: 'active' as const,
        hasSelectedUnit: true,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString()
      };

  const sessionToken = generateUserSessionToken({
    email: account.email,
    role: account.role,
    unitCode: account.unitCode,
    ttlHours: 168
  });

  const res = NextResponse.json(
    {
      authenticated: true,
      isAdmin: caller.isAdmin,
      account,
      sessionToken
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );

  res.cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60
  });

  return res;
}
