import {
  AuditReportResult,
  NgachAllocationRow,
  ProposedVtvlRow,
  SplitResultSummary,
  UnitScaleMetrics
} from '@/types/vtvl';
import { getCurrentOperatorSession } from '@/services/telemetry/operator-session';

function getSyncHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const op = getCurrentOperatorSession();
  if (op?.accessToken) headers.Authorization = `Bearer ${op.accessToken}`;
  return headers;
}

/**
 * Ghi nhật ký thao tác người dùng lên máy chủ (qua API bảo mật)
 */
export async function syncActivityToSupabase(
  unitCode: string,
  unitName: string,
  action: string,
  detail: string,
  actorEmail?: string,
  actorTitle?: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/audit-logs', {
      method: 'POST',
      headers: getSyncHeaders(),
      body: JSON.stringify({ unitCode, unitName, action, details: detail, actorEmail, actorTitle })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Đồng bộ kết quả phân tách tệp của đơn vị qua API máy chủ
 * Đồng bộ lên các bảng: c1_vtvl, a1_nhiem_vu, c3_nhu_cau, sldv_quy_mo_don_vi, sldv_phan_bo_ngach, t_tien_do
 */
export async function syncUnitSplitToSupabase(
  summary: SplitResultSummary,
  extra?: {
    scaleMetrics?: UnitScaleMetrics;
    ngachAllocations?: NgachAllocationRow[];
    proposedPositions?: ProposedVtvlRow[];
  }
): Promise<boolean> {
  try {
    const res = await fetch('/api/sync/split', {
      method: 'POST',
      headers: getSyncHeaders(),
      body: JSON.stringify({ summary, extra })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Đồng bộ kết quả rà soát chéo 9 biểu qua API máy chủ
 * Đồng bộ lên các bảng: k_kiem_tra, ra_soat_chua_du_can_cu
 */
export async function syncAuditResultToSupabase(
  report: AuditReportResult,
  unitCode: string
): Promise<boolean> {
  if (!unitCode || unitCode === 'X99') return false;
  try {
    const res = await fetch('/api/sync/audit', {
      method: 'POST',
      headers: getSyncHeaders(),
      body: JSON.stringify({ report, unitCode })
    });
    return res.ok;
  } catch {
    return false;
  }
}
