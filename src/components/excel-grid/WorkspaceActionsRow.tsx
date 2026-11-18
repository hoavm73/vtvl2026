'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Layers, ChevronDown, ShieldCheck, Save, ArrowRight, MoreHorizontal,
  RefreshCw, Database, BarChart3, Network, Download, KeyRound,
  FileSpreadsheet, Check, User
} from 'lucide-react';
import { ExcelSheetKey, SheetOrderMode } from './excel-grid-types';
import { OperatorSession } from '@/services/telemetry/operator-session';

interface WorkspaceActionsRowProps {
  activeSheet: ExcelSheetKey;
  session: OperatorSession | null;
  rowsCount: number;
  isDirty: boolean;
  lastSaved: Date | null;
  orderMode: SheetOrderMode;
  canNext: boolean;
  isExporting: boolean;
  isC1Unlocked: boolean;
  onSwitchSession: () => void;
  onToggleOrderMode: (mode: SheetOrderMode) => void;
  onOpenQualityModal: () => void;
  onOpenChartModal?: () => void;
  onOpenOrgTreeModal?: () => void;
  onSaveSheet: () => void;
  onSaveAndNext: () => void;
  onExportWorkbook: () => void;
  onLoadTcnsData: () => void;
  onLoadRecommendedVtvls: () => void;
  onOpenUnlockModal: () => void;
}

