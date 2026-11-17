-- =============================================================================
-- HCM-UTE VTVL 360: MIGRATION BỔ SUNG PHÂN QUYỀN RBAC VÀ PHIẾU CÔNG VIỆC CÁ NHÂN
-- Ngày ban hành: 14/11/2026
-- Căn cứ: Quyết định phân quyền 3 nhóm, Hướng dẫn số 07-HD/BTCTW và Nghị định 232/2026/NĐ-CP
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BẢNG 23: public.user_accounts (Tài khoản người dùng, chức danh & vai trò RBAC)
-- Đồng bộ 1-1 giữa Chức danh (title) và Vai trò (role):
-- 'admin'       <-> 'Phòng Tổ chức – Nhân sự'
-- 'unit_leader' <-> 'Lãnh đạo đơn vị'
-- 'staff'       <-> 'Cán bộ – Giảng viên'
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_accounts (
    email VARCHAR(255) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE RESTRICT,
    unit_name_vi VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'unit_leader', 'staff')),
    title VARCHAR(100) NOT NULL,
    auth_provider VARCHAR(50) NOT NULL DEFAULT 'email' CHECK (auth_provider IN ('google', 'email')),
    avatar_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    has_selected_unit BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_unit ON public.user_accounts(unit_code);
CREATE INDEX IF NOT EXISTS idx_user_accounts_role ON public.user_accounts(role);
CREATE INDEX IF NOT EXISTS idx_user_accounts_status ON public.user_accounts(status);

COMMENT ON TABLE public.user_accounts IS 'Bảng tài khoản cán bộ giảng viên, phân quyền RBAC 3 nhóm và đơn vị công tác duy nhất tại HCM-UTE';

-- -----------------------------------------------------------------------------
-- BẢNG 24: public.staff_work_tickets (Phiếu công việc cá nhân liên thông A1-A2-B1-C1)
-- Trạng thái: 'Nháp' (lưu tạm, giữ mã CV) | 'Đã nộp' (gửi duyệt lên bảng đơn vị)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_work_tickets (
    id VARCHAR(100) PRIMARY KEY,
    unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
    owner_email VARCHAR(255) NOT NULL REFERENCES public.user_accounts(email) ON DELETE CASCADE,
    owner_name VARCHAR(255) NOT NULL,
    owner_title VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Nháp' CHECK (status IN ('Nháp', 'Đã nộp')),
    ma_nhiem_vu VARCHAR(50) NOT NULL,
    ma_cong_viec VARCHAR(100) NOT NULL,
    ten_cong_viec TEXT NOT NULL,
    ma_vtvl VARCHAR(50) NOT NULL,
    ma_vtvl_phoi_hop VARCHAR(50) DEFAULT '',
    san_pham TEXT DEFAULT '',
    chat_luong TEXT DEFAULT '',
    can_cu TEXT DEFAULT '',
    so_sp_nam NUMERIC NOT NULL DEFAULT 0,
    nguon_so_lieu TEXT DEFAULT '',
    phut_thuc_te NUMERIC NOT NULL DEFAULT 0,
    gio_bo_sung NUMERIC NOT NULL DEFAULT 0,
    coordinated_tasks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_staff_ticket_unit_task UNIQUE (unit_code, ma_cong_viec)
);

CREATE INDEX IF NOT EXISTS idx_staff_tickets_owner ON public.staff_work_tickets(owner_email);
CREATE INDEX IF NOT EXISTS idx_staff_tickets_unit ON public.staff_work_tickets(unit_code);
CREATE INDEX IF NOT EXISTS idx_staff_tickets_status ON public.staff_work_tickets(status);
CREATE INDEX IF NOT EXISTS idx_staff_tickets_task ON public.staff_work_tickets(ma_cong_viec);

COMMENT ON TABLE public.staff_work_tickets IS 'Bảng kê khai Phiếu công việc cá nhân, tự động liên thông Biểu A1, A2, B1, C1 theo đơn vị';

-- -----------------------------------------------------------------------------
-- BẢNG 25: public.coordinated_tasks (Công việc phối hợp liên đơn vị toàn trường)
-- Gắn công việc của cá nhân với mã nhiệm vụ và công việc của các đơn vị khác
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coordinated_tasks (
    id VARCHAR(100) PRIMARY KEY,
    ticket_id VARCHAR(100) NOT NULL REFERENCES public.staff_work_tickets(id) ON DELETE CASCADE,
    unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
    target_unit_code VARCHAR(50) NOT NULL REFERENCES public.dm_don_vi(ma_don_vi) ON DELETE CASCADE,
    target_task_code VARCHAR(100),
    target_task_name TEXT,
    role_in_task VARCHAR(100),
    estimated_hours NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coord_ticket ON public.coordinated_tasks(ticket_id);
CREATE INDEX IF NOT EXISTS idx_coord_units ON public.coordinated_tasks(unit_code, target_unit_code);

COMMENT ON TABLE public.coordinated_tasks IS 'Bảng ghi nhận công việc phối hợp liên đơn vị trong toàn trường HCM-UTE';
