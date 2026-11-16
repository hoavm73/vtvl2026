export interface UnitSummaryRow {
  unitCode: string;
  unitNameVi: string;
  group: string;
  groupLabel: string;
  totalTickets: number;
  draftCount: number;
  submittedCount: number;
  resubmittedCount: number;
  changesRequestedCount: number;
  approvedCount: number;
  mergedCount: number;
  testTicketCount: number;
  hasWorkbook: boolean;
  workbookRevision: number;
  populatedSheetsCount: number;
  totalCoreSheets: number;
  totalRows: number;
  accountCount: number;
  leaderCount: number;
  staffCount: number;
  progressPercent: number;
  stageLabel: string;
  lastUpdatedAt: string | null;
}

export interface MonitorTotals {
  totalUnits: number;
  unitsWithTickets: number;
  unitsWithApproved: number;
  totalTickets: number;
  draftCount: number;
  submittedCount: number;
  resubmittedCount: number;
  changesRequestedCount: number;
  approvedCount: number;
  mergedCount: number;
  testTicketCount: number;
  totalAccounts: number;
}

export interface MonitorTicketItem {
  id: string;
  unitCode: string;
  unitNameVi: string;
  maNhiemVu: string;
  maCongViec: string;
  tenCongViec: string;
  maVtvl: string;
  ownerEmail: string;
  ownerName: string;
  status: string;
  canonicalStatus: string;
  currentVersionNo: number;
  isMergedToB1B2: boolean;
  isTestData: boolean;
  soSpNam: number;
  phutThucTe: number;
  gioBoSung: number;
  totalHours: number;
  revisionReason: string;
  lastChangeSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorHistoryItem {
  id: string;
  unitCode: string;
  unitNameVi: string;
  category: 'ticket' | 'workbook' | 'audit';
  actionLabel: string;
  title: string;
  details: string;
  actorEmail: string;
  statusBadge?: string;
  timestampIso: string;
}

export type StageFilterKey =
  | 'ALL'
  | 'has_draft'
  | 'has_pending'
  | 'has_changes'
  | 'has_approved'
  | 'has_merged'
  | 'empty';

export const SHORT_UNIT_GROUP_LABELS: Record<string, string> = {
  'khoa-vien': 'Khoa & Viện',
  'phong-ban': 'Phòng & Ban',
  'trung-tam': 'Trung tâm',
  'dang-doanthe': 'Đảng ủy'
};

/**
 * Định dạng mốc thời gian gọn chuẩn bảng theo dõi: HH:mm · DD/MM/YYYY.
 */
export function formatCompactTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${mm} · ${dd}/${mo}/${yyyy}`;
}

/**
 * Chuẩn hóa chuỗi tiếng Việt về dạng chữ thường không dấu để tìm kiếm linh hoạt.
 */
export function normalizeViSearch(value?: string | number | null): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kiểm tra chuỗi tìm kiếm (hỗ trợ nhiều từ khóa, có/không dấu) khớp trên tập trường dữ liệu.
 */
export function matchesMonitorSearch(
  fields: Array<string | number | undefined | null>,
  query: string
): boolean {
  const cleanQuery = normalizeViSearch(query);
  if (!cleanQuery) return true;
  const haystack = normalizeViSearch(fields.filter((f) => f !== undefined && f !== null).join(' '));
  return cleanQuery.split(' ').every((token) => haystack.includes(token));
}
