'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserCheck, LogOut, RefreshCw, PlusCircle, ArrowRight
} from 'lucide-react';
import {
  OperatorSession,
  getCurrentOperatorSession,
  saveCurrentOperatorSession,
  clearCurrentOperatorSession
} from '@/services/telemetry/operator-session';
import { getActivityLogs, ActivityLogEntry } from '@/services/telemetry/activity-log';
import { getActiveHcmuteUnits } from '@/configs/hcmute-units';
import { HcmuteUnit } from '@/types/vtvl';
import { AdminActivityLogsCard } from './AdminActivityLogsCard';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import {
  UserRole,
  ROLE_OPTIONS,
  adminUpdateUserRoleOnServer
} from '@/services/auth/account-client';

const PRESET_TITLES = [
  'Trưởng phòng', 'Phó Trưởng phòng', 'Trưởng khoa', 'Phó Trưởng khoa',
  'Chuyên viên Tổ chức cán bộ', 'Chuyên viên Kế hoạch', 'Giảng viên', 'Nhân viên'
];

export function AdminSessionControlTab() {
  const router = useRouter();
  const [currentSession, setCurrentSession] = useState<OperatorSession | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [availableUnits, setAvailableUnits] = useState<HcmuteUnit[]>([]);

  const [newEmail, setNewEmail] = useState('tcns@hcmute.edu.vn');
  const [newUnitCode, setNewUnitCode] = useState('TCNS');
  const [newTitle, setNewTitle] = useState('Chuyên viên Tổ chức cán bộ');
  const [newRole, setNewRole] = useState<UserRole>('staff');

  const refreshState = () => {
    setCurrentSession(getCurrentOperatorSession());
    setActivityLogs(getActivityLogs());
    setAvailableUnits(getActiveHcmuteUnits());
  };

  useEffect(() => {
    refreshState();
    const handleOperatorChanged = () => refreshState();
    const handleActivityUpdated = () => setActivityLogs(getActivityLogs());
    window.addEventListener('vtvl-operator-changed', handleOperatorChanged);
    window.addEventListener('vtvl-activity-updated', handleActivityUpdated);
    return () => {
      window.removeEventListener('vtvl-operator-changed', handleOperatorChanged);
      window.removeEventListener('vtvl-activity-updated', handleActivityUpdated);
    };
  }, []);

  const handleLogoutCurrentSession = () => {
    if (confirm('Bạn có chắc muốn rời phiên làm việc hiện tại trên trình duyệt này?')) {
      clearCurrentOperatorSession();
      refreshState();
    }
  };

  const handleClearDraftData = () => {
    if (!currentSession) return;
    if (confirm(`Bạn có chắc muốn xóa bản nháp bảng tính lưu trên máy của đơn vị [${currentSession.unitCode}]? Dữ liệu sẽ khôi phục về mặc định.`)) {
      try {
        localStorage.removeItem(`hcmute_vtvl_grid_state_v2_${currentSession.unitCode}`);
        localStorage.removeItem(`hcmute_vtvl_grid_history_v2_${currentSession.unitCode}`);
        alert('Đã xóa dữ liệu nháp cục bộ thành công.');
      } catch {
        /* ignore */
      }
    }
  };

  const handleCreateAndActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      alert('Vui lòng nhập email công vụ.');
      return;
    }
    const emailTrimmed = newEmail.trim();
    await adminUpdateUserRoleOnServer(
      { email: emailTrimmed, role: newRole, unitCode: newUnitCode, title: newTitle.trim() },
      currentSession
    );
    saveCurrentOperatorSession(emailTrimmed, newUnitCode, newTitle.trim(), { role: newRole });
    refreshState();
    router.push('/bang-tinh');
  };

  const handleClearActivityLogs = () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử nhật ký thao tác?')) {
      try {
        localStorage.removeItem('hcmute_vtvl_activity_logs_v1');
        setActivityLogs([]);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Khối 1: Phiên làm việc hiện hành */}
      <div className="p-4 sm:p-5 border-b border-[#e2e8f0]">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--surface-tint)] border border-[var(--primary)]/20 flex items-center justify-center text-[#004776]">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#004776]">
                Phiên làm việc hiện tại trên trình duyệt
              </h2>
              <p className="text-xs text-[#64748b]">
                Gắn kết với các thao tác nhập liệu bảng tính cục bộ
              </p>
            </div>
          </div>

          {currentSession && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearDraftData}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                title="Xóa bản nháp cục bộ để nạp lại từ đầu"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Xóa nháp dữ liệu đơn vị</span>
              </button>

              <button
                type="button"
                onClick={handleLogoutCurrentSession}
                className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-[var(--fix)] bg-[var(--fix-soft)] hover:opacity-90 border border-[var(--fix)]/30 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Rời phiên</span>
              </button>
            </div>
          )}
        </div>

        {currentSession ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 text-xs">
            <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
              <span className="text-[#64748b] block mb-0.5">Email công vụ:</span>
              <strong className="text-[#004776] text-xs font-semibold break-all">{currentSession.email}</strong>
            </div>

            <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
              <span className="text-[#64748b] block mb-0.5">Đơn vị công tác:</span>
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-[#004776]/10 text-[#004776] font-semibold text-[11px]">
                  {currentSession.unitCode}
                </span>
                <span className="font-medium text-[#004776] truncate" title={currentSession.unitNameVi}>
                  {currentSession.unitNameVi}
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
              <span className="text-[#64748b] block mb-0.5">Chức vụ:</span>
              <strong className="text-[#004776] font-medium">{currentSession.title}</strong>
            </div>

            <div className="p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
              <span className="text-[#64748b] block mb-0.5">Hoạt động lần cuối:</span>
              <strong className="text-emerald-700 font-medium">{currentSession.lastActiveAt || currentSession.startedAt}</strong>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-[#64748b]">
            <p className="font-medium text-xs text-[#004776]">Chưa có phiên làm việc nào được kích hoạt.</p>
          </div>
        )}
      </div>

      {/* Khối 2: Thiết lập hoặc Kích hoạt phiên mới */}
      <div className="p-4 sm:p-5 border-b border-[#e2e8f0]">
        <div className="flex items-center gap-2 pb-3 border-b border-[#f1f5f9]">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#004776]">
              Thiết lập / Chuyển đổi phiên làm việc
            </h2>
            <p className="text-xs text-[#64748b]">
              Chỉ định email, đơn vị và chức vụ để kiểm tra luồng thao tác của đơn vị đó
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateAndActivate} className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#004776]">Email công vụ</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="tcns@hcmute.edu.vn"
              className="w-full h-10 px-3 text-xs bg-white border border-[#cbd5e1] rounded-lg text-[#004776] font-normal focus:ring-2 focus:ring-[#004776]/20 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#004776]">Đơn vị công tác</label>
            <ShadcnSelect
              value={newUnitCode}
              onValueChange={setNewUnitCode}
              options={availableUnits.map((u) => ({ value: u.code, label: `[${u.code}] ${u.nameVi}` }))}
              size="md"
              searchable={true}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#004776]">Chức vụ người điền</label>
            <ShadcnSelect
              value={newTitle}
              onValueChange={setNewTitle}
              options={PRESET_TITLES.map((t) => ({ value: t, label: t }))}
              size="md"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-[#004776]">Vai trò hệ thống</label>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <ShadcnSelect
                  value={newRole}
                  onValueChange={(val) => setNewRole(val as UserRole)}
                  options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
                  size="md"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 h-10 px-4 bg-[#004776] hover:bg-[#00385c] text-white font-medium rounded-lg text-xs transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                <span>Kích hoạt</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Khối 3: Nhật ký hoạt động */}
      <div className="p-4 sm:p-5">
        <AdminActivityLogsCard logs={activityLogs} onClear={handleClearActivityLogs} />
      </div>
    </div>
  );
}
