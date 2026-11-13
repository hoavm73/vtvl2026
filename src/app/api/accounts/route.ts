import { NextRequest, NextResponse } from 'next/server';
import {
  syncAccountsFromSupabase,
  getUserAccountByEmail,
  upsertUserAccount,
  UserAccountRecord,
  UserRole
} from '@/services/storage/server-account-store';
import {
  getServerAdminAuth,
  isVerifiedAdminAccount,
  generateAdminToken,
  setServerAdminCookie
} from '@/services/storage/server-admin-auth';
import { normalizeEmail } from '@/services/storage/server-workbook-store';

function extractBearer(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
}

function sanitizeClientAccount(account: UserAccountRecord, isAdmin: boolean): UserAccountRecord {
  if (account.role === 'admin' && !isAdmin) {
    return { ...account, role: 'editor' };
  }
  return account;
}

export async function GET(req: NextRequest) {
  const email = normalizeEmail(req.nextUrl.searchParams.get('email') || '');
  if (!email) {
    return NextResponse.json({ error: 'Thiếu email người dùng.' }, { status: 400 });
  }

  await syncAccountsFromSupabase();
  const existing = getUserAccountByEmail(email);
  const rawAccount = existing || upsertUserAccount({ email });

  const cookieAdmin = await getServerAdminAuth();
  const bearer = extractBearer(req);
  const verifiedGoogleAdmin = bearer ? await isVerifiedAdminAccount(email, bearer) : false;

  if (verifiedGoogleAdmin && !cookieAdmin) {
    await setServerAdminCookie(generateAdminToken());
  }

  const isAdmin = cookieAdmin || verifiedGoogleAdmin;
  const account = sanitizeClientAccount(rawAccount, isAdmin);
  return NextResponse.json({ account, isAdmin });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    if (!email) {
      return NextResponse.json({ error: 'Email công vụ không hợp lệ.' }, { status: 400 });
    }

    await syncAccountsFromSupabase();
    const rawAccount = upsertUserAccount({
      email,
      displayName: body.displayName,
      unitCode: body.unitCode,
      title: body.title,
      avatarUrl: body.avatarUrl,
      authProvider: body.authProvider === 'google' ? 'google' : 'email'
    });

    const cookieAdmin = await getServerAdminAuth();
    const bearer = extractBearer(req);
    const verifiedGoogleAdmin = bearer ? await isVerifiedAdminAccount(email, bearer) : false;

    if (verifiedGoogleAdmin && !cookieAdmin) {
      await setServerAdminCookie(generateAdminToken());
    }

    const isAdmin = cookieAdmin || verifiedGoogleAdmin;
    const account = sanitizeClientAccount(rawAccount, isAdmin);
    return NextResponse.json({ account, isAdmin });
  } catch {
    return NextResponse.json({ error: 'Không thể đồng bộ tài khoản người dùng.' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    if (!email) {
      return NextResponse.json({ error: 'Email công vụ không hợp lệ.' }, { status: 400 });
    }

    await syncAccountsFromSupabase();
    const existing = getUserAccountByEmail(email);
    const bearer = extractBearer(req);
    const isAdmin = await getServerAdminAuth(email, bearer);

    if (existing?.status === 'suspended' && !isAdmin) {
      return NextResponse.json(
        { error: 'Tài khoản đang tạm khóa, không thể tự cập nhật hồ sơ.' },
        { status: 403 }
      );
    }

    const requestedRole = body.role as UserRole | undefined;
    if (requestedRole && !isAdmin) {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên hệ thống mới có quyền thay đổi vai trò.' },
        { status: 403 }
      );
    }

    const rawAccount = upsertUserAccount(
      {
        email,
        displayName: body.displayName,
        unitCode: body.unitCode,
        title: body.title,
        avatarUrl: body.avatarUrl,
        role: isAdmin ? requestedRole : undefined
      },
      isAdmin && Boolean(requestedRole)
    );

    const account = sanitizeClientAccount(rawAccount, isAdmin);
    return NextResponse.json({ account, isAdmin });
  } catch {
    return NextResponse.json({ error: 'Không thể cập nhật thông tin tài khoản.' }, { status: 400 });
  }
}
