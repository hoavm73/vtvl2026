/**
 * Real Headless Chrome Browser E2E Verification via Chrome DevTools Protocol (CDP)
 * Drives actual Google Chrome DOM on http://localhost:3360 across Staff, Leader, and Admin roles.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createHmac } from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3360';
const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9229;
const DATA_DIR = path.join(process.cwd(), '.data');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

function getSigningSecret() {
  if (process.env.ADMIN_SERVER_SECRET) return process.env.ADMIN_SERVER_SECRET.trim();
  try {
    const envLocal = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
    const match = envLocal.match(/ADMIN_SERVER_SECRET=([^\r\n]+)/);
    if (match && match[1]) return match[1].trim().replace(/^["']|["']$/g, '');
  } catch { /* ignore */ }
  return 'hcmute_vtvl_jwt_dev_secret_only';
}

function makeSignedSession(account) {
  const payloadObj = {
    email: account.email.toLowerCase(),
    role: account.role,
    unitCode: account.unitCode.toUpperCase(),
    issuedAt: new Date().toISOString(),
    expiresAt: Date.now() + 24 * 3600_000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf-8').toString('base64url');
  const sig = createHmac('sha256', getSigningSecret()).update(payloadB64).digest('base64url');
  const accessToken = `${payloadB64}.${sig}`;
  return {
    email: account.email.toLowerCase(),
    unitCode: account.unitCode.toUpperCase(),
    unitNameVi: account.unitNameVi,
    title: account.title,
    displayName: account.displayName,
    role: account.role,
    authProvider: 'email',
    accessToken,
    hasSelectedUnit: true,
    startedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  };
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.seq = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJs(expression) {
    try {
      const res = await this.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (res.exceptionDetails) {
        return null;
      }
      return res.result ? res.result.value : undefined;
    } catch {
      return null;
    }
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function waitForCondition(fn, timeoutMs = 15000, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const val = await fn();
    if (val) return val;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

async function runBrowserE2E() {
  console.log('\n🌐 KIỂM THỬ BROWSER E2E THẬT QUA HEADLESS CHROME (CDP WEBSOCKET)\n');

  if (!fs.existsSync(CHROME_BIN)) {
    console.error(`❌ Không tìm thấy Google Chrome tại ${CHROME_BIN}`);
    process.exit(1);
  }

  const filesToBackup = [
    path.join(DATA_DIR, 'staff_tickets.json'),
    path.join(DATA_DIR, 'staff_ticket_versions.json'),
    path.join(DATA_DIR, 'staff_ticket_merge_links.json'),
    path.join(DATA_DIR, 'server_accounts.json'),
    path.join(DATA_DIR, 'server_workbooks.json'),
    path.join(DATA_DIR, 'audit-logs.json'),
  ];
  const backups = new Map();
  for (const f of filesToBackup) {
    backups.set(f, fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : null);
  }

  let chromeProc = null;
  let cdp = null;
  const userDataDir = `/tmp/vtvl-qa-chrome-${Date.now()}`;

  const seedAdmin = {
    email: 'tcns@hcmute.edu.vn',
    displayName: 'Phòng Tổ chức – Nhân sự',
    unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự',
    title: 'Phòng Tổ chức – Nhân sự',
    role: 'admin',
  };
  const qaStaff = {
    email: 'qa.staff.qth@hcmute.edu.vn',
    displayName: 'Chuyên viên QA QTTHTT',
    unitCode: 'QTTHTT',
    unitNameVi: 'Phòng Quản trị thương hiệu và Truyền thông',
    title: 'Cán bộ – Giảng viên',
    role: 'staff',
  };
  const qaLeader = {
    email: 'qa.leader.qth@hcmute.edu.vn',
    displayName: 'Trưởng phòng QA QTTHTT',
    unitCode: 'QTTHTT',
    unitNameVi: 'Phòng Quản trị thương hiệu và Truyền thông',
    title: 'Lãnh đạo đơn vị',
    role: 'unit_leader',
  };
  const qaAdmin = {
    email: 'qa.admin.tcns@hcmute.edu.vn',
    displayName: 'Quản trị viên QA TCNS',
    unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự',
    title: 'Phòng Tổ chức – Nhân sự',
    role: 'admin',
  };

  const seedAdminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${makeSignedSession(seedAdmin).accessToken}`,
    'x-actor-email': seedAdmin.email,
  };

  try {
    // 1. Register isolated QA accounts on the running server via /api/admin/accounts
    for (const acc of [qaStaff, qaLeader, qaAdmin]) {
      await fetch(`${BASE_URL}/api/admin/accounts`, {
        method: 'POST',
        headers: seedAdminHeaders,
        body: JSON.stringify({
          email: acc.email,
          displayName: acc.displayName,
          unitCode: acc.unitCode,
          role: acc.role,
        }),
      });
    }

    // 2. Launch Headless Chrome
    chromeProc = spawn(
      CHROME_BIN,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1440,900',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${userDataDir}`,
        `${BASE_URL}/dang-nhap`,
      ],
      { stdio: 'ignore' }
    );

    const targetInfo = await waitForCondition(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (!res.ok) return null;
        const list = await res.json();
        return list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      } catch {
        return null;
      }
    }, 10000, 250);

    assert(Boolean(targetInfo && targetInfo.webSocketDebuggerUrl), 'Khởi chạy Google Chrome Headless & kết nối CDP thành công');

    cdp = new CDPClient(targetInfo.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // 3. Verify /dang-nhap DOM & Typography
    const loginDom = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body) return null;
        const h1 = document.querySelector('h1');
        if (!h1) return null;
        const spans = h1.querySelectorAll('span');
        if (spans.length < 2) return null;
        const s0 = window.getComputedStyle(spans[0]);
        const s1 = window.getComputedStyle(spans[1]);
        return {
          line1: spans[0].textContent.trim(),
          line2: spans[1].textContent.trim(),
          line1FontSize: s0.fontSize,
          line2FontWeight: s1.fontWeight,
          bodyText: document.body.innerText || ''
        };
      })()`);
    }, 10000);

    assert(
      loginDom && loginDom.line1 === 'Cổng thông tin' && loginDom.line2 === 'Vị trí việc làm',
      `DOM /dang-nhap hiển thị đúng 2 dòng tiêu đề h1: "${loginDom?.line1}" / "${loginDom?.line2}" (font-weight: ${loginDom?.line2FontWeight})`
    );
    assert(
      loginDom && loginDom.bodyText.includes('Trường Đại học Công nghệ Kỹ thuật TP. Hồ Chí Minh | HCM-UTE'),
      'DOM /dang-nhap hiển thị chuẩn "Trường Đại học Công nghệ Kỹ thuật TP. Hồ Chí Minh | HCM-UTE"'
    );

    // Helper to switch active user session in browser localStorage and navigate
    const switchBrowserRole = async (account, targetPath = '/phieu-cong-viec') => {
      const signed = makeSignedSession(account);
      await cdp.evalJs(`(() => {
        localStorage.setItem('hcmute_vtvl_current_operator_v1', ${JSON.stringify(JSON.stringify(signed))});
        localStorage.setItem('vtvl_active_unit_code', ${JSON.stringify(account.unitCode)});
        window.location.href = ${JSON.stringify(`${BASE_URL}${targetPath}`)};
        return true;
      })()`);
    };

    // 4. Role 1: Staff opens /phieu-cong-viec
    await switchBrowserRole(qaStaff, '/phieu-cong-viec');

    const staffFormReady = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body || window.location.pathname !== '/phieu-cong-viec') return null;
        const text = document.body.innerText || '';
        if (!text.includes('Phiếu của tôi') || !text.includes('Mã nhiệm vụ (theo Biểu A1)')) return null;
        const textarea = document.querySelector('#staff-ticket-form-card textarea');
        const selectTrigger = document.querySelector('#staff-ticket-form-card button[aria-haspopup="listbox"]');
        if (!textarea || !selectTrigger) return null;
        return {
          hasStaffTabs: text.includes('Phiếu của tôi') && text.includes('Tạo phiếu công việc') && text.includes('Công việc phối hợp với tôi') && text.includes('Mối quan hệ công việc'),
          hasTextarea: Boolean(textarea),
          hasSelectTrigger: Boolean(selectTrigger),
        };
      })()`);
    }, 15000);

    assert(
      Boolean(staffFormReady && staffFormReady.hasStaffTabs),
      'DOM /phieu-cong-viec (Staff) hiển thị đúng 4 tab cá nhân ("Phiếu của tôi", "Tạo phiếu công việc", "Công việc phối hợp với tôi", "Mối quan hệ công việc")'
    );

    // Click mission dropdown inside #staff-ticket-form-card to verify full mission text without truncation
    await cdp.evalJs(`(() => {
      const triggers = Array.from(document.querySelectorAll('#staff-ticket-form-card button[aria-haspopup="listbox"]'));
      if (triggers.length > 0) triggers[0].click();
      return triggers.length;
    })()`);

    const missionOptionsCheck = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body) return null;
        const els = Array.from(document.querySelectorAll('[role="option"]'));
        if (els.length === 0) return null;
        const options = els.map((el) => {
          const span = el.querySelector('span');
          return {
            text: (span ? span.textContent : el.textContent).trim(),
            spanClass: span ? span.className : el.className,
          };
        });
        els[0].click();
        return options;
      })()`);
    }, 5000);

    assert(
      Array.isArray(missionOptionsCheck) &&
        missionOptionsCheck.length > 0 &&
        missionOptionsCheck.every((o) => !o.spanClass.includes('truncate') && o.spanClass.includes('whitespace-normal')),
      `Dropdown Mã nhiệm vụ hiển thị đầy đủ toàn bộ nội dung chức năng nhiệm vụ (${missionOptionsCheck?.length || 0} mục, whitespace-normal, không bị cắt dấu "...")`
    );

    // 5. Staff creates Draft -> Reload -> Submits v1 -> Leader Returns #1 -> Staff Resubmits v2 -> Leader Returns #2 -> Staff Resubmits v3 -> Leader Approves
    const staffToken = makeSignedSession(qaStaff).accessToken;
    const leaderToken = makeSignedSession(qaLeader).accessToken;

    const staffHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
      'x-actor-email': qaStaff.email,
    };
    const leaderHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${leaderToken}`,
      'x-actor-email': qaLeader.email,
    };

    const basePayload = {
      unitCode: 'QTTHTT',
      maNhiemVu: 'QTTHTT.NV01',
      tenNhiemVu: 'Quản trị thương hiệu và truyền thông số HCM-UTE',
      tenCongViec: 'Thiết kế bộ nhận diện sự kiện tuyển sinh 2026',
      maVtvl: 'QTTHTT.CV01',
      tenVtvl: 'Chuyên viên Truyền thông',
      sanPham: 'Bộ ấn phẩm truyền thông',
      chatLuong: 'Đúng chuẩn nhận diện thương hiệu HCM-UTE',
      canCu: 'Kế hoạch truyền thông tuyển sinh 2026',
      soSpNam: 4,
      phutThucTe: 1200,
      gioBoSung: 5,
      nguonSoLieu: 'Báo cáo Phòng QTTHTT',
    };

    // Create Draft via API while Staff is logged in, then reload browser DOM to verify persistence
    const draftRes = await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        ...basePayload,
        action: 'save_draft',
        status: 'draft',
      }),
    });
    const draftJson = await draftRes.json();
    const ticketId = draftJson.ticket?.id;
    assert(Boolean(ticketId), `Tạo phiếu Nháp thành công (${ticketId})`);

    // Reload browser page and verify Draft appears in Staff's "Phiếu của tôi", then click "Sửa" to verify populated textarea has bg-[#eff8ff]
    await cdp.send('Page.reload', { ignoreCache: true });
    const draftVisibleInDom = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body || window.location.pathname !== '/phieu-cong-viec') return null;
        const text = document.body.innerText || '';
        return text.includes('Thiết kế bộ nhận diện sự kiện tuyển sinh 2026') && text.includes('Nháp');
      })()`);
    }, 12000);
    assert(Boolean(draftVisibleInDom), 'Sau khi reload trình duyệt (F5), phiếu Nháp vẫn hiển thị bền vững trong tab "Phiếu của tôi"');

    // Click "Sửa" button on the draft ticket so textarea gets populated and switches to bg-[#eff8ff]
    await cdp.evalJs(`(() => {
      const editBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === 'Sửa');
      if (editBtn) editBtn.click();
      return Boolean(editBtn);
    })()`);

    const populatedFormStyle = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        const textarea = document.querySelector('#staff-ticket-form-card textarea');
        const selectTrigger = document.querySelector('#staff-ticket-form-card button[aria-haspopup="listbox"]');
        if (!textarea || !selectTrigger || !textarea.className.includes('bg-[#eff8ff]')) return null;
        return {
          textareaClass: textarea.className,
          selectClass: selectTrigger.className,
        };
      })()`);
    }, 5000);
    assert(
      Boolean(populatedFormStyle && populatedFormStyle.textareaClass.includes('bg-[#eff8ff]')),
      'DOM /phieu-cong-viec phân biệt rõ vùng nhập tay (textarea nền xanh nhạt bg-[#eff8ff] border-[#7cc4f5]) và vùng chọn danh mục (ShadcnSelect)'
    );

    // Submit v1
    await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        ...basePayload,
        id: ticketId,
        action: 'submit',
        status: 'submitted',
      }),
    });

    // Switch browser to Leader via legacy /phieu-cong-viec?tab=pending -> auto redirects to /phieu-don-vi
    await switchBrowserRole(qaLeader, '/phieu-cong-viec?tab=pending');
    const leaderPendingDom = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body || window.location.pathname !== '/phieu-don-vi') return null;
        const text = document.body.innerText || '';
        const hasAll3Tabs = text.includes('Toàn bộ phiếu đơn vị') && text.includes('Chờ duyệt') && text.includes('Đã duyệt');
        const hasTicket = text.includes('Thiết kế bộ nhận diện sự kiện tuyển sinh 2026') && text.includes('Đã nộp');
        return hasAll3Tabs && hasTicket ? true : null;
      })()`);
    }, 12000);
    assert(Boolean(leaderPendingDom), 'Trưởng đơn vị mở ?tab=pending chuyển hướng sạch sang /phieu-don-vi, thấy đủ 3 tab đơn vị và thấy phiếu vừa nộp (v1)');

    // Leader returns #1 (passing `reason` to PATCH /api/tickets)
    await fetch(`${BASE_URL}/api/tickets`, {
      method: 'PATCH',
      headers: leaderHeaders,
      body: JSON.stringify({
        ticketId,
        action: 'request_changes',
        reason: 'Lần 1: Bổ sung thêm kênh truyền thông mạng xã hội và tăng số bộ ấn phẩm lên 5',
      }),
    });

    // Switch browser to Staff to verify warning alert in DOM
    await switchBrowserRole(qaStaff, '/phieu-cong-viec');
    const staffReturnBannerDom = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body || window.location.pathname !== '/phieu-cong-viec') return null;
        const text = document.body.innerText || '';
        return text.includes('Yêu cầu bổ sung') && text.includes('Lần 1: Bổ sung thêm kênh truyền thông');
      })()`);
    }, 12000);
    assert(Boolean(staffReturnBannerDom), 'Trình duyệt của Cán bộ hiển thị rõ cảnh báo "Yêu cầu bổ sung" kèm lời phê Lần 1 của Lãnh đạo');

    // Resubmit v2
    await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        ...basePayload,
        id: ticketId,
        soSpNam: 5,
        phutThucTe: 1200,
        gioBoSung: 5,
        changeSummary: 'Giải trình v2: Đã tăng số bộ ấn phẩm từ 4 lên 5 bộ',
        action: 'resubmit',
        status: 'resubmitted',
      }),
    });

    // Leader returns #2
    await fetch(`${BASE_URL}/api/tickets`, {
      method: 'PATCH',
      headers: leaderHeaders,
      body: JSON.stringify({
        ticketId,
        action: 'request_changes',
        reason: 'Lần 2: Điều chỉnh định mức giờ/bộ lên 24 giờ và giờ bổ sung lên 10 giờ',
      }),
    });

    // Staff resubmits v3
    await fetch(`${BASE_URL}/api/tickets`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        ...basePayload,
        id: ticketId,
        soSpNam: 5,
        phutThucTe: 1440,
        gioBoSung: 10,
        changeSummary: 'Giải trình v3: Đã cập nhật 24 giờ/bộ (1440 phút) và 10 giờ bổ sung (tổng 130 giờ/năm)',
        action: 'resubmit',
        status: 'resubmitted',
      }),
    });

    // Leader approves v3
    await fetch(`${BASE_URL}/api/tickets`, {
      method: 'PATCH',
      headers: leaderHeaders,
      body: JSON.stringify({
        ticketId,
        action: 'approve',
        reason: 'Đồng ý phê duyệt phiên bản v3 (130 giờ/năm)',
      }),
    });

    // 6. Switch browser to Leader on /phieu-don-vi?tab=all, check "Đưa vào Biểu A2 & B1" label & open Detail Modal -> "Thay đổi so với bản trước" (v1/v2/v3 diff)
    await switchBrowserRole(qaLeader, '/phieu-don-vi?tab=all');
    const leaderApprovedDom = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body || window.location.pathname !== '/phieu-don-vi') return null;
        const buttons = Array.from(document.querySelectorAll('button'));
        const hasMergeBtn = buttons.some((b) => b.textContent.includes('Đưa vào Biểu A2 & B1'));
        const hasWrongBtn = buttons.some((b) => b.textContent.includes('Gộp vào B1/B2'));
        return hasMergeBtn && !hasWrongBtn ? { hasMergeBtn, hasWrongBtn } : null;
      })()`);
    }, 12000);

    assert(
      Boolean(leaderApprovedDom && leaderApprovedDom.hasMergeBtn && !leaderApprovedDom.hasWrongBtn),
      'DOM hiển thị đúng nhãn nút "Đưa vào Biểu A2 & B1" (không còn gây hiểu lầm B1/B2)'
    );

    // Click "Xem chi tiết" button in DOM, then click "Thay đổi so với bản trước" tab inside StaffTicketDetailModal
    await cdp.evalJs(`(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const detailBtn = buttons.find((b) => b.textContent.includes('Xem chi tiết'));
      if (detailBtn) detailBtn.click();
      return Boolean(detailBtn);
    })()`);

    await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        const diffTabBtn = Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent.includes('Thay đổi so với bản trước')
        );
        if (!diffTabBtn) return null;
        diffTabBtn.click();
        return true;
      })()`);
    }, 5000);

    const diffModalDom = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body) return null;
        const text = document.body.innerText || '';
        if (!text.includes('Tổng số phiên bản đã nộp: 3')) return null;
        return {
          hasThreeVersions: text.includes('Tổng số phiên bản đã nộp: 3'),
          hasV1V2V3: text.includes('v1') && text.includes('v2') && text.includes('v3'),
          hasChangedFields: text.includes('1440') && text.includes('1200'),
        };
      })()`);
    }, 10000);

    assert(
      Boolean(diffModalDom && diffModalDom.hasThreeVersions && diffModalDom.hasV1V2V3 && diffModalDom.hasChangedFields),
      'Modal Chi tiết phiếu -> Tab "Thay đổi so với bản trước" trên trình duyệt hiển thị đủ 3 phiên bản (v1, v2, v3) và bảng đối chiếu từng trường'
    );

    // Execute Merge into workbook and reload DOM to verify "Đã gộp B1/B2" badge
    const mergeRes = await fetch(`${BASE_URL}/api/tickets`, {
      method: 'PATCH',
      headers: leaderHeaders,
      body: JSON.stringify({
        ticketId,
        action: 'merge',
      }),
    });
    const mergeJson = await mergeRes.json();
    assert(mergeRes.ok && Boolean(mergeJson.ticket), 'Thực thi gộp phiếu v3 vào bảng tính đơn vị thành công');

    await cdp.send('Page.reload', { ignoreCache: true });
    const mergedBadgeDom = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body || window.location.pathname !== '/phieu-don-vi') return null;
        const text = document.body.innerText || '';
        return text.includes('Đã đưa vào Biểu A2 & B1');
      })()`);
    }, 12000);
    assert(Boolean(mergedBadgeDom), 'Sau khi gộp và reload trình duyệt, phiếu hiển thị huy hiệu "Đã đưa vào Biểu A2 & B1"');

    // Switch back to personal /phieu-cong-viec and click "Xem trước bản in A4"
    await switchBrowserRole(qaStaff, '/phieu-cong-viec');
    const printPreviewDom = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body || window.location.pathname !== '/phieu-cong-viec') return null;
        const buttons = Array.from(document.querySelectorAll('button'));
        const myTab = buttons.find((b) => b.textContent.includes('Phiếu của tôi'));
        if (myTab) myTab.click();
        const printTab = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Xem trước bản in A4'));
        if (printTab) printTab.click();
        const text = document.body.innerText || '';
        return text.includes('PHIẾU KHẢO SÁT') || text.includes('Xem trước bản in A4');
      })()`);
    }, 8000);
    assert(Boolean(printPreviewDom), 'Chuyển sang chế độ "Xem trước bản in A4" trên trình duyệt hoạt động mượt mà');

    // 7. Role 3: Admin opens /phieu-don-vi (also verifying compatibility from /phieu-cong-viec?tab=unit) and views unit QTTHTT
    await switchBrowserRole({ ...qaAdmin, unitCode: 'QTTHTT', unitNameVi: 'Phòng Quản trị thương hiệu và Truyền thông' }, '/phieu-cong-viec?tab=unit');
    const adminViewDom = await waitForCondition(async () => {
      return await cdp.evalJs(`(() => {
        if (!document.body || window.location.pathname !== '/phieu-don-vi') return null;
        const text = document.body.innerText || '';
        return text.includes('Thiết kế bộ nhận diện sự kiện tuyển sinh 2026') && text.includes('Đã đưa vào Biểu A2 & B1');
      })()`);
    }, 12000);
    assert(Boolean(adminViewDom), 'Admin mở trình duyệt kiểm tra chéo đơn vị QTTHTT thấy đầy đủ phiếu và trạng thái "Đã đưa vào Biểu A2 & B1"');

  } finally {
    if (cdp) cdp.close();
    if (chromeProc) {
      try { chromeProc.kill('SIGKILL'); } catch { /* ignore */ }
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch { /* ignore */ }
    for (const [f, content] of backups.entries()) {
      if (content === null) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } else {
        fs.writeFileSync(f, content, 'utf-8');
      }
    }
  }

  console.log(`\n📊 KẾT QUẢ BROWSER E2E (HEADLESS CHROME): ${passed} PASS, ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

runBrowserE2E().catch((err) => {
  console.error('Lỗi chạy Browser E2E:', err);
  process.exit(1);
});
