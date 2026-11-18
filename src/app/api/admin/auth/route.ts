import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import {
  verifyAdminPassword,
  generateAdminToken,
  verifyAdminToken,
  getServerAdminAuth,
  setServerAdminCookie,
  clearServerAdminCookie,
  isVerifiedAdminAccount
} from '@/services/storage/server-admin-auth';
import {
  checkAuthRateLimit,
  recordAuthFailure,
  clearAuthFailures
} from '@/services/auth/rate-limiter';

function extractBearer(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
}

const ADMIN_COOKIE = 'hcmute_vtvl_admin_token_v2';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (caller.isAdmin) {
    return NextResponse.json({ authenticated: true, role: 'admin', unitCode: caller.unitCode });
  }
  if (caller.isUnitLeader) {
    return NextResponse.json({
      authenticated: true,
      role: 'unit_leader',
      unitCode: caller.unitCode,
      unitNameVi: findHcmuteUnit(caller.unitCode).nameVi
    });
  }

  const reqCookieToken = req.cookies.get(ADMIN_COOKIE)?.value;
  if (reqCookieToken && verifyAdminToken(reqCookieToken) !== null) {
    return NextResponse.json({ authenticated: true, role: 'admin' });
  }

  const cookieAuth = await getServerAdminAuth();
  if (cookieAuth) {
    return NextResponse.json({ authenticated: true, role: 'admin' });
  }

  const bearer = extractBearer(req);
  if (bearer && verifyAdminToken(bearer) !== null) {
    return NextResponse.json({ authenticated: true, role: 'admin' });
  }

  const email = req.nextUrl.searchParams.get('email') || '';
  if (email && bearer) {
    const isGoogleAdmin = await isVerifiedAdminAccount(email, bearer);
    if (isGoogleAdmin) {
      const token = generateAdminToken();
      await setServerAdminCookie(token);
      const res = NextResponse.json({ authenticated: true, role: 'admin', token });
      res.cookies.set(ADMIN_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60
      });
      return res;
    }
  }

  return NextResponse.json({
    authenticated: false,
    role: caller.role,
    error: caller.isStaff ? 'Tài khoản Cán bộ không có quyền truy cập trang Quản trị.' : undefined
  });
}

export async function POST(req: NextRequest) {
  try {
    const rateCheck = checkAuthRateLimit(req, 'admin_auth', 'admin');
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Quá nhiều lần nhập sai mật khẩu Quản trị. Vui lòng thử lại sau ${rateCheck.retryAfterSeconds} giây.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds: rateCheck.retryAfterSeconds
        },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const { password } = body;
    if (!password || !verifyAdminPassword(password)) {
      recordAuthFailure(req, 'admin_auth', 'admin');
      return NextResponse.json(
        { error: 'Mật khẩu quản trị viên không chính xác. Vui lòng liên hệ Phòng TCNS để được cấp quyền.' },
        { status: 401 }
      );
    }
    clearAuthFailures(req, 'admin_auth', 'admin');
    const token = generateAdminToken();
    await setServerAdminCookie(token);
    const res = NextResponse.json({
      success: true,
      message: 'Đăng nhập Quản trị viên thành công.',
      token
    });
    res.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60
    });
    return res;
  } catch {
    return NextResponse.json({ error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
  }
}

export async function DELETE() {
  await clearServerAdminCookie();
  const res = NextResponse.json({ success: true, message: 'Đã đăng xuất Quản trị viên.' });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
