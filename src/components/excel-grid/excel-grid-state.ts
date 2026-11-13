import { useState, useCallback, useMemo, useEffect } from 'react';
import { ExcelSheetKey, GenericGridRow, SheetOrderMode, EXCEL_NATURAL_SHEET_ORDER, TECHNICAL_DEPENDENCY_ORDER, ADMIN_ONLY_SHEETS } from './excel-grid-types';
import { buildDefaultGridWorkbook } from './excel-grid-defaults';
import { recalculateGridFormulas } from './excel-grid-formulas';
import { getNextMissionCode, getNextTaskCode, buildNewGridRow, handleSyncDeleteRow, createFiveYearD2Rows } from './excel-grid-code-helpers';
import { isMissionCodeDuplicate, canDeleteMission, performSplitMission, buildAuditLogEntry, syncA1MissionChange, syncC1VtvlChange } from './excel-grid-a1-helpers';
import { buildFullPl1C1Rows, buildFullPl1C2Rows, buildRecommendedC1Rows } from '@/configs/hcmute-pl1-builder';
import { PL1_VTVL_CATALOG } from '@/configs/hcmute-pl1-catalog';
import { HCMUTE_UNITS, findHcmuteUnit } from '@/configs/hcmute-units';
import { exportUserWorkbookToExcel } from '@/services/excel-export/user-workbook-exporter';
import { UnitGroupKind } from '@/types/vtvl';
import { useC1AdminLock } from './useC1AdminLock';

function getInitialUnitCode(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const cur = localStorage.getItem('hcmute_vtvl_current_operator_v1');
    return cur ? (JSON.parse(cur)?.unitCode || fallback) : fallback;
  } catch { return fallback; }
}

