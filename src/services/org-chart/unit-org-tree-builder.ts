/**
 * src/services/org-chart/unit-org-tree-builder.ts
 * Bộ máy trích xuất và dựng Sơ đồ cây VTVL và Danh mục công việc dự kiến của 48 đơn vị
 */

import { findHcmuteUnit } from '@/configs/hcmute-units';
import { UnitGroupKind } from '@/types/vtvl';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { TASK_TEMPLATES_BY_GROUP, NGACH_LIST_BY_GROUP } from '@/configs/hcmute-quotas';
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

function isHeadPosition(name: string, code: string): boolean {
  const n = name.toLowerCase();
  const c = code.toLowerCase();
  if (n.includes('phó') || c.includes('ptk') || c.includes('ptp') || c.includes('pgd') || c.includes('pcvp') || c.includes('ql4')) {
    return false;
  }
  return (
    n.includes('trưởng khoa') || n.includes('trưởng phòng') || n.includes('viện trưởng') ||
    n.includes('giám đốc') || n.includes('chánh văn phòng') || n.includes('trưởng trạm') ||
    c.includes('ql3') || c.includes('ql-tk') || c.includes('ql-tp') || c.includes('ql-gd') || c.includes('ql-cvp')
  );
}

function isDeputyPosition(name: string, code: string): boolean {
  const n = name.toLowerCase();
  const c = code.toLowerCase();
  return (
    n.includes('phó trưởng khoa') || n.includes('phó trưởng phòng') || n.includes('phó viện trưởng') ||
    n.includes('phó giám đốc') || n.includes('phó chánh văn phòng') || n.includes('phó trưởng trạm') ||
    c.includes('ql4') || c.includes('ql-ptk') || c.includes('ql-ptp') || c.includes('ql-pgd') || c.includes('ql-pcvp')
  );
}

