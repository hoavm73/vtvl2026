'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText, History, Clock, CheckCircle2, AlertTriangle,
  RefreshCw, FileSpreadsheet, ShieldCheck, ExternalLink, User
} from 'lucide-react';
import { MonitorTicketItem, MonitorHistoryItem } from './UnitMonitoringTypes';

interface UnitMonitoringHistoryPanelProps {
  selectedUnit: string;
  tickets: MonitorTicketItem[];
  history: MonitorHistoryItem[];
  onSelectUnit: (unitCode: string) => void;
}

export function UnitMonitoringHistoryPanel({
  selectedUnit,
  tickets,
  history,
  onSelectUnit
}: UnitMonitoringHistoryPanelProps) {
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL');
  const [historyCatFilter, setHistoryCatFilter] = useState<'ALL' | 'ticket' | 'workbook' | 'audit'>('ALL');

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (ticketStatusFilter === 'ALL') return true;
      if (ticketStatusFilter === 'merged') return t.isMergedToB1B2;
      if (ticketStatusFilter === 'pending') return t.canonicalStatus === 'submitted' || t.canonicalStatus === 'resubmitted';
      return t.canonicalStatus === ticketStatusFilter;
    });
  }, [tickets, ticketStatusFilter]);

  const filteredHistory = useMemo(() => {
    return history.filter((h) => (historyCatFilter === 'ALL' ? true : h.category === historyCatFilter));
  }, [history, historyCatFilter]);

  const formatTime = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const renderStatusBadge = (t: MonitorTicketItem) => {
    if (t.canonicalStatus === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Đã duyệt
        </span>
      );
    }
    if (t.canonicalStatus === 'changes_requested') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3" /> Yêu cầu bổ sung
        </span>
      );
    }
    if (t.canonicalStatus === 'resubmitted') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <RefreshCw className="w-3 h-3" /> Đã nộp lại
        </span>
      );
    }
    if (t.canonicalStatus === 'submitted') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-[#0072BC] border border-blue-200">
          <Clock className="w-3 h-3" /> Chờ duyệt
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#f1f5f9] text-[#004776] border border-[#cbd5e1]">
        <Clock className="w-3 h-3" /> Lưu nháp
      </span>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
      {/* Cột trái: Danh sách phiếu công việc hiện có */}
      <div className="lg:col-span-7 bg-[#f8fbff] rounded-2xl border border-[#dbe8f5] p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2ecf7] pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0072BC]" />
            <h3 className="text-sm font-bold text-[#004776]">
              Phiếu khảo sát hiện có ({filteredTickets.length})
              {selectedUnit !== 'ALL' ? ` — Đơn vị [${selectedUnit}]` : ' — Toàn trường'}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'draft', label: 'Lưu nháp' },
              { id: 'pending', label: 'Gửi duyệt' },
              { id: 'changes_requested', label: 'Cần bổ sung' },
              { id: 'approved', label: 'Đã duyệt' },
              { id: 'merged', label: 'Đã gộp B1/B2' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTicketStatusFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  ticketStatusFilter === tab.id
                    ? 'bg-[#0072BC] text-white shadow-2xs'
                    : 'bg-white text-[#004776] border border-[#d8e3ef] hover:bg-[#eef5ff]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#476885] bg-white rounded-xl border border-[#e2ecf7]">
            Chưa có phiếu khảo sát nào khớp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
            {filteredTickets.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-xl bg-white border border-[#dbe8f5] hover:border-[#0072BC] transition-all space-y-2 shadow-2xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectUnit(t.unitCode)}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e1edf8] text-[#004776] hover:bg-[#0072BC] hover:text-white cursor-pointer transition-colors"
                    >
                      [{t.unitCode}]
                    </button>
                    <span className="text-xs font-mono font-bold text-[#0072BC] bg-[#eef5ff] px-2 py-0.5 rounded-md">
                      {t.maCongViec}
                    </span>
                    {t.currentVersionNo > 0 && (
                      <span className="text-[11px] font-bold text-[#004776] bg-[#f8fafc] px-2 py-0.5 rounded-md border border-[#cbd5e1]">
                        v{t.currentVersionNo}
                      </span>
                    )}
                    {renderStatusBadge(t)}
                    {t.isMergedToB1B2 && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Đã gộp B1/B2
                      </span>
                    )}
                    {t.isTestData && (
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        Dữ liệu thử lịch sử
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/phieu-cong-viec?unitCode=${encodeURIComponent(t.unitCode)}&tab=unit`}
                    onClick={() => {
                      if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', t.unitCode);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0072BC] hover:text-[#004776]"
                  >
                    <span>Mở phiếu</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>

                <div className="text-xs sm:text-sm font-bold text-[#004776] leading-snug">
                  {t.tenCongViec}
                </div>

                {t.revisionReason && (
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-[#004776]">
                    <strong>Yêu cầu chỉnh sửa:</strong> {t.revisionReason}
                  </div>
                )}
                {t.lastChangeSummary && (
                  <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-200 text-[11px] text-[#004776]">
                    <strong>Giải trình cập nhật:</strong> {t.lastChangeSummary}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#476885] pt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <User className="w-3 h-3 text-[#0072BC]" />
                    <strong>{t.ownerName || t.ownerEmail}</strong> ({t.ownerEmail})
                  </span>
                  <span>
                    Sản lượng: <strong>{t.soSpNam}</strong> SP • Tổng: <strong>{t.totalHours}h</strong>/năm • Cập nhật: {formatTime(t.updatedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cột phải: Dòng thời gian Lịch sử hiện có & Nhật ký tiến trình */}
      <div className="lg:col-span-5 bg-[#f8fbff] rounded-2xl border border-[#dbe8f5] p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2ecf7] pb-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#0072BC]" />
            <h3 className="text-sm font-bold text-[#004776]">
              Lịch sử hoạt động &amp; Tiến trình ({filteredHistory.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'ticket', label: 'Phiếu CV' },
              { id: 'workbook', label: 'Bảng tính' },
              { id: 'audit', label: 'Nhật ký' }
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setHistoryCatFilter(c.id as 'ALL' | 'ticket' | 'workbook' | 'audit')}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  historyCatFilter === c.id
                    ? 'bg-[#004776] text-white'
                    : 'bg-white text-[#004776] border border-[#d8e3ef] hover:bg-[#eef5ff]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#476885] bg-white rounded-xl border border-[#e2ecf7]">
            Chưa có bản ghi lịch sử hoạt động nào.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
            {filteredHistory.map((item) => {
              const CatIcon =
                item.category === 'ticket' ? FileText : item.category === 'workbook' ? FileSpreadsheet : ShieldCheck;
              return (
                <div key={item.id} className="p-3 rounded-xl bg-white border border-[#dbe8f5] space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CatIcon className="w-3.5 h-3.5 text-[#0072BC] shrink-0" />
                      <button
                        type="button"
                        onClick={() => onSelectUnit(item.unitCode)}
                        className="text-[11px] font-bold text-[#0072BC] hover:underline cursor-pointer shrink-0"
                      >
                        [{item.unitCode}]
                      </button>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#eef5ff] text-[#004776] truncate">
                        {item.actionLabel}
                      </span>
                    </div>
                    <span className="text-[10.5px] text-[#476885] shrink-0">{formatTime(item.timestampIso)}</span>
                  </div>
                  <div className="text-xs font-bold text-[#004776] leading-snug">{item.title}</div>
                  <div className="text-[11px] text-[#335d84] leading-relaxed">{item.details}</div>
                  <div className="text-[10.5px] text-[#476885]">
                    Người thực hiện: <strong className="text-[#004776]">{item.actorEmail}</strong> • {item.unitNameVi}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
