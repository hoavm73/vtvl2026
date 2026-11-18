'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, CheckCircle2, Eye, Handshake, Lock, Search, ShieldAlert, UserCheck } from 'lucide-react';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { normalizeCode, PROPOSED_TAB_EMPTY_MESSAGE } from '@/services/tickets/vtvl-coordination-helpers';
import { ProposedCoordinatedTaskItem } from '@/types/staff-ticket';
import { ProposedCoordinatedDetailModal } from './ProposedCoordinatedDetailModal';

interface ViewerVtvlBadge {
  id: string;
  unitCode: string;
  maVtvl: string;
  tenVtvl?: string;
}

interface ProposedCoordinatedSideCardProps {
  items: ProposedCoordinatedTaskItem[];
  myAssignments: ViewerVtvlBadge[];
  unitCode?: string;
  selectedVtvl?: string;
  loading: boolean;
  onOpenFullTab: () => void;
}

function getBadgeCls(canonical: string): string {
  if (canonical === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (canonical === 'changes_requested') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (canonical === 'resubmitted') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  return 'bg-[#eff8ff] text-[#006cee] border-[#bfdbfe]';
}

export function ProposedCoordinatedSideCard({
  items,
  myAssignments,
  unitCode,
  selectedVtvl,
  loading,
  onOpenFullTab
}: ProposedCoordinatedSideCardProps) {
  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState<ProposedCoordinatedTaskItem | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState('');

  const normSel = normalizeCode(selectedVtvl);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? items
      : items.filter((item) =>
          [item.maNhiemVu, item.tenNhiemVu, item.maCongViec, item.tenCongViec, item.proposerName, item.hostUnitCode, item.hostUnitName, ...item.matchedVtvls.map((m) => m.maVtvl)]
            .join(' ')
            .toLowerCase()
            .includes(q)
        );
    return [...list].sort((a, b) => {
      const aMatch = normSel && a.matchedVtvls.some((m) => normalizeCode(m.maVtvl) === normSel) ? 2 : 0;
      const bMatch = normSel && b.matchedVtvls.some((m) => normalizeCode(m.maVtvl) === normSel) ? 2 : 0;
      const aDecl = a.isDeclaredByTargetUnit ? 1 : 0;
      const bDecl = b.isDeclaredByTargetUnit ? 1 : 0;
      return (bMatch + bDecl) - (aMatch + aDecl) || b.submittedAt.localeCompare(a.submittedAt);
    });
  }, [items, search, normSel]);

  const handleOpenDetail = async (item: ProposedCoordinatedTaskItem) => {
    setDetailError('');
    setDetailLoadingId(item.proposalKey);
    try {
      const op = getCurrentOperatorSession();
      const headers: Record<string, string> = {};
      if (op?.email) headers['x-actor-email'] = op.email;
      if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;
      const res = await fetch(
        `/api/tickets/coordinated?surveyId=${encodeURIComponent(item.surveyId)}&taskRowId=${encodeURIComponent(item.taskRowId)}&scope=unit`,
        { headers }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.item) {
        setDetailError(json.error || 'Không có quyền xem chi tiết công việc phối hợp này.');
        return;
      }
      setDetailItem(json.item);
    } catch {
      setDetailError('Lỗi kết nối máy chủ khi tải chi tiết công việc phối hợp.');
    } finally {
      setDetailLoadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-[16px] border border-[#e2e8f0] overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-[#e2e8f0] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-[8px] bg-[#eef5ff] text-[#006cee] shrink-0">
              <Handshake className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-[#004776] truncate">
              Các nhiệm vụ được đề xuất phối hợp
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#eef5fc] text-[#0072BC]">
              {items.length} đề xuất
            </span>
            <button
              type="button"
              onClick={onOpenFullTab}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] hover:bg-[#eef5ff] text-[11px] font-bold text-[#006cee] transition-colors cursor-pointer"
            >
              <span>Mở tab đầy đủ</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {unitCode && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#f1f6fc] text-[#004776] font-semibold">
              Đề xuất gửi về đơn vị [{unitCode}]
            </span>
          )}
          {selectedVtvl && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#006cee] text-white font-bold">
              Đang chọn VTVL: {selectedVtvl}
            </span>
          )}
          {myAssignments.length > 0 && myAssignments.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e1edf8] font-bold text-[#004776]">
              <Lock className="w-2.5 h-2.5 text-[#006cee]" /> [{a.unitCode}] {a.maVtvl}
            </span>
          ))}
        </div>

        {items.length > 0 && (
          <div className="relative">
            <label htmlFor="proposed-coord-side-search" className="sr-only">Lọc nhanh nhiệm vụ đề xuất phối hợp</label>
            <Search className="w-3.5 h-3.5 text-[#476b8e] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              id="proposed-coord-side-search"
              type="text"
              aria-label="Lọc nhanh theo mã nhiệm vụ, công việc, mã VTVL, đơn vị chủ trì"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lọc nhanh theo mã nhiệm vụ, công việc, mã VTVL, đơn vị chủ trì..."
              className="w-full h-9 pl-8 pr-3 text-xs rounded-[10px] border border-[#cbd5e1] bg-[#f8fbff] text-[#004776] focus:border-[#006cee] focus:bg-white outline-none"
            />
          </div>
        )}

        {detailError && (
          <div className="p-2.5 rounded-[10px] bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{detailError}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs font-semibold text-[#476b8e]">
          Đang tải nhiệm vụ đề xuất phối hợp...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-8 px-4 text-center space-y-1.5">
          <Handshake className="w-6 h-6 text-[#006cee] mx-auto opacity-75" />
          <p className="text-xs font-bold text-[#004776]">{PROPOSED_TAB_EMPTY_MESSAGE}</p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto divide-y divide-[#e2e8f0]">
          {filteredItems.map((task) => {
            const submittedVi = task.submittedAt
              ? new Date(task.submittedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : '—';
            const isBusy = detailLoadingId === task.proposalKey;
            const matchesSelected = Boolean(normSel && task.matchedVtvls.some((m) => normalizeCode(m.maVtvl) === normSel));
            const isHighlighted = matchesSelected || Boolean(task.isDeclaredByTargetUnit);
            return (
              <div
                key={task.proposalKey}
                className={`px-4 sm:px-5 py-3 transition-colors space-y-1.5 ${
                  isHighlighted
                    ? 'bg-[#eef6ff] border-l-2 border-[#006cee]'
                    : 'bg-white hover:bg-[#f8fbff]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-[6px] bg-[#eef5ff] text-[#006cee] text-[11px] font-bold font-mono">
                      [{task.hostUnitCode}] {task.maCongViec}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#f1f5f9] text-[#20446c] text-[11px] font-bold">
                      NV: {task.maNhiemVu}
                    </span>
                    {matchesSelected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#006cee] text-white text-[10.5px] font-bold">
                        Đang chọn VTVL: {selectedVtvl}
                      </span>
                    )}
                    {task.isDeclaredByTargetUnit && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10.5px] font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Đã được kê khai ({task.targetDeclaredTicketCode})
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${getBadgeCls(task.canonicalStatus)}`}>
                    {task.sourceStatus}
                  </span>
                </div>

                <p className="text-xs sm:text-[13px] font-bold text-[#004776] leading-snug break-words">
                  {task.tenCongViec}
                </p>

                <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                  {task.hostApprovalLabel && (
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${
                      task.hostUnitApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {task.hostApprovalLabel}
                    </span>
                  )}
                  {task.targetApprovalLabel && (
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${
                      task.targetUnitApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {task.targetApprovalLabel}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px] text-[#20446c]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                    <span className="inline-flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-[#006cee]" />
                      <strong className="text-[#004776]">{task.proposerName}</strong>
                    </span>
                    <span>
                      VTVL nhận: <strong className="text-[#006cee]">{task.matchedVtvls.map((m) => m.maVtvl).join(', ')}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#476b8e]">
                      <CalendarClock className="w-3 h-3" /> {submittedVi}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenDetail(task)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-[#f1f5f9] hover:bg-[#eef5ff] text-[#004776] font-bold cursor-pointer disabled:opacity-50 shrink-0 transition-colors"
                  >
                    <Eye className="w-3 h-3 text-[#006cee]" />
                    <span>{isBusy ? 'Đang mở...' : 'Xem chi tiết'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProposedCoordinatedDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
    </div>
  );
}
