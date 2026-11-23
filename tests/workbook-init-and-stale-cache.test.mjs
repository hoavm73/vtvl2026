import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { spawnSync } from 'child_process';

const root = process.cwd();
const dataDir = path.join(root, '.data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let passed = 0;
let failed = 0;

function runTest(id, name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ [PASS] [${id}] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ [FAIL] [${id}] ${name}:`, err?.message || err);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log(' KIỂM THỬ KHỞI TẠO SẠCH A1/C1 & CHỐNG CACHE CŨ GHI NGƯỢC');
console.log(' Mục 7 (Khởi tạo không nạp mẫu), Mục 8 (Revision/IndexedDB), Mục 12 (--execute)');
console.log('================================================================');

const backupNames = [
  'server_accounts.json',
  'accounts.json',
  'server_workbooks.json',
  'deleted_workbooks.json',
  'audit-logs.json',
  'audit_logs.json',
  'staff_tickets.json'
];
const backups = new Map(backupNames.map((f) => {
  const fp = path.join(dataDir, f);
  return [fp, fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null];
}));

const tsRunner = `
import assert from 'assert/strict';
import { NextRequest } from 'next/server';
import { buildDefaultGridWorkbook } from '@/components/excel-grid/excel-grid-defaults';
import { getInitialSeedWorkbooks } from '@/services/storage/server-seed-workbooks';
import { buildScopedDraftKey } from '@/services/storage/indexeddb-storage';
import { getSessionStorageKey } from '@/services/telemetry/operator-session';
import { setCachedValue, getCachedValue, invalidateUnitMutationCache } from '@/services/storage/runtime-cache';
import { upsertUserAccount } from '@/services/storage/server-account-store';
import { generateUserSessionToken } from '@/services/storage/server-auth-guard';
import { getOrCreateWorkbook } from '@/services/storage/server-workbook-store';
import { PUT as putWorkbook } from '@/app/api/workbooks/[id]/route';

async function main() {
  // 1. Mục 7: TCNS giữ nguyên 39 A1 / 6 C1; mọi đơn vị khác khởi tạo A1=[] C1=[]
  const tcnsWb = buildDefaultGridWorkbook('TCNS');
  assert.equal(tcnsWb.A1.length, 39, 'TCNS phải giữ nguyên 39 dòng A1 thực tế');
  assert.equal(tcnsWb.C1.length, 6, 'TCNS phải giữ nguyên 6 dòng C1 thực tế');
  assert(tcnsWb.A2.length > 0 && tcnsWb.C3.length === 6, 'TCNS giữ đủ biểu phụ thuộc');

  for (const uc of ['CNTT', 'SDH', 'CK', 'KT', 'GDQPAN']) {
    const emptyWb = buildDefaultGridWorkbook(uc);
    assert.equal(emptyWb.A1.length, 0, uc + ' phải khởi tạo A1 trống');
    assert.equal(emptyWb.C1.length, 0, uc + ' phải khởi tạo C1 trống');
    for (const depKey of ['A2', 'B1', 'B2_CT', 'B2', 'C2', 'C3', 'D1', 'DU_BAO', 'D2']) {
      assert.equal(emptyWb[depKey].length, 0, uc + '.' + depKey + ' phải khởi tạo trống');
    }
    assert(emptyWb.DM_SP.length > 0, uc + ' phải giữ nguyên danh mục DM_SP chuẩn');
    assert.equal(emptyWb.K.length, 6, uc + ' phải giữ đủ 6 chỉ tiêu kiểm tra K');
    assert(emptyWb.K.every((k) => Number(k.soDongLoi) === 0), uc + ' khởi tạo sạch không được có lỗi K1-K6');
    assert.equal(emptyWb.T.length, 1, uc + ' giữ dòng tổng hợp T_TienDo');
    assert(emptyWb.S.length >= 1, uc + ' giữ nhật ký khởi tạo S_NhatKy');
  }

  // 2. Mục 7: Server seed chỉ giữ TCNS, không pre-create hàng loạt đơn vị khác
  const seeds = getInitialSeedWorkbooks();
  assert.equal(seeds.length, 1, 'Chỉ được pre-create workbook seed cho TCNS');
  assert.equal(seeds[0].unitId, 'TCNS');
  assert.deepEqual(seeds[0].touchedCells, []);

  // 3. Mục 8: IndexedDB key & localStorage key phân tách theo unitCode + userId
  const k1 = buildScopedDraftKey('SDH', 'userA@hcmute.edu.vn');
  const k2 = buildScopedDraftKey('CK', 'userA@hcmute.edu.vn');
  const k3 = buildScopedDraftKey('SDH', 'userB@hcmute.edu.vn');
  assert.notEqual(k1, k2, 'IndexedDB key phải tách theo unitCode');
  assert.notEqual(k1, k3, 'IndexedDB key phải tách theo userId');
  assert(k1.startsWith('SDH::'), 'Key phải mang tiền tố unitCode chuẩn hóa');

  const ls1 = getSessionStorageKey('UserA@hcmute.edu.vn', 'SDH');
  const ls2 = getSessionStorageKey('UserA@hcmute.edu.vn', 'CK');
  assert.notEqual(ls1, ls2, 'localStorage session key phải tách theo unitCode');

  // 4. Mục 8: invalidateUnitMutationCache xóa sạch cache theo unitCode & workbookId
  setCachedValue('wb|u:SDH|wb:wb_SDH_1', { ok: true }, ['workbook'], 60000, true);
  setCachedValue('list|wb:wb_SDH_1', [1], ['workbook'], 60000, true);
  setCachedValue('wb|u:TCNS|wb:wb_TCNS_2026', { keep: true }, ['workbook'], 60000, true);
  invalidateUnitMutationCache('SDH', 'wb_SDH_1');
  assert.equal(getCachedValue('wb|u:SDH|wb:wb_SDH_1', true), undefined, 'Cache theo unitCode phải bị xóa');
  assert.equal(getCachedValue('list|wb:wb_SDH_1', true), undefined, 'Cache theo workbookId phải bị xóa');
  assert.deepEqual(getCachedValue('wb|u:TCNS|wb:wb_TCNS_2026', true), { keep: true }, 'Cache đơn vị khác không bị xóa nhầm');

  // 5. Mục 8: PUT /api/workbooks/[id] chặn revision cũ bằng 409 STALE_CLIENT_REVISION
  await upsertUserAccount({
    email: 'qa.leader.sdh@hcmute.edu.vn', displayName: 'Trưởng đơn vị SDH',
    unitCode: 'SDH', unitNameVi: 'Phòng Đào tạo Sau đại học', title: 'Trưởng phòng',
    role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  const tokenSdh = generateUserSessionToken({ email: 'qa.leader.sdh@hcmute.edu.vn', role: 'unit_leader', unitCode: 'SDH' });
  const wbSdh = getOrCreateWorkbook('SDH', 'Phòng Đào tạo Sau đại học');
  const okPut = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
    method: 'PUT',
    headers: { authorization: 'Bearer ' + tokenSdh, 'content-type': 'application/json' },
    body: JSON.stringify({ baseRevision: wbSdh.currentRevision, data: { ...wbSdh.data, A1: [] } })
  }), { params: Promise.resolve({ id: wbSdh.id }) });
  assert.equal(okPut.status, 200, 'PUT đúng baseRevision phải thành công');
  const okBody = await okPut.json();
  const serverRev = okBody.workbook.currentRevision;
  assert(serverRev > wbSdh.currentRevision, 'Server revision phải tăng sau khi lưu');

  for (const badBaseRev of [serverRev - 1, 0, undefined]) {
    const staleRes = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
      method: 'PUT',
      headers: { authorization: 'Bearer ' + tokenSdh, 'content-type': 'application/json' },
      body: JSON.stringify({ ...(badBaseRev !== undefined ? { baseRevision: badBaseRev } : {}), data: { ...wbSdh.data, A1: [{ id: 'stale-1', maNhiemVu: 'SDH.NV01' }] } })
    }), { params: Promise.resolve({ id: wbSdh.id }) });
    assert.equal(staleRes.status, 409, 'baseRevision=' + String(badBaseRev) + ' < ' + serverRev + ' phải bị chặn 409');
    const staleBody = await staleRes.json();
    assert.equal(staleBody.code, 'STALE_CLIENT_REVISION');
    assert.equal(staleBody.serverRevision, serverRev);
  }
  console.log('TSX_CHECKS_OK');
}

