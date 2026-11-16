import {
  CoordinatedTaskLink,
  FieldDiffChangeType,
  StaffWorkTicket,
  TicketFieldDiff,
  WorkSurveySnapshot
} from '@/types/staff-ticket';
import { findHcmuteUnit, QD2266_UNIT_NAMES } from '@/configs/hcmute-units';
import { getQd2266A1RowsForUnit } from '@/configs/hcmute-qd2266-missions';
import { ND232_2026_VTVL_CATALOG } from '@/configs/hcmute-nd232-catalog';
import { appendCoordinatedVtvlDiffs, normalizeCoordinatedVtvls } from './vtvl-coordination-helpers';

export const DELETED_CONTENT_LABEL = 'Đã xóa nội dung';
export const FIRST_VERSION_LABEL = 'Phiên bản nộp đầu tiên';
export const NO_CHANGE_LABEL = 'Không có thay đổi nội dung';
export const MISSING_PRIOR_DATA_LABEL = 'Chưa có dữ liệu để so sánh';
export const MIGRATION_BASELINE_LABEL = 'Bản ghi chuyển đổi dữ liệu';

export interface SnapshotCatalogOverride {
  unitNameSnapshot?: string;
  tenNhiemVuSnapshot?: string;
  tenVtvlSnapshot?: string;
  tenVtvlPhoiHopSnapshot?: string;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r\n/g, '\n').trim();
}

function normalizeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function resolveMissionName(unitCode: string, maNhiemVu: string): string {
  const code = normalizeText(maNhiemVu);
  if (!code) return '';
  try {
    const rows = getQd2266A1RowsForUnit(unitCode || 'TCNS');
    const found = rows.find((r) => String(r.maNhiemVu || '').trim().toUpperCase() === code.toUpperCase());
    if (found && found.tenNhiemVu) return String(found.tenNhiemVu).trim();
  } catch {
    // ignore
  }
  return '';
}

function resolveVtvlName(maVtvl: string): string {
  const code = normalizeText(maVtvl);
  if (!code) return '';
  const upper = code.toUpperCase();
  const byCatalog = ND232_2026_VTVL_CATALOG.find(
    (item) =>
      item.maDanhMucNd232.toUpperCase() === upper ||
      item.linkedCodeHint.toUpperCase() === upper ||
      upper.endsWith(`-${item.linkedCodeHint.toUpperCase()}`)
  );
  if (byCatalog) return byCatalog.positionName;
  return '';
}

