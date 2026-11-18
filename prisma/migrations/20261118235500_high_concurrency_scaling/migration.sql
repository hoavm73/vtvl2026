-- Migration: High-Concurrency Scaling for HCM-UTE VTVL 360 (15,000-20,000 tickets, 60,000-100,000 versions/history)
-- Date: 2026-11-18
-- Note: Standalone CONCURRENTLY index statements and pre-migration duplicate check queries are also provided in
-- scripts/check-duplicates-and-index-concurrently.sql for zero-downtime Production execution outside transaction blocks.

-- 1. Atomic task code counter table per (unit_code, mission_code)
CREATE TABLE IF NOT EXISTS public.unit_mission_counters (
  unit_code VARCHAR(50) NOT NULL,
  mission_code VARCHAR(80) NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (unit_code, mission_code)
);

-- Seed unit_mission_counters from existing staff_work_tickets so new allocations never collide with historical CV codes
INSERT INTO public.unit_mission_counters (unit_code, mission_code, last_seq, updated_at)
SELECT
  UPPER(TRIM(unit_code)) AS unit_code,
  UPPER(TRIM(ma_nhiem_vu)) AS mission_code,
  MAX(
     COALESCE(
       NULLIF(SUBSTRING(TRIM(ma_cong_viec) FROM '\.CV([0-9]+)$'), '')::INTEGER,
       0
     )
  ) AS last_seq,
  NOW()
FROM public.staff_work_tickets
WHERE TRIM(unit_code) <> '' AND TRIM(ma_nhiem_vu) <> ''
GROUP BY UPPER(TRIM(unit_code)), UPPER(TRIM(ma_nhiem_vu))
ON CONFLICT (unit_code, mission_code)
DO UPDATE SET
  last_seq = GREATEST(public.unit_mission_counters.last_seq, EXCLUDED.last_seq),
  updated_at = NOW();

-- 2. Idempotency records table for submit, approve, merge, and batch reconcile
CREATE TABLE IF NOT EXISTS public.idempotency_records (
  idempotency_key VARCHAR(180) PRIMARY KEY,
  action_scope VARCHAR(80) NOT NULL,
  actor_email VARCHAR(255) NOT NULL,
  target_id VARCHAR(120),
  response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at
  ON public.idempotency_records (expires_at);

-- 3. PostgreSQL Background Job Queue table (FOR UPDATE SKIP LOCKED worker pattern)
CREATE TABLE IF NOT EXISTS public.background_jobs (
  id VARCHAR(120) PRIMARY KEY,
  job_type VARCHAR(80) NOT NULL,
  unit_code VARCHAR(50) NOT NULL,
  actor_email VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_json JSONB,
  error_message TEXT,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bg_jobs_status_run_after
  ON public.background_jobs (status, run_after, created_at);

-- 4. High-concurrency pagination, history, and pending-merge partial indexes
CREATE INDEX IF NOT EXISTS idx_tickets_unit_status_updated
  ON public.staff_work_tickets (unit_code, status, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_owner_updated
  ON public.staff_work_tickets (owner_email, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_status_history_survey_created
  ON public.work_survey_status_history (survey_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_pending_merge
  ON public.staff_work_tickets (unit_code, approved_at)
  WHERE status = 'approved' AND is_merged_to_b1_b2 = false AND is_archived = false;
