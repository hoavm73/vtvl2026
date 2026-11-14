'use client';

import React, { useState, useEffect } from 'react';
import { X, Building2, Save, AlertCircle } from 'lucide-react';
import { HcmuteUnit, UnitGroupKind } from '@/types/vtvl';
import { saveAdminUnit } from '@/services/units/unit-management';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';

interface AdminUnitEditModalProps {
  isOpen: boolean;
  unit: HcmuteUnit | null;
  onClose: () => void;
  onSaved: () => void;
}

const UNIT_GROUPS_OPTIONS: { id: UnitGroupKind; label: string }[] = [
  { id: 'khoa-vien', label: 'Khối Đơn vị đào tạo (Khoa & Viện)' },
  { id: 'phong-ban', label: 'Khối Đơn vị quản lý HC (Phòng ban)' },
  { id: 'trung-tam', label: 'Khối Trung tâm chức năng & Phân hiệu' },
  { id: 'dang-doanthe', label: 'Khối Quản trị & Đảng – Đoàn thể' }
];

export function AdminUnitEditModal({
  isOpen, unit, onClose, onSaved
}: AdminUnitEditModalProps) {
  const isEditing = Boolean(unit);

  const [code, setCode] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [group, setGroup] = useState<UnitGroupKind>('phong-ban');
  const [headTitleVi, setHeadTitleVi] = useState('Trưởng phòng');
  const [headTitleEn, setHeadTitleEn] = useState('Director');
  const [defaultStaffCount, setDefaultStaffCount] = useState(15);
  const [error, setError] = useState('');

  useEffect(() => {
    if (unit) {
      setCode(unit.code);
      setNameVi(unit.nameVi);
      setNameEn(unit.nameEn || '');
      setGroup(unit.group);
      setHeadTitleVi(unit.headTitleVi || 'Trưởng phòng');
      setHeadTitleEn(unit.headTitleEn || 'Director');
      setDefaultStaffCount(unit.defaultStaffCount || 15);
    } else {
      setCode('');
      setNameVi('');
      setNameEn('');
      setGroup('phong-ban');
      setHeadTitleVi('Trưởng phòng');
      setHeadTitleEn('Director');
      setDefaultStaffCount(15);
    }
    setError('');
  }, [unit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const cleanNameVi = nameVi.trim();

    if (!cleanCode) {
      setError('Mã đơn vị không được để trống.');
      return;
    }
    if (!cleanNameVi) {
      setError('Tên tiếng Việt của đơn vị không được để trống.');
      return;
    }

    const payload: HcmuteUnit = {
      code: cleanCode,
      nameVi: cleanNameVi,
      nameEn: nameEn.trim() || cleanNameVi,
      group,
      domain: `${cleanCode.toLowerCase()}.hcmute.edu.vn`,
      headTitleVi: headTitleVi.trim() || 'Trưởng đơn vị',
      headTitleEn: headTitleEn.trim() || 'Head of Department',
      defaultStaffCount: Number(defaultStaffCount) || 10
    };

    saveAdminUnit(payload, unit ? unit.code : undefined);
    onSaved();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none"
    >
      <div className="relative w-full max-w-lg max-h-[92dvh] sm:max-h-[88dvh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#cbd5e1] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 bg-[#005fa3] text-white shrink-0 border-b border-[#004776]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#004776] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isEditing ? `Chỉnh sửa đơn vị [${unit?.code}]` : 'Thêm đơn vị mới'}
              </h3>
              <p className="text-[11px] text-white/90">
                Đồng bộ vào danh mục đơn vị trong toàn bộ 15 bảng tính
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-[#004776] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
          {isEditing && (
            <div className="p-2.5 bg-[#f0f7fd] border border-[#d0e4f5] rounded-xl text-xs text-[#004776] leading-relaxed">
              <span className="font-bold text-[#0072BC]">Đồng bộ tự động:</span> Khi thay đổi mã hoặc tên đơn vị, hệ thống sẽ tự động cập nhật toàn bộ mã nhiệm vụ ([MÃ_ĐV].NVxx), mã công việc ([Mã NV].CVxx), mã VTVL, công thức tính toán và dữ liệu trên 15 biểu.
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#004776]">Mã đơn vị *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VD: TCNS, CK, KHTN"
                className="w-full px-3 py-2 text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#004776] font-bold focus:ring-2 focus:ring-[#004776] focus:outline-none uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#004776]">Khối phân nhóm *</label>
              <ShadcnSelect
                value={group}
                onValueChange={(v) => setGroup(v as UnitGroupKind)}
                options={UNIT_GROUPS_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
                size="md"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#004776]">Tên tiếng Việt *</label>
            <input
              type="text"
              required
              value={nameVi}
              onChange={(e) => setNameVi(e.target.value)}
              placeholder="VD: Phòng Tổ chức - Nhân sự"
              className="w-full px-3 py-2 text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#004776] font-medium focus:ring-2 focus:ring-[#004776] focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-[#004776]">Tên tiếng Anh (Tùy chọn)</label>
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="VD: Office of Organization and Personnel"
              className="w-full px-3 py-2 text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#004776] font-medium focus:ring-2 focus:ring-[#004776] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#004776]">Chức danh người đứng đầu</label>
              <input
                type="text"
                value={headTitleVi}
                onChange={(e) => setHeadTitleVi(e.target.value)}
                placeholder="Trưởng phòng / Trưởng khoa"
                className="w-full px-3 py-2 text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#004776] font-medium focus:ring-2 focus:ring-[#004776] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-[#004776]">Định biên nhân sự mặc định</label>
              <input
                type="number"
                min={1}
                max={200}
                value={defaultStaffCount}
                onChange={(e) => setDefaultStaffCount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-[#004776] font-medium focus:ring-2 focus:ring-[#004776] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#cbd5e1]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#64748b] hover:bg-[#f1f5f9] rounded-xl transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#004776] hover:bg-[#00385c] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Lưu thay đổi' : 'Thêm & Đồng bộ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

