import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Globe, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="relative z-20 w-full bg-[#06366E] text-white border-t border-white/10 py-3 mt-6 print:hidden">
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8 xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/85">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/horizontal-ute-logo-white.png"
              alt="HCM-UTE Logo"
              width={140}
              height={41}
              sizes="140px"
              loading="lazy"
              className="h-8 w-auto object-contain"
            />
          </Link>
          <span className="hidden md:inline text-white/60">|</span>
          <span className="hidden md:inline">
            Hệ thống Vị trí việc làm — Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)
          </span>
        </div>
        <div className="flex items-center gap-4 text-white/80">
          <span>© 2026 HCM-UTE</span>
          <a
            href="https://hcmute.edu.vn"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white"
            title="Cổng thông tin HCM-UTE"
          >
            <Globe className="w-4 h-4" />
          </a>
          <a
            href="mailto:tcns@hcmute.edu.vn"
            className="hover:text-white"
            title="Thư điện tử hỗ trợ nghiệp vụ"
          >
            <Mail className="w-4 h-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
