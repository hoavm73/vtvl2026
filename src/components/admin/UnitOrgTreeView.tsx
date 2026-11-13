'use client';

import React from 'react';
import {
  Building2, UserCheck, Briefcase, GraduationCap, ChevronDown,
  ChevronRight, Users, CheckSquare
} from 'lucide-react';
import { UnitOrgNode } from '@/services/org-chart/unit-org-tree-types';

interface UnitOrgTreeViewProps {
  node: UnitOrgNode;
  selectedNodeId: string;
  expandedIds: Set<string>;
  onToggleExpand: (nodeId: string) => void;
  onSelectNode: (node: UnitOrgNode) => void;
  level?: number;
  isCompact?: boolean;
}

export function UnitOrgTreeView({
  node,
  selectedNodeId,
  expandedIds,
  onToggleExpand,
  onSelectNode,
  level = 0,
  isCompact = true
}: UnitOrgTreeViewProps) {
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectNode(node);
    if (hasChildren) onToggleExpand(node.id);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(node.id);
  };

  const getNodeIcon = () => {
    switch (node.nodeType) {
      case 'unit': return <Building2 className={isCompact ? "w-3.5 h-3.5 text-[#005fa3]" : "w-4 h-4 text-[#005fa3]"} />;
      case 'dean': return <UserCheck className={isCompact ? "w-3.5 h-3.5 text-emerald-600" : "w-4 h-4 text-emerald-600"} />;
      case 'vice-dean': return <Briefcase className={isCompact ? "w-3.5 h-3.5 text-sky-600" : "w-4 h-4 text-sky-600"} />;
      default: return <GraduationCap className={isCompact ? "w-3.5 h-3.5 text-indigo-600" : "w-4 h-4 text-indigo-600"} />;
    }
  };

  const getNodeBadgeClass = () => {
    switch (node.nodeType) {
      case 'unit': return 'bg-[#004776] text-white';
      case 'dean': return 'bg-emerald-700 text-white';
      case 'vice-dean': return 'bg-sky-700 text-white';
      default: return 'bg-indigo-50 text-indigo-800 border border-indigo-200';
    }
  };

  return (
    <div className="relative select-none">
      {/* Node container */}
      <div
        onClick={handleCardClick}
        className={`group flex items-start gap-2 rounded-lg border transition-all cursor-pointer ${
          isCompact ? 'p-2 sm:p-2.5' : 'p-3'
        } ${
          isSelected
            ? 'border-[#005fa3] bg-sky-50/85 shadow-2xs ring-2 ring-[#005fa3]/25'
            : 'border-[#cbd5e1] hover:border-[#005fa3]/60 bg-white hover:bg-slate-50/80'
        }`}
      >
        {/* Toggle chevron (nếu có con) */}
        <div className="pt-0.5 shrink-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={handleToggleClick}
              className="w-5 h-5 rounded hover:bg-black/5 flex items-center justify-center text-[#64748b] transition-colors cursor-pointer"
              title={isExpanded ? 'Thu gọn nhánh dưới' : 'Mở rộng nhánh con'}
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[#004776]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#004776]" />}
            </button>
          ) : (
            <div className="w-5 h-5 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-[#cbd5e1]" />
            </div>
          )}
        </div>

        {/* Node info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded bg-slate-100 flex items-center justify-center shrink-0`}>
              {getNodeIcon()}
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${getNodeBadgeClass()}`}>
              {node.levelLabel}
            </span>
            <span className="text-[10px] font-semibold text-[#64748b]">
              [{node.roleCode}]
            </span>
          </div>

          <h4 className={`${isCompact ? 'text-xs leading-snug mt-0.5' : 'text-xs sm:text-sm mt-1 leading-snug'} font-bold text-[#004776] line-clamp-2`}>
            {node.title}
          </h4>

          {node.groupLabel && !isCompact && (
            <p className="text-[10px] text-[#64748b] mt-0.5 truncate">
              {node.groupLabel}
            </p>
          )}

          {/* Quick stats chips */}
          <div className={`flex flex-wrap items-center gap-1.5 ${isCompact ? 'mt-1 text-[10px]' : 'mt-2 text-[11px]'}`}>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              <Users className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
              <span>{node.expectedStaffCount} người</span>
            </span>

            <span className="inline-flex items-center gap-1 font-semibold text-[#004776] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
              <CheckSquare className="w-2.5 h-2.5 text-[#005fa3] shrink-0" />
              <span>{node.tasks.length} việc</span>
            </span>

            {hasChildren && (
              <span className="inline-flex items-center text-[9.5px] font-bold text-[#64748b] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 ml-auto">
                {isExpanded ? 'Đang mở' : `+${node.children.length} cấp dưới`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Children branches */}
      {hasChildren && isExpanded && (
        <div className={`mt-1 pl-2.5 sm:pl-3.5 ml-2.5 sm:ml-3 border-l-2 border-dashed border-[#cbd5e1] ${isCompact ? 'space-y-1.5' : 'space-y-2'}`}>
          {node.children.map((child) => (
            <UnitOrgTreeView
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelectNode={onSelectNode}
              level={level + 1}
              isCompact={isCompact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
