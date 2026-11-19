import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { execSync } from 'node:child_process';

const root = process.cwd();
const readSrc = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    throw err;
  }
}

console.log('\n================================================================');
console.log(' KIỂM THỬ ĐỒNG BỘ 1 BỘ LỌC ĐƠN VỊ & BẢO TOÀN PHIÊN ADMIN');
console.log('================================================================\n');

test('TC1: Trang /nghiep-vu-don-vi chỉ giữ 1 bộ lọc đơn vị ở header và ẩn bộ lọc trùng lặp ở bảng tính + sơ đồ', () => {
  const page = readSrc('src/app/nghiep-vu-don-vi/page.tsx');
  assert.ok(page.includes('id="unit-workspace-select"'), 'Header phải có bộ lọc unit-workspace-select cho Admin');
  assert.ok(page.includes('<ExcelWorkbookViewer initialUnitCode={selectedUnitCode} requestedUnitCode={selectedUnitCode} initialSheet={sheetParam} hideUnitSelector={true}'), 'Phải truyền requestedUnitCode={selectedUnitCode} và hideUnitSelector={true} cho ExcelWorkbookViewer');
  assert.ok(page.includes('<UnitOrgTreeModal isOpen={true} inline={true} hideUnitSelector={true} onClose={() => handleSelectTab(\'overview\')} defaultUnitCode={selectedUnitCode}'), 'Phải truyền hideUnitSelector={true} và defaultUnitCode={selectedUnitCode} cho UnitOrgTreeModal');
  assert.ok(page.includes('[{activeUnit.code}] {activeUnit.nameVi}'), 'Non-admin phải hiển thị 1 badge tĩnh đơn vị ở header');
});

test('TC2: Trang thẩm định TcnsReviewDetailPanel khóa bộ lọc chọn đơn vị khác trong tab Bảng biểu', () => {
  const panel = readSrc('src/components/admin/TcnsReviewDetailPanel.tsx');
  assert.ok(panel.includes('<ExcelWorkbookViewer initialUnitCode={unit.code} requestedUnitCode={unit.code} hideUnitSelector={true}'), 'TcnsReviewDetailPanel phải khóa unit selector trong ExcelWorkbookViewer');
});

test('TC3: Trang độc lập /bang-tinh vẫn giữ nguyên bộ lọc chọn đơn vị', () => {
  const bangTinh = readSrc('src/app/bang-tinh/page.tsx');
  assert.ok(!bangTinh.includes('hideUnitSelector={true}'), '/bang-tinh độc lập không được ẩn unit selector');
  assert.ok(bangTinh.includes('<ExcelWorkbookViewer'), '/bang-tinh phải render ExcelWorkbookViewer');
});

test('TC4: ExcelWorkbookViewer phản ứng theo mọi lần đổi requestedUnitCode (không khóa cứng bởi adminManualUnitRef)', () => {
  const viewer = readSrc('src/components/excel-grid/ExcelWorkbookViewer.tsx');
  assert.ok(!viewer.includes('adminManualUnitRef'), 'Không còn ref adminManualUnitRef làm đóng băng đơn vị');
  assert.ok(viewer.includes('lastRequestedUnitRef'), 'Phải dùng lastRequestedUnitRef để theo dõi thay đổi requestedUnitCode');
  assert.ok(viewer.includes('lastRequestedUnitRef.current !== reqUpper'), 'Phải cập nhật lại grid & server workbook mỗi khi requestedUnitCode đổi sang đơn vị khác');
  assert.ok(viewer.includes('useOperatorSession(requestedUnitCode)'), 'Phải truyền requestedUnitCode vào useOperatorSession');
  assert.ok(viewer.includes('Boolean(requestedUnitCode)'), 'Phải báo hasExplicitUnit cho useExcelGridState khi có requestedUnitCode');
  assert.ok(viewer.includes('hideUnitSelector={hideUnitSelector}'), 'Phải truyền hideUnitSelector xuống header và OrgTree modal');
});

test('TC5: Header bảng tính Desktop & Mobile hỗ trợ hideUnitSelector để không nhân đôi bộ lọc', () => {
  const card = readSrc('src/components/excel-grid/ScientificWorkspaceCard.tsx');
  const row = readSrc('src/components/excel-grid/WorkspaceHeaderRow.tsx');
  const mob = readSrc('src/components/excel-grid/MobileWorkspaceHeader.tsx');
  const org = readSrc('src/components/admin/UnitOrgTreeModal.tsx');
  assert.ok(card.includes('hideUnitSelector?: boolean') && card.includes('hideUnitSelector={props.hideUnitSelector}'));
  assert.ok(row.includes('hideUnitSelector = false') && row.includes('{!hideUnitSelector &&'));
  assert.ok(mob.includes('hideUnitSelector?: boolean') && mob.includes('!props.hideUnitSelector'));
  assert.ok(org.includes('hideUnitSelector?: boolean') && org.includes('{showUnitPicker &&'));
});

test('TC6: useOperatorSession bảo toàn session.unitCode của mọi Admin và tải đúng viewingUnitRef khi window.focus', () => {
  const hook = readSrc('src/components/excel-grid/useOperatorSession.ts');
  assert.ok(hook.includes('viewingUnitRef'), 'Phải lưu viewingUnitRef để onFocusSync tải đúng đơn vị đang xem');
  assert.ok(hook.includes("cur?.role === 'admin' || cur?.email === 'tcns@hcmute.edu.vn'"), 'Không ghi đè đơn vị gốc trong localStorage đối với mọi tài khoản Admin');
  assert.ok(hook.includes("cur.role === 'admin' && viewingUnitRef.current ? viewingUnitRef.current"), 'Khi sync hoặc focus phải ưu tiên viewingUnitRef cho Admin');
});

