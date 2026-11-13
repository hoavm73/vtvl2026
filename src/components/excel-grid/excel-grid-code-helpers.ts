import { GenericGridRow } from './excel-grid-types';

/**
 * Tiện ích chuẩn hóa và sinh mã tự động cho Bộ biểu VTVL HCM-UTE
 * - Mã nhiệm vụ: [MÃ_ĐƠN_VỊ].NV{01..99} (ví dụ: TCNS.NV01)
 * - Mã công việc: [Mã nhiệm vụ].CV{01..99} (ví dụ: TCNS.NV01.CV01)
 */

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function formatMissionCode(unitCode: string, num: number): string {
  return `${unitCode}.NV${String(num).padStart(2, '0')}`;
}

export function formatTaskCode(missionCode: string, num: number): string {
  return `${missionCode}.CV${String(num).padStart(2, '0')}`;
}

export function cleanMissionSuffix(raw: string): string {
  if (!raw) return 'NV01';
  const match = raw.match(/NV\d+/i);
  return match ? match[0].toUpperCase() : 'NV01';
}

/**
 * Tìm mã nhiệm vụ kế tiếp [unitCode].NV{max + 1}
 */
export function getNextMissionCode(a1Rows: GenericGridRow[], unitCode: string): string {
  const prefix = `${unitCode}.NV`;
  let maxNum = 0;
  for (const r of a1Rows) {
    const val = String(r.maNhiemVu || '');
    if (val.startsWith(prefix)) {
      const numPart = parseInt(val.slice(prefix.length), 10);
      if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
    } else {
      const match = val.match(/NV(\d+)/i);
      if (match) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      }
    }
  }
  return formatMissionCode(unitCode, maxNum + 1);
}

/**
 * Tìm mã công việc kế tiếp [missionCode].CV{max + 1}
 */
export function getNextTaskCode(
  a2Rows: GenericGridRow[],
  missionCode: string,
  excludeRowId?: string
): string {
  const prefix = `${missionCode}.CV`;
  let maxNum = 0;
  for (const r of a2Rows) {
    if (excludeRowId && r.id === excludeRowId) continue;
    const taskMission = String(r.maNhiemVu || '');
    const taskCode = String(r.maCongViec || '');
    if (taskMission === missionCode || taskCode.startsWith(prefix)) {
      if (taskCode.startsWith(prefix)) {
        const numPart = parseInt(taskCode.slice(prefix.length), 10);
        if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
      } else {
        const match = taskCode.match(/CV(\d+)/i);
        if (match) {
          const numPart = parseInt(match[1], 10);
          if (!isNaN(numPart) && numPart > maxNum) maxNum = numPart;
        }
      }
    }
  }
  return formatTaskCode(missionCode, maxNum + 1);
}

/**
 * Nhân bản / tách một nhiệm vụ thành dòng mới kế thừa căn cứ và sinh mã kế tiếp
 */
export function splitMissionRow(
  targetRow: GenericGridRow,
  a1Rows: GenericGridRow[],
  unitCode: string
): { newRow: GenericGridRow; nextCode: string } {
  const nextCode = getNextMissionCode(a1Rows, unitCode);
  const newId = `a1-split-${Date.now().toString(36)}`;
  const originalName = String(targetRow.tenNhiemVu || '');
  const splitName = originalName.includes(';')
    ? originalName.split(';').slice(1).join(';').trim()
    : `${originalName} (Phần tách)`;

  const newRow: GenericGridRow = {
    id: newId,
    maNhiemVu: nextCode,
    tenNhiemVu: splitName,
    coQuan: targetRow.coQuan,
    canCu: targetRow.canCu,
    ky: targetRow.ky || '01/10/2025–30/9/2026',
    trangThai: targetRow.trangThai || 'Tiếp tục thực hiện',
    nguon: targetRow.nguon || 'QĐ 2266/QĐ-ĐHCNKT ngày 23/6/2026'
  };

  return { newRow, nextCode };
}

export { buildNewGridRow } from './excel-grid-row-templates';

