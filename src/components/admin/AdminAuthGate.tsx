'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { KeyRound, ArrowLeft, Unlock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { loginAsAdminSession } from '@/services/auth/admin-auth-client';

interface AdminAuthGateProps {
  onSuccess: () => void;
}

export function AdminAuthGate({ onSuccess }: AdminAuthGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setError('Vui lòng nhập mật khẩu quản trị.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed })
      });

      if (res.ok) {
        loginAsAdminSession();
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Mật khẩu quản trị viên không chính xác.');
      }
    } catch {
      setError('Không thể kết nối đến máy chủ xác thực.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_50px_-15px_rgba(0,71,118,0.16)] border border-[#d8e3ef] overflow-hidden">
        <div className="px-6 pt-7 pb-5 bg-gradient-to-b from-[#eef6ff] via-[#f6faff] to-white border-b border-[#e2e8f0] text-center">
          <img
            src="/ute_logo.png"
            alt="Logo HCM-UTE"
            className="w-14 h-14 object-contain mx-auto mb-3"
          />
          <h2 className="text-xl font-bold text-[#004776] tracking-tight">
            Cổng xác thực Quản trị viên
          </h2>
          <p className="text-sm text-[#476885] mt-1">
            Phòng Tổ chức – Nhân sự · HCM-UTE
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="admin-auth-pass" className="block text-sm font-bold text-[#004776]">
              Mật khẩu quản trị hệ thống
            </label>
            <div className="relative">
              <input
                id="admin-auth-pass"
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
            {error && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 font-semibold pt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <Button
              type="submit"
              variant="slink"
              size="lg"
              disabled={isVerifying}
              className="w-full"
            >
              <Unlock className="w-4 h-4" />
              <span>{isVerifying ? 'Đang kiểm tra...' : 'Đăng nhập quản trị viên'}</span>
            </Button>

            <Link
              href="/bang-tinh"
              className="w-full inline-flex items-center justify-center gap-1.5 h-10 px-4 text-sm font-semibold text-[#476885] hover:text-[#004776] hover:bg-[#f1f5f9] rounded-xl transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại bảng tính 15 sheet</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
