import { isDatabaseConfigured, pgQuery } from './prisma';
import { isIsolatedLocalMode } from './server-ticket-db';
import { StaffWorkTicket } from '@/types/staff-ticket';

const missionCounterMap = new Map<string, number>();
const idempotencyMemoryStore = new Map<string, { actionScope: string; actorEmail: string; targetId?: string; response: unknown; expiresAt: number }>();

export function resetMissionCounterAndIdempotencyStore(): void {
  missionCounterMap.clear();
  idempotencyMemoryStore.clear();
}

/**
 * Cấp mã công việc nguyên tử theo `(unit_code, mission_code)`.
 * - Khi PostgreSQL được cấu hình: thực thi `INSERT ... ON CONFLICT (unit_code, mission_code) DO UPDATE SET last_seq = GREATEST(last_seq, seedMaxSeq) + 1 RETURNING last_seq`.
 * - Khi chạy chế độ local cô lập: dùng bộ đếm đồng bộ nguyên tử theo khóa `(unit_code, mission_code)` sau khi đã khởi tạo từ `seedMaxSeq`.
 */
export async function allocateTaskCodeAtomic(
  unitCode: string,
  missionCode: string,
  seedMaxSeq: number
): Promise<string> {
  const cleanUnit = unitCode.trim().toUpperCase();
  const cleanMission = missionCode.trim();
  if (!cleanUnit || !cleanMission) return '';

  const normalizedMissionKey = `${cleanUnit}::${cleanMission.toUpperCase()}`;
  const safeSeed = Math.max(0, Math.floor(Number(seedMaxSeq) || 0));

  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    try {
      const res = await pgQuery<{ last_seq: number }>(
        `INSERT INTO public.unit_mission_counters (unit_code, mission_code, last_seq, updated_at)
         VALUES ($1, $2, GREATEST(1, $3 + 1), NOW())
         ON CONFLICT (unit_code, mission_code)
         DO UPDATE SET
           last_seq = GREATEST(public.unit_mission_counters.last_seq, $3) + 1,
           updated_at = NOW()
         RETURNING last_seq`,
        [cleanUnit, cleanMission.toUpperCase(), safeSeed]
      );
      const nextSeq = Number(res.rows[0]?.last_seq || 0);
      if (nextSeq > 0) {
        missionCounterMap.set(normalizedMissionKey, Math.max(missionCounterMap.get(normalizedMissionKey) || 0, nextSeq));
        return `${cleanMission}.CV${String(nextSeq).padStart(2, '0')}`;
      }
    } catch {
      // Fallback sang bộ đếm trong khóa cross-process nếu bảng unit_mission_counters chưa chạy migration trên DB cũ
    }
  }

  const prevSeq = missionCounterMap.get(normalizedMissionKey) || 0;
  const nextSeq = Math.max(prevSeq, safeSeed) + 1;
  missionCounterMap.set(normalizedMissionKey, nextSeq);
  return `${cleanMission}.CV${String(nextSeq).padStart(2, '0')}`;
}

export function getMissionCounterWatermark(unitCode: string, missionCode: string): number | undefined {
  const key = `${unitCode.trim().toUpperCase()}::${missionCode.trim().toUpperCase()}`;
  return missionCounterMap.get(key);
}

export function bumpMissionCounterWatermark(unitCode: string, missionCode: string, workCode: string): void {
  const cleanMission = missionCode.trim();
  const cleanUnit = unitCode.trim().toUpperCase();
  if (!cleanMission || !cleanUnit || !workCode) return;
  const pattern = new RegExp(`^${cleanMission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.CV(\\d+)$`, 'i');
  const match = workCode.trim().match(pattern);
  if (!match) return;
  const seq = parseInt(match[1], 10);
  if (!Number.isFinite(seq) || seq <= 0) return;
  const key = `${cleanUnit}::${cleanMission.toUpperCase()}`;
  missionCounterMap.set(key, Math.max(missionCounterMap.get(key) || 0, seq));
}

export interface ConcurrencyCheckResult {
  conflict: boolean;
  message?: string;
  currentVersionNo?: number;
  currentUpdatedAt?: string;
}

