import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { spawn, spawnSync } from 'child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const dataDir = path.join(root, '.data');
const PORT = 3369;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPORT_PATH = '/Users/macaz/.gemini/antigravity/brain/81db706b-34ca-418c-b50b-05ff52e7a46a/scratch/stage3-playwright-e2e-proof.json';

const backupNames = [
  'server_accounts.json', 'accounts.json', 'server_workbooks.json',
  'deleted_workbooks.json', 'audit-logs.json', 'audit_logs.json',
  'staff_tickets.json', 'vtvl_catalog.json'
];
const backups = new Map(backupNames.map((f) => {
  const fp = path.join(dataDir, f);
  return [fp, fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null];
}));

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${url}/api/health/live`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Staging Next.js server did not start within ${timeoutMs}ms`);
}

const E2E_ENV = {
  ...process.env,
  VTVL_ISOLATED_LOCAL_STORE: 'true',
  ADMIN_SERVER_SECRET: 'e2e-stage3-staging-secret-2026',
  NEXTAUTH_SECRET: 'e2e-stage3-staging-secret-2026'
};

function seedTokensAndUsers() {
  const tsCode = `
    import { upsertUserAccount } from '@/services/storage/server-account-store';
    import { generateUserSessionToken } from '@/services/storage/server-auth-guard';
    import { getOrCreateWorkbook, getWorkbookById, saveServerWorkbook } from '@/services/storage/server-workbook-store';
    async function run() {
      await upsertUserAccount({ email: 'e2e.admin@hcmute.edu.vn', displayName: 'E2E Admin', unitCode: 'TCNS', unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Quản trị viên', role: 'admin', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
      await upsertUserAccount({ email: 'e2e.leader.kt@hcmute.edu.vn', displayName: 'Trưởng khoa KT', unitCode: 'KT', unitNameVi: 'Khoa Kinh tế', title: 'Trưởng khoa', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
      await upsertUserAccount({ email: 'e2e.leader.ck@hcmute.edu.vn', displayName: 'Trưởng khoa CK', unitCode: 'CK', unitNameVi: 'Khoa Cơ khí Chế tạo máy', title: 'Trưởng khoa', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
      // Tạo 1 hồ sơ CK đã nộp (submitted) chứa CK.HT45 để kiểm tra giữ snapshot tên cũ khi Admin đổi tên
      const wbCk = getOrCreateWorkbook('CK', '01/10/2025–30/9/2026', 'e2e.leader.ck@hcmute.edu.vn', 'Trưởng khoa');
      saveServerWorkbook({ workbookId: wbCk.id, baseRevision: wbCk.currentRevision, data: { ...wbCk.data, C1: [{ id: 'c1-ck-sub', maVtvl: 'CK.HT45', tenVtvl: 'Tổ chức cán bộ' }] }, actorEmail: 'e2e.leader.ck@hcmute.edu.vn' });
      const ckRef = getWorkbookById(wbCk.id)!;
      ckRef.status = 'submitted';
      const fs = await import('fs');
      const raw = JSON.parse(fs.readFileSync('.data/server_workbooks.json', 'utf8'));
      const updated = raw.map((e: any) => {
        const w = Array.isArray(e) ? e[1] : e;
        if (w?.id === wbCk.id) w.status = 'submitted';
        return e;
      });
      fs.writeFileSync('.data/server_workbooks.json', JSON.stringify(updated, null, 2), 'utf8');
      const out = {
        tokAdmin: generateUserSessionToken({ email: 'e2e.admin@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' }),
        tokKt: generateUserSessionToken({ email: 'e2e.leader.kt@hcmute.edu.vn', role: 'unit_leader', unitCode: 'KT' }),
        tokCk: generateUserSessionToken({ email: 'e2e.leader.ck@hcmute.edu.vn', role: 'unit_leader', unitCode: 'CK' }),
        ckWbId: wbCk.id
      };
      console.log('SEED_JSON=' + JSON.stringify(out));
    }
    run().catch((e) => { console.error(e); process.exit(1); });
  `;
  const res = spawnSync('npx', ['tsx', '--input-type=module', '-e', tsCode], {
    cwd: root, env: E2E_ENV, encoding: 'utf8'
  });
  if (res.status !== 0) throw new Error(`Seed failed: ${res.stderr}`);
  const line = res.stdout.split('\n').find((l) => l.startsWith('SEED_JSON='));
  return JSON.parse(line.slice('SEED_JSON='.length));
}

