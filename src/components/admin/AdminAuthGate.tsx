'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, LogIn, ArrowLeft } from 'lucide-react';

interface AdminAuthGateProps {
  redirectUrl?: string;
}

export function AdminAuthGate({ redirectUrl = '/login?redirect=/admin&admin=true' }: AdminAuthGateProps) {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace(redirectUrl);
    }, 1500);
    return () => clearTimeout(timer);
  }, [router, redirectUrl]);

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-[0_20px_50px_-15px_rgba(0,71,118,0.16)] border border-[#d8e3ef] p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#f0f7fd] text-[#0072BC] flex items-center justify-center mx-auto border border-[#0072BC]/20">
          <ShieldCheck className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#004776] tracking-tight">
            Yêu cầu quyền Quản trị viên
          </h2>
          <p className="text-xs text-[#476885] mt-1.5 leading-relaxed">
            Chức năng quản trị hệ thống chỉ dành cho tài khoản Quản trị viên (Phòng Tổ chức – Nhân sự). Hệ thống đang chuyển hướng tới trang đăng nhập...
          </p>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link
            href={redirectUrl}
            className="w-full py-2.5 px-4 bg-[#004776] hover:bg-[#00385c] text-white text-xs font-bold rounded-xl transition-all shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập tài khoản Quản trị</span>
          </Link>
          <Link
            href="/"
            className="w-full py-2.5 px-4 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#004776] text-xs font-semibold rounded-xl transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về trang chủ</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
