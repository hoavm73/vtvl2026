import { NextResponse } from 'next/server';
import {
  getServerAdminAuth,
  verifyAdminPassword,
  generateAdminToken,
  setServerAdminCookie,
  clearServerAdminCookie
} from '@/services/storage/server-admin-auth';
import { getCallerSession } from '@/services/storage/server-auth-guard';

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
    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Vui lòng nhập mật khẩu quản trị viên.' },
        { status: 400 }
      );
    }

    const isValid = verifyAdminPassword(password.trim());
    if (!isValid) {
      return NextResponse.json(
        { error: 'Mật khẩu quản trị viên không chính xác.', unlocked: false },
        { status: 401 }
      );
    }

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

