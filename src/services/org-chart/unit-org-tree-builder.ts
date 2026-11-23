/**
 * src/services/org-chart/unit-org-tree-builder.ts
 * Bộ máy trích xuất và dựng Sơ đồ cây VTVL từ dữ liệu thực của Biểu C1, A1, A2, C3, D1, D2
 * Tuyệt đối không tự sinh mã giả (QL-TK, QL-PTK) hoặc VTVL mẫu khi đơn vị chưa khai tại C1.
 */

import { findHcmuteUnit } from '@/configs/hcmute-units';
import { UnitGroupKind } from '@/types/vtvl';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { findPl1Item } from '@/configs/hcmute-pl1-builder';
import { ExpectedTaskItem, UnitOrgNode, UnitOrgTreeData } from './unit-org-tree-types';

const GROUP_LABELS: Record<UnitGroupKind, string> = {
  'khoa-vien': 'Khối Đơn vị đào tạo (Khoa & Viện)',
  'phong-ban': 'Khối Đơn vị quản lý hành chính (Phòng ban)',
  'trung-tam': 'Khối Trung tâm chức năng & Phân hiệu',
  'dang-doanthe': 'Khối Quản trị & Đảng – Đoàn thể'
};

function getUnitWorkbookData(unitCode: string): Record<string, GenericGridRow[]> {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`hcmute_vtvl_grid_${unitCode}`);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
  }
  return buildDefaultGridWorkbook(unitCode);
}

function getPl1Suffix(code: string): string {
  const parts = String(code || '').trim().toUpperCase().split('.');
  return (parts[parts.length - 1] || '').replace(/-\d+$/, '');
}

function isHeadPosition(name: string, code: string): boolean {
  const suffix = getPl1Suffix(code);
  if (/^QL(10|3[1-9])$/.test(suffix)) return true;
  if (/^QL(20|4[1-9]|60)$/.test(suffix)) return false;
  const n = name.toLowerCase();
  if (n.includes('phó')) return false;
  return (
    n.includes('hiệu trưởng') || n.includes('trưởng khoa') || n.includes('trưởng phòng') ||
    n.includes('viện trưởng') || n.includes('giám đốc') || n.includes('chánh văn phòng') ||
    n.includes('trưởng trạm') || n.includes('trưởng ban') || n.includes('tổng biên tập')
  );
}

function isDeputyPosition(name: string, code: string): boolean {
  const suffix = getPl1Suffix(code);
  if (/^QL(20|4[1-9])$/.test(suffix)) return true;
  const n = name.toLowerCase();
  return (
    n.includes('phó hiệu trưởng') || n.includes('phó trưởng khoa') || n.includes('phó trưởng phòng') ||
    n.includes('phó viện trưởng') || n.includes('phó giám đốc') || n.includes('phó chánh văn phòng') ||
    n.includes('phó trưởng trạm') || n.includes('phó trưởng ban') || n.includes('phó tổng biên tập')
  );
}

