import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { getUserAccountByEmail, syncAccountsFromSupabase } from '@/services/storage/server-account-store';
import {
  getAllVtvlAssignments,
  getAssignmentsForEmail,
  previewRecipientsForTargets,
  setAssignmentsForAccount,
  syncVtvlAssignmentsFromSupabase
} from '@/services/storage/server-vtvl-assignment-store';
import { getOrCreateWorkbook, normalizeEmail, syncServerWorkbooksFromSupabase } from '@/services/storage/server-workbook-store';
import { isIsolatedLocalMode } from '@/services/storage/server-ticket-db';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { appendAuditLog, persistAuditLogToSupabase } from '@/services/storage/server-audit-store';
import { invalidateCacheTags } from '@/services/storage/runtime-cache';
import { resolveUnitCodeSafe } from '@/services/tickets/vtvl-coordination-helpers';

function parsePreviewTargets(rawTargets: string, fallbackUnit: string): { targetUnitCode: string; maVtvl: string }[] {
  if (!rawTargets.trim()) return [];
  return rawTargets
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const sep = token.indexOf('::');
      if (sep >= 0) {
        return {
          targetUnitCode: resolveUnitCodeSafe(token.slice(0, sep) || fallbackUnit),
          maVtvl: token.slice(sep + 2).trim()
        };
      }
      return { targetUnitCode: resolveUnitCodeSafe(fallbackUnit), maVtvl: token };
    })
    .filter((t) => Boolean(t.targetUnitCode && t.maVtvl));
}

export async function GET(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }

  if (!isIsolatedLocalMode()) {
    await Promise.all([
      syncAccountsFromSupabase().catch(() => {}),
      syncVtvlAssignmentsFromSupabase().catch(() => {}),
      syncServerWorkbooksFromSupabase(true).catch(() => {})
    ]);
  }

  const sp = req.nextUrl.searchParams;
  const mode = (sp.get('mode') || '').trim();

  if (mode === 'preview') {
    const rawTargets = sp.get('targets') || '';
    const unitCode = (sp.get('unitCode') || caller.unitCode).trim();
    const maVtvl = (sp.get('maVtvl') || '').trim();
    const targets = rawTargets ? parsePreviewTargets(rawTargets, unitCode) : (maVtvl ? [{ targetUnitCode: unitCode, maVtvl }] : []);
    const previews = previewRecipientsForTargets(targets).map((p) => ({
      ...p,
      // Bảo toàn tối thiểu dữ liệu: chỉ trả tên hiển thị + đơn vị ở khung xem trước
      recipients: p.recipients.map((r) => ({ displayName: r.displayName, unitCode: r.unitCode }))
    }));
    return NextResponse.json({ previews });
  }

  if (mode === 'unit-catalog') {
    const requestedUnit = resolveUnitCodeSafe(sp.get('unitCode') || caller.unitCode);
    const unit = findHcmuteUnit(requestedUnit);
    const wb = getOrCreateWorkbook(unit.code, '01/10/2025–30/9/2026', caller.email, caller.role);
    const c1 = Array.isArray(wb.data?.C1) ? wb.data.C1 : [];
    const options = c1
      .filter((r) => String(r.maVtvl || '').trim())
      .map((r) => ({
        maVtvl: String(r.maVtvl || '').trim(),
        tenVtvl: String(r.tenVtvl || '').trim()
      }));
    return NextResponse.json({ unitCode: unit.code, unitNameVi: unit.nameVi, options });
  }

  if (mode === 'accounts') {
    if (caller.isStaff) {
      return NextResponse.json({ error: 'Cán bộ không có quyền xem danh sách phân công toàn đơn vị.', code: 'FORBIDDEN_STAFF_ADMIN' }, { status: 403 });
    }
    const filterUnit = caller.isAdmin ? (sp.get('unitCode') || undefined) : caller.unitCode;
    return NextResponse.json({ assignments: getAllVtvlAssignments(filterUnit) });
  }

  return NextResponse.json({ assignments: getAssignmentsForEmail(caller.email) });
}

export async function PUT(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }
  if (caller.isStaff) {
    return NextResponse.json({ error: 'Chỉ Quản trị viên hoặc Lãnh đạo đơn vị được phân công mã VTVL.', code: 'FORBIDDEN_STAFF_ASSIGN_VTVL' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const reqActor = body.actorEmail || body.actor_id;
    if (reqActor && normalizeEmail(String(reqActor)) !== normalizeEmail(caller.email)) {
      return NextResponse.json({ error: 'Không được phép giả mạo danh tính actor_id.', code: 'FORBIDDEN_ACTOR_SPOOFING' }, { status: 403 });
    }

    const userEmail = normalizeEmail(String(body.userEmail || ''));
    if (!userEmail) {
      return NextResponse.json({ error: 'Thiếu email tài khoản cần phân công VTVL.', code: 'MISSING_USER_EMAIL' }, { status: 400 });
    }

    if (!isIsolatedLocalMode()) {
      await syncAccountsFromSupabase().catch(() => {});
    }
    const targetAccount = getUserAccountByEmail(userEmail);
    if (!targetAccount) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản trên hệ thống.', code: 'ACCOUNT_NOT_FOUND' }, { status: 404 });
    }

    if (!caller.isAdmin) {
      if (resolveUnitCodeSafe(targetAccount.unitCode) !== resolveUnitCodeSafe(caller.unitCode)) {
        return NextResponse.json({ error: 'Lãnh đạo đơn vị chỉ phân công VTVL cho tài khoản thuộc đơn vị mình.', code: 'FORBIDDEN_CROSS_UNIT' }, { status: 403 });
      }
      if (targetAccount.role === 'admin') {
        return NextResponse.json({ error: 'Lãnh đạo đơn vị không được thay đổi phân công của Quản trị viên.', code: 'FORBIDDEN_MODIFY_ADMIN' }, { status: 403 });
      }
    }

    const rawItems = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.maVtvls)
        ? body.maVtvls.map((code: string) => ({ maVtvl: String(code || '') }))
        : [];

    const unitCode = resolveUnitCodeSafe(targetAccount.unitCode);
    const oldAssignments = getAssignmentsForEmail(targetAccount.email);
    const assignments = await setAssignmentsForAccount({
      userEmail: targetAccount.email,
      unitCode,
      items: rawItems,
      assignedBy: caller.email
    });
    invalidateCacheTags(['coordination']);

    const audit = appendAuditLog({
      unitCode,
      unitName: findHcmuteUnit(unitCode).nameVi,
      action: 'PHÂN_CÔNG_VTVL_TÀI_KHOẢN',
      targetId: targetAccount.email,
      targetEntity: 'user_vtvl_assignments',
      details: `Phân công ${assignments.length} mã VTVL cho ${targetAccount.email} tại đơn vị ${unitCode}`,
      actorEmail: caller.email,
      actorRole: caller.role,
      oldValues: { maVtvls: oldAssignments.map((a) => `${a.unitCode}:${a.maVtvl}`) },
      newValues: { maVtvls: assignments.map((a) => `${a.unitCode}:${a.maVtvl}`) }
    });
    await persistAuditLogToSupabase(audit);

    return NextResponse.json({ ok: true, userEmail: targetAccount.email, unitCode, assignments });
  } catch {
    return NextResponse.json({ error: 'Không thể cập nhật phân công VTVL cho tài khoản.' }, { status: 400 });
  }
}
