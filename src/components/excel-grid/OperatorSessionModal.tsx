'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getFlatHcmuteUnitOptions } from '@/configs/hcmute-units';
import {
  OperatorSession,
  EmailSessionRecord,
  getAllEmailSessions,
  normalizeEmail
} from '@/services/telemetry/operator-session';
import { Mail, History, ArrowRight, X, Info, AlertCircle } from 'lucide-react';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { Button } from '@/components/ui/Button';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { GoogleOAuthButton } from '@/components/auth/GoogleOAuthButton';
import {
  OperatorServerWorkbookPicker,
  ServerLookupItem
} from './OperatorServerWorkbookPicker';

import { ADMIN_USER_TITLES } from '@/services/auth/account-client';

const COMMON_TITLES = ADMIN_USER_TITLES;

interface OperatorSessionModalProps {
  isOpen: boolean;
  currentSession: OperatorSession | null;
  defaultUnitCode?: string;
  onSubmit: (email: string, unitCode: string, title: string, workbookId?: string) => void;
  onClose?: () => void;
}

export function OperatorSessionModal({
  isOpen, currentSession, defaultUnitCode = 'TCNS', onSubmit, onClose
}: OperatorSessionModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [unitCode, setUnitCode] = useState(defaultUnitCode);
  const [title, setTitle] = useState('Chuyên viên');
  const [customTitle, setCustomTitle] = useState('');
  const [historySessions, setHistorySessions] = useState<EmailSessionRecord[]>([]);
  const [serverWorkbooks, setServerWorkbooks] = useState<ServerLookupItem[]>([]);
  const [selectedWorkbookId, setSelectedWorkbookId] = useState<string | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHistorySessions(getAllEmailSessions());
      if (currentSession?.email) {
        setEmail(currentSession.email);
        setUnitCode(currentSession.unitCode || defaultUnitCode);
        if (COMMON_TITLES.includes(currentSession.title)) setTitle(currentSession.title);
        else { setTitle('Khác (tự nhập)'); setCustomTitle(currentSession.title); }
      } else {
        setEmail('');
        setUnitCode(defaultUnitCode);
      }
    }
  }, [isOpen, currentSession, defaultUnitCode]);

  const lookupServerWorkbooks = useCallback(async (queryEmail: string) => {
    const norm = normalizeEmail(queryEmail);
    if (!norm || norm.length < 4) {
      setServerWorkbooks([]);
      setLookupError(null);
      return;
    }
    setIsSearching(true);
    setLookupError(null);
    try {
      const res = await fetch(`/api/workbooks/lookup?email=${encodeURIComponent(norm)}`);
      if (res.ok) {
        const json = await res.json();
        setServerWorkbooks(json.workbooks || []);
        if (json.workbooks?.length === 1) {
          setUnitCode(json.workbooks[0].unitCode);
          setSelectedWorkbookId(json.workbooks[0].id);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setLookupError({
          code: errJson.code || `HTTP_${res.status}`,
          message: errJson.error || 'Lỗi khi tra cứu hồ sơ trên máy chủ.'
        });
        setServerWorkbooks([]);
      }
    } catch {
      setLookupError({ code: 'NETWORK_ERROR', message: 'Lỗi kết nối mạng đến máy chủ tra cứu hồ sơ.' });
      setServerWorkbooks([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (email.trim()) lookupServerWorkbooks(email.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [email, lookupServerWorkbooks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalEmail = normalizeEmail(email);
    if (!finalEmail) return;
    const finalTitle = title === 'Khác (tự nhập)' ? customTitle.trim() || 'Người thực hiện' : title;
    onSubmit(finalEmail, unitCode, finalTitle, selectedWorkbookId);
    if (typeof window !== 'undefined' && window.location.pathname !== '/bang-tinh') {
      router.push('/bang-tinh');
    }
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#004776]/40 backdrop-blur-xs select-none"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === 'Escape' && onClose) onClose(); }}
        tabIndex={-1}
      >
        <div
          className="relative w-full max-w-xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] bg-white rounded-none sm:rounded-3xl shadow-[0_24px_48px_-12px_rgba(0,71,118,0.22)] border border-[#cbd5e1] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-[#f8fafc] border-b border-[#cbd5e1] shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <img src="/ute_logo.png" alt="HCM-UTE Logo" className="h-10 w-auto object-contain shrink-0" />
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-[#004776] tracking-tight">Đăng nhập phiên làm việc</h3>
                <p className="text-xs sm:text-sm font-medium text-[#476885] truncate">
                  Xác thực tài khoản Google hoặc email công vụ HCM-UTE
                </p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng cửa sổ"
                className="text-[#476885] hover:text-[#004776] p-2 rounded-xl hover:bg-[#e2e8f0]/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex-1 min-h-0 p-5 sm:p-6 space-y-4 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <GoogleOAuthButton label="Đăng nhập nhanh với Google (@hcmute.edu.vn)" />

            <div className="relative flex items-center justify-center">
              <div className="border-t border-[#e2ecf7] w-full" />
              <span className="bg-white px-3 text-xs font-semibold text-[#476885] whitespace-nowrap">
                Hoặc khai báo phiên email công vụ
              </span>
              <div className="border-t border-[#e2ecf7] w-full" />
            </div>

            {historySessions.length > 0 && !currentSession && (
              <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#cbd5e1] space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#004776]">
                  <History className="w-3.5 h-3.5 text-[#004776]" />
                  <span>Phiên làm việc gần đây trên trình duyệt:</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {historySessions.slice(0, 4).map((h) => (
                    <button
                      key={h.email}
                      type="button"
                      onClick={() => { setEmail(h.email); setUnitCode(h.unitCode); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-white hover:bg-[#eef5ff] border border-[#cbd5e1] hover:border-[#004776] text-[#004776] transition-all cursor-pointer font-medium"
                    >
                      <span>{h.email}</span>
                      <span className="text-[#476885]">[{h.unitCode}]</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-[#004776]">
                Email người thực hiện <span className="text-[#b42318]">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#004776]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => { if (email.trim()) setEmail((p) => normalizeEmail(p) || p); }}
                  placeholder="ví dụ: tcns@hcmute.edu.vn"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#cbd5e1] rounded-xl text-sm font-semibold text-[#004776] focus:ring-2 focus:ring-[#004776]/25 focus:border-[#004776] outline-none transition-all"
                />
              </div>
              {lookupError && (
                <div className="p-2.5 rounded-xl bg-[#fdeceb] border border-[#f8b4af] text-xs text-[#b42318] flex items-center justify-between gap-2 mt-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{lookupError.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => lookupServerWorkbooks(email)}
                    className="text-xs font-bold underline cursor-pointer shrink-0"
                  >
                    Thử lại
                  </button>
                </div>
              )}
              <OperatorServerWorkbookPicker
                workbooks={serverWorkbooks}
                selectedWorkbookId={selectedWorkbookId}
                currentUnitCode={unitCode}
                onSelect={(w) => { setUnitCode(w.unitCode); setSelectedWorkbookId(w.id); }}
              />
              {!isSearching && !lookupError && email.trim().length >= 5 && serverWorkbooks.length === 0 && (
                <p className="text-xs text-[#476885] bg-[#f8fafc] px-3 py-1.5 rounded-lg border border-[#e2ecf7] flex items-center gap-1.5 mt-1 font-medium">
                  <Info className="w-3.5 h-3.5 text-[#004776] shrink-0" />
                  <span>Chưa có hồ sơ máy chủ cho email này. Bạn có thể chọn đơn vị bên dưới để tạo phiên mới.</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-[#004776]">
                  Đơn vị công tác <span className="text-[#b42318]">*</span>
                </label>
                <ShadcnSelect
                  value={unitCode}
                  ariaLabel="Đơn vị công tác"
                  options={getFlatHcmuteUnitOptions()}
                  onChange={(val) => { setUnitCode(val); setSelectedWorkbookId(undefined); }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-[#004776]">
                  Chức vụ người điền <span className="text-[#b42318]">*</span>
                </label>
                <ShadcnSelect
                  value={title}
                  ariaLabel="Chức vụ người điền"
                  options={COMMON_TITLES.map((t) => ({ value: t, label: t }))}
                  onChange={(val) => setTitle(val)}
                />
              </div>
            </div>

            {title === 'Khác (tự nhập)' && (
              <input
                type="text"
                required
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Nhập tên chức vụ cụ thể..."
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#cbd5e1] focus:ring-2 focus:ring-[#004776]/25 focus:border-[#004776] outline-hidden text-[#004776] font-semibold"
              />
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              {onClose && (
                <Button type="button" variant="outline" size="default" onClick={onClose}>
                  Đóng
                </Button>
              )}
              <Button type="submit" variant="default" size="default">
                <span>{serverWorkbooks.length > 0 ? 'Tiếp tục hồ sơ' : 'Xác nhận & Bắt đầu'}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
