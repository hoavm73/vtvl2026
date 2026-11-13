'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Network, Maximize2, Minimize2, ArrowLeft, ZoomIn, ZoomOut } from 'lucide-react';
import { QD2266_GROUPED_UNITS_CATALOG } from '@/configs/hcmute-qd2266-missions';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { buildUnitOrgTree } from '@/services/org-chart/unit-org-tree-builder';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { UnitOrgNode } from '@/services/org-chart/unit-org-tree-types';
import { UnitOrgTreeView } from './UnitOrgTreeView';
import { UnitOrgNodeDetailPane } from './UnitOrgNodeDetailPane';

interface UnitOrgTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUnitCode?: string;
  workbookData?: Record<string, GenericGridRow[]>;
}

export function UnitOrgTreeModal({
  isOpen,
  onClose,
  defaultUnitCode = 'TCNS',
  workbookData
}: UnitOrgTreeModalProps) {
  const [selectedUnitCode, setSelectedUnitCode] = useState(defaultUnitCode);
  const [selectedNode, setSelectedNode] = useState<UnitOrgNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isCompact, setIsCompact] = useState(true);

  const treeData = useMemo(() => {
    return buildUnitOrgTree(
      selectedUnitCode,
      selectedUnitCode === defaultUnitCode ? workbookData : undefined
    );
  }, [selectedUnitCode, defaultUnitCode, workbookData]);

  useEffect(() => {
    if (defaultUnitCode) setSelectedUnitCode(defaultUnitCode);
  }, [defaultUnitCode]);

  useEffect(() => {
    const root = treeData.rootNode;
    const initialExpanded = new Set<string>([root.id]);
    if (root.children && root.children.length > 0) {
      root.children.forEach((head) => initialExpanded.add(head.id));
    }
    setExpandedIds(initialExpanded);
    setSelectedNode(root.children[0] || root);
  }, [treeData]);

  if (!isOpen) return null;

  const handleToggleExpand = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const handleExpandAll = () => {
    const all = new Set<string>();
    const collect = (n: UnitOrgNode) => {
      all.add(n.id);
      n.children?.forEach(collect);
    };
    collect(treeData.rootNode);
    setExpandedIds(all);
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set([treeData.rootNode.id]));
  };

  const currentViewingNode = selectedNode || treeData.rootNode;

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#004776]/35 backdrop-blur-xs select-none ${
          isFullscreen ? 'p-0' : 'p-0 sm:p-3'
        }`}
        onClick={onClose}
      >
        <div
          className={`bg-white overflow-hidden flex flex-col transition-all duration-150 ${
            isFullscreen
              ? 'w-screen h-screen max-w-none max-h-none rounded-none'
              : 'relative w-full max-w-7xl h-[100dvh] sm:h-[92dvh] rounded-none sm:rounded-2xl shadow-2xl border border-[#cbd5e1]'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 bg-[#f8fafc] border-b border-[#cbd5e1] shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#004776] hover:bg-[#00385c] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                title="Trở lại giao diện trước"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Trở lại</span>
              </button>
              <div className="w-9 h-9 rounded-xl bg-[#004776]/10 text-[#004776] flex items-center justify-center shrink-0">
                <Network className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm sm:text-base font-bold text-[#004776] tracking-tight truncate">
                    Sơ đồ Vị trí việc làm &amp; Công việc dự kiến
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#004776]/10 text-[#004776] border border-[#004776]/20">
                    {treeData.unitCode}
                  </span>
                </div>
                <p className="text-xs font-medium text-[#476885] truncate">
                  {treeData.unitNameVi} · Chuẩn hóa theo Hướng dẫn số 07-HD/BTCTW &amp; QĐ 2266/QĐ-ĐHCNKT
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 rounded-xl text-[#476885] hover:text-[#004776] hover:bg-[#e2e8f0]/60 transition-colors cursor-pointer"
                title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-[#476885] hover:text-[#004776] hover:bg-[#e2e8f0]/60 transition-colors cursor-pointer shrink-0"
                aria-label="Đóng cửa sổ sơ đồ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Action bar: Bộ chọn đơn vị & Thống kê nhanh & Nút thu nhỏ tổng quan */}
          <div className="px-3.5 sm:px-6 py-2 bg-[#f8fafc] border-b border-[#cbd5e1] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
              <span className="text-xs font-bold text-[#004776] shrink-0">Chọn đơn vị:</span>
              <div className="w-56 sm:w-72">
                <ShadcnSelect
                  value={selectedUnitCode}
                  onValueChange={setSelectedUnitCode}
                  options={QD2266_GROUPED_UNITS_CATALOG.flatMap((grp) =>
                    grp.units.map((u) => ({
                      value: u.code,
                      label: `[${u.code}] ${u.nameVi}`,
                      group: grp.groupLabel
                    }))
                  )}
                  searchable={true}
                  size="sm"
                />
              </div>

              <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-[#64748b]">
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-[#004776]">
                  {treeData.totalPositions} VTVL
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-emerald-800">
                  {treeData.totalExpectedStaff} người
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-sky-800">
                  {treeData.totalTasks} đầu việc
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsCompact(!isCompact)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                  isCompact
                    ? 'bg-[#004776] text-white border-[#004776] shadow-2xs'
                    : 'bg-white text-[#004776] border-[#cbd5e1] hover:bg-slate-100'
                }`}
                title={isCompact ? 'Chuyển sang chế độ chi tiết' : 'Thu nhỏ để xem tổng quan hơn'}
              >
                {isCompact ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                <span>{isCompact ? 'Thu nhỏ tổng quan' : 'Chế độ chuẩn'}</span>
              </button>

              <button
                type="button"
                onClick={handleExpandAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#004776] bg-white hover:bg-slate-100 border border-[#cbd5e1] rounded-lg transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Mở tất cả</span>
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#64748b] bg-white hover:bg-slate-100 border border-[#cbd5e1] rounded-lg transition-colors cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Thu gọn</span>
              </button>
            </div>
          </div>

          {/* Nội dung chính: 2 cột (Cột cây 50% - Cột chi tiết 50%) */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-0 divide-y md:divide-y-0 md:divide-x divide-[#cbd5e1]">
            <div className="md:col-span-6 p-3 sm:p-4 overflow-y-auto space-y-2 bg-[#f8fafc]/50">
              <div className="flex items-center justify-between pb-1 border-b border-[#e2e8f0]">
                <h4 className="text-xs font-bold text-[#004776] uppercase tracking-wide">
                  Sơ đồ phân cấp thứ bậc VTVL
                </h4>
                <span className="text-[11px] text-[#64748b] italic">
                  Bấm vào thẻ để xem công việc bên phải
                </span>
              </div>

              <UnitOrgTreeView
                node={treeData.rootNode}
                selectedNodeId={currentViewingNode.id}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onSelectNode={setSelectedNode}
                isCompact={isCompact}
              />
            </div>

            <div className="md:col-span-6 flex flex-col overflow-hidden bg-white">
              <UnitOrgNodeDetailPane node={currentViewingNode} />
            </div>
          </div>

          {/* Footer */}
          <div className="px-3.5 sm:px-6 py-2 sm:py-2.5 bg-[#f8fafc] border-t border-[#cbd5e1] flex items-center justify-between shrink-0">
            <span className="text-xs text-[#64748b]">
              Dữ liệu sơ đồ được liên kết tự động từ 15 sheet nghiệp vụ của {treeData.unitNameVi}.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#004776] text-white hover:bg-[#00365c] transition-colors cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Trở lại</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-[#004776] border border-[#cbd5e1] hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Đóng sơ đồ
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
