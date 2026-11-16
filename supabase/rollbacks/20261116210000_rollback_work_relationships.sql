-- ==============================================================================
-- ROLLBACK AN TOÀN CHO MIGRATION: 20261116210000_create_work_relationships.sql
-- Lưu ý:
-- 1. Gỡ 7 khóa ngoại (FK) và RPC mới thêm; tuyệt đối không xóa bảng dữ liệu.
-- 2. Phục hồi đầy đủ các giá trị gốc của approved_by, revision_requested_by, merged_by
--    và các bản ghi mồ côi trên work_relationships từ bảng migration_20261116210000_data_backup.
-- 3. Phục hồi chính xác trạng thái RLS (ENABLE/FORCE) và các policy trước migration.
-- ==============================================================================

BEGIN;

-- 1. Gỡ 7 khóa ngoại trước khi khôi phục dữ liệu gốc
ALTER TABLE public.staff_work_tickets
  DROP CONSTRAINT IF EXISTS fk_tickets_approved_by,
  DROP CONSTRAINT IF EXISTS fk_tickets_revision_requested_by,
  DROP CONSTRAINT IF EXISTS fk_tickets_merged_by;

ALTER TABLE public.work_relationships
  DROP CONSTRAINT IF EXISTS fk_work_rel_source_survey,
  DROP CONSTRAINT IF EXISTS fk_work_rel_target_survey,
  DROP CONSTRAINT IF EXISTS fk_work_rel_host_unit,
  DROP CONSTRAINT IF EXISTS fk_work_rel_target_unit;

-- 2. Gỡ RPC đồng bộ nguyên tử mới bổ sung
DROP FUNCTION IF EXISTS public.rpc_sync_workbook_atomic(TEXT, JSONB, JSONB, BOOLEAN);

-- 3. Khôi phục dữ liệu gốc trên staff_work_tickets và work_relationships từ bảng backup
DO $$
DECLARE
  rec RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'migration_20261116210000_data_backup'
  ) THEN
    -- 3.1. Khôi phục approved_by, revision_requested_by, merged_by trên staff_work_tickets
    UPDATE public.staff_work_tickets t
    SET
      approved_by = b.old_data->>'approved_by',
      revision_requested_by = b.old_data->>'revision_requested_by',
      merged_by = b.old_data->>'merged_by'
    FROM public.migration_20261116210000_data_backup b
    WHERE b.table_name = 'staff_work_tickets'
      AND b.action_taken = 'BACKUP_ACTOR_EMAILS'
      AND t.id = b.record_id;

    -- 3.2. Khôi phục các dòng work_relationships từng bị cách ly do mồ côi
    FOR rec IN
      SELECT old_data
      FROM public.migration_20261116210000_data_backup
      WHERE table_name = 'work_relationships'
        AND action_taken = 'QUARANTINE_ORPHAN_WORK_REL'
    LOOP
      INSERT INTO public.work_relationships
      SELECT * FROM jsonb_populate_record(NULL::public.work_relationships, rec.old_data)
      ON CONFLICT (id) DO NOTHING;
    END LOOP;

    -- 3.3. Khôi phục target_survey_id từng bị đưa về NULL
    UPDATE public.work_relationships wr
    SET target_survey_id = b.old_data->>'target_survey_id'
    FROM public.migration_20261116210000_data_backup b
    WHERE b.table_name = 'work_relationships'
      AND b.action_taken = 'NULLIFY_ORPHAN_TARGET_SURVEY'
      AND wr.id = b.record_id;
  END IF;
END $$;

-- 4. Phục hồi đúng policy và trạng thái RLS trước migration trên public.work_relationships
DROP POLICY IF EXISTS "rls_work_relationships_manage" ON public.work_relationships;
DROP POLICY IF EXISTS "rls_work_relationships_select" ON public.work_relationships;
DROP POLICY IF EXISTS "service_role_full_work_relationships" ON public.work_relationships;

DO $$
DECLARE
  v_flags JSONB;
  rec RECORD;
  v_roles TEXT;
  v_sql TEXT;
  v_restored_count INT := 0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'migration_20261116210000_data_backup'
  ) THEN
    -- Tái tạo các policy tồn tại trước migration (nếu có)
    FOR rec IN
      SELECT old_data
      FROM public.migration_20261116210000_data_backup
      WHERE table_name = 'rls_policy_snapshot'
        AND action_taken = 'SNAPSHOT_RLS_POLICY'
    LOOP
      SELECT string_agg(quote_ident(val), ', ')
      INTO v_roles
      FROM jsonb_array_elements_text(COALESCE(rec.old_data->'roles', '["public"]'::jsonb)) AS val;

      v_sql := format(
        'CREATE POLICY %I ON public.work_relationships AS %s FOR %s TO %s',
        rec.old_data->>'policyname',
        COALESCE(rec.old_data->>'permissive', 'PERMISSIVE'),
        COALESCE(rec.old_data->>'cmd', 'ALL'),
        COALESCE(v_roles, 'PUBLIC')
      );
      IF rec.old_data->>'qual' IS NOT NULL THEN
        v_sql := v_sql || format(' USING (%s)', rec.old_data->>'qual');
      END IF;
      IF rec.old_data->>'with_check' IS NOT NULL THEN
        v_sql := v_sql || format(' WITH CHECK (%s)', rec.old_data->>'with_check');
      END IF;
      EXECUTE v_sql;
      v_restored_count := v_restored_count + 1;
    END LOOP;

    -- Khôi phục cờ ENABLE / FORCE RLS theo đúng trạng thái trước migration
    SELECT old_data INTO v_flags
    FROM public.migration_20261116210000_data_backup
    WHERE table_name = 'rls_table_flags'
      AND record_id = 'public.work_relationships'
      AND action_taken = 'SNAPSHOT_RLS_FLAGS'
    LIMIT 1;

    IF v_flags IS NOT NULL AND COALESCE((v_flags->>'table_existed')::boolean, FALSE) = TRUE THEN
      IF COALESCE((v_flags->>'relforcerowsecurity')::boolean, FALSE) = FALSE THEN
        ALTER TABLE public.work_relationships NO FORCE ROW LEVEL SECURITY;
      END IF;
      IF COALESCE((v_flags->>'relrowsecurity')::boolean, FALSE) = FALSE THEN
        ALTER TABLE public.work_relationships DISABLE ROW LEVEL SECURITY;
      END IF;
    END IF;
  END IF;

  -- Nếu bảng vẫn bật RLS và trước đó chưa có policy nào, giữ lại policy cho service_role để không khóa backend
  IF v_restored_count = 0 THEN
    CREATE POLICY "service_role_full_work_relationships" ON public.work_relationships
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261116210000';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
