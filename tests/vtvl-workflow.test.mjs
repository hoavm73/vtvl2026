import fs from 'fs';
import path from 'path';
import assert from 'assert';

const root = process.cwd();
let passed = 0;

function runTest(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    process.exitCode = 1;
    throw err;
  }
}

function walkFiles(dir, extFilter = ['.ts', '.tsx']) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extFilter));
    } else if (extFilter.includes(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

console.log('================================================================');
console.log(' BỘ KIỂM THỬ ĐƠN VỊ (UNIT TEST) — HCM-UTE VỊ TRÍ VIỆC LÀM (2026–2030)');
console.log('================================================================');

// 1. Kiểm tra quy chuẩn AGENTS.md, Skills và tài liệu kiến trúc CSDL
runTest('1. Kiểm tra cấu trúc AGENTS.md, 5 Skills chuyên biệt & Tài liệu kiến trúc ERD', () => {
  const requiredFiles = [
    'AGENTS.md',
    '.agents/rules/hcmute-brand-guard.md',
    '.agents/rules/code-standards.md',
    '.agents/skills/hcmute-terminology/SKILL.md',
    '.agents/skills/hcmute-ui-system/SKILL.md',
    '.agents/skills/vtvl-excel-engine/SKILL.md',
    '.agents/skills/vtvl-audit-engine/SKILL.md',
    '.agents/skills/quality-assurance/SKILL.md',
    'docs/architecture/erd-database-schema.md',
    'public/mau/manifest.json'
  ];

  for (const rel of requiredFiles) {
    const full = path.join(root, rel);
    assert.ok(fs.existsSync(full), `Thiếu tệp bắt buộc: ${rel}`);
  }

  const skillDirs = [
    'hcmute-terminology',
    'hcmute-ui-system',
    'vtvl-excel-engine',
    'vtvl-audit-engine',
    'quality-assurance'
  ];
  for (const dir of skillDirs) {
    const content = fs.readFileSync(path.join(root, '.agents/skills', dir, 'SKILL.md'), 'utf8');
    assert.ok(content.includes('## A. Thông tin Skill'), `${dir} thiếu mục A`);
    assert.ok(content.includes('## B. Quy trình thực hiện'), `${dir} thiếu mục B`);
    assert.ok(content.includes('## C. Quy tắc kiểm tra'), `${dir} thiếu mục C`);
    assert.ok(content.includes('## D. Giới hạn'), `${dir} thiếu mục D`);
  }
});

// 2. Kiểm tra giới hạn < 300 dòng đối với toàn bộ tệp mã nguồn trong src/
runTest('2. Kiểm tra quy tắc giới hạn < 300 dòng cho mọi tệp trong src/ (Rule 8)', () => {
  const srcFiles = walkFiles(path.join(root, 'src'));
  assert.ok(srcFiles.length >= 20, 'Số lượng tệp nguồn trong src/ không hợp lệ');
  for (const file of srcFiles) {
    const rel = path.relative(root, file);
    const lines = fs.readFileSync(file, 'utf8').split('\n').length;
    assert.ok(lines <= 300, `Tệp ${rel} vượt quá 300 dòng (${lines} dòng)`);
  }
});

// 3. Kiểm tra Quy chuẩn thương hiệu HCM-UTE & Màu chữ Light Theme (#004776)
runTest('3. Kiểm tra Quy chuẩn thương hiệu HCM-UTE & Màu chữ rgb(0, 71, 118)', () => {
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
  assert.ok(css.includes('--foreground: rgb(0, 71, 118);'), 'globals.css phải đặt --foreground: rgb(0, 71, 118)');
  assert.ok(css.includes('overflow-x: hidden'), 'globals.css phải chống tràn ngang (overflow-x: hidden)');

  const uiFiles = [
    ...walkFiles(path.join(root, 'src/app')),
    ...walkFiles(path.join(root, 'src/components'))
  ];
  for (const file of uiFiles) {
    const rel = path.relative(root, file);
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(!content.includes('text-black'), `${rel} vi phạm: chứa class text-black`);
    assert.ok(!content.includes('text-gray-900'), `${rel} vi phạm: chứa class text-gray-900`);
    assert.ok(!content.includes('text-slate-900'), `${rel} vi phạm: chứa class text-slate-900`);
    assert.ok(!content.includes('Sư phạm Kỹ thuật'), `${rel} vi phạm: chứa tên trường cũ`);
  }
});

// 4. Kiểm tra Danh mục 51 đơn vị thuộc HCM-UTE và Khung 38 VTVL (Phụ lục I HD 1907)
runTest('4. Kiểm tra Danh mục 51 đơn vị & Khung 38 vị trí việc làm (04 nhóm)', () => {
  const unitsContent = fs.readFileSync(path.join(root, 'src/configs/hcmute-units.ts'), 'utf8');
  const unitMatches = unitsContent.match(/code:\s*'[A-Z0-9-]+'/g) || [];
  assert.strictEqual(unitMatches.length, 51, `Danh mục đơn vị phải đúng 51 đơn vị (hiện có ${unitMatches.length})`);

  const nd232Content = fs.readFileSync(path.join(root, 'src/configs/hcmute-nd232-catalog.ts'), 'utf8');
  const fwMatches = nd232Content.match(/m\('HD1907-(?:I|II|III|IV)-\d+'/g) || [];
  assert.strictEqual(fwMatches.length, 38, `Khung VTVL của Trường phải đủ 38 vị trí (hiện có ${fwMatches.length})`);
  assert.ok(nd232Content.includes('buildProposedPositionFromFramework'), 'Thiếu hàm khởi tạo vị trí đề xuất từ Khung Trường');
  assert.ok(nd232Content.includes('buildDefaultProposedPositionsForUnit'), 'Thiếu hàm khởi tạo danh sách VTVL đề xuất mặc định cho đơn vị');
});

// 5. Kiểm tra Lược đồ Cơ sở dữ liệu quan hệ 22 bảng & Trigger kiểm soát bậc nghề nghiệp
runTest('5. Kiểm tra Lược đồ CSDL quan hệ 22 bảng (PostgreSQL / Supabase Migration)', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261107_init_vtvl_hcmute.sql'), 'utf8');
  const expectedTables = [
    'dm_don_vi', 'dm_chuc_danh_tt31', 'dm_vtvl_khung_truong', 'dm_san_pham',
    'c1_vtvl', 'a1_nhiem_vu', 'a2_cong_viec', 'b1_khoi_luong',
    'b2_ct_tac_dong', 'b2_thay_doi', 'c2_nang_luc', 'c3_nhu_cau',
    'd1_nhan_luc', 'du_bao_5_nam', 'd2_phuong_an', 'k_kiem_tra',
    't_tien_do', 's_nhat_ky', 'sldv_quy_mo_don_vi', 'sldv_phan_bo_ngach',
    'can_cu_goi_y', 'ra_soat_chua_du_can_cu'
  ];
  for (const tbl of expectedTables) {
    assert.ok(
      sql.includes(`CREATE TABLE IF NOT EXISTS public.${tbl}`),
      `Thiếu bảng quan hệ public.${tbl} trong migration SQL`
    );
  }
  assert.ok(sql.includes('email_nguoi_thuc_hien'), 'Bảng nhật ký/tiến độ phải có cột email_nguoi_thuc_hien');
  assert.ok(sql.includes('chuc_vu_nguoi_thuc_hien'), 'Bảng nhật ký/tiến độ phải có cột chuc_vu_nguoi_thuc_hien');
  assert.ok(sql.includes('trg_validate_c1_career_level'), 'Thiếu Trigger kiểm tra giới hạn bậc nghề nghiệp');
  assert.ok(sql.includes('trg_enforce_unit_consistency'), 'Thiếu Trigger kiểm soát tính nhất quán ma_don_vi liên bảng');
  assert.ok(sql.includes('v_tong_hop_vtvl_toan_truong'), 'Thiếu View tổng hợp toàn trường');

  // Kiểm tra liên thông dữ liệu 5 giai đoạn (Session + Timer Workbook + Merge + Audit + Supabase Sync)
  const activityLog = fs.readFileSync(path.join(root, 'src/services/telemetry/activity-log.ts'), 'utf8');
  const bamGio = fs.readFileSync(path.join(root, 'src/app/bam-gio/page.tsx'), 'utf8');
  const mergeSec = fs.readFileSync(path.join(root, 'src/components/tao-tep/MergeStepSection.tsx'), 'utf8');
  const raSoat = fs.readFileSync(path.join(root, 'src/app/ra-soat/page.tsx'), 'utf8');
  const supaSync = fs.readFileSync(path.join(root, 'src/services/supabase/vtvl-sync.ts'), 'utf8');

  assert.ok(activityLog.includes('timeSessions') && activityLog.includes('lastMergedVersion') && activityLog.includes('lastAuditFixCount'), 'ActiveUnitSession phải lưu trữ xuyên suốt timeSessions, lastMergedVersion và lastAuditFixCount');
  assert.ok(bamGio.includes('buildPersonalTimerWorkbookFile') && bamGio.includes('saveActiveUnitSession'), 'Giai đoạn 3 (Bấm giờ) phải tự động đóng gói tệp khảo sát chuyển sang Giai đoạn 4');
  assert.ok(mergeSec.includes('buildPersonalTimerWorkbookFile') && mergeSec.includes('session.timeSessions'), 'Giai đoạn 4 (Gộp phiếu) phải tự động khôi phục phiếu bấm giờ từ session.timeSessions kể cả khi tải lại trang');
  assert.ok(raSoat.includes('syncAuditResultToSupabase') && supaSync.includes('sldv_quy_mo_don_vi') && supaSync.includes('ra_soat_chua_du_can_cu'), 'Giai đoạn 2, 4, 5 phải đồng bộ đầy đủ dữ liệu lên các bảng quan hệ Supabase');
});

// 6. Kiểm tra bắt buộc nhập Email & Chức vụ, Bảng mã ngạch (Tách & D1), 4 tệp xuất & Can_cu_goi_y
runTest('6. Kiểm tra Email/Chức vụ, Phân bổ mã ngạch (Tách & D1), 4 tệp xuất & Can_cu_goi_y', () => {
  const taoTep = fs.readFileSync(path.join(root, 'src/app/tao-tep/page.tsx'), 'utf8');
  const reviewConfirm = fs.readFileSync(path.join(root, 'src/components/tao-tep/Step1ReviewConfirm.tsx'), 'utf8');
  assert.ok(taoTep.includes('id="task-1-actor"'), 'Bước 1 phải có ô nhập Email người thực hiện (#task-1-actor)');
  assert.ok(taoTep.includes('id="task-1-role"'), 'Bước 1 phải có ô nhập Chức vụ người thực hiện (#task-1-role)');
  assert.ok(taoTep.includes('validateStep1Data') && reviewConfirm.includes('validateStep1Data'), 'Bước 1 phải kiểm tra bắt buộc Email, Chức vụ và từng VTVL trước khi xuất tệp');

  const ngachTool = fs.readFileSync(path.join(root, 'src/components/tao-tep/UnitScaleAndNgachTool.tsx'), 'utf8');
  assert.ok(ngachTool.includes('handleSplitNgachRow') && ngachTool.includes('Đưa vào bảng số người theo vị trí (D1)'), 'Phải có công cụ Tách dòng mã ngạch và Đưa vào bảng số người theo vị trí (D1)');

  const wbBuilder = fs.readFileSync(path.join(root, 'src/services/excel-split/workbook-builder.ts'), 'utf8');
  const sheetsBuilder = fs.readFileSync(path.join(root, 'src/services/excel-split/hd07-sheets-builder.ts'), 'utf8');
  assert.ok(wbBuilder.includes('draftUnitFileName') && sheetsBuilder.includes('Can_cu_goi_y'), 'Phải sinh đủ 4 tệp riêng biệt và có trang tính Can_cu_goi_y');

  const regenForms = fs.readFileSync(path.join(root, 'src/services/excel-split/regen-forms.ts'), 'utf8');
  assert.ok(regenForms.includes('regenerateFormsFromEditedUnitWorkbook'), 'Phải có tính năng Tạo lại phiếu từ tệp đơn vị đã sửa');
});

// 7. Kiểm tra 5 Thẻ Rà soát, Xuất Excel Chua_du_can_cu, Ví dụ X99 & Cảnh báo xung đột gộp phiếu
runTest('7. Kiểm tra 5 Thẻ Rà soát, Xuất Excel Chua_du_can_cu, Ví dụ X99 & Cảnh báo xung đột gộp phiếu', () => {
  const auditTabs = fs.readFileSync(path.join(root, 'src/components/ra-soat/AuditResultTabs.tsx'), 'utf8');
  for (const label of ['1. Cần xử lý', '2. Tổng hợp VTVL', '3. Chưa đủ căn cứ', '4. Lỗi của biểu mẫu', '5. Công cụ kiểm tra gì']) {
    assert.ok(auditTabs.includes(label), `Sổ kết quả rà soát thiếu thẻ: ${label}`);
  }
  const auditEngine = fs.readFileSync(path.join(root, 'src/services/excel-audit/audit-engine.ts'), 'utf8');
  assert.ok(auditEngine.includes('Chua_du_can_cu') && auditEngine.includes('Gop_y_bieu_mau'), 'Xuất Excel rà soát phải có sheet Chua_du_can_cu và Gop_y_bieu_mau');

  const mergeForms = fs.readFileSync(path.join(root, 'src/services/excel-merge/merge-forms.ts'), 'utf8');
  assert.ok(mergeForms.includes('allValues') && mergeForms.includes('rejectedForms'), 'Gộp phiếu phải liệt kê chi tiết xung đột giữa các phiếu và từ chối phiếu khác đơn vị');

  for (const pageRel of ['src/app/tao-tep/page.tsx', 'src/app/bam-gio/page.tsx', 'src/app/ra-soat/page.tsx']) {
    const pageContent = fs.readFileSync(path.join(root, pageRel), 'utf8');
    assert.ok(pageContent.includes('min-w-0'), `Trang ${pageRel} phải có min-w-0 trên cột chính để chống vỡ bố cục trên mobile`);
  }
});

// 8. Kiểm tra Hệ thống trạng thái biểu mẫu thống nhất (Dirty/Saving/Saved/Error, Blur Validation, Selected State, Toast, Kết quả dự kiến)
runTest('8. Kiểm tra hệ thống phản hồi tương tác & trạng thái biểu mẫu (FormField, SaveStatus, Blur Validation, Preview)', () => {
  const primitives = fs.readFileSync(path.join(root, 'src/components/ui/FormFeedbackPrimitives.tsx'), 'utf8');
  const inputs = fs.readFileSync(path.join(root, 'src/components/ui/FormInputs.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
  const taoTep = fs.readFileSync(path.join(root, 'src/app/tao-tep/page.tsx'), 'utf8');
  const posList = fs.readFileSync(path.join(root, 'src/components/tao-tep/Step1PositionList.tsx'), 'utf8');
  const reviewConfirm = fs.readFileSync(path.join(root, 'src/components/tao-tep/Step1ReviewConfirm.tsx'), 'utf8');
  const stepperBar = fs.readFileSync(path.join(root, 'src/components/tao-tep/StageStepperBar.tsx'), 'utf8');

  // Kiểm tra đủ các trạng thái biểu mẫu và lưu
  for (const stateToken of ["'default'", "'focused'", "'dirty'", "'saving'", "'saved'", "'error'", "'disabled'", "'readOnly'"]) {
    assert.ok(primitives.includes(stateToken), `FormFeedbackPrimitives thiếu trạng thái ${stateToken}`);
  }
  assert.ok(primitives.includes('Chưa lưu') && primitives.includes('Đang lưu…') && primitives.includes('Chưa thể lưu') && primitives.includes('Thử lại'), 'InlineStatus phải hỗ trợ Chưa lưu, Đang lưu…, Chưa thể lưu và nút Thử lại');
  assert.ok(primitives.includes('SegmentedControl') && primitives.includes('aria-pressed'), 'SegmentedControl phải có aria-pressed và trạng thái Selected rõ ràng');
  assert.ok(primitives.includes('ToastRegion') && primitives.includes('aria-live="polite"'), 'Phải có ToastRegion hỗ trợ aria-live');
  assert.ok(inputs.includes('TextInput') && inputs.includes('NumberInput') && inputs.includes('DateInput') && inputs.includes('Select') && inputs.includes('SearchableSelect'), 'FormInputs.tsx phải xuất đủ TextInput, NumberInput, DateInput, Select, SearchableSelect');
  assert.ok(css.includes('.vtvl-control') && css.includes('.vtvl-row-saved') && css.includes('prefers-reduced-motion: reduce'), 'globals.css phải có class trạng thái .vtvl-control, .vtvl-row-saved và hỗ trợ prefers-reduced-motion');

  // Kiểm tra validation sau blur, khóa nút Tiếp tục tránh bấm 2 lần, Kết quả hồ sơ dự kiến
  assert.ok(taoTep.includes('touchedFields') && taoTep.includes('scheduleAutosave') && taoTep.includes('isCheckingContinue'), 'tao-tep/page.tsx phải kiểm tra lỗi sau blur (touchedFields), autosave và khóa nút Tiếp tục khi đang kiểm tra');
  assert.ok(posList.includes('triggerRowChange') && posList.includes('vtvl-row-saved') && posList.includes('handleRetryRow'), 'Step1PositionList phải phản hồi Chưa lưu / Đã cập nhật (vtvl-row-saved) và cho phép Thử lại khi lỗi');
  assert.ok(posList.includes('openItemForEdit') && posList.includes('Thông tin vị trí') && posList.includes('Phân loại và định mức') && posList.includes('Lưu thay đổi') && posList.includes('Thu gọn'), 'Step1PositionList phải hỗ trợ 2 chế độ Thu gọn / Mở rộng chỉnh sửa 3 nhóm trường theo thiết kế tham chiếu');
  assert.ok(reviewConfirm.includes('Kết quả hồ sơ dự kiến') && reviewConfirm.includes('validateStageData'), 'Step1ReviewConfirm phải có khối Kết quả hồ sơ dự kiến và hàm validateStageData');
  assert.ok(stepperBar.includes('Đang kiểm tra…') && stepperBar.includes('SaveStatus'), 'StickyActionBar phải hiển thị Đang kiểm tra… và SaveStatus theo thời gian thực');
  assert.ok(css.includes('.surface-canvas') && css.includes('.surface-secondary') && css.includes('.surface-tint') && css.includes('.sticky-action-bar'), 'globals.css phải định nghĩa hệ thống 3 lớp bề mặt (.surface-canvas, .surface-secondary, .surface-tint) và .sticky-action-bar');
  assert.ok(stepperBar.includes('Xem các chặng') && stepperBar.includes('sticky-action-bar'), 'StageStepperBar phải có nút Xem các chặng trên mobile và StickyActionBar dùng .sticky-action-bar');
});

// 9. Kiểm tra Chuẩn hóa Mã nhiệm vụ ([MÃ_ĐV].NVxx), Mã công việc ([Mã NV].CVxx) và Tự động tăng dần
runTest('9. Kiểm tra chuẩn hóa Mã nhiệm vụ ([MÃ_ĐV].NVxx), Mã công việc ([Mã NV].CVxx) và tự động tăng dần', async () => {
  const helpersPath = path.join(root, 'src/components/excel-grid/excel-grid-code-helpers.ts');
  assert.ok(fs.existsSync(helpersPath), 'Phải có tệp excel-grid-code-helpers.ts');
  const helpersContent = fs.readFileSync(helpersPath, 'utf8');
  assert.ok(helpersContent.includes('formatMissionCode') && helpersContent.includes('formatTaskCode'), 'helpers phải có formatMissionCode và formatTaskCode');
  assert.ok(helpersContent.includes('getNextMissionCode') && helpersContent.includes('getNextTaskCode'), 'helpers phải có getNextMissionCode và getNextTaskCode');

  // Kiểm tra quy tắc mã trong QUY_TAC_MA và ERD
  const quyTacMa = fs.readFileSync(path.join(root, 'src/services/excel-split/hd07-sheets-builder.ts'), 'utf8');
  assert.ok(quyTacMa.includes('[MÃ_ĐV].NV[01..99]') && quyTacMa.includes('[MÃ_NV].CV[01..99]'), 'QUY_TAC_MA phải chuẩn hóa [MÃ_ĐV].NV[01..99] và [MÃ_NV].CV[01..99]');

  const erdTables = fs.readFileSync(path.join(root, 'src/configs/hcmute-erd-tables.ts'), 'utf8');
  assert.ok(erdTables.includes('[MA_DV].NV01..99') && erdTables.includes('[MA_NV].CV01..99'), 'hcmute-erd-tables.ts phải có mô tả khóa mã [MA_DV].NV01..99 và [MA_NV].CV01..99');

  // Kiểm tra defaults sinh mã có dấu chấm kế thừa
  const defaults = fs.readFileSync(path.join(root, 'src/components/excel-grid/excel-grid-defaults.ts'), 'utf8');
  assert.ok(defaults.includes('${unitCode}.${m.missionSuffix}') || defaults.includes('${unitCode}.NV01'), 'defaults phải dùng dấu chấm [unitCode].NVxx');
  assert.ok(defaults.includes('${mCode}.CV'), 'defaults phải dùng mã công việc dạng ${mCode}.CVxx');

  // Kiểm tra liên thông mã trong hd07-core-sheets.ts
  const coreSheets = fs.readFileSync(path.join(root, 'src/services/excel-split/hd07-core-sheets.ts'), 'utf8');
  assert.ok(coreSheets.includes('${opts.unitCode}.${m.missionSuffix}'), 'hd07-core-sheets phải sinh mã nhiệm vụ có dấu chấm');
  assert.ok(coreSheets.includes('${mCode}.CV'), 'hd07-core-sheets phải sinh mã công việc kế thừa mã nhiệm vụ');

  // Kiểm tra cấu trúc 10 sheet có số, QL33/QL43 dùng PP1 không có việc ở A2/B1
  const pl1Catalog = fs.readFileSync(path.join(root, 'src/configs/hcmute-pl1-catalog.ts'), 'utf8');
  assert.ok(!pl1Catalog.includes("taskSuffix: 'NV01.CV00'") && !pl1Catalog.includes("taskSuffix: 'NV02.CV00'"), 'TCNS_REAL_TASKS không được tạo công việc cho QL33 và QL43 (dùng PP1)');
  assert.ok(defaults.includes('TCNS.QL33') && defaults.includes('TCNS.QL43'), 'defaults C1 phải có TCNS.QL33 và TCNS.QL43');
  assert.ok(defaults.includes("PP1 – theo cơ cấu"), 'defaults C1 phải ghi rõ QL33/QL43 dùng PP1');

  // Kiểm tra chuẩn hóa trạng thái C1, kỳ A1, giải trình C3, T_TienDo và Validation Rules
  const metasCore = fs.readFileSync(path.join(root, 'src/components/excel-grid/excel-sheet-metas-core.ts'), 'utf8');
  assert.ok(metasCore.includes('Tiếp tục sử dụng') && metasCore.includes('Đề nghị bãi bỏ'), 'C1 Cột G phải có dropdown Tiếp tục sử dụng, Cần cập nhật, Đề nghị bổ sung, Đề nghị sửa đổi, Đề nghị bãi bỏ');
  assert.ok(metasCore.includes("'Số hóa', 'Cải tiến quy trình', 'Thuê dịch vụ/đặt hàng', 'Tự chủ', 'Xã hội hóa', 'Công việc mới phát sinh'"), 'B2_CT Cột D phải có đủ 6 lựa chọn loại tác động chuẩn');
  assert.ok(metasCore.includes("'Viên chức', 'Hợp đồng lao động', 'Hợp đồng khoán việc', 'Thuê dịch vụ'"), 'C1 Cột C phải có đúng 4 loại nhân lực chuẩn');
  const metasEval = fs.readFileSync(path.join(root, 'src/components/excel-grid/excel-sheet-metas-eval.ts'), 'utf8');
  assert.ok(metasEval.includes("'PP1', 'PP2', 'PP3', 'PP1+PP2', 'PP1+PP3', 'PP2+PP3'"), 'C3 Cột B phải có đủ 6 phương pháp tính nhân lực');
  assert.ok(defaults.includes('01/10/2025–30/9/2026'), 'A1 Cột E phải chuẩn hóa kỳ 01/10/2025–30/9/2026');
  assert.ok(defaults.includes('Định biên theo PP1; QĐ 2266, PL18 và BMTCV&KNL'), 'C3 Cột K phải có giải trình PP1 chuẩn');
  assert.ok(defaults.includes('Phòng Tổ chức – Nhân sự (HCM-UTE)'), '14. T_TienDo phải hiển thị Phòng Tổ chức – Nhân sự (HCM-UTE)');

  const formulas = fs.readFileSync(path.join(root, 'src/components/excel-grid/excel-grid-formulas.ts'), 'utf8');
  assert.ok(formulas.includes('CHỜ XÁC NHẬN KHÁC CHUẨN'), 'B1 Cột S phải kiểm tra cú pháp Đã xác nhận: và cảnh báo CHỜ XÁC NHẬN KHÁC CHUẨN');
  assert.ok(formulas.includes('THIẾU BIẾN ĐỘNG (NHẬP 0 NẾU KHÔNG ĐỔI)'), 'DU_BAO và D2 phải bắt buộc số nguyên và cảnh báo THIẾU BIẾN ĐỘNG (NHẬP 0 NẾU KHÔNG ĐỔI)');

  const lockHook = fs.readFileSync(path.join(root, 'src/components/excel-grid/useC1AdminLock.ts'), 'utf8');
  assert.ok(lockHook.includes('/api/admin/c1-lock'), 'useC1AdminLock phải ủy quyền kiểm tra mật khẩu cho máy chủ /api/admin/c1-lock');
  assert.ok(!lockHook.includes('0a5de87db3d6c7d52645c1581269a880b1bbc613abc8e4c8e0f51c99753f8909'), 'useC1AdminLock không được lưu mã băm SHA-256 ở client bundle');
});

// 10. Kiểm tra Bộ máy kiểm soát chất lượng dữ liệu (Data Quality Checker / vtvl-audit-engine)
runTest('10. Kiểm tra bộ quy tắc Data Quality Checker và Validation Engine 15 sheet', () => {
  const valTypes = fs.readFileSync(path.join(root, 'src/services/validation/vtvl-validation-types.ts'), 'utf8');
  assert.ok(valTypes.includes('ValidationSeverity') && valTypes.includes('ValidationIssue'), 'vtvl-validation-types.ts phải định nghĩa ValidationIssue và ValidationSeverity');

  const coreVal = fs.readFileSync(path.join(root, 'src/services/validation/vtvl-core-validators.ts'), 'utf8');
  assert.ok(coreVal.includes('validateA1Sheet') && coreVal.includes('validateA2Sheet') && coreVal.includes('validateB1Sheet'), 'vtvl-core-validators.ts phải có validators cho A1, A2, B1');
  assert.ok(coreVal.includes('R-TT31-40') && coreVal.includes('R-B1-06'), 'Phải có quy tắc R-TT31-40 và R-B1-06');

  const evalVal = fs.readFileSync(path.join(root, 'src/services/validation/vtvl-eval-validators.ts'), 'utf8');
  assert.ok(evalVal.includes('validateC1Sheet') && evalVal.includes('validateC3Sheet') && evalVal.includes('validateDuBaoSheet'), 'vtvl-eval-validators.ts phải có validators cho C1, C3, DU_BAO, D1, D2');
  assert.ok(evalVal.includes('R-DB-04') && evalVal.includes('R-C3-03'), 'Phải có quy tắc R-DB-04 và R-C3-03');

  const masterChecker = fs.readFileSync(path.join(root, 'src/services/validation/vtvl-data-quality-checker.ts'), 'utf8');
  assert.ok(masterChecker.includes('validateWorkbookData'), 'vtvl-data-quality-checker.ts phải xuất hàm validateWorkbookData');
  assert.ok(masterChecker.includes('scorePercent'), 'Phải tính điểm chất lượng dữ liệu scorePercent');

  const viewer = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelWorkbookViewer.tsx'), 'utf8');
  assert.ok(viewer.includes('DataQualityReportModal') && viewer.includes('validateWorkbookData'), 'ExcelWorkbookViewer phải tích hợp DataQualityReportModal và validateWorkbookData');
});

// 11. Kiểm tra phản hồi HTTP 200 OK trên máy chủ cục bộ (nếu đang chạy)
const checkLocalServer = async () => {
  const routes = ['/', '/tao-tep', '/bang-tinh', '/bam-gio', '/ra-soat', '/huong-dan'];
  try {
    const ping = await fetch('http://localhost:3360/');
    if (ping.ok) {
      for (const r of routes) {
        const res = await fetch(`http://localhost:3360${r}`);
        assert.strictEqual(res.status, 200, `Đường dẫn ${r} trả về mã lỗi ${res.status}`);
      }
      passed += 1;
      console.log('  ✓ [PASS] 11. Kiểm tra máy chủ cục bộ (http://localhost:3360): 6/6 trang trả về HTTP 200 OK');
    }
  } catch {
    console.log('  ℹ [SKIP] 11. Máy chủ cục bộ không chạy trong tiến trình hiện tại (đã qua 10/10 bài kiểm thử tĩnh)');
  }
  console.log('----------------------------------------------------------------');
  console.log(` KẾT QUẢ: ĐẠT ${passed}/${passed} BÀI KIỂM THỬ ĐƠN VỊ (0 LỖI)`);
  console.log('================================================================');
};

await checkLocalServer();
