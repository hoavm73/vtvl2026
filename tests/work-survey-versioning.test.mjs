import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { spawnSync } from 'child_process';

const root = process.cwd();

console.log('================================================================');
console.log(' BỘ KIỂM THỬ TÍCH HỢP VÒNG ĐỜI & PHIÊN BẢN PHIẾU (EXECUTABLE E2E)');
console.log(' Môi trường: Cô lập hoàn toàn (VTVL_ISOLATED_LOCAL_STORE=true)');
console.log(' Bao phủ: Mục B.10 (Quy trình 7 bước) & Mục C.1–C.6 (Versioning & Diff)');
console.log('================================================================');

const dataDir = path.join(root, '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Sao lưu toàn bộ tệp JSON hiện có trong .data trước khi chạy kiểm thử cô lập
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

const runnerScriptPath = path.join(dataDir, 'temp-versioning-e2e-runner.ts');

const runnerSource = `
import assert from 'assert';
import { NextRequest } from 'next/server';
import { GET as getTickets, POST as postTicket, PATCH as patchTicket } from '@/app/api/tickets/route';
import { GET as getWorkbookById, PUT as putWorkbook } from '@/app/api/workbooks/[id]/route';
import { GET as getAdminAccounts, POST as postAdminAccount, PATCH as patchAdminAccount } from '@/app/api/admin/accounts/route';
import { generateUserSessionToken } from '@/services/storage/server-auth-guard';
import { upsertUserAccount } from '@/services/storage/server-account-store';
import { getOrCreateWorkbook, saveServerWorkbook, resetWorkbookMemoryStore } from '@/services/storage/server-workbook-store';
import { getAuditLogs } from '@/services/storage/server-audit-store';
import { computeTicketVersionDiff, DELETED_CONTENT_LABEL } from '@/services/tickets/ticket-diff-engine';
import { ensureLegacyBaselineVersion, getTicketVersions, getTicketMergeLinks } from '@/services/storage/server-ticket-version-store';
import {
  resetTicketMemoryStore,
  getTicketsByUnit,
  allocateNextTaskCode,
  getTicketCounts,
  loadTickets,
  persistTickets
} from '@/services/storage/server-ticket-store';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createSchemaOrDbError } from '@/services/storage/server-ticket-db';
import { HCMUTE_UNITS } from '@/configs/hcmute-units';

interface TestResult {
  id: string;
  name: string;
  env: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  detail?: string;
}

const results: TestResult[] = [];

async function runCase(id: string, name: string, fn: () => Promise<void> | void) {
  const env = 'Isolated Local API + Service Store (VTVL_ISOLATED_LOCAL_STORE=true)';
  try {
    await fn();
    results.push({ id, name, env, status: 'PASS' });
    console.log(\`  ✓ [PASS] [\${id}] \${name} (\${env})\`);
  } catch (err: any) {
    results.push({ id, name, env, status: 'FAIL', detail: err?.message || String(err) });
    console.error(\`  ✗ [FAIL] [\${id}] \${name}:\`, err?.message || err);
    process.exitCode = 1;
  }
}

async function main() {
  // 1. Khởi tạo tài khoản chuẩn và tài khoản QA cùng đơn vị SDH trong store cô lập
  await upsertUserAccount({
    email: 'tcns@hcmute.edu.vn',
    displayName: 'Quản trị viên TCNS',
    unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự',
    title: 'Phòng Tổ chức – Nhân sự',
    role: 'admin',
    authProvider: 'email',
    status: 'active',
    hasSelectedUnit: true
  }, true);

  await upsertUserAccount({
    email: 'minhhoavo73@gmail.com',
    displayName: 'Võ Minh Hòa (Lãnh đạo SĐH)',
    unitCode: 'SDH',
    unitNameVi: 'Viện Sau Đại học',
    title: 'Lãnh đạo đơn vị',
    role: 'unit_leader',
    authProvider: 'email',
    status: 'active',
    hasSelectedUnit: true
  }, true);

  await upsertUserAccount({
    email: 'hoavm@hcmute.edu.vn',
    displayName: 'Võ Minh Hòa (Cán bộ QTTHTT)',
    unitCode: 'QTTHTT',
    unitNameVi: 'Phòng Quản trị thương hiệu và Truyền thông',
    title: 'Cán bộ – Giảng viên',
    role: 'staff',
    authProvider: 'email',
    status: 'active',
    hasSelectedUnit: true
  }, true);

  await upsertUserAccount({
    email: 'qa.staff.sdh@hcmute.edu.vn',
    displayName: 'Chuyên viên QA Khoa SĐH',
    unitCode: 'SDH',
    unitNameVi: 'Viện Sau Đại học',
    title: 'Cán bộ – Giảng viên',
    role: 'staff',
    authProvider: 'email',
    status: 'active',
    hasSelectedUnit: true
  }, true);

  // Khởi tạo workbook mẫu cho SDH và QTTHTT
  getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', 'minhhoavo73@gmail.com', 'Lãnh đạo đơn vị');
  const wbQtthtt = getOrCreateWorkbook('QTTHTT', '01/10/2025–30/9/2026', 'tcns@hcmute.edu.vn', 'Quản trị viên');

  const tokenAdmin = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
  const tokenLeaderSdh = generateUserSessionToken({ email: 'minhhoavo73@gmail.com', role: 'unit_leader', unitCode: 'SDH' });
  const tokenStaffQtthtt = generateUserSessionToken({ email: 'hoavm@hcmute.edu.vn', role: 'staff', unitCode: 'QTTHTT' });
  const tokenQaStaffSdh = generateUserSessionToken({ email: 'qa.staff.sdh@hcmute.edu.vn', role: 'staff', unitCode: 'SDH' });

  let qaTicketId = '';

  // CA 1: Danh mục 39 đơn vị và tài khoản chuẩn hoavm thuộc QTTHTT
  await runCase('E2E-01', 'Kiểm tra danh mục 39 đơn vị chính thức & tài khoản chuẩn hoavm thuộc QTTHTT', async () => {
    assert.strictEqual(HCMUTE_UNITS.length, 39, 'HCMUTE_UNITS phải có đúng 39 đơn vị');
    assert.ok(HCMUTE_UNITS.some(u => u.code === 'BANTT' && u.nameVi === 'Ban An ninh trật tự'), 'Phải giữ Ban An ninh trật tự (BANTT)');
    assert.ok(!HCMUTE_UNITS.some(u => ['BGH', 'HDT', 'TTNN'].includes(u.code)), 'Phải loại BGH, HDT, TTNN khỏi danh mục hoạt động');

    const res = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=QTTHTT', {
      headers: { authorization: 'Bearer ' + tokenStaffQtthtt }
    }));
    assert.strictEqual(res.status, 200, 'hoavm@hcmute.edu.vn phải truy cập thành công đơn vị chuẩn QTTHTT');
  });

  // CA 2: Tạo phiếu QA ở trạng thái Nháp (draft) -> lưu nháp nhiều lần không tạo phiên bản nộp v1
  await runCase('E2E-02', 'Tạo phiếu QA ở trạng thái Nháp (draft) và lưu nháp lại không sinh phiên bản v1', async () => {
    const createRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'SDH',
        ownerEmail: 'qa.staff.sdh@hcmute.edu.vn',
        ownerName: 'Chuyên viên QA Khoa SĐH',
        ownerTitle: 'Chuyên viên',
        maNhiemVu: 'SDH.NV01',
        maCongViec: 'SDH.NV01.CV99',
        tenCongViec: '[QA] Thẩm định hồ sơ bảo vệ luận văn cao học\\nBước 1: Tiếp nhận hồ sơ',
        maVtvl: 'SDH.CV01',
        maVtvlPhoiHop: 'SDH.QL02',
        sanPham: 'Hồ sơ thẩm định đủ điều kiện',
        chatLuong: 'Đúng quy chế đào tạo trình độ Thạc sĩ hiện hành',
        canCu: 'Quyết định 1907/QĐ-ĐHCNKT',
        soSpNam: 10,
        phutThucTe: 120,
        gioBoSung: 12,
        nguonSoLieu: 'Hệ thống quản lý học vụ SĐH (01/10/2025 - 30/9/2026)',
        status: 'draft',
        coordinatedTasks: [
          {
            id: 'coord-qa-1',
            targetUnitCode: 'DT',
            targetUnitName: 'Phòng Đào tạo',
            targetTaskCode: 'DT.NV02',
            targetTaskName: 'Đối chiếu văn bằng đại học đầu vào',
            note: 'Phối hợp tra cứu dữ liệu gốc'
          },
          {
            id: 'coord-qa-del',
            targetUnitCode: 'TV',
            targetUnitName: 'Trung tâm Học liệu',
            targetTaskCode: 'TV.NV01',
            targetTaskName: 'Xác nhận nộp lưu chiểu luận văn tạm thời'
          }
        ]
      })
    }));
    assert.strictEqual(createRes.status, 200, 'Tạo phiếu nháp QA phải trả về 200 OK');
    const createBody = await createRes.json();
    qaTicketId = createBody.ticket.id;
    assert.ok(qaTicketId, 'Phải trả về id của phiếu QA');
    assert.strictEqual(createBody.ticket.currentVersionNo || 0, 0, 'Lưu nháp lần 1 phải có currentVersionNo = 0');

    // Lưu nháp lần 2 (cập nhật nháp)
    const updateDraftRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        ...createBody.ticket,
        gioBoSung: 12.0,
        status: 'draft'
      })
    }));
    assert.strictEqual(updateDraftRes.status, 200, 'Cập nhật phiếu nháp phải thành công');
    const versionsAfterDraft = getTicketVersions(qaTicketId);
    assert.strictEqual(versionsAfterDraft.length, 0, 'Lưu nháp nhiều lần tuyệt đối không sinh bản ghi trong work_survey_versions');
  });

  // CA 3: Phiếu Nháp chỉ chủ sở hữu và Admin được xem
  await runCase('E2E-03', 'Phiếu Nháp chỉ chủ sở hữu và Admin được xem; Lãnh đạo cùng đơn vị không xem được bản nháp', async () => {
    const ownerRes = await getTickets(new NextRequest(\`http://localhost:3360/api/tickets?id=\${qaTicketId}\`, {
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh }
    }));
    assert.strictEqual(ownerRes.status, 200, 'Chủ sở hữu phải xem được phiếu nháp của mình');

    const adminRes = await getTickets(new NextRequest(\`http://localhost:3360/api/tickets?id=\${qaTicketId}\`, {
      headers: { authorization: 'Bearer ' + tokenAdmin }
    }));
    assert.strictEqual(adminRes.status, 200, 'Admin phải xem được phiếu nháp');

    const leaderRes = await getTickets(new NextRequest(\`http://localhost:3360/api/tickets?id=\${qaTicketId}\`, {
      headers: { authorization: 'Bearer ' + tokenLeaderSdh }
    }));
    assert.strictEqual(leaderRes.status, 403, 'Lãnh đạo đơn vị không được mở chi tiết phiếu Nháp của cán bộ');
    const leaderBody = await leaderRes.json();
    assert.strictEqual(leaderBody.code, 'FORBIDDEN_DRAFT_ACCESS');
  });

  // CA 4: Giả lập lỗi ghi snapshot khi submit -> rollback toàn bộ thao tác nộp
  await runCase('E2E-04', 'Lỗi tạo snapshot phiên bản làm hủy (rollback) toàn bộ thao tác nộp phiếu', async () => {
    process.env.VTVL_SIMULATE_VERSION_WRITE_FAILURE = 'true';
    try {
      const failSubmitRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
        method: 'PATCH',
        headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: qaTicketId, action: 'submit', _simulateVersionFailure: true })
      }));
      assert.ok(failSubmitRes.status >= 500, 'Khi lỗi ghi snapshot phải trả lỗi 500/503');
    } finally {
      delete process.env.VTVL_SIMULATE_VERSION_WRITE_FAILURE;
    }

    // Kiểm tra phiếu vẫn ở trạng thái Nháp và chưa có phiên bản nào
    const detailRes = await getTickets(new NextRequest(\`http://localhost:3360/api/tickets?id=\${qaTicketId}\`, {
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh }
    }));
    const detailBody = await detailRes.json();
    assert.strictEqual(detailBody.ticket.status, 'Nháp', 'Sau khi rollback, phiếu phải giữ nguyên trạng thái Nháp');
    assert.strictEqual(detailBody.ticket.currentVersionNo || 0, 0, 'currentVersionNo phải vẫn là 0');
    assert.strictEqual((detailBody.versions || []).length, 0, 'Không có snapshot mồ côi nào được giữ lại');
  });

  // CA 5: Nộp lần đầu sinh đúng v1 & bấm nộp 2 lần liên tiếp (idempotency) không sinh 2 phiên bản
  await runCase('E2E-05', 'Nộp phiếu lần đầu tạo đúng snapshot v1 bất biến; bấm nộp 2 lần liên tiếp không sinh bản trùng', async () => {
    const [res1, res2] = await Promise.all([
      patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
        method: 'PATCH',
        headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: qaTicketId, action: 'submit' })
      })),
      patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
        method: 'PATCH',
        headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: qaTicketId, action: 'submit' })
      }))
    ]);

    assert.strictEqual(res1.status, 200, 'Lệnh submit 1 phải thành công');
    assert.strictEqual(res2.status, 200, 'Lệnh submit 2 song song phải được xử lý idempotent 200 OK');
    const body1 = await res1.json();
    const calcHoursV1 = Math.round(((body1.ticket.soSpNam * body1.ticket.phutThucTe) / 60 + body1.ticket.gioBoSung) * 10) / 10;
    assert.strictEqual(calcHoursV1, 32, 'Tổng giờ năm của phiếu v1 phải được tính đúng (32 giờ)');

    const versions = getTicketVersions(qaTicketId);
    assert.strictEqual(versions.length, 1, 'Bấm nộp 2 lần song song chỉ được tạo đúng 1 phiên bản v1');
    assert.strictEqual(versions[0].versionNo, 1, 'Phiên bản đầu tiên phải là v1');
    assert.strictEqual(versions[0].submittedBy, 'qa.staff.sdh@hcmute.edu.vn');
    assert.strictEqual(versions[0].snapshot.soSpNam, 10);
    assert.strictEqual(versions[0].snapshot.phutThucTe, 120);
    assert.strictEqual(versions[0].snapshot.gioBoSung, 12);
  });

  // CA 6: Sau khi nộp, phiếu không thể hạ cấp ngược về Nháp và không ai được sửa nội dung kê khai của người khác
  await runCase('E2E-06', 'Phiếu đang Chờ duyệt không thể chuyển ngược về Nháp (FORBIDDEN_TICKET_LOCKED) và không ai sửa được phiếu của người khác', async () => {
    const ownerDowngradeToDraft = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: qaTicketId,
        action: 'draft',
        status: 'Nháp',
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        tenCongViec: 'Thử chuyển ngược về Nháp khi đang Chờ duyệt',
        maVtvl: 'SDH.CV01'
      })
    }));
    assert.strictEqual(ownerDowngradeToDraft.status, 403, 'Chủ sở hữu không được chuyển ngược phiếu Chờ duyệt về trạng thái Nháp');
    const errLocked = await ownerDowngradeToDraft.json();
    assert.strictEqual(errLocked.code, 'FORBIDDEN_TICKET_LOCKED');

    // Lãnh đạo hoặc Admin thử sửa trực tiếp nội dung kê khai của cán bộ -> bị chặn
    const leaderEditOther = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: qaTicketId,
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        tenCongViec: 'Lãnh đạo thử sửa trực tiếp nội dung của cán bộ',
        maVtvl: 'SDH.CV01'
      })
    }));
    assert.strictEqual(leaderEditOther.status, 403, 'Lãnh đạo không được sửa trực tiếp nội dung kê khai của người khác');
  });

  // CA 7: Yêu cầu bổ sung bắt buộc có lý do; Reload không mất trạng thái hoặc lý do
  await runCase('E2E-07', 'Lãnh đạo yêu cầu bổ sung bắt buộc có lý do; reload giữ nguyên trạng thái và lý do', async () => {
    const noReasonRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: qaTicketId, action: 'request_changes', reason: '   ' })
    }));
    assert.strictEqual(noReasonRes.status, 400, 'Yêu cầu bổ sung không có lý do phải bị chặn 400');

    const reasonText = 'Đề nghị rà soát lại VTVL phối hợp, điều chỉnh số sản phẩm năm thực tế từ 10 lên 15 và bổ sung bước 2 trong mô tả.';
    const reqChangesRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: qaTicketId, action: 'request_changes', reason: reasonText })
    }));
    assert.strictEqual(reqChangesRes.status, 200, 'Yêu cầu bổ sung có lý do phải thành công');

    // Reload qua GET /api/tickets?id=...
    const reloadRes = await getTickets(new NextRequest(\`http://localhost:3360/api/tickets?id=\${qaTicketId}\`, {
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh }
    }));
    assert.strictEqual(reloadRes.status, 200);
    const reloadData = await reloadRes.json();
    assert.strictEqual(reloadData.ticket.status, 'Yêu cầu bổ sung');
    assert.strictEqual(reloadData.ticket.revisionReason, reasonText, 'Reload không được mất lý do yêu cầu bổ sung');
    assert.strictEqual(reloadData.ticket.revisionRequestedBy, 'minhhoavo73@gmail.com');
  });

  // CA 8: Sửa phiếu ở trạng thái changes_requested và Nộp lại bắt buộc có giải trình -> tạo v2, giữ nguyên v1
  await runCase('E2E-08', 'Cán bộ sửa phiếu khi changes_requested và Nộp lại kèm giải trình -> tạo v2, bảo toàn v1', async () => {
    const editRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: qaTicketId,
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        maCongViec: 'SDH.NV01.CV99',
        tenCongViec: '[QA] Thẩm định hồ sơ bảo vệ luận văn cao học\\nBước 1: Tiếp nhận hồ sơ\\nBước 2: Rà soát điều kiện học phần và công bố khoa học',
        maVtvl: 'SDH.CV01',
        maVtvlPhoiHop: '', // Xóa nội dung trường tùy chọn maVtvlPhoiHop để kiểm thử trạng thái deleted ("Đã xóa nội dung")
        sanPham: 'Hồ sơ thẩm định đủ điều kiện',
        chatLuong: 'Đúng quy chế đào tạo trình độ Thạc sĩ hiện hành',
        canCu: 'Quyết định 1907/QĐ-ĐHCNKT & Quy chế đào tạo Thạc sĩ',
        soSpNam: 15,
        phutThucTe: 120,
        gioBoSung: 12.0,
        nguonSoLieu: 'Hệ thống quản lý học vụ SĐH (01/10/2025 - 30/9/2026)',
        status: 'changes_requested',
        coordinatedTasks: [
          {
            id: 'coord-qa-1',
            targetUnitCode: 'DT',
            targetUnitName: 'Phòng Đào tạo',
            targetTaskCode: 'DT.NV02',
            targetTaskName: 'Đối chiếu văn bằng đại học và chứng chỉ ngoại ngữ',
            note: 'Phối hợp tra cứu dữ liệu gốc'
          },
          {
            id: 'coord-qa-2',
            targetUnitCode: 'KHCN',
            targetUnitName: 'Phòng Khoa học Công nghệ',
            targetTaskCode: 'KHCN.NV01',
            targetTaskName: 'Xác nhận bài báo khoa học của học viên',
            note: 'Đối chiếu danh mục tạp chí'
          }
        ]
      })
    }));
    assert.strictEqual(editRes.status, 200, 'Cán bộ sửa phiếu ở trạng thái Yêu cầu bổ sung phải thành công');

    // Thử nộp lại mà không nhập giải trình -> phải bị chặn 400 MISSING_CHANGE_SUMMARY
    const noSummaryRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: qaTicketId, action: 'resubmit', changeSummary: '' })
    }));
    assert.strictEqual(noSummaryRes.status, 400, 'Nộp lại thiếu giải trình cập nhật phải bị chặn 400');

    // Nộp lại có giải trình hợp lệ
    const changeSummary = 'Đã xóa mã VTVL phối hợp không cần thiết, cập nhật số SP năm từ 10 lên 15 và thêm phối hợp với Phòng KHCN.';
    const resubmitRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: qaTicketId, action: 'resubmit', changeSummary })
    }));
    assert.strictEqual(resubmitRes.status, 200, 'Nộp lại kèm giải trình phải thành công');
    const resubmitBody = await resubmitRes.json();
    // Tổng giờ ở v2: (15 * 120)/60 + 12 = 30 + 12 = 42 giờ
    const calcHoursV2 = Math.round(((resubmitBody.ticket.soSpNam * resubmitBody.ticket.phutThucTe) / 60 + resubmitBody.ticket.gioBoSung) * 10) / 10;
    assert.strictEqual(calcHoursV2, 42, 'Tổng giờ năm sau khi nộp lại phải bằng 42 giờ');

    const versions = getTicketVersions(qaTicketId);
    assert.strictEqual(versions.length, 2, 'Sau khi nộp lại phải có đúng 2 phiên bản (v1 và v2)');
    assert.strictEqual(versions[0].versionNo, 1);
    assert.strictEqual(versions[0].snapshot.soSpNam, 10, 'Snapshot v1 phải bất biến, giữ nguyên soSpNam = 10');
    assert.strictEqual(versions[1].versionNo, 2);
    assert.strictEqual(versions[1].snapshot.soSpNam, 15, 'Snapshot v2 phải lưu soSpNam = 15');
    assert.strictEqual(versions[1].changeSummary, changeSummary);
  });

  // CA 9: Kiểm tra bộ máy so sánh từng trường giữa v1 và v2 (added / modified / deleted / unchanged / coordinatedTasks)
  await runCase('E2E-09', 'So sánh chi tiết từng trường giữa v1 và v2 (text nhiều dòng, số 12 vs 12.0, xóa nội dung, việc phối hợp)', async () => {
    const versions = getTicketVersions(qaTicketId);
    const v1 = versions[0];
    const v2 = versions[1];
    const diffs = computeTicketVersionDiff(v1.snapshot, v2.snapshot);
    const byKey = new Map(diffs.map(f => [f.fieldKey, f]));

    // 1. Trường bị xóa về rỗng: maVtvlPhoiHop & coordinatedTask:coord-qa-del
    assert.strictEqual(byKey.get('maVtvlPhoiHop')?.changeType, 'deleted', 'maVtvlPhoiHop bị xóa về rỗng phải có changeType = deleted');
    assert.strictEqual(byKey.get('maVtvlPhoiHop')?.currentValue, DELETED_CONTENT_LABEL, 'currentValue của trường bị xóa phải hiển thị "Đã xóa nội dung"');
    assert.strictEqual(byKey.get('coordinatedTask:coord-qa-del')?.changeType, 'deleted', 'Công việc phối hợp bị xóa phải có changeType = deleted');
    assert.strictEqual(byKey.get('coordinatedTask:coord-qa-del')?.currentValue, DELETED_CONTENT_LABEL);

    // 2. Trường mới thêm: coordinatedTask:coord-qa-2
    assert.strictEqual(byKey.get('coordinatedTask:coord-qa-2')?.changeType, 'added', 'Công việc phối hợp mới phải là added');
    assert.ok(byKey.get('coordinatedTask:coord-qa-2')?.currentValue.includes('[KHCN] Phòng Khoa học Công nghệ'));

    // 3. Trường bị sửa: tenCongViec (nhiều dòng), soSpNam (10 -> 15), canCu, coordinatedTask:coord-qa-1
    assert.strictEqual(byKey.get('tenCongViec')?.changeType, 'modified', 'tenCongViec nhiều dòng phải là modified');
    assert.ok(byKey.get('tenCongViec')?.currentValue.includes('Bước 2:'), 'tenCongViec phải bảo toàn xuống dòng');
    assert.strictEqual(byKey.get('soSpNam')?.changeType, 'modified', 'soSpNam (10 -> 15) phải là modified');
    assert.strictEqual(byKey.get('soSpNam')?.previousValue, '10');
    assert.strictEqual(byKey.get('soSpNam')?.currentValue, '15');
    assert.strictEqual(byKey.get('coordinatedTask:coord-qa-1')?.changeType, 'modified', 'coordinatedTasks phải đối chiếu theo ID ổn định');

    // 4. Trường số 12 vs 12.0: gioBoSung không được coi là thay đổi
    assert.strictEqual(byKey.has('gioBoSung'), false, 'gioBoSung 12 vs 12.0 phải được chuẩn hóa là không thay đổi');
  });

  // CA 9B: Vòng 2: Yêu cầu bổ sung lần 2 -> Sửa & Nộp lại tạo v3 -> So sánh v3/v2, v3/v1 & Reload xóa cache RAM
  await runCase('E2E-09B', 'Yêu cầu bổ sung lần 2 -> Nộp lại tạo v3 (giữ nguyên v1, v2) -> So sánh v3/v2, v3/v1 & Reload từ đĩa', async () => {
    const reqChanges2Res = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        ticketId: qaTicketId,
        action: 'request_changes',
        reason: 'Yêu cầu bổ sung lần 2: Điều chỉnh thời gian thực tế mỗi hồ sơ từ 120 phút lên 150 phút theo biên bản đo mẫu.'
      })
    }));
    assert.strictEqual(reqChanges2Res.status, 200, 'Yêu cầu bổ sung lần 2 phải thành công');

    // Nộp lại v3 qua POST (kiểm tra cả luồng POST resubmit bắt buộc có changeSummary)
    const postResubmitNoSummary = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: qaTicketId,
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        maCongViec: 'SDH.NV01.CV99',
        tenCongViec: '[QA] Thẩm định hồ sơ bảo vệ luận văn cao học\\nBước 1: Tiếp nhận hồ sơ\\nBước 2: Rà soát điều kiện học phần và công bố khoa học',
        maVtvl: 'SDH.CV01',
        sanPham: 'Hồ sơ thẩm định đủ điều kiện',
        chatLuong: 'Đúng quy chế đào tạo trình độ Thạc sĩ hiện hành',
        canCu: 'Quyết định 1907/QĐ-ĐHCNKT & Quy chế đào tạo Thạc sĩ',
        soSpNam: 15,
        phutThucTe: 150,
        gioBoSung: 12,
        nguonSoLieu: 'Hệ thống quản lý học vụ SĐH (01/10/2025 - 30/9/2026)',
        action: 'resubmit',
        changeSummary: '   '
      })
    }));
    assert.strictEqual(postResubmitNoSummary.status, 400, 'POST resubmit không có changeSummary phải bị chặn 400');

    const postResubmitV3 = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: qaTicketId,
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        maCongViec: 'SDH.NV01.CV99',
        tenCongViec: '[QA] Thẩm định hồ sơ bảo vệ luận văn cao học\\nBước 1: Tiếp nhận hồ sơ\\nBước 2: Rà soát điều kiện học phần và công bố khoa học',
        maVtvl: 'SDH.CV01',
        sanPham: 'Hồ sơ thẩm định đủ điều kiện',
        chatLuong: 'Đúng quy chế đào tạo trình độ Thạc sĩ hiện hành',
        canCu: 'Quyết định 1907/QĐ-ĐHCNKT & Quy chế đào tạo Thạc sĩ',
        soSpNam: 15,
        phutThucTe: 150,
        gioBoSung: 12,
        nguonSoLieu: 'Hệ thống quản lý học vụ SĐH (01/10/2025 - 30/9/2026)',
        coordinatedTasks: [
          {
            id: 'coord-qa-1',
            targetUnitCode: 'DT',
            targetUnitName: 'Phòng Đào tạo',
            targetTaskCode: 'DT.NV02',
            targetTaskName: 'Đối chiếu văn bằng đại học và chứng chỉ ngoại ngữ',
            note: 'Phối hợp tra cứu dữ liệu gốc'
          },
          {
            id: 'coord-qa-2',
            targetUnitCode: 'KHCN',
            targetUnitName: 'Phòng Khoa học Công nghệ',
            targetTaskCode: 'KHCN.NV01',
            targetTaskName: 'Xác nhận bài báo khoa học của học viên',
            note: 'Đối chiếu danh mục tạp chí'
          }
        ],
        action: 'resubmit',
        changeSummary: 'Cập nhật phutThucTe từ 120 lên 150 phút theo biên bản đo mẫu.'
      })
    }));
    assert.strictEqual(postResubmitV3.status, 200, 'Nộp lại lần 2 (v3) phải thành công');

    // Xóa cache trong bộ nhớ RAM và nạp lại từ đĩa để kiểm chứng tính bền vững sau khi reload
    resetTicketMemoryStore();
    const reloadAfterV3 = await getTickets(new NextRequest(\`http://localhost:3360/api/tickets?id=\${qaTicketId}\`, {
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh }
    }));
    assert.strictEqual(reloadAfterV3.status, 200);
    const reloadBody = await reloadAfterV3.json();
    assert.strictEqual(reloadBody.versions.length, 3, 'Sau khi xóa RAM và reload từ đĩa, phải có đủ 3 phiên bản v1, v2, v3');
    assert.strictEqual(reloadBody.versions[0].snapshot.soSpNam, 10, 'v1 giữ nguyên soSpNam = 10');
    assert.strictEqual(reloadBody.versions[1].snapshot.soSpNam, 15, 'v2 giữ nguyên soSpNam = 15, phutThucTe = 120');
    assert.strictEqual(reloadBody.versions[1].snapshot.phutThucTe, 120);
    assert.strictEqual(reloadBody.versions[2].snapshot.phutThucTe, 150, 'v3 lưu phutThucTe = 150');

    // Đối chiếu v3 vs v2: chỉ phutThucTe thay đổi (120 -> 150)
    const diffV3V2 = computeTicketVersionDiff(reloadBody.versions[1].snapshot, reloadBody.versions[2].snapshot);
    assert.strictEqual(diffV3V2.length, 1, 'Giữa v3 và v2 chỉ có đúng 1 trường thay đổi (phutThucTe)');
    assert.strictEqual(diffV3V2[0].fieldKey, 'phutThucTe');
    assert.strictEqual(diffV3V2[0].previousValue, '120');
    assert.strictEqual(diffV3V2[0].currentValue, '150');

    // Đối chiếu v3 vs v1: bao gồm cả thay đổi từ v2 và v3 (soSpNam 10 -> 15, phutThucTe 120 -> 150, maVtvlPhoiHop deleted...)
    const diffV3V1 = computeTicketVersionDiff(reloadBody.versions[0].snapshot, reloadBody.versions[2].snapshot);
    const mapV3V1 = new Map(diffV3V1.map((d: any) => [d.fieldKey, d]));
    assert.strictEqual(mapV3V1.get('soSpNam')?.previousValue, '10');
    assert.strictEqual(mapV3V1.get('soSpNam')?.currentValue, '15');
    assert.strictEqual(mapV3V1.get('phutThucTe')?.previousValue, '120');
    assert.strictEqual(mapV3V1.get('phutThucTe')?.currentValue, '150');
    assert.strictEqual(mapV3V1.get('maVtvlPhoiHop')?.changeType, 'deleted');
  });

  // CA 9C: Kiểm thử tương tranh Duyệt (approve) và Yêu cầu bổ sung (request_changes) cùng lúc + Rollback khi lỗi giữa chừng lúc gộp
  await runCase('E2E-09C', 'Tương tranh approve + request_changes đồng thời: chỉ 1 chuyển trạng thái hợp lệ được ghi nhận', async () => {
    const [raceApprove, raceReject] = await Promise.all([
      patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
        method: 'PATCH',
        headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: qaTicketId, action: 'approve', autoMerge: false })
      })),
      patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
        method: 'PATCH',
        headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: qaTicketId, action: 'request_changes', reason: 'Lệnh trả lại gửi đồng thời với lệnh duyệt' })
      }))
    ]);

    const statuses = [raceApprove.status, raceReject.status].sort();
    assert.deepStrictEqual(statuses, [200, 400], 'Khi approve và request_changes chạy song song, đúng 1 lệnh thành công (200) và 1 lệnh bị từ chối (400)');
  });

  // CA 10: Rollback khi lỗi giữa chừng lúc gộp & Gộp song song 2 luồng không tạo dòng trùng hay nhân đôi số giờ
  await runCase('E2E-10', 'Rollback khi lỗi giữa chừng lúc gộp (_simulateMergeFailure) & Gộp song song 2 luồng idempotent không nhân đôi giờ', async () => {
    // 1. Giả lập lỗi giữa chừng khi gộp -> bảng tính đơn vị và phiếu phải rollback nguyên trạng
    const wbBeforeFail = getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', 'minhhoavo73@gmail.com', 'Lãnh đạo đơn vị');
    const revBeforeFail = wbBeforeFail.currentRevision;

    const failMergeRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: qaTicketId, action: 'merge', _simulateMergeFailure: true })
    }));
    assert.ok(failMergeRes.status >= 500, 'Giả lập lỗi giữa chừng khi gộp phải trả lỗi 500');

    const wbAfterFail = getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', 'minhhoavo73@gmail.com', 'Lãnh đạo đơn vị');
    assert.strictEqual(wbAfterFail.currentRevision, revBeforeFail, 'Khi lỗi gộp giữa chừng, revision của bảng tính đơn vị phải được khôi phục');
    assert.strictEqual((wbAfterFail.data.A2 || []).filter((r: any) => r.sourceTicketId === qaTicketId).length, 0, 'Không có dòng A2 mồ côi khi lỗi gộp');

    // 2. Gộp song song 2 luồng cùng lúc (Promise.all)
    const [merge1Res, merge2Res] = await Promise.all([
      patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
        method: 'PATCH',
        headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: qaTicketId, action: 'merge' })
      })),
      patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
        method: 'PATCH',
        headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: qaTicketId, action: 'merge' })
      }))
    ]);
    assert.strictEqual(merge1Res.status, 200, 'Gộp song song luồng 1 phải thành công');
    assert.strictEqual(merge2Res.status, 200, 'Gộp song song luồng 2 phải trả về 200 OK idempotent');
    const merge1Data = await merge1Res.json();
    assert.strictEqual(merge1Data.ticket.a2RowId, \`a2-\${qaTicketId}\`, 'Phải ghi rõ a2RowId cho Biểu A2');
    assert.strictEqual(merge1Data.ticket.b1RowId, \`b1-\${qaTicketId}\`, 'Phải ghi rõ b1RowId cho Biểu B1');
    assert.strictEqual(merge1Data.ticket.b2RowId, undefined, 'Không có dữ liệu tác động B2 thì không được tự sinh b2RowId giả');

    // Kiểm tra số dòng trong Workbook SDH không bị nhân đôi (v3: 15 SP * 150 phút / 60 + 12 giờ = 37.5 + 12 = 49.5 giờ)
    const wbAfter = getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', 'minhhoavo73@gmail.com', 'Lãnh đạo đơn vị');
    const a2Rows = (wbAfter.data.A2 || []).filter((r: any) => r.sourceTicketId === qaTicketId);
    const b1Rows = (wbAfter.data.B1 || []).filter((r: any) => r.sourceTicketId === qaTicketId);
    assert.strictEqual(a2Rows.length, 1, 'Biểu A2 chỉ được có đúng 1 dòng từ phiếu đã gộp');
    assert.strictEqual(b1Rows.length, 1, 'Biểu B1 chỉ được có đúng 1 dòng từ phiếu đã gộp');
    assert.strictEqual(b1Rows[0].gioTong, 49.5, 'Dòng B1 sau khi gộp v3 phải tính đúng gioTong = 49.5 giờ (không bị nhân đôi)');

    // Kiểm tra liên kết gộp trong work_survey_merge_links
    const links = getTicketMergeLinks(qaTicketId);
    assert.strictEqual(links.length, 2, 'work_survey_merge_links phải có đúng 2 dòng liên kết (A2 và B1)');
    assert.ok(links.every(l => l.sourceVersion === 3), 'Mỗi liên kết gộp phải ghi rõ sourceVersion = 3');
  });

  // CA 10B: Hai tiến trình OS độc lập (2 child processes) gộp 2 phiếu khác nhau (cùng mã công việc) vào cùng 1 workbook + Người dùng sửa workbook lúc gộp (không ghi đè snapshot cũ)
  await runCase('E2E-10B', 'Đa tiến trình OS (2 tiến trình độc lập) gộp 2 phiếu cùng mã CV vào 1 workbook & chống ghi đè khi người dùng sửa workbook lúc gộp', async () => {
    await upsertUserAccount({
      email: 'qa.staff2.sdh@hcmute.edu.vn',
      displayName: 'QA Chuyên viên SĐH 2',
      unitCode: 'SDH',
      unitNameVi: 'Viện Sau Đại học',
      title: 'Chuyên viên',
      role: 'staff',
      authProvider: 'email',
      status: 'active',
      hasSelectedUnit: true
    }, true);
    const tokenStaff2Sdh = generateUserSessionToken({ email: 'qa.staff2.sdh@hcmute.edu.vn', role: 'staff', unitCode: 'SDH' });

    // Tạo phiếu thứ 2 của cán bộ thứ 2 nhưng CÙNG mã công việc SDH.NV01.CV99
    const createT2Res = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenStaff2Sdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        maCongViec: 'SDH.NV01.CV99',
        tenCongViec: '[QA-Cán bộ 2] Thẩm định hồ sơ bảo vệ luận văn cao học (Đợt 2)',
        maVtvl: 'SDH.CV01',
        sanPham: 'Hồ sơ thẩm định đợt 2',
        chatLuong: 'Đúng quy chế đào tạo',
        canCu: 'QĐ 1907/QĐ-ĐHCNKT',
        soSpNam: 8,
        phutThucTe: 60,
        gioBoSung: 2,
        nguonSoLieu: 'Hệ thống SĐH',
        action: 'submit',
        status: 'submitted'
      })
    }));
    assert.strictEqual(createT2Res.status, 200);
    const qaTicket2Id = (await createT2Res.json()).ticket.id;

    // Duyệt phiếu thứ 2
    const approveT2 = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: qaTicket2Id, action: 'approve' })
    }));
    assert.strictEqual(approveT2.status, 200);

    // 1. Khởi chạy 2 tiến trình OS độc lập (2 process riêng biệt) cùng gọi gộp qaTicketId và qaTicket2Id vào cùng workbook SDH
    const workerScript = path.join(process.cwd(), '.data', 'temp-merge-worker.ts');
    fs.writeFileSync(workerScript, \`
      import { mergeApprovedTicketToUnitWorkbook } from '../src/services/storage/server-ticket-merge';
      const ticketId = process.argv[2];
      mergeApprovedTicketToUnitWorkbook(ticketId, 'minhhoavo73@gmail.com')
        .then((res) => { console.log('OK:' + res.unitWorkbookRevision); process.exit(0); })
        .catch((err) => { console.error('ERR:' + err.message); process.exit(1); });
    \`, 'utf8');

    const runWorker = (tId: string) => new Promise<{ code: number; out: string }>((resolve) => {
      const child = spawn('npx', ['tsx', workerScript, tId], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'test', VTVL_ISOLATED_LOCAL_STORE: 'true' }
      });
      let out = '';
      child.stdout.on('data', (d) => { out += d.toString(); });
      child.stderr.on('data', (d) => { out += d.toString(); });
      child.on('close', (code) => resolve({ code: code ?? 1, out }));
    });

    try {
      const [w1, w2] = await Promise.all([runWorker(qaTicketId), runWorker(qaTicket2Id)]);
      assert.strictEqual(w1.code, 0, 'Tiến trình 1 gộp qaTicketId phải thành công: ' + w1.out);
      assert.strictEqual(w2.code, 0, 'Tiến trình 2 gộp qaTicket2Id phải thành công: ' + w2.out);
    } finally {
      if (fs.existsSync(workerScript)) fs.unlinkSync(workerScript);
    }

    // Xóa cache RAM để nạp lại từ đĩa sau khi 2 tiến trình con ghi xong
    resetWorkbookMemoryStore();
    resetTicketMemoryStore();
    const wbAfterMulti = getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', 'minhhoavo73@gmail.com', 'Lãnh đạo đơn vị');
    const a2T1 = (wbAfterMulti.data.A2 || []).find((r: any) => r.sourceTicketId === qaTicketId);
    const a2T2 = (wbAfterMulti.data.A2 || []).find((r: any) => r.sourceTicketId === qaTicket2Id);
    const b1T1 = (wbAfterMulti.data.B1 || []).find((r: any) => r.sourceTicketId === qaTicketId);
    const b1T2 = (wbAfterMulti.data.B1 || []).find((r: any) => r.sourceTicketId === qaTicket2Id);

    assert.ok(a2T1 && a2T2, 'Cả 2 phiếu (dù cùng mã công việc SDH.NV01.CV99) đều phải được giữ nguyên trong Biểu A2 sau khi gộp từ 2 tiến trình');
    assert.ok(b1T1 && b1T2, 'Cả 2 phiếu đều phải được giữ nguyên trong Biểu B1 mà không ghi đè mất kê khai của nhau');
    assert.strictEqual(b1T1.gioTong, 49.5, 'Giờ của Cán bộ 1 giữ đúng 49.5h');
    assert.strictEqual(b1T2.gioTong, 10, 'Giờ của Cán bộ 2 giữ đúng 10h (8 SP * 60p/60 + 2h)');

    // 2. Người dùng sửa workbook hợp lệ, sau đó một lệnh gộp bị lỗi giữa chừng (_simulateMergeFailure) -> KHÔNG ĐƯỢC khôi phục snapshot cũ đè mất cập nhật của người dùng
    const revBeforeUserEdit = wbAfterMulti.currentRevision;
    const customA1 = [...(wbAfterMulti.data.A1 || []), { id: 'a1-user-concurrent', maNhiemVu: 'SDH.NV99', tenNhiemVu: 'Nhiệm vụ do người dùng vừa cập nhật trực tiếp trên biểu' }];
    const userEditSaved = saveServerWorkbook({
      workbookId: wbAfterMulti.id,
      baseRevision: revBeforeUserEdit,
      data: { ...wbAfterMulti.data, A1: customA1 },
      actorEmail: 'minhhoavo73@gmail.com',
      changeSummary: 'Người dùng cập nhật Biểu A1',
      unitCode: 'SDH'
    });
    assert.strictEqual(userEditSaved.success, true, 'Cập nhật workbook với baseRevision hợp lệ phải thành công');

    // Gửi một cập nhật workbook với baseRevision cũ (stale) -> phải bị chặn conflict: true
    const staleUserEdit = saveServerWorkbook({
      workbookId: wbAfterMulti.id,
      baseRevision: revBeforeUserEdit, // đã cũ
      data: { ...wbAfterMulti.data, A1: [] },
      actorEmail: 'minhhoavo73@gmail.com',
      changeSummary: 'Cập nhật với baseRevision cũ',
      unitCode: 'SDH'
    });
    assert.strictEqual(staleUserEdit.conflict, true, 'Sửa workbook với baseRevision cũ phải bị từ chối conflict=true');

    // Chạy gộp lỗi (_simulateMergeFailure) ngay sau khi người dùng vừa cập nhật Biểu A1
    const failMergeAfterUserEdit = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: qaTicket2Id, action: 'merge', _simulateMergeFailure: true })
    }));
    assert.strictEqual(failMergeAfterUserEdit.status, 500);

    const wbCheckPreserved = getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', 'minhhoavo73@gmail.com', 'Lãnh đạo đơn vị');
    assert.ok(
      (wbCheckPreserved.data.A1 || []).some((r: any) => r.id === 'a1-user-concurrent'),
      'Khi gộp lỗi giữa chừng, cập nhật hợp lệ trước đó của người dùng trên Biểu A1 tuyệt đối không bị ghi đè mất'
    );
  });

  // CA 11: Kiểm thử chặn quyền Cán bộ (không sửa bảng tính, không duyệt phiếu, không quản trị tài khoản)
  await runCase('E2E-11', 'Cán bộ (hoavm / QTTHTT) bị chặn sửa bảng tính, duyệt phiếu và quản trị tài khoản', async () => {
    const editWbRes = await putWorkbook(new NextRequest(\`http://localhost:3360/api/workbooks/\${wbQtthtt.id}\`, {
      method: 'PUT',
      headers: { authorization: 'Bearer ' + tokenStaffQtthtt, 'content-type': 'application/json' },
      body: JSON.stringify({ data: { A1: [] } })
    }), { params: Promise.resolve({ id: wbQtthtt.id }) });
    assert.strictEqual(editWbRes.status, 403, 'Cán bộ sửa bảng tính phải bị chặn 403');

    const reviewRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenQaStaffSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: qaTicketId, action: 'approve' })
    }));
    assert.strictEqual(reviewRes.status, 403, 'Cán bộ duyệt phiếu phải bị chặn 403');

    const adminAccRes = await getAdminAccounts(new NextRequest('http://localhost:3360/api/admin/accounts', {
      headers: { authorization: 'Bearer ' + tokenStaffQtthtt }
    }));
    assert.strictEqual(adminAccRes.status, 403, 'Cán bộ truy cập quản trị tài khoản phải bị chặn 403');
  });

  // CA 12: Kiểm thử phân quyền Lãnh đạo (chặn truy cập khác đơn vị, chặn tự gán Đã duyệt khi tạo, cho phép bấm duyệt phiếu của mình sau khi nộp, chặn cấp Admin/sửa Admin/đổi đơn vị)
  await runCase('E2E-12', 'Lãnh đạo (SDH) bị chặn truy cập QTTHTT, chặn tạo thẳng Đã duyệt, được bấm duyệt phiếu của mình, chặn cấp Admin/sửa Admin/đổi đơn vị', async () => {
    // 1. Truy cập chéo sang QTTHTT
    const crossWbRes = await getWorkbookById(new NextRequest(\`http://localhost:3360/api/workbooks/\${wbQtthtt.id}\`, {
      headers: { authorization: 'Bearer ' + tokenLeaderSdh }
    }), { params: Promise.resolve({ id: wbQtthtt.id }) });
    assert.strictEqual(crossWbRes.status, 403, 'Lãnh đạo SDH không được đọc workbook của QTTHTT');

    const crossTicketsRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=QTTHTT', {
      headers: { authorization: 'Bearer ' + tokenLeaderSdh }
    }));
    assert.strictEqual(crossTicketsRes.status, 403, 'Lãnh đạo SDH không được đọc danh sách phiếu của QTTHTT');

    // 2. Lãnh đạo không được tạo thẳng trạng thái Đã duyệt -> phải nộp rồi bấm phê duyệt phiếu của chính mình
    const directApproveRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        tenCongViec: '[QA] Phiếu gán thẳng Đã duyệt',
        maVtvl: 'SDH.QL01',
        sanPham: 'Kế hoạch năm học',
        chatLuong: 'Đạt chuẩn',
        canCu: 'QĐ 1907',
        soSpNam: 2,
        phutThucTe: 240,
        gioBoSung: 0,
        nguonSoLieu: 'Báo cáo tổng kết',
        status: 'approved'
      })
    }));
    assert.strictEqual(directApproveRes.status, 403, 'Khai phiếu không được phép tự gán thẳng trạng thái Đã duyệt');
    assert.strictEqual((await directApproveRes.json()).code, 'FORBIDDEN_DIRECT_APPROVAL');

    const leaderCreateRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'SDH',
        maNhiemVu: 'SDH.NV01',
        tenCongViec: '[QA] Phiếu công việc của Lãnh đạo Khoa SĐH',
        maVtvl: 'SDH.QL01',
        sanPham: 'Kế hoạch năm học',
        chatLuong: 'Đạt chuẩn',
        canCu: 'QĐ 1907',
        soSpNam: 2,
        phutThucTe: 240,
        gioBoSung: 0,
        nguonSoLieu: 'Báo cáo tổng kết',
        status: 'submitted'
      })
    }));
    assert.strictEqual(leaderCreateRes.status, 200);
    const createdLeaderTicket = (await leaderCreateRes.json()).ticket;
    assert.strictEqual(createdLeaderTicket.status, 'Đã nộp', 'Phiếu Lãnh đạo vừa khai phải ở trạng thái Đã nộp, không tự duyệt');

    const selfApproveRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: createdLeaderTicket.id, action: 'approve' })
    }));
    assert.strictEqual(selfApproveRes.status, 200, 'Lãnh đạo đơn vị phải được bấm phê duyệt phiếu do chính mình khai');
    assert.strictEqual((await selfApproveRes.json()).ticket.status, 'Đã duyệt');

    // 3. Lãnh đạo thử cấp quyền Admin, sửa Admin, chuyển đơn vị tài khoản
    const grantAdminRes = await postAdminAccount(new NextRequest('http://localhost:3360/api/admin/accounts', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'new.admin@hcmute.edu.vn', displayName: 'New Admin', unitCode: 'SDH', role: 'admin' })
    }));
    assert.strictEqual(grantAdminRes.status, 403, 'Lãnh đạo không được cấp quyền Admin');
    assert.strictEqual((await grantAdminRes.json()).code, 'FORBIDDEN_GRANT_ADMIN');

    const editAdminRes = await patchAdminAccount(new NextRequest('http://localhost:3360/api/admin/accounts', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'tcns@hcmute.edu.vn', status: 'suspended' })
    }));
    assert.strictEqual(editAdminRes.status, 403, 'Lãnh đạo không được sửa/khóa tài khoản Admin');

    const moveUnitRes = await patchAdminAccount(new NextRequest('http://localhost:3360/api/admin/accounts', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'qa.staff.sdh@hcmute.edu.vn', unitCode: 'QTTHTT' })
    }));
    assert.strictEqual(moveUnitRes.status, 403, 'Lãnh đạo không được chuyển tài khoản sang đơn vị khác');
    assert.strictEqual((await moveUnitRes.json()).code, 'FORBIDDEN_CHANGE_UNIT');
  });

  // CA 13: Kiểm thử lỗi thiếu schema trả về DATABASE_SCHEMA_OUTDATED & Audit Log tự động lọc mật khẩu/token
  await runCase('E2E-13', 'Báo lỗi rõ DATABASE_SCHEMA_OUTDATED khi thiếu schema & Audit Log không lưu mật khẩu/token', async () => {
    const schemaErr = createSchemaOrDbError(
      'staff_work_tickets',
      500,
      JSON.stringify({ code: '42703', message: 'column "current_version_no" of relation "staff_work_tickets" does not exist' })
    );
    assert.strictEqual(schemaErr.code, 'DATABASE_SCHEMA_OUTDATED', 'Lỗi PostgreSQL 42703 phải ánh xạ thành DATABASE_SCHEMA_OUTDATED');

    const logs = getAuditLogs();
    assert.ok(logs.length >= 5, 'Phải có đầy đủ bản ghi audit log cho các thao tác vừa thực hiện');
    const serializedLogs = JSON.stringify(logs);
    assert.ok(!serializedLogs.includes('passwordHash'), 'Audit log không được chứa passwordHash');
  });

  // CA 14: Kiểm thử quy tắc baseline chuyển đổi dữ liệu cho phiếu cũ đã nộp chưa có v1
  await runCase('E2E-14', 'Phiếu cũ đã nộp chưa có v1 được tạo baseline "Bản ghi chuyển đổi dữ liệu", không bịa ngày nộp/người nộp', async () => {
    const legacyTicket: any = {
      id: 'tkt-QTTHTT-legacy-001',
      unitCode: 'QTTHTT',
      ownerEmail: 'hoavm@hcmute.edu.vn',
      ownerName: 'Võ Minh Hòa',
      ownerTitle: 'Chuyên viên',
      maNhiemVu: 'QTTHTT.NV01',
      maCongViec: 'QTTHTT.NV01.CV01',
      tenCongViec: 'Quản trị cổng thông tin điện tử HCM-UTE',
      maVtvl: 'QTTHTT.CV01',
      sanPham: 'Bản tin truyền thông',
      chatLuong: 'Đúng chuẩn thương hiệu HCM-UTE',
      canCu: 'QĐ 1907',
      soSpNam: 50,
      phutThucTe: 60,
      gioBoSung: 0,
      nguonSoLieu: 'Thống kê CMS',
      status: 'Đã nộp',
      coordinatedTasks: [],
      createdAt: '2026-11-10T08:00:00.000Z',
      updatedAt: '2026-11-10T08:00:00.000Z'
      // Cố tình không có submittedAt
    };

    const legacyVersions = ensureLegacyBaselineVersion(legacyTicket);
    assert.strictEqual(legacyVersions.length, 1, 'Phiếu legacy đã nộp phải có 1 bản ghi baseline');
    assert.strictEqual(legacyVersions[0].versionNo, 1);
    assert.strictEqual(legacyVersions[0].changeSummary, 'Bản ghi chuyển đổi dữ liệu');
    assert.strictEqual(legacyVersions[0].isMigrationBaseline, true);
    assert.strictEqual(legacyVersions[0].submittedAt, null, 'Không được tự suy đoán/bịa thời điểm nộp khi dữ liệu gốc không có');
    assert.strictEqual(legacyVersions[0].submittedBy, '', 'Không được tự suy đoán người nộp khi dữ liệu lịch sử không có căn cứ');
  });

  // CA 15: Kiểm thử cờ dữ liệu thử (isTestData / isArchived) bằng dữ liệu QA cô lập
  await runCase('E2E-15', 'Cờ dữ liệu thử (isTestData) loại bỏ phiếu thử khỏi thống kê Dashboard, danh sách đơn vị, cấp mã CV và chặn gộp biểu', async () => {
    const countsBefore = getTicketCounts();
    const store = loadTickets();
    const testTicketId = 'tkt-CK-qa-test-flag-01';
    store.set(testTicketId, {
      id: testTicketId,
      unitCode: 'CK',
      ownerEmail: 'hoavm@hcmute.edu.vn',
      ownerName: 'Vo Minh Hoa',
      ownerTitle: 'Chuyên viên',
      status: 'Đã duyệt',
      maNhiemVu: 'CK.NV01',
      maCongViec: 'CK.NV01.CV88',
      tenCongViec: '[QA Test Flag] Phiếu thử nghiệm có gắn cờ isTestData',
      maVtvl: 'CK.GV01',
      sanPham: 'Test',
      chatLuong: 'Test',
      canCu: 'Test',
      soSpNam: 10,
      phutThucTe: 60,
      gioBoSung: 0,
      nguonSoLieu: 'Test',
      isTestData: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    persistTickets();

    const countsAfter = getTicketCounts();
    assert.strictEqual(countsAfter.total, countsBefore.total, 'Phiếu gắn cờ isTestData=true không được cộng vào tổng số phiếu trên Dashboard');
    assert.strictEqual(countsAfter.approved, countsBefore.approved, 'Phiếu gắn cờ isTestData=true không được cộng vào số phiếu Đã duyệt trên Dashboard');

    const unitCkActiveTickets = getTicketsByUnit('CK', false);
    assert.ok(!unitCkActiveTickets.some(t => t.id === testTicketId), 'getTicketsByUnit mặc định phải loại bỏ phiếu có isTestData=true khỏi danh sách rà soát của đơn vị');

    const nextCode = allocateNextTaskCode('CK', 'CK.NV01', [], Array.from(store.values()));
    assert.strictEqual(nextCode, 'CK.NV01.CV89', 'allocateNextTaskCode vẫn phải giữ mã đã sử dụng (CV88) để không cấp trùng lại mã cũ khi phiếu thử còn tồn tại');

    const mergeTestFlagRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokenAdmin, 'content-type': 'application/json' },
      body: JSON.stringify({ ticketId: testTicketId, action: 'merge' })
    }));
    assert.strictEqual(mergeTestFlagRes.status, 400, 'Gộp phiếu có cờ isTestData=true phải bị chặn 400 FORBIDDEN_TEST_OR_ARCHIVED_MERGE');
    assert.strictEqual((await mergeTestFlagRes.json()).code, 'FORBIDDEN_TEST_OR_ARCHIVED_MERGE');

    store.delete(testTicketId);
    persistTickets();
  });

  console.log('----------------------------------------------------------------');
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  console.log(\` TỔNG KẾT E2E VERSIONING & LIFECYCLE: \${passCount} PASS, \${failCount} FAIL\`);
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Lỗi thực thi E2E runner:', err);
  process.exit(1);
});
`;

fs.writeFileSync(runnerScriptPath, runnerSource, 'utf8');

try {
  const run = spawnSync('npx', ['tsx', runnerScriptPath], {
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
  assert.strictEqual(run.status, 0, `Bộ kiểm thử tích hợp E2E kết thúc với mã lỗi ${run.status}`);
} finally {
  if (fs.existsSync(runnerScriptPath)) {
    fs.unlinkSync(runnerScriptPath);
  }
  // Khôi phục nguyên trạng 100% dữ liệu trong .data
  for (const [fileName, content] of backups.entries()) {
    const fullPath = path.join(dataDir, fileName);
    if (content !== null) {
      fs.writeFileSync(fullPath, content, 'utf8');
    } else if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}
