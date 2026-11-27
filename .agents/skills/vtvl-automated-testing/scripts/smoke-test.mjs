#!/usr/bin/env node
/**
 * Smoke Testing siêu nhanh (chỉ đọc, 0 ghi DB) cho HCM-UTE VTVL 360
 * Dùng ngay sau khi deploy production hoặc trên máy local:
 *   node ".agents/skills/vtvl-automated-testing/scripts/smoke-test.mjs"
 *   node ".agents/skills/vtvl-automated-testing/scripts/smoke-test.mjs" http://localhost:3360
 */

const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || 'https://kekhaivtvl.hcmute.edu.vn').replace(/\/+$/, '');
const TIMEOUT_MS = 10_000;

async function req(path, method = 'GET') {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}${path}`, { method, redirect: 'manual', signal: ctrl.signal });
    const text = method === 'HEAD' ? '' : await res.text();
    return { ok: true, status: res.status, ms: Math.round(performance.now() - t0), headers: res.headers, text };
  } catch (err) {
    return { ok: false, status: 0, ms: Math.round(performance.now() - t0), error: err instanceof Error ? err.message : String(err), text: '' };
  } finally {
    clearTimeout(timer);
  }
}

const checks = [
  {
    name: '1. App Liveness (/api/health/live)',
    run: async () => {
      const r = await req('/api/health/live');
      return { pass: r.status === 200 && r.text.includes('"ok"'), detail: `HTTP ${r.status} · ${r.ms}ms` };
    }
  },
  {
    name: '2. PostgreSQL Readiness (/api/health/ready)',
    run: async () => {
      const r = await req('/api/health/ready');
      return { pass: r.status === 200 && r.text.includes('"ready"'), detail: `HTTP ${r.status} · ${r.ms}ms` };
    }
  },
  {
    name: '3. Trang đăng nhập & Quy chuẩn thương hiệu (/login)',
    run: async () => {
      const r = await req('/login');
      const hasBrand = r.text.includes('HCM-UTE') && !/Sư phạm Kỹ thuật/i.test(r.text);
      const hasHeaders = r.headers?.get('x-frame-options') === 'SAMEORIGIN' && r.headers?.get('x-content-type-options') === 'nosniff';
      return { pass: r.status === 200 && hasBrand && hasHeaders, detail: `HTTP ${r.status} · ${r.ms}ms · Headers=${hasHeaders ? 'OK' : 'MISSING'}` };
    }
  },
  {
    name: '4. Cổng Hướng dẫn nghiệp vụ (/huong-dan?doc=1.4)',
    run: async () => {
      const r = await req('/huong-dan?doc=1.4');
      return { pass: r.status === 200 && r.text.length > 2000, detail: `HTTP ${r.status} · ${r.ms}ms` };
    }
  },
  {
    name: '5. Chặn bot tìm kiếm & AI crawler (/robots.txt)',
    run: async () => {
      const r = await req('/robots.txt');
      return { pass: r.status === 200 && r.text.includes('Disallow: /'), detail: `HTTP ${r.status} · ${r.ms}ms` };
    }
  },
  {
    name: '6. Khóa chặt API Quản trị & Bulk Import (401/403)',
    run: async () => {
      const targets = ['/api/admin/load-metrics', '/api/audit-logs', '/api/admin/accounts', '/api/tickets/bulk-import'];
      const rs = await Promise.all(targets.map((p) => req(p, p.includes('bulk-import') ? 'POST' : 'GET')));
      const allBlocked = rs.every((r) => r.status === 401 || r.status === 403);
      return { pass: allBlocked, detail: targets.map((p, i) => `${p.split('/').pop()}=${rs[i].status}`).join(', ') };
    }
  },
  {
    name: '7. Chặn lộ tệp nhạy cảm (/.env & /.git/config)',
    run: async () => {
      const [r1, r2] = await Promise.all([req('/.env'), req('/.git/config')]);
      return { pass: r1.status === 404 && r2.status === 404, detail: `.env=${r1.status}, .git/config=${r2.status}` };
    }
  },
  {
    name: '8. Tài nguyên Video MP4 & Manifest mẫu HD07 (HEAD 200)',
    run: async () => {
      const assets = [
        '/videos/VTVL-01-Lanh-dao-khai-A1-C1-1.5x.mp4',
        '/videos/VTVL-02-Can-bo-giang-vien-ke-khai-1.5x.mp4',
        '/videos/VTVL-03-Lanh-dao-quan-ly-phieu-1.5x.mp4',
        '/mau/manifest.json'
      ];
      const rs = await Promise.all(assets.map((p) => req(p, 'HEAD')));
      const allOk = rs.every((r) => r.status === 200);
      return {
        pass: allOk,
        detail: `${rs.filter((r) => r.status === 200).length}/${assets.length} tệp 200 OK${allOk ? '' : ' (' + assets.filter((_, i) => rs[i].status !== 200).join(', ') + ')'}`
      };
    }
  }
];

(async () => {
  const tStart = performance.now();
  console.log('====================================================================');
  console.log(` HCM-UTE VTVL 360 — SMOKE TEST (${BASE})`);
  console.log('====================================================================');

  let passed = 0;
  let failed = 0;
  for (const c of checks) {
    const res = await c.run();
    if (res.pass) {
      passed += 1;
      console.log(`  ✓ [PASS] ${c.name} (${res.detail})`);
    } else {
      failed += 1;
      console.error(`  ✗ [FAIL] ${c.name} (${res.detail})`);
    }
  }

  const totalSec = ((performance.now() - tStart) / 1000).toFixed(2);
  console.log('--------------------------------------------------------------------');
  console.log(` SMOKE RESULT: ${passed}/${checks.length} PASS | ${failed} FAIL | ${totalSec}s`);
  console.log('--------------------------------------------------------------------');
  if (failed > 0) process.exit(1);
})();
