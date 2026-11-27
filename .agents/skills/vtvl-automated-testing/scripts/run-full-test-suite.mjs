#!/usr/bin/env node
/**
 * Bộ điều phối kiểm thử tự động toàn diện HCM-UTE VTVL 360
 * Chuẩn Google Antigravity Automated Testing, Mocking & QA Verification
 */
import { spawnSync } from 'child_process';

const args = new Set(process.argv.slice(2));
const withBuild = args.has('--with-build');
const withBrowser = args.has('--with-browser');

const suites = [
  { tier: '1. Static & Type', name: 'Prisma Generate', cmd: 'npx', args: ['prisma', 'generate'] },
  { tier: '1. Static & Type', name: 'TypeScript Check', cmd: 'npm', args: ['run', 'typecheck'] },
  { tier: '2. Unit & Brand', name: 'Workflow, Brand & Rule 8', cmd: 'node', args: ['tests/vtvl-workflow.test.mjs'] },
  { tier: '3. Security & RBAC', name: 'RLS & Security Stress (25 vectors)', cmd: 'node', args: ['tests/security-stress-rls.test.mjs'] },
  { tier: '3. Security & RBAC', name: 'Schema Reconciliation (20 cases)', cmd: 'node', args: ['tests/schema-reconciliation.test.mjs'] },
  { tier: '3. Security & RBAC', name: 'RBAC & IDOR Matrix', cmd: 'node', args: ['tests/rbac-matrix.test.mjs'] },
  { tier: '4. Business Flows', name: 'Survey Lifecycle', cmd: 'node', args: ['tests/work-survey-lifecycle.test.mjs'] },
  { tier: '4. Business Flows', name: 'Survey Versioning (18 cases)', cmd: 'node', args: ['tests/work-survey-versioning.test.mjs'] },
  { tier: '4. Business Flows', name: 'Coordinated VTVL Proposals (12 cases)', cmd: 'node', args: ['tests/vtvl-coordinated-proposals.test.mjs'] },
  { tier: '4. Business Flows', name: 'A1 Excel & Required Validation', cmd: 'node', args: ['tests/a1-excel-and-validation.test.mjs'] },
  { tier: '4. Business Flows', name: 'C1 Catalog & Rename', cmd: 'node', args: ['tests/c1-catalog-and-rename.test.mjs'] },
  { tier: '4. Business Flows', name: 'Unit Filter Sync & Audit Logs (16 cases)', cmd: 'node', args: ['tests/unit-filter-sync.test.mjs'] },
  { tier: '4. Business Flows', name: 'Workbook Review Lock (4 steps)', cmd: 'node', args: ['tests/workbook-review-lock.test.mjs'] },
  { tier: '5. Race & Sync', name: 'Unit Code Atomic Migration & Hardening', cmd: 'node', args: ['tests/unit-code-migration-p0.test.mjs'] },
  { tier: '5. Race & Sync', name: 'Clean Init & Stale Cache 409 Guard', cmd: 'node', args: ['tests/workbook-init-and-stale-cache.test.mjs'] },
  { tier: '5. Race & Sync', name: 'C1 Sync, 409 Anti-Loss & A1 Reorder', cmd: 'node', args: ['tests/workbook-sync-and-a1-reorder.test.mjs'] }
];

if (withBuild) {
  suites.push({ tier: '6. Production Build', name: 'Next.js Production Build', cmd: 'npm', args: ['run', 'build'] });
}
if (withBrowser) {
  suites.push({ tier: '6. Browser E2E', name: 'Playwright Browser Lifecycle E2E', cmd: 'node', args: ['tests/browser-e2e-lifecycle.test.mjs'] });
}

console.log('========================================================================');
console.log(' HCM-UTE VTVL 360 — AUTOMATED TESTING & QA VERIFICATION SUITE');
console.log(` Isolation: VTVL_ISOLATED_LOCAL_STORE=true | Suites: ${suites.length}`);
console.log('========================================================================');

const results = [];
const env = { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' };
const startedAll = Date.now();

for (const s of suites) {
  const t0 = Date.now();
  const proc = spawnSync(s.cmd, s.args, { env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const ms = Date.now() - t0;
  const ok = proc.status === 0;
  results.push({ ...s, ok, ms, stderr: ok ? '' : (proc.stderr || proc.stdout || '').slice(-600) });
  const icon = ok ? '✓ [PASS]' : '✗ [FAIL]';
  console.log(`  ${icon} [${s.tier}] ${s.name} (${(ms / 1000).toFixed(1)}s)`);
}

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
const totalSec = ((Date.now() - startedAll) / 1000).toFixed(1);

console.log('------------------------------------------------------------------------');
console.log(` SUMMARY: ${passed}/${results.length} PASS | ${failed.length} FAIL | Total: ${totalSec}s`);
console.log('------------------------------------------------------------------------');

if (failed.length > 0) {
  console.error('\nFAILED SUITES DETAILS:');
  for (const f of failed) {
    console.error(`\n--- ${f.tier} :: ${f.name} ---\n${f.stderr}`);
  }
  process.exit(1);
}
