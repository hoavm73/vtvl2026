import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminAuth } from '@/services/storage/server-admin-auth';
import { getCallerSession } from '@/services/storage/server-auth-guard';
import {
  appendAuditLog,
  persistAuditLogToSupabase
} from '@/services/storage/server-audit-store';
import { invalidateCacheTags } from '@/services/storage/runtime-cache';
import {
  getServerUnits,
  upsertServerUnit,
  deleteServerUnit,
  resetServerUnits,
  syncUnitsFromSupabase,
  saveServerUnitsList
} from '@/services/storage/server-unit-store';
import {
  getAllUserAccounts,
  upsertUserAccount,
  syncAccountsFromSupabase
} from '@/services/storage/server-account-store';
import {
  syncServerWorkbooksFromSupabase,
  getWorkbookById
} from '@/services/storage/server-workbook-store';
import {
  persistWorkbookToSupabase,
  deleteWorkbookFromSupabase
} from '@/services/storage/server-supabase-store';
import { migrateWorkbookSheets } from '@/services/units/unit-synchronizer';
import { migrateTicketsForUnitDetailed } from '@/services/storage/server-ticket-store';

function handleUnitsError(err: unknown, fallbackMessage: string) {
  const errObj = err as { code?: string; status?: number; message?: string };
  if (errObj?.code === 'DB_SERVICE_UNAVAILABLE' || errObj?.status === 503) {
    return NextResponse.json(
      { error: 'Dịch vụ cơ sở dữ liệu tạm thời chưa sẵn sàng.', code: 'DB_SERVICE_UNAVAILABLE' },
      { status: 503 }
    );
  }
  if (errObj?.status && errObj.status >= 400 && errObj.status < 500) {
    return NextResponse.json(
      { error: errObj.message || fallbackMessage, code: errObj.code || 'BAD_REQUEST' },
      { status: errObj.status }
    );
  }
  return NextResponse.json(
    { error: errObj?.message || fallbackMessage, code: errObj?.code || 'INTERNAL_SERVER_ERROR' },
    { status: errObj?.status || 500 }
  );
}