test('TC7: useExcelGridState không để localStorage ghi đè initialUnitCode khi hasExplicitUnit=true', () => {
  const state = readSrc('src/components/excel-grid/excel-grid-state.ts');
  assert.ok(state.includes('hasExplicitUnit = false'), 'useExcelGridState phải hỗ trợ cờ hasExplicitUnit');
  assert.ok(state.includes('hasExplicitUnit ? findHcmuteUnit(initialUnitCode).code : getInitialUnitCode(initialUnitCode)'), 'Khi hasExplicitUnit=true phải dùng mã đơn vị truyền xuống thay vì đọc đè từ localStorage');
});

test('TC8: Kiểm thử thực thi resolveSafeUnitCode & verifyWorkbookContextMatch qua npx tsx', () => {
  const tmpRunner = path.join(root, '.data', '_tmp_unit_filter_check.ts');
  fs.mkdirSync(path.dirname(tmpRunner), { recursive: true });
  fs.writeFileSync(
    tmpRunner,
    `
import assert from 'node:assert';
import { resolveSafeUnitCode, verifyWorkbookContextMatch, getCanonicalWorkbookId } from '../src/services/context/workbook-context';

// Admin đổi qua lại nhiều đơn vị hợp lệ -> luôn nhận đúng đơn vị yêu cầu
assert.strictEqual(resolveSafeUnitCode({ role: 'admin', unitCode: 'TCNS' }, 'CNTT'), 'CNTT');
assert.strictEqual(resolveSafeUnitCode({ role: 'admin', unitCode: 'TCNS' }, 'STKNCCCN'), 'STKNCCCN');
assert.strictEqual(resolveSafeUnitCode({ role: 'admin', unitCode: 'TCNS' }, 'CK'), 'CK');

// Non-admin luôn bị khóa đúng đơn vị của phiên, không nhảy sang đơn vị khác
assert.strictEqual(resolveSafeUnitCode({ role: 'unit_leader', unitCode: 'CK' }, 'STKNCCCN'), 'CK');
assert.strictEqual(resolveSafeUnitCode({ role: 'staff', unitCode: 'CNTT' }, 'TCNS'), 'CNTT');

// Đối chiếu ngữ cảnh workbook không bị lệch đơn vị
assert.strictEqual(verifyWorkbookContextMatch({ expectedUnitCode: 'STKNCCCN', workbookUnitCode: 'STKNCCCN' }).valid, true);
assert.strictEqual(verifyWorkbookContextMatch({ expectedUnitCode: 'STKNCCCN', workbookUnitCode: 'CNTT' }).valid, false);
assert.strictEqual(getCanonicalWorkbookId('STKNCCCN'), 'wb_STKNCCCN_2026');
`,
    'utf8'
  );
  try {
    execSync(`npx tsx "${tmpRunner}"`, { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(tmpRunner)) fs.unlinkSync(tmpRunner);
  }
});

test('TC9: UnitTicketsFilterBar và UnitWorkspaceTicketsPanel bỏ tiêu đề lặp & bỏ chọn đơn vị trùng, giữ thanh điều hướng 3 tab', () => {
  const filterBar = readSrc('src/components/staff-portal/UnitTicketsFilterBar.tsx');
  const reviewList = readSrc('src/components/staff-portal/UnitTicketsReviewList.tsx');
  const panel = readSrc('src/components/nghiep-vu-don-vi/UnitWorkspaceTicketsPanel.tsx');
  const headerRow = readSrc('src/components/excel-grid/WorkspaceHeaderRow.tsx');

  assert.ok(!filterBar.includes('unit-tickets-unit-filter'), 'UnitTicketsFilterBar không được render select chọn đơn vị trùng lặp');
  assert.ok(!filterBar.includes('renderHeader'), 'UnitTicketsFilterBar không được render lại dòng tiêu đề lặp dưới thanh tab');
  assert.ok(filterBar.includes('Yêu cầu bổ sung'), 'Vẫn giữ bộ lọc con Yêu cầu bổ sung');
  assert.ok(!reviewList.includes('showUnitFilter='), 'UnitTicketsReviewList không truyền bộ lọc đơn vị lặp xuống filter bar');
  assert.ok(panel.includes('Toàn bộ phiếu đơn vị') && panel.includes('Chờ duyệt &amp; Yêu cầu bổ sung') && panel.includes('Đã duyệt &amp; Gộp B1/B2'), 'UnitWorkspaceTicketsPanel giữ nguyên 3 tab điều hướng ở trên');
  assert.ok(!panel.includes('Phiếu công việc đơn vị [{unitCode}]'), 'Đã bỏ khối tiêu đề mô tả thừa trong UnitWorkspaceTicketsPanel');
  assert.ok(headerRow.includes('hideUnitSelector ? ('), 'WorkspaceHeaderRow dùng h2 khi nhúng để giữ đúng 1 thẻ h1 trên trang');
});

console.log(`\n----------------------------------------------------------------`);
console.log(` KẾT QUẢ KIỂM THỬ BỘ LỌC ĐƠN VỊ: ${passed}/9 KỊCH BẢN PASS`);
console.log(`----------------------------------------------------------------\n`);
