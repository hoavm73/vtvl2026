'use client';

import React, { useState } from 'react';
import { Building2, ShieldAlert, CheckCircle2, LogOut, ArrowRight, Loader2 } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { Button } from '@/components/ui/Button';
import { getFlatHcmuteUnitOptions } from '@/configs/hcmute-units';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { signOutGoogleSession } from '@/services/auth/google-auth';
import { STANDARD_USER_TITLES } from '@/services/auth/account-client';

const POSITION_OPTIONS = STANDARD_USER_TITLES;

interface UnitSelectionModalProps {
  isOpen: boolean;
  session: OperatorSession | null;
  onConfirmed: (unitCode: string, title: string) => Promise<void>;
}

export function UnitSelectionModal({ isOpen, session, onConfirmed }: UnitSelectionModalProps) {
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [selectedTitle, setSelectedTitle] = useState<string>('Cán bộ – Giảng viên');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !session) return null;

  const unitOptions = getFlatHcmuteUnitOptions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) {
      setErrorMsg('Vui lòng chọn đơn vị công tác của bạn.');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onConfirmed(selectedUnit, selectedTitle);
    } catch {
      setErrorMsg('Không thể lưu đơn vị công tác. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayName = session.displayName || session.email.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] bg-[#004776]/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
        <div
          className="bg-white rounded-3xl w-full max-w-lg border border-[#d8e3ef] shadow-[0_24px_60px_-15px_rgba(0,71,118,0.35)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận đơn vị công tác"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-[#eef6ff] to-white border-b border-[#e2e8f0] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#004776] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#004776] truncate">
                Chọn đơn vị công tác của bạn
              </h2>
              <p className="text-xs font-medium text-[#476885] truncate">
                Hoàn tất liên kết tài khoản Google với đơn vị tại HCM-UTE
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
            {/* User Info Card */}
            <div className="p-3.5 rounded-2xl bg-[#f5f9ff] border border-[#d8e3ef] flex items-center gap-3">
              {session.avatarUrl ? (
                <img
                  src={session.avatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover border border-[#cbd5e1] shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#004776] text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-[#004776] truncate">{displayName}</div>
                <div className="text-xs font-medium text-[#476885] truncate">{session.email}</div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đã kết nối</span>
              </span>
            </div>

            {/* Warning Alert */}
            <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200 flex gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs font-medium text-amber-900 leading-relaxed">
                <strong className="font-bold">Lưu ý quan trọng:</strong> Mỗi email công vụ chỉ được gán với{' '}
                <strong className="font-bold">01 đơn vị công tác duy nhất</strong>. Sau khi xác nhận, bạn{' '}
                <strong className="font-bold underline">sẽ không thể tự đổi đơn vị</strong> (chỉ Quản trị viên hệ thống mới có quyền điều chuyển).
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {errorMsg}
              </div>
            )}

            {/* Unit Select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#004776]">
                Đơn vị công tác chính thức <span className="text-red-500">*</span>
              </label>
              <ShadcnSelect
                value={selectedUnit}
                onValueChange={setSelectedUnit}
                options={unitOptions}
                searchable={true}
                placeholder="-- Tìm và chọn 1 trong 51 đơn vị HCM-UTE --"
                size="md"
              />
            </div>

            {/* Position Select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#004776]">
                Vai trò / Chức danh <span className="text-red-500">*</span>
              </label>
              <ShadcnSelect
                value={selectedTitle}
                onValueChange={setSelectedTitle}
                options={POSITION_OPTIONS.map((p) => ({ value: p, label: p }))}
                size="md"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2.5">
              <Button
                type="submit"
                variant="default"
                size="default"
                disabled={!selectedUnit || isSubmitting}
                className="w-full justify-center font-bold text-sm h-11"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>Đang lưu đơn vị công tác…</span>
                  </>
                ) : (
                  <>
                    <span>Xác nhận &amp; Bắt đầu làm việc</span>
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={signOutGoogleSession}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#476885] hover:text-red-600 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Không phải tài khoản của bạn? Đăng xuất</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
