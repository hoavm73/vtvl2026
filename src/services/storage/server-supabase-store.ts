import { Prisma } from '@prisma/client';
import { ServerWorkbook } from './server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';
import { syncWorkbookAtomicOrFallback } from './server-workbook-relational-sync';
import { getDbTestHook, isDatabaseConfigured, prisma } from './prisma';
import { pgUpsertRows } from './postgres-rest-compat';

const CACHE_TTL_MS = 5000;
let cachedWorkbooks: ServerWorkbook[] | null = null;
let lastFetchedAt = 0;

export function invalidateSupabaseCache(): void {
  cachedWorkbooks = null;
  lastFetchedAt = 0;
}

export async function fetchWorkbooksFromSupabase(forceRefresh = false): Promise<ServerWorkbook[]> {
  if (process.env.VTVL_ISOLATED_LOCAL_STORE === 'true' || !isDatabaseConfigured()) return [];
  if (getDbTestHook() && !(process.env.DATABASE_URL || '').trim()) return [];

  const now = Date.now();
  if (!forceRefresh && cachedWorkbooks && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedWorkbooks;
  }

  try {
    const rows = await prisma.t_tien_do.findMany({
      select: {
        ma_don_vi: true,
        ten_don_vi: true,
        phien_ban: true,
        updated_at: true,
        du_lieu_ho_so_json: true
      },
      orderBy: { updated_at: 'desc' },
      take: 100
    });

    const workbooks: ServerWorkbook[] = [];

    for (const r of rows) {
      const json = (r.du_lieu_ho_so_json as Record<string, unknown>) || {};
      if (json.serverWorkbook) {
        const wb = json.serverWorkbook as ServerWorkbook;
        if (!wb.isDeleted) {
          if (!Array.isArray(wb.participants) || wb.participants.length === 0) {
            const email = String(json.actorEmail || 'tcns@hcmute.edu.vn');
            const title = String(json.actorTitle || 'Chuyên viên');
            wb.participants = [{
              id: `part_${wb.unitId || r.ma_don_vi}`,
              sessionId: `sess_${wb.unitId || r.ma_don_vi}`,
              workbookId: wb.id || `wb_${r.ma_don_vi}_2026`,
              displayName: title,
              email,
              emailNormalized: email.trim().toLowerCase(),
              roleLabel: title,
              startedAt: wb.updatedAt || new Date().toISOString(),
              updatedAt: wb.updatedAt || new Date().toISOString()
            }];
          }
          if (!Array.isArray(wb.revisions)) wb.revisions = [];
          if (!Array.isArray(wb.touchedCells)) wb.touchedCells = [];
          workbooks.push(wb);
        }
        continue;
      }

      if (json.isDeleted) continue;

      const unitCode = r.ma_don_vi;
      const unit = findHcmuteUnit(unitCode);
      const email = String(json.actorEmail || 'tcns@hcmute.edu.vn');
      const title = String(json.actorTitle || 'Chuyên viên');
      const updated = r.updated_at ? new Date(r.updated_at).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');
      const revNum = parseInt((r.phien_ban || '').replace('v', ''), 10) || 1;
      const gridData = (json.data as ServerWorkbook['data']) || buildDefaultGridWorkbook(unitCode);

      workbooks.push({
        id: `wb_${unitCode}_2026`,
        unitId: unitCode,
        unitNameVi: r.ten_don_vi || unit.nameVi,
        reportingPeriod: '01/10/2025–30/9/2026',
        status: 'draft',
        currentRevision: revNum,
        data: gridData,
        touchedCells: Array.isArray(json.touchedCells) ? (json.touchedCells as string[]) : [],
        createdAt: updated,
        updatedAt: updated,
        participants: [{
          id: `part_${unitCode}`,
          sessionId: `sess_${unitCode}`,
          workbookId: `wb_${unitCode}_2026`,
          displayName: title,
          email,
          emailNormalized: email.trim().toLowerCase(),
          roleLabel: title,
          startedAt: updated,
          updatedAt: updated
        }],
        revisions: [{
          id: `rev_${unitCode}_${revNum}`,
          workbookId: `wb_${unitCode}_2026`,
          revision: revNum,
          data: gridData,
          actorEmail: email.trim().toLowerCase(),
          actorTitle: title,
          changeSummary: 'Đồng bộ từ tiến độ đơn vị trực tuyến',
          createdAt: updated
        }]
      });
    }

    cachedWorkbooks = workbooks;
    lastFetchedAt = Date.now();
    return workbooks;
  } catch {
    return cachedWorkbooks || [];
  }
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
  invalidateSupabaseCache();
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
      revisions: Array.isArray(wb.revisions) ? wb.revisions.slice(0, 3) : []
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
    return syncRes.ok;
  } catch (err) {
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
