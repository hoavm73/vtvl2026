'use client';

import React from 'react';
import Link from 'next/link';
import { Search, Filter, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { UNIT_GROUPS } from '@/configs/hcmute-units';
import { UnitSummaryRow, MonitorTotals } from './UnitMonitoringTypes';

interface UnitMonitoringTableProps {
  selectedUnit: string;
  selectedGroup: string;
  stageFilter: string;
  searchQuery: string;
  includeTest: boolean;
  totals: MonitorTotals;
  filteredUnitRows: UnitSummaryRow[];
  onSelectUnit: (unitCode: string) => void;
  onSelectGroup: (group: string) => void;
  onChangeStageFilter: (stage: string) => void;
  onChangeSearch: (q: string) => void;
  onToggleIncludeTest: (val: boolean) => void;
}

export function UnitMonitoringTable({
  selectedUnit,
  selectedGroup,
  stageFilter,
  searchQuery,
  includeTest,
  totals,
  filteredUnitRows,
  onSelectUnit,
  onSelectGroup,
  onChangeStageFilter,
  onChangeSearch,
  onToggleIncludeTest
}: UnitMonitoringTableProps) {
  return (
    <div className="space-y-4">
      {/* 6 Thẻ số liệu KPI trọng yếu */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#f8fbff] border border-[#dbe8f5] space-y-1">
          <div className="text-[11px] font-bold text-[#476885]">Tổng phiếu kê khai</div>
          <div className="text-2xl font-extrabold text-[#004776]">{totals.totalTickets}</div>
          <div className="text-[11px] text-[#0072BC] font-semibold">
            {selectedUnit === 'ALL' ? `${totals.unitsWithTickets}/39 đơn vị đã tạo phiếu` : `Đơn vị [${selectedUnit}]`}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#f8fafc] border border-[#cbd5e1] space-y-1">
          <div className="text-[11px] font-bold text-[#476885]">Đang lưu nháp</div>
          <div className="text-2xl font-extrabold text-[#004776]">{totals.draftCount}</div>
          <div className="text-[11px] text-[#476885]">Phiếu Nháp cá nhân</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1">
          <div className="text-[11px] font-bold text-[#0072BC]">Đã gửi chờ duyệt</div>
          <div className="text-2xl font-extrabold text-[#0072BC]">{totals.submittedCount}</div>
          <div className="text-[11px] text-[#004776]">
            Nộp mới &amp; nộp lại ({totals.resubmittedCount} nộp lại)
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
          <div className="text-[11px] font-bold text-amber-800">Yêu cầu bổ sung</div>
          <div className="text-2xl font-extrabold text-amber-700">{totals.changesRequestedCount}</div>
          <div className="text-[11px] text-amber-800">Đang chờ cán bộ chỉnh sửa</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
          <div className="text-[11px] font-bold text-emerald-800">Đã phê duyệt</div>
          <div className="text-2xl font-extrabold text-emerald-700">{totals.approvedCount}</div>
          <div className="text-[11px] text-emerald-800">Sẵn sàng gộp vào biểu</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-1">
          <div className="text-[11px] font-bold text-purple-900">Đã gộp B1/B2</div>
          <div className="text-2xl font-extrabold text-purple-800">{totals.mergedCount}</div>
          <div className="text-[11px] text-purple-900">{totals.totalAccounts} tài khoản nhân sự</div>
        </div>
      </div>

      {/* Thanh công cụ lọc chi tiết Khối đơn vị, Trạng thái tiến trình & Tìm kiếm */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f8fbff] p-3.5 rounded-2xl border border-[#dbe8f5]">
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-[#0072BC] mr-1" />
          <button
            type="button"
            onClick={() => onSelectGroup('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
              selectedGroup === 'ALL' ? 'bg-[#004776] text-white' : 'bg-white text-[#004776] border border-[#cbd5e1]'
            }`}
          >
            Tất cả khối
          </button>
          {UNIT_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                selectedGroup === g.id ? 'bg-[#004776] text-white' : 'bg-white text-[#004776] border border-[#cbd5e1]'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Lọc theo trạng thái tiến trình"
            value={stageFilter}
            onChange={(e) => onChangeStageFilter(e.target.value)}
            className="h-9 px-2.5 rounded-xl border border-[#cbd5e1] bg-white text-xs font-semibold text-[#004776]"
          >
            <option value="ALL">Mọi trạng thái tiến trình</option>
            <option value="has_pending">Đơn vị có phiếu gửi chờ duyệt</option>
            <option value="has_draft">Đơn vị có phiếu lưu nháp</option>
            <option value="has_changes">Đơn vị có phiếu yêu cầu bổ sung</option>
            <option value="has_approved">Đơn vị có phiếu đã duyệt</option>
            <option value="has_merged">Đơn vị đã gộp B1/B2</option>
            <option value="empty">Đơn vị chưa có phiếu kê khai</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onChangeSearch(e.target.value)}
              placeholder="Tìm mã hoặc tên đơn vị..."
              className="h-9 pl-8 pr-3 rounded-xl border border-[#cbd5e1] bg-white text-xs text-[#004776] outline-hidden focus:border-[#0072BC]"
            />
          </div>

          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004776] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeTest}
              onChange={(e) => onToggleIncludeTest(e.target.checked)}
              className="rounded border-[#cbd5e1]"
            />
            <span>Kèm phiếu thử lịch sử (CK)</span>
          </label>
        </div>
      </div>

      {/* Bảng theo dõi tiến trình 39 đơn vị */}
      <div className="rounded-2xl border border-[#dbe8f5] overflow-hidden">
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#f1f6fc] text-[#004776] sticky top-0 z-10 border-b border-[#dbe8f5]">
              <tr>
                <th className="py-2.5 px-3 font-bold">Đơn vị ({filteredUnitRows.length})</th>
                <th className="py-2.5 px-3 font-bold">Tiến trình &amp; Mức độ</th>
                <th className="py-2.5 px-2.5 font-bold text-center">Lưu nháp</th>
                <th className="py-2.5 px-2.5 font-bold text-center">Gửi duyệt</th>
                <th className="py-2.5 px-2.5 font-bold text-center">Cần sửa</th>
                <th className="py-2.5 px-2.5 font-bold text-center">Đã duyệt</th>
                <th className="py-2.5 px-2.5 font-bold text-center">Đã gộp B1/B2</th>
                <th className="py-2.5 px-2.5 font-bold text-center">Biểu đã nhập</th>
                <th className="py-2.5 px-2.5 font-bold text-center">Nhân sự</th>
                <th className="py-2.5 px-3 font-bold text-right">Thao tác nhanh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef3f8]">
              {filteredUnitRows.map((u) => {
                const isSelected = selectedUnit === u.unitCode;
                return (
                  <tr
                    key={u.unitCode}
                    className={`hover:bg-[#f4f9ff] transition-colors ${isSelected ? 'bg-[#eef6ff]' : 'bg-white'}`}
                  >
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => onSelectUnit(isSelected ? 'ALL' : u.unitCode)}
                        className="text-left group cursor-pointer"
                      >
                        <div className="font-bold text-[#004776] group-hover:text-[#0072BC]">
                          [{u.unitCode}] {u.unitNameVi}
                        </div>
                        <div className="text-[11px] text-[#476885]">{u.groupLabel}</div>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 min-w-[165px]">
                      <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                        <span>{u.stageLabel}</span>
                        <span className="text-[#0072BC]">{u.progressPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#e2e8f0] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#0072BC] to-emerald-500 rounded-full"
                          style={{ width: `${u.progressPercent}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-bold">
                      {u.draftCount > 0 ? <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[#004776]">{u.draftCount}</span> : '0'}
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-bold">
                      {u.submittedCount > 0 ? <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#0072BC]">{u.submittedCount}</span> : '0'}
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-bold">
                      {u.changesRequestedCount > 0 ? <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">{u.changesRequestedCount}</span> : '0'}
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-bold">
                      {u.approvedCount > 0 ? <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">{u.approvedCount}</span> : '0'}
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-bold">
                      {u.mergedCount > 0 ? <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800">{u.mergedCount}</span> : '0'}
                    </td>
                    <td className="py-2.5 px-2.5 text-center font-semibold text-[#335d84]">
                      {u.populatedSheetsCount}/{u.totalCoreSheets} biểu (v{u.workbookRevision})
                    </td>
                    <td className="py-2.5 px-2.5 text-center text-[11px] text-[#476885]">
                      <strong>{u.accountCount}</strong> ({u.leaderCount} LĐ / {u.staffCount} CB)
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectUnit(isSelected ? 'ALL' : u.unitCode)}
                        className="px-2.5 py-1 rounded-lg bg-[#e1edf8] hover:bg-[#0072BC] text-[#004776] hover:text-white text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        {isSelected ? 'Bỏ lọc' : 'Lọc đơn vị'}
                      </button>
                      <Link
                        href={`/phieu-cong-viec?unitCode=${encodeURIComponent(u.unitCode)}&tab=unit`}
                        onClick={() => {
                          if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', u.unitCode);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-[11px] font-bold text-[#004776]"
                      >
                        <span>Phiếu</span>
                        <ExternalLink className="w-3 h-3 text-[#0072BC]" />
                      </Link>
                      <Link
                        href="/bang-tinh"
                        onClick={() => {
                          if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', u.unitCode);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-[11px] font-bold text-[#004776]"
                      >
                        <FileSpreadsheet className="w-3 h-3 text-[#0072BC]" />
                        <span>15 biểu</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
