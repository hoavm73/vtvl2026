import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import {
  StaffWorkTicket,
  WorkSurveyMergeLink,
  WorkSurveySnapshot,
  WorkSurveyVersion
} from '@/types/staff-ticket';
import { buildTicketSnapshot } from '@/services/tickets/ticket-diff-engine';
import { registerCacheInvalidator, withCrossProcessLock } from './server-file-lock';
import { isIsolatedLocalMode } from './server-ticket-db';
import { isDatabaseConfigured, prisma, toIsoString } from './prisma';
import { pgUpsertRows } from './postgres-rest-compat';

const DATA_DIR = process.env.VERCEL ? '/tmp/vtvl_data' : path.join(process.cwd(), '.data');
const VERSIONS_FILE = path.join(DATA_DIR, 'work_survey_versions.json');
const MERGE_LINKS_FILE = path.join(DATA_DIR, 'work_survey_merge_links.json');

let memoryVersions: Record<string, WorkSurveyVersion[]> | null = null;
let memoryMergeLinks: Record<string, WorkSurveyMergeLink[]> | null = null;
export function resetVersionMemoryStore(): void { memoryVersions = null; memoryMergeLinks = null; }
registerCacheInvalidator(resetVersionMemoryStore);

const recentSubmissionDigest = new Map<string, { version: WorkSurveyVersion; timestamp: number }>();

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
  } catch { /* ignore */ }
  memoryVersions = {};
  return memoryVersions;
}

function persistLocalVersions(): void {
  if (!memoryVersions) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(VERSIONS_FILE, JSON.stringify(memoryVersions, null, 2), 'utf8');
  } catch { /* ignore */ }
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
  } catch { /* ignore */ }
  memoryMergeLinks = {};
  return memoryMergeLinks;
}

function persistLocalMergeLinks(): void {
  if (!memoryMergeLinks) return;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(MERGE_LINKS_FILE, JSON.stringify(memoryMergeLinks, null, 2), 'utf8');
  } catch { /* ignore */ }
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
  if (isIsolatedLocalMode() || !isDatabaseConfigured()) return localList;
  try {
    const rows = await prisma.work_survey_versions.findMany({
      where: { survey_id: surveyId },
      orderBy: { version_no: 'asc' }
    });
    if (!rows.length) return localList;
    const mapped: WorkSurveyVersion[] = rows.map((r) => ({
      id: String(r.id || `ver-${surveyId}-${r.version_no}`),
      surveyId: String(r.survey_id || surveyId),
      versionNo: Number(r.version_no) || 1,
      snapshot: (r.snapshot as unknown as WorkSurveySnapshot) || ({} as WorkSurveySnapshot),
      submittedBy: String(r.submitted_by || ''),
      submittedAt: toIsoString(r.submitted_at) || null,
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

  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    try {
      await prisma.work_survey_versions.create({
        data: {
          survey_id: newVersion.surveyId,
          version_no: newVersion.versionNo,
          snapshot: newVersion.snapshot as unknown as Prisma.InputJsonValue,
          submitted_by: newVersion.submittedBy,
          submitted_at: newVersion.submittedAt ? new Date(newVersion.submittedAt) : new Date(),
          change_summary: newVersion.changeSummary || null,
          is_migration_baseline: false
        }
      });
    } catch (e) {
      const errText = e instanceof Error ? e.message : String(e);
      if (process.env.NODE_ENV === 'production') {
        const isSchemaErr = errText.includes('42P01') || errText.includes('work_survey_versions');
        const err = new Error(
          isSchemaErr
            ? `[DATABASE_SCHEMA_OUTDATED] Thiếu bảng hoặc cột work_survey_versions trên PostgreSQL: ${errText}`
            : `[DB_VERSION_WRITE_FAILED] Lỗi ghi phiên bản phiếu: ${errText}`
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

export function clearLocalMergeLinks(surveyId: string): void {
  const store = loadLocalMergeLinks();
  if (store[surveyId]) { delete store[surveyId]; persistLocalMergeLinks(); }
}

export async function recordIdempotentMergeLinks(
  surveyId: string,
  links: { targetSheet: 'A2' | 'B1' | 'B2'; targetRecordId: string; sourceVersion: number; mergedBy: string }[]
): Promise<WorkSurveyMergeLink[]> {
  const store = loadLocalMergeLinks();
  const current = store[surveyId] ? [...store[surveyId]] : [];
  const now = new Date().toISOString();

  for (const item of links) {
    const idx = current.findIndex((l) => l.surveyId === surveyId && l.targetSheet === item.targetSheet && l.targetRecordId === item.targetRecordId);
    if (idx >= 0) current[idx] = { ...current[idx], sourceVersion: item.sourceVersion, mergedBy: item.mergedBy, updatedAt: now };
    else {
      current.push({
        id: `ml-${surveyId}-${item.targetSheet}-${item.targetRecordId}`,
        surveyId, targetSheet: item.targetSheet, targetRecordId: item.targetRecordId,
        sourceVersion: item.sourceVersion, mergedBy: item.mergedBy, mergedAt: now, updatedAt: now
      });
    }
  }

  if (!isIsolatedLocalMode() && isDatabaseConfigured() && links.length > 0) {
    await pgUpsertRows(
      'work_survey_merge_links',
      links.map((item) => ({
        survey_id: surveyId,
        target_sheet: item.targetSheet,
        target_record_id: item.targetRecordId,
        source_version: item.sourceVersion,
        merged_by: item.mergedBy,
        merged_at: now,
        updated_at: now
      })),
      'survey_id,target_sheet,target_record_id'
    ).catch(() => {});
  }

  store[surveyId] = current;
  persistLocalMergeLinks();
  return current;
}
