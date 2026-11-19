'use client';

import React, { useState, useMemo } from 'react';
import { X, BarChart3, Search, ArrowUpRight, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
import { ExcelSheetKey, GenericGridRow } from './excel-grid-types';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { useQueryFilter } from '@/services/query/use-query-filter';
import {
  CombinedWorkforceItem,
  GROUP_OPTS,
  LABOR_OPTS,
  buildCombinedWorkforceItems
} from './workforce-chart-helpers';
import { WorkforceChartBody, WorkforceChartStats } from './WorkforceChartBody';

interface WorkforceStructureChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitCode: string;
  unitNameVi: string;
  c1Rows: GenericGridRow[];
  d2Rows: GenericGridRow[];
  onSelectSheet?: (sheet: ExcelSheetKey) => void;
  inline?: boolean;
}

export function WorkforceStructureChartModal({
  isOpen, onClose, unitCode, unitNameVi, c1Rows, d2Rows, onSelectSheet, inline = false
}: WorkforceStructureChartModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(!inline);

  const combinedItems = useMemo(() => buildCombinedWorkforceItems(c1Rows, d2Rows), [c1Rows, d2Rows]);

  const { params, setParam, data: filteredItems } = useQueryFilter<CombinedWorkforceItem, { q: string; group: string; laborType: string }>({
    queryKey: ['workforce-chart-c1-d2', unitCode],
    initialParams: { q: '', group: 'all', laborType: 'all' },
    data: combinedItems,
    syncUrl: false,
    queryFn: ({ params: p, data }) => data.filter((item) => {
      if (p.group !== 'all' && item.groupKind !== p.group) return false;
      if (p.laborType !== 'all' && item.loaiNhanLuc !== p.laborType) return false;
      if (p.q.trim()) {
        const term = p.q.trim().toLowerCase();
        if (!item.maVtvl.toLowerCase().includes(term) && !item.tenVtvl.toLowerCase().includes(term)) return false;
      }
      return true;
    })
  });

  const stats = useMemo<WorkforceChartStats>(() => {
    const totalPositions = filteredItems.length;
    const totalRequired = filteredItems.reduce((s, i) => s + i.canBoTri, 0);
    const totalAvailable = filteredItems.reduce((s, i) => s + i.coTheBoTri, 0);
    const totalAdjustment = filteredItems.reduce((s, i) => s + i.deNghiDieuChinh, 0);
    const maxHeadcount = Math.max(1, ...filteredItems.map((i) => Math.max(i.canBoTri, i.coTheBoTri, i.bienCheGiao, 1)));

    const byGroup = [
      { key: 'QL', label: 'Lãnh đạo, quản lý (QL)', color: '#0072BC' },
      { key: 'CM', label: 'Chuyên môn, nghề nghiệp (CM)', color: '#004776' },
      { key: 'HT', label: 'Hỗ trợ, phục vụ (HT)', color: '#ED1C24' }
    ].map((g) => {
      const m = filteredItems.filter((i) => i.groupKind === g.key);
      return { ...g, count: m.length, people: m.reduce((s, i) => s + i.canBoTri, 0), pct: totalPositions > 0 ? Math.round((m.length / totalPositions) * 100) : 0 };
    });

    const laborTypes = ['Viên chức', 'Hợp đồng lao động', 'Hợp đồng khoán việc', 'Thuê dịch vụ'].map((lt, idx) => {
      const m = filteredItems.filter((i) => i.loaiNhanLuc === lt);
      const color = idx % 2 === 0 ? '#0072BC' : '#ED1C24';
      return { label: lt, count: m.length, pct: totalPositions > 0 ? Math.round((m.length / totalPositions) * 100) : 0, color };
    });

    return { totalPositions, totalRequired, totalAvailable, totalAdjustment, maxHeadcount, byGroup, laborTypes };
  }, [filteredItems]);

  if (!isOpen) return null;

  const closeOrShrink = () => (inline && isFullscreen ? setIsFullscreen(false) : onClose());
  const cardCls = inline && !isFullscreen
    ? 'bg-white rounded-[16px] border border-[#e2e8f0] overflow-hidden flex flex-col'
    : `bg-white overflow-hidden flex flex-col transition-all duration-150 ${isFullscreen ? 'w-screen h-screen max-w-none max-h-none rounded-none' : 'relative w-full max-w-7xl h-[100dvh] sm:h-[92dvh] rounded-none sm:rounded-[16px] border border-[#e2e8f0]'}`;

  const chartCard = (
    <div className={cardCls} onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-white border-b border-[#e2e8f0] shrink-0">
        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
          {(!inline || isFullscreen) && (
            <button type="button" onClick={closeOrShrink} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-[#004776] text-xs font-semibold transition-colors cursor-pointer shrink-0" title="Trở lại giao diện trước">
              <ArrowLeft className="w-4 h-4 text-[#006cee]" /><span>Trở lại</span>
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <BarChart3 className="w-4 h-4 text-[#0072BC] shrink-0" />
              <h2 id="workforce-chart-modal-title" className="text-base sm:text-lg font-bold text-[#0072BC]">Biểu đồ cơ cấu nhân lực (Biểu C1 &amp; D2)</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eef5ff] text-[#004776]">[{unitCode}] {unitNameVi}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onSelectSheet && (
            <>
              <button type="button" onClick={() => { onSelectSheet('C1'); closeOrShrink(); }} className="inline-flex items-center gap-1 h-9 px-3 rounded-[8px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-[#004776] text-xs font-semibold cursor-pointer transition-colors">
                <span>Mở Biểu C1</span><ArrowUpRight className="w-3.5 h-3.5 text-[#006cee]" />
              </button>
              <button type="button" onClick={() => { onSelectSheet('D2'); closeOrShrink(); }} className="inline-flex items-center gap-1 h-9 px-3.5 rounded-[8px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold cursor-pointer transition-colors">
                <span>Mở Biểu D2</span><ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button type="button" onClick={() => setIsFullscreen(!isFullscreen)} aria-label={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'} className="h-9 w-9 rounded-[8px] text-[#476885] hover:text-[#004776] hover:bg-[#eef5ff] inline-flex items-center justify-center transition-colors cursor-pointer" title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {(!inline || isFullscreen) && (
            <button type="button" onClick={closeOrShrink} aria-label="Đóng biểu đồ" className="h-9 w-9 rounded-[8px] text-[#476885] hover:text-[#004776] hover:bg-[#eef5ff] inline-flex items-center justify-center cursor-pointer transition-colors"><X className="w-5 h-5" /></button>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-2.5 bg-[#f8fafc] border-b border-[#e2e8f0] grid grid-cols-1 sm:grid-cols-12 gap-2.5 shrink-0">
        <div className="sm:col-span-5 relative flex items-center">
          <Search className="w-4 h-4 text-[#476885] absolute left-3 pointer-events-none" />
          <input
            type="text"
            aria-label="Tìm theo mã VTVL hoặc tên vị trí"
            value={params.q}
            onChange={(e) => setParam('q', e.target.value)}
            placeholder="Tìm theo mã VTVL hoặc tên vị trí…"
            className="w-full min-h-[38px] pl-9 pr-3 text-xs leading-normal rounded-[8px] border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#006cee] focus:ring-2 focus:ring-[#006cee]/20 outline-hidden"
          />
        </div>
        <div className="sm:col-span-4">
          <ShadcnSelect size="sm" value={params.group} ariaLabel="Lọc theo nhóm VTVL" onChange={(v) => setParam('group', v)} options={GROUP_OPTS} />
        </div>
        <div className="sm:col-span-3">
          <ShadcnSelect size="sm" value={params.laborType} ariaLabel="Lọc theo loại nhân lực C1" onChange={(v) => setParam('laborType', v)} options={LABOR_OPTS} />
        </div>
      </div>

      <WorkforceChartBody stats={stats} filteredItems={filteredItems} />

      <div className="px-4 sm:px-6 py-3 bg-[#f8fafc] border-t border-[#e2e8f0] flex items-center justify-between gap-2 shrink-0">
        <span className="text-xs text-[#476885]">Trực quan hóa cơ cấu nhân lực tự động theo bộ nhận diện chuẩn HCM-UTE.</span>
        {(!inline || isFullscreen) && (
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={closeOrShrink} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[8px] text-xs font-semibold bg-[#006cee] text-white hover:bg-[#005ecc] transition-colors cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" /><span>Trở lại</span></button>
            <button type="button" onClick={closeOrShrink} className="h-9 px-3.5 rounded-[8px] text-xs font-semibold bg-white text-[#004776] border border-[#cbd5e1] hover:bg-[#eef5ff] transition-colors cursor-pointer">Đóng biểu đồ</button>
          </div>
        )}
      </div>
    </div>
  );

  if (inline && !isFullscreen) return chartCard;
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" aria-labelledby="workforce-chart-modal-title" className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#004776]/35 backdrop-blur-xs select-none ${isFullscreen ? 'p-0' : 'p-0 sm:p-3'}`} onClick={closeOrShrink}>
        {chartCard}
      </div>
    </ModalPortal>
  );
}
