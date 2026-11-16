import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { spawnSync } from 'child_process';

const root = process.cwd();

console.log('================================================================');
console.log(' BỘ KIỂM THỬ ĐỀ XUẤT PHỐI HỢP VTVL (12 KỊCH BẢN BẮT BUỘC)');
console.log(' Môi trường: Cô lập hoàn toàn (VTVL_ISOLATED_LOCAL_STORE=true)');
console.log('================================================================');

const dataDir = path.join(root, '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dataFilesToBackup = [
  'server_accounts.json',
  'accounts.json',
  'staff_tickets.json',
  'work_survey_versions.json',
  'work_survey_merge_links.json',
  'audit-logs.json',
  'audit_logs.json',
  'server_workbooks.json',
  'deleted_workbooks.json',
  'custom_units.json',
  'user_vtvl_assignments.json',
  'work_survey_coordinated_vtvls.json'
];

const backups = new Map();
for (const fileName of dataFilesToBackup) {
  const fullPath = path.join(dataDir, fileName);
  backups.set(fileName, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null);
}

// Dọn sạch dữ liệu giao dịch trong .data tạm thời (đã sao lưu an toàn vào backups)
for (const txFile of ['staff_tickets.json', 'work_survey_versions.json', 'user_vtvl_assignments.json', 'work_survey_coordinated_vtvls.json']) {
  const full = path.join(dataDir, txFile);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

const runnerScriptPath = path.join(dataDir, 'temp-coordinated-proposals-runner.ts');

const runnerSource = `
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { NextRequest } from 'next/server';
import { GET as getTickets, POST as postTicket, PATCH as patchTicket } from '@/app/api/tickets/route';
import { GET as getCoordinated } from '@/app/api/tickets/coordinated/route';
import { GET as getAssignments, PUT as putAssignments } from '@/app/api/vtvl-assignments/route';
import { generateUserSessionToken } from '@/services/storage/server-auth-guard';
import { upsertUserAccount } from '@/services/storage/server-account-store';
import { getOrCreateWorkbook, resetWorkbookMemoryStore } from '@/services/storage/server-workbook-store';
import { loadTickets, persistTickets, resetTicketMemoryStore } from '@/services/storage/server-ticket-store';
import { resetCoordinationMemoryStore } from '@/services/storage/server-coordination-store';
import { resetVtvlAssignmentMemoryStore } from '@/services/storage/server-vtvl-assignment-store';
import { getSubmittedCoordinationHistory } from '@/services/tickets/vtvl-coordination-service';

const root = process.cwd();
let passCount = 0;

async function runCase(id: string, name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passCount += 1;
    console.log(\`  ✓ [PASS] [\${id}] \${name}\`);
  } catch (err: any) {
    console.error(\`  ✗ [FAIL] [\${id}] \${name}:\`, err?.message || err);
    process.exitCode = 1;
    throw err;
  }
}

async function main() {
  resetTicketMemoryStore();
  resetCoordinationMemoryStore();
  resetVtvlAssignmentMemoryStore();
  resetWorkbookMemoryStore();

  await upsertUserAccount({
    email: 'tcns@hcmute.edu.vn', displayName: 'Quản trị viên TCNS', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Quản trị viên', role: 'admin',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'coord.leader.tcns@hcmute.edu.vn', displayName: 'Lãnh đạo TCNS', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Trưởng phòng', role: 'unit_leader',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'coord.a.tcns@hcmute.edu.vn', displayName: 'Cán bộ A (TCNS)', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Chuyên viên', role: 'staff',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'coord.b.tcns@hcmute.edu.vn', displayName: 'Cán bộ B (TCNS)', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Chuyên viên', role: 'staff',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'coord.b2.tcns@hcmute.edu.vn', displayName: 'Cán bộ B2 (TCNS)', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Chuyên viên', role: 'staff',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'coord.c.tcns@hcmute.edu.vn', displayName: 'Cán bộ C (TCNS)', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Chuyên viên', role: 'staff',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'coord.d.cntt@hcmute.edu.vn', displayName: 'Giảng viên D (CNTT)', unitCode: 'CNTT',
    unitNameVi: 'Khoa Công nghệ Thông tin', title: 'Giảng viên', role: 'staff',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);

  const wbTcnsInit = getOrCreateWorkbook('TCNS', '01/10/2025–30/9/2026', 'tcns@hcmute.edu.vn', 'Quản trị viên');
  const wbCnttInit = getOrCreateWorkbook('CNTT', '01/10/2025–30/9/2026', 'tcns@hcmute.edu.vn', 'Quản trị viên');
  const cnttB1LenBefore = (wbCnttInit.data?.B1 || []).length;
  const cnttB2LenBefore = (wbCnttInit.data?.B2 || []).length;
  const tcnsB1LenBefore = (wbTcnsInit.data?.B1 || []).length;
  const tcnsB2LenBefore = (wbTcnsInit.data?.B2 || []).length;

  const tokAdmin = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
  const tokLeader = generateUserSessionToken({ email: 'coord.leader.tcns@hcmute.edu.vn', role: 'unit_leader', unitCode: 'TCNS' });
  const tokA = generateUserSessionToken({ email: 'coord.a.tcns@hcmute.edu.vn', role: 'staff', unitCode: 'TCNS' });
  const tokB = generateUserSessionToken({ email: 'coord.b.tcns@hcmute.edu.vn', role: 'staff', unitCode: 'TCNS' });
  const tokB2 = generateUserSessionToken({ email: 'coord.b2.tcns@hcmute.edu.vn', role: 'staff', unitCode: 'TCNS' });
  const tokC = generateUserSessionToken({ email: 'coord.c.tcns@hcmute.edu.vn', role: 'staff', unitCode: 'TCNS' });
  const tokD = generateUserSessionToken({ email: 'coord.d.cntt@hcmute.edu.vn', role: 'staff', unitCode: 'CNTT' });

  const assignVtvls = async (userEmail: string, maVtvls: string[]) => {
    const r = await putAssignments(new NextRequest('http://localhost:3360/api/vtvl-assignments', {
      method: 'PUT',
      headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
      body: JSON.stringify({ userEmail, items: maVtvls.map((maVtvl) => ({ maVtvl })) })
    }));
    assert.strictEqual(r.status, 200, 'Gán VTVL cho ' + userEmail + ' phải thành công');
  };

  await assignVtvls('coord.b.tcns@hcmute.edu.vn', ['TCNS.VTVL_B', 'VTVL-CHUNG-01', 'TCNS.VTVL_SHARED']);
  await assignVtvls('coord.b2.tcns@hcmute.edu.vn', ['TCNS.VTVL_SHARED']);
  await assignVtvls('coord.c.tcns@hcmute.edu.vn', ['TCNS.VTVL_C']);
  await assignVtvls('coord.d.cntt@hcmute.edu.vn', ['CNTT.VTVL_D', 'VTVL-CHUNG-01']);

  let cv01Id = '';
  let cv02Id = '';
  let sharedTicketId = '';

  // Kịch bản 1: A chọn VTVL của B: lưu nháp chưa hiện cho B; nộp thành công thì hiện
  await runCase('CP-01', 'A chọn VTVL của B: xem trước nhận đúng người, lưu nháp chưa hiện cho B, nộp mới hiện', async () => {
    const prevRes = await getAssignments(new NextRequest('http://localhost:3360/api/vtvl-assignments?mode=preview&targets=TCNS::TCNS.VTVL_B', {
      headers: { authorization: 'Bearer ' + tokA }
    }));
    assert.strictEqual(prevRes.status, 200);
    const prevJson = await prevRes.json();
    assert.strictEqual(prevJson.previews[0].recipients.length, 1);
    assert.strictEqual(prevJson.previews[0].recipients[0].displayName, 'Cán bộ B (TCNS)');

    const createRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'TCNS', ownerEmail: 'coord.a.tcns@hcmute.edu.vn', ownerName: 'Cán bộ A (TCNS)', ownerTitle: 'Chuyên viên',
        maNhiemVu: 'TCNS.NV01', maCongViec: 'TCNS.NV01.CV91', tenCongViec: 'Tổng hợp hồ sơ tuyển dụng đợt 1',
        maVtvl: 'TCNS.VTVL_A', maVtvlPhoiHop: 'TCNS.VTVL_B', coordinationNote: 'B kiểm tra định mức biên chế',
        sanPham: 'Sản phẩm đã nộp v1', chatLuong: 'Đủ chữ ký', canCu: 'QĐ 2266',
        soSpNam: 12, phutThucTe: 60, gioBoSung: 0, nguonSoLieu: 'Sổ giao nhận TCNS', status: 'draft'
      })
    }));
    assert.strictEqual(createRes.status, 200);
    cv01Id = (await createRes.json()).ticket.id;

    // Nháp: B chưa được thấy ở danh sách và detail API
    const draftList = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokB } }))).json();
    assert.strictEqual(draftList.items.length, 0, 'Phiếu Nháp tuyệt đối không hiện trong tab phối hợp của B');
    const draftDetail = await getCoordinated(new NextRequest(\`http://localhost:3360/api/tickets/coordinated?surveyId=\${cv01Id}\`, { headers: { authorization: 'Bearer ' + tokB } }));
    assert.strictEqual(draftDetail.status, 404, 'Phiếu Nháp không được mở ở detail API phối hợp');

    // Nộp phiếu
    const subRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: cv01Id, action: 'submit' })
    }));
    assert.strictEqual(subRes.status, 200);

    const subList = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokB } }))).json();
    assert.strictEqual(subList.items.length, 1);
    assert.strictEqual(subList.items[0].maCongViec, 'TCNS.NV01.CV91');
    assert.strictEqual(subList.items[0].versionNo, 1);
    assert.strictEqual(subList.items[0].sourceStatus, 'Đã nộp');
  });

  // Kịch bản 2: B chỉ thấy công việc được gắn phối hợp, không thấy công việc khác cùng nhiệm vụ NV01
  await runCase('CP-02', 'B thấy đúng CV01, không thấy CV02 không gắn VTVL của B trong cùng nhiệm vụ NV01', async () => {
    const res2 = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'TCNS', ownerEmail: 'coord.a.tcns@hcmute.edu.vn', ownerName: 'Cán bộ A (TCNS)', ownerTitle: 'Chuyên viên',
        maNhiemVu: 'TCNS.NV01', maCongViec: 'TCNS.NV01.CV92', tenCongViec: 'Công việc nội bộ khác của A',
        maVtvl: 'TCNS.VTVL_A', maVtvlPhoiHop: 'TCNS.VTVL_C',
        sanPham: 'Báo cáo riêng', chatLuong: 'Chuẩn', canCu: 'QĐ nội bộ',
        soSpNam: 5, phutThucTe: 30, gioBoSung: 0, nguonSoLieu: 'TCNS', status: 'draft'
      })
    }));
    cv02Id = (await res2.json()).ticket.id;
    await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: cv02Id, action: 'submit' })
    }));

    const listB = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokB } }))).json();
    assert.ok(listB.items.some((i: any) => i.surveyId === cv01Id), 'B phải thấy CV01');
    assert.ok(!listB.items.some((i: any) => i.surveyId === cv02Id), 'B tuyệt đối không thấy CV02 dù cùng NV01');
    const detailBOnCv02 = await getCoordinated(new NextRequest(\`http://localhost:3360/api/tickets/coordinated?surveyId=\${cv02Id}\`, { headers: { authorization: 'Bearer ' + tokB } }));
    assert.strictEqual(detailBOnCv02.status, 403);
  });

  // Kịch bản 3: Người không thuộc VTVL nhận không xem được ở danh sách & API chi tiết (và chặn giả mạo actorEmail)
  await runCase('CP-03', 'Người không thuộc VTVL phối hợp bị chặn 403 trên API chi tiết và không có trong danh sách', async () => {
    const listC = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokC } }))).json();
    assert.ok(!listC.items.some((i: any) => i.surveyId === cv01Id), 'C không thấy CV01');

    const detC = await getCoordinated(new NextRequest(\`http://localhost:3360/api/tickets/coordinated?surveyId=\${cv01Id}\`, { headers: { authorization: 'Bearer ' + tokC } }));
    assert.strictEqual(detC.status, 403);
    assert.strictEqual((await detC.json()).code, 'FORBIDDEN_NOT_COORDINATED_RECIPIENT');

    const spoof = await getCoordinated(new NextRequest(\`http://localhost:3360/api/tickets/coordinated?actorEmail=coord.b.tcns@hcmute.edu.vn\`, { headers: { authorization: 'Bearer ' + tokC } }));
    assert.strictEqual(spoof.status, 403);
    assert.strictEqual((await spoof.json()).code, 'FORBIDDEN_ACTOR_SPOOFING');
  });

  // Kịch bản 4: Mã VTVL giống nhau ở 2 đơn vị (TCNS và CNTT cùng có VTVL-CHUNG-01) không nhận nhầm
  await runCase('CP-04', 'Cùng mã VTVL-CHUNG-01 ở TCNS và CNTT nhưng đối chiếu theo (unitCode, maVtvl) không nhầm đơn vị', async () => {
    const r = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'TCNS', ownerEmail: 'coord.a.tcns@hcmute.edu.vn', ownerName: 'Cán bộ A (TCNS)', ownerTitle: 'Chuyên viên',
        maNhiemVu: 'TCNS.NV02', maCongViec: 'TCNS.NV02.CV01', tenCongViec: 'Đề xuất cùng mã VTVL-CHUNG-01 tại TCNS',
        maVtvl: 'TCNS.VTVL_A', maVtvlPhoiHop: 'VTVL-CHUNG-01',
        sanPham: 'Hồ sơ TCNS', chatLuong: 'Đạt', canCu: 'QĐ',
        soSpNam: 2, phutThucTe: 30, gioBoSung: 0, nguonSoLieu: 'TCNS', status: 'draft'
      })
    }));
    const tid = (await r.json()).ticket.id;
    await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: tid, action: 'submit' })
    }));

    const listB = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokB } }))).json();
    const listD = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokD } }))).json();
    assert.ok(listB.items.some((i: any) => i.surveyId === tid), 'B thuộc TCNS phải thấy đề xuất (TCNS, VTVL-CHUNG-01)');
    assert.ok(!listD.items.some((i: any) => i.surveyId === tid), 'D thuộc CNTT tuyệt đối không thấy dù trùng mã VTVL-CHUNG-01');
    const detD = await getCoordinated(new NextRequest(\`http://localhost:3360/api/tickets/coordinated?surveyId=\${tid}\`, { headers: { authorization: 'Bearer ' + tokD } }));
    assert.strictEqual(detD.status, 403);
  });

  // Kịch bản 5: Nhiều người cùng được phân công một mã VTVL đều thấy
  await runCase('CP-05', 'Nhiều người cùng được gán TCNS.VTVL_SHARED đều xem được đề xuất', async () => {
    const r = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'TCNS', ownerEmail: 'coord.a.tcns@hcmute.edu.vn', ownerName: 'Cán bộ A (TCNS)', ownerTitle: 'Chuyên viên',
        maNhiemVu: 'TCNS.NV03', maCongViec: 'TCNS.NV03.CV01', tenCongViec: 'Công việc phối hợp nhóm B & B2',
        maVtvl: 'TCNS.VTVL_A', maVtvlPhoiHop: 'TCNS.VTVL_SHARED',
        sanPham: 'Bảng tổng hợp nhóm', chatLuong: 'Chuẩn', canCu: 'QĐ',
        soSpNam: 4, phutThucTe: 30, gioBoSung: 0, nguonSoLieu: 'TCNS', status: 'draft'
      })
    }));
    sharedTicketId = (await r.json()).ticket.id;
    await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: sharedTicketId, action: 'submit' })
    }));

    const prev = await (await getAssignments(new NextRequest('http://localhost:3360/api/vtvl-assignments?mode=preview&targets=TCNS::TCNS.VTVL_SHARED', { headers: { authorization: 'Bearer ' + tokA } }))).json();
    assert.strictEqual(prev.previews[0].recipients.length, 2);

    const listB = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokB } }))).json();
    const listB2 = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokB2 } }))).json();
    assert.ok(listB.items.some((i: any) => i.surveyId === sharedTicketId));
    assert.ok(listB2.items.some((i: any) => i.surveyId === sharedTicketId));
  });

  // Kịch bản 6: Chưa có người nhận vẫn lưu/nộp được và thông báo đúng thông điệp
  await runCase('CP-06', 'Mã VTVL chưa có người được phân công vẫn lưu được và hiển thị đúng cảnh báo', async () => {
    const prev = await (await getAssignments(new NextRequest('http://localhost:3360/api/vtvl-assignments?mode=preview&targets=TCNS::TCNS.VTVL_NO_ONE', { headers: { authorization: 'Bearer ' + tokA } }))).json();
    assert.strictEqual(prev.previews[0].recipients.length, 0);
    assert.strictEqual(prev.previews[0].emptyMessage, 'Chưa có người được phân công mã VTVL phối hợp này');

    const r = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'TCNS', ownerEmail: 'coord.a.tcns@hcmute.edu.vn', ownerName: 'Cán bộ A (TCNS)', ownerTitle: 'Chuyên viên',
        maNhiemVu: 'TCNS.NV04', maCongViec: 'TCNS.NV04.CV01', tenCongViec: 'Phối hợp mã VTVL chưa phân công',
        maVtvl: 'TCNS.VTVL_A', maVtvlPhoiHop: 'TCNS.VTVL_NO_ONE',
        sanPham: 'Hồ sơ chờ gán', chatLuong: 'Đạt', canCu: 'QĐ',
        soSpNam: 1, phutThucTe: 15, gioBoSung: 0, nguonSoLieu: 'TCNS', status: 'draft'
      })
    }));
    assert.strictEqual(r.status, 200);
    const tid = (await r.json()).ticket.id;
    const subRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: tid, action: 'submit' })
    }));
    assert.strictEqual(subRes.status, 200);
    const hist = getSubmittedCoordinationHistory(tid);
    assert.strictEqual(hist.length, 1);
    assert.strictEqual(hist[0].targetVtvlCode, 'TCNS.VTVL_NO_ONE');
  });

  // Kịch bản 8 & 7: Yêu cầu bổ sung + sửa nháp chưa nộp không lộ + Nộp lại thêm/bỏ mã cập nhật đúng không trùng
  await runCase('CP-08', 'Nội dung đang sửa sau yêu cầu bổ sung không bị lộ cho người nhận trước khi nộp lại', async () => {
    const reqRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH', headers: { authorization: 'Bearer ' + tokLeader, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: cv01Id, action: 'request_changes', reason: 'Cần cập nhật VTVL phối hợp liên đơn vị' })
    }));
    assert.strictEqual(reqRes.status, 200);

    // A sửa nháp trên phiếu đang Yêu cầu bổ sung nhưng CHƯA bấm nộp lại
    const editDraft = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: cv01Id, unitCode: 'TCNS', maNhiemVu: 'TCNS.NV01', maCongViec: 'TCNS.NV01.CV91',
        tenCongViec: 'Tổng hợp hồ sơ tuyển dụng đợt 1', maVtvl: 'TCNS.VTVL_A',
        maVtvlPhoiHop: 'TCNS.VTVL_C',
        coordinatedVtvls: [{ id: 'cvtvl-CNTT-CNTT.VTVL_D', targetUnitCode: 'CNTT', maVtvl: 'CNTT.VTVL_D', note: 'Nháp liên đơn vị' }],
        sanPham: 'Nháp đang sửa chưa nộp', chatLuong: 'Đủ chữ ký', canCu: 'QĐ 2266',
        soSpNam: 15, phutThucTe: 60, gioBoSung: 0, nguonSoLieu: 'Sổ giao nhận TCNS', status: 'changes_requested'
      })
    }));
    assert.strictEqual(editDraft.status, 200);

    // B vẫn thấy v1 đã nộp, KHÔNG thấy 'Nháp đang sửa chưa nộp'; C & D chưa thấy
    const detB = await getCoordinated(new NextRequest(\`http://localhost:3360/api/tickets/coordinated?surveyId=\${cv01Id}\`, { headers: { authorization: 'Bearer ' + tokB } }));
    assert.strictEqual(detB.status, 200);
    const detBJson = await detB.json();
    assert.strictEqual(detBJson.item.sanPham, 'Sản phẩm đã nộp v1');
    assert.strictEqual(detBJson.item.versionNo, 1);
    assert.strictEqual(detBJson.item.sourceStatus, 'Yêu cầu bổ sung');
    const listD = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokD } }))).json();
    assert.ok(!listD.items.some((i: any) => i.surveyId === cv01Id), 'D chưa được thấy trước khi A nộp lại');
  });

  await runCase('CP-07', 'Nộp lại cập nhật đúng danh sách VTVL mới (gỡ B, thêm C & D), không tạo trùng và giữ lịch sử phiên bản', async () => {
    const resub = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: cv01Id, action: 'resubmit', changeSummary: 'Chuyển phối hợp sang TCNS.VTVL_C và CNTT.VTVL_D' })
    }));
    assert.strictEqual(resub.status, 200);

    // B bị gỡ -> không còn xem được CV01
    const listB = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokB } }))).json();
    assert.ok(!listB.items.some((i: any) => i.surveyId === cv01Id));
    assert.strictEqual((await getCoordinated(new NextRequest(\`http://localhost:3360/api/tickets/coordinated?surveyId=\${cv01Id}\`, { headers: { authorization: 'Bearer ' + tokB } }))).status, 403);

    // C và D mỗi người thấy đúng 1 dòng v2
    const listC = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokC } }))).json();
    const listD = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokD } }))).json();
    const cRows = listC.items.filter((i: any) => i.surveyId === cv01Id);
    const dRows = listD.items.filter((i: any) => i.surveyId === cv01Id);
    assert.strictEqual(cRows.length, 1);
    assert.strictEqual(dRows.length, 1);
    assert.strictEqual(dRows[0].versionNo, 2);
    assert.strictEqual(dRows[0].sanPham, 'Nháp đang sửa chưa nộp');

    const hist = getSubmittedCoordinationHistory(cv01Id);
    assert.ok(hist.some((h) => h.versionNo === 1 && !h.isLatestSubmitted), 'Lịch sử phải giữ bản v1 isLatestSubmitted=false');
    assert.ok(hist.some((h) => h.versionNo === 2 && h.isLatestSubmitted && h.targetVtvlCode === 'CNTT.VTVL_D'), 'v2 mới nhất phải isLatestSubmitted=true');
  });

  // Kịch bản 9: Phối hợp khác đơn vị chỉ mở đúng phạm vi dữ liệu cần thiết
  await runCase('CP-09', 'Phối hợp khác đơn vị tối thiểu hóa dữ liệu (không lộ email, giờ công, phiếu khác của TCNS)', async () => {
    const detD = await (await getCoordinated(new NextRequest(\`http://localhost:3360/api/tickets/coordinated?surveyId=\${cv01Id}\`, { headers: { authorization: 'Bearer ' + tokD } }))).json();
    const item = detD.item;
    assert.strictEqual('ownerEmail' in item, false, 'Không được trả ownerEmail');
    assert.strictEqual('phutThucTe' in item, false, 'Không được trả phutThucTe');
    assert.strictEqual('soSpNam' in item, false, 'Không được trả soSpNam');
    assert.strictEqual('gioBoSung' in item, false, 'Không được trả gioBoSung');
    assert.strictEqual('canCu' in item, false, 'Không được trả canCu');
    assert.strictEqual(item.matchedVtvls.length, 1);
    assert.strictEqual(item.matchedVtvls[0].targetUnitCode, 'CNTT', 'Chỉ trả mã VTVL liên quan của D');

    const unitRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=TCNS', { headers: { authorization: 'Bearer ' + tokD } }));
    const unitJson = await unitRes.json().catch(() => ({}));
    assert.ok(unitRes.status === 403 || !(unitJson.unitTickets || []).some((t: any) => t.unitCode === 'TCNS'), 'D thuộc CNTT không được xem danh sách phiếu đơn vị TCNS');
  });

  // Kịch bản 10: Không tự tạo phiếu cá nhân, không cộng giờ, không tự gộp biểu; kiểm tra giữ nguyên UI constraints
  await runCase('CP-10', 'Không tự tạo phiếu, không cộng giờ, không tự gộp B1/B2 và đảm bảo UI chỉ đọc + nhãn chuẩn', async () => {
    const dTickets = await (await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=CNTT', { headers: { authorization: 'Bearer ' + tokD } }))).json();
    assert.strictEqual((dTickets.myTickets || []).length, 0, 'Đề xuất phối hợp không tự tạo phiếu cá nhân cho D');

    const wbCntt = getOrCreateWorkbook('CNTT');
    const wbTcns = getOrCreateWorkbook('TCNS');
    assert.strictEqual((wbCntt.data?.B1 || []).length, cnttB1LenBefore, 'Số dòng B1 của CNTT không tự tăng khi nhận phối hợp');
    assert.strictEqual((wbCntt.data?.B2 || []).length, cnttB2LenBefore, 'Số dòng B2 của CNTT không tự tăng khi nhận phối hợp');
    assert.strictEqual((wbTcns.data?.B1 || []).length, tcnsB1LenBefore, 'Số dòng B1 của TCNS không tự tăng');
    assert.strictEqual((wbTcns.data?.B2 || []).length, tcnsB2LenBefore, 'Số dòng B2 của TCNS không tự tăng');
    const hasMergedCoord = (wb: any) =>
      [...(wb.data?.B1 || []), ...(wb.data?.B2 || [])].some((r: any) => String(r.maCongViec || '').trim() === 'TCNS.NV01.CV91');
    assert.strictEqual(hasMergedCoord(wbCntt), false, 'Không tự gộp TCNS.NV01.CV91 vào B1/B2 của CNTT');
    assert.strictEqual(hasMergedCoord(wbTcns), false, 'Không tự gộp TCNS.NV01.CV91 vào B1/B2 của TCNS');

    const mergeModal = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketMergePreviewModal.tsx'), 'utf8');
    const modernForm = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketModernForm.tsx'), 'utf8');
    const proposedTab = fs.readFileSync(path.join(root, 'src/components/staff-portal/ProposedCoordinatedTasksTab.tsx'), 'utf8');
    const coordHelpers = fs.readFileSync(path.join(root, 'src/services/tickets/vtvl-coordination-helpers.ts'), 'utf8');
    const proposedModal = fs.readFileSync(path.join(root, 'src/components/staff-portal/ProposedCoordinatedDetailModal.tsx'), 'utf8');
    assert.ok(mergeModal.includes('Gộp vào B1/B2'), 'Phải giữ nguyên nhãn "Gộp vào B1/B2"');
    assert.ok(modernForm.includes('<ShadcnSelect'), 'Phải giữ ShadcnSelect ở các trường chọn');
    assert.ok(proposedTab.includes('PROPOSED_TAB_EMPTY_MESSAGE'));
    assert.ok(coordHelpers.includes('Chưa có nhiệm vụ được đề xuất phối hợp với vị trí việc làm của bạn.'));
    assert.ok(!proposedModal.includes('Phê duyệt') && !proposedModal.includes('Từ chối') && !proposedModal.includes('Chấp nhận'));
  });

  // Kịch bản 11: Phiếu thử (isTestData) hoặc đã lưu trữ (isArchived) không xuất hiện trong danh sách chính thức
  await runCase('CP-11', 'Phiếu gắn isTestData hoặc isArchived bị loại khỏi danh sách & API chi tiết phối hợp', async () => {
    const store = loadTickets();
    const shared = store.get(sharedTicketId)!;
    shared.isTestData = true;
    persistTickets();

    const listBTest = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokB } }))).json();
    assert.ok(!listBTest.items.some((i: any) => i.surveyId === sharedTicketId), 'Phiếu thử (isTestData) phải ẩn khỏi tab phối hợp');
    assert.strictEqual((await getCoordinated(new NextRequest(\`http://localhost:3360/api/tickets/coordinated?surveyId=\${sharedTicketId}\`, { headers: { authorization: 'Bearer ' + tokB } }))).status, 404);

    shared.isTestData = false;
    shared.isArchived = true;
    persistTickets();
    const listBArch = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokB } }))).json();
    assert.ok(!listBArch.items.some((i: any) => i.surveyId === sharedTicketId), 'Phiếu lưu trữ (isArchived) phải ẩn khỏi tab phối hợp');

    shared.isArchived = false;
    persistTickets();
  });

  // Kịch bản 12: Reload dữ liệu từ đĩa sau khi xóa cache RAM vẫn hiển thị đúng
  await runCase('CP-12', 'Reload sau khi reset RAM cache vẫn khôi phục đầy đủ phân công & đề xuất phối hợp', async () => {
    resetTicketMemoryStore();
    resetCoordinationMemoryStore();
    resetVtvlAssignmentMemoryStore();
    resetWorkbookMemoryStore();

    const listD = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokD } }))).json();
    assert.ok(listD.items.some((i: any) => i.surveyId === cv01Id), 'Sau reload RAM cache, D vẫn nhận lại đúng đề xuất từ tệp lưu trữ');
    const pageSrc = fs.readFileSync(path.join(root, 'src/app/phieu-cong-viec/page.tsx'), 'utf8');
    assert.ok(pageSrc.includes("tabParam === 'proposed'"), 'Trang /phieu-cong-viec phải hỗ trợ reload giữ nguyên ?tab=proposed');
  });

  console.log('----------------------------------------------------------------');
  console.log(\` TỔNG KẾT ĐỀ XUẤT PHỐI HỢP VTVL: \${passCount}/12 KỊCH BẢN PASS\`);
  console.log('================================================================');
  assert.strictEqual(passCount, 12);
}

main().catch((err) => {
  console.error('Lỗi runner:', err);
  process.exit(1);
});
`;

fs.writeFileSync(runnerScriptPath, runnerSource, 'utf8');

try {
  const run = spawnSync('npx', ['tsx', runnerScriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', VTVL_ISOLATED_LOCAL_STORE: 'true' }
  });
  if (run.stdout) console.log(run.stdout.trim());
  if (run.stderr) console.error(run.stderr.trim());
  assert.strictEqual(run.status, 0, `Bộ kiểm thử phối hợp VTVL kết thúc với mã lỗi ${run.status}`);
} finally {
  if (fs.existsSync(runnerScriptPath)) {
    fs.unlinkSync(runnerScriptPath);
  }
  for (const [fileName, content] of backups.entries()) {
    const fullPath = path.join(dataDir, fileName);
    if (content !== null) {
      fs.writeFileSync(fullPath, content, 'utf8');
    } else if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}
