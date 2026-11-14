'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X, UserCog, ShieldCheck, Building2, Mail, Save, CheckCircle2, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { QD2266_GROUPED_UNITS_CATALOG } from '@/configs/hcmute-qd2266-missions';
import { OperatorSession } from '@/services/telemetry/operator-session';
import {
  UserRole,
  ROLE_OPTIONS,
  getRoleLabel,
  getRoleBadgeVariant,
  updateMyAccountOnServer
} from '@/services/auth/account-client';

interface AccountProfileModalProps {
  isOpen: boolean;
  session: OperatorSession;
  isAdmin: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function AccountProfileModal({
  isOpen,
  session,
  isAdmin,
  onClose,
  onUpdated
}: AccountProfileModalProps) {
  const [displayName, setDisplayName] = useState(session.displayName || session.email.split('@')[0]);
  const [unitCode, setUnitCode] = useState(session.unitCode);
  const [title, setTitle] = useState(session.title || 'Chuyên viên');
  const [role, setRole] = useState<UserRole>(session.role || 'staff');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(session.displayName || session.email.split('@')[0]);
    setUnitCode(session.unitCode);
    setTitle(session.title || 'Chuyên viên');
    setRole(session.role || 'staff');
    setFeedback(null);
  }, [isOpen, session]);

  if (!isOpen) return null;

  const canChangeRole = isAdmin || session.role === 'admin';
  const canChangeUnit = true;
  const unitOptions = QD2266_GROUPED_UNITS_CATALOG.flatMap((group) =>
    group.units.map((u) => ({
      value: u.code,
      label: `[${u.code}] ${u.nameVi}`,
      description: group.groupLabel
    }))
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const res = await updateMyAccountOnServer(session, {
      displayName: displayName.trim() || session.email.split('@')[0],
      unitCode: canChangeUnit ? unitCode : session.unitCode,
      title,
      role: canChangeRole ? role : undefined
    });

    setSaving(false);
    if (!res.ok) {
      setFeedback({ type: 'error', message: res.error || 'Không thể lưu thay đổi tài khoản.' });
      return;
    }

    setFeedback({ type: 'success', message: 'Đã cập nhật thông tin tài khoản lên hệ thống.' });
    onUpdated?.();
  };

  const initials = (displayName || session.email).slice(0, 2).toUpperCase();

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] bg-[#004776]/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
        <div
          className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] border border-[#d8e3ef] shadow-[0_24px_60px_-15px_rgba(0,71,118,0.28)] flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Quản lý tài khoản cá nhân"
        >
          <div className="px-6 py-4 bg-gradient-to-r from-[#eef6ff] to-white border-b border-[#e2e8f0] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#004776] text-white flex items-center justify-center shrink-0">
                <UserCog className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-[#004776] truncate">
                  Quản lý tài khoản cá nhân
                </h2>
                <p className="text-xs font-medium text-[#476885] truncate">
                  Cập nhật hồ sơ công tác và kiểm tra quyền truy cập HCM-UTE
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#476885] hover:text-[#004776] hover:bg-[#e1edf8] transition-colors cursor-pointer shrink-0"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-5 sm:p-6 overflow-y-auto space-y-4">
            <div className="p-4 rounded-2xl bg-[#f5f9ff] border border-[#d8e3ef] flex items-center gap-3.5">
              {session.avatarUrl ? (
                <img
                  src={session.avatarUrl}
                  alt={displayName}
                  className="w-12 h-12 rounded-full object-cover border border-[#cbd5e1] shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#004776] text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#004776] truncate">{displayName}</span>
                  <Badge variant={getRoleBadgeVariant(role)}>
                    {getRoleLabel(role)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#476885] flex-wrap">
                  <span className="inline-flex items-center gap-1 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    {session.email}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-white border border-[#d8e3ef] text-[11px] font-semibold text-[#004776]">
                    {session.authProvider === 'google' ? 'Đăng nhập Google' : 'Phiên đơn vị'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="account-display-name" className="block text-xs font-bold text-[#004776]">
                Họ và tên hiển thị
              </label>
              <input
                id="account-display-name"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập họ và tên cán bộ..."
                className="w-full h-11 px-3.5 text-sm leading-normal bg-white border border-[#cbd5e1] rounded-xl text-[#004776] font-medium focus:ring-2 focus:ring-[#004776]/25 focus:border-[#004776] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-bold text-[#004776]">
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Đơn vị công tác</span>
                  </span>
                  {!canChangeUnit && (
                    <span className="text-[11px] text-[#476885] font-semibold">Cố định theo email</span>
                  )}
                </label>
                {canChangeUnit ? (
                  <ShadcnSelect
                    value={unitCode}
                    onValueChange={setUnitCode}
                    options={unitOptions}
                    searchable={true}
                    size="md"
                  />
                ) : (
                  <div className="w-full h-11 px-3.5 flex items-center bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-xs font-bold text-[#004776] cursor-not-allowed">
                    [{session.unitCode}] {session.unitNameVi || session.unitCode}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#004776]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Vai trò / Chức danh</span>
                </label>
                {canChangeRole ? (
                  <ShadcnSelect
                    value={role}
                    onValueChange={(val) => {
                      const nextRole = val as UserRole;
                      setRole(nextRole);
                      setTitle(getRoleLabel(nextRole));
                    }}
                    options={ROLE_OPTIONS.map((r) => ({
                      value: r.value,
                      label: r.label,
                      description: r.description
                    }))}
                    size="md"
                  />
                ) : (
                  <div className="w-full h-11 px-3.5 flex items-center bg-[#f8fafc] border border-[#cbd5e1] rounded-xl text-xs font-bold text-[#004776]">
                    {getRoleLabel(role)}
                  </div>
                )}
              </div>
            </div>

            {feedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <div className="pt-3 border-t border-[#e2e8f0] flex flex-wrap items-center justify-end gap-2.5">
              <Button type="button" variant="outline" onClick={onClose}>
                Đóng
              </Button>
              <Button type="submit" variant="slink" disabled={saving}>
                <Save className="w-4 h-4" />
                <span>{saving ? 'Đang lưu...' : 'Lưu thông tin tài khoản'}</span>
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
