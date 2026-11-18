import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const dataDir = path.join(root, '.data');
const reportsDir = path.join(root, 'reports');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

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
  const benchRunner = path.join(dataDir, '_tmp_bench_runner.ts');
  fs.writeFileSync(
    benchRunner,
    `
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { NextRequest } from 'next/server';
import { GET as getTickets, POST as postTicket } from '../src/app/api/tickets/route';
import { GET as getAdminOverview } from '../src/app/api/admin/overview/route';
import { POST as postReconcile } from '../src/app/api/tickets/reconcile/route';
import { generateUserSessionToken } from '../src/services/storage/server-auth-guard';
import { upsertUserAccount } from '../src/services/storage/server-account-store';
import { loadTickets, enrichTicket, resetTicketMemoryStore } from '../src/services/storage/server-ticket-store';
import { commitAllSurveyVersionsSnapshot } from '../src/services/storage/server-ticket-version-store';
import { getOrCreateWorkbook, resetWorkbookMemoryStore } from '../src/services/storage/server-workbook-store';
import { clearAllRuntimeCache } from '../src/services/storage/runtime-cache';
import { bumpMissionCounterWatermark } from '../src/services/storage/server-mission-counter';
import { setDbTestHook } from '../src/services/storage/prisma';
import { getActiveHcmuteUnits } from '../src/configs/hcmute-units';
import { StaffWorkTicket, WorkSurveyVersion } from '../src/types/staff-ticket';

function calcStats(samples: number[], totalWallMs: number, errorCount: number) {
  const sorted = [...samples].sort((a, b) => a - b);
  const pick = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] || 0;
  const totalReqs = samples.length;
  const rps = totalWallMs > 0 ? Number(((totalReqs / totalWallMs) * 1000).toFixed(1)) : 0;
  const errorRatePct = totalReqs > 0 ? Number(((errorCount / totalReqs) * 100).toFixed(2)) : 0;
  return {
    requests: totalReqs,
    errors: errorCount,
    errorRatePct,
    wallTimeMs: Number(totalWallMs.toFixed(2)),
    throughputRps: rps,
    p50: Number(pick(50).toFixed(2)),
    p95: Number(pick(95).toFixed(2)),
    p99: Number(pick(99).toFixed(2))
  };
}

async function main() {
  resetWorkbookMemoryStore();
  resetTicketMemoryStore();
  clearAllRuntimeCache();

  // Kích hoạt chế độ cô lập 100% trên RAM (không chạm PostgreSQL Production và tắt ghi JSON đồng bộ ra đĩa)
  process.env.VTVL_ISOLATED_LOCAL_STORE = 'true';
  process.env.VTVL_BENCHMARK_MEMORY_ONLY = 'true';

  await upsertUserAccount({
    email: 'tcns@hcmute.edu.vn', displayName: 'Quản trị TCNS', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Quản trị viên', role: 'admin',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'leader.cntt@hcmute.edu.vn', displayName: 'Trưởng khoa CNTT', unitCode: 'CNTT',
    unitNameVi: 'Khoa Công nghệ thông tin', title: 'Lãnh đạo đơn vị', role: 'unit_leader',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);

  const tokAdmin = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
  const tokLeaderCntt = generateUserSessionToken({ email: 'leader.cntt@hcmute.edu.vn', role: 'unit_leader', unitCode: 'CNTT' });

  // 0. Tạo dữ liệu giả lập: 20.000 phiếu công việc (Đã duyệt, chờ gộp) & 100.000 phiên bản (5 versions/phiếu) trên 39 đơn vị
  const seedT0 = performance.now();
  const units = getActiveHcmuteUnits();
  const store = loadTickets();
  store.clear();
  const versionsMap: Record<string, WorkSurveyVersion[]> = {};
  const baseTs = Date.now() - 86400_000;
  const expectedPerUnit = new Map<string, Set<string>>();

  for (const u of units) {
    const wb = getOrCreateWorkbook(u.code, '01/10/2025–30/9/2026', 'tcns@hcmute.edu.vn', 'Quản trị viên');
    wb.data.A2 = [];
    wb.data.B1 = [];
    expectedPerUnit.set(u.code, new Set());
  }

  for (let i = 1; i <= 20000; i++) {
    const u = units[(i - 1) % units.length];
    const id = \`tkt-bench-\${u.code}-\${i}\`;
    const updatedIso = new Date(baseTs + i * 10).toISOString();
    const taskCode = \`\${u.code}.NV01.CV\${String(i).padStart(5, '0')}\`;

    const ticket: StaffWorkTicket = {
      id, unitCode: u.code, unitId: u.code,
      ownerEmail: \`cb\${(i % 25) + 1}.\${u.code.toLowerCase()}@hcmute.edu.vn\`,
      ownerName: \`Cán bộ \${(i % 25) + 1}\`, ownerTitle: 'Giảng viên',
      status: 'Đã duyệt', maNhiemVu: \`\${u.code}.NV01\`, maCongViec: taskCode,
      tenCongViec: \`Nhiệm vụ chuyên môn kiểm định và đào tạo chuẩn HCM-UTE #\${i}\`,
      maVtvl: \`\${u.code}.GV01\`, sanPham: 'Hồ sơ nghiệm thu', chatLuong: 'Đạt chuẩn ISO',
      canCu: 'Quyết định 2266/QĐ-ĐHCNKT', soSpNam: 10, nguonSoLieu: 'Hệ thống', phutThucTe: 60, gioBoSung: 2,
      approvedBy: \`leader.\${u.code.toLowerCase()}@hcmute.edu.vn\`, approvedAt: updatedIso,
      isMergedToB1B2: false, currentVersionNo: 5,
      statusHistory: [
        { id: \`h1-\${i}\`, surveyId: id, fromStatus: 'draft', toStatus: 'submitted', action: 'SUBMIT', actorId: 'cb@hcmute.edu.vn', actorRole: 'staff', unitId: u.code, createdAt: updatedIso },
        { id: \`h2-\${i}\`, surveyId: id, fromStatus: 'submitted', toStatus: 'approved', action: 'APPROVE', actorId: 'ld@hcmute.edu.vn', actorRole: 'unit_leader', unitId: u.code, createdAt: updatedIso }
      ],
      createdAt: updatedIso, updatedAt: updatedIso
    };
    store.set(id, ticket);
    expectedPerUnit.get(u.code)!.add(id);

    const snap = {
      unitCode: u.code, ownerName: ticket.ownerName, ownerTitle: ticket.ownerTitle,
      maNhiemVu: ticket.maNhiemVu, maCongViec: taskCode, tenCongViec: ticket.tenCongViec,
      maVtvl: ticket.maVtvl, sanPham: ticket.sanPham, chatLuong: ticket.chatLuong,
      canCu: ticket.canCu, soSpNam: 10, nguonSoLieu: 'Hệ thống', phutThucTe: 60, gioBoSung: 2, coordinatedTasks: []
    };
    versionsMap[id] = [
      { id: \`v1-\${i}\`, surveyId: id, versionNo: 1, snapshot: snap, submittedBy: ticket.ownerEmail, submittedAt: updatedIso },
      { id: \`v2-\${i}\`, surveyId: id, versionNo: 2, snapshot: snap, submittedBy: ticket.ownerEmail, submittedAt: updatedIso },
      { id: \`v3-\${i}\`, surveyId: id, versionNo: 3, snapshot: snap, submittedBy: ticket.ownerEmail, submittedAt: updatedIso },
      { id: \`v4-\${i}\`, surveyId: id, versionNo: 4, snapshot: snap, submittedBy: ticket.ownerEmail, submittedAt: updatedIso },
      { id: \`v5-\${i}\`, surveyId: id, versionNo: 5, snapshot: snap, submittedBy: ticket.ownerEmail, submittedAt: updatedIso }
    ];
    bumpMissionCounterWatermark(u.code, ticket.maNhiemVu, taskCode);
  }
  commitAllSurveyVersionsSnapshot(versionsMap);
  const seedDurationMs = Number((performance.now() - seedT0).toFixed(2));

  // 1. Đo BEFORE (Tải toàn bộ ~513 phiếu của 1 đơn vị kèm 5 versions/phiếu) vs AFTER (Cursor Pagination limit=50 + List DTO nhẹ)
  const beforeListSamples: number[] = [];
  let beforeListPayloadBytes = 0;
  const beforeT0 = performance.now();
  for (let r = 0; r < 30; r++) {
    const t0 = performance.now();
    const rawUnit = Array.from(store.values()).filter((t) => t.unitCode === 'CNTT').map(enrichTicket);
    const json = JSON.stringify({ unitTickets: rawUnit });
    beforeListPayloadBytes = Buffer.byteLength(json, 'utf8');
    beforeListSamples.push(performance.now() - t0);
  }
  const beforeWallMs = performance.now() - beforeT0;

  const afterListSamples: number[] = [];
  let afterListPayloadBytes = 0;
  let afterListErrors = 0;
  const afterT0 = performance.now();
  // Chạy 200 request phân trang (4 đợt × 50 request đồng thời)
  for (let batch = 0; batch < 4; batch++) {
    await Promise.all(
      Array.from({ length: 50 }, async () => {
        const t0 = performance.now();
        const res = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=CNTT&view=list&limit=50', {
          headers: { authorization: 'Bearer ' + tokLeaderCntt }
        }));
        if (res.status !== 200) afterListErrors++;
        const text = await res.text();
        afterListPayloadBytes = Buffer.byteLength(text, 'utf8');
        afterListSamples.push(performance.now() - t0);
      })
    );
  }
  const afterWallMs = performance.now() - afterT0;

  // 2. Đo Dashboard Overview (200 request đồng thời trên 20.000 phiếu / 39 đơn vị)
  const overviewSamples: number[] = [];
  let overviewPayloadBytes = 0;
  let overviewErrors = 0;
  const ovT0 = performance.now();
  await Promise.all(
    Array.from({ length: 200 }, async () => {
      const t0 = performance.now();
      const res = await getAdminOverview(new NextRequest('http://localhost:3360/api/admin/overview?unitCode=ALL', {
        headers: { authorization: 'Bearer ' + tokAdmin }
      }));
      if (res.status !== 200) overviewErrors++;
      const txt = await res.text();
      overviewPayloadBytes = Buffer.byteLength(txt, 'utf8');
      overviewSamples.push(performance.now() - t0);
    })
  );
  const ovWallMs = performance.now() - ovT0;

  // 3. KỊCH BẢN TRỌNG TÂM: 39 ĐƠN VỊ ĐỒNG THỜI GỘP TOÀN BỘ 20.000 PHIẾU (Burst Reconcile 39 Units)
  const reconcileUnitSamples: number[] = [];
  let reconcileErrors = 0;
  let totalMergedTickets = 0;
  let totalFormulaRuns = 0;
  let totalWorkbookWrites = 0;

  const burstT0 = performance.now();
  await Promise.all(
    units.map(async (u) => {
      const uT0 = performance.now();
      const res = await postReconcile(new NextRequest('http://localhost:3360/api/tickets/reconcile', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
        body: JSON.stringify({ unitCode: u.code })
      }));
      const elapsed = performance.now() - uT0;
      reconcileUnitSamples.push(elapsed);
      if (res.status !== 200) {
        reconcileErrors++;
        return;
      }
      const body = await res.json();
      totalMergedTickets += Number(body.mergedCount) || 0;
      totalFormulaRuns += Number(body.formulaRuns) || 0;
      totalWorkbookWrites += Number(body.workbookWrites) || 0;
    })
  );
  const burstWallMs = performance.now() - burstT0;

  // Kiểm tra toàn vẹn dữ liệu sau khi 39 đơn vị cùng gộp 20.000 phiếu:
  let totalA2RowsAfterMerge = 0;
  let totalB1RowsAfterMerge = 0;
  let missingTicketsCount = 0;
  let duplicateA2RowsCount = 0;
  let duplicateB1RowsCount = 0;
  let duplicateTaskCodesCount = 0;
  let unflaggedTicketsCount = 0;

  for (const u of units) {
    const wb = getOrCreateWorkbook(u.code);
    const a2 = wb.data.A2 || [];
    const b1 = wb.data.B1 || [];
    totalA2RowsAfterMerge += a2.length;
    totalB1RowsAfterMerge += b1.length;

    const a2TicketIds = new Set<string>();
    const a2TaskCodes = new Set<string>();
    for (const r of a2) {
      const sid = String(r.sourceTicketId || '').trim();
      const code = String(r.maCongViec || '').trim();
      if (sid) {
        if (a2TicketIds.has(sid)) duplicateA2RowsCount++;
        a2TicketIds.add(sid);
      }
      if (code) {
        if (a2TaskCodes.has(code)) duplicateTaskCodesCount++;
        a2TaskCodes.add(code);
      }
    }

    const b1TicketIds = new Set<string>();
    for (const r of b1) {
      const sid = String(r.sourceTicketId || '').trim();
      if (sid) {
        if (b1TicketIds.has(sid)) duplicateB1RowsCount++;
        b1TicketIds.add(sid);
      }
    }

    const expectedSet = expectedPerUnit.get(u.code)!;
    for (const expectedId of expectedSet) {
      if (!a2TicketIds.has(expectedId) || !b1TicketIds.has(expectedId)) {
        missingTicketsCount++;
      }
      const tInStore = store.get(expectedId);
      if (!tInStore?.isMergedToB1B2) {
        unflaggedTicketsCount++;
      }
    }
  }

  // 4. Đo Cấp mã nguyên tử & Tạo 100 phiếu mới đồng thời trên 39 đơn vị (sau khi đã có 20.000 phiếu & 100.000 versions)
  const createSamples: number[] = [];
  let createErrors = 0;
  const createdTaskCodes = new Set<string>();
  let duplicateCreatedCodes = 0;
  const createT0 = performance.now();
  await Promise.all(
    Array.from({ length: 100 }, async (_, idx) => {
      const u = units[idx % units.length];
      const t0 = performance.now();
      const res = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
        body: JSON.stringify({
          unitCode: u.code, action: 'draft', status: 'Nháp',
          maNhiemVu: \`\${u.code}.NV02\`, tenCongViec: 'Tạo phiếu tải cao #' + idx, maVtvl: \`\${u.code}.GV01\`,
          sanPham: 'Hồ sơ', chatLuong: 'Đạt', canCu: 'QĐ', soSpNam: 5, nguonSoLieu: 'HT', phutThucTe: 45
        })
      }));
      createSamples.push(performance.now() - t0);
      if (res.status !== 200) {
        createErrors++;
        return;
      }
      const body = await res.json();
      const key = \`\${body.ticket.unitCode}::\${body.ticket.maCongViec}\`;
      if (createdTaskCodes.has(key)) duplicateCreatedCodes++;
      createdTaskCodes.add(key);
    })
  );
  const createWallMs = performance.now() - createT0;

  const summary = {
    timestamp: new Date().toISOString(),
    environment: 'Isolated Synthetic Benchmark (Production DB Mode Simulated — 0 Disk JSON Writes, 0 Production Impact)',
    dataset: {
      activeUnits: units.length,
      totalTickets: 20000,
      versionsPerTicket: 5,
      totalVersions: 100000,
      totalStatusHistory: 40000,
      seedDurationMs
    },
    beforeListFullUnit: {
      ...calcStats(beforeListSamples, beforeWallMs, 0),
      payloadBytes: beforeListPayloadBytes
    },
    afterListCursor50: {
      ...calcStats(afterListSamples, afterWallMs, afterListErrors),
      payloadBytes: afterListPayloadBytes
    },
    adminOverview200Concurrent: {
      ...calcStats(overviewSamples, ovWallMs, overviewErrors),
      payloadBytes: overviewPayloadBytes
    },
    concurrentCreate100Across39Units: {
      ...calcStats(createSamples, createWallMs, createErrors),
      uniqueCreatedCodes: createdTaskCodes.size,
      duplicateCreatedCodes
    },
    burst39UnitsMerge20000Tickets: {
      ...calcStats(reconcileUnitSamples, burstWallMs, reconcileErrors),
      unitsParticipated: units.length,
      totalMergedTickets,
      ticketsMergedPerSecond: Number(((totalMergedTickets / burstWallMs) * 1000).toFixed(1)),
      totalFormulaRuns,
      totalWorkbookWrites,
      postMergeIntegrityAudit: {
        expectedTickets: 20000,
        totalA2RowsAfterMerge,
        totalB1RowsAfterMerge,
        missingTicketsCount,
        duplicateA2RowsCount,
        duplicateB1RowsCount,
        duplicateTaskCodesCount,
        unflaggedTicketsCount,
        integrityPassed:
          totalMergedTickets === 20000 &&
          totalA2RowsAfterMerge === 20000 &&
          totalB1RowsAfterMerge === 20000 &&
          missingTicketsCount === 0 &&
          duplicateA2RowsCount === 0 &&
          duplicateB1RowsCount === 0 &&
          duplicateTaskCodesCount === 0 &&
          unflaggedTicketsCount === 0
      }
    }
  };

  const jsonReportPath = path.join(process.cwd(), 'reports', 'vtvl-benchmark-20k-100k-39units.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
`,
    'utf8'
  );

  try {
    execSync(`npx tsx "${benchRunner}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'inherit'
    });
  } finally {
    if (fs.existsSync(benchRunner)) fs.unlinkSync(benchRunner);
  }
} finally {
  for (const [p, content] of backups.entries()) {
    if (content === null) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } else {
      fs.writeFileSync(p, content, 'utf8');
    }
  }
}
