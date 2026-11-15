import fs from 'fs';
import path from 'path';
import {
  StaffWorkTicket,
  WorkSurveyMergeLink,
  WorkSurveySnapshot,
  WorkSurveyVersion
} from '@/types/staff-ticket';
import { buildTicketSnapshot } from '@/services/tickets/ticket-diff-engine';
import { registerCacheInvalidator, withCrossProcessLock } from './server-file-lock';
import { isIsolatedLocalMode } from './server-ticket-db';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const VERSIONS_FILE = path.join(DATA_DIR, 'work_survey_versions.json');
const MERGE_LINKS_FILE = path.join(DATA_DIR, 'work_survey_merge_links.json');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

let memoryVersions: Record<string, WorkSurveyVersion[]> | null = null;
let memoryMergeLinks: Record<string, WorkSurveyMergeLink[]> | null = null;
export function resetVersionMemoryStore(): void { memoryVersions = null; memoryMergeLinks = null; }
registerCacheInvalidator(resetVersionMemoryStore);

const recentSubmissionDigest = new Map<string, { version: WorkSurveyVersion; timestamp: number }>();

function getSupabaseHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

function loadLocalVersions(): Record<string, WorkSurveyVersion[]> {
  if (memoryVersions) return memoryVersions;
  try {
    if (fs.existsSync(VERSIONS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        memoryVersions = parsed;
        return memoryVersions!;
      }
    }
  } catch {
    // ignore
  }
  memoryVersions = {};
  return memoryVersions;
}

