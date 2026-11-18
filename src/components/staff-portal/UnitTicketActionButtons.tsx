'use client';

import React from 'react';
import {
  CheckCircle2, AlertTriangle, Eye, Printer, Layers, Link2, Edit3, RefreshCw, RotateCcw, Trash2
} from 'lucide-react';
import { CanonicalTicketStatus, StaffWorkTicket } from '@/types/staff-ticket';

interface UnitTicketActionButtonsProps {
  ticket: StaffWorkTicket;
  canonical: CanonicalTicketStatus;
  isLeader: boolean;
  isOwnTicket: boolean;
  isOwnLeaderTicket: boolean;
  onViewTicket: (ticket: StaffWorkTicket) => void;
  onPrintTicket: (ticket: StaffWorkTicket) => void;
  onEditTicket?: (ticket: StaffWorkTicket) => void;
  onCoordTicket?: (ticket: StaffWorkTicket) => void;
  onSubmitTicket?: (ticket: StaffWorkTicket, isResubmit: boolean) => void;
  onApproveTicket?: (ticket: StaffWorkTicket) => Promise<void>;
  onRequestChanges?: (ticket: StaffWorkTicket) => void;
  onMergeTicket?: (ticket: StaffWorkTicket) => void;
  onRevokeApproval?: (ticket: StaffWorkTicket) => void;
  onCancelTicket?: (ticket: StaffWorkTicket) => void;
}

export function UnitTicketActionButtons({
  ticket: t, canonical, isLeader, isOwnTicket, isOwnLeaderTicket,
  onViewTicket, onPrintTicket, onEditTicket, onCoordTicket, onSubmitTicket,
  onApproveTicket, onRequestChanges, onMergeTicket, onRevokeApproval, onCancelTicket
}: UnitTicketActionButtonsProps) {
  const canReview = isLeader && (canonical === 'submitted' || canonical === 'resubmitted');
  const canMerge = isLeader && canonical === 'approved';
  const canModerateOthers = isLeader && !isOwnLeaderTicket;

  return (
    <div className="flex flex-wrap md:flex-nowrap items-center xl:justify-end gap-1.5 w-full">
      <button type="button" onClick={() => onViewTicket(t)} className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0">
        <Eye className="w-3.5 h-3.5 text-[#006cee] shrink-0" /> Xem chi tiết
      </button>

      <button type="button" onClick={() => onPrintTicket(t)} className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0">
        <Printer className="w-3.5 h-3.5 text-[#006cee] shrink-0" /> In PDF
      </button>

      {isOwnTicket && onCoordTicket && (
        <button type="button" onClick={() => onCoordTicket(t)} className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-medium text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0">
          <Link2 className="w-3.5 h-3.5 text-[#006cee] shrink-0" /> Phối hợp
        </button>
      )}

      {isOwnTicket && onEditTicket && !t.isMergedToB1B2 && (canonical === 'changes_requested' || canonical === 'draft' || canonical === 'submitted' || canonical === 'resubmitted') && (
        <button type="button" onClick={() => onEditTicket(t)} className="h-8 px-2.5 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0">
          <Edit3 className="w-3.5 h-3.5 text-[#006cee] shrink-0" /> Chỉnh sửa
        </button>
      )}

      {isOwnTicket && onSubmitTicket && canonical === 'changes_requested' && (
        <button type="button" onClick={() => onSubmitTicket(t, true)} className="h-8 px-2.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors whitespace-nowrap shrink-0">
          <RefreshCw className="w-3.5 h-3.5 shrink-0" /> Nộp lại
        </button>
      )}

      {isLeader && onApproveTicket && canReview && (
        isOwnLeaderTicket ? (
          <span className="text-[11px] font-medium text-[#b45309] bg-[#fff8eb] px-2.5 py-1 rounded-lg border border-[#fcd34d] whitespace-nowrap shrink-0">
            Phiếu cá nhân của Lãnh đạo (Cần TCNS duyệt)
          </span>
        ) : (
          <>
            {onRequestChanges && (
              <button type="button" onClick={() => onRequestChanges(t)} className="h-8 px-2.5 rounded-lg border border-[#fcd34d] bg-white hover:bg-[#fff8eb] text-[#b45309] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-[#f99c00] shrink-0" /> Yêu cầu bổ sung
              </button>
            )}
            <button type="button" onClick={() => onApproveTicket(t)} className="h-8 px-2.5 rounded-lg bg-[#00a86b] hover:bg-[#008f5d] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors whitespace-nowrap shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Duyệt phiếu
            </button>
          </>
        )
      )}

      {canMerge && onMergeTicket && (
        <button
          type="button"
          onClick={() => onMergeTicket(t)}
          className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-2xs transition-colors whitespace-nowrap shrink-0 ${
            t.isMergedToB1B2
              ? 'border border-[#a7f3d0] bg-[#e6f9f1] text-[#008f5d] hover:bg-[#d1fae5]'
              : 'bg-[#006cee] hover:bg-[#005ecc] text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>{t.isMergedToB1B2 ? 'Cập nhật gộp B1/B2' : 'Gộp vào B1/B2'}</span>
        </button>
      )}

      {canModerateOthers && canonical === 'approved' && onRevokeApproval && (
        <button
          type="button"
          onClick={() => onRevokeApproval(t)}
          className="h-8 px-2.5 rounded-lg border border-[#fcd34d] bg-white hover:bg-[#fff8eb] text-[#b45309] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          title="Thu hồi phê duyệt để nhân viên chỉnh sửa lại phiếu (tự gỡ khỏi B1/A2 nếu đã gộp)"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#d97706] shrink-0" /> Thu hồi duyệt
        </button>
      )}

      {canModerateOthers && (canonical === 'approved' || canonical === 'submitted' || canonical === 'resubmitted' || canonical === 'changes_requested' || canonical === 'draft') && onCancelTicket && (
        <button
          type="button"
          onClick={() => onCancelTicket(t)}
          className="h-8 px-2.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          title="Hủy / xóa phiếu kê khai sai khỏi đơn vị (tự gỡ khỏi B1/A2 nếu đã gộp)"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" /> Xóa phiếu
        </button>
      )}
    </div>
  );
}
