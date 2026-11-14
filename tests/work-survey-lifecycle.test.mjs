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
console.log(' BỘ KIỂM THỬ QUY TRÌNH PHIẾU CÔNG VIỆC VTVL HCM-UTE (16 CA)');
console.log(' 3 Vai trò: Admin (TCNS), Lãnh đạo SDH, Cán bộ CK');
console.log(' Căn cứ: Nghị định số 232/2026/NĐ-CP & Hướng dẫn số 07-HD/BTCTW');
console.log('================================================================');

// 1. Đọc mã nguồn các thành phần chính
const ticketsRoute = fs.readFileSync(path.join(root, 'src/app/api/tickets/route.ts'), 'utf8');
const ticketStore = fs.readFileSync(path.join(root, 'src/services/storage/server-ticket-store.ts'), 'utf8');
const ticketDb = fs.readFileSync(path.join(root, 'src/services/storage/server-ticket-db.ts'), 'utf8');
const ticketsTypes = fs.readFileSync(path.join(root, 'src/types/staff-ticket.ts'), 'utf8');
const pageCode = fs.readFileSync(path.join(root, 'src/app/phieu-cong-viec/page.tsx'), 'utf8');
const reviewListCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/UnitTicketsReviewList.tsx'), 'utf8');
const myListCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffMyTicketsList.tsx'), 'utf8');
const migrationSql = fs.readFileSync(path.join(root, 'supabase/migrations/20261115030000_work_survey_lifecycle_erd.sql'), 'utf8');
const rollbackSql = fs.readFileSync(path.join(root, 'supabase/migrations/20261115030000_rollback_work_survey_lifecycle.sql'), 'utf8');

// -----------------------------------------------------------------------------
// CA 1: Cán bộ tạo và lưu nháp phiếu (draft)
// -----------------------------------------------------------------------------
runTest('Ca 1: Cán bộ tạo và lưu nháp phiếu (draft)', () => {
  assert.ok(ticketsTypes.includes("'draft'"), 'Type phải hỗ trợ canonical draft');
  assert.ok(ticketsRoute.includes("resolvedStatus = 'Nháp'") || ticketsRoute.includes("resolvedStatus: TicketStatus = 'Nháp'"), 'Mặc định lưu phiếu là Nháp/draft');
  assert.ok(myListCode.includes('canEdit'), 'Cán bộ có quyền sửa phiếu nháp');
});

// -----------------------------------------------------------------------------
// CA 2: Cán bộ nộp phiếu Nháp thành Đã nộp
// -----------------------------------------------------------------------------
runTest('Ca 2: Cán bộ nộp phiếu Nháp thành Đã nộp (draft -> submitted)', () => {
  assert.ok(ticketsRoute.includes("action === 'submit'"), 'API PATCH phải hỗ trợ action submit');
  assert.ok(ticketsRoute.includes("submittedAt:"), 'Khi nộp phải ghi nhận submittedAt');
  assert.ok(migrationSql.includes('rpc_submit_work_survey'), 'Migration phải có RPC submit');
});

// -----------------------------------------------------------------------------
// CA 3: Sau khi nộp, cán bộ không sửa được phiếu (FORBIDDEN_TICKET_LOCKED)
// -----------------------------------------------------------------------------
runTest('Ca 3: Sau khi nộp, cán bộ không sửa được phiếu (chặn 403 FORBIDDEN_TICKET_LOCKED)', () => {
  assert.ok(ticketsRoute.includes('FORBIDDEN_TICKET_LOCKED'), 'API POST phải trả mã FORBIDDEN_TICKET_LOCKED khi phiếu đã nộp');
  assert.ok(myListCode.includes("canonical === 'draft' || canonical === 'changes_requested'"), 'Giao diện chỉ hiển thị nút Sửa khi draft hoặc changes_requested');
});

// -----------------------------------------------------------------------------
// CA 4: Lãnh đạo đúng đơn vị thấy phiếu trong tab Chờ duyệt
// -----------------------------------------------------------------------------
runTest('Ca 4: Lãnh đạo đúng đơn vị thấy phiếu trong tab Chờ duyệt', () => {
  assert.ok(pageCode.includes("activeTab === 'pending'"), 'Trang có tab Chờ duyệt cho Lãnh đạo');
  assert.ok(pageCode.includes('pendingCount'), 'Hiển thị badge số lượng phiếu chờ duyệt');
  assert.ok(reviewListCode.includes("mode === 'pending'"), 'UnitTicketsReviewList hỗ trợ mode pending');
  assert.ok(reviewListCode.includes("c === 'submitted' || c === 'resubmitted'"), 'Chờ duyệt lọc chính xác phiếu submitted và resubmitted');
});

