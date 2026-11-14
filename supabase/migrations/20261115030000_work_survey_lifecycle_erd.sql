-- ==============================================================================
-- BẢN MIGRATION QUY TRÌNH PHIẾU CÔNG VIỆC: WORK SURVEY LIFECYCLE & AUDIT HISTORY
-- Hệ thống: HCM-UTE VTVL 360 (Trường Đại học Công nghệ Kỹ thuật TP.HCM)
-- Ngày ban hành: 15/11/2026
-- Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW
--
-- Mục tiêu:
--   1. Mở rộng bảng public.staff_work_tickets với đầy đủ các trường quản lý vòng đời:
--      submitted_at, resubmitted_at, approved_at, approved_by, revision_reason,
--      revision_requested_at, revision_requested_by, merged_at, merged_by,
--      b1_row_id, b2_row_id, unit_id, owner_id.
--   2. Tạo bảng nhật ký lịch sử trạng thái: public.work_survey_status_history.
--   3. Tạo bảng liên kết gộp dữ liệu B1/B2: public.work_survey_merge_links.
--   4. Check constraints chuẩn hóa: draft, submitted, changes_requested, resubmitted, approved.
--   5. Thiết lập các RPC Security Definer kiểm tra phân quyền đa tầng và ghi log trong transaction.
--   6. Backfill an toàn dữ liệu phiếu hiện có.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. MỞ RỘNG BẢNG PHIẾU CÔNG VIỆC: public.staff_work_tickets
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff_work_tickets') THEN
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS unit_id VARCHAR(50);
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS owner_id VARCHAR(255);
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS source_ticket_id VARCHAR(100);
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ;
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS revision_reason TEXT;
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMPTZ;
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS revision_requested_by VARCHAR(255);
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS merged_by VARCHAR(255);
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS b1_row_id VARCHAR(100);
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS b2_row_id VARCHAR(100);
    ALTER TABLE public.staff_work_tickets ADD COLUMN IF NOT EXISTS is_merged_to_b1_b2 BOOLEAN NOT NULL DEFAULT FALSE;

    -- Đồng bộ dữ liệu canonical giữa unit_id <-> unit_code, owner_id <-> owner_email
    UPDATE public.staff_work_tickets
    SET
      unit_id = COALESCE(unit_id, unit_code),
      owner_id = COALESCE(owner_id, owner_email),
      source_ticket_id = COALESCE(source_ticket_id, id)
    WHERE unit_id IS NULL OR owner_id IS NULL OR source_ticket_id IS NULL;

    -- Cập nhật ràng buộc trạng thái chuẩn hóa hỗ trợ cả 5 trạng thái canonical và tiếng Việt
    ALTER TABLE public.staff_work_tickets DROP CONSTRAINT IF EXISTS chk_staff_work_tickets_status;
    ALTER TABLE public.staff_work_tickets
      ADD CONSTRAINT chk_staff_work_tickets_status
      CHECK (status IN (
        'draft', 'submitted', 'changes_requested', 'resubmitted', 'approved',
        'Nháp', 'Đã nộp', 'Yêu cầu bổ sung', 'Đã nộp lại', 'Đã duyệt', 'Trả lại'
      ));

    -- Tạo các chỉ mục tối ưu truy vấn
    CREATE INDEX IF NOT EXISTS idx_swt_owner_id ON public.staff_work_tickets(owner_id);
    CREATE INDEX IF NOT EXISTS idx_swt_unit_id ON public.staff_work_tickets(unit_id);
    CREATE INDEX IF NOT EXISTS idx_swt_status ON public.staff_work_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_swt_submitted_at ON public.staff_work_tickets(submitted_at);
    CREATE INDEX IF NOT EXISTS idx_swt_approved_at ON public.staff_work_tickets(approved_at);
    CREATE INDEX IF NOT EXISTS idx_swt_unit_status ON public.staff_work_tickets(unit_code, status);
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. TẠO BẢNG LỊCH SỬ TRẠNG THÁI: public.work_survey_status_history
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_survey_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id VARCHAR(100) NOT NULL REFERENCES public.staff_work_tickets(id) ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  reason TEXT,
  actor_id VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) NOT NULL,
  unit_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wssh_survey_id ON public.work_survey_status_history(survey_id);
