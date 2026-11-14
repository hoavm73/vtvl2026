'use client';

import React from 'react';
import Image from 'next/image';
import { Calendar } from 'lucide-react';

export function LoginHeroPanel() {
  return (
    <section
      aria-label="Giới thiệu Đề án Vị trí việc làm HCM-UTE"
      className="hidden lg:flex lg:w-[56%] relative bg-gradient-to-br from-[#0B4F83] via-[#09416C] to-[#042846] text-white flex-col justify-between overflow-hidden select-none"
    >
      {/* Họa tiết lưới công nghệ và hào quang cyan mờ */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_90%,rgba(94,212,244,0.18)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_80%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Khối văn bản phía trên */}
      <header className="relative z-10 pt-10 xl:pt-14 px-8 sm:px-12 xl:px-16 space-y-4 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-[#5ED4F4]/50 backdrop-blur-md shadow-xs">
          <Calendar className="w-4 h-4 text-[#5ED4F4]" />
          <span className="text-xs xl:text-sm font-semibold text-white tracking-wide">
            Đề án Vị trí việc làm 2026–2030
          </span>
        </div>

        <h1 className="text-3xl xl:text-[42px] font-bold text-white tracking-tight leading-[1.18]">
          Cổng thông tin Vị trí việc làm
        </h1>

        <div className="w-14 h-1 bg-[#5ED4F4] rounded-full shadow-[0_0_12px_rgba(94,212,244,0.65)]" />

        <p className="text-sm xl:text-base text-[#D4E8F8] font-normal leading-relaxed tracking-wide pt-1">
          Chuẩn hóa công việc <span className="text-[#5ED4F4] mx-1.5">•</span> Đo lường định mức <span className="text-[#5ED4F4] mx-1.5">•</span> Tổng hợp biên chế
        </p>
      </header>

      {/* Nửa dưới: Line-art cổng trường HCM-UTE nền trong suốt, giữ tỉ lệ không méo */}
      <div className="relative z-10 mt-auto w-full flex items-end justify-center pointer-events-none px-4 sm:px-8 xl:px-12 pb-0">
        <Image
          src="/assets/login/hcmute-gate-line-art-transparent.png"
          alt="Cổng chính Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)"
          width={1774}
          height={887}
          priority
          className="w-full max-h-[50vh] xl:max-h-[54vh] object-contain object-bottom drop-shadow-[0_12px_32px_rgba(4,40,70,0.6)]"
        />
      </div>
    </section>
  );
}
