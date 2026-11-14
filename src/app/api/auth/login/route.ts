import { NextRequest, NextResponse } from 'next/server';
import {
  syncAccountsFromSupabase,
  verifyUserPassword,
  getUserAccountByEmail,
  stripAccountSensitiveFields
} from '@/services/storage/server-account-store';
import { generateAdminToken, setServerAdminCookie } from '@/services/storage/server-admin-auth';
import {
  generateUserSessionToken,
  setUserSessionCookie
} from '@/services/storage/server-auth-guard';
import { normalizeEmail } from '@/services/storage/server-workbook-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ email công vụ và mật khẩu.' },
        { status: 400 }
      );
    }

    await syncAccountsFromSupabase();
    const existing = getUserAccountByEmail(email);

    if (!existing) {
      return NextResponse.json(
        { error: 'Tài khoản chưa được khởi tạo trong hệ thống. Vui lòng đăng nhập bằng Google (@hcmute.edu.vn) hoặc liên hệ Phòng TCNS.' },
        { status: 401 }
      );
    }

    if (existing.status === 'suspended') {
      return NextResponse.json(
        { error: 'Tài khoản này đang bị tạm khóa. Vui lòng liên hệ Phòng Tổ chức – Nhân sự.' },
        { status: 403 }
      );
    }

    const verified = verifyUserPassword(email, password);
    if (!verified) {
      return NextResponse.json(
        { error: 'Mật khẩu không chính xác. Nếu dùng Google Workspace HCM-UTE, vui lòng chọn nút Đăng nhập bằng Google.' },
        { status: 401 }
      );
    }

    const sessionToken = generateUserSessionToken({
      email: verified.email,
      role: verified.role,
      unitCode: verified.unitCode
    });
    await setUserSessionCookie(sessionToken);

    let adminToken: string | undefined;
    if (verified.role === 'admin') {
      adminToken = generateAdminToken();
      await setServerAdminCookie(adminToken);
    }

    const res = NextResponse.json({
      ok: true,
      account: stripAccountSensitiveFields(verified),
      sessionToken,
      adminToken
    });

    if (adminToken) {
      res.cookies.set('hcmute_vtvl_admin_token_v2', adminToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60
      });
    }

    return res;
  } catch {
    return NextResponse.json({ error: 'Không thể xử lý yêu cầu đăng nhập.' }, { status: 500 });
  }
}