CREATE INDEX IF NOT EXISTS idx_wssh_unit_id ON public.work_survey_status_history(unit_id);
CREATE INDEX IF NOT EXISTS idx_wssh_created_at ON public.work_survey_status_history(created_at DESC);

-- Bật RLS cho work_survey_status_history: chỉ đọc, cấm sửa và xóa
ALTER TABLE public.work_survey_status_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.work_survey_status_history TO authenticated;

DROP POLICY IF EXISTS "wssh_select_policy" ON public.work_survey_status_history;
CREATE POLICY "wssh_select_policy" ON public.work_survey_status_history
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR unit_id = public.get_current_user_unit()
  );

DROP POLICY IF EXISTS "wssh_insert_policy" ON public.work_survey_status_history;
CREATE POLICY "wssh_insert_policy" ON public.work_survey_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_user()
    OR unit_id = public.get_current_user_unit()
  );

-- ------------------------------------------------------------------------------
-- 3. TẠO BẢNG LIÊN KẾT GỘP B1/B2: public.work_survey_merge_links
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_survey_merge_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id VARCHAR(100) NOT NULL REFERENCES public.staff_work_tickets(id) ON DELETE CASCADE,
  target_sheet VARCHAR(10) NOT NULL CHECK (target_sheet IN ('B1', 'B2', 'A2')),
  target_record_id VARCHAR(100) NOT NULL,
  source_version INT NOT NULL DEFAULT 1,
  merged_by VARCHAR(255) NOT NULL,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_survey_target_sheet UNIQUE (survey_id, target_sheet)
);

CREATE INDEX IF NOT EXISTS idx_wsml_survey_id ON public.work_survey_merge_links(survey_id);
CREATE INDEX IF NOT EXISTS idx_wsml_target ON public.work_survey_merge_links(target_sheet, target_record_id);

ALTER TABLE public.work_survey_merge_links ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.work_survey_merge_links TO authenticated;

DROP POLICY IF EXISTS "wsml_select_policy" ON public.work_survey_merge_links;
CREATE POLICY "wsml_select_policy" ON public.work_survey_merge_links
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user()
    OR EXISTS (
      SELECT 1 FROM public.staff_work_tickets
      WHERE id = survey_id AND unit_code = public.get_current_user_unit()
    )
  );

-- ------------------------------------------------------------------------------
-- 4. CÁC THỦ TỤC RPC SECURITY DEFINER QUẢN LÝ VÒNG ĐỜI PHIẾU
-- ------------------------------------------------------------------------------

