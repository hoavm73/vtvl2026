import {
  ProposedCoordinatedTaskItem,
  StaffWorkTicket,
  toCanonicalStatus,
  toDisplayStatus,
  UserVtvlAssignment,
  WorkSurveyVersion
} from '@/types/staff-ticket';
import { loadTickets } from '@/services/storage/server-ticket-store';
import { ensureLegacyBaselineVersion, hasStoredTicketVersions } from '@/services/storage/server-ticket-version-store';
import { getUserAccountByEmail } from '@/services/storage/server-account-store';
import {
  getAssignmentsForEmail,
  resolveUnitVtvlName
} from '@/services/storage/server-vtvl-assignment-store';
import {
  getCoordinatedCandidateTickets,
  loadCoordinationState,
  persistCoordinationState,
  SubmittedCoordinatedVtvlRow
} from '@/services/storage/server-coordination-store';
import { getOrCreateWorkbook } from '@/services/storage/server-workbook-store';
import { isIsolatedLocalMode } from '@/services/storage/server-ticket-db';
import { isDatabaseConfigured, prisma } from '@/services/storage/prisma';
import { pgUpsertRows } from '@/services/storage/postgres-rest-compat';
import {
  extractEffectiveCoordinatedVtvls,
  makeCompositeVtvlKey,
  normalizeCode,
  resolveUnitCodeSafe,
  resolveUnitNameSafe
} from './vtvl-coordination-helpers';

export function hasTicketOrTargetCoordination(ticket: StaffWorkTicket, previous?: StaffWorkTicket | null): boolean {
  if (ticket.maVtvlPhoiHop?.trim() || ticket.coordinatedVtvls?.length) return true;
  if (previous?.maVtvlPhoiHop?.trim() || previous?.coordinatedVtvls?.length) return true;
  const state = loadCoordinationState();
  if ((state.submittedRowsBySurvey[ticket.id]?.length || 0) > 0) return true;
  const uc = resolveUnitCodeSafe(ticket.unitCode), vtvl = normalizeCode(ticket.maVtvl);
  if (!uc || !vtvl) return false;
  for (const rows of Object.values(state.submittedRowsBySurvey)) {
    if (rows.some((r) => resolveUnitCodeSafe(r.targetUnitCode) === uc && normalizeCode(r.targetVtvlCode) === vtvl)) return true;
  }
  return false;
}

export function getSubmittedCoordinationHistory(surveyId: string): SubmittedCoordinatedVtvlRow[] {
  return [...(loadCoordinationState().submittedRowsBySurvey[surveyId] || [])].sort(
    (a, b) => a.versionNo - b.versionNo
  );
}

function resolveMissionNameFromWorkbook(unitCode: string, maNhiemVu: string, fallback?: string): string {
  if (fallback?.trim()) return fallback.trim();
  const cleanUnit = resolveUnitCodeSafe(unitCode);
  const cleanCode = normalizeCode(maNhiemVu);
  if (!cleanUnit || !cleanCode) return '';
  try {
    const wb = getOrCreateWorkbook(cleanUnit);
    const a1 = Array.isArray(wb.data?.A1) ? wb.data.A1 : [];
    const found = a1.find((r) => normalizeCode(r.maNhiemVu) === cleanCode);
    if (found?.tenNhiemVu) return String(found.tenNhiemVu).trim();
  } catch {
    // ignore
  }
  return '';
}

