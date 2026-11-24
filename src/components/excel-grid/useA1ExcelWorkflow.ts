'use client';

import { useState, useCallback, useRef } from 'react';
import { ExcelSheetKey, GenericGridRow } from './excel-grid-types';
import { validateNewA1RowsForSave } from '@/services/a1/a1-validation';
import { validateNewSheetRowsForSave } from '@/services/workbooks/workbook-sheet-validation';
import {
  A1ImportPreviewResult,
  applyA1ImportPreview,
  downloadA1ExcelFile
} from '@/services/a1/a1-excel-service';
import { recalculateGridFormulas } from './excel-grid-formulas';
import { syncActivityToSupabase } from '@/services/storage/vtvl-sync';

interface UseA1ExcelWorkflowParams {
  unitCode: string;
  unitNameVi: string;
  data: Record<ExcelSheetKey, GenericGridRow[]>;
  isReadOnly: boolean;
  restoreWorkbookData: (next: Record<ExcelSheetKey, GenericGridRow[]>, unitCode?: string, resetSheet?: boolean) => void;
  persistDataForSession: (
    nextData: Record<ExcelSheetKey, GenericGridRow[]>,
    forceImmediate?: boolean,
    unitOverride?: string
  ) => Promise<boolean>;
}

export interface A1FeedbackToast {
  kind: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}

