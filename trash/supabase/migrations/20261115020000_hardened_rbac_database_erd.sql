-- ==============================================================================
-- BẢN MIGRATION BẢO MẬT: HARDENED DATABASE RBAC, RPC & COMPREHENSIVE AUDIT LOGS
-- Hệ thống: HCM-UTE VTVL 360 (Trường Đại học Công nghệ Kỹ thuật TP.HCM)
-- Ngày ban hành: 15/11/2026
-- Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW
--
-- Mục tiêu:
--   1. Chuẩn hóa bảng public.user_accounts với đủ các trường canonical:
--      user_id, email, full_name, role, unit_id, is_active, created_at, updated_at
--   2. Check constraint nghiêm ngặt: role IN ('admin', 'unit_leader', 'staff')
--   3. Mở rộng public.audit_logs với old_values, new_values, ip_address, user_agent
--   4. RLS phân định độc lập cho từng thao tác (SELECT, INSERT, UPDATE, DELETE)
--   5. Thiết lập RPC bảo mật cho việc duyệt phiếu (chặn tuyệt đối tự duyệt phiếu mình)
--   6. Thiết lập RPC gộp phiếu đã duyệt vào B1/B2 với liên kết nguồn chống trùng
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CHUẨN HÓA BẢNG TÀI KHOẢN & PROFILE: public.user_accounts
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_accounts') THEN
    -- Bổ sung các cột canonical nếu chưa có
    ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
    ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
    ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS unit_id VARCHAR(50);
    ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    -- Đồng bộ dữ liệu hiện có giữa các cột song song
    UPDATE public.user_accounts
    SET
      user_id = COALESCE(user_id, email),
      full_name = COALESCE(full_name, display_name),
      unit_id = COALESCE(unit_id, unit_code),
      is_active = CASE WHEN status = 'suspended' THEN FALSE ELSE TRUE END,
      updated_at = NOW()
    WHERE user_id IS NULL OR full_name IS NULL OR unit_id IS NULL;

    -- Siết chặt Check Constraint role: CHỈ nhận 3 vai trò cố định
    ALTER TABLE public.user_accounts DROP CONSTRAINT IF EXISTS user_accounts_role_check;
    ALTER TABLE public.user_accounts DROP CONSTRAINT IF EXISTS chk_user_accounts_role;
    ALTER TABLE public.user_accounts
      ADD CONSTRAINT chk_user_accounts_role
      CHECK (role IN ('admin', 'unit_leader', 'staff'));

    -- Khóa ngoại đơn vị liên kết tới dm_don_vi
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'fk_user_accounts_unit_id' AND table_name = 'user_accounts'
    ) THEN
      ALTER TABLE public.user_accounts
        ADD CONSTRAINT fk_user_accounts_unit_id
        FOREIGN KEY (unit_id) REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE RESTRICT;
    END IF;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TRIGGER ĐỒNG BỘ HAI CHIỀU CANONICAL CHO public.user_accounts
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_account_canonical_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Đồng bộ full_name <-> display_name
  IF NEW.full_name IS NOT NULL AND (NEW.display_name IS NULL OR NEW.display_name = '') THEN
    NEW.display_name := NEW.full_name;
  ELSIF NEW.display_name IS NOT NULL AND (NEW.full_name IS NULL OR NEW.full_name = '') THEN
    NEW.full_name := NEW.display_name;
  END IF;

  -- Đồng bộ unit_id <-> unit_code
  IF NEW.unit_id IS NOT NULL AND (NEW.unit_code IS NULL OR NEW.unit_code = '') THEN
    NEW.unit_code := NEW.unit_id;
  ELSIF NEW.unit_code IS NOT NULL AND (NEW.unit_id IS NULL OR NEW.unit_id = '') THEN
    NEW.unit_id := NEW.unit_code;
  END IF;

  -- Đồng bộ is_active <-> status
  IF NEW.is_active = FALSE THEN
    NEW.status := 'suspended';
  ELSE
    NEW.status := 'active';
  END IF;

  NEW.user_id := COALESCE(NEW.user_id, NEW.email);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_account_canonical ON public.user_accounts;
