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

export function buildNewGridRow(
  sheetKey: string,
  prevData: Record<string, GenericGridRow[]>,
  currentUnit: { code: string; nameVi: string }
): { newRow: GenericGridRow; extraC2Row?: GenericGridRow } {
  const sheetRows = prevData[sheetKey] || [];
  const newId = `${sheetKey.toLowerCase()}-${Date.now().toString(36)}`;

  if (sheetKey === 'A1') {
    const nextCode = getNextMissionCode(sheetRows, currentUnit.code);
    return {
      newRow: {
        id: newId,
        maNhiemVu: nextCode,
        tenNhiemVu: '',
        coQuan: currentUnit.nameVi,
        canCu: '',
        ky: '01/10/2025–30/9/2026',
        trangThai: 'Tiếp tục thực hiện',
        nguon: ''
      }
    };
  }

  if (sheetKey === 'A2') {
    const existingA2 = prevData.A2 || [];
    const lastRow = existingA2[existingA2.length - 1];
    const targetMission =
      (lastRow?.maNhiemVu as string) ||
      (prevData.A1 && (prevData.A1[0]?.maNhiemVu as string)) ||
      `${currentUnit.code}.NV01`;
    const nextTaskCode = getNextTaskCode(existingA2, targetMission);
    return {
      newRow: {
        id: newId,
        maCongViec: nextTaskCode,
        maNhiemVu: targetMission,
        maVtvl: '',
        tenCongViec: '',
        sanPham: '',
        dvt: '',
        chatLuong: '',
        canCu: ''
      }
    };
  }

  return { newRow: { id: newId } };
}

