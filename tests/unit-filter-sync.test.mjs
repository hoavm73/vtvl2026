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

test('TC10: Thanh gạch chân cam #FD8C73 dùng border-b-[1.8px] đồng nhất và không -mb-[1px] ở cả 8 thanh tab', () => {
  const tabFiles = [
    'src/app/nghiep-vu-don-vi/page.tsx',
    'src/components/nghiep-vu-don-vi/UnitWorkspaceTicketsPanel.tsx',
    'src/components/staff-portal/UnitTicketsHeaderBar.tsx',
    'src/components/staff-portal/StaffTicketsTabBar.tsx',
    'src/components/admin/TcnsReviewDetailPanel.tsx',
    'src/app/admin/page.tsx',
    'src/components/ra-soat/AuditResultTabs.tsx',
    'src/components/excel-grid/ExcelSheetTabs.tsx'
  ];
  for (const rel of tabFiles) {
    const code = readSrc(rel);
    assert.ok(code.includes('border-[#FD8C73]'), `${rel} phải giữ màu cam san hô #FD8C73`);
    assert.ok(code.includes('border-b-[1.8px]'), `${rel} phải dùng border-b-[1.8px] đồng nhất`);
    assert.ok(!code.includes('-mb-[1px]'), `${rel} không được dùng -mb-[1px] gây cắt subpixel trong overflow-x-auto`);
  }
});

