import { NextRequest, NextResponse } from 'next/server';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import { getUserAccountByEmail, syncAccountsFromSupabase } from '@/services/storage/server-account-store';
import { upsertTicketAndSyncUnit } from '@/services/storage/server-ticket-store';
import { createImmutableSurveyVersion } from '@/services/storage/server-ticket-version-store';
import { appendAuditLog, persistAuditLogToSupabase } from '@/services/storage/server-audit-store';
import { withCrossProcessLock } from '@/services/storage/server-file-lock';
import { withHeavyMutationBudget } from '@/services/storage/heavy-mutation-gate';
import { enforceApiRateLimit } from '@/services/auth/api-rate-limiter';
import { readBoundedJsonBody, MAX_WORKBOOK_PAYLOAD_BYTES } from '@/services/auth/payload-limiter';
import { checkUnitWorkbookApprovedLock } from '@/services/workbooks/workbook-lock-guard';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { normalizeEmail } from '@/services/storage/server-workbook-store';
import { handleTicketRouteError } from '@/services/tickets/ticket-route-helpers';
import { StaffWorkTicket, TicketStatus } from '@/types/staff-ticket';

interface BulkImportRowInput {
  ownerEmail?: string;
  maNhiemVu?: string;
  maCongViec?: string;
  maVtvl?: string;
  tenCongViec?: string;
  sanPham?: string;
  chatLuong?: string;
  canCu?: string;
  maVtvlPhoiHop?: string;
  soSpNam?: number;
  phutThucTe?: number;
  gioBoSung?: number;
  nguonSoLieu?: string;
}

