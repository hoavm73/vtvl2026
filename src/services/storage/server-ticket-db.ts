import { Prisma } from '@prisma/client';
import { StaffWorkTicket, TicketStatus, toCanonicalStatus, toDisplayStatus, WorkSurveyStatusHistory } from '@/types/staff-ticket';
import { normalizeEmail } from './server-workbook-store';
import { getDbTestHook, getPgPool, isDatabaseConfigured, prisma, toIsoString, withPgTransaction } from './prisma';
import { pgCallSurveyRpc, pgUpsertRows } from './postgres-rest-compat';

const getDbUrl = () => (process.env.DATABASE_URL || '').trim();

export function isIsolatedLocalMode(): boolean {
  return process.env.VTVL_ISOLATED_LOCAL_STORE === 'true';
}

export function assertTicketDbConfigured(operation: string): boolean {
  if (isIsolatedLocalMode()) return false;
  if (!getDbUrl() && !isDatabaseConfigured()) {
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

export function createSchemaOrDbError(table: string, status: number, detailText: string): Error & { table?: string; status?: number; code?: string } {
  const isUniqueViolation = detailText.includes('23505') || detailText.includes('P2002') || detailText.includes('uq_staff_ticket_unit_task');
  if (isUniqueViolation) {
    const err = new Error(`[DUPLICATE_BUSINESS_CODE] Mã công việc đã tồn tại trong đơn vị (${detailText}).`);
    (err as unknown as { table: string; status: number; code: string }).table = table;
    (err as unknown as { table: string; status: number; code: string }).status = 409;
    (err as unknown as { table: string; status: number; code: string }).code = 'DUPLICATE_BUSINESS_CODE';
    return err;
  }

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
  id: string; unit_code: string; unit_id?: string | null; owner_email: string; owner_id?: string | null;
  owner_name?: string; owner_title?: string; status?: string; ma_nhiem_vu?: string;
  ma_cong_viec: string; ma_vtvl?: string; ma_vtvl_phoi_hop?: string | null; ten_cong_viec: string;
  san_pham?: string | null; chat_luong?: string | null; can_cu?: string | null; so_sp_nam?: unknown;
  phut_thuc_te?: unknown; gio_bo_sung?: unknown; nguon_so_lieu?: string | null;
  coordination_note?: string | null; coordinated_vtvls?: unknown; coordinated_tasks?: unknown;
  source_ticket_id?: string | null; submitted_at?: Date | string | null; resubmitted_at?: Date | string | null;
  approved_at?: Date | string | null; approved_by?: string | null; revision_reason?: string | null;
  revision_requested_at?: Date | string | null; revision_requested_by?: string | null;
  merged_at?: Date | string | null; merged_by?: string | null; a2_row_id?: string | null;
  b1_row_id?: string | null; b2_row_id?: string | null; is_merged_to_b1_b2?: boolean;
  current_version_no?: number; last_change_summary?: string | null; is_test_data?: boolean;
  is_archived?: boolean; created_at?: Date | string; updated_at?: Date | string;
}

export function mapDbRowToTicket(row: DbTicketRow): StaffWorkTicket {
  const normEmail = normalizeEmail(row.owner_email || '');
  return {
    id: row.id, unitCode: row.unit_code || 'CNTT', unitId: row.unit_id || row.unit_code,
    ownerEmail: normEmail, ownerId: row.owner_id || normEmail,
    ownerName: row.owner_name || normEmail.split('@')[0], ownerTitle: row.owner_title || 'Cán bộ – Giảng viên',
    status: toDisplayStatus(row.status) as TicketStatus, maNhiemVu: row.ma_nhiem_vu || '',
    maCongViec: row.ma_cong_viec, tenCongViec: row.ten_cong_viec, maVtvl: row.ma_vtvl || '',
    maVtvlPhoiHop: row.ma_vtvl_phoi_hop || '',
    coordinatedVtvls: Array.isArray(row.coordinated_vtvls) ? (row.coordinated_vtvls as StaffWorkTicket['coordinatedVtvls']) : undefined,
    coordinationNote: row.coordination_note || undefined,
    sanPham: row.san_pham || '', chatLuong: row.chat_luong || '', canCu: row.can_cu || '',
    soSpNam: Number(row.so_sp_nam) || 0, nguonSoLieu: row.nguon_so_lieu || '',
    phutThucTe: Number(row.phut_thuc_te) || 0, gioBoSung: Number(row.gio_bo_sung) || 0,
    coordinatedTasks: Array.isArray(row.coordinated_tasks) ? row.coordinated_tasks : [],
    sourceTicketId: row.source_ticket_id || row.id,
    submittedAt: toIsoString(row.submitted_at), resubmittedAt: toIsoString(row.resubmitted_at),
    approvedAt: toIsoString(row.approved_at), approvedBy: row.approved_by || undefined,
    revisionReason: row.revision_reason || undefined,
    revisionRequestedAt: toIsoString(row.revision_requested_at), revisionRequestedBy: row.revision_requested_by || undefined,
    mergedAt: toIsoString(row.merged_at), mergedBy: row.merged_by || undefined,
    a2RowId: row.a2_row_id || undefined, b1RowId: row.b1_row_id || undefined, b2RowId: row.b2_row_id || undefined,
    isMergedToB1B2: Boolean(row.is_merged_to_b1_b2), currentVersionNo: Number(row.current_version_no) || 0,
    lastChangeSummary: row.last_change_summary || undefined, isTestData: Boolean(row.is_test_data),
    isArchived: Boolean(row.is_archived),
    createdAt: toIsoString(row.created_at) || new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at) || new Date().toISOString()
  };
}

export async function fetchTicketsFromSupabase(unitCode?: string): Promise<StaffWorkTicket[] | null> {
  if (!assertTicketDbConfigured('fetchTickets')) return null;
  if (getDbTestHook() && !getDbUrl()) return null;
  try {
    const rows = await prisma.staff_work_tickets.findMany({
      where: unitCode ? { unit_code: unitCode } : undefined,
      orderBy: { updated_at: 'desc' }
    });
    return rows.map((r) => mapDbRowToTicket(r as unknown as DbTicketRow));
  } catch (e) {
    throw createSchemaOrDbError('staff_work_tickets', 500, e instanceof Error ? e.message : String(e));
  }
}

export async function persistTicketToSupabase(ticket: StaffWorkTicket, isNewInsert = false): Promise<boolean> {
  if (!assertTicketDbConfigured('persistTicket')) return false;
  const normEmail = normalizeEmail(ticket.ownerEmail);
  if (!normEmail || !normEmail.includes('@')) {
    throw new Error('[SECURITY] Invalid ticket owner identifier. Cannot persist ticket.');
  }

  const data = {
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
    coordinated_vtvls: (ticket.coordinatedVtvls || []) as unknown as Prisma.InputJsonValue,
    coordination_note: ticket.coordinationNote || '',
    ten_cong_viec: ticket.tenCongViec,
    san_pham: ticket.sanPham || '',
    chat_luong: ticket.chatLuong || '',
    can_cu: ticket.canCu || '',
    so_sp_nam: Number(ticket.soSpNam) || 0,
    phut_thuc_te: Number(ticket.phutThucTe) || 0,
    gio_bo_sung: Number(ticket.gioBoSung) || 0,
    nguon_so_lieu: ticket.nguonSoLieu || '',
    coordinated_tasks: (ticket.coordinatedTasks || []) as unknown as Prisma.InputJsonValue,
    source_ticket_id: ticket.sourceTicketId || ticket.id,
    submitted_at: ticket.submittedAt ? new Date(ticket.submittedAt) : null,
    resubmitted_at: ticket.resubmittedAt ? new Date(ticket.resubmittedAt) : null,
    approved_at: ticket.approvedAt ? new Date(ticket.approvedAt) : null,
    approved_by: ticket.approvedBy ? normalizeEmail(ticket.approvedBy) : null,
    revision_reason: ticket.revisionReason ?? null,
    revision_requested_at: ticket.revisionRequestedAt ? new Date(ticket.revisionRequestedAt) : null,
    revision_requested_by: ticket.revisionRequestedBy ? normalizeEmail(ticket.revisionRequestedBy) : null,
    merged_at: ticket.mergedAt ? new Date(ticket.mergedAt) : null,
    merged_by: ticket.mergedBy ? normalizeEmail(ticket.mergedBy) : null,
    a2_row_id: ticket.a2RowId ?? null,
    b1_row_id: ticket.b1RowId ?? null,
    b2_row_id: ticket.b2RowId ?? null,
    is_merged_to_b1_b2: Boolean(ticket.isMergedToB1B2),
    current_version_no: Number(ticket.currentVersionNo) || 0,
    last_change_summary: ticket.lastChangeSummary ?? null,
    is_test_data: Boolean(ticket.isTestData),
    is_archived: Boolean(ticket.isArchived),
    created_at: ticket.createdAt ? new Date(ticket.createdAt) : new Date(),
    updated_at: ticket.updatedAt ? new Date(ticket.updatedAt) : new Date()
  };

  try {
    if (isNewInsert) {
      try {
        await prisma.staff_work_tickets.create({ data });
      } catch (createErr) {
        if ((createErr as { code?: string })?.code === 'P2002') {
          await prisma.staff_work_tickets.upsert({ where: { id: ticket.id }, update: data, create: data });
        } else throw createErr;
      }
    } else {
      await prisma.staff_work_tickets.upsert({ where: { id: ticket.id }, update: data, create: data });
    }
  } catch (e) {
    throw createSchemaOrDbError('staff_work_tickets', 500, e instanceof Error ? e.message : String(e));
  }
  await syncCoordinatedTasksToTable(ticket).catch(() => {});
  return true;
}

async function syncCoordinatedTasksToTable(ticket: StaffWorkTicket): Promise<void> {
  if (!assertTicketDbConfigured('syncCoordinatedTasks')) return;
  const list = Array.isArray(ticket.coordinatedTasks) ? ticket.coordinatedTasks : [];
  if (list.length === 0) return;
  await prisma.coordinated_tasks.deleteMany({ where: { ticket_id: ticket.id } });
  await pgUpsertRows(
    'coordinated_tasks',
    list.map((c) => ({
      id: c.id || `coord-${ticket.id}-${c.targetUnitCode}-${c.targetTaskCode}`,
      ticket_id: ticket.id,
      unit_code: ticket.unitCode,
      target_unit_code: String(c.targetUnitCode || ticket.unitCode).trim().toUpperCase(),
      target_task_code: c.targetTaskCode,
      target_task_name: c.targetTaskName || null,
      notes: c.note || null
    })),
    'id'
  );
}

export async function deleteTicketFromSupabase(ticketId: string): Promise<boolean> {
  if (!assertTicketDbConfigured('deleteTicket') || !ticketId) return false;
  try {
    await prisma.staff_work_tickets.deleteMany({ where: { id: ticketId } });
    return true;
  } catch (e) {
    throw createSchemaOrDbError('staff_work_tickets', 500, e instanceof Error ? e.message : String(e));
  }
}

export async function recordStatusHistoryInSupabase(h: Omit<WorkSurveyStatusHistory, 'id' | 'createdAt'>): Promise<void> {
  if (!assertTicketDbConfigured('recordStatusHistory')) return;
  try {
    await prisma.work_survey_status_history.create({
      data: {
        survey_id: h.surveyId,
        from_status: h.fromStatus || null,
        to_status: h.toStatus,
        action: h.action,
        reason: h.reason || null,
        actor_id: h.actorId,
        actor_role: h.actorRole,
        unit_id: h.unitId
      }
    });
  } catch (e) {
    throw createSchemaOrDbError('work_survey_status_history', 500, e instanceof Error ? e.message : String(e));
  }
}

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
  const res = await pgCallSurveyRpc<DbTicketRow>(rpcName, params);
  if (!res.ok) {
    const detail = res.errorText || '';
    if (detail.includes('PGRST202') || res.status === 404) {
      return { executed: false };
    }
    throw createSchemaOrDbError(rpcName, res.status, detail);
  }
  return { executed: true, ticket: res.row && res.row.id ? mapDbRowToTicket(res.row) : undefined };
}

