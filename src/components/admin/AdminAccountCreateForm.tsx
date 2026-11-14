'use client';

import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { Button } from '@/components/ui/Button';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { UserRole, ROLE_OPTIONS, getRoleLabel } from '@/services/auth/account-client';

interface AdminAccountCreateFormProps {
  unitOptions: { value: string; label: string }[];
  currentUserRole?: UserRole;
  currentUserUnit?: string;
  onCreated: (message: string) => void;
  onError: (message: string) => void;
}

export function AdminAccountCreateForm({
  unitOptions,
  currentUserRole,
  currentUserUnit,
  onCreated,
  onError
}: AdminAccountCreateFormProps) {
  const isLeader = currentUserRole === 'unit_leader';
  const initialUnit = isLeader && currentUserUnit ? currentUserUnit : 'CNTT';
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [unitCode, setUnitCode] = useState(initialUnit);
  const [role, setRole] = useState<UserRole>('staff');
  const [creating, setCreating] = useState(false);

  const availableRoles = isLeader
    ? ROLE_OPTIONS.filter((r) => r.value !== 'admin')
    : ROLE_OPTIONS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setCreating(true);
    try {
      const cur = getCurrentOperatorSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cur?.accessToken) headers.Authorization = `Bearer ${cur.accessToken}`;
      if (cur?.email) headers['x-actor-email'] = cur.email;

      const targetUnit = isLeader && currentUserUnit ? currentUserUnit : unitCode;
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim() || undefined,
          unitCode: targetUnit,
          title: getRoleLabel(role),
          role
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(json.error || 'Không thể thêm tài khoản.');
      } else {
        setEmail('');
        setDisplayName('');
        onCreated(`Đã lưu tài khoản ${json.account.email} với vai trò ${getRoleLabel(json.account.role)}.`);
      }
    } catch {
      onError('Lỗi kết nối khi lưu tài khoản mới.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 sm:p-5 rounded-2xl bg-[#f8fbff] border border-[#d8e3ef] space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#004776] text-white flex items-center justify-center shrink-0">
          <UserPlus className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[#004776]">Cấp tài khoản và phân quyền nhanh</h2>
          <p className="text-xs text-[#476885]">
            Khai báo trước tài khoản @hcmute.edu.vn hoặc cập nhật vai trò ngay bên dưới
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email công vụ @hcmute.edu.vn"
          className="h-10 px-3 text-xs bg-white border border-[#cbd5e1] rounded-lg text-[#004776] font-medium focus:ring-2 focus:ring-[#004776]/25 focus:outline-none"
        />
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Họ và tên cán bộ"
          className="h-10 px-3 text-xs bg-white border border-[#cbd5e1] rounded-lg text-[#004776] font-medium focus:ring-2 focus:ring-[#004776]/25 focus:outline-none"
        />
        <ShadcnSelect
          value={isLeader && currentUserUnit ? currentUserUnit : unitCode}
          onValueChange={setUnitCode}
          options={unitOptions}
          searchable={true}
          size="md"
          disabled={isLeader}
        />
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <ShadcnSelect
              value={role}
              onValueChange={(v) => setRole(v as UserRole)}
              options={availableRoles.map((r) => ({ value: r.value, label: r.label }))}
              size="md"
            />
          </div>
          <Button type="submit" variant="slink" size="default" disabled={creating} className="shrink-0">
            {creating ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </div>
    </form>
  );
}