export function createFiveYearForecastRows(
  sheetKey: 'DU_BAO' | 'D2',
  sheetRows: GenericGridRow[],
  rowId: string,
  selectedVtvl: string,
  extra: { countD1?: number; baseNeed?: number }
): GenericGridRow[] {
  const YEARS = ['2027', '2028', '2029', '2030', '2031'];
  const otherRows = sheetRows.filter((r) => r.id !== rowId && r.maVtvl !== selectedVtvl);
  const baseNeed = extra.baseNeed || 1;
  const countD1 = extra.countD1 || 0;
  const newFiveRows: GenericGridRow[] = YEARS.map((yr) => {
    if (sheetKey === 'DU_BAO') {
      return {
        id: `dubao-${selectedVtvl}-${yr}-${Date.now().toString(36)}`,
        maVtvl: selectedVtvl,
        nam: yr,
        bienDong: 0,
        noiDungThayDoi: `Duy trì ổn định nhân lực năm ${yr}`,
        canCuNguon: 'Chiến lược phát triển HCM-UTE 2026–2030',
        nguoiC3: baseNeed,
        nguoiCanBoTriNam: baseNeed,
        kiemTra: 'ĐẠT'
      };
    }
    return {
      id: `d2-${selectedVtvl}-${yr}-${Date.now().toString(36)}`,
      maVtvl: selectedVtvl,
      nam: yr,
      soNguoiCanBoTri: baseNeed,
      soNguoiCoTheBoTri: countD1,
      bienCheGiao: countD1,
      deNghiDieuChinh: baseNeed - countD1,
      nguonGiaiTrinh: `Phương án cân đối nhân sự năm ${yr}`,
      canhBao: 'ĐẠT',
      trangThai: 'Đang xây dựng'
    };
  });
  return [...otherRows, ...newFiveRows];
}

export function syncFiveYearVtvlSelect(
  prev: Record<string, GenericGridRow[]>,
  sheetKey: 'DU_BAO' | 'D2',
  rowId: string,
  rawValue: string,
  unitCode: string
): Record<string, GenericGridRow[]> {
  const rawCode = rawValue.trim();
  const sheetRows = prev[sheetKey] || [];
  if (!rawCode) {
    const updatedRows = sheetRows.map((r) => (r.id === rowId ? { ...r, maVtvl: '' } : r));
    return { ...prev, [sheetKey]: updatedRows };
  }
  const selectedVtvl = rawCode.includes('.') ? rawCode : `${unitCode}.${rawCode}`;
  const countD1 = (prev.D1 || []).filter((d) => d.maVtvl === selectedVtvl).length;
  const c3Match = (prev.C3 || []).find((c) => c.maVtvl === selectedVtvl);
  const baseNeed = Number(c3Match?.nguoiCanBoTri) || 1;
  const newRows = createFiveYearForecastRows(sheetKey, sheetRows, rowId, selectedVtvl, { countD1, baseNeed });
  return { ...prev, [sheetKey]: newRows };
}

export function handleSyncDeleteRow(
  prev: Record<string, GenericGridRow[]>,
  sheetKey: string,
  rowId: string
): Record<string, GenericGridRow[]> {
  const currentSheetRows = (prev[sheetKey] || []).filter((r) => r.id !== rowId);
  const next = { ...prev, [sheetKey]: currentSheetRows };

  if (sheetKey === 'A2') {
    const targetRow = (prev.A2 || []).find((r) => r.id === rowId);
    if (targetRow?.maCongViec) {
      next.B1 = (prev.B1 || []).filter((b) => b.maCongViec !== targetRow.maCongViec);
      next.B2_CT = (prev.B2_CT || []).filter((c) => c.maCongViec !== targetRow.maCongViec);
      next.B2 = (prev.B2 || []).filter((b) => b.maCongViec !== targetRow.maCongViec);
    }
  }

  if (sheetKey === 'B1') {
    const targetRow = (prev.B1 || []).find((r) => r.id === rowId);
    if (targetRow?.maCongViec) {
      next.A2 = (prev.A2 || []).filter((a) => a.maCongViec !== targetRow.maCongViec);
      next.B2_CT = (prev.B2_CT || []).filter((c) => c.maCongViec !== targetRow.maCongViec);
      next.B2 = (prev.B2 || []).filter((b) => b.maCongViec !== targetRow.maCongViec);
    }
  }

  if (sheetKey === 'B2') {
    const targetRow = (prev.B2 || []).find((r) => r.id === rowId);
    if (targetRow?.maCongViec) {
      next.B2_CT = (prev.B2_CT || []).filter((c) => c.maCongViec !== targetRow.maCongViec);
    }
  }

  if (sheetKey === 'C1') {
    const targetRow = (prev.C1 || []).find((r) => r.id === rowId);
    if (targetRow?.maVtvl) {
      next.C2 = (prev.C2 || []).filter((c) => c.maVtvl !== targetRow.maVtvl);
      next.C3 = (prev.C3 || []).filter((c) => c.maVtvl !== targetRow.maVtvl);
      next.DU_BAO = (prev.DU_BAO || []).filter((db) => db.maVtvl !== targetRow.maVtvl);
      next.D2 = (prev.D2 || []).filter((d) => d.maVtvl !== targetRow.maVtvl);
    }
  }

  return next;
}

