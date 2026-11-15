import { WorkSurveyStatusHistory } from '@/types/staff-ticket';
import { assertTicketDbConfigured, createSchemaOrDbError } from './server-ticket-db';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

interface DbStatusHistoryRow {
  id: string;
  survey_id: string;
  from_status?: string | null;
  to_status: string;
  action: string;
  reason?: string | null;
  actor_id: string;
  actor_role: string;
  unit_id: string;
  created_at: string;
}

function getServiceHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Đọc toàn bộ lịch sử chuyển trạng thái & phản hồi từ bảng public.work_survey_status_history trên Supabase.
 */
export async function fetchStatusHistoryFromSupabase(
  unitCode?: string
): Promise<Map<string, WorkSurveyStatusHistory[]> | null> {
  if (!assertTicketDbConfigured('fetchStatusHistory')) return null;

  const filter = unitCode
    ? `?unit_id=eq.${encodeURIComponent(unitCode.toUpperCase())}&order=created_at.asc`
    : '?order=created_at.asc';

  const res = await fetch(`${SUPABASE_URL}/rest/v1/work_survey_status_history${filter}`, {
    headers: getServiceHeaders(),
    cache: 'no-store'
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw createSchemaOrDbError('work_survey_status_history', res.status, detail);
  }

  const rows = (await res.json()) as DbStatusHistoryRow[];
  const bySurvey = new Map<string, WorkSurveyStatusHistory[]>();
  if (!Array.isArray(rows)) return bySurvey;

  for (const r of rows) {
    if (!r?.survey_id) continue;
    const item: WorkSurveyStatusHistory = {
      id: String(r.id),
      surveyId: String(r.survey_id),
      fromStatus: r.from_status || undefined,
      toStatus: String(r.to_status),
      action: String(r.action),
      reason: r.reason || undefined,
      actorId: String(r.actor_id || '').toLowerCase().trim(),
      actorRole: String(r.actor_role || 'staff'),
      unitId: String(r.unit_id || ''),
      createdAt: String(r.created_at)
    };
    const list = bySurvey.get(item.surveyId) || [];
    list.push(item);
    bySurvey.set(item.surveyId, list);
  }

  return bySurvey;
}

/**
 * Gộp và khử trùng lịch sử trạng thái giữa bộ nhớ cục bộ và Supabase theo thứ tự thời gian tăng dần.
 */
export function mergeTicketStatusHistory(
  localList?: WorkSurveyStatusHistory[],
  remoteList?: WorkSurveyStatusHistory[]
): WorkSurveyStatusHistory[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const merged: WorkSurveyStatusHistory[] = [];

  const addItem = (item: WorkSurveyStatusHistory) => {
    const compositeKey = `${item.action}|${(item.actorId || '').toLowerCase().trim()}|${(item.createdAt || '').slice(0, 19)}`;
    if (seenIds.has(item.id) || seenKeys.has(compositeKey)) return;
    seenIds.add(item.id);
    seenKeys.add(compositeKey);
    merged.push(item);
  };

  // Ưu tiên bản ghi chuẩn từ Supabase trước, sau đó mới bổ sung bản ghi cục bộ nếu có
  for (const item of remoteList || []) addItem(item);
  for (const item of localList || []) addItem(item);

  return merged.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}
