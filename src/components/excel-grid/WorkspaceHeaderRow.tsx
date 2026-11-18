'use client';

import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Layers, Check } from 'lucide-react';
import { ExcelSheetKey } from './excel-grid-types';
import { EXCEL_SHEET_METAS } from './excel-sheet-metas';
import { getActiveHcmuteUnits } from '@/configs/hcmute-units';
import { HcmuteUnit } from '@/types/vtvl';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/Popover';

interface WorkspaceHeaderRowProps {
  activeSheet: ExcelSheetKey;
  currentUnit: HcmuteUnit;
  unitCode: string;
  activeStep: number;
  activeSheetIndex: number;
  totalSheets: number;
  session?: OperatorSession | null;
  onUnitChange: (code: string) => void;
}

export function WorkspaceHeaderRow({
  activeSheet,
  currentUnit,
  unitCode,
  activeStep,
  activeSheetIndex,
  totalSheets,
  session,
  onUnitChange
}: WorkspaceHeaderRowProps) {
  const [unitSearch, setUnitSearch] = useState('');
  const [availableUnits, setAvailableUnits] = useState<HcmuteUnit[]>(() => getActiveHcmuteUnits());

  const isAdmin = session?.role === 'admin';
  const canChangeUnit = !session || isAdmin;
  const activeMeta = EXCEL_SHEET_METAS[activeSheet];

  useEffect(() => {
    const handleUnitsUpdated = () => setAvailableUnits(getActiveHcmuteUnits());
    window.addEventListener('vtvl-units-updated', handleUnitsUpdated);
    return () => window.removeEventListener('vtvl-units-updated', handleUnitsUpdated);
  }, []);

  const filteredUnits = availableUnits.filter(
    (u: HcmuteUnit) =>
      u.nameVi.toLowerCase().includes(unitSearch.toLowerCase()) ||
      u.code.toLowerCase().includes(unitSearch.toLowerCase())
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 w-full min-w-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="inline-flex items-center gap-1 h-7 px-2 bg-[#f1f5f9] border border-[#e2e8f0] rounded-[8px] text-[11.5px] font-semibold text-[#20446c] shrink-0 tabular-nums"
          title={`Bước ${activeStep}/8 trong quy trình · Biểu ${activeSheetIndex + 1}/${totalSheets}`}
        >
          <Layers className="w-3.5 h-3.5 text-[#006cee] shrink-0" />
          <span className="whitespace-nowrap">B{activeStep}/8 · {activeSheetIndex + 1}/{totalSheets}</span>
        </span>

        <h1
          className="!text-[16.5px] sm:!text-[21px] !leading-[1.35] font-bold !text-[#0072BC] truncate min-w-0"
          title={activeMeta.title}
        >
          {activeMeta.title}
        </h1>
      </div>

      {canChangeUnit ? (
        <Popover>
          <PopoverTrigger>
            <span
              className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-white hover:bg-[#f4f7fb] border border-[#cbd5e1] hover:border-[#006cee] rounded-[9px] text-xs font-semibold text-[#004776] transition-colors max-w-[190px] sm:max-w-[230px] truncate cursor-pointer"
              title={`[${unitCode}] ${currentUnit.nameVi} — Nhấp để đổi đơn vị công tác`}
            >
              <Building2 className="w-3.5 h-3.5 text-[#006cee] shrink-0" />
              <span className="truncate font-bold">[{unitCode}] {currentUnit.nameVi}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#476885] shrink-0" />
            </span>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2.5">
            <input
              type="text"
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
              placeholder="Tìm mã hoặc tên đơn vị..."
              aria-label="Tìm mã hoặc tên đơn vị"
              className="w-full h-9 px-3 text-sm rounded-xl border border-[#cbd5e1] mb-2 text-[#004776] font-medium focus:ring-2 focus:ring-[#006cee]/25 focus:border-[#006cee] outline-hidden"
            />
            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {filteredUnits.map((u: HcmuteUnit) => (
                <PopoverClose key={u.code} onClick={() => onUnitChange(u.code)}>
                  <div
                    className={`w-full text-left px-3 py-2 rounded-lg text-[13px] truncate flex items-center justify-between gap-2 ${
                      u.code === unitCode
                        ? 'bg-[#eef5ff] text-[#006cee] font-bold'
                        : 'hover:bg-[#f4f7fb] text-[#004776] font-medium'
                    }`}
                  >
                    <span className="truncate">[{u.code}] {u.nameVi}</span>
                    {u.code === unitCode && <Check className="w-4 h-4 text-[#006cee] shrink-0" />}
                  </div>
                </PopoverClose>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <span
          className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-[#f5f9ff] border border-[#d8e3ef] rounded-[9px] text-xs font-bold text-[#004776] max-w-[220px] truncate cursor-default"
          title={`[${unitCode}] ${currentUnit.nameVi} · Đơn vị công tác cố định`}
        >
          <Building2 className="w-3.5 h-3.5 text-[#006cee] shrink-0" />
          <span className="truncate font-bold">[{unitCode}] {currentUnit.nameVi}</span>
        </span>
      )}
    </div>
  );
}
