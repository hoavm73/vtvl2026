'use client';

import React, { useState, useMemo } from 'react';
import { X, BarChart3, Users, Briefcase, Scale, Search, ArrowUpRight, ArrowLeft, Maximize2, Minimize2 } from 'lucide-react';
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

interface WorkforceStructureChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitCode: string;
  unitNameVi: string;
  c1Rows: GenericGridRow[];
  d2Rows: GenericGridRow[];
  onSelectSheet?: (sheet: ExcelSheetKey) => void;
}

export function WorkforceStructureChartModal({
  isOpen, onClose, unitCode, unitNameVi, c1Rows, d2Rows, onSelectSheet
}: WorkforceStructureChartModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(true);

  const combinedItems = useMemo(() => {
    return buildCombinedWorkforceItems(c1Rows, d2Rows);
  }, [c1Rows, d2Rows]);

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

  const stats = useMemo(() => {
    const totalPositions = filteredItems.length;
    const totalRequired = filteredItems.reduce((s, i) => s + i.canBoTri, 0);
    const totalAvailable = filteredItems.reduce((s, i) => s + i.coTheBoTri, 0);
    const totalAdjustment = filteredItems.reduce((s, i) => s + i.deNghiDieuChinh, 0);
    const maxHeadcount = Math.max(1, ...filteredItems.map((i) => Math.max(i.canBoTri, i.coTheBoTri, i.bienCheGiao, 1)));

    // Hệ màu chuẩn HCM-UTE: Xanh #0072BC & Đỏ #ED1C24
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

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workforce-chart-modal-title"
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#004776]/35 backdrop-blur-xs select-none ${isFullscreen ? 'p-0' : 'p-0 sm:p-3'}`}
        onClick={onClose}
      >
        <div
          className={`bg-white overflow-hidden flex flex-col transition-all duration-150 ${
            isFullscreen ? 'w-screen h-screen max-w-none max-h-none rounded-none' : 'relative w-full max-w-7xl h-[100dvh] sm:h-[92dvh] rounded-none sm:rounded-2xl shadow-2xl border border-[#cbd5e1]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 sm:px-6 py-3 bg-[#f8fafc] border-b border-[#cbd5e1] shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0072BC] hover:bg-[#005c96] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                title="Trở lại giao diện trước"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Trở lại</span>
              </button>
              <div className="w-9 h-9 rounded-xl bg-[#0072BC] text-white flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="workforce-chart-modal-title" className="text-sm sm:text-base font-bold text-[#004776]">
                    Biểu đồ cơ cấu nhân lực (Biểu C1 &amp; D2)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#0072BC]/10 text-[#0072BC] border border-[#0072BC]/20">
                    [{unitCode}] {unitNameVi}
                  </span>
                </div>
                <p className="text-xs text-[#476885] truncate">Trực quan hóa danh mục vị trí việc làm (3. C1_VTVL) và phương án bố trí biên chế (11. D2_PhuongAn)</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onSelectSheet && (
                <>
                  <button type="button" onClick={() => { onSelectSheet('C1'); onClose(); }} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-[#0072BC] hover:bg-[#005c96] text-white text-xs font-bold cursor-pointer transition-colors">
                    <span>Mở Biểu C1</span><ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => { onSelectSheet('D2'); onClose(); }} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-[#0072BC] hover:bg-[#005c96] text-white text-xs font-bold cursor-pointer transition-colors">
                    <span>Mở Biểu D2</span><ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg text-[#476885] hover:text-[#0072BC] hover:bg-[#e2e8f0]/60 transition-colors cursor-pointer"
                title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng biểu đồ"
                className="p-1.5 rounded-lg text-[#476885] hover:text-[#0072BC] hover:bg-[#e2e8f0]/60 inline-flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="px-3.5 sm:px-6 py-2 bg-[#f8fafc] border-b border-[#cbd5e1] grid grid-cols-1 sm:grid-cols-12 gap-2.5 shrink-0">
            <div className="sm:col-span-5 relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 pointer-events-none" />
              <input type="text" value={params.q} onChange={(e) => setParam('q', e.target.value)} placeholder="Tìm theo mã VTVL hoặc tên vị trí..." className="w-full h-8.5 pl-8 pr-3 text-xs rounded-lg border border-[#cbd5e1] bg-white text-[#004776] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden" />
            </div>
            <div className="sm:col-span-4">
              <ShadcnSelect size="sm" value={params.group} ariaLabel="Lọc theo nhóm VTVL" onChange={(v) => setParam('group', v)} options={GROUP_OPTS} />
            </div>
            <div className="sm:col-span-3">
              <ShadcnSelect size="sm" value={params.laborType} ariaLabel="Lọc theo loại nhân lực C1" onChange={(v) => setParam('laborType', v)} options={LABOR_OPTS} />
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0 bg-white">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {[
                { label: 'Tổng vị trí (Biểu C1)', val: `${stats.totalPositions} VTVL`, bg: 'bg-[#f4f8ff]', color: 'text-[#004776]', icon: <Briefcase className="w-4 h-4 text-[#0072BC]" /> },
                { label: 'Nhu cầu cần bố trí (D2)', val: `${stats.totalRequired} người`, bg: 'bg-[#eef7fd]', color: 'text-[#0072BC]', icon: <Users className="w-4 h-4 text-[#0072BC]" /> },
                { label: 'Hiện có có thể bố trí (D2)', val: `${stats.totalAvailable} người`, bg: 'bg-[#e8f3fa]', color: 'text-[#004776]', icon: <Users className="w-4 h-4 text-[#004776]" /> },
                { label: 'Đề nghị điều chỉnh (D2)', val: `${stats.totalAdjustment > 0 ? `+${stats.totalAdjustment}` : stats.totalAdjustment} người`, bg: stats.totalAdjustment !== 0 ? 'bg-[#fdeceb]' : 'bg-[#f8fafc]', color: stats.totalAdjustment !== 0 ? 'text-[#ED1C24]' : 'text-[#004776]', icon: <Scale className="w-4 h-4 text-[#ED1C24]" /> }
              ].map((s, idx) => (
                <div key={idx} className={`p-3 rounded-xl ${s.bg} border border-[#cbd5e1] flex items-center gap-2.5`}>
                  <div className="w-8 h-8 rounded-lg bg-white/90 flex items-center justify-center shrink-0 shadow-2xs">{s.icon}</div>
                  <div><div className="text-[11px] text-[#476885]">{s.label}</div><div className={`text-base font-semibold tabular-nums ${s.color}`}>{s.val}</div></div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {/* 1. Cơ cấu theo 03 nhóm chức danh (Xanh #0072BC & Đỏ #ED1C24) */}
              <div className="p-3.5 rounded-xl border border-[#cbd5e1] bg-white space-y-2.5">
                <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-[#004776]">1. Cơ cấu VTVL theo 03 nhóm chức danh (Biểu C1)</h3><span className="text-xs text-[#476885] tabular-nums">{stats.totalPositions} vị trí</span></div>
                <div className="w-full h-3 rounded-full bg-[#f1f5f9] overflow-hidden flex">
                  {stats.byGroup.map((g) => g.pct > 0 && <div key={g.key} style={{ width: `${g.pct}%`, backgroundColor: g.color }} title={`${g.label}: ${g.count} VTVL (${g.pct}%)`} className="h-full transition-all" />)}
                </div>
                <div className="space-y-1.5 pt-0.5">
                  {stats.byGroup.map((g) => (
                    <div key={g.key} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 font-medium text-[#004776]"><span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: g.color }} /><span>{g.label}</span></span>
                      <span className="tabular-nums text-[#476885]"><strong className="text-[#004776]">{g.count}</strong> VTVL · <strong style={{ color: g.color }}>{g.people}</strong> người ({g.pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Cơ cấu theo Loại nhân lực (Xanh #0072BC & Đỏ #ED1C24) */}
              <div className="p-3.5 rounded-xl border border-[#cbd5e1] bg-white space-y-2.5">
                <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-[#004776]">2. Cơ cấu theo Loại nhân lực (Biểu C1)</h3><span className="text-xs text-[#476885]">Chuẩn Data Validation</span></div>
                <div className="space-y-2">
                  {stats.laborTypes.map((lt) => (
                    <div key={lt.label} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs"><span className="font-medium text-[#004776]">{lt.label}</span><span className="tabular-nums text-[#476885]"><strong className="text-[#004776]">{lt.count}</strong> VTVL ({lt.pct}%)</span></div>
                      <div className="w-full h-1.5 rounded-full bg-[#f1f5f9] overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(lt.count > 0 ? 6 : 0, lt.pct)}%`, backgroundColor: lt.color }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Đối chiếu Nhu cầu cần bố trí và Nhân lực có thể bố trí */}
            <div className="p-3.5 rounded-xl border border-[#cbd5e1] bg-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] pb-2">
                <div>
                  <h3 className="text-xs font-semibold text-[#004776]">3. Đối chiếu Nhu cầu cần bố trí và Nhân lực có thể bố trí theo từng VTVL (Biểu D2 ↔ C1)</h3>
                  <p className="text-[11px] text-[#476885]">So sánh Cột C (Cần bố trí), Cột D (Có thể bố trí) và Cột G (Đề nghị điều chỉnh) tại Biểu 11. D2_PhuongAn</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 text-[#004776] font-medium"><span className="w-2.5 h-2.5 rounded-xs bg-[#0072BC]" /> Cần bố trí (D2.C)</span>
                  <span className="inline-flex items-center gap-1 text-[#004776] font-medium"><span className="w-2.5 h-2.5 rounded-xs bg-[#004776]" /> Có thể bố trí (D2.D)</span>
                  <span className="inline-flex items-center gap-1 text-[#004776] font-medium"><span className="w-2.5 h-2.5 rounded-xs bg-[#ED1C24]" /> Điều chỉnh/Thiếu hụt (D2.G)</span>
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#64748b]">Không có vị trí việc làm nào khớp điều kiện lọc.</div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => {
                    const bars = [
                      { label: 'Cần bố trí', val: item.canBoTri, pct: Math.round((item.canBoTri / stats.maxHeadcount) * 100), color: 'bg-[#0072BC]', text: 'text-[#0072BC]', h: 'h-2' },
                      { label: 'Có thể bố trí', val: item.coTheBoTri, pct: Math.round((item.coTheBoTri / stats.maxHeadcount) * 100), color: 'bg-[#004776]', text: 'text-[#004776]', h: 'h-2' },
                      { label: 'Biên chế giao', val: item.bienCheGiao, pct: Math.round((item.bienCheGiao / stats.maxHeadcount) * 100), color: 'bg-[#94a3b8]', text: 'text-[#476885]', h: 'h-1.5' }
                    ];
                    return (
                      <div key={item.maVtvl} className="p-2.5 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-[#eef7fd] text-[#0072BC] font-semibold text-[11px] shrink-0">{item.maVtvl}</span>
                            <span className="font-semibold text-[#004776] truncate" title={item.tenVtvl}>{item.tenVtvl}</span>
                            <span className="text-[#64748b] hidden sm:inline text-[11px]">· {item.loaiNhanLuc}</span>
                          </div>
                          <div className="flex items-center gap-2 tabular-nums shrink-0 text-xs">
                            <span className="text-[#476885]">Cần: <strong className="text-[#0072BC]">{item.canBoTri}</strong> · Có: <strong className="text-[#004776]">{item.coTheBoTri}</strong></span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${item.deNghiDieuChinh !== 0 ? 'bg-[#fdeceb] text-[#ED1C24] border border-[#fca5a5]' : 'bg-[#eef7fd] text-[#0072BC]'}`}>
                              {item.deNghiDieuChinh > 0 ? `+${item.deNghiDieuChinh} bổ sung` : item.deNghiDieuChinh < 0 ? `${item.deNghiDieuChinh} dôi dư` : 'Cân đối (0)'}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          {bars.map((b, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-2">
                              <span className="w-20 text-[#476885] shrink-0">{b.label}</span>
                              <div className={`flex-1 ${b.h} bg-white rounded-full overflow-hidden border border-[#e2e8f0]`}>
                                <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${Math.max(b.val > 0 ? 6 : 0, b.pct)}%` }} />
                              </div>
                              <span className={`w-6 text-right font-semibold ${b.text} tabular-nums`}>{b.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 bg-[#f8fafc] border-t border-[#cbd5e1] flex items-center justify-between shrink-0">
            <span className="text-xs text-[#64748b]">Trực quan hóa cơ cấu nhân lực tự động theo màu xanh #0072BC và đỏ #ED1C24 của HCM-UTE.</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#0072BC] text-white hover:bg-[#005c96] transition-colors cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Trở lại</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-[#004776] border border-[#cbd5e1] hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Đóng biểu đồ
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