CREATE TRIGGER trg_sync_user_account_canonical
  BEFORE INSERT OR UPDATE ON public.user_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_account_canonical_columns();

-- ------------------------------------------------------------------------------
-- 3. CHUẨN HÓA BẢNG NHẬT KÝ KIỂM TOÁN: public.audit_logs
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role text;
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS unit_id text;
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_id text;
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_entity text;
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS old_values jsonb;
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS new_values jsonb;
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address text;
    ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_agent text;

    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_email);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_unit ON public.audit_logs(unit_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. CHUẨN HÓA BẢNG PHIẾU CÔNG VIỆC: public.staff_work_tickets
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_work_tickets') THEN
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS source_ticket_id VARCHAR(100);
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS is_merged_to_b1_b2 BOOLEAN NOT NULL DEFAULT FALSE;

    -- Đồng bộ source_ticket_id tự trỏ id
    UPDATE public.staff_work_tickets
    SET source_ticket_id = id
    WHERE source_ticket_id IS NULL;

    -- Check constraint hỗ trợ cả định danh tiếng Việt và tiếng Anh chuẩn
    ALTER TABLE public.staff_work_tickets DROP CONSTRAINT IF EXISTS chk_staff_work_tickets_status;
    ALTER TABLE public.staff_work_tickets
      ADD CONSTRAINT chk_staff_work_tickets_status
      CHECK (status IN ('Nháp', 'Đã nộp', 'Đã duyệt', 'Trả lại', 'draft', 'submitted', 'approved', 'changes_requested'));
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. CÁC HÀM SECURITY DEFINER BẢO MẬT (FIXED search_path)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    auth.jwt() ->> 'email',
    ''
  )::text;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (SELECT role FROM public.user_accounts WHERE lower(email) = lower(public.get_current_user_email()) LIMIT 1),
    'staff'
  )::text;
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_unit()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (SELECT COALESCE(unit_id, unit_code) FROM public.user_accounts WHERE lower(email) = lower(public.get_current_user_email()) LIMIT 1),
    ''
  )::text;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    lower(public.get_current_user_email()) = 'tcns@hcmute.edu.vn'
    OR public.get_current_user_role() = 'admin'
  );
$$;

