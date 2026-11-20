import { StaffWorkTicket, WorkSurveyStatusHistory } from '@/types/staff-ticket';
import { assertTicketDbConfigured, createSchemaOrDbError, DbTicketRow, isIsolatedLocalMode, mapDbRowToTicket } from './server-ticket-db';
import { getDbTestHook, prisma, toIsoString } from './prisma';

function extractMissionChangeFields(reason?: string | null): Partial<WorkSurveyStatusHistory> {
  if (!reason) return {};
  const m = reason.match(/Thay đổi Mã nhiệm vụ từ\s+([^\s;]+)\s+sang\s+([^\s;]+);\s*Mã công việc được thay đổi từ\s+([^\s;]+)\s+sang\s+([^\s.;]+)/i);
  if (!m) return {};
  return {
    oldMissionCode: m[1],
    newMissionCode: m[2],
    oldWorkCode: m[3],
    newWorkCode: m[4]
  };
}

function mapDbHistoryRow(r: {
  id: unknown; survey_id: unknown; from_status: string | null; to_status: unknown;
  action: unknown; reason: string | null; actor_id: unknown; actor_role: unknown;
  unit_id: unknown; created_at: Date | string | null;
}): WorkSurveyStatusHistory {
  return {
    id: String(r.id),
    surveyId: String(r.survey_id),
    fromStatus: r.from_status || undefined,
    toStatus: String(r.to_status),
    action: String(r.action),
    reason: r.reason || undefined,
    actorId: String(r.actor_id || '').toLowerCase().trim(),
    actorRole: String(r.actor_role || 'staff'),
    unitId: String(r.unit_id || ''),
    createdAt: toIsoString(r.created_at) || new Date().toISOString(),
    ...extractMissionChangeFields(r.reason)
  };
}

/**
 * Đọc toàn bộ lịch sử chuyển trạng thái & phản hồi từ bảng public.work_survey_status_history qua Prisma.
 */
