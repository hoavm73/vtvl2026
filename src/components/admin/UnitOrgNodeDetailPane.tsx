'use client';

import React, { useState } from 'react';
import { Search, CheckSquare } from 'lucide-react';
import { UnitOrgNode } from '@/services/org-chart/unit-org-tree-types';

interface UnitOrgNodeDetailPaneProps {
  node: UnitOrgNode;
}

export function UnitOrgNodeDetailPane({ node }: UnitOrgNodeDetailPaneProps) {
  const [taskSearch, setTaskSearch] = useState('');

  const filteredTasks = node.tasks.filter((t) => {
    if (!taskSearch.trim()) return true;
    const q = taskSearch.toLowerCase();
    return (
      t.taskCode.toLowerCase().includes(q) ||
      t.taskName.toLowerCase().includes(q) ||
      (t.productName && t.productName.toLowerCase().includes(q)) ||
      (t.missionName && t.missionName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header thẻ vị trí đang chọn */}
      <div className="p-4 bg-slate-50 border-b border-[#cbd5e1] space-y-2 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#0072BC] text-white">
                {node.levelLabel}
              </span>
              <span className="text-xs font-bold text-[#0072BC]">
                [{node.roleCode}]
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-[#0072BC] mt-1">
              {node.title}
            </h4>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs text-[#64748b] block">Định biên dự kiến</span>
            <span className="text-base font-bold text-[#0072BC]">
              {node.expectedStaffCount} người
            </span>
          </div>
        </div>

        {/* Thông số vị trí */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-slate-200">
          <div>
            <span className="text-[#64748b] block">Bậc nghề nghiệp:</span>
            <strong className="text-[#0072BC] font-bold">
              {node.careerLevel || 'Không áp dụng'}
            </strong>
          </div>
          <div>
            <span className="text-[#64748b] block">Chế độ làm việc:</span>
            <strong className="text-[#0072BC] font-bold">
              {node.workingRegime || 'Phổ biến (1.904h)'}
            </strong>
          </div>
          <div>
            <span className="text-[#64748b] block">Loại nhân lực:</span>
            <strong className="text-[#0072BC] font-bold">
              {node.personnelType || 'Viên chức'}
            </strong>
          </div>
        </div>
      </div>

      {/* Thanh tìm kiếm công việc trong vị trí */}
      <div className="px-4 py-2 bg-white border-b border-[#f1f5f9] flex items-center justify-between gap-2 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#0072BC] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            placeholder="Tìm trong danh mục công việc..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-[#f8fafc] border border-[#cbd5e1] rounded-lg text-[#0072BC] focus:ring-2 focus:ring-[#0072BC] focus:outline-hidden"
          />
        </div>

        <span className="text-xs font-bold text-[#0072BC]">
          Dự kiến {filteredTasks.length}/{node.tasks.length} đầu việc
        </span>
      </div>

      {/* Danh sách công việc dự kiến */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filteredTasks.length === 0 ? (
          <div className="py-12 text-center text-[#64748b]">
            <CheckSquare className="w-10 h-10 text-[#cbd5e1] mx-auto mb-2" />
            <p className="text-xs font-bold text-[#0072BC]">
              {taskSearch ? 'Không tìm thấy công việc phù hợp với từ khóa.' : 'Chưa có dữ liệu công việc được gán.'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task, idx) => (
            <div
              key={task.id || idx}
              className="p-3 rounded-xl border border-[#cbd5e1] hover:border-[#0072BC]/60 bg-white hover:bg-slate-50/50 transition-all space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0072BC] border border-blue-200">
                    {task.taskCode}
                  </span>
                  {task.missionCode && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-[#0072BC]">
                      Nhiệm vụ: {task.missionCode}
                    </span>
                  )}
                </div>

                <span className="text-[11px] font-bold text-[#0072BC] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                  {task.standardMinutes} phút/SP
                </span>
              </div>

              <h5 className="text-xs font-bold text-[#0072BC] leading-snug">
                {task.taskName}
              </h5>

              {task.productName && (
                <p className="text-[11px] text-[#64748b]">
                  <span className="font-bold text-[#0072BC]">Sản phẩm đầu ra:</span> {task.productName}
                </p>
              )}

              {task.missionName && (
                <p className="text-[11px] text-[#64748b] truncate" title={task.missionName}>
                  <span className="font-bold text-[#0072BC]">Căn cứ:</span> {task.missionName}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
