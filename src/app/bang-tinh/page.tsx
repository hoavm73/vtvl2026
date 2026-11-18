'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExcelWorkbookViewer } from '@/components/excel-grid/ExcelWorkbookViewer';
import { EXCEL_SHEET_METAS } from '@/components/excel-grid/excel-sheet-metas';
import { ExcelSheetKey } from '@/components/excel-grid/excel-grid-types';
import { PageWorkspaceSkeleton } from '@/components/ui/Skeleton';

function BangTinhContent() {
  const searchParams = useSearchParams();
  const rawUnit = searchParams.get('unit')?.trim() || undefined;
  const rawSheet = searchParams.get('sheet')?.trim().toUpperCase();
  const initialSheet = rawSheet && rawSheet in EXCEL_SHEET_METAS ? (rawSheet as ExcelSheetKey) : undefined;

  return (
    <div className="w-full max-w-none min-w-0 overflow-x-clip px-2.5 sm:px-5 lg:px-6 py-2.5 sm:py-4">
      <ExcelWorkbookViewer initialUnitCode={rawUnit || 'TCNS'} requestedUnitCode={rawUnit} initialSheet={initialSheet} />
    </div>
  );
}

export default function BangTinhPage() {
  return (
    <Suspense fallback={<div className="px-2.5 sm:px-5 lg:px-6 py-2.5 sm:py-4"><PageWorkspaceSkeleton statusText="Đang tải bảng tính 10 biểu Excel..." /></div>}>
      <BangTinhContent />
    </Suspense>
  );
}
