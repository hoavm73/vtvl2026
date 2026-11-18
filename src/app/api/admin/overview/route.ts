import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { getAdminOverviewSqlAggregate } from '@/services/tickets/ticket-query-service';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }

  const requestedUnit = (req.nextUrl.searchParams.get('unitCode') || '').trim().toUpperCase();
  if (!caller.isAdmin && requestedUnit && requestedUnit !== 'ALL' && requestedUnit !== caller.unitCode.toUpperCase()) {
    return NextResponse.json({ error: 'Bạn không có quyền truy cập thống kê của đơn vị khác.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
  }

  const effectiveScope = caller.isAdmin ? (requestedUnit || 'ALL') : caller.unitCode.toUpperCase();
  const data = await getAdminOverviewSqlAggregate(effectiveScope);

  return NextResponse.json({
    ok: true,
    scope: effectiveScope,
    source: data.source,
    totals: data.totals,
    units: data.units
  }, { headers: { 'Cache-Control': 'private, max-age=5' } });
}
