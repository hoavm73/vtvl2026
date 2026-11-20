import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { collectSystemLoadMetrics, resetSystemLoadMetrics } from '@/services/storage/system-load-metrics';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: 'Chỉ Quản trị viên mới được xem số đo tải hệ thống.', code: 'FORBIDDEN_ADMIN_ONLY' }, { status: 403 });
  }

  if (req.nextUrl.searchParams.get('reset') === 'true') {
    resetSystemLoadMetrics(req.nextUrl.searchParams.get('resetBuckets') === 'true');
  }

  return NextResponse.json(
    { ok: true, ...collectSystemLoadMetrics() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
