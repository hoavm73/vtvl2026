import { StaffWorkTicket, TicketStatus, toCanonicalStatus, toDisplayStatus, WorkSurveyStatusHistory } from '@/types/staff-ticket';
import { normalizeEmail } from './server-workbook-store';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export function isIsolatedLocalMode(): boolean {
  return process.env.VTVL_ISOLATED_LOCAL_STORE === 'true';
}

export function assertTicketDbConfigured(operation: string): boolean {
  if (isIsolatedLocalMode()) return false;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error(`[DB_SERVICE_UNAVAILABLE] Dịch vụ CSDL máy chủ chưa được cấu hình cho thao tác ${operation}.`);
      (err as unknown as { status: number; code: string }).status = 503;
      (err as unknown as { status: number; code: string }).code = 'SUPABASE_NOT_CONFIGURED';
      throw err;
    }
    return false;
  }
  return true;
}

function getServiceHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

export function createSchemaOrDbError(table: string, status: number, detailText: string): Error & { table?: string; status?: number; code?: string } {
  const isSchemaOutdated =
    status === 400 ||
    detailText.includes('PGRST204') ||
    detailText.includes('PGRST205') ||
    detailText.includes('42703') ||
    detailText.includes('42P01') ||
    detailText.includes('column') ||
    detailText.includes('schema cache');

  const code = isSchemaOutdated ? 'DATABASE_SCHEMA_OUTDATED' : 'DB_ERROR';
  const msg = isSchemaOutdated
    ? `[DATABASE_SCHEMA_OUTDATED] Lược đồ bảng ${table} chưa đồng bộ với phiên bản ứng dụng (HTTP ${status}): ${detailText}`
    : `[DB_ERROR] Thao tác bảng ${table} thất bại (HTTP ${status}): ${detailText}`;

  const err = new Error(msg);
  (err as unknown as { table: string; status: number; code: string }).table = table;
  (err as unknown as { table: string; status: number; code: string }).status = isSchemaOutdated ? 500 : status;
  (err as unknown as { table: string; status: number; code: string }).code = code;
  return err;
}

