'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { Badge } from '@/components/ui/Badge';
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
  isUpdating: boolean;
  currentUserRole?: UserRole;
  onUpdate: (
    account: UserAccountRecord,
    patch: { role?: UserRole; unitCode?: string; title?: string; status?: 'active' | 'suspended' }
  ) => void;
  onDelete: (email: string) => void;
}

export function AdminAccountRow({
  account: acc,
  index,
  unitOptions,
  isUpdating,
  currentUserRole,
  onUpdate,
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

