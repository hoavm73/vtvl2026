import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { spawnSync } from 'child_process';

const root = process.cwd();

console.log('================================================================');
console.log(' BỘ KIỂM THỬ P0-01: ĐỒNG BỘ ĐỔI MÃ ĐƠN VỊ NGUYÊN TỬ (6 KỊCH BẢN)');
console.log(' Bao gồm: OLD->NEW, Trùng mã 409, Lỗi TX Rollback, 0 phiếu, Tương tranh & Rollback ngược');
console.log('================================================================');

const dataDir = path.join(root, '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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
  'work_survey_coordinated_vtvls.json',
  'work_relationships.json'
];

const backups = new Map();
for (const fileName of dataFilesToBackup) {
  const fullPath = path.join(dataDir, fileName);
  backups.set(fullPath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : null);
}

for (const txFile of ['staff_tickets.json', 'work_survey_versions.json', 'user_vtvl_assignments.json', 'work_survey_coordinated_vtvls.json', 'work_relationships.json', 'server_workbooks.json', 'custom_units.json']) {
  const full = path.join(dataDir, txFile);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

const runnerScriptPath = path.join(dataDir, 'temp-p0-unit-migration-runner.ts');

const runnerSource = `
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { NextRequest } from 'next/server';
import { POST as postAdminUnit } from '@/app/api/admin/units/route';
import { POST as postUnitSync } from '@/app/api/admin/units/sync/route';
import { POST as postAuthLogin } from '@/app/api/auth/login/route';
import { POST as postC1Lock } from '@/app/api/admin/c1-lock/route';
import { POST as postSyncSplit } from '@/app/api/sync/split/route';
import { PUT as putWorkbook } from '@/app/api/workbooks/[id]/route';
import { GET as getTickets, POST as postTicket, PATCH as patchTicket } from '@/app/api/tickets/route';
import { GET as getCoordinated } from '@/app/api/tickets/coordinated/route';
import { PUT as putAssignments, GET as getAssignments } from '@/app/api/vtvl-assignments/route';
import { generateUserSessionToken, verifyUserSessionToken } from '@/services/storage/server-auth-guard';
import { resetAllRateLimits } from '@/services/auth/rate-limiter';
import { upsertUserAccount } from '@/services/storage/server-account-store';
import { upsertServerUnit, resetUnitMemoryStore } from '@/services/storage/server-unit-store';
import { setDbTestHook } from '@/services/storage/prisma';
import { getAuditLogs } from '@/services/storage/server-audit-store';
import { migrateTicketsForUnitDetailed } from '@/services/storage/server-unit-migration';
import { replaceUnitCodePrefix } from '@/services/units/unit-synchronizer';
import {
  resetTicketMemoryStore,
  syncTicketsFromSupabase
} from '@/services/storage/server-ticket-store';
import { resetCoordinationMemoryStore } from '@/services/storage/server-coordination-store';
import {
  resetVtvlAssignmentMemoryStore,
  syncVtvlAssignmentsFromSupabase,
  getAllVtvlAssignments
} from '@/services/storage/server-vtvl-assignment-store';
import {
  resetWorkRelationshipsMemoryStore,
  syncWorkRelationshipsFromSupabase
} from '@/services/storage/server-work-relationship-store';
import { resetVersionMemoryStore } from '@/services/storage/server-ticket-version-store';
import { resetWorkbookMemoryStore, getOrCreateWorkbook } from '@/services/storage/server-workbook-store';

let passCount = 0;

async function runCase(id: string, name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passCount += 1;
    console.log(\`  ✓ [PASS] [\${id}] \${name}\`);
  } catch (err: any) {
    console.error(\`  ✗ [FAIL] [\${id}] \${name}:\`, err?.message || err);
    process.exitCode = 1;
    throw err;
  }
}

async function main() {
  resetUnitMemoryStore();
  resetTicketMemoryStore();
  resetCoordinationMemoryStore();
  resetVtvlAssignmentMemoryStore();
  resetWorkRelationshipsMemoryStore();
  resetVersionMemoryStore();
  resetWorkbookMemoryStore();

  // Giả lập bảng DB trong bộ nhớ qua DbTestHook (chỉ cho sync/upsert verification)
  const dbTables: Record<string, Record<string, any>[]> = {
    staff_work_tickets: [],
    user_vtvl_assignments: [],
    work_relationships: [],
    work_survey_versions: []
  };
  const upsertCalls: { table: string; count: number }[] = [];
  let injectDbError = false;

  setDbTestHook({
    upsert: async (table, rows) => {
      upsertCalls.push({ table, count: rows.length });
      if (injectDbError) {
        return { ok: false, status: 500, error: 'Injected DB Transaction Failure' };
      }
      if (!dbTables[table]) dbTables[table] = [];
      for (const row of rows) {
        const idx = dbTables[table].findIndex((r) => r.id && row.id && r.id === row.id);
        if (idx >= 0) dbTables[table][idx] = { ...dbTables[table][idx], ...row };
        else dbTables[table].push(row);
      }
      return { ok: true, status: 201 };
    },
    select: async (table) => dbTables[table] || []
  });

  await upsertUserAccount({
    email: 'tcns@hcmute.edu.vn', displayName: 'Quản trị viên TCNS', unitCode: 'TCNS',
    unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Quản trị viên', role: 'admin',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);

  await upsertServerUnit({
    code: 'OLD_U', nameVi: 'Đơn vị Thử nghiệm Cũ', nameEn: 'Old Unit',
    group: 'trung-tam', domain: 'oldu.hcmute.edu.vn', headTitleVi: 'Giám đốc', headTitleEn: 'Director', defaultStaffCount: 5
  });

  await upsertUserAccount({
    email: 'leader.oldu@hcmute.edu.vn', displayName: 'Lãnh đạo OLD_U', unitCode: 'OLD_U',
    unitNameVi: 'Đơn vị Thử nghiệm Cũ', title: 'Giám đốc', role: 'unit_leader',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'staff.oldu@hcmute.edu.vn', displayName: 'Chuyên viên OLD_U', unitCode: 'OLD_U',
    unitNameVi: 'Đơn vị Thử nghiệm Cũ', title: 'Chuyên viên', role: 'staff',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);
  await upsertUserAccount({
    email: 'staff.cntt@hcmute.edu.vn', displayName: 'Chuyên viên CNTT', unitCode: 'CNTT',
    unitNameVi: 'Khoa Công nghệ Thông tin', title: 'Giảng viên', role: 'staff',
    authProvider: 'email', status: 'active', hasSelectedUnit: true
  }, true);

  const tokAdmin = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
  const tokOldStaff = generateUserSessionToken({ email: 'staff.oldu@hcmute.edu.vn', role: 'staff', unitCode: 'OLD_U' });
  const tokOldLeader = generateUserSessionToken({ email: 'leader.oldu@hcmute.edu.vn', role: 'unit_leader', unitCode: 'OLD_U' });
  const tokCnttStaff = generateUserSessionToken({ email: 'staff.cntt@hcmute.edu.vn', role: 'staff', unitCode: 'CNTT' });

  getOrCreateWorkbook('OLD_U', '01/10/2025–30/9/2026', 'leader.oldu@hcmute.edu.vn', 'Giám đốc');

  // Phân công VTVL cho staff.oldu ở OLD_U
  const assignRes = await putAssignments(new NextRequest('http://localhost:3360/api/vtvl-assignments', {
    method: 'PUT',
    headers: { authorization: 'Bearer ' + tokOldLeader, 'content-type': 'application/json' },
    body: JSON.stringify({
      userEmail: 'staff.oldu@hcmute.edu.vn',
      items: [{ maVtvl: 'OLD_U.VTVL01', tenVtvl: 'Chuyên viên kiểm thử' }]
    })
  }));
  assert.strictEqual(assignRes.status, 200);

  // Phiếu 1: thuộc OLD_U
  const t1Res = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tokOldStaff, 'content-type': 'application/json' },
    body: JSON.stringify({
      unitCode: 'OLD_U', ownerEmail: 'staff.oldu@hcmute.edu.vn', action: 'submit',
      maNhiemVu: 'OLD_U.NV01', maCongViec: 'OLD_U.NV01.CV01', tenCongViec: 'Công việc của đơn vị cũ',
      maVtvl: 'OLD_U.VTVL01', sanPham: 'Báo cáo', chatLuong: 'Đạt', canCu: 'QĐ 2266',
      soSpNam: 10, nguonSoLieu: 'OLD_U', phutThucTe: 60
    })
  }));
  assert.strictEqual(t1Res.status, 200);

  // Phiếu 2: thuộc CNTT nhưng phối hợp tới OLD_U.VTVL01
  const t2Res = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tokCnttStaff, 'content-type': 'application/json' },
    body: JSON.stringify({
      unitCode: 'CNTT', ownerEmail: 'staff.cntt@hcmute.edu.vn', action: 'submit',
      maNhiemVu: 'CNTT.NV01', maCongViec: 'CNTT.NV01.CV99', tenCongViec: 'Công việc phối hợp sang OLD_U',
      maVtvl: 'CNTT.GV01',
      coordinatedVtvls: [{ targetUnitCode: 'OLD_U', maVtvl: 'OLD_U.VTVL01', tenVtvl: 'Chuyên viên kiểm thử', note: 'Phối hợp kiểm thử' }],
      sanPham: 'Biên bản phối hợp', chatLuong: 'Đạt', canCu: 'QĐ 2266',
      soSpNam: 5, nguonSoLieu: 'CNTT', phutThucTe: 45
    })
  }));
  assert.strictEqual(t2Res.status, 200);

  // Tạo sẵn work_relationship thông qua GET /api/tickets/coordinated
  const preCoordRes = await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', {
    headers: { authorization: 'Bearer ' + tokOldStaff }
  }));
  assert.strictEqual(preCoordRes.status, 200);
  const preCoordJson = await preCoordRes.json();
  assert.strictEqual(preCoordJson.items.length, 1, 'Trước khi đổi mã, staff OLD_U phải thấy 1 đề xuất phối hợp');

  await runCase('P0-01', 'OLD_U -> NEW_U cập nhật đồng bộ phiếu, phân công VTVL, quan hệ phối hợp, DB & giữ nguyên sau re-sync', async () => {
    upsertCalls.length = 0;
    const res = await postAdminUnit(new NextRequest('http://localhost:3360/api/admin/units', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
      body: JSON.stringify({
        originalCode: 'OLD_U',
        unit: {
          code: 'NEW_U', nameVi: 'Đơn vị Thử nghiệm Mới', nameEn: 'New Unit',
          group: 'trung-tam', domain: 'newu.hcmute.edu.vn', headTitleVi: 'Giám đốc', headTitleEn: 'Director', defaultStaffCount: 5
        }
      })
    }));
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.migrated.tickets, 1);

    // 1. DbTestHook phải nhận ghi DB (không còn dbCalls === 0 như trước!)
    assert.ok(upsertCalls.some((c) => c.table === 'staff_work_tickets' && c.count >= 2), 'Phải ghi cả phiếu OLD_U và phiếu phối hợp CNTT xuống DB');
    assert.ok(upsertCalls.some((c) => c.table === 'user_vtvl_assignments' && c.count >= 1), 'Phải ghi user_vtvl_assignments xuống DB');
    assert.ok(upsertCalls.some((c) => c.table === 'work_relationships' && c.count >= 1), 'Phải ghi work_relationships xuống DB');

    // 2. File JSON trên đĩa không còn OLD_U trong staff_tickets.json
    const diskTickets = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.data/staff_tickets.json'), 'utf8'));
    assert.strictEqual(diskTickets.filter((t: any) => t.unitCode === 'OLD_U').length, 0, 'File JSON không được còn phiếu mang OLD_U');
    const migratedTicket = diskTickets.find((t: any) => t.unitCode === 'NEW_U');
    assert.ok(migratedTicket, 'Phải tìm thấy phiếu mang NEW_U trên đĩa');
    assert.strictEqual(migratedTicket.maNhiemVu, 'NEW_U.NV01');
    assert.strictEqual(migratedTicket.maCongViec, 'NEW_U.NV01.CV01');
    assert.strictEqual(migratedTicket.maVtvl, 'NEW_U.VTVL01');
    assert.strictEqual(migratedTicket.immutableUnitId, 'OLD_U', 'Phải bảo toàn immutableUnitId gốc');

    // 3. Phiếu phối hợp từ CNTT cũng chuyển targetUnitCode -> NEW_U
    const cnttTicket = diskTickets.find((t: any) => t.unitCode === 'CNTT');
    assert.strictEqual(cnttTicket.coordinatedVtvls[0].targetUnitCode, 'NEW_U');
    assert.strictEqual(cnttTicket.coordinatedVtvls[0].maVtvl, 'NEW_U.VTVL01');

    // 4. Chạy lại đồng bộ từ DB/cache -> dữ liệu vẫn giữ NEW_U (bao gồm đọc ngược từ hook.select)
    assert.strictEqual(replaceUnitCodePrefix('KTX.NV01', 'KT', 'KT_NEW'), 'KTX.NV01', 'Không được thay nhầm tiền tố đơn vị khác');
    assert.strictEqual(replaceUnitCodePrefix('KT.NV01.CV02', 'KT', 'KT_NEW'), 'KT_NEW.NV01.CV02');
    assert.strictEqual(replaceUnitCodePrefix('OLD_U-GV-01', 'OLD_U', 'NEW_U'), 'NEW_U-GV-01');

    resetTicketMemoryStore();
    resetVtvlAssignmentMemoryStore();
    resetWorkRelationshipsMemoryStore();
    const prevIso = process.env.VTVL_ISOLATED_LOCAL_STORE;
    process.env.VTVL_ISOLATED_LOCAL_STORE = 'false';
    await syncWorkRelationshipsFromSupabase();
    process.env.VTVL_ISOLATED_LOCAL_STORE = prevIso;
    await syncTicketsFromSupabase(undefined, true);
    await syncVtvlAssignmentsFromSupabase();
    await syncWorkRelationshipsFromSupabase();
    assert.ok(dbTables.staff_work_tickets.every((r: any) => r.unit_code !== 'OLD_U'), 'DB hook không được còn phiếu OLD_U');
    assert.ok(dbTables.work_relationships.some((r: any) => r.target_unit_code === 'NEW_U' && r.target_vtvl_code === 'NEW_U.VTVL01'), 'DB hook work_relationships phải chuyển sang NEW_U');

    // 5. Giao diện đơn vị mới thấy đủ phiếu, đơn vị cũ không còn phiếu
    const tokNewLeader = generateUserSessionToken({ email: 'leader.oldu@hcmute.edu.vn', role: 'unit_leader', unitCode: 'NEW_U' });
    const newListRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=NEW_U', {
      headers: { authorization: 'Bearer ' + tokNewLeader }
    }));
    const newListJson = await newListRes.json();
    assert.strictEqual(newListJson.unitTickets.length, 1, 'Đơn vị NEW_U phải thấy đủ 1 phiếu');
    assert.strictEqual(newListJson.unitTickets[0].maCongViec, 'NEW_U.NV01.CV01');

    const oldListRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=OLD_U', {
      headers: { authorization: 'Bearer ' + tokAdmin }
    }));
    const oldListJson = await oldListRes.json();
    assert.strictEqual(oldListJson.unitTickets.length, 0, 'Đơn vị OLD_U phải còn 0 phiếu');

    const tokNewStaff = generateUserSessionToken({ email: 'staff.oldu@hcmute.edu.vn', role: 'staff', unitCode: 'NEW_U' });
    const postCoordRes = await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated', {
      headers: { authorization: 'Bearer ' + tokNewStaff }
    }));
    const postCoordJson = await postCoordRes.json();
    assert.strictEqual(postCoordJson.items.length, 1, 'Cán bộ NEW_U phải nhận được đề xuất phối hợp từ CNTT');
    assert.strictEqual(postCoordJson.items[0].matchedVtvls[0].targetUnitCode, 'NEW_U');
    assert.strictEqual(postCoordJson.items[0].matchedVtvls[0].maVtvl, 'NEW_U.VTVL01');

    // 6. Audit Log phải ghi nhận mã cũ, mã mới và số bản ghi đã chuyển
    const logs = getAuditLogs({ unitCode: 'NEW_U' });
    assert.ok(logs.some((l) => l.action === 'ĐỒNG_BỘ_ĐỔI_MÃ_ĐƠN_VỊ' && l.oldValues?.unitCode === 'OLD_U' && l.newValues?.newCode === 'NEW_U'));
  });

  await runCase('P0-02', 'Chặn đổi mã sang mã mới đã tồn tại (NEW_U -> TCNS) trả về HTTP 409', async () => {
    const dupRes = await postAdminUnit(new NextRequest('http://localhost:3360/api/admin/units', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
      body: JSON.stringify({
        originalCode: 'NEW_U',
        unit: {
          code: 'TCNS', nameVi: 'Ghi đè TCNS', nameEn: 'TCNS',
          group: 'phong-ban', domain: 'tcns.hcmute.edu.vn', headTitleVi: 'Trưởng phòng', headTitleEn: 'Director', defaultStaffCount: 10
        }
      })
    }));
    assert.strictEqual(dupRes.status, 409);
    const dupJson = await dupRes.json();
    assert.strictEqual(dupJson.code, 'UNIT_CODE_ALREADY_EXISTS');

    const syncDupRes = await postUnitSync(new NextRequest('http://localhost:3360/api/admin/units/sync', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
      body: JSON.stringify({ oldCode: 'NEW_U', newCode: 'TCNS' })
    }));
    assert.strictEqual(syncDupRes.status, 409);
  });

  await runCase('P0-03', 'Transaction thất bại giữa chừng: DB lỗi không được phép ghi file cục bộ hay thay đổi cache', async () => {
    const beforeTicketsRaw = fs.readFileSync(path.join(process.cwd(), '.data/staff_tickets.json'), 'utf8');
    const beforeUnitsRaw = fs.readFileSync(path.join(process.cwd(), '.data/custom_units.json'), 'utf8');

    // A) Giả lập lỗi giữa chừng trong API POST /api/admin/units
    const failApiRes = await postAdminUnit(new NextRequest('http://localhost:3360/api/admin/units', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
      body: JSON.stringify({
        originalCode: 'NEW_U',
        simulateTxFailure: true,
        unit: {
          code: 'FAIL_U', nameVi: 'Đơn vị Lỗi', nameEn: 'Fail',
          group: 'trung-tam', domain: 'fail.hcmute.edu.vn', headTitleVi: 'Giám đốc', headTitleEn: 'Director', defaultStaffCount: 5
        }
      })
    }));
    assert.strictEqual(failApiRes.status, 500);
    assert.strictEqual(fs.readFileSync(path.join(process.cwd(), '.data/staff_tickets.json'), 'utf8'), beforeTicketsRaw, 'staff_tickets.json phải giữ nguyên khi TX lỗi');
    assert.strictEqual(fs.readFileSync(path.join(process.cwd(), '.data/custom_units.json'), 'utf8'), beforeUnitsRaw, 'custom_units.json phải giữ nguyên khi TX lỗi');

    // B) Giả lập lỗi trực tiếp từ tầng PostgreSQL (injectDbError = true)
    injectDbError = true;
    await assert.rejects(
      () => migrateTicketsForUnitDetailed('NEW_U', 'FAIL2_U'),
      /DB_TICKETS_TX_FAILED|Injected DB Transaction Failure/
    );
    injectDbError = false;
    assert.strictEqual(fs.readFileSync(path.join(process.cwd(), '.data/staff_tickets.json'), 'utf8'), beforeTicketsRaw, 'DB thất bại tuyệt đối không được cập nhật file');
  });

  await runCase('P0-04', 'Đơn vị không có phiếu (EMPTY_OLD -> EMPTY_NEW) đổi mã an toàn không lỗi', async () => {
    await upsertServerUnit({
      code: 'EMPTY_OLD', nameVi: 'Đơn vị Trống Cũ', nameEn: 'Empty Old',
      group: 'trung-tam', domain: 'empty.hcmute.edu.vn', headTitleVi: 'Giám đốc', headTitleEn: 'Director', defaultStaffCount: 3
    });
    const emptyRes = await postAdminUnit(new NextRequest('http://localhost:3360/api/admin/units', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
      body: JSON.stringify({
        originalCode: 'EMPTY_OLD',
        unit: {
          code: 'EMPTY_NEW', nameVi: 'Đơn vị Trống Mới', nameEn: 'Empty New',
          group: 'trung-tam', domain: 'emptynew.hcmute.edu.vn', headTitleVi: 'Giám đốc', headTitleEn: 'Director', defaultStaffCount: 3
        }
      })
    }));
    assert.strictEqual(emptyRes.status, 200);
    const emptyJson = await emptyRes.json();
    assert.strictEqual(emptyJson.migrated.tickets, 0);
  });

  await runCase('P0-05', 'Hai yêu cầu đổi mã đồng thời được khóa tuần tự an toàn, không mất hay hỏng dữ liệu', async () => {
    await upsertServerUnit({
      code: 'CONC_A', nameVi: 'Đơn vị A', nameEn: 'Unit A',
      group: 'trung-tam', domain: 'ca.hcmute.edu.vn', headTitleVi: 'Giám đốc', headTitleEn: 'Director', defaultStaffCount: 4
    });
    await upsertServerUnit({
      code: 'CONC_B', nameVi: 'Đơn vị B', nameEn: 'Unit B',
      group: 'trung-tam', domain: 'cb.hcmute.edu.vn', headTitleVi: 'Giám đốc', headTitleEn: 'Director', defaultStaffCount: 4
    });
    await upsertUserAccount({
      email: 's.conca@hcmute.edu.vn', displayName: 'Staff A', unitCode: 'CONC_A',
      unitNameVi: 'Đơn vị A', title: 'Chuyên viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true
    }, true);
    await upsertUserAccount({
      email: 's.concb@hcmute.edu.vn', displayName: 'Staff B', unitCode: 'CONC_B',
      unitNameVi: 'Đơn vị B', title: 'Chuyên viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true
    }, true);
    const tokA = generateUserSessionToken({ email: 's.conca@hcmute.edu.vn', role: 'staff', unitCode: 'CONC_A' });
    const tokB = generateUserSessionToken({ email: 's.concb@hcmute.edu.vn', role: 'staff', unitCode: 'CONC_B' });

    await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST', headers: { authorization: 'Bearer ' + tokA, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'CONC_A', ownerEmail: 's.conca@hcmute.edu.vn', action: 'save_draft',
        maNhiemVu: 'CONC_A.NV01', maCongViec: 'CONC_A.NV01.CV01', tenCongViec: 'Tác vụ A',
        maVtvl: 'CONC_A.V01', sanPham: 'SP A', chatLuong: 'Đạt', canCu: 'QĐ', soSpNam: 1, nguonSoLieu: 'A', phutThucTe: 10
      })
    }));
    await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
      method: 'POST', headers: { authorization: 'Bearer ' + tokB, 'content-type': 'application/json' },
      body: JSON.stringify({
        unitCode: 'CONC_B', ownerEmail: 's.concb@hcmute.edu.vn', action: 'save_draft',
        maNhiemVu: 'CONC_B.NV01', maCongViec: 'CONC_B.NV01.CV01', tenCongViec: 'Tác vụ B',
        maVtvl: 'CONC_B.V01', sanPham: 'SP B', chatLuong: 'Đạt', canCu: 'QĐ', soSpNam: 1, nguonSoLieu: 'B', phutThucTe: 10
      })
    }));

    const [rA, rB] = await Promise.all([
      postAdminUnit(new NextRequest('http://localhost:3360/api/admin/units', {
        method: 'POST', headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
        body: JSON.stringify({
          originalCode: 'CONC_A',
          unit: { code: 'CONC_A2', nameVi: 'Đơn vị A2', nameEn: 'A2', group: 'trung-tam', domain: 'a2.hcmute.edu.vn', headTitleVi: 'Giám đốc', headTitleEn: 'Director', defaultStaffCount: 4 }
        })
      })),
      postAdminUnit(new NextRequest('http://localhost:3360/api/admin/units', {
        method: 'POST', headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
        body: JSON.stringify({
          originalCode: 'CONC_B',
          unit: { code: 'CONC_B2', nameVi: 'Đơn vị B2', nameEn: 'B2', group: 'trung-tam', domain: 'b2.hcmute.edu.vn', headTitleVi: 'Giám đốc', headTitleEn: 'Director', defaultStaffCount: 4 }
        })
      }))
    ]);
    assert.strictEqual(rA.status, 200);
    assert.strictEqual(rB.status, 200);

    const diskTickets = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.data/staff_tickets.json'), 'utf8'));
    assert.strictEqual(diskTickets.filter((t: any) => t.unitCode === 'CONC_A2').length, 1);
    assert.strictEqual(diskTickets.filter((t: any) => t.unitCode === 'CONC_B2').length, 1);
    assert.strictEqual(diskTickets.filter((t: any) => t.unitCode === 'CONC_A' || t.unitCode === 'CONC_B').length, 0);
  });

  await runCase('P0-06', 'Đổi mã rồi Rollback (NEW_U -> OLD_U) khôi phục đầy đủ toàn bộ phiếu & quan hệ phối hợp', async () => {
    const rbRes = await postAdminUnit(new NextRequest('http://localhost:3360/api/admin/units', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
      body: JSON.stringify({
        originalCode: 'NEW_U',
        unit: {
          code: 'OLD_U', nameVi: 'Đơn vị Thử nghiệm Cũ', nameEn: 'Old Unit',
          group: 'trung-tam', domain: 'oldu.hcmute.edu.vn', headTitleVi: 'Giám đốc', headTitleEn: 'Director', defaultStaffCount: 5
        }
      })
    }));
    assert.strictEqual(rbRes.status, 200);

    const backOldRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=OLD_U', {
      headers: { authorization: 'Bearer ' + tokAdmin }
    }));
    const backOldJson = await backOldRes.json();
    assert.strictEqual(backOldJson.unitTickets.length, 1);
    assert.strictEqual(backOldJson.unitTickets[0].maCongViec, 'OLD_U.NV01.CV01');
    assert.strictEqual(backOldJson.unitTickets[0].immutableUnitId, 'OLD_U');

    const backNewRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=NEW_U', {
      headers: { authorization: 'Bearer ' + tokAdmin }
    }));
    const backNewJson = await backNewRes.json();
    assert.strictEqual(backNewJson.unitTickets.length, 0);

    const assignmentsOld = getAllVtvlAssignments('OLD_U');
    assert.ok(assignmentsOld.some((a) => a.maVtvl === 'OLD_U.VTVL01'), 'Phân công VTVL phải quay về OLD_U.VTVL01');
  });

  await runCase('SEC-TTL', 'P1-02: Token phiên người dùng mặc định cấp TTL 168 giờ (7 ngày) khớp Cookie maxAge', async () => {
    const tok = generateUserSessionToken({ email: 'ttl.check@hcmute.edu.vn', role: 'staff', unitCode: 'CNTT' });
    const decoded = verifyUserSessionToken(tok);
    assert.ok(decoded, 'Token phải hợp lệ');
    const diffHours = (decoded!.expiresAt - Date.now()) / (60 * 60 * 1000);
    assert.ok(diffHours >= 167 && diffHours <= 169, \`TTL mặc định phải ~168h (nhận được \${diffHours}h)\`);
  });

  await runCase('SEC-RL', 'P1-03: Rate Limiter chặn HTTP 429 khi thử sai mật khẩu quá 10 lần trên login & C1 lock', async () => {
    resetAllRateLimits();
    for (let i = 0; i < 10; i++) {
      const r = await postAuthLogin(new NextRequest('http://localhost:3360/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.10.10.88', 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'brute.target@hcmute.edu.vn', password: 'wrong-' + i })
      }));
      assert.strictEqual(r.status, 401);
    }
    const blockedLogin = await postAuthLogin(new NextRequest('http://localhost:3360/api/auth/login', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.10.10.88', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'brute.target@hcmute.edu.vn', password: 'wrong-final' })
    }));
    assert.strictEqual(blockedLogin.status, 429, 'Lần thử sai thứ 11 phải bị chặn HTTP 429');
    const blockedJson = await blockedLogin.json();
    assert.strictEqual(blockedJson.code, 'RATE_LIMITED');
    assert.ok(blockedLogin.headers.get('retry-after'), 'Phải trả về header Retry-After');

    for (let i = 0; i < 10; i++) {
      const c = await postC1Lock(new NextRequest('http://localhost:3360/api/admin/c1-lock', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.10.10.89', 'content-type': 'application/json' },
        body: JSON.stringify({ password: 'bad-c1-password-' + i })
      }));
      assert.strictEqual(c.status, 401);
    }
    const blockedC1 = await postC1Lock(new NextRequest('http://localhost:3360/api/admin/c1-lock', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.10.10.89', 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'bad-c1-password-11' })
    }));
    assert.strictEqual(blockedC1.status, 429, 'Thử sai mật khẩu C1 lần 11 phải bị chặn HTTP 429');
    resetAllRateLimits();
  });

  await runCase('SYNC-KEEP', 'P2-01: POST /api/sync/split bảo toàn serverWorkbook trong t_tien_do.du_lieu_ho_so_json', async () => {
    const cnttWb = getOrCreateWorkbook('CNTT', '01/10/2025–30/9/2026', 'tcns@hcmute.edu.vn', 'Admin');
    dbTables.t_tien_do = [];
    const prevIso = process.env.VTVL_ISOLATED_LOCAL_STORE;
    process.env.VTVL_ISOLATED_LOCAL_STORE = 'false';
    let splitRes: Response;
    try {
      splitRes = await postSyncSplit(new NextRequest('http://localhost:3360/api/sync/split', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
        body: JSON.stringify({
          summary: {
            unitCode: 'CNTT',
            unitNameVi: 'Khoa Công nghệ Thông tin',
            kind: 'khoa-vien',
            version: 2,
            missionCount: 5,
            taskCount: 12,
            vtvlCount: 6,
            totalStandardFte: 10,
            unitFileName: 'CNTT_K2526_v2.xlsx',
            positionBreakdown: []
          }
        })
      }));
    } finally {
      process.env.VTVL_ISOLATED_LOCAL_STORE = prevIso;
    }
    assert.strictEqual(splitRes.status, 200);
    const savedTd = dbTables.t_tien_do[dbTables.t_tien_do.length - 1];
    assert.ok(savedTd?.du_lieu_ho_so_json?.serverWorkbook, 't_tien_do phải giữ nguyên serverWorkbook khi sync/split');
    assert.strictEqual(savedTd.du_lieu_ho_so_json.serverWorkbook.id, cnttWb.id);
  });

  await runCase('SEC-SIZE', 'P2-06: Chặn HTTP 413 PAYLOAD_TOO_LARGE khi Content-Length vượt quá 5MB trên workbook & sync/split', async () => {
    const bigSplit = await postSyncSplit(new NextRequest('http://localhost:3360/api/sync/split', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json', 'content-length': String(6 * 1024 * 1024) },
      body: '{}'
    }));
    assert.strictEqual(bigSplit.status, 413);
    assert.strictEqual((await bigSplit.json()).code, 'PAYLOAD_TOO_LARGE');

    const bigPut = await putWorkbook(
      new NextRequest('http://localhost:3360/api/workbooks/wb_CNTT_2026', {
        method: 'PUT',
        headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json', 'content-length': String(6 * 1024 * 1024) },
        body: '{}'
      }),
      { params: Promise.resolve({ id: 'wb_CNTT_2026' }) }
    );
    assert.strictEqual(bigPut.status, 413);
    assert.strictEqual((await bigPut.json()).code, 'PAYLOAD_TOO_LARGE');
  });

  setDbTestHook(null);
  console.log(\`----------------------------------------------------------------\`);
  console.log(\` TỔNG KẾT P0-01 & HARDENING: \${passCount}/10 KỊCH BẢN PASS\`);
  console.log(\`================================================================\`);
}

main().catch((err) => {
  setDbTestHook(null);
  console.error(err);
  process.exit(1);
});
`;

let exitCode = 0;
try {
  fs.writeFileSync(runnerScriptPath, runnerSource, 'utf8');
  const res = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', runnerScriptPath],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true', DATABASE_URL: '' }
    }
  );
  exitCode = res.status ?? 1;
} finally {
  if (fs.existsSync(runnerScriptPath)) {
    fs.unlinkSync(runnerScriptPath);
  }
  for (const [fullPath, originalContent] of backups.entries()) {
    if (originalContent === null) {
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } else {
      fs.writeFileSync(fullPath, originalContent, 'utf8');
    }
  }
}

process.exit(exitCode);
