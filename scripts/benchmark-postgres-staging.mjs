#!/usr/bin/env node
/**
 * Nghiệm thu toàn diện Phương án A (1 instance Next.js + Nginx L7 + PostgreSQL 16 thử nghiệm):
 * - Giai đoạn 1: Khởi tạo PostgreSQL 16, Next Standalone (:3369), Nginx Staging (:8360) & kiểm tra /api/health/{live,ready}
 * - Giai đoạn 2: Nghiệm thu toàn vẹn dữ liệu độc lập với tốc độ (bấm lặp, gộp lâu 8s, 2 người duyệt đồng thời, SIGKILL)
 * - Giai đoạn 3: Nạp dữ liệu thử quy mô 20.000 phiếu + 100.000 phiên bản/lịch sử & đợt dồn tải 39 đơn vị
 * - Giai đoạn 4: Đo tải 30 / 60 / 100 req/s (phân tách từng luồng, p95/p99, 429/5xx, chặn nhầm, DB pool) & dò trần chịu tải 1 bản
 * - Giai đoạn 5: Đo thực nghiệm thời gian phục hồi khi bản duy nhất dừng (SIGTERM & SIGKILL + khóa mồ côi)
 */
import assert from 'node:assert';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { execSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  execQuiet,
  hashPasswordScrypt,
  httpRequest,
  seedFullScaleDataset,
  signUserToken,
  sleep,
  summarizeLatencies,
  verifyPerIdApprovedTicketReconciliation,
  waitForHttp200,
  withDeadline
} from './staging-benchmark-helpers.mjs';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const ROOT = process.cwd();
const STANDALONE_DIR = path.join(ROOT, '.next', 'standalone');
const PG_DIR = '/tmp/utevtvl_pg16_staging';
const PG_PORT = 5439;
const APP_PORT = 3369;
const NGINX_PORT = 8360;
const NGINX_DIR = '/tmp/utevtvl_nginx_staging';
const PG_URL = `postgresql://utevtvl_admin@127.0.0.1:${PG_PORT}/utevtvl_db?schema=public`;
const getAppDbUrl = (dbName = 'utevtvl_db') =>
  `postgresql://utevtvl_admin@127.0.0.1:${PG_PORT}/${dbName}?schema=public&connection_limit=10&pool_timeout=15`;
const AUTH_SECRET = 'staging-vtvl-bench-secret-key-2026-hcmute';
const ADMIN_PW = 'staging-bench-admin-pw-2026';

const hadMigrationsLog = fs.existsSync(path.join(ROOT, 'migrations.log'));
const migrationsLogBackup = hadMigrationsLog ? fs.readFileSync(path.join(ROOT, 'migrations.log'), 'utf8') : null;
const DIAG_ONLY = process.env.VTVL_BENCH_DIAG_ONLY === 'true';
const DIAG_SNAPSHOT_PATH =
  process.env.VTVL_BENCH_DIAG_PATH ||
  path.join(ROOT, 'reports', 'diag-102rps-snapshot.json');

const RATE_LIMIT_POLICY = {
  read: { keyBy: 'email', sustainedMax: 180, burst: 60 },
  ticket_write: { keyBy: 'email', sustainedMax: 45, burst: 15 },
  ticket_review: { keyBy: 'email', sustainedMax: 90, burst: 25 },
  unit_reconcile: { keyBy: 'unitCode', sustainedMax: 12, burst: 4 },
  workbook_write: { keyBy: 'unitCode', sustainedMax: 24, burst: 6 }
};

function spawnAppInstance(dbName = 'utevtvl_db') {
  const dbUrl = getAppDbUrl(dbName);
  const proc = spawn('node', ['server.js'], {
    cwd: STANDALONE_DIR,
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      DATABASE_URL: dbUrl,
      DIRECT_URL: `postgresql://utevtvl_admin@127.0.0.1:${PG_PORT}/${dbName}?schema=public`,
      ADMIN_SERVER_SECRET: AUTH_SECRET,
      NEXTAUTH_SECRET: AUTH_SECRET,
      ADMIN_DEFAULT_PASSWORD: ADMIN_PW,
      VTVL_ISOLATED_LOCAL_STORE: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  proc.stdout.on('data', (d) => { logs += d.toString(); });
  proc.stderr.on('data', (d) => { logs += d.toString(); });
  return { proc, getLogs: () => logs };
}

async function stopProcClean(proc, signal = 'SIGTERM') {
  if (!proc || proc.exitCode !== null) return;
  await new Promise((resolve) => {
    const fallback = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* ignore */ }
    }, 3000);
    proc.once('exit', () => {
      clearTimeout(fallback);
      resolve();
    });
    try { proc.kill(signal); } catch {
      clearTimeout(fallback);
      resolve();
    }
  });
}

