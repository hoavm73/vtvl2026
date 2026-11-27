import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { execSync } from 'node:child_process';

const root = process.cwd();
console.log('================================================================');
console.log(' KIỂM THỬ SÂU: ĐỒNG BỘ LƯU C1/409, CHỐNG MẤT DỮ LIỆU & A1 REORDER');
console.log('================================================================');

// 1. Static regression guards (đảm bảo không bao giờ tái phát lỗi gọi lưu đúp / xóa cờ dirty sớm)
const cmdBarSrc = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelCommandBar.tsx'), 'utf8');
assert.ok(!cmdBarSrc.includes('onSaveSheet(); onSaveNow()'), 'ExcelCommandBar không được gọi lưu đúp 2 lần trong 1 cú click');
assert.ok(
  cmdBarSrc.indexOf("isDirty || syncStatus === 'unsaved'") < cmdBarSrc.indexOf("dataSource === 'server_synced'"),
  'ExcelCommandBar phải hiển thị Chưa lưu ưu tiên trước Đã lưu khi isDirty=true'
);

const viewerSrc = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelWorkbookViewer.tsx'), 'utf8');
assert.ok(viewerSrc.includes('shouldApplyRemoteWorkbook('), 'ExcelWorkbookViewer phải dùng shouldApplyRemoteWorkbook để chặn ghi đè dữ liệu cục bộ');
assert.ok(viewerSrc.includes("window.addEventListener('beforeunload'"), 'ExcelWorkbookViewer phải có cảnh báo beforeunload khi còn dữ liệu chưa lưu');
assert.ok(!viewerSrc.includes('|| localDiffers ||'), 'ExcelWorkbookViewer không được tự ghi đè dữ liệu chỉ vì localDiffers khi server không mới hơn');

const tableSrc = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelTableRenderer.tsx'), 'utf8');
assert.ok(!tableSrc.includes("handleSort('id')"), 'Cột STT không được sắp xếp theo chuỗi id ngẫu nhiên');
assert.ok(tableSrc.includes('onRestoreRow(deletedRowBackup.row, deletedRowBackup.index)'), 'Hoàn tác xóa dòng phải khôi phục đúng bản ghi đã xóa thay vì thêm dòng trống');
console.log('  ✓ [PASS] Static regression guards (Save 1-call, Dirty status priority, Zero-overwrite, Undo restore, STT sort)');

