'use client';

import React, { useState, useMemo } from 'react';
import {
  X, FileSpreadsheet, Download, Calendar, User, Building,
  BarChart3, Network, ArrowLeft, ExternalLink, Maximize2, Minimize2
} from 'lucide-react';
import { EmailSessionRecord, loadSessionData } from '@/services/telemetry/operator-session';
import { EXCEL_NATURAL_SHEET_ORDER, ExcelSheetKey, GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { EXCEL_SHEET_METAS } from '@/components/excel-grid/excel-sheet-metas';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';
import { exportUserWorkbookToExcel } from '@/services/excel-export/user-workbook-exporter';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { WorkforceStructureChartModal } from '@/components/excel-grid/WorkforceStructureChartModal';
import { UnitOrgTreeModal } from './UnitOrgTreeModal';

interface AdminSheetDataModalProps {
  session: EmailSessionRecord | null;
  onClose: () => void;
}

export function AdminSheetDataModal({ session, onClose }: AdminSheetDataModalProps) {
  const [selectedSheet, setSelectedSheet] = useState<ExcelSheetKey>('A1');
  const [isExporting, setIsExporting] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showOrgTreeModal, setShowOrgTreeModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);

  const unitName = useMemo(() => {
    if (!session) return '';
    if (session.unitNameVi) return session.unitNameVi;
    try { return findHcmuteUnit(session.unitCode).nameVi; } catch { return session.unitCode; }
  }, [session]);

  const fullData = useMemo(() => {
    if (!session) return {} as Record<ExcelSheetKey, GenericGridRow[]>;
    const defaultData = buildDefaultGridWorkbook(session.unitCode);
    if (session.data && typeof session.data === 'object' && Object.keys(session.data).length > 0) {
      return { ...defaultData, ...session.data };
    }
    const local = loadSessionData(session.email, session.unitCode);
    return { ...defaultData, ...local };
  }, [session]);

  if (!session) return null;

  const currentSheetMeta = EXCEL_SHEET_METAS[selectedSheet];
  const rawRows = fullData[selectedSheet];
  const sheetRows: GenericGridRow[] = Array.isArray(rawRows) ? rawRows : [];
  const columns = currentSheetMeta?.columns || [];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      exportUserWorkbookToExcel({
        unitCode: session.unitCode,
        unitNameVi: unitName,
        operatorEmail: session.email,
        data: fullData
      });
    } catch {
      alert('Không thể tạo file Excel cho phiên này, vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none ${isFullscreen ? 'p-0' : 'p-2 sm:p-4'}`}
    >
      <div className={`bg-white overflow-hidden flex flex-col transition-all duration-150 ${isFullscreen ? 'w-screen h-screen max-w-none max-h-none rounded-none' : 'relative w-full max-w-7xl max-h-[94dvh] rounded-2xl shadow-2xl border border-[#cbd5e1]'}`}>
        {/* Header Modal với màu xanh #0072BC */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 sm:px-5 py-2.5 sm:py-3 bg-[#0072BC] text-white shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#005c96] hover:bg-[#004a7a] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
              title="Trở lại danh sách quản trị phiên"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Trở lại</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">Chi tiết bảng biểu phiên làm việc</h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#005c96] text-white">{session.unitCode}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-white/90 mt-0.5">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{session.email} ({session.title || 'Người thực hiện'})</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Building className="w-3.5 h-3.5" />{unitName}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Lưu lúc: {session.lastSavedAt || '—'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/bang-tinh?unit=${session.unitCode}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors cursor-pointer"
              title="Mở toàn bộ không gian làm việc của đơn vị này trong tab mới"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mở trang mới</span>
            </a>
            <button
              type="button"
              onClick={() => setShowOrgTreeModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#005c96] hover:bg-[#004a7a] rounded-lg transition-colors cursor-pointer"
              title="Xem sơ đồ cây vị trí việc làm"
            >
              <Network className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sơ đồ VTVL</span>
            </button>
            <button
              type="button"
              onClick={() => setShowChartModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#005c96] hover:bg-[#004a7a] rounded-lg transition-colors cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Biểu đồ C1–D2</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-white/90 hover:text-white p-1.5 rounded-lg bg-[#005c96] hover:bg-[#004a7a] transition-colors cursor-pointer"
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-white/90 hover:text-white p-1.5 rounded-lg bg-[#005c96] hover:bg-[#004a7a] transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thanh chọn sheet biểu (15 sheet) */}
        <div className="bg-[#f8fafc] border-b border-[#cbd5e1] px-4 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-thin shrink-0">
          {EXCEL_NATURAL_SHEET_ORDER.map((key) => {
            const meta = EXCEL_SHEET_METAS[key];
            const isActive = selectedSheet === key;
            const rows = fullData[key];
            const count = Array.isArray(rows) ? rows.length : 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedSheet(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                  isActive ? 'bg-[#0072BC] text-white border-[#0072BC] font-bold shadow-2xs' : 'bg-white text-[#0072BC] border-[#cbd5e1] hover:bg-[#eef7fd]'
                }`}
              >
                <span>{meta?.shortLabel || key}</span>
                <span className={`text-[10px] px-1 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#64748b]'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Thông tin sheet hiện tại */}
        <div className="px-5 py-2 bg-slate-50/70 border-b border-[#cbd5e1] flex items-center justify-between text-xs text-[#004776] shrink-0">
          <div className="font-semibold flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#0072BC]/10 text-[#0072BC] font-bold rounded">Biểu {currentSheetMeta?.shortLabel || selectedSheet}</span>
            <span className="font-bold text-[#0072BC]">{currentSheetMeta?.title || 'Dữ liệu bảng tính'}</span>
          </div>
          <div className="text-[#64748b]">Tổng dòng: <strong className="text-[#0072BC]">{sheetRows.length}</strong> · Số cột: <strong className="text-[#0072BC]">{columns.length}</strong></div>
        </div>

        {/* Vùng xem dữ liệu bảng tính */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 bg-slate-100/50">
          {sheetRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-[#64748b]">
              <FileSpreadsheet className="w-12 h-12 text-[#cbd5e1] mb-2" />
              <p className="font-bold text-sm text-[#0072BC]">Chưa có dữ liệu nhập riêng cho biểu {currentSheetMeta?.shortLabel || selectedSheet}</p>
              <p className="text-xs text-[#64748b] mt-1">Biểu này đang sử dụng thiết lập định biên ngầm định của Ban Tổ chức Trung ương.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-[#cbd5e1]">
                      <th className="p-2.5 font-bold text-[#0072BC] border-r border-[#cbd5e1] w-12 text-center shrink-0">STT</th>
                      {columns.map((col) => (
                        <th key={col.field} className="p-2.5 font-bold text-[#0072BC] border-r border-[#cbd5e1] whitespace-nowrap min-w-[140px]">
                          {col.headerName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheetRows.map((row, idx) => (
                      <tr key={row?.id || idx} className="border-b border-[#cbd5e1]/70 hover:bg-blue-50/40 transition-colors">
                        <td className="p-2.5 text-center text-[#64748b] font-medium border-r border-[#cbd5e1] bg-[#f8fafc]/50 align-top">{idx + 1}</td>
                        {columns.map((col) => (
                          <td
                            key={col.field}
                            className="p-2.5 text-[#004776] border-r border-[#cbd5e1]/70 align-top text-xs leading-relaxed whitespace-normal break-words min-w-[140px]"
                            title={String(row?.[col.field] ?? '')}
                          >
                            {String(row?.[col.field] ?? '') || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-[#f8fafc] border-t border-[#cbd5e1] flex items-center justify-between shrink-0">
          <span className="text-xs text-[#64748b]">Dữ liệu được lưu trữ tự động trong nhật ký phiên của hệ thống VTVL</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#0072BC] hover:bg-[#005c96] rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Trở lại danh sách</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-[#0072BC] bg-white border border-[#cbd5e1] hover:bg-[#e2e8f0] rounded-lg transition-colors cursor-pointer"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>

        <WorkforceStructureChartModal
          isOpen={showChartModal}
          onClose={() => setShowChartModal(false)}
          unitCode={session.unitCode}
          unitNameVi={unitName}
          c1Rows={fullData.C1 || []}
          d2Rows={fullData.D2 || []}
          onSelectSheet={(s) => setSelectedSheet(s)}
        />
        <UnitOrgTreeModal
          isOpen={showOrgTreeModal}
          onClose={() => setShowOrgTreeModal(false)}
          defaultUnitCode={session.unitCode}
          workbookData={fullData}
        />
      </div>
    </div>
  );
}