export async function batchMarkTicketsMergedInDb(tickets: StaffWorkTicket[]): Promise<void> {
  if (!assertTicketDbConfigured('batchMergeTickets') || tickets.length === 0) return;
  if (getDbTestHook() && !(process.env.DATABASE_URL || '').trim()) return;
  if (!getPgPool()) return;

  const ids = tickets.map((t) => t.id);
  const mergedBys = tickets.map((t) => (t.mergedBy ? normalizeEmail(t.mergedBy) : null));
  const mergedAts = tickets.map((t) => (t.mergedAt ? new Date(t.mergedAt) : new Date()));
  const a2RowIds = tickets.map((t) => t.a2RowId ?? null);
  const b1RowIds = tickets.map((t) => t.b1RowId ?? null);
  const b2RowIds = tickets.map((t) => t.b2RowId ?? null);
  const vers = tickets.map((t) => Number(t.currentVersionNo) || 1);
  const updatedAts = tickets.map((t) => (t.updatedAt ? new Date(t.updatedAt) : new Date()));

  try {
    await withPgTransaction(async (client) => {
      await client.query(
        `UPDATE public.staff_work_tickets AS s
         SET is_merged_to_b1_b2 = true,
             merged_by = u.merged_by,
             merged_at = u.merged_at,
             a2_row_id = u.a2_row_id,
             b1_row_id = u.b1_row_id,
             b2_row_id = u.b2_row_id,
             current_version_no = u.current_version_no,
             updated_at = u.updated_at
         FROM unnest(
           $1::varchar[], $2::varchar[], $3::timestamptz[], $4::varchar[],
           $5::varchar[], $6::varchar[], $7::int4[], $8::timestamptz[]
         ) AS u(id, merged_by, merged_at, a2_row_id, b1_row_id, b2_row_id, current_version_no, updated_at)
         WHERE s.id = u.id`,
        [ids, mergedBys, mergedAts, a2RowIds, b1RowIds, b2RowIds, vers, updatedAts]
      );
    });
  } catch (e) {
    throw createSchemaOrDbError('staff_work_tickets', 500, e instanceof Error ? e.message : String(e));
  }
}
