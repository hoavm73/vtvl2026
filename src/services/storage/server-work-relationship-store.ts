import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import {
  ProposedCoordinatedTaskItem, StaffWorkTicket, WorkRelationshipApprovalLevel,
  WorkRelationshipItem, toCanonicalStatus, toDisplayStatus
} from '@/types/staff-ticket';
import { registerCacheInvalidator } from './server-file-lock';
import { isIsolatedLocalMode } from './server-ticket-db';
import { loadTickets } from './server-ticket-store';
import { ensureLegacyBaselineVersion } from './server-ticket-version-store';
import { resolveUnitVtvlName } from './server-vtvl-assignment-store';
import { normalizeEmail } from './server-workbook-store';
import { getDbTestHook, isDatabaseConfigured, prisma, toIsoString } from './prisma';
import { pgUpsertRows } from './postgres-rest-compat';
import { writeJsonFileAtomic } from './atomic-json-file';
import { extractEffectiveCoordinatedVtvls, normalizeCode, resolveUnitCodeSafe, resolveUnitNameSafe } from '@/services/tickets/vtvl-coordination-helpers';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const REL_FILE = path.join(DATA_DIR, 'work_relationships.json');

interface ManualApprovalRecord {
  hostLeaderApproved?: boolean; hostApprovedBy?: string; hostApprovedAt?: string;
  targetLeaderApproved?: boolean; targetApprovedBy?: string; targetApprovedAt?: string;
  tcnsApproved?: boolean; tcnsApprovedBy?: string; tcnsApprovedAt?: string;
}
export interface WorkRelationshipStoreState { manualApprovals: Record<string, ManualApprovalRecord>; relationships: Record<string, WorkRelationshipItem>; }

let memoryState: WorkRelationshipStoreState | null = null;
let supabaseTableUnavailable = false;
export function resetWorkRelationshipsMemoryStore(): void { memoryState = null; supabaseTableUnavailable = false; }
registerCacheInvalidator(resetWorkRelationshipsMemoryStore);

export function makeWorkRelationshipId(sourceSurveyId: string, targetUnitCode: string, targetVtvlCode: string): string {
  return `wrel-${sourceSurveyId}-${resolveUnitCodeSafe(targetUnitCode)}-${normalizeCode(targetVtvlCode)}`;
}