async function main() {
  if (!fs.existsSync(path.join(STANDALONE_DIR, 'server.js'))) {
    throw new Error('Thiếu .next/standalone/server.js. Vui lòng chạy npm run build trước.');
  }

  const pgPrefix = execQuiet('/opt/homebrew/bin/brew --prefix postgresql@16').trim();
  const ngxPrefix = execQuiet('/opt/homebrew/bin/brew --prefix nginx').trim();
  const initdbBin = path.join(pgPrefix, 'bin', 'initdb');
  const pgCtlBin = path.join(pgPrefix, 'bin', 'pg_ctl');
  const createdbBin = path.join(pgPrefix, 'bin', 'createdb');
  const pgDumpBin = path.join(pgPrefix, 'bin', 'pg_dump');
  const pgRestoreBin = path.join(pgPrefix, 'bin', 'pg_restore');
  const nginxBin = path.join(ngxPrefix, 'bin', 'nginx');
  const globalWatchdog = setTimeout(() => {
    console.error('❌ [WATCHDOG] Quá thời gian 8 phút, dừng khẩn cấp benchmark.');
    process.exit(2);
  }, 480_000);
  globalWatchdog.unref?.();

  fs.rmSync(PG_DIR, { recursive: true, force: true });
  fs.rmSync(NGINX_DIR, { recursive: true, force: true });
  fs.rmSync(path.join(STANDALONE_DIR, '.data'), { recursive: true, force: true });
  fs.mkdirSync(PG_DIR, { recursive: true });
  fs.mkdirSync(path.join(NGINX_DIR, 'cache'), { recursive: true });
  fs.mkdirSync(path.join(NGINX_DIR, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(NGINX_DIR, 'client_body_temp'), { recursive: true });
  fs.mkdirSync(path.join(NGINX_DIR, 'proxy_temp'), { recursive: true });

  let currentApp = null;
  let nginxStarted = false;
  let pgStarted = false;
  const helperProcs = [];
  const pgClient = new Client({ connectionString: PG_URL });

  try {
    const benchT0 = performance.now();
    const s1T0 = benchT0;
    console.log('\n[1/5] Khởi tạo PostgreSQL 16 (:5439), Next Standalone (:3369), Nginx Staging (:8360) & Healthchecks...');
    execQuiet(`"${initdbBin}" -D "${PG_DIR}" -U utevtvl_admin --auth=trust -E UTF8 --locale=C`);
    execQuiet(
      `"${pgCtlBin}" -D "${PG_DIR}" -l "${PG_DIR}/pg.log" -o "-p ${PG_PORT} -h 127.0.0.1 -k ${PG_DIR} -c max_connections=100 -c shared_buffers=256MB" start`
    );
    pgStarted = true;
    execQuiet(`"${createdbBin}" -h 127.0.0.1 -p ${PG_PORT} -U utevtvl_admin utevtvl_db`);

    execSync('node scripts/migrate-postgres.mjs', {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: PG_URL, DIRECT_URL: PG_URL },
      stdio: 'inherit'
    });
    execSync('node scripts/verify-deployed-tables.mjs', {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: PG_URL, DIRECT_URL: PG_URL },
      stdio: 'inherit'
    });

    await pgClient.connect();
    const activeUnits = (
      await pgClient.query(`SELECT ma_don_vi, ten_don_vi_vi FROM public.dm_don_vi WHERE is_active = true ORDER BY ma_don_vi`)
    ).rows;
    assert.strictEqual(activeUnits.length, 39, `Phải có đủ 39 đơn vị hoạt động, thực tế: ${activeUnits.length}`);

    const pwHash = hashPasswordScrypt('BenchUser@2026');
    const adminHash = hashPasswordScrypt(ADMIN_PW);
    await pgClient.query(
      `INSERT INTO public.user_accounts (email, display_name, unit_code, unit_name_vi, title, role, auth_provider, status, has_selected_unit, password_hash)
       VALUES ('tcns@hcmute.edu.vn', 'Phòng Tổ chức - Nhân sự', 'TCNS', 'Phòng Tổ chức – Nhân sự', 'Quản trị viên', 'admin', 'email', 'active', true, $1)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', status = 'active'`,
      [adminHash]
    );

    const sessions = [];
    const leaderByUnit = new Map();
    const staffByUnit = new Map();
    for (let i = 0; i < 250; i++) {
      const unit = activeUnits[i % activeUnits.length];
      const isLeader = i < activeUnits.length;
      const role = isLeader ? 'unit_leader' : 'staff';
      const title = isLeader ? 'Lãnh đạo đơn vị' : 'Cán bộ – Giảng viên';
      const email = `bench.user${String(i + 1).padStart(3, '0')}@hcmute.edu.vn`;
      await pgClient.query(
        `INSERT INTO public.user_accounts (email, display_name, unit_code, unit_name_vi, title, role, auth_provider, status, has_selected_unit, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, 'email', 'active', true, $7)
         ON CONFLICT (email) DO UPDATE SET unit_code = EXCLUDED.unit_code, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash, status = 'active'`,
        [email, `Cán bộ thử ${i + 1}`, unit.ma_don_vi, unit.ten_don_vi_vi, title, role, pwHash]
      );
      const token = signUserToken(email, role, unit.ma_don_vi, AUTH_SECRET);
      const sess = { email, role, unitCode: unit.ma_don_vi, token };
      sessions.push(sess);
      if (isLeader) leaderByUnit.set(unit.ma_don_vi, sess);
      else {
        if (!staffByUnit.has(unit.ma_don_vi)) staffByUnit.set(unit.ma_don_vi, []);
        staffByUnit.get(unit.ma_don_vi).push(sess);
      }
    }
    const adminToken = signUserToken('tcns@hcmute.edu.vn', 'admin', 'TCNS', AUTH_SECRET);

    currentApp = spawnAppInstance();
    await waitForHttp200(`http://127.0.0.1:${APP_PORT}/api/health/ready`, 25000);

    const dryConfSrc = fs.readFileSync(path.join(ROOT, 'deploy/nginx/staging/kekhaivtvl.hcmute.edu.vn.staging.conf'), 'utf8');
    const enforceConfSrc = dryConfSrc
      .replace('limit_req_dry_run on;', 'limit_req_dry_run off;')
      .replace('limit_conn_dry_run on;', 'limit_conn_dry_run off;');
    const dryConfPath = path.join(NGINX_DIR, 'kekhaivtvl.dry.conf');
    const enforceConfPath = path.join(NGINX_DIR, 'kekhaivtvl.enforce.conf');
    const activeVhostLink = path.join(NGINX_DIR, 'active.vhost.conf');
    fs.writeFileSync(dryConfPath, dryConfSrc, 'utf8');
    fs.writeFileSync(enforceConfPath, enforceConfSrc, 'utf8');
    fs.copyFileSync(dryConfPath, activeVhostLink);

    const ngxMainConf = path.join(NGINX_DIR, 'nginx.conf');
    fs.writeFileSync(
      ngxMainConf,
      `worker_processes 2;
pid ${path.join(NGINX_DIR, 'nginx.pid')};
error_log ${path.join(NGINX_DIR, 'logs', 'error.log')} warn;
events { worker_connections 2048; }
http {
  default_type application/octet-stream;
  access_log off;
  keepalive_requests 100000;
  proxy_cache_path ${path.join(NGINX_DIR, 'cache')} levels=1:2 keys_zone=vtvl_static_cache:10m max_size=256m inactive=1d use_temp_path=off;
  client_body_temp_path ${path.join(NGINX_DIR, 'client_body_temp')};
  proxy_temp_path ${path.join(NGINX_DIR, 'proxy_temp')};
  include "${path.join(ROOT, 'deploy/nginx/staging/vtvl-http-zones.conf')}";
  include "${activeVhostLink}";
}
`,
      'utf8'
    );
    execQuiet(`"${nginxBin}" -t -c "${ngxMainConf}"`);
    execQuiet(`"${nginxBin}" -c "${ngxMainConf}"`);
    nginxStarted = true;
    await waitForHttp200(`http://127.0.0.1:${NGINX_PORT}/api/health/ready`, 10000);

    let agent = new http.Agent({ keepAlive: true, maxSockets: 256 });
    const resetAgent = () => {
      try { agent.destroy(); } catch { /* ignore */ }
      agent = new http.Agent({ keepAlive: true, maxSockets: 256 });
    };
    const reqPort = (port, method, p, body = null, token = '', extraHeaders = {}) =>
      httpRequest(
        agent,
        {
          hostname: '127.0.0.1',
          port,
          path: p,
          method,
          timeout: 15000,
          headers: {
            ...(body !== null ? { 'content-type': 'application/json' } : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...extraHeaders
          }
        },
        body !== null ? JSON.stringify(body) : null
      );
    const getPath = (p, token = '') => reqPort(NGINX_PORT, 'GET', p, null, token);
    const postJson = (p, body, token = '', extra = {}) => reqPort(NGINX_PORT, 'POST', p, body, token, extra);
    const patchJson = (p, body, token = '', extra = {}) => reqPort(NGINX_PORT, 'PATCH', p, body, token, extra);

    // Xác nhận liveness & readiness qua Nginx Staging
    const liveProbe = await getPath('/api/health/live');
    const readyProbe = await getPath('/api/health/ready');
    assert.strictEqual(liveProbe.status, 200);
    assert.deepStrictEqual(liveProbe.json, { status: 'ok' });
    assert.strictEqual(readyProbe.status, 200);
    assert.deepStrictEqual(readyProbe.json, { status: 'ready' });
    console.log('  ✓ Healthchecks qua Nginx: /api/health/live -> 200 {status:"ok"}, /api/health/ready -> 200 {status:"ready"}');

    // Khởi tạo 39 bảng tính để lấy mã Nhiệm vụ A1 và VTVL C1 thực tế cho từng đơn vị
    const unitMetaMap = new Map();
    for (const u of activeUnits) {
      const uc = u.ma_don_vi;
      const wbInit = await postJson('/api/workbooks', { unitCode: uc }, leaderByUnit.get(uc).token);
      assert.strictEqual(wbInit.status, 200, `Init workbook ${uc} failed: ${wbInit.text}`);
      const wbObj = wbInit.json.workbook;
      const initData = wbObj.data || {};
      const missionCode = String(initData.A1?.[0]?.maNhiemVu || `${uc}.NV01`).trim();
      const vtvlCode = String(initData.C1?.[0]?.maVtvl || `${uc}.HT01`).trim();
      const initB1 = initData.B1 || [];
      const baseHours = initB1.reduce((acc, r) => acc + (Number(r.soSpNam || 0) * Number(r.phutThucTe || 0)) / 60 + Number(r.gioBoSung || 0), 0);
      unitMetaMap.set(uc, {
        wbId: wbObj.id,
        missionCode,
        vtvlCode,
        baseA2Count: (initData.A2 || []).length,
        baseB1Count: initB1.length,
        baseHours,
        sampleData: initData
      });
    }

    const stage1Sec = Number(((performance.now() - s1T0) / 1000).toFixed(2));
    const chaosUnits = activeUnits.slice(0, 10).map((u) => u.ma_don_vi);
    const pickStaff = (uc, idx = 0) => (staffByUnit.get(uc) || [leaderByUnit.get(uc)])[idx % Math.max(1, (staffByUnit.get(uc) || []).length)];
    const locksDir = path.join(STANDALONE_DIR, '.data', '.locks');
    let partAResult = null;
    let stage2IdReconcile = null;
    let stage2Sec = 0;

    // =========================================================================
    // GIAI ĐOẠN 2: NGHIỆM THU TOÀN VẸN DỮ LIỆU ĐỘC LẬP VỚI TỐC ĐỘ (MỤC 5)
    // =========================================================================
    if (!DIAG_ONLY) {
    const s2T0 = performance.now();
    console.log('\n[2/5] Giai đoạn 2: Nghiệm thu toàn vẹn dữ liệu độc lập (chung IP, gộp lâu >8s, 2 người duyệt đồng thời, SIGKILL)...');
    for (let i = 0; i < 10; i++) {
      const bad = await postJson('/api/auth/login', { email: sessions[0].email, password: 'wrong-' + i });
      assert.strictEqual(bad.status, 401);
    }
    assert.strictEqual((await postJson('/api/auth/login', { email: sessions[0].email, password: 'BenchUser@2026' })).status, 429);
    assert.strictEqual((await postJson('/api/auth/login', { email: sessions[1].email, password: 'BenchUser@2026' })).status, 200);
    assert.strictEqual((await postJson('/api/admin/c1-lock', { password: ADMIN_PW }, sessions[1].token)).status, 200);

    const expectedAddedTickets = new Map(chaosUnits.map((u) => [u, 0]));
    const expectedAddedVersions = new Map(chaosUnits.map((u) => [u, 0]));
    const expectedAddedHours = new Map(chaosUnits.map((u) => [u, 0]));
    const expectedTicketIdsByUnit = new Map(chaosUnits.map((u) => [u, []]));
    const expectedActionCounts = { SUBMIT: 0, REQUEST_CHANGES: 0, RESUBMIT: 0, APPROVE: 0, MERGE_TO_SHEETS: 0 };

    // 40 phiếu nộp/duyệt kèm bấm lặp Idempotency-Key
    for (let idx = 0; idx < 40; idx++) {
      const u = chaosUnits[idx % chaosUnits.length];
      const staff = pickStaff(u, idx);
      const ld = leaderByUnit.get(u);
      const meta = unitMetaMap.get(u);
      const payload = {
        unitCode: u,
        maNhiemVu: meta.missionCode,
        maVtvl: meta.vtvlCode,
        tenCongViec: `Công việc đối soát toàn vẹn #${idx + 1}`,
        sanPham: 'Biên bản / Hồ sơ nghiệm thu',
        chatLuong: 'Đạt chuẩn HCM-UTE',
        canCu: 'QĐ 2266/QĐ-ĐHCNKT',
        soSpNam: 6 + (idx % 5),
        nguonSoLieu: 'Thống kê đơn vị',
        phutThucTe: 60 + (idx % 3) * 30,
        gioBoSung: idx % 2 === 0 ? 1.5 : 0.5,
        action: 'submit'
      };
      const idemKey = `chaos-sub-${u}-${idx}`;
      const createRes = await postJson('/api/tickets', payload, staff.token, { 'idempotency-key': idemKey });
      assert.strictEqual(createRes.status, 200, `Create failed on ${u}: ${createRes.text}`);
      const tkt = createRes.json.ticket;

      const retryRes = await postJson('/api/tickets', payload, staff.token, { 'idempotency-key': idemKey });
      assert.strictEqual(retryRes.status, 200);
      assert.strictEqual(retryRes.json.idempotent, true);
      assert.strictEqual(retryRes.json.ticket.id, tkt.id);
      expectedActionCounts.SUBMIT += 1;

      const approveKey = `chaos-app-${tkt.id}`;
      const [ap1, ap2] = await Promise.all([
        patchJson('/api/tickets', { id: tkt.id, action: 'approve', autoMerge: false }, ld.token, { 'idempotency-key': approveKey }),
        patchJson('/api/tickets', { id: tkt.id, action: 'approve', autoMerge: false }, ld.token, { 'idempotency-key': approveKey })
      ]);
      assert.strictEqual(ap1.status, 200);
      assert.strictEqual(ap2.status, 200);
      expectedActionCounts.APPROVE += 1;

      expectedAddedTickets.set(u, expectedAddedTickets.get(u) + 1);
      expectedAddedVersions.set(u, expectedAddedVersions.get(u) + 1);
      expectedTicketIdsByUnit.get(u).push(tkt.id);
      const hrs = Number(((payload.soSpNam * payload.phutThucTe) / 60 + payload.gioBoSung).toFixed(4));
      expectedAddedHours.set(u, Number((expectedAddedHours.get(u) + hrs).toFixed(4)));
    }

    // 2 phiếu đi hết chu trình Yêu cầu bổ sung -> Nộp lại (v2) -> Duyệt
    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const u = chaosUnits[rIdx];
      const staff = pickStaff(u, 1);
      const ld = leaderByUnit.get(u);
      const meta = unitMetaMap.get(u);
      const subRes = await postJson('/api/tickets', {
        unitCode: u, maNhiemVu: meta.missionCode, maVtvl: meta.vtvlCode,
        tenCongViec: `Công việc nộp lại v2 #${rIdx + 1}`, sanPham: 'Hồ sơ rà soát',
        chatLuong: 'Đạt chuẩn HCM-UTE', canCu: 'QĐ 2266', soSpNam: 8, nguonSoLieu: 'Sổ tay',
        phutThucTe: 90, gioBoSung: 1, action: 'submit'
      }, staff.token, { 'idempotency-key': `chaos-v2-sub-${rIdx}` });
      assert.strictEqual(subRes.status, 200);
      const tkt = subRes.json.ticket;
      expectedActionCounts.SUBMIT += 1;

      assert.strictEqual((await patchJson('/api/tickets', { id: tkt.id, action: 'request_changes', reason: 'Bổ sung minh chứng' }, ld.token)).status, 200);
      expectedActionCounts.REQUEST_CHANGES += 1;

      assert.strictEqual((await patchJson('/api/tickets', { id: tkt.id, action: 'resubmit', changeSummary: 'Đã cập nhật minh chứng đầy đủ' }, staff.token)).status, 200);
      expectedActionCounts.RESUBMIT += 1;

      assert.strictEqual((await patchJson('/api/tickets', { id: tkt.id, action: 'approve', autoMerge: false }, ld.token)).status, 200);
      expectedActionCounts.APPROVE += 1;

      expectedAddedTickets.set(u, expectedAddedTickets.get(u) + 1);
      expectedAddedVersions.set(u, expectedAddedVersions.get(u) + 2);
      expectedTicketIdsByUnit.get(u).push(tkt.id);
      expectedAddedHours.set(u, Number((expectedAddedHours.get(u) + 13).toFixed(4)));
    }

    // Tình huống Bắt buộc: Hai người duyệt đồng thời (Race 1: Approve vs Approve cùng autoMerge=true; Race 2: Approve vs Request Changes)
    const uRace1 = chaosUnits[2];
    const metaR1 = unitMetaMap.get(uRace1);
    const race1Sub = await postJson('/api/tickets', {
      unitCode: uRace1, maNhiemVu: metaR1.missionCode, maVtvl: metaR1.vtvlCode,
      tenCongViec: 'Đua 2 người duyệt đồng thời (Approve vs Approve)', sanPham: 'Báo cáo nghiệm thu',
      chatLuong: 'Đạt chuẩn HCM-UTE', canCu: 'QĐ 2266', soSpNam: 10, nguonSoLieu: 'Hệ thống',
      phutThucTe: 60, gioBoSung: 2, action: 'submit'
    }, pickStaff(uRace1, 0).token, { 'idempotency-key': 'race1-sub' });
    assert.strictEqual(race1Sub.status, 200);
    const race1Id = race1Sub.json.ticket.id;
    expectedActionCounts.SUBMIT += 1;

    const [r1A, r1B] = await Promise.all([
      patchJson('/api/tickets', { id: race1Id, action: 'approve', autoMerge: true }, leaderByUnit.get(uRace1).token, { 'idempotency-key': 'race1-ld' }),
      patchJson('/api/tickets', { id: race1Id, action: 'approve', autoMerge: true }, adminToken, { 'idempotency-key': 'race1-adm' })
    ]);
    assert.deepStrictEqual([r1A.status, r1B.status].sort((a, b) => a - b), [200, 400], 'Race Approve vs Approve phải đúng 1 bên 200 và 1 bên 400');
    expectedActionCounts.APPROVE += 1;
    expectedActionCounts.MERGE_TO_SHEETS += 1;
    expectedAddedTickets.set(uRace1, expectedAddedTickets.get(uRace1) + 1);
    expectedAddedVersions.set(uRace1, expectedAddedVersions.get(uRace1) + 1);
    expectedTicketIdsByUnit.get(uRace1).push(race1Id);
    expectedAddedHours.set(uRace1, Number((expectedAddedHours.get(uRace1) + 12).toFixed(4)));

    const uRace2 = chaosUnits[3];
    const metaR2 = unitMetaMap.get(uRace2);
    const race2Sub = await postJson('/api/tickets', {
      unitCode: uRace2, maNhiemVu: metaR2.missionCode, maVtvl: metaR2.vtvlCode,
      tenCongViec: 'Đua 2 người duyệt đồng thời (Approve vs Request Changes)', sanPham: 'Hồ sơ phối hợp',
      chatLuong: 'Đạt chuẩn HCM-UTE', canCu: 'QĐ 2266', soSpNam: 5, nguonSoLieu: 'Thống kê',
      phutThucTe: 120, gioBoSung: 0.5, action: 'submit'
    }, pickStaff(uRace2, 0).token, { 'idempotency-key': 'race2-sub' });
    assert.strictEqual(race2Sub.status, 200);
    const race2Id = race2Sub.json.ticket.id;
    expectedActionCounts.SUBMIT += 1;

    const [r2App, r2Req] = await Promise.all([
      patchJson('/api/tickets', { id: race2Id, action: 'approve', autoMerge: true }, adminToken, { 'idempotency-key': 'race2-adm-app' }),
      patchJson('/api/tickets', { id: race2Id, action: 'request_changes', reason: 'Kiểm tra lại căn cứ định mức' }, leaderByUnit.get(uRace2).token)
    ]);
    assert.deepStrictEqual([r2App.status, r2Req.status].sort((a, b) => a - b), [200, 400], 'Race Approve vs RequestChanges phải đúng 1 bên 200 và 1 bên 400');
    if (r2App.status === 200) {
      expectedActionCounts.APPROVE += 1;
      expectedActionCounts.MERGE_TO_SHEETS += 1;
      expectedAddedVersions.set(uRace2, expectedAddedVersions.get(uRace2) + 1);
    } else {
      expectedActionCounts.REQUEST_CHANGES += 1;
      assert.strictEqual((await patchJson('/api/tickets', { id: race2Id, action: 'resubmit', changeSummary: 'Đã bổ sung theo nhận xét' }, pickStaff(uRace2, 0).token)).status, 200);
      expectedActionCounts.RESUBMIT += 1;
      assert.strictEqual((await patchJson('/api/tickets', { id: race2Id, action: 'approve', autoMerge: false }, leaderByUnit.get(uRace2).token)).status, 200);
      expectedActionCounts.APPROVE += 1;
      expectedAddedVersions.set(uRace2, expectedAddedVersions.get(uRace2) + 2);
    }
    expectedAddedTickets.set(uRace2, expectedAddedTickets.get(uRace2) + 1);
    expectedTicketIdsByUnit.get(uRace2).push(race2Id);
    expectedAddedHours.set(uRace2, Number((expectedAddedHours.get(uRace2) + 10.5).toFixed(4)));

    // Gộp lâu (> 8s) -> trả 429 LOCK_ACQUIRE_TIMEOUT -> nhả khóa -> retry thành công
    const slowUnit = chaosUnits[0];
    fs.mkdirSync(locksDir, { recursive: true });
    const slowChild = spawn(
      'node',
      [
        '-e',
        `const fs=require('fs'),p=${JSON.stringify(path.join(locksDir, `unit_wb_${slowUnit}.lock`))};` +
        `const m={pid:process.pid,hostname:${JSON.stringify(os.hostname())},instanceId:'slow-worker',lockToken:'tok-slow',acquiredAt:Date.now(),heartbeatAt:Date.now()};` +
        `const fd=fs.openSync(p,'wx');fs.writeFileSync(fd,JSON.stringify(m));fs.closeSync(fd);console.log('SLOW_LOCKED');` +
        `const iv=setInterval(()=>{m.heartbeatAt=Date.now();fs.writeFileSync(p,JSON.stringify(m));},500);` +
        `setTimeout(()=>{clearInterval(iv);if(JSON.parse(fs.readFileSync(p,'utf8')).lockToken==='tok-slow')fs.unlinkSync(p);process.exit(0);},9200);`
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    helperProcs.push(slowChild);
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('slowChild timeout')), 5000);
      slowChild.stdout.on('data', (d) => { if (d.toString().includes('SLOW_LOCKED')) { clearTimeout(t); resolve(); } });
    });
    const slowTimeoutRes = await postJson('/api/tickets/reconcile', { unitCode: slowUnit }, leaderByUnit.get(slowUnit).token, { 'idempotency-key': `rec-slow-${slowUnit}` });
    assert.strictEqual(slowTimeoutRes.status, 429, `Gộp quá 8s phải trả 429 (nhận ${slowTimeoutRes.status})`);
    assert.ok(slowTimeoutRes.headers['retry-after']);
    await new Promise((resolve) => slowChild.once('exit', () => resolve()));

    // Tiến trình giữ khóa bị SIGKILL -> tự thu hồi khóa mồ côi
    const crashUnit = chaosUnits[1];
    const crashChild = spawn(
      'node',
      [
        '-e',
        `const fs=require('fs'),p=${JSON.stringify(path.join(locksDir, `unit_wb_${crashUnit}.lock`))};` +
        `const m={pid:process.pid,hostname:${JSON.stringify(os.hostname())},instanceId:'crash-worker',lockToken:'tok-crash',acquiredAt:Date.now(),heartbeatAt:Date.now()};` +
        `const fd=fs.openSync(p,'wx');fs.writeFileSync(fd,JSON.stringify(m));fs.closeSync(fd);console.log('CRASH_LOCKED');setInterval(()=>{},1000);`
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    helperProcs.push(crashChild);
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('crashChild timeout')), 5000);
      crashChild.stdout.on('data', (d) => { if (d.toString().includes('CRASH_LOCKED')) { clearTimeout(t); resolve(); } });
    });
    crashChild.kill('SIGKILL');
    await new Promise((resolve) => crashChild.once('exit', () => resolve()));

    // Đồng loạt đối soát + bấm lặp sau timeout / SIGKILL
    const recResponses = await Promise.all(
      chaosUnits.flatMap((u) => [
        postJson('/api/tickets/reconcile', { unitCode: u }, leaderByUnit.get(u).token, { 'idempotency-key': `rec-final-${u}` }),
        postJson('/api/tickets/reconcile', { unitCode: u }, leaderByUnit.get(u).token, { 'idempotency-key': `rec-final-${u}` })
      ])
    );
    assert.ok(recResponses.every((r) => r.status === 200), 'Reconcile đồng thời + bấm lặp + phục hồi khóa phải trả 200 hết');
    // Retry riêng bằng đúng key đã từng timeout 429 ở slowUnit -> phải thành công 200
    const slowRetryAfter = await postJson('/api/tickets/reconcile', { unitCode: slowUnit }, leaderByUnit.get(slowUnit).token, { 'idempotency-key': `rec-slow-${slowUnit}` });
    assert.strictEqual(slowRetryAfter.status, 200);

    // Đối chiếu SQL vs Workbook từng đơn vị (trước / sau)
    const sqlUnitRows = (
      await pgClient.query(`
        SELECT unit_code, count(*)::int AS cnt, round(sum(so_sp_nam * phut_thuc_te / 60.0 + gio_bo_sung)::numeric, 4) AS total_hours
        FROM public.staff_work_tickets
        WHERE is_archived = false AND is_merged_to_b1_b2 = true
        GROUP BY unit_code ORDER BY unit_code
      `)
    ).rows;
    const sqlVerByUnit = new Map(
      (await pgClient.query(`SELECT t.unit_code, count(*)::int AS cnt FROM public.work_survey_versions v JOIN public.staff_work_tickets t ON t.id = v.survey_id GROUP BY t.unit_code`))
        .rows.map((r) => [r.unit_code, r.cnt])
    );
    const sqlHistByUnit = new Map(
      (await pgClient.query(`SELECT unit_id, count(*)::int AS cnt FROM public.work_survey_status_history GROUP BY unit_id`))
        .rows.map((r) => [r.unit_id, r.cnt])
    );
    const sqlDupRes = await pgClient.query(`SELECT count(*)::int AS dups FROM (SELECT unit_code, ma_cong_viec FROM public.staff_work_tickets GROUP BY 1,2 HAVING count(*) > 1) s`);
    const sqlHistByAction = Object.fromEntries(
      (await pgClient.query(`SELECT action, count(*)::int AS cnt FROM public.work_survey_status_history GROUP BY action ORDER BY action`))
        .rows.map((r) => [r.action, r.cnt])
    );
    const wbRowsMap = new Map(
      (await pgClient.query(`SELECT ma_don_vi, du_lieu_ho_so_json FROM public.t_tien_do WHERE ma_don_vi = ANY($1::text[])`, [chaosUnits]))
        .rows.map((r) => [r.ma_don_vi, r.du_lieu_ho_so_json])
    );

    assert.strictEqual(sqlDupRes.rows[0].dups, 0);
    for (const [actKey, expCnt] of Object.entries(expectedActionCounts)) {
      if (expCnt > 0) assert.strictEqual(sqlHistByAction[actKey] || 0, expCnt, `Action ${actKey} không khớp`);
    }

    const perUnitReconciliation = [];
    let totalTicketsSql = 0, totalVersionsSql = 0, totalHistorySql = 0, totalA2Added = 0, totalB1Added = 0, totalHoursSql = 0, totalHoursWbB1 = 0;

    for (const r of sqlUnitRows) {
      const u = r.unit_code;
      const meta = unitMetaMap.get(u);
      const expIds = new Set(expectedTicketIdsByUnit.get(u));
      const expHrs = expectedAddedHours.get(u);
      const sqlHrs = Number(r.total_hours);
      assert.strictEqual(r.cnt, expectedAddedTickets.get(u), `Số phiếu đơn vị ${u} không khớp`);
      assert.strictEqual(sqlVerByUnit.get(u) || 0, expectedAddedVersions.get(u), `Số phiên bản đơn vị ${u} không khớp`);
      assert.ok(Math.abs(sqlHrs - expHrs) < 0.001, `Lệch tổng giờ SQL tại ${u}: ${sqlHrs} vs ${expHrs}`);

      const wbData = wbRowsMap.get(u)?.serverWorkbook?.data || {};
      const a2 = wbData.A2 || [];
      const b1 = wbData.B1 || [];
      assert.strictEqual(a2.length, meta.baseA2Count + expIds.size, `A2 length lệch tại ${u}`);
      assert.strictEqual(b1.length, meta.baseB1Count + expIds.size, `B1 length lệch tại ${u}`);
      const mergedA2 = a2.filter((row) => expIds.has(row.sourceTicketId));
      const mergedB1 = b1.filter((row) => expIds.has(row.sourceTicketId));
      assert.strictEqual(mergedA2.length, expIds.size, `Thiếu/trùng dòng A2 gộp tại ${u}`);
      assert.strictEqual(mergedB1.length, expIds.size, `Thiếu/trùng dòng B1 gộp tại ${u}`);

      const b1AddedHrs = Number(mergedB1.reduce((acc, row) => acc + (Number(row.soSpNam || 0) * Number(row.phutThucTe || 0)) / 60 + Number(row.gioBoSung || 0), 0).toFixed(4));
      assert.ok(Math.abs(b1AddedHrs - sqlHrs) < 0.001, `Lệch tổng giờ B1 tại ${u}: ${b1AddedHrs} vs ${sqlHrs}`);

      const histCnt = sqlHistByUnit.get(u) || 0;
      const verCnt = sqlVerByUnit.get(u) || 0;
      perUnitReconciliation.push({
        unitCode: u,
        ticketsBefore: 0,
        ticketsAfter: r.cnt,
        versionsAfter: verCnt,
        historyAfter: histCnt,
        a2Before: meta.baseA2Count,
        a2After: a2.length,
        b1Before: meta.baseB1Count,
        b1After: b1.length,
        sqlAddedHours: sqlHrs,
        wbB1AddedHours: b1AddedHrs,
        hoursDiff: Number(Math.abs(sqlHrs - b1AddedHrs).toFixed(6))
      });
      totalTicketsSql += r.cnt;
      totalVersionsSql += verCnt;
      totalHistorySql += histCnt;
      totalA2Added += mergedA2.length;
      totalB1Added += mergedB1.length;
      totalHoursSql += sqlHrs;
      totalHoursWbB1 += b1AddedHrs;
    }

    partAResult = {
      sharedIpIsolationPassed: true,
      timeout429RetryPassed: true,
      dualApproverRacePassed: true,
      sigkillOrphanRecovered: true,
      ticketsTotal: totalTicketsSql,
      duplicateTaskCodes: sqlDupRes.rows[0].dups,
      versionsCount: totalVersionsSql,
      historyTotalCount: totalHistorySql,
      historyByAction: sqlHistByAction,
      workbookA2AddedRows: totalA2Added,
      workbookB1AddedRows: totalB1Added,
      totalHoursSql: Number(totalHoursSql.toFixed(4)),
      totalHoursWbB1: Number(totalHoursWbB1.toFixed(4)),
      hoursDiff: Number(Math.abs(totalHoursSql - totalHoursWbB1).toFixed(6)),
      perUnitReconciliation
    };
    console.log(`✓ Giai đoạn 2 PASS 100%: ${totalTicketsSql} phiếu, ${totalVersionsSql} versions, ${totalHistorySql} history, 0 trùng mã, hoursDiff=${partAResult.hoursDiff}`);
    stage2IdReconcile = await verifyPerIdApprovedTicketReconciliation({
      pgClient,
      activeUnits,
      phaseLabel: 'stage2_afterChaos10Units'
    });
    console.log(`  ✓ Đối soát từng ID [Mốc 1]: ${stage2IdReconcile.totalApprovedDbIds}/${stage2IdReconcile.totalApprovedDbIds} phiếu khớp 100% A2/B1/merge_links (0 thiếu/trùng/mồ côi)`);

    stage2Sec = Number(((performance.now() - s2T0) / 1000).toFixed(2));
    } // end if (!DIAG_ONLY)
    // =========================================================================
    // GIAI ĐOẠN 3: BƠM 20.000 PHIẾU + 100.000 PHIÊN BẢN/LỊCH SỬ & ĐỢT DỒN TẢI 39 ĐƠN VỊ
    // =========================================================================
    const s3T0 = performance.now();
    console.log('\n[3/5] Giai đoạn 3: Nạp dữ liệu thử 20.000 phiếu + 100.000 phiên bản/lịch sử & chạy đợt dồn tải 39 đơn vị...');
    const seedSummary = await seedFullScaleDataset({
      pgClient,
      activeUnits,
      sessions,
      leaderByUnit,
      unitMetaMap,
      targetTickets: 20000,
      targetVersions: 60000,
      targetHistory: 40000
    });
    console.log(`  ✓ Đã nạp PostgreSQL: ${seedSummary.totalTickets} phiếu, ${seedSummary.totalVersions} phiên bản, ${seedSummary.totalHistory} lịch sử`);

    // Kiểm chứng ngay trên cache RAM đang nóng (trước restart): đọc GET làm ấm TTL 2500ms rồi gọi reconcile BANTT tức thời
    await getPath('/api/tickets?unitCode=BANTT&view=list&limit=20', leaderByUnit.get('BANTT').token);
    await getPath('/api/tickets?unitCode=BANTT', leaderByUnit.get('BANTT').token);
    const warmSeedRecRes = await postJson(
      '/api/tickets/reconcile',
      { unitCode: 'BANTT' },
      leaderByUnit.get('BANTT').token,
      { 'idempotency-key': 'warm-after-seed-BANTT' }
    );
    assert.strictEqual(warmSeedRecRes.status, 200, `Reconcile ngay sau seed SQL phải trả 200 (nhận ${warmSeedRecRes.status})`);
    assert.ok(
      Number(warmSeedRecRes.json?.mergedCount || 0) >= 350,
      `Reconcile ngay sau seed SQL trên cache nóng phải lấy trực tiếp DB và gộp >= 350 phiếu BANTT (thực tế: ${warmSeedRecRes.json?.mergedCount})`
    );
    const warmAfterSeedReconcileCheck = {
      unitCode: 'BANTT',
      status: warmSeedRecRes.status,
      mergedCount: Number(warmSeedRecRes.json?.mergedCount || 0)
    };
    console.log(`  ✓ Cache nóng sau seed SQL (không restart): BANTT reconcile hợp nhất trực tiếp từ DB ${warmAfterSeedReconcileCheck.mergedCount} phiếu`);

    // Khởi động lại Node Standalone để mọi cache RAM bắt đầu lạnh trên nền CSDL 20k/100k
    await stopProcClean(currentApp.proc, 'SIGTERM');
    currentApp = spawnAppInstance();
    await waitForHttp200(`http://127.0.0.1:${APP_PORT}/api/health/ready`, 25000);
    await waitForHttp200(`http://127.0.0.1:${NGINX_PORT}/api/health/ready`, 10000);

    // Đợt dồn tải 39 đơn vị đồng thời (Wave 1: 39 POST tạo phiếu + 39 POST đối soát gộp ~3.000 phiếu Đã duyệt chưa gộp)
    await getPath('/api/admin/load-metrics?reset=true&resetBuckets=true', adminToken);
    const wave1Start = performance.now();
    let wave1CreateInitial429 = 0;
    const wave1Creates = activeUnits.map(async (u, idx) => {
      const uc = u.ma_don_vi;
      const meta = unitMetaMap.get(uc);
      const tok = pickStaff(uc, 0).token;
      const body = {
        unitCode: uc, maNhiemVu: meta.missionCode, maVtvl: meta.vtvlCode,
        tenCongViec: `Đợt dồn tải 39 đơn vị #${idx + 1}`, sanPham: 'Hồ sơ nộp sát hạn',
        chatLuong: 'Đạt chuẩn HCM-UTE', canCu: 'QĐ 2266', soSpNam: 10, nguonSoLieu: 'Đơn vị',
        phutThucTe: 60, gioBoSung: 1, action: 'submit'
      };
      const idemKey = `burst39-create-${uc}`;
      let res = await postJson('/api/tickets', body, tok, { 'idempotency-key': idemKey });
      if (res.status === 429) wave1CreateInitial429 += 1;
      let attempt = 0;
      while (res.status === 429 && attempt < 8) {
        attempt += 1;
        const retrySec = Math.min(4, Math.max(1, Number(res.headers['retry-after'] || 2)));
        await sleep(retrySec * 1000 + Math.floor(Math.random() * 250));
        res = await postJson('/api/tickets', body, tok, { 'idempotency-key': idemKey });
      }
      return res;
    });

    let wave1Initial429 = 0;
    let wave1Initial5xx = 0;
    let wave1Retries = 0;
    const wave1Latencies = [];
    const wave1Reconciles = activeUnits.map(async (u) => {
      const uc = u.ma_don_vi;
      const tok = leaderByUnit.get(uc).token;
      const idemKey = `burst39-rec-${uc}`;
      let res = await postJson('/api/tickets/reconcile', { unitCode: uc }, tok, { 'idempotency-key': idemKey });
      wave1Latencies.push(res.elapsedMs);
      if (res.status === 429) wave1Initial429 += 1;
      else if (res.status >= 500) wave1Initial5xx += 1;

      let attempt = 0;
      while (res.status === 429 && attempt < 8) {
        attempt += 1;
        wave1Retries += 1;
        const retrySec = Math.min(4, Math.max(1, Number(res.headers['retry-after'] || 2)));
        await sleep(retrySec * 1000 + Math.floor(Math.random() * 250));
        res = await postJson('/api/tickets/reconcile', { unitCode: uc }, tok, { 'idempotency-key': idemKey });
        wave1Latencies.push(res.elapsedMs);
      }
      return res;
    });

    const [wave1CreateRes, wave1RecRes] = await Promise.all([Promise.all(wave1Creates), Promise.all(wave1Reconciles)]);
    const wave1WallMs = Number((performance.now() - wave1Start).toFixed(2));
    const failedCreates = wave1CreateRes.filter((r) => r.status !== 200);
    if (failedCreates.length > 0) {
      console.error('Wave1 Create Failures:', failedCreates.map((r) => ({ status: r.status, body: r.text?.slice(0, 300) })));
      console.error('App Logs tail:', currentApp.getLogs().slice(-1500));
    }
    assert.strictEqual(failedCreates.length, 0, `Toàn bộ 39 POST tạo phiếu trong đợt dồn tải phải thành công (thất bại ${failedCreates.length})`);
    const failedRecs = wave1RecRes.filter((r) => r.status !== 200);
    if (failedRecs.length > 0) {
      console.error('Wave1 Reconcile Failures:', failedRecs.map((r) => ({ status: r.status, body: r.text?.slice(0, 300) })));
      console.error('App Logs tail:', currentApp.getLogs().slice(-1500));
    }
    assert.strictEqual(failedRecs.length, 0, `Toàn bộ 39 đơn vị gộp phải hoàn tất 200 sau retry (lỗi: ${failedRecs.map((r) => r.status)})`);
    assert.strictEqual(wave1Initial5xx, 0, 'Đợt dồn tải 39 đơn vị không được phát sinh 5xx');

    const totalBurstMerged = wave1RecRes.reduce((acc, r) => acc + Number(r.json?.mergedCount || 0), 0);
    const remainingUnmergedApproved = (
      await pgClient.query(`SELECT count(*)::int AS cnt FROM public.staff_work_tickets WHERE status = 'approved' AND is_merged_to_b1_b2 = false AND is_archived = false`)
    ).rows[0].cnt;
    if (remainingUnmergedApproved !== 0) {
      const byUnit = (
        await pgClient.query(`SELECT unit_code, count(*)::int AS cnt FROM public.staff_work_tickets WHERE status = 'approved' AND is_merged_to_b1_b2 = false AND is_archived = false GROUP BY unit_code ORDER BY unit_code`)
      ).rows;
      const recSummary = wave1RecRes.map((r) => ({ unit: r.json?.unitCode, merged: r.json?.mergedCount, idem: Boolean(r.json?.idempotent), status: r.status }));
      console.error('Unmerged approved by unit:', byUnit);
      console.error('Wave1 reconcile responses (merged==0 or match):', recSummary.filter((x) => !x.merged || byUnit.some((u) => u.unit_code === x.unit)));
      console.error('App Logs tail:', currentApp.getLogs().slice(-2000));
    }
    assert.strictEqual(remainingUnmergedApproved, 0, 'Sau đợt dồn tải 39 đơn vị, toàn bộ phiếu approved chưa gộp phải về 0');
    const stage3IdReconcile = await verifyPerIdApprovedTicketReconciliation({
      pgClient,
      activeUnits,
      phaseLabel: 'stage3_afterBurst39Units'
    });
    console.log(`  ✓ Đối soát từng ID [Mốc 2]: ${stage3IdReconcile.totalApprovedDbIds}/${stage3IdReconcile.totalApprovedDbIds} phiếu trên 39 đơn vị khớp 100% A2/B1/merge_links (0 thiếu/trùng/mồ côi)`);
    const wave1Metrics = (await reqPort(APP_PORT, 'GET', '/api/admin/load-metrics', null, adminToken)).json || {};

    // Wave 2: Vượt trần hàng đợi 60 để kiểm chứng 429 SERVER_BUSY_RETRY an toàn, không crash / không 5xx
    await getPath('/api/admin/load-metrics?reset=true&resetBuckets=true', adminToken);
    const wave2Reqs = Array.from({ length: 85 }, (_, k) => {
      const uc = activeUnits[k % activeUnits.length].ma_don_vi;
      return reqPort(APP_PORT, 'POST', '/api/tickets/reconcile', { unitCode: uc }, leaderByUnit.get(uc).token);
    });
    const wave2Res = await Promise.all(wave2Reqs);
    const wave2Stats = {
      total: wave2Res.length,
      ok200: wave2Res.filter((r) => r.status === 200).length,
      busy429: wave2Res.filter((r) => r.status === 429).length,
      err5xx: wave2Res.filter((r) => r.status >= 500).length
    };
    assert.strictEqual(wave2Stats.err5xx, 0, 'Wave 2 xả tải không được sinh lỗi 5xx');

    const burst39UnitsSummary = {
      datasetBeforeBurst: seedSummary,
      warmAfterSeedReconcileCheck,
      wave1Creates200: wave1CreateRes.filter((r) => r.status === 200).length,
      wave1CreateInitial429,
      wave1ReconcilesUnits200: wave1RecRes.filter((r) => r.status === 200).length,
      wave1TotalMergedTickets: totalBurstMerged,
      remainingUnmergedApproved,
      wave1Initial429,
      wave1Retries,
      wave1Initial5xx,
      wave1WallMs,
      wave1ReconcileLatencies: summarizeLatencies(wave1Latencies),
      wave1HeavyGatePeakActive: wave1Metrics.heavyGate?.peakActive ?? 0,
      wave1HeavyGatePeakQueued: wave1Metrics.heavyGate?.peakQueued ?? 0,
      wave1PgPool: wave1Metrics.pgPool || {},
      wave2QueueShedTest: wave2Stats
    };
    console.log(`  ✓ Đợt dồn tải 39 đơn vị hoàn tất: gộp ${totalBurstMerged} phiếu, còn sót=${remainingUnmergedApproved}, 5xx=0, wall=${wave1WallMs} ms`);

    const stage3Sec = Number(((performance.now() - s3T0) / 1000).toFixed(2));
    // =========================================================================
    // GIAI ĐOẠN 4: ĐO TẢI 30 / 60 / 100 REQ/S TỪNG LUỒNG & DÒ TRẦN CHỊU TẢI 1 BẢN
    // =========================================================================
    const s4T0 = performance.now();
    console.log('\n[4/5] Giai đoạn 4: Đo tải trên 20.000 phiếu (250 phiên chung IP) ở 30, 60, 100 req/s + dò trần 1 bản...');
    for (const u of activeUnits) {
      const uc = u.ma_don_vi;
      const meta = unitMetaMap.get(uc);
      const wbGet = await getPath(`/api/workbooks/${meta.wbId}`, leaderByUnit.get(uc).token);
      if (wbGet.status === 200 && wbGet.json?.workbook?.data) {
        meta.sampleData = wbGet.json.workbook.data;
      }
    }
    const homeHtml = (await getPath('/')).text;
    const chunkMatch = homeHtml.match(/\/_next\/static\/chunks\/[^"']+\.js/);
    const staticCheck = { url: chunkMatch ? chunkMatch[0] : '/_next/static/', hit1: 'N/A', hit2: 'N/A', apiCacheControl: '' };
    if (chunkMatch) {
      staticCheck.hit1 = String((await getPath(chunkMatch[0])).headers['x-vtvl-cache'] || '');
      staticCheck.hit2 = String((await getPath(chunkMatch[0])).headers['x-vtvl-cache'] || '');
    }
    const apiCacheProbe = await getPath(`/api/tickets?unitCode=${chaosUnits[0]}&view=list&limit=20`, sessions[1].token);
    staticCheck.apiCacheControl = String(apiCacheProbe.headers['cache-control'] || '');
    assert.strictEqual(staticCheck.hit2, 'HIT');
    assert.ok(staticCheck.apiCacheControl.includes('no-store'));
    assert.ok(!apiCacheProbe.headers['x-vtvl-cache']);

    const pendingApproveByUnit = new Map(activeUnits.map((u) => [u.ma_don_vi, []]));
    let loadSeq = 0;

    async function runPacedLoadPhase(targetRps, durationSec, modeLabel, targetPort = NGINX_PORT) {
      await reqPort(APP_PORT, 'GET', '/api/admin/load-metrics?reset=true&resetBuckets=true', null, adminToken, { connection: 'close' });
      const totalRequests = targetRps * durationSec;
      const allLatencies = [];
      const flowBuckets = {
        read_tickets_list: { latencies: [], ok2xx: 0, blocked429: 0, err5xx: 0, other: 0 },
        read_overview_coord: { latencies: [], ok2xx: 0, blocked429: 0, err5xx: 0, other: 0 },
        read_workbook: { latencies: [], ok2xx: 0, blocked429: 0, err5xx: 0, other: 0 },
        write_submit_review: { latencies: [], ok2xx: 0, blocked429: 0, err5xx: 0, other: 0 },
        heavy_reconcile_save: { latencies: [], ok2xx: 0, blocked429: 0, err5xx: 0, other: 0 }
      };
      const breakdown429 = {
        byCode: {},
        byApi: {},
        byUnit: {},
        byRole: {},
        policyBlockedCount: 0,
        overloadFalsePositiveCount: 0
      };
      const distByGroup = Object.fromEntries(
        Object.keys(RATE_LIMIT_POLICY).map((k) => [k, { requests: 0, bySubject: new Map(), actors: new Set() }])
      );
      let status2xx = 0, status429 = 0, status5xx = 0, statusOther = 0, dryRunFlagged = 0;
      const error5xxSamples = [];
      let lastDispatchElapsedMs = 0;

      const startMs = performance.now();
      const inFlight = [];
      let sent = 0;

      while (sent < totalRequests) {
        const elapsedMs = performance.now() - startMs;
        const shouldHaveSent = Math.min(totalRequests, Math.floor((elapsedMs * targetRps) / 1000) + 1);
        while (sent < shouldHaveSent) {
          const i = sent++;
          const sess = sessions[i % sessions.length];
          const uc = sess.unitCode;
          const meta = unitMetaMap.get(uc);
          const roll = i % 20;
          const uniqueIdx = ++loadSeq;

          let flowName;
          let apiLabel;
          let rateGroup;
          let rateSubject;
          let actorEmail;
          let actorRole;
          let reqPromise;
          if (roll < 8) {
            flowName = 'read_tickets_list';
            rateGroup = 'read';
            rateSubject = sess.email;
            actorEmail = sess.email;
            actorRole = sess.role;
            if (roll === 7 && seedSummary.sampleIdsByUnit[uc]) {
              apiLabel = 'GET /api/tickets/[id]/versions';
              reqPromise = reqPort(targetPort, 'GET', `/api/tickets/${seedSummary.sampleIdsByUnit[uc]}/versions`, null, sess.token);
            } else {
              apiLabel = 'GET /api/tickets';
              reqPromise = reqPort(targetPort, 'GET', `/api/tickets?unitCode=${uc}&view=list&limit=50`, null, sess.token);
            }
          } else if (roll < 11) {
            flowName = 'read_overview_coord';
            rateGroup = 'read';
            rateSubject = sess.email;
            actorEmail = sess.email;
            actorRole = sess.role;
            const isOverview = roll === 8;
            apiLabel = isOverview ? 'GET /api/admin/overview' : 'GET /api/tickets/coordinated';
            const pathUrl = isOverview ? `/api/admin/overview?unitCode=${uc}` : '/api/tickets/coordinated';
            reqPromise = reqPort(targetPort, 'GET', pathUrl, null, sess.token);
          } else if (roll < 14) {
            flowName = 'read_workbook';
            rateGroup = 'read';
            rateSubject = sess.email;
            actorEmail = sess.email;
            actorRole = sess.role;
            apiLabel = 'GET /api/workbooks/[id]';
            reqPromise = reqPort(targetPort, 'GET', `/api/workbooks/${meta.wbId}`, null, sess.token);
          } else if (roll < 19) {
            flowName = 'write_submit_review';
            const unitQueue = pendingApproveByUnit.get(uc);
            const st = pickStaff(uc, i);
            if (roll === 18 && unitQueue && unitQueue.length > 0) {
              const ld = leaderByUnit.get(uc);
              rateGroup = 'ticket_review';
              rateSubject = ld.email;
              actorEmail = ld.email;
              actorRole = ld.role;
              apiLabel = 'PATCH /api/tickets (approve)';
              const tktIdToApprove = unitQueue.shift();
              reqPromise = reqPort(targetPort, 'PATCH', '/api/tickets', { id: tktIdToApprove, action: 'approve', autoMerge: false }, ld.token, {
                'idempotency-key': `load-app-${uniqueIdx}`
              });
            } else {
              const isSubmit = roll % 2 === 0;
              rateGroup = 'ticket_write';
              rateSubject = st.email;
              actorEmail = st.email;
              actorRole = st.role;
              apiLabel = isSubmit ? 'POST /api/tickets (submit)' : 'POST /api/tickets (draft)';
              reqPromise = reqPort(
                targetPort,
                'POST',
                '/api/tickets',
                {
                  unitCode: uc,
                  maNhiemVu: meta.missionCode,
                  maVtvl: meta.vtvlCode,
                  tenCongViec: `Tải ${modeLabel} ${targetRps}rps #${uniqueIdx}`,
                  sanPham: 'Hồ sơ nghiệm thu',
                  chatLuong: 'Đạt chuẩn HCM-UTE',
                  canCu: 'QĐ 2266',
                  soSpNam: 5,
                  nguonSoLieu: 'Đơn vị',
                  phutThucTe: 60,
                  gioBoSung: 0,
                  action: isSubmit ? 'submit' : 'draft',
                  status: isSubmit ? 'Đã nộp' : 'Nháp'
                },
                st.token,
                { 'idempotency-key': `load-post-${uniqueIdx}` }
              ).then((r) => {
                if (isSubmit && r.status === 200 && r.json?.ticket?.id) {
                  unitQueue.push(r.json.ticket.id);
                }
                return r;
              });
            }
          } else {
            flowName = 'heavy_reconcile_save';
            const ld = leaderByUnit.get(uc);
            rateSubject = uc;
            actorEmail = ld.email;
            actorRole = ld.role;
            if (uniqueIdx % 3 === 0) {
              rateGroup = 'workbook_write';
              apiLabel = 'PUT /api/workbooks/[id]';
              reqPromise = reqPort(targetPort, 'PUT', `/api/workbooks/${meta.wbId}`, {
                data: meta.sampleData,
                baseRevision: 0,
                commitMessage: `Lưu tải ${targetRps}rps`
              }, ld.token);
            } else {
              rateGroup = 'unit_reconcile';
              apiLabel = 'POST /api/tickets/reconcile';
              reqPromise = reqPort(targetPort, 'POST', '/api/tickets/reconcile', { unitCode: uc }, ld.token);
            }
          }

          const gDist = distByGroup[rateGroup];
          gDist.requests += 1;
          const subjKey = String(rateSubject || '').toLowerCase();
          gDist.bySubject.set(subjKey, (gDist.bySubject.get(subjKey) || 0) + 1);
          gDist.actors.add(String(actorEmail || '').toLowerCase());
          lastDispatchElapsedMs = performance.now() - startMs;

          inFlight.push(
            reqPromise
              .then((r) => {
                allLatencies.push(r.elapsedMs);
                const fb = flowBuckets[flowName];
                fb.latencies.push(r.elapsedMs);
                const rlHdr = String(r.headers['x-ratelimit-status'] || '');
                if (rlHdr.includes('REJECTED_DRY_RUN')) dryRunFlagged += 1;
                if (r.status >= 200 && r.status < 300) {
                  status2xx += 1;
                  fb.ok2xx += 1;
                } else if (r.status === 429) {
                  status429 += 1;
                  fb.blocked429 += 1;
                  const rawCode = String(r.json?.code || 'HTTP_429');
                  const codeKey = rawCode === 'RATE_LIMITED' && r.json?.scope ? `${rawCode}:${r.json.scope}` : rawCode;
                  breakdown429.byCode[codeKey] = (breakdown429.byCode[codeKey] || 0) + 1;
                  breakdown429.byApi[apiLabel] = (breakdown429.byApi[apiLabel] || 0) + 1;
                  breakdown429.byUnit[uc] = (breakdown429.byUnit[uc] || 0) + 1;
                  breakdown429.byRole[actorRole] = (breakdown429.byRole[actorRole] || 0) + 1;
                  if (rawCode === 'RATE_LIMITED' || rawCode === 'NGINX_RATE_LIMITED') {
                    breakdown429.policyBlockedCount += 1;
                  } else {
                    breakdown429.overloadFalsePositiveCount += 1;
                  }
                } else if (r.status >= 500) {
                  status5xx += 1;
                  fb.err5xx += 1;
                  if (error5xxSamples.length < 10) {
                    error5xxSamples.push({ api: apiLabel, status: r.status, body: String(r.text || '').slice(0, 240) });
                  }
                } else {
                  statusOther += 1;
                  fb.other += 1;
                }
              })
              .catch((err) => {
                status5xx += 1;
                flowBuckets[flowName].err5xx += 1;
                if (error5xxSamples.length < 10) {
                  error5xxSamples.push({ api: apiLabel, status: 0, body: String(err?.message || err).slice(0, 240) });
                }
              })
          );
        }
        if (sent < totalRequests) await sleep(8);
      }

      await Promise.all(inFlight);
      const wallMs = performance.now() - startMs;
      const metrics = (await reqPort(APP_PORT, 'GET', '/api/admin/load-metrics', null, adminToken, { connection: 'close' })).json || {};
      const overallLat = summarizeLatencies(allLatencies);
      const perFlow = Object.fromEntries(
        Object.entries(flowBuckets).map(([k, v]) => {
          const totalFlow = Math.max(1, v.ok2xx + v.blocked429 + v.err5xx + v.other);
          return [
            k,
            {
              ...summarizeLatencies(v.latencies),
              ok2xx: v.ok2xx,
              rate2xxPct: Number(((v.ok2xx / totalFlow) * 100).toFixed(2)),
              blocked429: v.blocked429,
              err5xx: v.err5xx,
              other: v.other
            }
          ];
        })
      );
      const workloadDistribution = Object.fromEntries(
        Object.entries(distByGroup).map(([group, info]) => {
          const policy = RATE_LIMIT_POLICY[group];
          const counts = Array.from(info.bySubject.values());
          const maxReqsPerSubject = counts.length ? Math.max(...counts) : 0;
          const minReqsPerSubject = counts.length ? Math.min(...counts) : 0;
          const avgReqsPerSubject = counts.length ? Number((info.requests / counts.length).toFixed(2)) : 0;
          return [
            group,
            {
              keyBy: policy.keyBy,
              totalRequests: info.requests,
              distinctSubjects: info.bySubject.size,
              distinctActors: info.actors.size,
              minReqsPerSubject,
              avgReqsPerSubject,
              maxReqsPerSubject,
              policyLimitPer60s: policy.sustainedMax,
              policyBurst: policy.burst,
              withinSustainedPolicy: maxReqsPerSubject <= policy.sustainedMax
            }
          ];
        })
      );

      return {
        mode: modeLabel,
        targetRps,
        durationSec,
        totalRequests,
        wallTimeSec: Number((wallMs / 1000).toFixed(2)),
        drainTailMs: Number(Math.max(0, wallMs - lastDispatchElapsedMs).toFixed(2)),
        achievedRps: Number(((totalRequests * 1000) / wallMs).toFixed(1)),
        achieved2xxRps: Number(((status2xx * 1000) / wallMs).toFixed(2)),
        status2xx,
        status429,
        status5xx,
        statusOther,
        dryRunFlagged,
        validBlockedCount: status429 + dryRunFlagged,
        rate2xxPct: Number(((status2xx / totalRequests) * 100).toFixed(2)),
        rate429Pct: Number(((status429 / totalRequests) * 100).toFixed(2)),
        rate5xxPct: Number(((status5xx / totalRequests) * 100).toFixed(2)),
        falsePositiveBlockPct: Number((((status429 + dryRunFlagged) / totalRequests) * 100).toFixed(2)),
        p50Ms: overallLat.p50Ms,
        p95Ms: overallLat.p95Ms,
        p99Ms: overallLat.p99Ms,
        perFlow,
        breakdown429,
        error5xxSamples,
        workloadDistribution,
        heavyGatePeakActive: metrics.heavyGate?.peakActive ?? 0,
        heavyGatePeakQueued: metrics.heavyGate?.peakQueued ?? 0,
        heavyGateDetail: metrics.heavyGate || {},
        fileLockPeakQueued: metrics.fileLocks?.peakQueuedWaiters ?? 0,
        fileLocksDetail: metrics.fileLocks || {},
        pgPool: metrics.pgPool || {}
      };
    }

    const dryRunRuns = [];
    if (!DIAG_ONLY) {
      for (const [rps, sec] of [[30, 6], [60, 6], [100, 8]]) {
        const r = await withDeadline(runPacedLoadPhase(rps, sec, 'nginx_dry_run_on', NGINX_PORT), (sec + 35) * 1000, `dryRun_${rps}rps`);
        dryRunRuns.push(r);
        console.log(`  • ${r.mode} ${rps} req/s (${r.durationSec}s / wall=${r.wallTimeSec}s): đạt ${r.achievedRps} rps (2xx=${r.achieved2xxRps} rps), p95=${r.p95Ms}ms, p99=${r.p99Ms}ms, 2xx=${r.status2xx}/${r.totalRequests} (${r.rate2xxPct}%), 429=${r.status429} (${r.rate429Pct}%), 5xx=${r.status5xx} (${r.rate5xxPct}%)`);
      }
    }

    fs.copyFileSync(enforceConfPath, activeVhostLink);
    execQuiet(`"${nginxBin}" -s reload -c "${ngxMainConf}"`);
    resetAgent();
    await sleep(500);
    await waitForHttp200(`http://127.0.0.1:${NGINX_PORT}/api/health/ready`, 10000);

    const enforceRuns = [];
    for (const [rps, sec] of [[30, 6], [60, 6], [100, 8], [102, 60]]) {
      const deadlineMs = (sec >= 60 ? sec + 45 : sec + 35) * 1000;
      const r = await withDeadline(runPacedLoadPhase(rps, sec, 'nginx_enforced', NGINX_PORT), deadlineMs, `enforce_${rps}rps`);
      enforceRuns.push(r);
      console.log(`  • ${r.mode} ${rps} req/s (${r.durationSec}s / wall=${r.wallTimeSec}s, drain=${r.drainTailMs}ms): đạt ${r.achievedRps} rps (2xx=${r.achieved2xxRps} rps), p95=${r.p95Ms}ms, p99=${r.p99Ms}ms, 2xx=${r.status2xx}/${r.totalRequests} (${r.rate2xxPct}%), 429=${r.status429} (${r.rate429Pct}%), 5xx=${r.status5xx} (${r.rate5xxPct}%)`);
      if (rps === 102 && sec === 60 && !DIAG_ONLY) {
        assert.strictEqual(r.status5xx, 0, `Mốc 102 req/s × 60s không được phát sinh lỗi 5xx (thực tế: ${r.status5xx})`);
        assert.ok(r.achieved2xxRps >= 100, `Mốc 102 req/s × 60s phải đạt >= 100.0 req/s thành công (2xx/wallTimeSec gồm xả hàng đợi), thực tế: ${r.achieved2xxRps} rps`);
      }
    }

    if (DIAG_ONLY) {
      const focus102x60 = enforceRuns.find((x) => x.targetRps === 102 && x.durationSec === 60) || null;
      fs.mkdirSync(path.dirname(DIAG_SNAPSHOT_PATH), { recursive: true });
      fs.writeFileSync(
        DIAG_SNAPSHOT_PATH,
        JSON.stringify({ generatedAt: new Date().toISOString(), burst39UnitsSummary, enforceRuns, focus102x60 }, null, 2) + '\n',
        'utf8'
      );
      agent.destroy();
      console.log(`\n📊 [DIAG_ONLY] Đã ghi số đo chẩn đoán tại ${DIAG_SNAPSHOT_PATH}`);
      return;
    }

    // Dò trần chịu tải của 1 bản: qua Nginx 1 IP (150, 200 req/s) & trực tiếp vào backend 1 bản nhiều phiên (150, 220, 300 req/s)
    const ceilingProbes = [];
    for (const [rps, sec, label, port] of [
      [150, 6, 'ceiling_nginx_1ip', NGINX_PORT],
      [200, 6, 'ceiling_nginx_1ip', NGINX_PORT],
      [150, 5, 'ceiling_direct_multi_ip', APP_PORT],
      [220, 5, 'ceiling_direct_multi_ip', APP_PORT],
      [300, 5, 'ceiling_direct_multi_ip', APP_PORT]
    ]) {
      resetAgent();
      await sleep(250);
      const r = await withDeadline(runPacedLoadPhase(rps, sec, label, port), (sec + 35) * 1000, `${label}_${rps}rps`);
      ceilingProbes.push(r);
      console.log(`  • ${r.mode} ${rps} req/s (${r.durationSec}s / wall=${r.wallTimeSec}s): đạt ${r.achievedRps} rps, p95=${r.p95Ms}ms, p99=${r.p99Ms}ms, 2xx=${r.status2xx}/${r.totalRequests} (${r.rate2xxPct}%), 429=${r.status429} (${r.rate429Pct}%), 5xx=${r.status5xx} (${r.rate5xxPct}%)`);
    }

    // Chặn payload & burst auth
    const oversizeApi = await postJson('/api/tickets', { unitCode: 'CNTT', pad: 'x'.repeat(1100 * 1024) }, sessions[1].token);
    assert.strictEqual(oversizeApi.status, 413);

    const chunkedStream = new Readable({ read() {} });
    const chunkedReqPromise = httpRequest(
      agent,
      {
        hostname: '127.0.0.1',
        port: NGINX_PORT,
        path: '/api/sync/split',
        method: 'POST',
        timeout: 30000,
        headers: {
          'content-type': 'application/json',
          'transfer-encoding': 'chunked',
          authorization: `Bearer ${leaderByUnit.get('CNTT').token}`
        }
      },
      chunkedStream
    );
    chunkedStream.push('{"summary":{"unitCode":"CNTT","pad":"');
    const block = 'a'.repeat(512 * 1024);
    for (let k = 0; k < 11; k++) chunkedStream.push(block);
    chunkedStream.push('"}}');
    chunkedStream.push(null);
    const chunked53MbRes = await chunkedReqPromise;
    assert.strictEqual(chunked53MbRes.status, 413);

    const authBurst = await Promise.all(Array.from({ length: 50 }, () => postJson('/api/auth/login', { email: '', password: '' })));
    const nginx429Count = authBurst.filter((r) => r.status === 429 && r.json?.code === 'NGINX_RATE_LIMITED').length;
    assert.ok(nginx429Count > 0);

    // Đối soát cuối Giai đoạn 4 cho toàn bộ 39 đơn vị & kiểm tra từng ID sau tải cao
    await sleep(1200);
    const stage4SweepRes = await Promise.all(
      activeUnits.map(async (u) => {
        const uc = u.ma_don_vi;
        const tok = leaderByUnit.get(uc).token;
        let res = await postJson('/api/tickets/reconcile', { unitCode: uc }, tok);
        let attempt = 0;
        while (res.status === 429 && attempt < 8) {
          attempt += 1;
          const retrySec = Math.min(4, Math.max(1, Number(res.headers['retry-after'] || 2)));
          await sleep(retrySec * 1000 + Math.floor(Math.random() * 200));
          res = await postJson('/api/tickets/reconcile', { unitCode: uc }, tok);
        }
        return res;
      })
    );
    assert.ok(stage4SweepRes.every((r) => r.status === 200), 'Reconcile 39 đơn vị cuối Giai đoạn 4 phải đạt 200 OK hết');
    const stage4IdReconcile = await verifyPerIdApprovedTicketReconciliation({
      pgClient,
      activeUnits,
      phaseLabel: 'stage4_afterHighLoad39Units'
    });
    console.log(`  ✓ Đối soát từng ID [Mốc 3]: ${stage4IdReconcile.totalApprovedDbIds}/${stage4IdReconcile.totalApprovedDbIds} phiếu sau tải cao khớp 100% A2/B1/merge_links (0 thiếu/trùng/mồ côi)`);
    const stage4Sec = Number(((performance.now() - s4T0) / 1000).toFixed(2));

    // =========================================================================
    // GIAI ĐOẠN 5: ĐO THỜI GIAN PHỤC HỒI KHI BẢN DUY NHẤT DỪNG (SIGTERM & SIGKILL)
    // =========================================================================
    const s5T0 = performance.now();
    console.log('\n[5/6] Giai đoạn 5: Đo thời gian phục hồi khi bản duy nhất dừng (SIGTERM & SIGKILL + khóa mồ côi)...');
    resetAgent();
    async function waitEndpoint200(pathUrl) {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        try {
          const r = await getPath(pathUrl, leaderByUnit.get(chaosUnits[0]).token);
          if (r.status === 200) return performance.now();
        } catch { /* retry */ }
        await sleep(20);
      }
      throw new Error(`Recovery timeout on ${pathUrl}`);
    }

    // R1: SIGTERM sạch -> xác nhận Nginx trả 502 trong lúc down -> bật lại ngay -> đo live, ready & API nghiệp vụ trên 20k phiếu
    const r1StopT0 = performance.now();
    await stopProcClean(currentApp.proc, 'SIGTERM');
    const downCheck = await getPath('/api/health/ready');
    const saw502WhileDown = downCheck.status === 502 || downCheck.status === 503;
    const r1SpawnT0 = performance.now();
    currentApp = spawnAppInstance();
    const [r1LiveAt, r1ReadyAt, r1ListAt] = await Promise.all([
      waitEndpoint200('/api/health/live'),
      waitEndpoint200('/api/health/ready'),
      waitEndpoint200(`/api/tickets?unitCode=${chaosUnits[0]}&view=list&limit=50`)
    ]);
    const r1Result = {
      saw502WhileDown,
      stopSignalMs: Number((r1SpawnT0 - r1StopT0).toFixed(1)),
      bootToLiveMs: Number((r1LiveAt - r1SpawnT0).toFixed(1)),
      bootToReadyMs: Number((r1ReadyAt - r1SpawnT0).toFixed(1)),
      bootToList20kMs: Number((r1ListAt - r1SpawnT0).toFixed(1)),
      totalStopToReadyMs: Number((r1ReadyAt - r1StopT0).toFixed(1)),
      totalStopToTrafficMs: Number((r1ListAt - r1StopT0).toFixed(1))
    };

    // R2: SIGKILL đột ngột khi một tiến trình khác đang giữ .lock -> bật lại ngay -> đo thu hồi khóa mồ côi + reconcile 200
    const lockTargetUnit = chaosUnits[4];
    const orphanChild = spawn(
      'node',
      [
        '-e',
        `const fs=require('fs'),p=${JSON.stringify(path.join(locksDir, `unit_wb_${lockTargetUnit}.lock`))};` +
        `const m={pid:process.pid,hostname:${JSON.stringify(os.hostname())},instanceId:'killed-node-proc',lockToken:'tok-r2',acquiredAt:Date.now(),heartbeatAt:Date.now()};` +
        `const fd=fs.openSync(p,'wx');fs.writeFileSync(fd,JSON.stringify(m));fs.closeSync(fd);console.log('R2_LOCKED');setInterval(()=>{},1000);`
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    helperProcs.push(orphanChild);
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('orphanChild timeout')), 5000);
      orphanChild.stdout.on('data', (d) => { if (d.toString().includes('R2_LOCKED')) { clearTimeout(t); resolve(); } });
    });
    const r2KillT0 = performance.now();
    orphanChild.kill('SIGKILL');
    await Promise.all([
      new Promise((resolve) => orphanChild.once('exit', () => resolve())),
      stopProcClean(currentApp.proc, 'SIGKILL')
    ]);
    const r2SpawnT0 = performance.now();
    currentApp = spawnAppInstance();
    const [r2LiveAt, r2ReadyAt] = await Promise.all([
      waitEndpoint200('/api/health/live'),
      waitEndpoint200('/api/health/ready')
    ]);
    const recAfterKillRes = await postJson('/api/tickets/reconcile', { unitCode: lockTargetUnit }, leaderByUnit.get(lockTargetUnit).token);
    assert.strictEqual(recAfterKillRes.status, 200, 'Reconcile ngay sau SIGKILL phải tự thu hồi khóa mồ côi & trả 200');
    const r2ReconcileAt = performance.now();

    const r2Result = {
      bootToLiveMs: Number((r2LiveAt - r2SpawnT0).toFixed(1)),
      bootToReadyMs: Number((r2ReadyAt - r2SpawnT0).toFixed(1)),
      totalKillToReadyMs: Number((r2ReadyAt - r2KillT0).toFixed(1)),
      totalKillToReconcileLockRecoveredMs: Number((r2ReconcileAt - r2KillT0).toFixed(1))
    };
    const recoveryMeasurement = { trial1_sigtermCleanRestart: r1Result, trial2_sigkillWithOrphanLock: r2Result };
    console.log('  ✓ Phục hồi thực đo:', JSON.stringify(recoveryMeasurement));
    const stage5Sec = Number(((performance.now() - s5T0) / 1000).toFixed(2));

    // =========================================================================
    // GIAI ĐOẠN 6: THỬ SAO LƯU pg_dump & KHÔI PHỤC pg_restore TRÊN DB THỬ RIÊNG
    // =========================================================================
    const s6T0 = performance.now();
    console.log('\n[6/6] Giai đoạn 6: Thử sao lưu (pg_dump) & khôi phục (pg_restore) sang CSDL thử riêng utevtvl_restore_verify_db...');
    await stopProcClean(currentApp.proc, 'SIGTERM');

    async function queryDbIntegritySnapshot(client) {
      const res = await client.query(`
        SELECT
          (SELECT count(*)::int FROM public.staff_work_tickets) AS total_tickets,
          (SELECT count(*)::int FROM public.staff_work_tickets WHERE is_archived = false AND is_test_data = false) AS active_tickets,
          (SELECT count(*)::int FROM public.staff_work_tickets WHERE is_archived = false AND is_merged_to_b1_b2 = true) AS merged_tickets,
          (SELECT count(*)::int FROM public.work_survey_versions) AS versions_count,
          (SELECT count(*)::int FROM public.work_survey_status_history) AS history_count,
          (SELECT count(*)::int FROM public.t_tien_do) AS progress_units_count,
          (SELECT count(*)::int FROM public.workbooks) AS workbooks_count,
          (SELECT count(*)::int FROM public.user_accounts) AS accounts_count,
          (SELECT count(*)::int FROM public.unit_mission_counters) AS counters_count,
          (SELECT COALESCE(round(sum(so_sp_nam * phut_thuc_te / 60.0 + gio_bo_sung)::numeric, 4), 0)::float8
             FROM public.staff_work_tickets WHERE is_archived = false AND is_merged_to_b1_b2 = true) AS total_merged_hours
      `);
      return res.rows[0];
    }

    const sourceSnapshot = await queryDbIntegritySnapshot(pgClient);
    const dumpPath = path.join(PG_DIR, 'utevtvl_backup.dump');
    const dumpT0 = performance.now();
    execQuiet(`"${pgDumpBin}" -Fc --no-owner --no-acl -h 127.0.0.1 -p ${PG_PORT} -U utevtvl_admin -d utevtvl_db -f "${dumpPath}"`);
    const dumpDurationMs = Number((performance.now() - dumpT0).toFixed(1));
    const dumpSizeBytes = fs.statSync(dumpPath).size;

    const restoreDbName = 'utevtvl_restore_verify_db';
    execQuiet(`"${createdbBin}" -h 127.0.0.1 -p ${PG_PORT} -U utevtvl_admin ${restoreDbName}`);
    const restoreT0 = performance.now();
    execQuiet(`"${pgRestoreBin}" --no-owner --no-acl -j 2 -h 127.0.0.1 -p ${PG_PORT} -U utevtvl_admin -d ${restoreDbName} "${dumpPath}"`);
    const restoreDurationMs = Number((performance.now() - restoreT0).toFixed(1));

    const verifyPgClient = new Client({ connectionString: `postgresql://utevtvl_admin@127.0.0.1:${PG_PORT}/${restoreDbName}` });
    await verifyPgClient.connect();
    let restoredSnapshot;
    let stage6RestoredIdReconcile;
    try {
      await verifyPgClient.query('ANALYZE');
      restoredSnapshot = await queryDbIntegritySnapshot(verifyPgClient);
      stage6RestoredIdReconcile = await verifyPerIdApprovedTicketReconciliation({
        pgClient: verifyPgClient,
        activeUnits,
        phaseLabel: 'stage6_afterPgRestore39Units'
      });
      console.log(`  ✓ Đối soát từng ID [Mốc 4 - bản pg_restore]: ${stage6RestoredIdReconcile.totalApprovedDbIds}/${stage6RestoredIdReconcile.totalApprovedDbIds} phiếu khớp 100% A2/B1/merge_links (0 thiếu/trùng/mồ côi)`);
    } finally {
      await verifyPgClient.end().catch(() => {});
    }

    assert.deepStrictEqual(restoredSnapshot, sourceSnapshot, 'Bản khôi phục utevtvl_restore_verify_db phải khớp 100% số dòng và tổng giờ với utevtvl_db');
    const restoreHoursDiff = Number(Math.abs(restoredSnapshot.total_merged_hours - sourceSnapshot.total_merged_hours).toFixed(6));

    // Khởi chạy Next.js Standalone sạch RAM trỏ vào CSDL vừa khôi phục & kiểm chứng API nghiệp vụ qua Nginx
    fs.rmSync(path.join(STANDALONE_DIR, '.data'), { recursive: true, force: true });
    resetAgent();
    const restoreAppT0 = performance.now();
    currentApp = spawnAppInstance(restoreDbName);
    await waitForHttp200(`http://127.0.0.1:${APP_PORT}/api/health/ready`, 25000);
    const restoredAppReadyMs = Number((performance.now() - restoreAppT0).toFixed(1));

    const restoredHealthRes = await getPath('/api/health/ready');
    const restoredListRes = await getPath('/api/tickets?unitCode=CNTT&view=list&limit=50', leaderByUnit.get('CNTT').token);
    const restoredOverviewRes = await getPath('/api/admin/overview?unitCode=ALL', adminToken);
    const restoredWbRes = await getPath(`/api/workbooks/${unitMetaMap.get('CNTT').wbId}`, leaderByUnit.get('CNTT').token);

    assert.strictEqual(restoredHealthRes.status, 200);
    assert.strictEqual(restoredListRes.status, 200);
    assert.ok((restoredListRes.json?.items || []).length > 0, 'Danh sách phiếu CNTT sau restore phải có dữ liệu');
    assert.strictEqual(restoredOverviewRes.status, 200);
    assert.strictEqual(restoredOverviewRes.json?.totals?.total, restoredSnapshot.active_tickets, 'Tổng phiếu trên /api/admin/overview phải khớp 100% sau restore');
    assert.strictEqual(restoredWbRes.status, 200);
    assert.ok((restoredWbRes.json?.workbook?.data?.A2 || []).length > 0, 'Bảng tính CNTT sau restore phải giữ đủ dữ liệu biểu A2');

    const backupRestoreVerification = {
      sourceDb: 'utevtvl_db',
      restoredDb: restoreDbName,
      dumpFormat: 'postgresql_custom_compressed (-Fc)',
      dumpDurationMs,
      dumpSizeBytes,
      dumpSizeMb: Number((dumpSizeBytes / (1024 * 1024)).toFixed(2)),
      restoreDurationMs,
      restoredAppReadyMs,
      sourceSnapshot,
      restoredSnapshot,
      exactTableCountsMatch: true,
      hoursDiff: restoreHoursDiff,
      perIdReconciliation: stage6RestoredIdReconcile,
      apiVerificationOnRestoredDb: {
        healthReadyStatus: restoredHealthRes.status,
        cnttListStatus: restoredListRes.status,
        cnttListTotalCount: restoredListRes.json?.totalCount ?? 0,
        overviewStatus: restoredOverviewRes.status,
        overviewTotalsTotal: restoredOverviewRes.json?.totals?.total ?? 0,
        cnttWorkbookStatus: restoredWbRes.status,
        cnttWorkbookA2Rows: restoredWbRes.json?.workbook?.data?.A2?.length ?? 0
      }
    };
    const stage6Sec = Number(((performance.now() - s6T0) / 1000).toFixed(2));
    const stageDurationsSec = {
      stage1_initAndMigrateSec: stage1Sec,
      stage2_functionalAndChaosSec: stage2Sec,
      stage3_seedAndBurst39Sec: stage3Sec,
      stage4_loadAndCeilingSec: stage4Sec,
      stage5_processRecoverySec: stage5Sec,
      stage6_pgDumpAndRestoreSec: stage6Sec,
      totalBenchmarkWallSec: Number(((performance.now() - benchT0) / 1000).toFixed(2))
    };
    console.log(`  ✓ Backup & Restore PASS 100%: dump=${backupRestoreVerification.dumpSizeMb} MB (${dumpDurationMs} ms), restore=${restoreDurationMs} ms, appReady=${restoredAppReadyMs} ms, totalTickets=${restoredSnapshot.total_tickets}, hoursDiff=${restoreHoursDiff}, totalBench=${stageDurationsSec.totalBenchmarkWallSec}s`);

    // =========================================================================
    // XUẤT BÁO CÁO ĐỊNH LƯỢNG VÀO reports/staging-rate-limit-benchmark.{json,md}
    // =========================================================================
    const report = {
      generatedAt: new Date().toISOString(),
      environment: {
        postgresVersion: 'PostgreSQL 16.16 (isolated local cluster port 5439)',
        nginxVersion: 'nginx/1.31.9 (staging port 8360)',
        nextMode: 'next build standalone (port 3369)',
        pgPoolMaxConfigured: 5,
        concurrentSessions: 250,
        activeUnits: 39
      },
      stageDurationsSec,
      healthCheckVerification: {
        liveStatus: liveProbe.status,
        liveBody: liveProbe.json,
        readyStatus: readyProbe.status,
        readyBody: readyProbe.json
      },
      partA_functionalAndChaos: partAResult,
      burst39UnitsSummary,
      perIdReconciliation: [stage2IdReconcile, stage3IdReconcile, stage4IdReconcile, stage6RestoredIdReconcile],
      staticCacheVerification: staticCheck,
      dryRunRuns,
      enforceRuns,
      ceilingProbes,
      recoveryMeasurement,
      backupRestoreVerification,
      thresholdChecks: {
        apiOver1MbStatus: oversizeApi.status,
        chunkedBetween5And6MbNodeStatus: chunked53MbRes.status,
        chunkedNodeCode: chunked53MbRes.json?.code || '',
        nginxAuthBurst50Rejected429Count: nginx429Count
      }
    };

    const reportsDir = path.join(ROOT, 'reports');
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(path.join(reportsDir, 'staging-rate-limit-benchmark.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

    const mdLines = [
      '# Báo cáo nghiệm thu & đo tải Phương án A (20.000 phiếu · 100.000 phiên bản/lịch sử · 250 phiên chung IP)',
      '',
      `- Thời điểm đo: \`${report.generatedAt}\` (Tổng thời lượng chạy benchmark 6 giai đoạn: \`${stageDurationsSec.totalBenchmarkWallSec}s\`)`,
      `- Thời lượng từng giai đoạn: GĐ1=\`${stageDurationsSec.stage1_initAndMigrateSec}s\`, GĐ2=\`${stageDurationsSec.stage2_functionalAndChaosSec}s\`, GĐ3=\`${stageDurationsSec.stage3_seedAndBurst39Sec}s\`, GĐ4=\`${stageDurationsSec.stage4_loadAndCeilingSec}s\`, GĐ5=\`${stageDurationsSec.stage5_processRecoverySec}s\`, GĐ6=\`${stageDurationsSec.stage6_pgDumpAndRestoreSec}s\``,
      `- Cụm thử nghiệm: \`${report.environment.postgresVersion}\`, \`${report.environment.nginxVersion}\`, \`${report.environment.nextMode}\`, \`PG_POOL_MAX=${report.environment.pgPoolMaxConfigured}\``,
      `- Liveness / Readiness: \`/api/health/live\` -> \`${liveProbe.status}\` (\`${JSON.stringify(liveProbe.json)}\`), \`/api/health/ready\` -> \`${readyProbe.status}\` (\`${JSON.stringify(readyProbe.json)}\`).`,
      '',
      '## 1. Nghiệm thu toàn vẹn dữ liệu độc lập (Trước / Sau 10 đơn vị)',
      `- Cách ly đồng nghiệp chung IP trường (login + C1 + duyệt): **ĐẠT**`,
      `- Timeout chờ khóa 8s (\`429 LOCK_ACQUIRE_TIMEOUT\`) & retry idempotent sau nhả khóa: **ĐẠT**`,
      `- Đua 2 người duyệt đồng thời (\`Approve vs Approve\` & \`Approve vs RequestChanges\`): **ĐẠT** (đúng 1 bên 200, 1 bên 400, 0 trùng lịch sử/dòng A2-B1)`,
      `- Tiến trình giữ khóa bị \`SIGKILL\` tự thu hồi khóa mồ côi (\`ESRCH\`): **ĐẠT**`,
      `- Đối soát tổng: \`${partAResult.ticketsTotal}\` phiếu, \`0\` mã trùng, \`${partAResult.versionsCount}\` phiên bản, \`${partAResult.historyTotalCount}\` lịch sử, A2/B1 added \`${partAResult.workbookA2AddedRows}/${partAResult.workbookB1AddedRows}\`, tổng giờ SQL \`${partAResult.totalHoursSql}\` vs Biểu B1 \`${partAResult.totalHoursWbB1}\` (sai số \`${partAResult.hoursDiff}\`).`,
      '',
      '## 2. Đợt dồn tải 39 đơn vị trên nền 20.000 phiếu & 100.000 phiên bản/lịch sử',
      `- Quy mô CSDL trước burst: \`${seedSummary.totalTickets}\` phiếu, \`${seedSummary.totalVersions}\` phiên bản + \`${seedSummary.totalHistory}\` lịch sử (\`${seedSummary.totalVersionAndHistory}\` tổng).`,
      `- Kiểm tra cache nóng ngay sau seed SQL (không restart app): \`BANTT\` reconcile hợp nhất trực tiếp từ PostgreSQL \`${warmAfterSeedReconcileCheck.mergedCount}\` phiếu (\`status=${warmAfterSeedReconcileCheck.status}\`).`,
      `- Wave 1 (39 POST tạo phiếu + 39 POST gộp đồng thời): gộp \`${burst39UnitsSummary.wave1TotalMergedTickets}\` phiếu, sót chưa gộp \`${burst39UnitsSummary.remainingUnmergedApproved}\`, initial 429=\`${burst39UnitsSummary.wave1Initial429}\` (retries=\`${burst39UnitsSummary.wave1Retries}\`), **5xx=\`${burst39UnitsSummary.wave1Initial5xx}\`**, wall=\`${burst39UnitsSummary.wave1WallMs} ms\`, DB Pool wait p95/max=\`${burst39UnitsSummary.wave1PgPool.p95WaitMs ?? 0}/${burst39UnitsSummary.wave1PgPool.maxWaitMs ?? 0} ms\`.`,
      `- Wave 2 xả tải vượt hàng đợi (85 req đồng thời): OK \`${wave2Stats.ok200}\`, 429 \`${wave2Stats.busy429}\`, **5xx \`${wave2Stats.err5xx}\`**.`,
      '',
      '### Đối soát từng ID (`staff_work_tickets` ↔ `A2` ↔ `B1` ↔ `work_survey_merge_links`, 39 đơn vị)',
      '',
      '| Mốc đối soát | Số ĐV | Tổng ID Đã duyệt | Khớp A2 | Khớp B1 | Khớp Merge Links | Cờ chưa gộp | Thiếu A2/B1 | Trùng / Mồ côi |',
      '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
      ...[stage2IdReconcile, stage3IdReconcile, stage4IdReconcile, stage6RestoredIdReconcile].map((x) =>
        `| ${x.phaseLabel} | ${x.unitsChecked} | ${x.totalApprovedDbIds} | ${x.matchedA2Ids} | ${x.matchedB1Ids} | ${x.matchedMergeLinkPairs} | ${x.unmergedFlagCount} | ${x.missingInA2Count}/${x.missingInB1Count} | ${x.duplicateInA2Count + x.duplicateInB1Count}/${x.orphanSourceIdsCount} |`
      ),
      '',
      '## 3. Đo tải 30 / 60 / 100 / 102×60s req/s & dò trần chịu tải 1 bản',
      '',
      '| Chế độ | Mốc (req/s) | Thời lượng (cấu hình / thực tế) | Xả hàng đợi (ms) | Thực đạt tổng / 2xx (req/s) | p50 / p95 / p99 (ms) | 2xx (%) | 429 (%) | 5xx (%) | Chặn nhầm | DB Pool p95 / max (ms) | Đỉnh chờ Pool |',
      '|---|---:|---|---:|---:|---|---:|---:|---:|---:|---|---:|',
      ...[...dryRunRuns, ...enforceRuns, ...ceilingProbes].map((r) =>
        `| ${r.mode} | ${r.targetRps} | ${r.durationSec}s / ${r.wallTimeSec}s | ${r.drainTailMs} | ${r.achievedRps} / ${r.achieved2xxRps} | ${r.p50Ms} / ${r.p95Ms} / ${r.p99Ms} | ${r.rate2xxPct}% (${r.status2xx}/${r.totalRequests}) | ${r.rate429Pct}% | ${r.rate5xxPct}% | ${r.validBlockedCount} | ${r.pgPool.p95WaitMs ?? 0} / ${r.pgPool.maxWaitMs ?? 0} | ${r.pgPool.peakWaitingCount ?? 0} |`
      ),
      ...(() => {
        const focus = enforceRuns.find((r) => r.targetRps === 102 && r.durationSec === 60);
        if (!focus) return [];
        const gateOps = Object.entries(focus.heavyGateDetail?.byOp || {});
        const lockScopes = Object.entries(focus.fileLocksDetail?.byScope || {});
        const distEntries = Object.entries(focus.workloadDistribution || {});
        return [
          '',
          '### Chi tiết mốc 102 req/s × 60s (Tính cả xả hàng đợi)',
          `- Thông lượng thực (gồm xả hàng đợi \`${focus.drainTailMs} ms\`): \`${focus.status2xx}/${focus.totalRequests}\` (\`${focus.rate2xxPct}%\`) trên \`wallTimeSec=${focus.wallTimeSec}s\` => **\`achieved2xxRps = ${focus.achieved2xxRps} req/s\`**, \`429=${focus.status429}\` (\`policyBlocked=${focus.breakdown429?.policyBlockedCount ?? 0}\`, \`overload=${focus.breakdown429?.overloadFalsePositiveCount ?? 0}\`), \`5xx=${focus.status5xx}\`.`,
          `- Phân rã 429 theo mã: \`${JSON.stringify(focus.breakdown429?.byCode || {})}\`; theo API: \`${JSON.stringify(focus.breakdown429?.byApi || {})}\`; theo vai trò: \`${JSON.stringify(focus.breakdown429?.byRole || {})}\`.`,
          '',
          '| Thao tác (HeavyGate / Lock) | Số lượt | Chờ p50 / p95 / max (ms) | Giữ slot/khóa avg / p95 / max (ms) | Từ chối queue / Timeout |',
          '|---|---:|---|---|---|',
          ...gateOps.map(([op, m]) =>
            `| Gate: ${op} | ${m.count} | ${m.waitMs.p50Ms} / ${m.waitMs.p95Ms} / ${m.waitMs.maxMs} | ${m.holdMs.avgMs} / ${m.holdMs.p95Ms} / ${m.holdMs.maxMs} | ${m.rejectedQueueFull} / ${m.waitTimeouts} |`
          ),
          ...lockScopes.map(([sc, m]) =>
            `| FileLock: ${sc} | ${m.count} | ${m.waitMs.p50Ms} / ${m.waitMs.p95Ms} / ${m.waitMs.maxMs} | ${m.holdMs.avgMs} / ${m.holdMs.p95Ms} / ${m.holdMs.maxMs} | ${m.rejectedQueueFull} / ${m.waitTimeouts} |`
          ),
          '',
          '| Nhóm Rate Limit | Khóa đếm | Tổng req | Số đối tượng | Max req / đối tượng | Trần 60s (Burst) | Đạt chính sách |',
          '|---|---|---:|---:|---:|---|---|',
          ...distEntries.map(([g, d]) =>
            `| ${g} | ${d.keyBy} | ${d.totalRequests} | ${d.distinctSubjects} | ${d.maxReqsPerSubject} | ${d.policyLimitPer60s} (${d.policyBurst}) | ${d.withinSustainedPolicy ? 'Có' : 'Không'} |`
          )
        ];
      })(),
      '',
      '## 4. Thời gian phục hồi đo thực tế khi bản duy nhất dừng',
      `- **SIGTERM (restart sạch):** Nginx trả \`502/503\` khi app dừng (\`${r1Result.saw502WhileDown}\`), khởi động lại tới \`/api/health/live\` = \`${r1Result.bootToLiveMs} ms\`, tới \`/api/health/ready\` = \`${r1Result.bootToReadyMs} ms\`, tổng thời gian từ lúc dừng tới sẵn sàng = \`${r1Result.totalStopToReadyMs} ms\`, tới truy vấn 20k phiếu = \`${r1Result.totalStopToTrafficMs} ms\`.`,
      `- **SIGKILL (crash đột ngột khi đang giữ .lock):** tổng thời gian từ lúc kill tới \`/api/health/ready\` = \`${r2Result.totalKillToReadyMs} ms\`, tới thu hồi khóa mồ côi & gộp 200 = \`${r2Result.totalKillToReconcileLockRecoveredMs} ms\`.`,
      '',
      '## 5. Thử sao lưu (pg_dump) & khôi phục (pg_restore) trên CSDL thử riêng',
      `- Tệp sao lưu \`${backupRestoreVerification.dumpFormat}\`: dung lượng \`${backupRestoreVerification.dumpSizeMb} MB\`, thời gian dump \`${dumpDurationMs} ms\`, thời gian restore vào \`${restoreDbName}\` \`${restoreDurationMs} ms\`, app khởi động sẵn sàng \`${restoredAppReadyMs} ms\`.`,
      `- Đối chiếu CSDL sau restore: phiếu \`${restoredSnapshot.total_tickets}\` (hoạt động \`${restoredSnapshot.active_tickets}\`, đã gộp \`${restoredSnapshot.merged_tickets}\`), phiên bản \`${restoredSnapshot.versions_count}\`, lịch sử \`${restoredSnapshot.history_count}\`, \`t_tien_do=${restoredSnapshot.progress_units_count}\`, tài khoản \`${restoredSnapshot.accounts_count}\`, sai số tổng giờ \`${restoreHoursDiff}\` (**KHỚP 100%**).`
    ];
    fs.writeFileSync(path.join(reportsDir, 'staging-rate-limit-benchmark.md'), mdLines.join('\n') + '\n', 'utf8');

    agent.destroy();
    console.log('\n✅ HOÀN TẤT NGHIỆM THU PHƯƠNG ÁN A 20.000 PHIẾU / 100.000 LỊCH SỬ & BACKUP/RESTORE! Báo cáo lưu tại reports/staging-rate-limit-benchmark.{json,md}');
  } finally {
    clearTimeout(globalWatchdog);
    for (const child of helperProcs) {
      if (child && child.exitCode === null) {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }
    }
    await pgClient.end().catch(() => {});
    if (nginxStarted) {
      try {
        const ngxPrefix = execQuiet('/opt/homebrew/bin/brew --prefix nginx').trim();
        execQuiet(`"${path.join(ngxPrefix, 'bin', 'nginx')}" -s stop -c "${path.join(NGINX_DIR, 'nginx.conf')}"`);
      } catch { /* ignore */ }
    }
    if (currentApp?.proc) {
      await stopProcClean(currentApp.proc, 'SIGTERM');
    }
    if (pgStarted) {
      try {
        const pgPrefix = execQuiet('/opt/homebrew/bin/brew --prefix postgresql@16').trim();
        execQuiet(`"${path.join(pgPrefix, 'bin', 'pg_ctl')}" -D "${PG_DIR}" stop -m immediate`);
      } catch { /* ignore */ }
    }
    fs.rmSync(NGINX_DIR, { recursive: true, force: true });
    fs.rmSync(PG_DIR, { recursive: true, force: true });
    fs.rmSync(path.join(STANDALONE_DIR, '.data'), { recursive: true, force: true });
    if (hadMigrationsLog && migrationsLogBackup !== null) {
      fs.writeFileSync(path.join(ROOT, 'migrations.log'), migrationsLogBackup, 'utf8');
    } else if (!hadMigrationsLog && fs.existsSync(path.join(ROOT, 'migrations.log'))) {
      fs.unlinkSync(path.join(ROOT, 'migrations.log'));
    }
  }
}

main().catch((err) => {
  console.error('❌ [STAGING BENCHMARK FAIL]', err);
  process.exit(1);
});