export function useExcelGridState(initialUnitCode = 'TCNS', isAdmin = false) {
  const [unitCode, setUnitCode] = useState(() => getInitialUnitCode(initialUnitCode));
  const [orderMode, setOrderMode] = useState<SheetOrderMode>('excel');
  const [activeSheet, setActiveSheet] = useState<ExcelSheetKey>('A1');
  const { isC1Unlocked, unlockC1, lockC1 } = useC1AdminLock();
  const [data, setData] = useState<Record<ExcelSheetKey, GenericGridRow[]>>(() => {
    const code = getInitialUnitCode(initialUnitCode);
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`hcmute_vtvl_grid_${code}`);
        if (stored) return JSON.parse(stored);
      } catch { /* ignore */ }
    }
    return buildDefaultGridWorkbook(code);
  });
  const [lastSaved, setLastSaved] = useState<string>('');
  const [lastSavedSheet, setLastSavedSheet] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const currentUnit = findHcmuteUnit(unitCode);

  const handleUnitChange = useCallback((newUnitCode: string) => {
    setUnitCode(newUnitCode);
    let fresh = buildDefaultGridWorkbook(newUnitCode);
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`hcmute_vtvl_grid_${newUnitCode}`);
        if (stored) fresh = JSON.parse(stored);
      } catch { /* ignore */ }
    }
    setData(fresh);
    setActiveSheet('A1');
  }, []);

  const handleLoadTcnsData = useCallback(() => {
    setUnitCode('TCNS');
    const tcnsData = buildDefaultGridWorkbook('TCNS');
    setData(tcnsData);
    setActiveSheet('A1');
    if (typeof window !== 'undefined') {
      localStorage.setItem('hcmute_vtvl_grid_TCNS', JSON.stringify(tcnsData));
    }
  }, []);

  const restoreWorkbookData = useCallback((restoredData: Record<ExcelSheetKey, GenericGridRow[]>, newUnitCode?: string) => {
    if (newUnitCode) setUnitCode(newUnitCode);
    setData(restoredData);
    setActiveSheet('A1');
  }, []);

  const updateCell = useCallback((sheetKey: ExcelSheetKey, rowId: string, field: string, value: string | number) => {
    if (sheetKey === 'C1' && !isC1Unlocked) return;
    setData((prev) => {
      const sheetRows = prev[sheetKey] || [];

      // 1. Khi đổi mã nhiệm vụ ở A1 -> kiểm tra chống trùng và đồng bộ sang A2
      if (sheetKey === 'A1' && field === 'maNhiemVu') {
        const newMission = String(value).trim();
        if (isMissionCodeDuplicate(sheetRows, rowId, newMission)) {
          alert(`Mã nhiệm vụ "${newMission}" đã tồn tại trong danh mục A1. Vui lòng nhập mã duy nhất.`);
          return prev;
        }
        const { updatedA1, syncedA2 } = syncA1MissionChange(prev, rowId, newMission);
        return recalculateGridFormulas({ ...prev, A1: updatedA1, ...(syncedA2 ? { A2: syncedA2 } : {}) }, currentUnit.code, currentUnit.nameVi);
      }

      // 2. Khi đổi mã nhiệm vụ ở A2 -> tự động sinh lại mã công việc theo nhiệm vụ mới
      if (sheetKey === 'A2' && field === 'maNhiemVu') {
        const newMission = String(value);
        const nextTaskCode = getNextTaskCode(sheetRows, newMission, rowId);
        const updatedRows = sheetRows.map((row) =>
          row.id === rowId ? { ...row, maNhiemVu: newMission, maCongViec: nextTaskCode } : row
        );
        return recalculateGridFormulas({ ...prev, A2: updatedRows }, currentUnit.code, currentUnit.nameVi);
      }

      // 3. Khi chọn mã VTVL ở C1 -> gán mã đơn vị phía trước và tự động điền Tên VTVL từ danh mục trường
      if (sheetKey === 'C1' && field === 'maVtvl') {
        const rawCode = String(value).trim().toUpperCase();
        if (!rawCode) {
          const updatedRows = sheetRows.map((r) => (r.id === rowId ? { ...r, maVtvl: '', tenVtvl: '' } : r));
          return recalculateGridFormulas({ ...prev, C1: updatedRows }, currentUnit.code, currentUnit.nameVi);
        }
        const finalVtvl = rawCode.includes('.') ? rawCode : `${currentUnit.code}.${rawCode}`;
        const { updatedC1, updatedC2 } = syncC1VtvlChange(prev, rowId, finalVtvl);
        return recalculateGridFormulas({ ...prev, C1: updatedC1, C2: updatedC2 }, currentUnit.code, currentUnit.nameVi);
      }

      // 4. Khi chọn mã công việc ở B2_CT -> tự tra cứu mã VTVL từ A2
      if (sheetKey === 'B2_CT' && field === 'maCongViec') {
        const taskCode = String(value);
        const a2Item = (prev.A2 || []).find((a) => a.maCongViec === taskCode);
        const vCode = a2Item?.maVtvl || '';
        const updatedRows = sheetRows.map((row) =>
          row.id === rowId ? { ...row, maCongViec: taskCode, maVtvl: vCode } : row
        );
        return recalculateGridFormulas({ ...prev, B2_CT: updatedRows }, currentUnit.code, currentUnit.nameVi);
      }

      // 5. Khi chọn Mã VTVL ở Biểu D2 -> tự động sinh 5 hàng tương ứng 5 năm 2027–2031
      if (sheetKey === 'D2' && field === 'maVtvl') {
        const rawCode = String(value).trim();
        if (!rawCode) {
          const updatedRows = sheetRows.map((r) => (r.id === rowId ? { ...r, maVtvl: '' } : r));
          return recalculateGridFormulas({ ...prev, D2: updatedRows }, currentUnit.code, currentUnit.nameVi);
        }
        const selectedVtvl = rawCode.includes('.') ? rawCode : `${currentUnit.code}.${rawCode}`;
        const countD1 = (prev.D1 || []).filter((d) => d.maVtvl === selectedVtvl).length;
        const c3Match = (prev.C3 || []).find((c) => c.maVtvl === selectedVtvl);
        const baseNeed = Number(c3Match?.nguoiCanBoTri) || 1;
        const updatedD2 = createFiveYearD2Rows(sheetRows, rowId, selectedVtvl, countD1, baseNeed);
        return recalculateGridFormulas({ ...prev, D2: updatedD2 }, currentUnit.code, currentUnit.nameVi);
      }

      const updatedRows = sheetRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row));
      return recalculateGridFormulas({ ...prev, [sheetKey]: updatedRows }, currentUnit.code, currentUnit.nameVi);
    });
  }, [currentUnit.code, currentUnit.nameVi]);

  const addRow = useCallback((sheetKey: ExcelSheetKey) => {
    setData((prev) => {
      const sheetRows = prev[sheetKey] || [];
      const { newRow, extraC2Row } = buildNewGridRow(sheetKey, prev, currentUnit);

      if (sheetKey === 'C1') {
        const nextC1 = [...sheetRows, newRow];
        const nextC2 = extraC2Row ? [...(prev.C2 || []), extraC2Row] : prev.C2;
        return recalculateGridFormulas({ ...prev, C1: nextC1, C2: nextC2 }, currentUnit.code, currentUnit.nameVi);
      }

      if (sheetKey === 'B2') {
        const nextB2Ct = [...(prev.B2_CT || []), { ...newRow, id: `b2ct-${Date.now().toString(36)}` }];
        return recalculateGridFormulas({ ...prev, B2_CT: nextB2Ct }, currentUnit.code, currentUnit.nameVi);
      }

      return recalculateGridFormulas({ ...prev, [sheetKey]: [...sheetRows, newRow] }, currentUnit.code, currentUnit.nameVi);
    });
  }, [currentUnit.code, currentUnit.nameVi]);

  const deleteRow = useCallback((sheetKey: ExcelSheetKey, rowId: string) => {
    if (sheetKey === 'A1') {
      const check = canDeleteMission(data.A1 || [], data.A2 || [], rowId);
      if (!check.canDelete) {
        alert(check.message);
        return;
      }
    }
    setData((prev) => {
      const nextData = handleSyncDeleteRow(prev, sheetKey, rowId);
      return recalculateGridFormulas(nextData, currentUnit.code, currentUnit.nameVi);
    });
  }, [currentUnit.code, currentUnit.nameVi, data.A1, data.A2]);

  const splitRow = useCallback((sheetKey: ExcelSheetKey, rowId: string) => {
    if (sheetKey !== 'A1') return;
    setData((prev) => {
      const res = performSplitMission(prev.A1 || [], rowId, currentUnit.code);
      if (!res) return prev;
      const { nextRows, newRow, nextCode } = res;
      const targetRow = (prev.A1 || []).find((r) => r.id === rowId);
      const audit = buildAuditLogEntry({
        bieu: '1. A1_NhiemVu',
        ma: nextCode,
        truong: 'Tách nhiệm vụ',
        giaTriCu: `Tách từ ${targetRow?.maNhiemVu || ''}`,
        giaTriMoi: `${nextCode}: ${newRow.tenNhiemVu}`,
        nguon: String(targetRow?.canCu || 'QĐ 2266'),
        nguoiXacNhan: `Tổ công tác [${currentUnit.code}]`,
        versionCount: prev.S?.length || 0
      });
      return recalculateGridFormulas({ ...prev, A1: nextRows, S: [audit, ...(prev.S || [])] }, currentUnit.code, currentUnit.nameVi);
    });
  }, [currentUnit.code, currentUnit.nameVi]);

  const saveSheetData = useCallback((sheetKey: ExcelSheetKey) => {
    const timeStr = new Date().toLocaleTimeString('vi-VN');
    setData((prev) => {
      const synced = recalculateGridFormulas(prev, currentUnit.code, currentUnit.nameVi);
      const logEntry = buildAuditLogEntry({
        bieu: sheetKey === 'A1' ? '1. A1_NhiemVu' : `Biểu ${sheetKey}`,
        ma: currentUnit.code,
        truong: 'Lưu dữ liệu biểu',
        giaTriCu: 'Bản lưu trước',
        giaTriMoi: `Lưu cập nhật biểu ${sheetKey} lúc ${timeStr}`,
        nguon: 'QĐ 2266/QĐ-ĐHCNKT',
        nguoiXacNhan: `Tổ công tác VTVL [${currentUnit.code}]`,
        versionCount: prev.S?.length || 0
      });
      synced.S = [logEntry, ...(synced.S || []).slice(0, 49)];
      if (typeof window !== 'undefined') localStorage.setItem(`hcmute_vtvl_grid_${currentUnit.code}`, JSON.stringify(synced));
      return synced;
    });
    setLastSaved(timeStr);
    setLastSavedSheet(sheetKey);
    return timeStr;
  }, [currentUnit.code, currentUnit.nameVi]);

  const currentSheetOrder = useMemo(() => {
    const rawOrder = orderMode === 'technical' ? TECHNICAL_DEPENDENCY_ORDER : EXCEL_NATURAL_SHEET_ORDER;
    return isAdmin ? rawOrder : rawOrder.filter((key) => !ADMIN_ONLY_SHEETS.has(key));
  }, [orderMode, isAdmin]);

  useEffect(() => {
    if (!isAdmin && ADMIN_ONLY_SHEETS.has(activeSheet)) setActiveSheet('A1');
  }, [isAdmin, activeSheet]);

  const activeSheetIndex = currentSheetOrder.indexOf(activeSheet);
  const goToNextSheet = useCallback(() => {
    if (activeSheetIndex < currentSheetOrder.length - 1) setActiveSheet(currentSheetOrder[activeSheetIndex + 1]);
  }, [activeSheetIndex, currentSheetOrder]);

  const goToPrevSheet = useCallback(() => {
    if (activeSheetIndex > 0) setActiveSheet(currentSheetOrder[activeSheetIndex - 1]);
  }, [activeSheetIndex, currentSheetOrder]);

  const saveAndGoNext = useCallback(() => {
    saveSheetData(activeSheet);
    goToNextSheet();
  }, [saveSheetData, activeSheet, goToNextSheet]);

  const dynamicOptionsMap = useMemo(() => ({
    vtvlList: Array.from(new Set((data.C1 || []).map((r) => String(r.maVtvl || '')).filter(Boolean))),
    missionList: Array.from(new Set((data.A1 || []).map((r) => String(r.maNhiemVu || '')).filter(Boolean))),
    taskList: Array.from(new Set((data.A2 || []).map((r) => String(r.maCongViec || '')).filter(Boolean))),
    productList: Array.from(new Set((data.DM_SP || []).map((r) => String(r.maSpChuan || '')).filter(Boolean))),
    pl1VtvlList: PL1_VTVL_CATALOG.map((item) => ({
      value: item.pl1Code,
      label: `${item.pl1Code} – ${item.positionName}`
    }))
  }), [data.C1, data.A1, data.A2, data.DM_SP]);

  const loadFullPl1Catalog = useCallback(() => {
    setData((prev) => {
      const fullC1 = buildFullPl1C1Rows(currentUnit.code);
      return recalculateGridFormulas({ ...prev, C1: fullC1, C2: buildFullPl1C2Rows(fullC1) }, currentUnit.code, currentUnit.nameVi);
    });
  }, [currentUnit.code, currentUnit.nameVi]);

  const loadRecommendedVtvls = useCallback(() => {
    setData((prev) => {
      const recC1 = buildRecommendedC1Rows(currentUnit.code, currentUnit.group);
      return recalculateGridFormulas({ ...prev, C1: recC1, C2: buildFullPl1C2Rows(recC1) }, currentUnit.code, currentUnit.nameVi);
    });
  }, [currentUnit.code, currentUnit.nameVi, currentUnit.group]);

  const exportFullWorkbook = useCallback(async () => {
    setIsExporting(true);
    try {
      exportUserWorkbookToExcel({
        unitCode: currentUnit.code,
        unitNameVi: currentUnit.nameVi,
        reportingPeriod: '01/10/2025–30/9/2026',
        data
      });
    } catch {
      alert('Không thể tạo file Excel từ dữ liệu đang điền, vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  }, [currentUnit, data]);

  return {
    unitCode, currentUnit, orderMode, setOrderMode, currentSheetOrder, activeSheet, activeSheetIndex,
    data, lastSaved, lastSavedSheet, isExporting, dynamicOptionsMap, isC1Unlocked, unlockC1, lockC1,
    handleUnitChange, handleLoadTcnsData, restoreWorkbookData, loadFullPl1Catalog, loadRecommendedVtvls,
    setActiveSheet, updateCell, addRow, splitRow, deleteRow, saveSheetData, saveAndGoNext,
    exportFullWorkbook, goToNextSheet, goToPrevSheet
  };
}
