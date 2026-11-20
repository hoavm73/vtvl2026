import fs from 'fs';
import path from 'path';
import { CoordinatedVtvlEntry, ReplacedWorkCodeRecord, StaffWorkTicket, toCanonicalStatus, WorkSurveySnapshot, WorkSurveyVersion } from '@/types/staff-ticket';
import { registerCacheInvalidator } from './server-file-lock';
import { DbTicketRow, isIsolatedLocalMode, mapDbRowToTicket } from './server-ticket-db';
import { getGlobalTicketMutationSeq, loadTickets, syncTicketsFromSupabase } from './server-ticket-store';
import { getTicketVersions, hasStoredTicketVersions, mergeSurveyVersionsIntoMemory } from './server-ticket-version-store';
import { normalizeCoordinatedVtvls } from '@/services/tickets/vtvl-coordination-helpers';
import { getDbTestHook, isDatabaseConfigured, pgQuery, prisma, toIsoString } from './prisma';
import { writeJsonFileAtomic } from './atomic-json-file';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const PROJECTION_FILE = path.join(DATA_DIR, 'work_survey_coordinated_vtvls.json');

export interface SubmittedCoordinatedVtvlRow {
  id: string;
  surveyId: string;
  versionNo: number;
  taskRowId: string;
  hostUnitCode: string;
  targetUnitCode: string;
  targetVtvlCode: string;
  targetVtvlName?: string;
  coordinationNote?: string;
  isLatestSubmitted: boolean;
  createdAt: string;
}

export interface CoordinationDiskState {
  draftExtrasBySurvey: Record<string, { coordinatedVtvls?: CoordinatedVtvlEntry[]; coordinationNote?: string }>;
  submittedRowsBySurvey: Record<string, SubmittedCoordinatedVtvlRow[]>;
  replacedCodesBySurvey: Record<string, ReplacedWorkCodeRecord[]>;
}

let memoryState: CoordinationDiskState | null = null;
let lastVersionSyncAt = 0;
let inFlightVersionSync: Promise<void> | null = null;
let lastCoordTicketSyncAt = 0;
let inFlightCoordTicketSync: Promise<void> | null = null;
let coordCandidatesCache: { seq: number; verSyncAt: number; coordSyncAt: number; tickets: StaffWorkTicket[] } | null = null;
export function resetCoordinationMemoryStore(): void {
  memoryState = null; lastVersionSyncAt = 0; inFlightVersionSync = null;
  lastCoordTicketSyncAt = 0; inFlightCoordTicketSync = null; coordCandidatesCache = null;
}
registerCacheInvalidator((lockKey?: string) => {
  if (!lockKey || !isDatabaseConfigured()) resetCoordinationMemoryStore();
});

export function loadCoordinationState(): CoordinationDiskState {
  if (memoryState) return memoryState;
  try {
    if (fs.existsSync(PROJECTION_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PROJECTION_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        memoryState = {
          draftExtrasBySurvey: parsed.draftExtrasBySurvey || {},
          submittedRowsBySurvey: parsed.submittedRowsBySurvey || {},
          replacedCodesBySurvey: parsed.replacedCodesBySurvey || {}
        };
        return memoryState;
      }
    }
  } catch {
    // ignore corrupted local cache
  }
  memoryState = { draftExtrasBySurvey: {}, submittedRowsBySurvey: {}, replacedCodesBySurvey: {} };
  return memoryState;
}

export function persistCoordinationState(state: CoordinationDiskState): void {
  memoryState = state;
  coordCandidatesCache = null;
  writeJsonFileAtomic(PROJECTION_FILE, state, true);
}

