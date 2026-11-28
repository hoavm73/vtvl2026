import { useState, useCallback, useMemo, useEffect } from 'react';
import { ExcelSheetKey, GenericGridRow, SheetOrderMode, EXCEL_NATURAL_SHEET_ORDER, TECHNICAL_DEPENDENCY_ORDER, ADMIN_ONLY_SHEETS } from './excel-grid-types';
import { buildDefaultGridWorkbook } from './excel-grid-defaults';
import { recalculateGridFormulas } from './excel-grid-formulas';
import { normalizeC2Rows, normalizeD1Rows } from './excel-c2-d1-helpers';
import { normalizeA1Rows } from '@/services/a1/a1-validation';
import { getNextMissionCode, getNextTaskCode, buildNewGridRow, handleSyncDeleteRow, syncFiveYearVtvlSelect } from './excel-grid-code-helpers';
import { isMissionCodeDuplicate, performSplitMission, moveRowByDirection, sortA1RowsByMissionCode, buildAuditLogEntry, syncA1MissionChange, syncC1VtvlChange } from './excel-grid-a1-helpers';
import { validateRowDeletion } from './excel-grid-delete-guards';
import { buildFullPl1C1Rows, buildFullPl1C2Rows, buildRecommendedC1Rows } from '@/configs/hcmute-pl1-builder';
import { PL1_VTVL_CATALOG } from '@/configs/hcmute-pl1-catalog';
import { HCMUTE_UNITS, findHcmuteUnit } from '@/configs/hcmute-units';
import { exportUserWorkbookToExcel } from '@/services/excel-export/user-workbook-exporter';
import { UnitGroupKind } from '@/types/vtvl';
import { useC1AdminLock } from './useC1AdminLock';
import { safeSetUnitGridOnly } from './workbook-sync-queue';

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
    if (initialSheet && (isAdmin || !ADMIN_ONLY_SHEETS.has(initialSheet))) setActiveSheet(initialSheet);
  }, [initialSheet, isAdmin]);
  const { isC1Unlocked, unlockC1, lockC1 } = useC1AdminLock();
  const [data, setData] = useState<Record<ExcelSheetKey, GenericGridRow[]>>(() => buildDefaultGridWorkbook(initialUnitCode));
  useEffect(() => {
    const code = hasExplicitUnit ? findHcmuteUnit(initialUnitCode).code : getInitialUnitCode(initialUnitCode);
    setUnitCode(code);
    try {
      const stored = localStorage.getItem(`hcmute_vtvl_grid_${code.toUpperCase()}`);
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
        const stored = localStorage.getItem(`hcmute_vtvl_grid_${newUnitCode.toUpperCase()}`);
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
    return () => { window.removeEventListener('vtvl-grid-sync', handleGridSync); window.removeEventListener('vtvl-units-updated', handleUnitsUpdated); };
  }, [unitCode, handleUnitChange]);

  const handleLoadTcnsData = useCallback(() => {
    if (currentUnit.code.toUpperCase() !== 'TCNS') return;
    setUnitCode('TCNS');
    const tcnsData = buildDefaultGridWorkbook('TCNS');
    setData(tcnsData);
    setActiveSheet('A1');
    safeSetUnitGridOnly('TCNS', tcnsData);
  }, [currentUnit.code]);

  const restoreWorkbookData = useCallback((restoredData: Record<ExcelSheetKey, GenericGridRow[]>, newUnitCode?: string, resetSheet = false) => {
    const resolvedUnit = findHcmuteUnit(newUnitCode || unitCode);
    if (newUnitCode) setUnitCode(newUnitCode);
    setData({
      ...restoredData,
      A1: normalizeA1Rows(restoredData.A1, resolvedUnit.code, resolvedUnit.nameVi),
      C2: normalizeC2Rows(restoredData.C2, restoredData.C1 || []),
      D1: normalizeD1Rows(restoredData.D1, restoredData.C1 || [], resolvedUnit.nameVi)
    });
    if (resetSheet) setActiveSheet('A1');
  }, [unitCode]);

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
      if (sheetKey === 'C1' && ['tenVtvl', 'nhomVtvl4', 'maNgach'].includes(field)) return prev;
      if (sheetKey === 'C2' && field === 'maVtvl') {
        const vCode = String(value);
        const tenVtvl = String((prev.C1 || []).find((c) => String(c.maVtvl) === vCode)?.tenVtvl || '');
        return recalculateGridFormulas({ ...prev, C2: sheetRows.map((r) => (r.id === rowId ? { ...r, maVtvl: vCode, tenVtvl } : r)) }, currentUnit.code, currentUnit.nameVi);
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
    safeSetUnitGridOnly(currentUnit.code, synced);
    setLastSaved(timeStr);
    setLastSavedSheet(sheetKey);
    return synced;
  }, [currentUnit.code, currentUnit.nameVi, data]);

  const currentSheetOrder = useMemo(() => {
    const rawOrder = orderMode === 'technical' ? TECHNICAL_DEPENDENCY_ORDER : EXCEL_NATURAL_SHEET_ORDER;
    return rawOrder.filter((key) => !ADMIN_ONLY_SHEETS.has(key));
  }, [orderMode]);

  useEffect(() => { if (ADMIN_ONLY_SHEETS.has(activeSheet)) setActiveSheet('A1'); }, [activeSheet]);

  const activeSheetIndex = currentSheetOrder.indexOf(activeSheet);
  const goToNextSheet = useCallback(() => { if (activeSheetIndex < currentSheetOrder.length - 1) setActiveSheet(currentSheetOrder[activeSheetIndex + 1]); }, [activeSheetIndex, currentSheetOrder]);
  const goToPrevSheet = useCallback(() => { if (activeSheetIndex > 0) setActiveSheet(currentSheetOrder[activeSheetIndex - 1]); }, [activeSheetIndex, currentSheetOrder]);
  const saveAndGoNext = useCallback(() => { saveSheetData(activeSheet); goToNextSheet(); }, [saveSheetData, activeSheet, goToNextSheet]);

  const dynamicOptionsMap = useMemo(() => ({
    vtvlList: (data.C1 || []).filter((r) => r.maVtvl).map((r) => ({ value: String(r.maVtvl), label: r.tenVtvl ? `${r.maVtvl} — ${r.tenVtvl}` : String(r.maVtvl) })),
    missionList: (data.A1 || []).filter((r) => r.maNhiemVu).map((r) => ({ value: String(r.maNhiemVu), label: r.tenNhiemVu ? `${r.maNhiemVu} — ${r.tenNhiemVu}` : String(r.maNhiemVu) })),
    taskList: (data.A2 || []).filter((r) => r.maCongViec).map((r) => ({ value: String(r.maCongViec), label: r.tenCongViec ? `${r.maCongViec} — ${r.tenCongViec}` : String(r.maCongViec) })),
    productList: (data.DM_SP || []).filter((r) => r.maSpChuan).map((r) => ({ value: String(r.maSpChuan), label: r.tenSanPham ? `${r.maSpChuan} — ${r.tenSanPham}` : String(r.maSpChuan) })),
    pl1VtvlList: PL1_VTVL_CATALOG.map((item) => ({ value: item.pl1Code, label: `${item.pl1Code} – ${item.positionName}` }))
  }), [data.C1, data.A1, data.A2, data.DM_SP]);

  const loadFullPl1Catalog = useCallback(() => setData((prev) => recalculateGridFormulas({ ...prev, C1: buildFullPl1C1Rows(currentUnit.code), C2: buildFullPl1C2Rows(buildFullPl1C1Rows(currentUnit.code)) }, currentUnit.code, currentUnit.nameVi)), [currentUnit.code, currentUnit.nameVi]);
  const loadRecommendedVtvls = useCallback(() => setData((prev) => recalculateGridFormulas({ ...prev, C1: buildRecommendedC1Rows(currentUnit.code, currentUnit.group), C2: buildFullPl1C2Rows(buildRecommendedC1Rows(currentUnit.code, currentUnit.group)) }, currentUnit.code, currentUnit.nameVi)), [currentUnit.code, currentUnit.nameVi, currentUnit.group]);

  const exportFullWorkbook = useCallback(async () => {
    setIsExporting(true);
    try { exportUserWorkbookToExcel({ unitCode: currentUnit.code, unitNameVi: currentUnit.nameVi, reportingPeriod: '01/10/2025–30/9/2026', data }); }
    catch { alert('Không thể tạo file Excel từ dữ liệu đang điền, vui lòng thử lại.'); }
    finally { setIsExporting(false); }
  }, [currentUnit, data]);
  const moveRow = useCallback((sheetKey: ExcelSheetKey, rowId: string, direction: 'up' | 'down'): boolean => {
    let moved = false;
    setData((prev) => {
      const nextRows = moveRowByDirection(prev[sheetKey] || [], rowId, direction);
      if (!nextRows) return prev;
      moved = true;
      return recalculateGridFormulas({ ...prev, [sheetKey]: nextRows }, currentUnit.code, currentUnit.nameVi);
    });
    return moved;
  }, [currentUnit.code, currentUnit.nameVi]);
  const sortA1ByCode = useCallback(() => setData((prev) => recalculateGridFormulas({ ...prev, A1: sortA1RowsByMissionCode(prev.A1 || []) }, currentUnit.code, currentUnit.nameVi)), [currentUnit.code, currentUnit.nameVi]);
  const restoreDeletedRow = useCallback((sheetKey: ExcelSheetKey, row: GenericGridRow, index: number) => {
    setData((prev) => {
      const list = [...(prev[sheetKey] || [])];
      if (list.some((r) => r.id === row.id)) return prev;
      list.splice(Math.max(0, Math.min(index, list.length)), 0, row);
      return recalculateGridFormulas({ ...prev, [sheetKey]: list }, currentUnit.code, currentUnit.nameVi);
    });
  }, [currentUnit.code, currentUnit.nameVi]);
  return {
    unitCode, currentUnit, orderMode, setOrderMode, currentSheetOrder, activeSheet, activeSheetIndex,
    data, lastSaved, lastSavedSheet, isExporting, dynamicOptionsMap, isC1Unlocked, unlockC1, lockC1,
    handleUnitChange, handleLoadTcnsData, restoreWorkbookData, loadFullPl1Catalog, loadRecommendedVtvls,
    setActiveSheet, updateCell, addRow, splitRow, moveRow, sortA1ByCode, restoreDeletedRow, deleteRow, saveSheetData, saveAndGoNext,
    exportFullWorkbook, goToNextSheet, goToPrevSheet
  };
}
