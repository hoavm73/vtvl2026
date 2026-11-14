'use client';

import React from 'react';
import { HelpCircle, X } from 'lucide-react';

interface LoginSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginSupportModal({ isOpen, onClose }: LoginSupportModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-modal-title"
      className="fixed inset-0 z-50 bg-[#004776]/45 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-[#CBD5E1] shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-[#004776]">
            <HelpCircle className="w-5 h-5 text-[#006CEE]" />
            <h3 id="support-modal-title" className="text-base font-bold">
              Hỗ trợ tài khoản đăng nhập
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className="text-[#64748B] hover:text-[#004776] p-1 rounded-lg hover:bg-[#F1F5F9] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs sm:text-sm text-[#476885] space-y-2.5 leading-relaxed">
          <p>
            <strong>Tài khoản Google:</strong> Sử dụng tài khoản email công vụ do trường cấp với đuôi <code className="font-semibold text-[#004776]">@hcmute.edu.vn</code>.
          </p>
          <p>
            <strong>Tài khoản mật khẩu:</strong> Dành cho tài khoản nội bộ do Phòng Tổ chức – Nhân sự cấp phát hoặc cấu hình riêng theo đề án.
          </p>
          <div className="p-3 rounded-xl bg-[#F5F8FB] border border-[#D8E3EF] text-xs text-[#004776] space-y-1">
            <div className="font-bold">Đơn vị thường trực hỗ trợ:</div>
            <div>Phòng Tổ chức – Nhân sự (Phòng A1-201)</div>
            <div>Email: <a href="mailto:tcns@hcmute.edu.vn" className="text-[#006CEE] font-semibold underline">tcns@hcmute.edu.vn</a></div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-10 rounded-xl bg-[#004776] hover:bg-[#00385d] text-white text-xs font-bold transition-colors cursor-pointer"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}