export function buildUnitOrgTree(unitCode: string, customWorkbookData?: Record<string, GenericGridRow[]>): UnitOrgTreeData {
  const unitDef = findHcmuteUnit(unitCode);
  const group = (unitDef.group || 'khoa-vien') as UnitGroupKind;
  const wb = customWorkbookData || getUnitWorkbookData(unitCode);

  const c1Rows = wb.C1 || [];
  const a1Rows = wb.A1 || [];
  const a2Rows = wb.A2 || [];
  const d2Rows = wb.D2 || [];

  const missionMap = new Map<string, string>();
  a1Rows.forEach((r) => {
    if (r.maNhiemVu) missionMap.set(String(r.maNhiemVu), String(r.tenNhiemVu || ''));
  });

  const allTasks: ExpectedTaskItem[] = a2Rows.map((r, idx) => ({
    id: String(r.id || `task-${idx + 1}`),
    taskCode: String(r.maCongViec || `${unitCode}.CV${String(idx + 1).padStart(2, '0')}`),
    taskName: String(r.tenCongViec || 'Công việc chuyên môn'),
    missionCode: String(r.maNhiemVu || ''),
    missionName: missionMap.get(String(r.maNhiemVu)) || String(r.canCu || 'Nhiệm vụ theo QĐ 2266/QĐ-ĐHCNKT'),
    productName: String(r.sanPham || 'Sản phẩm hoàn thành'),
    standardMinutes: Number(r.phutChuan || r.phutDinhMuc) || 120,
    standardHoursYear: Number(r.gioNam) || 1904,
    method: String(r.phuongPhap || 'PP2'),
    digitalImpact: String(r.mucDoSoHoa || 'Ứng dụng phần mềm quản trị'),
    unitCode
  }));

  const templateTasks = TASK_TEMPLATES_BY_GROUP[group] || [];

  function getTasksForPosition(posName: string, posCode: string): ExpectedTaskItem[] {
    const matched = allTasks.filter((t) => {
      const codeMatch = posCode && t.taskCode.toLowerCase().includes(posCode.toLowerCase());
      const nameMatch = posName && t.taskName.toLowerCase().includes(posName.toLowerCase().replace(/bậc \d+/i, '').trim());
      return codeMatch || nameMatch;
    });

    if (matched.length > 0) return matched;

    const tplMatched = templateTasks.filter((tpl) => {
      const isMatch =
        tpl.vtvlName.toLowerCase().includes(posName.toLowerCase()) ||
        posName.toLowerCase().includes(tpl.vtvlName.toLowerCase()) ||
        posCode.toLowerCase().includes(tpl.vtvlSuffix.toLowerCase());
      return isMatch;
    });

    if (tplMatched.length > 0) {
      return tplMatched.map((tpl, i) => ({
        id: `tpl-${posCode}-${i + 1}`,
        taskCode: `${unitCode}.${tpl.taskSuffix || `CV${i + 1}`}`,
        taskName: tpl.taskName,
        missionCode: `${unitCode}.${tpl.missionSuffix || 'NV01'}`,
        missionName: 'Nhiệm vụ theo QĐ 2266/QĐ-ĐHCNKT của Trường',
        productName: tpl.productName || 'Hồ sơ / Báo cáo hoàn thành',
        standardMinutes: tpl.defaultMinutesPerProduct || 120,
        standardHoursYear: tpl.extraRelatedHoursYear ? 1904 : 1760,
        method: tpl.method || 'PP2',
        digitalImpact: tpl.digitalImpactStage || 'Chuyển đổi số quản trị',
        unitCode
      }));
    }

    return allTasks.slice(0, 2);
  }

  let headPosition: UnitOrgNode | null = null;
  let deputyPosition: UnitOrgNode | null = null;
  const staffPositions: UnitOrgNode[] = [];

  const staffRows = c1Rows.length > 0
    ? c1Rows
    : (NGACH_LIST_BY_GROUP[group] || []).map((ng, i) => ({
        id: `gen-c1-${i}`,
        maVtvl: `${unitCode}.${ng.code}`,
        tenVtvl: ng.name,
        loaiNhanLuc: ng.personnelType,
        cheDoLamViec: ng.workingRegime,
        gioChuanPp2: ng.standardHoursPerYear,
        dinhBien: ng.defaultCount
      }));

  staffRows.forEach((row, idx) => {
    const code = String(row.maVtvl || `${unitCode}.VTVL${idx + 1}`);
    const name = String(row.tenVtvl || 'Vị trí việc làm');
    const d2Match = d2Rows.find((d) => d.maVtvl === code);
    const expectedStaff = Number(d2Match?.canBoTri || row.dinhBien || (row.defaultCount as number) || 2);
    const tasks = getTasksForPosition(name, code);

    const node: UnitOrgNode = {
      id: `node-${code}`,
      title: name,
      roleCode: code,
      nodeType: 'position',
      levelLabel: 'Cán bộ, giảng viên / chuyên viên',
      careerLevel: String(row.bacNgheNghiep || row.careerLevel || 'Bậc 3'),
      groupLabel: String(row.nhomVtvl || (group === 'khoa-vien' ? 'Chuyên môn đào tạo' : 'Nghiệp vụ hành chính')),
      personnelType: String(row.loaiNhanLuc || 'Viên chức'),
      workingRegime: String(row.cheDoLamViec || (group === 'khoa-vien' ? 'Đặc thù (1.760h)' : 'Phổ biến (1.904h)')),
      standardHoursYear: Number(row.gioChuanPp2) || 1904,
      expectedStaffCount: Math.max(1, expectedStaff),
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

  if (!headPosition) {
    const headTitle = unitDef.headTitleVi || (group === 'khoa-vien' ? 'Trưởng khoa' : 'Trưởng phòng');
    headPosition = {
      id: `head-${unitCode}`,
      title: `${headTitle} ${unitDef.nameVi}`,
      roleCode: `${unitCode}.QL31`,
      nodeType: 'dean',
      levelLabel: 'Trưởng đơn vị',
      careerLevel: 'Không áp dụng bậc (Chức vụ quản lý)',
      groupLabel: 'I. Nhóm VTVL Quản lý',
      personnelType: 'Viên chức',
      workingRegime: group === 'khoa-vien' ? 'Đặc thù (1.760h)' : 'Phổ biến (1.904h)',
      standardHoursYear: group === 'khoa-vien' ? 1760 : 1904,
      expectedStaffCount: 1,
      unitCode,
      unitNameVi: unitDef.nameVi,
      tasks: getTasksForPosition(headTitle, 'QL31'),
      children: []
    };
  }

  if (!deputyPosition) {
    const depTitle = `Phó ${unitDef.headTitleVi || (group === 'khoa-vien' ? 'Trưởng khoa' : 'Trưởng phòng')}`;
    deputyPosition = {
      id: `deputy-${unitCode}`,
      title: `${depTitle} phụ trách chuyên môn`,
      roleCode: `${unitCode}.QL41`,
      nodeType: 'vice-dean',
      levelLabel: 'Phó Trưởng đơn vị',
      careerLevel: 'Không áp dụng bậc (Chức vụ quản lý)',
      groupLabel: 'I. Nhóm VTVL Quản lý',
      personnelType: 'Viên chức',
      workingRegime: group === 'khoa-vien' ? 'Đặc thù (1.760h)' : 'Phổ biến (1.904h)',
      standardHoursYear: group === 'khoa-vien' ? 1760 : 1904,
      expectedStaffCount: group === 'khoa-vien' ? 2 : 1,
      unitCode,
      unitNameVi: unitDef.nameVi,
      tasks: getTasksForPosition(depTitle, 'QL41'),
      children: []
    };
  }

  deputyPosition.children = staffPositions;
  headPosition.children = [deputyPosition];

  const totalPositionsCount = 1 + 1 + staffPositions.length;
  const totalStaffSum =
    headPosition.expectedStaffCount +
    deputyPosition.expectedStaffCount +
    staffPositions.reduce((acc, curr) => acc + curr.expectedStaffCount, 0);

  const rootTasks = allTasks.length > 0 ? allTasks : [
    ...headPosition.tasks,
    ...deputyPosition.tasks,
    ...staffPositions.flatMap((s) => s.tasks)
  ];

  const rootNode: UnitOrgNode = {
    id: `root-${unitCode}`,
    title: unitDef.nameVi,
    roleCode: unitCode,
    nodeType: 'unit',
    levelLabel: 'Đơn vị công tác',
    careerLevel: `${totalPositionsCount} vị trí việc làm`,
    groupLabel: GROUP_LABELS[group] || 'Đơn vị trực thuộc',
    personnelType: `${totalStaffSum} biên chế / người dự kiến`,
    workingRegime: 'Quy định chức năng tại Quyết định số 2266/QĐ-ĐHCNKT',
    standardHoursYear: 1904,
    expectedStaffCount: totalStaffSum,
    unitCode,
    unitNameVi: unitDef.nameVi,
    tasks: rootTasks,
    children: [headPosition]
  };

  return {
    unitCode,
    unitNameVi: unitDef.nameVi,
    unitGroup: group,
    unitGroupLabel: GROUP_LABELS[group] || group,
    totalPositions: totalPositionsCount,
    totalTasks: rootTasks.length,
    totalExpectedStaff: totalStaffSum,
    rootNode
  };
}
