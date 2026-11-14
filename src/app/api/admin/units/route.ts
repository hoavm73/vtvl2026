import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminAuth } from '@/services/storage/server-admin-auth';
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
import { migrateTicketsForUnit } from '@/services/storage/server-ticket-store';

export async function GET() {
  const units = await syncUnitsFromSupabase();
  return NextResponse.json({ units });
}

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await getServerAdminAuth();
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

    const { units, oldUnit } = await upsertServerUnit(unit, originalCode);
    const oldNameVi = oldUnit?.nameVi || newNameVi;

    // Nếu mã hoặc tên thay đổi: Đồng bộ dữ liệu toàn hệ thống
    let migratedAccounts = 0;
    let migratedWorkbook = false;
    let migratedTickets = 0;

    if (normOldCode !== normNewCode || oldNameVi !== newNameVi) {
      // 1. Đồng bộ tài khoản
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

      // 2. Đồng bộ bảng tính 15 biểu
      await syncServerWorkbooksFromSupabase();
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

      // 3. Đồng bộ phiếu công việc
      migratedTickets = migrateTicketsForUnit(normOldCode, normNewCode);
    }

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
  } catch {
    return NextResponse.json({ error: 'Lỗi máy chủ khi cập nhật đơn vị.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const isAdmin = await getServerAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Chỉ Quản trị viên mới có quyền xóa đơn vị.' }, { status: 403 });
    }
    const code = req.nextUrl.searchParams.get('code') || '';
    if (!code) {
      return NextResponse.json({ error: 'Thiếu mã đơn vị cần xóa.' }, { status: 400 });
    }
    const units = await deleteServerUnit(code);
    return NextResponse.json({ success: true, units });
  } catch {
    return NextResponse.json({ error: 'Lỗi máy chủ khi xóa đơn vị.' }, { status: 500 });
  }
}

export async function PUT() {
  try {
    const isAdmin = await getServerAdminAuth();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Chỉ Quản trị viên mới có quyền khôi phục danh mục.' }, { status: 403 });
    }
    const units = await resetServerUnits();
    return NextResponse.json({ success: true, units });
  } catch {
    return NextResponse.json({ error: 'Lỗi máy chủ khi khôi phục danh mục.' }, { status: 500 });
  }
}
