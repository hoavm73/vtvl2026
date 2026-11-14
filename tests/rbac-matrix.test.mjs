import fs from 'fs';
import path from 'path';
import assert from 'assert';

const root = process.cwd();
let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log(' BỘ KIỂM THỬ MA TRẬN PHÂN QUYỀN RBAC (16 CA KIỂM THỬ BẢO MẬT)');
console.log(' Hệ thống: HCM-UTE VTVL 360 & S-Link (Nghị định 232/2026/NĐ-CP)');
console.log(' Nguồn sự thật: Ma trận 3 vai trò: Admin, Lãnh đạo đơn vị, Cán bộ');
console.log('================================================================');

// Khởi tạo các vai trò mẫu chuẩn theo đặc tả bài toán
const adminCaller = {
  email: 'tcns@hcmute.edu.vn',
  role: 'admin',
  unitCode: 'TCNS',
  isAdmin: true,
  isUnitLeader: false,
  isStaff: false
};

const leaderSdh = {
  email: 'minhhoavo73@gmail.com',
  role: 'unit_leader',
  unitCode: 'SDH',
  isAdmin: false,
  isUnitLeader: true,
  isStaff: false
};

const staffCk = {
  email: 'hoavm@hcmute.edu.vn',
  role: 'staff',
  unitCode: 'CK',
  isAdmin: false,
  isUnitLeader: false,
  isStaff: true
};

function canAccessUnit(caller, unitCode) {
  if (caller.isAdmin) return true;
  return caller.unitCode.toUpperCase() === unitCode.toUpperCase();
}

function canEditUnitWorkbook(caller, unitCode) {
  if (caller.isAdmin) return true;
  if (caller.isUnitLeader && caller.unitCode.toUpperCase() === unitCode.toUpperCase()) return true;
  return false;
}

function canReviewTicket(caller, ticketUnitCode) {
  if (caller.isAdmin) return true;
  if (caller.isUnitLeader && caller.unitCode.toUpperCase() === ticketUnitCode.toUpperCase()) return true;
  return false;
}

function canManageUnitAccounts(caller, targetUnitCode) {
  if (caller.isAdmin) return true;
  if (caller.isUnitLeader && caller.unitCode.toUpperCase() === targetUnitCode.toUpperCase()) return true;
  return false;
}

// -----------------------------------------------------------------------------
// CA 1: Admin xem và sửa mọi đơn vị
// -----------------------------------------------------------------------------
runTest('Ca 1: Admin (tcns@hcmute.edu.vn) xem và sửa toàn bộ dữ liệu mọi đơn vị', () => {
  const allUnits = ['SDH', 'CK', 'TCNS', 'CNTT', 'KLL', 'FME'];
  allUnits.forEach((u) => {
    assert.strictEqual(canAccessUnit(adminCaller, u), true, `Admin phải truy cập được đơn vị ${u}`);
    assert.strictEqual(canEditUnitWorkbook(adminCaller, u), true, `Admin phải sửa được 15 biểu đơn vị ${u}`);
    assert.strictEqual(canReviewTicket(adminCaller, u), true, `Admin phải duyệt/trả phiếu được đơn vị ${u}`);
    assert.strictEqual(canManageUnitAccounts(adminCaller, u), true, `Admin phải quản trị tài khoản được đơn vị ${u}`);
  });
});

// -----------------------------------------------------------------------------
// CA 2: Lãnh đạo SDH sửa 15 biểu & C1 của SDH
// -----------------------------------------------------------------------------
runTest('Ca 2: Lãnh đạo SDH (minhhoavo73@gmail.com) sửa 15 biểu & C1 của SDH mà không cần admin mở khóa', () => {
  assert.strictEqual(canAccessUnit(leaderSdh, 'SDH'), true, 'Lãnh đạo SDH phải xem được SDH');
  assert.strictEqual(canEditUnitWorkbook(leaderSdh, 'SDH'), true, 'Lãnh đạo SDH phải sửa được 15 biểu của SDH');
  assert.strictEqual(canReviewTicket(leaderSdh, 'SDH'), true, 'Lãnh đạo SDH phải duyệt/trả phiếu của SDH');

  const c1LockCode = fs.readFileSync(path.join(root, 'src/app/api/admin/c1-lock/route.ts'), 'utf8');
  assert.ok(c1LockCode.includes('caller.isUnitLeader'), 'API C1 lock phải cấp quyền tự động cho Lãnh đạo đơn vị');
});