function normalizeCoordinatedTasks(tasks?: CoordinatedTaskLink[]): CoordinatedTaskLink[] {
  if (!Array.isArray(tasks)) return [];
  return tasks
    .filter((t) => t && normalizeText(t.id))
    .map((t) => ({
      id: normalizeText(t.id),
      targetUnitCode: normalizeText(t.targetUnitCode).toUpperCase(),
      targetUnitName:
        normalizeText(t.targetUnitName) ||
        QD2266_UNIT_NAMES[normalizeText(t.targetUnitCode).toUpperCase()] ||
        normalizeText(t.targetUnitCode),
      targetTaskCode: normalizeText(t.targetTaskCode),
      targetTaskName: normalizeText(t.targetTaskName),
      note: normalizeText(t.note) || undefined
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Tạo snapshot bất biến cho phiên bản nộp của phiếu công việc.
 * Lưu cả mã và tên danh mục tại thời điểm nộp để danh mục thay đổi về sau không làm lệch lịch sử.
 * Tuyệt đối không chứa thông tin xác thực, token hoặc timestamp hệ thống.
 */
export function buildTicketSnapshot(
  ticket: Partial<StaffWorkTicket>,
  overrides?: SnapshotCatalogOverride
): WorkSurveySnapshot {
  const unitCode = normalizeText(ticket.unitCode || ticket.unitId).toUpperCase();
  const unitDef = unitCode ? findHcmuteUnit(unitCode) : undefined;
  const maNhiemVu = normalizeText(ticket.maNhiemVu);
  const maVtvl = normalizeText(ticket.maVtvl);
  const maVtvlPhoiHop = normalizeText(ticket.maVtvlPhoiHop);

  return {
    unitCode,
    unitNameSnapshot: overrides?.unitNameSnapshot || unitDef?.nameVi || QD2266_UNIT_NAMES[unitCode] || unitCode,
    ownerName: normalizeText(ticket.ownerName),
    ownerTitle: normalizeText(ticket.ownerTitle),
    maNhiemVu,
    tenNhiemVuSnapshot: overrides?.tenNhiemVuSnapshot ?? resolveMissionName(unitCode, maNhiemVu),
    maCongViec: normalizeText(ticket.maCongViec),
    tenCongViec: normalizeText(ticket.tenCongViec),
    maVtvl,
    tenVtvlSnapshot: overrides?.tenVtvlSnapshot ?? resolveVtvlName(maVtvl),
    maVtvlPhoiHop: maVtvlPhoiHop || undefined,
    tenVtvlPhoiHopSnapshot:
      overrides?.tenVtvlPhoiHopSnapshot ?? (maVtvlPhoiHop ? resolveVtvlName(maVtvlPhoiHop) : undefined),
    coordinationNote: normalizeText(ticket.coordinationNote) || undefined,
    coordinatedVtvls: normalizeCoordinatedVtvls(ticket.coordinatedVtvls, unitCode),
    sanPham: normalizeText(ticket.sanPham),
    chatLuong: normalizeText(ticket.chatLuong),
    canCu: normalizeText(ticket.canCu),
    soSpNam: normalizeNumber(ticket.soSpNam),
    nguonSoLieu: normalizeText(ticket.nguonSoLieu),
    phutThucTe: normalizeNumber(ticket.phutThucTe),
    gioBoSung: normalizeNumber(ticket.gioBoSung),
    coordinatedTasks: normalizeCoordinatedTasks(ticket.coordinatedTasks)
  };
}

function formatCatalogDisplay(code?: string, name?: string): string {
  const cleanCode = normalizeText(code);
  const cleanName = normalizeText(name);
  if (!cleanCode && !cleanName) return '';
  if (cleanCode && cleanName && !cleanName.includes(cleanCode)) {
    return `[${cleanCode}] ${cleanName}`;
  }
  return cleanCode || cleanName;
}

function formatCoordinatedTask(task: CoordinatedTaskLink): string {
  const unitPart = task.targetUnitName
    ? `[${task.targetUnitCode}] ${task.targetUnitName}`
    : `[${task.targetUnitCode}]`;
  const taskPart = task.targetTaskCode
    ? `${task.targetTaskCode} — ${task.targetTaskName}`
    : task.targetTaskName;
  const notePart = task.note ? `\nGhi chú: ${task.note}` : '';
  return `Đơn vị: ${unitPart}\nCông việc: ${taskPart}${notePart}`;
}

function compareTextField(
  diffs: TicketFieldDiff[],
  fieldKey: string,
  fieldLabel: string,
  prevRaw: string,
  currRaw: string
): void {
  const prev = normalizeText(prevRaw);
  const curr = normalizeText(currRaw);
  if (prev === curr) return;

  let changeType: FieldDiffChangeType = 'modified';
  if (!prev && curr) changeType = 'added';
  else if (prev && !curr) changeType = 'deleted';

  diffs.push({
    fieldKey,
    fieldLabel,
    changeType,
    previousValue: prev || '—',
    currentValue: changeType === 'deleted' ? DELETED_CONTENT_LABEL : curr
  });
}

function compareNumericField(
  diffs: TicketFieldDiff[],
  fieldKey: string,
  fieldLabel: string,
  prevRaw: unknown,
  currRaw: unknown
): void {
  const prevNum = normalizeNumber(prevRaw);
  const currNum = normalizeNumber(currRaw);
  // So sánh số theo giá trị toán học: 12 và 12.0 là giống nhau
  if (prevNum === currNum) return;

  diffs.push({
    fieldKey,
    fieldLabel,
    changeType: 'modified',
    previousValue: String(prevNum),
    currentValue: String(currNum)
  });
}

/**
 * So sánh từng trường nghiệp vụ giữa hai phiên bản phiếu (prevSnapshot vs currSnapshot).
 * Chỉ trả về các trường thực sự thay đổi nội dung nghiệp vụ.
 */
export function computeTicketVersionDiff(
  prevSnapshot: Partial<WorkSurveySnapshot> | null | undefined,
  currSnapshot: Partial<WorkSurveySnapshot> | null | undefined
): TicketFieldDiff[] {
  if (!prevSnapshot || !currSnapshot) return [];
  const diffs: TicketFieldDiff[] = [];

  compareTextField(diffs, 'ownerName', 'Họ và tên người kê khai', prevSnapshot.ownerName || '', currSnapshot.ownerName || '');
  compareTextField(diffs, 'ownerTitle', 'Chức danh / Chức vụ', prevSnapshot.ownerTitle || '', currSnapshot.ownerTitle || '');

  compareTextField(
    diffs,
    'maNhiemVu',
    'Mã nhiệm vụ (B1)',
    formatCatalogDisplay(prevSnapshot.maNhiemVu, prevSnapshot.tenNhiemVuSnapshot),
    formatCatalogDisplay(currSnapshot.maNhiemVu, currSnapshot.tenNhiemVuSnapshot)
  );

  compareTextField(
    diffs,
    'maVtvl',
    'Vị trí việc làm phụ trách chính (C1)',
    formatCatalogDisplay(prevSnapshot.maVtvl, prevSnapshot.tenVtvlSnapshot),
    formatCatalogDisplay(currSnapshot.maVtvl, currSnapshot.tenVtvlSnapshot)
  );

  compareTextField(
    diffs,
    'maVtvlPhoiHop',
    'Vị trí việc làm phối hợp',
    formatCatalogDisplay(prevSnapshot.maVtvlPhoiHop, prevSnapshot.tenVtvlPhoiHopSnapshot),
    formatCatalogDisplay(currSnapshot.maVtvlPhoiHop, currSnapshot.tenVtvlPhoiHopSnapshot)
  );

  compareTextField(diffs, 'maCongViec', 'Mã công việc', prevSnapshot.maCongViec || '', currSnapshot.maCongViec || '');
  compareTextField(diffs, 'tenCongViec', 'Tên công việc cụ thể', prevSnapshot.tenCongViec || '', currSnapshot.tenCongViec || '');
  compareTextField(diffs, 'sanPham', 'Sản phẩm đầu ra', prevSnapshot.sanPham || '', currSnapshot.sanPham || '');
  compareTextField(diffs, 'chatLuong', 'Yêu cầu chất lượng / Tiêu chuẩn', prevSnapshot.chatLuong || '', currSnapshot.chatLuong || '');
  compareTextField(diffs, 'canCu', 'Căn cứ pháp lý / Minh chứng', prevSnapshot.canCu || '', currSnapshot.canCu || '');

  compareNumericField(
    diffs,
    'soSpNam',
    'Số sản phẩm hoàn thành trong năm trong chu kỳ 1 năm (01/10/2025 đến 30/9/2026)',
    prevSnapshot.soSpNam,
    currSnapshot.soSpNam
  );

  compareTextField(diffs, 'nguonSoLieu', 'Nguồn số liệu kiểm chứng', prevSnapshot.nguonSoLieu || '', currSnapshot.nguonSoLieu || '');
  compareNumericField(diffs, 'phutThucTe', 'Thời gian thực hiện 01 sản phẩm (phút)', prevSnapshot.phutThucTe, currSnapshot.phutThucTe);
  compareNumericField(diffs, 'gioBoSung', 'Giờ bổ sung (Nếu có)', prevSnapshot.gioBoSung, currSnapshot.gioBoSung);

  // So sánh công việc phối hợp theo ID ổn định
  const prevTasks = normalizeCoordinatedTasks(prevSnapshot.coordinatedTasks);
  const currTasks = normalizeCoordinatedTasks(currSnapshot.coordinatedTasks);
  const prevMap = new Map(prevTasks.map((t) => [t.id, t]));
  const currMap = new Map(currTasks.map((t) => [t.id, t]));
  const allTaskIds = Array.from(new Set([...prevMap.keys(), ...currMap.keys()]));

  for (const taskId of allTaskIds) {
    const pTask = prevMap.get(taskId);
    const cTask = currMap.get(taskId);
    const label = `Công việc phối hợp (${taskId})`;
    if (!pTask && cTask) {
      diffs.push({
        fieldKey: `coordinatedTask:${taskId}`,
        fieldLabel: label,
        changeType: 'added',
        previousValue: '—',
        currentValue: formatCoordinatedTask(cTask)
      });
    } else if (pTask && !cTask) {
      diffs.push({
        fieldKey: `coordinatedTask:${taskId}`,
        fieldLabel: label,
        changeType: 'deleted',
        previousValue: formatCoordinatedTask(pTask),
        currentValue: DELETED_CONTENT_LABEL
      });
    } else if (pTask && cTask) {
      const pFormatted = formatCoordinatedTask(pTask);
      const cFormatted = formatCoordinatedTask(cTask);
      if (pFormatted !== cFormatted) {
        diffs.push({
          fieldKey: `coordinatedTask:${taskId}`,
          fieldLabel: label,
          changeType: 'modified',
          previousValue: pFormatted,
          currentValue: cFormatted
        });
      }
    }
  }

  appendCoordinatedVtvlDiffs(diffs, prevSnapshot, currSnapshot);
  return diffs;
}
