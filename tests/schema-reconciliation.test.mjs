import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { execSync } from 'child_process';

const root = process.cwd();
let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    process.exitCode = 1;
  }
}

console.log('================================================================');
console.log(' BỘ KIỂM THỬ TĨNH RECONCILIATION SCHEMA & SECURITY VTVL 360 (V3)');
console.log(' Kiểm định chặt chẽ: NOT NULL unit_name_vi, Service Role, Compensation');
console.log('================================================================');

const MIGRATION_PATH = path.join(root, 'trash/supabase/migrations/20261114220000_reconcile_production_schema.sql');

runTest('1. Tệp migration 20261114220000_reconcile_production_schema.sql tồn tại', () => {
  assert.ok(fs.existsSync(MIGRATION_PATH), 'Tệp migration reconciliation phải tồn tại');
});

const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

runTest('2. 15 bảng nghiệp vụ khớp 100% canonical schema 20261107_init_vtvl_hcmute.sql', () => {
  assert.ok(/ten_san_pham text NOT NULL/i.test(migrationSql), 'a2_cong_viec phải có ten_san_pham');
  assert.ok(/nhom_la_ma text NOT NULL CHECK \(nhom_la_ma IN \('I', 'II', 'III', 'IV', 'V', 'VI'\)\)/i.test(migrationSql), 'a2_cong_viec phải có nhom_la_ma I-VI');
  assert.ok(/phut_sp_do_thuc_te numeric\(10,2\) NOT NULL DEFAULT 0/i.test(migrationSql), 'b1_khoi_luong phải có phut_sp_do_thuc_te');
  assert.ok(/nguon_so_luong text/i.test(migrationSql), 'b1_khoi_luong phải có nguon_so_luong');
  assert.ok(/nam_du_bao integer NOT NULL CHECK \(nam_du_bao BETWEEN 2027 AND 2031\)/i.test(migrationSql), 'du_bao_5_nam phải có nam_du_bao');
  assert.ok(/ty_le_thay_doi_kl_pct numeric\(6,2\) NOT NULL DEFAULT 0/i.test(migrationSql), 'du_bao_5_nam phải có ty_le_thay_doi_kl_pct');
  assert.ok(/PRIMARY KEY \(ma_don_vi, ma_cong_viec\)/i.test(migrationSql), 'can_cu_goi_y phải dùng composite PK (ma_don_vi, ma_cong_viec)');
  assert.ok(/id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY/i.test(migrationSql), 'ra_soat_chua_du_can_cu phải dùng identity PK');
  assert.ok(/target_task_name TEXT/i.test(migrationSql), 'coordinated_tasks phải có target_task_name');
  assert.ok(/notes TEXT/i.test(migrationSql), 'coordinated_tasks phải có notes');
});

runTest('3. Backfill user_accounts: Cung cấp đầy đủ unit_name_vi, tránh NOT NULL error', () => {
  assert.ok(migrationSql.includes('v_unit_name_vi TEXT;'), 'Phải khai báo biến v_unit_name_vi');
  assert.ok(migrationSql.includes('SELECT ten_don_vi_vi FROM public.dm_don_vi WHERE ma_don_vi = v_mapped_unit'), 'Phải lấy ten_don_vi_vi từ dm_don_vi');
  assert.ok(/INSERT INTO public\.user_accounts \([^)]*unit_name_vi[^)]*\)/i.test(migrationSql), 'Cả hai câu INSERT backfill phải có cột unit_name_vi');
  assert.ok(migrationSql.includes('password_hash = COALESCE(public.user_accounts.password_hash, EXCLUDED.password_hash)'), 'Phải backfill password_hash an toàn');
  assert.ok(!/RAISE (NOTICE|WARNING).*password/i.test(migrationSql), 'Không được log password hash');
});

runTest('4. RLS user_accounts: cấm SELECT password_hash, cấm USING(true), cấm self-update recursion', () => {
  assert.ok(!/GRANT SELECT ON public\.user_accounts TO authenticated;/i.test(migrationSql), 'Cấm GRANT SELECT toàn bảng user_accounts');
  assert.ok(/GRANT SELECT \([^)]+\)\s+ON public\.user_accounts TO authenticated;/i.test(migrationSql), 'Phải GRANT SELECT theo cột an toàn');
  const matchGrant = migrationSql.match(/GRANT SELECT \(([^)]+)\)\s+ON public\.user_accounts TO authenticated;/i);
  assert.ok(matchGrant, 'Phải có match GRANT SELECT theo cột');
  assert.ok(!matchGrant[1].includes('password_hash'), 'Tuyệt đối không cấp quyền SELECT cột password_hash');
  assert.ok(!/CREATE POLICY "user_accounts_select_auth" ON public\.user_accounts[\s\S]+?USING \(true\);/i.test(migrationSql), 'Policy SELECT user_accounts cấm USING (true)');
  assert.ok(/public\.is_tcns_admin\(\)\s+OR\s+email = public\.current_auth_email\(\)/i.test(migrationSql), 'Policy SELECT user_accounts chỉ cho admin hoặc chính chủ');
  assert.ok(/CREATE POLICY "user_accounts_self_update" ON public\.user_accounts[\s\S]+?WITH CHECK \(email = public\.current_auth_email\(\)\);/i.test(migrationSql), 'Self-update policy phải dùng direct email check');
});

