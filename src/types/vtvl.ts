export type UnitGroupKind = 'khoa-vien' | 'phong-ban' | 'trung-tam' | 'dang-doanthe';

export type HcmuteVtvlGroup4 =
  | 'I. Nhóm VTVL Quản lý'
  | 'II. Nhóm VTVL Chuyên môn, nghiệp vụ'
  | 'III. Nhóm VTVL Hỗ trợ'
  | 'IV. Nhóm VTVL Phục vụ';

export type WorkforceMethod =
  | 'PP1'
  | 'PP2'
  | 'PP3'
  | 'PP1+PP2'
  | 'PP1+PP3'
  | 'PP2+PP3'
  | 'PP1+PP2+PP3';

export type WorkingRegime = 'Phổ biến (40 giờ/tuần)' | 'Đặc thù';
export type ProductGroupRoman = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

export interface HcmuteUnit {
  code: string;
  immutableUnitId?: string;
  nameVi: string;
  nameEn: string;
  group: UnitGroupKind;
  subType?: string;
  domain: string;
  headTitleVi: string;
  headTitleEn: string;
  defaultStaffCount: number;
}

export interface NgachItem {
  code: string;
  name: string;
  frameworkTitle?: string;
  specificNameSuffix?: string;
  vtvlGroup4?: HcmuteVtvlGroup4;
  defaultCareerLevel?: string;
  allowedCareerLevels?: string[];
  group: string;
  personnelType: 'Viên chức' | 'Hợp đồng lao động' | 'Hợp đồng khoán việc' | 'Thuê dịch vụ';
  workingRegime: WorkingRegime;
  standardHoursPerYear: number;
  defaultCount: number;
  salaryGroup?: string;
  salaryRange?: string;
  legalBasis?: string;
}

export interface MissionTemplate {
  missionSuffix: string;
  missionName: string;
  legalBasis: string;
  status: 'Tiếp tục thực hiện' | 'Mới tiếp nhận' | 'Đã chuyển giao' | 'Không còn thực hiện';
  source: string;
}

export interface StandardProductItem {
  productCode: string;
  productName: string;
  sector: string;
  romanGroup: ProductGroupRoman;
  standardMinutes: number;
  approvalDoc: string;
  status: 'Đã xác nhận' | 'Dự thảo' | 'Tham khảo';
  authority: string;
  effectiveDate: string;
  scopeNote: string;
}

export interface JobTaskTemplate {
  stt: number;
  vtvlSuffix: string;
  vtvlName: string;
  frameworkTitle?: string;
  vtvlGroup4?: HcmuteVtvlGroup4;
  defaultCareerLevel?: string;
  allowedCareerLevels?: string[];
  ngachCode: string;
  method: WorkforceMethod;
  missionSuffix: string;
  taskSuffix: string;
  taskName: string;
  productName: string;
  productCode: string;
  romanGroup: ProductGroupRoman;
  unitName: string;
  qualityRequirement: string;
  sourceHint: string;
  defaultQtyPerYear: number;
  defaultMinutesPerProduct: number;
  extraRelatedHoursYear: number;
  timeBasisStatus: 'Có định mức' | 'Kiểm đếm, ước lượng thực tế';
  legalBasisHint: string;
  competencyLevel: string;
  digitalImpactStage?: string;
  digitalMinutesBefore?: number;
  digitalMinutesAfter?: number;
}

export interface ProposedVtvlRow {
  id: string;
  frameworkId: string;
  vtvlSuffix: string;
  ngachCode: string;
  vtvlGroup4: HcmuteVtvlGroup4;
  frameworkTitle: string;
  specificName: string;
  careerLevel: string;
  allowedLevels: string[];
  method: WorkforceMethod;
  workingRegime: WorkingRegime;
  standardHoursYear: number;
  staffCount: number;
  proposedFte: number;
}

export interface UnitScaleMetrics {
  studentCount: number;
  programCount: number;
  courseSectionCount: number;
  labWorkshopCount: number;
  researchTopicCount: number;
  adminDocCount: number;
  scaleMultiplier: number;
}

export interface NgachAllocationRow {
  id: string;
  ngachCode: string;
  ngachName: string;
  count: number;
  targetPositionId: string;
  isSplitRow?: boolean;
  note?: string;
}

