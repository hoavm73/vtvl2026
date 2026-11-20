import { Prisma } from '@prisma/client';
import { ServerWorkbook } from './server-workbook-store';
import { findHcmuteUnit, UNIT_CODE_ALIASES } from '@/configs/hcmute-units';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';
import { syncWorkbookAtomicOrFallback } from './server-workbook-relational-sync';
import { getDbTestHook, isDatabaseConfigured, prisma } from './prisma';
import { pgUpsertRows } from './postgres-rest-compat';

const CACHE_TTL_MS = 5000;
const TIEN_DO_SELECT = {
  ma_don_vi: true, ten_don_vi: true, phien_ban: true, updated_at: true, du_lieu_ho_so_json: true
} as const;
let cachedWorkbooks: ServerWorkbook[] | null = null;
const cachedByUnit = new Map<string, { wb: ServerWorkbook; fetchedAt: number }>();
const inFlightByUnit = new Map<string, Promise<ServerWorkbook | null>>();
let lastFetchedAt = 0;
let lastInvalidatedAt = 0;
let inFlightWorkbooksFetch: Promise<ServerWorkbook[]> | null = null;
let inFlightStartedAt = 0;

export function invalidateSupabaseCache(): void {
  cachedWorkbooks = null; cachedByUnit.clear(); lastFetchedAt = 0; lastInvalidatedAt = Date.now();
}

export function evictUnitFromSupabaseCache(unitCode: string): void {
  const uc = (unitCode || '').trim().toUpperCase();
  if (!uc) return;
  cachedByUnit.delete(uc);
  if (cachedWorkbooks) cachedWorkbooks = cachedWorkbooks.filter((w) => w.unitId.toUpperCase() !== uc);
}

export function upsertWorkbookInSupabaseCache(wb: ServerWorkbook): void {
  const uc = (wb.unitId || '').trim().toUpperCase();
  if (!uc) return;
  if (wb.isDeleted) {
    cachedByUnit.delete(uc);
    if (cachedWorkbooks) cachedWorkbooks = cachedWorkbooks.filter((w) => w.id !== wb.id && w.unitId.toUpperCase() !== uc);
    return;
  }
  cachedByUnit.set(uc, { wb, fetchedAt: Date.now() });
  if (cachedWorkbooks) {
    const idx = cachedWorkbooks.findIndex((w) => w.id === wb.id || w.unitId.toUpperCase() === uc);
    if (idx >= 0) cachedWorkbooks[idx] = wb;
    else cachedWorkbooks.unshift(wb);
  }
}

function mapTienDoRowToWorkbook(r: {
  ma_don_vi: string; ten_don_vi: string | null; phien_ban: string | null;
  updated_at: Date | string | null; du_lieu_ho_so_json: unknown;
}): ServerWorkbook | null {
  const json = (r.du_lieu_ho_so_json as Record<string, unknown>) || {};
  const email = String(json.actorEmail || 'tcns@hcmute.edu.vn');
  const title = String(json.actorTitle || 'Chuyên viên');
  const makePart = (wbId: string, unit: string, ts: string) => ({
    id: `part_${unit}`, sessionId: `sess_${unit}`, workbookId: wbId, displayName: title, email,
    emailNormalized: email.trim().toLowerCase(), roleLabel: title, startedAt: ts, updatedAt: ts
  });
  if (json.serverWorkbook) {
    const wb = json.serverWorkbook as ServerWorkbook;
    if (wb.isDeleted) return null;
    if (!Array.isArray(wb.participants) || wb.participants.length === 0) {
      wb.participants = [makePart(wb.id || `wb_${r.ma_don_vi}_2026`, wb.unitId || r.ma_don_vi, wb.updatedAt || new Date().toISOString())];
    }
    if (!Array.isArray(wb.revisions)) wb.revisions = [];
    if (!Array.isArray(wb.touchedCells)) wb.touchedCells = [];
    return wb;
  }
  if (json.isDeleted) return null;
  const unitCode = r.ma_don_vi;
  const unit = findHcmuteUnit(unitCode);
  const updated = r.updated_at ? new Date(r.updated_at).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');
  const revNum = parseInt((r.phien_ban || '').replace('v', ''), 10) || 1;
  const gridData = (json.data as ServerWorkbook['data']) || buildDefaultGridWorkbook(unitCode);
  const wbId = `wb_${unitCode}_2026`;
  return {
    id: wbId, unitId: unitCode, unitNameVi: r.ten_don_vi || unit.nameVi,
    reportingPeriod: '01/10/2025–30/9/2026', status: 'draft', currentRevision: revNum, data: gridData,
    touchedCells: Array.isArray(json.touchedCells) ? (json.touchedCells as string[]) : [],
    createdAt: updated, updatedAt: updated, participants: [makePart(wbId, unitCode, updated)],
    revisions: [{
      id: `rev_${unitCode}_${revNum}`, workbookId: wbId, revision: revNum, data: gridData,
      actorEmail: email.trim().toLowerCase(), actorTitle: title, changeSummary: 'Đồng bộ từ tiến độ đơn vị trực tuyến', createdAt: updated
    }]
  };
}

