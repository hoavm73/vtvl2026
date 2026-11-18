import { isDatabaseConfigured, pgQuery, withPgTransaction } from './prisma';
import { isIsolatedLocalMode } from './server-ticket-db';

export type BackgroundJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface BackgroundJobRecord {
  id: string;
  jobType: string;
  unitCode: string;
  actorEmail: string;
  status: BackgroundJobStatus;
  progress: number;
  attempts: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

const localJobQueue = new Map<string, BackgroundJobRecord>();

export function resetBackgroundJobsStore(): void {
  localJobQueue.clear();
}

export async function enqueueBackgroundJob(params: {
  jobType: string;
  unitCode: string;
  actorEmail: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<BackgroundJobRecord> {
  const nowIso = new Date().toISOString();
  const job: BackgroundJobRecord = {
    id: `job-${params.unitCode.toUpperCase()}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    jobType: params.jobType,
    unitCode: params.unitCode.toUpperCase(),
    actorEmail: params.actorEmail.toLowerCase(),
    status: 'queued',
    progress: 0,
    attempts: 0,
    maxAttempts: Math.max(1, params.maxAttempts || 3),
    payload: params.payload,
    result: null,
    errorMessage: null,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    try {
      await pgQuery(
        `INSERT INTO public.background_jobs
           (id, job_type, unit_code, actor_email, status, progress, attempts, max_attempts, payload_json, run_after, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'queued', 0, 0, $5, $6::jsonb, NOW(), NOW(), NOW())`,
        [job.id, job.jobType, job.unitCode, job.actorEmail, job.maxAttempts, JSON.stringify(job.payload)]
      );
      return job;
    } catch {
      // Fallback sang localJobQueue nếu bảng chưa migrate
    }
  }

  localJobQueue.set(job.id, job);
  return job;
}

/**
 * Worker nhận job bằng `FOR UPDATE SKIP LOCKED` trên PostgreSQL để nhiều worker chạy song song không đụng job nhau.
 */
export async function claimNextQueuedBackgroundJob(jobType?: string): Promise<BackgroundJobRecord | null> {
  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    try {
      return await withPgTransaction(async (client) => {
        const sql = jobType
          ? `SELECT * FROM public.background_jobs
             WHERE status = 'queued' AND job_type = $1 AND run_after <= NOW() AND attempts < max_attempts
             ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
          : `SELECT * FROM public.background_jobs
             WHERE status = 'queued' AND run_after <= NOW() AND attempts < max_attempts
             ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`;
        const picked = await client.query(sql, jobType ? [jobType] : []);
        const row = picked.rows[0];
        if (!row) return null;

        const updated = await client.query(
          `UPDATE public.background_jobs
           SET status = 'running', attempts = attempts + 1, started_at = NOW(), updated_at = NOW()
           WHERE id = $1 RETURNING *`,
          [row.id]
        );
        const u = updated.rows[0] || row;
        return {
          id: String(u.id),
          jobType: String(u.job_type),
          unitCode: String(u.unit_code),
          actorEmail: String(u.actor_email),
          status: 'running',
          progress: Number(u.progress) || 0,
          attempts: Number(u.attempts) || 1,
          maxAttempts: Number(u.max_attempts) || 3,
          payload: (u.payload_json as Record<string, unknown>) || {},
          createdAt: new Date(u.created_at).toISOString(),
          updatedAt: new Date(u.updated_at).toISOString(),
          startedAt: u.started_at ? new Date(u.started_at).toISOString() : new Date().toISOString()
        };
      });
    } catch {
      // Fallback sang local queue
    }
  }

  for (const job of localJobQueue.values()) {
    if (job.status === 'queued' && (!jobType || job.jobType === jobType) && job.attempts < job.maxAttempts) {
      const nowIso = new Date().toISOString();
      job.status = 'running';
      job.attempts += 1;
      job.startedAt = nowIso;
      job.updatedAt = nowIso;
      return { ...job };
    }
  }
  return null;
}

export async function completeBackgroundJob(
  jobId: string,
  result: Record<string, unknown>,
  progress = 100
): Promise<BackgroundJobRecord | null> {
  const nowIso = new Date().toISOString();
  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    await pgQuery(
      `UPDATE public.background_jobs
       SET status = 'completed', progress = $2, result_json = $3::jsonb, completed_at = NOW(), updated_at = NOW(), error_message = NULL
       WHERE id = $1`,
      [jobId, progress, JSON.stringify(result)]
    ).catch(() => {});
  }
  const existing = localJobQueue.get(jobId);
  if (existing) {
    existing.status = 'completed';
    existing.progress = progress;
    existing.result = result;
    existing.errorMessage = null;
    existing.completedAt = nowIso;
    existing.updatedAt = nowIso;
    return { ...existing };
  }
  return null;
}

export async function failBackgroundJob(jobId: string, errorMessage: string): Promise<void> {
  const nowIso = new Date().toISOString();
  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    await pgQuery(
      `UPDATE public.background_jobs
       SET status = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'failed' END,
           error_message = $2,
           run_after = CASE WHEN attempts < max_attempts THEN NOW() + INTERVAL '5 seconds' ELSE run_after END,
           updated_at = NOW()
       WHERE id = $1`,
      [jobId, errorMessage.slice(0, 1000)]
    ).catch(() => {});
  }
  const existing = localJobQueue.get(jobId);
  if (existing) {
    existing.status = existing.attempts < existing.maxAttempts ? 'queued' : 'failed';
    existing.errorMessage = errorMessage;
    existing.updatedAt = nowIso;
  }
}

export async function getBackgroundJobById(jobId: string): Promise<BackgroundJobRecord | null> {
  if (!isIsolatedLocalMode() && isDatabaseConfigured()) {
    try {
      const res = await pgQuery(`SELECT * FROM public.background_jobs WHERE id = $1 LIMIT 1`, [jobId]);
      const u = res.rows[0];
      if (u) {
        return {
          id: String(u.id),
          jobType: String(u.job_type),
          unitCode: String(u.unit_code),
          actorEmail: String(u.actor_email),
          status: u.status as BackgroundJobStatus,
          progress: Number(u.progress) || 0,
          attempts: Number(u.attempts) || 0,
          maxAttempts: Number(u.max_attempts) || 3,
          payload: (u.payload_json as Record<string, unknown>) || {},
          result: (u.result_json as Record<string, unknown>) || null,
          errorMessage: u.error_message ? String(u.error_message) : null,
          createdAt: new Date(u.created_at).toISOString(),
          updatedAt: new Date(u.updated_at).toISOString(),
          startedAt: u.started_at ? new Date(u.started_at).toISOString() : null,
          completedAt: u.completed_at ? new Date(u.completed_at).toISOString() : null
        };
      }
    } catch {
      // Fallback sang local map
    }
  }
  const found = localJobQueue.get(jobId);
  return found ? { ...found } : null;
}
