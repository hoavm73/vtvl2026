import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminAuth } from '@/services/storage/server-admin-auth';
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

export async function POST(req: NextRequest) {
  try {
    const isAdmin = await getServerAdminAuth();
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

    // 1. Đồng bộ tài khoản người dùng
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

    // 2. Đồng bộ tệp hồ sơ đơn vị trên máy chủ
    await syncServerWorkbooksFromSupabase();
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

    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ mã ${oldCode} ➔ ${newCode} và tên đơn vị ${newNameVi}`,
      updatedAccountsCount,
      updatedWorkbook
    });
  } catch {
    return NextResponse.json({ error: 'Lỗi hệ thống khi đồng bộ mã và tên đơn vị.' }, { status: 500 });
  }
}