function persistLocalVersions(): void {
  if (!memoryVersions) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(VERSIONS_FILE, JSON.stringify(memoryVersions, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

function loadLocalMergeLinks(): Record<string, WorkSurveyMergeLink[]> {
  if (memoryMergeLinks) return memoryMergeLinks;
  try {
    if (fs.existsSync(MERGE_LINKS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(MERGE_LINKS_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        memoryMergeLinks = parsed;
        return memoryMergeLinks!;
      }
    }
  } catch {
    // ignore
  }
  memoryMergeLinks = {};
  return memoryMergeLinks;
}

function persistLocalMergeLinks(): void {
  if (!memoryMergeLinks) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MERGE_LINKS_FILE, JSON.stringify(memoryMergeLinks, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

export async function withSurveySubmissionLock<T>(surveyId: string, fn: () => Promise<T>): Promise<T> {
  return withCrossProcessLock(`survey_${surveyId}`, fn);
}

export function getTicketVersions(surveyId: string): WorkSurveyVersion[] {
  const store = loadLocalVersions();
  const list = store[surveyId] || [];
  return [...list].sort((a, b) => a.versionNo - b.versionNo);
}

export function ensureLegacyBaselineVersion(ticket: StaffWorkTicket): WorkSurveyVersion[] {
  const existing = getTicketVersions(ticket.id);
  if (existing.length > 0 || ticket.status === 'Nháp' || ticket.status === 'draft') return existing;
  const store = loadLocalVersions();
  const baseline: WorkSurveyVersion = {
    id: `ver-${ticket.id}-v1-baseline`,
    surveyId: ticket.id,
    versionNo: 1,
    snapshot: buildTicketSnapshot(ticket),
    submittedBy: ticket.submittedAt ? (ticket.ownerEmail || '').toLowerCase().trim() : '',
    submittedAt: ticket.submittedAt || null,
    changeSummary: 'Bản ghi chuyển đổi dữ liệu',
    isMigrationBaseline: true
  };
  store[ticket.id] = [baseline];
  persistLocalVersions();
  return [baseline];
}

export async function fetchTicketVersionsFromSupabase(surveyId: string): Promise<WorkSurveyVersion[]> {
  const localList = getTicketVersions(surveyId);
  if (isIsolatedLocalMode() || !SUPABASE_URL || !SERVICE_KEY) return localList;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/work_survey_versions?survey_id=eq.${encodeURIComponent(surveyId)}&order=version_no.asc`,
      { headers: getSupabaseHeaders(), cache: 'no-store' }
    );
    if (!res.ok) return localList;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return localList;
    const mapped: WorkSurveyVersion[] = rows.map((r: Record<string, unknown>) => ({
      id: String(r.id || `ver-${surveyId}-${r.version_no}`),
      surveyId: String(r.survey_id || surveyId),
      versionNo: Number(r.version_no) || 1,
      snapshot: (r.snapshot as WorkSurveySnapshot) || ({} as WorkSurveySnapshot),
      submittedBy: String(r.submitted_by || ''),
      submittedAt: r.submitted_at ? String(r.submitted_at) : null,
      changeSummary: r.change_summary ? String(r.change_summary) : undefined,
      isMigrationBaseline: Boolean(r.is_migration_baseline)
    }));
    const store = loadLocalVersions();
    store[surveyId] = mapped;
    persistLocalVersions();
    return mapped;
  } catch {
    return localList;
  }
}

export interface CreateVersionInput {
  surveyId: string;
  ticket: Partial<StaffWorkTicket>;
  submittedBy: string;
  submittedAt: string;
  changeSummary?: string;
  simulateFailure?: boolean;
}

export async function createImmutableSurveyVersion(input: CreateVersionInput): Promise<WorkSurveyVersion> {
  if (input.simulateFailure) {
    const err = new Error('[VERSION_SNAPSHOT_FAILED] Không thể ghi snapshot lịch sử phiên bản phiếu.');
    (err as unknown as { code: string; status: number }).code = 'VERSION_SNAPSHOT_FAILED';
    (err as unknown as { status: number }).status = 500;
    throw err;
  }

  const snapshot = buildTicketSnapshot(input.ticket);
  const digestKey = `${input.surveyId}:${input.submittedBy}:${JSON.stringify(snapshot)}:${input.changeSummary || ''}`;
  const recent = recentSubmissionDigest.get(digestKey);
  if (recent && Date.now() - recent.timestamp < 5000) {
    return recent.version;
  }

  const store = loadLocalVersions();
  const existing = store[input.surveyId] ? [...store[input.surveyId]] : [];
  const nextVersionNo = existing.reduce((max, v) => Math.max(max, v.versionNo), 0) + 1;

  // Chặn ghi đè nếu version_no đã tồn tại
  if (existing.some((v) => v.versionNo === nextVersionNo)) {
    throw new Error(`[DUPLICATE_VERSION] Phiên bản v${nextVersionNo} của phiếu ${input.surveyId} đã tồn tại.`);
  }

  const newVersion: WorkSurveyVersion = {
    id: `ver-${input.surveyId}-v${nextVersionNo}-${Date.now()}`,
    surveyId: input.surveyId,
    versionNo: nextVersionNo,
    snapshot,
    submittedBy: input.submittedBy.toLowerCase().trim(),
    submittedAt: input.submittedAt,
    changeSummary: input.changeSummary?.trim() || undefined,
    isMigrationBaseline: false
  };

  if (!isIsolatedLocalMode() && SUPABASE_URL && SERVICE_KEY) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/work_survey_versions`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        survey_id: newVersion.surveyId,
        version_no: newVersion.versionNo,
        snapshot: newVersion.snapshot,
        submitted_by: newVersion.submittedBy,
        submitted_at: newVersion.submittedAt,
        change_summary: newVersion.changeSummary || null,
        is_migration_baseline: false
      })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      // Ở production: bắt buộc bảng work_survey_versions phải tồn tại và ghi thành công
      if (process.env.NODE_ENV === 'production') {
        const isSchemaErr = errText.includes('PGRST204') || errText.includes('42P01') || errText.includes('work_survey_versions');
        const err = new Error(
          isSchemaErr
            ? `[DATABASE_SCHEMA_OUTDATED] Thiếu bảng hoặc cột work_survey_versions trên Supabase: ${errText}`
            : `[DB_VERSION_WRITE_FAILED] Lỗi ghi phiên bản phiếu (${res.status}): ${errText}`
        );
        (err as unknown as { code: string; status: number }).code = isSchemaErr ? 'DATABASE_SCHEMA_OUTDATED' : 'DB_VERSION_WRITE_FAILED';
        (err as unknown as { status: number }).status = 500;
        throw err;
      }
    }
  }

  existing.push(newVersion);
  store[input.surveyId] = existing;
  persistLocalVersions();
  recentSubmissionDigest.set(digestKey, { version: newVersion, timestamp: Date.now() });
  return newVersion;
}

/**
 * Hoàn tác phiên bản vừa tạo trong bộ nhớ khi giao dịch nộp phiếu bị lỗi giữa chừng (Compensation Rollback).
 */
export function compensateRemoveSurveyVersion(surveyId: string, versionNo: number): void {
  const store = loadLocalVersions();
  if (!store[surveyId]) return;
  store[surveyId] = store[surveyId].filter((v) => v.versionNo !== versionNo);
  persistLocalVersions();
}

export function getTicketMergeLinks(surveyId: string): WorkSurveyMergeLink[] {
  const store = loadLocalMergeLinks();
  return store[surveyId] ? [...store[surveyId]] : [];
}

export async function recordIdempotentMergeLinks(
  surveyId: string,
  links: { targetSheet: 'A2' | 'B1' | 'B2'; targetRecordId: string; sourceVersion: number; mergedBy: string }[]
): Promise<WorkSurveyMergeLink[]> {
  const store = loadLocalMergeLinks();
  const current = store[surveyId] ? [...store[surveyId]] : [];
  const now = new Date().toISOString();

  for (const item of links) {
    const idx = current.findIndex(
      (l) => l.surveyId === surveyId && l.targetSheet === item.targetSheet && l.targetRecordId === item.targetRecordId
    );
    if (idx >= 0) {
      current[idx] = {
        ...current[idx],
        sourceVersion: item.sourceVersion,
        mergedBy: item.mergedBy,
        updatedAt: now
      };
    } else {
      current.push({
        id: `ml-${surveyId}-${item.targetSheet}-${item.targetRecordId}`,
        surveyId,
        targetSheet: item.targetSheet,
        targetRecordId: item.targetRecordId,
        sourceVersion: item.sourceVersion,
        mergedBy: item.mergedBy,
        mergedAt: now,
        updatedAt: now
      });
    }
  }

  if (!isIsolatedLocalMode() && SUPABASE_URL && SERVICE_KEY && links.length > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/work_survey_merge_links?on_conflict=survey_id,target_sheet,target_record_id`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(
        links.map((item) => ({
          survey_id: surveyId,
          target_sheet: item.targetSheet,
          target_record_id: item.targetRecordId,
          source_version: item.sourceVersion,
          merged_by: item.mergedBy,
          merged_at: now,
          updated_at: now
        }))
      )
    }).catch(() => {});
  }

  store[surveyId] = current;
  persistLocalMergeLinks();
  return current;
}
