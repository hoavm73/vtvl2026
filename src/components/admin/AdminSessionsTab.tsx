'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, AlertCircle } from 'lucide-react';
import {
  EmailSessionRecord, getAllEmailSessions, getCurrentOperatorSession,
  saveCurrentOperatorSession, loadSessionData
} from '@/services/telemetry/operator-session';

function getSessionAuthHeaders(): Record<string, string> {
  const op = getCurrentOperatorSession();
  const h: Record<string, string> = {};
  if (op?.accessToken) h.Authorization = `Bearer ${op.accessToken}`;
  return h;
}
import { exportUserWorkbookToExcel } from '@/services/excel-export/user-workbook-exporter';
import { AdminSheetDataModal } from './AdminSheetDataModal';
import { AdminLocalDraftsCard } from './AdminLocalDraftsCard';
import { AdminSessionFilterBar, UserSummaryItem } from './AdminSessionFilterBar';
import { AdminSessionTableRow } from './AdminSessionTableRow';
import { useQueryFilter } from '@/services/query/use-query-filter';

export interface AdminDisplaySession extends EmailSessionRecord {
  id?: string;
  reportingPeriod?: string;
  currentRevision?: number;
  totalRows?: number;
  populatedSheetsCount?: number;
  status?: string;
}

export function AdminSessionsTab() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AdminDisplaySession[]>([]);
  const [localDrafts, setLocalDrafts] = useState<EmailSessionRecord[]>([]);
  const [viewingSession, setViewingSession] = useState<EmailSessionRecord | null>(null);
  const [exportingEmail, setExportingEmail] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/admin/sessions', { headers: getSessionAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setSessions(json.workbooks || []);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setLoadError({
          code: errJson.code || `HTTP_${res.status}`,
          message: errJson.error || 'Không thể tải danh sách hồ sơ từ máy chủ.'
        });
        setSessions([]);
      }
    } catch {
      setLoadError({
        code: 'NETWORK_ERROR',
        message: 'Lỗi kết nối mạng khi tải danh sách hồ sơ máy chủ.'
      });
      setSessions([]);
    } finally {
      setLoading(false);
      setLocalDrafts(getAllEmailSessions());
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const users: UserSummaryItem[] = useMemo(() => {
    const map = new Map<string, UserSummaryItem>();
    sessions.forEach((s) => {
      if (!s.email) return;
      const cur = map.get(s.email);
      if (cur) {
        cur.count++;
      } else {
        map.set(s.email, { email: s.email, title: s.title || 'Cán bộ', count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email));
  }, [sessions]);

  const { params, setParam, data: filtered } = useQueryFilter<AdminDisplaySession, { sq: string; user: string }>({
    queryKey: ['admin-sessions'],
    initialParams: { sq: '', user: '' },
    data: sessions,
    syncUrl: true,
    queryFn: ({ params: p, data }) => {
      let result = data;
      if (p.user) {
        const u = p.user.trim().toLowerCase();
        result = result.filter((s) => s.email.toLowerCase() === u);
      }
      if (p.sq.trim()) {
        const q = p.sq.trim().toLowerCase();
        result = result.filter((s) =>
          s.email.toLowerCase().includes(q) ||
          s.unitCode.toLowerCase().includes(q) ||
          s.unitNameVi.toLowerCase().includes(q) ||
          s.title.toLowerCase().includes(q)
        );
      }
      return result;
    }
  });

  const recentWorkbookId = useMemo(() => {
    if (filtered.length === 0) return null;
    const sorted = [...filtered].sort((a, b) => {
      const getT = (s?: string) => {
        if (!s) return 0;
        const m = s.match(/^(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) return new Date(Number(m[6]), Number(m[5]) - 1, Number(m[4]), Number(m[1]), Number(m[2]), Number(m[3])).getTime();
        const t = Date.parse(s);
        return isNaN(t) ? 0 : t;
      };
      return getT(b.lastSavedAt) - getT(a.lastSavedAt);
    });
    return sorted[0]?.id || sorted[0]?.email;
  }, [filtered]);

  const handleExport = async (session: AdminDisplaySession) => {
    setExportingEmail(session.email);
    try {
      if (session.id) {
        const res = await fetch(`/api/workbooks/${session.id}`, { headers: getSessionAuthHeaders() });
        if (res.ok) {
          const json = await res.json();
          if (json.workbook?.data) {
            exportUserWorkbookToExcel({
              unitCode: session.unitCode,
              unitNameVi: session.unitNameVi,
              reportingPeriod: session.reportingPeriod,
              operatorEmail: session.email,
              data: json.workbook.data
            });
            return;
          }
        }
      }
      const fallbackData = loadSessionData(session.email, session.unitCode);
      exportUserWorkbookToExcel({
        unitCode: session.unitCode,
        unitNameVi: session.unitNameVi,
        reportingPeriod: session.reportingPeriod,
        operatorEmail: session.email,
        data: fallbackData
      });
    } catch {
      alert('Không thể tạo file Excel cho phiên này, vui lòng thử lại.');
    } finally {
      setExportingEmail(null);
    }
  };

  const handleView = async (session: AdminDisplaySession) => {
    const key = session.id || session.email;
    setViewingId(key);
    try {
      if (session.id) {
        const res = await fetch(`/api/workbooks/${session.id}`, { headers: getSessionAuthHeaders() });
        if (res.ok) {
          const json = await res.json();
          if (json.workbook?.data) {
            setViewingSession({ ...session, data: json.workbook.data });
            return;
          }
        }
      }
      setViewingSession(session);
    } catch {
      setViewingSession(session);
    } finally {
      setViewingId(null);
    }
  };

  const handleDelete = async (session: AdminDisplaySession) => {
    if (!session.id) return;
    if (confirm(`Bạn có chắc chắn muốn xóa hồ sơ máy chủ của [${session.email}] - đơn vị [${session.unitCode}]?`)) {
      try {
        const res = await fetch(`/api/admin/sessions?id=${session.id}`, { method: 'DELETE', headers: getSessionAuthHeaders() });
        if (res.ok) loadSessions();
        else alert('Không thể xóa hồ sơ máy chủ.');
      } catch {
        alert('Lỗi kết nối khi gửi yêu cầu xóa.');
      }
    }
  };

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      <AdminSessionFilterBar
        search={params.sq}
        onSearchChange={(val) => setParam('sq', val)}
        selectedUser={params.user}
        onUserChange={(val) => setParam('user', val)}
        users={users}
        totalCount={sessions.length}
        loading={loading}
        onRefresh={loadSessions}
      />

      {loadError && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-red-700 font-semibold">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError.message} (Mã: {loadError.code})</span>
          </div>
          <button
            type="button"
            onClick={loadSessions}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {!loadError && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-[#cbd5e1] p-10 text-center text-[#64748b] shadow-2xs">
          <FileSpreadsheet className="w-10 h-10 text-[#cbd5e1] mx-auto mb-2" />
          <p className="font-bold text-[#004776] text-sm">
            {params.sq || params.user ? 'Không tìm thấy hồ sơ phù hợp với bộ lọc.' : 'Máy chủ hiện chưa có hồ sơ.'}
          </p>
          <p className="text-xs text-[#64748b] mt-1 max-w-md mx-auto">
            Khi cán bộ tại các đơn vị thao tác và lưu bảng biểu, toàn bộ 15 sheet sẽ được đồng bộ lên máy chủ.
          </p>
        </div>
      )}

      {!loadError && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-[#cbd5e1] shadow-2xs overflow-hidden">
          <div className="overflow-x-auto max-h-[650px] relative">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-[#f8fafc] shadow-2xs">
                <tr className="border-b border-[#cbd5e1]">
                  <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] w-12 text-center bg-[#f8fafc]">STT</th>
                  <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] bg-[#f8fafc]">Người thực hiện</th>
                  <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] bg-[#f8fafc]">Đơn vị công tác</th>
                  <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] bg-[#f8fafc]">Kỳ / Phiên bản</th>
                  <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] bg-[#f8fafc]">Dữ liệu</th>
                  <th className="p-3 font-bold text-[#004776] border-r border-[#cbd5e1] whitespace-nowrap bg-[#f8fafc]">Lần lưu cuối</th>
                  <th className="p-3 font-bold text-[#004776] text-center w-52 sticky right-0 bg-[#f8fafc] border-l border-[#cbd5e1]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <AdminSessionTableRow
                    key={s.id || idx}
                    session={s}
                    index={idx}
                    isRecentlyUpdated={(s.id || s.email) === recentWorkbookId}
                    viewingId={viewingId}
                    exportingEmail={exportingEmail}
                    onView={handleView}
                    onExport={handleExport}
                    onOpen={(item) => {
                      saveCurrentOperatorSession(item.email, item.unitCode, item.title);
                      router.push('/bang-tinh');
                    }}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminLocalDraftsCard initialDrafts={localDrafts} />
      <AdminSheetDataModal session={viewingSession} onClose={() => setViewingSession(null)} />
    </div>
  );
}
