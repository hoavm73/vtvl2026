import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminPassword,
  generateAdminToken,
  verifyAdminToken,
  getServerAdminAuth,
  setServerAdminCookie,
  clearServerAdminCookie,
  isVerifiedAdminAccount
} from '@/services/storage/server-admin-auth';

function extractBearer(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
}

const ADMIN_COOKIE = 'hcmute_vtvl_admin_token_v2';

export async function GET(req: NextRequest) {
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

  return NextResponse.json({ authenticated: false });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;
    if (!password || !verifyAdminPassword(password)) {
      return NextResponse.json(
        { error: 'Mật khẩu quản trị viên không chính xác. Vui lòng liên hệ Phòng TCNS để được cấp quyền.' },
        { status: 401 }
      );
    }
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
