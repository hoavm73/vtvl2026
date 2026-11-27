'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { HCMUTE_UNITS, findHcmuteUnit } from '@/configs/hcmute-units';
import { StaffWorkTicket } from '@/types/staff-ticket';
import {
  A2TicketParseResult,
  UnitAccountLite,
  downloadA2TicketTemplate,
  parseA2TicketExcelBuffer
} from '@/services/tickets/a2-ticket-excel-service';
import { AdminA2TicketImportPreviewTable } from './AdminA2TicketImportPreviewTable';

interface AdminA2TicketImportModalProps {
  isOpen: boolean;
  defaultUnitCode: string;
  allTickets: StaffWorkTicket[];
  authHeaders: Record<string, string>;
  onClose: () => void;
  onImported: () => void;
}

export function AdminA2TicketImportModal({
  isOpen,
  defaultUnitCode,
  allTickets,
  authHeaders,
  onClose,
  onImported
}: AdminA2TicketImportModalProps) {
  const initialUnit = defaultUnitCode && defaultUnitCode !== 'ALL' ? defaultUnitCode : 'TCNS';
  const [unitCode, setUnitCode] = useState(initialUnit);
  const [unitAccounts, setUnitAccounts] = useState<UnitAccountLite[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'draft' | 'submitted'>('draft');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<A2TicketParseResult | null>(null);
  const [ownerOverrides, setOwnerOverrides] = useState<Record<number, string>>({});
  const [duplicateDecisions, setDuplicateDecisions] = useState<Record<number, 'skip' | 'add_new'>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setUnitCode(defaultUnitCode && defaultUnitCode !== 'ALL' ? defaultUnitCode : 'TCNS');
    setParsed(null);
    setFileName('');
    setOwnerOverrides({});
    setDuplicateDecisions({});
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [isOpen, defaultUnitCode]);

  useEffect(() => {
    if (!isOpen || !unitCode) return;
    let cancelled = false;
    setLoadingAccounts(true);
    fetch(`/api/admin/accounts?unitCode=${encodeURIComponent(unitCode)}`, { headers: authHeaders, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((json) => {
        if (cancelled) return;
        const list = Array.isArray(json.accounts) ? json.accounts : [];
        setUnitAccounts(
          list.map((a: Record<string, unknown>) => ({
            email: String(a.email || ''),
            displayName: String(a.displayName || a.email || ''),
            role: String(a.role || 'staff'),
            unitCode: String(a.unitCode || unitCode)
          }))
        );
      })
      .catch(() => { if (!cancelled) setUnitAccounts([]); })
      .finally(() => { if (!cancelled) setLoadingAccounts(false); });
    return () => { cancelled = true; };
  }, [isOpen, unitCode, authHeaders]);

  const unitTickets = useMemo(
    () => allTickets.filter((t) => (t.unitCode || '').toUpperCase() === unitCode.toUpperCase()),
    [allTickets, unitCode]
  );

  const readyRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.filter((r) => {
      const owner = ownerOverrides[r.rowIndex] ?? r.ownerEmail;
      if (!owner || r.errors.length > 0) return false;
      if (r.isDuplicate && (duplicateDecisions[r.rowIndex] || 'skip') === 'skip') return false;
      return true;
    });
  }, [parsed, ownerOverrides, duplicateDecisions]);

  if (!isOpen) return null;

  const currentUnit = findHcmuteUnit(unitCode);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const result = parseA2TicketExcelBuffer(buf, unitAccounts, unitTickets);
      if (result.error) {
        setParsed(null);
        setErrorMsg(result.error);
      } else {
        setParsed(result);
        setOwnerOverrides({});
        setDuplicateDecisions({});
      }
    } catch {
      setParsed(null);
      setErrorMsg('Không thể đọc tệp Excel. Vui lòng kiểm tra định dạng .xlsx.');
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (readyRows.length === 0) return;
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const payload = {
        unitCode,
        targetStatus,
        rows: readyRows.map((r) => ({
          ownerEmail: ownerOverrides[r.rowIndex] ?? r.ownerEmail,
          maNhiemVu: r.maNhiemVu,
          maCongViec: r.maCongViec,
          maVtvl: r.maVtvl,
          tenCongViec: r.tenCongViec,
          sanPham: r.sanPham,
          chatLuong: r.chatLuong,
          canCu: r.canCu,
          maVtvlPhoiHop: r.maVtvlPhoiHop,
          soSpNam: r.soSpNam,
          phutThucTe: r.phutThucTe,
          gioBoSung: r.gioBoSung,
          nguonSoLieu: r.nguonSoLieu
        }))
      };
      const res = await fetch('/api/tickets/bulk-import', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(json.error || 'Nạp phiếu từ Excel thất bại.');
        return;
      }
      setSuccessMsg(`Đã nạp thành công ${json.importedCount} phiếu cho ${json.staffCount} cán bộ thuộc ${currentUnit.nameVi}.`);
      onImported();
    } catch {
      setErrorMsg('Lỗi kết nối khi gửi dữ liệu nạp phiếu lên máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#004776]/45 backdrop-blur-[1px] flex items-center justify-center p-3 sm:p-5">
      <div className="w-full max-w-[1100px] max-h-[92vh] bg-white rounded-[16px] border border-[#cbd5e1] shadow-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#e2e8f0] bg-[#f8fbff] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-5 h-5 text-[#0072BC] shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#004776]">Nhập Excel phiếu công việc chuẩn A2_CongViec (Admin)</h2>
              <p className="text-[11.5px] text-[#476885]">Tạo phiếu tự động đứng tên đúng từng cán bộ trong đơn vị như cách họ tự kê khai.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="w-8 h-8 rounded-lg hover:bg-[#e2e8f0] inline-flex items-center justify-center text-[#004776] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#004776]">1. Đơn vị nhận phiếu</label>
              <select
                value={unitCode}
                onChange={(e) => { setUnitCode(e.target.value); setParsed(null); setFileName(''); }}
                className="w-full h-9 px-2.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-bold text-[#004776]"
              >
                {HCMUTE_UNITS.map((u) => (
                  <option key={u.code} value={u.code}>[{u.code}] {u.nameVi}</option>
                ))}
              </select>
              <div className="text-[11px] text-[#476885]">
                {loadingAccounts ? 'Đang tải danh sách cán bộ…' : `Đã tải ${unitAccounts.length} tài khoản thuộc ${currentUnit.code}`}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#004776]">2. Trạng thái phiếu khi nạp</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as 'draft' | 'submitted')}
                className="w-full h-9 px-2.5 rounded-lg border border-[#cbd5e1] bg-white text-xs font-semibold text-[#004776]"
              >
                <option value="draft">Lưu Nháp (khuyến nghị — cán bộ mở ra tự kiểm tra & nộp)</option>
                <option value="submitted">Đã nộp (chuyển thẳng sang Chờ duyệt đơn vị)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[#004776]">3. Tệp Excel chuẩn A2_CongViec</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadA2TicketTemplate(currentUnit.code, currentUnit.nameVi)}
                  className="h-9 px-3 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#eef5ff] text-xs font-semibold text-[#004776] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-[#0072BC]" /><span>Tải mẫu A2</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 px-3 rounded-lg bg-[#006cee] hover:bg-[#0055c4] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" /><span>Chọn file .xlsx</span>
                </button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
              </div>
              {fileName && <div className="text-[11px] text-[#0072BC] truncate">Đã chọn: {fileName}</div>}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-[10px] bg-[#fdeceb] border border-[#f5c2c7] text-xs text-[#b42318] font-medium">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-[10px] bg-[#e6f9f1] border border-[#a7f3d0] text-xs text-[#008f5d] font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /><span>{successMsg}</span>
            </div>
          )}

          {parsed && parsed.rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#476885]">
                <span>Sheet nguồn: <strong className="text-[#004776]">{parsed.sheetName}</strong> · Tổng <strong>{parsed.rows.length}</strong> dòng</span>
                <span>Sẵn sàng nạp: <strong className="text-[#008f5d]">{readyRows.length} phiếu</strong></span>
              </div>
              <AdminA2TicketImportPreviewTable
                rows={parsed.rows}
                unitAccounts={unitAccounts}
                ownerOverrides={ownerOverrides}
                duplicateDecisions={duplicateDecisions}
                onChangeOwner={(idx, email) => setOwnerOverrides((prev) => ({ ...prev, [idx]: email }))}
                onChangeDuplicate={(idx, dec) => setDuplicateDecisions((prev) => ({ ...prev, [idx]: dec }))}
              />
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-[#476885]">
            Chỉ Quản trị viên (Admin) thấy chức năng này · Mọi phiếu nạp đều ghi Nhật ký hệ thống.
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg border border-[#cbd5e1] bg-white hover:bg-[#f1f5f9] text-xs font-semibold text-[#004776] cursor-pointer">
              Đóng
            </button>
            <button
              type="button"
              disabled={submitting || readyRows.length === 0}
              onClick={handleConfirmImport}
              className="h-9 px-4 rounded-lg bg-[#006cee] hover:bg-[#0055c4] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              {submitting ? 'Đang nạp phiếu…' : `Xác nhận nạp (${readyRows.length} phiếu)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