export async function POST(req: NextRequest) {
  const caller = await getCallerSession(req);
  if (!caller.isAuthenticated) {
    return NextResponse.json({ error: 'Yêu cầu đăng nhập.', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  if (caller.isSuspended) {
    return NextResponse.json({ error: 'Tài khoản đang bị tạm khóa.', code: 'ACCOUNT_SUSPENDED' }, { status: 403 });
  }
  if (!caller.isAdmin) {
    return NextResponse.json(
      { error: 'Chỉ Quản trị viên (Admin) mới được phép nhập Excel phiếu công việc thay mặt cán bộ.', code: 'FORBIDDEN_ADMIN_ONLY' },
      { status: 403 }
    );
  }

  const rateErr = enforceApiRateLimit('unit_reconcile', caller.email);
  if (rateErr) return rateErr;

  try {
    const parsed = await readBoundedJsonBody<{
      unitCode?: string;
      targetStatus?: 'draft' | 'submitted';
      rows?: BulkImportRowInput[];
    }>(req, MAX_WORKBOOK_PAYLOAD_BYTES);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error, code: parsed.code }, { status: parsed.status });
    }

    const effectiveUnit = String(parsed.data.unitCode || '').trim().toUpperCase();
    if (!effectiveUnit || effectiveUnit === 'ALL') {
      return NextResponse.json({ error: 'Vui lòng chọn đúng 1 đơn vị cụ thể để nạp phiếu.', code: 'INVALID_UNIT' }, { status: 400 });
    }
    const unitInfo = findHcmuteUnit(effectiveUnit);
    const lockErr = await checkUnitWorkbookApprovedLock(unitInfo.code);
    if (lockErr) return lockErr;

    const rows = Array.isArray(parsed.data.rows) ? parsed.data.rows : [];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Không có dòng phiếu nào để nạp.', code: 'EMPTY_ROWS' }, { status: 400 });
    }
    if (rows.length > 300) {
      return NextResponse.json({ error: 'Mỗi lần nạp tối đa 300 dòng phiếu để bảo đảm hiệu năng.', code: 'TOO_MANY_ROWS' }, { status: 400 });
    }

    const asSubmitted = parsed.data.targetStatus === 'submitted';
    await syncAccountsFromSupabase().catch(() => {});

    const validated: Array<{ row: BulkImportRowInput; ownerEmail: string; ownerName: string; ownerTitle: string }> = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const email = normalizeEmail(String(r.ownerEmail || ''));
      const acc = email ? getUserAccountByEmail(email) : null;
      if (!acc) {
        return NextResponse.json(
          { error: `Dòng ${i + 1}: Không tìm thấy tài khoản "${r.ownerEmail || '(trống)'}" trong hệ thống.`, code: 'INVALID_OWNER_EMAIL' },
          { status: 400 }
        );
      }
      if (!String(r.maNhiemVu || '').trim() || !String(r.maVtvl || '').trim() || !String(r.tenCongViec || '').trim()) {
        return NextResponse.json(
          { error: `Dòng ${i + 1}: Thiếu Mã nhiệm vụ (A1), Mã VTVL (C1) hoặc Tên công việc.`, code: 'MISSING_CORE_FIELDS' },
          { status: 400 }
        );
      }
      if (asSubmitted && (!String(r.sanPham || '').trim() || !String(r.chatLuong || '').trim() || !String(r.canCu || '').trim() || !Number(r.soSpNam) || !String(r.nguonSoLieu || '').trim() || !Number(r.phutThucTe))) {
        return NextResponse.json(
          { error: `Dòng ${i + 1} (${r.tenCongViec}): Thiếu trường bắt buộc để nạp ở trạng thái "Đã nộp". Vui lòng chọn nạp ở trạng thái "Nháp".`, code: 'MISSING_SUBMIT_FIELDS' },
          { status: 400 }
        );
      }
      validated.push({
        row: r,
        ownerEmail: acc.email,
        ownerName: acc.displayName || acc.email.split('@')[0],
        ownerTitle: acc.role === 'unit_leader' ? 'Lãnh đạo đơn vị' : 'Cán bộ – Giảng viên'
      });
    }

    const created: StaffWorkTicket[] = [];
    const ownerSet = new Set<string>();

    await withHeavyMutationBudget({ kind: 'unit_reconcile', op: 'submit_ticket', unitCode: unitInfo.code, actorEmail: caller.email }, () =>
      withCrossProcessLock(`ticket_unit_${unitInfo.code}`, async () => {
        const status: TicketStatus = asSubmitted ? 'Đã nộp' : 'Nháp';
        const nowIso = new Date().toISOString();
        for (const item of validated) {
          const { row, ownerEmail, ownerName, ownerTitle } = item;
          const res = await upsertTicketAndSyncUnit({
            unitCode: unitInfo.code,
            ownerEmail,
            ownerName,
            ownerTitle,
            status,
            maNhiemVu: String(row.maNhiemVu).trim().toUpperCase(),
            maCongViec: String(row.maCongViec || '').trim(),
            tenCongViec: String(row.tenCongViec).trim(),
            maVtvl: String(row.maVtvl).trim().toUpperCase(),
            maVtvlPhoiHop: String(row.maVtvlPhoiHop || '').trim().toUpperCase(),
            sanPham: String(row.sanPham || '').trim(),
            chatLuong: String(row.chatLuong || '').trim(),
            canCu: String(row.canCu || '').trim(),
            soSpNam: Number(row.soSpNam) || 0,
            nguonSoLieu: String(row.nguonSoLieu || '').trim(),
            phutThucTe: Number(row.phutThucTe) || 0,
            gioBoSung: Number(row.gioBoSung) || 0,
            submittedAt: asSubmitted ? nowIso : undefined,
            lastChangeSummary: `Nhập từ Excel A2 bởi Admin (${caller.email})`
          });
          if (asSubmitted) {
            await createImmutableSurveyVersion({
              surveyId: res.ticket.id,
              ticket: res.ticket,
              submittedBy: caller.email,
              submittedAt: nowIso,
              changeSummary: `Nhập từ Excel A2 bởi Admin (${caller.email}) thay mặt ${ownerEmail}`
            });
          }
          created.push(res.ticket);
          ownerSet.add(ownerEmail);
        }
      })
    );

    const audit = appendAuditLog({
      unitCode: unitInfo.code,
      unitName: unitInfo.nameVi,
      action: 'NHẬP_EXCEL_PHIẾU_HÀNG_LOẠT',
      details: `Admin nhập Excel chuẩn A2: tạo ${created.length} phiếu (${asSubmitted ? 'Đã nộp' : 'Nháp'}) cho ${ownerSet.size} cán bộ tại ${unitInfo.nameVi}`,
      actorEmail: caller.email,
      actorRole: caller.role,
      targetEntity: 'staff_work_tickets'
    });
    await persistAuditLogToSupabase(audit).catch(() => {});

    return NextResponse.json({
      ok: true,
      importedCount: created.length,
      staffCount: ownerSet.size,
      targetStatus: asSubmitted ? 'submitted' : 'draft',
      tickets: created
    });
  } catch (err: unknown) {
    return handleTicketRouteError(err, 'Lỗi khi nhập hàng loạt phiếu công việc từ Excel.');
  }
}
