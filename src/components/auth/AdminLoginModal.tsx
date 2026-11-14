'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, AlertCircle, X, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { loginWithAdminPassword } from '@/services/auth/admin-auth-client';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminLoginModal({ isOpen, onClose, onSuccess }: AdminLoginModalProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const res = await loginWithAdminPassword(password);
    setIsSubmitting(false);

    if (res.ok) {
      setPassword('');
      onSuccess?.();
      onClose();
      router.push('/admin');
    } else {
      setError(res.error || 'Mật khẩu quản trị viên không chính xác.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-modal-title"
      className="fixed inset-0 z-50 bg-[#004776]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#d8e3ef] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 pt-6 pb-5 bg-gradient-to-b from-[#eef6ff] via-[#f6faff] to-white border-b border-[#e2e8f0] text-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="absolute top-4 right-4 p-1.5 rounded-full text-[#476885] hover:text-[#004776] hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#004776] text-white mb-2.5 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 id="admin-login-modal-title" className="text-lg font-bold text-[#004776] tracking-tight">
            Đăng nhập Quản trị hệ thống
          </h2>
          <p className="text-xs text-[#476885] mt-0.5 font-medium">
            Phòng Tổ chức – Nhân sự · HCM-UTE
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 rounded-xl bg-[#f0f7fd] border border-[#d0e4f5] text-xs text-[#004776] space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-[#0072BC]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Nguyên tắc phiên làm việc duy nhất:</span>
            </p>
            <p className="text-[#335d84] leading-relaxed">
              Mỗi phiên chỉ ghi nhận 01 tài khoản làm việc. Khi đăng nhập Quản trị viên, hệ thống sẽ tự động đăng xuất tài khoản hiện tại và chuyển sang tài khoản Quản trị viên [TCNS].
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-modal-password" className="block text-xs font-bold text-[#004776]">
              Mật khẩu Quản trị viên
            </label>
            <div className="relative">
              <input
                id="admin-modal-password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Nhập mật khẩu quản trị..."
                className="w-full h-11 pl-10 pr-4 text-sm bg-[#f8fafc] border border-[#cbd5e1] rounded-xl focus:ring-2 focus:ring-[#004776] focus:outline-none text-[#004776] font-medium"
              />
              <KeyRound className="w-4 h-4 text-[#476885] absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[11px] text-[#476885]">Mật khẩu mặc định hệ thống: <code className="font-bold text-[#004776]">Hcmute@2026</code></p>
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-[#b42318] font-semibold pt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 text-xs font-bold"
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="slink"
              size="default"
              disabled={isSubmitting || !password.trim()}
              className="flex-1 text-xs font-bold gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang xác thực…</span>
                </>
              ) : (
                <>
                  <span>Xác nhận</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
