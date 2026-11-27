import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const dataDir = path.join(root, '.data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const BACKUP_FILES = [
  'server_workbooks.json',
  'deleted_workbooks.json',
  'server_accounts.json',
  'accounts.json',
  'deleted_accounts.json',
  'audit-logs.json',
  'audit_logs.json',
  'staff_tickets.json',
  'work_survey_versions.json',
  'work_survey_merge_links.json',
  'user_vtvl_assignments.json',
  'work_survey_coordinated_vtvls.json',
  'work_relationships.json',
  'custom_units.json'
];

const backups = new Map();
for (const name of BACKUP_FILES) {
  const p = path.join(dataDir, name);
  backups.set(p, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
}

try {
  console.log('\n================================================================');
  console.log(' KIỂM THỬ LUỒNG THẨM ĐỊNH 4 BƯỚC & KHÓA CỨNG HỒ SƠ ĐƠN VỊ');
  console.log('================================================================\n');

  const runnerPath = path.join(dataDir, '_tmp_review_lock_runner.ts');
  fs.writeFileSync(
    runnerPath,
    `
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { GET as getWorkbook, PUT as putWorkbook } from '../src/app/api/workbooks/[id]/route';
import { GET as getHistory, POST as postHistory } from '../src/app/api/workbooks/[id]/history/route';
import { POST as postTicket, PATCH as patchTicket, DELETE as deleteTicket } from '../src/app/api/tickets/route';
import { generateUserSessionToken } from '../src/services/storage/server-auth-guard';
import { upsertUserAccount } from '../src/services/storage/server-account-store';
import { getOrCreateWorkbook, resetWorkbookMemoryStore } from '../src/services/storage/server-workbook-store';
import { resetTicketMemoryStore } from '../src/services/storage/server-ticket-store';
import { clearAllRuntimeCache } from '../src/services/storage/runtime-cache';

function makeHeaders(email: string, role: 'admin' | 'unit_leader' | 'staff', unitCode: string) {
  const token = generateUserSessionToken({ email, role, unitCode });
  return {
    'content-type': 'application/json',
    'authorization': 'Bearer ' + token,
    'x-actor-email': email
  };
}

async function main() {
  resetWorkbookMemoryStore();
  resetTicketMemoryStore();
  clearAllRuntimeCache();

  const unitCode = 'CNTT';
  const wbId = 'wb_CNTT';
  const adminEmail = 'tcns@hcmute.edu.vn';
  const leaderEmail = 'truongkhoa.cntt@hcmute.edu.vn';
  const staffEmail = 'giangvien.cntt@hcmute.edu.vn';

  await upsertUserAccount({
    email: adminEmail, displayName: 'Phòng TCNS', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Quản trị viên', role: 'admin',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: leaderEmail, displayName: 'Trưởng khoa CNTT', unitCode,
    unitNameVi: 'Khoa Công nghệ thông tin', title: 'Lãnh đạo đơn vị', role: 'unit_leader',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: staffEmail, displayName: 'Giảng viên CNTT', unitCode,
    unitNameVi: 'Khoa Công nghệ thông tin', title: 'Cán bộ – Giảng viên', role: 'staff',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);

  const adminHeaders = makeHeaders(adminEmail, 'admin', 'TCNS');
  const leaderHeaders = makeHeaders(leaderEmail, 'unit_leader', unitCode);
  const staffHeaders = makeHeaders(staffEmail, 'staff', unitCode);

  getOrCreateWorkbook(unitCode, '01/10/2025–30/9/2026', leaderEmail);
  const ctx = { params: Promise.resolve({ id: wbId }) };

  // 0. Tạo 1 phiếu nháp trước khi khóa để kiểm thử PATCH & DELETE lúc khóa
  const createPreRes = await postTicket(new NextRequest('http://localhost/api/tickets', {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({
      unitCode,
      maNhiemVu: 'NV01',
      maVtvl: 'CNTT-01',
      tenCongViec: 'Công việc thử nghiệm luồng khóa thẩm định',
      sanPham: 'Báo cáo',
      chatLuong: 'Đúng chuẩn',
      canCu: 'Quy định trường',
      soSpNam: 10,
      nguonSoLieu: 'Thống kê năm',
      phutThucTe: 60
    })
  }));
  const createPreJson = await createPreRes.json();
  assert.strictEqual(createPreRes.status, 200, 'Tạo phiếu nháp ban đầu phải thành công');
  const draftTicketId = createPreJson.ticket.id;

  // 1. Trạng thái ban đầu: chua_gui
  const h0Res = await getHistory(new Request('http://localhost/api/workbooks/wb_CNTT/history', { headers: leaderHeaders }), ctx);
  const h0 = await h0Res.json();
  assert.strictEqual(h0Res.status, 200);
  assert.strictEqual(h0.reviewMeta.status, 'chua_gui');
  console.log('  ✓ [PASS] TC1: Trạng thái khởi tạo là chua_gui (Bước 1/4)');

  // 2. Đơn vị gửi TCNS -> cho_tham_dinh
  const subRes = await postHistory(new Request('http://localhost/api/workbooks/wb_CNTT/history', {
    method: 'POST',
    headers: leaderHeaders,
    body: JSON.stringify({ action: 'submit_to_tcns', unitCode })
  }), ctx);
  const subJson = await subRes.json();
  assert.strictEqual(subRes.status, 200);
  assert.strictEqual(subJson.reviewMeta.status, 'cho_tham_dinh');
  console.log('  ✓ [PASS] TC2: Lãnh đạo đơn vị gửi TCNS -> cho_tham_dinh (Bước 2/4)');

  // 3. TCNS bắt đầu thẩm định -> dang_tham_dinh
  const startRes = await postHistory(new Request('http://localhost/api/workbooks/wb_CNTT/history', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'tcns_start_review', unitCode })
  }), ctx);
  const startJson = await startRes.json();
  assert.strictEqual(startRes.status, 200);
  assert.strictEqual(startJson.reviewMeta.status, 'dang_tham_dinh');
  console.log('  ✓ [PASS] TC3: Phòng TCNS bắt đầu thẩm định -> dang_tham_dinh (Bước 3/4)');

  // 4. TCNS yêu cầu bổ sung -> can_bo_sung + lưu reviewNote
  const reqRes = await postHistory(new Request('http://localhost/api/workbooks/wb_CNTT/history', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'tcns_request_changes', unitCode, note: 'Bổ sung căn cứ Biểu B1' })
  }), ctx);
  const reqJson = await reqRes.json();
  assert.strictEqual(reqRes.status, 200);
  assert.strictEqual(reqJson.reviewMeta.status, 'can_bo_sung');
  assert.strictEqual(reqJson.reviewMeta.reviewNote, 'Bổ sung căn cứ Biểu B1');
  console.log('  ✓ [PASS] TC4: Phòng TCNS yêu cầu bổ sung -> can_bo_sung & lưu reviewNote');

  // 5. Đơn vị gửi lại -> da_gui_lai
  const resubRes = await postHistory(new Request('http://localhost/api/workbooks/wb_CNTT/history', {
    method: 'POST',
    headers: leaderHeaders,
    body: JSON.stringify({ action: 'submit_to_tcns', unitCode, note: 'Đã bổ sung đủ Biểu B1' })
  }), ctx);
  const resubJson = await resubRes.json();
  assert.strictEqual(resubRes.status, 200);
  assert.strictEqual(resubJson.reviewMeta.status, 'da_gui_lai');
  console.log('  ✓ [PASS] TC5: Đơn vị gửi lại TCNS -> da_gui_lai');

  // 6. TCNS xác nhận đạt -> dat_yeu_cau & wb.status === 'approved'
  const appRes = await postHistory(new Request('http://localhost/api/workbooks/wb_CNTT/history', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'tcns_approve', unitCode, note: 'Đạt yêu cầu thẩm định' })
  }), ctx);
  const appJson = await appRes.json();
  assert.strictEqual(appRes.status, 200);
  assert.strictEqual(appJson.reviewMeta.status, 'dat_yeu_cau');

  const wbGetRes = await getWorkbook(new Request('http://localhost/api/workbooks/wb_CNTT', { headers: leaderHeaders }), ctx);
  const wbGetJson = await wbGetRes.json();
  assert.strictEqual(wbGetJson.workbook.status, 'approved');
  console.log('  ✓ [PASS] TC6: Phòng TCNS xác nhận đạt -> dat_yeu_cau & wb.status === approved (Bước 4/4 Khóa)');

  // 7. Khóa cứng PUT /api/workbooks/[id] -> 403 FORBIDDEN_UNIT_APPROVED_LOCKED
  const lockedPutRes = await putWorkbook(new Request('http://localhost/api/workbooks/wb_CNTT', {
    method: 'PUT',
    headers: leaderHeaders,
    body: JSON.stringify({ data: wbGetJson.workbook.data, baseRevision: wbGetJson.workbook.currentRevision })
  }), ctx);
  const lockedPutJson = await lockedPutRes.json();
  assert.strictEqual(lockedPutRes.status, 403);
  assert.strictEqual(lockedPutJson.code, 'FORBIDDEN_UNIT_APPROVED_LOCKED');
  console.log('  ✓ [PASS] TC7: PUT /api/workbooks/[id] bị chặn 403 FORBIDDEN_UNIT_APPROVED_LOCKED khi đã khóa');

  // 8. Khóa cứng POST /api/tickets, PATCH /api/tickets, DELETE /api/tickets, submit_to_tcns -> 403
  const lockedPostTicket = await postTicket(new NextRequest('http://localhost/api/tickets', {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({ unitCode, maNhiemVu: 'NV01', maVtvl: 'CNTT-01', tenCongViec: 'Thử tạo khi khóa' })
  }));
  assert.strictEqual(lockedPostTicket.status, 403);
  assert.strictEqual((await lockedPostTicket.json()).code, 'FORBIDDEN_UNIT_APPROVED_LOCKED');

  const lockedPatchTicket = await patchTicket(new NextRequest('http://localhost/api/tickets', {
    method: 'PATCH',
    headers: staffHeaders,
    body: JSON.stringify({ ticketId: draftTicketId, action: 'submit' })
  }));
  assert.strictEqual(lockedPatchTicket.status, 403);
  assert.strictEqual((await lockedPatchTicket.json()).code, 'FORBIDDEN_UNIT_APPROVED_LOCKED');

  const lockedDeleteTicket = await deleteTicket(new NextRequest('http://localhost/api/tickets?id=' + encodeURIComponent(draftTicketId), {
    method: 'DELETE',
    headers: staffHeaders
  }));
  assert.strictEqual(lockedDeleteTicket.status, 403);
  assert.strictEqual((await lockedDeleteTicket.json()).code, 'FORBIDDEN_UNIT_APPROVED_LOCKED');

  const lockedSubmitAgain = await postHistory(new Request('http://localhost/api/workbooks/wb_CNTT/history', {
    method: 'POST',
    headers: leaderHeaders,
    body: JSON.stringify({ action: 'submit_to_tcns', unitCode })
  }), ctx);
  assert.strictEqual(lockedSubmitAgain.status, 403);
  assert.strictEqual((await lockedSubmitAgain.json()).code, 'FORBIDDEN_UNIT_APPROVED_LOCKED');
  console.log('  ✓ [PASS] TC8: POST/PATCH/DELETE /api/tickets & submit_to_tcns đều bị chặn 403 khi hồ sơ đã khóa');

  // 9. Phòng TCNS bấm Mở lại hồ sơ (tcns_reopen) -> mở khóa thành công
  const reopenRes = await postHistory(new Request('http://localhost/api/workbooks/wb_CNTT/history', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'tcns_reopen', unitCode, note: 'Mở lại theo công văn điều chỉnh' })
  }), ctx);
  const reopenJson = await reopenRes.json();
  assert.strictEqual(reopenRes.status, 200);
  assert.strictEqual(reopenJson.reviewMeta.status, 'chua_gui');
  console.log('  ✓ [PASS] TC9: Phòng TCNS Mở lại hồ sơ (tcns_reopen) -> mở khóa về chua_gui');

  // 10. Sau khi mở lại, PUT workbook và POST ticket hoạt động lại bình thường (200 OK)
  const wbAfterRes = await getWorkbook(new Request('http://localhost/api/workbooks/wb_CNTT', { headers: leaderHeaders }), ctx);
  const wbAfterJson = await wbAfterRes.json();
  assert.ok(['draft', 'not_started'].includes(wbAfterJson.workbook.status), 'Trạng thái sau mở khóa phải là draft hoặc not_started');

  const unlockedPut = await putWorkbook(new Request('http://localhost/api/workbooks/wb_CNTT', {
    method: 'PUT',
    headers: leaderHeaders,
    body: JSON.stringify({ data: wbAfterJson.workbook.data, baseRevision: wbAfterJson.workbook.currentRevision, commitMessage: 'Chỉnh sửa sau mở khóa' })
  }), ctx);
  assert.strictEqual(unlockedPut.status, 200, 'PUT workbook phải thành công sau khi mở khóa');

  const unlockedTicket = await postTicket(new NextRequest('http://localhost/api/tickets', {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({ unitCode, maNhiemVu: 'NV01', maVtvl: 'CNTT-01', tenCongViec: 'Tạo lại phiếu sau khi mở khóa' })
  }));
  assert.strictEqual(unlockedTicket.status, 200, 'POST ticket phải thành công sau khi mở khóa');
  console.log('  ✓ [PASS] TC10: PUT /api/workbooks/[id] & POST /api/tickets hoạt động lại 200 OK sau khi mở khóa');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
`,
    'utf8'
  );

  try {
    execSync(`npx tsx "${runnerPath}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'inherit'
    });
  } finally {
    if (fs.existsSync(runnerPath)) fs.unlinkSync(runnerPath);
  }

  console.log('\n================================================================');
  console.log(' KẾT QUẢ: 10/10 KỊCH BẢN THẨM ĐỊNH & KHÓA HỒ SƠ ĐẠT 100% (PASS)');
  console.log('================================================================\n');
} finally {
  for (const [p, content] of backups.entries()) {
    if (content === null) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } else {
      fs.writeFileSync(p, content, 'utf8');
    }
  }
}