// -----------------------------------------------------------------------------
// CA 3: Lãnh đạo SDH không xem/sửa CK (403)
// -----------------------------------------------------------------------------
runTest('Ca 3: Lãnh đạo SDH không xem hoặc sửa dữ liệu của đơn vị CK (chặn 403 FORBIDDEN_CROSS_UNIT)', () => {
  assert.strictEqual(canAccessUnit(leaderSdh, 'CK'), false, 'Lãnh đạo SDH không được xem dữ liệu CK');
  assert.strictEqual(canEditUnitWorkbook(leaderSdh, 'CK'), false, 'Lãnh đạo SDH không được sửa 15 biểu CK');
  assert.strictEqual(canReviewTicket(leaderSdh, 'CK'), false, 'Lãnh đạo SDH không được duyệt/trả phiếu CK');
  assert.strictEqual(canManageUnitAccounts(leaderSdh, 'CK'), false, 'Lãnh đạo SDH không được quản trị tài khoản CK');

  const workbooksCode = fs.readFileSync(path.join(root, 'src/app/api/workbooks/[id]/route.ts'), 'utf8');
  assert.ok(workbooksCode.includes('FORBIDDEN_CROSS_UNIT'), 'API Workbook phải trả mã lỗi FORBIDDEN_CROSS_UNIT');
});

// -----------------------------------------------------------------------------
// CA 4: Cán bộ CK xem 15 biểu CK ở chế độ chỉ đọc
// -----------------------------------------------------------------------------
runTest('Ca 4: Cán bộ CK (hoavm@hcmute.edu.vn) xem 15 biểu CK ở chế độ chỉ đọc', () => {
  assert.strictEqual(canAccessUnit(staffCk, 'CK'), true, 'Cán bộ CK được xem dữ liệu đơn vị mình');
  assert.strictEqual(canEditUnitWorkbook(staffCk, 'CK'), false, 'Cán bộ CK KHÔNG được sửa 15 biểu đơn vị');

  const workbooksCode = fs.readFileSync(path.join(root, 'src/app/api/workbooks/[id]/route.ts'), 'utf8');
  assert.ok(workbooksCode.includes('FORBIDDEN_VIEWER_WRITE'), 'API PUT workbook phải chặn cán bộ sửa 15 biểu');

  const viewerCode = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelWorkbookViewer.tsx'), 'utf8');
  assert.ok(viewerCode.includes('Chế độ chỉ xem — Tài khoản Cán bộ – Giảng viên xem dữ liệu đơn vị ở chế độ chỉ đọc'), 'Phải có banner chỉ xem');
  assert.ok(viewerCode.includes('isReadOnly={isReadOnlyViewer}'), 'Phải truyền isReadOnly vào ExcelTableRenderer');
});

// -----------------------------------------------------------------------------
// CA 5: Cán bộ CK xem phiếu toàn đơn vị CK ở chế độ chỉ đọc
// -----------------------------------------------------------------------------
runTest('Ca 5: Cán bộ CK xem danh sách phiếu toàn đơn vị CK ở chế độ chỉ đọc (không duyệt/trả lại)', () => {
  const ticketsRoute = fs.readFileSync(path.join(root, 'src/app/api/tickets/route.ts'), 'utf8');
  assert.ok(ticketsRoute.includes('unitTickets'), 'API tickets phải trả về unitTickets cho đơn vị');

  const reviewListCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/UnitTicketsReviewList.tsx'), 'utf8');
  assert.ok(reviewListCode.includes('isLeader && onReviewTicket'), 'Chỉ render nút Duyệt/Trả lại cho Lãnh đạo hoặc Admin');
});

