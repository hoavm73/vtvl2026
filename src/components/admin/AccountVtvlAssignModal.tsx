'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Briefcase, Plus, Save, X } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { UserAccountRecord } from '@/services/auth/account-client';
import { UserVtvlAssignment } from '@/types/staff-ticket';

interface VtvlOptionItem {
  maVtvl: string;
  tenVtvl?: string;
}

interface AccountVtvlAssignModalProps {
  account: UserAccountRecord | null;
  initialAssignments: UserVtvlAssignment[];
  onClose: () => void;
  onSaved: (email: string, updated: UserVtvlAssignment[]) => void;
}

export function AccountVtvlAssignModal({
  account,
  initialAssignments,
  onClose,
  onSaved
}: AccountVtvlAssignModalProps) {
  const [catalog, setCatalog] = useState<{ maVtvl: string; tenVtvl: string }[]>([]);
  const [selectedItems, setSelectedItems] = useState<VtvlOptionItem[]>([]);
  const [pickedCode, setPickedCode] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!account) return;
    setErr('');
    setPickedCode('');
    setSelectedItems(initialAssignments.map((a) => ({ maVtvl: a.maVtvl, tenVtvl: a.tenVtvl })));

    let cancelled = false;
    setLoadingCatalog(true);
    const cur = getCurrentOperatorSession();
    const headers: Record<string, string> = {};
    if (cur?.accessToken) headers.Authorization = `Bearer ${cur.accessToken}`;
    if (cur?.email) headers['x-actor-email'] = cur.email;

    fetch(`/api/vtvl-assignments?mode=unit-catalog&unitCode=${encodeURIComponent(account.unitCode)}`, { headers })
      .then((r) => (r.ok ? r.json() : { options: [] }))
      .then((json) => {
        if (!cancelled) setCatalog(Array.isArray(json.options) ? json.options : []);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });

    return () => {
      cancelled = true;
    };
  }, [account, initialAssignments]);

  const selectOptions = useMemo(() => {
    const pickedSet = new Set(selectedItems.map((s) => s.maVtvl.toUpperCase()));
    return catalog
      .filter((c) => !pickedSet.has(c.maVtvl.toUpperCase()))
      .map((c) => ({
        value: c.maVtvl,
        label: c.tenVtvl ? `${c.maVtvl} — ${c.tenVtvl}` : c.maVtvl
      }));
  }, [catalog, selectedItems]);

  if (!account) return null;

  const handleAdd = () => {
    const clean = pickedCode.trim();
    if (!clean) return;
    if (selectedItems.some((s) => s.maVtvl.toUpperCase() === clean.toUpperCase())) return;
    const found = catalog.find((c) => c.maVtvl.toUpperCase() === clean.toUpperCase());
    setSelectedItems((prev) => [...prev, { maVtvl: clean, tenVtvl: found?.tenVtvl }]);
    setPickedCode('');
  };

  const handleSave = async () => {
    setSaving(true);
    setErr('');
    try {
      const cur = getCurrentOperatorSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cur?.accessToken) headers.Authorization = `Bearer ${cur.accessToken}`;
      if (cur?.email) headers['x-actor-email'] = cur.email;

      const res = await fetch('/api/vtvl-assignments', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ userEmail: account.email, items: selectedItems })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error || 'Không thể lưu phân công VTVL.');
        return;
      }
      onSaved(account.email, Array.isArray(json.assignments) ? json.assignments : []);
      onClose();
    } catch {
      setErr('Lỗi kết nối mạng khi lưu phân công VTVL.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#004776]/40 backdrop-blur-xs p-3 sm:p-5">
      <div className="w-full max-w-xl bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 px-5 py-4 bg-[#f8fbff] border-b border-[#dbeafe]">
          <div className="space-y-0.5 min-w-0">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006cee]">
              <Briefcase className="w-3.5 h-3.5" />
              <span>Phân công vị trí việc làm (Biểu C1)</span>
            </div>
            <h3 className="text-base font-extrabold text-[#004776] truncate">
              {account.displayName} ({account.unitCode})
            </h3>
            <p className="text-xs text-[#476b8e] truncate">{account.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white text-[#20446c] hover:text-[#004776] cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto text-xs text-[#004776]">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="font-bold text-[#004776]">
                Chọn mã VTVL thuộc đơn vị {account.unitCode}
              </label>
              <ShadcnSelect
                value={pickedCode}
                options={selectOptions}
                placeholder="Chọn mã VTVL theo Biểu C1..."
                searchable
                disabled={loadingCatalog}
                onChange={setPickedCode}
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!pickedCode}
              className="h-10 px-4 rounded-xl bg-[#006cee] hover:bg-[#005ecc] text-white font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm mã</span>
            </button>
          </div>

          <div className="space-y-2">
            <span className="font-bold text-[#20446c]">
              Danh sách VTVL đang phân công ({selectedItems.length})
            </span>
            {selectedItems.length === 0 ? (
              <p className="p-3 rounded-xl bg-[#f8fafc] border border-dashed border-[#cbd5e1] text-[#476b8e]">
                Tài khoản này chưa được phân công mã VTVL nào.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedItems.map((item) => (
                  <span
                    key={item.maVtvl}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e1edf8] border border-[#bfdbfe] text-[#004776] font-semibold"
                  >
                    <span>{item.maVtvl}{item.tenVtvl ? ` — ${item.tenVtvl}` : ''}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedItems((prev) => prev.filter((p) => p.maVtvl !== item.maVtvl))}
                      className="text-[#20446c] hover:text-red-600 cursor-pointer"
                      title="Gỡ mã VTVL"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {err && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{err}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 bg-[#f8fafc] border-t border-[#e2e8f0]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-[#004776] text-xs font-bold cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#004776] hover:bg-[#003559] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Đang lưu...' : 'Lưu phân công'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
