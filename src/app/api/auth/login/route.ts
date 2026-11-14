import { NextRequest, NextResponse } from 'next/server';
import {
  syncAccountsFromSupabase,
  verifyUserPassword,
  getUserAccountByEmail,
  stripAccountSensitiveFields
} from '@/services/storage/server-account-store';
import { generateAdminToken, setServerAdminCookie } from '@/services/storage/server-admin-auth';
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

    if (verified.role === 'admin') {
      await setServerAdminCookie(generateAdminToken());
    }

    return NextResponse.json({
      ok: true,
      account: stripAccountSensitiveFields(verified)
    });
  } catch {
    return NextResponse.json({ error: 'Không thể xử lý yêu cầu đăng nhập.' }, { status: 500 });
  }
}