export function useA1ExcelWorkflow({
  unitCode,
  unitNameVi,
  data,
  isReadOnly,
  restoreWorkbookData,
  persistDataForSession
}: UseA1ExcelWorkflowParams) {
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [validationBanner, setValidationBanner] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<A1FeedbackToast | null>(null);
  const [showA1ImportModal, setShowA1ImportModal] = useState(false);
  const [isImportingA1, setIsImportingA1] = useState(false);
  const baselineBySheetRef = useRef<Partial<Record<ExcelSheetKey, GenericGridRow[]>>>({});
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((toast: A1FeedbackToast) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setFeedbackToast(toast);
    toastTimerRef.current = setTimeout(() => setFeedbackToast(null), 6000);
  }, []);

  const syncWorkbookBaseline = useCallback((wbData: Partial<Record<ExcelSheetKey, GenericGridRow[]>> | undefined) => {
    const next: Partial<Record<ExcelSheetKey, GenericGridRow[]>> = {};
    if (wbData) {
      for (const [k, rows] of Object.entries(wbData)) {
        if (Array.isArray(rows)) next[k as ExcelSheetKey] = rows.map((r) => ({ ...r }));
      }
    }
    baselineBySheetRef.current = next;
    setCellErrors((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    setValidationBanner((prev) => (prev === null ? prev : null));
  }, []);

  const clearCellError = useCallback((cellKey: string) => {
    setCellErrors((prev) => {
      if (!prev[cellKey]) return prev;
      const next = { ...prev };
      delete next[cellKey];
      if (Object.keys(next).length === 0) setValidationBanner(null);
      return next;
    });
  }, []);

  const runSheetCheck = useCallback((sheetKey: ExcelSheetKey, rows: GenericGridRow[]) => {
    const existing = baselineBySheetRef.current[sheetKey] || [];
    if (sheetKey === 'A1') {
      return validateNewA1RowsForSave({ incomingA1: rows, existingA1: existing });
    }
    return validateNewSheetRowsForSave({ sheetKey, incomingRows: rows, existingRows: existing });
  }, []);

  const isSheetValidForAutoSave = useCallback((sheetKey: ExcelSheetKey, rows: GenericGridRow[]): boolean => {
    return runSheetCheck(sheetKey, rows).ok;
  }, [runSheetCheck]);

  const checkSheetBeforeSave = useCallback((sheetKey: ExcelSheetKey, rows: GenericGridRow[], focusOnError: boolean): boolean => {
    const check = runSheetCheck(sheetKey, rows);
    if (check.ok) {
      setCellErrors((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setValidationBanner((prev) => (prev === null ? prev : null));
      return true;
    }
    if (focusOnError) {
      setCellErrors(check.cellErrors);
      setValidationBanner(check.error || 'Vui lòng điền đủ tất cả các trường bắt buộc trước khi lưu.');
      if (check.firstErrorCellKey && typeof document !== 'undefined') {
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLElement>(`[data-cell-key="${check.firstErrorCellKey}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            const focusTarget = el.matches('input,textarea,button,select') ? el : el.querySelector<HTMLElement>('button,input,textarea,select');
            (focusTarget || el).focus();
          }
        });
      }
    }
    return false;
  }, [runSheetCheck]);

  const handleDownloadA1Template = useCallback(() => {
    void downloadA1ExcelFile({ unitCode, unitNameVi, mode: 'template' })
      .then((fileName) => showToast({ kind: 'info', title: 'Đã tải tệp mẫu trống Biểu A1', detail: `${fileName} (có sẵn bộ lọc 7 cột và danh sách chọn 4 trạng thái).` }))
      .catch(() => showToast({ kind: 'error', title: 'Không thể tạo tệp mẫu Excel', detail: 'Vui lòng thử lại.' }));
  }, [unitCode, unitNameVi, showToast]);

  const handleExportA1 = useCallback(() => {
    const count = (data.A1 || []).length;
    void downloadA1ExcelFile({ unitCode, unitNameVi, rows: data.A1 || [], mode: 'export' })
      .then((fileName) => showToast({ kind: 'success', title: 'Xuất dữ liệu Biểu A1 thành công', detail: `Đã xuất ${count} nhiệm vụ ra tệp ${fileName}.` }))
      .catch(() => showToast({ kind: 'error', title: 'Xuất dữ liệu A1 thất bại', detail: 'Vui lòng thử lại.' }));
  }, [unitCode, unitNameVi, data.A1, showToast]);

  const handleConfirmA1Import = useCallback(async (
    preview: A1ImportPreviewResult,
    duplicateDecisions: Record<number, 'skip' | 'add_new'> = {}
  ): Promise<boolean> => {
    if (isReadOnly) return false;
    const applied = applyA1ImportPreview({ preview, existingA1: data.A1 || [], unitCode, duplicateDecisions });
    if (!applied.ok) {
      showToast({ kind: 'error', title: 'Nhập Excel thất bại', detail: applied.error });
      return false;
    }
    const totalSkipped = preview.summary.unchangedCount + applied.skippedDuplicateCount;
    if (applied.addedCount === 0) {
      showToast({ kind: 'info', title: 'Không có dòng mới cần thêm', detail: `Đã bỏ qua ${totalSkipped} dòng trùng với dữ liệu đã có trên bảng.` });
      return true;
    }

    setIsImportingA1(true);
    try {
      const nextWorkbook = recalculateGridFormulas({ ...data, A1: applied.nextA1 }, unitCode, unitNameVi);
      const savedOk = await persistDataForSession(nextWorkbook, true, unitCode);
      if (!savedOk) {
        showToast({ kind: 'error', title: 'Lưu dữ liệu nhập thất bại', detail: 'Máy chủ từ chối lưu hoặc phiên bản hồ sơ đã thay đổi. Vui lòng kiểm tra thông báo.' });
        return false;
      }
      restoreWorkbookData(nextWorkbook, unitCode);
      syncWorkbookBaseline(nextWorkbook);
      void syncActivityToSupabase(
        unitCode,
        unitNameVi,
        'NHẬP_EXCEL_BIỂU_A1',
        `Nhập Excel Biểu A1: thêm mới ${applied.addedCount} nhiệm vụ${totalSkipped > 0 ? ` (bỏ qua ${totalSkipped} dòng trùng)` : ''}.`
      );
      showToast({
        kind: 'success',
        title: `Nhập Excel thành công (+${applied.addedCount} nhiệm vụ)`,
        detail: totalSkipped > 0 ? `Đã bỏ qua ${totalSkipped} dòng trùng dữ liệu và giữ nguyên liên kết A2.` : 'Toàn bộ nhiệm vụ mới đã được lưu vào hồ sơ đơn vị.'
      });
      return true;
    } finally {
      setIsImportingA1(false);
    }
  }, [isReadOnly, data, unitCode, unitNameVi, persistDataForSession, restoreWorkbookData, syncWorkbookBaseline, showToast]);

  return {
    cellErrors,
    validationBanner,
    feedbackToast,
    dismissToast: () => setFeedbackToast(null),
    showA1ImportModal,
    setShowA1ImportModal,
    isImportingA1,
    syncWorkbookBaseline,
    clearCellError,
    isSheetValidForAutoSave,
    checkSheetBeforeSave,
    handleDownloadA1Template,
    handleExportA1,
    handleConfirmA1Import
  };
}
