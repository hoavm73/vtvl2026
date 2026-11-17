-- ==============================================================================
-- BẢN ROLLBACK AN TOÀN:
-- Hoàn tác các đối tượng được bổ sung bởi 20261115210000_add_vtvl_coordination_proposals.sql
-- ==============================================================================

BEGIN;

DROP POLICY IF EXISTS "rls_work_survey_coordinated_vtvls_select" ON public.work_survey_coordinated_vtvls;
DROP POLICY IF EXISTS "service_role_full_work_survey_coordinated_vtvls" ON public.work_survey_coordinated_vtvls;
DROP POLICY IF EXISTS "rls_user_vtvl_assignments_manage" ON public.user_vtvl_assignments;
DROP POLICY IF EXISTS "rls_user_vtvl_assignments_select" ON public.user_vtvl_assignments;
DROP POLICY IF EXISTS "service_role_full_user_vtvl_assignments" ON public.user_vtvl_assignments;

DROP TABLE IF EXISTS public.work_survey_coordinated_vtvls;
DROP TABLE IF EXISTS public.user_vtvl_assignments;

ALTER TABLE IF EXISTS public.staff_work_tickets DROP COLUMN IF EXISTS coordinated_vtvls;
ALTER TABLE IF EXISTS public.staff_work_tickets DROP COLUMN IF EXISTS coordination_note;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261115210000';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