export async function syncSubmittedCoordinationProjection(
  ticket: StaffWorkTicket,
  version: WorkSurveyVersion
): Promise<SubmittedCoordinatedVtvlRow[]> {
  const state = loadCoordinationState();
  const taskRowId = ticket.sourceTicketId || ticket.id;
  const hostUnitCode = resolveUnitCodeSafe(version.snapshot.unitCode || ticket.unitCode);
  const effective = extractEffectiveCoordinatedVtvls(version.snapshot, hostUnitCode);
  const nowIso = version.submittedAt || new Date().toISOString();

  const existing = (state.submittedRowsBySurvey[ticket.id] || [])
    .filter((r) => r.versionNo !== version.versionNo)
    .map((r) => ({ ...r, isLatestSubmitted: false }));

  const newRows: SubmittedCoordinatedVtvlRow[] = effective.map((item) => ({
    id: `wscv-${ticket.id}-v${version.versionNo}-${resolveUnitCodeSafe(item.targetUnitCode)}-${normalizeCode(item.maVtvl)}`,
    surveyId: ticket.id,
    versionNo: version.versionNo,
    taskRowId,
    hostUnitCode,
    targetUnitCode: resolveUnitCodeSafe(item.targetUnitCode),
    targetVtvlCode: item.maVtvl,
    targetVtvlName: item.tenVtvl || resolveUnitVtvlName(item.targetUnitCode, item.maVtvl) || undefined,
    coordinationNote: item.note || version.snapshot.coordinationNote || undefined,
    isLatestSubmitted: true,
    createdAt: nowIso
  }));

  state.submittedRowsBySurvey[ticket.id] = [...existing, ...newRows];
  persistCoordinationState(state);

  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    try {
      await prisma.work_survey_coordinated_vtvls.updateMany({
        where: { survey_id: ticket.id },
        data: { is_latest_submitted: false }
      });
      if (newRows.length > 0) {
        await pgUpsertRows(
          'work_survey_coordinated_vtvls',
          newRows.map((r) => ({
            survey_id: r.surveyId,
            version_no: r.versionNo,
            task_row_id: r.taskRowId,
            host_unit_code: r.hostUnitCode,
            target_unit_code: r.targetUnitCode,
            target_vtvl_code: r.targetVtvlCode,
            target_vtvl_name: r.targetVtvlName || null,
            coordination_note: r.coordinationNote || null,
            is_latest_submitted: true,
            created_at: r.createdAt
          })),
          'survey_id,version_no,task_row_id,target_unit_code,target_vtvl_code'
        );
      }
    } catch {
      // Fallback an toàn vào dữ liệu cục bộ nếu bảng chưa đồng bộ
    }
  }

  return newRows;
}

export function compensateRemoveCoordinationProjection(surveyId: string, versionNo: number): void {
  const state = loadCoordinationState();
  const list = state.submittedRowsBySurvey[surveyId];
  if (!list) return;
  const filtered = list.filter((r) => r.versionNo !== versionNo);
  const maxVer = filtered.reduce((m, r) => Math.max(m, r.versionNo), 0);
  state.submittedRowsBySurvey[surveyId] = filtered.map((r) => ({
    ...r,
    isLatestSubmitted: r.versionNo === maxVer
  }));
  persistCoordinationState(state);
}

function buildMinimizedProposalForViewer(
  ticket: StaffWorkTicket,
  latestVer: WorkSurveyVersion,
  filter: { viewerKeys?: Set<string>; targetUnitCode?: string; includeAllUnits?: boolean }
): ProposedCoordinatedTaskItem | null {
  const snap = latestVer.snapshot;
  const hostUnitCode = resolveUnitCodeSafe(snap.unitCode || ticket.unitCode);
  const effective = extractEffectiveCoordinatedVtvls(snap, hostUnitCode);
  const matched = effective.filter((item) => {
    if (filter.includeAllUnits) return true;
    if (filter.targetUnitCode) return resolveUnitCodeSafe(item.targetUnitCode) === filter.targetUnitCode;
    return Boolean(filter.viewerKeys?.has(makeCompositeVtvlKey(item.targetUnitCode, item.maVtvl)));
  });
  if (matched.length === 0) return null;

  const taskRowId = ticket.sourceTicketId || ticket.id;
  const matchedNotes = matched.map((m) => m.note).filter(Boolean) as string[];
  const coordinationNote = matchedNotes[0] || snap.coordinationNote || undefined;

  return {
    proposalKey: `${ticket.id}::${taskRowId}`,
    surveyId: ticket.id,
    taskRowId,
    hostUnitCode,
    hostUnitName: snap.unitNameSnapshot || resolveUnitNameSafe(hostUnitCode),
    maNhiemVu: snap.maNhiemVu,
    tenNhiemVu: resolveMissionNameFromWorkbook(hostUnitCode, snap.maNhiemVu, snap.tenNhiemVuSnapshot),
    maCongViec: snap.maCongViec,
    tenCongViec: snap.tenCongViec,
    proposerName: snap.ownerName || ticket.ownerName,
    proposerTitle: snap.ownerTitle || ticket.ownerTitle,
    hostPrimaryVtvlCode: snap.maVtvl,
    hostPrimaryVtvlName: snap.tenVtvlSnapshot || resolveUnitVtvlName(hostUnitCode, snap.maVtvl),
    matchedVtvls: matched.map((m) => ({
      targetUnitCode: resolveUnitCodeSafe(m.targetUnitCode),
      targetUnitName: m.targetUnitName || resolveUnitNameSafe(m.targetUnitCode),
      maVtvl: m.maVtvl,
      tenVtvl: m.tenVtvl || resolveUnitVtvlName(m.targetUnitCode, m.maVtvl),
      note: m.note
    })),
    sanPham: snap.sanPham || '',
    coordinationNote,
    submittedAt: latestVer.submittedAt || ticket.resubmittedAt || ticket.submittedAt || ticket.updatedAt,
    versionNo: latestVer.versionNo,
    sourceStatus: toDisplayStatus(ticket.status),
    canonicalStatus: toCanonicalStatus(ticket.status)
  };
}

