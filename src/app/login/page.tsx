'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, LogIn, Building2, UserCheck, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { startGoogleOAuthLogin, consumeGoogleOAuthCallback } from '@/services/auth/google-auth';
import { syncOperatorAccountWithServer, UserRole } from '@/services/auth/account-client';
import { saveCurrentOperatorSession, getCurrentOperatorSession } from '@/services/telemetry/operator-session';

function getLandingRouteByRole(role?: UserRole): string {
  if (role === 'staff') return '/phieu-cong-viec';
  return '/bang-tinh';
}

export default function LoginPortalPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ email, password })
      });
      const json = await res.json();
      if (!res.ok || !json.account) {
        setError(json.error || 'Đăng nhập không thành công.');
        setLoading(false);
        return;
      }

      const acc = json.account;
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
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-[#f8fbff] via-white to-[#eef5ff] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-[#dbeafe] shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Cột trái: Thông tin Cổng thông tin HCM-UTE */}
        <div className="lg:col-span-6 bg-[#004776] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[#0072BC]/25 pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative z-10 space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-[#e0f2fe]">
              <ShieldCheck className="w-4 h-4 text-[#38bdf8]" />
              Đề án Vị trí việc làm giai đoạn 2026–2030
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-[#bae6fd] font-semibold">
                Trường Đại học Công nghệ Kỹ thuật TP.HCM (HCM-UTE)
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold leading-snug text-white">
                Cổng thông tin Vị trí việc làm
              </h1>
              <p className="text-sm text-[#e2e8f0] leading-relaxed">
                Hệ thống chuẩn hóa danh mục công việc, đo lường định mức thời gian thực tế và tổng hợp phương án biên chế theo Hướng dẫn số 07-HD/BTCTW.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 bg-white/10 rounded-xl p-3 border border-white/10">
                <Building2 className="w-5 h-5 text-[#38bdf8] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-white">Phòng Tổ chức – Nhân sự</div>
                  <div className="text-xs text-[#cbd5e1]">Toàn quyền quản trị, rà soát và thẩm định dữ liệu 51 đơn vị.</div>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/10 rounded-xl p-3 border border-white/10">
                <UserCheck className="w-5 h-5 text-[#4ade80] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-white">Lãnh đạo đơn vị</div>
                  <div className="text-xs text-[#cbd5e1]">Xem, rà soát và cập nhật toàn bộ dữ liệu bảng tính thuộc đơn vị mình.</div>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-white/10 rounded-xl p-3 border border-white/10">
                <FileSpreadsheet className="w-5 h-5 text-[#facc15] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-white">Cán bộ – Giảng viên</div>
                  <div className="text-xs text-[#cbd5e1]">Khai báo Phiếu công việc cá nhân, lưu nháp, gửi đơn vị và xuất PDF chuẩn A4.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-white/15 mt-6 text-xs text-[#bae6fd] flex items-center justify-between">
            <span>Phiên bản VTVL 360</span>
            <span>Ho Chi Minh City University of Technology and Engineering</span>
          </div>
        </div>

        {/* Cột phải: Khối Đăng nhập Google & Tài khoản/Mật khẩu */}
        <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-center bg-white">
          <div className="max-w-sm w-full mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#004776]">Đăng nhập hệ thống</h2>
              <p className="text-xs text-[#64748b] mt-1">
                Chọn đăng nhập nhanh bằng tài khoản Google HCM-UTE hoặc tài khoản được cấp.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full h-11 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#004776] font-semibold text-sm flex items-center justify-center gap-2.5 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
              </svg>
              Đăng nhập bằng Google (@hcmute.edu.vn)
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-[#e2e8f0]" />
              <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-[#64748b]">Hoặc tài khoản mật khẩu</span>
              <div className="flex-grow border-t border-[#e2e8f0]" />
            </div>

            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#004776] mb-1">Email công vụ</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#64748b] absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tendangnhap@hcmute.edu.vn"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#cbd5e1] text-sm text-[#004776] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#004776] mb-1">Mật khẩu</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#64748b] absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#cbd5e1] text-sm text-[#004776] focus:border-[#0072BC] focus:ring-2 focus:ring-[#0072BC]/20 outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-[#0072BC] hover:bg-[#004776] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
              </button>
            </form>

            <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-[11px] text-[#475569] space-y-1">
              <div className="font-semibold text-[#004776] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0072BC]" /> Tài khoản thử nghiệm 3 cấp quyền:
              </div>
              <div>• Phòng TCNS: <code>tcns@hcmute.edu.vn</code> / <code>Hcmute@2026</code></div>
              <div>• Lãnh đạo (FIT): <code>lanhdao@hcmute.edu.vn</code> / <code>123456</code></div>
              <div>• Giảng viên (FIT): <code>giangvien@hcmute.edu.vn</code> / <code>123456</code></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