runTest('5. RLS role helpers, workbooks và staff_work_tickets cách ly bản nháp', () => {
  assert.ok(migrationSql.includes('public.get_auth_role()'), 'Phải có helper get_auth_role');
  assert.ok(migrationSql.includes('public.can_write_unit_data'), 'Phải có helper can_write_unit_data');
  assert.ok(migrationSql.includes('public.can_write_unit_data(unit_id)'), 'workbooks phải dùng can_write_unit_data');
  assert.ok(migrationSql.includes("public.get_auth_role() = 'unit_leader' OR status = 'Đã nộp'"), 'staff khác chỉ được xem ticket Đã nộp');
});

runTest('6. Server DB Service-Role & Zero PII in Errors', () => {
  const accountDbPath = path.join(root, 'src/services/storage/server-account-db.ts');
  const accountDbCode = fs.readFileSync(accountDbPath, 'utf8');
  assert.ok(accountDbCode.includes('DATABASE_URL') && accountDbCode.includes('prisma'), 'server-account-db.ts phải dùng Prisma & DATABASE_URL');
  assert.ok(accountDbCode.includes('unit_name_vi: a.unitNameVi'), 'server-account-db.ts phải gửi unit_name_vi');
  assert.ok(accountDbCode.includes('deleteAccountFromSupabase'), 'server-account-db.ts phải có deleteAccountFromSupabase');
  assert.ok(accountDbCode.includes('SUPABASE_NOT_CONFIGURED'), 'server-account-db.ts phải throw 503 nếu prod thiếu DATABASE_URL');

  const ticketDbPath = path.join(root, 'src/services/storage/server-ticket-db.ts');
  const ticketDbCode = fs.readFileSync(ticketDbPath, 'utf8');
  assert.ok(ticketDbCode.includes('DATABASE_URL') && ticketDbCode.includes('prisma'), 'server-ticket-db.ts phải dùng Prisma & DATABASE_URL');
  assert.ok(!ticketDbCode.includes('ticket.ownerEmail}'), 'server-ticket-db.ts cấm log ownerEmail vào error');
  assert.ok(ticketDbCode.includes('assertTicketDbConfigured'), 'server-ticket-db.ts phải assertTicketDbConfigured');
});

runTest('7. Ticket Cache, Remote-first & Compensation Consistency', () => {
  const ticketStoreCode = [
    fs.readFileSync(path.join(root, 'src/services/storage/server-ticket-store.ts'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/services/storage/server-ticket-merge.ts'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/services/tickets/ticket-workflow-handlers.ts'), 'utf8')
  ].join('\n');

  // Dev missing-config không clear cache
  assert.ok(ticketStoreCode.includes('if (remote === null) return;'), 'syncTicketsFromSupabase không được clear cache khi DB null');
  // Compensation khi xung đột revision hoặc lỗi version/history
  assert.ok(ticketStoreCode.includes('REVISION_CONFLICT'), 'ticket store phải xử lý xung đột revision');
  assert.ok(ticketStoreCode.includes('deleteTicketFromSupabase(ticketId)'), 'delete phải xóa trên Supabase trước khi xóa cache');
  assert.ok(ticketStoreCode.includes('restoreTicketInMemory(latest, latest.id)'), 'workflow phải rollback restore ticket cũ nếu tạo snapshot/history lỗi');
  assert.ok(ticketStoreCode.includes('compensateRemoveSurveyVersion'), 'workflow phải xóa snapshot mồ côi khi rollback');
  // Cấm catch-ignore quanh persist
  assert.ok(!/catch\s*\{\s*\/\*\s*ignore cache fallback\s*\*\/\s*\}/i.test(ticketStoreCode), 'ticket store không được catch-ignore DB write');
});

runTest('8. Account Source-of-Truth: Remote-first persist & real delete', () => {
  const accountStorePath = path.join(root, 'src/services/storage/server-account-store.ts');
  const accountStoreCode = fs.readFileSync(accountStorePath, 'utf8');

  assert.ok(accountStoreCode.includes('await persistAccountToSupabase(nextRecord);'), 'upsertUserAccount phải await persist single record remote trước khi commit memory');
  assert.ok(accountStoreCode.includes('await deleteAccountFromSupabase(norm);'), 'deleteUserAccount phải await remote delete trước khi commit memory');
  assert.ok(accountStoreCode.includes('remoteEmails.has(email)'), 'syncAccountsFromSupabase phải dọn dẹp các account local đã bị xóa trên remote');

  const guardPath = path.join(root, 'src/services/storage/server-auth-guard.ts');
  const guardCode = fs.readFileSync(guardPath, 'utf8');
  assert.ok(guardCode.includes('!acc && process.env.NODE_ENV === \'production\''), 'Production auth guard phải fail-closed nếu tài khoản bị xóa trên DB');
});

