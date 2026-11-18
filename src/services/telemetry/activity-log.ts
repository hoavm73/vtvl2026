import { HCMUTE_UNITS, findHcmuteUnit } from '@/configs/hcmute-units';
import { getCurrentOperatorSession } from './operator-session';
import { buildDefaultProposedPositionsForUnit } from '@/configs/hcmute-nd232-catalog';
import { HcmuteUnit, NgachAllocationRow, ProposedVtvlRow, TimeSessionRow, UnitGroupKind, UnitScaleMetrics } from '@/types/vtvl';
import { syncActivityToSupabase } from '@/services/storage/vtvl-sync';

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  unitCode: string;
  unitName: string;
  actorEmail?: string;
  actorTitle?: string;
  action: 'TAO_TEP' | 'NAP_PHIEU' | 'BAM_GIO' | 'RA_SOAT' | 'CHON_DON_VI' | 'LUU_NHAP';
  details: string;
}

export interface ActiveUnitSession {
  unitCode: string;
  kind: UnitGroupKind;
  customDate: string;
  actorEmail: string;
  actorTitle: string;
  activeStep: number;
  wizardStage: 1 | 2 | 3 | 4 | 5;
  lastSavedAt: string;
  scaleMetrics?: UnitScaleMetrics;
  ngachAllocations?: NgachAllocationRow[];
  ngachOverrides: Record<string, number>;
  customPositionNames: Record<string, string>;
  customCareerLevels: Record<string, string>;
  proposedPositions: ProposedVtvlRow[];
  previousPositionsSnapshot?: ProposedVtvlRow[];
  timeSessions?: TimeSessionRow[];
  lastExportedFileName?: string;
  lastMergedFileName?: string;
  lastMergedVersion?: number;
  lastAuditFixCount?: number;
}

const STORAGE_KEY = 'hcmute_vtvl_activity_logs_v1';
const UNIT_SESSION_KEY = 'hcmute_vtvl_active_unit_session_v2';

let cachedUnitCode = '';
let cachedRootWorkbookFile: File | null = null;
let cachedMergedWorkbookFile: File | null = null;
let cachedSurveyFormFiles: File[] = [];

export function formatCurrentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

export function getRealtimeDateYYYYMMDD(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function notifyRealtimeSessionChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('vtvl-unit-session-updated'));
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('hcmute_vtvl_realtime');
      bc.postMessage({ type: 'SESSION_UPDATED', ts: Date.now() });
      bc.close();
    }
  } catch { /* ignore */ }
}

export function buildDefaultScaleMetrics(group: UnitGroupKind): UnitScaleMetrics {
  if (group === 'khoa-vien') {
    return { studentCount: 1850, programCount: 4, courseSectionCount: 240, labWorkshopCount: 8, researchTopicCount: 15, adminDocCount: 420, scaleMultiplier: 1.0 };
  }
  return { studentCount: 0, programCount: 0, courseSectionCount: 0, labWorkshopCount: 2, researchTopicCount: 4, adminDocCount: 1200, scaleMultiplier: 1.0 };
}

export function buildDefaultNgachAllocations(positions: ProposedVtvlRow[]): NgachAllocationRow[] {
  return positions.map((p, idx) => ({
    id: `ngach-row-${idx + 1}`,
    ngachCode: p.ngachCode,
    ngachName: `${p.frameworkTitle} (${p.careerLevel})`,
    count: p.staffCount,
    targetPositionId: p.id,
    isSplitRow: false
  }));
}

function createDefaultSession(unit: HcmuteUnit = HCMUTE_UNITS[0]): ActiveUnitSession {
  const proposedPositions = buildDefaultProposedPositionsForUnit(unit.nameVi, unit.group);
  return {
    unitCode: unit.code,
    kind: unit.group,
    customDate: getRealtimeDateYYYYMMDD(),
    actorEmail: '',
    actorTitle: '',
    activeStep: 1,
    wizardStage: 1,
    lastSavedAt: formatCurrentHHMM(),
    scaleMetrics: buildDefaultScaleMetrics(unit.group),
    ngachAllocations: buildDefaultNgachAllocations(proposedPositions),
    ngachOverrides: {},
    customPositionNames: {},
    customCareerLevels: {},
    proposedPositions,
    timeSessions: []
  };
}

