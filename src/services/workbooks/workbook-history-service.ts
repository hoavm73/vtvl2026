import { ExcelSheetKey, GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { ServerAuditLog } from '@/services/storage/server-audit-store';
import { ServerRevision, ServerWorkbook } from '@/services/storage/server-workbook-store';
import { StaffWorkTicket } from '@/types/staff-ticket';

export type WorkbookReviewStatus =
  | 'chua_gui'
  | 'cho_tham_dinh'
  | 'dang_tham_dinh'
  | 'can_bo_sung'
  | 'da_gui_lai'
  | 'dat_yeu_cau'
  | 'da_khoa';

export interface WorkbookReviewMeta {
  status: WorkbookReviewStatus;
  statusLabel: string;
  submittedAt: string | null;
  submittedBy: string | null;
  submittedRevision: number | null;
  reviewerEmail: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
}

export interface WorkbookHistoryTimelineEvent {
  id: string;
  source: 'revision' | 's_nhat_ky' | 'audit' | 'ticket' | 'review';
  sourceLabel: string;
  action: string;
  title: string;
  details: string;
  actorEmail: string;
  sheet?: string;
  revision?: number;
  timestamp: string;
}

export const REVIEW_STATUS_LABELS: Record<WorkbookReviewStatus, string> = {
  chua_gui: 'Chưa gửi',
  cho_tham_dinh: 'Chờ thẩm định',
  dang_tham_dinh: 'Đang thẩm định',
  can_bo_sung: 'Cần bổ sung',
  da_gui_lai: 'Đã gửi lại',
  dat_yeu_cau: 'Đạt yêu cầu',
  da_khoa: 'Đã khóa'
};

export const REVIEW_ACTION_SET: ReadonlySet<string> = new Set([
  'GUI_TCNS',
  'GUI_LAI_TCNS',
  'BAT_DAU_THAM_DINH',
  'THAM_DINH_YEU_CAU_BO_SUNG',
  'THAM_DINH_DAT',
  'MO_LAI_HO_SO',
  'KHOA_HO_SO',
  'NHAN_XET_THAM_DINH'
]);

const REVIEW_ACTIONS = REVIEW_ACTION_SET;

export function computeUnitProgressStage(input: {
  mergedCount: number;
  populatedSheetsCount: number;
  approvedCount: number;
  submittedCount: number;
  changesRequestedCount: number;
  draftCount: number;
}): { progressPercent: number; stageLabel: string } {
  if (input.mergedCount > 0 && input.populatedSheetsCount >= 6) {
    return { progressPercent: 100, stageLabel: 'Đã gộp B1/B2 & hoàn thiện biểu' };
  }
  if (input.approvedCount > 0) {
    return { progressPercent: 80, stageLabel: 'Đã duyệt phiếu' };
  }
  if (input.submittedCount > 0 || input.changesRequestedCount > 0) {
    return {
      progressPercent: 60,
      stageLabel: input.submittedCount > 0 ? 'Đang chờ duyệt phiếu' : 'Đang chờ bổ sung phiếu'
    };
  }
  if (input.draftCount > 0) {
    return { progressPercent: 35, stageLabel: 'Đang lưu nháp phiếu' };
  }
  if (input.populatedSheetsCount > 0) {
    return { progressPercent: 20, stageLabel: 'Đã khởi tạo biểu mẫu' };
  }
  return { progressPercent: 0, stageLabel: 'Chưa kê khai' };
}

function mapAuditActionToStatus(action: string, current: WorkbookReviewStatus): WorkbookReviewStatus {
  if (action === 'GUI_TCNS') return current === 'can_bo_sung' ? 'da_gui_lai' : 'cho_tham_dinh';
  if (action === 'GUI_LAI_TCNS') return 'da_gui_lai';
  if (action === 'BAT_DAU_THAM_DINH') return 'dang_tham_dinh';
  if (action === 'THAM_DINH_YEU_CAU_BO_SUNG') return 'can_bo_sung';
  if (action === 'THAM_DINH_DAT') return 'dat_yeu_cau';
  if (action === 'KHOA_HO_SO') return 'da_khoa';
  if (action === 'MO_LAI_HO_SO') return 'chua_gui';
  return current;
}

export function deriveReviewMetaFromWorkbook(
  wb: Pick<ServerWorkbook, 'id' | 'unitId' | 'status' | 'currentRevision' | 'updatedAt' | 'data'> | undefined | null,
  auditLogs: ServerAuditLog[]
): WorkbookReviewMeta {
  const unitUpper = (wb?.unitId || '').toUpperCase();
  const unitReviewLogs = auditLogs
    .filter((l) => (l.unitCode || '').toUpperCase() === unitUpper && REVIEW_ACTIONS.has(l.action))
    .slice()
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  let status: WorkbookReviewStatus =
    wb?.status === 'approved'
      ? 'dat_yeu_cau'
      : wb?.status === 'reviewed'
        ? 'dang_tham_dinh'
        : wb?.status === 'submitted'
          ? 'cho_tham_dinh'
          : wb?.status === 'archived'
            ? 'da_khoa'
            : 'chua_gui';

  let submittedAt: string | null = null;
  let submittedBy: string | null = null;
  let submittedRevision: number | null = null;
  let reviewerEmail: string | null = null;
  let reviewedAt: string | null = null;
  let reviewNote: string | null = null;

  for (const log of unitReviewLogs) {
    status = mapAuditActionToStatus(log.action, status);
    const nv = (log.newValues || {}) as Record<string, unknown>;
    if (log.action === 'GUI_TCNS' || log.action === 'GUI_LAI_TCNS') {
      submittedAt = log.createdAt;
      submittedBy = log.actorEmail || null;
      submittedRevision = typeof nv.revision === 'number' ? nv.revision : wb?.currentRevision || null;
    } else if (log.action !== 'NHAN_XET_THAM_DINH') {
      reviewerEmail = log.actorEmail || reviewerEmail;
      reviewedAt = log.createdAt;
      reviewNote = typeof nv.reviewNote === 'string' && nv.reviewNote ? nv.reviewNote : log.details;
    } else {
      reviewerEmail = log.actorEmail || reviewerEmail;
      reviewedAt = log.createdAt;
      reviewNote = typeof nv.reviewNote === 'string' && nv.reviewNote ? nv.reviewNote : log.details;
    }
  }

  return {
    status,
    statusLabel: REVIEW_STATUS_LABELS[status],
    submittedAt,
    submittedBy,
    submittedRevision,
    reviewerEmail,
    reviewedAt,
    reviewNote
  };
}

export function summarizeErrorCountFromWorkbookData(data?: Record<ExcelSheetKey, GenericGridRow[]> | null): number {
  const kRows = data?.K;
  if (!Array.isArray(kRows)) return 0;
  return kRows.reduce((sum, row) => sum + (Number(row?.soDongLoi) || 0), 0);
}

export function buildAggregatedWorkbookHistory(
  wb: ServerWorkbook,
  revisions: ServerRevision[],
  auditLogs: ServerAuditLog[],
  unitTickets: StaffWorkTicket[]
): WorkbookHistoryTimelineEvent[] {
  const events: WorkbookHistoryTimelineEvent[] = [];

  for (const rev of revisions) {
    events.push({
      id: `rev-${rev.id || rev.revision}`,
      source: 'revision',
      sourceLabel: 'Phiên bản hồ sơ',
      action: `Phiên bản v${rev.revision}`,
      title: rev.changeSummary || `Cập nhật hồ sơ đơn vị v${rev.revision}`,
      details: `Lưu ảnh dữ liệu toàn bộ 10 biểu tại phiên bản v${rev.revision}`,
      actorEmail: rev.actorEmail || 'system',
      revision: rev.revision,
      timestamp: rev.createdAt || wb.updatedAt
    });
  }

  const sRows = wb.data?.S || [];
  sRows.forEach((row, idx) => {
    const content = String(row.noiDungThayDoi || '').trim();
    if (!content) return;
    events.push({
      id: `snk-${row.id || idx}`,
      source: 's_nhat_ky',
      sourceLabel: 'Biểu S_NhatKy',
      action: String(row.bieuThayDoi || 'Cập nhật biểu'),
      title: content,
      details: String(row.canCuThayDoi || 'Ghi nhận trực tiếp trong sổ nhật ký workbook'),
      actorEmail: String(row.nguoiThaoTac || 'system'),
      sheet: String(row.bieuThayDoi || 'S'),
      timestamp: String(row.thoiGian || wb.updatedAt)
    });
  });

  for (const log of auditLogs) {
    const isReview = REVIEW_ACTIONS.has(log.action);
    events.push({
      id: `aud-${log.id}`,
      source: isReview ? 'review' : 'audit',
      sourceLabel: isReview ? 'Thẩm định & Gửi TCNS' : 'Nhật ký nghiệp vụ',
      action: log.action,
      title: log.details,
      details: log.targetEntity ? `Đối tượng: ${log.targetEntity}${log.targetId ? ` (${log.targetId})` : ''}` : 'Ghi nhận trên máy chủ',
      actorEmail: log.actorEmail || 'system',
      timestamp: log.createdAt
    });
  }

  const STATUS_VI_MAP: Record<string, string> = {
    draft: 'Lưu nháp',
    submitted: 'Đã nộp chờ duyệt',
    resubmitted: 'Đã nộp lại chờ duyệt',
    changes_requested: 'Yêu cầu bổ sung',
    approved: 'Đã duyệt',
    cancelled: 'Đã hủy'
  };

  for (const t of unitTickets) {
    for (const h of t.statusHistory || []) {
      const toLabel = STATUS_VI_MAP[h.toStatus] || h.toStatus;
      events.push({
        id: `tkt-${t.id}-${h.id}`,
        source: 'ticket',
        sourceLabel: 'Phiếu công việc',
        action: h.action || h.toStatus,
        title: `[${t.maCongViec}] ${t.tenCongViec}`,
        details: h.reason ? `${toLabel}: ${h.reason}` : `Trạng thái: ${toLabel}`,
        actorEmail: h.actorId || t.ownerEmail,
        sheet: h.action === 'MERGE_TO_SHEETS' ? 'A2, B1' : undefined,
        timestamp: h.createdAt || t.updatedAt
      });
    }
  }

  return events.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 180);
}
