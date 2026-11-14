'use client';

import React from 'react';

interface StaffTicketSignatureBlockProps {
  ownerName: string;
}

export function StaffTicketSignatureBlock({ ownerName }: StaffTicketSignatureBlockProps) {
  const today = new Date();
  return (
    <div className="hidden print:grid grid-cols-2 gap-6 mt-8 text-center text-[13px]">
      <div>
        <div className="font-bold uppercase">XÁC NHẬN CỦA TRƯỞNG ĐƠN VỊ</div>
        <div className="text-[11.5px] italic">(Ký, ghi rõ họ tên)</div>
        <div className="h-24" />
      </div>
      <div>
        <div className="text-[12px] italic">
          TP. Hồ Chí Minh, ngày {String(today.getDate()).padStart(2, '0')} tháng {String(today.getMonth() + 1).padStart(2, '0')} năm {today.getFullYear()}
        </div>
        <div className="font-bold uppercase mt-0.5">NGƯỜI LẬP PHIẾU</div>
        <div className="text-[11.5px] italic">(Ký, ghi rõ họ tên)</div>
        <div className="h-20" />
        <div className="font-bold">{ownerName}</div>
      </div>
    </div>
  );
}
