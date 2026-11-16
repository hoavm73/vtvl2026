'use client';

import React from 'react';
import { Briefcase, Trash2 } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { Badge } from '@/components/ui/Badge';
import { UserVtvlAssignment } from '@/types/staff-ticket';
import {
  UserRole,
  UserAccountRecord,
  ROLE_OPTIONS,
  getRoleLabel,
  getRoleBadgeVariant
} from '@/services/auth/account-client';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'suspended', label: 'Tạm khóa' }
];

interface AdminAccountRowProps {
  account: UserAccountRecord;
  index: number;
  unitOptions: { value: string; label: string }[];
  assignedVtvls: UserVtvlAssignment[];
  isUpdating: boolean;
  currentUserRole?: UserRole;
  onUpdate: (
    account: UserAccountRecord,
    patch: { role?: UserRole; unitCode?: string; title?: string; status?: 'active' | 'suspended' }
  ) => void;
  onOpenAssignVtvl: (account: UserAccountRecord) => void;
  onDelete: (email: string) => void;
}

export function AdminAccountRow({
  account: acc,
  index,
  unitOptions,
  assignedVtvls,
  isUpdating,
  currentUserRole,
  onUpdate,
  onOpenAssignVtvl,
  onDelete
}: AdminAccountRowProps) {
  const isLeader = currentUserRole === 'unit_leader';
  const isRootAdmin = acc.email === 'tcns@hcmute.edu.vn';
  const cannotEdit = isRootAdmin || (isLeader && acc.role === 'admin');

  const availableRoles = isLeader
    ? ROLE_OPTIONS.filter((r) => r.value !== 'admin')
    : ROLE_OPTIONS;

  return (
    <tr className="border-b border-[#e2e8f0] hover:bg-[#f5f9ff]/60 transition-colors">
      <td className="p-2.5 text-center font-medium text-[#476885] border-r border-[#e2e8f0]">{index + 1}</td>
      <td className="p-2.5 border-r border-[#e2e8f0]">
        <div className="flex items-center gap-2.5 min-w-0">
          {acc.avatarUrl ? (
            <img src={acc.avatarUrl} alt={acc.displayName} className="w-8 h-8 rounded-full object-cover shrink-0 border border-[#cbd5e1]" />
          ) : (
            <span className="w-8 h-8 rounded-full bg-[#004776] text-white text-[11px] font-bold inline-flex items-center justify-center shrink-0">
              {(acc.displayName || acc.email).slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-[#004776] truncate">{acc.displayName}</span>
              <Badge variant={getRoleBadgeVariant(acc.role)} className="text-[10px] px-1.5 py-0">
                {acc.authProvider === 'google' ? 'Google' : 'Phiên'}
              </Badge>
            </div>
            <div className="text-[11px] text-[#476885] truncate">{acc.email}</div>
          </div>
        </div>
      </td>
      <td className="p-2.5 border-r border-[#e2e8f0]">
        <ShadcnSelect
          value={acc.unitCode}
          onValueChange={(val) => onUpdate(acc, { unitCode: val })}
          options={unitOptions}
          searchable={true}
          size="sm"
          disabled={isUpdating || isLeader}
        />
      </td>
      <td className="p-2.5 border-r border-[#e2e8f0]">
        <div className="flex flex-wrap items-center gap-1.5">
          {assignedVtvls.length > 0 ? (
            assignedVtvls.map((v) => (
              <span
                key={v.id}
                title={v.tenVtvl || v.maVtvl}
                className="px-2 py-0.5 rounded-full bg-[#e1edf8] border border-[#bfdbfe] text-[#004776] text-[10px] font-bold"
              >
                {v.maVtvl}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-[#64748b] italic">Chưa gán VTVL</span>
          )}
          <button
            type="button"
            disabled={isUpdating || (isLeader && acc.role === 'admin')}
            onClick={() => onOpenAssignVtvl(acc)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-[#bfdbfe] bg-white hover:bg-[#eff8ff] text-[#006cee] text-[11px] font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Briefcase className="w-3 h-3" />
            <span>Gán VTVL</span>
          </button>
        </div>
      </td>
      <td className="p-2.5 border-r border-[#e2e8f0]">
        <ShadcnSelect
          value={acc.role}
          onValueChange={(val) => {
            const nextRole = val as UserRole;
            onUpdate(acc, { role: nextRole, title: getRoleLabel(nextRole) });
          }}
          options={availableRoles.map((r) => ({ value: r.value, label: r.label }))}
          size="sm"
          disabled={isUpdating || cannotEdit}
        />
      </td>
      <td className="p-2.5 border-r border-[#e2e8f0]">
        <ShadcnSelect
          value={acc.status || 'active'}
          onValueChange={(val) => onUpdate(acc, { status: val as 'active' | 'suspended' })}
          options={STATUS_OPTIONS}
          size="sm"
          disabled={isUpdating || cannotEdit}
        />
      </td>
      <td className="p-2.5 text-center">
        <button
          type="button"
          disabled={cannotEdit || isUpdating}
          onClick={() => onDelete(acc.email)}
          title={isRootAdmin ? 'Không thể xóa tài khoản quản trị gốc' : cannotEdit ? 'Lãnh đạo đơn vị không thể xóa tài khoản Quản trị viên' : 'Xóa tài khoản'}
          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 border border-red-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