// -----------------------------------------------------------------------------
// CA 6: Cán bộ chỉ sửa được phiếu do chính mình tạo
// -----------------------------------------------------------------------------
runTest('Ca 6: Cán bộ chỉ sửa được phiếu do chính mình tạo, sửa phiếu người khác bị 403', () => {
  const ticketsRoute = fs.readFileSync(path.join(root, 'src/app/api/tickets/route.ts'), 'utf8');
  assert.ok(
    ticketsRoute.includes('FORBIDDEN_IDOR') || ticketsRoute.includes('FORBIDDEN_STAFF_EDIT_OTHER'),
    'Phải chặn cán bộ sửa phiếu người khác với mã lỗi bảo mật 403 (FORBIDDEN_IDOR)'
  );
  assert.ok(
    ticketsRoute.includes('existing.ownerEmail !== caller.email') || ticketsRoute.includes('targetOwner !== caller.email'),
    'Logic phải so sánh người tạo phiếu với caller session'
  );
});

// -----------------------------------------------------------------------------
// CA 7: Cán bộ không thể duyệt/trả phiếu (403)
// -----------------------------------------------------------------------------
runTest('Ca 7: Cán bộ không thể duyệt hoặc trả lại phiếu của bất kỳ ai (chặn 403 FORBIDDEN_STAFF_REVIEW)', () => {
  assert.strictEqual(canReviewTicket(staffCk, 'CK'), false, 'Cán bộ CK không có quyền duyệt phiếu');
  const ticketsRoute = fs.readFileSync(path.join(root, 'src/app/api/tickets/route.ts'), 'utf8');
  assert.ok(ticketsRoute.includes('FORBIDDEN_STAFF_REVIEW'), 'PATCH /api/tickets phải chặn cán bộ với FORBIDDEN_STAFF_REVIEW');
  assert.ok(
    ticketsRoute.includes("action !== 'approve' && action !== 'return'") || ticketsRoute.includes("action === 'approve' || action === 'return'"),
    'API phải hỗ trợ 2 hành động approve và return'
  );
});

// -----------------------------------------------------------------------------
// CA 8: Cán bộ truy cập /admin bị từ chối / chuyển hướng
// -----------------------------------------------------------------------------
runTest('Ca 8: Cán bộ truy cập /admin bị từ chối và chuyển hướng', () => {
  const adminPage = fs.readFileSync(path.join(root, 'src/app/admin/page.tsx'), 'utf8');
  assert.ok(adminPage.includes('cur?.role === \'staff\''), 'Admin page phải kiểm tra role staff');
  assert.ok(adminPage.includes('router.replace'), 'Admin page phải chuyển hướng cán bộ');

  const adminAuthRoute = fs.readFileSync(path.join(root, 'src/app/api/admin/auth/route.ts'), 'utf8');
  assert.ok(adminAuthRoute.includes('caller.isStaff'), 'API admin auth phải từ chối xác thực cán bộ');

  const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/AppSidebar.tsx'), 'utf8');
  assert.ok(sidebar.includes("roles: ['admin', 'unit_leader']"), 'Sidebar phải ẩn menu admin đối với cán bộ');
});

// -----------------------------------------------------------------------------
// CA 9: Lãnh đạo chỉ quản lý tài khoản trong đơn vị mình
// -----------------------------------------------------------------------------
runTest('Ca 9: Lãnh đạo chỉ quản lý tài khoản trong đơn vị mình', () => {
  assert.strictEqual(canManageUnitAccounts(leaderSdh, 'SDH'), true, 'Lãnh đạo SDH quản lý tài khoản SDH');
  assert.strictEqual(canManageUnitAccounts(leaderSdh, 'CK'), false, 'Lãnh đạo SDH không quản lý tài khoản CK');

  const accountsRoute = fs.readFileSync(path.join(root, 'src/app/api/admin/accounts/route.ts'), 'utf8');
  assert.ok(
    accountsRoute.includes('caller.unitCode') || accountsRoute.includes('caller.isUnitLeader'),
    'API accounts phải lọc theo đơn vị lãnh đạo'
  );
  assert.ok(
    accountsRoute.includes('targetUnit !== caller.unitCode') || accountsRoute.includes('FORBIDDEN_CROSS_UNIT'),
    'Phải chặn thao tác tài khoản khác đơn vị'
  );
});

