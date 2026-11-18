'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { FileText, History, Clock, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, User, ChevronDown } from 'lucide-react';
import { MonitorTicketItem, MonitorHistoryItem, formatCompactTime, matchesMonitorSearch } from './UnitMonitoringTypes';
import { MonitorSearchInput } from './MonitorSearchInput';

interface UnitMonitoringHistoryPanelProps {
  selectedUnit: string;
  tickets: MonitorTicketItem[];
  history: MonitorHistoryItem[];
  externalStatusSync?: string;
  onSelectUnit: (unitCode: string) => void;
}

const STATUS_BADGE_META: Record<string, { label: string; badgeClass: string; stripeClass: string; Icon: React.ComponentType<{ className?: string }> }> = {
  approved: { label: 'Đã duyệt', badgeClass: 'bg-[#e6f9f1] text-[#008f5d]', stripeClass: 'bg-[#00b87a]', Icon: CheckCircle2 },
  changes_requested: { label: 'Yêu cầu bổ sung', badgeClass: 'bg-[#fff4e5] text-[#c26d00]', stripeClass: 'bg-[#f99c00]', Icon: AlertTriangle },
  resubmitted: { label: 'Đã nộp lại', badgeClass: 'bg-purple-50 text-purple-700', stripeClass: 'bg-[#7c3aed]', Icon: RefreshCw },
  submitted: { label: 'Chờ duyệt', badgeClass: 'bg-[#e6f1ff] text-[#006cee]', stripeClass: 'bg-[#006cee]', Icon: Clock },
  draft: { label: 'Lưu nháp', badgeClass: 'bg-[#eef4fb] text-[#20446c]', stripeClass: 'bg-[#94b2d0]', Icon: Clock }
};

const TIMELINE_DOT_COLOR: Record<MonitorHistoryItem['category'], string> = {
  ticket: 'bg-[#006cee] ring-[#e6f1ff]',
  workbook: 'bg-[#00b87a] ring-[#e6f9f1]',
  audit: 'bg-[#7c3aed] ring-[#f3e8ff]'
};

const TICKET_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'pending', label: 'Chờ duyệt' },
  { id: 'changes_requested', label: 'Cần bổ sung' },
  { id: 'approved', label: 'Đã duyệt' },
  { id: 'merged', label: 'Đã gộp B1/B2' },
  { id: 'draft', label: 'Lưu nháp' }
] as const;

const HISTORY_TABS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'ticket', label: 'Phiếu CV' },
  { id: 'workbook', label: 'Bảng tính' },
  { id: 'audit', label: 'Nhật ký' }
] as const;

/**
 * Hai khối song song chuẩn S-Link: Danh sách phiếu phẳng có vạch trạng thái & Dòng thời gian lịch sử dọc.
 */