export function queryProposedTasksForUser(
  callerEmail: string,
  options?: { unitCode?: string; scope?: string }
): {
  items: ProposedCoordinatedTaskItem[];
  myAssignments: UserVtvlAssignment[];
} {
  const myAssignments = getAssignmentsForEmail(callerEmail);
  const callerAccount = getUserAccountByEmail(callerEmail);
  const scope = (options?.scope || '').trim().toLowerCase();
  const includeAllUnits = scope === 'all_units' && callerAccount?.role === 'admin';
  const useUnitScope = scope === 'unit' || myAssignments.length === 0;
  const targetUnitCode = resolveUnitCodeSafe(options?.unitCode || callerAccount?.unitCode || '');

  if (!includeAllUnits && useUnitScope && !targetUnitCode) {
    return { items: [], myAssignments };
  }
  if (!includeAllUnits && !useUnitScope && myAssignments.length === 0) {
    return { items: [], myAssignments: [] };
  }

  const viewerKeys = new Set(myAssignments.map((a) => makeCompositeVtvlKey(a.unitCode, a.maVtvl)));
  const filter = includeAllUnits ? { includeAllUnits: true } : useUnitScope ? { targetUnitCode } : { viewerKeys };
  const items: ProposedCoordinatedTaskItem[] = [];

  for (const ticket of getCoordinatedCandidateTickets()) {
    if (ticket.isTestData || ticket.isArchived) continue;
    if (toCanonicalStatus(ticket.status) === 'draft') continue;
    const hasCoord = Boolean(ticket.maVtvlPhoiHop?.trim() || ticket.coordinatedVtvls?.length);
    if (!hasCoord && !hasStoredTicketVersions(ticket.id)) continue;
    const versions = ensureLegacyBaselineVersion(ticket);
    if (versions.length === 0) continue;
    const item = buildMinimizedProposalForViewer(ticket, versions[versions.length - 1], filter);
    if (item) items.push(item);
  }

  items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return { items, myAssignments };
}

export function queryProposedTaskDetailForUser(
  callerEmail: string,
  surveyId: string,
  taskRowId?: string,
  options?: { unitCode?: string; scope?: string }
):
  | { ok: true; status: 200; item: ProposedCoordinatedTaskItem }
  | { ok: false; status: 403 | 404; code: string; error: string } {
  const ticket = loadTickets().get(surveyId);
  if (!ticket || ticket.isTestData || ticket.isArchived || toCanonicalStatus(ticket.status) === 'draft') {
    return { ok: false, status: 404, code: 'PROPOSAL_NOT_FOUND', error: 'Không tìm thấy công việc đề xuất phối hợp.' };
  }
  const actualTaskRowId = ticket.sourceTicketId || ticket.id;
  if (taskRowId && taskRowId !== actualTaskRowId) {
    return { ok: false, status: 404, code: 'PROPOSAL_TASK_NOT_FOUND', error: 'Không tìm thấy dòng công việc phối hợp.' };
  }

  const myAssignments = getAssignmentsForEmail(callerEmail);
  const callerAccount = getUserAccountByEmail(callerEmail);
  const scope = (options?.scope || '').trim().toLowerCase();
  const includeAllUnits = scope === 'all_units' && callerAccount?.role === 'admin';
  const useUnitScope = scope === 'unit' || myAssignments.length === 0;
  const targetUnitCode = resolveUnitCodeSafe(options?.unitCode || callerAccount?.unitCode || '');
  const viewerKeys = new Set(myAssignments.map((a) => makeCompositeVtvlKey(a.unitCode, a.maVtvl)));
  const filter = includeAllUnits
    ? { includeAllUnits: true }
    : useUnitScope
      ? { targetUnitCode }
      : { viewerKeys };

  const versions = ensureLegacyBaselineVersion(ticket);
  if (versions.length === 0) {
    return { ok: false, status: 404, code: 'PROPOSAL_NOT_FOUND', error: 'Phiếu chưa có phiên bản nộp chính thức.' };
  }

  const latestVer = versions[versions.length - 1];
  const item = buildMinimizedProposalForViewer(ticket, latestVer, filter);
  if (!item) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN_NOT_COORDINATED_RECIPIENT',
      error: 'Bạn không thuộc đơn vị hoặc vị trí việc làm được đề xuất phối hợp của công việc này.'
    };
  }

  return { ok: true, status: 200, item };
}
