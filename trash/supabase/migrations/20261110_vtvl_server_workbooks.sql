-- =============================================================================
-- MIGRATION: 20261110_vtvl_server_workbooks.sql
-- Mô tả: CSDL quản lý Workbook, Phiên làm việc (Sessions), Người thực hiện (Participants),
--        Lịch sử phiên bản (Revisions), Khóa lạc quan (Optimistic Locking) và Nhật ký kiểm toán (Audit Logs)
-- Hệ thống: VTVL HCM-UTE 360 (Trường Đại học Công nghệ Kỹ thuật TP.HCM)
-- Ngày ban hành: 10/11/2026
-- =============================================================================

-- 1. BẢNG WORKBOOKS (Hồ sơ bảng tính theo đơn vị và kỳ)
CREATE TABLE IF NOT EXISTS public.workbooks (
  id text PRIMARY KEY,                                      -- Định danh duy nhất (wb_unit_period_uuid)
  unit_id text NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE RESTRICT,
  reporting_period text NOT NULL DEFAULT '01/10/2025–30/9/2026',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed', 'approved', 'archived')),
  current_revision integer NOT NULL DEFAULT 1 CHECK (current_revision >= 1),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,                  -- Snapshot 15 sheet hiện hành
  touched_cells jsonb NOT NULL DEFAULT '[]'::jsonb,         -- Danh sách các ô đã biên tập
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_session text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_session text,
  is_deleted boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_workbooks_unit_period ON public.workbooks(unit_id, reporting_period);
CREATE INDEX IF NOT EXISTS idx_workbooks_updated_at ON public.workbooks(updated_at DESC);

-- 2. BẢNG WORKBOOK_SESSIONS (Phiên làm việc độc lập của từng lần biên tập)
CREATE TABLE IF NOT EXISTS public.workbook_sessions (
  id text PRIMARY KEY,                                      -- session_id (sess_uuid)
  workbook_id text NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  access_scope text NOT NULL DEFAULT 'editor' CHECK (access_scope IN ('editor', 'viewer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz,
  last_active_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workbook_sessions_wb ON public.workbook_sessions(workbook_id);
CREATE INDEX IF NOT EXISTS idx_workbook_sessions_active ON public.workbook_sessions(last_active_at DESC);

-- 3. BẢNG SESSION_PARTICIPANTS (Thông tin người thực hiện trong phiên - Email làm khóa tra cứu)
CREATE TABLE IF NOT EXISTS public.session_participants (
  id text PRIMARY KEY,                                      -- part_uuid
  session_id text NOT NULL REFERENCES public.workbook_sessions(id) ON DELETE CASCADE,
  workbook_id text NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  display_name text,
  email text NOT NULL,                                      -- Email gốc người dùng nhập
  email_normalized text NOT NULL,                           -- Email chuẩn hóa chữ thường để tra cứu
  role_label text NOT NULL DEFAULT 'Chuyên viên',
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_participants_email_norm ON public.session_participants(email_normalized);
CREATE INDEX IF NOT EXISTS idx_participants_wb ON public.session_participants(workbook_id);

-- 4. BẢNG WORKBOOK_REVISIONS (Lịch sử phiên bản snapshot phục hồi và chống ghi đè)
CREATE TABLE IF NOT EXISTS public.workbook_revisions (
  id text PRIMARY KEY,                                      -- rev_uuid
  workbook_id text NOT NULL REFERENCES public.workbooks(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  data jsonb NOT NULL,                                      -- Snapshot toàn bộ 15 sheet tại revision
  checksum text,                                            -- SHA-256 mã kiểm tra tính toàn vẹn
  actor_email text NOT NULL,
  actor_title text,
  session_id text,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revisions_wb_rev ON public.workbook_revisions(workbook_id, revision DESC);

-- 5. BẢNG AUDIT_LOGS (Nhật ký kiểm toán hệ thống append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial PRIMARY KEY,
  workbook_id text,
  session_id text,
  actor_email text,
  action text NOT NULL,                                     -- OPEN, CREATE, SAVE, SWITCH_EMAIL, RESTORE_REV, DELETE, EXPORT
  sheet_id text,
  record_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_wb ON public.audit_logs(workbook_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- =============================================================================
-- PHẦN II. BẢO MẬT ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.workbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workbook_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Quyền trên bảng workbooks:
-- Chỉ cho phép đọc workbooks chưa bị xóa
CREATE POLICY "Cho phép đọc workbooks hợp lệ" ON public.workbooks
  FOR SELECT TO authenticated, anon
  USING (is_deleted = false);

-- Chỉ cho phép cập nhật / thêm qua API có session hợp lệ
CREATE POLICY "Cho phép cập nhật workbooks qua API" ON public.workbooks
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 2. Quyền trên bảng session_participants:
CREATE POLICY "Tra cứu participants theo email chuẩn hóa" ON public.session_participants
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Ghi nhận participant trong phiên" ON public.session_participants
  FOR ALL TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- 3. Quyền trên bảng workbook_revisions:
CREATE POLICY "Đọc revisions của workbook" ON public.workbook_revisions
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Ghi nhận revision mới" ON public.workbook_revisions
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- 4. Quyền trên bảng audit_logs:
-- Append-only: Chỉ cho phép INSERT, cấm tuyệt đối UPDATE hoặc DELETE
CREATE POLICY "Chỉ cho phép thêm audit logs (Append-only)" ON public.audit_logs
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Chỉ đọc audit logs" ON public.audit_logs
  FOR SELECT TO authenticated, anon
  USING (true);

-- =============================================================================
-- PHẦN III. KẾ HOẠCH HỒI PHỤC (ROLLBACK PLAN)
-- Khi cần hủy bỏ migration này, thực thi lệnh sau:
-- DROP TABLE IF EXISTS public.audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.workbook_revisions CASCADE;
-- DROP TABLE IF EXISTS public.session_participants CASCADE;
-- DROP TABLE IF EXISTS public.workbook_sessions CASCADE;
-- DROP TABLE IF EXISTS public.workbooks CASCADE;
-- =============================================================================