// 2. Runtime deep tests via tsx
const tsTest = `
import assert from 'node:assert';
import { createSerializedSaveQueue, shouldApplyRemoteWorkbook } from './src/components/excel-grid/workbook-sync-queue';
import { moveRowByDirection, sortA1RowsByMissionCode, performSplitMission } from './src/components/excel-grid/excel-grid-a1-helpers';
import { validateAndNormalizeUnitC1Rows, getVtvlCatalog } from './src/services/storage/server-vtvl-catalog-store';
import { validateNewSheetRowsForSave } from './src/services/workbooks/workbook-sheet-validation';

async function main() {
  // 2A. Single-flight save queue: 5 overlapping save requests -> max concurrency = 1, 0 self-409 conflicts
  const queue = createSerializedSaveQueue<{ seq: number }>();
  let serverRev = 106;
  let clientRev = 106;
  let activeCalls = 0;
  let maxConcurrent = 0;
  const executedSeqs: number[] = [];

  const simulatedPut = async (payload: { seq: number }) => {
    activeCalls += 1;
    maxConcurrent = Math.max(maxConcurrent, activeCalls);
    const baseRev = clientRev;
    await new Promise((r) => setTimeout(r, 15));
    activeCalls -= 1;
    // Máy chủ từ chối 409 nếu baseRev < serverRev
    if (baseRev < serverRev) return false;
    serverRev += 1;
    clientRev = serverRev;
    executedSeqs.push(payload.seq);
    return true;
  };

  const results = await Promise.all([
    queue.enqueue({ seq: 1 }, simulatedPut),
    queue.enqueue({ seq: 2 }, simulatedPut),
    queue.enqueue({ seq: 3 }, simulatedPut),
    queue.enqueue({ seq: 4 }, simulatedPut),
    queue.enqueue({ seq: 5 }, simulatedPut)
  ]);

  assert.strictEqual(maxConcurrent, 1, 'Không bao giờ được có >1 PUT chạy song song');
  assert.deepStrictEqual(results, [true, true, true, true, true], 'Mọi caller phải nhận true, 0 xung đột 409');
  assert.deepStrictEqual(executedSeqs, [1, 5], 'Các payload trung gian (2,3,4) phải được gộp gọn thành payload mới nhất (5)');
  assert.strictEqual(serverRev, 108, 'Revision phải tăng tuần tự 106 -> 107 -> 108');

  // 2B. Failure propagation: nếu PUT thất bại (409/400), các lệnh chờ cũng nhận false (không xóa dirty)
  const failQueue = createSerializedSaveQueue<{ seq: number }>();
  const failResults = await Promise.all([
    failQueue.enqueue({ seq: 1 }, async () => { await new Promise((r) => setTimeout(r, 10)); return false; }),
    failQueue.enqueue({ seq: 2 }, async () => true)
  ]);
  assert.deepStrictEqual(failResults, [false, false], 'Khi PUT đang bay thất bại, hàng đợi phải trả false và không bắn tiếp');

  // 2C. Zero-data-loss decision matrix (10 dòng C1 vừa nhập không bao giờ bị ghi đè)
  assert.strictEqual(
    shouldApplyRemoteWorkbook({
      isReadOnlyViewer: false, hasDirtySheets: true, isSavingOrUnsaved: false,
      hasLocalGrid: true, savedRev: 106, remoteRev: 106, serverTicketDiff: false
    }),
    'ignore',
    'Đang có 10 dòng C1 chưa lưu & server không mới hơn -> PHẢI bỏ qua, cấm ghi đè'
  );
  assert.strictEqual(
    shouldApplyRemoteWorkbook({
      isReadOnlyViewer: false, hasDirtySheets: false, isSavingOrUnsaved: true,
      hasLocalGrid: true, savedRev: 106, remoteRev: 106, serverTicketDiff: false
    }),
    'ignore',
    'PUT vừa lỗi (status=unsaved) & người dùng quay lại tab -> PHẢI bỏ qua, cấm ghi đè'
  );
  assert.strictEqual(
    shouldApplyRemoteWorkbook({
      isReadOnlyViewer: false, hasDirtySheets: false, isSavingOrUnsaved: false,
      hasLocalGrid: true, savedRev: 106, remoteRev: 106, serverTicketDiff: false
    }),
    'ignore',
    'Server rev === savedRev -> không tự ghi đè dữ liệu cục bộ'
  );
  assert.strictEqual(
    shouldApplyRemoteWorkbook({
      isReadOnlyViewer: false, hasDirtySheets: true, isSavingOrUnsaved: false,
      hasLocalGrid: true, savedRev: 106, remoteRev: 107, serverTicketDiff: false
    }),
    'mark_stale',
    'Có dữ liệu chưa lưu VÀ người khác đã lưu v107 -> cảnh báo xung đột, không tự xóa dữ liệu cục bộ'
  );
  assert.strictEqual(
    shouldApplyRemoteWorkbook({
      isReadOnlyViewer: false, hasDirtySheets: false, isSavingOrUnsaved: false,
      hasLocalGrid: true, savedRev: 106, remoteRev: 107, serverTicketDiff: false
    }),
    'apply',
    'Không có sửa đổi cục bộ VÀ server có v107 mới hơn -> nạp bản mới'
  );
  assert.strictEqual(
    shouldApplyRemoteWorkbook({
      isReadOnlyViewer: false, hasDirtySheets: true, isSavingOrUnsaved: true,
      hasLocalGrid: true, savedRev: 106, remoteRev: 106, serverTicketDiff: false, forceReload: true
    }),
    'apply',
    'Người dùng bấm rõ nút Tải lại dữ liệu máy chủ -> luôn nạp lại'
  );

  // 2D. C1 validation & suffix preservation (-02, -03 không bị cắt mất trên server)
  const firstCatalogCode = getVtvlCatalog({ activeOnly: true })[0]?.code;
  assert.ok(firstCatalogCode, 'Danh mục VTVL chuẩn phải có ít nhất 1 mã đang hoạt động');
  const c1Res = validateAndNormalizeUnitC1Rows({
    unitCode: 'CNTT',
    incomingC1: [
      { id: 'c1-1', maVtvl: 'CNTT.' + firstCatalogCode, tenVtvl: '', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', trangThai: 'Tiếp tục sử dụng' },
      { id: 'c1-2', maVtvl: 'CNTT.' + firstCatalogCode + '-02', tenVtvl: '', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', trangThai: 'Tiếp tục sử dụng' }
    ]
  });
  assert.strictEqual(c1Res.ok, true, 'C1 có hậu tố -02 hợp lệ phải được chấp nhận');
  if (c1Res.ok) {
    assert.strictEqual(c1Res.normalizedC1[0].maVtvl, 'CNTT.' + firstCatalogCode);
    assert.strictEqual(c1Res.normalizedC1[1].maVtvl, 'CNTT.' + firstCatalogCode + '-02', 'Hậu tố -02 phải được bảo toàn nguyên vẹn');
  }

  // C1 dòng mới hoặc dòng cũ bị xóa trống maVtvl -> client validation chặn trước khi gửi server
  const c1ClientCheck = validateNewSheetRowsForSave({
    sheetKey: 'C1',
    incomingRows: [{ id: 'c1-old', maVtvl: '', cheDoLamViec: 'Phổ biến (40 giờ/tuần)', trangThai: 'Tiếp tục sử dụng' }],
    existingRows: [{ id: 'c1-old', maVtvl: 'CNTT.QL01' }]
  });
  assert.strictEqual(c1ClientCheck.ok, false, 'Client phải phát hiện C1 bị xóa trống maVtvl trước khi gọi API');

  // 2E. A1 split + moveRowByDirection + sortA1RowsByMissionCode
  const baseA1 = [
    { id: 'r1', maNhiemVu: 'CK.NV01', tenNhiemVu: 'Nhiệm vụ 1' },
    { id: 'r2', maNhiemVu: 'CK.NV02', tenNhiemVu: 'Nhiệm vụ 2' },
    { id: 'r3', maNhiemVu: 'CK.NV10', tenNhiemVu: 'Nhiệm vụ 10' }
  ];
  const split = performSplitMission(baseA1, 'r1', 'CK');
  assert.ok(split, 'Tách nhiệm vụ phải thành công');
  assert.strictEqual(split!.nextCode, 'CK.NV11');
  assert.deepStrictEqual(split!.nextRows.map((r) => r.maNhiemVu), ['CK.NV01', 'CK.NV11', 'CK.NV02', 'CK.NV10']);

  // Di chuyển dòng CK.NV11 xuống 2 nấc về cuối bảng
  const m1 = moveRowByDirection(split!.nextRows, split!.newRow.id, 'down');
  assert.ok(m1);
  assert.deepStrictEqual(m1!.map((r) => r.maNhiemVu), ['CK.NV01', 'CK.NV02', 'CK.NV11', 'CK.NV10']);
  const m2 = moveRowByDirection(m1!, split!.newRow.id, 'down');
  assert.ok(m2);
  assert.deepStrictEqual(m2!.map((r) => r.maNhiemVu), ['CK.NV01', 'CK.NV02', 'CK.NV10', 'CK.NV11']);
  assert.strictEqual(moveRowByDirection(m2!, split!.newRow.id, 'down'), null, 'Không thể di chuyển xuống quá cuối bảng');
  assert.strictEqual(moveRowByDirection(m2!, 'r1', 'up'), null, 'Không thể di chuyển lên quá đầu bảng');

  // Sắp xếp tự nhiên theo mã NV (NV01 -> NV02 -> NV10 -> NV11) giữ nguyên mã
  const sorted = sortA1RowsByMissionCode(split!.nextRows);
  assert.deepStrictEqual(sorted.map((r) => r.maNhiemVu), ['CK.NV01', 'CK.NV02', 'CK.NV10', 'CK.NV11']);

  console.log('ALL_WORKBOOK_SYNC_AND_A1_REORDER_TESTS_PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });
`;

const tmpScript = path.join(root, '.tmp-sync-a1-test.ts');
fs.writeFileSync(tmpScript, tsTest);
try {
  const out = execSync(`npx tsx "${tmpScript}"`, { encoding: 'utf8', stdio: 'pipe' });
  console.log(out.trim());
  assert.ok(out.includes('ALL_WORKBOOK_SYNC_AND_A1_REORDER_TESTS_PASS'));
  console.log('  ✓ [PASS] Toàn bộ kiểm thử sâu đồng bộ lưu C1/409, chống mất dữ liệu và sắp xếp/di chuyển A1');
} finally {
  if (fs.existsSync(tmpScript)) fs.unlinkSync(tmpScript);
}