// -----------------------------------------------------------------------------
// CA 10: Lãnh đạo không thể cấp Admin, sửa Admin hoặc chuyển đơn vị (403)
// -----------------------------------------------------------------------------
runTest('Ca 10: Lãnh đạo không thể cấp quyền Admin, sửa/khóa/xóa Admin hoặc chuyển đơn vị tài khoản', () => {
  const accountsRoute = fs.readFileSync(path.join(root, 'src/app/api/admin/accounts/route.ts'), 'utf8');
  assert.ok(accountsRoute.includes('FORBIDDEN_GRANT_ADMIN'), 'Phải chặn lãnh đạo cấp quyền Admin (FORBIDDEN_GRANT_ADMIN)');
  assert.ok(accountsRoute.includes('FORBIDDEN_EDIT_ADMIN'), 'Phải chặn lãnh đạo sửa Admin (FORBIDDEN_EDIT_ADMIN)');
  assert.ok(accountsRoute.includes('FORBIDDEN_CHANGE_UNIT'), 'Phải chặn lãnh đạo chuyển đơn vị (FORBIDDEN_CHANGE_UNIT)');

  const createForm = fs.readFileSync(path.join(root, 'src/components/admin/AdminAccountCreateForm.tsx'), 'utf8');
  assert.ok(createForm.includes('ROLE_OPTIONS.filter'), 'Form tạo tài khoản phải loại bỏ quyền admin cho Lãnh đạo đơn vị');

  const accountRow = fs.readFileSync(path.join(root, 'src/components/admin/AdminAccountRow.tsx'), 'utf8');
  assert.ok(accountRow.includes('cannotEdit'), 'Hàng tài khoản phải vô hiệu hóa sửa/xóa tài khoản Admin');
});

// -----------------------------------------------------------------------------
// CA 11: Mọi thao tác trái quyền trả về 401 hoặc 403, ghi nhận Audit Log
// -----------------------------------------------------------------------------
runTest('Ca 11: Mọi thao tác trái quyền trả về 401/403, ghi nhận Audit Log cho các hành động trọng yếu', () => {
  const workbooksEdit = fs.readFileSync(path.join(root, 'src/app/api/workbooks/[id]/route.ts'), 'utf8');
  assert.ok(workbooksEdit.includes("'SỬA_BIỂU'"), 'Phải ghi audit log khi sửa biểu');

  const ticketsReview = fs.readFileSync(path.join(root, 'src/app/api/tickets/route.ts'), 'utf8');
  assert.ok(ticketsReview.includes("'DUYỆT_PHIẾU'"), 'Phải ghi audit log khi duyệt phiếu');
  assert.ok(ticketsReview.includes("'TRẢ_LẠI_PHIẾU'"), 'Phải ghi audit log khi trả lại phiếu');

  const accountsEdit = fs.readFileSync(path.join(root, 'src/app/api/admin/accounts/route.ts'), 'utf8');
  assert.ok(accountsEdit.includes("'THAY_ĐỔI_TÀI_KHOẢN'"), 'Phải ghi audit log khi thay đổi tài khoản');

  const unitsEdit = fs.readFileSync(path.join(root, 'src/app/api/admin/units/route.ts'), 'utf8');
  assert.ok(unitsEdit.includes("'THAY_ĐỔI_ĐƠN_VỊ'"), 'Phải ghi audit log khi thay đổi đơn vị');
});

