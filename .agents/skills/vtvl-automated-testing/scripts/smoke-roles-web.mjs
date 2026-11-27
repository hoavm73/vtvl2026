#!/usr/bin/env node
/**
 * Role-Based Web Smoke Testing cho HCM-UTE VTVL 360 (3 vai trò: Staff, Unit Leader, Admin)
 * Chạy trên bản build cục bộ cô lập (VTVL_ISOLATED_LOCAL_STORE=true) bằng Chrome Headless.
 */
import { spawn } from 'child_process';
import { createHmac } from 'crypto';
import { chromium } from 'playwright';

const PORT = Number(process.env.SMOKE_WEB_PORT || 3371);
const BASE = `http://127.0.0.1:${PORT}`;
const TEST_SECRET = 'vtvl_role_smoke_isolated_secret';

function signSession(role, email, unitCode, unitNameVi, displayName, title) {
  const payloadObj = {
    email: email.toLowerCase(),
    role,
    unitCode: unitCode.toUpperCase(),
    issuedAt: new Date().toISOString(),
    expiresAt: Date.now() + 24 * 3600_000
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = createHmac('sha256', TEST_SECRET).update(payloadB64).digest('base64url');
  return {
    email: email.toLowerCase(),
    unitCode: unitCode.toUpperCase(),
    unitNameVi,
    title,
    displayName,
    role,
    authProvider: 'email',
    accessToken: `${payloadB64}.${sig}`,
    hasSelectedUnit: true,
    startedAt: new Date().toISOString()
  };
}

async function waitReady(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(`${BASE}/api/health/live`)).ok) return true;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Không khởi động được máy chủ local để chạy Role Smoke Test.');
}

async function createRolePage(browser, session, pageErrors) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: 'hcmute_vtvl_session_token', value: session.accessToken, domain: '127.0.0.1', path: '/' }
  ]);
  const page = await context.newPage();
  page.on('pageerror', (e) => pageErrors.push(`[${session.role}] ${e.message}`));
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((s) => {
    localStorage.setItem('vtvl_operator_session', JSON.stringify(s));
    localStorage.setItem('hcmute_vtvl_current_operator_v1', JSON.stringify(s));
    if (s.role === 'admin') sessionStorage.setItem('hcmute_vtvl_admin_token', s.accessToken);
  }, session);
  return { context, page };
}

