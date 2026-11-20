import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { getServerAdminAuth } from '@/services/storage/server-admin-auth';
import { syncTicketsFromSupabase } from '@/services/storage/server-ticket-store';
import { syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { syncAccountsFromSupabase } from '@/services/storage/server-account-store';
import { syncAuditLogsFromSupabase } from '@/services/storage/server-audit-store';
import { buildUnitMonitorPayload } from '@/services/admin/unit-monitor-builder';
import { cacheGetOrSet } from '@/services/storage/runtime-cache';

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  const isTcnsOrAdmin =
    caller.isAdmin ||
    (caller.isAuthenticated && caller.unitCode?.toUpperCase() === 'TCNS') ||
    (await getServerAdminAuth());

  if (!isTcnsOrAdmin) {
    return NextResponse.json(
      {
        error: 'Chỉ Phòng Tổ chức - Nhân sự (TCNS) và Quản trị viên mới có quyền truy cập Dashboard theo dõi đơn vị.',
        code: 'FORBIDDEN_TCNS_ADMIN_ONLY'
      },
      { status: 403 }
    );
  }

  const filterUnit = (req.nextUrl.searchParams.get('unitCode') || '').trim().toUpperCase();
  const includeTest = req.nextUrl.searchParams.get('includeTest') === 'true';
  const cacheKey = `api:unit-monitor:${filterUnit || 'ALL'}:${includeTest}`;

  const payload = await cacheGetOrSet(cacheKey, ['tickets', 'workbooks', 'accounts', 'unit-monitor'], 3000, async () => {
    await Promise.all([
      syncTicketsFromSupabase().catch(() => {}),
      syncServerWorkbooksFromSupabase().catch(() => {}),
      syncAccountsFromSupabase().catch(() => {}),
      syncAuditLogsFromSupabase(500).catch(() => {})
    ]);
    return buildUnitMonitorPayload(filterUnit, includeTest);
  });

  return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