test('TC11: Đồng nhất computeUnitProgressStage giữa unit-monitor-builder và history API', () => {
  const builder = readSrc('src/services/admin/unit-monitor-builder.ts');
  const histRoute = readSrc('src/app/api/workbooks/[id]/history/route.ts');
  assert.ok(builder.includes('computeUnitProgressStage('), 'unit-monitor-builder phải dùng computeUnitProgressStage');
  assert.ok(histRoute.includes('computeUnitProgressStage('), 'history/route.ts phải dùng computeUnitProgressStage');

  const tmpRunner = path.join(root, '.data', '_tmp_tc11_progress.ts');
  fs.mkdirSync(path.dirname(tmpRunner), { recursive: true });
  fs.writeFileSync(
    tmpRunner,
    `
import assert from 'node:assert';
import { computeUnitProgressStage } from '../src/services/workbooks/workbook-history-service';

assert.deepStrictEqual(computeUnitProgressStage({ mergedCount: 1, populatedSheetsCount: 6, approvedCount: 1, submittedCount: 0, changesRequestedCount: 0, draftCount: 0 }), { progressPercent: 100, stageLabel: 'Đã gộp B1/B2 & hoàn thiện biểu' });
assert.deepStrictEqual(computeUnitProgressStage({ mergedCount: 0, populatedSheetsCount: 3, approvedCount: 1, submittedCount: 0, changesRequestedCount: 0, draftCount: 0 }), { progressPercent: 80, stageLabel: 'Đã duyệt phiếu' });
assert.deepStrictEqual(computeUnitProgressStage({ mergedCount: 0, populatedSheetsCount: 3, approvedCount: 0, submittedCount: 1, changesRequestedCount: 0, draftCount: 0 }), { progressPercent: 60, stageLabel: 'Đang chờ duyệt phiếu' });
assert.deepStrictEqual(computeUnitProgressStage({ mergedCount: 0, populatedSheetsCount: 3, approvedCount: 0, submittedCount: 0, changesRequestedCount: 1, draftCount: 0 }), { progressPercent: 60, stageLabel: 'Đang chờ bổ sung phiếu' });
assert.deepStrictEqual(computeUnitProgressStage({ mergedCount: 0, populatedSheetsCount: 3, approvedCount: 0, submittedCount: 0, changesRequestedCount: 0, draftCount: 1 }), { progressPercent: 35, stageLabel: 'Đang lưu nháp phiếu' });
assert.deepStrictEqual(computeUnitProgressStage({ mergedCount: 0, populatedSheetsCount: 1, approvedCount: 0, submittedCount: 0, changesRequestedCount: 0, draftCount: 0 }), { progressPercent: 20, stageLabel: 'Đã khởi tạo biểu mẫu' });
assert.deepStrictEqual(computeUnitProgressStage({ mergedCount: 0, populatedSheetsCount: 0, approvedCount: 0, submittedCount: 0, changesRequestedCount: 0, draftCount: 0 }), { progressPercent: 0, stageLabel: 'Chưa kê khai' });
`,
    'utf8'
  );
  try {
    execSync(`npx tsx "${tmpRunner}"`, { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(tmpRunner)) fs.unlinkSync(tmpRunner);
  }
});

test('TC12: getAuditLogs lọc actions thẩm định trước khi cắt limit và các API đều đồng bộ audit_logs từ DB', () => {
  for (const rel of [
    'src/app/api/audit-logs/route.ts',
    'src/app/api/stats/overview/route.ts',
    'src/app/api/admin/unit-monitor/route.ts',
    'src/app/api/workbooks/[id]/history/route.ts'
  ]) {
    const code = readSrc(rel);
    assert.ok(code.includes('syncAuditLogsFromSupabase('), `${rel} phải gọi syncAuditLogsFromSupabase`);
  }
  assert.ok(readSrc('src/app/api/audit-logs/route.ts').includes('no-store'), '/api/audit-logs phải trả Cache-Control: no-store');

  const auditFile = path.join(root, '.data', 'audit-logs.json');
  const backup = fs.existsSync(auditFile) ? fs.readFileSync(auditFile, 'utf8') : null;
  const tmpRunner = path.join(root, '.data', '_tmp_tc12_audit.ts');
  fs.mkdirSync(path.dirname(tmpRunner), { recursive: true });
  fs.writeFileSync(
    tmpRunner,
    `
import assert from 'node:assert';
import { appendAuditLog, getAuditLogs } from '../src/services/storage/server-audit-store';
import { REVIEW_ACTION_SET, deriveReviewMetaFromWorkbook } from '../src/services/workbooks/workbook-history-service';

appendAuditLog({ unitCode: 'QA_TC12', unitName: 'QA Test', action: 'THAM_DINH_YEU_CAU_BO_SUNG', details: 'Cần bổ sung', actorEmail: 'tcns@hcmute.edu.vn', actorRole: 'admin' });
for (let i = 0; i < 120; i++) {
  appendAuditLog({ unitCode: 'QA_TC12', unitName: 'QA Test', action: 'SỬA_BIỂU', details: 'Sửa dòng ' + i, actorEmail: 'leader@hcmute.edu.vn', actorRole: 'unit_leader' });
}
const reviewOnly = getAuditLogs({ unitCode: 'qa_tc12', actions: REVIEW_ACTION_SET, limit: 10 });
assert.ok(reviewOnly.some((l) => l.action === 'THAM_DINH_YEU_CAU_BO_SUNG'), 'Log thẩm định không được bị trôi mất bởi 120 log SỬA_BIỂU');
const meta = deriveReviewMetaFromWorkbook({ id: 'wb_QA_TC12_2026', unitId: 'QA_TC12', status: 'draft', currentRevision: 1, updatedAt: '', data: {} as any }, reviewOnly);
assert.strictEqual(meta.status, 'can_bo_sung', 'Trạng thái thẩm định suy ra phải giữ đúng can_bo_sung');
`,
    'utf8'
  );
  try {
    execSync(`npx tsx "${tmpRunner}"`, { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(tmpRunner)) fs.unlinkSync(tmpRunner);
    if (backup !== null) fs.writeFileSync(auditFile, backup, 'utf8');
    else if (fs.existsSync(auditFile)) fs.unlinkSync(auditFile);
  }
});

test('TC13: Khớp nhóm lọc STEP_SUBMITTED và STEP_APPROVED giữa SchoolReviewProgressBar và TcnsReviewListPanel', () => {
  const bar = readSrc('src/components/workbooks/SchoolReviewProgressBar.tsx');
  const panel = readSrc('src/components/admin/TcnsReviewListPanel.tsx');
  assert.ok(bar.includes("'STEP_SUBMITTED'") && bar.includes("'STEP_APPROVED'"), 'SchoolReviewProgressBar phải phát mã nhóm STEP_SUBMITTED và STEP_APPROVED');
  assert.ok(panel.includes("statusFilter === 'STEP_SUBMITTED'") && panel.includes("da_gui_lai"), 'TcnsReviewListPanel phải lọc cả cho_tham_dinh + da_gui_lai cho STEP_SUBMITTED');
  assert.ok(panel.includes("statusFilter === 'STEP_APPROVED'") && panel.includes("da_khoa"), 'TcnsReviewListPanel phải lọc cả dat_yeu_cau + da_khoa cho STEP_APPROVED');
  assert.ok(panel.includes('activeFilter={statusFilter}'), 'TcnsReviewListPanel phải truyền activeFilter={statusFilter}');
});

test('TC14: UnitWorkbookCheckPanel cách ly isOwnSessionUnit/Auth header và UnitOrgTreeModal nạp dữ liệu thực', () => {
  const checkPanel = readSrc('src/components/ra-soat/UnitWorkbookCheckPanel.tsx');
  const orgModal = readSrc('src/components/admin/UnitOrgTreeModal.tsx');
  assert.ok(checkPanel.includes('isOwnSessionUnit'), 'UnitWorkbookCheckPanel phải kiểm tra isOwnSessionUnit để tránh nhiễm chéo phiên đơn vị');
  assert.ok(checkPanel.includes("mode !== 'tcns'"), 'UnitWorkbookCheckPanel ở mode tcns không tự ghi đè dữ liệu khi vừa mở tab');
  assert.ok(checkPanel.includes('headers.Authorization = `Bearer ${op.accessToken}`'), 'handleSubmitToTcns phải đính kèm Authorization Bearer');
  assert.ok(orgModal.includes('/api/workbooks/${encodeURIComponent(getCanonicalWorkbookId(upper))}'), 'UnitOrgTreeModal phải nạp dữ liệu workbook thực từ API khi mở từ /admin hoặc đổi đơn vị');
});

test('TC15: Tab Chờ duyệt & Yêu cầu bổ sung hỗ trợ 3 bộ lọc liên thông Nhiệm vụ -> Người khai -> Trạng thái duyệt', () => {
  const filterBar = readSrc('src/components/staff-portal/UnitTicketsFilterBar.tsx');
  const reviewList = readSrc('src/components/staff-portal/UnitTicketsReviewList.tsx');
  assert.ok(filterBar.includes('pending-mission-cascade-filter'), 'Phải có dropdown Cấp 1 Nhiệm vụ');
  assert.ok(filterBar.includes('pending-owner-cascade-filter'), 'Phải có dropdown Cấp 2 Người khai');
  assert.ok(filterBar.includes('pending-status-cascade-filter'), 'Phải có dropdown Cấp 3 Trạng thái duyệt');
  assert.ok(filterBar.includes('Yêu cầu bổ sung'), 'Phải giữ nhãn trạng thái Yêu cầu bổ sung');
  assert.ok(reviewList.includes('buildPendingCascadeState('), 'UnitTicketsReviewList phải dùng buildPendingCascadeState');

  const tmpRunner = path.join(root, '.data', '_tmp_tc15_cascade.ts');
  fs.mkdirSync(path.dirname(tmpRunner), { recursive: true });
  fs.writeFileSync(
    tmpRunner,
    `
import assert from 'node:assert';
import { buildPendingCascadeState } from '../src/components/staff-portal/unit-tickets-cascade-helpers';
import type { StaffWorkTicket } from '../src/types/staff-ticket';

const mk = (id: string, maNhiemVu: string, email: string, name: string, status: StaffWorkTicket['status']): StaffWorkTicket => ({
  id, unitCode: 'TCNS', unitName: 'Phòng TCNS', ownerEmail: email, ownerName: name, ownerTitle: 'CV',
  status, currentVersion: 1, maVtvl: 'TCNS.HT01', tenVtvl: 'Chuyên viên', maCongViec: id,
  tenCongViec: 'Việc ' + id, maNhiemVu, tenSanPham: 'SP', tanSuat: 'THUONG_XUYEN',
  soLanNam: 1, thoiGianPhut: 60, tongGioNam: 1, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
  submittedAt: '2026-11-02T00:00:00Z', isMergedToB1B2: false
});

const sample: StaffWorkTicket[] = [
  mk('1', 'TCNS.NV01', 'an@hcmute.edu.vn', 'Nguyễn Văn An', 'submitted'),
  mk('2', 'TCNS.NV01', 'an@hcmute.edu.vn', 'Nguyễn Văn An', 'resubmitted'),
  mk('3', 'TCNS.NV01', 'binh@hcmute.edu.vn', 'Trần Thị Bình', 'changes_requested'),
  mk('4', 'TCNS.NV02', 'cuong@hcmute.edu.vn', 'Lê Văn Cường', 'submitted'),
  mk('5', 'TCNS.NV02', 'binh@hcmute.edu.vn', 'Trần Thị Bình', 'approved'),
  mk('6', 'TCNS.NV02', 'cuong@hcmute.edu.vn', 'Lê Văn Cường', 'draft')
];

// Toàn bộ pool chỉ tính submitted + resubmitted + changes_requested (4 phiếu)
const allState = buildPendingCascadeState(sample, 'ALL', 'ALL', 'ALL');
assert.strictEqual(allState.totalPendingCount, 4);
assert.strictEqual(allState.missionOptions.length, 3); // ALL + NV01 + NV02
assert.strictEqual(allState.ownerOptions.length, 4); // ALL + 3 người khai hợp lệ

// Chọn Cấp 1: TCNS.NV01 -> Cấp 2 chỉ còn An (2) & Bình (1), không còn Cường
const m1State = buildPendingCascadeState(sample, 'TCNS.NV01', 'ALL', 'ALL');
assert.strictEqual(m1State.effectiveMission, 'TCNS.NV01');
assert.strictEqual(m1State.ownerOptions.length, 3);
assert.ok(!m1State.ownerOptions.some((o) => o.value === 'cuong@hcmute.edu.vn'));

// Chọn Cấp 2: Bình dưới NV01 -> Cấp 3 chỉ còn Yêu cầu bổ sung (1), không còn Chờ phê duyệt
const m1OwnerState = buildPendingCascadeState(sample, 'TCNS.NV01', 'binh@hcmute.edu.vn', 'ALL');
assert.strictEqual(m1OwnerState.effectiveOwner, 'binh@hcmute.edu.vn');
assert.ok(m1OwnerState.statusOptions.some((s) => s.value === 'CHANGES' && s.label.includes('(1)')));
assert.ok(!m1OwnerState.statusOptions.some((s) => s.value === 'WAITING'));
assert.strictEqual(m1OwnerState.filteredTickets.map((t) => t.id).join(','), '3');

// Đổi Cấp 1 sang TCNS.NV02 khi đang giữ Cấp 2/3 cũ -> tự chuẩn hóa về ALL
const staleReset = buildPendingCascadeState(sample, 'TCNS.NV02', 'binh@hcmute.edu.vn', 'CHANGES');
assert.strictEqual(staleReset.effectiveMission, 'TCNS.NV02');
assert.strictEqual(staleReset.effectiveOwner, 'ALL');
assert.strictEqual(staleReset.effectiveStatus, 'ALL');
assert.strictEqual(staleReset.filteredTickets.map((t) => t.id).join(','), '4');
`,
    'utf8'
  );
  try {
    execSync(`npx tsx "${tmpRunner}"`, { stdio: 'inherit' });
  } finally {
    if (fs.existsSync(tmpRunner)) fs.unlinkSync(tmpRunner);
  }
});

test('TC16: Nhật ký hệ thống ghi nhận ĐĂNG_NHẬP / ĐĂNG_NHẬP_THẤT_BẠI (IP, role, đơn vị) và lọc category=auth không bị trôi bởi log sửa biểu', () => {
  const auditFile = path.join(root, '.data', 'audit-logs.json');
  const accountsFile = path.join(root, '.data', 'user_accounts.json');
  const auditBackup = fs.existsSync(auditFile) ? fs.readFileSync(auditFile, 'utf8') : null;
  const accountsBackup = fs.existsSync(accountsFile) ? fs.readFileSync(accountsFile, 'utf8') : null;
  const tmpRunner = path.join(root, '.data', '_tmp_tc16_auth_audit.ts');
  fs.mkdirSync(path.dirname(tmpRunner), { recursive: true });
  fs.writeFileSync(
    tmpRunner,
    `
import assert from 'node:assert';
import { NextRequest } from 'next/server';
import { POST as postAuthLogin } from '../src/app/api/auth/login/route';
import { GET as getAuditLogsRoute } from '../src/app/api/audit-logs/route';
import { appendAuditLog, getAuditLogs } from '../src/services/storage/server-audit-store';
import { upsertUserAccount } from '../src/services/storage/server-account-store';
import { hashAccountPassword } from '../src/services/storage/account-crypto';
import { generateUserSessionToken } from '../src/services/storage/server-auth-guard';

async function main() {
  const testEmail = 'tc16.auth.audit@hcmute.edu.vn';
  const adminTok = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS', ttlHours: 1 });
  await upsertUserAccount({
    email: testEmail, displayName: 'TC16 Audit User', unitCode: 'CNTT', role: 'staff',
    passwordHash: hashAccountPassword('Pass@2026'), hasSelectedUnit: true
  }, true);

  const failRes = await postAuthLogin(new NextRequest('http://localhost:3360/api/auth/login', {
    method: 'POST', headers: { 'x-real-ip': '10.99.88.77', 'user-agent': 'VTVL-QA-Agent/1.0', 'content-type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'WrongPass999!' })
  }));
  assert.strictEqual(failRes.status, 401);

  const okRes = await postAuthLogin(new NextRequest('http://localhost:3360/api/auth/login', {
    method: 'POST', headers: { 'x-real-ip': '10.99.88.77', 'user-agent': 'VTVL-QA-Agent/1.0', 'content-type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: 'Pass@2026' })
  }));
  assert.strictEqual(okRes.status, 200);

  const rawLogsStr = JSON.stringify(getAuditLogs({ limit: 50 }));
  assert.ok(!rawLogsStr.includes('WrongPass999!') && !rawLogsStr.includes('Pass@2026') && !rawLogsStr.includes('passwordHash'), 'Nhật ký không được rò rỉ mật khẩu');

  for (let i = 0; i < 120; i++) {
    appendAuditLog({ unitCode: 'CNTT', unitName: 'Khoa CNTT', action: 'SỬA_BIỂU', details: 'Sửa ô ' + i, actorEmail: testEmail, actorRole: 'staff' });
  }

  const authLogsRes = await getAuditLogsRoute(new Request('http://localhost:3360/api/audit-logs?category=auth&limit=50', {
    headers: { authorization: 'Bearer ' + adminTok }
  }));
  assert.strictEqual(authLogsRes.status, 200);
  const authPayload = await authLogsRes.json();
  const authLogs = authPayload.logs || [];
  assert.ok(!authLogs.some((l: any) => l.action === 'SỬA_BIỂU'), 'category=auth không được lẫn log SỬA_BIỂU');

  const okLog = authLogs.find((l: any) => l.action === 'ĐĂNG_NHẬP' && l.actorEmail === testEmail);
  const failLog = authLogs.find((l: any) => l.action === 'ĐĂNG_NHẬP_THẤT_BẠI' && l.actorEmail === testEmail);
  assert.ok(okLog, 'Phải ghi nhận ĐĂNG_NHẬP khi đăng nhập thành công');
  assert.ok(failLog, 'Phải ghi nhận ĐĂNG_NHẬP_THẤT_BẠI khi sai mật khẩu');
  assert.strictEqual(okLog.actorRole, 'staff');
  assert.strictEqual(okLog.unitCode, 'CNTT');
  assert.strictEqual(okLog.ipAddress, '10.99.88.77');
  assert.strictEqual(okLog.workbookId, undefined, 'Log auth không được gắn workbookId');
}
main().catch((e) => { console.error(e); process.exit(1); });
`,
    'utf8'
  );
  try {
    execSync(`npx tsx "${tmpRunner}"`, { stdio: 'inherit', env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' } });
  } finally {
    if (fs.existsSync(tmpRunner)) fs.unlinkSync(tmpRunner);
    if (auditBackup !== null) fs.writeFileSync(auditFile, auditBackup, 'utf8');
    else if (fs.existsSync(auditFile)) fs.unlinkSync(auditFile);
    if (accountsBackup !== null) fs.writeFileSync(accountsFile, accountsBackup, 'utf8');
    else if (fs.existsSync(accountsFile)) fs.unlinkSync(accountsFile);
  }
});

console.log(`\n----------------------------------------------------------------`);
console.log(` KẾT QUẢ KIỂM THỬ BỘ LỌC ĐƠN VỊ: ${passed}/16 KỊCH BẢN PASS`);
console.log(`----------------------------------------------------------------\n`);
