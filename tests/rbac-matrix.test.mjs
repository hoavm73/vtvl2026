import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { spawnSync } from 'child_process';

const root = process.cwd();
const dataDir = path.join(root, '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('================================================================');
console.log(' BỘ KIỂM THỬ THỰC THI MA TRẬN PHÂN QUYỀN (RBAC & IDOR REAL API)');
console.log(' Thực thi trực tiếp Route Handlers + Auth Guard + Crypto Token');
console.log('================================================================');

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
  'custom_units.json'
];

const backups = new Map();
for (const fileName of dataFilesToBackup) {
  const fullPath = path.join(dataDir, fileName);
  backups.set(fileName, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null);
}

const runnerPath = path.join(dataDir, 'temp-rbac-real-api-runner.ts');

const runnerSource = `
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { NextRequest } from 'next/server';
import { GET as getTickets, POST as postTicket, PATCH as patchTicket, DELETE as deleteTicket } from '@/app/api/tickets/route';
import { GET as getWorkbookById, PUT as putWorkbook } from '@/app/api/workbooks/[id]/route';
import { GET as getAdminAccounts, POST as postAdminAccount, PATCH as patchAdminAccount, DELETE as deleteAdminAccount } from '@/app/api/admin/accounts/route';
import { POST as postAdminUnits } from '@/app/api/admin/units/route';
import { generateUserSessionToken, verifyUserSessionToken } from '@/services/storage/server-auth-guard';
import { verifyAdminToken, normalizeTokenExpirationMs } from '@/services/storage/server-admin-auth';
import { createSessionToken, getAuthSecret } from '@/services/storage/account-crypto';
import { upsertUserAccount, getAllUserAccounts } from '@/services/storage/server-account-store';
import { getOrCreateWorkbook } from '@/services/storage/server-workbook-store';

let passed = 0;
let failed = 0;

async function runTest(id: string, name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(\`  ✓ [PASS] [\${id}] \${name}\`);
  } catch (err: any) {
    failed += 1;
    console.error(\`  ✗ [FAIL] [\${id}] \${name}:\`, err?.message || err);
    process.exitCode = 1;
  }
}

async function main() {
  // 1. Khởi tạo các tài khoản QA riêng biệt cho 3 vai trò và 2 đơn vị (SDH & QTTHTT)
  await upsertUserAccount({
    email: 'qa.admin@hcmute.edu.vn',
    displayName: 'QA Admin TCNS',
    unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự',
    title: 'Quản trị viên QA',
    role: 'admin',
    authProvider: 'email',
    status: 'active',
    hasSelectedUnit: true
  }, true);

  await upsertUserAccount({
    email: 'qa.leader.sdh@hcmute.edu.vn',
    displayName: 'QA Lãnh đạo SĐH',
    unitCode: 'SDH',
    unitNameVi: 'Viện Sau Đại học',
    title: 'Lãnh đạo đơn vị',
    role: 'unit_leader',
    authProvider: 'email',
    status: 'active',
    hasSelectedUnit: true
  }, true);

  await upsertUserAccount({
    email: 'qa.staff.sdh@hcmute.edu.vn',
    displayName: 'QA Cán bộ SĐH 1',
    unitCode: 'SDH',
    unitNameVi: 'Viện Sau Đại học',
    title: 'Chuyên viên',
    role: 'staff',
    authProvider: 'email',
    status: 'active',
    hasSelectedUnit: true
  }, true);

  await upsertUserAccount({
    email: 'qa.staff2.sdh@hcmute.edu.vn',
    displayName: 'QA Cán bộ SĐH 2',
    unitCode: 'SDH',
    unitNameVi: 'Viện Sau Đại học',
    title: 'Chuyên viên',
    role: 'staff',
    authProvider: 'email',
    status: 'active',
    hasSelectedUnit: true
  }, true);

  await upsertUserAccount({
    email: 'qa.staff.qtthtt@hcmute.edu.vn',
    displayName: 'QA Cán bộ QTTHTT',
    unitCode: 'QTTHTT',
    unitNameVi: 'Phòng Quản trị thương hiệu và Truyền thông',
    title: 'Chuyên viên',
    role: 'staff',
    authProvider: 'email',
    status: 'active',
    hasSelectedUnit: true
  }, true);

  const wbSdh = getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', 'qa.leader.sdh@hcmute.edu.vn', 'Lãnh đạo đơn vị');
  const wbQtthtt = getOrCreateWorkbook('QTTHTT', '01/10/2025–30/9/2026', 'qa.admin@hcmute.edu.vn', 'Quản trị viên');

  const tokenAdmin = generateUserSessionToken({ email: 'qa.admin@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
  const tokenLeaderSdh = generateUserSessionToken({ email: 'qa.leader.sdh@hcmute.edu.vn', role: 'unit_leader', unitCode: 'SDH' });
  const tokenStaffSdh = generateUserSessionToken({ email: 'qa.staff.sdh@hcmute.edu.vn', role: 'staff', unitCode: 'SDH' });
  const tokenStaff2Sdh = generateUserSessionToken({ email: 'qa.staff2.sdh@hcmute.edu.vn', role: 'staff', unitCode: 'SDH' });
  const tokenStaffQtthtt = generateUserSessionToken({ email: 'qa.staff.qtthtt@hcmute.edu.vn', role: 'staff', unitCode: 'QTTHTT' });

  // Tạo token đã hết hạn (exp trong quá khứ)
  const expiredPayload = Buffer.from(JSON.stringify({
    type: 'user_session',
    email: 'qa.staff.sdh@hcmute.edu.vn',
    role: 'staff',
    unitCode: 'SDH',
    exp: Date.now() - 60_000
  }), 'utf8').toString('base64url');
  const crypto = await import('crypto');
  const expiredSig = crypto.createHmac('sha256', getAuthSecret()).update(expiredPayload).digest('base64url');
  const expiredToken = \`\${expiredPayload}.\${expiredSig}\`;

  // RBAC-01: Kiểm tra 3 tài khoản chuẩn mặc định trong hệ thống
  await runTest('RBAC-01', '3 tài khoản chuẩn mặc định: tcns (admin/TCNS), minhhoavo73 (unit_leader/SDH), hoavm (staff/QTTHTT)', async () => {
    const accounts = getAllUserAccounts();
    const tcns = accounts.find(a => a.email === 'tcns@hcmute.edu.vn');
    const minhhoa = accounts.find(a => a.email === 'minhhoavo73@gmail.com');
    const hoavm = accounts.find(a => a.email === 'hoavm@hcmute.edu.vn');

    assert.ok(tcns && tcns.role === 'admin' && tcns.unitCode === 'TCNS', 'tcns@hcmute.edu.vn phải là admin / TCNS');
    assert.ok(minhhoa && minhhoa.role === 'unit_leader' && minhhoa.unitCode === 'SDH', 'minhhoavo73@gmail.com phải là unit_leader / SDH');
    assert.ok(hoavm && hoavm.role === 'staff' && hoavm.unitCode === 'QTTHTT', 'hoavm@hcmute.edu.vn phải là staff / QTTHTT (không thuộc CK)');
  });

  // RBAC-02: Kiểm tra chuẩn hóa thời hạn token (exp giây vs expiresAt mili-giây, thiếu hạn, sai kiểu, sai chữ ký) & 401 trên API thật
  await runTest('RBAC-02', 'Kiểm tra đầy đủ AUTH-01: exp (giây) vs expiresAt (mili-giây), hết hạn, thiếu hạn, sai kiểu, sai chữ ký & 401 API', async () => {
    const signCustomPayload = (obj: unknown) => {
      const b = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
      const s = crypto.createHmac('sha256', getAuthSecret()).update(b).digest('base64url');
      return \`\${b}.\${s}\`;
    };

    // 1. Token hợp lệ với expiresAt tính bằng mili-giây
    const validMsToken = signCustomPayload({
      email: 'qa.staff.sdh@hcmute.edu.vn',
      role: 'staff',
      unitCode: 'SDH',
      expiresAt: Date.now() + 3600_000
    });
    const verifiedMs = verifyUserSessionToken(validMsToken);
    assert.ok(verifiedMs && verifiedMs.email === 'qa.staff.sdh@hcmute.edu.vn', 'Token hợp lệ với expiresAt (ms) phải được chấp nhận');

    // 2. Token hợp lệ với exp chuẩn JWT tính bằng giây (Unix seconds) -> phải được chuẩn hóa nhân 1000 sang ms
    const validSecExp = Math.floor(Date.now() / 1000) + 3600;
    const validSecToken = signCustomPayload({
      email: 'qa.staff.sdh@hcmute.edu.vn',
      role: 'staff',
      unitCode: 'SDH',
      exp: validSecExp
    });
    const verifiedSec = verifyUserSessionToken(validSecToken);
    assert.ok(verifiedSec && verifiedSec.expiresAt === validSecExp * 1000, 'Token với exp (Unix seconds) phải được quy đổi chính xác sang mili-giây');

    // 3. Token hết hạn theo cả mili-giây (expiresAt) và giây (exp)
    const expSecPastToken = signCustomPayload({
      email: 'qa.staff.sdh@hcmute.edu.vn',
      role: 'staff',
      unitCode: 'SDH',
      exp: Math.floor(Date.now() / 1000) - 60
    });
    assert.strictEqual(verifyUserSessionToken(expiredToken), null, 'Token hết hạn (ms) phải trả về null');
    assert.strictEqual(verifyUserSessionToken(expSecPastToken), null, 'Token hết hạn (Unix seconds) phải trả về null');

    // 4. Token thiếu thời hạn, sai kiểu dữ liệu (string, boolean, array, null), hoặc giá trị thời gian phi lý
    for (const invalidExp of [
      {},
      { expiresAt: null },
      { expiresAt: '9999999999999' },
      { expiresAt: true },
      { expiresAt: [Date.now() + 60000] },
      { expiresAt: -1000 },
      { expiresAt: 0 },
      { expiresAt: 500_000 }, // Năm 1970 (nhỏ hơn minValidEpochMs)
      { expiresAt: Date.now() + 400 * 24 * 3600 * 1000 } // Quá 366 ngày
    ]) {
      const badToken = signCustomPayload({
        email: 'qa.staff.sdh@hcmute.edu.vn',
        role: 'staff',
        unitCode: 'SDH',
        ...invalidExp
      });
      assert.strictEqual(verifyUserSessionToken(badToken), null, \`Token có thời hạn không hợp lệ \${JSON.stringify(invalidExp)} phải bị từ chối\`);
      const badAdminToken = signCustomPayload({ role: 'admin', ...invalidExp });
      assert.strictEqual(verifyAdminToken(badAdminToken), null, \`Admin token có thời hạn không hợp lệ \${JSON.stringify(invalidExp)} phải bị từ chối\`);
    }

    // 5. Token sai chữ ký hoặc sai cấu trúc phân đoạn
    assert.strictEqual(verifyUserSessionToken(validMsToken + 'tampered'), null, 'Token bị sửa chữ ký phải trả về null');
    assert.strictEqual(verifyUserSessionToken(validMsToken + '.extra'), null, 'Token có 3 phân đoạn phải bị từ chối');

    // 6. Kiểm tra trực tiếp trên API thật
    const unauthRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets'));
    assert.strictEqual(unauthRes.status, 401, 'Request chưa đăng nhập phải trả về 401');

    const expiredRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets', {
      headers: { authorization: 'Bearer ' + expiredToken }
    }));
    assert.strictEqual(expiredRes.status, 401, 'Token đã hết hạn phải bị từ chối với 401 UNAUTHORIZED');

    const ForgedHeaderRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets', {
      headers: { 'x-actor-email': 'tcns@hcmute.edu.vn' }
    }));
    assert.strictEqual(ForgedHeaderRes.status, 401, 'Chỉ gửi header x-actor-email không có chữ ký HMAC phải bị từ chối 401');
  });

  // RBAC-03: Giả mạo owner_id, unit_id, actor_id, role, status trong payload POST / PATCH
  await runTest('RBAC-03', 'Chặn giả mạo owner_id, unit_id, actor_id, role và status=approved trực tiếp trong payload', async () => {
    // 1. Giả mạo owner_id
    const spoofOwner = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        owner_id: 'qa.leader.sdh@hcmute.edu.vn',
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        tenCongViec: 'Giả mạo owner_id',
        maVtvl: 'SDH.CV01'
      })
    }));
    assert.strictEqual(spoofOwner.status, 403, 'Giả mạo owner_id phải bị chặn 403 FORBIDDEN_IDOR');
    assert.strictEqual((await spoofOwner.json()).code, 'FORBIDDEN_IDOR');

    // 2. Giả mạo unit_id sang đơn vị khác
    const spoofUnit = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        unit_id: 'QTTHTT',
        maNhiemVu: 'QTTHTT.NV01',
        tenCongViec: 'Giả mạo unit_id',
        maVtvl: 'QTTHTT.CV01'
      })
    }));
    assert.strictEqual(spoofUnit.status, 403, 'Giả mạo unit_id khác đơn vị phải bị chặn 403 FORBIDDEN_CROSS_UNIT');
    assert.strictEqual((await spoofUnit.json()).code, 'FORBIDDEN_CROSS_UNIT');

    // 3. Giả mạo actor_id
    const spoofActor = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        actor_id: 'qa.admin@hcmute.edu.vn',
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        tenCongViec: 'Giả mạo actor_id',
        maVtvl: 'SDH.CV01'
      })
    }));
    assert.strictEqual(spoofActor.status, 403, 'Giả mạo actor_id phải bị chặn 403 FORBIDDEN_ACTOR_SPOOFING');
    assert.strictEqual((await spoofActor.json()).code, 'FORBIDDEN_ACTOR_SPOOFING');

    // 4. Giả mạo role trong payload
    const spoofRole = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        role: 'admin',
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        tenCongViec: 'Giả mạo role',
        maVtvl: 'SDH.CV01'
      })
    }));
    assert.strictEqual(spoofRole.status, 403, 'Giả mạo role trong payload phải bị chặn 403 FORBIDDEN_ROLE_SPOOFING');
    assert.strictEqual((await spoofRole.json()).code, 'FORBIDDEN_ROLE_SPOOFING');

    // 5. Gửi trực tiếp status = 'approved' khi tạo phiếu
    const spoofApproved = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        tenCongViec: 'Tự gán status approved',
        maVtvl: 'SDH.CV01',
        status: 'approved'
      })
    }));
    assert.strictEqual(spoofApproved.status, 403, 'Tự gán status=approved khi POST phải bị chặn 403 FORBIDDEN_DIRECT_APPROVAL');
    assert.strictEqual((await spoofApproved.json()).code, 'FORBIDDEN_DIRECT_APPROVAL');
  });

  // RBAC-04: Truy cập chéo đơn vị SDH <-> QTTHTT qua ID và API trực tiếp
  let sdhDraftTicketId = '';
  let sdhSubmittedTicketId = '';
  await runTest('RBAC-04', 'Cách ly chéo đơn vị SDH <-> QTTHTT và bảo mật phiếu Nháp cùng đơn vị', async () => {
    // Tạo 1 phiếu Nháp và 1 phiếu Đã nộp tại SDH
    const draftRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        tenCongViec: 'Phiếu nháp nội bộ SDH',
        maVtvl: 'SDH.CV01',
        status: 'draft'
      })
    }));
    sdhDraftTicketId = (await draftRes.json()).ticket.id;

    const subRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        tenCongViec: 'Phiếu đã nộp nội bộ SDH',
        maVtvl: 'SDH.CV01',
        sanPham: 'Báo cáo',
        chatLuong: 'Đạt',
        canCu: 'QĐ 1907',
        soSpNam: 5,
        phutThucTe: 60,
        gioBoSung: 0,
        nguonSoLieu: 'Hồ sơ',
        status: 'submitted'
      })
    }));
    sdhSubmittedTicketId = (await subRes.json()).ticket.id;

    // 1. Cán bộ QTTHTT gọi trực tiếp ID phiếu của SDH -> bị chặn 403 FORBIDDEN_CROSS_UNIT
    const crossGetById = await getTickets(new NextRequest(\`http://localhost:3360/api/tickets?id=\${sdhSubmittedTicketId}\`, {
      headers: { authorization: 'Bearer ' + tokenStaffQtthtt }
    }));
    assert.strictEqual(crossGetById.status, 403, 'Cán bộ QTTHTT đọc phiếu SDH qua ID phải bị chặn 403');
    assert.strictEqual((await crossGetById.json()).code, 'FORBIDDEN_CROSS_UNIT');

    // 2. Cán bộ cùng đơn vị (Staff 2 SDH) đọc phiếu Nháp của Staff 1 SDH -> bị chặn 403 FORBIDDEN_DRAFT_ACCESS
    const sameUnitDraft = await getTickets(new NextRequest(\`http://localhost:3360/api/tickets?id=\${sdhDraftTicketId}\`, {
      headers: { authorization: 'Bearer ' + tokenStaff2Sdh }
    }));
    assert.strictEqual(sameUnitDraft.status, 403, 'Cán bộ khác cùng đơn vị không được đọc phiếu Nháp');
    assert.strictEqual((await sameUnitDraft.json()).code, 'FORBIDDEN_DRAFT_ACCESS');

    // 3. Cán bộ cùng đơn vị (Staff 2 SDH) đọc phiếu Đã nộp của Staff 1 SDH -> được phép 200 OK
    const sameUnitSubmitted = await getTickets(new NextRequest(\`http://localhost:3360/api/tickets?id=\${sdhSubmittedTicketId}\`, {
      headers: { authorization: 'Bearer ' + tokenStaff2Sdh }
    }));
    assert.strictEqual(sameUnitSubmitted.status, 200, 'Cán bộ cùng đơn vị được xem phiếu Đã nộp để tránh trùng việc');

    // 4. Cán bộ cùng đơn vị (Staff 2 SDH) thử xóa hoặc sửa phiếu của Staff 1 SDH -> bị chặn 403 FORBIDDEN_IDOR
    const deleteOther = await deleteTicket(new NextRequest(\`http://localhost:3360/api/tickets?id=\${sdhDraftTicketId}\`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer ' + tokenStaff2Sdh }
    }));
    assert.strictEqual(deleteOther.status, 403, 'Không được xóa phiếu của người khác');
  });

  // RBAC-05: Cán bộ gọi trực tiếp API duyệt / trả lại / gộp / sửa bảng tính / quản trị đơn vị
  await runTest('RBAC-05', 'Cán bộ gọi trực tiếp API duyệt, yêu cầu bổ sung, gộp phiếu, sửa 15 biểu và quản trị đều bị chặn 403', async () => {
    for (const act of ['approve', 'request_changes', 'merge']) {
      const res = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
        method: 'PATCH',
        headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: sdhSubmittedTicketId, action: act, reason: 'Thử nghiệm' })
      }));
      assert.strictEqual(res.status, 403, \`Cán bộ gọi action=\${act} phải bị chặn 403\`);
      assert.strictEqual((await res.json()).code, 'FORBIDDEN_STAFF_REVIEW');
    }

    const wbPut = await putWorkbook(new NextRequest(\`http://localhost:3360/api/workbooks/\${wbSdh.id}\`, {
      method: 'PUT',
      headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ data: { C1: [] } })
    }), { params: Promise.resolve({ id: wbSdh.id }) });
    assert.strictEqual(wbPut.status, 403, 'Cán bộ không được sửa bảng tính đơn vị');

    const unitPost = await postAdminUnits(new NextRequest('http://localhost:3360/api/admin/units', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ units: [] })
    }));
    assert.strictEqual(unitPost.status, 403, 'Cán bộ không được sửa danh mục đơn vị');
  });

  // RBAC-06: Lãnh đạo sửa toàn bộ 15 biểu (bao gồm C1) của đơn vị mình nhưng bị chặn ở đơn vị khác
  await runTest('RBAC-06', 'Lãnh đạo sửa được 15 biểu (bao gồm Biểu C1) của đơn vị mình (SDH) nhưng bị chặn 403 ở đơn vị khác (QTTHTT)', async () => {
    const ownWbPut = await putWorkbook(new NextRequest(\`http://localhost:3360/api/workbooks/\${wbSdh.id}\`, {
      method: 'PUT',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        baseRevision: wbSdh.currentRevision,
        data: {
          ...wbSdh.data,
          C1: [{ id: 'c1-sdh-1', maVtvl: 'SDH.CV01', tenVtvl: 'Chuyên viên đào tạo Sau đại học', bacNgheNghiep: 'Bậc 3' }]
        }
      })
    }), { params: Promise.resolve({ id: wbSdh.id }) });
    assert.strictEqual(ownWbPut.status, 200, 'Lãnh đạo phải sửa được Biểu C1 của đơn vị mình');

    const crossWbPut = await putWorkbook(new NextRequest(\`http://localhost:3360/api/workbooks/\${wbQtthtt.id}\`, {
      method: 'PUT',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ data: { C1: [] } })
    }), { params: Promise.resolve({ id: wbQtthtt.id }) });
    assert.strictEqual(crossWbPut.status, 403, 'Lãnh đạo không được sửa bảng tính của đơn vị khác');
  });

  // RBAC-07: Lãnh đạo quản lý tài khoản trong đơn vị mình nhưng bị chặn cấp Admin, sửa tài khoản ngoài đơn vị hoặc xóa Admin
  await runTest('RBAC-07', 'Lãnh đạo tạo được tài khoản staff trong đơn vị nhưng bị chặn cấp Admin, sửa ngoài đơn vị, xóa Admin', async () => {
    // 1. Tạo tài khoản staff trong đơn vị SDH -> 200 OK
    const createStaffRes = await postAdminAccount(new NextRequest('http://localhost:3360/api/admin/accounts', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'qa.newstaff.sdh@hcmute.edu.vn',
        displayName: 'Tài khoản Mới SĐH',
        unitCode: 'SDH',
        role: 'staff'
      })
    }));
    assert.strictEqual(createStaffRes.status, 200, 'Lãnh đạo được tạo tài khoản staff trong đơn vị mình');

    // 2. Thử nâng quyền lên admin qua PATCH -> 403 FORBIDDEN_GRANT_ADMIN
    const promoteAdminRes = await patchAdminAccount(new NextRequest('http://localhost:3360/api/admin/accounts', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'qa.newstaff.sdh@hcmute.edu.vn', role: 'admin' })
    }));
    assert.strictEqual(promoteAdminRes.status, 403, 'Lãnh đạo không được nâng quyền lên Admin');
    assert.strictEqual((await promoteAdminRes.json()).code, 'FORBIDDEN_GRANT_ADMIN');

    // 3. Thử sửa tài khoản thuộc QTTHTT -> 403 FORBIDDEN_CROSS_UNIT
    const editCrossUnitRes = await patchAdminAccount(new NextRequest('http://localhost:3360/api/admin/accounts', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'qa.staff.qtthtt@hcmute.edu.vn', displayName: 'Sửa trái phép' })
    }));
    assert.strictEqual(editCrossUnitRes.status, 403, 'Lãnh đạo không được sửa tài khoản đơn vị khác');
    assert.strictEqual((await editCrossUnitRes.json()).code, 'FORBIDDEN_CROSS_UNIT');

    // 4. Thử xóa tài khoản Admin -> 403
    const delAdminRes = await deleteAdminAccount(new NextRequest('http://localhost:3360/api/admin/accounts?email=qa.admin@hcmute.edu.vn', {
      method: 'DELETE',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh }
    }));
    assert.strictEqual(delAdminRes.status, 403, 'Lãnh đạo không được xóa tài khoản Admin');
  });

  // RBAC-08: Cầu nối danh tính SQL (resolve_trusted_actor, app.actor_id, SECURITY DEFINER, search_path, REVOKE/GRANT)
  await runTest('RBAC-08', 'Kiểm tra cầu nối danh tính SQL resolve_trusted_actor, chặn giả mạo app.actor_id và RLS bất biến', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20261115140000_reconcile_vtvl_39_units_and_versions.sql'), 'utf8');
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.resolve_trusted_actor'), 'Phải có hàm resolve_trusted_actor');
    assert.ok(sql.includes("current_setting('app.actor_id', true)"), 'Phải kiểm tra ngữ cảnh app.actor_id');
    assert.ok(sql.includes("PERFORM set_config('app.actor_id', lower(v_account.email), true);"), 'Phải thiết lập SET LOCAL (is_local=true) cho app.actor_id trong phạm vi transaction để chống rò rỉ qua connection pool');
    assert.ok(sql.includes('FORBIDDEN_ACTOR_SPOOFING'), 'Phải chặn giả mạo p_trusted_actor_email và app.actor_id từ client role');
    assert.ok(sql.includes('SET search_path = public, pg_temp'), 'Các hàm SECURITY DEFINER phải cố định search_path = public, pg_temp');
    assert.ok(sql.includes('REVOKE EXECUTE ON FUNCTION public.resolve_trusted_actor(TEXT) FROM PUBLIC, anon;'), 'Phải REVOKE EXECUTE khỏi PUBLIC và anon');
    assert.ok(sql.includes('REVOKE UPDATE, DELETE ON public.work_survey_versions FROM authenticated, anon;'), 'Phải REVOKE UPDATE, DELETE trên work_survey_versions');
    assert.ok(sql.includes('REVOKE UPDATE, DELETE ON public.work_survey_status_history FROM authenticated, anon;'), 'Phải REVOKE UPDATE, DELETE trên work_survey_status_history');
    assert.ok(sql.includes('REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;'), 'Phải REVOKE UPDATE, DELETE trên audit_logs');
  });

  console.log('----------------------------------------------------------------');
  console.log(\` KẾT QUẢ RBAC REAL API: \${passed} PASS, \${failed} FAIL\`);
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Lỗi thực thi RBAC runner:', err);
  process.exit(1);
});
`;

fs.writeFileSync(runnerPath, runnerSource, 'utf8');

try {
  const run = spawnSync('npx', ['tsx', runnerPath], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      VTVL_ISOLATED_LOCAL_STORE: 'true'
    }
  });

  if (run.stdout) console.log(run.stdout.trim());
  if (run.stderr) console.error(run.stderr.trim());
  assert.strictEqual(run.status, 0, `Bộ kiểm thử RBAC kết thúc với mã lỗi ${run.status}`);
} finally {
  if (fs.existsSync(runnerPath)) {
    fs.unlinkSync(runnerPath);
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