main().catch((e) => { console.error(e); process.exit(1); });
`;

try {
  runTest('INIT-CACHE-01', 'Thực thi TypeScript unit/API tests (khởi tạo sạch A1/C1, phân tách IndexedDB/Cache & 409 STALE_CLIENT_REVISION)', () => {
    const res = spawnSync('npx', ['tsx', '--input-type=module', '-e', tsRunner], {
      cwd: root,
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      encoding: 'utf8'
    });
    if (res.status !== 0) {
      throw new Error(`exit=${res.status}\nstdout=${res.stdout}\nstderr=${res.stderr}`);
    }
    assert(res.stdout.includes('TSX_CHECKS_OK'));
  });
} finally {
  for (const [fp, content] of backups.entries()) {
    if (content === null) { if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    else fs.writeFileSync(fp, content, 'utf8');
  }
}

runTest('INIT-CACHE-02', 'Kiểm tra static guards trên UI/Hook: không còn tự động ghi đè 409/rev=0, có cảnh báo tải lại và khóa mẫu TCNS', () => {
  const hookSrc = fs.readFileSync(path.join(root, 'src/components/excel-grid/useOperatorSession.ts'), 'utf8');
  const viewerSrc = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelWorkbookViewer.tsx'), 'utf8');
  const stateSrc = fs.readFileSync(path.join(root, 'src/components/excel-grid/excel-grid-state.ts'), 'utf8');
  const menuSrc = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelCommandToolsMenu.tsx'), 'utf8');
  const mobileSrc = fs.readFileSync(path.join(root, 'src/components/excel-grid/MobileWorkspaceHeader.tsx'), 'utf8');
  const idbSrc = fs.readFileSync(path.join(root, 'src/services/storage/indexeddb-storage.ts'), 'utf8');

  assert(!hookSrc.includes('savedRev === 0'), 'Không được tự động upload bản local khi savedRev === 0');
  assert(!hookSrc.includes('res.status === 409 && !baseRevOverride'), 'Không được tự động retry ghi đè 409');
  assert(hookSrc.includes('staleClientDetected') && hookSrc.includes('reloadLatestFromServer'), 'Phải xuất state staleClientDetected và reloadLatestFromServer');
  assert(viewerSrc.includes('staleClientDetected') && viewerSrc.includes('Tải lại dữ liệu máy chủ'), 'UI phải hiển thị nút tải lại khi phát hiện bản nháp cũ');
  assert(viewerSrc.includes('text-[#004776]') && !viewerSrc.includes('text-black'), 'Banner tuân thủ màu chữ thương hiệu #004776');
  assert(stateSrc.includes("currentUnit.code.toUpperCase() !== 'TCNS'"), 'handleLoadTcnsData phải chặn ngoài TCNS');
  assert(!menuSrc.includes('Khôi phục dữ liệu mẫu TCNS') && !mobileSrc.includes('Khôi phục dữ liệu mẫu TCNS') && !menuSrc.includes('Nạp gợi ý VTVL') && !mobileSrc.includes('Nạp gợi ý VTVL'), 'Đã ẩn hoàn toàn 2 nút Khôi phục dữ liệu mẫu TCNS và Nạp gợi ý VTVL chuẩn trên menu Công cụ');
  assert(idbSrc.includes('DB_VERSION = 2') && idbSrc.includes('purgeStaleLocalDrafts'), 'IndexedDB phải dùng DB_VERSION=2 và có purgeStaleLocalDrafts');
});

runTest('STAGE3-EXEC-03', 'Script audit-a1-c1-templates.mjs bắt buộc từ chối mọi cờ --execute / --apply / --delete', () => {
  for (const flag of ['--execute', '--apply', '--delete']) {
    const res = spawnSync('npx', ['tsx', 'scripts/audit-a1-c1-templates.mjs', flag], { cwd: root, encoding: 'utf8' });
    assert.notStrictEqual(res.status, 0, `Cờ ${flag} phải bị từ chối với mã thoát khác 0`);
    assert((res.stderr + res.stdout).includes('TỪ CHỐI'), `Thông báo từ chối phải rõ ràng cho ${flag}`);
  }
});

console.log(`\n TỔNG KẾT: ${passed} PASS, ${failed} FAIL\n`);
if (failed > 0) process.exit(1);
