import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, getCallerSession, USER_SESSION_COOKIE_NAME } from '@/services/storage/server-auth-guard';
import { extractClientIp } from '@/services/auth/rate-limiter';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { recordAuthAuditEvent } from '@/services/storage/server-audit-store';

const COOKIES_TO_CLEAR = [
  USER_SESSION_COOKIE_NAME,
  ADMIN_COOKIE_NAME,
  'hcmute_vtvl_c1_unlock',
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.callback-url',
  '__Secure-next-auth.callback-url',
  'next-auth.csrf-token',
  '__Host-next-auth.csrf-token'
];

function buildLogoutResponse() {
  const res = NextResponse.json(
    { ok: true, message: 'Đã đăng xuất và xóa toàn bộ cookie phiên làm việc.' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );

  const isProd = process.env.NODE_ENV === 'production';
  for (const name of COOKIES_TO_CLEAR) {
    const mustBeSecure = name.startsWith('__Secure-') || name.startsWith('__Host-') || isProd;
    res.cookies.set(name, '', {
      httpOnly: !name.includes('csrf-token') && !name.includes('callback-url'),
      secure: mustBeSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0)
    });
  }
  return res;
}

async function logLogoutSession(req?: Request) {
  if (!req) return;
  const caller = await getCallerSession(req).catch(() => null);
  if (caller?.isAuthenticated && caller.email) {
    await recordAuthAuditEvent({
      action: 'ĐĂNG_XUẤT',
      email: caller.email,
      role: caller.role,
      unitCode: caller.unitCode,
      unitName: findHcmuteUnit(caller.unitCode).nameVi,
      ipAddress: extractClientIp(req),
      userAgent: req.headers.get('user-agent') || undefined,
      authMethod: 'logout',
      details: `Đăng xuất khỏi hệ thống (${caller.email})`
    });
  }
}

export async function POST(req: Request) {
  await logLogoutSession(req);
  return buildLogoutResponse();
}

export async function DELETE(req: Request) {
  await logLogoutSession(req);
  return buildLogoutResponse();
}

