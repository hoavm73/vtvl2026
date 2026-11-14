'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface LoginSuccessCardProps {
  message: string;
}

export function LoginSuccessCard({ message }: LoginSuccessCardProps) {
  return (
    <div className="p-6 sm:p-8 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-center space-y-4 shadow-xs animate-in fade-in zoom-in-95 duration-200">
      <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 shadow-2xs">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 animate-pulse" />
      </div>
      <div>
        <h3 className="text-base sm:text-lg font-bold text-[#004776]">
          Đã đăng nhập thành công!
        </h3>
        <p className="text-xs sm:text-sm text-emerald-800 mt-1 font-medium leading-relaxed">
          {message}
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#006cee] pt-1">
        <div className="w-4 h-4 rounded-full border-2 border-[#006cee] border-t-transparent animate-spin" />
        <span>Đang chuyển hướng vào hệ thống…</span>
      </div>
    </div>
  );
}
