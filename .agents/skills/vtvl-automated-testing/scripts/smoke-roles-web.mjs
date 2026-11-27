#!/usr/bin/env node
/**
 * Role-Based Web Smoke Testing toàn chu trình cho HCM-UTE VTVL 360
 * Kiểm tra cả giao diện 3 vai trò lẫn chu trình thật:
 *   Leader nhập A1/C1 -> Staff tạo Nháp -> Sửa & Nộp -> Xóa Nháp -> Leader duyệt vào A2 & B1.
 * Cô lập 100% bằng VTVL_ISOLATED_LOCAL_STORE=true (không chạm dữ liệu thật).
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
  console.log(' HCM-UTE VTVL 360 — ROLE-BASED WEB SMOKE TEST (UI + NHẬP/SỬA/LƯU PHIẾU)');
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

    const leaderSess = signSession('unit_leader', 'ld.smoke@hcmute.edu.vn', 'CNTT', 'Khoa Công nghệ thông tin', 'Lãnh đạo CNTT', 'Trưởng khoa');
    const staffSess = signSession('staff', 'gv.smoke@hcmute.edu.vn', 'CNTT', 'Khoa Công nghệ thông tin', 'Giảng viên Smoke', 'Giảng viên');
    const adminSess = signSession('admin', 'tcns@hcmute.edu.vn', 'TCNS', 'Phòng Tổ chức – Nhân sự', 'Quản trị TCNS', 'Quản trị viên');

    // 1. LÃNH ĐẠO ĐƠN VỊ: MỞ KHÔNG GIAN ĐƠN VỊ & LƯU A1 + C1 KHÔNG MẤT DỮ LIỆU
    const leaderCtx = await createRolePage(browser, leaderSess, pageErrors);
    await leaderCtx.page.goto(`${BASE}/nghiep-vu-don-vi`, { waitUntil: 'domcontentloaded' });
    await leaderCtx.page.locator('main').getByRole('tab').first().waitFor({ timeout: 10000 });
    check('LEADER', 'L1. Mở /nghiep-vu-don-vi hiển thị không gian bảng tính đơn vị CNTT', true);

    const seedA1C1 = await leaderCtx.page.evaluate(async (tok) => {
      const h = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
      const g = await fetch('/api/workbooks/wb_CNTT_2026', { headers: h });
      const gj = await g.json();
      const wb = gj.workbook;
      const nextData = {
        ...wb.data,
        A1: [{ id: 'a1-smoke-1', maNhiemVu: 'CNTT.NV01', tenNhiemVu: 'Quản lý đào tạo Smoke Test', coQuan: 'Khoa Công nghệ thông tin', canCu: 'QĐ 2266/QĐ-ĐHCNKT', ky: '01/10/2025–30/9/2026', trangThai: 'Tiếp tục thực hiện', nguon: 'Phụ lục 1' }],
        C1: [{ id: 'c1-smoke-1', maVtvl: 'CNTT.CM63', tenVtvl: 'Giảng viên đại học', loaiNhanLuc: 'Viên chức', quyetDinh: 'NĐ 232/2026/NĐ-CP', canCuQuyGio: 'Mức chung 1.904 giờ', trangThai: 'Tiếp tục sử dụng', cheDoLamViec: 'Phổ biến (40 giờ/tuần)' }]
      };
      const p = await fetch(`/api/workbooks/${wb.id}`, {
        method: 'PUT',
        headers: h,
        body: JSON.stringify({ data: nextData, baseRevision: wb.currentRevision, commitMessage: 'Smoke nhập A1 & C1' })
      });
      const pj = await p.json();
      const g2 = await (await fetch(`/api/workbooks/${wb.id}`, { headers: h })).json();
      return { putStatus: p.status, a1: g2.workbook?.data?.A1?.length || 0, c1: g2.workbook?.data?.C1?.length || 0, rev: pj.workbook?.currentRevision };
    }, leaderSess.accessToken);
    check('LEADER', 'L1b. Nhập & lưu Biểu A1 + C1, đọc lại còn nguyên dữ liệu', seedA1C1.putStatus === 200 && seedA1C1.a1 === 1 && seedA1C1.c1 === 1, `HTTP ${seedA1C1.putStatus}, A1=${seedA1C1.a1}, C1=${seedA1C1.c1}`);

    // 2. CÁN BỘ – GIẢNG VIÊN: TẠO NHÁP -> HIỂN THỊ TRÊN WEB -> SỬA & NỘP -> XÓA NHÁP
    const staffCtx = await createRolePage(browser, staffSess, pageErrors);
    await staffCtx.page.goto(`${BASE}/phieu-cong-viec`, { waitUntil: 'domcontentloaded' });
    await staffCtx.page.getByText(/Phiếu công việc|Kê khai/i).first().waitFor({ timeout: 10000 });
    check('STAFF', 'S1. Mở /phieu-cong-viec hiển thị không gian kê khai cá nhân', true);

    const draftRes = await staffCtx.page.evaluate(async (tok) => {
      const r = await fetch('/api/tickets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitCode: 'CNTT', maNhiemVu: 'CNTT.NV01', maVtvl: 'CNTT.CM63',
          tenCongViec: 'Công việc Smoke Test ban đầu', sanPham: 'Báo cáo kết quả',
          chatLuong: 'Đúng hạn', canCu: 'QĐ 2266/QĐ-ĐHCNKT', soSpNam: 12, phutThucTe: 60,
          gioBoSung: 2, nguonSoLieu: 'Sổ theo dõi học kỳ', action: 'draft'
        })
      });
      const j = await r.json();
      return { status: r.status, id: j.ticket?.id, code: j.ticket?.maCongViec, st: j.ticket?.status };
    }, staffSess.accessToken);
    await staffCtx.page.reload({ waitUntil: 'domcontentloaded' });
    await staffCtx.page.getByText('Công việc Smoke Test ban đầu').first().waitFor({ timeout: 10000 });
    check('STAFF', 'S4. Nhập & lưu phiếu Nháp, reload /phieu-cong-viec thấy đúng trên DOM', draftRes.status === 200 && Boolean(draftRes.id), `${draftRes.code} (${draftRes.st})`);

    const submitRes = await staffCtx.page.evaluate(async ({ tok, id }) => {
      const r = await fetch('/api/tickets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id, unitCode: 'CNTT', maNhiemVu: 'CNTT.NV01', maVtvl: 'CNTT.CM63',
          tenCongViec: 'Công việc Smoke Test đã chỉnh sửa & nộp', sanPham: 'Báo cáo đã hoàn thiện',
          chatLuong: 'Đạt chuẩn 100%', canCu: 'QĐ 2266/QĐ-ĐHCNKT', soSpNam: 15, phutThucTe: 45,
          gioBoSung: 1, nguonSoLieu: 'Thống kê đào tạo', action: 'submit'
        })
      });
      const j = await r.json();
      return { status: r.status, st: j.ticket?.status, ver: j.ticket?.currentVersionNo };
    }, { tok: staffSess.accessToken, id: draftRes.id });
    await staffCtx.page.reload({ waitUntil: 'domcontentloaded' });
    await staffCtx.page.getByText('Công việc Smoke Test đã chỉnh sửa & nộp').first().waitFor({ timeout: 10000 });
    check('STAFF', 'S5. Sửa nội dung phiếu & Nộp phiếu (v1), hiển thị đúng trên DOM', submitRes.status === 200 && submitRes.ver >= 1, `status=${submitRes.st}, v${submitRes.ver}`);

    const delDraftRes = await staffCtx.page.evaluate(async (tok) => {
      const c = await fetch('/api/tickets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitCode: 'CNTT', maNhiemVu: 'CNTT.NV01', maVtvl: 'CNTT.CM63', tenCongViec: 'Phiếu nháp tạm để xóa', action: 'draft' })
      });
      const cj = await c.json();
      const d = await fetch(`/api/tickets?id=${encodeURIComponent(cj.ticket.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } });
      return { createStatus: c.status, deleteStatus: d.status };
    }, staffSess.accessToken);
    check('STAFF', 'S6. Tạo & Xóa phiếu Nháp thành công (200 OK)', delDraftRes.createStatus === 200 && delDraftRes.deleteStatus === 200);

    const staffBulkStatus = await staffCtx.page.evaluate(async (tok) => {
      const r = await fetch('/api/tickets/bulk-import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitCode: 'CNTT', rows: [] })
      });
      return r.status;
    }, staffSess.accessToken);
    await staffCtx.page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    await staffCtx.page.waitForTimeout(700);
    check('STAFF', 'S2. Chặn truy cập /admin & API bulk-import (403)', !staffCtx.page.url().includes('/admin') && staffBulkStatus === 403, `bulkApi=${staffBulkStatus}`);

    await staffCtx.page.goto(`${BASE}/huong-dan?doc=2.1`, { waitUntil: 'domcontentloaded' });
    await staffCtx.page.locator('video').first().waitFor({ timeout: 10000 });
    const staffVideoSrc = await staffCtx.page.locator('video').first().getAttribute('src');
    const staffPopupBtn = await staffCtx.page.getByRole('button', { name: /Mở popup video hướng dẫn/i }).isVisible();
    check('STAFF', 'S3. /huong-dan?doc=2.1 hiển thị Video 02 & popup nổi góc phải dưới', Boolean(staffVideoSrc?.includes('VTVL-02')) && staffPopupBtn);
    await staffCtx.context.close();

    // 3. LÃNH ĐẠO ĐƠN VỊ: THẤY PHIẾU CÁN BỘ VỪA NỘP TRÊN /phieu-don-vi & DUYỆT ĐƯA VÀO A2/B1
    await leaderCtx.page.goto(`${BASE}/phieu-don-vi`, { waitUntil: 'domcontentloaded' });
    await leaderCtx.page.getByText('Công việc Smoke Test đã chỉnh sửa & nộp').first().waitFor({ timeout: 10000 });
    const leaderHasAdminImportBtn = await leaderCtx.page.getByRole('button', { name: /Nhập Excel A2/i }).count();
    check('LEADER', 'L2. Mở /phieu-don-vi thấy phiếu cán bộ vừa nộp & ẩn nút Nhập Excel A2', leaderHasAdminImportBtn === 0);

    const approveRes = await leaderCtx.page.evaluate(async ({ tok, id }) => {
      const r = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: id, action: 'approve', unitCode: 'CNTT' })
      });
      const j = await r.json();
      const wb = await (await fetch('/api/workbooks/wb_CNTT_2026', { headers: { Authorization: `Bearer ${tok}` } })).json();
      const inA2 = (wb.workbook?.data?.A2 || []).some((row) => row.sourceTicketId === id);
      const inB1 = (wb.workbook?.data?.B1 || []).some((row) => row.sourceTicketId === id);
      return { status: r.status, merged: j.ticket?.isMergedToB1B2, inA2, inB1 };
    }, { tok: leaderSess.accessToken, id: draftRes.id });
    check('LEADER', 'L4. Phê duyệt phiếu & tự động đưa vào Biểu A2 & B1', approveRes.status === 200 && approveRes.merged && approveRes.inA2 && approveRes.inB1, `A2=${approveRes.inA2}, B1=${approveRes.inB1}`);

    await leaderCtx.page.goto(`${BASE}/huong-dan?doc=3.1`, { waitUntil: 'domcontentloaded' });
    await leaderCtx.page.locator('video').first().waitFor({ timeout: 10000 });
    const leaderVideoSrc = await leaderCtx.page.locator('video').first().getAttribute('src');
    check('LEADER', 'L3. /huong-dan?doc=3.1 hiển thị Video 03 quản lý phiếu', Boolean(leaderVideoSrc?.includes('VTVL-03')));
    await leaderCtx.context.close();

    // 4. QUẢN TRỊ VIÊN TCNS (ADMIN)
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
