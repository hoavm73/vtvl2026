import { NextRequest, NextResponse } from 'next/server';
import {
  syncAccountsFromSupabase,
  getAllUserAccounts,
  upsertUserAccount,
  updateUserAccountRole,
  deleteUserAccount,
  UserRole
} from '@/services/storage/server-account-store';
import { getServerAdminAuth } from '@/services/storage/server-admin-auth';
import { normalizeEmail } from '@/services/storage/server-workbook-store';

function extractBearer(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || '';
  return authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
}

async function authorizeAdmin(req: NextRequest): Promise<boolean> {
  const actorEmail = req.headers.get('x-actor-email') || req.nextUrl.searchParams.get('actorEmail') || '';
  return getServerAdminAuth(actorEmail || undefined, extractBearer(req));
}

export async function GET(req: NextRequest) {
  const isAuth = await authorizeAdmin(req);
  if (!isAuth) {
    return NextResponse.json(
      { error: 'Yêu cầu quyền Quản trị viên để quản lý danh sách tài khoản.', code: 'UNAUTHORIZED_ADMIN' },
      { status: 401 }
    );
  }

  try {
    await syncAccountsFromSupabase(true);
    const accounts = getAllUserAccounts();
    return NextResponse.json({ accounts, total: accounts.length });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'SUPABASE_NOT_CONFIGURED' || errorObj?.status === 503) {
      return NextResponse.json(
        { error: 'Dịch vụ CSDL máy chủ chưa được cấu hình.', code: 'SUPABASE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Không thể đồng bộ danh sách tài khoản từ CSDL máy chủ.', code: 'PERSISTENCE_FAILED' },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const isAuth = await authorizeAdmin(req);
  if (!isAuth) {
    return NextResponse.json(
      { error: 'Yêu cầu quyền Quản trị viên để tạo hoặc cập nhật tài khoản.', code: 'UNAUTHORIZED_ADMIN' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    if (!email) {
      return NextResponse.json({ error: 'Email công vụ không hợp lệ.' }, { status: 400 });
    }

    const account = await upsertUserAccount(
      {
        email,
        displayName: body.displayName,
        unitCode: body.unitCode,
        title: body.title,
        role: body.role as UserRole,
        authProvider: body.authProvider === 'google' ? 'google' : 'email',
        status: body.status === 'suspended' ? 'suspended' : 'active',
        hasSelectedUnit: true
      },
      true
    );

    return NextResponse.json({ account });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'SUPABASE_NOT_CONFIGURED' || errorObj?.status === 503) {
      return NextResponse.json(
        { error: 'Dịch vụ CSDL máy chủ chưa được cấu hình.', code: 'SUPABASE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    if (errorObj?.code === 'DB_ERROR' || errorObj?.code === 'PERSISTENCE_FAILED') {
      return NextResponse.json(
        { error: 'Lưu tài khoản vào CSDL máy chủ thất bại.', code: 'PERSISTENCE_FAILED' },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: 'Không thể lưu tài khoản.' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const isAuth = await authorizeAdmin(req);
  if (!isAuth) {
    return NextResponse.json(
      { error: 'Yêu cầu quyền Quản trị viên để cập nhật vai trò tài khoản.', code: 'UNAUTHORIZED_ADMIN' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    const role = body.role as UserRole;
    if (!email || !role) {
      return NextResponse.json({ error: 'Thiếu email hoặc vai trò cần cập nhật.' }, { status: 400 });
    }

    const updated = await updateUserAccountRole(email, role, {
      unitCode: body.unitCode,
      title: body.title,
      displayName: body.displayName,
      status: body.status,
      hasSelectedUnit: true
    });

    if (!updated) {
      return NextResponse.json({ error: 'Vai trò hoặc email không hợp lệ.' }, { status: 400 });
    }

    return NextResponse.json({ account: updated });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'SUPABASE_NOT_CONFIGURED' || errorObj?.status === 503) {
      return NextResponse.json(
        { error: 'Dịch vụ CSDL máy chủ chưa được cấu hình.', code: 'SUPABASE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    if (errorObj?.code === 'DB_ERROR' || errorObj?.code === 'PERSISTENCE_FAILED') {
      return NextResponse.json(
        { error: 'Lỗi cập nhật CSDL máy chủ.', code: 'PERSISTENCE_FAILED' },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: 'Lỗi khi cập nhật phân quyền tài khoản.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const isAuth = await authorizeAdmin(req);
  if (!isAuth) {
    return NextResponse.json(
      { error: 'Yêu cầu quyền Quản trị viên để xóa tài khoản.', code: 'UNAUTHORIZED_ADMIN' },
      { status: 401 }
    );
  }

  const email = normalizeEmail(req.nextUrl.searchParams.get('email') || '');
  if (!email) {
    return NextResponse.json({ error: 'Thiếu email tài khoản cần xóa.' }, { status: 400 });
  }

  if (email === 'tcns@hcmute.edu.vn') {
    return NextResponse.json({ error: 'Không thể xóa tài khoản quản trị gốc TCNS.' }, { status: 400 });
  }

  try {
    const ok = await deleteUserAccount(email);
    return NextResponse.json({ success: ok });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'SUPABASE_NOT_CONFIGURED' || errorObj?.status === 503) {
      return NextResponse.json(
        { error: 'Dịch vụ CSDL máy chủ chưa được cấu hình.', code: 'SUPABASE_NOT_CONFIGURED' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Xóa tài khoản trên CSDL máy chủ thất bại.', code: 'PERSISTENCE_FAILED' },
      { status: 502 }
    );
  }
}

