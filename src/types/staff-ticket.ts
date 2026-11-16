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

export interface CoordinatedVtvlEntry {
  id: string;
  targetUnitCode: string;
  targetUnitName?: string;
  maVtvl: string;
  tenVtvl?: string;
  note?: string;
}

export interface UserVtvlAssignment {
  id: string;
  userEmail: string;
  unitCode: string;
  maVtvl: string;
  tenVtvl?: string;
  isActive: boolean;
  assignedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoordinatedVtvlRecipientPreview {
  targetUnitCode: string;
  targetUnitName: string;
  maVtvl: string;
  tenVtvl: string;
  recipients: { email: string; displayName: string; unitCode: string }[];
  emptyMessage?: string;
}

export interface ProposedCoordinatedTaskItem {
  proposalKey: string;
  surveyId: string;
  taskRowId: string;
  hostUnitCode: string;
  hostUnitName: string;
  maNhiemVu: string;
  tenNhiemVu: string;
  maCongViec: string;
  tenCongViec: string;
  proposerName: string;
  proposerTitle: string;
  hostPrimaryVtvlCode: string;
  hostPrimaryVtvlName: string;
  matchedVtvls: {
    targetUnitCode: string;
    targetUnitName: string;
    maVtvl: string;
    tenVtvl: string;
    note?: string;
  }[];
  sanPham: string;
  coordinationNote?: string;
  submittedAt: string;
  versionNo: number;
  sourceStatus: DisplayTicketStatus;
  canonicalStatus: CanonicalTicketStatus;
  isDeclaredByTargetUnit?: boolean;
  targetDeclaredTicketCode?: string;
  targetDeclaredStatus?: string;
  hostUnitApproved?: boolean;
  targetUnitApproved?: boolean;
  tcnsApproved?: boolean;
  hostApprovalLabel?: string;
  targetApprovalLabel?: string;
  approvalBadgeText?: string;
  relationshipId?: string;
}

export type WorkRelationshipApprovalLevel =
  | 'both_units_and_tcns'
  | 'tcns_approved'
  | 'both_units_approved'
  | 'one_unit_approved'
  | 'unapproved';

export interface WorkRelationshipItem {
  id: string;
  sourceSurveyId: string;
  sourceTaskCode: string;
  sourceTaskName: string;
  sourceMissionCode: string;
  hostUnitCode: string;
  hostUnitName: string;
  hostVtvlCode: string;
  hostVtvlName?: string;
  proposerName: string;
  targetUnitCode: string;
  targetUnitName: string;
  targetVtvlCode: string;
  targetVtvlName?: string;
  coordinationNote?: string;
  sanPham?: string;
  isDeclaredByTargetUnit: boolean;
  targetDeclaredTicketId?: string;
  targetDeclaredTicketCode?: string;
  targetDeclaredTaskName?: string;
  targetDeclaredStatus?: string;
  hostLeaderApproved: boolean;
  hostApprovedBy?: string;
  hostApprovedAt?: string;
  targetLeaderApproved: boolean;
  targetApprovedBy?: string;
  targetApprovedAt?: string;
  tcnsApproved: boolean;
  tcnsApprovedBy?: string;
  tcnsApprovedAt?: string;
  approvalLevel: WorkRelationshipApprovalLevel;
  approvalLabel: string;
  hostApprovalLabel: string;
  targetApprovalLabel: string;
  updatedAt: string;
}

export interface WorkSurveyStatusHistory {
  id: string;
  surveyId: string;
  fromStatus?: string;
  toStatus: string;
  action: string;
  reason?: string;
  actorId: string;
  actorName?: string;
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

export interface WorkSurveySnapshot {
  unitCode: string;
  unitNameSnapshot?: string;
  ownerName: string;
  ownerTitle: string;
  maNhiemVu: string;
  tenNhiemVuSnapshot?: string;
  maCongViec: string;
  tenCongViec: string;
  maVtvl: string;
  tenVtvlSnapshot?: string;
  maVtvlPhoiHop?: string;
  tenVtvlPhoiHopSnapshot?: string;
  coordinationNote?: string;
  coordinatedVtvls?: CoordinatedVtvlEntry[];
  sanPham: string;
  chatLuong: string;
  canCu: string;
  soSpNam: number;
  nguonSoLieu: string;
  phutThucTe: number;
  gioBoSung: number;
  coordinatedTasks: CoordinatedTaskLink[];
}

export interface WorkSurveyVersion {
  id: string;
  surveyId: string;
  versionNo: number;
  snapshot: WorkSurveySnapshot;
  submittedBy: string;
  submittedAt?: string | null;
  changeSummary?: string;
  isMigrationBaseline?: boolean;
}

export type FieldDiffChangeType = 'added' | 'modified' | 'deleted';

export interface TicketFieldDiff {
  fieldKey: string;
  fieldLabel: string;
  changeType: FieldDiffChangeType;
  previousValue: string;
  currentValue: string;
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
  coordinationNote?: string;
  coordinatedVtvls?: CoordinatedVtvlEntry[];
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
  approvedByName?: string;
  revisionReason?: string;
  revisionRequestedAt?: string;
  revisionRequestedBy?: string;
  revisionRequestedByName?: string;
  mergedAt?: string;
  mergedBy?: string;
  mergedByName?: string;
  a2RowId?: string;
  b1RowId?: string;
  b2RowId?: string;
  isMergedToB1B2?: boolean;
  currentVersionNo?: number;
  lastChangeSummary?: string;
  isTestData?: boolean;
  isArchived?: boolean;
  statusHistory?: WorkSurveyStatusHistory[];
  versions?: WorkSurveyVersion[];
  mergeLinks?: WorkSurveyMergeLink[];
  createdAt: string;
  updatedAt: string;
}