function loadState(): WorkRelationshipStoreState {
  if (memoryState) return memoryState;
  try {
    if (fs.existsSync(REL_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(REL_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        memoryState = { manualApprovals: parsed.manualApprovals || {}, relationships: parsed.relationships || {} };
        return memoryState;
      }
    }
  } catch { /* ignore */ }
  memoryState = { manualApprovals: {}, relationships: {} };
  return memoryState;
}

function persistState(state: WorkRelationshipStoreState): void {
  memoryState = state;
  writeJsonFileAtomic(REL_FILE, state, true);
}

export function getWorkRelationshipStateSnapshot(): WorkRelationshipStoreState {
  return JSON.parse(JSON.stringify(loadState())) as WorkRelationshipStoreState;
}

export function commitWorkRelationshipState(state: WorkRelationshipStoreState): void {
  persistState(state);
}

function mapRelItemToDbRow(r: WorkRelationshipItem) {
  return {
    id: r.id, source_survey_id: r.sourceSurveyId, source_task_code: r.sourceTaskCode,
    source_task_name: r.sourceTaskName, source_mission_code: r.sourceMissionCode,
    host_unit_code: r.hostUnitCode, host_unit_name: r.hostUnitName, host_vtvl_code: r.hostVtvlCode,
    host_vtvl_name: r.hostVtvlName || '', target_unit_code: r.targetUnitCode, target_unit_name: r.targetUnitName,
    target_vtvl_code: r.targetVtvlCode, target_vtvl_name: r.targetVtvlName || '',
    coordination_note: r.coordinationNote || '', san_pham: r.sanPham || '',
    target_survey_id: r.targetDeclaredTicketId || null, target_task_code: r.targetDeclaredTicketCode || null,
    host_leader_approved: r.hostLeaderApproved, host_approved_by: r.hostApprovedBy || null,
    host_approved_at: r.hostApprovedAt || null, target_leader_approved: r.targetLeaderApproved,
    target_approved_by: r.targetApprovedBy || null, target_approved_at: r.targetApprovedAt || null,
    tcns_approved: r.tcnsApproved, tcns_approved_by: r.tcnsApprovedBy || null,
    tcns_approved_at: r.tcnsApprovedAt || null, relationship_status: r.approvalLevel, updated_at: r.updatedAt
  };
}

export async function syncWorkRelationshipsFromSupabase(): Promise<void> {
  if (isIsolatedLocalMode() || !isDatabaseConfigured()) return;
  try {
    const state = loadState();
    const hook = getDbTestHook();
    const tdRow: Record<string, unknown> | null = hook?.select
      ? ((await hook.select('t_tien_do', { ma_don_vi: 'TCNS' }))[0] || null)
      : ((await prisma.t_tien_do.findUnique({ where: { ma_don_vi: 'TCNS' }, select: { du_lieu_ho_so_json: true } })) as unknown as Record<string, unknown> | null);
    const tdJson = (tdRow?.du_lieu_ho_so_json as Record<string, unknown>) || {};
    const jsonbRels: WorkRelationshipItem[] = Array.isArray(tdJson.workRelationships)
      ? (tdJson.workRelationships as WorkRelationshipItem[]) : [];

    for (const jr of jsonbRels) {
      if (!jr?.id) continue;
      const cur = state.manualApprovals[jr.id] || {};
      state.manualApprovals[jr.id] = {
        hostLeaderApproved: Boolean(cur.hostLeaderApproved || jr.hostLeaderApproved),
        hostApprovedBy: cur.hostApprovedBy || jr.hostApprovedBy,
        hostApprovedAt: cur.hostApprovedAt || jr.hostApprovedAt,
        targetLeaderApproved: Boolean(cur.targetLeaderApproved || jr.targetLeaderApproved),
        targetApprovedBy: cur.targetApprovedBy || jr.targetApprovedBy,
        targetApprovedAt: cur.targetApprovedAt || jr.targetApprovedAt,
        tcnsApproved: Boolean(cur.tcnsApproved || jr.tcnsApproved),
        tcnsApprovedBy: cur.tcnsApprovedBy || jr.tcnsApprovedBy,
        tcnsApprovedAt: cur.tcnsApprovedAt || jr.tcnsApprovedAt
      };
      state.relationships[jr.id] = { ...(state.relationships[jr.id] || jr), ...state.manualApprovals[jr.id] };
    }

    if (!supabaseTableUnavailable) {
      const rows: Record<string, unknown>[] = hook?.select
        ? await hook.select('work_relationships')
        : ((await prisma.work_relationships.findMany()) as unknown as Record<string, unknown>[]);
      const dbIds = new Set<string>();
      for (const r of rows) {
        const id = String(r.id || '').trim();
        if (!id) continue;
        dbIds.add(id);
        const cur = state.manualApprovals[id] || {};
        state.manualApprovals[id] = {
          hostLeaderApproved: Boolean(r.host_leader_approved || cur.hostLeaderApproved),
          hostApprovedBy: (r.host_approved_by ? String(r.host_approved_by) : undefined) || cur.hostApprovedBy,
          hostApprovedAt: toIsoString(r.host_approved_at as Date | string) || cur.hostApprovedAt,
          targetLeaderApproved: Boolean(r.target_leader_approved || cur.targetLeaderApproved),
          targetApprovedBy: (r.target_approved_by ? String(r.target_approved_by) : undefined) || cur.targetApprovedBy,
          targetApprovedAt: toIsoString(r.target_approved_at as Date | string) || cur.targetApprovedAt,
          tcnsApproved: Boolean(r.tcns_approved || cur.tcnsApproved),
          tcnsApprovedBy: (r.tcns_approved_by ? String(r.tcns_approved_by) : undefined) || cur.tcnsApprovedBy,
          tcnsApprovedAt: toIsoString(r.tcns_approved_at as Date | string) || cur.tcnsApprovedAt
        };
      }
      const missingFromDb = jsonbRels.filter((jr) => jr?.id && !dbIds.has(jr.id));
      if (missingFromDb.length > 0) {
        await pgUpsertRows('work_relationships', missingFromDb.map((jr) => mapRelItemToDbRow({ ...jr, ...state.manualApprovals[jr.id] })), 'id').catch(() => {});
      }
    }
    persistState(state);
  } catch { /* fallback to local file store */ }
}

async function persistRelationshipsToSupabase(items: WorkRelationshipItem[]): Promise<void> {
  if (isIsolatedLocalMode() || !isDatabaseConfigured() || items.length === 0) return;
  try {
    if (!supabaseTableUnavailable) {
      const res = await pgUpsertRows('work_relationships', items.map(mapRelItemToDbRow), 'id');
      if (res.ok) return;
      if (res.status === 404) supabaseTableUnavailable = true;
    }
    const existingRow = await prisma.t_tien_do.findUnique({ where: { ma_don_vi: 'TCNS' } });
    const prevJson = (existingRow?.du_lieu_ho_so_json as Record<string, unknown>) || {};
    const nextJson = { ...prevJson, workRelationships: items } as unknown as Prisma.InputJsonValue;
    await prisma.t_tien_do.upsert({
      where: { ma_don_vi: 'TCNS' },
      update: { ten_don_vi: 'Phòng Tổ chức - Nhân sự', du_lieu_ho_so_json: nextJson, updated_at: new Date() },
      create: { ma_don_vi: 'TCNS', ten_don_vi: 'Phòng Tổ chức - Nhân sự', phien_ban: existingRow?.phien_ban || 'v1', du_lieu_ho_so_json: nextJson }
    });
  } catch { /* fallback safely */ }
}

function findTargetDeclaredTicket(allTickets: StaffWorkTicket[], src: StaffWorkTicket, hostUnit: string, targetUnit: string, targetVtvl: string): StaffWorkTicket | undefined {
  const candidates = allTickets.filter((t) => t.id !== src.id && resolveUnitCodeSafe(t.unitCode) === targetUnit && normalizeCode(t.maVtvl) === normalizeCode(targetVtvl));
  if (candidates.length === 0) return undefined;
  const scored = candidates.map((cand) => {
    const pointsBack = extractEffectiveCoordinatedVtvls(cand, targetUnit).some((rv) => resolveUnitCodeSafe(rv.targetUnitCode) === hostUnit);
    const sameContent = Boolean(src.tenCongViec && cand.tenCongViec.toLowerCase().includes(src.tenCongViec.trim().toLowerCase().slice(0, 12)));
    return { cand, score: (pointsBack ? 4 : 0) + (sameContent ? 2 : 0) + (toCanonicalStatus(cand.status) === 'approved' ? 1 : 0) };
  });
  scored.sort((a, b) => b.score - a.score || b.cand.updatedAt.localeCompare(a.cand.updatedAt));
  return scored[0]?.cand;
}

function buildApprovalMeta(hostUnit: string, targetUnit: string, targetTicket: StaffWorkTicket | undefined, hostApproved: boolean, targetApproved: boolean, tcnsApproved: boolean): {
  approvalLevel: WorkRelationshipApprovalLevel; approvalLabel: string; hostApprovalLabel: string; targetApprovalLabel: string;
} {
  const isDeclared = Boolean(targetTicket);
  const hostApprovalLabel = hostApproved ? `Đơn vị đề xuất (${hostUnit}): Lãnh đạo đã duyệt` : `Đơn vị đề xuất (${hostUnit}): Chưa phê duyệt`;
  const targetApprovalLabel = targetApproved
    ? (isDeclared ? `Đơn vị nhận (${targetUnit}): Đã kê khai (${targetTicket!.maCongViec}) & Lãnh đạo đã duyệt` : `Đơn vị nhận (${targetUnit}): Lãnh đạo đã duyệt`)
    : (isDeclared ? `Đơn vị nhận (${targetUnit}): Đã kê khai (${targetTicket!.maCongViec}) • Chờ lãnh đạo duyệt` : `Đơn vị nhận (${targetUnit}): Chưa kê khai / Chưa duyệt`);

  if (tcnsApproved && hostApproved && targetApproved) return { approvalLevel: 'both_units_and_tcns', approvalLabel: 'Đã được lãnh đạo 2 đơn vị & Phòng Tổ chức – Nhân sự duyệt', hostApprovalLabel, targetApprovalLabel };
  if (tcnsApproved) return { approvalLevel: 'tcns_approved', approvalLabel: 'Phòng Tổ chức – Nhân sự đã duyệt', hostApprovalLabel, targetApprovalLabel };
  if (hostApproved && targetApproved) return { approvalLevel: 'both_units_approved', approvalLabel: 'Đã được lãnh đạo 2 đơn vị duyệt', hostApprovalLabel, targetApprovalLabel };
  if (hostApproved || targetApproved) {
    const done = hostApproved ? hostUnit : targetUnit;
    const wait = hostApproved ? targetUnit : hostUnit;
    return { approvalLevel: 'one_unit_approved', approvalLabel: `Mới 1 bên lãnh đạo duyệt (${done} đã duyệt • Chờ ${wait} duyệt)`, hostApprovalLabel, targetApprovalLabel };
  }
  return { approvalLevel: 'unapproved', approvalLabel: 'Chưa phê duyệt bởi lãnh đạo 2 đơn vị', hostApprovalLabel, targetApprovalLabel };
}

export async function computeWorkRelationshipsAndEnrichProposals(
  items: ProposedCoordinatedTaskItem[], callerUnitCode: string, isAdmin: boolean
): Promise<WorkRelationshipItem[]> {
  const validTickets = Array.from(loadTickets().values()).filter((t) => !t.isTestData && !t.isArchived && toCanonicalStatus(t.status) !== 'draft');
  const state = loadState();
  const relMap = new Map<string, WorkRelationshipItem>();

  for (const src of validTickets) {
    const versions = ensureLegacyBaselineVersion(src);
    if (versions.length === 0) continue;
    const snap = versions[versions.length - 1].snapshot;
    const hostUnit = resolveUnitCodeSafe(snap.unitCode || src.unitCode);
    for (const target of extractEffectiveCoordinatedVtvls(snap, hostUnit)) {
      const targetUnit = resolveUnitCodeSafe(target.targetUnitCode);
      if (!targetUnit || !target.maVtvl) continue;
      const relId = makeWorkRelationshipId(src.id, targetUnit, target.maVtvl);
      const manual = state.manualApprovals[relId] || {};
      const targetTicket = findTargetDeclaredTicket(validTickets, src, hostUnit, targetUnit, target.maVtvl);
      const srcApproved = toCanonicalStatus(src.status) === 'approved', tgtApproved = Boolean(targetTicket && toCanonicalStatus(targetTicket.status) === 'approved');
      const hostApproved = srcApproved || Boolean(manual.hostLeaderApproved);
      const targetApproved = tgtApproved || Boolean(manual.targetLeaderApproved);
      const tcnsAuto = (srcApproved && normalizeEmail(src.approvedBy || '') === 'tcns@hcmute.edu.vn') ||
        Boolean(tgtApproved && targetTicket && normalizeEmail(targetTicket.approvedBy || '') === 'tcns@hcmute.edu.vn');
      const tcnsApproved = Boolean(manual.tcnsApproved) || tcnsAuto;
      const meta = buildApprovalMeta(hostUnit, targetUnit, targetTicket, hostApproved, targetApproved, tcnsApproved);
      const relItem: WorkRelationshipItem = {
        id: relId, sourceSurveyId: src.id, sourceTaskCode: snap.maCongViec || src.maCongViec,
        sourceTaskName: snap.tenCongViec || src.tenCongViec, sourceMissionCode: snap.maNhiemVu || src.maNhiemVu,
        hostUnitCode: hostUnit, hostUnitName: snap.unitNameSnapshot || resolveUnitNameSafe(hostUnit),
        hostVtvlCode: snap.maVtvl || src.maVtvl, hostVtvlName: snap.tenVtvlSnapshot || resolveUnitVtvlName(hostUnit, snap.maVtvl || src.maVtvl),
        proposerName: snap.ownerName || src.ownerName, targetUnitCode: targetUnit,
        targetUnitName: target.targetUnitName || resolveUnitNameSafe(targetUnit), targetVtvlCode: target.maVtvl,
        targetVtvlName: target.tenVtvl || resolveUnitVtvlName(targetUnit, target.maVtvl),
        coordinationNote: target.note || snap.coordinationNote || undefined, sanPham: snap.sanPham || '',
        isDeclaredByTargetUnit: Boolean(targetTicket), targetDeclaredTicketId: targetTicket?.id,
        targetDeclaredTicketCode: targetTicket?.maCongViec, targetDeclaredTaskName: targetTicket?.tenCongViec,
        targetDeclaredStatus: targetTicket ? toDisplayStatus(targetTicket.status) : undefined,
        hostLeaderApproved: hostApproved, hostApprovedBy: manual.hostApprovedBy || (srcApproved ? src.approvedBy : undefined),
        hostApprovedAt: manual.hostApprovedAt || (srcApproved ? src.approvedAt : undefined),
        targetLeaderApproved: targetApproved, targetApprovedBy: manual.targetApprovedBy || (tgtApproved ? targetTicket?.approvedBy : undefined),
        targetApprovedAt: manual.targetApprovedAt || (tgtApproved ? targetTicket?.approvedAt : undefined),
        tcnsApproved, tcnsApprovedBy: manual.tcnsApprovedBy || (tcnsAuto ? 'tcns@hcmute.edu.vn' : undefined),
        tcnsApprovedAt: manual.tcnsApprovedAt || (tcnsAuto ? (src.approvedAt || targetTicket?.approvedAt) : undefined),
        ...meta, updatedAt: targetTicket && targetTicket.updatedAt > src.updatedAt ? targetTicket.updatedAt : src.updatedAt
      };
      relMap.set(relId, relItem);
      state.relationships[relId] = relItem;
    }
  }

  for (const p of items) {
    const matchedRels = p.matchedVtvls.map((m) => relMap.get(makeWorkRelationshipId(p.surveyId, m.targetUnitCode, m.maVtvl))).filter((r): r is WorkRelationshipItem => Boolean(r));
    const best = matchedRels.find((r) => r.isDeclaredByTargetUnit) || matchedRels[0];
    if (!best) continue;
    p.isDeclaredByTargetUnit = best.isDeclaredByTargetUnit; p.targetDeclaredTicketCode = best.targetDeclaredTicketCode;
    p.targetDeclaredStatus = best.targetDeclaredStatus; p.hostUnitApproved = best.hostLeaderApproved;
    p.targetUnitApproved = best.targetLeaderApproved; p.tcnsApproved = best.tcnsApproved;
    p.hostApprovalLabel = best.hostApprovalLabel; p.targetApprovalLabel = best.targetApprovalLabel;
    p.approvalBadgeText = best.approvalLabel; p.relationshipId = best.id;
  }

  const allComputed = Array.from(relMap.values());
  persistState(state);
  await persistRelationshipsToSupabase(allComputed);
  const cleanCallerUnit = resolveUnitCodeSafe(callerUnitCode);
  return allComputed
    .filter((r) => (r.hostLeaderApproved || r.targetLeaderApproved || r.tcnsApproved) &&
      (isAdmin || r.hostUnitCode === cleanCallerUnit || r.targetUnitCode === cleanCallerUnit))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getWorkRelationshipById(relationshipId: string): WorkRelationshipItem | null {
  return loadState().relationships[relationshipId] || null;
}

export async function setRelationshipManualApproval(params: {
  relationshipId: string; side: 'host' | 'target' | 'tcns'; approved: boolean; actorEmail: string;
}): Promise<WorkRelationshipItem | null> {
  const state = loadState();
  const prev = state.manualApprovals[params.relationshipId] || {};
  const nowIso = new Date().toISOString();
  const actor = normalizeEmail(params.actorEmail);
  if (params.side === 'host') { prev.hostLeaderApproved = params.approved; prev.hostApprovedBy = actor; prev.hostApprovedAt = nowIso; }
  else if (params.side === 'target') { prev.targetLeaderApproved = params.approved; prev.targetApprovedBy = actor; prev.targetApprovedAt = nowIso; }
  else { prev.tcnsApproved = params.approved; prev.tcnsApprovedBy = actor; prev.tcnsApprovedAt = nowIso; }
  state.manualApprovals[params.relationshipId] = prev;
  persistState(state);
  const rels = await computeWorkRelationshipsAndEnrichProposals([], '', true);
  return rels.find((r) => r.id === params.relationshipId) || state.relationships[params.relationshipId] || null;
}