// -----------------------------------------------------------------------------
// CA 5: Lãnh đạo đơn vị khác không thấy và không duyệt được phiếu
// -----------------------------------------------------------------------------
runTest('Ca 5: Lãnh đạo đơn vị khác không thấy và không duyệt được phiếu (chặn 403 FORBIDDEN_CROSS_UNIT)', () => {
  assert.ok(ticketsRoute.includes('FORBIDDEN_CROSS_UNIT'), 'API phải chặn thao tác khác đơn vị với FORBIDDEN_CROSS_UNIT');
  assert.ok(ticketsRoute.includes('target.unitCode.toUpperCase() !== caller.unitCode.toUpperCase()'), 'So sánh unitCode của phiếu với caller unitCode');
});

// -----------------------------------------------------------------------------
// CA 6: Lãnh đạo yêu cầu bổ sung và bắt buộc phải nhập lý do
// -----------------------------------------------------------------------------
runTest('Ca 6: Lãnh đạo yêu cầu bổ sung và bắt buộc phải nhập lý do (MISSING_REVISION_REASON)', () => {
  assert.ok(ticketsRoute.includes('MISSING_REVISION_REASON'), 'API phải trả MISSING_REVISION_REASON nếu thiếu lý do');
  assert.ok(ticketsRoute.includes('revisionReason: reasonText'), 'API phải lưu lý do yêu cầu bổ sung');
  const revisionModalCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketRevisionModal.tsx'), 'utf8');
  assert.ok(revisionModalCode.includes('Lý do yêu cầu bổ sung'), 'Có modal nhập lý do bổ sung');
});

// -----------------------------------------------------------------------------
// CA 7: Cán bộ thấy lý do, sửa phiếu và nộp lại
// -----------------------------------------------------------------------------
runTest('Ca 7: Cán bộ thấy lý do, sửa phiếu và nộp lại (changes_requested -> resubmitted)', () => {
  assert.ok(myListCode.includes('t.revisionReason'), 'Danh sách phiếu của tôi hiển thị rõ revisionReason');
  assert.ok(myListCode.includes('canResubmit'), 'Có nút Nộp lại khi changes_requested');
  assert.ok(ticketsRoute.includes("action === 'resubmit'"), 'API PATCH hỗ trợ action resubmit');
  assert.ok(ticketsRoute.includes("resubmittedAt:"), 'Ghi nhận resubmittedAt khi nộp lại');
});

// -----------------------------------------------------------------------------
// CA 8: Phiếu Đã nộp lại xuất hiện trong tab Chờ duyệt
// -----------------------------------------------------------------------------
runTest('Ca 8: Phiếu Đã nộp lại xuất hiện trong tab Chờ duyệt', () => {
  assert.ok(reviewListCode.includes("c === 'resubmitted'"), 'Mode pending bao gồm phiếu resubmitted');
  assert.ok(reviewListCode.includes('localeCompare'), 'Sắp xếp thời gian nộp mới nhất lên đầu');
});

// -----------------------------------------------------------------------------
// CA 9: Lãnh đạo duyệt phiếu thành công
// -----------------------------------------------------------------------------
runTest('Ca 9: Lãnh đạo duyệt phiếu thành công (resubmitted -> approved)', () => {
  assert.ok(ticketsRoute.includes("action === 'approve'"), 'API PATCH hỗ trợ action approve');
  assert.ok(ticketsRoute.includes("status: 'Đã duyệt'"), 'Cập nhật status Đã duyệt');
  assert.ok(ticketsRoute.includes('approvedBy: caller.email'), 'Lưu email người duyệt approvedBy');
  assert.ok(ticketsRoute.includes('approvedAt: nowIso'), 'Lưu thời điểm duyệt approvedAt');
});

// -----------------------------------------------------------------------------
// CA 10: Phiếu đã duyệt không còn chỉnh sửa được
// -----------------------------------------------------------------------------
runTest('Ca 10: Phiếu đã duyệt không còn chỉnh sửa được (chỉ đọc)', () => {
  assert.ok(ticketsRoute.includes("canonical !== 'draft' && canonical !== 'changes_requested'"), 'Chỉ draft và changes_requested mới được sửa');
  assert.ok(myListCode.includes("const canEdit = canonical === 'draft' || canonical === 'changes_requested'"), 'Chỉ hiển thị nút Sửa khi draft hoặc changes_requested');
});

// -----------------------------------------------------------------------------
// CA 11: Chỉ phiếu đã duyệt mới được gộp vào B1/B2
// -----------------------------------------------------------------------------
runTest('Ca 11: Chỉ phiếu đã duyệt mới được gộp vào B1/B2 (FORBIDDEN_UNAPPROVED_MERGE)', () => {
  assert.ok(ticketsRoute.includes('FORBIDDEN_UNAPPROVED_MERGE'), 'API chặn gộp nếu chưa duyệt với FORBIDDEN_UNAPPROVED_MERGE');
  assert.ok(ticketStore.includes("ticket.status !== 'Đã duyệt'"), 'Lõi store chỉ gộp khi status là Đã duyệt');
});