export async function fetchStatusHistoryFromSupabase(
  unitCode?: string
): Promise<Map<string, WorkSurveyStatusHistory[]> | null> {
  if (!assertTicketDbConfigured('fetchStatusHistory')) return null;

  try {
    const rows = await prisma.work_survey_status_history.findMany({
      where: unitCode ? { unit_id: unitCode.toUpperCase() } : undefined,
      orderBy: { created_at: 'asc' }
    });

    const bySurvey = new Map<string, WorkSurveyStatusHistory[]>();
    for (const r of rows) {
      if (!r?.survey_id) continue;
      const item = mapDbHistoryRow(r);
      const list = bySurvey.get(item.surveyId) || [];
      list.push(item);
      bySurvey.set(item.surveyId, list);
    }

    return bySurvey;
  } catch (e) {
    throw createSchemaOrDbError('work_survey_status_history', 500, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Đồng bộ trực tiếp đúng 1 phiếu theo `id` (kèm lịch sử riêng của phiếu đó) thay vì quét toàn đơn vị.
 */
export async function syncSingleTicketAuthoritativeFromDb(
  ticketId: string,
  store: Map<string, StaffWorkTicket>,
  deletedIds?: ReadonlySet<string>
): Promise<StaffWorkTicket | null> {
  const id = (ticketId || '').trim();
  if (!id || deletedIds?.has(id)) return null;
  if (!assertTicketDbConfigured('fetchSingleTicket') || (getDbTestHook() && !(process.env.DATABASE_URL || '').trim())) {
    return store.get(id) || null;
  }
  try {
    const [row, histRows] = await Promise.all([
      prisma.staff_work_tickets.findUnique({ where: { id } }),
      prisma.work_survey_status_history.findMany({ where: { survey_id: id }, orderBy: { created_at: 'asc' } })
    ]);
    if (!row) return store.get(id) || null;
    const remote = mapDbRowToTicket(row as unknown as DbTicketRow);
    const remoteHistory = histRows.map((r) => mapDbHistoryRow(r));
    const existing = store.get(id);
    const exUpdated = existing?.updatedAt || '';
    const rmUpdated = remote.updatedAt || '';
    const mergedReg = Boolean(existing?.isMergedToB1B2 && !remote.isMergedToB1B2 && exUpdated >= rmUpdated);
    const keepExisting = Boolean(existing && (exUpdated > rmUpdated || mergedReg));
    const nextTicket: StaffWorkTicket =
      keepExisting && existing
        ? { ...existing, statusHistory: mergeTicketStatusHistory(existing.statusHistory, remoteHistory) }
        : { ...existing, ...remote, statusHistory: mergeTicketStatusHistory(existing?.statusHistory || remote.statusHistory, remoteHistory) };
    store.set(id, nextTicket);
    return nextTicket;
  } catch {
    return store.get(id) || null;
  }
}

/**
 * Gộp và khử trùng lịch sử trạng thái giữa bộ nhớ cục bộ và PostgreSQL theo thứ tự thời gian tăng dần.
 */
export function mergeTicketStatusHistory(
  localList?: WorkSurveyStatusHistory[],
  remoteList?: WorkSurveyStatusHistory[]
): WorkSurveyStatusHistory[] {
  const byId = new Map<string, WorkSurveyStatusHistory>();
  const byKey = new Map<string, WorkSurveyStatusHistory>();
  const merged: WorkSurveyStatusHistory[] = [];

  const addItem = (item: WorkSurveyStatusHistory) => {
    const enriched = { ...extractMissionChangeFields(item.reason), ...item };
    const compositeKey = `${enriched.action}|${(enriched.actorId || '').toLowerCase().trim()}|${(enriched.createdAt || '').slice(0, 19)}`;
    const existing = byId.get(enriched.id) || byKey.get(compositeKey);
    if (existing) {
      Object.assign(existing, {
        oldMissionCode: existing.oldMissionCode || enriched.oldMissionCode,
        newMissionCode: existing.newMissionCode || enriched.newMissionCode,
        oldWorkCode: existing.oldWorkCode || enriched.oldWorkCode,
        newWorkCode: existing.newWorkCode || enriched.newWorkCode,
        previousVersionNo: existing.previousVersionNo ?? enriched.previousVersionNo,
        currentVersionNo: existing.currentVersionNo ?? enriched.currentVersionNo,
        actorName: existing.actorName || enriched.actorName
      });
      return;
    }
    byId.set(enriched.id, enriched);
    byKey.set(compositeKey, enriched);
    merged.push(enriched);
  };

  for (const item of remoteList || []) addItem(item);
  for (const item of localList || []) addItem(item);

  return merged.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}

export interface MergeRemoteTicketsOptions {
  store: Map<string, StaffWorkTicket>;
  remote: StaffWorkTicket[];
  remoteHistory?: Map<string, WorkSurveyStatusHistory[]> | null;
  unitCode?: string;
  mutatedDuringFetch: boolean;
  unitMutated: boolean;
  startedUnitSeqSnap?: ReadonlyMap<string, number>;
  currentUnitSeqMap?: ReadonlyMap<string, number>;
  startedUnitSyncSnap?: ReadonlyMap<string, number>;
  currentUnitSyncMap?: ReadonlyMap<string, number>;
  deletedTicketIds?: ReadonlySet<string>;
}

/**
 * Chặn nhánh `remote === null` trả im lặng khi PostgreSQL đang được cấu hình, tránh đọc nhầm RAM trống thành 0 phiếu.
 */
export function assertAuthoritativeRemoteTickets(
  remote: StaffWorkTicket[] | null,
  scopeKey: string
): remote is StaffWorkTicket[] {
  if (Array.isArray(remote)) return true;
  const dbActive = !isIsolatedLocalMode() && Boolean((process.env.DATABASE_URL || '').trim());
  if (dbActive) {
    throw Object.assign(
      new Error(`[DB_SYNC_UNAVAILABLE] Đồng bộ phiếu từ PostgreSQL trả về null bất thường cho phạm vi ${scopeKey}.`),
      { status: 503, code: 'DB_SYNC_UNAVAILABLE' }
    );
  }
  return false;
}

/**
 * Hợp nhất an toàn dữ liệu phiếu từ DB vào cache RAM, bảo vệ không để luồng preload ALL chậm hơn ghi đè hoặc xóa nhầm dữ liệu đơn vị mới hơn.
 */
export function mergeRemoteTicketsIntoStore(opts: MergeRemoteTicketsOptions): StaffWorkTicket[] {
  const uc = opts.unitCode ? opts.unitCode.trim().toUpperCase() : undefined;
  const remoteIds = new Set(opts.remote.map((t) => t.id));

  const isUnitTouchedDuringAll = (itemUnitCode: string): boolean => {
    if (uc) return opts.unitMutated;
    const normUc = (itemUnitCode || '').trim().toUpperCase();
    const seqStarted = opts.startedUnitSeqSnap?.get(normUc) || 0;
    const seqNow = opts.currentUnitSeqMap?.get(normUc) || 0;
    const syncStarted = opts.startedUnitSyncSnap?.get(normUc) || 0;
    const syncNow = opts.currentUnitSyncMap?.get(normUc) || 0;
    return seqNow > seqStarted || syncNow > syncStarted;
  };

  for (const [id, existing] of Array.from(opts.store.entries())) {
    if (opts.deletedTicketIds?.has(id)) {
      opts.store.delete(id);
      continue;
    }
    if (uc) {
      if (existing.unitCode.toUpperCase() === uc && !remoteIds.has(id) && !opts.unitMutated) {
        opts.store.delete(id);
      }
    } else if (!remoteIds.has(id) && !opts.mutatedDuringFetch && !isUnitTouchedDuringAll(existing.unitCode)) {
      opts.store.delete(id);
    }
  }

  const out: StaffWorkTicket[] = [];
  const seenIds = new Set<string>();
  for (const t of opts.remote) {
    if (opts.deletedTicketIds?.has(t.id)) continue;
    const existing = opts.store.get(t.id);
    const existingUpdated = existing?.updatedAt || '';
    const remoteUpdated = t.updatedAt || '';
    const mergedRegression = Boolean(existing?.isMergedToB1B2 && !t.isMergedToB1B2 && existingUpdated >= remoteUpdated);
    const existingIsNewer = Boolean(
      existing &&
        (existingUpdated > remoteUpdated ||
          mergedRegression ||
          (!uc && isUnitTouchedDuringAll(t.unitCode) && existingUpdated >= remoteUpdated))
    );
    const nextTicket: StaffWorkTicket =
      existingIsNewer && existing
        ? {
            ...existing,
            statusHistory: mergeTicketStatusHistory(existing.statusHistory, opts.remoteHistory?.get(t.id))
          }
        : {
            ...existing,
            ...t,
            statusHistory: mergeTicketStatusHistory(existing?.statusHistory || t.statusHistory, opts.remoteHistory?.get(t.id))
          };
    opts.store.set(t.id, nextTicket);
    seenIds.add(t.id);
    out.push(nextTicket);
  }

  if (uc && opts.unitMutated) {
    for (const [id, existing] of opts.store.entries()) {
      if (!seenIds.has(id) && !opts.deletedTicketIds?.has(id) && existing.unitCode.toUpperCase() === uc) {
        out.push(existing);
      }
    }
  }
  return out;
}
