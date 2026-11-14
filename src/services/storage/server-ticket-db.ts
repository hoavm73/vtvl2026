import { StaffWorkTicket, TicketStatus } from '@/types/staff-ticket';
import { normalizeEmail } from './server-workbook-store';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
// Thao tác đặc quyền server-side: Bắt buộc duy nhất SUPABASE_SERVICE_ROLE_KEY ở mọi môi trường
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export function assertTicketDbConfigured(operation: string): boolean {
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

export interface DbTicketRow {
  id: string;
  unit_code: string;
  owner_email: string;
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
  created_at?: string;
  updated_at?: string;
}

export function mapDbRowToTicket(row: DbTicketRow): StaffWorkTicket {
  const normEmail = normalizeEmail(row.owner_email || '');
  return {
    id: row.id,
    unitCode: row.unit_code || 'CNTT',
    ownerEmail: normEmail,
    ownerName: row.owner_name || normEmail.split('@')[0],
    ownerTitle: row.owner_title || 'Cán bộ – Giảng viên',
    status: (row.status === 'Đã nộp' ? 'Đã nộp' : 'Nháp') as TicketStatus,
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
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

export async function fetchTicketsFromSupabase(unitCode?: string): Promise<StaffWorkTicket[] | null> {
  if (!assertTicketDbConfigured('fetchTickets')) return null;
  const filter = unitCode ? `?unit_code=eq.${encodeURIComponent(unitCode)}` : '';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/staff_work_tickets${filter}`, {
    headers: getServiceHeaders(),
    cache: 'no-store'
  });
  if (!res.ok) {
    const err = new Error(`[DB_ERROR] staff_work_tickets query failed with status ${res.status}`);
    (err as unknown as { table: string; status: number; code: string }).table = 'staff_work_tickets';
    (err as unknown as { table: string; status: number; code: string }).status = res.status;
    (err as unknown as { table: string; status: number; code: string }).code = 'DB_ERROR';
    throw err;
  }
  const rows = (await res.json()) as DbTicketRow[];
  return Array.isArray(rows) ? rows.map(mapDbRowToTicket) : [];
}

export async function persistTicketToSupabase(ticket: StaffWorkTicket): Promise<boolean> {
  if (!assertTicketDbConfigured('persistTicket')) return false;
  const normEmail = normalizeEmail(ticket.ownerEmail);
  if (!normEmail || !normEmail.includes('@')) {
    throw new Error('[SECURITY] Invalid ticket owner identifier. Cannot persist ticket.');
  }

  const payload: DbTicketRow = {
    id: ticket.id,
    unit_code: ticket.unitCode,
    owner_email: normEmail,
    owner_name: ticket.ownerName,
    owner_title: ticket.ownerTitle,
    status: ticket.status,
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
    created_at: ticket.createdAt,
    updated_at: ticket.updatedAt || new Date().toISOString()
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/staff_work_tickets?on_conflict=id`, {
    method: 'POST',
    headers: { ...getServiceHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = new Error(`[DB_ERROR] staff_work_tickets persist failed with status ${res.status}`);
    (err as unknown as { table: string; status: number; code: string }).table = 'staff_work_tickets';
    (err as unknown as { table: string; status: number; code: string }).status = res.status;
    (err as unknown as { table: string; status: number; code: string }).code = 'DB_ERROR';
    throw err;
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
    const err = new Error(`[DB_ERROR] staff_work_tickets delete failed with status ${res.status}`);
    (err as unknown as { table: string; status: number; code: string }).table = 'staff_work_tickets';
    (err as unknown as { table: string; status: number; code: string }).status = res.status;
    (err as unknown as { table: string; status: number; code: string }).code = 'DB_ERROR';
    throw err;
  }
  return true;
}