async function runWorkbooksFetchQuery(): Promise<ServerWorkbook[]> {
  try {
    const rows = await prisma.t_tien_do.findMany({ select: TIEN_DO_SELECT, orderBy: { updated_at: 'desc' }, take: 100 });
    const workbooks: ServerWorkbook[] = [];
    const now = Date.now();
    for (const r of rows) {
      const wb = mapTienDoRowToWorkbook(r);
      if (!wb) continue;
      workbooks.push(wb);
      cachedByUnit.set((wb.unitId || r.ma_don_vi).trim().toUpperCase(), { wb, fetchedAt: now });
    }
    cachedWorkbooks = workbooks;
    lastFetchedAt = now;
    return workbooks;
  } catch {
    return cachedWorkbooks || [];
  }
}

export async function fetchUnitWorkbookFromSupabase(unitCode: string, forceRefresh = false): Promise<ServerWorkbook | null> {
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !isDatabaseConfigured()) return null;
  if (getDbTestHook() && !(process.env.DATABASE_URL || '').trim()) return null;
  const rawUc = (unitCode || '').trim().toUpperCase();
  if (!rawUc) return null;

  if (!forceRefresh) {
    const hit = cachedByUnit.get(rawUc);
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.wb;
    const inflight = inFlightByUnit.get(rawUc);
    if (inflight) return inflight;
  }

  const run = (async (): Promise<ServerWorkbook | null> => {
    try {
      const canonical = UNIT_CODE_ALIASES[rawUc] || rawUc;
      const row = canonical !== rawUc
        ? await prisma.t_tien_do.findFirst({ where: { ma_don_vi: { in: [rawUc, canonical] } }, select: TIEN_DO_SELECT })
        : await prisma.t_tien_do.findUnique({ where: { ma_don_vi: rawUc }, select: TIEN_DO_SELECT });
      if (!row) return null;
      const wb = mapTienDoRowToWorkbook(row);
      if (!wb) { cachedByUnit.delete(rawUc); return null; }
      upsertWorkbookInSupabaseCache(wb);
      cachedByUnit.set(rawUc, { wb, fetchedAt: Date.now() });
      return wb;
    } catch (err) {
      if (forceRefresh && process.env.VTVL_ISOLATED_LOCAL_STORE !== 'true' && Boolean((process.env.DATABASE_URL || '').trim())) throw err;
      return cachedByUnit.get(rawUc)?.wb || null;
    }
  })().finally(() => {
    if (inFlightByUnit.get(rawUc) === run) inFlightByUnit.delete(rawUc);
  });

  inFlightByUnit.set(rawUc, run);
  return run;
}

export async function fetchWorkbooksFromSupabase(forceRefresh = false): Promise<ServerWorkbook[]> {
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !isDatabaseConfigured()) return [];
  if (getDbTestHook() && !(process.env.DATABASE_URL || '').trim()) return [];

  if (!forceRefresh && cachedWorkbooks && Date.now() - lastFetchedAt < CACHE_TTL_MS) {
    return cachedWorkbooks;
  }

  if (inFlightWorkbooksFetch) {
    if (!forceRefresh || inFlightStartedAt >= lastInvalidatedAt) {
      return inFlightWorkbooksFetch;
    }
    await inFlightWorkbooksFetch.catch(() => []);
    if (cachedWorkbooks && Date.now() - lastFetchedAt < CACHE_TTL_MS) {
      return cachedWorkbooks;
    }
  }

  inFlightStartedAt = Date.now();
  const run = runWorkbooksFetchQuery().finally(() => {
    if (inFlightWorkbooksFetch === run) inFlightWorkbooksFetch = null;
  });
  inFlightWorkbooksFetch = run;
  return run;
}

