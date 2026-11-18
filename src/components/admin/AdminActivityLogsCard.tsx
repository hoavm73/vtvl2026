'use client';

import React from 'react';
import { History, Trash2 } from 'lucide-react';
import { ActivityLogEntry } from '@/services/telemetry/activity-log';

interface AdminActivityLogsCardProps {
  logs: ActivityLogEntry[];
  onClear: () => void;
}

export function AdminActivityLogsCard({ logs, onClear }: AdminActivityLogsCardProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#0072BC]">
              Nhật ký thao tác Telemetry ({logs.length} sự kiện gần nhất)
            </h2>
            <p className="text-xs text-[#64748b]">
              Ghi nhận các sự kiện lưu dữ liệu, nạp mẫu và chuyển bước của người dùng
            </p>
          </div>
        </div>

        {logs.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium text-[var(--fix)] hover:bg-[var(--fix-soft)] border border-[var(--fix)]/30 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa lịch sử</span>
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="py-6 text-center text-xs text-[#64748b]">Chưa có bản ghi hoạt động nào.</p>
      ) : (
        <div className="rounded-lg border border-[#e2e8f0] overflow-hidden max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#f8fafc] border-b border-[#cbd5e1] text-[#004776]">
                <th className="p-2 w-36 font-semibold">Thời gian</th>
                <th className="p-2 w-24 font-semibold">Đơn vị</th>
                <th className="p-2 w-32 font-semibold">Hành động</th>
                <th className="p-2 font-semibold">Chi tiết nội dung</th>
                <th className="p-2 w-44 font-semibold">Người thực hiện</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] bg-white">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#f8fafc]">
                  <td className="p-2 text-[#64748b] whitespace-nowrap">{log.timestamp}</td>
                  <td className="p-2 font-semibold text-[#004776]">[{log.unitCode}]</td>
                  <td className="p-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-[#004776] border border-blue-200">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-2 text-[#004776]">{log.details}</td>
                  <td className="p-2 text-[#64748b] truncate" title={log.actorEmail}>
                    {log.actorEmail || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