export function getActiveUnitSession(): ActiveUnitSession {
  if (typeof window === 'undefined') return createDefaultSession();
  try {
    const op = getCurrentOperatorSession();
    const raw = window.localStorage.getItem(UNIT_SESSION_KEY);
    if (!raw) {
      const def = createDefaultSession();
      if (op) {
        def.actorEmail = op.email;
        def.actorTitle = op.title;
        if (op.unitCode) { def.unitCode = op.unitCode; def.kind = findHcmuteUnit(op.unitCode).group; }
      }
      return def;
    }
    const parsed = JSON.parse(raw) as Partial<ActiveUnitSession>;
    const isTcns = op?.email === 'tcns@hcmute.edu.vn';
    const isSameActor = Boolean(op?.email && parsed.actorEmail && parsed.actorEmail.toLowerCase() === op.email.toLowerCase());
    const targetCode = isTcns ? 'TCNS' : ((isSameActor ? parsed.unitCode : op?.unitCode) || op?.unitCode || parsed.unitCode || 'TCNS');
    const unit = findHcmuteUnit(targetCode);
    const proposed =
      Array.isArray(parsed.proposedPositions) && parsed.proposedPositions.length > 0
        ? parsed.proposedPositions : buildDefaultProposedPositionsForUnit(unit.nameVi, unit.group);
    const stage = ([1, 2, 3, 4, 5] as const).includes(parsed.wizardStage as 1 | 2 | 3 | 4 | 5)
      ? (parsed.wizardStage as 1 | 2 | 3 | 4 | 5) : 1;
    return {
      unitCode: unit.code,
      kind: unit.group,
      customDate: parsed.customDate || getRealtimeDateYYYYMMDD(),
      actorEmail: parsed.actorEmail || op?.email || '',
      actorTitle: parsed.actorTitle || op?.title || '',
      activeStep: parsed.activeStep || 1,
      wizardStage: stage,
      lastSavedAt: parsed.lastSavedAt || formatCurrentHHMM(),
      scaleMetrics: parsed.scaleMetrics || buildDefaultScaleMetrics(unit.group),
      ngachAllocations: Array.isArray(parsed.ngachAllocations) && parsed.ngachAllocations.length > 0 ? parsed.ngachAllocations : buildDefaultNgachAllocations(proposed),
      ngachOverrides: parsed.ngachOverrides || {}, customPositionNames: parsed.customPositionNames || {}, customCareerLevels: parsed.customCareerLevels || {},
      proposedPositions: proposed, previousPositionsSnapshot: parsed.previousPositionsSnapshot,
      timeSessions: Array.isArray(parsed.timeSessions) ? parsed.timeSessions : [],
      lastExportedFileName: parsed.lastExportedFileName, lastMergedFileName: parsed.lastMergedFileName,
      lastMergedVersion: parsed.lastMergedVersion, lastAuditFixCount: parsed.lastAuditFixCount
    };
  } catch {
    return createDefaultSession();
  }
}

export function getActiveUnitDefinition(codeOverride?: string): HcmuteUnit {
  const op = typeof window !== 'undefined' ? getCurrentOperatorSession() : null;
  const session = getActiveUnitSession();
  const targetCode = codeOverride || session.unitCode || op?.unitCode;
  return findHcmuteUnit(targetCode);
}

export function saveActiveUnitSession(partial: Partial<ActiveUnitSession>): ActiveUnitSession {
  const current = getActiveUnitSession();
  const nextUnitCode = partial.unitCode ?? current.unitCode;
  const matchedUnit = findHcmuteUnit(nextUnitCode);
  const isSameUnit = matchedUnit.code === current.unitCode;
  const nextPositions =
    partial.proposedPositions ??
    (isSameUnit ? current.proposedPositions : buildDefaultProposedPositionsForUnit(matchedUnit.nameVi, matchedUnit.group));

  const updated: ActiveUnitSession = {
    unitCode: matchedUnit.code,
    kind: matchedUnit.group,
    customDate: partial.customDate ?? current.customDate,
    actorEmail: partial.actorEmail ?? current.actorEmail,
    actorTitle: partial.actorTitle ?? current.actorTitle,
    activeStep: partial.activeStep ?? current.activeStep,
    wizardStage: partial.wizardStage ?? current.wizardStage,
    lastSavedAt: formatCurrentHHMM(),
    scaleMetrics: partial.scaleMetrics ?? (isSameUnit ? current.scaleMetrics : buildDefaultScaleMetrics(matchedUnit.group)),
    ngachAllocations: partial.ngachAllocations ?? (isSameUnit ? current.ngachAllocations : buildDefaultNgachAllocations(nextPositions)),
    ngachOverrides: partial.ngachOverrides ?? (isSameUnit ? current.ngachOverrides : {}),
    customPositionNames: partial.customPositionNames ?? (isSameUnit ? current.customPositionNames : {}),
    customCareerLevels: partial.customCareerLevels ?? (isSameUnit ? current.customCareerLevels : {}),
    proposedPositions: nextPositions, previousPositionsSnapshot: partial.previousPositionsSnapshot !== undefined ? partial.previousPositionsSnapshot : current.previousPositionsSnapshot,
    timeSessions: partial.timeSessions ?? (isSameUnit ? current.timeSessions : []),
    lastExportedFileName: partial.lastExportedFileName ?? (isSameUnit ? current.lastExportedFileName : undefined),
    lastMergedFileName: partial.lastMergedFileName ?? (isSameUnit ? current.lastMergedFileName : undefined),
    lastMergedVersion: partial.lastMergedVersion ?? (isSameUnit ? current.lastMergedVersion : undefined),
    lastAuditFixCount: partial.lastAuditFixCount ?? (isSameUnit ? current.lastAuditFixCount : undefined)
  };

  if (!isSameUnit && cachedUnitCode && cachedUnitCode !== matchedUnit.code) {
    cachedRootWorkbookFile = null; cachedMergedWorkbookFile = null; cachedSurveyFormFiles = [];
  }
  cachedUnitCode = matchedUnit.code;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(UNIT_SESSION_KEY, JSON.stringify(updated));
      notifyRealtimeSessionChange();
    } catch { /* ignore */ }
  }
  return updated;
}

