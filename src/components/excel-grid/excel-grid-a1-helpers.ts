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
import { createC2RowFromPl1, findPl1Item, getPl1CareerLevel } from '@/configs/hcmute-pl1-builder';

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

export function resolveUniqueC1Code(
  c1Rows: GenericGridRow[],
  rowId: string,
  unitCode: string,
  rawCode: string
): string {
  const cleanRaw = rawCode.trim().toUpperCase().replace(/\s+/g, '_');
  const cleanUnit = unitCode.trim().toUpperCase();
  const suffix = cleanRaw.includes('.') ? cleanRaw.slice(cleanRaw.indexOf('.') + 1).trim() : cleanRaw;
  const baseCode = suffix ? `${cleanUnit}.${suffix}` : `${cleanUnit}.VT01`;
  const taken = new Set(
    c1Rows
      .filter((r) => r.id !== rowId && String(r.maVtvl || '').trim())
      .map((r) => String(r.maVtvl || '').trim().toUpperCase())
  );
  if (!taken.has(baseCode)) return baseCode;
  const stem = baseCode.replace(/-\d+$/, '');
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${stem}-${String(i).padStart(2, '0')}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now().toString(36).toUpperCase()}`;
}

export function getNextCustomVtvlCode(
  c1Rows: GenericGridRow[],
  rowId: string,
  unitCode: string
): string {
  const cleanUnit = unitCode.trim().toUpperCase();
  const taken = new Set(
    c1Rows
      .filter((r) => r.id !== rowId && String(r.maVtvl || '').trim())
      .map((r) => String(r.maVtvl || '').trim().toUpperCase())
  );
  for (let i = 1; i < 100; i += 1) {
    const candidate = `${cleanUnit}.VT${String(i).padStart(2, '0')}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${cleanUnit}.VT${Date.now().toString(36).toUpperCase()}`;
}

export function syncC1VtvlChange(
  prevData: Record<string, GenericGridRow[]>,
  rowId: string,
  rawCodeOrPrefixed: string,
  unitCode = ''
): Record<string, GenericGridRow[]> {
  const sheetRows = prevData.C1 || [];
  const oldRow = sheetRows.find((r) => r.id === rowId);
  const oldVtvl = String(oldRow?.maVtvl || '').trim();
  const rawTrimmed = String(rawCodeOrPrefixed || '').trim().toUpperCase();
  if (!rawTrimmed) {
    return { ...prevData, C1: sheetRows.map((r) => (r.id === rowId ? { ...r, maVtvl: '', tenVtvl: '' } : r)) };
  }

  const effectiveUnit = unitCode || (oldVtvl.includes('.') ? oldVtvl.split('.')[0] : 'TCNS');
  const newVtvl = resolveUniqueC1Code(sheetRows, rowId, effectiveUnit, rawTrimmed);
  const pl1Item = findPl1Item(newVtvl);
  const isQl = pl1Item?.pl1Code.startsWith('QL') ?? newVtvl.includes('.QL');
  const resolvedName = pl1Item ? (pl1Item.titleOrRole || pl1Item.positionName) : '';
  const resolvedGroup = pl1Item?.vtvlGroup4 || '';
  const resolvedRank = pl1Item?.tt31OrNgachCode || '';

  const updatedC1 = sheetRows.map((row) =>
    row.id === rowId
      ? {
          ...row,
          maVtvl: newVtvl,
          tenVtvl: resolvedName,
          tenKhung: resolvedName,
          nhomVtvl4: resolvedGroup || row.nhomVtvl4 || '',
          maNgach: resolvedRank || row.maNgach || '',
          canCuQuyGio: isQl ? 'PP1 – theo cơ cấu và chức danh quản lý' : 'Mức chung 1.904 giờ – quy định về thời giờ làm việc'
        }
      : row
  );
  const nextRow = updatedC1.find((row) => row.id === rowId);

  const existingC2 = prevData.C2 || [];
  const oldUpper = oldVtvl.toUpperCase();
  const hasMatchingC2 = Boolean(oldVtvl) && existingC2.some((c2) => String(c2.maVtvl || '').trim().toUpperCase() === oldUpper);
  let updatedC2 = hasMatchingC2
    ? existingC2.map((c2) =>
        String(c2.maVtvl || '').trim().toUpperCase() === oldUpper
          ? { ...c2, maVtvl: newVtvl, tenVtvl: resolvedName || c2.tenVtvl || '', bacNgheNghiep: getPl1CareerLevel(newVtvl) }
          : c2
      )
    : existingC2;
  if (nextRow && !updatedC2.some((c2) => String(c2.maVtvl || '').trim().toUpperCase() === newVtvl.toUpperCase())) {
    updatedC2 = [...updatedC2, createC2RowFromPl1(nextRow, updatedC2.length)];
  }

  const remapCode = (rows?: GenericGridRow[], skipTicketRows = false) =>
    oldVtvl && oldUpper !== newVtvl.toUpperCase() && Array.isArray(rows)
      ? rows.map((r) => {
          if (skipTicketRows && r.sourceTicketId) return r;
          return String(r.maVtvl || '').trim().toUpperCase() === oldUpper ? { ...r, maVtvl: newVtvl } : r;
        })
      : rows;

  return {
    ...prevData,
    C1: updatedC1,
    C2: updatedC2,
    ...(prevData.A2 ? { A2: remapCode(prevData.A2, true) } : {}),
    ...(prevData.C3 ? { C3: remapCode(prevData.C3) } : {}),
    ...(prevData.D1 ? { D1: remapCode(prevData.D1) } : {}),
    ...(prevData.DU_BAO ? { DU_BAO: remapCode(prevData.DU_BAO) } : {}),
    ...(prevData.D2 ? { D2: remapCode(prevData.D2) } : {})
  };
}

export function syncC1NameChange(
  prevData: Record<string, GenericGridRow[]>,
  rowId: string,
  newName: string,
  unitCode: string
): Record<string, GenericGridRow[]> {
  const sheetRows = prevData.C1 || [];
  const targetRow = sheetRows.find((r) => r.id === rowId);
  if (!targetRow) return prevData;
  const existingCode = String(targetRow.maVtvl || '').trim();
  const resolvedCode = existingCode || (newName.trim() ? getNextCustomVtvlCode(sheetRows, rowId, unitCode) : '');
  const updatedC1 = sheetRows.map((row) =>
    row.id === rowId ? { ...row, maVtvl: resolvedCode, tenVtvl: newName } : row
  );
  const nextRow = updatedC1.find((row) => row.id === rowId);
  const existingC2 = prevData.C2 || [];
  const codeUpper = resolvedCode.toUpperCase();
  let updatedC2 = existingC2.map((c2) =>
    codeUpper && String(c2.maVtvl || '').trim().toUpperCase() === codeUpper ? { ...c2, tenVtvl: newName } : c2
  );
  if (resolvedCode && nextRow && !updatedC2.some((c2) => String(c2.maVtvl || '').trim().toUpperCase() === codeUpper)) {
    updatedC2 = [...updatedC2, createC2RowFromPl1(nextRow, updatedC2.length)];
  }
  return { ...prevData, C1: updatedC1, C2: updatedC2 };
}