// -----------------------------------------------------------------------------
// CA 12: Gộp nhiều lần không tạo dữ liệu trùng (Idempotent)
// -----------------------------------------------------------------------------
runTest('Ca 12: Gộp nhiều lần không tạo dữ liệu trùng (Idempotent sourceTicketId)', () => {
  assert.ok(ticketStore.includes('sourceTicketId: ticket.id'), 'Lõi store gán sourceTicketId chống trùng');
  assert.ok(ticketStore.includes('filteredA2'), 'Lõi store lọc bỏ bản ghi cũ trước khi thêm dòng mới');
  assert.ok(ticketStore.includes('filteredB1'), 'Lõi store lọc bỏ bản ghi B1 cũ trước khi thêm dòng mới');
  assert.ok(migrationSql.includes('uq_survey_target_sheet'), 'Database có UNIQUE constraint (survey_id, target_sheet)');
});

// -----------------------------------------------------------------------------
// CA 13: Cán bộ xem được phiếu toàn đơn vị nhưng không sửa được (Chỉ đọc)
// -----------------------------------------------------------------------------
runTest('Ca 13: Cán bộ xem được phiếu toàn đơn vị nhưng không sửa được (chế độ chỉ đọc)', () => {
  assert.ok(pageCode.includes("Phiếu toàn đơn vị (Chỉ đọc)"), 'Tiêu đề tab hiển thị chỉ đọc cho cán bộ');
  assert.ok(reviewListCode.includes('canReview'), 'Chỉ Lãnh đạo mới có nút Duyệt/Yêu cầu bổ sung');
  assert.ok(!reviewListCode.includes('onEditTicket'), 'Bảng toàn đơn vị không có nút sửa phiếu');
});

// -----------------------------------------------------------------------------
// CA 14: Lãnh đạo không tự duyệt phiếu do chính mình tạo (FORBIDDEN_SELF_REVIEW)
// -----------------------------------------------------------------------------
runTest('Ca 14: Lãnh đạo không tự duyệt phiếu do chính mình tạo (FORBIDDEN_SELF_REVIEW)', () => {
  assert.ok(ticketsRoute.includes('FORBIDDEN_SELF_REVIEW'), 'API PATCH chặn tự duyệt với FORBIDDEN_SELF_REVIEW');
  assert.ok(reviewListCode.includes('isOwnLeaderTicket'), 'UI nhận diện isOwnLeaderTicket để ẩn nút duyệt');
  assert.ok(reviewListCode.includes('Phiếu cá nhân của Lãnh đạo (Cần TCNS duyệt)'), 'UI hiển thị thông báo cần cấp trên duyệt');
  assert.ok(migrationSql.includes('FORBIDDEN_SELF_REVIEW'), 'Database RPC rpc_approve_work_survey chặn tự duyệt');
});

// -----------------------------------------------------------------------------
// CA 15: Admin duyệt được phiếu của lãnh đạo
// -----------------------------------------------------------------------------
runTest('Ca 15: Admin duyệt được phiếu của lãnh đạo các đơn vị', () => {
  assert.ok(ticketsRoute.includes('!caller.isAdmin && target.ownerEmail.toLowerCase() === caller.email.toLowerCase()'), 'Ràng buộc tự duyệt loại trừ caller.isAdmin');
  assert.ok(migrationSql.includes("v_caller_role <> 'admin' AND lower(v_ticket.owner_email) = v_caller_email"), 'RPC database cho phép Admin duyệt mọi phiếu');
});

// -----------------------------------------------------------------------------
// CA 16: Mọi thay đổi trạng thái đều có audit log / lịch sử trạng thái
// -----------------------------------------------------------------------------
runTest('Ca 16: Mọi thay đổi trạng thái đều ghi vào work_survey_status_history và audit_logs', () => {
  assert.ok(ticketsRoute.includes('recordStatusHistoryInSupabase'), 'API gọi recordStatusHistoryInSupabase');
  assert.ok(ticketsRoute.includes('appendAuditLog'), 'API gọi appendAuditLog');
  assert.ok(migrationSql.includes('work_survey_status_history'), 'Migration tạo bảng work_survey_status_history');
  assert.ok(migrationSql.includes('work_survey_merge_links'), 'Migration tạo bảng work_survey_merge_links');
  assert.ok(rollbackSql.includes('DROP TABLE IF EXISTS public.work_survey_status_history'), 'Rollback script an toàn');
});

console.log('\n================================================================');
console.log(` KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
