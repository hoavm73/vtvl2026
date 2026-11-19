import { useState, useCallback, useMemo, useEffect } from 'react';
import { ExcelSheetKey, GenericGridRow, SheetOrderMode, EXCEL_NATURAL_SHEET_ORDER, TECHNICAL_DEPENDENCY_ORDER, ADMIN_ONLY_SHEETS } from './excel-grid-types';
import { buildDefaultGridWorkbook } from './excel-grid-defaults';
import { recalculateGridFormulas } from './excel-grid-formulas';
import { getNextMissionCode, getNextTaskCode, buildNewGridRow, handleSyncDeleteRow, syncFiveYearVtvlSelect } from './excel-grid-code-helpers';
import { isMissionCodeDuplicate, performSplitMission, buildAuditLogEntry, syncA1MissionChange, syncC1VtvlChange, syncC1NameChange } from './excel-grid-a1-helpers';
import { validateRowDeletion } from './excel-grid-delete-guards';
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

export function useExcelGridState(initialUnitCode = 'TCNS', isAdmin = false, initialSheet?: ExcelSheetKey, hasExplicitUnit = false) {
  const [unitCode, setUnitCode] = useState(initialUnitCode);
  const [orderMode, setOrderMode] = useState<SheetOrderMode>('excel');
  const [activeSheet, setActiveSheet] = useState<ExcelSheetKey>(initialSheet || 'A1');

  useEffect(() => {
    if (initialSheet && (isAdmin || !ADMIN_ONLY_SHEETS.has(initialSheet))) {
      setActiveSheet(initialSheet);
    }
  }, [initialSheet, isAdmin]);
  const { isC1Unlocked, unlockC1, lockC1 } = useC1AdminLock();
  const [data, setData] = useState<Record<ExcelSheetKey, GenericGridRow[]>>(() => buildDefaultGridWorkbook(initialUnitCode));
  useEffect(() => {
    const code = hasExplicitUnit ? findHcmuteUnit(initialUnitCode).code : getInitialUnitCode(initialUnitCode);
    setUnitCode(code);
    try {
      const stored = localStorage.getItem(`hcmute_vtvl_grid_${code}`);
      if (stored) { setData(JSON.parse(stored)); return; }
    } catch { /* ignore */ }
    if (code !== initialUnitCode) setData(buildDefaultGridWorkbook(code));
  }, [initialUnitCode, hasExplicitUnit]);
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
  }, []);

  useEffect(() => {
    const handleGridSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const { oldCode, newCode, updatedData } = detail;
      if (unitCode.toUpperCase() === String(oldCode).toUpperCase()) {
        setUnitCode(newCode);
        if (updatedData) setData(updatedData);
        else handleUnitChange(newCode);
      }
    };
    const handleUnitsUpdated = () => {
      const updatedUnit = findHcmuteUnit(unitCode);
      setData((prev) => recalculateGridFormulas(prev, updatedUnit.code, updatedUnit.nameVi));
    };
    window.addEventListener('vtvl-grid-sync', handleGridSync);
    window.addEventListener('vtvl-units-updated', handleUnitsUpdated);
    return () => {
      window.removeEventListener('vtvl-grid-sync', handleGridSync);
      window.removeEventListener('vtvl-units-updated', handleUnitsUpdated);
    };
  }, [unitCode, handleUnitChange]);

  const handleLoadTcnsData = useCallback(() => {
    setUnitCode('TCNS');
    const tcnsData = buildDefaultGridWorkbook('TCNS');
    setData(tcnsData);
    setActiveSheet('A1');
    if (typeof window !== 'undefined') localStorage.setItem('hcmute_vtvl_grid_TCNS', JSON.stringify(tcnsData));
  }, []);

  const restoreWorkbookData = useCallback((restoredData: Record<ExcelSheetKey, GenericGridRow[]>, newUnitCode?: string, resetSheet = false) => {
    if (newUnitCode) setUnitCode(newUnitCode);
    setData(restoredData);
    if (resetSheet) setActiveSheet('A1');
  }, []);

  const updateCell = useCallback((sheetKey: ExcelSheetKey, rowId: string, field: string, value: string | number) => {
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

      // 3. Khi chọn/sửa mã VTVL hoặc tên VTVL ở C1 -> chuẩn hóa mã đơn vị, chống trùng và đồng bộ C2..D2
      if (sheetKey === 'C1' && field === 'maVtvl') {
        return recalculateGridFormulas(syncC1VtvlChange(prev, rowId, String(value), currentUnit.code), currentUnit.code, currentUnit.nameVi);
      }
      if (sheetKey === 'C1' && field === 'tenVtvl') {
        return recalculateGridFormulas(syncC1NameChange(prev, rowId, String(value), currentUnit.code), currentUnit.code, currentUnit.nameVi);
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

      // 5. Khi chọn Mã VTVL ở Biểu DU_BAO hoặc D2 -> tự động sinh 5 hàng tương ứng 5 năm 2027–2031
      if ((sheetKey === 'DU_BAO' || sheetKey === 'D2') && field === 'maVtvl') {
        const nextData = syncFiveYearVtvlSelect(prev, sheetKey, rowId, String(value), currentUnit.code);
        return recalculateGridFormulas(nextData, currentUnit.code, currentUnit.nameVi);
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

  const deleteRow = useCallback((sheetKey: ExcelSheetKey, rowIdOrIds: string | string[]): boolean => {
    const ids = Array.isArray(rowIdOrIds) ? rowIdOrIds : [rowIdOrIds];
    if (ids.length === 0) return false;

    const guard = validateRowDeletion(data, sheetKey, ids);
    if (!guard.canDelete) {
      alert(guard.message);
      return false;
    }

    setData((prev) => {
      let nextData = prev;
      for (const id of ids) {
        nextData = handleSyncDeleteRow(nextData, sheetKey, id);
      }
      return recalculateGridFormulas(nextData, currentUnit.code, currentUnit.nameVi);
    });
    return true;
  }, [currentUnit.code, currentUnit.nameVi, data]);

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
    const synced = recalculateGridFormulas(data, currentUnit.code, currentUnit.nameVi);
    const logEntry = buildAuditLogEntry({
      bieu: sheetKey === 'A1' ? '1. A1_NhiemVu' : `Biểu ${sheetKey}`,
      ma: currentUnit.code,
      truong: 'Lưu dữ liệu biểu',
      giaTriCu: 'Bản lưu trước',
      giaTriMoi: `Lưu cập nhật biểu ${sheetKey} lúc ${timeStr}`,
      nguon: 'QĐ 2266/QĐ-ĐHCNKT',
      nguoiXacNhan: `Tổ công tác VTVL [${currentUnit.code}]`,
      versionCount: data.S?.length || 0
    });
    synced.S = [logEntry, ...(synced.S || []).slice(0, 49)];
    setData(synced);
    if (typeof window !== 'undefined') localStorage.setItem(`hcmute_vtvl_grid_${currentUnit.code}`, JSON.stringify(synced));
    setLastSaved(timeStr);
    setLastSavedSheet(sheetKey);
    return synced;
  }, [currentUnit.code, currentUnit.nameVi, data]);

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
    vtvlList: (data.C1 || []).filter((r) => r.maVtvl).map((r) => ({ value: String(r.maVtvl), label: r.tenVtvl ? `${r.maVtvl} — ${r.tenVtvl}` : String(r.maVtvl) })),
    missionList: (data.A1 || []).filter((r) => r.maNhiemVu).map((r) => ({ value: String(r.maNhiemVu), label: r.tenNhiemVu ? `${r.maNhiemVu} — ${r.tenNhiemVu}` : String(r.maNhiemVu) })),
    taskList: (data.A2 || []).filter((r) => r.maCongViec).map((r) => ({ value: String(r.maCongViec), label: r.tenCongViec ? `${r.maCongViec} — ${r.tenCongViec}` : String(r.maCongViec) })),
    productList: (data.DM_SP || []).filter((r) => r.maSpChuan).map((r) => ({ value: String(r.maSpChuan), label: r.tenSanPham ? `${r.maSpChuan} — ${r.tenSanPham}` : String(r.maSpChuan) })),
    pl1VtvlList: PL1_VTVL_CATALOG.map((item) => ({ value: item.pl1Code, label: `${item.pl1Code} – ${item.positionName}` }))
  }), [data.C1, data.A1, data.A2, data.DM_SP]);

  const loadFullPl1Catalog = useCallback(() => {
    setData((prev) => recalculateGridFormulas({ ...prev, C1: buildFullPl1C1Rows(currentUnit.code), C2: buildFullPl1C2Rows(buildFullPl1C1Rows(currentUnit.code)) }, currentUnit.code, currentUnit.nameVi));
  }, [currentUnit.code, currentUnit.nameVi]);

  const loadRecommendedVtvls = useCallback(() => {
    setData((prev) => recalculateGridFormulas({ ...prev, C1: buildRecommendedC1Rows(currentUnit.code, currentUnit.group), C2: buildFullPl1C2Rows(buildRecommendedC1Rows(currentUnit.code, currentUnit.group)) }, currentUnit.code, currentUnit.nameVi));
  }, [currentUnit.code, currentUnit.nameVi, currentUnit.group]);

  const exportFullWorkbook = useCallback(async () => {
    setIsExporting(true);
    try {
      exportUserWorkbookToExcel({ unitCode: currentUnit.code, unitNameVi: currentUnit.nameVi, reportingPeriod: '01/10/2025–30/9/2026', data });
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
