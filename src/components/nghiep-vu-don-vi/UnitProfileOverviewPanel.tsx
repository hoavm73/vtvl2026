'use client';

import React from 'react';
import Link from 'next/link';
import { FileSpreadsheet, ShieldCheck, ClipboardCheck, History, ArrowRight, AlertTriangle } from 'lucide-react';
import { UnitSummaryRow, formatCompactTime } from '@/components/overview/UnitMonitoringTypes';
import { WorkbookHistoryTimelineEvent } from '@/services/workbooks/workbook-history-service';

const EVENT_DOT_COLOR: Record<WorkbookHistoryTimelineEvent['source'], string> = {
  review: 'bg-[#006cee] ring-[#e6f1ff]',
  revision: 'bg-[#00b87a] ring-[#e6f9f1]',
  s_nhat_ky: 'bg-[#0ea5e9] ring-[#e0f2fe]',
  ticket: 'bg-[#006cee] ring-[#e6f1ff]',
  audit: 'bg-[#7c3aed] ring-[#f3e8ff]'
};

interface UnitProfileOverviewPanelProps {
  unitCode: string;
  unitNameVi: string;
  groupLabel: string;
  summary: UnitSummaryRow | null;
  loading: boolean;
  error: string | null;
  recentEvents: WorkbookHistoryTimelineEvent[];
  onSelectTab: (tab: 'workbook' | 'tickets' | 'history' | 'check') => void;
}

