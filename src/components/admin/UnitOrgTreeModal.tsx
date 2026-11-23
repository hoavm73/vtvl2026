'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { X, Maximize2, Minimize2, ArrowLeft, ZoomIn, ZoomOut } from 'lucide-react';
import { getFlatHcmuteUnitOptions } from '@/configs/hcmute-units';
import { ShadcnSelect } from '@/components/ui/ShadcnSelect';
import { ModalPortal } from '@/components/ui/ModalPortal';
import { buildUnitOrgTree } from '@/services/org-chart/unit-org-tree-builder';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { UnitOrgNode } from '@/services/org-chart/unit-org-tree-types';
import { getCanonicalWorkbookId } from '@/services/context/workbook-context';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';
import { UnitOrgTreeView } from './UnitOrgTreeView';
import { UnitOrgNodeDetailPane } from './UnitOrgNodeDetailPane';

interface UnitOrgTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUnitCode?: string;
  workbookData?: Record<string, GenericGridRow[]>;
  inline?: boolean;
  hideUnitSelector?: boolean;
}

export function UnitOrgTreeModal({
  isOpen,
  onClose,
  defaultUnitCode = 'TCNS',
  workbookData,
  inline = false,
  hideUnitSelector
}: UnitOrgTreeModalProps) {
  const [selectedUnitCode, setSelectedUnitCode] = useState(defaultUnitCode);
  const [selectedNode, setSelectedNode] = useState<UnitOrgNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(!inline);
  const [isCompact, setIsCompact] = useState(true);
  const [remoteWorkbook, setRemoteWorkbook] = useState<{ unitCode: string; data: Record<string, GenericGridRow[]> } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const upper = selectedUnitCode.toUpperCase();
    if (upper === defaultUnitCode.toUpperCase() && workbookData) return;
    let cancelled = false;
    const op = getCurrentOperatorSession();
    const headers: Record<string, string> = {};
    if (typeof window !== 'undefined') {
      try {
        const adm = sessionStorage.getItem('hcmute_vtvl_admin_token') || '';
        if (adm) headers.Authorization = `Bearer ${adm}`;
      } catch { /* ignore */ }
    }
    if (!headers.Authorization && op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;
    if (op?.email) headers['x-actor-email'] = op.email;
    void fetch(`/api/workbooks/${encodeURIComponent(getCanonicalWorkbookId(upper))}`, { headers, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.workbook?.data) setRemoteWorkbook({ unitCode: upper, data: json.workbook.data });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, selectedUnitCode, defaultUnitCode, workbookData]);

  const treeData = useMemo(() => {
    const upper = selectedUnitCode.toUpperCase();
    const effectiveData =
      upper === defaultUnitCode.toUpperCase() && workbookData
        ? workbookData
        : remoteWorkbook?.unitCode === upper
          ? remoteWorkbook.data
          : undefined;
    return buildUnitOrgTree(selectedUnitCode, effectiveData);
  }, [selectedUnitCode, defaultUnitCode, workbookData, remoteWorkbook]);

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

  const cardCls = inline && !isFullscreen
    ? 'bg-white rounded-[16px] border border-[#cbd5e1] overflow-hidden flex flex-col min-h-[680px] shadow-xs'
    : `bg-white overflow-hidden flex flex-col transition-all duration-150 ${
        isFullscreen ? 'w-screen h-screen max-w-none max-h-none rounded-none' : 'relative w-full max-w-7xl h-[100dvh] sm:h-[92dvh] rounded-none sm:rounded-2xl shadow-2xl border border-[#cbd5e1]'
      }`;
  const closeOrShrink = () => (inline && isFullscreen ? setIsFullscreen(false) : onClose());
  const showUnitPicker = !(hideUnitSelector ?? inline);

  const treeCard = (
    <div className={cardCls} onClick={(e) => e.stopPropagation()}>
      {/* Thanh công cụ & điều khiển sơ đồ */}
      <div className="px-3.5 sm:px-5 py-2.5 bg-[#f8fafc] border-b border-[#cbd5e1] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          {(!inline || isFullscreen) && (
            <button type="button" onClick={closeOrShrink} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0072BC] hover:bg-[#005c96] text-white text-xs font-bold transition-colors cursor-pointer shrink-0" title="Trở lại giao diện trước">
              <ArrowLeft className="w-4 h-4" /><span>Trở lại</span>
            </button>
          )}
          {showUnitPicker && (
            <>
              <span className="text-xs font-bold text-[#0072BC] shrink-0">Chọn đơn vị:</span>
              <div className="w-56 sm:w-72">
                <ShadcnSelect
                  value={selectedUnitCode}
                  onValueChange={setSelectedUnitCode}
                  options={getFlatHcmuteUnitOptions()}
                  searchable={true}
                  size="sm"
                />
              </div>
            </>
          )}
          {!showUnitPicker && (!inline || isFullscreen) && (
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0072BC]/10 text-[#0072BC] border border-[#0072BC]/20 truncate">
              [{treeData.unitCode}] {treeData.unitNameVi}
            </span>
          )}

          <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-[#64748b]">
            <span className="px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-[#0072BC] font-bold">
              {treeData.totalPositions} VTVL
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-[#0072BC] font-bold">
              {treeData.totalExpectedStaff} người
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white border border-[#cbd5e1] text-[#0072BC] font-bold">
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
                ? 'bg-[#0072BC] text-white border-[#0072BC] shadow-2xs'
                : 'bg-white text-[#0072BC] border-[#cbd5e1] hover:bg-slate-100'
            }`}
            title={isCompact ? 'Chuyển sang chế độ chi tiết' : 'Thu nhỏ để xem tổng quan hơn'}
          >
            {isCompact ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            <span>{isCompact ? 'Thu nhỏ tổng quan' : 'Chế độ chuẩn'}</span>
          </button>

          <button
            type="button"
            onClick={handleExpandAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#0072BC] bg-white hover:bg-slate-100 border border-[#cbd5e1] rounded-lg transition-colors cursor-pointer"
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
          <button type="button" onClick={() => setIsFullscreen(!isFullscreen)} aria-label={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'} className="p-1.5 rounded-lg text-[#476885] hover:text-[#0072BC] hover:bg-[#e2e8f0]/60 transition-colors cursor-pointer" title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}>
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {(!inline || isFullscreen) && (
            <button type="button" onClick={closeOrShrink} className="p-1.5 rounded-lg text-[#476885] hover:text-[#0072BC] hover:bg-[#e2e8f0]/60 transition-colors cursor-pointer shrink-0" aria-label="Đóng cửa sổ sơ đồ">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Nội dung chính */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden min-h-0 divide-y md:divide-y-0 md:divide-x divide-[#cbd5e1]">
        <div className="md:col-span-6 p-3 sm:p-4 overflow-y-auto space-y-2 bg-[#f8fafc]/50">
          <div className="flex items-center justify-between pb-1 border-b border-[#e2e8f0]">
            <h4 className="text-xs font-bold text-[#0072BC] uppercase tracking-wide">
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
          {treeData.totalPositions === 0 && (
            <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-white p-4 text-xs text-[#64748b]">
              Đơn vị chưa kê khai Vị trí việc làm nào tại Biểu <strong>3. C1_VTVL</strong>. Hãy thêm VTVL trong bảng biểu để hệ thống tự động khởi tạo sơ đồ.
            </div>
          )}
        </div>

        <div className="md:col-span-6 flex flex-col overflow-hidden bg-white">
          <UnitOrgNodeDetailPane node={currentViewingNode} />
        </div>
      </div>
    </div>
  );

  if (inline && !isFullscreen) return treeCard;
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" aria-label="Sơ đồ vị trí việc làm và công việc dự kiến" className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#004776]/35 backdrop-blur-xs select-none ${isFullscreen ? 'p-0' : 'p-0 sm:p-3'}`} onClick={closeOrShrink}>
        {treeCard}
      </div>
    </ModalPortal>
  );
}