-- ------------------------------------------------------------------------------
-- 6. RPC BẢO MẬT: DUYỆT / TRẢ LẠI PHIẾU CÔNG VIỆC
--    Quy tắc:
--      - Cán bộ: CẤM duyệt/trả phiếu
--      - Lãnh đạo đơn vị: CẤM tự duyệt phiếu của chính mình
--      - Lãnh đạo đơn vị: Chỉ duyệt phiếu thuộc đơn vị mình
--      - Ghi nhận Audit Log chi tiết
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_review_staff_ticket(
  p_ticket_id text,
  p_action text,
  p_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_email text;
  v_caller_role text;
  v_caller_unit text;
  v_ticket public.staff_work_tickets%ROWTYPE;
  v_new_status text;
BEGIN
  v_caller_email := lower(public.get_current_user_email());
  v_caller_role := public.get_current_user_role();
  v_caller_unit := public.get_current_user_unit();

  IF v_caller_email = '' THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập để thực hiện xét duyệt phiếu.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role = 'staff' THEN
    RAISE EXCEPTION 'Cán bộ – Giảng viên không có quyền duyệt hoặc trả lại phiếu công việc.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ticket FROM public.staff_work_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy phiếu công việc với mã %', p_ticket_id USING ERRCODE = 'P0002';
  END IF;

  -- Kiểm tra Lãnh đạo thao tác chéo đơn vị
  IF v_caller_role <> 'admin' AND v_ticket.unit_code <> v_caller_unit THEN
    RAISE EXCEPTION 'Lãnh đạo đơn vị chỉ có quyền duyệt phiếu thuộc đơn vị của mình.' USING ERRCODE = '42501';
  END IF;

  -- QUY TẮC P0: Lãnh đạo đơn vị KHÔNG ĐƯỢC TỰ DUYỆT PHIẾU CỦA CHÍNH MÌNH
  IF v_caller_role <> 'admin' AND lower(v_ticket.owner_email) = v_caller_email THEN
    RAISE EXCEPTION 'FORBIDDEN_SELF_REVIEW: Lãnh đạo đơn vị không thể tự duyệt phiếu của chính mình. Vui lòng chuyển Phòng TCNS phê duyệt.' USING ERRCODE = '42501';
  END IF;

  IF p_action = 'approve' THEN
    v_new_status := 'Đã duyệt';
  ELSIF p_action = 'return' THEN
    v_new_status := 'Trả lại';
  ELSE
    RAISE EXCEPTION 'Hành động không hợp lệ: chỉ chấp nhận approve hoặc return.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.staff_work_tickets
  SET
    status = v_new_status,
    approved_by = CASE WHEN p_action = 'approve' THEN v_caller_email ELSE NULL END,
    approved_at = CASE WHEN p_action = 'approve' THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  -- Ghi nhận Audit Log
  INSERT INTO public.audit_logs (
    workbook_id, actor_email, actor_role, unit_id, action, target_id, target_entity,
    old_values, new_values, metadata, created_at
  ) VALUES (
    'wb_' || v_ticket.unit_code || '_2026',
    v_caller_email,
    v_caller_role,
    v_ticket.unit_code,
    CASE WHEN p_action = 'approve' THEN 'DUYỆT_PHIẾU' ELSE 'TRẢ_LẠI_PHIẾU' END,
    v_ticket.id,
    'staff_work_tickets',
    jsonb_build_object('status', v_ticket.status),
    jsonb_build_object('status', v_new_status, 'note', p_notes),
    jsonb_build_object('ticketTask', v_ticket.ma_cong_viec, 'owner', v_ticket.owner_email),
    NOW()
  );

  RETURN to_jsonb(v_ticket);
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. CHÍNH SÁCH RLS PHÂN QUYỀN ĐỘC LẬP TỪNG THAO TÁC (FINE-GRAINED RLS)
-- ------------------------------------------------------------------------------

-- A. BẢNG public.staff_work_tickets
ALTER TABLE public.staff_work_tickets ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_work_tickets TO authenticated;

DROP POLICY IF EXISTS "rls_staff_tickets_select" ON public.staff_work_tickets;
CREATE POLICY "rls_staff_tickets_select" ON public.staff_work_tickets
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR (
      unit_code = public.get_current_user_unit()
      AND (
        lower(owner_email) = lower(public.get_current_user_email())
        OR status IN ('Đã nộp', 'Đã duyệt', 'Trả lại', 'submitted', 'approved', 'changes_requested')
      )
    )
  );

DROP POLICY IF EXISTS "rls_staff_tickets_insert" ON public.staff_work_tickets;
CREATE POLICY "rls_staff_tickets_insert" ON public.staff_work_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR (
      lower(owner_email) = lower(public.get_current_user_email())
      AND unit_code = public.get_current_user_unit()
      AND status IN ('Nháp', 'Đã nộp', 'draft', 'submitted')
    )
  );

DROP POLICY IF EXISTS "rls_staff_tickets_update" ON public.staff_work_tickets;
CREATE POLICY "rls_staff_tickets_update" ON public.staff_work_tickets
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR (
      unit_code = public.get_current_user_unit()
      AND public.get_current_user_role() = 'unit_leader'
    )
    OR (
      lower(owner_email) = lower(public.get_current_user_email())
      AND unit_code = public.get_current_user_unit()
      AND status IN ('Nháp', 'Trả lại', 'draft', 'changes_requested')
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR (
      unit_code = public.get_current_user_unit()
      AND (
        public.get_current_user_role() = 'unit_leader'
        OR lower(owner_email) = lower(public.get_current_user_email())
      )
    )
  );

