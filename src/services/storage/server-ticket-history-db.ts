import { WorkSurveyStatusHistory } from '@/types/staff-ticket';
import { assertTicketDbConfigured, createSchemaOrDbError } from './server-ticket-db';
import { prisma, toIsoString } from './prisma';

/**
 * Đọc toàn bộ lịch sử chuyển trạng thái & phản hồi từ bảng public.work_survey_status_history qua Prisma.
 */
export async function fetchStatusHistoryFromSupabase(
  unitCode?: string
): Promise<Map<string, WorkSurveyStatusHistory[]> | null> {
  if (!assertTicketDbConfigured('fetchStatusHistory')) return null;

  try {
    const rows = await prisma.work_survey_status_history.findMany({
      where: unitCode ? { unit_id: unitCode.toUpperCase() } : undefined,
      orderBy: { created_at: 'asc' }
    });

    const bySurvey = new Map<string, WorkSurveyStatusHistory[]>();
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
        createdAt: toIsoString(r.created_at) || new Date().toISOString()
      };
      const list = bySurvey.get(item.surveyId) || [];
      list.push(item);
      bySurvey.set(item.surveyId, list);
    }

    return bySurvey;
  } catch (e) {
    throw createSchemaOrDbError('work_survey_status_history', 500, e instanceof Error ? e.message : String(e));
  }
}

/**
 * Gộp và khử trùng lịch sử trạng thái giữa bộ nhớ cục bộ và PostgreSQL theo thứ tự thời gian tăng dần.
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

  for (const item of remoteList || []) addItem(item);
  for (const item of localList || []) addItem(item);

  return merged.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}