export function WorkspaceActionsRow({
  activeSheet, session, orderMode, canNext, isExporting, isC1Unlocked,
  onSwitchSession, onToggleOrderMode, onOpenQualityModal, onOpenChartModal,
  onOpenOrgTreeModal, onSaveSheet, onSaveAndNext, onExportWorkbook,
  onLoadTcnsData, onLoadRecommendedVtvls, onOpenUnlockModal
}: WorkspaceActionsRowProps) {
  const [showOrderMenu, setShowOrderMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const orderMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (orderMenuRef.current && !orderMenuRef.current.contains(target)) setShowOrderMenu(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) setShowMoreMenu(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 min-w-0">
      {/* Bên trái: Người thực hiện & đổi phiên (Hiển thị duy nhất tại đây) */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#476885] min-w-0 max-w-full">
        {session ? (
          <div
            className="inline-flex flex-wrap items-center gap-1.5 bg-[#f8fafc] min-h-[36px] py-1 px-2.5 rounded-lg border border-[#e2e8f0] min-w-0 max-w-full"
            title={`${session.email} · ${session.title || 'Chuyên viên'}`}
          >
            <User className="w-3.5 h-3.5 text-[#004776] shrink-0" />
            <span className="font-medium text-[#004776] truncate max-w-[180px] sm:max-w-[260px]">
              {session.email}
            </span>
            <span className="text-[#94a3b8]">·</span>
            <span className="truncate max-w-[130px] sm:max-w-[180px]">{session.title || 'Chuyên viên'}</span>
            {session.role === 'admin' && (
              <>
                <span className="text-[#cbd5e1]">|</span>
                <button
                  type="button"
                  onClick={onSwitchSession}
                  className="font-semibold text-[#004776] hover:underline cursor-pointer shrink-0"
                >
                  Đổi phiên
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 bg-[#f8fafc] min-h-[36px] py-1 px-2.5 rounded-lg border border-[#e2e8f0] text-xs font-medium text-[#476885]">
            <User className="w-3.5 h-3.5 text-[#476885] shrink-0" />
            <span>Chưa đăng nhập (Xem mẫu)</span>
          </div>
        )}
      </div>

      {/* Bên phải: Thứ tự biểu · Kiểm tra dữ liệu · Lưu biểu · Lưu & sang biểu tiếp · ⋯ */}
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
        <div className="relative hidden sm:block" ref={orderMenuRef}>
          <button
            type="button"
            onClick={() => setShowOrderMenu(!showOrderMenu)}
            className="inline-flex items-center gap-1.5 h-9 px-3 bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#004776] cursor-pointer transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-[#004776]" />
            <span>Thứ tự: {orderMode === 'technical' ? 'Luồng kỹ thuật' : 'Theo file Excel'}</span>
            <ChevronDown className="w-3 h-3 text-[#64748b]" />
          </button>

          {showOrderMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-lg border border-[#cbd5e1] shadow-lg z-50 py-1.5">
              <button
                type="button"
                onClick={() => { onToggleOrderMode('excel'); setShowOrderMenu(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#f8fafc] cursor-pointer ${
                  orderMode === 'excel' ? 'bg-[#f0f9ff] text-[#004776] font-semibold' : 'text-[#004776] font-normal'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#004776]" />
                  <span>Theo file Excel (1..15)</span>
                </span>
                {orderMode === 'excel' && <Check className="w-3.5 h-3.5 text-[#004776]" />}
              </button>
              <button
                type="button"
                onClick={() => { onToggleOrderMode('technical'); setShowOrderMenu(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#f8fafc] cursor-pointer ${
                  orderMode === 'technical' ? 'bg-[#f0f9ff] text-[#004776] font-semibold' : 'text-[#004776] font-normal'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#004776]" />
                  <span>Luồng kỹ thuật (12 bước)</span>
                </span>
                {orderMode === 'technical' && <Check className="w-3.5 h-3.5 text-[#004776]" />}
              </button>
            </div>
          )}
        </div>

        {onOpenOrgTreeModal && (
          <button
            type="button"
            onClick={onOpenOrgTreeModal}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 bg-[#eef5ff] hover:bg-[#e1edf8] border border-[#005fa3]/30 rounded-lg text-xs font-semibold text-[#005fa3] cursor-pointer transition-colors"
            title="Xem sơ đồ cây vị trí việc làm và dự kiến công việc của đơn vị"
          >
            <Network className="w-3.5 h-3.5 text-[#005fa3]" />
            <span>Sơ đồ VTVL</span>
          </button>
        )}

        {onOpenChartModal && (
          <button
            type="button"
            onClick={onOpenChartModal}
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 bg-[#eef5ff] hover:bg-[#e1edf8] border border-[#005fa3]/30 rounded-lg text-xs font-semibold text-[#005fa3] cursor-pointer transition-colors"
            title="Xem biểu đồ trực quan cơ cấu nhân lực từ Biểu C1 và D2"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#005fa3]" />
            <span>Biểu đồ C1–D2</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenQualityModal}
          className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#004776] cursor-pointer transition-colors"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#004776]" />
          <span>Kiểm tra dữ liệu</span>
        </button>

        <button
          type="button"
          onClick={onSaveSheet}
          className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-3 bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-xs font-medium text-[#004776] cursor-pointer transition-colors"
        >
          <Save className="w-3.5 h-3.5 text-[#004776]" />
          <span>Lưu biểu</span>
        </button>

        <button
          type="button"
          onClick={onSaveAndNext}
          disabled={!canNext}
          className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-3.5 bg-[#005fa3] hover:bg-[#004776] text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-1 sm:flex-initial"
        >
          <span>Lưu & sang biểu tiếp</span>
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </button>

        <div className="relative" ref={moreMenuRef}>
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            aria-label="Thêm thao tác khác"
            className="w-10 h-10 sm:w-9 sm:h-9 inline-flex items-center justify-center bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-[#004776] cursor-pointer transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-[min(16rem,calc(100vw-2rem))] bg-white rounded-lg border border-[#cbd5e1] shadow-lg z-50 py-1.5">
              {onOpenOrgTreeModal && (
                <button
                  type="button"
                  onClick={() => { onOpenOrgTreeModal(); setShowMoreMenu(false); }}
                  className="w-full text-left px-3.5 py-2.5 sm:py-2 text-xs text-[#005fa3] font-semibold hover:bg-[#f8fafc] flex items-center gap-2 cursor-pointer"
                >
                  <Network className="w-3.5 h-3.5 text-[#005fa3]" />
                  <span>Sơ đồ VTVL dự kiến</span>
                </button>
              )}

        {onOpenChartModal && (
                <button
                  type="button"
                  onClick={() => { onOpenChartModal(); setShowMoreMenu(false); }}
                  className="w-full text-left px-3.5 py-2.5 sm:py-2 text-xs text-[#005fa3] font-semibold hover:bg-[#f8fafc] flex items-center gap-2 cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-[#005fa3]" />
                  <span>Biểu đồ cơ cấu nhân lực (C1–D2)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => { onOpenQualityModal(); setShowMoreMenu(false); }}
                className="sm:hidden w-full text-left px-3.5 py-2.5 text-xs text-[#004776] hover:bg-[#f8fafc] flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#004776]" />
                <span>Kiểm tra dữ liệu 10 biểu</span>
              </button>
              <button
                type="button"
                onClick={() => { onToggleOrderMode(orderMode === 'excel' ? 'technical' : 'excel'); setShowMoreMenu(false); }}
                className="sm:hidden w-full text-left px-3.5 py-2.5 text-xs text-[#004776] hover:bg-[#f8fafc] flex items-center gap-2 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#004776]" />
                <span>Đổi thứ tự ({orderMode === 'excel' ? 'Luồng kỹ thuật' : 'Theo file Excel'})</span>
              </button>
              <button
                type="button"
                onClick={() => { onLoadTcnsData(); setShowMoreMenu(false); }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 text-xs text-[#004776] hover:bg-[#f8fafc] flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#004776]" />
                <span>Nạp mẫu chuẩn TCNS</span>
              </button>
              <button
                type="button"
                onClick={() => { onLoadRecommendedVtvls(); setShowMoreMenu(false); }}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 text-xs text-[#004776] hover:bg-[#f8fafc] flex items-center gap-2 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-[#005fa3]" />
                <span>Nạp gợi ý danh mục VTVL</span>
              </button>
              {activeSheet === 'C1' && !isC1Unlocked && (
                <button
                  type="button"
                  onClick={() => { onOpenUnlockModal(); setShowMoreMenu(false); }}
                  className="w-full text-left px-3.5 py-2.5 sm:py-2 text-xs text-[#004776] hover:bg-[#f8fafc] flex items-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[var(--warn)]" />
                  <span>Mở khóa chỉnh sửa C1</span>
                </button>
              )}
              <div className="border-t border-[#f1f5f9] my-1" />
              <button
                type="button"
                onClick={() => { onExportWorkbook(); setShowMoreMenu(false); }}
                disabled={isExporting}
                className="w-full text-left px-3.5 py-2.5 sm:py-2 text-xs text-[#004776] font-semibold hover:bg-[#f0f9ff] flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#004776]" />
                <span>{isExporting ? 'Đang xuất...' : 'Xuất tệp Excel (.xlsx)'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