export function buildUnitOrgTree(unitCode: string, customWorkbookData?: Record<string, GenericGridRow[]>): UnitOrgTreeData {
  const unitDef = findHcmuteUnit(unitCode);
  const group = (unitDef.group || 'khoa-vien') as UnitGroupKind;
  const wb = customWorkbookData || getUnitWorkbookData(unitCode);

  const c1Rows = (wb.C1 || []).filter((r) => String(r.maVtvl || '').trim() !== '');
  const a1Rows = wb.A1 || [];
  const a2Rows = wb.A2 || [];
  const b1Rows = wb.B1 || [];
  const c2Rows = wb.C2 || [];
  const c3Rows = wb.C3 || [];
  const d1Rows = wb.D1 || [];
  const d2Rows = wb.D2 || [];

  const missionMap = new Map<string, string>();
  a1Rows.forEach((r) => {
    if (r.maNhiemVu) missionMap.set(String(r.maNhiemVu).trim().toUpperCase(), String(r.tenNhiemVu || ''));
  });

  const b1ByTask = new Map<string, GenericGridRow>();
  b1Rows.forEach((r) => {
    const key = String(r.maCongViec || '').trim().toUpperCase();
    if (key && !b1ByTask.has(key)) b1ByTask.set(key, r);
  });

  const tasksByVtvl = new Map<string, ExpectedTaskItem[]>();
  const allTasks: ExpectedTaskItem[] = a2Rows.map((r, idx) => {
    const taskCode = String(r.maCongViec || `${unitCode}.CV${String(idx + 1).padStart(2, '0')}`).trim();
    const missionCode = String(r.maNhiemVu || '').trim();
    const b1 = b1ByTask.get(taskCode.toUpperCase());
    const item: ExpectedTaskItem = {
      id: String(r.id || `task-${idx + 1}`),
      taskCode,
      taskName: String(r.tenCongViec || ''),
      missionCode,
      missionName: missionMap.get(missionCode.toUpperCase()) || String(r.canCu || ''),
      productName: String(r.sanPham || ''),
      standardMinutes: Number(b1?.phutApDung || b1?.phutThucTe || r.phutChuan || 0),
      standardHoursYear: Number(b1?.gioTong || r.gioNam || 0),
      method: String(b1?.ppThucTe || r.phuongPhap || 'PP2'),
      digitalImpact: String(r.mucDoSoHoa || ''),
      unitCode
    };
    const vKey = String(r.maVtvl || '').trim().toUpperCase();
    if (vKey) {
      const list = tasksByVtvl.get(vKey) || [];
      list.push(item);
      tasksByVtvl.set(vKey, list);
    }
    return item;
  });

  let headPosition: UnitOrgNode | null = null;
  let deputyPosition: UnitOrgNode | null = null;
  const staffPositions: UnitOrgNode[] = [];

  c1Rows.forEach((row) => {
    const code = String(row.maVtvl || '').trim();
    const codeUpper = code.toUpperCase();
    const pl1 = findPl1Item(code);
    const rawName = String(row.tenVtvl || '').trim();
    const name = pl1 && (!rawName || rawName === pl1.titleOrRole) ? pl1.positionName : (rawName || pl1?.positionName || code);
    const c2Match = c2Rows.find((r) => String(r.maVtvl || '').trim().toUpperCase() === codeUpper);
    const c3Match = c3Rows.find((r) => String(r.maVtvl || '').trim().toUpperCase() === codeUpper);
    const d2Match = d2Rows.find((r) => String(r.maVtvl || '').trim().toUpperCase() === codeUpper);
    const d1Count = d1Rows.filter((r) => String(r.maVtvl || '').trim().toUpperCase() === codeUpper).length;
    const expectedStaff = Number(c3Match?.nguoiCanBoTri ?? d2Match?.soNguoiCanBoTri ?? d1Count ?? 0) || 0;
    const tasks = tasksByVtvl.get(codeUpper) || [];

    const node: UnitOrgNode = {
      id: `node-${code}`,
      title: name,
      roleCode: code,
      nodeType: 'position',
      levelLabel: 'Vị trí việc làm',
      careerLevel: String(c2Match?.bacNgheNghiep || pl1?.careerLevel || 'Không áp dụng bậc'),
      groupLabel: String(row.nhomVtvl4 || pl1?.vtvlGroup4 || (group === 'khoa-vien' ? 'II. Nhóm VTVL Chuyên môn, nghiệp vụ' : 'III. Nhóm VTVL Hỗ trợ')),
      personnelType: String(row.loaiNhanLuc || 'Viên chức'),
      workingRegime: String(row.cheDoLamViec || 'Phổ biến (40 giờ/tuần)'),
      standardHoursYear: Number(row.gioChuanPp2) || 1904,
      expectedStaffCount: Math.max(0, expectedStaff),
      unitCode,
      unitNameVi: unitDef.nameVi,
      tasks,
      children: []
    };

    if (!headPosition && isHeadPosition(name, code)) {
      node.nodeType = 'dean';
      node.levelLabel = 'Trưởng đơn vị';
      headPosition = node;
    } else if (!deputyPosition && isDeputyPosition(name, code)) {
      node.nodeType = 'vice-dean';
      node.levelLabel = 'Phó Trưởng đơn vị';
      deputyPosition = node;
    } else {
      staffPositions.push(node);
    }
  });

  const rootChildren: UnitOrgNode[] = [];
  if (headPosition && deputyPosition) {
    (deputyPosition as UnitOrgNode).children = staffPositions;
    (headPosition as UnitOrgNode).children = [deputyPosition];
    rootChildren.push(headPosition);
  } else if (headPosition) {
    (headPosition as UnitOrgNode).children = staffPositions;
    rootChildren.push(headPosition);
  } else if (deputyPosition) {
    (deputyPosition as UnitOrgNode).children = staffPositions;
    rootChildren.push(deputyPosition);
  } else {
    rootChildren.push(...staffPositions);
  }

  const allNodes: UnitOrgNode[] = [
    ...(headPosition ? [headPosition] : []),
    ...(deputyPosition ? [deputyPosition] : []),
    ...staffPositions
  ];
  const totalPositionsCount = allNodes.length;
  const totalStaffSum = allNodes.reduce((acc, curr) => acc + curr.expectedStaffCount, 0);

  const rootNode: UnitOrgNode = {
    id: `root-${unitCode}`,
    title: unitDef.nameVi,
    roleCode: unitCode,
    nodeType: 'unit',
    levelLabel: 'Đơn vị công tác',
    careerLevel: `${totalPositionsCount} vị trí việc làm`,
    groupLabel: GROUP_LABELS[group] || 'Đơn vị trực thuộc',
    personnelType: `${totalStaffSum} người dự kiến`,
    workingRegime: 'Quy định chức năng tại Quyết định số 2266/QĐ-ĐHCNKT',
    standardHoursYear: 1904,
    expectedStaffCount: totalStaffSum,
    unitCode,
    unitNameVi: unitDef.nameVi,
    tasks: allTasks,
    children: rootChildren
  };

  return {
    unitCode,
    unitNameVi: unitDef.nameVi,
    unitGroup: group,
    unitGroupLabel: GROUP_LABELS[group] || group,
    totalPositions: totalPositionsCount,
    totalTasks: allTasks.length,
    totalExpectedStaff: totalStaffSum,
    rootNode
  };
}
