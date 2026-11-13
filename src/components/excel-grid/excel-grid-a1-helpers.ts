/**
 * src/components/excel-grid/excel-grid-a1-helpers.ts
 * Nghiệp vụ chuyên sâu cho Biểu 1. A1_NhiemVu:
 * - Kiểm tra trùng mã nhiệm vụ
 * - Kiểm tra khóa ngoại khi xóa (chặn xóa nếu có công việc A2 liên kết)
 * - Tách / nhân bản nhiệm vụ kèm sinh mã tự động
 * - Tạo bản ghi nhật ký 10 cột chuẩn cho 15. S_NhatKy
 */

import { GenericGridRow } from './excel-grid-types';
import { getNextMissionCode, splitMissionRow } from './excel-grid-code-helpers';
import { findPl1Item, getPl1CareerLevel } from '@/configs/hcmute-pl1-builder';

export function isMissionCodeDuplicate(
  a1Rows: GenericGridRow[],
  rowId: string,
  newCode: string
): boolean {
  const norm = newCode.trim().toUpperCase();
  if (!norm) return false;
  return a1Rows.some((r) => r.id !== rowId && String(r.maNhiemVu || '').trim().toUpperCase() === norm);
}

export function canDeleteMission(
  a1Rows: GenericGridRow[],
  a2Rows: GenericGridRow[],
  rowId: string
): { canDelete: boolean; message?: string; missionCode?: string } {
  const target = a1Rows.find((r) => r.id === rowId);
  const missionCode = String(target?.maNhiemVu || '').trim();
  if (!missionCode) return { canDelete: true };

  const linkedTasks = (a2Rows || []).filter(
    (t) => String(t.maNhiemVu || '').trim().toUpperCase() === missionCode.toUpperCase()
  );

  if (linkedTasks.length > 0) {
    return {
      canDelete: false,
      missionCode,
      message: `Nhiệm vụ này đã có ${linkedTasks.length} công việc liên kết ở Biểu A2. Vui lòng xóa/chuyển công việc ở A2 trước hoặc đổi trạng thái sang "Không còn thực hiện".`
    };
  }

  return { canDelete: true, missionCode };
}

export function performSplitMission(
  a1Rows: GenericGridRow[],
  targetRowId: string,
  unitCode: string
): { nextRows: GenericGridRow[]; newRow: GenericGridRow; nextCode: string } | null {
  const targetIdx = a1Rows.findIndex((r) => r.id === targetRowId);
  if (targetIdx === -1) return null;

  const targetRow = a1Rows[targetIdx];
  const { newRow, nextCode } = splitMissionRow(targetRow, a1Rows, unitCode);
  const nextRows = [...a1Rows];
  nextRows.splice(targetIdx + 1, 0, newRow);

  return { nextRows, newRow, nextCode };
}

export function buildAuditLogEntry(params: {
  ky?: string;
  bieu: string;
  ma: string;
  truong: string;
  giaTriCu?: string;
  giaTriMoi: string;
  nguon?: string;
  nguoiXacNhan: string;
  versionCount?: number;
}): GenericGridRow {
  const today = new Date();
  const d = String(today.getDate()).padStart(2, '0');
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const y = today.getFullYear();
  const dateStr = `${d}/${m}/${y}`;
  const vNum = (params.versionCount || 0) + 1;

  return {
    id: `s-log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    ky: params.ky || '01/10/2025–30/9/2026',
    bieu: params.bieu,
    ma: params.ma,
    truong: params.truong,
    giaTriCu: params.giaTriCu || '(Trống)',
    giaTriMoi: params.giaTriMoi,
    nguon: params.nguon || 'QĐ 2266/QĐ-ĐHCNKT ngày 23/6/2026',
    nguoiXacNhan: params.nguoiXacNhan,
    ngay: dateStr,
    phienBan: `v1.${vNum}`
  };
}

export function syncA1MissionChange(
  prevData: Record<string, GenericGridRow[]>,
  rowId: string,
  newMission: string
): { updatedA1: GenericGridRow[]; syncedA2?: GenericGridRow[] } {
  const sheetRows = prevData.A1 || [];
  const oldRow = sheetRows.find((r) => r.id === rowId);
  const oldMission = String(oldRow?.maNhiemVu || '');
  const updatedA1 = sheetRows.map((row) => (row.id === rowId ? { ...row, maNhiemVu: newMission } : row));

  if (oldMission && newMission && oldMission !== newMission && prevData.A2) {
    const syncedA2 = prevData.A2.map((t) => {
      if (String(t.maNhiemVu) === oldMission) {
        const oldTaskCode = String(t.maCongViec || '');
        const match = oldTaskCode.match(/CV\d+/i);
        const suffix = match ? match[0] : 'CV01';
        return { ...t, maNhiemVu: newMission, maCongViec: `${newMission}.${suffix}` };
      }
      return t;
    });
    return { updatedA1, syncedA2 };
  }
  return { updatedA1 };
}

export function syncC1VtvlChange(
  prevData: Record<string, GenericGridRow[]>,
  rowId: string,
  newVtvl: string
): { updatedC1: GenericGridRow[]; updatedC2: GenericGridRow[] } {
  const sheetRows = prevData.C1 || [];
  const pl1Item = findPl1Item(newVtvl);
  const isQl = pl1Item?.pl1Code.startsWith('QL') ?? newVtvl.includes('QL');
  const oldRow = sheetRows.find((r) => r.id === rowId);
  const oldVtvl = String(oldRow?.maVtvl || '');
  const posName = pl1Item ? (pl1Item.positionName || pl1Item.titleOrRole) : '';
  const updatedC1 = sheetRows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          maVtvl: newVtvl,
          tenVtvl: posName || row.tenVtvl || '',
          canCuQuyGio: isQl ? 'PP1 – theo cơ cấu và chức danh quản lý' : 'Mức chung 1.904 giờ – quy định về thời giờ làm việc'
        }
      : row
  );
  const existingC2 = prevData.C2 || [];
  const updatedC2 = existingC2.map((c2) =>
    String(c2.maVtvl) === oldVtvl
      ? {
          ...c2,
          maVtvl: newVtvl,
          tenVtvl: posName || c2.tenVtvl || '',
          bacNgheNghiep: getPl1CareerLevel(newVtvl)
        }
      : c2
  );
  return { updatedC1, updatedC2 };
}