export interface DbTicketRow {
  id: string;
  unit_code: string;
  unit_id?: string;
  owner_email: string;
  owner_id?: string;
  owner_name?: string;
  owner_title?: string;
  status?: string;
  ma_nhiem_vu?: string;
  ma_cong_viec: string;
  ma_vtvl?: string;
  ma_vtvl_phoi_hop?: string;
  ten_cong_viec: string;
  san_pham?: string;
  chat_luong?: string;
  can_cu?: string;
  so_sp_nam?: number;
  phut_thuc_te?: number;
  gio_bo_sung?: number;
  nguon_so_lieu?: string;
  coordinated_tasks?: unknown;
  source_ticket_id?: string;
  submitted_at?: string;
  resubmitted_at?: string;
  approved_at?: string;
  approved_by?: string;
  revision_reason?: string;
  revision_requested_at?: string;
  revision_requested_by?: string;
  merged_at?: string;
  merged_by?: string;
  a2_row_id?: string;
  b1_row_id?: string;
  b2_row_id?: string;
  is_merged_to_b1_b2?: boolean;
  current_version_no?: number;
  last_change_summary?: string;
  is_test_data?: boolean;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

export function mapDbRowToTicket(row: DbTicketRow): StaffWorkTicket {
  const normEmail = normalizeEmail(row.owner_email || '');
  return {
    id: row.id,
    unitCode: row.unit_code || 'CNTT',
    unitId: row.unit_id || row.unit_code,
    ownerEmail: normEmail,
    ownerId: row.owner_id || normEmail,
    ownerName: row.owner_name || normEmail.split('@')[0],
    ownerTitle: row.owner_title || 'Cán bộ – Giảng viên',
    status: toDisplayStatus(row.status) as TicketStatus,
    maNhiemVu: row.ma_nhiem_vu || '',
    maCongViec: row.ma_cong_viec,
    tenCongViec: row.ten_cong_viec,
    maVtvl: row.ma_vtvl || '',
    maVtvlPhoiHop: row.ma_vtvl_phoi_hop || '',
    sanPham: row.san_pham || '',
    chatLuong: row.chat_luong || '',
    canCu: row.can_cu || '',
    soSpNam: Number(row.so_sp_nam) || 0,
    nguonSoLieu: row.nguon_so_lieu || '',
    phutThucTe: Number(row.phut_thuc_te) || 0,
    gioBoSung: Number(row.gio_bo_sung) || 0,
    coordinatedTasks: Array.isArray(row.coordinated_tasks) ? row.coordinated_tasks : [],
    sourceTicketId: row.source_ticket_id || row.id,
    submittedAt: row.submitted_at,
    resubmittedAt: row.resubmitted_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    revisionReason: row.revision_reason,
    revisionRequestedAt: row.revision_requested_at,
    revisionRequestedBy: row.revision_requested_by,
    mergedAt: row.merged_at,
    mergedBy: row.merged_by,
    a2RowId: row.a2_row_id,
    b1RowId: row.b1_row_id,
    b2RowId: row.b2_row_id,
    isMergedToB1B2: Boolean(row.is_merged_to_b1_b2),
    currentVersionNo: Number(row.current_version_no) || 0,
    lastChangeSummary: row.last_change_summary,
    isTestData: Boolean(row.is_test_data),
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

export async function fetchTicketsFromSupabase(unitCode?: string): Promise<StaffWorkTicket[] | null> {
  if (!assertTicketDbConfigured('fetchTickets')) return null;
  const filter = unitCode ? `?unit_code=eq.${encodeURIComponent(unitCode)}&order=updated_at.desc` : '?order=updated_at.desc';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/staff_work_tickets${filter}`, {
    headers: getServiceHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw createSchemaOrDbError('staff_work_tickets', res.status, detail);
  }
  const rows = (await res.json()) as DbTicketRow[];
  return Array.isArray(rows) ? rows.map(mapDbRowToTicket) : [];
}

/**
 * Lưu phiếu công việc vào Supabase với đầy đủ trường metadata vòng đời & phiên bản.
 * Tuyệt đối không fallback âm thầm sang payload rút gọn làm mất metadata phê duyệt/lịch sử.
 */
export async function persistTicketToSupabase(ticket: StaffWorkTicket): Promise<boolean> {
  if (!assertTicketDbConfigured('persistTicket')) return false;
  const normEmail = normalizeEmail(ticket.ownerEmail);
  if (!normEmail || !normEmail.includes('@')) {
    throw new Error('[SECURITY] Invalid ticket owner identifier. Cannot persist ticket.');
  }

  const payload: DbTicketRow = {
    id: ticket.id,
    unit_code: ticket.unitCode,
    unit_id: ticket.unitId || ticket.unitCode,
    owner_email: normEmail,
    owner_id: ticket.ownerId || normEmail,
    owner_name: ticket.ownerName,
    owner_title: ticket.ownerTitle,
    status: toCanonicalStatus(ticket.status),
    ma_nhiem_vu: ticket.maNhiemVu,
    ma_cong_viec: ticket.maCongViec,
    ma_vtvl: ticket.maVtvl,
    ma_vtvl_phoi_hop: ticket.maVtvlPhoiHop || '',
    ten_cong_viec: ticket.tenCongViec,
    san_pham: ticket.sanPham || '',
    chat_luong: ticket.chatLuong || '',
    can_cu: ticket.canCu || '',
    so_sp_nam: Number(ticket.soSpNam) || 0,
    phut_thuc_te: Number(ticket.phutThucTe) || 0,
    gio_bo_sung: Number(ticket.gioBoSung) || 0,
    nguon_so_lieu: ticket.nguonSoLieu || '',
    coordinated_tasks: ticket.coordinatedTasks || [],
    source_ticket_id: ticket.sourceTicketId || ticket.id,
    submitted_at: ticket.submittedAt,
    resubmitted_at: ticket.resubmittedAt,
    approved_at: ticket.approvedAt,
    approved_by: ticket.approvedBy,
    revision_reason: ticket.revisionReason,
    revision_requested_at: ticket.revisionRequestedAt,
    revision_requested_by: ticket.revisionRequestedBy,
    merged_at: ticket.mergedAt,
    merged_by: ticket.mergedBy,
    a2_row_id: ticket.a2RowId,
    b1_row_id: ticket.b1RowId,
    b2_row_id: ticket.b2RowId,
    is_merged_to_b1_b2: Boolean(ticket.isMergedToB1B2),
    current_version_no: Number(ticket.currentVersionNo) || 0,
    last_change_summary: ticket.lastChangeSummary,
    is_test_data: Boolean(ticket.isTestData),
    is_archived: Boolean(ticket.isArchived),
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt || new Date().toISOString()
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/staff_work_tickets?on_conflict=id`, {
    method: 'POST',
    headers: { ...getServiceHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw createSchemaOrDbError('staff_work_tickets', res.status, detail);
  }
  return true;
}

export async function deleteTicketFromSupabase(ticketId: string): Promise<boolean> {
  if (!assertTicketDbConfigured('deleteTicket')) return false;
  if (!ticketId) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/staff_work_tickets?id=eq.${encodeURIComponent(ticketId)}`, {
    method: 'DELETE',
    headers: getServiceHeaders()
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw createSchemaOrDbError('staff_work_tickets', res.status, detail);
  }
  return true;
}

export async function recordStatusHistoryInSupabase(h: Omit<WorkSurveyStatusHistory, 'id' | 'createdAt'>): Promise<void> {
  if (!assertTicketDbConfigured('recordStatusHistory')) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/work_survey_status_history`, {
    method: 'POST',
    headers: { ...getServiceHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({
      survey_id: h.surveyId,
      from_status: h.fromStatus || null,
      to_status: h.toStatus,
      action: h.action,
      reason: h.reason || null,
      actor_id: h.actorId,
      actor_role: h.actorRole,
      unit_id: h.unitId
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw createSchemaOrDbError('work_survey_status_history', res.status, detail);
  }
}

/**
 * Gọi RPC nguyên tử trên PostgreSQL (rpc_submit_work_survey, rpc_approve_work_survey,
 * rpc_request_work_survey_changes, rpc_merge_work_survey_to_b1_b2) với danh tính đã xác thực.
 * Mỗi lời gọi PostgREST /rpc/... chạy trong đúng 1 transaction DB với SET LOCAL app.actor_id.
 */
export async function callAtomicSurveyRpc(
  rpcName:
    | 'rpc_submit_work_survey'
    | 'rpc_resubmit_work_survey'
    | 'rpc_approve_work_survey'
    | 'rpc_request_work_survey_changes'
    | 'rpc_merge_work_survey_to_b1_b2',
  params: Record<string, unknown>
): Promise<{ executed: boolean; ticket?: StaffWorkTicket }> {
  if (!assertTicketDbConfigured(rpcName)) return { executed: false };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: getServiceHeaders(),
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (detail.includes('PGRST202') || res.status === 404) {
      return { executed: false };
    }
    throw createSchemaOrDbError(rpcName, res.status, detail);
  }
  const row = (await res.json()) as DbTicketRow;
  return { executed: true, ticket: row && row.id ? mapDbRowToTicket(row) : undefined };
}