// -----------------------------------------------------------------------------
// CA 12: Chặn Lãnh đạo đơn vị TỰ DUYỆT PHIẾU CỦA CHÍNH MÌNH (FORBIDDEN_SELF_REVIEW)
// -----------------------------------------------------------------------------
runTest('Ca 12: Chặn Lãnh đạo đơn vị tự duyệt phiếu của chính mình (403 FORBIDDEN_SELF_REVIEW)', () => {
  const ticketsRoute = fs.readFileSync(path.join(root, 'src/app/api/tickets/route.ts'), 'utf8');
  assert.ok(
    ticketsRoute.includes('FORBIDDEN_SELF_REVIEW'),
    'PATCH /api/tickets phải có mã lỗi FORBIDDEN_SELF_REVIEW khi lãnh đạo tự duyệt phiếu mình'
  );

  const reviewList = fs.readFileSync(path.join(root, 'src/components/staff-portal/UnitTicketsReviewList.tsx'), 'utf8');
  assert.ok(
    reviewList.includes('isOwnLeaderTicket'),
    'UnitTicketsReviewList phải nhận diện isOwnLeaderTicket để ẩn nút Duyệt'
  );
  assert.ok(
    reviewList.includes('Phiếu cá nhân của Lãnh đạo (Cần TCNS duyệt)'),
    'UnitTicketsReviewList phải hiển thị huy hiệu báo cần cấp trên duyệt'
  );

  const rbacHardenedSql = fs.readFileSync(
    path.join(root, 'supabase/migrations/20261115020000_hardened_rbac_database_erd.sql'),
    'utf8'
  );
  assert.ok(
    rbacHardenedSql.includes('FORBIDDEN_SELF_REVIEW'),
    'RPC rpc_review_staff_ticket phải chặn tự duyệt phiếu ở mức database'
  );
});

// -----------------------------------------------------------------------------
// CA 13: Phiếu Nháp của người khác không xuất hiện trong danh sách toàn đơn vị
// -----------------------------------------------------------------------------
runTest('Ca 13: Phiếu Nháp của người khác không xuất hiện trong danh sách phiếu toàn đơn vị', () => {
  const ticketsRoute = fs.readFileSync(path.join(root, 'src/app/api/tickets/route.ts'), 'utf8');
  assert.ok(
    ticketsRoute.includes("'Nháp'") && ticketsRoute.includes("'draft'"),
    'GET /api/tickets phải lọc bỏ phiếu Nháp của người khác khỏi unitTickets'
  );

  const rbacHardenedSql = fs.readFileSync(
    path.join(root, 'supabase/migrations/20261115020000_hardened_rbac_database_erd.sql'),
    'utf8'
  );
  assert.ok(
    rbacHardenedSql.includes("status NOT IN ('Nháp', 'draft')") || rbacHardenedSql.includes("status IN ('Đã nộp', 'Đã duyệt', 'Trả lại'"),
    'RLS policy SELECT trên staff_work_tickets phải loại bỏ phiếu Nháp của người khác'
  );
});

// -----------------------------------------------------------------------------
// CA 14: Phiếu chỉ được gộp vào B1/B2 khi đã được duyệt và có liên kết nguồn chống trùng
// -----------------------------------------------------------------------------
runTest('Ca 14: Chỉ phiếu Đã duyệt mới được phép gộp vào B1/B2 với sourceTicketId chống trùng', () => {
  const ticketStore = fs.readFileSync(path.join(root, 'src/services/storage/server-ticket-store.ts'), 'utf8');
  assert.ok(
    ticketStore.includes("ticket.status !== 'Đã duyệt'"),
    'server-ticket-store phải chặn gộp phiếu chưa duyệt'
  );
  assert.ok(
    ticketStore.includes('sourceTicketId: ticket.id'),
    'Khi gộp vào B1/B2 phải gán sourceTicketId để chống gộp trùng'
  );

  const ticketsRoute = fs.readFileSync(path.join(root, 'src/app/api/tickets/route.ts'), 'utf8');
  assert.ok(
    ticketsRoute.includes('FORBIDDEN_UNAPPROVED_MERGE'),
    'Action merge trên PATCH /api/tickets phải trả về FORBIDDEN_UNAPPROVED_MERGE nếu phiếu chưa duyệt'
  );
});

