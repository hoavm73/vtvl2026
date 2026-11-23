'use client';

import React, { useState } from 'react';
import {
  X, AlertTriangle, Printer, Check, CornerDownLeft, FileText, GitCompare, History, RotateCcw, Trash2
} from 'lucide-react';
import { StaffWorkTicket } from '@/types/staff-ticket';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { formatTicketCoordinatedVtvlsText } from '@/services/tickets/vtvl-coordination-helpers';
import { StaffTicketVersionDiffTab } from './StaffTicketVersionDiffTab';
import { TicketApprovalProgress, getTicketStatusMeta } from './TicketApprovalProgress';
import { TicketApprovalHistoryTimeline } from './TicketApprovalHistoryTimeline';

interface StaffTicketDetailModalProps {
  ticket: StaffWorkTicket | null;
  unitNameVi?: string;
  currentUserRole?: 'admin' | 'unit_leader' | 'staff';
  currentUserEmail?: string;
  onClose: () => void;
  onPrint?: (t: StaffWorkTicket) => void;
  onApprove?: (t: StaffWorkTicket) => void | Promise<void>;
  onRequestChanges?: (t: StaffWorkTicket) => void;
  onRevokeApproval?: (t: StaffWorkTicket) => void;
  onCancelTicket?: (t: StaffWorkTicket) => void;
}