export function getCoordinatedCandidateTickets(): StaffWorkTicket[] {
  const seq = getGlobalTicketMutationSeq();
  if (!isIsolatedLocalMode() && coordCandidatesCache && coordCandidatesCache.seq === seq && coordCandidatesCache.verSyncAt === lastVersionSyncAt && coordCandidatesCache.coordSyncAt === lastCoordTicketSyncAt) {
    return coordCandidatesCache.tickets;
  }
  const candidates: StaffWorkTicket[] = [];
  for (const ticket of loadTickets().values()) {
    if (ticket.isTestData || ticket.isArchived || toCanonicalStatus(ticket.status) === 'draft') continue;
    const vers = hasStoredTicketVersions(ticket.id) ? getTicketVersions(ticket.id) : null;
    const latestSnap = vers && vers.length > 0 ? vers[vers.length - 1].snapshot : null;
    const hasCoord = Boolean(
      ticket.maVtvlPhoiHop?.trim() ||
      ticket.coordinatedVtvls?.length ||
      latestSnap?.maVtvlPhoiHop?.trim() ||
      latestSnap?.coordinatedVtvls?.length
    );
    if (hasCoord) candidates.push(ticket);
  }
  if (!isIsolatedLocalMode()) {
    coordCandidatesCache = { seq, verSyncAt: lastVersionSyncAt, coordSyncAt: lastCoordTicketSyncAt, tickets: candidates };
  }
  return candidates;
}

export function recordReplacedWorkCode(entry: Omit<ReplacedWorkCodeRecord, 'id'>): ReplacedWorkCodeRecord {
  const state = loadCoordinationState();
  const list = state.replacedCodesBySurvey[entry.surveyId] ? [...state.replacedCodesBySurvey[entry.surveyId]] : [];
  const item: ReplacedWorkCodeRecord = {
    ...entry,
    id: `rwc-${entry.surveyId}-${entry.oldWorkCode}-${entry.newWorkCode}-${Date.now()}`
  };
  list.push(item);
  state.replacedCodesBySurvey[entry.surveyId] = list;
  persistCoordinationState(state);
  return item;
}

export function compensateRemoveReplacedWorkCode(surveyId: string, recordId: string): void {
  const state = loadCoordinationState();
  const list = state.replacedCodesBySurvey[surveyId];
  if (!list) return;
  state.replacedCodesBySurvey[surveyId] = list.filter((r) => r.id !== recordId);
  persistCoordinationState(state);
}

export function getReplacedWorkCodesForSurvey(surveyId: string): ReplacedWorkCodeRecord[] {
  return [...(loadCoordinationState().replacedCodesBySurvey[surveyId] || [])];
}

export function getAllReplacedWorkCodes(unitCode?: string): ReplacedWorkCodeRecord[] {
  const state = loadCoordinationState();
  const uc = unitCode ? unitCode.trim().toUpperCase() : '';
  const all: ReplacedWorkCodeRecord[] = [];
  for (const list of Object.values(state.replacedCodesBySurvey)) {
    for (const r of list) {
      if (!uc || r.unitCode.toUpperCase() === uc) all.push(r);
    }
  }
  return all;
}

export function saveDraftCoordinationExtras(
  surveyId: string,
  coordinatedVtvls?: CoordinatedVtvlEntry[],
  coordinationNote?: string
): void {
  if (!surveyId) return;
  const state = loadCoordinationState();
  const cleanList = normalizeCoordinatedVtvls(coordinatedVtvls);
  const cleanNote = String(coordinationNote || '').trim() || undefined;
  if (cleanList.length === 0 && !cleanNote) {
    delete state.draftExtrasBySurvey[surveyId];
  } else {
    state.draftExtrasBySurvey[surveyId] = { coordinatedVtvls: cleanList, coordinationNote: cleanNote };
  }
  persistCoordinationState(state);
}

export function getDraftCoordinationExtras(surveyId: string): {
  coordinatedVtvls?: CoordinatedVtvlEntry[];
  coordinationNote?: string;
} {
  return loadCoordinationState().draftExtrasBySurvey[surveyId] || {};
}

export function removeCoordinationDataForSurvey(surveyId: string): void {
  const state = loadCoordinationState();
  delete state.draftExtrasBySurvey[surveyId];
  delete state.submittedRowsBySurvey[surveyId];
  persistCoordinationState(state);
}

