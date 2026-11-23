import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { execSync } from 'node:child_process';

const root = process.cwd();
console.log('================================================================');
console.log(' KIỂM THỬ NHẬP–XUẤT EXCEL & RÀNG BUỘC BẮT BUỘC BIỂU A1 (HCM-UTE)');
console.log('================================================================');

const tsTest = `
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import XLSX from 'xlsx';
import {
  A1_HEADERS, A1_SHEET_NAME, A1_STATUS_OPTIONS, A1_REQUIRED_FIELDS,
  validateA1Row, validateNewA1RowsForSave
} from './src/services/a1/a1-validation';
import {
  buildA1ExcelBuffer, parseAndPreviewA1Import, applyA1ImportPreview
} from './src/services/a1/a1-excel-service';
import { PUT } from './src/app/api/workbooks/[id]/route';
import { getOrCreateWorkbook, getWorkbookById, saveServerWorkbook, resetWorkbookMemoryStore } from './src/services/storage/server-workbook-store';
import { generateUserSessionToken } from './src/services/storage/server-auth-guard';
import { upsertUserAccount, resetAccountMemoryStore } from './src/services/storage/server-account-store';

async function main() {
  const validRow = {
    id: 'a1-new-1',
    maNhiemVu: 'CK.NV01',
    tenNhiemVu: 'Tổ chức đào tạo bậc đại học ngành Cơ khí',
    coQuan: 'Khoa Cơ khí',
    canCu: 'QĐ 2266/QĐ-ĐHCNKT, PL18',
    ky: '01/10/2025–30/9/2026',
    trangThai: 'Tiếp tục thực hiện',
    nguon: 'QĐ 2266/QĐ-ĐHCNKT'
  };

  // 1. Từng trường bắt buộc thiếu & chuỗi toàn khoảng trắng
  for (const field of A1_REQUIRED_FIELDS) {
    const missing = { ...validRow, [field]: '' };
    const r1 = validateA1Row(missing);
    assert.strictEqual(r1.valid, false, 'Phải báo lỗi khi thiếu ' + field);
    assert.ok(r1.errors[field], 'Phải có thông báo lỗi đúng trường ' + field);

    const spaces = { ...validRow, [field]: '     ' };
    const r2 = validateA1Row(spaces);
    assert.strictEqual(r2.valid, false, 'Phải từ chối chuỗi toàn khoảng trắng ở ' + field);
  }

  // 2. Trạng thái ngoài danh mục 4 lựa chọn
  const badStatus = validateA1Row({ ...validRow, trangThai: 'Trạng thái tự chế' });
  assert.strictEqual(badStatus.valid, false, 'Phải từ chối trạng thái ngoài danh mục');
  assert.ok(badStatus.errors.trangThai, 'Phải báo lỗi đúng cột trangThai');

  // 3. Dòng mới đủ 6 trường hợp lệ -> PASS
  assert.strictEqual(validateA1Row(validRow).valid, true, 'Dòng mới đủ 6 trường phải hợp lệ');

  // 4. Dòng cũ thiếu trường không làm hỏng thao tác lưu dòng mới hợp lệ
  const legacyIncomplete = { id: 'a1-old-1', maNhiemVu: 'CK.NV01', tenNhiemVu: 'Nhiệm vụ cũ', coQuan: '', canCu: '', ky: '', trangThai: '', nguon: '' };
  const validSecond = { ...validRow, id: 'a1-new-2', maNhiemVu: 'CK.NV02' };
  const legacySaveCheck = validateNewA1RowsForSave({ incomingA1: [legacyIncomplete, validSecond], existingA1: [legacyIncomplete] });
  assert.strictEqual(legacySaveCheck.ok, true, 'Dòng cũ thiếu dữ liệu không được làm hỏng lưu dòng mới hợp lệ');

  // 5. Tạo file mẫu trống -> kiểm tra sheet name, AutoFilter 7 cột & Data Validation 4 trạng thái
  const tplBytes = await buildA1ExcelBuffer({ unitCode: 'CK', unitNameVi: 'Khoa Cơ khí', mode: 'template' });
  const tplZip = await JSZip.loadAsync(tplBytes);
  const tplXml = await tplZip.file('xl/worksheets/sheet1.xml')!.async('string');
  assert.ok(tplXml.includes('<autoFilter ref="A2:G500"'), 'File mẫu phải có AutoFilter A2:G500');
  assert.ok(tplXml.includes('sqref="F3:F500"'), 'File mẫu phải có Data Validation cột F (F3:F500)');
  for (const st of A1_STATUS_OPTIONS) {
    assert.ok(tplXml.includes(st), 'Data Validation phải chứa trạng thái ' + st);
  }

  // Lưu file mẫu chuẩn vào public/mau/Mau_A1_NhiemVu_HCMUTE.xlsx
  fs.mkdirSync(path.join(process.cwd(), 'public/mau'), { recursive: true });
  const genericTpl = await buildA1ExcelBuffer({ unitCode: 'MAU', unitNameVi: 'Đơn vị HCM-UTE', mode: 'template' });
  fs.writeFileSync(path.join(process.cwd(), 'public/mau/Mau_A1_NhiemVu_HCMUTE.xlsx'), genericTpl);

  // 6. Vòng Tải mẫu -> điền (kèm dòng trống) -> nhập -> xuất -> nhập lại
  const wbFill = XLSX.read(tplBytes, { type: 'array' });
  const wsFill = wbFill.Sheets[A1_SHEET_NAME];
  XLSX.utils.sheet_add_aoa(wsFill, [
    ['', 'Nhiệm vụ mới A', 'Khoa Cơ khí', 'QĐ 2266', '01/10/2025–30/9/2026', 'Tiếp tục thực hiện', 'QĐ 2266'],
    ['', '', '', '', '', '', ''],
    ['', 'Nhiệm vụ mới B', 'Khoa Cơ khí', 'QĐ 2266', '01/10/2025–30/9/2026', 'Mới tiếp nhận', 'QĐ 2266']
  ], { origin: 'A3' });
  const filledBuf = new Uint8Array(XLSX.write(wbFill, { bookType: 'xlsx', type: 'array' }));
  const preview1 = parseAndPreviewA1Import({ buffer: filledBuf, unitCode: 'CK', existingA1: [] });
  assert.strictEqual(preview1.ok, true);
  assert.strictEqual(preview1.summary.totalRead, 2, 'Phải bỏ qua dòng hoàn toàn trống');
  assert.strictEqual(preview1.summary.newCount, 2);
  const applied1 = applyA1ImportPreview({ preview: preview1, existingA1: [], unitCode: 'CK' });
  assert.strictEqual(applied1.ok, true);
  assert.strictEqual(applied1.nextA1[0].maNhiemVu, 'CK.NV01');
  assert.strictEqual(applied1.nextA1[1].maNhiemVu, 'CK.NV02');

  // Xuất file A1 -> kiểm tra AutoFilter & Data Validation vẫn còn -> nhập lại không tăng dòng
  const expBytes = await buildA1ExcelBuffer({ unitCode: 'CK', unitNameVi: 'Khoa Cơ khí', rows: applied1.nextA1, mode: 'export' });
  const expZip = await JSZip.loadAsync(expBytes);
  const expXml = await expZip.file('xl/worksheets/sheet1.xml')!.async('string');
  assert.ok(expXml.includes('<autoFilter ref="A2:G500"'), 'File xuất phải giữ AutoFilter');
  assert.ok(expXml.includes('sqref="F3:F500"'), 'File xuất phải giữ Data Validation');

  const reimportPreview = parseAndPreviewA1Import({ buffer: expBytes, unitCode: 'CK', existingA1: applied1.nextA1 });
  assert.strictEqual(reimportPreview.ok, true);
  assert.strictEqual(reimportPreview.summary.newCount, 0);
  assert.strictEqual(reimportPreview.summary.unchangedCount, 2, 'Nhập lại file xuất phải bỏ qua 2 dòng trùng nội dung');
  const reapplied = applyA1ImportPreview({ preview: reimportPreview, existingA1: applied1.nextA1, unitCode: 'CK' });
  assert.strictEqual(reapplied.nextA1.length, 2, 'Số dòng không tăng khi nhập lại');

  // 7. Xung đột cùng mã nhưng khác nội dung -> báo xung đột, không ghi đè
  const wbConflict = XLSX.read(expBytes, { type: 'array' });
  wbConflict.Sheets[A1_SHEET_NAME]['B3'] = { t: 's', v: 'Tên nhiệm vụ đã bị sửa khác' };
  const conflictBuf = new Uint8Array(XLSX.write(wbConflict, { bookType: 'xlsx', type: 'array' }));
  const conflictPreview = parseAndPreviewA1Import({ buffer: conflictBuf, unitCode: 'CK', existingA1: applied1.nextA1 });
  assert.strictEqual(conflictPreview.ok, false);
  assert.strictEqual(conflictPreview.summary.conflictCount, 1, 'Phải phát hiện 1 dòng xung đột');
  assert.strictEqual(applyA1ImportPreview({ preview: conflictPreview, existingA1: applied1.nextA1, unitCode: 'CK' }).ok, false);

  // 8. File lẫn cả dòng đúng và dòng lỗi -> không ghi một phần lô
  const wbMixed = XLSX.read(tplBytes, { type: 'array' });
  XLSX.utils.sheet_add_aoa(wbMixed.Sheets[A1_SHEET_NAME], [
    ['', 'Nhiệm vụ đúng', 'Khoa Cơ khí', 'QĐ 2266', '01/10/2025–30/9/2026', 'Tiếp tục thực hiện', 'QĐ 2266'],
    ['', '   ', 'Khoa Cơ khí', 'QĐ 2266', '01/10/2025–30/9/2026', 'Sai trạng thái', 'QĐ 2266']
  ], { origin: 'A3' });
  const mixedBuf = new Uint8Array(XLSX.write(wbMixed, { bookType: 'xlsx', type: 'array' }));
  const mixedPreview = parseAndPreviewA1Import({ buffer: mixedBuf, unitCode: 'CK', existingA1: applied1.nextA1 });
  assert.strictEqual(mixedPreview.ok, false);
  assert.strictEqual(mixedPreview.summary.newCount, 1);
  assert.ok(mixedPreview.summary.errorCount >= 2);
  const mixedApply = applyA1ImportPreview({ preview: mixedPreview, existingA1: applied1.nextA1, unitCode: 'CK' });
  assert.strictEqual(mixedApply.ok, false, 'Còn lỗi thì không được ghi một phần lô');
  assert.strictEqual(mixedApply.nextA1.length, 2, 'Dữ liệu gốc phải nguyên vẹn');

  // 9. Kiểm thử API PUT /api/workbooks/[id] trên dữ liệu cô lập (thiếu quyền, thiếu trường, hồ sơ khóa, ghi đồng thời)
  process.env.VTVL_ISOLATED_LOCAL_STORE = 'true';
  resetWorkbookMemoryStore();
  resetAccountMemoryStore();
  upsertUserAccount({ email: 'leader.ck@hcmute.edu.vn', displayName: 'Lãnh đạo CK', unitCode: 'CK', role: 'unit_leader', hasSelectedUnit: true });
  upsertUserAccount({ email: 'staff.ck@hcmute.edu.vn', displayName: 'Giảng viên CK', unitCode: 'CK', role: 'staff', hasSelectedUnit: true });
  const leaderTok = generateUserSessionToken({ email: 'leader.ck@hcmute.edu.vn', unitCode: 'CK', role: 'unit_leader', displayName: 'Lãnh đạo CK' });
  const staffTok = generateUserSessionToken({ email: 'staff.ck@hcmute.edu.vn', unitCode: 'CK', role: 'staff', displayName: 'Giảng viên CK' });

  const wb = getOrCreateWorkbook('CK', '01/10/2025–30/9/2026', 'leader.ck@hcmute.edu.vn', 'Lãnh đạo CK', 'Lãnh đạo đơn vị');
  // Lưu 1 dòng cũ thiếu trường trực tiếp ở tầng store để kiểm tra tương thích ngược + giữ liên kết A2
  const linkedA2 = [{ id: 'a2-1', maCongViec: 'CK.NV01.CV01', maNhiemVu: 'CK.NV01', maVtvl: 'CK.HT31', tenCongViec: 'Bảo trì xưởng' }];
  const seedSave = saveServerWorkbook({ workbookId: wb.id, data: { ...wb.data, A1: [legacyIncomplete], A2: linkedA2 }, baseRevision: wb.currentRevision, actorEmail: 'leader.ck@hcmute.edu.vn' });
  const revAfterSeed = seedSave.currentRevision;

  const callPut = (token: string, body: Record<string, unknown>) =>
    PUT(new Request('http://localhost/api/workbooks/' + wb.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body)
    }), { params: Promise.resolve({ id: wb.id }) });

  // 9a. Staff thiếu quyền -> 403
  const resStaff = await callPut(staffTok, { data: { ...wb.data, A1: [legacyIncomplete, validSecond], A2: linkedA2 }, baseRevision: revAfterSeed });
  assert.strictEqual(resStaff.status, 403, 'Staff phải bị chặn 403');

  // 9b. Lãnh đạo gửi dòng mới thiếu trường -> 400 A1_VALIDATION_FAILED
  const resMissing = await callPut(leaderTok, { data: { ...wb.data, A1: [legacyIncomplete, { ...validSecond, nguon: '   ' }], A2: linkedA2 }, baseRevision: revAfterSeed });
  assert.strictEqual(resMissing.status, 400, 'Dòng mới thiếu nguồn phải trả 400');

  // 9c. Hai lượt thêm mới đồng thời cùng baseRevision -> 1 thành công (200), 1 xung đột (409)
  const [resConc1, resConc2] = await Promise.all([
    callPut(leaderTok, { data: { ...wb.data, A1: [legacyIncomplete, validSecond], A2: linkedA2 }, baseRevision: revAfterSeed }),
    callPut(leaderTok, { data: { ...wb.data, A1: [legacyIncomplete, { ...validSecond, id: 'a1-new-3', maNhiemVu: 'CK.NV03' }], A2: linkedA2 }, baseRevision: revAfterSeed })
  ]);
  const statuses = [resConc1.status, resConc2.status].sort();
  assert.deepStrictEqual(statuses, [200, 409], 'Hai lượt lưu đồng thời phải có đúng 1 lượt 200 và 1 lượt 409');

  // 9d. Hồ sơ đã khóa (approved) -> bị từ chối 403 FORBIDDEN_UNIT_APPROVED_LOCKED
  const liveWb = getWorkbookById(wb.id);
  if (liveWb) liveWb.status = 'approved';
  const resLocked = await callPut(leaderTok, { data: { ...wb.data, A1: [legacyIncomplete, validSecond, { ...validSecond, id: 'a1-new-4', maNhiemVu: 'CK.NV04' }], A2: linkedA2 }, baseRevision: revAfterSeed + 1 });
  assert.strictEqual(resLocked.status, 403, 'Hồ sơ đã khóa phải chặn ghi 403 (nhận ' + resLocked.status + ')');

  console.log('ALL_A1_EXCEL_AND_VALIDATION_TESTS_PASS');
}
main().catch((e) => { console.error(e); process.exit(1); });
`;

const tmpScript = path.join(root, '.tmp-a1-test.ts');
fs.writeFileSync(tmpScript, tsTest);
try {
  const out = execSync(`npx tsx "${tmpScript}"`, { encoding: 'utf8', stdio: 'pipe' });
  console.log(out.trim());
  assert.ok(out.includes('ALL_A1_EXCEL_AND_VALIDATION_TESTS_PASS'));
  console.log('  ✓ [PASS] Toàn bộ kịch bản A1 Excel & Validation (thiếu từng trường, khoảng trắng, trạng thái sai, dòng cũ, AutoFilter/DataValidation, vòng xuất-nhập lại, xung đột, lô hỗn hợp, 403/400/409/khóa hồ sơ)');
} finally {
  if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
}
