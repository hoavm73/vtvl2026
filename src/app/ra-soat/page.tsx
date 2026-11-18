'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

export default function RaSoatRedirectPage() {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState('/nghiep-vu-don-vi?tab=check');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const scope = p.get('scope');
    const unitCode = p.get('unitCode') || p.get('unit');
    const workbookId = p.get('workbookId');
    const revision = p.get('revision');

    const dest = new URLSearchParams();
    if (unitCode) dest.set('unitCode', unitCode);
    if (workbookId) dest.set('workbookId', workbookId);
    if (revision) dest.set('revision', revision);

    let nextPath = '/nghiep-vu-don-vi';
    if (scope === 'tcns') {
      nextPath = '/admin/tham-dinh';
      dest.set('tab', 'check');
    } else {
      dest.set('tab', 'check');
    }

    const qs = dest.toString();
    const resolved = qs ? `${nextPath}?${qs}` : nextPath;
    setTargetUrl(resolved);
    router.replace(resolved);
  }, [router]);

  return (
    <div className="w-full max-w-[760px] mx-auto px-4 py-12">
      <div className="min-w-0 rounded-[14px] border border-[#e2e8f0] bg-white p-6 space-y-3 text-center">
        <h1 className="text-base font-bold text-[#004776]">Chuyển hướng sang Kiểm tra hồ sơ đơn vị</h1>
        <p className="text-xs sm:text-sm text-[#476885]">
          Chức năng kiểm tra chéo K_KiemTra đã được tích hợp vào hồ sơ đơn vị để đảm bảo đồng bộ đúng ngữ cảnh và phiên bản.
        </p>
        <div className="pt-1">
          <Link href={targetUrl} className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-[10px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold">
            <span>Mở ngay hồ sơ kiểm tra</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
