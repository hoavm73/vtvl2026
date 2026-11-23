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
console.log(' KIỂM THỬ DANH MỤC C1 HAI LỚP, ĐỔI TÊN VTVL & TRẠNG THÁI NOT_STARTED');
console.log(' Mục VII, VIII, IX, X, XV & XVIII (Ca 20–27)');
console.log('================================================================');

const backupNames = [
  'server_accounts.json', 'accounts.json', 'server_workbooks.json',
  'deleted_workbooks.json', 'audit-logs.json', 'audit_logs.json',
  'staff_tickets.json', 'vtvl_catalog.json'
];
const backups = new Map(backupNames.map((f) => {
  const fp = path.join(dataDir, f);
  return [fp, fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null];
}));

const tsRunner = `
import assert from 'assert/strict';
import { NextRequest } from 'next/server';
import { upsertUserAccount } from '@/services/storage/server-account-store';
import { generateUserSessionToken } from '@/services/storage/server-auth-guard';
import { getOrCreateWorkbook, getWorkbookForUnitReadOnly, getWorkbookById, saveServerWorkbook } from '@/services/storage/server-workbook-store';
import { resetVtvlCatalogMemoryStore } from '@/services/storage/server-vtvl-catalog-store';
import { getAuditLogs } from '@/services/storage/server-audit-store';
import { buildScopedDraftKey } from '@/services/storage/indexeddb-storage';
import { PUT as putWorkbook } from '@/app/api/workbooks/[id]/route';
import { GET as getPublicCatalog } from '@/app/api/vtvl-catalog/route';
import { POST as postAdminCatalog, PATCH as patchAdminCatalog, DELETE as deleteAdminCatalog } from '@/app/api/admin/vtvl-catalog/route';

async function main() {
  resetVtvlCatalogMemoryStore();

  // 1. IndexedDB v2 key chuẩn unitCode::userId::workbookId
  const kA = buildScopedDraftKey('SDH', 'user@hcmute.edu.vn', 'wb_SDH_1');
  const kB = buildScopedDraftKey('SDH', 'user@hcmute.edu.vn', 'wb_SDH_2');
  assert.equal(kA, 'SDH::user@hcmute.edu.vn::wb_SDH_1');
  assert.notEqual(kA, kB, 'Key IndexedDB v2 phải phân tách theo workbookId');

  // 2. Đơn vị chưa có workbook trả trạng thái not_started, A1=[], C1=[]
  const freshUnit = getWorkbookForUnitReadOnly('KTTT');
  assert.equal(freshUnit.status, 'not_started', 'Đơn vị mới chưa kê khai phải có trạng thái not_started');
  assert.equal(freshUnit.data.A1.length, 0);
  assert.equal(freshUnit.data.C1.length, 0);

  // 3. Khởi tạo tài khoản Admin & Lãnh đạo 2 đơn vị (SDH & CK)
  await upsertUserAccount({
    email: 'qa.admin.c1@hcmute.edu.vn', displayName: 'Admin TCNS', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Quản trị viên', role: 'admin',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'qa.leader.sdh2@hcmute.edu.vn', displayName: 'Trưởng phòng SDH', unitCode: 'SDH',
    unitNameVi: 'Phòng Đào tạo Sau đại học', title: 'Trưởng phòng', role: 'unit_leader',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'qa.leader.ck2@hcmute.edu.vn', displayName: 'Trưởng khoa CK', unitCode: 'CK',
    unitNameVi: 'Khoa Cơ khí Chế tạo máy', title: 'Trưởng khoa', role: 'unit_leader',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);

  const tokAdmin = generateUserSessionToken({ email: 'qa.admin.c1@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
  const tokSdh = generateUserSessionToken({ email: 'qa.leader.sdh2@hcmute.edu.vn', role: 'unit_leader', unitCode: 'SDH' });

  // 4. Đơn vị đọc được danh mục VTVL chuẩn nhưng bị chặn 403 khi gọi API quản trị danh mục
  const pubCat = await getPublicCatalog(new NextRequest('http://localhost:3360/api/vtvl-catalog', { headers: { authorization: 'Bearer ' + tokSdh } }));
  assert.equal(pubCat.status, 200);
  assert((await pubCat.json()).items.length >= 50, 'Danh mục chuẩn phải có đủ mã VTVL hoạt động');

  const forbidPatch = await patchAdminCatalog(new NextRequest('http://localhost:3360/api/admin/vtvl-catalog', {
    method: 'PATCH', headers: { authorization: 'Bearer ' + tokSdh, 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'HT45', name: 'Đơn vị tự đổi tên' })
  }));
  assert.equal(forbidPatch.status, 403, 'Lãnh đạo đơn vị không được sửa danh mục VTVL chuẩn');

  // 5. Đơn vị thêm A1 & chọn C1 chuẩn -> Backend ghi đè tên chuẩn, bỏ qua tên giả mạo từ client
  const wbSdh = getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', 'qa.leader.sdh2@hcmute.edu.vn', 'Trưởng phòng');
  const putValid = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
    method: 'PUT', headers: { authorization: 'Bearer ' + tokSdh, 'content-type': 'application/json' },
    body: JSON.stringify({
      baseRevision: wbSdh.currentRevision,
      data: {
        ...wbSdh.data,
        A1: [{ id: 'a1-real-1', maNhiemVu: 'SDH.NV01', tenNhiemVu: 'Quản lý đào tạo tiến sĩ', canCu: 'QĐ 2266' }],
        C1: [{ id: 'c1-real-1', maVtvl: 'SDH.HT45', tenVtvl: 'TÊN GIẢ MẠO TỪ CLIENT', nhomVtvl4: 'NHÓM GIẢ', maNgach: 'FAKE.99' }]
      }
    })
  }), { params: Promise.resolve({ id: wbSdh.id }) });
  assert.equal(putValid.status, 200);
  const putValidBody = await putValid.json();
  const savedSdh = putValidBody.workbook?.serverWorkbook || getWorkbookById(wbSdh.id)!;
  const savedC1Row = savedSdh.data.C1.find((r: any) => r.id === 'c1-real-1');
  assert.equal(savedC1Row.maVtvl, 'SDH.HT45');
  assert.notEqual(savedC1Row.tenVtvl, 'TÊN GIẢ MẠO TỪ CLIENT', 'Backend phải bỏ qua tên giả mạo do client gửi');
  assert.notEqual(savedC1Row.nhomVtvl4, 'NHÓM GIẢ', 'Backend phải lấy nhóm VTVL chuẩn từ danh mục');
  assert.notEqual(savedC1Row.maNgach, 'FAKE.99', 'Backend phải lấy ngạch chuẩn từ danh mục');

  // 6. Backend từ chối mã ngoài danh mục và mã chéo đơn vị
  const putInvalid = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
    method: 'PUT', headers: { authorization: 'Bearer ' + tokSdh, 'content-type': 'application/json' },
    body: JSON.stringify({ baseRevision: savedSdh.currentRevision, data: { ...savedSdh.data, C1: [...savedSdh.data.C1, { id: 'c1-bad', maVtvl: 'SDH.KHONGTONTAI', tenVtvl: 'Ảo' }] } })
  }), { params: Promise.resolve({ id: wbSdh.id }) });
  assert.equal(putInvalid.status, 400);
  assert.equal((await putInvalid.json()).code, 'INVALID_VTVL_CODE');

  const putCross = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
    method: 'PUT', headers: { authorization: 'Bearer ' + tokSdh, 'content-type': 'application/json' },
    body: JSON.stringify({ baseRevision: savedSdh.currentRevision, data: { ...savedSdh.data, C1: [{ id: 'c1-x', maVtvl: 'TCNS.HT45', tenVtvl: 'X' }] } })
  }), { params: Promise.resolve({ id: wbSdh.id }) });
  assert.equal(putCross.status, 400);
  assert.equal((await putCross.json()).code, 'CROSS_UNIT_VTVL_CODE');

  // 7. Admin không được xóa cứng mã đang được sử dụng (409 VTVL_IN_USE)
  const delInUse = await deleteAdminCatalog(new NextRequest('http://localhost:3360/api/admin/vtvl-catalog?code=HT45', {
    method: 'DELETE', headers: { authorization: 'Bearer ' + tokAdmin }
  }));
  assert.equal(delInUse.status, 409, 'Không được xóa cứng mã VTVL đang được đơn vị sử dụng');
  assert.equal((await delInUse.json()).code, 'VTVL_IN_USE');

  // 8. Admin thêm mã mới rồi ngừng sử dụng -> đơn vị bị chặn 400 INACTIVE_VTVL_CODE
  const addRes = await postAdminCatalog(new NextRequest('http://localhost:3360/api/admin/vtvl-catalog', {
    method: 'POST', headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'CM999', name: 'Chuyên gia kiểm thử chuẩn', groupName: 'II. Nhóm VTVL Chuyên môn, nghiệp vụ', rankTitle: 'V.07.01.03', isActive: false })
  }));
  assert.equal(addRes.status, 201);
  const putInactive = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
    method: 'PUT', headers: { authorization: 'Bearer ' + tokSdh, 'content-type': 'application/json' },
    body: JSON.stringify({ baseRevision: savedSdh.currentRevision, data: { ...savedSdh.data, C1: [...savedSdh.data.C1, { id: 'c1-inact', maVtvl: 'SDH.CM999' }] } })
  }), { params: Promise.resolve({ id: wbSdh.id }) });
  assert.equal(putInactive.status, 400);
  assert.equal((await putInactive.json()).code, 'INACTIVE_VTVL_CODE');

  // 9. Admin đổi tên VTVL: hồ sơ draft (SDH) nhận tên mới; hồ sơ submitted (CK) giữ nguyên snapshot tên cũ; audit log ghi tên cũ & mới
  const wbCk = getOrCreateWorkbook('CK', '01/10/2025–30/9/2026', 'qa.leader.ck2@hcmute.edu.vn', 'Trưởng khoa');
  const origName = savedC1Row.tenVtvl;
  saveServerWorkbook({ workbookId: wbCk.id, baseRevision: wbCk.currentRevision, data: { ...wbCk.data, C1: [{ id: 'c1-ck-1', maVtvl: 'CK.HT45', tenVtvl: origName }] }, actorEmail: 'qa.leader.ck2@hcmute.edu.vn' });
  const ckRef = getWorkbookById(wbCk.id)!;
  ckRef.status = 'submitted';
  const prevSdhRevCount = getWorkbookById(wbSdh.id)!.revisions.length;

  const renameRes = await patchAdminCatalog(new NextRequest('http://localhost:3360/api/admin/vtvl-catalog', {
    method: 'PATCH', headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'HT45', name: 'Chuyên viên hành chính chuẩn (2026)' })
  }));
  assert.equal(renameRes.status, 200);
  const afterSdh = getWorkbookById(wbSdh.id)!;
  const afterCk = getWorkbookById(wbCk.id)!;
  assert.equal(afterSdh.data.C1.find((r: any) => r.id === 'c1-real-1')?.tenVtvl, 'Chuyên viên hành chính chuẩn (2026)', 'Bản nháp phải hiển thị tên VTVL mới');
  assert.equal(afterCk.data.C1.find((r: any) => r.id === 'c1-ck-1')?.tenVtvl, origName, 'Hồ sơ đã gửi (submitted) phải giữ nguyên snapshot tên cũ');
  assert(afterSdh.revisions.length >= prevSdhRevCount, 'Lịch sử revision cũ phải được giữ nguyên');
  const renameLogs = getAuditLogs({ unitCode: 'TCNS', limit: 20 }).filter((l) => l.action === 'VTVL_CATALOG_RENAME' && l.targetId === 'HT45');
  assert(renameLogs.length >= 1, 'Phải ghi nhật ký VTVL_CATALOG_RENAME');
  assert.equal(renameLogs[0].oldValues?.name, origName);
  assert.equal(renameLogs[0].newValues?.name, 'Chuyên viên hành chính chuẩn (2026)');

  console.log('C1_CATALOG_CHECKS_OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
`;

