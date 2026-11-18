import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminAuth } from '@/services/storage/server-admin-auth';
import { getCallerSession } from '@/services/storage/server-auth-guard';
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
import { getServerUnits, upsertServerUnit } from '@/services/storage/server-unit-store';
import { migrateWorkbookSheets } from '@/services/units/unit-synchronizer';
import { migrateTicketsForUnitDetailed } from '@/services/storage/server-ticket-store';
import { invalidateCacheTags } from '@/services/storage/runtime-cache';

export async function POST(req: NextRequest) {
  try {
    const caller = await getCallerSession(req);
    const isAdmin = caller.isAdmin || (await getServerAdminAuth());
    if (!isAdmin) {
      return NextResponse.json({ error: 'Chỉ Quản trị viên hệ thống mới có quyền đồng bộ đơn vị.' }, { status: 403 });
    }

    const body = await req.json();
    const oldCode = String(body.oldCode || '').trim().toUpperCase();
    const newCode = String(body.newCode || '').trim().toUpperCase();
    const oldNameVi = String(body.oldNameVi || '').trim();
    const newNameVi = String(body.newNameVi || '').trim();

    if (!oldCode || !newCode) {
      return NextResponse.json({ error: 'Mã đơn vị cũ và mới không được để trống.' }, { status: 400 });
    }

    const currentUnits = getServerUnits();
    const oldUnit = currentUnits.find((u) => u.code.toUpperCase() === oldCode);
    const existingNew = currentUnits.find((u) => u.code.toUpperCase() === newCode);

    if (oldCode !== newCode && existingNew && (Boolean(body.checkTargetExists) || (oldUnit && existingNew.immutableUnitId !== oldCode))) {
      return NextResponse.json(
        { error: `Mã đơn vị mới [${newCode}] đã tồn tại trong danh mục đang hoạt động.`, code: 'UNIT_CODE_ALREADY_EXISTS' },
        { status: 409 }
      );
    }

    // 1. Thực thi giao dịch đồng bộ phiếu công việc, phân công VTVL & quan hệ phối hợp xuống DB trước khi sửa file/cache
    const ticketStats = await migrateTicketsForUnitDetailed(oldCode, newCode, {
      newNameVi: newNameVi || oldUnit?.nameVi,
      targetUnitMeta: oldUnit ? { ...oldUnit, code: newCode, nameVi: newNameVi || oldUnit.nameVi } : undefined,
      actorEmail: caller.email,
      actorRole: caller.role,
      simulateTxFailure: Boolean(body.simulateTxFailure),
      checkTargetExists: Boolean(body.checkTargetExists)
    });

    // 2. Đồng bộ danh mục đơn vị nếu mã mới chưa được tạo trong danh mục
    if (oldCode !== newCode && oldUnit && !existingNew) {
      await upsertServerUnit(
        {
          ...oldUnit,
          code: newCode,
          immutableUnitId: oldUnit.immutableUnitId || oldCode,
          nameVi: newNameVi || oldUnit.nameVi
        },
        oldCode
      );
    }

    // 3. Đồng bộ tài khoản người dùng
    await syncAccountsFromSupabase(true);
    const accounts = getAllUserAccounts();
    let updatedAccountsCount = 0;

    for (const acc of accounts) {
      if (acc.unitCode.toUpperCase() === oldCode) {
        await upsertUserAccount({
          ...acc,
          unitCode: newCode,
          unitNameVi: newNameVi || acc.unitNameVi
        }, true);
        updatedAccountsCount++;
      }
    }

    // 4. Đồng bộ tệp hồ sơ đơn vị trên máy chủ
    await syncServerWorkbooksFromSupabase(true);
    const wb = getWorkbookById(`wb_${oldCode}_2026`);
    let updatedWorkbook = false;

    if (wb && !wb.isDeleted) {
      wb.unitId = newCode;
      if (newNameVi) wb.unitNameVi = newNameVi;
      wb.id = `wb_${newCode}_2026`;
      wb.updatedAt = new Date().toLocaleString('vi-VN');
      if (wb.data) {
        wb.data = migrateWorkbookSheets(wb.data, oldCode, newCode, oldNameVi, newNameVi);
      }
      await persistWorkbookToSupabase(wb);
      if (oldCode !== newCode) {
        await deleteWorkbookFromSupabase(oldCode);
      }
      updatedWorkbook = true;
    }

    invalidateCacheTags(['units', 'accounts', 'workbooks', 'tickets', 'overview-stats', 'unit-monitor', 'coordination']);

    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ mã ${oldCode} ➔ ${newCode} và tên đơn vị ${newNameVi}`,
      updatedAccountsCount,
      updatedWorkbook,
      updatedTicketsCount: ticketStats.migratedTickets,
      migrationStats: ticketStats
    });
  } catch (err: unknown) {
    const errObj = err as { status?: number; code?: string; message?: string };
    return NextResponse.json(
      { error: errObj?.message || 'Lỗi hệ thống khi đồng bộ mã và tên đơn vị.', code: errObj?.code || 'INTERNAL_SERVER_ERROR' },
      { status: errObj?.status || 500 }
    );
  }
}
