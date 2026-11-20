import assert from 'node:assert';
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
  console.log(' BỘ KIỂM THỬ CHỊU TẢI CAO & BẢO TOÀN NGHIỆP VỤ (12 KỊCH BẢN)');
  console.log('================================================================\n');

  const runnerPath = path.join(dataDir, '_tmp_hc_runner.ts');
  fs.writeFileSync(
    runnerPath,
    `
import assert from 'node:assert';
import fs from 'node:fs';
import { NextRequest } from 'next/server';
import { GET as getTickets, POST as postTicket, PUT as putTicket, PATCH as patchTicket } from '../src/app/api/tickets/route';
import { GET as getTicketDetail } from '../src/app/api/tickets/[id]/route';
import { GET as getTicketVersionsRoute } from '../src/app/api/tickets/[id]/versions/route';
import { GET as getTicketHistoryRoute } from '../src/app/api/tickets/[id]/history/route';
import { POST as postReconcile, GET as getReconcileJob } from '../src/app/api/tickets/reconcile/route';
import { GET as getAdminOverview } from '../src/app/api/admin/overview/route';
import { GET as getWorkbook } from '../src/app/api/workbooks/[id]/route';
import { generateUserSessionToken } from '../src/services/storage/server-auth-guard';
import { upsertUserAccount } from '../src/services/storage/server-account-store';
import { getOrCreateWorkbook, resetWorkbookMemoryStore } from '../src/services/storage/server-workbook-store';
import { resetTicketMemoryStore, loadTickets, persistTickets } from '../src/services/storage/server-ticket-store';
import { cacheGetOrSet, clearAllRuntimeCache } from '../src/services/storage/runtime-cache';
import { setDbTestHook } from '../src/services/storage/prisma';
import { getActiveHcmuteUnits } from '../src/configs/hcmute-units';

async function main() {
  resetWorkbookMemoryStore();
  resetTicketMemoryStore();
  clearAllRuntimeCache();

  await upsertUserAccount({
    email: 'tcns@hcmute.edu.vn', displayName: 'Quản trị TCNS', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Quản trị viên', role: 'admin',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'leader.cntt.hc@hcmute.edu.vn', displayName: 'Trưởng khoa CNTT', unitCode: 'CNTT',
    unitNameVi: 'Khoa Công nghệ thông tin', title: 'Lãnh đạo đơn vị', role: 'unit_leader',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'staff.cntt.hc@hcmute.edu.vn', displayName: 'Giảng viên CNTT', unitCode: 'CNTT',
    unitNameVi: 'Khoa Công nghệ thông tin', title: 'Cán bộ – Giảng viên', role: 'staff',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);

  const tokAdmin = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
  const tokLeaderCntt = generateUserSessionToken({ email: 'leader.cntt.hc@hcmute.edu.vn', role: 'unit_leader', unitCode: 'CNTT' });
  const tokStaffCntt = generateUserSessionToken({ email: 'staff.cntt.hc@hcmute.edu.vn', role: 'staff', unitCode: 'CNTT' });

  // TC 1: 50 request đồng thời cấp mã trong cùng (unit_code, ma_nhiem_vu) -> 0 trùng mã
  const allocPromises = Array.from({ length: 50 }, () =>
    putTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PUT',
      headers: { authorization: 'Bearer ' + tokStaffCntt, 'content-type': 'application/json' },
      body: JSON.stringify({ unitCode: 'CNTT', maNhiemVu: 'CNTT.NV09' })
    }))
  );
  const allocResList = await Promise.all(allocPromises);
  const allocatedCodes = await Promise.all(allocResList.map(async (r) => (await r.json()).nextTaskCode));
  const uniqueAlloc = new Set(allocatedCodes);
  assert.strictEqual(uniqueAlloc.size, 50, 'TC1: 50 request đồng thời phải nhận đủ 50 mã công việc duy nhất, không trùng');
  console.log('  ✓ [PASS] TC1: 50 request đồng thời cấp mã trong cùng (unit_code, ma_nhiem_vu) -> 50 mã duy nhất');

  // TC 2: 100 request đồng thời tạo phiếu ở 10 đơn vị
  const tenUnits = getActiveHcmuteUnits().slice(0, 10).map((u) => u.code);
  const create100 = Array.from({ length: 100 }, (_, idx) => {
    const uc = tenUnits[idx % 10];
    return postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: uc, action: 'draft', status: 'Nháp',
        maNhiemVu: uc + '.NV01', tenCongViec: 'Công việc đồng thời #' + idx, maVtvl: uc + '.CV01',
        sanPham: 'Hồ sơ', chatLuong: 'Đạt', canCu: 'QĐ 2266', soSpNam: 5, nguonSoLieu: 'Hệ thống', phutThucTe: 30
      })
    }));
  });
  const res100 = await Promise.all(create100);
  assert.ok(res100.every((r) => r.status === 200), 'TC2: Cả 100 request tạo phiếu ở 10 đơn vị đều trả 200 OK');
  const tickets100 = await Promise.all(res100.map(async (r) => (await r.json()).ticket));
  const unitTaskKeys = new Set(tickets100.map((t) => t.unitCode + '::' + t.maCongViec));
  assert.strictEqual(unitTaskKeys.size, 100, 'TC2: 100 phiếu ở 10 đơn vị có (unit_code, ma_cong_viec) hoàn toàn duy nhất');
  console.log('  ✓ [PASS] TC2: 100 request đồng thời tạo phiếu ở 10 đơn vị -> 100% thành công, 0 trùng mã');

  // TC 3: 2 người / 2 phiên cùng sửa 1 phiếu với expectedVersionNo cũ -> 1 thành công (200), 1 nhận HTTP 409 REVISION_CONFLICT
  const subInitRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tokStaffCntt, 'content-type': 'application/json' },
    body: JSON.stringify({
      unitCode: 'CNTT', action: 'submit', status: 'Đã nộp',
      maNhiemVu: 'CNTT.NV01', tenCongViec: 'Phiếu kiểm tra Optimistic Concurrency v1', maVtvl: 'CNTT.CV01',
      sanPham: 'Báo cáo v1', chatLuong: 'Đúng hạn', canCu: 'QĐ 01', soSpNam: 10, nguonSoLieu: 'LMS', phutThucTe: 60
    })
  }));
  const baseTicket = (await subInitRes.json()).ticket;
  assert.strictEqual(baseTicket.currentVersionNo, 1);

  const [editWin, editLose] = await Promise.all([
    postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokStaffCntt, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: baseTicket.id, unitCode: 'CNTT', action: 'update_pending', expectedVersionNo: 1,
        maNhiemVu: 'CNTT.NV01', tenCongViec: 'Cập nhật hợp lệ lên v2', maVtvl: 'CNTT.CV01',
        sanPham: 'Báo cáo v2', chatLuong: 'Đúng hạn', canCu: 'QĐ 01', soSpNam: 12, nguonSoLieu: 'LMS', phutThucTe: 60
      })
    })),
    postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokStaffCntt, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: baseTicket.id, unitCode: 'CNTT', action: 'update_pending', expectedVersionNo: 1,
        maNhiemVu: 'CNTT.NV01', tenCongViec: 'Cập nhật chậm hơn với expectedVersionNo=1 cũ', maVtvl: 'CNTT.CV01',
        sanPham: 'Báo cáo bị xung đột', chatLuong: 'Đúng hạn', canCu: 'QĐ 01', soSpNam: 99, nguonSoLieu: 'LMS', phutThucTe: 60
      })
    }))
  ]);
  const statuses3 = [editWin.status, editLose.status].sort();
  assert.deepStrictEqual(statuses3, [200, 409], 'TC3: 1 request thành công (200) và 1 request nhận HTTP 409 Conflict');
  const conflictRes = editWin.status === 409 ? editWin : editLose;
  const conflictBody = await conflictRes.json();
  assert.strictEqual(conflictBody.code, 'REVISION_CONFLICT', 'TC3: Mã lỗi xung đột phải là REVISION_CONFLICT');
  console.log('  ✓ [PASS] TC3: Optimistic Concurrency chống Lost Update -> trả HTTP 409 REVISION_CONFLICT chính xác');

  // TC 4: Double submit với cùng Idempotency-Key -> idempotent=true, không tạo thêm version
  const draftForIdem = (await (await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tokStaffCntt, 'content-type': 'application/json' },
    body: JSON.stringify({
      unitCode: 'CNTT', action: 'draft', status: 'Nháp',
      maNhiemVu: 'CNTT.NV01', tenCongViec: 'Phiếu test double submit', maVtvl: 'CNTT.CV01',
      sanPham: 'Báo cáo', chatLuong: 'Đạt', canCu: 'QĐ 01', soSpNam: 4, nguonSoLieu: 'LMS', phutThucTe: 45
    })
  }))).json()).ticket;

  const [sub1, sub2] = await Promise.all([
    patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokStaffCntt, 'content-type': 'application/json', 'idempotency-key': 'idem-submit-001' },
      body: JSON.stringify({ ticketId: draftForIdem.id, action: 'submit', unitCode: 'CNTT' })
    })),
    patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokStaffCntt, 'content-type': 'application/json', 'idempotency-key': 'idem-submit-001' },
      body: JSON.stringify({ ticketId: draftForIdem.id, action: 'submit', unitCode: 'CNTT' })
    }))
  ]);
  const bSub1 = await sub1.json();
  const bSub2 = await sub2.json();
  assert.strictEqual(bSub1.ok && bSub2.ok, true);
  assert.strictEqual(Boolean(bSub1.idempotent || bSub2.idempotent), true, 'TC4: Double submit phải đánh dấu idempotent=true');
  const verCheckRes = await getTicketVersionsRoute(new NextRequest('http://localhost:3360/api/tickets/' + draftForIdem.id + '/versions', {
    headers: { authorization: 'Bearer ' + tokStaffCntt }
  }), { params: Promise.resolve({ id: draftForIdem.id }) });
  const verCheckBody = await verCheckRes.json();
  assert.strictEqual(verCheckBody.versions.length, 1, 'TC4: Double submit chỉ tạo đúng 1 version');
  console.log('  ✓ [PASS] TC4: Double submit idempotent -> chỉ tạo đúng 1 phiên bản v1');

  // TC 5: Double approve với cùng Idempotency-Key -> idempotent=true, không nhân đôi lịch sử APPROVE
  const [ap1, ap2] = await Promise.all([
    patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokLeaderCntt, 'content-type': 'application/json', 'idempotency-key': 'idem-approve-001' },
      body: JSON.stringify({ ticketId: draftForIdem.id, action: 'approve', autoMerge: false, unitCode: 'CNTT' })
    })),
    patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokLeaderCntt, 'content-type': 'application/json', 'idempotency-key': 'idem-approve-001' },
      body: JSON.stringify({ ticketId: draftForIdem.id, action: 'approve', autoMerge: false, unitCode: 'CNTT' })
    }))
  ]);
  const bAp1 = await ap1.json();
  const bAp2 = await ap2.json();
  assert.strictEqual(Boolean(bAp1.idempotent || bAp2.idempotent), true, 'TC5: Double approve phải trả idempotent=true');
  const histCheckRes = await getTicketHistoryRoute(new NextRequest('http://localhost:3360/api/tickets/' + draftForIdem.id + '/history', {
    headers: { authorization: 'Bearer ' + tokLeaderCntt }
  }), { params: Promise.resolve({ id: draftForIdem.id }) });
  const histBody = await histCheckRes.json();
  const approveEvents = (histBody.statusHistory || []).filter((h: any) => h.action === 'APPROVE');
  assert.strictEqual(approveEvents.length, 1, 'TC5: Double approve chỉ tạo đúng 1 bản ghi lịch sử APPROVE');
  console.log('  ✓ [PASS] TC5: Double approve idempotent -> không tạo lịch sử duyệt trùng');

  // TC 6: Double merge với cùng Idempotency-Key -> idempotent=true, không nhân đôi dòng A2/B1
  const [mg1, mg2] = await Promise.all([
    patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokLeaderCntt, 'content-type': 'application/json', 'idempotency-key': 'idem-merge-001' },
      body: JSON.stringify({ ticketId: draftForIdem.id, action: 'merge', unitCode: 'CNTT' })
    })),
    patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokLeaderCntt, 'content-type': 'application/json', 'idempotency-key': 'idem-merge-001' },
      body: JSON.stringify({ ticketId: draftForIdem.id, action: 'merge', unitCode: 'CNTT' })
    }))
  ]);
  const bMg1 = await mg1.json();
  const bMg2 = await mg2.json();
  assert.strictEqual(Boolean(bMg1.idempotent || bMg2.idempotent), true, 'TC6: Double merge phải trả idempotent=true');
  const wbCntt = getOrCreateWorkbook('CNTT');
  assert.strictEqual((wbCntt.data.A2 || []).filter((r) => r.sourceTicketId === draftForIdem.id).length, 1, 'TC6: Chỉ có đúng 1 dòng trong A2');
  assert.strictEqual((wbCntt.data.B1 || []).filter((r) => r.sourceTicketId === draftForIdem.id).length, 1, 'TC6: Chỉ có đúng 1 dòng trong B1');
  console.log('  ✓ [PASS] TC6: Double merge idempotent -> không nhân đôi dòng trong Biểu A2 & B1');

  // TC 7: Batch reconcile 300 phiếu đã duyệt của 1 đơn vị (CK) -> formulaRuns = 1, workbookWrites = 1
  const store = loadTickets();
  const nowIso = new Date().toISOString();
  for (let i = 1; i <= 300; i++) {
    const id = 'tkt-CK-batch-' + String(i).padStart(3, '0');
    store.set(id, {
      id, unitCode: 'CK', unitId: 'CK', ownerEmail: 'staff.ck@hcmute.edu.vn', ownerId: 'staff.ck@hcmute.edu.vn',
      ownerName: 'Giảng viên CK ' + i, ownerTitle: 'Giảng viên', status: 'Đã duyệt',
      maNhiemVu: 'CK.NV01', maCongViec: 'CK.NV01.CV' + String(i + 100),
      tenCongViec: 'Công việc lô 300 #' + i, maVtvl: 'CK.GV01',
      sanPham: 'Bài giảng', chatLuong: 'Đạt', canCu: 'QĐ 2266',
      soSpNam: 4, nguonSoLieu: 'Đào tạo', phutThucTe: 60, gioBoSung: 1,
      approvedBy: 'leader.ck@hcmute.edu.vn', approvedAt: nowIso,
      isMergedToB1B2: false, currentVersionNo: 1,
      createdAt: nowIso, updatedAt: new Date(Date.now() - i * 1000).toISOString()
    });
  }
  persistTickets();

  const recRes = await postReconcile(new NextRequest('http://localhost:3360/api/tickets/reconcile', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
    body: JSON.stringify({ unitCode: 'CK' })
  }));
  assert.strictEqual(recRes.status, 200);
  const recBody = await recRes.json();
  assert.strictEqual(recBody.mergedCount, 300, 'TC7: Phải gộp đủ 300 phiếu trong 1 lần batch reconcile');
  assert.strictEqual(recBody.formulaRuns, 1, 'TC7: Phải tính lại công thức đúng 1 lần duy nhất cho cả 300 phiếu');
  assert.strictEqual(recBody.workbookWrites, 1, 'TC7: Phải ghi workbook đúng 1 lần duy nhất cho cả 300 phiếu');
  const wbCk = getOrCreateWorkbook('CK');
  assert.ok((wbCk.data.A2 || []).length >= 300 && (wbCk.data.B1 || []).length >= 300, 'TC7: Workbook CK có đủ >= 300 dòng A2 & B1');
  console.log(\`  ✓ [PASS] TC7: Batch reconcile 300 phiếu/đơn vị -> formulaRuns=1, workbookWrites=1 (\${recBody.durationMs}ms)\`);

  // TC 8: 39 đơn vị đồng thời chạy batch reconcile (Burst load) + kiểm tra background_jobs queue
  const all39Units = getActiveHcmuteUnits();
  for (const u of all39Units) {
    const tid = \`tkt-burst-\${u.code}-01\`;
    store.set(tid, {
      id: tid, unitCode: u.code, unitId: u.code, ownerEmail: \`staff.\${u.code.toLowerCase()}@hcmute.edu.vn\`,
      ownerName: \`Cán bộ \${u.code}\`, ownerTitle: 'Chuyên viên', status: 'Đã duyệt',
      maNhiemVu: \`\${u.code}.NV01\`, maCongViec: \`\${u.code}.NV01.CV888\`,
      tenCongViec: \`Phiếu burst \${u.code}\`, maVtvl: \`\${u.code}.CV01\`,
      sanPham: 'Hồ sơ', chatLuong: 'Đạt', canCu: 'QĐ', soSpNam: 2, nguonSoLieu: 'HT', phutThucTe: 60, gioBoSung: 0,
      isMergedToB1B2: false, currentVersionNo: 1, createdAt: nowIso, updatedAt: nowIso
    });
  }
  persistTickets();

  const burst39Res = await Promise.all(
    all39Units.map((u, idx) =>
      postReconcile(new NextRequest('http://localhost:3360/api/tickets/reconcile', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
        body: JSON.stringify({ unitCode: u.code, async: idx === 0 })
      }))
    )
  );
  assert.ok(burst39Res.every((r) => r.status === 200 || r.status === 202), 'TC8: 39 đơn vị đồng thời reconcile đều thành công (200/202)');
  const asyncJobBody = await burst39Res[0].json();
  assert.strictEqual(asyncJobBody.mode, 'background_job');
  const jobPoll = await getReconcileJob(new NextRequest('http://localhost:3360/api/tickets/reconcile?jobId=' + asyncJobBody.job.id, {
    headers: { authorization: 'Bearer ' + tokAdmin }
  }));
  assert.strictEqual((await jobPoll.json()).job.status, 'completed', 'TC8: Background job hoàn tất trạng thái completed');
  console.log('  ✓ [PASS] TC8: Burst load 39 đơn vị đồng thời reconcile + PostgreSQL job queue (SKIP LOCKED) thành công');

  // TC 9: GET route không tạo side-effect ghi dữ liệu (0 lần gọi fs.writeFileSync, 0 thay đổi trạng thái phiếu)
  const unmergedId = 'tkt-CNTT-unmerged-get-test';
  const activeStore = loadTickets();
  activeStore.set(unmergedId, {
    id: unmergedId, unitCode: 'CNTT', unitId: 'CNTT', ownerEmail: 'staff.cntt.hc@hcmute.edu.vn',
    ownerName: 'GV CNTT', ownerTitle: 'Giảng viên', status: 'Đã duyệt',
    maNhiemVu: 'CNTT.NV01', maCongViec: 'CNTT.NV01.CV777', tenCongViec: 'Phiếu test GET read-only', maVtvl: 'CNTT.CV01',
    sanPham: 'SP', chatLuong: 'Đạt', canCu: 'QĐ', soSpNam: 3, nguonSoLieu: 'HT', phutThucTe: 60, gioBoSung: 0,
    isMergedToB1B2: false, currentVersionNo: 1, createdAt: nowIso, updatedAt: nowIso
  });
  persistTickets();

  let writeCountDuringGet = 0;
  const origWriteSync = fs.writeFileSync;
  fs.writeFileSync = function (...args: Parameters<typeof fs.writeFileSync>) {
    writeCountDuringGet++;
    return origWriteSync.apply(fs, args);
  };
  try {
    const g1 = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=CNTT&view=list&limit=25', {
      headers: { authorization: 'Bearer ' + tokLeaderCntt }
    }));
    const g2 = await getWorkbook(new NextRequest('http://localhost:3360/api/workbooks/wb_CNTT_2026', {
      headers: { authorization: 'Bearer ' + tokLeaderCntt }
    }), { params: Promise.resolve({ id: 'wb_CNTT_2026' }) });
    const g3 = await getAdminOverview(new NextRequest('http://localhost:3360/api/admin/overview?unitCode=ALL', {
      headers: { authorization: 'Bearer ' + tokAdmin }
    }));
    const g4 = await getTicketDetail(new NextRequest('http://localhost:3360/api/tickets/' + unmergedId, {
      headers: { authorization: 'Bearer ' + tokLeaderCntt }
    }), { params: Promise.resolve({ id: unmergedId }) });
    assert.strictEqual(g1.status, 200);
    assert.strictEqual(g2.status, 200);
    assert.strictEqual(g3.status, 200);
    assert.strictEqual(g4.status, 200);
  } finally {
    fs.writeFileSync = origWriteSync;
  }
  assert.strictEqual(writeCountDuringGet, 0, 'TC9: Các GET route tuyệt đối không gọi writeFileSync');
  assert.strictEqual(loadTickets().get(unmergedId)?.isMergedToB1B2, false, 'TC9: GET route không tự ý sửa trạng thái isMergedToB1B2 của phiếu trong store');
  console.log('  ✓ [PASS] TC9: GET routes (/api/tickets, /api/workbooks/:id, /api/admin/overview, /api/tickets/:id) hoàn toàn Read-Only (0 write side-effects)');

  // TC 10: Cursor pagination không bỏ sót và không trùng dữ liệu qua toàn bộ 300 phiếu của đơn vị CK + List DTO nhẹ
  const seenIds = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  do {
    const url = 'http://localhost:3360/api/tickets?unitCode=CK&view=list&limit=50' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
    const pageRes = await getTickets(new NextRequest(url, { headers: { authorization: 'Bearer ' + tokAdmin } }));
    assert.strictEqual(pageRes.status, 200);
    const pageBody = await pageRes.json();
    pages++;
    for (const item of pageBody.items) {
      assert.strictEqual(item.versions, undefined, 'TC10: List DTO không được chứa mảng versions nặng');
      assert.strictEqual(item.mergeLinks, undefined, 'TC10: List DTO không được chứa mảng mergeLinks nặng');
      assert.strictEqual(seenIds.has(item.id), false, 'TC10: Cursor pagination không được trả trùng phiếu giữa các trang');
      seenIds.add(item.id);
    }
    cursor = pageBody.nextCursor;
  } while (cursor && pages < 20);
  assert.ok(seenIds.size >= 301, \`TC10: Duyệt cursor pagination lấy đủ toàn bộ \${seenIds.size} phiếu của đơn vị CK qua \${pages} trang\`);
  console.log(\`  ✓ [PASS] TC10: Cursor pagination duyệt \${seenIds.size} phiếu qua \${pages} trang không trùng, không sót & List DTO nhẹ\`);

  // TC 11: Khi database được cấu hình trên Production (VTVL_ISOLATED_LOCAL_STORE=false) -> không ghi file JSON local
  const prevIso = process.env.VTVL_ISOLATED_LOCAL_STORE;
  let prodWriteCalls = 0;
  fs.writeFileSync = function (...args: Parameters<typeof fs.writeFileSync>) {
    prodWriteCalls++;
    return origWriteSync.apply(fs, args);
  };
  try {
    process.env.VTVL_ISOLATED_LOCAL_STORE = 'false';
    setDbTestHook({ select: async () => [], upsert: async () => ({ ok: true, status: 200 }) });
    persistTickets();
    assert.strictEqual(prodWriteCalls, 0, 'TC11: Khi DB được cấu hình, persistTickets() không gọi fs.writeFileSync');
  } finally {
    setDbTestHook(null);
    process.env.VTVL_ISOLATED_LOCAL_STORE = prevIso;
    fs.writeFileSync = origWriteSync;
  }
  console.log('  ✓ [PASS] TC11: Khi PostgreSQL được cấu hình, hệ thống không serialize hay ghi file JSON local (0 fs.writeFileSync)');

  // TC 12: Single-flight cache chống Cache Stampede (50 request đồng thời chỉ gọi fetcher đúng 1 lần)
  clearAllRuntimeCache();
  let loaderInvocations = 0;
  const sfResults = await Promise.all(
    Array.from({ length: 50 }, () =>
      cacheGetOrSet('test:stampede:key', ['overview-stats'], 5000, async () => {
        loaderInvocations++;
        await new Promise((r) => setTimeout(r, 25));
        return { total: 20000 };
      }, { forceSingleFlight: true })
    )
  );
  assert.strictEqual(loaderInvocations, 1, 'TC12: 50 request đồng thời khi cache miss chỉ kích hoạt hàm nạp dữ liệu đúng 1 lần');
  assert.ok(sfResults.every((r) => r.total === 20000));
  console.log('  ✓ [PASS] TC12: Single-flight cache chống Cache Stampede -> 50 request đồng thời chỉ gọi DB fetcher đúng 1 lần');
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
      env: {
        ...process.env,
        VTVL_ISOLATED_LOCAL_STORE: 'true',
        VTVL_API_RATE_LIMIT_ENABLED: process.env.VTVL_API_RATE_LIMIT_ENABLED ?? 'false',
        VTVL_HEAVY_MAX_QUEUE: process.env.VTVL_HEAVY_MAX_QUEUE ?? '150',
        VTVL_LOCK_MAX_WAITERS: process.env.VTVL_LOCK_MAX_WAITERS ?? '60'
      },
      stdio: 'inherit'
    });
  } finally {
    if (fs.existsSync(runnerPath)) fs.unlinkSync(runnerPath);
  }

  console.log('\n================================================================');
  console.log(' KẾT QUẢ: 12/12 KỊCH BẢN CHỊU TẢI CAO ĐẠT 100% (PASS)');
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