/**
 * Kiểm tra Optimistic Concurrency trước khi ghi đè phiếu đang chỉnh sửa.
 * Hỗ trợ `expectedVersionNo`, `baseRevision`, và `expectedUpdatedAt` từ client.
 */
export function checkTicketOptimisticConcurrency(
  existing: StaffWorkTicket | null | undefined,
  body: Record<string, unknown>
): ConcurrencyCheckResult {
  if (!existing) return { conflict: false };

  const currentVersion = Number(existing.currentVersionNo || 0);
  const rawExpectedVer = body.expectedVersionNo ?? body.baseRevision;
  if (rawExpectedVer !== undefined && rawExpectedVer !== null && String(rawExpectedVer).trim() !== '') {
    const expectedVer = Number(rawExpectedVer);
    if (Number.isFinite(expectedVer) && expectedVer !== currentVersion) {
      return {
        conflict: true,
        message: `Phiếu công việc đã được cập nhật lên phiên bản v${currentVersion} từ phiên khác. Vui lòng tải lại dữ liệu trước khi lưu.`,
        currentVersionNo: currentVersion,
        currentUpdatedAt: existing.updatedAt
      };
    }
  }

  const rawExpectedUpdatedAt = typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt.trim() : '';
  if (rawExpectedUpdatedAt && existing.updatedAt && rawExpectedUpdatedAt !== existing.updatedAt) {
    return {
      conflict: true,
      message: 'Phiếu công việc đã thay đổi sau thời điểm bạn mở biểu mẫu. Vui lòng tải lại dữ liệu mới nhất.',
      currentVersionNo: currentVersion,
      currentUpdatedAt: existing.updatedAt
    };
  }

  return { conflict: false };
}

export function extractIdempotencyKey(req: Request | null, body?: Record<string, unknown>): string {
  const headerKey = req?.headers?.get('idempotency-key') || req?.headers?.get('x-idempotency-key') || '';
  const bodyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : '';
  return String(headerKey || bodyKey || '').trim().slice(0, 128);
}

export async function getRecordedIdempotencyResponse<T = Record<string, unknown>>(
  idempotencyKey: string,
  actionScope: string
): Promise<T | null> {
  if (!idempotencyKey) return null;
  const scopedKey = `${actionScope}::${idempotencyKey}`;

  const mem = idempotencyMemoryStore.get(scopedKey);
  if (mem && Date.now() < mem.expiresAt) {
    return mem.response as T;
  }

  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    try {
      const res = await pgQuery<{ response_json: unknown }>(
        `SELECT response_json FROM public.idempotency_records
         WHERE idempotency_key = $1 AND action_scope = $2 AND expires_at > NOW()
         LIMIT 1`,
        [scopedKey, actionScope]
      );
      if (res.rows[0]?.response_json) {
        return res.rows[0].response_json as T;
      }
    } catch {
      // ignore if table not yet migrated
    }
  }
  return null;
}

export async function saveIdempotencyResponse(params: {
  idempotencyKey: string;
  actionScope: string;
  actorEmail: string;
  targetId?: string;
  response: Record<string, unknown>;
  ttlMs?: number;
}): Promise<void> {
  if (!params.idempotencyKey) return;
  const scopedKey = `${params.actionScope}::${params.idempotencyKey}`;
  const ttlMs = params.ttlMs ?? 24 * 60 * 60 * 1000;
  const expiresAt = Date.now() + ttlMs;

  idempotencyMemoryStore.set(scopedKey, {
    actionScope: params.actionScope,
    actorEmail: params.actorEmail,
    targetId: params.targetId,
    response: params.response,
    expiresAt
  });

  if (idempotencyMemoryStore.size > 5000) {
    const oldestKey = idempotencyMemoryStore.keys().next().value;
    if (oldestKey) idempotencyMemoryStore.delete(oldestKey);
  }

  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    try {
      await pgQuery(
        `INSERT INTO public.idempotency_records
           (idempotency_key, action_scope, actor_email, target_id, response_json, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), $6)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          scopedKey,
          params.actionScope,
          params.actorEmail,
          params.targetId || null,
          JSON.stringify(params.response),
          new Date(expiresAt)
        ]
      );
    } catch {
      // ignore if table not yet migrated
    }
  }
}