export interface UnitSplitOptions {
  kind: UnitGroupKind;
  unitCode: string;
  unitNameVi: string;
  unitNameEn: string;
  period: string;
  exportDate: string;
  includeZipPerPosition: boolean;
  actorEmail?: string;
  actorTitle?: string;
  scaleMetrics?: UnitScaleMetrics;
  ngachAllocations?: NgachAllocationRow[];
  ngachOverrides: Record<string, number>;
  customPositionNames?: Record<string, string>;
  customCareerLevels?: Record<string, string>;
  proposedPositions?: ProposedVtvlRow[];
  customStaffRows?: StaffMemberRow[];
}

export interface StaffMemberRow {
  staffId: string;
  fullName: string;
  title: string;
  ngachCode: string;
  primaryVtvlCode: string;
  primaryAllocationPct: number;
  secondaryVtvlCode?: string;
  secondaryAllocationPct?: number;
}

export interface SplitResultSummary {
  unitCode: string;
  unitNameVi: string;
  kind: UnitGroupKind;
  version: number;
  actorEmail?: string;
  actorTitle?: string;
  missionCount: number;
  taskCount: number;
  vtvlCount: number;
  totalStandardFte: number;
  unitFileName: string;
  unitBlob: Blob;
  draftUnitFileName: string;
  draftUnitBlob: Blob;
  fullFormFileName: string;
  fullFormBlob: Blob;
  zipFileName?: string;
  zipBlob?: Blob;
  positionBreakdown: {
    vtvlCode: string;
    vtvlName: string;
    frameworkTitle?: string;
    vtvlGroup4?: string;
    careerLevel?: string;
    ngachCode: string;
    method: WorkforceMethod;
    workingRegime: WorkingRegime;
    standardHoursYear: number;
    taskCount: number;
    b1HoursYear: number;
    b2NetHoursYear: number;
    netHoursYear: number;
    recommendedFte: number;
  }[];
}

export interface TimeSessionRow {
  id: string;
  taskCode: string;
  taskName: string;
  runNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  productCount: number;
  minutesPerProduct: number;
  performerTitle: string;
  note?: string;
}

export type AuditSeverity = 'fix' | 'evidence' | 'review';
export type AuditSheetCode = 'Tệp' | 'A1' | 'A2' | 'B1' | 'B2_CT' | 'B2' | 'C1' | 'C2' | 'C3' | 'D1' | 'D2' | 'DM' | 'DU_BAO' | 'K';

export interface AuditIssue {
  id: string;
  ruleId: string;
  fileName: string;
  unitCode: string;
  sheet: AuditSheetCode;
  cellRef: string;
  severity: AuditSeverity;
  title: string;
  currentValue: string;
  suggestion: string;
}

export interface AuditVtvlRecalcRow {
  unitCode: string;
  vtvlCode: string;
  vtvlName: string;
  careerLevel: string;
  method: string;
  standardHours: number;
  taskCount: number;
  recalcB1Hours: number;
  b2DeltaHours: number;
  recalcNetHours: number;
  recalcPp2Fte: number;
  c3ProposedFte: number;
  d1CurrentStaff: number;
  hasData: boolean;
}

export interface AuditEvidenceItem {
  unitCode: string;
  fileName: string;
  sheet: AuditSheetCode;
  cellRef: string;
  refCode: string;
  taskOrPositionName: string;
  currentSourceText: string;
  reasonHint: string;
}

export interface AuditTemplateFeedbackItem {
  unitCode: string;
  sheet: string;
  cellOrColumn: string;
  templateIssue: string;
  unitFeedbackSuggestion: string;
}

export interface AuditReportResult {
  filesCount: number;
  isSampleDemo?: boolean;
  totalIssues: number;
  countsBySeverity: Record<AuditSeverity, number>;
  countsBySheet: Record<string, number>;
  unitSummaries: {
    fileName: string;
    unitCode: string;
    unitName: string;
    version: string;
    vtvlCount: number;
    taskCount: number;
    staffCount: number;
    proposedFte: number;
    fixCount: number;
    evidenceCount: number;
    reviewCount: number;
  }[];
  issues: AuditIssue[];
  vtvlRecalcRows: AuditVtvlRecalcRow[];
  evidenceItems: AuditEvidenceItem[];
  templateFeedbackItems: AuditTemplateFeedbackItem[];
}
