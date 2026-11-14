export type CanonicalTicketStatus = 'draft' | 'submitted' | 'changes_requested' | 'resubmitted' | 'approved';
export type DisplayTicketStatus = 'Nháp' | 'Đã nộp' | 'Yêu cầu bổ sung' | 'Đã nộp lại' | 'Đã duyệt' | 'Trả lại';
export type TicketStatus = CanonicalTicketStatus | DisplayTicketStatus;

export function toCanonicalStatus(status: string | undefined): CanonicalTicketStatus {
  if (!status) return 'draft';
  const s = status.trim();
  if (s === 'draft' || s === 'Nháp') return 'draft';
  if (s === 'submitted' || s === 'Đã nộp') return 'submitted';
  if (s === 'changes_requested' || s === 'Yêu cầu bổ sung' || s === 'Trả lại') return 'changes_requested';
  if (s === 'resubmitted' || s === 'Đã nộp lại') return 'resubmitted';
  if (s === 'approved' || s === 'Đã duyệt') return 'approved';
  return 'draft';
}

export function toDisplayStatus(status: string | undefined): DisplayTicketStatus {
  const c = toCanonicalStatus(status);
  switch (c) {
    case 'draft': return 'Nháp';
    case 'submitted': return 'Đã nộp';
    case 'changes_requested': return 'Yêu cầu bổ sung';
    case 'resubmitted': return 'Đã nộp lại';
    case 'approved': return 'Đã duyệt';
  }
}

export interface CoordinatedTaskLink {
  id: string;
  targetUnitCode: string;
  targetUnitName: string;
  targetTaskCode: string;
  targetTaskName: string;
  note?: string;
}

export interface WorkSurveyStatusHistory {
  id: string;
  surveyId: string;
  fromStatus?: string;
  toStatus: string;
  action: string;
  reason?: string;
  actorId: string;
  actorRole: string;
  unitId: string;
  createdAt: string;
}

export interface WorkSurveyMergeLink {
  id: string;
  surveyId: string;
  targetSheet: 'B1' | 'B2' | 'A2';
  targetRecordId: string;
  sourceVersion: number;
  mergedBy: string;
  mergedAt: string;
  updatedAt: string;
}

export interface StaffWorkTicket {
  id: string;
  unitCode: string;
  unitId?: string;
  ownerEmail: string;
  ownerId?: string;
  ownerName: string;
  ownerTitle: string;
  status: TicketStatus;
  maNhiemVu: string;
  maCongViec: string;
  tenCongViec: string;
  maVtvl: string;
  maVtvlPhoiHop?: string;
  sanPham: string;
  chatLuong: string;
  canCu: string;
  soSpNam: number;
  nguonSoLieu: string;
  phutThucTe: number;
  gioBoSung: number;
  coordinatedTasks?: CoordinatedTaskLink[];
  sourceTicketId?: string;
  submittedAt?: string;
  resubmittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  revisionReason?: string;
  revisionRequestedAt?: string;
  revisionRequestedBy?: string;
  mergedAt?: string;
  mergedBy?: string;
  b1RowId?: string;
  b2RowId?: string;
  isMergedToB1B2?: boolean;
  statusHistory?: WorkSurveyStatusHistory[];
  createdAt: string;
  updatedAt: string;
}