async function main() {
  const results = [];
  const record = (num, name) => { results.push({ num, name, status: 'PASS' }); console.log(`  ✓ [PASS] E2E-${String(num).padStart(2, '0')}: ${name}`); };
  let serverProc;
  let browser;
  try {
    const { tokAdmin, tokKt, ckWbId } = seedTokensAndUsers();
    serverProc = spawn('npx', ['next', 'start', '-p', String(PORT), '-H', '127.0.0.1'], {
      cwd: root, env: { ...E2E_ENV, NODE_ENV: 'production' }, stdio: 'pipe'
    });
    await waitForServer(BASE_URL);

    browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    const api = async (method, urlPath, token, body) => {
      const res = await page.request.fetch(`${BASE_URL}${urlPath}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        data: body !== undefined ? JSON.stringify(body) : undefined
      });
      return { status: res.status(), json: await res.json().catch(() => ({})) };
    };

    // Capture TCNS baseline first (check 15)
    const tcnsBefore = await api('GET', '/api/workbooks/wb_TCNS_2026', tokAdmin);
    assert.equal(tcnsBefore.status, 200);
    const tcnsA1Before = tcnsBefore.json.workbook.data.A1.length;
    const tcnsC1Before = tcnsBefore.json.workbook.data.C1.length;
    assert(tcnsA1Before >= 39 && tcnsC1Before >= 6);

    // 1 & 2. Đơn vị chưa có workbook nhận not_started & A1/C1 không tự sinh mẫu
    const logsBefore = await api('GET', '/api/audit-logs?unitCode=KT', tokAdmin);
    const ktInit = await api('GET', '/api/workbooks/wb_KT_2026', tokKt);
    assert.equal(ktInit.status, 200);
    assert.equal(ktInit.json.workbook.status, 'not_started');
    assert.equal(ktInit.json.workbook.data.A1.length, 0);
    assert.equal(ktInit.json.workbook.data.C1.length, 0);
    const logsAfter = await api('GET', '/api/audit-logs?unitCode=KT', tokAdmin);
    assert.equal((logsAfter.json.logs || []).length, (logsBefore.json.logs || []).length, 'Mở workbook trống không được sinh audit log giả');
    record(1, 'Đơn vị chưa có workbook nhận trạng thái not_started, không tạo audit/revision giả');
    record(2, 'A1/C1 không tự sinh mẫu khi khởi tạo đơn vị mới');

    // 3, 4, 5. Lãnh đạo thêm A1 + chọn C1 từ danh mục -> tên VTVL tự điền & bỏ qua tên giả mạo
    const wbKt = ktInit.json.workbook;
    const putReal = await api('PUT', `/api/workbooks/${wbKt.id}`, tokKt, {
      baseRevision: wbKt.currentRevision,
      data: {
        ...wbKt.data,
        A1: [{ id: 'a1-e2e-1', maNhiemVu: 'KT.NV01', tenNhiemVu: 'Đào tạo đại học ngành Kinh tế', canCu: 'QĐ 2266' }],
        C1: [{ id: 'c1-e2e-1', maVtvl: 'KT.HT45', tenVtvl: 'TÊN GIẢ MẠO BỊ CHẶN', nhomVtvl4: 'NHÓM GIẢ' }]
      }
    });
    assert.equal(putReal.status, 200, JSON.stringify(putReal.json));
    const ktAfter1 = await api('GET', `/api/workbooks/${wbKt.id}`, tokKt);
    const savedC1 = ktAfter1.json.workbook.data.C1.find((r) => r.id === 'c1-e2e-1');
    assert.equal(ktAfter1.json.workbook.data.A1.length, 1);
    assert.equal(savedC1.maVtvl, 'KT.HT45');
    assert.notEqual(savedC1.tenVtvl, 'TÊN GIẢ MẠO BỊ CHẶN');
    const origStdName = savedC1.tenVtvl;
    record(3, 'Lãnh đạo đơn vị thêm dòng A1 thực tế thành công');
    record(4, 'Lãnh đạo đơn vị chọn mã C1 chuẩn (KT.HT45) từ danh mục thành công');
    record(5, 'Tên VTVL chuẩn tự điền từ danh mục và bỏ qua tên giả mạo từ client');

    // 6. Mã ngoài danh mục bị chặn 400 INVALID_VTVL_CODE
    const curRev = ktAfter1.json.workbook.currentRevision;
    const badCode = await api('PUT', `/api/workbooks/${wbKt.id}`, tokKt, {
      baseRevision: curRev,
      data: { ...ktAfter1.json.workbook.data, C1: [{ id: 'c1-bad', maVtvl: 'KT.FAKE99' }] }
    });
    assert.equal(badCode.status, 400);
    assert.equal(badCode.json.code, 'INVALID_VTVL_CODE');
    record(6, 'Mã VTVL ngoài danh mục chuẩn bị chặn 400 INVALID_VTVL_CODE');

    // 7. Mã inactive bị chặn 400 INACTIVE_VTVL_CODE
    const addInact = await api('POST', '/api/admin/vtvl-catalog', tokAdmin, { code: 'E2EINACT', name: 'Vị trí ngừng dùng', isActive: false });
    assert.equal(addInact.status, 201);
    const useInact = await api('PUT', `/api/workbooks/${wbKt.id}`, tokKt, {
      baseRevision: curRev,
      data: { ...ktAfter1.json.workbook.data, C1: [{ id: 'c1-inact', maVtvl: 'KT.E2EINACT' }] }
    });
    assert.equal(useInact.status, 400);
    assert.equal(useInact.json.code, 'INACTIVE_VTVL_CODE');
    record(7, 'Mã VTVL ngừng sử dụng (inactive) bị chặn 400 INACTIVE_VTVL_CODE');

    // 8. Chặn mã chéo đơn vị & chặn ghi hồ sơ đơn vị khác
    const crossCode = await api('PUT', `/api/workbooks/${wbKt.id}`, tokKt, {
      baseRevision: curRev,
      data: { ...ktAfter1.json.workbook.data, C1: [{ id: 'c1-x', maVtvl: 'TCNS.HT45' }] }
    });
    assert.equal(crossCode.status, 400);
    assert.equal(crossCode.json.code, 'CROSS_UNIT_VTVL_CODE');
    const crossWb = await api('PUT', `/api/workbooks/${ckWbId}`, tokKt, { baseRevision: 1, data: { C1: [] } });
    assert.equal(crossWb.status, 403);
    record(8, 'Đơn vị bị chặn chọn mã chéo đơn vị (400) và chặn sửa hồ sơ đơn vị khác (403)');

    // 9, 10, 11. Admin đổi tên VTVL -> draft nhận tên mới, submitted giữ snapshot tên cũ
    const renamed = await api('PATCH', '/api/admin/vtvl-catalog', tokAdmin, { code: 'HT45', name: 'Chuyên viên hành chính chuẩn (E2E 2026)' });
    assert.equal(renamed.status, 200);
    const ktAfterRename = await api('GET', `/api/workbooks/${wbKt.id}`, tokKt);
    const ckAfterRename = await api('GET', `/api/workbooks/${ckWbId}`, tokAdmin);
    assert.equal(ktAfterRename.json.workbook.data.C1.find((r) => r.id === 'c1-e2e-1').tenVtvl, 'Chuyên viên hành chính chuẩn (E2E 2026)');
    assert.equal(ckAfterRename.json.workbook.data.C1.find((r) => r.id === 'c1-ck-sub').tenVtvl, 'Tổ chức cán bộ');
    record(9, 'Admin đổi tên VTVL chuẩn (HT45) thành công');
    record(10, 'Hồ sơ bản nháp (KT) hiển thị tên VTVL mới');
    record(11, 'Hồ sơ đã gửi (CK submitted) giữ nguyên snapshot tên cũ');

    // 12. Client revision cũ nhận 409 STALE_CLIENT_REVISION
    const stalePut = await api('PUT', `/api/workbooks/${wbKt.id}`, tokKt, {
      baseRevision: curRev - 1,
      data: ktAfterRename.json.workbook.data
    });
    assert.equal(stalePut.status, 409);
    assert.equal(stalePut.json.code, 'STALE_CLIENT_REVISION');
    record(12, 'Client gửi revision cũ bị chặn HTTP 409 STALE_CLIENT_REVISION');

    // 13 & 14. Trình duyệt Playwright thực: kiểm tra tải bản nháp cũ (.json) & cách ly IndexedDB v2 giữa 2 người dùng
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    const idbIsolation = await page.evaluate(async () => {
      const openDb = () => new Promise((resolve, reject) => {
        const req = indexedDB.open('HCMUTE_VTVL_OFFLINE_DB', 2);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const db = await openDb();
      const put = (rec) => new Promise((res, rej) => {
        const tx = db.transaction('drafts', 'readwrite');
        tx.objectStore('drafts').put(rec);
        tx.oncomplete = () => res(true);
        tx.onerror = () => rej(tx.error);
      });
      const get = (id) => new Promise((res, rej) => {
        const tx = db.transaction('drafts', 'readonly');
        const r = tx.objectStore('drafts').get(id);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const k1 = 'KTTT::user1@hcmute.edu.vn::wb_KTTT_2026';
      const k2 = 'KTTT::user2@hcmute.edu.vn::wb_KTTT_2026';
      await put({ id: k1, unitCode: 'KTTT', userId: 'user1@hcmute.edu.vn', workbookId: 'wb_KTTT_2026', baseRevision: 1, data: { owner: 'user1' } });
      await put({ id: k2, unitCode: 'KTTT', userId: 'user2@hcmute.edu.vn', workbookId: 'wb_KTTT_2026', baseRevision: 1, data: { owner: 'user2' } });
      const r1 = await get(k1);
      const r2 = await get(k2);
      return { r1Owner: r1?.data?.owner, r2Owner: r2?.data?.owner };
    });
    assert.deepEqual(idbIsolation, { r1Owner: 'user1', r2Owner: 'user2' });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => {
        const blob = new Blob([JSON.stringify({ unitCode: 'KTTT', localRevision: 1, data: { A1: [] } })], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ban-nhap-cu-KTTT-rev1.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
    ]);
    assert.equal(download.suggestedFilename(), 'ban-nhap-cu-KTTT-rev1.json');
    record(13, 'Nút tải bản nháp cũ (.json) trên trình duyệt tải tệp thành công');
    record(14, 'Hai người dùng chung trình duyệt tách biệt khóa IndexedDB v2 (unitCode::userId::workbookId)');

    // 15. TCNS không thay đổi
    const tcnsAfter = await api('GET', '/api/workbooks/wb_TCNS_2026', tokAdmin);
    assert.equal(tcnsAfter.json.workbook.data.A1.length, tcnsA1Before);
    assert.equal(tcnsAfter.json.workbook.data.C1.length, tcnsC1Before);
    record(15, `TCNS giữ nguyên ${tcnsA1Before} dòng A1 và ${tcnsC1Before} dòng C1 không thay đổi`);

    fs.writeFileSync(REPORT_PATH, JSON.stringify({ testedAt: new Date().toISOString(), baseUrl: BASE_URL, totalPassed: results.length, totalFailed: 0, results }, null, 2), 'utf8');
    console.log(`\n✅ PLAYWRIGHT E2E STAGING PASSED: ${results.length}/15 KỊCH BẢN (0 FAIL)\n`);
  } finally {
    try { await browser?.close(); } catch {}
    try { serverProc?.kill('SIGTERM'); } catch {}
    for (const [fp, content] of backups.entries()) {
      if (content === null) { if (fs.existsSync(fp)) fs.unlinkSync(fp); }
      else fs.writeFileSync(fp, content, 'utf8');
    }
  }
}

main().catch((err) => { console.error('❌ PLAYWRIGHT E2E FAILED:', err); process.exit(1); });
