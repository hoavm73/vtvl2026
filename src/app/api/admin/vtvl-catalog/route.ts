import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import {
  createVtvlCatalogItem,
  deleteVtvlCatalogItem,
  getVtvlCatalog,
  updateVtvlCatalogItem
} from '@/services/storage/server-vtvl-catalog-store';

async function requireAdmin(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return { ok: false as const, res: NextResponse.json({ error: 'Chưa đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 }) };
  }
  if (caller.isSuspended) {
    return { ok: false as const, res: NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 }) };
  }
  if (!caller.isAdmin) {
    return { ok: false as const, res: NextResponse.json({ error: 'Chỉ Admin/TCNS được quản lý danh mục VTVL chuẩn cấp Trường.', code: 'FORBIDDEN_ADMIN_ONLY' }, { status: 403 }) };
  }
  return { ok: true as const, caller };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const items = getVtvlCatalog({ activeOnly: false });
  return NextResponse.json({ items, total: items.length });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const res = createVtvlCatalogItem(body, auth.caller.email);
  if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: res.status });
  return NextResponse.json({ success: true, item: res.item }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || '').trim();
  if (!code) return NextResponse.json({ error: 'Thiếu mã VTVL cần cập nhật.', code: 'MISSING_CODE' }, { status: 400 });
  const res = await updateVtvlCatalogItem(code, body, auth.caller.email);
  if (!res.ok) return NextResponse.json({ error: res.error, code: res.code }, { status: res.status });
  return NextResponse.json({ success: true, item: res.item, propagatedWorkbooks: res.propagatedWorkbooks });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;
  const code = req.nextUrl.searchParams.get('code') || (await req.json().catch(() => ({}))).code || '';
  if (!code) return NextResponse.json({ error: 'Thiếu mã VTVL cần xóa.', code: 'MISSING_CODE' }, { status: 400 });
  const res = deleteVtvlCatalogItem(String(code), auth.caller.email);
  if (!res.ok) {
    return NextResponse.json({ error: res.error, code: res.code, usedByUnits: res.usedByUnits }, { status: res.status });
  }
  return NextResponse.json({ success: true });
}