export async function GET() {
  try {
    const units = await syncUnitsFromSupabase();
    return NextResponse.json({ units });
  } catch (err: unknown) {
    return handleUnitsError(err, 'Lỗi máy chủ khi tải danh mục đơn vị.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerSession(req);
    const isAdmin = caller.isAdmin || (await getServerAdminAuth());
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Chỉ Quản trị viên hệ thống mới có quyền quản trị đơn vị.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { unit, originalCode, fullList } = body;

    if (Array.isArray(fullList)) {
      const units = await saveServerUnitsList(fullList);
      return NextResponse.json({ success: true, units });
    }

    if (!unit || !unit.code || !unit.nameVi) {
      return NextResponse.json({ error: 'Thông tin đơn vị không hợp lệ.' }, { status: 400 });
    }

    const normNewCode = String(unit.code).trim().toUpperCase();
    const normOldCode = originalCode ? String(originalCode).trim().toUpperCase() : normNewCode;
    const newNameVi = String(unit.nameVi).trim();
    const currentUnits = getServerUnits();
    const existingOldUnit = currentUnits.find((u) => u.code.toUpperCase() === normOldCode) || null;
    const existingNewUnit = currentUnits.find((u) => u.code.toUpperCase() === normNewCode) || null;
    const oldNameVi = existingOldUnit?.nameVi || newNameVi;

    if (
      normOldCode !== normNewCode &&
      existingNewUnit &&
      existingNewUnit.immutableUnitId !== normOldCode
    ) {
      return NextResponse.json(
        { error: `Mã đơn vị mới [${normNewCode}] đã tồn tại trong danh mục đang hoạt động.`, code: 'UNIT_CODE_ALREADY_EXISTS' },
        { status: 409 }
      );
    }

    let migratedAccounts = 0;
    let migratedWorkbook = false;
    let migratedTickets = 0;

    if (normOldCode !== normNewCode || oldNameVi !== newNameVi) {
      // 1. Thực thi transaction di chuyển phiếu, phân công VTVL & quan hệ phối hợp trước khi sửa danh mục/file cục bộ
      const migrationStats = await migrateTicketsForUnitDetailed(normOldCode, normNewCode, {
        newNameVi,
        targetUnitMeta: unit,
        actorEmail: caller.email,
        actorRole: caller.role,
        simulateTxFailure: Boolean(body.simulateTxFailure)
      });
      migratedTickets = migrationStats.migratedTickets;
    }

    const effectiveOriginal = existingOldUnit ? originalCode : (existingNewUnit ? normNewCode : originalCode);
    const { units } = await upsertServerUnit(
      { ...unit, immutableUnitId: unit.immutableUnitId || existingOldUnit?.immutableUnitId || normOldCode },
      effectiveOriginal
    );

    if (normOldCode !== normNewCode || oldNameVi !== newNameVi) {
      // 2. Đồng bộ tài khoản
      await syncAccountsFromSupabase(true);
      const accounts = getAllUserAccounts();
      for (const acc of accounts) {
        if (acc.unitCode.toUpperCase() === normOldCode) {
          await upsertUserAccount({
            ...acc,
            unitCode: normNewCode,
            unitNameVi: newNameVi || acc.unitNameVi
          }, true);
          migratedAccounts++;
        }
      }

      // 3. Đồng bộ bảng tính 10 biểu
      await syncServerWorkbooksFromSupabase(true);
      const wb = getWorkbookById(`wb_${normOldCode}_2026`);
      if (wb && !wb.isDeleted) {
        wb.unitId = normNewCode;
        if (newNameVi) wb.unitNameVi = newNameVi;
        wb.id = `wb_${normNewCode}_2026`;
        wb.updatedAt = new Date().toLocaleString('vi-VN');
        if (wb.data) {
          wb.data = migrateWorkbookSheets(wb.data, normOldCode, normNewCode, oldNameVi, newNameVi);
        }
        await persistWorkbookToSupabase(wb);
        if (normOldCode !== normNewCode) {
          await deleteWorkbookFromSupabase(normOldCode);
        }
        migratedWorkbook = true;
      }
    }

    invalidateCacheTags(['units', 'accounts', 'workbooks', 'tickets', 'overview-stats', 'unit-monitor', 'coordination']);

    const audit = appendAuditLog({
      unitCode: normNewCode,
      unitName: newNameVi || normNewCode,
      action: 'THAY_ĐỔI_ĐƠN_VỊ',
      details: `Cập nhật đơn vị [${normOldCode} -> ${normNewCode}]: ${newNameVi}. Đồng bộ ${migratedAccounts} tài khoản, hồ sơ biểu: ${migratedWorkbook}, ${migratedTickets} phiếu.`,
      actorEmail: caller.email,
      actorRole: caller.role,
      oldValues: { unitCode: normOldCode, nameVi: oldNameVi },
      newValues: { unitCode: normNewCode, nameVi: newNameVi, migratedAccounts, migratedWorkbook, migratedTickets }
    });
    await persistAuditLogToSupabase(audit);

    return NextResponse.json({
      success: true,
      units,
      migrated: {
        oldCode: normOldCode,
        newCode: normNewCode,
        accounts: migratedAccounts,
        workbook: migratedWorkbook,
        tickets: migratedTickets
      }
    });
  } catch (err: unknown) {
    return handleUnitsError(err, 'Lỗi máy chủ khi cập nhật đơn vị.');
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const caller = await getCallerSession(req);
    const isAdmin = caller.isAdmin || (await getServerAdminAuth());
    if (!isAdmin) {
      return NextResponse.json({ error: 'Chỉ Quản trị viên mới có quyền xóa đơn vị.' }, { status: 403 });
    }
    const code = req.nextUrl.searchParams.get('code') || '';
    if (!code) {
      return NextResponse.json({ error: 'Thiếu mã đơn vị cần xóa.' }, { status: 400 });
    }
    const units = await deleteServerUnit(code);
    appendAuditLog({
      unitCode: code.toUpperCase(),
      unitName: code.toUpperCase(),
      action: 'THAY_ĐỔI_ĐƠN_VỊ',
      details: `Xóa đơn vị [${code.toUpperCase()}] khỏi danh mục hệ thống.`,
      actorEmail: caller.email,
      actorRole: caller.role
    });
    return NextResponse.json({ success: true, units });
  } catch (err: unknown) {
    return handleUnitsError(err, 'Lỗi máy chủ khi xóa đơn vị.');
  }
}

export async function PUT(req: NextRequest) {
  try {
    const caller = await getCallerSession(req);
    const isAdmin = caller.isAdmin || (await getServerAdminAuth());
    if (!isAdmin) {
      return NextResponse.json({ error: 'Chỉ Quản trị viên mới có quyền khôi phục danh mục.' }, { status: 403 });
    }
    const units = await resetServerUnits();
    appendAuditLog({
      unitCode: 'ALL',
      unitName: 'Toàn trường',
      action: 'THAY_ĐỔI_ĐƠN_VỊ',
      details: 'Khôi phục danh mục 39 đơn vị chuẩn HCM-UTE.',
      actorEmail: caller.email,
      actorRole: caller.role
    });
    return NextResponse.json({ success: true, units });
  } catch (err: unknown) {
    return handleUnitsError(err, 'Lỗi máy chủ khi khôi phục danh mục.');
  }
}
