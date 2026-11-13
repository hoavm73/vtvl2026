'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, ShieldCheck, AlertCircle, CheckCircle2, Users } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { Button } from '@/components/ui/Button';
import { AdminAccountCreateForm } from '@/components/admin/AdminAccountCreateForm';
import { AdminAccountRow } from '@/components/admin/AdminAccountRow';
import { QD2266_GROUPED_UNITS_CATALOG } from '@/configs/hcmute-qd2266-missions';
import { getCurrentOperatorSession, saveCurrentOperatorSession } from '@/services/telemetry/operator-session';
import {
  UserRole,
  UserAccountRecord,
  ROLE_OPTIONS,
  getRoleLabel,
  adminUpdateUserRoleOnServer
} from '@/services/auth/account-client';

export function AdminAccountsTab() {
  const [accounts, setAccounts] = useState<UserAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const unitOptions = useMemo(
    () => QD2266_GROUPED_UNITS_CATALOG.flatMap((g) => g.units.map((u) => ({ value: u.code, label: `[${u.code}] ${u.nameVi}` }))),
    []
  );

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cur = getCurrentOperatorSession();
      const headers: Record<string, string> = {};
      if (cur?.accessToken) headers.Authorization = `Bearer ${cur.accessToken}`;
      if (cur?.email) headers['x-actor-email'] = cur.email;

      const res = await fetch('/api/admin/accounts', { headers, cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Không thể tải danh sách tài khoản.');
        setAccounts([]);
      } else {
        setAccounts(json.accounts || []);
      }
    } catch {
      setError('Lỗi kết nối mạng khi tải danh sách tài khoản.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const roleCounts = useMemo(() => {
    const counts: Record<UserRole, number> = { admin: 0, unit_leader: 0, editor: 0, viewer: 0 };
    accounts.forEach((a) => { counts[a.role] = (counts[a.role] || 0) + 1; });
    return counts;
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (roleFilter !== 'all' && acc.role !== roleFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        acc.email.toLowerCase().includes(q) ||
        acc.displayName.toLowerCase().includes(q) ||
        acc.unitCode.toLowerCase().includes(q) ||
        acc.unitNameVi.toLowerCase().includes(q)
      );
    });
  }, [accounts, roleFilter, searchQuery]);

  const handleUpdateAccount = async (
    target: UserAccountRecord,
    patch: { role?: UserRole; unitCode?: string; title?: string; status?: 'active' | 'suspended' }
  ) => {
    setUpdatingEmail(target.email);
    setFeedback(null);
    setError(null);
    const cur = getCurrentOperatorSession();
    const res = await adminUpdateUserRoleOnServer(
      {
        email: target.email,
        role: patch.role || target.role,
        unitCode: patch.unitCode || target.unitCode,
        title: patch.title ?? target.title,
        status: patch.status ?? target.status
      },
      cur
    );
    setUpdatingEmail(null);
    if (!res.ok || !res.account) {
      setError(res.error || 'Không thể cập nhật phân quyền.');
      return;
    }
    setAccounts((prev) => prev.map((a) => (a.email === res.account!.email ? res.account! : a)));
    if (cur && cur.email === res.account.email) {
      saveCurrentOperatorSession(res.account.email, res.account.unitCode, res.account.title, {
        displayName: res.account.displayName,
        avatarUrl: cur.avatarUrl,
        authProvider: cur.authProvider,
        accessToken: cur.accessToken,
        role: res.account.role
      });
    }
    setFeedback(`Đã cập nhật tài khoản ${res.account.email}: ${getRoleLabel(res.account.role)} · ${res.account.status === 'suspended' ? 'Tạm khóa' : 'Đang hoạt động'}.`);
  };

  const handleDeleteAccount = async (email: string) => {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản ${email} khỏi danh sách phân quyền?`)) return;
    const cur = getCurrentOperatorSession();
    const headers: Record<string, string> = {};
    if (cur?.accessToken) headers.Authorization = `Bearer ${cur.accessToken}`;
    if (cur?.email) headers['x-actor-email'] = cur.email;

    const res = await fetch(`/api/admin/accounts?email=${encodeURIComponent(email)}`, { method: 'DELETE', headers });
    if (res.ok) {
      setAccounts((prev) => prev.filter((a) => a.email !== email));
      setFeedback(`Đã xóa tài khoản ${email}.`);
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error || 'Không thể xóa tài khoản.');
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f4f7fb] border border-[#d8e3ef] text-xs font-bold text-[#004776]">
          <Users className="w-3.5 h-3.5" />
          <span>Tổng số: {accounts.length}</span>
        </span>
        {ROLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setRoleFilter((prev) => (prev === opt.value ? 'all' : opt.value))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              roleFilter === opt.value
                ? 'bg-[#004776] text-white border-[#004776]'
                : 'bg-white text-[#004776] border-[#d8e3ef] hover:bg-[#f4f7fb]'
            }`}
          >
            <span>{opt.label}: {roleCounts[opt.value] || 0}</span>
          </button>
        ))}
      </div>

      <AdminAccountCreateForm
        unitOptions={unitOptions}
        onCreated={async (msg) => { setError(null); setFeedback(msg); await loadAccounts(); }}
        onError={(msg) => { setFeedback(null); setError(msg); }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-[#476885] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo email, họ tên, mã đơn vị..."
              className="w-full h-10 pl-9 pr-3 text-xs bg-white border border-[#cbd5e1] rounded-xl text-[#004776] font-medium focus:ring-2 focus:ring-[#004776]/25 focus:outline-none"
            />
          </div>
          <div className="w-60">
            <ShadcnSelect
              value={roleFilter}
              onValueChange={setRoleFilter}
              options={[
                { value: 'all', label: `Tất cả vai trò (${accounts.length})` },
                ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))
              ]}
              size="md"
            />
          </div>
        </div>
        <Button type="button" variant="outline" size="default" onClick={loadAccounts} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {filteredAccounts.length === 0 ? (
        <div className="p-10 rounded-xl border border-[#cbd5e1] bg-white text-center text-[#476885] space-y-2">
          <Users className="w-9 h-9 text-[#cbd5e1] mx-auto" />
          <p className="text-sm font-bold text-[#004776]">Chưa có tài khoản phù hợp với bộ lọc.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xs lg:overflow-visible overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#cbd5e1] bg-[#f8fafc] text-[#004776]">
                <th className="p-3 font-bold w-12 text-center border-r border-[#e2e8f0]">STT</th>
                <th className="p-3 font-bold border-r border-[#e2e8f0]">Tài khoản cán bộ</th>
                <th className="p-3 font-bold border-r border-[#e2e8f0] min-w-[200px]">Đơn vị công tác</th>
                <th className="p-3 font-bold border-r border-[#e2e8f0] min-w-[170px]">Chức danh</th>
                <th className="p-3 font-bold border-r border-[#e2e8f0] min-w-[220px]">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Cập nhật vai trò</span>
                  </span>
                </th>
                <th className="p-3 font-bold border-r border-[#e2e8f0] min-w-[140px]">Trạng thái</th>
                <th className="p-3 font-bold text-center w-16">Xóa</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acc, idx) => (
                <AdminAccountRow
                  key={acc.email}
                  account={acc}
                  index={idx}
                  unitOptions={unitOptions}
                  isUpdating={updatingEmail === acc.email}
                  onUpdate={handleUpdateAccount}
                  onDelete={handleDeleteAccount}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
