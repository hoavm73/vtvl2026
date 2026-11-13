'use client';

import React, { useState } from 'react';
import { Lock, Unlock, KeyRound, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { ModalPortal } from '@/components/ui/ModalPortal';

interface C1AdminLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlock: (password: string) => Promise<boolean>;
}

export function C1AdminLockModal({
  isOpen,
  onClose,
  onUnlock
}: C1AdminLockModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Vui lòng nhập mật khẩu quản trị.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const success = await onUnlock(password);
    setIsSubmitting(false);

    if (success) {
      setPassword('');
      setError('');
      onClose();
    } else {
      setError('Mật khẩu quản trị viên không chính xác. Vui lòng kiểm tra lại.');
    }
  };

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="c1-lock-modal-title"
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-[#004776]/35 backdrop-blur-xs p-0 sm:p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#cbd5e1] w-full max-w-md max-h-[92dvh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between px-5 py-4 bg-[#f8fafc] border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#004776]/10 flex items-center justify-center text-[#004776]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 id="c1-lock-modal-title" className="text-sm font-bold text-[#004776]">
                Xác thực quyền Quản trị viên
              </h3>
              <p className="text-[11px] text-[#64748b]">Biểu 3. C1_VTVL (Danh mục VTVL chuẩn)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#64748b] hover:text-[#004776] rounded-lg p-1.5 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Quy chuẩn Ban Tổ chức Trung ương:</span> Danh mục VTVL tại Biểu 3. C1_VTVL do cơ quan đầu mối (Admin) quản lý và ban hành. Chỉ Quản trị viên có mật khẩu mới được phép chỉnh sửa hoặc bổ sung.
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-pass-input" className="block text-xs font-bold text-[#004776]">
              Mật khẩu Admin mở khóa:
            </label>
            <input
              id="admin-pass-input"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder="Nhập mật khẩu quản trị..."
              className="w-full px-3.5 py-2.5 text-sm bg-[#f8fafc] border border-[#cbd5e1] rounded-lg focus:ring-2 focus:ring-[#004776] focus:outline-none text-[#004776] font-medium"
            />
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 font-semibold pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e2e8f0]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#64748b] hover:bg-[#f1f5f9] rounded-lg transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#004776] hover:bg-[#00385c] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang xác thực...' : 'Mở khóa chỉnh sửa'}</span>
            </button>
          </div>
        </form>
        </div>
      </div>
    </ModalPortal>
  );
}

interface C1AdminStatusBannerProps {
  isUnlocked: boolean;
  onOpenUnlockModal: () => void;
  onLock: () => void;
}

export function C1AdminStatusBanner({
  isUnlocked,
  onOpenUnlockModal,
  onLock
}: C1AdminStatusBannerProps) {
  if (isUnlocked) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900">
        <div className="flex items-center gap-2">
          <Unlock className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            <strong className="font-bold text-emerald-800">Quyền Quản trị viên (Admin) đang mở:</strong> Cho phép chỉnh sửa, thêm/bớt danh mục VTVL chuẩn và nạp lại dữ liệu Phụ lục I.
          </span>
        </div>
        <button
          type="button"
          onClick={onLock}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-md transition-colors cursor-pointer"
        >
          <Lock className="w-3 h-3" />
          <span>Khóa lại</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          <strong className="font-bold text-amber-800">Biểu 3. C1_VTVL đã khóa (Chỉ đọc):</strong> Do cơ quan đầu mối (Admin) quản lý và ban hành trước. Đơn vị cơ sở chỉ đối chiếu sử dụng.
        </span>
      </div>
      <button
        type="button"
        onClick={onOpenUnlockModal}
        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-[#004776] hover:bg-[#00385c] rounded-md transition-colors cursor-pointer shadow-2xs"
      >
        <KeyRound className="w-3 h-3" />
        <span>Mở khóa Admin</span>
      </button>
    </div>
  );
}