/** Đồng bộ snapshot phiên bản phiếu từ PostgreSQL (ưu tiên phạm vi phiếu có phối hợp để tránh full-scan). */
export async function syncVersionsCacheFromSupabase(force = false): Promise<void> {
  if (isIsolatedLocalMode() || !isDatabaseConfigured()) return;
  if (!force && lastVersionSyncAt > 0 && Date.now() - lastVersionSyncAt < 3000) return;
  if (inFlightVersionSync && !force) return inFlightVersionSync;

  const run = (async () => {
    try {
      const rows = !force && !getDbTestHook()
        ? (
            await pgQuery<{
              id: string; survey_id: string; version_no: number; snapshot: unknown;
              submitted_by: string; submitted_at: Date | string | null; change_summary: string | null; is_migration_baseline: boolean;
            }>(
              `SELECT id, survey_id, version_no, snapshot, submitted_by, submitted_at, change_summary, is_migration_baseline
               FROM public.work_survey_versions
               WHERE survey_id IN (
                 SELECT survey_id FROM public.work_survey_coordinated_vtvls
                 UNION
                 SELECT id FROM public.staff_work_tickets
                 WHERE COALESCE(ma_vtvl_phoi_hop, '') <> '' OR jsonb_array_length(COALESCE(coordinated_vtvls, '[]'::jsonb)) > 0
               )
               ORDER BY version_no ASC`
            )
          ).rows
        : await prisma.work_survey_versions.findMany({ orderBy: { version_no: 'asc' } });

      if (!rows.length) {
        lastVersionSyncAt = Date.now();
        return;
      }

      const remoteGrouped: Record<string, WorkSurveyVersion[]> = {};
      for (const r of rows) {
        const surveyId = String(r.survey_id || '').trim();
        if (!surveyId) continue;
        if (!remoteGrouped[surveyId]) remoteGrouped[surveyId] = [];
        remoteGrouped[surveyId].push({
          id: String(r.id || `ver-${surveyId}-${r.version_no}`),
          surveyId,
          versionNo: Number(r.version_no) || 1,
          snapshot: (r.snapshot as unknown as WorkSurveySnapshot) || ({} as WorkSurveySnapshot),
          submittedBy: String(r.submitted_by || ''),
          submittedAt: toIsoString(r.submitted_at) || null,
          changeSummary: r.change_summary ? String(r.change_summary) : undefined,
          isMigrationBaseline: Boolean(r.is_migration_baseline)
        });
      }
      for (const list of Object.values(remoteGrouped)) {
        list.sort((a, b) => a.versionNo - b.versionNo);
      }

      mergeSurveyVersionsIntoMemory(remoteGrouped);
      lastVersionSyncAt = Date.now();
    } catch {
      // ignore transient DB fallback
    }
  })();

  inFlightVersionSync = run;
  try {
    await run;
  } finally {
    if (inFlightVersionSync === run) inFlightVersionSync = null;
  }
}

/** Đồng bộ có mục tiêu các phiếu có phối hợp (nguồn + đích) tránh tải toàn bộ 20.000+ phiếu. */
export async function syncCoordinationTicketsFromSupabase(force = false): Promise<void> {
  if (isIsolatedLocalMode() || !isDatabaseConfigured()) return;
  if (getDbTestHook()) { await syncTicketsFromSupabase(undefined, force); return; }
  if (!force && lastCoordTicketSyncAt > 0 && Date.now() - lastCoordTicketSyncAt < 3000) return;
  if (inFlightCoordTicketSync && !force) return inFlightCoordTicketSync;

  const run = (async () => {
    try {
      const res = await pgQuery<DbTicketRow>(
        `SELECT * FROM public.staff_work_tickets
         WHERE is_archived = false AND is_test_data = false AND (
           COALESCE(ma_vtvl_phoi_hop, '') <> ''
           OR jsonb_array_length(COALESCE(coordinated_vtvls, '[]'::jsonb)) > 0
           OR (unit_code, ma_vtvl) IN (SELECT target_unit_code, target_vtvl_code FROM public.work_survey_coordinated_vtvls)
         )
         ORDER BY updated_at DESC`
      );
      const store = loadTickets();
      for (const r of res.rows) {
        const mapped = mapDbRowToTicket(r);
        const existing = store.get(mapped.id);
        store.set(mapped.id, { ...existing, ...mapped, statusHistory: existing?.statusHistory || mapped.statusHistory });
      }
      lastCoordTicketSyncAt = Date.now();
    } catch { /* fallback safely */ }
  })().finally(() => { if (inFlightCoordTicketSync === run) inFlightCoordTicketSync = null; });

  inFlightCoordTicketSync = run;
  await run;
}