-- 4.1 RPC: Cán bộ nộp hoặc nộp lại phiếu
CREATE OR REPLACE FUNCTION public.rpc_submit_work_survey(
  p_ticket_id text,
  p_is_resubmit boolean DEFAULT false
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
  v_action text;
BEGIN
  v_caller_email := lower(public.get_current_user_email());
  v_caller_role := public.get_current_user_role();
  v_caller_unit := public.get_current_user_unit();

  IF v_caller_email = '' THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập để nộp phiếu.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ticket FROM public.staff_work_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy phiếu %', p_ticket_id USING ERRCODE = 'P0002';
  END IF;

  -- Kiểm tra quyền sở hữu
  IF v_caller_role <> 'admin' AND lower(v_ticket.owner_email) <> v_caller_email THEN
    RAISE EXCEPTION 'Bạn chỉ có quyền nộp phiếu do chính mình tạo.' USING ERRCODE = '42501';
  END IF;

  -- Kiểm tra luồng trạng thái
  IF p_is_resubmit THEN
    IF v_ticket.status NOT IN ('changes_requested', 'Yêu cầu bổ sung', 'Trả lại') THEN
      RAISE EXCEPTION 'Chỉ phiếu có yêu cầu bổ sung mới được nộp lại.' USING ERRCODE = '22023';
    END IF;
    v_new_status := 'resubmitted';
    v_action := 'RESUBMIT';
  ELSE
    IF v_ticket.status NOT IN ('draft', 'Nháp') THEN
      RAISE EXCEPTION 'Chỉ phiếu Nháp mới được nộp lần đầu.' USING ERRCODE = '22023';
    END IF;
    v_new_status := 'submitted';
    v_action := 'SUBMIT';
  END IF;

  UPDATE public.staff_work_tickets
  SET
    status = v_new_status,
    submitted_at = CASE WHEN NOT p_is_resubmit THEN NOW() ELSE submitted_at END,
    resubmitted_at = CASE WHEN p_is_resubmit THEN NOW() ELSE resubmitted_at END,
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  -- Ghi nhận lịch sử trạng thái
  INSERT INTO public.work_survey_status_history (
    survey_id, from_status, to_status, action, actor_id, actor_role, unit_id
  ) VALUES (
    v_ticket.id, v_ticket.status, v_new_status, v_action, v_caller_email, v_caller_role, v_ticket.unit_code
  );

  RETURN to_jsonb(v_ticket);
END;
$$;

-- 4.2 RPC: Lãnh đạo hoặc Admin yêu cầu bổ sung phiếu
CREATE OR REPLACE FUNCTION public.rpc_request_work_survey_changes(
  p_ticket_id text,
  p_reason text
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
  v_clean_reason text;
BEGIN
  v_caller_email := lower(public.get_current_user_email());
  v_caller_role := public.get_current_user_role();
  v_caller_unit := public.get_current_user_unit();
  v_clean_reason := trim(p_reason);

  IF v_caller_email = '' THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập để thực hiện.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role = 'staff' THEN
    RAISE EXCEPTION 'Cán bộ không có quyền yêu cầu bổ sung phiếu.' USING ERRCODE = '42501';
  END IF;

  IF v_clean_reason = '' OR v_clean_reason IS NULL THEN
    RAISE EXCEPTION 'Lý do yêu cầu bổ sung là bắt buộc và không được để trống.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ticket FROM public.staff_work_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy phiếu %', p_ticket_id USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role <> 'admin' AND v_ticket.unit_code <> v_caller_unit THEN
    RAISE EXCEPTION 'Lãnh đạo chỉ thao tác trên phiếu thuộc đơn vị mình.' USING ERRCODE = '42501';
  END IF;

  IF v_ticket.status NOT IN ('submitted', 'resubmitted', 'Đã nộp', 'Đã nộp lại') THEN
    RAISE EXCEPTION 'Chỉ phiếu Đã nộp hoặc Đã nộp lại mới có thể yêu cầu bổ sung.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.staff_work_tickets
  SET
    status = 'changes_requested',
    revision_reason = v_clean_reason,
    revision_requested_at = NOW(),
    revision_requested_by = v_caller_email,
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  INSERT INTO public.work_survey_status_history (
    survey_id, from_status, to_status, action, reason, actor_id, actor_role, unit_id
  ) VALUES (
    v_ticket.id, v_ticket.status, 'changes_requested', 'REQUEST_CHANGES', v_clean_reason, v_caller_email, v_caller_role, v_ticket.unit_code
  );

  RETURN to_jsonb(v_ticket);
END;
$$;

-- 4.3 RPC: Lãnh đạo hoặc Admin duyệt phiếu (Chặn Lãnh đạo tự duyệt phiếu mình)
CREATE OR REPLACE FUNCTION public.rpc_approve_work_survey(
  p_ticket_id text
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
BEGIN
  v_caller_email := lower(public.get_current_user_email());
  v_caller_role := public.get_current_user_role();
  v_caller_unit := public.get_current_user_unit();

  IF v_caller_email = '' THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập để duyệt phiếu.' USING ERRCODE = '42501';
  END IF;

  IF v_caller_role = 'staff' THEN
    RAISE EXCEPTION 'Cán bộ không có quyền phê duyệt phiếu.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ticket FROM public.staff_work_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy phiếu %', p_ticket_id USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role <> 'admin' AND v_ticket.unit_code <> v_caller_unit THEN
    RAISE EXCEPTION 'Lãnh đạo đơn vị chỉ có quyền duyệt phiếu thuộc đơn vị của mình.' USING ERRCODE = '42501';
  END IF;

  -- QUY TẮC BẢO MẬT P0: LÃNH ĐẠO ĐƠN VỊ KHÔNG ĐƯỢC TỰ DUYỆT PHIẾU CỦA CHÍNH MÌNH
  IF v_caller_role <> 'admin' AND lower(v_ticket.owner_email) = v_caller_email THEN
    RAISE EXCEPTION 'FORBIDDEN_SELF_REVIEW: Lãnh đạo đơn vị không thể tự duyệt phiếu của chính mình. Vui lòng chuyển Phòng TCNS phê duyệt.' USING ERRCODE = '42501';
  END IF;

  IF v_ticket.status NOT IN ('submitted', 'resubmitted', 'Đã nộp', 'Đã nộp lại') THEN
    RAISE EXCEPTION 'Chỉ phiếu Đã nộp hoặc Đã nộp lại mới có thể phê duyệt.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.staff_work_tickets
  SET
    status = 'approved',
    approved_by = v_caller_email,
    approved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  INSERT INTO public.work_survey_status_history (
    survey_id, from_status, to_status, action, actor_id, actor_role, unit_id
  ) VALUES (
    v_ticket.id, v_ticket.status, 'approved', 'APPROVE', v_caller_email, v_caller_role, v_ticket.unit_code
  );

  RETURN to_jsonb(v_ticket);
END;
$$;

-- 4.4 RPC: Gộp phiếu đã duyệt vào B1/B2 (idempotent, không trùng lặp)
CREATE OR REPLACE FUNCTION public.rpc_merge_work_survey_to_b1_b2(
  p_ticket_id text
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
BEGIN
  v_caller_email := lower(public.get_current_user_email());
  v_caller_role := public.get_current_user_role();
  v_caller_unit := public.get_current_user_unit();

  IF v_caller_role = 'staff' THEN
    RAISE EXCEPTION 'Cán bộ không có quyền gộp phiếu vào biểu của đơn vị.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_ticket FROM public.staff_work_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy phiếu %', p_ticket_id USING ERRCODE = 'P0002';
  END IF;

  IF v_caller_role <> 'admin' AND v_ticket.unit_code <> v_caller_unit THEN
    RAISE EXCEPTION 'Lãnh đạo chỉ được gộp phiếu thuộc đơn vị mình.' USING ERRCODE = '42501';
  END IF;

  IF v_ticket.status NOT IN ('approved', 'Đã duyệt') THEN
    RAISE EXCEPTION 'FORBIDDEN_UNAPPROVED_MERGE: Chỉ phiếu Đã duyệt mới được phép gộp vào B1/B2.' USING ERRCODE = '22023';
  END IF;

  -- Cập nhật thông tin gộp vào bảng phiếu
  UPDATE public.staff_work_tickets
  SET
    is_merged_to_b1_b2 = TRUE,
    merged_by = v_caller_email,
    merged_at = NOW(),
    b1_row_id = 'b1-' || v_ticket.id,
    b2_row_id = 'a2-' || v_ticket.id,
    updated_at = NOW()
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  -- Ghi hoặc cập nhật liên kết gộp vào work_survey_merge_links (Idempotent ON CONFLICT)
  INSERT INTO public.work_survey_merge_links (
    survey_id, target_sheet, target_record_id, source_version, merged_by, merged_at, updated_at
  ) VALUES
    (v_ticket.id, 'B1', 'b1-' || v_ticket.id, 1, v_caller_email, NOW(), NOW()),
    (v_ticket.id, 'B2', 'a2-' || v_ticket.id, 1, v_caller_email, NOW(), NOW())
  ON CONFLICT (survey_id, target_sheet)
  DO UPDATE SET
    target_record_id = EXCLUDED.target_record_id,
    merged_by = EXCLUDED.merged_by,
    updated_at = NOW();

  INSERT INTO public.work_survey_status_history (
    survey_id, from_status, to_status, action, actor_id, actor_role, unit_id
  ) VALUES (
    v_ticket.id, v_ticket.status, v_ticket.status, 'MERGE_B1_B2', v_caller_email, v_caller_role, v_ticket.unit_code
  );

  RETURN to_jsonb(v_ticket);
END;
$$;