export async function persistWorkbookToSupabase(
  wb: ServerWorkbook,
  userToken?: string,
  options?: { simulateTxError?: boolean; requireAtomicRpc?: boolean }
): Promise<boolean> {
  if (options?.simulateTxError && process.env.VTVL_ISOLATED_LOCAL_STORE === 'true') {
    throw new Error('TX_ABORTED_MIDWAY: Lỗi giả lập giữa giao dịch đồng bộ bảng tính.');
  }
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true') return true;
  if (!isDatabaseConfigured()) return false;
  upsertWorkbookInSupabaseCache(wb);
  try {
    const latestPart = wb.participants[wb.participants.length - 1] || {
      email: 'tcns@hcmute.edu.vn',
      roleLabel: 'Chuyên viên'
    };

    let a1Count = 0;
    let a2Count = 0;
    let c1Count = 0;
    let fteTotal = 0;

    if (wb.data) {
      const d = wb.data as unknown as Record<string, Array<Record<string, unknown>>>;
      if (Array.isArray(d.A1)) a1Count = d.A1.length;
      if (Array.isArray(d.A2)) a2Count = d.A2.length;
      if (Array.isArray(d.C1)) c1Count = d.C1.length;
      if (Array.isArray(d.C3)) {
        fteTotal = d.C3.reduce((sum, r) => sum + (parseFloat(String(r.nguoiCanBoTri ?? r.nhuCauFte ?? 0)) || 0), 0);
      }
    }

    const compactWorkbookForJsonb: ServerWorkbook = {
      ...wb,
      revisions: Array.isArray(wb.revisions) ? wb.revisions.slice(0, 1) : []
    };

    const payload = {
      ma_don_vi: wb.unitId,
      ten_don_vi: wb.unitNameVi,
      phien_ban: `v${wb.currentRevision}`,
      so_nhiem_vu_a1: a1Count,
      so_cong_viec_a2: a2Count,
      so_vtvl_c1: c1Count,
      tong_fte_c3: Math.round(fteTotal * 100) / 100,
      trang_thai_ra_soat: 'Đã lưu trực tuyến',
      updated_at: new Date().toISOString(),
      email_nguoi_thuc_hien: latestPart.email || null,
      chuc_vu_nguoi_thuc_hien: latestPart.roleLabel || null,
      du_lieu_ho_so_json: {
        serverWorkbook: compactWorkbookForJsonb,
        actorEmail: latestPart.email,
        actorTitle: latestPart.roleLabel,
        lastSavedAt: wb.updatedAt
      }
    };

    const syncRes = await syncWorkbookAtomicOrFallback(wb, payload, userToken, options);
    if (syncRes.ok) upsertWorkbookInSupabaseCache(wb);
    else cachedByUnit.delete((wb.unitId || '').trim().toUpperCase());
    return syncRes.ok;
  } catch (err) {
    cachedByUnit.delete((wb.unitId || '').trim().toUpperCase());
    if (options?.simulateTxError || options?.requireAtomicRpc) throw err;
    return false;
  }
}

export interface PostServerRestResult {
  ok: boolean;
  status: number;
  table: string;
  error?: string;
}

export async function postServerRest(
  table: string,
  payload: unknown,
  upsertConflictCol?: string
): Promise<PostServerRestResult> {
  return pgUpsertRows(table, payload, upsertConflictCol);
}

export async function postServerRestRequired(
  table: string,
  payload: unknown,
  upsertConflictCol?: string
): Promise<PostServerRestResult> {
  const result = await postServerRest(table, payload, upsertConflictCol);
  if (!result.ok) {
    const err = new Error(result.error || `Lỗi ghi bảng ${table}`);
    (err as unknown as { table: string; status: number }).table = table;
    (err as unknown as { table: string; status: number }).status = result.status;
    throw err;
  }
  return result;
}

export async function deleteWorkbookFromSupabase(unitId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  invalidateSupabaseCache();
  try {
    await prisma.t_tien_do.updateMany({
      where: { ma_don_vi: unitId },
      data: {
        trang_thai_ra_soat: 'Đã đánh dấu lưu trữ/xóa',
        du_lieu_ho_so_json: { isDeleted: true } as unknown as Prisma.InputJsonValue,
        updated_at: new Date()
      }
    });
    return true;
  } catch {
    return false;
  }
}
