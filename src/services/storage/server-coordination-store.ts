import fs from 'fs';
import path from 'path';
import { CoordinatedVtvlEntry, ReplacedWorkCodeRecord, WorkSurveySnapshot, WorkSurveyVersion } from '@/types/staff-ticket';
import { registerCacheInvalidator } from './server-file-lock';
import { isIsolatedLocalMode } from './server-ticket-db';
import { resetVersionMemoryStore } from './server-ticket-version-store';
import { normalizeCoordinatedVtvls } from '@/services/tickets/vtvl-coordination-helpers';
import { isDatabaseConfigured, prisma, toIsoString } from './prisma';
import { writeJsonFileAtomic } from './atomic-json-file';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const PROJECTION_FILE = path.join(DATA_DIR, 'work_survey_coordinated_vtvls.json');
const VERSIONS_FILE = path.join(DATA_DIR, 'work_survey_versions.json');

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
export function resetCoordinationMemoryStore(): void {
  memoryState = null;
  lastVersionSyncAt = 0;
}
registerCacheInvalidator(resetCoordinationMemoryStore);

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
  writeJsonFileAtomic(PROJECTION_FILE, state, true);
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

/** Đồng bộ toàn bộ snapshot phiên bản phiếu từ PostgreSQL qua Prisma. */
export async function syncVersionsCacheFromSupabase(force = false): Promise<void> {
  if (isIsolatedLocalMode() || !isDatabaseConfigured()) return;
  const now = Date.now();
  if (!force && now - lastVersionSyncAt < 3000) return;
  lastVersionSyncAt = now;
  try {
    const rows = await prisma.work_survey_versions.findMany({
      orderBy: { version_no: 'asc' }
    });
    if (!rows.length) return;

    let currentMap: Record<string, WorkSurveyVersion[]> = {};
    try {
      if (fs.existsSync(VERSIONS_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));
        if (parsed && typeof parsed === 'object') currentMap = parsed;
      }
    } catch {
      // ignore corrupted local cache
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

    const merged: Record<string, WorkSurveyVersion[]> = { ...currentMap };
    for (const [surveyId, list] of Object.entries(remoteGrouped)) {
      merged[surveyId] = list.sort((a, b) => a.versionNo - b.versionNo);
    }

    writeJsonFileAtomic(VERSIONS_FILE, merged, true);
    resetVersionMemoryStore();
  } catch {
    // ignore transient DB fallback
  }
}
