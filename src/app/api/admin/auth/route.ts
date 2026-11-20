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
  MAX_AUTH_PAYLOAD_BYTES,
  checkDirectRateKey,
  checkPayloadSizeLimit,
  clearDirectRateKey,
  extractClientIp,
  readBoundedJsonBody,
  recordDirectFailure
} from '@/services/auth/rate-limiter';

const ADMIN_GLOBAL_KEY = 'admin_auth_global_shared';
const ADMIN_GLOBAL_MAX = 40;
const ADMIN_ANON_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_ACTOR_WINDOW_MS = 15 * 60 * 1000;

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
    const quickSize = checkPayloadSizeLimit(req, MAX_AUTH_PAYLOAD_BYTES);
    if (!quickSize.allowed) {
      return NextResponse.json({ error: 'Dữ liệu yêu cầu vượt quá giới hạn cho phép.', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    }

    const caller = await getCallerSession(req);
    const hasVerifiedActor = Boolean(caller.isAuthenticated && caller.email);
    const primaryKey = hasVerifiedActor
      ? `admin_auth_actor:${caller.email.toLowerCase()}`
      : `admin_auth_anon:${extractClientIp(req)}`;
    const primaryWindowMs = hasVerifiedActor ? ADMIN_ACTOR_WINDOW_MS : ADMIN_ANON_WINDOW_MS;

    const primaryCheck = checkDirectRateKey(primaryKey, 10, primaryWindowMs);
    const globalCheck = checkDirectRateKey(ADMIN_GLOBAL_KEY, ADMIN_GLOBAL_MAX, ADMIN_ANON_WINDOW_MS);
    if (!primaryCheck.allowed || !globalCheck.allowed) {
      const retryAfterSeconds = Math.max(primaryCheck.retryAfterSeconds, globalCheck.retryAfterSeconds);
      return NextResponse.json(
        {
          error: `Quá nhiều lần nhập sai mật khẩu Quản trị. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const parsed = await readBoundedJsonBody<{ password?: unknown }>(req, MAX_AUTH_PAYLOAD_BYTES);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: parsed.code }, { status: parsed.status });
    }
    const password = typeof parsed.data.password === 'string' ? parsed.data.password : '';
    if (!password || !verifyAdminPassword(password)) {
      recordDirectFailure(primaryKey, 10, primaryWindowMs);
      recordDirectFailure(ADMIN_GLOBAL_KEY, ADMIN_GLOBAL_MAX, ADMIN_ANON_WINDOW_MS);
      return NextResponse.json(
        { error: 'Mật khẩu quản trị viên không chính xác. Vui lòng liên hệ Phòng TCNS để được cấp quyền.' },
        { status: 401 }
      );
    }
    clearDirectRateKey(primaryKey);
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
