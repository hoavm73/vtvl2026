'use client';

import React from 'react';
import {
  CheckCircle2, RefreshCw, AlertTriangle, WifiOff,
  Save, Layers, AlertCircle, Database
} from 'lucide-react';
import { OperatorSession } from '@/services/telemetry/operator-session';
import { SyncStatusKind, DataSourceKind, ApiSyncError } from './useOperatorSession';

interface SyncStatusBarProps {
  session: OperatorSession | null;
  unitNameVi: string;
  revision: number;
  syncStatus: SyncStatusKind;
  dataSource?: DataSourceKind;
  apiError?: ApiSyncError | null;
  lastSyncedAt: string | null;
  onSaveNow: () => void;
  onSwitchSession: () => void;
  onRetry?: () => void;
}

export function SyncStatusBar({
  session,
  revision,
  syncStatus,
  dataSource = 'sample',
  apiError,
  lastSyncedAt,
  onSaveNow,
  onRetry
}: SyncStatusBarProps) {
  if (!session) return null;

  return (
    <div className="border-b border-[var(--border-subtle)] bg-[#f8fafc]">
      <div className="px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Bên trái: Phiên bản & trạng thái lưu duy nhất */}
        <div className="flex flex-wrap items-center gap-2 text-[#476885]">
          <span className="inline-flex items-center gap-1 font-medium text-[#004776]">
            <Layers className="w-3.5 h-3.5 text-[#004776]" />
            <span>Phiên bản: <strong>v{revision}</strong></span>
          </span>

          <span className="text-[#cbd5e1]">|</span>

          {syncStatus === 'saving' ? (
            <span className="inline-flex items-center gap-1.5 text-[#004776] font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Đang lưu…</span>
            </span>
          ) : syncStatus === 'conflict' ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--fix)] font-medium">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Lưu thất bại (xung đột revision) — Thử lại</span>
            </span>
          ) : syncStatus === 'offline' ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--warn)] font-medium">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>Ngoại tuyến (đã lưu nháp trên thiết bị)</span>
            </span>
          ) : dataSource === 'server_synced' ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--ok)] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Đã lưu lúc {lastSyncedAt || 'vừa xong'}</span>
            </span>
          ) : dataSource === 'server_restored' ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--ok)] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Đã khôi phục hồ sơ từ máy chủ (v{revision})</span>
            </span>
          ) : dataSource === 'server_created' ? (
            <span className="inline-flex items-center gap-1.5 text-[#004776] font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Đã tạo hồ sơ máy chủ (v1) — sẵn sàng nhập liệu</span>
            </span>
          ) : dataSource === 'local_draft' ? (
            <span className="inline-flex items-center gap-1.5 text-[var(--warn)] font-medium">
              <Save className="w-3.5 h-3.5 shrink-0" />
              <span>Bản nháp trên thiết bị — chưa đồng bộ máy chủ</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[#476885]">
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>Dữ liệu mẫu ban đầu — chưa tạo hồ sơ máy chủ</span>
            </span>
          )}
        </div>

        {/* Bên phải: Nút đồng bộ máy chủ */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSaveNow}
            disabled={syncStatus === 'saving'}
            className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#004776] hover:bg-[#00385c] text-white rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            title="Lưu ngay lập tức dữ liệu 10 biểu lên máy chủ"
          >
            <Save className="w-3 h-3" />
            <span>Lưu máy chủ</span>
          </button>
        </div>
      </div>

      {/* Hiển thị lỗi API rõ ràng và nút thử lại */}
      {apiError && (
        <div className="bg-[var(--fix-soft)] border-t border-[var(--fix)]/25 px-4 py-1.5 flex items-center justify-between text-xs text-[var(--fix)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Lưu thất bại ({apiError.code}):</strong> {apiError.message}
            </span>
          </div>
          {apiError.retryable && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--fix)] hover:opacity-90 text-white rounded-md text-xs font-medium cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Thử lại</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
