import { NextRequest, NextResponse } from 'next/server';
import {
  syncAccountsFromSupabase,
  getAllUserAccounts,
  getUserAccountByEmail,
  upsertUserAccount,
  updateUserAccountRole,
  deleteUserAccount,
  UserRole
} from '@/services/storage/server-account-store';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { appendAuditLog } from '@/services/storage/server-audit-store';
import { normalizeEmail } from '@/services/storage/server-workbook-store';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập để quản lý tài khoản.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }
  if (caller.isStaff) {
    return NextResponse.json({ error: 'Cán bộ – Giảng viên không có quyền truy cập trang quản trị tài khoản.', code: 'FORBIDDEN_STAFF_ADMIN' }, { status: 403 });
  }

  try {
    await syncAccountsFromSupabase(true);
    let accounts = getAllUserAccounts();
    // Lãnh đạo đơn vị chỉ xem danh sách tài khoản thuộc đơn vị mình
    if (!caller.isAdmin) {
      accounts = accounts.filter((a) => a.unitCode.toUpperCase() === caller.unitCode.toUpperCase());
    }
    return NextResponse.json({ accounts, total: accounts.length });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'SUPABASE_NOT_CONFIGURED' || errorObj?.status === 503) {
      return NextResponse.json({ error: 'Dịch vụ CSDL máy chủ chưa được cấu hình.', code: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Không thể đồng bộ danh sách tài khoản từ CSDL máy chủ.', code: 'PERSISTENCE_FAILED' }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }
  if (caller.isStaff) {
    return NextResponse.json({ error: 'Cán bộ không có quyền tạo tài khoản.', code: 'FORBIDDEN_STAFF_ADMIN' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    if (!email) return NextResponse.json({ error: 'Email công vụ không hợp lệ.' }, { status: 400 });

    const existing = getUserAccountByEmail(email);

    // Ràng buộc bảo mật Lãnh đạo đơn vị
    if (!caller.isAdmin) {
      const targetUnit = String(body.unitCode || caller.unitCode).toUpperCase();
      if (targetUnit !== caller.unitCode.toUpperCase()) {
        return NextResponse.json({ error: 'Lãnh đạo đơn vị chỉ có quyền tạo tài khoản trong đơn vị mình.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
      }
      if (body.role === 'admin') {
        return NextResponse.json({ error: 'Lãnh đạo đơn vị không thể cấp quyền Quản trị viên.', code: 'FORBIDDEN_GRANT_ADMIN' }, { status: 403 });
      }
      if (existing && (existing.role === 'admin' || existing.email === 'tcns@hcmute.edu.vn')) {
        return NextResponse.json({ error: 'Lãnh đạo đơn vị không thể sửa tài khoản Quản trị viên.', code: 'FORBIDDEN_EDIT_ADMIN' }, { status: 403 });
      }
    }

    const assignedUnit = caller.isAdmin ? (body.unitCode || existing?.unitCode || 'TCNS') : caller.unitCode;
    const assignedRole = caller.isAdmin ? (body.role as UserRole || 'staff') : (body.role === 'unit_leader' ? 'unit_leader' : 'staff');

    const account = await upsertUserAccount(
      {
        email,
        displayName: body.displayName,
        unitCode: assignedUnit,
        title: body.title,
        role: assignedRole,
        authProvider: body.authProvider === 'google' ? 'google' : 'email',
        status: body.status === 'suspended' ? 'suspended' : 'active',
        hasSelectedUnit: true
      },
      true
    );

    appendAuditLog({
      unitCode: account.unitCode,
      unitName: account.unitNameVi,
      action: 'THAY_ĐỔI_TÀI_KHOẢN',
      details: `Tạo/cập nhật tài khoản ${account.email} (${account.displayName}) - Vai trò: ${account.role}`,
      actorEmail: caller.email,
      actorRole: caller.role
    });

    return NextResponse.json({ account });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'SUPABASE_NOT_CONFIGURED' || errorObj?.status === 503) {
      return NextResponse.json({ error: 'Dịch vụ CSDL máy chủ chưa được cấu hình.', code: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Không thể lưu tài khoản.' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }
  if (caller.isStaff) {
    return NextResponse.json({ error: 'Cán bộ không có quyền thay đổi phân quyền tài khoản.', code: 'FORBIDDEN_STAFF_ADMIN' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    const role = body.role as UserRole;
    if (!email) return NextResponse.json({ error: 'Thiếu email tài khoản cần cập nhật.' }, { status: 400 });

    const existing = getUserAccountByEmail(email);
    if (!existing) return NextResponse.json({ error: 'Không tìm thấy tài khoản.', code: 'ACCOUNT_NOT_FOUND' }, { status: 404 });

    // Ràng buộc bảo mật Lãnh đạo đơn vị
    if (!caller.isAdmin) {
      if (existing.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
        return NextResponse.json({ error: 'Lãnh đạo đơn vị chỉ có quyền quản lý tài khoản thuộc đơn vị mình.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
      }
      if (existing.role === 'admin' || existing.email === 'tcns@hcmute.edu.vn') {
        return NextResponse.json({ error: 'Lãnh đạo đơn vị không thể sửa hoặc khóa tài khoản Quản trị viên.', code: 'FORBIDDEN_EDIT_ADMIN' }, { status: 403 });
      }
      if (role === 'admin') {
        return NextResponse.json({ error: 'Lãnh đạo đơn vị không thể cấp quyền Quản trị viên.', code: 'FORBIDDEN_GRANT_ADMIN' }, { status: 403 });
      }
      if (body.unitCode && body.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
        return NextResponse.json({ error: 'Lãnh đạo đơn vị không thể chuyển tài khoản sang đơn vị khác.', code: 'FORBIDDEN_CHANGE_UNIT' }, { status: 403 });
      }
    }

    const assignedRole = caller.isAdmin ? (role || existing.role) : (role === 'unit_leader' ? 'unit_leader' : 'staff');
    const assignedUnit = caller.isAdmin ? (body.unitCode || existing.unitCode) : caller.unitCode;

    const updated = await updateUserAccountRole(email, assignedRole, {
      unitCode: assignedUnit,
      title: body.title,
      displayName: body.displayName,
      status: body.status,
      hasSelectedUnit: true
    });

    if (!updated) return NextResponse.json({ error: 'Cập nhật phân quyền không thành công.' }, { status: 400 });

    appendAuditLog({
      unitCode: updated.unitCode,
      unitName: updated.unitNameVi,
      action: 'THAY_ĐỔI_TÀI_KHOẢN',
      details: `Cập nhật phân quyền tài khoản ${updated.email} - Vai trò: ${updated.role}`,
      actorEmail: caller.email,
      actorRole: caller.role
    });

    return NextResponse.json({ account: updated });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'SUPABASE_NOT_CONFIGURED' || errorObj?.status === 503) {
      return NextResponse.json({ error: 'Dịch vụ CSDL máy chủ chưa được cấu hình.', code: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Lỗi khi cập nhật phân quyền tài khoản.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }
  if (caller.isStaff) {
    return NextResponse.json({ error: 'Cán bộ không có quyền xóa tài khoản.', code: 'FORBIDDEN_STAFF_ADMIN' }, { status: 403 });
  }

  const email = normalizeEmail(req.nextUrl.searchParams.get('email') || '');
  if (!email) return NextResponse.json({ error: 'Thiếu email tài khoản cần xóa.' }, { status: 400 });
  if (email === 'tcns@hcmute.edu.vn') {
    return NextResponse.json({ error: 'Không thể xóa tài khoản quản trị gốc TCNS.' }, { status: 400 });
  }

  const existing = getUserAccountByEmail(email);
  if (!caller.isAdmin && existing) {
    if (existing.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json({ error: 'Lãnh đạo đơn vị chỉ có quyền xóa tài khoản thuộc đơn vị mình.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
    }
    if (existing.role === 'admin') {
      return NextResponse.json({ error: 'Lãnh đạo đơn vị không thể xóa tài khoản Quản trị viên.', code: 'FORBIDDEN_DELETE_ADMIN' }, { status: 403 });
    }
  }

  try {
    const ok = await deleteUserAccount(email);
    appendAuditLog({
      unitCode: existing?.unitCode || caller.unitCode,
      unitName: existing?.unitNameVi || caller.unitCode,
      action: 'THAY_ĐỔI_TÀI_KHOẢN',
      details: `Xóa tài khoản ${email}`,
      actorEmail: caller.email,
      actorRole: caller.role
    });
    return NextResponse.json({ success: ok });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; status?: number };
    if (errorObj?.code === 'SUPABASE_NOT_CONFIGURED' || errorObj?.status === 503) {
      return NextResponse.json({ error: 'Dịch vụ CSDL máy chủ chưa được cấu hình.', code: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Xóa tài khoản trên CSDL máy chủ thất bại.', code: 'PERSISTENCE_FAILED' }, { status: 502 });
  }
}

