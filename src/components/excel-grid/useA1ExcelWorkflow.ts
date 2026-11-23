'use client';

import { useState, useCallback, useRef } from 'react';
import { ExcelSheetKey, GenericGridRow } from './excel-grid-types';
import { validateNewA1RowsForSave } from '@/services/a1/a1-validation';
import {
  A1ImportPreviewResult,
  applyA1ImportPreview,
  downloadA1ExcelFile
} from '@/services/a1/a1-excel-service';
import { recalculateGridFormulas } from './excel-grid-formulas';

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
  const [showA1ImportModal, setShowA1ImportModal] = useState(false);
  const [isImportingA1, setIsImportingA1] = useState(false);
  const baselineA1Ref = useRef<GenericGridRow[]>([]);

  const syncA1Baseline = useCallback((rows: GenericGridRow[] | undefined) => {
    baselineA1Ref.current = Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
    setCellErrors({});
    setValidationBanner(null);
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

  const checkA1BeforeSave = useCallback((a1Rows: GenericGridRow[], focusOnError: boolean): boolean => {
    const check = validateNewA1RowsForSave({
      incomingA1: a1Rows,
      existingA1: baselineA1Ref.current
    });
    if (check.ok) {
      setCellErrors({});
      setValidationBanner(null);
      return true;
    }
    if (focusOnError) {
      setCellErrors(check.cellErrors);
      setValidationBanner(check.error || 'Vui lòng điền đủ 6 trường bắt buộc cho nhiệm vụ mới tại Biểu A1.');
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
  }, []);

  const handleDownloadA1Template = useCallback(() => {
    void downloadA1ExcelFile({ unitCode, unitNameVi, mode: 'template' });
  }, [unitCode, unitNameVi]);

  const handleExportA1 = useCallback(() => {
    void downloadA1ExcelFile({ unitCode, unitNameVi, rows: data.A1 || [], mode: 'export' });
  }, [unitCode, unitNameVi, data.A1]);

  const handleConfirmA1Import = useCallback(async (preview: A1ImportPreviewResult): Promise<boolean> => {
    if (isReadOnly) return false;
    const applied = applyA1ImportPreview({ preview, existingA1: data.A1 || [], unitCode });
    if (!applied.ok) return false;
    if (applied.addedCount === 0) return true;

    setIsImportingA1(true);
    try {
      const nextWorkbook = recalculateGridFormulas({ ...data, A1: applied.nextA1 }, unitCode, unitNameVi);
      const savedOk = await persistDataForSession(nextWorkbook, true, unitCode);
      if (!savedOk) return false;
      restoreWorkbookData(nextWorkbook, unitCode);
      syncA1Baseline(nextWorkbook.A1);
      return true;
    } finally {
      setIsImportingA1(false);
    }
  }, [isReadOnly, data, unitCode, unitNameVi, persistDataForSession, restoreWorkbookData, syncA1Baseline]);

  return {
    cellErrors,
    validationBanner,
    showA1ImportModal,
    setShowA1ImportModal,
    isImportingA1,
    syncA1Baseline,
    clearCellError,
    checkA1BeforeSave,
    handleDownloadA1Template,
    handleExportA1,
    handleConfirmA1Import
  };
}
