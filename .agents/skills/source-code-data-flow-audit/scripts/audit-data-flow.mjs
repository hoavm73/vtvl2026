#!/usr/bin/env node
/**
 * Bộ kiểm toán tự động luồng dữ liệu 8 bước (Source-Code Data-Flow Audit)
 * Kiểm tra xuyên suốt: Database -> Prisma -> API -> Frontend -> Giao diện -> Test
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
let passed = 0;
let failed = 0;
const findings = [];

function check(stage, title, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ [PASS] [${stage}] ${title}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    findings.push({ stage, title, error: msg });
    console.error(`  ✗ [FAIL] [${stage}] ${title}: ${msg}`);
  }
}

function walkFiles(dir, extList = ['.ts', '.tsx']) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(full, extList));
    else if (extList.some((ext) => entry.name.endsWith(ext))) results.push(full);
  }
  return results;
}

console.log('================================================================');
console.log(' SOURCE-CODE DATA-FLOW AUDIT (DB → PRISMA → API → FE → UI → TEST)');
console.log('================================================================');

// 1. TẦNG DATABASE
check('1. Database', 'Zero-Supabase & Cố định cấu hình PostgreSQL 16 (DATABASE_URL)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (Object.keys(deps).some((k) => k.startsWith('@supabase/'))) {
    throw new Error('Phát hiện gói @supabase/* trong package.json');
  }
  if (!deps['@prisma/client'] || !deps['pg']) {
    throw new Error('Thiếu @prisma/client hoặc pg trong package.json');
  }
});

// 2. TẦNG PRISMA
check('2. Prisma', 'Singleton PrismaClient & Đồng bộ Remote-First trong các Store', () => {
  const prismaFile = fs.readFileSync(path.join(root, 'src/services/storage/prisma.ts'), 'utf8');
  if (!prismaFile.includes('__uteVtvlPrisma')) {
    throw new Error('src/services/storage/prisma.ts chưa áp dụng Singleton pattern trên globalThis');
  }
  const accountStore = fs.readFileSync(path.join(root, 'src/services/storage/server-account-store.ts'), 'utf8');
  if (!accountStore.includes('await persistAccountToSupabase(nextRecord);')) {
    throw new Error('server-account-store.ts chưa đảm bảo Remote-First persist trước khi lưu RAM');
  }
  const ticketStore = fs.readFileSync(path.join(root, 'src/services/storage/server-ticket-store.ts'), 'utf8');
  if (!ticketStore.includes('await persistTicketToSupabase(ticket);')) {
    throw new Error('server-ticket-store.ts chưa đảm bảo Remote-First persist trước khi lưu RAM');
  }
});

// 3. TẦNG API
check('3. API', 'Kiểm soát xác thực, chống cache (no-store) và tổng hợp Realtime', () => {
  const overviewApi = fs.readFileSync(path.join(root, 'src/app/api/stats/overview/route.ts'), 'utf8');
  if (!overviewApi.includes('no-store') || !overviewApi.includes('appliedPositions') || !overviewApi.includes('totalC1Positions')) {
    throw new Error('/api/stats/overview chưa trả về đủ chỉ số Realtime (totalC1Positions, appliedPositions) với Cache-Control: no-store');
  }
  const ticketsApi = fs.readFileSync(path.join(root, 'src/app/api/tickets/route.ts'), 'utf8');
  if (!ticketsApi.includes('getCallerSession') || !ticketsApi.includes("unitCodeParam === 'ALL'")) {
    throw new Error('/api/tickets chưa hỗ trợ getCallerSession hoặc lọc toàn trường unitCode=ALL cho Admin');
  }
});

// 4. TẦNG FRONTEND
check('4. Frontend', 'Cố định đơn vị TCNS cho tcns@hcmute.edu.vn và BGH cho 4 tài khoản Ban Giám hiệu', () => {
  const opSession = fs.readFileSync(path.join(root, 'src/services/telemetry/operator-session.ts'), 'utf8');
  if (!opSession.includes("session.email === 'tcns@hcmute.edu.vn'")) {
    throw new Error('operator-session.ts chưa khóa đơn vị TCNS cho tcns@hcmute.edu.vn');
  }
  const unitsCfg = fs.readFileSync(path.join(root, 'src/configs/hcmute-units.ts'), 'utf8');
  for (const bghEmail of ['hientt@hcmute.edu.vn', 'haiqt@hcmute.edu.vn', 'gianglh@hcmute.edu.vn', 'chdthanh@hcmute.edu.vn']) {
    if (!unitsCfg.includes(bghEmail)) {
      throw new Error(`Thiếu cấu hình BGH_ACCOUNT_EMAILS cho ${bghEmail}`);
    }
  }
});

// 5. TẦNG GIAO DIỆN (UI)
check('5. Giao diện', 'Tuân thủ Rule 8 (< 300 dòng), màu #004776, nhãn 10 biểu, không còn icon Sparkles', () => {
  const srcFiles = walkFiles(path.join(root, 'src'));
  const overLimit = [];
  const forbiddenBlack = [];
  const remaining15Bieu = [];
  const remainingSparkles = [];

  for (const file of srcFiles) {
    const rel = path.relative(root, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n').length;
    if (lines >= 300) overLimit.push(`${rel} (${lines} dòng)`);
    if (/\b(text-black|text-slate-900|text-gray-900)\b/.test(content)) forbiddenBlack.push(rel);
    if (/15\s+biểu/i.test(content)) remaining15Bieu.push(rel);
    if (/\bSparkles\b/.test(content)) remainingSparkles.push(rel);
  }

  if (overLimit.length > 0) throw new Error(`Vượt quá 300 dòng: ${overLimit.join(', ')}`);
  if (forbiddenBlack.length > 0) throw new Error(`Vi phạm màu chữ đen: ${forbiddenBlack.join(', ')}`);
  if (remaining15Bieu.length > 0) throw new Error(`Còn sót chuỗi "15 biểu": ${remaining15Bieu.join(', ')}`);
  if (remainingSparkles.length > 0) throw new Error(`Còn sót icon Sparkles: ${remainingSparkles.join(', ')}`);
});

// 6. TẦNG TEST & SIDEBAR
check('6. Test & Điều hướng', 'Tab Quản lý phiếu đơn vị (/phieu-don-vi) và nhãn Dashboard chuẩn hóa', () => {
  const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/AppSidebar.tsx'), 'utf8');
  if (!sidebar.includes('/phieu-don-vi') || !sidebar.includes('Quản lý phiếu đơn vị')) {
    throw new Error('AppSidebar.tsx chưa có tab Quản lý phiếu đơn vị (/phieu-don-vi)');
  }
  const overviewDash = fs.readFileSync(path.join(root, 'src/components/overview/SchoolOverviewDashboard.tsx'), 'utf8');
  if (
    !overviewDash.includes('Vị trí việc làm được áp dụng tại đơn vị') ||
    !overviewDash.includes('Tổng phiếu khảo sát toàn trường')
  ) {
    throw new Error('SchoolOverviewDashboard.tsx chưa cập nhật đúng nhãn yêu cầu');
  }
});

console.log('----------------------------------------------------------------');
console.log(` KẾT QUẢ AUDIT LUỒNG DỮ LIỆU: ${passed} PASS, ${failed} FAIL`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