(async () => {
  const t0 = performance.now();
  console.log('========================================================================');
  console.log(' HCM-UTE VTVL 360 — ROLE-BASED WEB SMOKE TEST (STAFF · LEADER · ADMIN)');
  console.log('========================================================================');

  const srv = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true', ADMIN_SERVER_SECRET: TEST_SECRET, NODE_ENV: 'production' },
    stdio: 'ignore'
  });

  let browser;
  const pageErrors = [];
  const results = [];
  const check = (role, name, ok, detail = '') => {
    results.push({ role, name, ok, detail });
    console.log(`  ${ok ? '✓ [PASS]' : '✗ [FAIL]'} [${role}] ${name}${detail ? ' — ' + detail : ''}`);
  };

  try {
    await waitReady();
    browser = await chromium.launch({ headless: true, channel: 'chrome' });

    // 1. VAI TRÒ CÁN BỘ – GIẢNG VIÊN (STAFF)
    const staffSess = signSession('staff', 'gv.smoke@hcmute.edu.vn', 'CNTT', 'Khoa Công nghệ thông tin', 'Giảng viên Smoke', 'Giảng viên');
    const staffCtx = await createRolePage(browser, staffSess, pageErrors);
    await staffCtx.page.goto(`${BASE}/phieu-cong-viec`, { waitUntil: 'domcontentloaded' });
    await staffCtx.page.getByText(/Phiếu công việc|Kê khai/i).first().waitFor({ timeout: 10000 });
    check('STAFF', 'S1. Mở /phieu-cong-viec hiển thị không gian kê khai cá nhân', true);

    const staffBulkStatus = await staffCtx.page.evaluate(async (tok) => {
      const r = await fetch('/api/tickets/bulk-import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitCode: 'CNTT', rows: [] })
      });
      return r.status;
    }, staffSess.accessToken);
    await staffCtx.page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    await staffCtx.page.waitForTimeout(800);
    const staffBlockedAdmin = !staffCtx.page.url().includes('/admin');
    check('STAFF', 'S2. Chặn truy cập /admin & API bulk-import (403)', staffBlockedAdmin && staffBulkStatus === 403, `url=${new URL(staffCtx.page.url()).pathname}, bulkApi=${staffBulkStatus}`);

    await staffCtx.page.goto(`${BASE}/huong-dan?doc=2.1`, { waitUntil: 'domcontentloaded' });
    await staffCtx.page.locator('video').first().waitFor({ timeout: 10000 });
    const staffVideoSrc = await staffCtx.page.locator('video').first().getAttribute('src');
    const staffPopupBtn = await staffCtx.page.getByRole('button', { name: /Mở popup video hướng dẫn/i }).isVisible();
    check('STAFF', 'S3. /huong-dan?doc=2.1 hiển thị Video 02 & popup nổi góc phải dưới', Boolean(staffVideoSrc?.includes('VTVL-02')) && staffPopupBtn, staffVideoSrc || '');
    await staffCtx.context.close();

    // 2. VAI TRÒ LÃNH ĐẠO ĐƠN VỊ (UNIT LEADER)
    const leaderSess = signSession('unit_leader', 'ld.smoke@hcmute.edu.vn', 'CNTT', 'Khoa Công nghệ thông tin', 'Lãnh đạo CNTT', 'Trưởng khoa');
    const leaderCtx = await createRolePage(browser, leaderSess, pageErrors);
    await leaderCtx.page.goto(`${BASE}/nghiep-vu-don-vi`, { waitUntil: 'domcontentloaded' });
    await leaderCtx.page.locator('main').getByRole('tab').first().waitFor({ timeout: 10000 });
    check('LEADER', 'L1. Mở /nghiep-vu-don-vi hiển thị không gian bảng tính đơn vị CNTT', true);

    await leaderCtx.page.goto(`${BASE}/phieu-don-vi`, { waitUntil: 'domcontentloaded' });
    await leaderCtx.page.getByText(/Toàn bộ phiếu đơn vị/i).first().waitFor({ timeout: 10000 });
    const leaderHasAdminImportBtn = await leaderCtx.page.getByRole('button', { name: /Nhập Excel A2/i }).count();
    check('LEADER', 'L2. Mở /phieu-don-vi duyệt phiếu & ẩn nút Nhập Excel A2 (chỉ Admin)', leaderHasAdminImportBtn === 0, `adminImportBtnCount=${leaderHasAdminImportBtn}`);

    await leaderCtx.page.goto(`${BASE}/huong-dan?doc=3.1`, { waitUntil: 'domcontentloaded' });
    await leaderCtx.page.locator('video').first().waitFor({ timeout: 10000 });
    const leaderVideoSrc = await leaderCtx.page.locator('video').first().getAttribute('src');
    check('LEADER', 'L3. /huong-dan?doc=3.1 hiển thị Video 03 quản lý phiếu', Boolean(leaderVideoSrc?.includes('VTVL-03')), leaderVideoSrc || '');
    await leaderCtx.context.close();

    // 3. VAI TRÒ QUẢN TRỊ VIÊN PHÒNG TCNS (ADMIN)
    const adminSess = signSession('admin', 'tcns@hcmute.edu.vn', 'TCNS', 'Phòng Tổ chức – Nhân sự', 'Quản trị TCNS', 'Quản trị viên');
    const adminCtx = await createRolePage(browser, adminSess, pageErrors);
    await adminCtx.page.goto(`${BASE}/admin?tab=system-logs`, { waitUntil: 'domcontentloaded' });
    await adminCtx.page.locator('[aria-label="Lọc nhóm nhật ký hệ thống"]').waitFor({ timeout: 10000 });
    check('ADMIN', 'A1. Mở /admin?tab=system-logs hiển thị bộ lọc 4 nhóm Nhật ký', true);

    await adminCtx.page.goto(`${BASE}/phieu-don-vi`, { waitUntil: 'domcontentloaded' });
    const adminImportBtn = adminCtx.page.getByRole('button', { name: /Nhập Excel A2/i }).first();
    await adminImportBtn.waitFor({ timeout: 10000 });
    await adminImportBtn.click();
    const modalOk = await adminCtx.page.getByText(/Nhập Excel phiếu công việc chuẩn A2_CongViec/i).isVisible();
    check('ADMIN', 'A2. /phieu-don-vi hiện nút Nhập Excel A2 & mở hộp thoại chuẩn A2', modalOk);

    await adminCtx.page.goto(`${BASE}/admin/suc-khoe`, { waitUntil: 'domcontentloaded' });
    await adminCtx.page.getByText(/Sức khỏe & tải hệ thống HCM-UTE VTVL 360/i).waitFor({ timeout: 10000 });
    const kpiOk = await adminCtx.page.getByText(/Kết nối PostgreSQL/i).isVisible();
    check('ADMIN', 'A3. Mở trang độc lập /admin/suc-khoe hiển thị đủ KPI vận hành', kpiOk);
    await adminCtx.context.close();

    check('GLOBAL', 'G1. Không phát sinh lỗi JS runtime (pageerror) trên cả 3 vai trò', pageErrors.length === 0, `pageErrors=${pageErrors.length}`);

    const passed = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    console.log('------------------------------------------------------------------------');
    console.log(` ROLE WEB SMOKE RESULT: ${passed}/${results.length} PASS | ${failed} FAIL | ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    console.log('------------------------------------------------------------------------');
    if (failed > 0) process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    srv.kill('SIGTERM');
  }
})();