export function resetActiveUnitToDefault(unitCode: string, fullSessionReset = false): ActiveUnitSession {
  const current = getActiveUnitSession();
  const unit = findHcmuteUnit(unitCode);
  const freshPositions = buildDefaultProposedPositionsForUnit(unit.nameVi, unit.group);
  const freshScale = buildDefaultScaleMetrics(unit.group);
  const freshNgach = buildDefaultNgachAllocations(freshPositions);
  cachedRootWorkbookFile = null; cachedMergedWorkbookFile = null; cachedSurveyFormFiles = [];

  const resetSession: ActiveUnitSession = {
    unitCode: unit.code,
    kind: unit.group,
    customDate: getRealtimeDateYYYYMMDD(),
    actorEmail: fullSessionReset ? '' : current.actorEmail,
    actorTitle: fullSessionReset ? '' : current.actorTitle,
    activeStep: 1,
    wizardStage: fullSessionReset ? 1 : 4,
    lastSavedAt: formatCurrentHHMM(),
    scaleMetrics: freshScale,
    ngachAllocations: freshNgach,
    ngachOverrides: {},
    customPositionNames: {},
    customCareerLevels: {},
    proposedPositions: freshPositions,
    previousPositionsSnapshot: current.proposedPositions,
    timeSessions: [],
    lastExportedFileName: undefined,
    lastMergedFileName: undefined,
    lastMergedVersion: undefined,
    lastAuditFixCount: undefined
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(UNIT_SESSION_KEY, JSON.stringify(resetSession));
      notifyRealtimeSessionChange();
    } catch { /* ignore */ }
  }
  return resetSession;
}

export function setSessionRootWorkbook(unitCode: string, blob: Blob, fileName: string): File {
  cachedUnitCode = unitCode;
  const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  cachedRootWorkbookFile = file;
  saveActiveUnitSession({ unitCode, lastExportedFileName: fileName });
  return file;
}

export function setSessionMergedWorkbook(unitCode: string, blob: Blob, fileName: string, version = 2): File {
  cachedUnitCode = unitCode;
  const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  cachedMergedWorkbookFile = file;
  saveActiveUnitSession({ unitCode, lastMergedFileName: fileName, lastMergedVersion: version });
  return file;
}

export function addSessionSurveyFormFile(unitCode: string, blob: Blob, fileName: string): File {
  cachedUnitCode = unitCode;
  const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  cachedSurveyFormFiles = [...cachedSurveyFormFiles.filter((f) => f.name !== fileName), file];
  return file;
}

export function getSessionFilesForUnit(unitCode: string) {
  if (cachedUnitCode !== unitCode) return { rootFile: null, mergedFile: null, formFiles: [] as File[] };
  return { rootFile: cachedRootWorkbookFile, mergedFile: cachedMergedWorkbookFile, formFiles: cachedSurveyFormFiles };
}

export function recordActivity(unitCode: string, unitName: string, action: ActivityLogEntry['action'], details: string, actorOverride?: { actorEmail?: string; actorTitle?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    const session = getActiveUnitSession();
    const actorEmail = (actorOverride?.actorEmail ?? session.actorEmail ?? '').trim();
    const actorTitle = (actorOverride?.actorTitle ?? session.actorTitle ?? '').trim();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list: ActivityLogEntry[] = raw ? JSON.parse(raw) : [];
    const entry: ActivityLogEntry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: new Date().toLocaleString('vi-VN'), unitCode, unitName, actorEmail, actorTitle, action, details };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...list].slice(0, 80)));
    window.dispatchEvent(new Event('vtvl-activity-updated'));
    void syncActivityToSupabase(unitCode, unitName, action, details, actorEmail, actorTitle);
  } catch { /* ignore */ }
}

export function getActivityLogs(): ActivityLogEntry[] {
  if (typeof window === 'undefined') return [];
  try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
