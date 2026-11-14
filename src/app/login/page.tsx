'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { startGoogleOAuthLogin, consumeGoogleOAuthCallback } from '@/services/auth/google-auth';
import { syncOperatorAccountWithServer, UserRole, markEmailAsOnboarded } from '@/services/auth/account-client';
import { saveCurrentOperatorSession, getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { LoginHeroPanel } from '@/components/auth/LoginHeroPanel';
import { LoginSupportModal } from '@/components/auth/LoginSupportModal';

function getLandingRouteByRole(_role?: UserRole): string {
  return '/';
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  useEffect(() => {
    const oauthSession = consumeGoogleOAuthCallback();
    const active = oauthSession || getCurrentOperatorSession();
    if (!active) return;

    syncOperatorAccountWithServer(active).then(({ account }) => {
      const role = account?.role || active.role || 'staff';
      router.replace(getLandingRouteByRole(role));
    });
  }, [router]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const json = await res.json();
      if (!res.ok || !json.account) {
        setError(json.error || 'Đăng nhập không thành công.');
        setLoading(false);
        return;
      }

      const acc = json.account;
      markEmailAsOnboarded(acc.email);
      saveCurrentOperatorSession(acc.email, acc.unitCode, acc.title, {
        displayName: acc.displayName,
        role: acc.role,
        authProvider: acc.authProvider || 'email',
        hasSelectedUnit: acc.hasSelectedUnit ?? true
      });
      router.push(getLandingRouteByRole(acc.role));
    } catch {
      setError('Không thể kết nối tới máy chủ xác thực.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    const res = await startGoogleOAuthLogin('/login');
    if (!res.ok) {
      setError(res.message || 'Không thể khởi tạo đăng nhập Google.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden bg-[#F5F8FB]">
      {/* 1. Cột trái: Nền xanh HCMUTE & Line-art cổng trường (Chiếm ~56% viewport desktop) */}
      <LoginHeroPanel />

      {/* 2. Cột phải: Thẻ đăng nhập gọn gàng trên nền Porcelain (Chiếm ~44% viewport desktop) */}
      <section
        aria-label="Khu vực đăng nhập"
        className="w-full lg:w-[44%] min-h-screen lg:min-h-0 flex flex-col justify-between p-5 sm:p-8 xl:p-12 overflow-y-auto bg-[#F5F8FB]"
      >
        <div className="max-w-[420px] w-full mx-auto my-auto space-y-5 sm:space-y-6">
          {/* Logo HCM-UTE chính thức (Since 1962) */}
          <div className="text-center pt-2 sm:pt-0">
            <Image
              src="/assets/login/hcmute-logo-vertical.png"
              alt="Logo Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)"
              width={76}
              height={104}
              priority
              className="h-16 sm:h-[72px] w-auto object-contain mx-auto"
            />
            <h2 className="text-2xl sm:text-[26px] font-bold text-[#004776] tracking-tight mt-3">
              Đăng nhập hệ thống
            </h2>
            <p className="text-xs sm:text-sm text-[#476885] mt-1 font-medium">
              Sử dụng tài khoản HCM-UTE để tiếp tục.
            </p>
          </div>

          {/* Thông báo lỗi nếu có */}
          {error && (
            <div
              role="alert"
              className="p-3 sm:p-3.5 rounded-xl bg-red-50/90 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 animate-in fade-in duration-150"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          {/* Nút đăng nhập Google nổi bật */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            aria-label="Đăng nhập bằng tài khoản Google HCM-UTE"
            className="w-full h-11 sm:h-12 rounded-xl border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] active:bg-[#EFF6FF] text-[#004776] font-semibold text-xs sm:text-[14px] flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[#006CEE]"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
              <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
            </svg>
            <span>Đăng nhập bằng Google (@hcmute.edu.vn)</span>
          </button>

          {/* Đường phân cách */}
          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-[#D8E3EF]" />
            <span className="shrink px-3 text-xs text-[#64748B] font-medium bg-[#F5F8FB]">
              hoặc
            </span>
            <div className="flex-grow border-t border-[#D8E3EF]" />
          </div>

          {/* Form đăng nhập email và mật khẩu */}
          <form onSubmit={handlePasswordLogin} className="space-y-4" noValidate={false}>
            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-[#004776] mb-1.5">
                Email công vụ
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập email công vụ (@hcmute.edu.vn)"
                  className="w-full h-11 sm:h-12 pl-10 pr-3.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#004776] placeholder-[#94A3B8] font-medium focus:border-[#006CEE] focus:ring-2 focus:ring-[#006CEE]/20 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-[#004776] mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full h-11 sm:h-12 pl-10 pr-11 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#004776] placeholder-[#94A3B8] font-medium focus:border-[#006CEE] focus:ring-2 focus:ring-[#006CEE]/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#004776] p-1 rounded-md transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 sm:h-12 rounded-xl bg-[#006CEE] hover:bg-[#0057C2] active:bg-[#004776] text-white font-bold text-sm sm:text-[15px] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006CEE]"
            >
              {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
            </button>
          </form>

          {/* Liên kết hỗ trợ đăng nhập */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setShowSupportModal(true)}
              className="text-xs sm:text-sm font-semibold text-[#006CEE] hover:text-[#004776] hover:underline transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Cần hỗ trợ đăng nhập?</span>
            </button>
          </div>
        </div>

        {/* Responsive mobile banner (dưới 900px, xuất hiện phía dưới form gọn gàng) */}
        <div className="lg:hidden mt-6 pt-4 border-t border-[#D8E3EF] text-center space-y-3">
          <div className="w-full max-w-[280px] mx-auto opacity-75">
            <Image
              src="/assets/login/hcmute-gate-line-art-transparent.png"
              alt="Cổng trường HCM-UTE"
              width={1774}
              height={887}
              className="w-full h-auto object-contain"
            />
          </div>
          <p className="text-xs text-[#0B4F83] font-semibold">
            Đề án Vị trí việc làm 2026–2030 • HCM-UTE
          </p>
        </div>

        {/* Bản quyền chân trang */}
        <footer className="text-center text-[11px] sm:text-xs text-[#64748B] pt-4 font-medium select-none">
          © 2026 HCM-UTE • Phòng Tổ chức – Nhân sự
        </footer>
      </section>

      {/* Modal hỗ trợ đăng nhập */}
      <LoginSupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
      />
    </div>
  );
}
