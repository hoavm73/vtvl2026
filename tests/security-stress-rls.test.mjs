import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { spawnSync } from 'child_process';

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
console.log(' BỘ KIỂM THỬ BẢO MẬT & TẢI NẶNG RLS (HARD STRESS TEST RLS & ACCESS)');
console.log(' Hệ thống: HCM-UTE VTVL 360 & S-Link (Nghị định 232/2026/NĐ-CP)');
console.log('================================================================');

// -----------------------------------------------------------------------------
// PHẦN 1: KIỂM THỬ TĨNH TỆP MIGRATION SUPABASE RLS HARDENED
// -----------------------------------------------------------------------------
runTest('1. Kiểm tra tồn tại tệp Migration 20261114_hardened_rls_data_protection.sql', () => {
  const migPath = path.join(root, 'supabase/migrations/20261114_hardened_rls_data_protection.sql');
  assert.ok(fs.existsSync(migPath), 'Tệp migration bảo mật P0 phải tồn tại');
  const content = fs.readFileSync(migPath, 'utf8');

  // Kiểm tra bật RLS trên tất cả bảng
  assert.ok(content.includes('ENABLE ROW LEVEL SECURITY'), 'Phải kích hoạt RLS');
  assert.ok(content.includes('REVOKE ALL ON public.%I FROM anon'), 'Phải thu hồi toàn bộ quyền anon trên bảng nghiệp vụ');
  assert.ok(content.includes('GRANT ALL ON public.%I TO service_role'), 'Service role phải có toàn quyền');

  // Kiểm tra bảo vệ các bảng nhạy cảm mới
  const tables = ['staff_work_tickets', 'coordinated_tasks', 'user_accounts', 'workbooks', 't_tien_do'];
  tables.forEach((t) => {
    assert.ok(content.includes(t), `Migration phải bảo vệ bảng ${t}`);
  });

  // Kiểm tra xóa bỏ chính sách rls_google_hcmute_rw_% diện rộng
  assert.ok(content.includes('rls_google_hcmute_rw_'), 'Phải xóa bỏ policy rls_google_hcmute_rw cũ');

  // Kiểm tra khóa Read-Only trên 4 danh mục dùng chung
  const catalogs = ['dm_don_vi', 'dm_chuc_danh_tt31', 'dm_vtvl_khung_truong', 'dm_san_pham'];
  catalogs.forEach((c) => {
    assert.ok(content.includes(c), `Danh mục ${c} phải được cấu hình Read-Only`);
  });
  assert.ok(content.includes('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated'), 'Cấm ghi trên danh mục');
});

runTest('2. Kiểm tra tuân thủ Rule 8 (< 300 dòng) trên tất cả các tệp bảo mật mới tạo và cập nhật', () => {
  const targetFiles = [
    'src/services/storage/server-auth-guard.ts',
    'src/app/api/auth/login/route.ts',
    'src/app/api/tickets/route.ts',
    'src/app/api/workbooks/route.ts',
    'src/app/api/workbooks/[id]/route.ts',
    'src/app/api/workbooks/[id]/revisions/route.ts',
    'src/app/api/workbooks/lookup/route.ts',
    'src/app/api/accounts/route.ts',
    'src/app/api/sync/split/route.ts',
    'src/app/api/sync/audit/route.ts',
    'src/app/api/admin/units/route.ts',
    'src/app/api/admin/sessions/route.ts',
    'src/app/api/admin/units/sync/route.ts'
  ];

  targetFiles.forEach((file) => {
    const fullPath = path.join(root, file);
    assert.ok(fs.existsSync(fullPath), `Tệp ${file} phải tồn tại`);
    const lines = fs.readFileSync(fullPath, 'utf8').split('\n').length;
    assert.ok(lines <= 300, `Tệp ${file} có ${lines} dòng, vượt quá 300 dòng (Rule 8)`);
  });
});