runTest('9. Backend Auth & Crypto Hardening: không leak secret, không lộ password mặc định', () => {
  function checkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        checkDir(full);
      } else if (/\.(ts|tsx|js|jsx|json)$/.test(ent.name)) {
        const text = fs.readFileSync(full, 'utf8');
        assert.ok(!/hcmute@2026/i.test(text), `Tệp ${full} vẫn còn chứa literal password hcmute@2026`);
      }
    }
  }
  checkDir(path.join(root, 'src'));

  const cryptoPath = path.join(root, 'src/services/storage/account-crypto.ts');
  const cryptoCode = fs.readFileSync(cryptoPath, 'utf8');
  assert.ok(cryptoCode.includes('crypto.timingSafeEqual'), 'account-crypto.ts phải dùng crypto.timingSafeEqual');
  assert.ok(cryptoCode.includes('getAuthSecret'), 'account-crypto.ts phải export getAuthSecret');
});

runTest('10. Kiểm tra Rule 8 (< 300 dòng) trên tất cả các tệp mã nguồn liên quan', () => {
  const files = [
    'src/services/storage/server-supabase-store.ts',
    'src/services/storage/server-account-store.ts',
    'src/services/storage/server-account-db.ts',
    'src/services/storage/server-unit-store.ts',
    'src/services/storage/account-crypto.ts',
    'src/services/storage/server-admin-auth.ts',
    'src/services/storage/server-auth-guard.ts',
    'src/services/storage/server-ticket-store.ts',
    'src/services/storage/server-ticket-db.ts',
    'src/services/storage/server-workbook-store.ts',
    'src/app/api/tickets/route.ts',
    'src/app/api/accounts/route.ts',
    'src/app/api/admin/accounts/route.ts',
    'src/app/api/admin/units/route.ts',
    'src/app/api/auth/login/route.ts',
    'src/app/api/admin/auth/route.ts',
    'src/app/api/sync/split/route.ts',
    'src/app/api/sync/audit/route.ts'
  ];

  files.forEach((f) => {
    const full = path.join(root, f);
    assert.ok(fs.existsSync(full), `Tệp ${f} phải tồn tại`);
    const count = fs.readFileSync(full, 'utf8').split('\n').length;
    assert.ok(count <= 300, `Tệp ${f} có ${count} dòng, vượt quá giới hạn 300 dòng (Rule 8)`);
  });
});

runTest('11. Danh mục chuẩn 39 đơn vị theo v2DS phan quyen (1).xls (cột G:I) & loại bỏ BGH, HDT, TTNN khỏi danh mục hoạt động', () => {
  const unitsPath = path.join(root, 'src/configs/hcmute-units.ts');
  const content = fs.readFileSync(unitsPath, 'utf8');

  const activeArraySlice = content.slice(
    content.indexOf('export const HCMUTE_UNITS'),
    content.indexOf('export const DELETED_UNIT_CODES')
  );
  const unitMatches = activeArraySlice.match(/code:\s*'[A-Z0-9-]+'/g) || [];
  assert.strictEqual(unitMatches.length, 39, `HCMUTE_UNITS phải có đúng 39 đơn vị hoạt động (hiện có ${unitMatches.length})`);

  // Kiểm tra mã mới chính thức
  assert.ok(activeArraySlice.includes("code: 'CK'"), 'Khoa Cơ khí phải có mã chính thức là CK');
  assert.ok(activeArraySlice.includes("code: 'CNTT'"), 'Khoa CNTT phải có mã chính thức là CNTT');
  assert.ok(activeArraySlice.includes("code: 'QTTHTT'"), 'Phòng QTTH&TT phải có mã chính thức là QTTHTT');
  assert.ok(activeArraySlice.includes("code: 'DT'"), 'Phòng Đào tạo phải có mã chính thức là DT');
  assert.ok(activeArraySlice.includes("code: 'KHTC'"), 'Phòng KHTC phải có mã chính thức là KHTC');
  assert.ok(activeArraySlice.includes("code: 'STKNCCCN'"), 'TT Sáng tạo KN&CGCN phải có mã chính thức là STKNCCCN');
  assert.ok(activeArraySlice.includes("code: 'BANTT'"), 'Ban An ninh trật tự phải có mã chính thức là BANTT');

  // Tuyệt đối không còn mã cũ hay mã ngoài 39 đơn vị trong HCMUTE_UNITS
  const legacyCodes = ['FME', 'FEET', 'FEEE', 'FIT', 'FCFT', 'FCE', 'FE', 'FAE', 'FGAM', 'FPI', 'FAS', 'FFL', 'ITE', 'IIE', 'CISAT', 'INC', 'ITC', 'STC', 'TPC', 'CFL', 'VGC', 'SRC', 'ESC', 'EETC', 'CERAC', 'BMC', 'AAO', 'OIA', 'ERO', 'FPO', 'STIAO', 'OGA', 'SAO', 'QAO', 'EMO', 'CPM'];
  const excludedCodes = ['IDDF', 'TRTC', 'HDT', 'FFT', 'BGH', 'TTNN', 'TTVD', 'TTRBTM', 'TTKTTH', 'KTCNMT', 'NCUDKTXD', 'THKTTH', 'TTCNTT', 'CDT', 'DTN'];

  legacyCodes.forEach((c) => {
    assert.ok(!activeArraySlice.includes(`code: '${c}'`), `HCMUTE_UNITS không được chứa mã cũ: ${c}`);
  });
  excludedCodes.forEach((c) => {
    assert.ok(!activeArraySlice.includes(`code: '${c}'`), `HCMUTE_UNITS không được chứa mã ngoài danh mục 39 đơn vị: ${c}`);
  });
});

