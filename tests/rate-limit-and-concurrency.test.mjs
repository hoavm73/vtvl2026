import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

const root = process.cwd();
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vtvl-rl-test-'));
const runnerPath = path.join(root, '.data', '_tmp_rl_concurrency_runner.ts');

console.log('\n================================================================');
console.log(' KIỂM THỬ RATE LIMIT, STREAM PAYLOAD, LOCK & CACHE PHỐI HỢP');
console.log('================================================================\n');

try {
  fs.mkdirSync(path.dirname(runnerPath), { recursive: true });
  fs.writeFileSync(
    runnerPath,
    `
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { NextRequest } from 'next/server';
import {
  extractClientIp,
  checkDirectRateKey,
  recordDirectFailure,
  getAuthRateLimiterStats,
  resetAllRateLimits
} from '../src/services/auth/rate-limiter';
import { readBoundedJsonBody } from '../src/services/auth/payload-limiter';
import { resetApiRateLimits } from '../src/services/auth/api-rate-limiter';
import {
  withCrossProcessLock,
  getLockTelemetry,
  resetLockTelemetry,
  registerCacheInvalidator,
  invalidateAllLocalCaches
} from '../src/services/storage/server-file-lock';
import { withHeavyMutationBudget, resetHeavyGateMetrics } from '../src/services/storage/heavy-mutation-gate';
import { setDbTestHook } from '../src/services/storage/prisma';
import { GET as getHealthLive, HEAD as headHealthLive } from '../src/app/api/health/live/route';
import { GET as getHealthReady, HEAD as headHealthReady } from '../src/app/api/health/ready/route';
import { POST as postLogin } from '../src/app/api/auth/login/route';
import { POST as postAdminAuth } from '../src/app/api/admin/auth/route';
import { POST as postC1Lock } from '../src/app/api/admin/c1-lock/route';
import { POST as postTicket, PATCH as patchTicket } from '../src/app/api/tickets/route';
import { PUT as putWorkbook } from '../src/app/api/workbooks/[id]/route';
import { GET as getCoordinated } from '../src/app/api/tickets/coordinated/route';
import { upsertUserAccount, resetAccountMemoryStore, syncAccountsFromSupabase } from '../src/services/storage/server-account-store';
import { hashAccountPassword } from '../src/services/storage/account-crypto';
import { generateUserSessionToken, getCallerSession } from '../src/services/storage/server-auth-guard';
import { upsertTicketAndSyncUnit, resetTicketMemoryStore, getTicketById, loadTickets, bumpTicketMutationWatermark } from '../src/services/storage/server-ticket-store';
import { assertAuthoritativeRemoteTickets, mergeRemoteTicketsIntoStore } from '../src/services/storage/server-ticket-history-db';
import { getOrCreateWorkbook, getAllActiveServerWorkbooks } from '../src/services/storage/server-workbook-store';
import { createImmutableSurveyVersion } from '../src/services/storage/server-ticket-version-store';
import { syncSubmittedCoordinationProjection } from '../src/services/tickets/vtvl-coordination-service';
import { setAssignmentsForAccount } from '../src/services/storage/server-vtvl-assignment-store';
import { clearAllRuntimeCache } from '../src/services/storage/runtime-cache';

function buildChunkedStreamReq(url: string, chunks: string[], headers: Record<string, string>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      for (const c of chunks) ctrl.enqueue(enc.encode(c));
      ctrl.close();
    }
  });
  return new NextRequest(url, { method: 'POST', headers, body: stream, duplex: 'half' } as any);
}

async function main() {
  resetAllRateLimits();
  resetApiRateLimits();
  resetLockTelemetry();
  resetHeavyGateMetrics();
  clearAllRuntimeCache();

  // (a) Trusted Proxy & IP Extraction
  assert.strictEqual(extractClientIp(new Request('http://x', { headers: { 'x-real-ip': '203.162.1.5', 'x-forwarded-for': '1.2.3.4, 203.162.1.5' } })), '203.162.1.5');
  assert.strictEqual(extractClientIp(new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9, 198.51.100.77' } })), '198.51.100.77');
  process.env.VTVL_TRUST_PROXY = 'none';
  assert.strictEqual(extractClientIp(new Request('http://x', { headers: { 'x-real-ip': '203.162.1.5' } })), 'direct-unproxied');
  process.env.VTVL_TRUST_PROXY = 'legacy';
  assert.strictEqual(extractClientIp(new Request('http://x', { headers: { 'x-forwarded-for': '9.9.9.9, 198.51.100.77', 'x-real-ip': '203.162.1.5' } })), '9.9.9.9');
  process.env.VTVL_TRUST_PROXY = 'nginx';
  console.log('  ✓ [PASS] (a) extractClientIp ưu tiên X-Real-IP, chặn XFF[0] spoof, hỗ trợ none/legacy');

  // Seed fake test accounts
  invalidateAllLocalCaches();
  resetTicketMemoryStore();
  await upsertUserAccount({ email: 'u1.rl@hcmute.edu.vn', displayName: 'U1', unitCode: 'CNTT', role: 'staff', passwordHash: hashAccountPassword('Pw1@2026'), hasSelectedUnit: true }, true);
  await upsertUserAccount({ email: 'u2.rl@hcmute.edu.vn', displayName: 'U2', unitCode: 'CNTT', role: 'staff', passwordHash: hashAccountPassword('Pw2@2026'), hasSelectedUnit: true }, true);
  await upsertUserAccount({ email: 'ld1.rl@hcmute.edu.vn', displayName: 'LD1', unitCode: 'CNTT', role: 'unit_leader', passwordHash: hashAccountPassword('Ld1@2026'), hasSelectedUnit: true }, true);
  await upsertUserAccount({ email: 'ld2.rl@hcmute.edu.vn', displayName: 'LD2', unitCode: 'CK', role: 'unit_leader', passwordHash: hashAccountPassword('Ld2@2026'), hasSelectedUnit: true }, true);
  await upsertUserAccount({ email: 'tcns@hcmute.edu.vn', displayName: 'TCNS', unitCode: 'TCNS', role: 'admin', passwordHash: hashAccountPassword('fake-rl-admin-pw'), hasSelectedUnit: true }, true);

  const tokU1 = generateUserSessionToken({ email: 'u1.rl@hcmute.edu.vn', role: 'staff', unitCode: 'CNTT' });
  const tokLd1 = generateUserSessionToken({ email: 'ld1.rl@hcmute.edu.vn', role: 'unit_leader', unitCode: 'CNTT' });
  const tokLd2 = generateUserSessionToken({ email: 'ld2.rl@hcmute.edu.vn', role: 'unit_leader', unitCode: 'CK' });
  const tokAdmin = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
  const campusIp = '203.162.88.10';

  // (b) Shared Campus IP isolation across /api/auth/login, /api/admin/c1-lock, /api/admin/auth
  for (let i = 0; i < 10; i++) {
    const r = await postLogin(new NextRequest('http://localhost:3360/api/auth/login', {
      method: 'POST', headers: { 'x-real-ip': campusIp, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'u1.rl@hcmute.edu.vn', password: 'bad-' + i })
    }));
    assert.strictEqual(r.status, 401);
  }
  const u1Blocked = await postLogin(new NextRequest('http://localhost:3360/api/auth/login', {
    method: 'POST', headers: { 'x-real-ip': campusIp, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'u1.rl@hcmute.edu.vn', password: 'Pw1@2026' })
  }));
  assert.strictEqual(u1Blocked.status, 429);

  // Colleague u2 on same campus IP must succeed 200
  const u2Ok = await postLogin(new NextRequest('http://localhost:3360/api/auth/login', {
    method: 'POST', headers: { 'x-real-ip': campusIp, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'u2.rl@hcmute.edu.vn', password: 'Pw2@2026' })
  }));
  assert.strictEqual(u2Ok.status, 200);

  // Authenticated C1 unlock: ld1 failing 10 times does NOT block ld2 on same IP
  for (let i = 0; i < 10; i++) {
    const r = await postC1Lock(new NextRequest('http://localhost:3360/api/admin/c1-lock', {
      method: 'POST', headers: { authorization: 'Bearer ' + tokLd1, 'x-real-ip': campusIp, 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-c1-' + i })
    }));
    assert.strictEqual(r.status, 401);
  }
  const ld1C1Blocked = await postC1Lock(new NextRequest('http://localhost:3360/api/admin/c1-lock', {
    method: 'POST', headers: { authorization: 'Bearer ' + tokLd1, 'x-real-ip': campusIp, 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'fake-rl-admin-pw' })
  }));
  assert.strictEqual(ld1C1Blocked.status, 429);
  const ld2C1Ok = await postC1Lock(new NextRequest('http://localhost:3360/api/admin/c1-lock', {
    method: 'POST', headers: { authorization: 'Bearer ' + tokLd2, 'x-real-ip': campusIp, 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'fake-rl-admin-pw' })
  }));
  assert.strictEqual(ld2C1Ok.status, 200);

  // Admin auth anonymous cannot bypass IP limit via fake email in body; authenticated ld1 & ld2 remain isolated
  for (let i = 0; i < 10; i++) {
    const r = await postAdminAuth(new NextRequest('http://localhost:3360/api/admin/auth', {
      method: 'POST', headers: { 'x-real-ip': campusIp, 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'spoof-' + i + '@hcmute.edu.vn', password: 'wrong-' + i })
    }));
    assert.strictEqual(r.status, 401);
  }
  const anonBlocked = await postAdminAuth(new NextRequest('http://localhost:3360/api/admin/auth', {
    method: 'POST', headers: { 'x-real-ip': campusIp, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'another-spoof@hcmute.edu.vn', password: 'fake-rl-admin-pw' })
  }));
  assert.strictEqual(anonBlocked.status, 429);
  const authLd2Ok = await postAdminAuth(new NextRequest('http://localhost:3360/api/admin/auth', {
    method: 'POST', headers: { authorization: 'Bearer ' + tokLd2, 'x-real-ip': campusIp, 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'fake-rl-admin-pw' })
  }));
  assert.strictEqual(authLd2Ok.status, 200);
  console.log('  ✓ [PASS] (b) Cách ly đồng nghiệp chung IP trường & chống giả mạo email trên admin/auth ẩn danh');

  // (c) Bounded memory capacity, pinned lock protection & fail-closed on saturation + restart reset
  resetAllRateLimits();
  process.env.VTVL_RATE_LIMIT_MAX_KEYS = '20';
  for (let i = 0; i < 10; i++) recordDirectFailure('pinned:attacker', 10, 900_000);
  for (let i = 0; i < 500; i++) recordDirectFailure('probe:' + i, 10, 900_000);
  const pinnedRes = checkDirectRateKey('pinned:attacker', 10, 900_000);
  assert.strictEqual(pinnedRes.allowed, false, 'Khóa đang bị chặn không được trôi mất khi bơm 500 probe');
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 10; j++) recordDirectFailure('saturated:' + i, 10, 900_000);
  }
  const satOverflow = checkDirectRateKey('brand-new-unknown', 10, 900_000);
  assert.strictEqual(satOverflow.allowed, false);
  assert.strictEqual(satOverflow.reason, 'CAPACITY_OVERFLOW');
  const stats = getAuthRateLimiterStats();
  assert.ok(stats.trackedKeys <= 20, 'trackedKeys phải giữ <= maxKeys=20');
  resetAllRateLimits();
  assert.strictEqual(getAuthRateLimiterStats().trackedKeys, 0);
  delete process.env.VTVL_RATE_LIMIT_MAX_KEYS;
  console.log('  ✓ [PASS] (c) Bộ đếm giữ giới hạn bộ nhớ, ghim khóa đang chặn & fail-closed khi bão hòa toàn bảng');

  // (d) Stream payload limiter without Content-Length (Transfer-Encoding: chunked simulation)
  const chunkedBig = buildChunkedStreamReq('http://localhost:3360/api/tickets', ['{"a":"', 'x'.repeat(600 * 1024), '","b":"', 'y'.repeat(600 * 1024), '"}'], { authorization: 'Bearer ' + tokU1, 'content-type': 'application/json' });
  const ticket413 = await postTicket(chunkedBig);
  assert.strictEqual(ticket413.status, 413);
  assert.strictEqual((await ticket413.json()).code, 'PAYLOAD_TOO_LARGE');
  const streamCheck = await readBoundedJsonBody(buildChunkedStreamReq('http://x', ['{"k":"', 'z'.repeat(70 * 1024), '"}'], {}), 64 * 1024);
  assert.strictEqual(streamCheck.ok, false);
  if (!streamCheck.ok) assert.strictEqual(streamCheck.code, 'PAYLOAD_TOO_LARGE');
  console.log('  ✓ [PASS] (d) Stream body limiter chặn 413 PAYLOAD_TOO_LARGE trước JSON.parse kể cả thiếu Content-Length');

  // (e) Shared Heavy Mutation Budget (save + reconcile queue limit)
  resetHeavyGateMetrics();
  process.env.VTVL_HEAVY_MAX_CONCURRENT = '1';
  process.env.VTVL_HEAVY_MAX_QUEUE = '2';
  let holdResolve!: () => void;
  const holder = withHeavyMutationBudget({ kind: 'unit_reconcile', unitCode: 'CNTT' }, () => new Promise<void>((r) => { holdResolve = r; }));
  const q1 = withHeavyMutationBudget({ kind: 'workbook_save', unitCode: 'CK' }, async () => 'q1');
  const q2 = withHeavyMutationBudget({ kind: 'ticket_mutation', unitCode: 'DIEN' }, async () => 'q2');
  let rejectedErr: any = null;
  try {
    await withHeavyMutationBudget({ kind: 'unit_reconcile', unitCode: 'KT' }, async () => 'fail');
  } catch (e) { rejectedErr = e; }
  assert.strictEqual(rejectedErr?.status, 429);
  assert.strictEqual(rejectedErr?.code, 'SERVER_BUSY_RETRY');
  holdResolve();
  await Promise.all([holder, q1, q2]);
  delete process.env.VTVL_HEAVY_MAX_CONCURRENT;
  delete process.env.VTVL_HEAVY_MAX_QUEUE;
  console.log('  ✓ [PASS] (e) Ngân sách chung HeavyMutationGate dùng chung cho lưu & gộp, trả 429 SERVER_BUSY_RETRY khi đầy hàng đợi');

  // (f) Lock timeout integrity: timed-out waiter leaves safely without stealing active lock
  resetLockTelemetry();
  let lockPhase = 'idle';
  const activeTask = withCrossProcessLock('unit_integrity_test', async () => {
    lockPhase = 'holding';
    await new Promise((r) => setTimeout(r, 380));
    lockPhase = 'finished';
    return 'owner-done';
  }, { waitTimeoutMs: 2000 });
  await new Promise((r) => setTimeout(r, 40));
  assert.strictEqual(lockPhase, 'holding');
  let timeoutErr: any = null;
  try {
    await withCrossProcessLock('unit_integrity_test', async () => 'intruder', { waitTimeoutMs: 90 });
  } catch (e) { timeoutErr = e; }
  assert.strictEqual(timeoutErr?.code, 'LOCK_ACQUIRE_TIMEOUT');
  assert.strictEqual(lockPhase, 'holding', 'Waiter timeout tuyệt đối không làm mất quyền sở hữu khóa của tác vụ đang chạy');
  assert.strictEqual(await activeTask, 'owner-done');
  assert.strictEqual(lockPhase, 'finished');
  assert.strictEqual(getLockTelemetry().timeoutsCount, 1);
  console.log('  ✓ [PASS] (f) Waiter timeout rút lui an toàn (429), tác vụ đang chạy giữ nguyên khóa tới khi hoàn tất');

  // (g) Orphan lock recovery when child process holding .lock is SIGKILLed + cache invalidation
  resetLockTelemetry();
  let invalidationCalled = 0;
  registerCacheInvalidator(() => { invalidationCalled += 1; });
  const childScript = \`
    import { withCrossProcessLock } from './src/services/storage/server-file-lock';
    withCrossProcessLock('orphan_sigkill_test', async () => {
      console.log('CHILD_LOCKED');
      await new Promise(() => {});
    });
  \`;
  const child = spawn('npx', ['tsx', '-e', childScript], { env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Child lock timeout')), 8000);
    child.stdout.on('data', (d) => {
      if (d.toString().includes('CHILD_LOCKED')) { clearTimeout(t); resolve(); }
    });
    child.on('exit', (c) => { clearTimeout(t); reject(new Error('Child exited unexpectedly: ' + c)); });
  });
  child.kill('SIGKILL');
  await new Promise<void>((resolve) => child.on('exit', () => resolve()));
  const recovered = await withCrossProcessLock('orphan_sigkill_test', async () => 'recovered-ok', { waitTimeoutMs: 2000, staleOrphanMs: 30000 });
  assert.strictEqual(recovered, 'recovered-ok');
  assert.ok(getLockTelemetry().orphanRecoveriesCount >= 1, 'Phải thu hồi khóa mồ côi ngay qua kiểm tra ESRCH');
  assert.ok(invalidationCalled >= 1, 'Thu hồi khóa từ tiến trình khác phải kích hoạt invalidateAllLocalCaches()');
  console.log('  ✓ [PASS] (g) Phát hiện tiến trình giữ khóa bị SIGKILL (ESRCH), thu hồi khóa mồ côi & hủy cache cục bộ');

  // (h) Coordinated cache isolation across user, role, assignment, scope
  process.env.VTVL_COORD_CACHE_FORCE = 'true';
  clearAllRuntimeCache();
  await setAssignmentsForAccount({ userEmail: 'u1.rl@hcmute.edu.vn', unitCode: 'CNTT', items: [{ maVtvl: 'CNTT.GV01' }], assignedBy: 'tcns@hcmute.edu.vn' });
  await setAssignmentsForAccount({ userEmail: 'u2.rl@hcmute.edu.vn', unitCode: 'CNTT', items: [{ maVtvl: 'CNTT.GV02' }], assignedBy: 'tcns@hcmute.edu.vn' });
  const { ticket: coordTkt } = await upsertTicketAndSyncUnit({
    unitCode: 'CK', ownerEmail: 'ld2.rl@hcmute.edu.vn', ownerName: 'LD2', ownerTitle: 'LD',
    status: 'Đã nộp', maNhiemVu: 'CK.NV01', tenCongViec: 'Phối hợp riêng U1', maVtvl: 'CK.GV01',
    coordinatedVtvls: [{ targetUnitCode: 'CNTT', maVtvl: 'CNTT.GV01', note: 'Riêng U1' }],
    sanPham: 'SP', chatLuong: 'CL', canCu: 'CC', soSpNam: 1, nguonSoLieu: 'NS', phutThucTe: 60
  });
  const ver = await createImmutableSurveyVersion({ surveyId: coordTkt.id, ticket: coordTkt, submittedBy: 'ld2.rl@hcmute.edu.vn', submittedAt: new Date().toISOString() });
  await syncSubmittedCoordinationProjection(coordTkt, ver);
  const resU1 = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokU1 } }))).json();
  const resU2 = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', { headers: { authorization: 'Bearer ' + tokU2WithToken() } }))).json();
  const resAdminUnit = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated?scope=unit', { headers: { authorization: 'Bearer ' + tokAdmin } }))).json();
  const resAdminAll = await (await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated?scope=all_units', { headers: { authorization: 'Bearer ' + tokAdmin } }))).json();
  assert.strictEqual(resU1.total, 1, 'U1 được gán CNTT.GV01 phải thấy 1 đề xuất');
  assert.strictEqual(resU2.total, 0, 'U2 được gán CNTT.GV02 không được dính cache của U1');
  assert.strictEqual(resAdminUnit.total, 0, 'Admin scope=unit (TCNS) không thấy đề xuất gửi CNTT');
  assert.strictEqual(resAdminAll.total, 1, 'Admin scope=all_units thấy 1 đề xuất toàn trường');
  delete process.env.VTVL_COORD_CACHE_FORCE;
  console.log('  ✓ [PASS] (h) Single-flight cache /api/tickets/coordinated cách ly chuẩn theo email, phân công & scope');

  // (j) Dedicated Liveness (/api/health/live) & Readiness (/api/health/ready) endpoints
  const liveGet = await getHealthLive();
  const liveBody = await liveGet.json();
  assert.strictEqual(liveGet.status, 200);
  assert.deepStrictEqual(liveBody, { status: 'ok' });
  assert.ok((liveGet.headers.get('cache-control') || '').includes('no-store'));
  const liveHead = await headHealthLive();
  assert.strictEqual(liveHead.status, 200);

  const readyNoDb = await getHealthReady();
  assert.strictEqual(readyNoDb.status, 503);
  assert.deepStrictEqual(await readyNoDb.json(), { status: 'unavailable' });

  try {
    setDbTestHook({ select: async () => [{ ok: 1 }] });
    const readyOk = await getHealthReady();
    assert.strictEqual(readyOk.status, 200);
    assert.deepStrictEqual(await readyOk.json(), { status: 'ready' });
    assert.strictEqual((await headHealthReady()).status, 200);

    process.env.VTVL_SIMULATE_DB_UNREADY = 'true';
    const readySimFail = await getHealthReady();
    assert.strictEqual(readySimFail.status, 503);
    assert.deepStrictEqual(await readySimFail.json(), { status: 'unavailable' });
    delete process.env.VTVL_SIMULATE_DB_UNREADY;

    process.env.VTVL_READINESS_TIMEOUT_MS = '150';
    setDbTestHook({ select: () => new Promise((r) => setTimeout(() => r([]), 800)) });
    const tStart = Date.now();
    const readyTimeout = await getHealthReady();
    const tElapsed = Date.now() - tStart;
    assert.strictEqual(readyTimeout.status, 503);
    assert.ok(tElapsed < 500, 'Readiness timeout 150ms không được treo quá 500ms, thực tế: ' + tElapsed + 'ms');
  } finally {
    delete process.env.VTVL_SIMULATE_DB_UNREADY;
    delete process.env.VTVL_READINESS_TIMEOUT_MS;
    setDbTestHook(null);
  }
  console.log('  ✓ [PASS] (j) /api/health/live (200) & /api/health/ready (200/503 với short timeout, payload tối giản no-store)');

  // (k) Same-PID container restart orphan reclaim & concurrent dual-approver race
  resetLockTelemetry();
  const lockDir = '/tmp/vtvl_data/.locks';
  fs.mkdirSync(lockDir, { recursive: true });
  fs.writeFileSync(
    path.join(lockDir, 'docker_pid1_reclaim.lock'),
    JSON.stringify({
      pid: process.pid,
      hostname: os.hostname(),
      instanceId: 'crashed-prev-container-instance',
      lockToken: 'stale-pid1-token',
      acquiredAt: Date.now(),
      heartbeatAt: Date.now()
    }),
    'utf8'
  );
  const reclaimedPid1 = await withCrossProcessLock('docker_pid1_reclaim', async () => 'reclaimed-pid1-ok', {
    waitTimeoutMs: 500,
    staleOrphanMs: 30000
  });
  assert.strictEqual(reclaimedPid1, 'reclaimed-pid1-ok');
  assert.ok(getLockTelemetry().orphanRecoveriesCount >= 1, 'Phải thu hồi ngay khóa cùng PID/hostname nhưng khác instanceId');

  const dualSubRes = await postTicket(
    new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokU1, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'CNTT', maNhiemVu: 'CNTT.NV01', maVtvl: 'CNTT.HT01',
        tenCongViec: 'Đua 2 người duyệt đồng thời', sanPham: 'Biên bản',
        chatLuong: 'Đạt', canCu: 'QĐ 2266', soSpNam: 5, nguonSoLieu: 'Thống kê',
        phutThucTe: 60, gioBoSung: 1, action: 'submit'
      })
    })
  );
  assert.strictEqual(dualSubRes.status, 200);
  const dualTktId = (await dualSubRes.json()).ticket.id;

  const [dualR1, dualR2] = await Promise.all([
    patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokLd1, 'content-type': 'application/json', 'idempotency-key': 'dual-app-1' },
      body: JSON.stringify({ ticketId: dualTktId, action: 'approve', autoMerge: true, unitCode: 'CNTT' })
    })),
    patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'PATCH',
      headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json', 'idempotency-key': 'dual-app-2' },
      body: JSON.stringify({ ticketId: dualTktId, action: 'approve', autoMerge: true, unitCode: 'CNTT' })
    }))
  ]);
  const dualStatuses = [dualR1.status, dualR2.status].sort((a, b) => a - b);
  assert.deepStrictEqual(dualStatuses, [200, 400], 'Hai người duyệt đồng thời phải có đúng 1 bên 200 và 1 bên 400');
  const dualFinal = getTicketById(dualTktId);
  assert.strictEqual((dualFinal?.statusHistory || []).filter((h) => h.action === 'APPROVE').length, 1);
  const wbDual = getOrCreateWorkbook('CNTT');
  assert.strictEqual((wbDual.data.A2 || []).filter((r) => r.sourceTicketId === dualTktId).length, 1);
  assert.strictEqual((wbDual.data.B1 || []).filter((r) => r.sourceTicketId === dualTktId).length, 1);
  console.log('  ✓ [PASS] (k) Thu hồi tức thời khóa trùng PID container restart & đua 2 người duyệt đồng thời toàn vẹn');

  // (l) Single-flight syncAccountsFromSupabase khi cold-start đồng thời 20 request getCallerSession
  resetAccountMemoryStore();
  const pSyncA = syncAccountsFromSupabase();
  const pSyncB = syncAccountsFromSupabase();
  assert.strictEqual(pSyncA, pSyncB, 'Hai lời gọi syncAccountsFromSupabase đồng thời khi cold-start phải dùng chung 1 Promise single-flight');
  await Promise.all([pSyncA, pSyncB]);

  resetAccountMemoryStore();
  const coldAuthCalls = await Promise.all(
    Array.from({ length: 20 }, () =>
      getCallerSession(new NextRequest('http://localhost:3360/api/tickets', { headers: { authorization: 'Bearer ' + tokU1 } }))
    )
  );
  assert.ok(coldAuthCalls.every((c) => c.isAuthenticated && c.email === 'u1.rl@hcmute.edu.vn'), '20/20 phiên cold-start đồng thời phải xác thực thành công (0 lỗi 401)');
  console.log('  ✓ [PASS] (l) Single-flight syncAccountsFromSupabase chống race condition 401 khi cold-start đồng thời');

  // (m) Scoped cross-process cache invalidation preserves other units' in-memory tickets & workbooks under DB mode
  resetTicketMemoryStore();
  getOrCreateWorkbook('BANTT', '01/10/2025–30/9/2026', 'tcns@hcmute.edu.vn', 'Admin');
  getOrCreateWorkbook('CK', '01/10/2025–30/9/2026', 'tcns@hcmute.edu.vn', 'Admin');
  const tktBantt = await upsertTicketAndSyncUnit({
    id: 'tkt-m-bantt', unitCode: 'BANTT', ownerEmail: 'u1.rl@hcmute.edu.vn', ownerName: 'U1', ownerTitle: 'CB',
    status: 'Đã duyệt', maNhiemVu: 'BANTT.NV01', maCongViec: 'BANTT.NV01.CV01', tenCongViec: 'Giữ cache BANTT',
    maVtvl: 'BANTT.CV01', sanPham: 'SP', chatLuong: 'Đạt', canCu: 'QĐ', soSpNam: 1, nguonSoLieu: 'ĐV', phutThucTe: 60, gioBoSung: 0
  });
  const tktCk = await upsertTicketAndSyncUnit({
    id: 'tkt-m-ck', unitCode: 'CK', ownerEmail: 'u2.rl@hcmute.edu.vn', ownerName: 'U2', ownerTitle: 'CB',
    status: 'Đã duyệt', maNhiemVu: 'CK.NV01', maCongViec: 'CK.NV01.CV01', tenCongViec: 'Kiểm tra cache CK',
    maVtvl: 'CK.CV01', sanPham: 'SP', chatLuong: 'Đạt', canCu: 'QĐ', soSpNam: 1, nguonSoLieu: 'ĐV', phutThucTe: 60, gioBoSung: 0
  });
  assert.ok(loadTickets().has(tktBantt.ticket.id) && loadTickets().has(tktCk.ticket.id));
  const prevIsolated = process.env.VTVL_ISOLATED_LOCAL_STORE;
  const prevDbUrl = process.env.DATABASE_URL;
  try {
    process.env.VTVL_ISOLATED_LOCAL_STORE = 'false';
    process.env.DATABASE_URL = 'postgresql://bench:bench@127.0.0.1:5439/bench';
    invalidateAllLocalCaches('unit_wb_CK');
    assert.strictEqual(loadTickets().has(tktBantt.ticket.id), true, 'invalidateAllLocalCaches("unit_wb_CK") không được xóa phiếu BANTT khỏi RAM');
    assert.strictEqual(loadTickets().has(tktCk.ticket.id), true, 'invalidateAllLocalCaches("unit_wb_CK") vẫn giữ map memoryTickets nguyên vẹn');
    const activeWbs = getAllActiveServerWorkbooks();
    assert.strictEqual(activeWbs.some((w) => w.unitId === 'BANTT'), true, 'Workbook BANTT vẫn còn trong cache RAM');
    assert.strictEqual(activeWbs.some((w) => w.unitId === 'CK'), false, 'Workbook CK đã bị loại khỏi cache RAM theo lockKey');
  } finally {
    process.env.VTVL_ISOLATED_LOCAL_STORE = prevIsolated;
    process.env.DATABASE_URL = prevDbUrl;
  }
  console.log('  ✓ [PASS] (m) invalidateAllLocalCaches(lockKey) cô lập theo đơn vị, bảo toàn RAM của các đơn vị chạy song song');

  // (n) Anti-race: stale ALL preload snapshot completing AFTER unit merge & create must NOT clobber merged flag or delete new ticket
  const staleSnapUpdatedAt = tktBantt.ticket.updatedAt;
  const staleAllSnapshot = [{ ...tktBantt.ticket, isMergedToB1B2: false, updatedAt: staleSnapUpdatedAt }];
  const startedUnitSeqSnap = new Map<string, number>([['BANTT', 0]]);
  // Simulate BANTT merge + new ticket creation finishing after ALL began fetching
  const storeRef = loadTickets();
  storeRef.set(tktBantt.ticket.id, { ...tktBantt.ticket, isMergedToB1B2: true, a2RowId: 'a2-' + tktBantt.ticket.id, b1RowId: 'b1-' + tktBantt.ticket.id, updatedAt: staleSnapUpdatedAt });
  bumpTicketMutationWatermark('BANTT');
  const { ticket: raceNewTicket } = await upsertTicketAndSyncUnit({
    id: 'tkt-race-new', unitCode: 'BANTT', ownerEmail: 'u1.rl@hcmute.edu.vn', ownerName: 'U1', ownerTitle: 'CB',
    status: 'Đã duyệt', maNhiemVu: 'BANTT.NV01', maCongViec: 'BANTT.NV01.CV99', tenCongViec: 'Phiếu mới tạo trong lúc ALL sync',
    maVtvl: 'BANTT.CV01', sanPham: 'SP', chatLuong: 'Đạt', canCu: 'QĐ', soSpNam: 2, nguonSoLieu: 'ĐV', phutThucTe: 30, gioBoSung: 0
  });
  mergeRemoteTicketsIntoStore({
    store: storeRef,
    remote: staleAllSnapshot,
    unitCode: undefined,
    mutatedDuringFetch: true,
    unitMutated: true,
    startedUnitSeqSnap,
    currentUnitSeqMap: new Map<string, number>([['BANTT', 2]])
  });
  assert.strictEqual(storeRef.get(tktBantt.ticket.id)?.isMergedToB1B2, true, 'Preload ALL chậm hơn tuyệt đối không được ghi đè ngược isMergedToB1B2 về false');
  assert.strictEqual(storeRef.has(raceNewTicket.id), true, 'Preload ALL chậm hơn không được xóa phiếu mới vừa tạo tại đơn vị BANTT');
  console.log('  ✓ [PASS] (n) Chống race giữa preload ALL chậm với gộp/tạo phiếu theo đơn vị (bảo toàn isMergedToB1B2 & phiếu mới)');

  // (o) Guard against silent remote === null in DB-configured mode
  const prevIsoO = process.env.VTVL_ISOLATED_LOCAL_STORE;
  const prevDbO = process.env.DATABASE_URL;
  try {
    assert.strictEqual(assertAuthoritativeRemoteTickets(null, 'BANTT'), false, 'Chế độ local cô lập trả false an toàn');
    process.env.VTVL_ISOLATED_LOCAL_STORE = 'false';
    process.env.DATABASE_URL = 'postgresql://bench:bench@127.0.0.1:5439/bench';
    let nullErr: any = null;
    try {
      assertAuthoritativeRemoteTickets(null, 'BANTT');
    } catch (err) {
      nullErr = err;
    }
    assert.strictEqual(nullErr?.status, 503, 'remote === null khi đã cấu hình CSDL phải ném lỗi 503');
    assert.strictEqual(nullErr?.code, 'DB_SYNC_UNAVAILABLE', 'Mã lỗi phải là DB_SYNC_UNAVAILABLE, không được im lặng trả 200 mergedCount=0');
  } finally {
    process.env.VTVL_ISOLATED_LOCAL_STORE = prevIsoO;
    process.env.DATABASE_URL = prevDbO;
  }
  console.log('  ✓ [PASS] (o) Chặn nhánh remote === null trả im lặng khi PostgreSQL đang được cấu hình (ném 503 DB_SYNC_UNAVAILABLE)');

  function tokU2WithToken() {
    return generateUserSessionToken({ email: 'u2.rl@hcmute.edu.vn', role: 'staff', unitCode: 'CNTT' });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
`,
    'utf8'
  );

  execSync(`npx tsx "${runnerPath}"`, {
    env: {
      ...process.env,
      VTVL_ISOLATED_LOCAL_STORE: 'true',
      VERCEL: '1',
      DATABASE_URL: '',
      ADMIN_DEFAULT_PASSWORD: 'fake-rl-admin-pw',
      ADMIN_SERVER_SECRET: 'fake-rl-test-secret-key-for-isolated-unit-test-only'
    },
    stdio: 'inherit'
  });

  // (i) Real nginx -t syntax test against deploy/nginx/staging/
  const nginxPrefix = execSync('/opt/homebrew/bin/brew --prefix nginx', { encoding: 'utf8' }).trim();
  const nginxBin = path.join(nginxPrefix, 'bin', 'nginx');
  const ngxConfDir = path.join(tmpDir, 'nginx');
  fs.mkdirSync(path.join(ngxConfDir, 'cache'), { recursive: true });
  fs.mkdirSync(path.join(ngxConfDir, 'logs'), { recursive: true });
  const testNgxConf = path.join(ngxConfDir, 'nginx.conf');
  fs.writeFileSync(
    testNgxConf,
    `worker_processes 1;
pid ${path.join(ngxConfDir, 'nginx.pid')};
error_log ${path.join(ngxConfDir, 'logs', 'error.log')} warn;
events { worker_connections 512; }
http {
  default_type application/octet-stream;
  access_log off;
  proxy_cache_path ${path.join(ngxConfDir, 'cache')} levels=1:2 keys_zone=vtvl_static_cache:10m max_size=128m inactive=1d use_temp_path=off;
  client_body_temp_path ${path.join(ngxConfDir, 'client_body_temp')};
  proxy_temp_path ${path.join(ngxConfDir, 'proxy_temp')};
  include "${path.join(root, 'deploy', 'nginx', 'staging', 'vtvl-http-zones.conf')}";
  include "${path.join(root, 'deploy', 'nginx', 'staging', 'kekhaivtvl.hcmute.edu.vn.staging.conf')}";
}
`,
    'utf8'
  );
  execSync(`"${nginxBin}" -t -c "${testNgxConf}"`, { stdio: 'inherit' });
  console.log('  ✓ [PASS] (i) Kiểm tra cú pháp Nginx staging thực tế (nginx -t) thành công');

  console.log('\n================================================================');
  console.log(' KẾT QUẢ: 15/15 KIỂM THỬ RATE LIMIT, LOCK, HEALTH, RACE & CONCURRENCY PASS');
  console.log('================================================================\n');
} finally {
  if (fs.existsSync(runnerPath)) fs.unlinkSync(runnerPath);
  fs.rmSync('/tmp/vtvl_data', { recursive: true, force: true });
  fs.rmSync('/tmp/audit-logs.json', { force: true });
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
