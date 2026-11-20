import { NextResponse } from 'next/server';
import {
  getServerAdminAuth,
  verifyAdminPassword,
  generateAdminToken,
  setServerAdminCookie,
  clearServerAdminCookie
} from '@/services/storage/server-admin-auth';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import {
  MAX_AUTH_PAYLOAD_BYTES,
  checkAuthRateLimit,
  checkDirectRateKey,
  checkPayloadSizeLimit,
  clearAuthFailures,
  clearDirectRateKey,
  readBoundedJsonBody,
  recordAuthFailure,
  recordDirectFailure
} from '@/services/auth/rate-limiter';

const SHARED_GLOBAL_KEY = 'c1_unlock_global_shared';
const SHARED_GLOBAL_MAX = 40;
const SHARED_GLOBAL_WINDOW_MS = 10 * 60 * 1000;

export async function GET(req: Request) {
  const caller = await getCallerSession(req);
  if (caller.isAdmin || caller.isUnitLeader) {
    return NextResponse.json({ unlocked: true });
  }
  const isAuth = await getServerAdminAuth();
  return NextResponse.json({ unlocked: isAuth });
}

export async function POST(req: Request) {
  try {
    const quickSize = checkPayloadSizeLimit(req, MAX_AUTH_PAYLOAD_BYTES);
    if (!quickSize.allowed) {
      return NextResponse.json({ error: 'Dữ liệu yêu cầu vượt quá giới hạn cho phép.', code: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
    }

    const caller = await getCallerSession(req);
    const hasVerifiedActor = Boolean(caller.isAuthenticated && caller.email);
    const actorKey = hasVerifiedActor ? `c1_unlock_actor:${caller.email.toLowerCase()}` : '';

    const actorCheck = hasVerifiedActor
      ? checkDirectRateKey(actorKey)
      : checkAuthRateLimit(req, 'c1_unlock', 'anon');
    const globalCheck = checkDirectRateKey(SHARED_GLOBAL_KEY, SHARED_GLOBAL_MAX, SHARED_GLOBAL_WINDOW_MS);

    if (!actorCheck.allowed || !globalCheck.allowed) {
      const retryAfterSeconds = Math.max(actorCheck.retryAfterSeconds, globalCheck.retryAfterSeconds);
      return NextResponse.json(
        {
          error: `Quá nhiều lần thử mở khóa C1 thất bại. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds,
          unlocked: false
        },
        { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
      );
    }

    const parsed = await readBoundedJsonBody<{ password?: unknown }>(req, MAX_AUTH_PAYLOAD_BYTES);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: parsed.code, unlocked: false }, { status: parsed.status });
    }
    const { password } = parsed.data;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Vui lòng nhập mật khẩu quản trị viên.' },
        { status: 400 }
      );
    }

    const isValid = verifyAdminPassword(password.trim());
    if (!isValid) {
      if (hasVerifiedActor) recordDirectFailure(actorKey);
      else recordAuthFailure(req, 'c1_unlock', 'anon');
      recordDirectFailure(SHARED_GLOBAL_KEY, SHARED_GLOBAL_MAX, SHARED_GLOBAL_WINDOW_MS);
      return NextResponse.json(
        { error: 'Mật khẩu quản trị viên không chính xác.', unlocked: false },
        { status: 401 }
      );
    }
    if (hasVerifiedActor) clearDirectRateKey(actorKey);
    else clearAuthFailures(req, 'c1_unlock', 'anon');

    const token = generateAdminToken();
    await setServerAdminCookie(token);

    return NextResponse.json({
      success: true,
      unlocked: true,
      message: 'Mở khóa chỉnh sửa C1 thành công trên máy chủ.'
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lỗi hệ thống';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  await clearServerAdminCookie();
  return NextResponse.json({ success: true, unlocked: false });
}