export function UnitMonitoringHistoryPanel({
  selectedUnit,
  tickets,
  history,
  externalStatusSync,
  onSelectUnit
}: UnitMonitoringHistoryPanelProps) {
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('ALL');
  const [ticketSearch, setTicketSearch] = useState<string>('');
  const [historyCatFilter, setHistoryCatFilter] = useState<'ALL' | 'ticket' | 'workbook' | 'audit'>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [ticketsExpanded, setTicketsExpanded] = useState<boolean>(true);
  const [historyExpanded, setHistoryExpanded] = useState<boolean>(true);

  useEffect(() => {
    if (externalStatusSync !== undefined) setTicketStatusFilter(externalStatusSync);
  }, [externalStatusSync]);

  const searchedTickets = useMemo(
    () =>
      tickets.filter((t) =>
        matchesMonitorSearch(
          [t.unitCode, t.unitNameVi, t.maNhiemVu, t.maCongViec, t.tenCongViec, t.maVtvl, t.ownerName, t.ownerEmail, t.status, t.revisionReason, t.lastChangeSummary],
          ticketSearch
        )
      ),
    [tickets, ticketSearch]
  );

  const ticketTabCounts = useMemo(() => ({
    ALL: searchedTickets.length,
    pending: searchedTickets.filter((t) => t.canonicalStatus === 'submitted' || t.canonicalStatus === 'resubmitted').length,
    changes_requested: searchedTickets.filter((t) => t.canonicalStatus === 'changes_requested').length,
    approved: searchedTickets.filter((t) => t.canonicalStatus === 'approved').length,
    merged: searchedTickets.filter((t) => t.isMergedToB1B2).length,
    draft: searchedTickets.filter((t) => t.canonicalStatus === 'draft').length
  }), [searchedTickets]);

  const filteredTickets = useMemo(() => searchedTickets.filter((t) => {
    if (ticketStatusFilter === 'ALL') return true;
    if (ticketStatusFilter === 'merged') return t.isMergedToB1B2;
    if (ticketStatusFilter === 'pending') return t.canonicalStatus === 'submitted' || t.canonicalStatus === 'resubmitted';
    return t.canonicalStatus === ticketStatusFilter;
  }), [searchedTickets, ticketStatusFilter]);

  const filteredHistory = useMemo(
    () =>
      history.filter(
        (h) =>
          (historyCatFilter === 'ALL' ? true : h.category === historyCatFilter) &&
          matchesMonitorSearch([h.unitCode, h.unitNameVi, h.actionLabel, h.title, h.details, h.actorEmail], historySearch)
      ),
    [history, historyCatFilter, historySearch]
  );

  return (
    <div className="bg-white rounded-[16px] border border-[#e2e8f0] overflow-hidden grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-[#e2e8f0] min-w-0">
      {/* Cột trái: Danh sách phiếu khảo sát phẳng, vạch màu trạng thái */}
      <div className="flex flex-col min-w-0">
        <div className="px-4 py-3.5 border-b border-[#e2e8f0] bg-[#f8fafc] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setTicketsExpanded((v) => !v)} aria-expanded={ticketsExpanded} className="flex items-center gap-2 shrink-0 cursor-pointer text-left">
              <FileText className="w-4 h-4 text-[#006cee] shrink-0" />
              <h3 className="text-sm font-bold text-[#004776]">Phiếu khảo sát hiện có ({filteredTickets.length})</h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#e1edf8] text-[#20446c] shrink-0">{selectedUnit !== 'ALL' ? `[${selectedUnit}]` : 'Toàn trường'}</span>
              <ChevronDown className={`w-4 h-4 text-[#476885] transition-transform ${ticketsExpanded ? 'rotate-180' : ''}`} />
            </button>
            <MonitorSearchInput value={ticketSearch} onChange={setTicketSearch} placeholder="Tìm mã CV, tên việc…" ariaLabel="Tìm kiếm phiếu khảo sát" className="w-full sm:w-[236px]" />
          </div>

          {ticketsExpanded && (
            <div className="flex flex-wrap items-center gap-1.5">
              {TICKET_TABS.map((tab) => {
                const cnt = ticketTabCounts[tab.id];
                const isActive = ticketStatusFilter === tab.id;
                return (
                  <button key={tab.id} type="button" onClick={() => setTicketStatusFilter(tab.id)} className={`h-7 px-2.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors inline-flex items-center gap-1 ${isActive ? 'bg-[#006cee] text-white' : 'bg-white text-[#20446c] hover:bg-[#eef5ff] hover:text-[#004776]'}`}>
                    <span>{tab.label}</span>
                    {cnt > 0 && <span className={`text-[10px] tabular-nums ${isActive ? 'text-white/90' : 'text-[#006cee] font-bold'}`}>{cnt}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {ticketsExpanded && (filteredTickets.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-[#20446c]">Chưa có phiếu khảo sát nào khớp với bộ lọc hiện tại.</div>
        ) : (
          <div className="divide-y divide-[#e2e8f0] max-h-[430px] overflow-y-auto">
            {filteredTickets.map((t) => {
              const meta = STATUS_BADGE_META[t.canonicalStatus] || STATUS_BADGE_META.draft;
              const BadgeIcon = meta.Icon;
              return (
                <div key={t.id} className="px-4 py-3 hover:bg-[#f8fbff] transition-colors flex gap-3">
                  <div className={`w-1 rounded-full shrink-0 self-stretch ${meta.stripeClass}`} />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => onSelectUnit(t.unitCode)}
                          className="text-[11px] font-bold px-2 py-0.5 rounded-[6px] bg-[#e1edf8] text-[#004776] hover:bg-[#006cee] hover:text-white cursor-pointer transition-colors"
                        >
                          {t.unitCode}
                        </button>
                        <span className="text-[11.5px] font-mono font-bold text-[#006cee] tabular-nums">{t.maCongViec}</span>
                        {t.currentVersionNo > 0 && (
                          <span className="text-[10.5px] font-semibold text-[#20446c] bg-[#f1f5f9] px-1.5 py-0.5 rounded-full tabular-nums">
                            v{t.currentVersionNo}
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.badgeClass}`}>
                          <BadgeIcon className="w-3 h-3" /> {meta.label}
                        </span>
                        {t.isMergedToB1B2 && (
                          <span className="text-[11px] font-semibold text-[#008f5d] bg-[#e6f9f1] px-2 py-0.5 rounded-full">Đã gộp B1/B2</span>
                        )}
                        {t.isTestData && (
                          <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">Dữ liệu thử</span>
                        )}
                      </div>

                      <Link
                        href={`/phieu-don-vi?unitCode=${encodeURIComponent(t.unitCode)}&tab=all`}
                        onClick={() => { if (typeof window !== 'undefined') localStorage.setItem('vtvl_active_unit_code', t.unitCode); }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#006cee] hover:text-[#004776] shrink-0"
                      >
                        <span>Mở phiếu</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="text-[13px] font-semibold text-[#004776] leading-snug">{t.tenCongViec}</div>

                    {t.revisionReason && (
                      <div className="px-2.5 py-1.5 rounded-[8px] bg-[#fff8eb] border-l-2 border-[#f99c00] text-[11px] text-[#004776]">
                        <strong>Yêu cầu sửa:</strong> {t.revisionReason}
                      </div>
                    )}
                    {t.lastChangeSummary && (
                      <div className="px-2.5 py-1.5 rounded-[8px] bg-[#f4f9ff] border-l-2 border-[#006cee] text-[11px] text-[#004776]">
                        <strong>Giải trình:</strong> {t.lastChangeSummary}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#20446c]/80 tabular-nums">
                      <span className="inline-flex items-center gap-1 min-w-0 truncate">
                        <User className="w-3 h-3 text-[#006cee] shrink-0" />
                        <strong className="text-[#004776] truncate">{t.ownerName || t.ownerEmail}</strong>
                        <span className="truncate">({t.ownerEmail})</span>
                      </span>
                      <span className="shrink-0">
                        <strong className="text-[#004776]">{t.soSpNam}</strong> SP · <strong className="text-[#004776]">{t.totalHours}h</strong>/năm · {formatCompactTime(t.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Cột phải: Dòng thời gian lịch sử hoạt động (Vertical Timeline) */}
      <div className="flex flex-col min-w-0">
        <div className="px-4 py-3.5 border-b border-[#e2e8f0] bg-[#f8fafc] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setHistoryExpanded((v) => !v)} aria-expanded={historyExpanded} className="flex items-center gap-2 shrink-0 cursor-pointer text-left">
              <History className="w-4 h-4 text-[#006cee] shrink-0" />
              <h3 className="text-sm font-bold text-[#004776]">Nhật ký hoạt động ({filteredHistory.length})</h3>
              <ChevronDown className={`w-4 h-4 text-[#476885] transition-transform ${historyExpanded ? 'rotate-180' : ''}`} />
            </button>
            <MonitorSearchInput value={historySearch} onChange={setHistorySearch} placeholder="Tìm đơn vị, nội dung…" ariaLabel="Tìm kiếm nhật ký tiến trình và lịch sử" className="w-full sm:w-[236px]" />
          </div>
          {historyExpanded && (
            <div className="flex flex-wrap items-center gap-1.5">
              {HISTORY_TABS.map((c) => (
                <button key={c.id} type="button" onClick={() => setHistoryCatFilter(c.id)} className={`h-7 px-2.5 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${historyCatFilter === c.id ? 'bg-[#004776] text-white' : 'bg-white text-[#20446c] hover:bg-[#eef5ff] hover:text-[#004776]'}`}>
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {historyExpanded && (filteredHistory.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-[#20446c]">Chưa có bản ghi lịch sử hoạt động nào.</div>
        ) : (
          <div className="p-4 max-h-[430px] overflow-y-auto">
            <div className="relative pl-5 space-y-4">
              <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-[#dbe8f5]" />
              {filteredHistory.map((item) => (
                <div key={item.id} className="relative space-y-1">
                  <span className={`absolute -left-5 top-1.5 w-3 h-3 rounded-full ring-4 ${TIMELINE_DOT_COLOR[item.category]}`} />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectUnit(item.unitCode)}
                        className="text-[11px] font-bold text-[#006cee] hover:underline cursor-pointer shrink-0"
                      >
                        [{item.unitCode}]
                      </button>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eef5ff] text-[#004776] truncate">
                        {item.actionLabel}
                      </span>
                    </div>
                    <span className="text-[10.5px] text-[#20446c]/75 shrink-0 tabular-nums">{formatCompactTime(item.timestampIso)}</span>
                  </div>
                  <div className="text-xs font-semibold text-[#004776] leading-snug">{item.title}</div>
                  <div className="text-[11px] text-[#20446c] leading-relaxed">{item.details}</div>
                  <div className="text-[10.5px] text-[#20446c]/80">
                    Thực hiện: <strong className="text-[#004776]">{item.actorEmail}</strong> · {item.unitNameVi}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