export function StaffTicketDetailModal({
  ticket, unitNameVi, currentUserRole, currentUserEmail,
  onClose, onPrint, onApprove, onRequestChanges, onRevokeApproval, onCancelTicket
}: StaffTicketDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'a4' | 'diff' | 'history'>('a4');

  if (!ticket) return null;

  const badge = getTicketStatusMeta(ticket);
  const canonical = badge.canonical;
  const StatusIcon = badge.Icon;
  const canModerate = currentUserRole === 'admin' || currentUserRole === 'unit_leader';
  const canReview = Boolean(canModerate && (canonical === 'submitted' || canonical === 'resubmitted') && onApprove && onRequestChanges);

  const soSp = Number(ticket.soSpNam) || 0;
  const phut = Number(ticket.phutThucTe) || 0;
  const gioBs = Number(ticket.gioBoSung) || 0;
  const totalHoursSp = Math.round(((soSp * phut) / 60) * 10) / 10;
  const totalHoursAll = Math.round((totalHoursSp + gioBs) * 10) / 10;

  const unit = findHcmuteUnit(ticket.unitCode);
  const displayUnitName = unitNameVi || unit.nameVi;
  const today = new Date();
  const versionCount = Array.isArray(ticket.versions) ? ticket.versions.length : (ticket.currentVersionNo || 0);

  const tableFields = [
    { num: '1', label: 'Mã nhiệm vụ (Biểu A1)', val: ticket.maNhiemVu || '—' },
    { num: '2', label: 'Mã công việc (tự sinh)', val: ticket.maCongViec, isCode: true },
    { num: '3', label: 'Tên công việc cụ thể', val: ticket.tenCongViec, isBold: true },
    { num: '4', label: 'Vị trí việc làm chính (Biểu C1)', val: ticket.maVtvl || '—' },
    { num: '5', label: 'VTVL phối hợp (nếu có)', val: formatTicketCoordinatedVtvlsText(ticket) },
    { num: '6', label: 'Sản phẩm đầu ra', val: ticket.sanPham || '—' },
    { num: '7', label: 'Tiêu chuẩn chất lượng', val: ticket.chatLuong || '—' },
    { num: '8', label: 'Căn cứ pháp lý & hồ sơ giải trình', val: ticket.canCu || '—' },
    { num: '9', label: 'Số sản phẩm hoàn thành trong năm trong chu kỳ 1 năm (01/10/2025 đến 30/9/2026)', val: `${ticket.soSpNam} sản phẩm / năm${ticket.nguonSoLieu ? ` (Nguồn: ${ticket.nguonSoLieu})` : ''}` },
    { num: '10', label: 'Thời gian trung bình / 1 SP', val: `${ticket.phutThucTe} phút / sản phẩm` },
    { num: '11', label: 'Giờ bổ sung (Nếu có)', val: `${ticket.gioBoSung || 0} giờ / năm` }
  ];

  const handlePrintA4 = () => {
    if (onPrint) { onClose(); onPrint(ticket); return; }
    if (activeTab !== 'a4') { setActiveTab('a4'); setTimeout(() => window.print(), 60); return; }
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#004776]/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:block print:bg-white print:backdrop-blur-none print:p-0 print:m-0 print:overflow-visible">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col overflow-hidden print:static print:block print:w-full print:max-w-none print:max-h-none print:overflow-visible print:border-none print:shadow-none print:rounded-none">
        {/* Thanh công cụ tiêu đề & thao tác gọn 2 hàng */}
        <div className="px-4 sm:px-6 py-3 bg-[#f8fafc] border-b border-[#e2e8f0] space-y-2.5 shrink-0 print:hidden">
          {/* Hàng 1: Mã phiếu, trạng thái, tên công việc & nút đóng */}
          <div className="flex items-start sm:items-center justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <span className="text-xs font-mono font-bold text-[#0072BC] bg-[#eef5ff] px-2.5 py-0.5 rounded-[6px]">
                  {ticket.maCongViec}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.pillCls}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {badge.label}
                </span>
                {versionCount > 0 && (
                  <span className="text-xs font-bold text-[#004776] bg-white px-2 py-0.5 rounded-[6px] border border-[#cbd5e1] tabular-nums">
                    v{versionCount}
                  </span>
                )}
                {ticket.isMergedToB1B2 && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Đã gộp B1/B2
                  </span>
                )}
              </div>
              <h3 title={ticket.tenCongViec} className="text-sm sm:text-[15px] font-bold text-[#004776] truncate min-w-0 flex-1">
                {ticket.tenCongViec}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng chi tiết phiếu"
              className="w-8 h-8 inline-flex items-center justify-center rounded-[8px] text-[#476885] hover:text-[#004776] hover:bg-[#e2e8f0] cursor-pointer shrink-0 transition-colors"
              title="Đóng"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Hàng 2: Tabs chế độ xem & cụm nút hành động trên 1 hàng */}
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 min-w-0">
            <div className="inline-flex items-center p-0.5 bg-[#e2e8f0] rounded-[10px] overflow-x-auto no-scrollbar max-w-full">
              <button
                type="button"
                onClick={() => setActiveTab('a4')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'a4' ? 'bg-white text-[#004776]' : 'text-[#476885] hover:text-[#004776]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Chi tiết phiếu (A4)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('diff')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'diff' ? 'bg-white text-[#004776]' : 'text-[#476885] hover:text-[#004776]'
                }`}
              >
                <GitCompare className="w-3.5 h-3.5 shrink-0" />
                <span>Thay đổi so với bản trước</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-xs font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'history' ? 'bg-white text-[#004776]' : 'text-[#476885] hover:text-[#004776]'
                }`}
              >
                <History className="w-3.5 h-3.5 shrink-0" />
                <span>Lịch sử phê duyệt</span>
              </button>
            </div>

            <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 w-full lg:w-auto lg:ml-auto min-w-0">
              {canReview && (
                <>
                  <button type="button" onClick={() => onApprove?.(ticket)} className="h-8 px-2.5 rounded-[8px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors">
                    <Check className="w-3.5 h-3.5 shrink-0" /><span>Duyệt phiếu</span>
                  </button>
                  <button type="button" onClick={() => onRequestChanges?.(ticket)} className="h-8 px-2.5 rounded-[8px] bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors">
                    <CornerDownLeft className="w-3.5 h-3.5 shrink-0" /><span>Yêu cầu bổ sung</span>
                  </button>
                </>
              )}
              {canModerate && canonical === 'approved' && onRevokeApproval && (
                <button type="button" onClick={() => onRevokeApproval(ticket)} className="h-8 px-2.5 rounded-[8px] border border-[#fcd34d] bg-white hover:bg-[#fff8eb] text-[#b45309] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors">
                  <RotateCcw className="w-3.5 h-3.5 text-[#d97706] shrink-0" /><span>Thu hồi duyệt</span>
                </button>
              )}
              {canModerate && canonical !== 'draft' && onCancelTicket && (
                <button type="button" onClick={() => onCancelTicket(ticket)} className="h-8 px-2.5 rounded-[8px] border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" /><span>Xóa phiếu</span>
                </button>
              )}
              <button type="button" onClick={handlePrintA4} className="h-8 px-2.5 rounded-[8px] bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors">
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>In PDF (A4)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Nội dung theo tab */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-[#f1f5f9] flex flex-col items-center space-y-4 print:static print:block print:p-0 print:m-0 print:bg-white print:overflow-visible print:space-y-0">
          <div className="w-full max-w-[210mm] print:hidden">
            <TicketApprovalProgress ticket={ticket} variant="banner" />
          </div>
          {ticket.revisionReason && (
            <div className="w-full max-w-[210mm] p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-[#004776] space-y-1 shadow-xs print:hidden">
              <div className="flex items-center gap-1.5 font-bold text-[#004776] text-xs sm:text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Ý kiến / Lý do yêu cầu bổ sung từ Lãnh đạo đơn vị:</span>
              </div>
              <p className="text-xs pl-5 whitespace-pre-wrap leading-relaxed">{ticket.revisionReason}</p>
              {ticket.revisionRequestedBy && (
                <div className="text-[11px] text-[#476885] pl-5 pt-0.5">
                  Người yêu cầu: <strong>{ticket.revisionRequestedByName || ticket.revisionRequestedBy}</strong>
                  {ticket.revisionRequestedByName ? ` (${ticket.revisionRequestedBy})` : ''} •{' '}
                  {ticket.revisionRequestedAt ? new Date(ticket.revisionRequestedAt).toLocaleString('vi-VN') : ''}
                </div>
              )}
            </div>
          )}

          {activeTab === 'diff' ? (
            <StaffTicketVersionDiffTab ticket={ticket} />
          ) : activeTab === 'history' ? (
            <div className="w-full max-w-[210mm] bg-white rounded-2xl border border-[#cbd5e1] p-5 shadow-xs space-y-3">
              <h4 className="text-sm font-bold text-[#004776] border-b border-[#e8eff7] pb-2">
                Lịch sử phê duyệt &amp; phản hồi chi tiết
              </h4>
              <TicketApprovalHistoryTimeline ticket={ticket} />
            </div>
          ) : (
            <div
              id="vtvl-ticket-detail-a4-sheet"
              className="vtvl-printable-sheet bg-white w-full max-w-[210mm] min-h-[297mm] pt-[20mm] pr-[20mm] pb-[20mm] pl-[30mm] shadow-md border border-[#cbd5e1] text-[#004776] text-[13px] leading-relaxed print:static print:block print:w-full print:max-w-none print:min-h-0 print:p-0 print:m-0 print:border-none print:shadow-none"
              style={{ fontFamily: '"Times New Roman", Times, serif' }}
            >
              <div className="grid grid-cols-12 gap-2 text-center mb-5">
                <div className="col-span-6">
                  <div className="text-[11px] uppercase font-normal whitespace-nowrap">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM</div>
                  <div className="text-[11px] font-bold uppercase mt-0.5">{displayUnitName}</div>
                  <div className="w-24 h-[1px] bg-[#004776] mx-auto mt-1" />
                </div>
                <div className="col-span-6">
                  <div className="text-[11px] font-bold uppercase whitespace-nowrap">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                  <div className="text-[12px] font-bold">Độc lập – Tự do – Hạnh phúc</div>
                  <div className="w-32 h-[1px] bg-[#004776] mx-auto mt-1" />
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-[16px] sm:text-[18px] font-bold uppercase tracking-tight text-[#004776]">
                  PHIẾU KHẢO SÁT KHỐI LƯỢNG CÔNG VIỆC CÁ NHÂN
                </h2>
                <div className="text-[12px] italic text-[#476885] mt-0.5">
                  (Kỳ thống kê: Từ ngày 01/10/2025 đến ngày 30/9/2026)
                </div>
              </div>

              <div className="space-y-1.5 mb-5 text-[13px] border-b border-[#e2e8f0] pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><strong>Họ và tên người lập phiếu:</strong> {ticket.ownerName} ({ticket.ownerEmail})</div>
                  <div><strong>Trạng thái:</strong> <span className="font-bold text-[#0072BC]">{badge.label}</span></div>
                </div>
                <div>
                  <strong>Chức danh / Chức vụ:</strong> {ticket.ownerTitle || 'Chuyên viên'} &nbsp;|&nbsp;{' '}
                  <strong>Đơn vị:</strong> {displayUnitName} ({ticket.unitCode})
                </div>
              </div>

              <div className="overflow-x-auto print:overflow-visible mb-6">
                <table className="w-full border-collapse border border-[#004776] text-[12.5px]">
                  <tbody>
                    {tableFields.map((f) => (
                      <tr key={f.num}>
                        <td className="border border-[#004776] px-3 py-2 font-bold w-1/3 align-top">
                          {f.num}. {f.label}
                        </td>
                        <td className={`border border-[#004776] px-3 py-2 whitespace-pre-line leading-relaxed ${f.isCode ? 'font-bold text-[#0072BC]' : f.isBold ? 'font-semibold' : ''}`}>
                          {f.val}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#f8fafc]">
                      <td className="border border-[#004776] px-3 py-2 font-bold align-top">
                        12. Tổng thời gian quy đổi (Biểu B1)
                      </td>
                      <td className="border border-[#004776] px-3 py-2 font-bold text-[#0072BC] text-[13px]">
                        {totalHoursAll} giờ/năm
                        <span className="block font-normal text-[11px] text-[#476885] mt-0.5">
                          (Quy đổi theo sản phẩm: {totalHoursSp} giờ + Giờ bổ sung: {gioBs} giờ)
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center mt-8 pt-4">
                <div>
                  <div className="font-bold text-[12.5px] uppercase">TRƯỞNG ĐƠN VỊ DUYỆT</div>
                  <div className="text-[11px] italic text-[#476885]">(Ký, ghi rõ họ tên và xác nhận)</div>
                  <div className="h-24" />
                </div>
                <div>
                  <div className="text-[12px] italic mb-1 text-[#476885]">
                    TP. Hồ Chí Minh, ngày {today.getDate()} tháng {today.getMonth() + 1} năm {today.getFullYear()}
                  </div>
                  <div className="font-bold text-[12.5px] uppercase">NGƯỜI KÊ KHAI PHIẾU</div>
                  <div className="text-[11px] italic text-[#476885]">(Ký và ghi rõ họ tên)</div>
                  <div className="h-20" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
