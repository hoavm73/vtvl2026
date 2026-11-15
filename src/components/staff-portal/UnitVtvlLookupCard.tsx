'use client';

import React, { useState, useMemo } from 'react';
import { Search, Briefcase, ChevronRight, CheckCircle2, Filter, Layers, Clock } from 'lucide-react';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { buildDefaultProposedPositionsForUnit } from '@/configs/hcmute-nd232-catalog';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { UnitGroupKind } from '@/types/vtvl';

export interface UnitVtvlItem {
  maVtvl: string;
  tenVtvl: string;
  nhomVtvl: string;
  ngachCode?: string;
  dinhMucGio?: number;
  careerLevel?: string;
  soNguoi?: number;
}

interface UnitVtvlLookupCardProps {
  unitCode: string;
  c1Vtvls: GenericGridRow[];
  onSelectVtvl?: (maVtvl: string) => void;
}

export function UnitVtvlLookupCard({ unitCode, c1Vtvls, onSelectVtvl }: UnitVtvlLookupCardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');

  const unit = useMemo(() => findHcmuteUnit(unitCode), [unitCode]);

  // Chuẩn hóa danh sách VTVL từ Biểu C1 hoặc cấu hình mẫu NĐ 232 của đơn vị
  const vtvlList = useMemo<UnitVtvlItem[]>(() => {
    if (c1Vtvls && c1Vtvls.length > 0) {
      return c1Vtvls.map((row) => ({
        maVtvl: String(row.maVtvl || row.maVTVL || row.stt || '').trim(),
        tenVtvl: String(row.tenVtvl || row.tenVTVL || row.viTriViecLam || 'Vị trí chưa đặt tên').trim(),
        nhomVtvl: String(row.nhomVtvl || row.nhom || 'Chuyên môn, nghiệp vụ').trim(),
        ngachCode: String(row.ngachCode || row.maNgach || '').trim(),
        dinhMucGio: Number(row.dinhMucGio || row.dinhMuc || 1904),
        careerLevel: String(row.careerLevel || row.bacNgheNghiep || '').trim(),
        soNguoi: Number(row.soNguoi || row.staffCount || 1)
      })).filter((item) => item.maVtvl || item.tenVtvl);
    }

    // Dự phòng chuẩn từ khung 38 VTVL NĐ 232 cho đơn vị
    const defaults = buildDefaultProposedPositionsForUnit(unit.nameVi, (unit.group || 'khoa-vien') as UnitGroupKind);
    return defaults.map((p) => ({
      maVtvl: `${unitCode}-${p.vtvlSuffix}`,
      tenVtvl: p.specificName || p.frameworkTitle,
      nhomVtvl: p.vtvlGroup4,
      ngachCode: p.ngachCode,
      dinhMucGio: p.standardHoursYear || 1904,
      careerLevel: p.careerLevel,
      soNguoi: p.staffCount || 1
    }));
  }, [c1Vtvls, unitCode]);

  // Bộ lọc tìm kiếm và nhóm
  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return vtvlList.filter((item) => {
      const matchSearch =
        !q ||
        item.maVtvl.toLowerCase().includes(q) ||
        item.tenVtvl.toLowerCase().includes(q) ||
        (item.ngachCode && item.ngachCode.toLowerCase().includes(q)) ||
        item.nhomVtvl.toLowerCase().includes(q);

      if (!matchSearch) return false;
      if (selectedGroup === 'all') return true;
      if (selectedGroup === 'quan-ly') return item.nhomVtvl.toLowerCase().includes('quản lý');
      if (selectedGroup === 'chuyen-mon') return item.nhomVtvl.toLowerCase().includes('chuyên môn') || item.nhomVtvl.toLowerCase().includes('nghiệp vụ');
      if (selectedGroup === 'ho-tro') return item.nhomVtvl.toLowerCase().includes('hỗ trợ') || item.nhomVtvl.toLowerCase().includes('phục vụ');
      return true;
    });
  }, [vtvlList, searchTerm, selectedGroup]);

  return (
    <div className="bg-white rounded-2xl border border-[#cbd5e1] p-4 sm:p-5 shadow-xs space-y-4">
      {/* Tiêu đề */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-[#e1edf8] text-[#0072BC]">
              <Briefcase className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-[#004776]">
              Danh mục vị trí việc làm của đơn vị [{unit.code}]
            </h3>
          </div>
          <p className="text-xs text-[#476885]">
            Tra cứu chức danh, mã ngạch và chọn kê khai phiếu khối lượng công việc
          </p>
        </div>
        <span className="inline-flex items-center self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-bold bg-[#eef5fc] text-[#0072BC] border border-[#d8e3ef]">
          {filteredList.length} / {vtvlList.length} VTVL
        </span>
      </div>

      {/* Thanh tìm kiếm & lọc nhanh */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#476885]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên VTVL, mã hiệu, ngạch chức danh..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-[#cbd5e1] bg-[#f8fbff] text-xs text-[#004776] placeholder-[#94a3b8] focus:outline-none focus:border-[#0072BC] focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setSelectedGroup('all')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              selectedGroup === 'all'
                ? 'bg-[#004776] text-white'
                : 'bg-[#f1f5f9] text-[#476885] hover:bg-[#e2e8f0]'
            }`}
          >
            Tất cả ({vtvlList.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedGroup('quan-ly')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              selectedGroup === 'quan-ly'
                ? 'bg-[#004776] text-white'
                : 'bg-[#f1f5f9] text-[#476885] hover:bg-[#e2e8f0]'
            }`}
          >
            Quản lý
          </button>
          <button
            type="button"
            onClick={() => setSelectedGroup('chuyen-mon')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              selectedGroup === 'chuyen-mon'
                ? 'bg-[#004776] text-white'
                : 'bg-[#f1f5f9] text-[#476885] hover:bg-[#e2e8f0]'
            }`}
          >
            Chuyên môn
          </button>
          <button
            type="button"
            onClick={() => setSelectedGroup('ho-tro')}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              selectedGroup === 'ho-tro'
                ? 'bg-[#004776] text-white'
                : 'bg-[#f1f5f9] text-[#476885] hover:bg-[#e2e8f0]'
            }`}
          >
            Hỗ trợ & phục vụ
          </button>
        </div>
      </div>

      {/* Danh sách cuộn */}
      <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
        {filteredList.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#476885] bg-[#f8fafc] rounded-xl border border-dashed border-[#cbd5e1]">
            Không tìm thấy vị trí việc làm phù hợp với từ khóa tra cứu.
          </div>
        ) : (
          filteredList.map((item, idx) => (
            <div
              key={`${item.maVtvl}-${idx}`}
              className="p-3 rounded-xl border border-[#e2e8f0] bg-[#f8fbff] hover:bg-white hover:border-[#0072BC] transition-all space-y-2 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#e1edf8] text-[#004776]">
                      {item.maVtvl}
                    </span>
                    {item.ngachCode && (
                      <span className="px-1.5 py-0.5 rounded text-[10.5px] font-medium bg-[#f1f5f9] text-[#476885]">
                        Ngạch: {item.ngachCode}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-[#004776] pt-0.5 leading-snug">
                    {item.tenVtvl}
                  </h4>
                </div>

                {onSelectVtvl && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectVtvl(item.maVtvl);
                      // Cuộn nhẹ lên form kê khai nếu cần
                      const formEl = document.getElementById('staff-ticket-form-card');
                      if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-[#0072BC] hover:bg-[#004776] text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    title="Chọn vị trí này để kê khai phiếu"
                  >
                    <span>Kê khai</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#476885] pt-1 border-t border-[#eef3f8]">
                <span className="truncate max-w-[200px]">{item.nhomVtvl}</span>
                <span className="inline-flex items-center gap-1 text-[#0072BC] font-medium shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>{item.dinhMucGio || 1904}h/năm</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
