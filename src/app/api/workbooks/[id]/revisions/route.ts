import { NextResponse } from 'next/server';
import {
  getWorkbookById,
  rollbackServerWorkbookRevisionAndPersist,
  ServerRevision,
  syncServerWorkbooksFromSupabase
} from '@/services/storage/server-workbook-store';
import { appendAuditLog, persistAuditLogToSupabase } from '@/services/storage/server-audit-store';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { isDatabaseConfigured, prisma, toIsoString } from '@/services/storage/prisma';
import { invalidateUnitMutationCache } from '@/services/storage/runtime-cache';
import { MAX_WORKBOOK_PAYLOAD_BYTES, readBoundedJsonBody } from '@/services/auth/payload-limiter';
import { enforceApiRateLimit } from '@/services/auth/api-rate-limiter';
import { toHeavyBusyResponse, withHeavyMutationBudget } from '@/services/storage/heavy-mutation-gate';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const { id } = await context.params;
    await syncServerWorkbooksFromSupabase(true);
    const workbook = getWorkbookById(id);
    if (!workbook) return NextResponse.json({ error: 'Không tìm thấy hồ sơ.', code: 'NOT_FOUND' }, { status: 404 });
    if (!caller.isAdmin && workbook.unitId.toUpperCase() !== caller.unitCode.toUpperCase()) {
      return NextResponse.json({ error: 'Không có quyền truy cập lịch sử đơn vị khác.', code: 'FORBIDDEN' }, { status: 403 });
    }
    const revMap = new Map<number, ServerRevision>();
    for (const r of workbook.revisions || []) {
      revMap.set(r.revision, r);
    }
    if (process.env.VTVL_ISOLATED_LOCAL_STORE !== 'true' && isDatabaseConfigured()) {
      try {
        const dbRows = await prisma.workbook_revisions.findMany({
          where: { workbook_id: workbook.id },
          orderBy: { revision: 'desc' },
          take: 15
        });
        for (const r of dbRows) {
          if (!revMap.has(r.revision)) {
            revMap.set(r.revision, {
              id: r.id,
              workbookId: r.workbook_id,
              revision: r.revision,
              data: r.data as unknown as ServerRevision['data'],
              actorEmail: r.actor_email,
              actorTitle: r.actor_title || undefined,
              changeSummary: r.change_summary || undefined,
              createdAt: toIsoString(r.created_at) || new Date().toISOString()
            });
          }
        }
      } catch {
        // Fallback an toàn về danh sách lưu trong bộ nhớ/tệp
      }
    }
    const mergedRevisions = Array.from(revMap.values()).sort((a, b) => b.revision - a.revision);
    return NextResponse.json({ workbookId: id, currentRevision: workbook.currentRevision || 1, revisions: mergedRevisions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lỗi hệ thống' }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  if (!caller.isAdmin && !caller.isUnitLeader) {
    return NextResponse.json({ error: 'Chỉ Lãnh đạo đơn vị hoặc Quản trị viên mới có quyền khôi phục phiên bản.', code: 'FORBIDDEN' }, { status: 403 });
  }
  try {
    const parsed = await readBoundedJsonBody<{ targetRevision?: unknown; reason?: unknown }>(req, MAX_WORKBOOK_PAYLOAD_BYTES);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: parsed.code }, { status: parsed.status });
    }
    const { id } = await context.params;
    const unitMatch = id.match(/^wb_([A-Za-z0-9]+)/);
    const prelimUnit = (unitMatch ? unitMatch[1] : caller.unitCode).toUpperCase();
    const rateErr = enforceApiRateLimit('workbook_write', prelimUnit);
    if (rateErr) return rateErr;

    const { targetRevision, reason } = parsed.data;
    if (typeof targetRevision !== 'number') {
      return NextResponse.json({ error: 'Thiếu số phiên bản cần khôi phục (targetRevision).' }, { status: 400 });
    }

    return await withHeavyMutationBudget({ kind: 'workbook_save', unitCode: prelimUnit, actorEmail: caller.email }, async () => {
      await syncServerWorkbooksFromSupabase(true);
      const workbook = getWorkbookById(id);
      if (workbook && !caller.isAdmin && workbook.unitId.toUpperCase() !== caller.unitCode.toUpperCase()) {
        return NextResponse.json({ error: 'Không thể khôi phục phiên bản đơn vị khác.', code: 'FORBIDDEN' }, { status: 403 });
      }
      const updated = await rollbackServerWorkbookRevisionAndPersist(id, targetRevision, caller.email, typeof reason === 'string' ? reason : undefined);
      if (!updated.success || !updated.serverWorkbook) {
        return NextResponse.json({ error: 'Không thể khôi phục phiên bản đã chọn.' }, { status: 400 });
      }
      const audit = appendAuditLog({
        workbookId: id, unitCode: updated.serverWorkbook.unitId, unitName: updated.serverWorkbook.unitNameVi,
        action: 'KHÔI_PHỤC_PHIÊN_BẢN', details: `Khôi phục phiên bản #${targetRevision}${reason ? `: ${reason}` : ''}`,
        actorEmail: caller.email, actorRole: caller.role
      });
      await persistAuditLogToSupabase(audit);
      invalidateUnitMutationCache(updated.serverWorkbook.unitId);
      return NextResponse.json({ success: true, currentRevision: updated.currentRevision, workbook: updated.serverWorkbook });
    });
  } catch (error) {
    const busy = toHeavyBusyResponse(error);
    if (busy) return busy;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Lỗi hệ thống' }, { status: 500 });
  }
}