export function UnitProfileOverviewPanel({
  unitCode,
  unitNameVi,
  groupLabel,
  summary,
  loading,
  error,
  recentEvents,
  onSelectTab
}: UnitProfileOverviewPanelProps) {
  const errCountDisplay = loading || error ? '—' : String(summary?.errorCount ?? 0);
  const ticketCountDisplay = loading || error ? '—' : String(summary?.totalTickets ?? 0);
  const progressDisplay = loading || error ? '—' : `${summary?.progressPercent ?? 0}%`;
  const sheetsDisplay = loading || error ? '—' : `${summary?.populatedSheetsCount ?? 0}/10`;

  return (
    <div className="space-y-6">
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2e8f0] pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#476885]">
            <span className="px-2 py-0.5 rounded-full bg-[#eef5ff] font-bold text-[#006cee]">{unitCode}</span>
            <span>{groupLabel}</span>
            <span>·</span>
            <span className="font-semibold text-[#004776]">Phiên bản v{summary?.workbookRevision || 1}</span>
            {summary?.reviewStatusLabel && (
              <span className="px-2 py-0.5 rounded-full bg-[#f1f5f9] font-semibold text-[#004776]">
                Thẩm định: {summary.reviewStatusLabel}
              </span>
            )}
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[#004776]">{unitNameVi}</h2>
          <p className="text-xs text-[#476885]">
            {summary?.stageLabel || 'Đang đồng bộ trạng thái hồ sơ...'}
            {summary?.submittedAt ? ` · Gửi TCNS: ${summary.submittedAt}` : ''}
            {summary?.reviewerEmail ? ` · Phụ trách TCNS: ${summary.reviewerEmail}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/bang-tinh?unit=${encodeURIComponent(unitCode)}`} className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-[10px] bg-[#006cee] hover:bg-[#005ecc] text-white text-xs font-semibold transition-colors">
            <FileSpreadsheet className="w-4 h-4" /><span>Mở bảng tính 10 biểu</span>
          </Link>
          <button type="button" onClick={() => onSelectTab('check')} className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 rounded-[10px] border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] cursor-pointer">
            <ShieldCheck className="w-4 h-4 text-[#006cee]" /><span>Kiểm tra &amp; gửi TCNS</span>
          </button>
        </div>
      </section>

      {summary?.reviewNote && (
        <div className="rounded-[10px] bg-[#fffbeb] border border-[#fde68a] px-4 py-3 flex items-start gap-2.5 text-xs text-[#004776]">
          <AlertTriangle className="w-4 h-4 text-[#a16207] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Nhận xét thẩm định từ Phòng TCNS:</div>
            <p className="mt-0.5 text-[#20446c]">{summary.reviewNote}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-[10px] bg-[#fdeceb] border border-[#f8b4af] px-4 py-2.5 text-xs text-[#b42318]">
          {error}
        </div>
      )}

      <div className="border-y border-[#e2e8f0] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#e2e8f0]">
        <div className="py-3 px-4">
          <div className="text-xs text-[#476885]">Biểu đã nhập liệu</div>
          <div className="text-xl font-bold text-[#004776] tabular-nums mt-0.5">{sheetsDisplay}</div>
          <div className="text-[11px] text-[#64748b] tabular-nums">{summary ? `${summary.totalRows} dòng dữ liệu` : 'Đang đồng bộ'}</div>
        </div>
        <div className="py-3 px-4">
          <div className="text-xs text-[#476885]">Cảnh báo rà soát</div>
          <div className={`text-xl font-bold tabular-nums mt-0.5 ${(summary?.errorCount ?? 0) > 0 ? 'text-[#b42318]' : 'text-[#13653f]'}`}>{errCountDisplay}</div>
          <div className="text-[11px] text-[#64748b]">Kiểm tra chéo A1–D2</div>
        </div>
        <div className="py-3 px-4">
          <div className="text-xs text-[#476885]">Phiếu công việc</div>
          <div className="text-xl font-bold text-[#004776] tabular-nums mt-0.5">{ticketCountDisplay}</div>
          <div className="text-[11px] text-[#64748b] tabular-nums">{summary ? `Chờ duyệt: ${summary.submittedCount} · Đã gộp: ${summary.mergedCount}` : 'Theo dõi phiếu'}</div>
        </div>
        <div className="py-3 px-4">
          <div className="text-xs text-[#476885]">Tiến độ hoàn thiện</div>
          <div className="text-xl font-bold text-[#006cee] tabular-nums mt-0.5">{progressDisplay}</div>
          <div className="text-[11px] text-[#64748b]">{summary?.lastUpdatedAt ? `Cập nhật: ${summary.lastUpdatedAt}` : 'Chưa phát sinh'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-[#e2e8f0] pb-5">
        <button type="button" onClick={() => onSelectTab('workbook')} className="text-left p-3 rounded-[10px] hover:bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between gap-2 cursor-pointer transition-colors">
          <div>
            <div className="text-xs font-bold text-[#004776]">Nhập &amp; chỉnh sửa bảng tính</div>
            <div className="text-[11px] text-[#476885] mt-0.5">Mở trực tiếp 10 biểu A1–D2, B2_CT, K_KiemTra</div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#006cee] shrink-0" />
        </button>
        <Link href={`/phieu-don-vi?unitCode=${encodeURIComponent(unitCode)}`} className="p-3 rounded-[10px] hover:bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between gap-2 transition-colors">
          <div>
            <div className="text-xs font-bold text-[#004776] flex items-center gap-1"><ClipboardCheck className="w-3.5 h-3.5 text-[#006cee]" /><span>Duyệt &amp; gộp phiếu đơn vị</span></div>
            <div className="text-[11px] text-[#476885] mt-0.5">Quản lý phiếu chờ duyệt và gộp vào B1/B2</div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#006cee] shrink-0" />
        </Link>
        <button type="button" onClick={() => onSelectTab('history')} className="text-left p-3 rounded-[10px] hover:bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-between gap-2 cursor-pointer transition-colors">
          <div>
            <div className="text-xs font-bold text-[#004776] flex items-center gap-1"><History className="w-3.5 h-3.5 text-[#006cee]" /><span>Lịch sử &amp; khôi phục phiên bản</span></div>
            <div className="text-[11px] text-[#476885] mt-0.5">Xem revision, S_NhatKy và nhật ký TCNS</div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#006cee] shrink-0" />
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#20446c]">Hoạt động gần đây</h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e6f9f1] text-[#008f5d] text-[10.5px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00b87a] animate-pulse" /><span>Cập nhật liên tục</span>
            </span>
          </div>
          <button type="button" onClick={() => onSelectTab('history')} className="text-xs font-semibold text-[#006cee] hover:underline cursor-pointer">Xem toàn bộ</button>
        </div>
        {recentEvents.length === 0 ? (
          <p className="text-xs text-[#476885] py-3">Chưa có sự kiện nào được ghi nhận cho đơn vị này.</p>
        ) : (
          <div className="border-t border-[#e2e8f0] pt-3.5">
            <div className="relative pl-5 space-y-3.5">
              <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-[#dbe8f5]" />
              {recentEvents.slice(0, 5).map((ev, idx) => (
                <div key={ev.id} className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                  <span className={`absolute -left-5 top-1.5 w-3 h-3 rounded-full ring-4 ${EVENT_DOT_COLOR[ev.source] || 'bg-[#006cee] ring-[#e6f1ff]'} ${idx === 0 ? 'animate-pulse' : ''}`} />
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-[#eef5ff] text-[#004776] font-semibold text-[11px]">{ev.sourceLabel}</span>
                      <span className="font-semibold text-[#004776] truncate">{ev.title}</span>
                    </div>
                    <div className="text-[11px] text-[#476885] truncate">{ev.details} · {ev.actorEmail}</div>
                  </div>
                  <span className="text-[11px] text-[#64748b] tabular-nums shrink-0">{formatCompactTime(ev.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