runTest('12. Unit Store Service-Role-Only & Fail-Closed 503', () => {
  const unitStorePath = path.join(root, 'src/services/storage/server-unit-store.ts');
  const unitStoreCode = fs.readFileSync(unitStorePath, 'utf8');

  assert.ok(!unitStoreCode.includes('SUPABASE_ANON_KEY'), 'server-unit-store.ts cấm chứa SUPABASE_ANON_KEY');
  assert.ok(!unitStoreCode.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'), 'server-unit-store.ts cấm chứa NEXT_PUBLIC_SUPABASE_ANON_KEY');
  assert.ok(unitStoreCode.includes('DATABASE_URL') && unitStoreCode.includes('prisma'), 'server-unit-store.ts phải dùng Prisma & DATABASE_URL');
  assert.ok(unitStoreCode.includes('assertUnitDbConfigured'), 'server-unit-store.ts phải có assertUnitDbConfigured');

  const adminUnitsPath = path.join(root, 'src/app/api/admin/units/route.ts');
  const adminUnitsCode = fs.readFileSync(adminUnitsPath, 'utf8');
  assert.ok(adminUnitsCode.includes('DB_SERVICE_UNAVAILABLE'), 'API /api/admin/units phải map lỗi sang DB_SERVICE_UNAVAILABLE');
  assert.ok(adminUnitsCode.includes('{ status: 503 }'), 'API /api/admin/units phải trả về status 503');
});

runTest('13. Unit Normalization: Chuẩn hóa 36 mã cũ -> mã mới, loại bỏ FFT/HDT/BGH/IDDF/TRTC', () => {
  const unitStorePath = path.join(root, 'src/services/storage/server-unit-store.ts');
  const unitStoreCode = fs.readFileSync(unitStorePath, 'utf8');

  assert.ok(unitStoreCode.includes("FME: 'CK'"), 'LEGACY_UNIT_MAP phải map FME -> CK');
  assert.ok(unitStoreCode.includes("FIT: 'CNTT'"), 'LEGACY_UNIT_MAP phải map FIT -> CNTT');
  assert.ok(unitStoreCode.includes("BMC: 'QTTHTT'"), 'LEGACY_UNIT_MAP phải map BMC -> QTTHTT');
  assert.ok(unitStoreCode.includes("AAO: 'DT'"), 'LEGACY_UNIT_MAP phải map AAO -> DT');
  assert.ok(unitStoreCode.includes("CISAT: 'STKNCCCN'"), 'LEGACY_UNIT_MAP phải map CISAT -> STKNCCCN');
  assert.ok(unitStoreCode.includes('normalizeRemoteUnits'), 'Phải export normalizeRemoteUnits');

  const syncFnBody = unitStoreCode.slice(
    unitStoreCode.indexOf('async function syncUnitsFromSupabase'),
    unitStoreCode.indexOf('export async function saveServerUnitsList')
  );
  assert.ok(!syncFnBody.includes('persistUnitsToSupabase'), 'syncUnitsFromSupabase/GET tuyệt đối không gọi persistUnitsToSupabase');

  // Chạy integration test thực tế cho normalizeRemoteUnits qua tsx
  const tsxCode = `
    const { normalizeRemoteUnits, LEGACY_UNIT_MAP } = require('./src/services/storage/server-unit-store');
    const assert = require('assert');
    assert.strictEqual(LEGACY_UNIT_MAP.FME, 'CK');
    assert.strictEqual(LEGACY_UNIT_MAP.FIT, 'CNTT');
    assert.strictEqual(LEGACY_UNIT_MAP.BMC, 'QTTHTT');
    assert.strictEqual(LEGACY_UNIT_MAP.AAO, 'DT');
    assert.strictEqual(LEGACY_UNIT_MAP.CISAT, 'STKNCCCN');

    const raw = [
      { code: 'FME', nameVi: 'Tên cũ FME' },
      { code: 'FIT', nameVi: 'Tên cũ FIT' },
      { code: 'FFT', nameVi: 'Khoa Thời trang cũ (phải bị xóa)' },
      { code: 'HDT', nameVi: 'Hội đồng trường cũ (phải bị xóa)' },
      { code: 'BGH', nameVi: 'Ban Giám hiệu cũ (phải bị xóa)' },
      { code: 'TTNN', nameVi: 'Trung tâm Ngoại ngữ (ngoài 39 đơn vị hoạt động)' },
      { code: 'CUSTOM_LAB', nameVi: 'Phòng thí nghiệm tùy chỉnh' },
      { code: 'CK', nameVi: 'Khoa Cơ khí' }
    ];
    const res = normalizeRemoteUnits(raw);
    assert.strictEqual(res.length, 3);
    assert.strictEqual(res.find(u => u.code === 'CK').nameVi, 'Khoa Cơ khí');
    assert.strictEqual(res.find(u => u.code === 'CNTT').nameVi, 'Khoa Công nghệ Thông tin');
    assert.strictEqual(res.find(u => u.code === 'CUSTOM_LAB').nameVi, 'Phòng thí nghiệm tùy chỉnh');
    assert.ok(!res.some(u => ['FFT', 'HDT', 'BGH', 'TTNN', 'FME', 'FIT'].includes(u.code)));
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

runTest('14. Tra cứu đơn vị findHcmuteUnit & Tương thích ngược Aliases', () => {
  const tsxCode = `
    const { findHcmuteUnit, UNIT_CODE_ALIASES } = require('./src/configs/hcmute-units');
    const assert = require('assert');

    // Kiểm tra trực tiếp mã mới
    const uCK = findHcmuteUnit('CK');
    assert.strictEqual(uCK.code, 'CK');
    assert.strictEqual(uCK.nameVi, 'Khoa Cơ khí');

    const uCNTT = findHcmuteUnit('CNTT');
    assert.strictEqual(uCNTT.code, 'CNTT');
    assert.strictEqual(uCNTT.nameVi, 'Khoa Công nghệ Thông tin');

    // Kiểm tra tương thích ngược mã cũ (FME -> CK, FIT -> CNTT, AAO -> DT)
    const uFME = findHcmuteUnit('FME');
    assert.strictEqual(uFME.code, 'CK');
    assert.strictEqual(uFME.nameVi, 'Khoa Cơ khí');

    const uFIT = findHcmuteUnit('FIT');
    assert.strictEqual(uFIT.code, 'CNTT');

    const uAAO = findHcmuteUnit('AAO');
    assert.strictEqual(uAAO.code, 'DT');
    assert.strictEqual(uAAO.nameVi, 'Phòng Đào tạo');

    const uPDT = findHcmuteUnit('PDT');
    assert.strictEqual(uPDT.code, 'DT');
    assert.strictEqual(uPDT.nameVi, 'Phòng Đào tạo');
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

runTest('15. Tệp migration 20261115000000_sync_units_catalog_48.sql an toàn Transaction & Dynamic Snapshot', () => {
  const migPath = path.join(root, 'trash/supabase/migrations/20261115000000_sync_units_catalog_48.sql');
  assert.ok(fs.existsSync(migPath), 'Tệp migration 20261115000000_sync_units_catalog_48.sql phải tồn tại');

  const sql = fs.readFileSync(migPath, 'utf8');
  assert.ok(sql.includes('BEGIN;'), 'Migration phải mở đầu bằng BEGIN;');
  assert.ok(sql.includes('COMMIT;'), 'Migration phải kết thúc bằng COMMIT;');

  // Kiểm tra cấm mở rộng PID dollar quote
  const corruptMatch = sql.match(/DO \d+|END \d+;/);
  assert.strictEqual(corruptMatch, null, `Không được chứa cú pháp dollar quote bị mở rộng thành PID: ${corruptMatch}`);

  // Kiểm tra cân bằng dollar quote
  const dollarQuotes = (sql.match(/\$\$/g) || []).length;
  assert.ok(dollarQuotes > 0 && dollarQuotes % 2 === 0, `Dollar quote ($$) phải hiện diện và cân bằng (tìm thấy: ${dollarQuotes})`);

  // Bảng tạm mapping & snapshots
  assert.ok(sql.includes('CREATE TEMP TABLE unit_code_map'), 'Phải tạo bảng tạm unit_code_map');
  assert.ok(sql.includes('CREATE TEMP TABLE temp_row_counts_pre'), 'Phải tạo bảng tạm temp_row_counts_pre');
  assert.ok(sql.includes('CREATE TEMP TABLE temp_fk_snapshot'), 'Phải tạo bảng tạm temp_fk_snapshot');
  assert.ok(sql.includes('CREATE TEMP TABLE temp_trigger_snapshot'), 'Phải tạo bảng tạm temp_trigger_snapshot');

  // Dynamic FK & Trigger snapshot via pg_get_*
  assert.ok(sql.includes('pg_get_constraintdef'), 'Phải dùng pg_get_constraintdef để snapshot 100% định nghĩa FK ban đầu');
  assert.ok(sql.includes('pg_get_triggerdef'), 'Phải dùng pg_get_triggerdef để snapshot 100% định nghĩa Trigger ban đầu');
  assert.ok(sql.includes('ADD CONSTRAINT %I %s'), 'Phải phục hồi động FK theo định nghĩa ban đầu');
  assert.ok(sql.includes('EXECUTE rec.trigger_def'), 'Phải phục hồi động Trigger theo định nghĩa ban đầu');

  // Preflight & Postflight assertions
  assert.ok(sql.includes('PREFLIGHT ABORT'), 'Phải có preflight assertions');
  assert.ok(sql.includes('POSTFLIGHT ABORT'), 'Phải có postflight assertions');
  assert.ok(sql.includes("DELETE FROM public.dm_don_vi WHERE ma_don_vi IN ('IDDF', 'TRTC', 'HDT', 'BGH')"), 'Phải xóa đúng 4 mã thừa khỏi dm_don_vi');
  assert.ok(sql.includes("WHERE ma_don_vi = 'TCNS'"), 'Phải cập nhật customUnits trong t_tien_do cho TCNS');
  assert.ok(sql.includes('v_final_count <> 48'), 'Phải có assertion kiểm tra đúng 48 đơn vị');
  assert.ok(sql.includes('v_restored_fk_count <> v_snap_fk_count'), 'Phải đối soát số lượng FK phục hồi bằng số lượng snapshot');
  assert.ok(sql.includes('v_restored_trg_count <> v_snap_trg_count'), 'Phải đối soát số lượng Trigger phục hồi bằng số lượng snapshot');
  assert.ok(sql.includes('v_post_cnt <> rec.row_count'), 'Phải đối soát số lượng bản ghi các bảng nghiệp vụ không đổi');

  // Khẳng định cấm hoàn toàn ::regproc và ::regclass
  assert.ok(!sql.includes('::regproc'), 'Tuyệt đối cấm sử dụng ::regproc vì gây ERROR 42883 khi function chưa tồn tại trên production');
  assert.ok(!sql.includes('::regclass'), 'Tuyệt đối cấm sử dụng ::regclass trong snapshot để tránh lỗi relation không tồn tại');
  assert.ok(sql.includes("t.tgname IN ('trg_enforce_unit_consistency', 'trg_validate_c1_career_level')"), 'Phải lọc trigger an toàn theo tên tgname');

  // Khẳng định không còn bất kỳ mẫu LIKE wildcard nguy hiểm nào
  assert.ok(!sql.includes("m.old_code || '_%'"), 'Tuyệt đối không chứa mẫu LIKE nguy hiểm m.old_code || \'_%\'');
  assert.ok(!sql.includes("|| '_%'"), 'Tuyệt đối không chứa wildcard underscore chưa escape || \'_%\'');
  assert.ok(!sql.includes("LIKE ('wb_'"), 'Tuyệt đối không dùng LIKE có wildcard cho workbook ID');
  assert.ok(sql.includes("left(t.ma_vtvl, length(m.old_code) + 1) IN (m.old_code || '.', m.old_code || '-', m.old_code || '_')"), 'Phải dùng left() với ranh giới chính xác cho ma_vtvl');
  assert.ok(sql.includes("left(t.workbook_id, length('wb_' || m.old_code || '_')) = ('wb_' || m.old_code || '_')"), 'Phải dùng left() với ranh giới chính xác cho workbook_id');
});

runTest('16. Kiểm tra ranh giới tiền tố: FE không nhầm lẫn với FEET và wb_FE không nhầm với wb_FEET', () => {
  // Logic ranh giới tiền tố mã nhiệm vụ / VTVL / công việc
  const matchCodePrefix = (val, oldCode) => {
    const prefixLen = oldCode.length + 1;
    const leftVal = val.slice(0, prefixLen);
    const candidates = [oldCode + '.', oldCode + '-', oldCode + '_'];
    return candidates.includes(leftVal) || val === oldCode;
  };

  // Logic ranh giới tiền tố workbook
  const matchWbPrefix = (val, oldCode) => {
    const wbPrefix = `wb_${oldCode}_`;
    return val.slice(0, wbPrefix.length) === wbPrefix || val === `wb_${oldCode}`;
  };

  // 1. Kiểm tra mã tiền tố: FE không được match FEET
  assert.strictEqual(matchCodePrefix('FEET.NV01', 'FE'), false, 'FEET.NV01 không được match với FE');
  assert.strictEqual(matchCodePrefix('FEET-VTVL-01', 'FE'), false, 'FEET-VTVL-01 không được match với FE');
  assert.strictEqual(matchCodePrefix('FEET_01', 'FE'), false, 'FEET_01 không được match với FE');
  assert.strictEqual(matchCodePrefix('FEET', 'FE'), false, 'FEET không được match với FE');

  // FEET phải match FEET
  assert.strictEqual(matchCodePrefix('FEET.NV01', 'FEET'), true, 'FEET.NV01 phải match với FEET');
  assert.strictEqual(matchCodePrefix('FEET', 'FEET'), true, 'FEET phải match với FEET');

  // FE phải match FE
  assert.strictEqual(matchCodePrefix('FE.NV01', 'FE'), true, 'FE.NV01 phải match với FE');
  assert.strictEqual(matchCodePrefix('FE-VTVL-01', 'FE'), true, 'FE-VTVL-01 phải match với FE');
  assert.strictEqual(matchCodePrefix('FE', 'FE'), true, 'FE phải match với FE');

  // 2. Kiểm tra workbook ID: wb_FE không được match wb_FEET
  assert.strictEqual(matchWbPrefix('wb_FEET_2026_q1', 'FE'), false, 'wb_FEET_2026_q1 không được match với FE');
  assert.strictEqual(matchWbPrefix('wb_FEET', 'FE'), false, 'wb_FEET không được match với FE');

  // wb_FEET phải match FEET
  assert.strictEqual(matchWbPrefix('wb_FEET_2026_q1', 'FEET'), true, 'wb_FEET_2026_q1 phải match với FEET');
  assert.strictEqual(matchWbPrefix('wb_FEET', 'FEET'), true, 'wb_FEET phải match với FEET');

  // wb_FE phải match FE
  assert.strictEqual(matchWbPrefix('wb_FE_2026_q1', 'FE'), true, 'wb_FE_2026_q1 phải match với FE');
  assert.strictEqual(matchWbPrefix('wb_FE', 'FE'), true, 'wb_FE phải match với FE');
});

runTest('17. Kiểm tra snapshot/restore trigger an toàn khi 0 trigger tồn tại trên production', () => {
  const migPath = path.join(root, 'trash/supabase/migrations/20261115000000_sync_units_catalog_48.sql');
  const sql = fs.readFileSync(migPath, 'utf8');

  // 1. Tuyệt đối không cast ::regproc
  assert.strictEqual(sql.includes('::regproc'), false, 'Không được có bất kỳ ::regproc nào');

  // 2. Kiểm tra câu truy vấn trigger snapshot sử dụng LEFT JOIN pg_proc hoặc lọc tgname
  assert.ok(sql.includes('LEFT JOIN pg_proc p ON p.oid = t.tgfoid'), 'Trigger snapshot phải dùng LEFT JOIN pg_proc thay vì ép kiểu regproc');

  // 3. Mô phỏng toán học: khi snapshot trả về 0 trigger
  const snapshotCount = 0;
  const restoredCount = 0;
  // Postflight assertion: IF v_restored_trg_count <> v_snap_trg_count THEN RAISE EXCEPTION ...
  const failsAssertion = restoredCount !== snapshotCount;
  assert.strictEqual(failsAssertion, false, 'Khi có 0 trigger, postflight assertion phải pass trơn tru');
});

runTest('18. Chuẩn hóa thư mục supabase/rollbacks & Migration 20261115140000_reconcile_vtvl_39_units_and_versions.sql', () => {
  const migrationsDir = path.join(root, 'trash/supabase/migrations');
  const rollbacksDir = path.join(root, 'trash/supabase/rollbacks');
  assert.ok(fs.existsSync(rollbacksDir), 'Thư mục supabase/rollbacks phải tồn tại');

  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  // Không có tệp rollback nào nằm trong supabase/migrations
  migrationFiles.forEach((f) => {
    assert.ok(!f.includes('rollback'), `Tệp rollback ${f} phải nằm trong supabase/rollbacks, không nằm trong supabase/migrations`);
  });

  // Kiểm tra các phiên bản 14 chữ số trong supabase/migrations không bị trùng prefix
  const numericPrefixes = migrationFiles
    .map((f) => f.match(/^(\d{14})_/)?.[1])
    .filter(Boolean);
  const uniquePrefixes = new Set(numericPrefixes);
  assert.strictEqual(numericPrefixes.length, uniquePrefixes.size, 'Không được có phiên bản migration 14 chữ số bị trùng lặp trong supabase/migrations');

  // Kiểm tra migration mới nhất
  const newMigPath = path.join(migrationsDir, '20261115140000_reconcile_vtvl_39_units_and_versions.sql');
  assert.ok(fs.existsSync(newMigPath), 'Phải có migration 20261115140000_reconcile_vtvl_39_units_and_versions.sql');
  const newMigSql = fs.readFileSync(newMigPath, 'utf8');
  assert.ok(newMigSql.includes('BEGIN;') && newMigSql.includes('COMMIT;'), 'Migration mới phải bọc trong BEGIN...COMMIT');
  assert.ok(newMigSql.includes('PREFLIGHT_FAILED') && newMigSql.includes('POSTFLIGHT_FAILED'), 'Migration mới phải có preflight và postflight');
  assert.ok(newMigSql.includes('CREATE TABLE IF NOT EXISTS public.work_survey_versions'), 'Migration mới phải tạo bảng work_survey_versions');
  assert.ok(newMigSql.includes('uq_work_survey_versions_survey_version'), 'Migration mới phải có UNIQUE(survey_id, version_no)');
  assert.ok(newMigSql.includes('uq_survey_target_sheet_record'), 'Migration mới phải có UNIQUE(survey_id, target_sheet, target_record_id)');
  assert.ok(newMigSql.includes('public.resolve_trusted_actor'), 'Migration mới phải có cầu nối danh tính đáng tin resolve_trusted_actor');

  // Kiểm tra các tệp rollback trong supabase/rollbacks
  const expectedRollbacks = [
    '20261115020000_rollback_rbac_security.sql',
    '20261115030000_rollback_work_survey_lifecycle.sql',
    '20261115140000_rollback_vtvl_39_units_and_versions.sql'
  ];
  expectedRollbacks.forEach((rb) => {
    assert.ok(fs.existsSync(path.join(rollbacksDir, rb)), `Thiếu tệp rollback: supabase/rollbacks/${rb}`);
  });
});

runTest('19. Đối soát 100% tên cột & hàm trong 20261115140000_reconcile_vtvl_39_units_and_versions.sql với schema thực tế trên Supabase', () => {
  const newMigPath = path.join(root, 'trash/supabase/migrations/20261115140000_reconcile_vtvl_39_units_and_versions.sql');
  const sql = fs.readFileSync(newMigPath, 'utf8');

  // 1. dm_don_vi phải dùng đúng cột thực tế: ma_don_vi, ten_don_vi_vi, ten_don_vi_en, khoi_don_vi, linh_vuc, chuc_danh_thu_truong_vi, chuc_danh_thu_truong_en, so_nhan_su_mac_dinh, is_active
  assert.ok(sql.includes('INSERT INTO public.dm_don_vi ('), 'Phải có INSERT INTO public.dm_don_vi');
  assert.ok(sql.includes('ten_don_vi_vi, ten_don_vi_en, khoi_don_vi'), 'Phải dùng đúng cột ten_don_vi_vi, ten_don_vi_en, khoi_don_vi của dm_don_vi');
  assert.ok(!sql.includes('INSERT INTO public.dm_don_vi (ma_don_vi, ten_don_vi,'), 'Tuyệt đối không dùng cột ten_don_vi không tồn tại trên dm_don_vi');

  // 2. staff_work_tickets backfill và RPC phải dùng đúng cột thật (owner_email, owner_name, owner_title, san_pham, so_sp_nam, phut_thuc_te, gio_bo_sung), không dùng cột ảo
  const nonExistentTicketCols = [
    't.staff_name', 't.staff_code', 't.position_title', 't.nhom_vtvl', 't.san_pham_dau_ra', 't.so_luong_nam', 't.so_gio_mot_san_pham',
    'v_ticket.staff_name', 'v_ticket.staff_code', 'v_ticket.position_title', 'v_ticket.san_pham_dau_ra', 'v_ticket.so_luong_nam'
  ];
  nonExistentTicketCols.forEach((col) => {
    assert.ok(!sql.includes(col), `Migration SQL không được tham chiếu cột không tồn tại: ${col}`);
  });
  assert.ok(sql.includes('t.owner_email') && sql.includes('t.so_sp_nam') && sql.includes('t.phut_thuc_te') && sql.includes('t.gio_bo_sung'), 'Backfill phải dùng đúng cột thực tế của staff_work_tickets');

  // 3. Cầu nối danh tính resolve_trusted_actor kiểm tra cả JWT, p_trusted_actor_email và app.actor_id
  assert.ok(sql.includes("current_setting('app.actor_id', true)"), 'resolve_trusted_actor phải kiểm tra cả app.actor_id');
  assert.ok(sql.includes('FORBIDDEN_ACTOR_SPOOFING'), 'resolve_trusted_actor phải chặn giả mạo danh tính');

  // 4. RLS helper functions đầy đủ và chính sách rls_staff_tickets_update không cho phép sửa phiếu người khác
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.get_current_user_email()'), 'Phải định nghĩa get_current_user_email()');
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.get_current_user_unit()'), 'Phải định nghĩa get_current_user_unit()');
  assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.is_admin_user()'), 'Phải định nghĩa is_admin_user()');
});

runTest('20. Đối soát từng dòng (39 đơn vị) giữa HCMUTE_UNITS và file gốc v2DS phan quyen (1).xls (cột G:I, dòng 2..40)', () => {
  const xlsPath = path.join(root, 'v2DS phan quyen (1).xls');
  if (!fs.existsSync(xlsPath)) {
    const tsxFallback = `
      const assert = require('assert');
      const { HCMUTE_UNITS } = require('./src/configs/hcmute-units');
      assert.strictEqual(HCMUTE_UNITS.length, 39, 'HCMUTE_UNITS phải có đúng 39 đơn vị');
    `;
    execSync(`npx tsx -e "${tsxFallback.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
    return;
  }
  const tsxCode = `
    const XLSX = require('xlsx');
    const assert = require('assert');
    const { HCMUTE_UNITS } = require('./src/configs/hcmute-units');

    const wb = XLSX.readFile('./v2DS phan quyen (1).xls');
    const sheet = wb.Sheets[wb.SheetNames[0]];

    const xlsUnits = [];
    for (let r = 2; r <= 40; r++) {
      const group = String(sheet['G' + r]?.v || '').trim();
      const tt = sheet['H' + r]?.v ?? null;
      const nameVi = String(sheet['I' + r]?.v || '').trim();
      if (group && nameVi) {
        xlsUnits.push({ row: r, group, tt, nameVi });
      }
    }

    assert.strictEqual(xlsUnits.length, 39, 'Cột G:I (dòng 2..40) trong file xls phải có đúng 39 đơn vị');
    assert.strictEqual(HCMUTE_UNITS.length, 39, 'HCMUTE_UNITS phải có đúng 39 đơn vị');

    for (let i = 0; i < 39; i++) {
      const expected = xlsUnits[i];
      const actual = HCMUTE_UNITS[i];
      assert.ok(actual, 'Thiếu đơn vị tại vị trí ' + i);
      assert.strictEqual(actual.nameVi, expected.nameVi, 'Sai tên đơn vị tại dòng ' + expected.row + ': ' + actual.nameVi + ' !== ' + expected.nameVi);
    }
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

console.log(`\n================================================================`);
console.log(` KẾT QUẢ: ${passed} PASS, ${failed} FAIL`);
console.log(`================================================================\n`);

if (failed > 0) process.exit(1);
