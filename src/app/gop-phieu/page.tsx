'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

export default function GopPhieuRedirectPage() {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState('/phieu-don-vi?tab=approved');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const unitCode = p.get('unitCode') || p.get('unit');
    const dest = new URLSearchParams({ tab: 'approved' });
    if (unitCode) dest.set('unitCode', unitCode);
    const resolved = `/phieu-don-vi?${dest.toString()}`;
    setTargetUrl(resolved);
    router.replace(resolved);
  }, [router]);

  return (
    <div className="w-full max-w-[760px] mx-auto px-4 py-12">
      <div className="min-w-0 rounded-[14px] border border-[#e2e8f0] bg-white p-6 space-y-3 text-center">
        <h1 className="text-base font-bold text-[#004776]">Chuyển hướng sang Quản lý &amp; Gộp phiếu đơn vị</h1>
        <p className="text-xs sm:text-sm text-[#476885]">
          Thao tác đưa phiếu công việc đã duyệt vào Biểu A2 &amp; B1 được thực hiện thống nhất tại phân hệ Quản lý phiếu đơn vị.
        </p>
        <div className="pt-1">
          <Link href={targetUrl} className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-[10px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold">
            <span>Mở Quản lý &amp; Gộp phiếu đơn vị</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