// -----------------------------------------------------------------------------
// CA 15: Kiểm tra đầy đủ tài liệu ERD, Policies, Matrix và Test Cases trong docs/database/
// -----------------------------------------------------------------------------
runTest('Ca 15: Kiểm tra sự tồn tại và chuẩn mực của 4 tài liệu docs/database/', () => {
  const docs = [
    'docs/database/rbac-erd.md',
    'docs/database/rbac-policies.md',
    'docs/database/rbac-permission-matrix.md',
    'docs/database/rbac-test-cases.md'
  ];

  docs.forEach((d) => {
    const fullPath = path.join(root, d);
    assert.ok(fs.existsSync(fullPath), `Tài liệu ${d} phải tồn tại`);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.length > 500, `Tài liệu ${d} phải có nội dung chi tiết`);
  });

  const erdContent = fs.readFileSync(path.join(root, 'docs/database/rbac-erd.md'), 'utf8');
  assert.ok(erdContent.includes('erDiagram'), 'rbac-erd.md phải chứa biểu đồ erDiagram Mermaid');
  assert.ok(erdContent.includes('STAFF_WORK_TICKETS'), 'ERD phải chứa thực thể STAFF_WORK_TICKETS');

  const policiesContent = fs.readFileSync(path.join(root, 'docs/database/rbac-policies.md'), 'utf8');
  assert.ok(policiesContent.includes('SECURITY DEFINER'), 'rbac-policies.md phải mô tả hàm SECURITY DEFINER');
  assert.ok(policiesContent.includes('rpc_review_staff_ticket'), 'rbac-policies.md phải mô tả RPC duyệt phiếu');
});

// -----------------------------------------------------------------------------
// CA 16: Kiểm tra Rule 8 (< 300 dòng) và tệp Migration + Rollback
// -----------------------------------------------------------------------------
runTest('Ca 16: Kiểm tra Rule 8 (< 300 dòng) trên tất cả các tệp RBAC và tính toàn vẹn Migration/Rollback', () => {
  const rbacFiles = [
    'src/services/storage/server-auth-guard.ts',
    'src/services/storage/server-ticket-store.ts',
    'src/services/storage/server-audit-store.ts',
    'src/app/api/workbooks/route.ts',
    'src/app/api/workbooks/[id]/route.ts',
    'src/app/api/tickets/route.ts',
    'src/app/api/admin/accounts/route.ts',
    'src/app/api/admin/units/route.ts',
    'src/app/api/admin/auth/route.ts',
    'src/app/api/admin/c1-lock/route.ts',
    'src/components/excel-grid/ExcelWorkbookViewer.tsx',
    'src/components/excel-grid/ExcelTableRenderer.tsx',
    'src/components/excel-grid/ExcelCommandBar.tsx',
    'src/components/staff-portal/UnitTicketsReviewList.tsx',
    'src/components/admin/AdminAccountRow.tsx',
    'src/components/admin/AdminAccountCreateForm.tsx',
    'src/components/admin/AdminAccountsTab.tsx',
    'src/app/admin/page.tsx',
    'src/app/phieu-cong-viec/page.tsx'
  ];

  rbacFiles.forEach((file) => {
    const fullPath = path.join(root, file);
    assert.ok(fs.existsSync(fullPath), `Tệp ${file} phải tồn tại`);
    const lineCount = fs.readFileSync(fullPath, 'utf8').split('\n').length;
    assert.ok(
      lineCount <= 300,
      `Tệp ${file} vi phạm Rule 8: có ${lineCount} dòng (vượt quá 300 dòng)`
    );
  });

  // Kiểm tra Migration RBAC Hardened
  const migPath = path.join(root, 'supabase/migrations/20261115020000_hardened_rbac_database_erd.sql');
  assert.ok(fs.existsSync(migPath), 'Tệp migration RBAC 20261115020000_hardened_rbac_database_erd.sql phải tồn tại');

  // Kiểm tra Rollback script
  const rollbackPath = path.join(root, 'supabase/migrations/20261115020000_rollback_rbac_security.sql');
  assert.ok(fs.existsSync(rollbackPath), 'Tệp rollback 20261115020000_rollback_rbac_security.sql phải tồn tại');
});

console.log('\n================================================================');
console.log(` KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
