'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LayoutList, Printer } from 'lucide-react';
import { CoordinatedVtvlEntry, StaffWorkTicket, TicketStatus, toCanonicalStatus } from '@/types/staff-ticket';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { replaceUnitCodePrefix } from '@/services/units/unit-synchronizer';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { StaffTicketModernForm } from './StaffTicketModernForm';
import { StaffTicketA4Preview } from './StaffTicketA4Preview';
import { StaffTicketToolbar } from './StaffTicketToolbar';
import { StaffTicketResubmitBox } from './StaffTicketResubmitBox';

interface StaffTicketInlineFormProps {
  unitCode: string;
  ownerEmail: string;
  ownerName: string;
  ownerTitle: string;
  editingTicket: StaffWorkTicket | null;
  pickedVtvl?: { code: string; seq: number } | null;
  a1Missions: GenericGridRow[];
  c1Vtvls: GenericGridRow[];
  onActiveVtvlChange?: (maVtvl: string) => void;
  onCancelEdit: () => void;
  onSaved: (ticket?: StaffWorkTicket) => void;
}

export function StaffTicketInlineForm({
  unitCode, ownerEmail, ownerName, ownerTitle, editingTicket, pickedVtvl, a1Missions, c1Vtvls, onActiveVtvlChange, onCancelEdit, onSaved
}: StaffTicketInlineFormProps) {
  const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');
  const [maNhiemVu, setMaNhiemVu] = useState('');
  const [maCongViec, setMaCongViec] = useState('');
  const [tenCongViec, setTenCongViec] = useState('');
  const [maVtvl, setMaVtvl] = useState('');
  const [maVtvlPhoiHop, setMaVtvlPhoiHop] = useState('');
  const [coordinationNote, setCoordinationNote] = useState('');
  const [coordinatedVtvls, setCoordinatedVtvls] = useState<CoordinatedVtvlEntry[]>([]);
  const [sanPham, setSanPham] = useState('');
  const [chatLuong, setChatLuong] = useState('');
  const [canCu, setCanCu] = useState('');
  const [soSpNam, setSoSpNam] = useState<string>('0');
  const [nguonSoLieu, setNguonSoLieu] = useState('');
  const [phutThucTe, setPhutThucTe] = useState<string>('0');
  const [gioBoSung, setGioBoSung] = useState<string>('0');
  const [changeSummary, setChangeSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const unit = findHcmuteUnit(unitCode);
  const editingCanon = editingTicket ? toCanonicalStatus(editingTicket.status) : null;
  const isResubmittingMode = Boolean(editingTicket && editingCanon === 'changes_requested');
  const isEditingPendingMode = Boolean(editingTicket && (editingCanon === 'submitted' || editingCanon === 'resubmitted'));

  const resetForm = () => {
    setMaNhiemVu(''); setMaCongViec(''); setTenCongViec(''); setMaVtvl(''); setMaVtvlPhoiHop('');
    setCoordinationNote(''); setCoordinatedVtvls([]);
    setSanPham(''); setChatLuong(''); setCanCu(''); setSoSpNam('0'); setNguonSoLieu('');
    setPhutThucTe('0'); setGioBoSung('0'); setChangeSummary('');
  };

  useEffect(() => {
    setErr(''); setSuccessMsg('');
    const t = editingTicket;
    if (t) {
      const cleanUnit = unitCode.toUpperCase();
      setMaNhiemVu(replaceUnitCodePrefix(t.maNhiemVu, t.unitCode, cleanUnit) || '');
      setMaCongViec(replaceUnitCodePrefix(t.maCongViec, t.unitCode, cleanUnit) || '');
      setTenCongViec(t.tenCongViec || '');
      setMaVtvl(replaceUnitCodePrefix(t.maVtvl, t.unitCode, cleanUnit) || '');
      setMaVtvlPhoiHop(t.maVtvlPhoiHop ? replaceUnitCodePrefix(t.maVtvlPhoiHop, t.unitCode, cleanUnit) : '');
      setCoordinationNote(t.coordinationNote || '');
      setCoordinatedVtvls(t.coordinatedVtvls || []);
      setSanPham(t.sanPham || '');
      setChatLuong(t.chatLuong || '');
      setCanCu(t.canCu || '');
      setSoSpNam(String(t.soSpNam ?? 0));
      setNguonSoLieu(t.nguonSoLieu || '');
      setPhutThucTe(String(t.phutThucTe ?? 0));
      setGioBoSung(String(t.gioBoSung ?? 0));
      setChangeSummary(t.lastChangeSummary || '');
    } else {
      resetForm();
    }
  }, [editingTicket, unitCode]);

  useEffect(() => { if (pickedVtvl?.code) setMaVtvl(pickedVtvl.code); }, [pickedVtvl]);
  useEffect(() => { onActiveVtvlChange?.(maVtvl); }, [maVtvl, onActiveVtvlChange]);

  const handleMissionChange = async (nextMission: string) => {
    setMaNhiemVu(nextMission);
    if (!nextMission) { setMaCongViec(''); return; }
    if (editingTicket && editingTicket.maNhiemVu.trim().toUpperCase() === nextMission.trim().toUpperCase()) {
      setMaCongViec(editingTicket.maCongViec);
      return;
    }
    try {
      const op = getCurrentOperatorSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-actor-email': ownerEmail };
      if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;
      const res = await fetch('/api/tickets', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ unitCode, maNhiemVu: nextMission, excludeTicketId: editingTicket?.id })
      });
      if (res.ok) {
        const json = await res.json();
        setMaCongViec(json.nextTaskCode || '');
      }
    } catch { /* ignore */ }
  };

  const handleSave = async (status: TicketStatus) => {
    setErr(''); setSuccessMsg('');
    if (!maNhiemVu || !tenCongViec.trim() || !maVtvl) {
      setErr('Vui lòng chọn Mã nhiệm vụ, Mã vị trí việc làm chính và nhập Tên công việc cụ thể.');
      return;
    }
    const isSubmitAction = isEditingPendingMode || status === 'Đã nộp' || status === 'Đã nộp lại' || status === 'submitted' || status === 'resubmitted';
    if (isSubmitAction) {
      const missing: string[] = [];
      if (!sanPham.trim()) missing.push('Sản phẩm đầu ra');
      if (!chatLuong.trim()) missing.push('Tiêu chuẩn chất lượng');
      if (!canCu.trim()) missing.push('Căn cứ pháp lý / Quyết định giao việc');
      if (!soSpNam || Number(soSpNam) <= 0) missing.push('Số sản phẩm hoàn thành trong năm trong chu kỳ 1 năm (01/10/2025 đến 30/9/2026)');
      if (!nguonSoLieu.trim()) missing.push('Nguồn số liệu kiểm chứng');
      if (!phutThucTe || Number(phutThucTe) <= 0) missing.push('Thời gian thực tế (phút/SP)');
      if (isResubmittingMode && !changeSummary.trim()) missing.push('Giải trình nội dung đã cập nhật / chỉnh sửa');
      if (missing.length > 0) {
        setErr(`Để nộp phiếu, vui lòng điền đầy đủ các trường bắt buộc (trừ các mục có ghi "nếu có"): ${missing.join(', ')}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const op = getCurrentOperatorSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-actor-email': ownerEmail };
      if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;

      const effectiveAction = isEditingPendingMode ? 'update_pending' : isSubmitAction ? (isResubmittingMode ? 'resubmit' : 'submit') : 'draft';
      const effectiveStatus: TicketStatus = isEditingPendingMode
        ? (editingCanon === 'resubmitted' ? 'Đã nộp lại' : 'Đã nộp')
        : isSubmitAction ? (isResubmittingMode ? 'Đã nộp lại' : 'Đã nộp') : (isResubmittingMode ? 'Yêu cầu bổ sung' : 'Nháp');

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: editingTicket?.id, unitCode, ownerEmail, ownerName, ownerTitle,
          action: effectiveAction, status: effectiveStatus,
          changeSummary: changeSummary.trim() || undefined,
          maNhiemVu, maCongViec, tenCongViec: tenCongViec.trim(), maVtvl, maVtvlPhoiHop,
          coordinationNote: coordinationNote.trim() || undefined,
          coordinatedVtvls,
          sanPham: sanPham.trim(), chatLuong: chatLuong.trim(), canCu: canCu.trim(),
          soSpNam: Number(soSpNam) || 0, nguonSoLieu: nguonSoLieu.trim(),
          phutThucTe: Number(phutThucTe) || 0, gioBoSung: Number(gioBoSung) || 0,
          coordinatedTasks: editingTicket?.coordinatedTasks || []
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error || 'Không thể lưu phiếu công việc.');
        return;
      }
      setSuccessMsg(
        isEditingPendingMode
          ? 'Đã cập nhật phiếu. Phiếu tiếp tục ở trạng thái Chờ duyệt.'
          : isSubmitAction
            ? (isResubmittingMode ? 'Đã nộp lại phiếu và lưu phiên bản mới thành công!' : 'Đã lưu và gửi phiếu thành công!')
            : 'Đã lưu nháp và giữ mã công việc ở đơn vị!'
      );
      onSaved(json.ticket);
      if (!editingTicket) resetForm();
    } catch {
      setErr('Lỗi kết nối máy chủ khi lưu phiếu.');
    } finally {
      setSaving(false);
    }
  };

  const missionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of a1Missions) {
      const code = String(m.maNhiemVu || '').trim();
      if (!code) continue;
      const name = String(m.tenNhiemVu || '').trim();
      if (!map.has(code) || (!map.get(code)?.includes('—') && name)) {
        map.set(code, name ? `${code} — ${name}` : code);
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [a1Missions]);

  const vtvlOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of c1Vtvls) {
      const code = String(v.maVtvl || '').trim();
      if (!code) continue;
      const name = String(v.tenVtvl || '').trim();
      if (!map.has(code) || (!map.get(code)?.includes('—') && name)) {
        map.set(code, name ? `${code} — ${name}` : code);
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [c1Vtvls]);

  const draftTicketCandidate: Partial<StaffWorkTicket> = useMemo(
    () => ({
      unitCode, ownerName, ownerTitle, maNhiemVu, maCongViec, tenCongViec, maVtvl, maVtvlPhoiHop,
      coordinationNote, coordinatedVtvls,
      sanPham, chatLuong, canCu, soSpNam: Number(soSpNam) || 0, nguonSoLieu,
      phutThucTe: Number(phutThucTe) || 0, gioBoSung: Number(gioBoSung) || 0,
      coordinatedTasks: editingTicket?.coordinatedTasks || []
    }),
    [unitCode, ownerName, ownerTitle, maNhiemVu, maCongViec, tenCongViec, maVtvl, maVtvlPhoiHop, coordinationNote, coordinatedVtvls, sanPham, chatLuong, canCu, soSpNam, nguonSoLieu, phutThucTe, gioBoSung, editingTicket?.coordinatedTasks]
  );

  const formProps = {
    unitCode, maNhiemVu, maCongViec, tenCongViec, maVtvl, maVtvlPhoiHop,
    coordinationNote, coordinatedVtvls,
    sanPham, chatLuong, canCu, soSpNam, nguonSoLieu, phutThucTe, gioBoSung,
    missionOptions, vtvlOptions,
    onChangeMission: handleMissionChange, onChangeTenCongViec: setTenCongViec,
    onChangeVtvl: setMaVtvl, onChangeVtvlPhoiHop: setMaVtvlPhoiHop,
    onChangeCoordinationNote: setCoordinationNote, onChangeCoordinatedVtvls: setCoordinatedVtvls,
    onChangeSanPham: setSanPham, onChangeChatLuong: setChatLuong,
    onChangeCanCu: setCanCu, onChangeSoSp: setSoSpNam,
    onChangeNguon: setNguonSoLieu, onChangePhut: setPhutThucTe, onChangeGioBoSung: setGioBoSung
  };

  return (
    <div id="staff-ticket-form-card" className="space-y-3">
      <div className="bg-white p-3 rounded-2xl border border-[#dbe8f5] shadow-[0_2px_12px_-4px_rgba(0,71,118,0.06)] space-y-2.5 print:hidden">
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#f1f6fc] rounded-xl border border-[#dbe8f5]">
          <button type="button" onClick={() => setViewMode('form')} className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-w-0 ${viewMode === 'form' ? 'bg-white text-[#004776] shadow-xs' : 'text-[#20446c]/80 hover:text-[#004776]'}`}>
            <LayoutList className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Kê khai nhập liệu</span>
          </button>
          <button type="button" onClick={() => setViewMode('preview')} className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-w-0 ${viewMode === 'preview' ? 'bg-white text-[#004776] shadow-xs' : 'text-[#20446c]/80 hover:text-[#004776]'}`}>
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Xem trước bản in A4</span>
          </button>
        </div>
        <StaffTicketToolbar
          isEditing={Boolean(editingTicket)} isEditingPending={isEditingPendingMode}
          editingTaskCode={editingTicket?.maCongViec} saving={saving}
          onCancelEdit={onCancelEdit} onPrint={() => window.print()} onSave={handleSave}
        />
      </div>

      {isEditingPendingMode && (
        <div className="p-3 rounded-xl bg-[#eef5ff] border border-[#bfdbfe] text-xs text-[#004776] font-medium print:hidden">
          Phiếu đã được gửi duyệt. Bạn vẫn có thể chỉnh sửa trong thời gian phiếu chưa được duyệt. Nội dung mới nhất sẽ được gửi đến người duyệt.
        </div>
      )}

      {err && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium print:hidden">{err}</div>}
      {successMsg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium print:hidden">{successMsg}</div>}

      {isResubmittingMode && editingTicket && (
        <StaffTicketResubmitBox
          editingTicket={editingTicket} draftTicketCandidate={draftTicketCandidate}
          changeSummary={changeSummary} onChangeSummary={setChangeSummary}
        />
      )}

      <div className={viewMode === 'form' ? 'block print:hidden' : 'hidden print:hidden'}>
        <StaffTicketModernForm {...formProps} />
      </div>

      <div className={viewMode === 'preview' ? 'block' : 'hidden print:block'}>
        <StaffTicketA4Preview
          {...formProps} unitNameVi={unit.nameVi} unitCode={unit.code}
          ownerName={ownerName} ownerEmail={ownerEmail} ownerTitle={ownerTitle} editingTicket={editingTicket}
        />
      </div>
    </div>
  );
}