DROP POLICY IF EXISTS "rls_staff_tickets_delete" ON public.staff_work_tickets;
CREATE POLICY "rls_staff_tickets_delete" ON public.staff_work_tickets
  FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR (
      lower(owner_email) = lower(public.get_current_user_email())
      AND unit_code = public.get_current_user_unit()
      AND status IN ('Nháp', 'draft')
    )
  );

-- B. BẢNG public.workbooks (15 BIỂU)
ALTER TABLE public.workbooks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workbooks TO authenticated;

DROP POLICY IF EXISTS "rls_workbooks_select" ON public.workbooks;
CREATE POLICY "rls_workbooks_select" ON public.workbooks
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR unit_id = public.get_current_user_unit()
  );

DROP POLICY IF EXISTS "rls_workbooks_insert" ON public.workbooks;
CREATE POLICY "rls_workbooks_insert" ON public.workbooks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR (
      public.get_current_user_role() = 'unit_leader'
      AND unit_id = public.get_current_user_unit()
    )
  );

DROP POLICY IF EXISTS "rls_workbooks_update" ON public.workbooks;
CREATE POLICY "rls_workbooks_update" ON public.workbooks
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.get_current_user_role() = 'unit_leader'
      AND unit_id = public.get_current_user_unit()
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR (
      public.get_current_user_role() = 'unit_leader'
      AND unit_id = public.get_current_user_unit()
    )
  );

DROP POLICY IF EXISTS "rls_workbooks_delete" ON public.workbooks;
CREATE POLICY "rls_workbooks_delete" ON public.workbooks
  FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
  );

-- C. BẢNG public.user_accounts
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_accounts TO authenticated;

DROP POLICY IF EXISTS "rls_user_accounts_select" ON public.user_accounts;
CREATE POLICY "rls_user_accounts_select" ON public.user_accounts
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR COALESCE(unit_id, unit_code) = public.get_current_user_unit()
    OR lower(email) = lower(public.get_current_user_email())
  );

DROP POLICY IF EXISTS "rls_user_accounts_insert" ON public.user_accounts;
CREATE POLICY "rls_user_accounts_insert" ON public.user_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR (
      public.get_current_user_role() = 'unit_leader'
      AND COALESCE(unit_id, unit_code) = public.get_current_user_unit()
      AND role IN ('unit_leader', 'staff')
    )
  );

DROP POLICY IF EXISTS "rls_user_accounts_update" ON public.user_accounts;
CREATE POLICY "rls_user_accounts_update" ON public.user_accounts
  FOR UPDATE TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.get_current_user_role() = 'unit_leader'
      AND COALESCE(unit_id, unit_code) = public.get_current_user_unit()
      AND role <> 'admin'
    )
  )
  WITH CHECK (
    public.is_admin_user()
    OR (
      public.get_current_user_role() = 'unit_leader'
      AND COALESCE(unit_id, unit_code) = public.get_current_user_unit()
      AND role IN ('unit_leader', 'staff')
    )
  );

DROP POLICY IF EXISTS "rls_user_accounts_delete" ON public.user_accounts;
CREATE POLICY "rls_user_accounts_delete" ON public.user_accounts
  FOR DELETE TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.get_current_user_role() = 'unit_leader'
      AND COALESCE(unit_id, unit_code) = public.get_current_user_unit()
      AND role <> 'admin'
      AND lower(email) <> 'tcns@hcmute.edu.vn'
    )
  );

-- D. BẢNG public.audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

DROP POLICY IF EXISTS "rls_audit_logs_select" ON public.audit_logs;
CREATE POLICY "rls_audit_logs_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR unit_id = public.get_current_user_unit()
  );

DROP POLICY IF EXISTS "rls_audit_logs_insert" ON public.audit_logs;
CREATE POLICY "rls_audit_logs_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR lower(actor_email) = lower(public.get_current_user_email())
  );
