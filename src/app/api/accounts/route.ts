import { NextRequest, NextResponse } from 'next/server';
import {
  syncAccountsFromSupabase,
  getUserAccountByEmail,
  upsertUserAccount,
  stripAccountSensitiveFields,
  UserAccountRecord,
  UserRole
} from '@/services/storage/server-account-store';
import {
  getServerAdminAuth,
  isVerifiedAdminAccount,
  generateAdminToken,
  setServerAdminCookie
} from '@/services/storage/server-admin-auth';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { normalizeEmail } from '@/services/storage/server-workbook-store';

function extractBearer(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
}

function sanitizeClientAccount(account: UserAccountRecord, isAdmin: boolean): UserAccountRecord {
  const clean = stripAccountSensitiveFields(account);
  if (clean.role === 'admin' && !isAdmin) {
    return { ...clean, role: 'staff' };
  }
  return clean;
}

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const requestedEmail = normalizeEmail(req.nextUrl.searchParams.get('email') || caller.email);
  await syncAccountsFromSupabase();
  const rawAccount = getUserAccountByEmail(requestedEmail);

  if (!rawAccount) {
    return NextResponse.json({ account: null, isAdmin: false });
  }

  // IDOR Protection: Chỉ Admin hoặc Lãnh đạo đơn vị được xem hồ sơ người khác
  if (!caller.isAdmin && requestedEmail !== caller.email) {
    if (!caller.isUnitLeader || rawAccount.unitCode !== caller.unitCode) {
      return NextResponse.json(
        { error: 'Bạn không có quyền xem thông tin tài khoản này.', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }
  }

  const account = sanitizeClientAccount(rawAccount, caller.isAdmin);
  return NextResponse.json({ account, isAdmin: caller.isAdmin });
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerSession(req);
    const body = await req.json();
    const email = normalizeEmail(body.email || (caller.isAuthenticated ? caller.email : ''));
    if (!email) {
      return NextResponse.json({ error: 'Email công vụ không hợp lệ.' }, { status: 400 });
    }

    if (caller.isAuthenticated && !caller.isAdmin && email !== caller.email) {
      return NextResponse.json(
        { error: 'Bạn không có quyền thao tác trên tài khoản khác.', code: 'FORBIDDEN_IDOR' },
        { status: 403 }
      );
    }

    await syncAccountsFromSupabase(true);
    const existing = getUserAccountByEmail(email);
    const cookieAdmin = await getServerAdminAuth();
    const bearer = extractBearer(req);
    const verifiedGoogleAdmin = bearer ? await isVerifiedAdminAccount(email, bearer) : false;
    const isExplicitAdmin = email === 'tcns@hcmute.edu.vn' || existing?.role === 'admin' || body.role === 'admin';
    const isAdmin = isExplicitAdmin && (cookieAdmin || verifiedGoogleAdmin || caller.isAdmin);

    if (body.role === 'admin' && !isAdmin) {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên hệ thống mới có quyền thiết lập vai trò Quản trị.' },
        { status: 403 }
      );
    }

    const hasExistingAssignment = Boolean(
      existing?.hasSelectedUnit ||
      existing?.role === 'unit_leader' ||
      existing?.role === 'admin' ||
      (Boolean(existing?.unitCode) && existing?.unitCode !== 'FIT')
    );
    const targetUnitCode = hasExistingAssignment ? existing!.unitCode : (body.unitCode || existing?.unitCode || 'FIT');
    const targetTitle = hasExistingAssignment ? existing!.title : (body.title || existing?.title);
    const targetRole = hasExistingAssignment ? existing!.role : undefined;
    const targetHasSelectedUnit = hasExistingAssignment
      ? true
      : (body.hasSelectedUnit !== undefined ? Boolean(body.hasSelectedUnit) : false);

    const rawAccount = await upsertUserAccount({
      email,
      displayName: body.displayName || existing?.displayName,
      unitCode: targetUnitCode,
      title: targetTitle,
      avatarUrl: body.avatarUrl || existing?.avatarUrl,
      authProvider: body.authProvider === 'google' ? 'google' : (existing?.authProvider || 'email'),
      role: targetRole,
      hasSelectedUnit: targetHasSelectedUnit
    });

    if (verifiedGoogleAdmin && !cookieAdmin) {
      await setServerAdminCookie(generateAdminToken());
    }

    const account = sanitizeClientAccount(rawAccount, isAdmin);
    return NextResponse.json({ account, isAdmin });
  } catch {
    return NextResponse.json({ error: 'Không thể đồng bộ tài khoản người dùng.' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const caller = await getCallerSession(req);
    const body = await req.json();
    const email = normalizeEmail(body.email || (caller.isAuthenticated ? caller.email : ''));
    if (!email) {
      return NextResponse.json({ error: 'Email công vụ không hợp lệ.' }, { status: 400 });
    }

    if (caller.isAuthenticated && !caller.isAdmin && email !== caller.email) {
      return NextResponse.json(
        { error: 'Bạn không có quyền sửa thông tin của tài khoản khác.', code: 'FORBIDDEN_IDOR' },
        { status: 403 }
      );
    }

    await syncAccountsFromSupabase(true);
    const existing = getUserAccountByEmail(email);
    const bearer = extractBearer(req);
    const isAdmin = caller.isAdmin || (await getServerAdminAuth(email, bearer));

    if (existing?.status === 'suspended' && !isAdmin) {
      return NextResponse.json(
        { error: 'Tài khoản đang tạm khóa, không thể tự cập nhật hồ sơ.' },
        { status: 403 }
      );
    }

    const isFirstTimeOnboarding = !existing || !existing.hasSelectedUnit;
    const requestedRole = body.role as UserRole | undefined;

    if (requestedRole === 'admin' && !isAdmin && email !== 'tcns@hcmute.edu.vn') {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên hệ thống mới có quyền thiết lập vai trò Quản trị.' },
        { status: 403 }
      );
    }

    if (requestedRole && !isAdmin && !isFirstTimeOnboarding && requestedRole !== existing?.role) {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên hệ thống mới có quyền thay đổi vai trò sau khi đã xác nhận.' },
        { status: 403 }
      );
    }

    const targetUnitCode = body.unitCode || existing?.unitCode;
    const targetHasSelectedUnit = body.hasSelectedUnit !== undefined
      ? Boolean(body.hasSelectedUnit)
      : (Boolean(body.unitCode) || Boolean(existing?.hasSelectedUnit));

    const canChangeRole = isAdmin || isFirstTimeOnboarding || email === 'tcns@hcmute.edu.vn';
    const effectiveRole = canChangeRole && requestedRole ? requestedRole : existing?.role;

    const rawAccount = await upsertUserAccount(
      {
        email,
        displayName: body.displayName || existing?.displayName,
        unitCode: targetUnitCode,
        title: body.title || existing?.title,
        avatarUrl: body.avatarUrl || existing?.avatarUrl,
        role: effectiveRole,
        hasSelectedUnit: targetHasSelectedUnit
      },
      canChangeRole && Boolean(requestedRole)
    );

    const account = sanitizeClientAccount(rawAccount, isAdmin);
    return NextResponse.json({ account, isAdmin });
  } catch {
    return NextResponse.json({ error: 'Không thể cập nhật thông tin tài khoản.' }, { status: 400 });
  }
}
