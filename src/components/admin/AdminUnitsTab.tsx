'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2, Search, PlusCircle, RotateCcw, Edit2, Trash2,
  CheckCircle2, Filter
} from 'lucide-react';
import { HcmuteUnit, UnitGroupKind } from '@/types/vtvl';
import {
  getAdminUnits,
  deleteAdminUnit,
  resetAdminUnitsToDefault,
  subscribeToUnitsChange,
  syncUnitsWithServer
} from '@/services/units/unit-management';
import { AdminUnitEditModal } from './AdminUnitEditModal';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { useQueryFilter } from '@/services/query/use-query-filter';

const GROUP_LABELS: Record<UnitGroupKind, string> = {
  'khoa-vien': 'Khoa - Viện đào tạo',
  'phong-ban': 'Phòng ban quản lý',
  'trung-tam': 'Trung tâm - Phân hiệu',
  'dang-doanthe': 'Quản trị - Đoàn thể'
};

export function AdminUnitsTab() {
  const [units, setUnits] = useState<HcmuteUnit[]>([]);
  const [editingUnit, setEditingUnit] = useState<HcmuteUnit | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadUnits = () => {
    setUnits(getAdminUnits());
  };

  useEffect(() => {
    loadUnits();
    syncUnitsWithServer().then((remoteUnits) => {
      if (Array.isArray(remoteUnits) && remoteUnits.length > 0) setUnits(remoteUnits);
    });
    const unsubscribe = subscribeToUnitsChange((updated) => {
      setUnits(updated);
    });
    return () => unsubscribe();
  }, []);

  const { params, setParam, data: filtered } = useQueryFilter<
    HcmuteUnit,
    { uq: string; ugroup: string }
  >({
    queryKey: ['admin-units'],
    initialParams: { uq: '', ugroup: 'all' },
    data: units,
    syncUrl: true,
    queryFn: ({ params: p, data }) =>
      data.filter((u) => {
        const q = p.uq.trim().toLowerCase();
        const matchSearch =
          !q ||
          u.code.toLowerCase().includes(q) ||
          u.nameVi.toLowerCase().includes(q) ||
          (u.nameEn && u.nameEn.toLowerCase().includes(q));
        const matchGroup = p.ugroup === 'all' || u.group === p.ugroup;
        return matchSearch && matchGroup;
      })
  });

  const handleEdit = (unit: HcmuteUnit) => {
    setEditingUnit(unit);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingUnit(null);
    setIsModalOpen(true);
  };

  const handleDelete = (code: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa đơn vị [${code}]? Mọi bảng biểu sẽ không còn nhận diện mã này.`)) {
      deleteAdminUnit(code);
      loadUnits();
    }
  };

  const handleResetToDefault = () => {
    if (confirm('Khôi phục danh mục về 51 đơn vị chuẩn gốc của HCM-UTE? Các đơn vị thêm mới hoặc sửa đổi sẽ bị hoàn tác.')) {
      resetAdminUnitsToDefault();
      loadUnits();
    }
  };

  return (
    <div className="space-y-3 min-w-0">
      {/* 5. Command bar gộp Tìm kiếm, Bộ lọc và Thao tác */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 min-h-[48px] sm:min-h-[52px]">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[220px] w-full sm:w-auto">
          <div className="relative flex-1 min-w-[180px] sm:max-w-md w-full sm:w-auto">
            <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={params.uq}
              onChange={(e) => setParam('uq', e.target.value)}
              placeholder="Tìm theo mã đơn vị hoặc tên đơn vị..."
              className="w-full h-10 pl-9 pr-3 text-sm sm:text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#004776] font-medium focus:ring-2 focus:ring-[#004776] focus:outline-none"
            />
          </div>

          <div className="relative flex items-center w-full sm:w-56">
            <ShadcnSelect
              value={params.ugroup}
              onValueChange={(v) => setParam('ugroup', v)}
              options={[
                { value: 'all', label: `Tất cả các khối (${units.length})` },
                { value: 'khoa-vien', label: 'Khoa & Viện đào tạo' },
                { value: 'phong-ban', label: 'Phòng ban quản lý' },
                { value: 'trung-tam', label: 'Trung tâm & Phân hiệu' },
                { value: 'dang-doanthe', label: 'Quản trị & Đảng – Đoàn thể' }
              ]}
              size="md"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="h-10 inline-flex items-center justify-center gap-1.5 px-3 text-xs font-semibold text-[#64748b] hover:text-[#004776] hover:bg-[#f1f5f9] border border-[#cbd5e1] rounded-xl transition-colors cursor-pointer"
            title="Khôi phục danh mục về 51 đơn vị chuẩn gốc của HCM-UTE"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>Khôi phục 51 đơn vị chuẩn</span>
          </button>

          <button
            type="button"
            onClick={handleCreate}
            className="h-10 inline-flex items-center justify-center gap-1.5 px-3.5 text-xs font-bold text-white bg-[#004776] hover:bg-[#00385c] rounded-xl transition-colors cursor-pointer shadow-2xs flex-1 sm:flex-initial"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Thêm đơn vị mới</span>
          </button>
        </div>
      </div>

      {/* 6. Status row rút gọn mỏng ngay phía trên bảng */}
      <div className="flex items-center justify-between gap-2 px-1 py-1 text-xs text-[#004776] min-h-[32px] sm:min-h-[36px]">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="text-xs font-medium text-[#004776]">
            Đồng bộ thời gian thực với dropdown và công thức của 15 bảng tính
          </span>
        </div>
        <span className="font-bold text-[11px] text-[#64748b] bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 shrink-0">
          {filtered.length}/{units.length} đơn vị
        </span>
      </div>

      {/* 7. Ưu tiên Bảng dữ liệu: Đưa lên cao, sticky header, row height 48-52px */}
      <div className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[650px] relative">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[#f8fafc] shadow-2xs">
              <tr className="border-b border-[#cbd5e1]">
                <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] w-12 text-center bg-[#f8fafc]">STT</th>
                <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] w-28 bg-[#f8fafc]">Mã đơn vị</th>
                <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] bg-[#f8fafc]">Tên tiếng Việt</th>
                <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] bg-[#f8fafc]">Khối phân nhóm</th>
                <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] bg-[#f8fafc]">Người đứng đầu</th>
                <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] text-center w-24 bg-[#f8fafc]">Định biên</th>
                <th className="p-3 font-bold text-[#004776] text-center w-28 sticky right-0 bg-[#f8fafc] border-l border-[#cbd5e1]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, idx) => (
                <tr key={u.code} className="h-[48px] sm:h-[50px] border-b border-[#cbd5e1]/70 hover:bg-blue-50/30 transition-colors">
                  <td className="p-2.5 text-center text-[#64748b] font-medium border-r border-[#cbd5e1] bg-[#f8fafc]/50">
                    {idx + 1}
                  </td>
                  <td className="p-2.5 font-bold border-r border-[#cbd5e1]">
                    <span className="inline-block px-2 py-0.5 rounded bg-[#004776]/10 text-[#004776] font-bold text-xs">
                      {u.code}
                    </span>
                  </td>
                  <td className="p-2.5 font-semibold text-[#004776] border-r border-[#cbd5e1]">
                    <div>{u.nameVi}</div>
                    {u.nameEn && (
                      <div className="text-[11px] font-normal text-[#64748b] mt-0.5">{u.nameEn}</div>
                    )}
                  </td>
                  <td className="p-2.5 text-[#64748b] border-r border-[#cbd5e1]">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-[#004776] border border-slate-200">
                      {GROUP_LABELS[u.group] || u.group}
                    </span>
                  </td>
                  <td className="p-2.5 text-[#004776] border-r border-[#cbd5e1]">
                    {u.headTitleVi || 'Trưởng đơn vị'}
                  </td>
                  <td className="p-2.5 text-center font-bold text-[#004776] border-r border-[#cbd5e1]">
                    {u.defaultStaffCount || 10}
                  </td>
                  <td className="p-2.5 text-center sticky right-0 bg-white/95 backdrop-blur-xs border-l border-[#cbd5e1]/60">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEdit(u)}
                        className="p-1.5 text-[#004776] hover:bg-[#e2e8f0] rounded-lg transition-colors cursor-pointer border border-[#cbd5e1]"
                        title="Chỉnh sửa đơn vị"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(u.code)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-red-200"
                        title="Xóa đơn vị"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm / Chỉnh sửa */}
      <AdminUnitEditModal
        isOpen={isModalOpen}
        unit={editingUnit}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadUnits}
      />
    </div>
  );
}

