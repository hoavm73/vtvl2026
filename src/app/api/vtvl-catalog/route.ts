import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { getVtvlCatalog } from '@/services/storage/server-vtvl-catalog-store';
import { cacheGetOrSet } from '@/services/storage/runtime-cache';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json(
      { error: 'Yêu cầu đăng nhập để tra cứu danh mục VTVL chuẩn.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }

  const items = await cacheGetOrSet(
    'vtvl-catalog:active',
    ['c1-catalog'],
    30_000,
    async () => getVtvlCatalog({ activeOnly: true })
  );
  return NextResponse.json({ items, total: items.length });
}
