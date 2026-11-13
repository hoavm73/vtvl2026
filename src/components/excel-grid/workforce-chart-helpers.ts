import { GenericGridRow } from './excel-grid-types';

export interface CombinedWorkforceItem {
  maVtvl: string;
  tenVtvl: string;
  groupKind: 'QL' | 'CM' | 'HT';
  loaiNhanLuc: string;
  canBoTri: number;
  coTheBoTri: number;
  bienCheGiao: number;
  deNghiDieuChinh: number;
}

export function classifyVtvlGroup(code: string): 'QL' | 'CM' | 'HT' {
  const u = code.toUpperCase();
  return (u.includes('QL') || u.includes('LD')) ? 'QL' : (u.includes('CM') || u.includes('GV') || u.includes('NC')) ? 'CM' : 'HT';
}

export const GROUP_OPTS = [
  { value: 'all', label: 'Tất cả nhóm VTVL (QL, CM, HT)' },
  { value: 'QL', label: 'Nhóm Lãnh đạo, quản lý (QL)' },
  { value: 'CM', label: 'Nhóm Chuyên môn, nghề nghiệp (CM)' },
  { value: 'HT', label: 'Nhóm Hỗ trợ, phục vụ (HT)' }
];

export const LABOR_OPTS = [
  { value: 'all', label: 'Tất cả loại nhân lực (C1)' },
  { value: 'Viên chức', label: 'Viên chức' },
  { value: 'Hợp đồng lao động', label: 'Hợp đồng lao động' },
  { value: 'Hợp đồng khoán việc', label: 'Hợp đồng khoán việc' },
  { value: 'Thuê dịch vụ', label: 'Thuê dịch vụ' }
];

export function buildCombinedWorkforceItems(c1Rows: GenericGridRow[], d2Rows: GenericGridRow[]): CombinedWorkforceItem[] {
  const d2Map = new Map<string, GenericGridRow>();
  d2Rows.forEach((r) => { const c = String(r.maVtvl || '').trim(); if (c) d2Map.set(c, r); });
  const seen = new Set<string>();
  const list: CombinedWorkforceItem[] = [];

  c1Rows.forEach((c) => {
    const code = String(c.maVtvl || '').trim();
    if (!code) return;
    seen.add(code);
    const d2 = d2Map.get(code);
    const can = Number(d2?.soNguoiCanBoTri ?? 1) || 0;
    const co = Number(d2?.soNguoiCoTheBoTri ?? 1) || 0;
    list.push({
      maVtvl: code, tenVtvl: String(c.tenVtvl || code), groupKind: classifyVtvlGroup(code),
      loaiNhanLuc: String(c.loaiNhanLuc || 'Viên chức'), canBoTri: can, coTheBoTri: co,
      bienCheGiao: Number(d2?.bienCheGiao ?? co) || 0, deNghiDieuChinh: Number(d2?.deNghiDieuChinh ?? (can - co)) || 0
    });
  });

  d2Rows.forEach((d2) => {
    const code = String(d2.maVtvl || '').trim();
    if (!code || seen.has(code)) return;
    const can = Number(d2.soNguoiCanBoTri ?? 1) || 0;
    const co = Number(d2.soNguoiCoTheBoTri ?? 1) || 0;
    list.push({
      maVtvl: code, tenVtvl: `Vị trí ${code}`, groupKind: classifyVtvlGroup(code),
      loaiNhanLuc: 'Viên chức', canBoTri: can, coTheBoTri: co,
      bienCheGiao: Number(d2.bienCheGiao ?? co) || 0, deNghiDieuChinh: Number(d2.deNghiDieuChinh ?? (can - co)) || 0
    });
  });
  return list;
}