// -----------------------------------------------------------------------------
// PHẦN 2: CHẠY BỘ KIỂM THỬ KHAI THÁC & XÂM NHẬP TRỰC TIẾP QUA TSX
// -----------------------------------------------------------------------------
runTest('3. Thực thi 25 vector tấn công khai thác dữ liệu qua npx tsx runner', () => {
  const runnerScript = `
import assert from 'assert';
import { NextRequest } from 'next/server';
import { GET as getTickets, POST as postTicket, DELETE as deleteTicket } from '@/app/api/tickets/route';
import { GET as getWorkbooks, POST as postWorkbook } from '@/app/api/workbooks/route';
import { GET as getWorkbookById, PUT as putWorkbook, DELETE as deleteWorkbook } from '@/app/api/workbooks/[id]/route';
import { GET as lookupWorkbooks } from '@/app/api/workbooks/lookup/route';
import { GET as getRevisions, POST as rollbackRevision } from '@/app/api/workbooks/[id]/revisions/route';
import { GET as getAccount, POST as postAccount, PATCH as patchAccount } from '@/app/api/accounts/route';
import { POST as syncSplit } from '@/app/api/sync/split/route';
import { POST as syncAudit } from '@/app/api/sync/audit/route';
import { POST as adminUnitPost } from '@/app/api/admin/units/route';
import { GET as adminSessionsGet } from '@/app/api/admin/sessions/route';
import { generateUserSessionToken } from '@/services/storage/server-auth-guard';
import { upsertUserAccount } from '@/services/storage/server-account-store';

async function runAttackSuite() {
  console.log('--- KHỞI ĐỘNG CÁC KỊCH BẢN TẤN CÔNG KHAI THÁC DỮ LIỆU ---');

  // Token danh tính thử nghiệm
  const tokenAlice = generateUserSessionToken({ email: 'alice.fit@hcmute.edu.vn', role: 'staff', unitCode: 'FIT' });
  const tokenLeaderFit = generateUserSessionToken({ email: 'leader.fit@hcmute.edu.vn', role: 'unit_leader', unitCode: 'FIT' });
  const tokenAdmin = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });

  // 1. TẤN CÔNG VÔ DANH (UNAUTHENTICATED ATTACKS - ZERO TRUST)
  // Vector 1: Trích xuất phiếu công việc khi chưa đăng nhập
  const r1 = await getTickets(new NextRequest('http://localhost:3000/api/tickets'));
  assert.strictEqual(r1.status, 401, 'V1: Phải chặn 401 khi truy cập phiếu vô danh');

  // Vector 2: Nộp phiếu vô danh
  const r2 = await postTicket(new NextRequest('http://localhost:3000/api/tickets', { method: 'POST', body: JSON.stringify({}) }));
  assert.strictEqual(r2.status, 401, 'V2: Phải chặn 401 khi nộp phiếu vô danh');

  // Vector 3: Xóa phiếu vô danh
  const r3 = await deleteTicket(new NextRequest('http://localhost:3000/api/tickets?id=ticket1', { method: 'DELETE' }));
  assert.strictEqual(r3.status, 401, 'V3: Phải chặn 401 khi xóa phiếu vô danh');

  // Vector 4: Trích xuất danh sách workbook vô danh
  const r4 = await getWorkbooks(new NextRequest('http://localhost:3000/api/workbooks'));
  assert.strictEqual(r4.status, 401, 'V4: Phải chặn 401 khi trích xuất workbooks vô danh');

  // Vector 5: Đọc chi tiết hồ sơ đơn vị vô danh
  const r5 = await getWorkbookById(new NextRequest('http://localhost:3000/api/workbooks/wb_TCNS_2026'), { params: Promise.resolve({ id: 'wb_TCNS_2026' }) });
  assert.strictEqual(r5.status, 401, 'V5: Phải chặn 401 khi đọc chi tiết workbook vô danh');

  // Vector 6: Ghi đè hồ sơ đơn vị vô danh
  const r6 = await putWorkbook(new NextRequest('http://localhost:3000/api/workbooks/wb_TCNS_2026', { method: 'PUT', body: JSON.stringify({ data: {} }) }), { params: Promise.resolve({ id: 'wb_TCNS_2026' }) });
  assert.strictEqual(r6.status, 401, 'V6: Phải chặn 401 khi ghi đè workbook vô danh');

  // Vector 7: Tra cứu workbook bằng email người khác vô danh
  const r7 = await lookupWorkbooks(new NextRequest('http://localhost:3000/api/workbooks/lookup?email=tcns@hcmute.edu.vn'));
  assert.strictEqual(r7.status, 401, 'V7: Phải chặn 401 khi tra cứu vô danh');

  // Vector 8: Đọc hồ sơ tài khoản người dùng vô danh
  const r8 = await getAccount(new NextRequest('http://localhost:3000/api/accounts?email=tcns@hcmute.edu.vn'));
  assert.strictEqual(r8.status, 401, 'V8: Phải chặn 401 khi xem tài khoản vô danh');

  // Vector 9: Tấn công API quản trị đơn vị vô danh
  const r9 = await adminUnitPost(new NextRequest('http://localhost:3000/api/admin/units', { method: 'POST', body: JSON.stringify({}) }));
  assert.strictEqual(r9.status, 403, 'V9: Phải chặn 403 khi gọi admin units');

  // Vector 10: Tấn công trích xuất phiên làm việc admin vô danh
  const r10 = await adminSessionsGet(new NextRequest('http://localhost:3000/api/admin/sessions'));
  assert.strictEqual(r10.status, 401, 'V10: Phải chặn 401 khi xem admin sessions');

  // Vector 11: Đồng bộ kết quả split vô danh
  const r11 = await syncSplit(new NextRequest('http://localhost:3000/api/sync/split', { method: 'POST', body: JSON.stringify({ summary: { unitCode: 'TCNS' } }) }));
  assert.strictEqual(r11.status, 401, 'V11: Phải chặn 401 khi sync split vô danh');

  // Vector 12: Đồng bộ kết quả audit vô danh
  const r12 = await syncAudit(new NextRequest('http://localhost:3000/api/sync/audit', { method: 'POST', body: JSON.stringify({ unitCode: 'TCNS' }) }));
  assert.strictEqual(r12.status, 401, 'V12: Phải chặn 401 khi sync audit vô danh');

  // 2. TẤN CÔNG MẠO DANH & IDOR (INSECURE DIRECT OBJECT REFERENCE)
  // Vector 13: Alice mạo danh nộp phiếu với ownerEmail của Bob
  const r13 = await postTicket(new NextRequest('http://localhost:3000/api/tickets', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tokenAlice, 'content-type': 'application/json' },
    body: JSON.stringify({ ownerEmail: 'bob@hcmute.edu.vn', maNhiemVu: 'FIT.NV01', tenCongViec: 'Test IDOR', maVtvl: 'FIT-GV-01' })
  }));
  assert.strictEqual(r13.status, 403, 'V13: Phải chặn 403 FORBIDDEN_IDOR khi Alice mạo danh Bob');

  // Vector 14: Alice cố ý xóa phiếu của Bob
  const r14 = await deleteTicket(new NextRequest('http://localhost:3000/api/tickets?id=ticket_bob_secret', {
    method: 'DELETE',
    headers: { authorization: 'Bearer ' + tokenAlice }
  }));
  assert.strictEqual(r14.status, 403, 'V14: Phải chặn 403 khi xóa phiếu người khác');

  // Vector 15: Alice cố ý sửa đổi hồ sơ người khác qua PATCH /api/accounts
  const r15 = await patchAccount(new NextRequest('http://localhost:3000/api/accounts', {
    method: 'PATCH',
    headers: { authorization: 'Bearer ' + tokenAlice, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'bob@hcmute.edu.vn', displayName: 'Hacked Name' })
  }));
  assert.strictEqual(r15.status, 403, 'V15: Phải chặn 403 khi Alice cố sửa tài khoản Bob');

  // 3. TẤN CÔNG THOÁT ĐƠN VỊ & RÒ RỈ DỮ LIỆU ĐA KHÁCH HÀNG (TENANT ESCAPING)
  // Vector 16: Alice (Khoa FIT) cố truy cập phiếu của Phòng TCNS
  const r16 = await getTickets(new NextRequest('http://localhost:3000/api/tickets?unitCode=TCNS', {
    headers: { authorization: 'Bearer ' + tokenAlice }
  }));
  assert.strictEqual(r16.status, 403, 'V16: Phải chặn 403 FORBIDDEN_CROSS_UNIT khi đọc phiếu đơn vị khác');

  // Vector 17: Alice (FIT) cố nộp phiếu cho Khoa Cơ khí (CK)
  const r17 = await postTicket(new NextRequest('http://localhost:3000/api/tickets', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tokenAlice, 'content-type': 'application/json' },
    body: JSON.stringify({ unitCode: 'CK', ownerEmail: 'alice.fit@hcmute.edu.vn', maNhiemVu: 'CK.NV01', tenCongViec: 'Test Cross', maVtvl: 'CK-GV-01' })
  }));
  assert.strictEqual(r17.status, 403, 'V17: Phải chặn 403 khi nộp phiếu đơn vị khác');

  // Vector 18: Alice (FIT) cố đọc trực tiếp hồ sơ wb_TCNS_2026
  const r18 = await getWorkbookById(new NextRequest('http://localhost:3000/api/workbooks/wb_TCNS_2026', {
    headers: { authorization: 'Bearer ' + tokenAlice }
  }), { params: Promise.resolve({ id: 'wb_TCNS_2026' }) });
  assert.strictEqual(r18.status, 403, 'V18: Phải chặn 403 khi xem workbook đơn vị khác');

  // Vector 19: Lãnh đạo Khoa FIT cố ghi đè hồ sơ Phòng TCNS
  const r19 = await putWorkbook(new NextRequest('http://localhost:3000/api/workbooks/wb_TCNS_2026', {
    method: 'PUT',
    headers: { authorization: 'Bearer ' + tokenLeaderFit, 'content-type': 'application/json' },
    body: JSON.stringify({ data: { A1: [] } })
  }), { params: Promise.resolve({ id: 'wb_TCNS_2026' }) });
  assert.strictEqual(r19.status, 403, 'V19: Phải chặn 403 khi Lãnh đạo sửa hồ sơ đơn vị khác');

  // Vector 20: Cách ly danh sách workbooks (Alice FIT chỉ thấy FIT, không thấy TCNS hay 50 đơn vị khác)
  const r20 = await getWorkbooks(new NextRequest('http://localhost:3000/api/workbooks', {
    headers: { authorization: 'Bearer ' + tokenAlice }
  }));
  assert.strictEqual(r20.status, 200);
  const data20 = await r20.json();
  const leakedUnits = (data20.workbooks || []).filter((w: any) => w.unitCode !== 'FIT');
  assert.strictEqual(leakedUnits.length, 0, 'V20: Không được rò rỉ bất kỳ đơn vị nào ngoài FIT cho Alice');

  // 4. TẤN CÔNG LEO THANG ĐẶC QUYỀN (PRIVILEGE ESCALATION) & VI PHẠM KHUNG C1
  // Vector 21: Alice cố ý leo thang quyền thành admin qua PATCH /api/accounts
  const r21 = await patchAccount(new NextRequest('http://localhost:3000/api/accounts', {
    method: 'PATCH',
    headers: { authorization: 'Bearer ' + tokenAlice, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'alice.fit@hcmute.edu.vn', role: 'admin' })
  }));
  assert.strictEqual(r21.status, 403, 'V21: Phải chặn 403 khi tự phong role admin');

  // Vector 22: Cán bộ Alice cố ý ghi đè trực tiếp bảng 15 biểu thay vì nộp phiếu
  const r22 = await putWorkbook(new NextRequest('http://localhost:3000/api/workbooks/wb_FIT_2026', {
    method: 'PUT',
    headers: { authorization: 'Bearer ' + tokenAlice, 'content-type': 'application/json' },
    body: JSON.stringify({ data: { A1: [] } })
  }), { params: Promise.resolve({ id: 'wb_FIT_2026' }) });
  assert.strictEqual(r22.status, 403, 'V22: Phải chặn 403 FORBIDDEN_VIEWER_WRITE khi staff ghi bảng');

  // Vector 23: Alice cố ý khôi phục phiên bản hồ sơ đơn vị
  const r23 = await rollbackRevision(new NextRequest('http://localhost:3000/api/workbooks/wb_FIT_2026/revisions', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tokenAlice, 'content-type': 'application/json' },
    body: JSON.stringify({ targetRevision: 1, reason: 'Exploit rollback' })
  }), { params: Promise.resolve({ id: 'wb_FIT_2026' }) });
  assert.strictEqual(r23.status, 403, 'V23: Phải chặn 403 khi nhân viên cố rollback revision');

  // 5. TẤN CÔNG GIẢ MẠO TOKEN & TÀI KHOẢN TẠM KHÓA
  // Vector 24: Ký token HMAC giả mạo
  const fakeToken = 'eyJlbWFpbCI6InRjbnNAaGNtdXRlLmVkdS52biJ9.invalidsig12345';
  const r24 = await getTickets(new NextRequest('http://localhost:3000/api/tickets', {
    headers: { authorization: 'Bearer ' + fakeToken }
  }));
  assert.strictEqual(r24.status, 401, 'V24: Token giả mạo chữ ký phải bị từ chối 401');

  // Vector 25: Header injection giả mạo x-actor-email không có token
  const r25 = await adminUnitPost(new NextRequest('http://localhost:3000/api/admin/units', {
    method: 'POST',
    headers: { 'x-actor-email': 'tcns@hcmute.edu.vn', 'content-type': 'application/json' },
    body: JSON.stringify({})
  }));
  assert.strictEqual(r25.status, 403, 'V25: Header spoofing x-actor-email không token phải bị chặn 403');

  // Vector 26: Tài khoản bị tạm khóa (suspended) không được phép thao tác
  await upsertUserAccount({
    email: 'locked.user@hcmute.edu.vn',
    displayName: 'Locked User',
    unitCode: 'FIT',
    title: 'Cán bộ',
    role: 'staff',
    authProvider: 'email',
    status: 'suspended'
  }, true);
  const tokenLocked = generateUserSessionToken({ email: 'locked.user@hcmute.edu.vn', role: 'staff', unitCode: 'FIT' });
  const r26 = await getTickets(new NextRequest('http://localhost:3000/api/tickets', {
    headers: { authorization: 'Bearer ' + tokenLocked }
  }));
  assert.strictEqual(r26.status, 401, 'V26: Tài khoản tạm khóa phải bị chặn 401/403');

  // 6. KIỂM THỬ TẢI NẶNG ĐỒNG THỜI (CONCURRENCY STRESS TEST - 50 PARALLEL ATTACKS)
  console.log('--- CHẠY THỬ THÁCH TẢI NẶNG: 50 YÊU CẦU TẤN CÔNG ĐỒNG THỜI ---');
  const parallelAttacks = Array.from({ length: 50 }, (_, i) => {
    if (i % 3 === 0) {
      return getTickets(new NextRequest('http://localhost:3000/api/tickets?unitCode=TCNS', {
        headers: { authorization: 'Bearer ' + tokenAlice }
      }));
    } else if (i % 3 === 1) {
      return postTicket(new NextRequest('http://localhost:3000/api/tickets', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + tokenAlice, 'content-type': 'application/json' },
        body: JSON.stringify({ ownerEmail: 'victim' + i + '@hcmute.edu.vn' })
      }));
    } else {
      return putWorkbook(new NextRequest('http://localhost:3000/api/workbooks/wb_TCNS_2026', {
        method: 'PUT',
        headers: { authorization: 'Bearer ' + fakeToken, 'content-type': 'application/json' },
        body: JSON.stringify({ data: {} })
      }), { params: Promise.resolve({ id: 'wb_TCNS_2026' }) });
    }
  });

  const attackResults = await Promise.all(parallelAttacks);
  const allBlocked = attackResults.every((res) => res.status === 401 || res.status === 403 || res.status === 400);
  assert.ok(allBlocked, 'Toàn bộ 50 yêu cầu tấn công đồng thời phải bị chặn đứng (401/403/400)');
  console.log('✓ Hoàn tất 50 cuộc tấn công song song: 100% bị chặn an toàn, máy chủ ổn định');
}

runAttackSuite().catch((err) => {
  console.error('Lỗi khi chạy bộ kịch bản tấn công:', err);
  process.exit(1);
});
`;

  const scriptPath = path.join(root, '.data', 'temp-security-runner.ts');
  if (!fs.existsSync(path.join(root, '.data'))) fs.mkdirSync(path.join(root, '.data'), { recursive: true });
  fs.writeFileSync(scriptPath, runnerScript, 'utf8');

  try {
    const res = spawnSync('npx', ['tsx', scriptPath], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    if (res.stdout) console.log(res.stdout.trim());
    if (res.stderr) console.error(res.stderr.trim());
    assert.strictEqual(res.status, 0, `Tiến trình kiểm thử tấn công kết thúc với mã lỗi: ${res.status}`);
  } finally {
    if (fs.existsSync(scriptPath)) fs.unlinkSync(scriptPath);
  }
});

console.log('----------------------------------------------------------------');
console.log(` KẾT QUẢ: ĐẠT ${passed}/${passed + failed} BÀI KIỂM THỬ BẢO MẬT & RLS STRESS TEST`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
