'use client';

import React, { useState, useEffect } from 'react';
import { X, Link2, Plus, Trash2 } from 'lucide-react';
import { StaffWorkTicket, CoordinatedTaskLink } from '@/types/staff-ticket';
import { HCMUTE_UNITS, findHcmuteUnit } from '@/configs/hcmute-units';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';

interface CoordinatedTaskModalProps {
  ticket: StaffWorkTicket | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CoordinatedTaskModal({ ticket, onClose, onSaved }: CoordinatedTaskModalProps) {
  const [targetUnitCode, setTargetUnitCode] = useState('TCNS');
  const [targetTasks, setTargetTasks] = useState<{ maCongViec: string; tenCongViec: string }[]>([]);
  const [selectedTaskCode, setSelectedTaskCode] = useState('');
  const [note, setNote] = useState('');
  const [links, setLinks] = useState<CoordinatedTaskLink[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setLinks(ticket.coordinatedTasks || []);
  }, [ticket]);

  useEffect(() => {
    if (!ticket || !targetUnitCode) return;
    fetch(`/api/tickets?unitCode=${encodeURIComponent(targetUnitCode)}`)
      .then((res) => res.json())
      .then((json) => {
        const list = (json.unitA2Tasks || []).map((r: any) => ({
          maCongViec: String(r.maCongViec || ''),
          tenCongViec: String(r.tenCongViec || '')
        }));
        setTargetTasks(list);
        setSelectedTaskCode('');
      })
      .catch(() => setTargetTasks([]));
  }, [ticket, targetUnitCode]);

  if (!ticket) return null;

  const unitOptions = HCMUTE_UNITS.map((u) => ({
    value: u.code,
    label: `[${u.code}] ${u.nameVi}`
  }));

  const taskOptions = targetTasks.map((t) => ({
    value: t.maCongViec,
    label: `${t.maCongViec} — ${t.tenCongViec.slice(0, 55)}`
  }));

  const handleAddLink = () => {
    if (!selectedTaskCode) return;
    const foundUnit = findHcmuteUnit(targetUnitCode);
    const foundTask = targetTasks.find((t) => t.maCongViec === selectedTaskCode);
    if (!foundTask) return;
    const nextLink: CoordinatedTaskLink = {
      id: `coord-${Date.now().toString(36)}`,
      targetUnitCode,
      targetUnitName: foundUnit?.nameVi || targetUnitCode,
      targetTaskCode: foundTask.maCongViec,
      targetTaskName: foundTask.tenCongViec,
      note: note.trim()
    };
    setLinks((prev) => [...prev, nextLink]);
    setSelectedTaskCode('');
    setNote('');
  };

  const handleSaveLinks = async () => {
    setSaving(true);
    try {
      await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ticket,
          coordinatedTasks: links
        })
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#004776]/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#cbd5e1] shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#004776] flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#0072BC]" />
              Thêm công việc phối hợp liên đơn vị — [{ticket.maCongViec}]
            </h3>
            <p className="text-xs text-[#64748b] mt-0.5">
              Gán công việc của bạn với mã công việc tương ứng thuộc các đơn vị trong Trường.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#e2e8f0] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm text-[#004776]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Đơn vị phối hợp (51 đơn vị)</label>
              <ShadcnSelect value={targetUnitCode} options={unitOptions} onChange={setTargetUnitCode} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Mã công việc phối hợp</label>
              <ShadcnSelect
                value={selectedTaskCode}
                options={taskOptions}
                placeholder="Chọn công việc..."
                onChange={setSelectedTaskCode}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú nội dung phối hợp (tùy chọn)..."
              className="flex-1 h-9 px-3 rounded-lg border border-[#cbd5e1] text-xs text-[#004776] outline-hidden"
            />
            <button
              type="button"
              onClick={handleAddLink}
              disabled={!selectedTaskCode}
              className="h-9 px-3.5 rounded-lg bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </div>

          <div className="border border-[#e2e8f0] rounded-xl divide-y divide-[#f1f5f9] max-h-56 overflow-y-auto">
            {links.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#64748b]">Chưa có công việc phối hợp nào được gán.</div>
            ) : (
              links.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between gap-3 hover:bg-[#f8fafc]">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#004776]">
                      [{item.targetUnitCode}] {item.targetTaskCode}
                    </div>
                    <div className="text-xs text-[#475569] truncate">{item.targetTaskName}</div>
                    {item.note && <div className="text-[11px] text-[#64748b] italic mt-0.5">{item.note}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setLinks((prev) => prev.filter((x) => x.id !== item.id))}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-6 py-3.5 bg-[#f8fafc] border-t border-[#e2e8f0] flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl border border-[#cbd5e1] text-xs font-medium text-[#004776] cursor-pointer">
            Đóng
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveLinks}
            className="h-9 px-4 rounded-xl bg-[#0072BC] hover:bg-[#004776] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu danh sách phối hợp'}
          </button>
        </div>
      </div>
    </div>
  );
}
