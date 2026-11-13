import { ServerWorkbook } from './server-workbook-store';
import { findHcmuteUnit } from '@/configs/hcmute-units';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''
).trim();

const CACHE_TTL_MS = 5000;
let cachedWorkbooks: ServerWorkbook[] | null = null;
let lastFetchedAt = 0;

function getHeaders(userToken?: string): Record<string, string> {
  const bearer = userToken || SUPABASE_KEY;
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${bearer}`,
    'Content-Type': 'application/json'
  };
}

export function invalidateSupabaseCache(): void {
  cachedWorkbooks = null;
  lastFetchedAt = 0;
}

export async function fetchWorkbooksFromSupabase(forceRefresh = false): Promise<ServerWorkbook[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];

  const now = Date.now();
  if (!forceRefresh && cachedWorkbooks && now - lastFetchedAt < CACHE_TTL_MS) {
    return cachedWorkbooks;
  }

  try {
    const query =
      'select=ma_don_vi,ten_don_vi,phien_ban,updated_at,du_lieu_ho_so_json&order=updated_at.desc.nullslast&limit=100';
    const res = await fetch(`${SUPABASE_URL}/rest/v1/t_tien_do?${query}`, {
      headers: getHeaders(),
      cache: 'no-store'
    });
    if (!res.ok) return cachedWorkbooks || [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return cachedWorkbooks || [];

    const workbooks: ServerWorkbook[] = [];

    for (const r of rows) {
      if (r.du_lieu_ho_so_json?.serverWorkbook) {
        const wb: ServerWorkbook = r.du_lieu_ho_so_json.serverWorkbook;
        if (!wb.isDeleted) {
          if (!Array.isArray(wb.participants) || wb.participants.length === 0) {
            const email = r.du_lieu_ho_so_json?.actorEmail || 'tcns@hcmute.edu.vn';
            wb.participants = [{
              id: `part_${wb.unitId || r.ma_don_vi}`,
              sessionId: `sess_${wb.unitId || r.ma_don_vi}`,
              workbookId: wb.id || `wb_${r.ma_don_vi}_2026`,
              displayName: r.du_lieu_ho_so_json?.actorTitle || 'Chuyên viên',
              email,
              emailNormalized: email.trim().toLowerCase(),
              roleLabel: r.du_lieu_ho_so_json?.actorTitle || 'Chuyên viên',
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

      if (r.du_lieu_ho_so_json?.isDeleted) continue;

      const unitCode = r.ma_don_vi;
      const unit = findHcmuteUnit(unitCode);
      const email = r.du_lieu_ho_so_json?.actorEmail || 'tcns@hcmute.edu.vn';
      const title = r.du_lieu_ho_so_json?.actorTitle || 'Chuyên viên';
      const updated = r.updated_at ? new Date(r.updated_at).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');
      const revNum = parseInt((r.phien_ban || '').replace('v', ''), 10) || 1;

      workbooks.push({
        id: `wb_${unitCode}_2026`,
        unitId: unitCode,
        unitNameVi: r.ten_don_vi || unit.nameVi,
        reportingPeriod: '01/10/2025–30/9/2026',
        status: 'draft',
        currentRevision: revNum,
        data: r.du_lieu_ho_so_json?.data || buildDefaultGridWorkbook(unitCode),
        touchedCells: r.du_lieu_ho_so_json?.touchedCells || [],
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
          data: r.du_lieu_ho_so_json?.data || buildDefaultGridWorkbook(unitCode),
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

export async function persistWorkbookToSupabase(wb: ServerWorkbook, userToken?: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
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
      const d = wb.data as Record<string, any[]>;
      if (Array.isArray(d.A1)) a1Count = d.A1.length;
      if (Array.isArray(d.A2)) a2Count = d.A2.length;
      if (Array.isArray(d.C1)) c1Count = d.C1.length;
      if (Array.isArray(d.C3)) {
        fteTotal = d.C3.reduce((sum, r) => sum + (parseFloat(r.nguoiCanBoTri || r.nhuCauFte || 0) || 0), 0);
      }
    }

    const payload = {
      ma_don_vi: wb.unitId,
      ten_don_vi: wb.unitNameVi,
      phien_ban: `v${wb.currentRevision}`,
      so_nhiem_vu_a1: a1Count,
      so_cong_viec_a2: a2Count,
      so_vtvl_c1: c1Count,
      tong_fte_c3: Math.round(fteTotal * 100) / 100,
      trang_thai_ra_soat: 'Đã lưu trực tuyến',
      du_lieu_ho_so_json: {
        serverWorkbook: wb,
        actorEmail: latestPart.email,
        actorTitle: latestPart.roleLabel,
        lastSavedAt: wb.updatedAt
      }
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/t_tien_do?on_conflict=ma_don_vi`, {
      method: 'POST',
      headers: {
        ...getHeaders(userToken),
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(payload)
    });

    return res.ok;
  } catch {
    return false;
  }
}

export async function postServerRest(
  table: string,
  payload: unknown,
  upsertConflictCol?: string
): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  const query = upsertConflictCol ? `?on_conflict=${encodeURIComponent(upsertConflictCol)}` : '';
  const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        Prefer: upsertConflictCol ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteWorkbookFromSupabase(unitId: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  invalidateSupabaseCache();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/t_tien_do?ma_don_vi=eq.${encodeURIComponent(unitId)}`, {
      method: 'PATCH',
      headers: {
        ...getHeaders(),
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        trang_thai_ra_soat: 'Đã đánh dấu lưu trữ/xóa',
        du_lieu_ho_so_json: { isDeleted: true }
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}