try {
  runTest('C1-CAT-01', 'Thực thi API & Service kiểm thử C1 hai lớp, chống giả mạo tên/mã, Admin đổi tên & snapshot submitted', () => {
    const res = spawnSync('npx', ['tsx', '--input-type=module', '-e', tsRunner], {
      cwd: root, env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' }, encoding: 'utf8'
    });
    if (res.status !== 0) throw new Error(`exit=${res.status}\nstdout=${res.stdout}\nstderr=${res.stderr}`);
    assert(res.stdout.includes('C1_CATALOG_CHECKS_OK'));
  });
} finally {
  for (const [fp, content] of backups.entries()) {
    if (content === null) { if (fs.existsSync(fp)) fs.unlinkSync(fp); }
    else fs.writeFileSync(fp, content, 'utf8');
  }
}

runTest('C1-CAT-02', 'Kiểm tra static UI: C1.maVtvl khóa chọn từ danh mục (allowCustom=false), tenVtvl/nhomVtvl4/maNgach chỉ đọc & banner có tải bản nháp cũ', () => {
  const metas = fs.readFileSync(path.join(root, 'src/components/excel-grid/excel-sheet-metas-core.ts'), 'utf8');
  const viewer = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelWorkbookViewer.tsx'), 'utf8');
  assert(metas.includes("field: 'maVtvl'") && metas.includes('allowCustom: false'), 'C1.maVtvl phải cấm nhập mã ngoài danh mục');
  assert(metas.includes("field: 'tenVtvl'") && metas.includes('isFormula: true'), 'C1.tenVtvl phải là trường chỉ đọc');
  assert(metas.includes("field: 'nhomVtvl4'") && metas.includes("field: 'maNgach'"), 'C1 phải hiển thị nhomVtvl4 & maNgach chuẩn');
  assert(viewer.includes('Tải bản nháp cũ (.json)'), 'Banner cache cũ phải cho phép tải xuống bản nháp cũ');
});

console.log(`\n TỔNG KẾT: ${passed} PASS, ${failed} FAIL\n`);
if (failed > 0) process.exit(1);
