'use client';

import React from 'react';
import Image from 'next/image';
import { Calendar } from 'lucide-react';

export function LoginHeroPanel() {
  return (
    <section
      aria-label="Giới thiệu Đề án Vị trí việc làm HCM-UTE"
      className="flex w-full lg:w-[56%] relative bg-gradient-to-br from-[#0B4F83] via-[#09416C] to-[#042846] text-white flex-col justify-between overflow-hidden select-none"
    >
      {/* Họa tiết lưới công nghệ và hào quang cyan mờ */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_90%,rgba(94,212,244,0.18)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_80%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Khối văn bản phía trên */}
      <header className="relative z-10 shrink-0 pt-7 sm:pt-9 lg:pt-10 xl:pt-12 2xl:pt-14 px-6 sm:px-10 lg:px-12 xl:px-16 max-w-2xl text-left">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.08] border border-[#5ED4F4]/35 backdrop-blur-md">
          <Calendar className="w-3 h-3 xl:w-3.5 xl:h-3.5 text-[#5ED4F4] shrink-0" />
          <span className="text-[11px] xl:text-xs font-[500] text-white/85 tracking-wide">
            Đề án Vị trí việc làm 2026–2030
          </span>
        </div>

        <h1 className="mt-3 xl:mt-3.5 text-left tracking-tight overflow-visible">
          <span
            className="block text-[clamp(24px,2vw,28px)] font-[500] leading-[1.35] text-white/80 mb-1"
            style={{ fontSize: 'clamp(24px, 2vw, 28px)', fontWeight: 500 }}
          >
            Cổng thông tin
          </span>
          <span
            className="block text-[clamp(36px,4.2vw,64px)] font-[800] leading-[1.15] text-white py-[0.03em]"
            style={{ fontSize: 'clamp(36px, 4.2vw, 64px)', fontWeight: 800, lineHeight: 1.15 }}
          >
            Vị trí việc làm
          </span>
        </h1>

        <p className="mt-3 xl:mt-3.5 max-w-xl text-sm xl:text-[15px] text-[#D4E8F8]/90 font-normal leading-relaxed tracking-wide">
          Trường Đại học Công nghệ Kỹ thuật TP. Hồ Chí Minh <span className="text-[#5ED4F4] mx-1">|</span> <span className="font-semibold text-white">HCM-UTE</span>
        </p>

        <div className="mt-3.5 xl:mt-4 w-12 h-1 bg-[#5ED4F4] rounded-full shadow-[0_0_12px_rgba(94,212,244,0.65)]" />
      </header>

      {/* Nửa dưới: Line-art cổng trường HCM-UTE nền trong suốt, giữ tỉ lệ không méo và không chồng lên chữ */}
      <div className="relative z-10 min-h-0 flex-1 w-full flex items-end justify-center pointer-events-none px-4 sm:px-8 xl:px-12 pt-4 sm:pt-6 pb-0">
        <Image
          src="/assets/login/hcmute-gate-line-art-transparent.png"
          alt="Cổng chính Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)"
          width={1774}
          height={887}
          priority
          className="w-full h-auto max-h-[26vh] sm:max-h-[32vh] lg:max-h-[44vh] xl:max-h-[48vh] 2xl:max-h-[52vh] object-contain object-bottom drop-shadow-[0_12px_32px_rgba(4,40,70,0.6)]"
        />
      </div>
    </section>
  );
}
