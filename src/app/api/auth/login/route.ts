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
  setUserSessionCookie,
  USER_SESSION_COOKIE_NAME,
  DEFAULT_SESSION_TTL_HOURS,
  DEFAULT_SESSION_MAX_AGE_SECONDS
} from '@/services/storage/server-auth-guard';
import { normalizeEmail } from '@/services/storage/server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { recordAuthAuditEvent } from '@/services/storage/server-audit-store';
import {
  MAX_AUTH_PAYLOAD_BYTES,
  checkAuthRateLimit,
  checkDirectRateKey,
  clearAuthFailures,
  extractClientIp,
  readBoundedJsonBody,
  recordAuthFailure,
  recordDirectFailure
} from '@/services/auth/rate-limiter';

const IP_SPRAY_MAX_ATTEMPTS = 60;
const RATE_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const parsed = await readBoundedJsonBody<{ email?: unknown; password?: unknown }>(req, MAX_AUTH_PAYLOAD_BYTES);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: parsed.code }, { status: parsed.status });
    }
    const body = parsed.data;
    const email = normalizeEmail(String(body.email || ''));
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ email công vụ và mật khẩu.' },
        { status: 400 }
      );
    }

    const clientIp = extractClientIp(req);
    const userAgent = req.headers.get('user-agent') || undefined;
    const sprayKey = `user_login_ip_spray:${clientIp}`;
    const rateCheck = checkAuthRateLimit(req, 'user_login', email);
    const sprayCheck = checkDirectRateKey(sprayKey, IP_SPRAY_MAX_ATTEMPTS, RATE_WINDOW_MS);
    if (!rateCheck.allowed || !sprayCheck.allowed) {
      const retryAfterSeconds = Math.max(rateCheck.retryAfterSeconds, sprayCheck.retryAfterSeconds);
      return NextResponse.json(
        {
          error: `Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    await syncAccountsFromSupabase();
    const existing = getUserAccountByEmail(email);

    if (!existing) {
      recordAuthFailure(req, 'user_login', email);
      recordDirectFailure(sprayKey, IP_SPRAY_MAX_ATTEMPTS, RATE_WINDOW_MS);
      await recordAuthAuditEvent({
        action: 'ĐĂNG_NHẬP_THẤT_BẠI',
        email,
        role: 'guest',
        unitCode: 'SYSTEM',
        unitName: 'Hệ thống xác thực',
        ipAddress: clientIp,
        userAgent,
        authMethod: 'email',
        reason: 'ACCOUNT_NOT_FOUND',
        details: `Đăng nhập thất bại: tài khoản ${email} chưa tồn tại trên hệ thống`
      });
      return NextResponse.json(
        { error: 'Tài khoản chưa được khởi tạo trong hệ thống. Vui lòng đăng nhập bằng Google (@hcmute.edu.vn) hoặc liên hệ Phòng TCNS.' },
        { status: 401 }
      );
    }

    if (existing.status === 'suspended') {
      await recordAuthAuditEvent({
        action: 'ĐĂNG_NHẬP_THẤT_BẠI',
        email,
        role: existing.role,
        unitCode: existing.unitCode,
        unitName: existing.unitNameVi || findHcmuteUnit(existing.unitCode).nameVi,
        ipAddress: clientIp,
        userAgent,
        authMethod: 'email',
        reason: 'ACCOUNT_SUSPENDED',
        details: `Đăng nhập bị từ chối: tài khoản ${email} đang bị tạm khóa`
      });
      return NextResponse.json(
        { error: 'Tài khoản này đang bị tạm khóa. Vui lòng liên hệ Phòng Tổ chức – Nhân sự.' },
        { status: 403 }
      );
    }

    const verified = await verifyUserPassword(email, password);
    if (!verified) {
      recordAuthFailure(req, 'user_login', email);
      recordDirectFailure(sprayKey, IP_SPRAY_MAX_ATTEMPTS, RATE_WINDOW_MS);
      await recordAuthAuditEvent({
        action: 'ĐĂNG_NHẬP_THẤT_BẠI',
        email,
        role: existing.role,
        unitCode: existing.unitCode,
        unitName: existing.unitNameVi || findHcmuteUnit(existing.unitCode).nameVi,
        ipAddress: clientIp,
        userAgent,
        authMethod: 'email',
        reason: 'WRONG_PASSWORD',
        details: `Đăng nhập thất bại: sai mật khẩu cho tài khoản ${email}`
      });
      return NextResponse.json(
        { error: 'Mật khẩu không chính xác. Nếu dùng Google Workspace HCM-UTE, vui lòng chọn nút Đăng nhập bằng Google.' },
        { status: 401 }
      );
    }

    clearAuthFailures(req, 'user_login', email);
    await recordAuthAuditEvent({
      action: 'ĐĂNG_NHẬP',
      email: verified.email,
      role: verified.role,
      unitCode: verified.unitCode,
      unitName: verified.unitNameVi || findHcmuteUnit(verified.unitCode).nameVi,
      ipAddress: clientIp,
      userAgent,
      authMethod: 'email',
      details: `Đăng nhập hệ thống qua Email/Mật khẩu (${verified.displayName || verified.email})`
    });

    const sessionToken = generateUserSessionToken({
      email: verified.email,
      role: verified.role,
      unitCode: verified.unitCode,
      ttlHours: DEFAULT_SESSION_TTL_HOURS
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

    res.cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: DEFAULT_SESSION_MAX_AGE_SECONDS
    });

    return res;
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'SUPABASE_NOT_CONFIGURED' || errorObj?.status === 503) {
      return NextResponse.json(
        { error: 'Dịch vụ xác thực CSDL chưa được cấu hình. Vui lòng liên hệ Quản trị viên.', code: 'SUPABASE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    if (errorObj?.code === 'DB_ERROR' || errorObj?.code === 'PERSISTENCE_FAILED') {
      return NextResponse.json(
        { error: 'Lỗi kết nối CSDL xác thực người dùng. Vui lòng thử lại sau.', code: 'PERSISTENCE_FAILED' },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: 'Không thể xử lý yêu cầu đăng nhập.' }, { status: 500 });
  }
}
