'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2, ChevronDown, LogOut, RefreshCw, CheckCircle2, UserCog, ShieldCheck
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/Popover';
import { Badge } from '@/components/ui/Badge';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { GoogleLogoSvg, GoogleOAuthButton } from '@/components/auth/GoogleOAuthButton';
import { AccountProfileModal } from '@/components/auth/AccountProfileModal';
import { UnitSelectionModal } from '@/components/auth/UnitSelectionModal';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import {
  OperatorSession,
  getCurrentOperatorSession
} from '@/services/telemetry/operator-session';
import {
  consumeGoogleOAuthCallback,
  signOutGoogleSession
} from '@/services/auth/google-auth';
import {
  UserRole,
  ROLE_OPTIONS,
  getRoleLabel,
  getRoleBadgeVariant,
  getRoleFromTitle,
  syncOperatorAccountWithServer,
  updateMyAccountOnServer
} from '@/services/auth/account-client';

export function UserProfilePopover() {
  const router = useRouter();
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState(false);

  const loadAndSync = async (overrideSession?: OperatorSession | null) => {
    const active = overrideSession ?? getCurrentOperatorSession();
    setSession(active);
    if (!active) {
      setIsAdmin(false);
      return;
    }
    const synced = await syncOperatorAccountWithServer(active);
    setIsAdmin(synced.isAdmin);
    setSession(getCurrentOperatorSession() || active);
  };

  useEffect(() => {
    const callbackSession = consumeGoogleOAuthCallback();
    loadAndSync(callbackSession);

    const handleSessionChange = () => loadAndSync();
    window.addEventListener('vtvl-operator-changed', handleSessionChange);
    return () => window.removeEventListener('vtvl-operator-changed', handleSessionChange);
  }, []);

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/bang-tinh';

  const handleOpenSwitchModal = () => {
    window.dispatchEvent(new CustomEvent('vtvl-open-session-modal'));
  };

  const handleLogout = () => {
    setIsProfileOpen(false);
    setIsAdmin(false);
    setSession(null);
    signOutGoogleSession();
  };

  const handleQuickRoleUpdate = async (newRole: string) => {
    if (!session) return;
    setRoleUpdating(true);
    const res = await updateMyAccountOnServer(session, { role: newRole as UserRole });
    if (res.ok) {
      setSession(getCurrentOperatorSession());
    }
    setRoleUpdating(false);
  };

  const handleUnitConfirmed = async (unitCode: string, title: string) => {
    if (!session) return;
    const mappedRole = getRoleFromTitle(title);
    await updateMyAccountOnServer(session, { unitCode, title, role: mappedRole, hasSelectedUnit: true });
    await loadAndSync();
    router.push(mappedRole === 'unit_leader' ? '/bang-tinh' : '/phieu-cong-viec');
  };

  const needsUnitSelection = Boolean(session && !session.hasSelectedUnit && session.role !== 'admin');

  if (!session) {
    return (
      <Popover>
        <PopoverTrigger>
          <span className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-[#d8e3ef] bg-white hover:border-[#004776] hover:bg-[#f4f7fb] text-sm font-semibold text-[#004776] shadow-2xs transition-all">
            <GoogleLogoSvg className="w-4 h-4" />
            <span className="hidden sm:inline">Đăng nhập Google</span>
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-4 space-y-3">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#0072BC]">Đăng nhập tài khoản HCM-UTE</h4>
            <p className="text-xs font-medium text-[#476885] leading-relaxed">
              Sử dụng tài khoản Google công vụ @hcmute.edu.vn để đồng bộ hồ sơ an toàn và tự động lưu phiên làm việc.
            </p>
          </div>
          <GoogleOAuthButton
            label="Tiếp tục với Google"
            loadingLabel="Đang kết nối Google…"
            redirectPath={currentPath}
            size="default"
            className="w-full justify-center font-bold border-[#cbd5e1] hover:border-[#004776]"
          />
          <div className="pt-2 border-t border-[#e8eff7]">
            <PopoverClose onClick={handleOpenSwitchModal}>
              <span className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg bg-[#e1edf8] hover:bg-[#d0e4f5] text-xs font-bold text-[#004776] transition-colors">
                <Building2 className="w-3.5 h-3.5 text-[#004776]" />
                <span>Hoặc khai báo phiên đơn vị</span>
              </span>
            </PopoverClose>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const label = session.displayName || session.email.split('@')[0];
  const initials = label.slice(0, 2).toUpperCase();
  const activeRole = session.role || 'staff';
  const canManageAdminRoles = isAdmin;
  const activeUnit = session ? findHcmuteUnit(session.unitCode) : null;
  const unitCode = activeUnit?.code || session.unitCode;
  const unitNameVi = activeUnit?.nameVi || session.unitNameVi;

  return (
    <>
      <Popover>
        <PopoverTrigger>
          <span className="inline-flex items-center gap-2.5 h-10 pl-1.5 pr-3 rounded-full border border-[#d8e3ef] bg-white hover:border-[#004776] hover:bg-[#f4f7fb] transition-all shadow-2xs">
            {session.avatarUrl ? (
              <img
                src={session.avatarUrl}
                alt={label}
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-7 h-7 rounded-full bg-[#004776] text-white text-xs font-bold inline-flex items-center justify-center shrink-0">
                {initials}
              </span>
            )}
            <span className="hidden md:flex flex-col text-left leading-tight">
              <span className="text-[13px] font-bold text-[#004776] max-w-[130px] truncate">
                {label}
              </span>
              <span className="text-[11px] font-semibold text-[#476885]">
                [{unitCode}] · {getRoleLabel(activeRole)}
              </span>
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#476885] shrink-0" />
          </span>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-[330px] p-4 space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-[#e8eff7]">
            {session.avatarUrl ? (
              <img
                src={session.avatarUrl}
                alt={label}
                className="w-11 h-11 rounded-full object-cover shrink-0 border border-[#d8e3ef]"
              />
            ) : (
              <span className="w-11 h-11 rounded-full bg-[#004776] text-white text-sm font-bold inline-flex items-center justify-center shrink-0">
                {initials}
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="text-sm font-bold text-[#004776] truncate">{label}</div>
              <div className="text-xs font-medium text-[#476885] truncate">{session.email}</div>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <Badge variant={getRoleBadgeVariant(activeRole)} className="text-[11px] px-2 py-0.5">
                  {getRoleLabel(activeRole)}
                </Badge>
                {session.authProvider === 'google' && (
                  <Badge variant="success" className="text-[11px] px-2 py-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Google</span>
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#f5f9ff] border border-[#d8e3ef] space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#004776]">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#004776]" />
                <span>Đơn vị [{unitCode}]</span>
              </span>
              <span className="text-[11px] font-semibold text-[#476885] truncate max-w-[140px]">
                {session.title || 'Chuyên viên'}
              </span>
            </div>
            <p className="text-xs font-medium text-[#20446c] leading-snug pl-5">
              {unitNameVi}
            </p>
          </div>

          {canManageAdminRoles && (
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-bold text-[#004776]">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#004776]" />
                  <span>Vai trò hệ thống</span>
                </span>
                {roleUpdating && <span className="text-[11px] text-[#476885]">Đang lưu…</span>}
              </label>
              <ShadcnSelect
                value={activeRole}
                onValueChange={handleQuickRoleUpdate}
                options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
                size="sm"
                disabled={roleUpdating}
              />
            </div>
          )}

          <div className="space-y-1.5 pt-1">
            {session.authProvider !== 'google' && (
              <GoogleOAuthButton
                label="Liên kết tài khoản Google"
                loadingLabel="Đang kết nối Google…"
                redirectPath={currentPath}
                size="sm"
                className="w-full justify-start font-semibold"
              />
            )}

            <PopoverClose onClick={() => setIsProfileOpen(true)}>
              <span className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[#e1edf8] hover:bg-[#d0e4f5] text-xs font-bold text-[#004776] transition-colors">
                <UserCog className="w-3.5 h-3.5 text-[#004776]" />
                <span>Quản lý tài khoản cá nhân</span>
              </span>
            </PopoverClose>

            {canManageAdminRoles && (
              <PopoverClose onClick={handleOpenSwitchModal}>
                <span className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[#d8e3ef] bg-white hover:bg-[#f4f7fb] text-xs font-semibold text-[#004776] transition-colors">
                  <RefreshCw className="w-3.5 h-3.5 text-[#004776]" />
                  <span>Đổi đơn vị hoặc phiên làm việc</span>
                </span>
              </PopoverClose>
            )}

            {canManageAdminRoles && (
              <Link
                href="/admin?tab=accounts"
                className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-[#d8e3ef] bg-white hover:bg-[#f4f7fb] text-xs font-semibold text-[#004776] transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#004776]" />
                <span>Quản trị tài khoản &amp; phân quyền</span>
              </Link>
            )}

            <PopoverClose onClick={handleLogout}>
              <span className="w-full inline-flex items-center gap-2 h-9 px-3 rounded-lg bg-[#fdeceb] hover:bg-[#fbd5d3] text-xs font-bold text-[#b42318] transition-colors">
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </span>
            </PopoverClose>
          </div>
        </PopoverContent>
      </Popover>

      <AccountProfileModal
        isOpen={isProfileOpen}
        session={session}
        isAdmin={isAdmin}
        onClose={() => setIsProfileOpen(false)}
        onUpdated={() => loadAndSync()}
      />

      <UnitSelectionModal
        isOpen={needsUnitSelection}
        session={session}
        onConfirmed={handleUnitConfirmed}
      />
    </>
  );
}
