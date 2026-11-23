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
console.log(' BỘ KIỂM THỬ ĐƠN VỊ & GIAO DIỆN QUY TRÌNH PHIẾU VTVL HCM-UTE');
console.log(' Thực thi hàm chuyển trạng thái, công thức A2/B1/B2 & UI Props');
console.log('================================================================');

const pageCode = fs.readFileSync(path.join(root, 'src/app/phieu-cong-viec/page.tsx'), 'utf8');
const reviewListCode =
  fs.readFileSync(path.join(root, 'src/components/staff-portal/UnitTicketsReviewList.tsx'), 'utf8') +
  '\n' +
  fs.readFileSync(path.join(root, 'src/components/staff-portal/UnitTicketActionButtons.tsx'), 'utf8');
const myListCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffMyTicketsList.tsx'), 'utf8');
const inlineFormCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketInlineForm.tsx'), 'utf8');
const fieldsSectionCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketModernForm.tsx'), 'utf8');
const detailModalCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketDetailModal.tsx'), 'utf8');
const versionDiffCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketVersionDiffTab.tsx'), 'utf8');
const mergePreviewCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketMergePreviewModal.tsx'), 'utf8');
const printSheetCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketA4Preview.tsx'), 'utf8');

runTest('Ca 1: Thực thi hàm chuẩn hóa trạng thái toCanonicalStatus & toDisplayStatus', () => {
  const tsxCode = `
    const assert = require('assert');
    const { toCanonicalStatus, toDisplayStatus } = require('./src/types/staff-ticket');

    assert.strictEqual(toCanonicalStatus('Nháp'), 'draft');
    assert.strictEqual(toCanonicalStatus('draft'), 'draft');
    assert.strictEqual(toCanonicalStatus('Đã nộp'), 'submitted');
    assert.strictEqual(toCanonicalStatus('submitted'), 'submitted');
    assert.strictEqual(toCanonicalStatus('Yêu cầu bổ sung'), 'changes_requested');
    assert.strictEqual(toCanonicalStatus('Trả lại'), 'changes_requested');
    assert.strictEqual(toCanonicalStatus('changes_requested'), 'changes_requested');
    assert.strictEqual(toCanonicalStatus('Đã nộp lại'), 'resubmitted');
    assert.strictEqual(toCanonicalStatus('resubmitted'), 'resubmitted');
    assert.strictEqual(toCanonicalStatus('Đã duyệt'), 'approved');
    assert.strictEqual(toCanonicalStatus('approved'), 'approved');

    assert.strictEqual(toDisplayStatus('draft'), 'Nháp');
    assert.strictEqual(toDisplayStatus('submitted'), 'Đã nộp');
    assert.strictEqual(toDisplayStatus('changes_requested'), 'Yêu cầu bổ sung');
    assert.strictEqual(toDisplayStatus('resubmitted'), 'Đã nộp lại');
    assert.strictEqual(toDisplayStatus('approved'), 'Đã duyệt');
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

runTest('Ca 2: Thực thi công thức recalculateGridFormulas — phân định rõ A2 -> B1 và B2_CT -> B2 (không tự sinh B2 giả)', () => {
  const tsxCode = `
    const assert = require('assert');
    const { recalculateGridFormulas } = require('./src/components/excel-grid/excel-grid-formulas');

    // Trường hợp 1: Chỉ có dòng A2 và B1 từ phiếu đã gộp, không có B2_CT -> B2 phải rỗng (0 dòng giả)
    const afterMergeNoB2Ct = recalculateGridFormulas({
      A1: [{ id: 'a1-1', maNhiemVu: 'SDH.NV01', tenNhiemVu: 'Đào tạo Sau đại học' }],
      A2: [{ id: 'a2-t1', maCongViec: 'SDH.NV01.CV01', maNhiemVu: 'SDH.NV01', maVtvl: 'SDH.CV01', tenCongViec: 'Thẩm định luận văn', sanPham: 'Hồ sơ' }],
      B1: [{ id: 'b1-t1', maCongViec: 'SDH.NV01.CV01', maVtvl: 'SDH.CV01', soSpNam: 15, phutThucTe: 120, gioBoSung: 12 }],
      B2_CT: [],
      B2: []
    }, 'SDH', 'Viện Sau Đại học');

    assert.strictEqual(afterMergeNoB2Ct.B1.length, 1);
    assert.strictEqual(afterMergeNoB2Ct.B1[0].gioSp, 30, 'B1 gioSp = (15 * 120)/60 = 30 giờ');
    assert.strictEqual(afterMergeNoB2Ct.B1[0].gioTong, 42, 'B1 gioTong = 30 + 12 = 42 giờ');
    assert.strictEqual(afterMergeNoB2Ct.B2.length, 0, 'Khi không có dữ liệu B2_CT thì không được tự sinh số liệu B2 giả');

    // Trường hợp 2: Có dữ liệu biến động tại B2_CT -> B2 tổng hợp trung thực từ B2_CT
    const afterMergeWithB2Ct = recalculateGridFormulas({
      A1: [{ id: 'a1-1', maNhiemVu: 'SDH.NV01', tenNhiemVu: 'Đào tạo Sau đại học' }],
      A2: [{ id: 'a2-t1', maCongViec: 'SDH.NV01.CV01', maNhiemVu: 'SDH.NV01', maVtvl: 'SDH.CV01', tenCongViec: 'Thẩm định luận văn', sanPham: 'Hồ sơ' }],
      B1: [{ id: 'b1-t1', maCongViec: 'SDH.NV01.CV01', maVtvl: 'SDH.CV01', soSpNam: 15, phutThucTe: 120, gioBoSung: 12 }],
      B2_CT: [
        { id: 'b2ct-1', maCongViec: 'SDH.NV01.CV01', maVtvl: 'SDH.CV01', gioBienDong: -6 },
        { id: 'b2ct-2', maCongViec: 'SDH.NV01.CV01', maVtvl: 'SDH.CV01', gioBienDong: -4 }
      ],
      B2: []
    }, 'SDH', 'Viện Sau Đại học');

    assert.strictEqual(afterMergeWithB2Ct.B2.length, 1, 'Khi có B2_CT thì B2 phải tổng hợp đúng 1 dòng cho mã công việc');
    assert.strictEqual(afterMergeWithB2Ct.B2[0].gioB1, 42);
    assert.strictEqual(afterMergeWithB2Ct.B2[0].gioGiam, -10);
    assert.strictEqual(afterMergeWithB2Ct.B2[0].gioSauTacDong, 32);
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

runTest('Ca 3: Giao diện biểu mẫu phiếu công việc dùng ShadcnSelect cho trường chọn & textarea tô nền xanh nhạt khi có nội dung', () => {
  assert.ok(fieldsSectionCode.includes('ShadcnSelect'), 'Trường chọn Nhiệm vụ A1 và VTVL C1 phải dùng ShadcnSelect');
  assert.ok(fieldsSectionCode.includes('<textarea'), 'Các trường tự nhập phải dùng textarea');
  assert.ok(fieldsSectionCode.includes('border-[#7cc4f5] bg-[#eff8ff]'), 'Ô đã nhập phải được tô nền xanh dương nhạt border-[#7cc4f5] bg-[#eff8ff]');
  assert.ok(fieldsSectionCode.includes('Số sản phẩm hoàn thành trong năm trong chu kỳ 1 năm (01/10/2025 đến 30/9/2026)'), 'Nhãn Số sản phẩm hoàn thành trong năm phải đúng chuẩn chu kỳ 01/10/2025 đến 30/9/2026');
  assert.ok(fieldsSectionCode.includes('Giờ bổ sung (Nếu có)'), 'Nhãn Giờ bổ sung (Nếu có) phải đúng yêu cầu');
});

runTest('Ca 4: Biểu mẫu kiểm tra bắt buộc nhập Giải trình nội dung cập nhật khi nộp lại (client & server)', () => {
  assert.ok(inlineFormCode.includes("if (isResubmittingMode && !changeSummary.trim()) missing.push('Giải trình nội dung đã cập nhật / chỉnh sửa')"), 'InlineForm phải bắt buộc nhập Giải trình khi nộp lại');
  assert.ok(pageCode.includes("if (isResubmit && !t.lastChangeSummary?.trim()) missing.push('Giải trình nội dung đã cập nhật / chỉnh sửa')"), 'Trang phiếu công việc phải kiểm tra Giải trình khi bấm Nộp lại');
});

runTest('Ca 5: Modal Xem trước gộp (StaffTicketMergePreviewModal) giữ nhãn nút "Gộp vào B1/B2" và mô tả trung thực Biểu A2 & B1', () => {
  assert.ok(mergePreviewCode.includes('Gộp vào B1/B2 — Xem trước dữ liệu') && mergePreviewCode.includes("'Gộp vào B1/B2'"), 'Nút và tiêu đề modal giữ nhãn cũ "Gộp vào B1/B2"');
  assert.ok(mergePreviewCode.includes('1. Bản ghi vào Biểu A2 (Danh mục công việc & sản phẩm)'), 'Mục 1 của modal phải ghi rõ Biểu A2, không gọi nhầm A2 là B2');
  assert.ok(mergePreviewCode.includes('2. Bản ghi vào Biểu B1 (Thống kê sản phẩm & định mức giờ)'), 'Mục 2 của modal phải ghi rõ Biểu B1');
  assert.ok(mergePreviewCode.includes('3. Liên kết Biểu B2 (Tổng hợp nhật ký khảo sát giờ):'), 'Mục 3 giải thích rõ điều kiện liên kết Biểu B2 từ B2_CT');
  assert.ok(reviewListCode.includes('Gộp vào B1/B2') && reviewListCode.includes('Đã gộp B1/B2') && myListCode.includes('Đã gộp B1/B2'), 'Nút và badge danh sách giữ nhãn "Gộp vào B1/B2" / "Đã gộp B1/B2"');
});

runTest('Ca 8: Nhiều cán bộ cùng kê khai một mã công việc — không ghi đè mất kê khai và không cộng trùng khi gộp lại', () => {
  const tsxCode = `
    import assert from 'assert';
    import { recalculateGridFormulas } from './src/components/excel-grid/excel-grid-formulas';

    // Hai cán bộ (tkt-1 và tkt-2) cùng kê khai mã công việc SDH.NV01.CV01 trên cùng VTVL SDH.CV01
    const result = recalculateGridFormulas({
      A1: [{ id: 'a1-1', maNhiemVu: 'SDH.NV01', tenNhiemVu: 'Quản lý đào tạo Sau đại học' }],
      A2: [
        { id: 'a2-tkt-1', sourceTicketId: 'tkt-1', sourceVersion: 1, maCongViec: 'SDH.NV01.CV01', maNhiemVu: 'SDH.NV01', maVtvl: 'SDH.CV01', tenCongViec: 'Thẩm định hồ sơ (Cán bộ 1)', sanPham: 'Hồ sơ' },
        { id: 'a2-tkt-2', sourceTicketId: 'tkt-2', sourceVersion: 2, maCongViec: 'SDH.NV01.CV01', maNhiemVu: 'SDH.NV01', maVtvl: 'SDH.CV01', tenCongViec: 'Thẩm định hồ sơ (Cán bộ 2)', sanPham: 'Hồ sơ' }
      ],
      B1: [
        { id: 'b1-tkt-1', sourceTicketId: 'tkt-1', sourceVersion: 1, maCongViec: 'SDH.NV01.CV01', maVtvl: 'SDH.CV01', soSpNam: 10, phutThucTe: 60, gioBoSung: 2 },
        { id: 'b1-tkt-2', sourceTicketId: 'tkt-2', sourceVersion: 2, maCongViec: 'SDH.NV01.CV01', maVtvl: 'SDH.CV01', soSpNam: 20, phutThucTe: 60, gioBoSung: 3 }
      ],
      B2_CT: [],
      B2: [],
      C1: [{ id: 'c1-1', maVtvl: 'SDH.CV01', tenVtvl: 'Chuyên viên', gioChuanPp2: 1904 }],
      C3: []
    }, 'SDH', 'Viện Sau Đại học');

    assert.strictEqual(result.B1.length, 2, 'Phải bảo toàn đủ 2 dòng B1 cho 2 cán bộ cùng kê khai 1 mã công việc');
    const b1Row1 = result.B1.find((r) => r.sourceTicketId === 'tkt-1');
    const b1Row2 = result.B1.find((r) => r.sourceTicketId === 'tkt-2');
    assert.ok(b1Row1 && b1Row1.gioTong === 12 && b1Row1.sourceVersion === 1, 'Dòng B1 của Cán bộ 1 giữ đúng 12 giờ (10 + 2) và v1');
    assert.ok(b1Row2 && b1Row2.gioTong === 23 && b1Row2.sourceVersion === 2, 'Dòng B1 của Cán bộ 2 giữ đúng 23 giờ (20 + 3) và v2');
    assert.strictEqual(result.C3[0].gioB1, 35, 'Biểu C3 phải cộng đúng tổng 12 + 23 = 35 giờ từ cả 2 cán bộ');
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

runTest('Ca 6: Modal chi tiết phiếu hiển thị đầy đủ lịch sử phiên bản (v1, v2, v3...) và bộ chọn đối chiếu từng trường', () => {
  assert.ok(detailModalCode.includes('StaffTicketVersionDiffTab'), 'Modal chi tiết phải tích hợp StaffTicketVersionDiffTab');
  assert.ok(versionDiffCode.includes('computeTicketVersionDiff'), 'Component đối chiếu phải gọi computeTicketVersionDiff');
  assert.ok(versionDiffCode.includes('MIGRATION_BASELINE_LABEL'), 'Hiển thị rõ MIGRATION_BASELINE_LABEL ("Bản ghi chuyển đổi dữ liệu") cho phiếu cũ');
  assert.ok(versionDiffCode.includes('MISSING_PRIOR_DATA_LABEL'), 'Hiển thị rõ MISSING_PRIOR_DATA_LABEL khi phiếu Nháp chưa có lịch sử phiên bản');
});

runTest('Ca 7: Bản in PDF A4 của phiếu công việc giữ nguyên định dạng chuẩn hành chính HCM-UTE', () => {
  const printModalCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketPrintModal.tsx'), 'utf8');
  assert.ok(!printSheetCode.includes('BỘ GIÁO DỤC VÀ ĐÀO TẠO') && !detailModalCode.includes('BỘ GIÁO DỤC VÀ ĐÀO TẠO') && !printModalCode.includes('BỘ GIÁO DỤC VÀ ĐÀO TẠO'), 'Đã bỏ dòng BỘ GIÁO DỤC VÀ ĐÀO TẠO');
  assert.ok(printSheetCode.includes('font-normal whitespace-nowrap">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM</div>'), 'Tên trường không in đậm và nằm trên cùng 1 hàng');
  assert.ok(printSheetCode.includes('font-bold uppercase mt-0.5">{props.unitNameVi}</div>'), 'Tên đơn vị in đậm bên dưới tên trường');
  assert.ok(printSheetCode.includes('print:block'), 'Bản in PDF hỗ trợ chế độ in A4');
});

runTest('Ca 9: Dòng thời gian lịch sử phê duyệt (buildDisplayApprovalEvents) giữ đủ người duyệt, phản hồi và thời gian qua nhiều vòng', () => {
  const progressCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/TicketApprovalProgress.tsx'), 'utf8');
  const ticketStoreCode = fs.readFileSync(path.join(root, 'src/services/storage/server-ticket-store.ts'), 'utf8');

  assert.ok(detailModalCode.includes('Lịch sử phê duyệt') && detailModalCode.includes('TicketApprovalHistoryTimeline'), 'Modal chi tiết phải có tab Lịch sử phê duyệt');
  assert.ok(progressCode.includes('TicketApprovalSummaryStrip') && progressCode.includes('TicketApprovalHistoryTimeline'), 'Thanh tiến trình duyệt phải gắn tóm tắt người duyệt và dòng lịch sử mở rộng');
  assert.ok(ticketStoreCode.includes('fetchStatusHistoryFromSupabase') && ticketStoreCode.includes('mergeTicketStatusHistory'), 'Server ticket store phải đồng bộ và gộp lịch sử duyệt từ work_survey_status_history');

  const tsxCode = `
    import assert from 'assert';
    import { buildDisplayApprovalEvents, formatApprovalDateTime } from './src/components/staff-portal/TicketApprovalHistoryTimeline';

    const fullTicket = {
      id: 'tkt-test-9',
      unitCode: 'TCNS',
      ownerEmail: 'cb@hcmute.edu.vn',
      ownerName: 'Nguyễn Văn A',
      ownerRole: 'Cán bộ',
      missionCode: 'TCNS.NV01',
      taskCode: 'TCNS.NV01.CV01',
      vtvlCode: 'TCNS.CV01',
      taskName: 'Tổng hợp hồ sơ',
      productCountPerYear: 12,
      minutesPerProduct: 60,
      extraHoursPerYear: 0,
      status: 'approved',
      isMergedToB1B2: true,
      createdAt: '2026-10-01T08:00:00Z',
      updatedAt: '2026-10-05T10:00:00Z',
      statusHistory: [
        { id: 'h5', surveyId: 'tkt-test-9', toStatus: 'approved', action: 'MERGE_TO_SHEETS', actorId: 'truong.tcns@hcmute.edu.vn', actorName: 'Trần Thị Trưởng', actorRole: 'unit_leader', createdAt: '2026-10-05T10:30:00Z' },
        { id: 'h2', surveyId: 'tkt-test-9', fromStatus: 'submitted', toStatus: 'changes_requested', action: 'REQUEST_CHANGES', reason: 'Cần bổ sung minh chứng số lượng hồ sơ', actorId: 'truong.tcns@hcmute.edu.vn', actorName: 'Trần Thị Trưởng', actorRole: 'unit_leader', createdAt: '2026-10-02T09:15:00Z' },
        { id: 'h1', surveyId: 'tkt-test-9', fromStatus: 'draft', toStatus: 'submitted', action: 'SUBMIT', actorId: 'cb@hcmute.edu.vn', actorRole: 'staff', createdAt: '2026-10-01T09:00:00Z' },
        { id: 'h4', surveyId: 'tkt-test-9', fromStatus: 'resubmitted', toStatus: 'approved', action: 'APPROVE', reason: 'Đã đối chiếu đạt định mức', actorId: 'truong.tcns@hcmute.edu.vn', actorName: 'Trần Thị Trưởng', actorRole: 'unit_leader', createdAt: '2026-10-04T14:20:00Z' },
        { id: 'h3', surveyId: 'tkt-test-9', fromStatus: 'changes_requested', toStatus: 'resubmitted', action: 'RESUBMIT', reason: 'Đã đính kèm biên bản thống kê', actorId: 'cb@hcmute.edu.vn', actorRole: 'staff', createdAt: '2026-10-03T11:05:00Z' }
      ]
    };

    const events = buildDisplayApprovalEvents(fullTicket);
    assert.strictEqual(events.length, 5);
    assert.deepStrictEqual(events.map((e) => e.action), ['SUBMIT', 'REQUEST_CHANGES', 'RESUBMIT', 'APPROVE', 'MERGE_TO_SHEETS']);
    assert.strictEqual(events[0].actorName, 'Nguyễn Văn A');
    assert.strictEqual(events[1].actorName, 'Trần Thị Trưởng');
    assert.strictEqual(events[1].reason, 'Cần bổ sung minh chứng số lượng hồ sơ');
    assert.strictEqual(events[3].actorName, 'Trần Thị Trưởng');
    assert.strictEqual(events[3].reason, 'Đã đối chiếu đạt định mức');
    assert.ok(formatApprovalDateTime(events[3].timestampIso).includes('·'));

    const legacyTicket = {
      ...fullTicket,
      statusHistory: [],
      submittedAt: '2026-10-01T09:00:00Z',
      revisionRequestedAt: '2026-10-02T09:15:00Z',
      revisionRequestedBy: 'truong.tcns@hcmute.edu.vn',
      revisionRequestedByName: 'Trần Thị Trưởng',
      revisionReason: 'Bổ sung minh chứng',
      resubmittedAt: '2026-10-03T11:05:00Z',
      lastChangeSummary: 'Đã cập nhật sản lượng',
      approvedAt: '2026-10-04T14:20:00Z',
      approvedBy: 'truong.tcns@hcmute.edu.vn',
      approvedByName: 'Trần Thị Trưởng',
      mergedAt: '2026-10-05T10:30:00Z',
      mergedBy: 'truong.tcns@hcmute.edu.vn',
      mergedByName: 'Trần Thị Trưởng'
    };
    const fallbackEvents = buildDisplayApprovalEvents(legacyTicket);
    assert.strictEqual(fallbackEvents.length, 5);
    assert.strictEqual(fallbackEvents[1].reason, 'Bổ sung minh chứng');
    assert.strictEqual(fallbackEvents[3].actorName, 'Trần Thị Trưởng');
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

runTest('Ca 10: Thanh công cụ và cột lưới trang Phiếu công việc chống tràn ngang ở mọi độ rộng màn hình', () => {
  const toolbarCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketToolbar.tsx'), 'utf8');

  assert.ok(!toolbarCode.includes('flex-nowrap'), 'StaffTicketToolbar không được dùng flex-nowrap gây tràn ngang');
  assert.ok(inlineFormCode.includes('grid-cols-2') && inlineFormCode.includes('Xem trước bản in A4'), 'StaffTicketInlineForm dùng grid-cols-2 cho bộ chuyển chế độ và giữ nhãn Xem trước bản in A4');
  assert.ok(pageCode.includes('xl:col-span-6 min-w-0'), 'Các cột xl:col-span-6 tại trang phiếu công việc phải có min-w-0');
});

runTest('Ca 11: Tách rõ 4 tab cá nhân tại /phieu-cong-viec và 3 tab duyệt/gộp đơn vị tại /phieu-don-vi', () => {
  const tabBarCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketsTabBar.tsx'), 'utf8');
  const unitHeaderCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/UnitTicketsHeaderBar.tsx'), 'utf8');
  const filterBarCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/UnitTicketsFilterBar.tsx'), 'utf8');
  const cascadeHelperCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/unit-tickets-cascade-helpers.ts'), 'utf8');
  const sideCardCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/ProposedCoordinatedSideCard.tsx'), 'utf8');

  assert.ok(
    tabBarCode.includes("export type StaffTicketsTabKey = 'my-tickets' | 'create' | 'coordination' | 'relationships';"),
    'StaffTicketsTabBar phải khai báo đúng 4 tab cá nhân'
  );
  assert.ok(
    tabBarCode.includes('Phiếu của tôi') && tabBarCode.includes('Tạo phiếu công việc') && tabBarCode.includes('Công việc phối hợp với tôi') && tabBarCode.includes('Mối quan hệ công việc'),
    'StaffTicketsTabBar phải hiển thị đúng 4 nhãn tab cá nhân'
  );
  assert.ok(
    unitHeaderCode.includes('Toàn bộ phiếu đơn vị') && unitHeaderCode.includes('Chờ duyệt') && unitHeaderCode.includes('Đã duyệt'),
    'UnitTicketsHeaderBar trên /phieu-don-vi phải hiển thị đủ 3 tab quản lý phiếu đơn vị'
  );
  assert.ok(
    reviewListCode.includes('buildPendingCascadeState(') &&
    cascadeHelperCode.includes("c === 'submitted' || c === 'resubmitted' || c === 'changes_requested'"),
    'Tab Chờ duyệt trong UnitTicketsReviewList phải bao gồm cả submitted, resubmitted và changes_requested'
  );
  assert.ok(
    reviewListCode.includes("mode === 'approved'") && filterBarCode.includes('Yêu cầu bổ sung'),
    'UnitTicketsReviewList và UnitTicketsFilterBar phải hỗ trợ mode approved và bộ lọc Yêu cầu bổ sung'
  );
  assert.ok(
    pageCode.includes("toCanonicalStatus(t.status) === 'draft'") &&
    pageCode.includes('myDraftTickets.length > 0') &&
    pageCode.includes('UnitVtvlLookupCard') &&
    pageCode.includes('ProposedCoordinatedSideCard') &&
    sideCardCode.includes('Các nhiệm vụ được đề xuất phối hợp'),
    'Trang /phieu-cong-viec phải hiển thị danh sách phiếu cá nhân, Danh mục VTVL và Các nhiệm vụ được đề xuất phối hợp'
  );
});

runTest('Ca 12: Banner Tổng quan VTVL dùng đúng ảnh cổng gốc, màu #004776/#D6EAF7, phân quyền nút và tab gọn chuẩn', () => {
  const bannerCode = fs.readFileSync(path.join(root, 'src/components/overview/OverviewWelcomeBanner.tsx'), 'utf8');
  const homeCode = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8');

  assert.ok(bannerCode.includes('Đề án vị trí việc làm 2026–2030'), 'Banner có dòng Đề án vị trí việc làm 2026–2030');
  assert.ok(bannerCode.includes('Hệ thống Vị trí việc làm 360'), 'Banner có tiêu đề Hệ thống Vị trí việc làm 360');
  assert.ok(bannerCode.includes('Trường Đại học Công nghệ Kỹ thuật TP. Hồ Chí Minh (HCM-UTE)'), 'Banner có tên trường HCM-UTE');
  assert.ok(!bannerCode.includes('Chuẩn hóa công việc') && !bannerCode.includes('#bef264'), 'Banner đã bỏ dòng cũ và màu xanh lá chói');
  assert.ok(
    bannerCode.includes('/assets/login/hcmute-gate-line-art-transparent.png') &&
    bannerCode.includes('object-contain') &&
    bannerCode.includes('pointer-events-none') &&
    bannerCode.includes('alt=""'),
    'Banner dùng đúng asset cổng trường chuẩn, object-contain, pointer-events-none và alt=""'
  );
  assert.ok(
    bannerCode.includes('#004776') && bannerCode.includes('#D6EAF7') && bannerCode.includes('rounded-[24px]') && bannerCode.includes('rounded-[12px]'),
    'Banner tuân thủ màu nền #004776, chữ đơn vị #D6EAF7, bo góc 24px và nút bo 12px'
  );
  assert.ok(
    bannerCode.includes("role === 'admin'") &&
    bannerCode.includes("role !== 'staff'") &&
    bannerCode.includes('Trang quản trị') &&
    bannerCode.includes('Phiếu công việc') &&
    bannerCode.includes('Bảng tính 10 biểu'),
    'Banner giữ nguyên phân quyền hiển thị 3 nút cho Admin/Lãnh đạo/Cán bộ'
  );
  assert.ok(
    homeCode.includes('Tổng quan toàn trường') && homeCode.includes('Theo dõi đơn vị') && homeCode.includes('role="tablist"'),
    'Trang chủ giữ đủ 2 tab Tổng quan toàn trường và Theo dõi đơn vị với role="tablist"'
  );
});

runTest('Ca 13: Dashboard Theo dõi đơn vị có ô tìm kiếm + nút Tìm cho Phiếu khảo sát, Nhật ký lịch sử và Bảng đơn vị (có/không dấu)', () => {
  const searchComp = fs.readFileSync(path.join(root, 'src/components/overview/MonitorSearchInput.tsx'), 'utf8');
  const historyPanel = fs.readFileSync(path.join(root, 'src/components/overview/UnitMonitoringHistoryPanel.tsx'), 'utf8');
  const tableComp = fs.readFileSync(path.join(root, 'src/components/overview/UnitMonitoringTable.tsx'), 'utf8');
  const dashComp = fs.readFileSync(path.join(root, 'src/components/overview/UnitMonitoringDashboard.tsx'), 'utf8');
  const typesCode = fs.readFileSync(path.join(root, 'src/components/overview/UnitMonitoringTypes.ts'), 'utf8');

  assert.ok(
    searchComp.includes('<span>Tìm</span>') && searchComp.includes('#006cee') && searchComp.includes('#004776') && !searchComp.includes('text-black'),
    'MonitorSearchInput có nút Tìm chuẩn HCM-UTE S-Link (#006cee/#004776)'
  );
  assert.ok(
    (historyPanel.match(/<MonitorSearchInput/g) || []).length === 2 &&
    historyPanel.includes('ticketSearch') &&
    historyPanel.includes('historySearch') &&
    historyPanel.includes('matchesMonitorSearch'),
    'UnitMonitoringHistoryPanel tích hợp đủ 2 thanh tìm kiếm (Phiếu khảo sát & Nhật ký lịch sử)'
  );
  assert.ok(tableComp.includes('<MonitorSearchInput'), 'UnitMonitoringTable dùng MonitorSearchInput đồng bộ');
  assert.ok(dashComp.includes('matchesMonitorSearch'), 'UnitMonitoringDashboard lọc đơn vị bằng matchesMonitorSearch');
  assert.ok(typesCode.includes('normalizeViSearch') && typesCode.includes('matchesMonitorSearch'), 'UnitMonitoringTypes xuất hàm tìm kiếm tiếng Việt');

  const tsxCode = `
    const assert = require('assert');
    const { normalizeViSearch, matchesMonitorSearch } = require('./src/components/overview/UnitMonitoringTypes');
    assert.strictEqual(normalizeViSearch('Phòng Tổ chức – Nhân sự · Đảng ủy'), 'phong to chuc – nhan su · dang uy');
    assert.strictEqual(matchesMonitorSearch(['TCNS', 'TCNS.NV03.CV01', 'Rà soát quy định', 'Quang Bình Lê'], ''), true);
    assert.strictEqual(matchesMonitorSearch(['TCNS', 'TCNS.NV03.CV01', 'Rà soát quy định', 'Quang Bình Lê'], 'nv03 quang binh'), true);
    assert.strictEqual(matchesMonitorSearch(['DU', 'Đảng ủy Trường'], 'dang uy'), true);
    assert.strictEqual(matchesMonitorSearch(['TCNS', 'TCNS.NV03.CV01', 'Rà soát quy định'], 'khoa co khi'), false);
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

runTest('Ca 14: Luồng Biểu C1 -> Phiếu công việc: Lãnh đạo thêm VTVL mới vào C1, nhân viên cùng đơn vị lấy được ngay qua GET /api/tickets sau reset cache', () => {
  const dataDir = path.join(root, '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupNames = ['server_workbooks.json', 'server_accounts.json', 'accounts.json', 'audit-logs.json', 'audit_logs.json', 'staff_tickets.json'];
  const backups = new Map();
  for (const name of backupNames) {
    const p = path.join(dataDir, name);
    backups.set(name, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }
  try {
    const tsxCode = `
      const assert = require('assert');
      const { NextRequest } = require('next/server');
      const { PUT: putWorkbook } = require('./src/app/api/workbooks/[id]/route');
      const { GET: getTickets } = require('./src/app/api/tickets/route');
      const { generateUserSessionToken } = require('./src/services/storage/server-auth-guard');
      const { upsertUserAccount } = require('./src/services/storage/server-account-store');
      const { getOrCreateWorkbook, resetWorkbookMemoryStore } = require('./src/services/storage/server-workbook-store');
      const { findVtvlCatalogItem } = require('./src/services/storage/server-vtvl-catalog-store');

      (async () => {
        await upsertUserAccount({ email: 'minhhoavo73@gmail.com', displayName: 'Lãnh đạo SĐH', unitCode: 'SDH', unitNameVi: 'Viện Sau Đại học', title: 'Lãnh đạo đơn vị', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'qa.staff.sdh@hcmute.edu.vn', displayName: 'Nhân viên SĐH', unitCode: 'SDH', unitNameVi: 'Viện Sau Đại học', title: 'Cán bộ – Giảng viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);

        const wb = getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', 'minhhoavo73@gmail.com', 'Lãnh đạo đơn vị');
        const originalC1 = JSON.parse(JSON.stringify(wb.data.C1 || []));
        const tokenLeader = generateUserSessionToken({ email: 'minhhoavo73@gmail.com', role: 'unit_leader', unitCode: 'SDH' });
        const tokenStaff = generateUserSessionToken({ email: 'qa.staff.sdh@hcmute.edu.vn', role: 'staff', unitCode: 'SDH' });
        const stdHt45 = findVtvlCatalogItem('HT45');

        const putReq = new NextRequest('http://localhost:3360/api/workbooks/' + wb.id, {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tokenLeader, 'content-type': 'application/json' },
          body: JSON.stringify({
            baseRevision: wb.currentRevision,
            commitMessage: 'QA thêm VTVL chuẩn mới vào Biểu C1',
            data: { ...wb.data, C1: [...originalC1, { id: 'c1-qa-ht45', maVtvl: 'SDH.HT45', tenVtvl: 'Tên client gửi sẽ bị ghi đè', gioChuanPp2: 1904 }] }
          })
        });
        const putRes = await putWorkbook(putReq, { params: Promise.resolve({ id: wb.id }) });
        assert.strictEqual(putRes.status, 200, 'PUT C1 phải trả 200 OK');
        const putJson = await putRes.json();
        const nextRev = putJson?.workbook?.currentRevision;

        resetWorkbookMemoryStore();

        const getReq = new NextRequest('http://localhost:3360/api/tickets?email=qa.staff.sdh@hcmute.edu.vn&unitCode=SDH', {
          headers: { authorization: 'Bearer ' + tokenStaff }
        });
        const getRes = await getTickets(getReq);
        assert.strictEqual(getRes.status, 200, 'GET /api/tickets trả 200 OK');
        const getJson = await getRes.json();
        const foundNew = (getJson.c1Vtvls || []).find((r) => r.maVtvl === 'SDH.HT45');
        assert.ok(foundNew && foundNew.tenVtvl === stdHt45.name, 'Nhân viên phải thấy VTVL SDH.HT45 với tên chuẩn từ danh mục sau khi reset RAM cache');

        const restoreReq = new NextRequest('http://localhost:3360/api/workbooks/' + wb.id, {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tokenLeader, 'content-type': 'application/json' },
          body: JSON.stringify({ baseRevision: nextRev || wb.currentRevision + 1, commitMessage: 'QA khôi phục C1 SĐH', data: { ...wb.data, C1: originalC1 } })
        });
        const restoreRes = await putWorkbook(restoreReq, { params: Promise.resolve({ id: wb.id }) });
        assert.strictEqual(restoreRes.status, 200, 'Khôi phục C1 SĐH ban đầu thành công');
      })().catch((e) => { console.error(e); process.exit(1); });
    `;
    execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'pipe'
    });
  } finally {
    for (const [name, content] of backups.entries()) {
      const p = path.join(dataDir, name);
      if (content === null) { if (fs.existsSync(p)) fs.unlinkSync(p); }
      else fs.writeFileSync(p, content, 'utf8');
    }
  }
});

runTest('Ca 15: RBAC đầy đủ Thêm/Sửa/Xoá VTVL (Biểu C1) cho Lãnh đạo đơn vị, Admin (mọi đơn vị) & Nhân viên chọn VTVL tạo phiếu', () => {
  const dataDir = path.join(root, '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupNames = ['server_workbooks.json', 'server_accounts.json', 'accounts.json', 'audit-logs.json', 'audit_logs.json', 'staff_tickets.json'];
  const backups = new Map();
  for (const name of backupNames) {
    const p = path.join(dataDir, name);
    backups.set(name, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }
  try {
    const tsxCode = `
      const assert = require('assert');
      const { NextRequest } = require('next/server');
      const { PUT: putWorkbook } = require('./src/app/api/workbooks/[id]/route');
      const { GET: getTickets, POST: postTicket } = require('./src/app/api/tickets/route');
      const { generateUserSessionToken } = require('./src/services/storage/server-auth-guard');
      const { upsertUserAccount } = require('./src/services/storage/server-account-store');
      const { getOrCreateWorkbook, resetWorkbookMemoryStore } = require('./src/services/storage/server-workbook-store');
      const { findVtvlCatalogItem } = require('./src/services/storage/server-vtvl-catalog-store');

      (async () => {
        await upsertUserAccount({ email: 'tcns@hcmute.edu.vn', displayName: 'Quản trị viên TCNS', unitCode: 'TCNS', unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Quản trị viên', role: 'admin', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'qa.leader.sdh@hcmute.edu.vn', displayName: 'Lãnh đạo SĐH', unitCode: 'SDH', unitNameVi: 'Viện Sau Đại học', title: 'Lãnh đạo đơn vị', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'qa.staff.sdh@hcmute.edu.vn', displayName: 'Nhân viên SĐH', unitCode: 'SDH', unitNameVi: 'Viện Sau Đại học', title: 'Cán bộ – Giảng viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'qa.staff.qt@hcmute.edu.vn', displayName: 'Nhân viên QTTHTT', unitCode: 'QTTHTT', unitNameVi: 'Phòng Quản trị thương hiệu và Truyền thông', title: 'Cán bộ – Giảng viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);

        const wbSdh = getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', 'qa.leader.sdh@hcmute.edu.vn', 'Lãnh đạo đơn vị');
        const wbQt = getOrCreateWorkbook('QTTHTT', '01/10/2025–30/9/2026', 'tcns@hcmute.edu.vn', 'Quản trị viên');
        const tokenAdmin = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
        const tokenLeaderSdh = generateUserSessionToken({ email: 'qa.leader.sdh@hcmute.edu.vn', role: 'unit_leader', unitCode: 'SDH' });
        const tokenStaffSdh = generateUserSessionToken({ email: 'qa.staff.sdh@hcmute.edu.vn', role: 'staff', unitCode: 'SDH' });
        const tokenStaffQt = generateUserSessionToken({ email: 'qa.staff.qt@hcmute.edu.vn', role: 'staff', unitCode: 'QTTHTT' });
        const stdHt45 = findVtvlCatalogItem('HT45');
        const stdHt49 = findVtvlCatalogItem('HT49');

        // 1. Lãnh đạo SDH chọn thêm + sửa căn cứ + xoá VTVL chuẩn của đơn vị SDH
        const c1Added = [...wbSdh.data.C1, { id: 'c1-sdh-new', maVtvl: 'SDH.HT45', gioChuanPp2: 1904, quyetDinh: 'QĐ đơn vị' }];
        const putAddRes = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
          body: JSON.stringify({ baseRevision: wbSdh.currentRevision, data: { ...wbSdh.data, C1: c1Added } })
        }), { params: Promise.resolve({ id: wbSdh.id }) });
        assert.strictEqual(putAddRes.status, 200, 'Lãnh đạo SDH thêm VTVL chuẩn phải trả 200 OK');
        const revAfterAdd = (await putAddRes.json()).workbook.currentRevision;

        const c1Edited = c1Added.map((r) => r.maVtvl === 'SDH.HT45' ? { ...r, quyetDinh: 'QĐ cập nhật 2026' } : r);
        const putEditRes = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
          body: JSON.stringify({ baseRevision: revAfterAdd, data: { ...wbSdh.data, C1: c1Edited } })
        }), { params: Promise.resolve({ id: wbSdh.id }) });
        assert.strictEqual(putEditRes.status, 200, 'Lãnh đạo SDH sửa thông tin áp dụng VTVL phải trả 200 OK');
        const revAfterEdit = (await putEditRes.json()).workbook.currentRevision;

        const deletedCode = c1Edited[0].maVtvl;
        const c1AfterDelete = c1Edited.slice(1);
        const putDelRes = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
          body: JSON.stringify({ baseRevision: revAfterEdit, data: { ...wbSdh.data, C1: c1AfterDelete } })
        }), { params: Promise.resolve({ id: wbSdh.id }) });
        assert.strictEqual(putDelRes.status, 200, 'Lãnh đạo SDH xóa VTVL phải trả 200 OK');
        const revAfterDel = (await putDelRes.json()).workbook.currentRevision;

        resetWorkbookMemoryStore();
        const staffSdhTicketsRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=SDH', {
          headers: { authorization: 'Bearer ' + tokenStaffSdh }
        }));
        assert.strictEqual(staffSdhTicketsRes.status, 200);
        const staffSdhJson = await staffSdhTicketsRes.json();
        const foundEdited = (staffSdhJson.c1Vtvls || []).find((r) => r.maVtvl === 'SDH.HT45');
        const foundDeleted = (staffSdhJson.c1Vtvls || []).find((r) => r.maVtvl === deletedCode);
        assert.ok(foundEdited && foundEdited.tenVtvl === stdHt45.name, 'Nhân viên SDH phải thấy VTVL mới với tên chuẩn từ danh mục');
        assert.strictEqual(foundDeleted, undefined, 'Nhân viên SDH không còn thấy VTVL đã bị lãnh đạo xóa');

        const createTicketRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
          body: JSON.stringify({
            unitCode: 'SDH', ownerEmail: 'qa.staff.sdh@hcmute.edu.vn', action: 'draft',
            maNhiemVu: (staffSdhJson.a1Missions[0] && staffSdhJson.a1Missions[0].maNhiemVu) || 'SDH.NV01',
            tenCongViec: 'Công việc thử nghiệm chọn VTVL mới SDH.HT45',
            maVtvl: 'SDH.HT45'
          })
        }));
        assert.strictEqual(createTicketRes.status, 200, 'Nhân viên SDH tạo phiếu công việc chọn VTVL mới SDH.HT45 thành công');

        // 2. Lãnh đạo SDH bị chặn sửa C1 của đơn vị khác (QTTHTT)
        const crossLeaderRes = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbQt.id, {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
          body: JSON.stringify({ baseRevision: wbQt.currentRevision, data: { ...wbQt.data, C1: [] } })
        }), { params: Promise.resolve({ id: wbQt.id }) });
        assert.strictEqual(crossLeaderRes.status, 403, 'Lãnh đạo đơn vị SDH sửa C1 đơn vị QTTHTT phải bị chặn 403');

        // 3. Nhân viên SDH bị chặn sửa C1 của chính đơn vị mình
        const staffWriteRes = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tokenStaffSdh, 'content-type': 'application/json' },
          body: JSON.stringify({ baseRevision: revAfterDel, data: { ...wbSdh.data, C1: [] } })
        }), { params: Promise.resolve({ id: wbSdh.id }) });
        assert.strictEqual(staffWriteRes.status, 403, 'Nhân viên sửa Biểu C1 phải bị chặn 403');

        // 4. Admin thêm, sửa, xóa VTVL chuẩn ở nhiều đơn vị khác nhau (SDH & QTTHTT)
        const adminSdhAddRes = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbSdh.id, {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tokenAdmin, 'content-type': 'application/json' },
          body: JSON.stringify({ baseRevision: revAfterDel, data: { ...wbSdh.data, C1: [...c1AfterDelete, { id: 'c1-adm-sdh', maVtvl: 'SDH.HT47', gioChuanPp2: 1904 }] } })
        }), { params: Promise.resolve({ id: wbSdh.id }) });
        assert.strictEqual(adminSdhAddRes.status, 200, 'Admin phải thêm được VTVL chuẩn ở đơn vị SĐH');

        const adminQtAddRes = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbQt.id, {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tokenAdmin, 'content-type': 'application/json' },
          body: JSON.stringify({ baseRevision: wbQt.currentRevision, data: { ...wbQt.data, C1: [...wbQt.data.C1, { id: 'c1-adm-qt', maVtvl: 'QTTHTT.HT49', gioChuanPp2: 1904 }] } })
        }), { params: Promise.resolve({ id: wbQt.id }) });
        assert.strictEqual(adminQtAddRes.status, 200, 'Admin phải thêm/sửa được VTVL chuẩn ở đơn vị QTTHTT');
        const qtRev1 = (await adminQtAddRes.json()).workbook.currentRevision;

        const adminQtEditDelRes = await putWorkbook(new NextRequest('http://localhost:3360/api/workbooks/' + wbQt.id, {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tokenAdmin, 'content-type': 'application/json' },
          body: JSON.stringify({ baseRevision: qtRev1, data: { ...wbQt.data, C1: [{ id: 'c1-adm-qt', maVtvl: 'QTTHTT.HT49', gioChuanPp2: 1760 }] } })
        }), { params: Promise.resolve({ id: wbQt.id }) });
        assert.strictEqual(adminQtEditDelRes.status, 200, 'Admin phải sửa & xóa được VTVL ở đơn vị QTTHTT');

        resetWorkbookMemoryStore();
        const staffQtTicketsRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=QTTHTT', {
          headers: { authorization: 'Bearer ' + tokenStaffQt }
        }));
        const staffQtJson = await staffQtTicketsRes.json();
        assert.strictEqual((staffQtJson.c1Vtvls || []).length, 1, 'Nhân viên QTTHTT thấy đúng danh sách VTVL còn lại sau khi Admin sửa/xóa');
        assert.strictEqual(staffQtJson.c1Vtvls[0].tenVtvl, stdHt49.name);
      })().catch((e) => { console.error(e); process.exit(1); });
    `;
    execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'pipe'
    });
  } finally {
    for (const [name, content] of backups.entries()) {
      const p = path.join(dataDir, name);
      if (content === null) { if (fs.existsSync(p)) fs.unlinkSync(p); }
      else fs.writeFileSync(p, content, 'utf8');
    }
  }
});

runTest('Ca 16: Nút "Bảng tính toàn đơn vị" trỏ ?sheet=A2, nạp máy chủ không reset về A1, C1 mở khóa cho Admin & Lãnh đạo và logic thêm/sửa/xóa VTVL', () => {
  const tabBar = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketsTabBar.tsx'), 'utf8');
  assert.ok(tabBar.includes('href="/bang-tinh?sheet=A2"') && tabBar.includes('Bảng tính toàn đơn vị'), 'StaffPortalHeaderBanner phải dẫn tới /bang-tinh?sheet=A2 với nhãn Bảng tính toàn đơn vị');

  const bangTinhPage = fs.readFileSync(path.join(root, 'src/app/bang-tinh/page.tsx'), 'utf8');
  assert.ok(bangTinhPage.includes("searchParams.get('sheet')") && bangTinhPage.includes('initialSheet='), 'Trang /bang-tinh phải đọc query ?sheet= và truyền xuống ExcelWorkbookViewer');

  const viewer = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelWorkbookViewer.tsx'), 'utf8');
  assert.ok(viewer.includes("session?.role === 'admin'") && viewer.includes("session?.role === 'unit_leader'"), 'effectiveC1Unlocked phải mở trực tiếp cho cả admin và unit_leader');
  assert.ok(viewer.includes("setActiveSheet('A2')"), 'Staff vào /bang-tinh không có ?sheet= cũng mặc định chuyển sang Biểu A2');

  const gridState = fs.readFileSync(path.join(root, 'src/components/excel-grid/excel-grid-state.ts'), 'utf8');
  assert.ok(gridState.includes('resetSheet = false') && gridState.includes("if (resetSheet) setActiveSheet('A1')"), 'restoreWorkbookData mặc định không được reset activeSheet về A1 khi tải dữ liệu máy chủ');

  const accountClient = fs.readFileSync(path.join(root, 'src/services/auth/account-client.ts'), 'utf8');
  assert.ok(accountClient.includes("account.role === 'admin'") && accountClient.includes('effectiveUnitCode'), 'syncOperatorAccountWithServer phải giữ mã đơn vị làm việc của Admin không bị ghi đè ngược về TCNS');

  const tsxCode = `
    const assert = require('assert');
    const { syncC1VtvlChange, syncC1NameChange } = require('./src/components/excel-grid/excel-grid-a1-helpers');
    const { validateRowDeletion } = require('./src/components/excel-grid/excel-grid-delete-guards');
    const { handleSyncDeleteRow } = require('./src/components/excel-grid/excel-grid-code-helpers');
    const { buildDefaultGridWorkbook } = require('./src/components/excel-grid/excel-grid-defaults');

    const tcnsWb = buildDefaultGridWorkbook('TCNS');
    assert.strictEqual(tcnsWb.A1.length, 39, 'TCNS phải giữ nguyên 39 nhiệm vụ thực tế A1');
    assert.strictEqual(tcnsWb.C1.length, 6, 'TCNS phải giữ nguyên 6 VTVL thực tế C1');

    const emptySdh = buildDefaultGridWorkbook('SDH');
    assert.strictEqual(emptySdh.A1.length, 0, 'Đơn vị ngoài TCNS phải khởi tạo A1 rỗng');
    assert.strictEqual(emptySdh.C1.length, 0, 'Đơn vị ngoài TCNS phải khởi tạo C1 rỗng');

    const wb = {
      ...emptySdh,
      C1: [{ id: 'c1-seed-1', maVtvl: 'SDH.QL31', tenVtvl: 'Trưởng khoa', gioChuanPp2: 1904 }],
      D1: [{ id: 'd1-seed-1', maVtvl: 'SDH.QL31', hoTen: 'Cán bộ mẫu' }]
    };
    // 1. Nhập tên trước khi chọn mã -> tự động sinh SDH.VT01
    const withNewRow = { ...wb, C1: [...wb.C1, { id: 'c1-test-1', maVtvl: '', tenVtvl: '' }] };
    const afterName = syncC1NameChange(withNewRow, 'c1-test-1', 'Chuyên viên hỗ trợ AI', 'SDH');
    const newItem = afterName.C1.find((r) => r.id === 'c1-test-1');
    assert.strictEqual(newItem.maVtvl, 'SDH.VT01', 'Nhập tên VTVL mới trước phải tự sinh mã SDH.VT01');
    assert.ok(afterName.C2.some((c) => c.maVtvl === 'SDH.VT01'), 'Phải tự sinh dòng C2 tương ứng');

    // 2. Chọn lại mã Phụ lục I đã có -> tự thêm hậu tố -02 tránh trùng mã
    const firstPl1 = wb.C1[0].maVtvl;
    const dupRowWb = { ...afterName, C1: [...afterName.C1, { id: 'c1-test-2', maVtvl: '', tenVtvl: '' }] };
    const afterDupPick = syncC1VtvlChange(dupRowWb, 'c1-test-2', firstPl1, 'SDH');
    const dupItem = afterDupPick.C1.find((r) => r.id === 'c1-test-2');
    assert.strictEqual(dupItem.maVtvl, firstPl1 + '-02', 'Chọn lại mã PL1 đã tồn tại phải tự đánh hậu tố -02');

    // 3. Xóa VTVL không gắn phiếu thực tế -> được phép xóa kể cả có dữ liệu D1/DU_BAO/D2 mẫu, và dọn sạch C2/C3/D1/DU_BAO/D2
    const guardDefault = validateRowDeletion(afterDupPick, 'C1', 'c1-test-1');
    assert.strictEqual(guardDefault.canDelete, true, 'VTVL mới chưa gắn phiếu thực tế phải xóa được');
    const guardSampleSeed = validateRowDeletion(afterDupPick, 'C1', afterDupPick.C1[0].id);
    assert.strictEqual(guardSampleSeed.canDelete, true, 'VTVL chưa gắn phiếu thực tế phải xóa được');
    const cleaned = handleSyncDeleteRow(afterDupPick, 'C1', afterDupPick.C1[0].id);
    assert.strictEqual(cleaned.D1.some((d) => d.maVtvl === firstPl1), false, 'Dữ liệu D1 gắn VTVL đã xóa phải được dọn sạch');

    // 4. VTVL đang gắn phiếu công việc thực tế (sourceTicketId) -> bị chặn xóa để bảo toàn dữ liệu
    const wbWithRealTicket = { ...afterDupPick, A2: [...afterDupPick.A2, { id: 'a2-real-1', maCongViec: 'SDH.NV01.CV99', maNhiemVu: 'SDH.NV01', maVtvl: 'SDH.VT01', sourceTicketId: 't-123' }] };
    const guardReal = validateRowDeletion(wbWithRealTicket, 'C1', 'c1-test-1');
    assert.strictEqual(guardReal.canDelete, false, 'VTVL đang có phiếu công việc thực tế của cán bộ phải bị chặn xóa');
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

runTest('Ca 17: Thu hồi phê duyệt phiếu đã duyệt & đã gộp -> tự gỡ khỏi Biểu A2/B1, nhân viên sửa & nộp lại v2 và duyệt lại thành công', () => {
  const dataDir = path.join(root, '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupNames = ['server_workbooks.json', 'server_accounts.json', 'accounts.json', 'audit-logs.json', 'audit_logs.json', 'staff_tickets.json', 'work_survey_versions.json', 'work_survey_merge_links.json', 'work_survey_coordinated_vtvls.json'];
  const backups = new Map();
  for (const name of backupNames) {
    const p = path.join(dataDir, name);
    backups.set(name, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }
  try {
    const tsxCode = `
      const assert = require('assert');
      const { NextRequest } = require('next/server');
      const { POST: postTicket, PATCH: patchTicket, GET: getTickets } = require('./src/app/api/tickets/route');
      const { generateUserSessionToken } = require('./src/services/storage/server-auth-guard');
      const { upsertUserAccount } = require('./src/services/storage/server-account-store');
      const { getOrCreateWorkbook } = require('./src/services/storage/server-workbook-store');

      (async () => {
        await upsertUserAccount({ email: 'qa.leader.ck@hcmute.edu.vn', displayName: 'Trưởng khoa CK', unitCode: 'CK', unitNameVi: 'Khoa Cơ khí', title: 'Lãnh đạo đơn vị', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'qa.staff.ck@hcmute.edu.vn', displayName: 'Giảng viên CK 1', unitCode: 'CK', unitNameVi: 'Khoa Cơ khí', title: 'Cán bộ – Giảng viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'qa.staff2.ck@hcmute.edu.vn', displayName: 'Giảng viên CK 2', unitCode: 'CK', unitNameVi: 'Khoa Cơ khí', title: 'Cán bộ – Giảng viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);

        const tokenLeader = generateUserSessionToken({ email: 'qa.leader.ck@hcmute.edu.vn', role: 'unit_leader', unitCode: 'CK' });
        const tokenStaff1 = generateUserSessionToken({ email: 'qa.staff.ck@hcmute.edu.vn', role: 'staff', unitCode: 'CK' });
        const tokenStaff2 = generateUserSessionToken({ email: 'qa.staff2.ck@hcmute.edu.vn', role: 'staff', unitCode: 'CK' });

        // Tạo 2 phiếu cùng mã công việc để xác nhận gỡ phiếu 1 KHÔNG làm mất phiếu 2
        const submitTicket = async (email, token, jobName, qty) => {
          const r = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
            body: JSON.stringify({
              unitCode: 'CK', ownerEmail: email, action: 'submit',
              maNhiemVu: 'CK.NV01', maCongViec: 'CK.NV01.CV91', tenCongViec: jobName,
              maVtvl: 'CK.CM76', sanPham: 'Giáo trình & bài giảng', chatLuong: 'Đạt chuẩn kiểm định',
              canCu: 'QĐ phân công năm học', soSpNam: qty, nguonSoLieu: 'Phòng Đào tạo', phutThucTe: 60
            })
          }));
          assert.strictEqual(r.status, 200);
          return (await r.json()).ticket;
        };

        const t1 = await submitTicket('qa.staff.ck@hcmute.edu.vn', tokenStaff1, 'Soạn bài giảng nhầm số lượng', 50);
        const t2 = await submitTicket('qa.staff2.ck@hcmute.edu.vn', tokenStaff2, 'Hướng dẫn đồ án của GV2', 20);

        for (const t of [t1, t2]) {
          const ap = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
            method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeader, 'content-type': 'application/json' },
            body: JSON.stringify({ ticketId: t.id, action: 'approve', unitCode: 'CK' })
          }));
          assert.strictEqual(ap.status, 200);
          const mg = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
            method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeader, 'content-type': 'application/json' },
            body: JSON.stringify({ ticketId: t.id, action: 'merge', unitCode: 'CK' })
          }));
          assert.strictEqual(mg.status, 200);
        }

        let wb = getOrCreateWorkbook('CK');
        assert.ok(wb.data.A2.some((r) => r.sourceTicketId === t1.id), 'Trước thu hồi phải có dòng A2 của t1');
        assert.ok(wb.data.B1.some((r) => r.sourceTicketId === t1.id), 'Trước thu hồi phải có dòng B1 của t1');

        // Thu hồi phê duyệt phiếu t1
        const revokeRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeader, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t1.id, action: 'revoke_approval', unitCode: 'CK', reason: 'Sai số sản phẩm thực tế (50 -> 15)' })
        }));
        assert.strictEqual(revokeRes.status, 200, 'Thu hồi phê duyệt phải trả 200 OK');
        const revokeJson = await revokeRes.json();
        assert.strictEqual(revokeJson.ticket.status, 'Yêu cầu bổ sung', 'Trạng thái phải chuyển về Yêu cầu bổ sung');
        assert.strictEqual(revokeJson.ticket.isMergedToB1B2, false, 'Cờ đã gộp B1/B2 phải được reset về false');
        assert.strictEqual(revokeJson.ticket.approvedAt, undefined, 'Thời điểm duyệt cũ phải được xóa');

        wb = getOrCreateWorkbook('CK');
        assert.strictEqual(wb.data.A2.some((r) => r.sourceTicketId === t1.id), false, 'Dòng A2 của t1 phải được tự động gỡ bỏ');
        assert.strictEqual(wb.data.B1.some((r) => r.sourceTicketId === t1.id), false, 'Dòng B1 của t1 phải được tự động gỡ bỏ');
        assert.ok(wb.data.A2.some((r) => r.sourceTicketId === t2.id) && wb.data.B1.some((r) => r.sourceTicketId === t2.id), 'Dòng của GV2 cùng mã công việc vẫn phải được giữ nguyên');

        // Nhân viên 1 sửa và nộp lại v2 -> Lãnh đạo duyệt lại & gộp lại thành công
        const resub = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST', headers: { authorization: 'Bearer ' + tokenStaff1, 'content-type': 'application/json' },
          body: JSON.stringify({
            id: t1.id, unitCode: 'CK', ownerEmail: 'qa.staff.ck@hcmute.edu.vn', action: 'resubmit',
            changeSummary: 'Đã sửa số lượng SP từ 50 thành 15 theo số liệu Phòng Đào tạo',
            maNhiemVu: 'CK.NV01', maCongViec: 'CK.NV01.CV91', tenCongViec: 'Soạn bài giảng đã hiệu chỉnh',
            maVtvl: 'CK.CM76', sanPham: 'Giáo trình & bài giảng', chatLuong: 'Đạt chuẩn kiểm định',
            canCu: 'QĐ phân công năm học', soSpNam: 15, nguonSoLieu: 'Phòng Đào tạo', phutThucTe: 60
          })
        }));
        assert.strictEqual(resub.status, 200, 'Nhân viên sửa & nộp lại v2 thành công');
        const resubTicket = (await resub.json()).ticket;
        assert.strictEqual(resubTicket.currentVersionNo, 2, 'Phiên bản mới phải tăng lên v2');

        const reApprove = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeader, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t1.id, action: 'approve', unitCode: 'CK' })
        }));
        assert.strictEqual(reApprove.status, 200);
        const reMerge = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeader, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t1.id, action: 'merge', unitCode: 'CK' })
        }));
        assert.strictEqual(reMerge.status, 200);

        const detailRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?id=' + t1.id, {
          headers: { authorization: 'Bearer ' + tokenLeader }
        }));
        const detailJson = await detailRes.json();
        assert.ok((detailJson.ticket.statusHistory || []).some((h) => h.action === 'REVOKE_APPROVAL'), 'Lịch sử phải ghi nhận sự kiện REVOKE_APPROVAL');
      })().catch((e) => { console.error(e); process.exit(1); });
    `;
    execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'pipe'
    });
  } finally {
    for (const [name, content] of backups.entries()) {
      const p = path.join(dataDir, name);
      if (content === null) { if (fs.existsSync(p)) fs.unlinkSync(p); }
      else fs.writeFileSync(p, content, 'utf8');
    }
  }
});

runTest('Ca 18: Hủy / xóa phiếu đã duyệt & đã gộp -> tự gỡ B1/A2, ẩn khỏi danh sách/Dashboard & kiểm soát chặt RBAC', () => {
  const dataDir = path.join(root, '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupNames = ['server_workbooks.json', 'server_accounts.json', 'accounts.json', 'audit-logs.json', 'audit_logs.json', 'staff_tickets.json', 'work_survey_versions.json', 'work_survey_merge_links.json', 'work_survey_coordinated_vtvls.json'];
  const backups = new Map();
  for (const name of backupNames) {
    const p = path.join(dataDir, name);
    backups.set(name, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }
  try {
    const tsxCode = `
      const assert = require('assert');
      const { NextRequest } = require('next/server');
      const { POST: postTicket, PATCH: patchTicket, GET: getTickets } = require('./src/app/api/tickets/route');
      const { generateUserSessionToken } = require('./src/services/storage/server-auth-guard');
      const { upsertUserAccount } = require('./src/services/storage/server-account-store');
      const { getOrCreateWorkbook } = require('./src/services/storage/server-workbook-store');
      const { getTicketCounts } = require('./src/services/storage/server-ticket-merge');

      (async () => {
        await upsertUserAccount({ email: 'tcns@hcmute.edu.vn', displayName: 'Quản trị viên TCNS', unitCode: 'TCNS', unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Quản trị viên', role: 'admin', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'qa.leader.ck@hcmute.edu.vn', displayName: 'Trưởng khoa CK', unitCode: 'CK', unitNameVi: 'Khoa Cơ khí', title: 'Lãnh đạo đơn vị', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'qa.leader.sdh@hcmute.edu.vn', displayName: 'Lãnh đạo SĐH', unitCode: 'SDH', unitNameVi: 'Viện Sau Đại học', title: 'Lãnh đạo đơn vị', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'qa.staff.ck@hcmute.edu.vn', displayName: 'Giảng viên CK', unitCode: 'CK', unitNameVi: 'Khoa Cơ khí', title: 'Cán bộ – Giảng viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);

        const tokenAdmin = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
        const tokenLeaderCk = generateUserSessionToken({ email: 'qa.leader.ck@hcmute.edu.vn', role: 'unit_leader', unitCode: 'CK' });
        const tokenLeaderSdh = generateUserSessionToken({ email: 'qa.leader.sdh@hcmute.edu.vn', role: 'unit_leader', unitCode: 'SDH' });
        const tokenStaffCk = generateUserSessionToken({ email: 'qa.staff.ck@hcmute.edu.vn', role: 'staff', unitCode: 'CK' });

        const countsBase = getTicketCounts();

        const subRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST', headers: { authorization: 'Bearer ' + tokenStaffCk, 'content-type': 'application/json' },
          body: JSON.stringify({
            unitCode: 'CK', ownerEmail: 'qa.staff.ck@hcmute.edu.vn', action: 'submit',
            maNhiemVu: 'CK.NV01', maCongViec: 'CK.NV01.CV95', tenCongViec: 'Phiếu lập nhầm trùng lặp',
            maVtvl: 'CK.CM76', sanPham: 'SP', chatLuong: 'OK', canCu: 'QĐ', soSpNam: 10, nguonSoLieu: 'Khoa', phutThucTe: 30
          })
        }));
        const t = (await subRes.json()).ticket;
        await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeaderCk, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t.id, action: 'approve', unitCode: 'CK' })
        }));
        await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeaderCk, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t.id, action: 'merge', unitCode: 'CK' })
        }));

        // Kiểm tra chặn RBAC: Nhân viên không được thu hồi/hủy; Lãnh đạo khác đơn vị bị 403; thiếu lý do bị 400
        const rStaff = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenStaffCk, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t.id, action: 'cancel_ticket', reason: 'Xin xóa' })
        }));
        assert.strictEqual(rStaff.status, 403, 'Nhân viên không được hủy phiếu đã duyệt');

        const rCross = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeaderSdh, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t.id, action: 'revoke_approval', reason: 'Thu hồi chéo' })
        }));
        assert.strictEqual(rCross.status, 403, 'Lãnh đạo đơn vị khác không được thu hồi phiếu đơn vị CK');

        const rNoReason = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeaderCk, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t.id, action: 'revoke_approval', unitCode: 'CK', reason: '   ' })
        }));
        assert.strictEqual(rNoReason.status, 400, 'Thu hồi/hủy thiếu lý do phải báo lỗi 400');

        // Phiếu cá nhân của chính Lãnh đạo CK do Admin duyệt -> Lãnh đạo không được tự thu hồi, Admin thu hồi được
        const subLeaderOwn = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST', headers: { authorization: 'Bearer ' + tokenLeaderCk, 'content-type': 'application/json' },
          body: JSON.stringify({
            unitCode: 'CK', ownerEmail: 'qa.leader.ck@hcmute.edu.vn', action: 'submit',
            maNhiemVu: 'CK.NV01', maCongViec: 'CK.NV01.CV96', tenCongViec: 'Phiếu cá nhân của Lãnh đạo CK',
            maVtvl: 'CK.QL31', sanPham: 'SP', chatLuong: 'OK', canCu: 'QĐ', soSpNam: 5, nguonSoLieu: 'Khoa', phutThucTe: 30
          })
        }));
        const tLeaderOwn = (await subLeaderOwn.json()).ticket;
        await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenAdmin, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: tLeaderOwn.id, action: 'approve', unitCode: 'CK' })
        }));
        const rSelfRevoke = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeaderCk, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: tLeaderOwn.id, action: 'revoke_approval', unitCode: 'CK', reason: 'Tự thu hồi' })
        }));
        assert.strictEqual(rSelfRevoke.status, 403, 'Lãnh đạo không được tự thu hồi phiếu cá nhân của chính mình');
        const rAdminRevoke = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenAdmin, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: tLeaderOwn.id, action: 'revoke_approval', unitCode: 'CK', reason: 'Admin thu hồi giúp lãnh đạo sửa' })
        }));
        assert.strictEqual(rAdminRevoke.status, 200, 'Admin phải thu hồi được phiếu cá nhân của lãnh đạo đơn vị');

        // Lãnh đạo CK hủy phiếu t đã duyệt & đã gộp
        const cancelRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeaderCk, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t.id, action: 'cancel_ticket', unitCode: 'CK', reason: 'Nhân viên kê khai nhầm, hủy bỏ hoàn toàn' })
        }));
        assert.strictEqual(cancelRes.status, 200, 'Hủy phiếu đã duyệt phải trả 200 OK');
        const cancelJson = await cancelRes.json();
        assert.strictEqual(cancelJson.archived, true);

        const wbAfter = getOrCreateWorkbook('CK');
        assert.strictEqual(wbAfter.data.A2.some((r) => r.sourceTicketId === t.id), false, 'Dòng A2 của phiếu đã hủy phải bị gỡ');
        assert.strictEqual(wbAfter.data.B1.some((r) => r.sourceTicketId === t.id), false, 'Dòng B1 của phiếu đã hủy phải bị gỡ');

        const staffListRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?unitCode=CK', {
          headers: { authorization: 'Bearer ' + tokenStaffCk }
        }));
        const staffListJson = await staffListRes.json();
        assert.strictEqual(staffListJson.myTickets.some((x) => x.id === t.id), false, 'Phiếu đã hủy không còn xuất hiện ở Phiếu của tôi');
        assert.strictEqual(staffListJson.unitTickets.some((x) => x.id === t.id), false, 'Phiếu đã hủy không còn xuất hiện ở Danh sách đơn vị');

        const countsAfter = getTicketCounts();
        // tLeaderOwn chuyển về changes_requested (tính trong pending/total không tính approved), t đã bị archive
        assert.strictEqual(countsAfter.approved, countsBase.approved, 'Bộ đếm Đã duyệt không tính phiếu đã hủy và phiếu vừa thu hồi');
      })().catch((e) => { console.error(e); process.exit(1); });
    `;
    execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'pipe'
    });
  } finally {
    for (const [name, content] of backups.entries()) {
      const p = path.join(dataDir, name);
      if (content === null) { if (fs.existsSync(p)) fs.unlinkSync(p); }
      else fs.writeFileSync(p, content, 'utf8');
    }
  }
});

runTest('Ca 19: Kiểm tra kiến trúc Mobile-First (#11-#14): Phiếu mặc định <768px, Sticky Bar, Xác nhận xóa rõ bản ghi, Header gọn & Phân trang giữ cuộn', () => {
  const renderer = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelTableRenderer.tsx'), 'utf8');
  assert.ok(renderer.includes("useState<'table' | 'cards'>('cards')"), 'ExcelTableRenderer phải mặc định mở chế độ Phiếu (cards) dưới 768px');
  assert.ok(!renderer.includes("handleDeleteRow = (rowId: string) => {\n    if (selectedRowIds"), 'handleDeleteRow không được xóa ngay 1 dòng khi chưa mở hộp thoại xác nhận');
  assert.ok(renderer.includes('resolveDeleteTargetLabel(confirmDeleteId, rows, selectedRowIds)'), 'ExcelTableRenderer phải truyền nhãn bản ghi cụ thể cho hộp thoại xác nhận xóa');

  const delModal = fs.readFileSync(path.join(root, 'src/components/excel-grid/TableDeleteConfirmModal.tsx'), 'utf8');
  assert.ok(delModal.includes('role="alertdialog"') && delModal.includes('targetRecordLabel'), 'TableDeleteConfirmModal phải hiển thị hộp thoại xác nhận nêu rõ bản ghi cần xóa');

  const mobileHeader = fs.readFileSync(path.join(root, 'src/components/excel-grid/MobileWorkspaceHeader.tsx'), 'utf8');
  const sciCard = fs.readFileSync(path.join(root, 'src/components/excel-grid/ScientificWorkspaceCard.tsx'), 'utf8');
  assert.ok(mobileHeader.includes('statusMeta.label') && mobileHeader.includes('<span>Lưu</span>') && mobileHeader.includes('<span>Thêm</span>'), 'MobileWorkspaceHeader chỉ giữ trực tiếp Tên biểu, Trạng thái lưu, nút Lưu và menu Thêm');
  assert.ok(sciCard.includes('<MobileWorkspaceHeader'), 'ScientificWorkspaceCard phải render MobileWorkspaceHeader trên điện thoại');

  const stickyBar = fs.readFileSync(path.join(root, 'src/components/excel-grid/MobileStickyActionBar.tsx'), 'utf8');
  const viewer = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelWorkbookViewer.tsx'), 'utf8');
  assert.ok(stickyBar.includes('fixed bottom-0') && stickyBar.includes('Kiểm tra') && stickyBar.includes('Lưu'), 'MobileStickyActionBar phải bám đáy màn hình với nút Lưu & Kiểm tra');
  assert.ok(viewer.includes('<MobileStickyActionBar'), 'ExcelWorkbookViewer phải tích hợp MobileStickyActionBar');

  const unitMonitorTbl = fs.readFileSync(path.join(root, 'src/components/overview/UnitMonitoringTable.tsx'), 'utf8');
  const adminUnits = fs.readFileSync(path.join(root, 'src/components/admin/AdminUnitsTab.tsx'), 'utf8');
  const cardEditor = fs.readFileSync(path.join(root, 'src/components/excel-grid/ExcelRowCardEditor.tsx'), 'utf8');
  for (const [name, content] of [['UnitMonitoringTable', unitMonitorTbl], ['AdminUnitsTab', adminUnits], ['ExcelRowCardEditor', cardEditor]]) {
    assert.ok(content.includes('<ListPaginationBar') && content.includes('usePersistedListState'), `${name} phải dùng ListPaginationBar và usePersistedListState`);
  }

  const tsxCode = `
    const assert = require('assert');
    const { resolveDeleteTargetLabel } = require('./src/components/excel-grid/excel-grid-delete-guards');
    const rows = [
      { id: 'r1', maNhiemVu: 'CNTT.NV01', tenNhiemVu: 'Quản trị hệ thống thông tin' },
      { id: 'r2', maCongViec: 'CNTT.NV01.CV02', tenCongViec: 'Kiểm thử an toàn dữ liệu' }
    ];
    const single = resolveDeleteTargetLabel('r2', rows, new Set());
    assert.ok(single && single.includes('Dòng #2') && single.includes('CNTT.NV01.CV02') && single.includes('Kiểm thử an toàn dữ liệu'));
    const bulk = resolveDeleteTargetLabel('selected', rows, new Set(['r1', 'r2']));
    assert.ok(bulk && bulk.includes('CNTT.NV01') && bulk.includes('CNTT.NV01.CV02'));
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

runTest('Ca 20: Modal Yêu cầu bổ sung / Thu hồi / Hủy xóa sạch dữ liệu cũ mỗi lần mở phiếu khác (unmount + key + autoComplete=off)', () => {
  const unitPageSrc = fs.readFileSync(path.join(root, 'src/app/phieu-don-vi/page.tsx'), 'utf8');
  assert.ok(
    unitPageSrc.includes('{moderationModal && <StaffTicketRevisionModal key=') && unitPageSrc.includes('moderationModal.seq'),
    'Trang /phieu-don-vi phải unmount StaffTicketRevisionModal khi đóng và gắn key duy nhất theo seq mỗi lần mở'
  );

  const modalSrc = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketRevisionModal.tsx'), 'utf8');
  assert.ok(modalSrc.includes('handleClose') && modalSrc.includes('autoComplete="off"'), 'StaffTicketRevisionModal phải có handleClose xóa reason và autoComplete="off" chống lưu cache trình duyệt');
  assert.ok(modalSrc.includes('name={`moderation-reason-${ticket.id}-${mode}`}'), 'Textarea lý do phải gắn name riêng theo từng ticket.id để không bị autofill nhầm từ phiếu khác');
});

runTest('Ca 21: Bấm Duyệt phiếu tự động đưa vào Danh sách Biểu A2 & B1 + tự đồng bộ phiếu đã duyệt còn thiếu', () => {
  const dataDir = path.join(root, '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupNames = ['server_workbooks.json', 'server_accounts.json', 'accounts.json', 'audit-logs.json', 'audit_logs.json', 'staff_tickets.json', 'work_survey_versions.json', 'work_survey_merge_links.json', 'work_survey_coordinated_vtvls.json'];
  const backups = new Map();
  for (const name of backupNames) {
    const p = path.join(dataDir, name);
    backups.set(name, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }
  try {
    const tsxCode = `
      const assert = require('assert');
      const { NextRequest } = require('next/server');
      const { POST: postTicket, PATCH: patchTicket } = require('./src/app/api/tickets/route');
      const { GET: getWorkbook } = require('./src/app/api/workbooks/[id]/route');
      const { generateUserSessionToken } = require('./src/services/storage/server-auth-guard');
      const { upsertUserAccount } = require('./src/services/storage/server-account-store');
      const { getOrCreateWorkbook } = require('./src/services/storage/server-workbook-store');

      (async () => {
        await upsertUserAccount({ email: 'qa.leader.ck@hcmute.edu.vn', displayName: 'Trưởng khoa CK', unitCode: 'CK', unitNameVi: 'Khoa Cơ khí', title: 'Lãnh đạo đơn vị', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'qa.staff.ck@hcmute.edu.vn', displayName: 'Giảng viên CK', unitCode: 'CK', unitNameVi: 'Khoa Cơ khí', title: 'Cán bộ – Giảng viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);

        const tokenLeader = generateUserSessionToken({ email: 'qa.leader.ck@hcmute.edu.vn', role: 'unit_leader', unitCode: 'CK' });
        const tokenStaff = generateUserSessionToken({ email: 'qa.staff.ck@hcmute.edu.vn', role: 'staff', unitCode: 'CK' });

        // 1. Bấm Duyệt phiếu (approve) -> tự động vào luôn A2 & B1 không cần bước merge thứ 2
        const createRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST', headers: { authorization: 'Bearer ' + tokenStaff, 'content-type': 'application/json' },
          body: JSON.stringify({
            unitCode: 'CK', ownerEmail: 'qa.staff.ck@hcmute.edu.vn', action: 'submit',
            maNhiemVu: 'CK.NV01', maCongViec: 'CK.NV01.CV98', tenCongViec: 'Tự động vào A2 khi bấm duyệt',
            maVtvl: 'CK.CM76', sanPham: 'Hồ sơ nghiệm thu', chatLuong: 'Đạt chuẩn', canCu: 'QĐ 2266',
            soSpNam: 12, nguonSoLieu: 'Khoa Cơ khí', phutThucTe: 60
          })
        }));
        assert.strictEqual(createRes.status, 200);
        const t1 = (await createRes.json()).ticket;

        const apRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeader, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t1.id, action: 'approve', unitCode: 'CK' })
        }));
        assert.strictEqual(apRes.status, 200);
        const apTicket = (await apRes.json()).ticket;
        assert.strictEqual(apTicket.isMergedToB1B2, true, 'Duyệt phiếu phải tự đặt isMergedToB1B2 = true');
        assert.strictEqual(apTicket.a2RowId, 'a2-' + t1.id, 'Duyệt phiếu phải tự ghi a2RowId');
        assert.strictEqual(apTicket.b1RowId, 'b1-' + t1.id, 'Duyệt phiếu phải tự ghi b1RowId');

        const wb1 = getOrCreateWorkbook('CK');
        assert.ok(wb1.data.A2.some((r) => r.sourceTicketId === t1.id && r.tenCongViec === 'Tự động vào A2 khi bấm duyệt'), 'Biểu A2 phải có ngay dòng công việc của t1');
        assert.ok(wb1.data.B1.some((r) => r.sourceTicketId === t1.id && Number(r.gioTong) === 12), 'Biểu B1 phải có ngay dòng khối lượng của t1');

        // 2. Phiếu đã duyệt từ trước (autoMerge: false) tự được đồng bộ khi mở GET /api/workbooks/wb_CK_2026
        const createRes2 = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST', headers: { authorization: 'Bearer ' + tokenStaff, 'content-type': 'application/json' },
          body: JSON.stringify({
            unitCode: 'CK', ownerEmail: 'qa.staff.ck@hcmute.edu.vn', action: 'submit',
            maNhiemVu: 'CK.NV01', maCongViec: 'CK.NV01.CV99', tenCongViec: 'Phiếu đã duyệt cũ tự đồng bộ vào A2',
            maVtvl: 'CK.CM76', sanPham: 'Báo cáo', chatLuong: 'Đạt chuẩn', canCu: 'QĐ 2266',
            soSpNam: 6, nguonSoLieu: 'Khoa Cơ khí', phutThucTe: 60
          })
        }));
        const t2 = (await createRes2.json()).ticket;
        await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokenLeader, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: t2.id, action: 'approve', unitCode: 'CK', autoMerge: false })
        }));
        const wbGetRes = await getWorkbook(new NextRequest('http://localhost:3360/api/workbooks/wb_CK_2026', {
          headers: { authorization: 'Bearer ' + tokenLeader }
        }), { params: Promise.resolve({ id: 'wb_CK_2026' }) });
        assert.strictEqual(wbGetRes.status, 200);
        const wbGetJson = await wbGetRes.json();
        assert.ok((wbGetJson.workbook.data.A2 || []).some((r) => r.sourceTicketId === t2.id), 'GET /api/workbooks phải tự đối soát đưa phiếu Đã duyệt còn thiếu vào A2');
      })().catch((e) => { console.error(e); process.exit(1); });
    `;
    execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'pipe'
    });
  } finally {
    for (const [name, content] of backups.entries()) {
      const p = path.join(dataDir, name);
      if (content === null) { if (fs.existsSync(p)) fs.unlinkSync(p); }
      else fs.writeFileSync(p, content, 'utf8');
    }
  }
});

runTest('Ca 22: Hiển thị đầy đủ coordinatedVtvls & ghi chú phối hợp trên bản in A4, thẻ phiếu và Biểu A2', () => {
  const printModalCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketPrintModal.tsx'), 'utf8');
  assert.ok(printSheetCode.includes('formatTicketCoordinatedVtvlsText'), 'StaffTicketA4Preview phải dùng formatTicketCoordinatedVtvlsText');
  assert.ok(detailModalCode.includes('formatTicketCoordinatedVtvlsText'), 'StaffTicketDetailModal phải dùng formatTicketCoordinatedVtvlsText');
  assert.ok(printModalCode.includes('formatTicketCoordinatedVtvlsText'), 'StaffTicketPrintModal phải dùng formatTicketCoordinatedVtvlsText');
  assert.ok(myListCode.includes('getTicketCoordinatedVtvlBadges'), 'StaffMyTicketsList phải hiển thị badge từ getTicketCoordinatedVtvlBadges');
  assert.ok(reviewListCode.includes('getTicketCoordinatedVtvlBadges'), 'UnitTicketsReviewList phải hiển thị badge từ getTicketCoordinatedVtvlBadges');

  const tsxCode = `
    const assert = require('assert');
    const {
      formatTicketCoordinatedVtvlsText,
      getTicketCoordinatedVtvlBadges,
      formatCoordinatedVtvlCodesForA2
    } = require('./src/services/tickets/vtvl-coordination-helpers');

    const crossUnitTicket = {
      unitCode: 'TCNS',
      maVtvlPhoiHop: '',
      coordinatedVtvls: [
        {
          id: 'cvtvl-QTTHTT-QTTHTT.HT46',
          targetUnitCode: 'QTTHTT',
          targetUnitName: 'Phòng Quản trị thương hiệu và Truyền thông',
          maVtvl: 'QTTHTT.HT46',
          tenVtvl: 'Quản trị mạng, hệ thống phần mềm, hạ tầng số',
          note: 'phần mềm'
        }
      ]
    };

    const a4Text = formatTicketCoordinatedVtvlsText(crossUnitTicket);
    assert.ok(a4Text.includes('[QTTHTT - Phòng Quản trị thương hiệu và Truyền thông]'), 'Bản A4 phải hiển thị đơn vị phối hợp');
    assert.ok(a4Text.includes('QTTHTT.HT46 — Quản trị mạng, hệ thống phần mềm, hạ tầng số'), 'Bản A4 phải hiển thị mã & tên VTVL phối hợp');
    assert.ok(a4Text.includes('phần mềm'), 'Bản A4 phải hiển thị ghi chú riêng của VTVL phối hợp');

    const badges = getTicketCoordinatedVtvlBadges(crossUnitTicket);
    assert.strictEqual(badges.length, 1);
    assert.ok(badges[0].label.includes('[QTTHTT] QTTHTT.HT46'));
    assert.strictEqual(badges[0].note, 'phần mềm');

    assert.strictEqual(formatCoordinatedVtvlCodesForA2(crossUnitTicket), 'QTTHTT.HT46');
    assert.strictEqual(formatTicketCoordinatedVtvlsText({ unitCode: 'TCNS', maVtvlPhoiHop: '', coordinatedVtvls: [] }), 'Không có');
  `;
  execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
});

runTest('Ca 23: Hiển thị đề xuất phối hợp theo Đơn vị, highlight khi chọn mã VTVL & tab Mối quan hệ công việc', () => {
  const dataDir = path.join(root, '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupNames = ['server_workbooks.json', 'server_accounts.json', 'accounts.json', 'audit-logs.json', 'audit_logs.json', 'staff_tickets.json', 'work_survey_versions.json', 'work_survey_merge_links.json', 'user_vtvl_assignments.json', 'work_survey_coordinated_vtvls.json', 'work_relationships.json'];
  const backups = new Map();
  for (const name of backupNames) {
    const p = path.join(dataDir, name);
    backups.set(name, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }
  try {
    const sideCardSrc = fs.readFileSync(path.join(root, 'src/components/staff-portal/ProposedCoordinatedSideCard.tsx'), 'utf8');
    const relTabSrc = fs.readFileSync(path.join(root, 'src/components/staff-portal/WorkRelationshipsTab.tsx'), 'utf8');
    const migSql = fs.readFileSync(path.join(root, 'trash/supabase/migrations/20261116210000_create_work_relationships.sql'), 'utf8');
    assert.ok(sideCardSrc.includes('Đang chọn VTVL:') && sideCardSrc.includes('Đã được kê khai'), 'ProposedCoordinatedSideCard phải highlight & hiện nhãn theo VTVL đang chọn');
    assert.ok(relTabSrc.includes('Mối quan hệ công việc phối hợp') && relTabSrc.includes('Đã được lãnh đạo 2 đơn vị duyệt'), 'WorkRelationshipsTab phải có nhãn phê duyệt 2 phía & TCNS');
    assert.ok(migSql.includes('CREATE TABLE IF NOT EXISTS public.work_relationships'), 'Migration phải tạo bảng work_relationships');

    const tsxCode = `
      const assert = require('assert');
      const { NextRequest } = require('next/server');
      const { POST: postTicket, PATCH: patchTicket } = require('./src/app/api/tickets/route');
      const { GET: getCoord, PATCH: patchCoord } = require('./src/app/api/tickets/coordinated/route');
      const { generateUserSessionToken } = require('./src/services/storage/server-auth-guard');
      const { upsertUserAccount } = require('./src/services/storage/server-account-store');

      (async () => {
        await upsertUserAccount({ email: 'tcns@hcmute.edu.vn', displayName: 'Phòng TCNS', unitCode: 'TCNS', unitNameVi: 'Phòng Tổ chức – Nhân sự', title: 'Quản trị viên', role: 'admin', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'staff.tcns.23@hcmute.edu.vn', displayName: 'Chuyên viên TCNS', unitCode: 'TCNS', unitNameVi: 'Phòng Tổ chức – Nhân sự', title: 'Chuyên viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'staff.qtthtt.23@hcmute.edu.vn', displayName: 'Nhân sự QTTHTT', unitCode: 'QTTHTT', unitNameVi: 'Phòng Quản trị thương hiệu và Truyền thông', title: 'Chuyên viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: 'leader.qtthtt.23@hcmute.edu.vn', displayName: 'Trưởng phòng QTTHTT', unitCode: 'QTTHTT', unitNameVi: 'Phòng Quản trị thương hiệu và Truyền thông', title: 'Lãnh đạo đơn vị', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);

        const tokTcnsStaff = generateUserSessionToken({ email: 'staff.tcns.23@hcmute.edu.vn', role: 'staff', unitCode: 'TCNS' });
        const tokAdmin = generateUserSessionToken({ email: 'tcns@hcmute.edu.vn', role: 'admin', unitCode: 'TCNS' });
        const tokQtStaff = generateUserSessionToken({ email: 'staff.qtthtt.23@hcmute.edu.vn', role: 'staff', unitCode: 'QTTHTT' });
        const tokQtLeader = generateUserSessionToken({ email: 'leader.qtthtt.23@hcmute.edu.vn', role: 'unit_leader', unitCode: 'QTTHTT' });

        // 1. TCNS nộp phiếu đề xuất phối hợp với QTTHTT.HT46 (chưa gán cứng user_vtvl_assignments cho QTTHTT)
        const r1 = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST', headers: { authorization: 'Bearer ' + tokTcnsStaff, 'content-type': 'application/json' },
          body: JSON.stringify({
            unitCode: 'TCNS', ownerEmail: 'staff.tcns.23@hcmute.edu.vn', action: 'submit',
            maNhiemVu: 'TCNS.NV01', maCongViec: 'TCNS.NV01.CV88', tenCongViec: 'Phối hợp quản trị hạ tầng số',
            maVtvl: 'TCNS.QL33', coordinatedVtvls: [{ id: 'cvtvl-QTTHTT-QTTHTT.HT46', targetUnitCode: 'QTTHTT', maVtvl: 'QTTHTT.HT46', note: 'phần mềm' }],
            sanPham: 'Hệ thống vận hành', chatLuong: 'Đạt', canCu: 'QĐ 2266', soSpNam: 4, nguonSoLieu: 'TCNS', phutThucTe: 60
          })
        }));
        assert.strictEqual(r1.status, 200);
        const srcTicket = (await r1.json()).ticket;

        // 2. Tài khoản QTTHTT chưa được gán cứng vẫn nhận đề xuất về đơn vị QTTHTT
        const q1 = await (await getCoord(new NextRequest('http://localhost:3360/api/tickets/coordinated?scope=unit', {
          headers: { authorization: 'Bearer ' + tokQtStaff }
        }))).json();
        const foundProposal = q1.items.find((i) => i.surveyId === srcTicket.id);
        assert.ok(foundProposal, 'Tài khoản QTTHTT không gắn cứng vẫn phải thấy đề xuất QTTHTT.HT46');
        assert.strictEqual(foundProposal.isDeclaredByTargetUnit, false);
        assert.strictEqual(q1.relationships.some((r) => r.sourceSurveyId === srcTicket.id), false, 'Chưa bên nào duyệt -> chưa vào tab Mối quan hệ công việc');

        // 3. Lãnh đạo TCNS (Admin) duyệt phiếu nguồn -> xuất hiện trong Mối quan hệ công việc với nhãn Mới 1 bên lãnh đạo duyệt + Phòng TCNS
        await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: srcTicket.id, action: 'approve', unitCode: 'TCNS' })
        }));
        const q2 = await (await getCoord(new NextRequest('http://localhost:3360/api/tickets/coordinated?scope=unit', {
          headers: { authorization: 'Bearer ' + tokQtStaff }
        }))).json();
        const rel1 = q2.relationships.find((r) => r.sourceSurveyId === srcTicket.id);
        assert.ok(rel1, 'Sau khi 1 bên duyệt phải hiện trong Mối quan hệ công việc');
        assert.strictEqual(rel1.hostLeaderApproved, true);
        assert.strictEqual(rel1.targetLeaderApproved, false);

        // 4. Nhân sự QTTHTT kê khai phiếu với mã QTTHTT.HT46 -> isDeclaredByTargetUnit = true; Lãnh đạo QTTHTT duyệt -> cả 2 đơn vị duyệt
        const r2 = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST', headers: { authorization: 'Bearer ' + tokQtStaff, 'content-type': 'application/json' },
          body: JSON.stringify({
            unitCode: 'QTTHTT', ownerEmail: 'staff.qtthtt.23@hcmute.edu.vn', action: 'submit',
            maNhiemVu: 'QTTHTT.NV01', maCongViec: 'QTTHTT.NV01.CV88', tenCongViec: 'Phối hợp quản trị hạ tầng số phía QTTHTT',
            maVtvl: 'QTTHTT.HT46', sanPham: 'Nhật ký vận hành', chatLuong: 'Đạt', canCu: 'QĐ 2266', soSpNam: 4, nguonSoLieu: 'QTTHTT', phutThucTe: 45
          })
        }));
        const tgtTicket = (await r2.json()).ticket;
        await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokQtLeader, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId: tgtTicket.id, action: 'approve', unitCode: 'QTTHTT' })
        }));
        const p3 = await patchCoord(new NextRequest('http://localhost:3360/api/tickets/coordinated', {
          method: 'PATCH', headers: { authorization: 'Bearer ' + tokAdmin, 'content-type': 'application/json' },
          body: JSON.stringify({ relationshipId: rel1.id, side: 'tcns', approved: true })
        }));
        assert.strictEqual(p3.status, 200);
        const relFinal = (await p3.json()).relationship;
        assert.strictEqual(relFinal.isDeclaredByTargetUnit, true);
        assert.strictEqual(relFinal.hostLeaderApproved, true);
        assert.strictEqual(relFinal.targetLeaderApproved, true);
        assert.strictEqual(relFinal.tcnsApproved, true);
        assert.ok(relFinal.approvalLabel.includes('Đã được lãnh đạo 2 đơn vị'));
      })().catch((e) => { console.error(e); process.exit(1); });
    `;
    execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'pipe'
    });
  } finally {
    for (const [name, content] of backups.entries()) {
      const p = path.join(dataDir, name);
      if (content === null) { if (fs.existsSync(p)) fs.unlinkSync(p); }
      else fs.writeFileSync(p, content, 'utf8');
    }
  }
});

runTest('Ca 24: Chuẩn hóa luồng lưu dữ liệu UI/CTA -> API -> Supabase (Unit Store, Workbook Relational Sync, Revision Restore, Auth Headers & Migration)', () => {
  const dataDir = path.join(root, '.data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupNames = [
    'server_workbooks.json', 'deleted_workbooks.json', 'server_accounts.json', 'accounts.json',
    'audit-logs.json', 'audit_logs.json', 'staff_tickets.json', 'work_survey_versions.json',
    'work_survey_merge_links.json', 'user_vtvl_assignments.json', 'work_survey_coordinated_vtvls.json',
    'work_relationships.json', 'custom_units.json'
  ];
  const backups = new Map();
  for (const name of backupNames) {
    const p = path.join(dataDir, name);
    backups.set(name, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }
  try {
    const migSql = fs.readFileSync(path.join(root, 'trash/supabase/migrations/20261116210000_create_work_relationships.sql'), 'utf8');
    const rollbackSql = fs.readFileSync(path.join(root, 'trash/supabase/rollbacks/20261116210000_rollback_work_relationships.sql'), 'utf8');
    const relSyncSrc = fs.readFileSync(path.join(root, 'src/services/storage/server-workbook-relational-sync.ts'), 'utf8');
    const vtvlSyncSrc = fs.readFileSync(path.join(root, 'src/services/storage/vtvl-sync.ts'), 'utf8');
    const coordModalSrc = fs.readFileSync(path.join(root, 'src/components/staff-portal/CoordinatedTaskModal.tsx'), 'utf8');
    const adminSessionsSrc = fs.readFileSync(path.join(root, 'src/components/admin/AdminSessionsTab.tsx'), 'utf8');
    const revRouteSrc = fs.readFileSync(path.join(root, 'src/app/api/workbooks/[id]/revisions/route.ts'), 'utf8');

    for (const fkName of [
      'fk_work_rel_source_survey', 'fk_work_rel_target_survey', 'fk_work_rel_host_unit',
      'fk_work_rel_target_unit', 'fk_tickets_approved_by', 'fk_tickets_revision_requested_by', 'fk_tickets_merged_by'
    ]) {
      assert.ok(migSql.includes(fkName), `Migration thiếu khóa ngoại ${fkName}`);
      assert.ok(migSql.includes(`VALIDATE CONSTRAINT ${fkName}`), `Migration phải VALIDATE CONSTRAINT ${fkName}`);
    }
    assert.ok(migSql.includes('migration_20261116210000_data_backup'), 'Migration phải tạo bảng sao lưu migration_20261116210000_data_backup trước khi sửa email/mồ côi');
    assert.ok(migSql.includes('BACKUP_ACTOR_EMAILS') && migSql.includes('QUARANTINE_ORPHAN_WORK_REL'), 'Migration phải sao lưu email gốc và bản ghi mồ côi trước khi cập nhật');
    assert.ok(migSql.includes('SNAPSHOT_RLS_FLAGS') && migSql.includes('SNAPSHOT_RLS_POLICY'), 'Migration phải chụp trạng thái RLS và policy trước khi thay đổi');
    assert.ok(migSql.includes('c.convalidated') && migSql.includes('pg_get_constraintdef(c.oid)'), 'Postflight phải kiểm tra convalidated = TRUE và định nghĩa pg_get_constraintdef của cả 7 FK');
    assert.ok(migSql.includes('CREATE OR REPLACE FUNCTION public.rpc_sync_workbook_atomic'), 'Migration phải định nghĩa RPC giao dịch nguyên tử rpc_sync_workbook_atomic');
    assert.ok(migSql.includes("du_lieu_ho_so_json -> 'workRelationships'") && migSql.includes('ON CONFLICT (id) DO UPDATE'), 'Migration phải backfill work_relationships từ JSONB idempotent');

    const rollbackExecutableSql = rollbackSql.replace(/--.*$/gm, '');
    assert.ok(!/DROP\s+TABLE/i.test(rollbackExecutableSql), 'Rollback SQL tuyệt đối không được dùng DROP TABLE');
    assert.ok(rollbackSql.includes('BACKUP_ACTOR_EMAILS') && rollbackSql.includes('QUARANTINE_ORPHAN_WORK_REL'), 'Rollback SQL phải khôi phục dữ liệu gốc từ bảng backup');
    assert.ok(rollbackSql.includes('SNAPSHOT_RLS_POLICY') && rollbackSql.includes('SNAPSHOT_RLS_FLAGS'), 'Rollback SQL phải khôi phục đúng policy và cờ RLS trước migration');

    for (const table of ['a1_nhiem_vu', 'a2_cong_viec', 'b1_khoi_luong', 'b2_ct_tac_dong', 'b2_thay_doi', 'c1_vtvl', 'c2_nang_luc', 'c3_nhu_cau', 'd1_nhan_luc', 'du_bao_5_nam', 'd2_phuong_an', 'k_kiem_tra', 'can_cu_goi_y', 'workbooks', 'workbook_sessions', 'session_participants', 'workbook_revisions']) {
      assert.ok(relSyncSrc.includes(table), `Relational sync phải hỗ trợ đồng bộ bảng ${table}`);
    }
    assert.ok(relSyncSrc.includes('rpc_sync_workbook_atomic'), 'Relational sync phải gọi RPC nguyên tử rpc_sync_workbook_atomic');
    assert.ok(vtvlSyncSrc.includes('Authorization') && vtvlSyncSrc.includes('Bearer') && !vtvlSyncSrc.includes('x-actor-email'), 'vtvl-sync.ts chỉ gửi Bearer token, không dùng x-actor-email');
    assert.ok(coordModalSrc.includes('Authorization') && coordModalSrc.includes('Bearer') && !coordModalSrc.includes('x-actor-email'), 'CoordinatedTaskModal.tsx chỉ gửi Bearer token, không dùng x-actor-email');
    assert.ok(adminSessionsSrc.includes('Authorization') && adminSessionsSrc.includes('Bearer') && !adminSessionsSrc.includes('x-actor-email'), 'AdminSessionsTab.tsx chỉ gửi Bearer token, không dùng x-actor-email');
    assert.ok(revRouteSrc.includes('rollbackServerWorkbookRevisionAndPersist'), 'Route revisions phải gọi rollbackServerWorkbookRevisionAndPersist');

    const tsxCode = `
      const assert = require('assert');
      const { NextRequest } = require('next/server');
      const { POST: postTicket } = require('./src/app/api/tickets/route');
      const { POST: postAuditLog } = require('./src/app/api/audit-logs/route');
      const { POST: postSyncSplit } = require('./src/app/api/sync/split/route');
      const { generateUserSessionToken } = require('./src/services/storage/server-auth-guard');
      const { upsertUserAccount } = require('./src/services/storage/server-account-store');
      const { upsertServerUnit, deleteServerUnit, resetServerUnits, resetUnitMemoryStore, getServerUnits } = require('./src/services/storage/server-unit-store');
      const { findHcmuteUnit, getActiveHcmuteUnits } = require('./src/configs/hcmute-units');
      const { saveServerWorkbook, saveServerWorkbookAndPersist, rollbackServerWorkbookRevisionAndPersist, getWorkbookById } = require('./src/services/storage/server-workbook-store');
      const { buildWorkbookRelationalPayload } = require('./src/services/storage/server-workbook-relational-sync');

      (async () => {
        // 1. Tạo đơn vị mới LAB_QA -> tạo tài khoản -> tạo phiếu thành công -> ngừng hoạt động đơn vị
        await upsertServerUnit({
          code: 'LAB_QA',
          nameVi: 'Trung tâm Đảm bảo chất lượng Thử nghiệm',
          nameEn: 'QA Testing Center',
          group: 'trung-tam',
          domain: 'qa.hcmute.edu.vn',
          headTitleVi: 'Giám đốc',
          headTitleEn: 'Director',
          defaultStaffCount: 5
        });
        assert.strictEqual(getActiveHcmuteUnits().some((u) => u.code === 'LAB_QA'), true, 'getActiveHcmuteUnits phải nhận đơn vị mới LAB_QA');
        assert.strictEqual(findHcmuteUnit('LAB_QA').code, 'LAB_QA', 'findHcmuteUnit phải trả về đúng mã LAB_QA');

        await upsertUserAccount({
          email: 'staff.labqa@hcmute.edu.vn',
          displayName: 'Chuyên viên LAB_QA',
          unitCode: 'LAB_QA',
          unitNameVi: 'Trung tâm Đảm bảo chất lượng Thử nghiệm',
          title: 'Chuyên viên',
          role: 'staff',
          authProvider: 'email',
          status: 'active',
          hasSelectedUnit: true
        }, true);
        const tokLabQa = generateUserSessionToken({ email: 'staff.labqa@hcmute.edu.vn', role: 'staff', unitCode: 'LAB_QA' });
        const tRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tokLabQa, 'content-type': 'application/json' },
          body: JSON.stringify({
            unitCode: 'LAB_QA',
            ownerEmail: 'staff.labqa@hcmute.edu.vn',
            action: 'submit',
            maNhiemVu: 'LAB_QA.NV01',
            maCongViec: 'LAB_QA.NV01.CV01',
            tenCongViec: 'Kiểm thử luồng tạo phiếu đơn vị mới',
            maVtvl: 'LAB_QA.CV01',
            sanPham: 'Báo cáo thử nghiệm',
            chatLuong: 'Đạt',
            canCu: 'QĐ 2266',
            soSpNam: 6,
            nguonSoLieu: 'LAB_QA',
            phutThucTe: 45
          })
        }));
        assert.strictEqual(tRes.status, 200, 'Tạo phiếu cho đơn vị mới LAB_QA phải thành công');
        const tBody = await tRes.json();
        assert.strictEqual(tBody.ticket.unitCode, 'LAB_QA');

        // 2. Xác minh x-actor-email không được tin cậy; actor luôn lấy từ phiên xác thực trên server
        const unauthAudit = await postAuditLog(new NextRequest('http://localhost:3360/api/audit-logs', {
          method: 'POST',
          headers: { 'x-actor-email': 'tcns@hcmute.edu.vn', 'content-type': 'application/json' },
          body: JSON.stringify({ unitCode: 'TCNS', action: 'TEST', details: 'Giả mạo không token' })
        }));
        assert.strictEqual(unauthAudit.status, 401, 'Gửi x-actor-email không có token phải bị từ chối 401');

        const spoofHeaderAudit = await postAuditLog(new NextRequest('http://localhost:3360/api/audit-logs', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tokLabQa, 'x-actor-email': 'tcns@hcmute.edu.vn', 'content-type': 'application/json' },
          body: JSON.stringify({ unitCode: 'LAB_QA', action: 'TEST', details: 'Giả mạo header x-actor-email' })
        }));
        assert.strictEqual(spoofHeaderAudit.status, 403, 'Gửi header x-actor-email khác phiên xác thực phải bị chặn 403');
        assert.strictEqual((await spoofHeaderAudit.json()).code, 'FORBIDDEN_ACTOR_SPOOFING');

        const spoofBodySplit = await postSyncSplit(new NextRequest('http://localhost:3360/api/sync/split', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tokLabQa, 'content-type': 'application/json' },
          body: JSON.stringify({ summary: { unitCode: 'LAB_QA', actorEmail: 'tcns@hcmute.edu.vn' } })
        }));
        assert.strictEqual(spoofBodySplit.status, 403, 'Giả mạo actorEmail trong /api/sync/split phải bị chặn 403');

        const validAudit = await postAuditLog(new NextRequest('http://localhost:3360/api/audit-logs', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tokLabQa, 'content-type': 'application/json' },
          body: JSON.stringify({ unitCode: 'LAB_QA', action: 'BAM_GIO', details: 'Lưu phiên hợp lệ' })
        }));
        assert.strictEqual(validAudit.status, 201);
        assert.strictEqual((await validAudit.json()).log.actorEmail, 'staff.labqa@hcmute.edu.vn', 'Actor phải lấy từ phiên server đã xác thực');

        // 3. Lưu bảng tính, kiểm tra payload can_cu_goi_y/sessions/participants, lỗi giữa giao dịch (rollback) & khôi phục phiên bản
        const s1 = saveServerWorkbook({
          workbookId: 'wb_LAB_QA_24',
          unitCode: 'LAB_QA',
          baseRevision: 0,
          actorEmail: 'staff.labqa@hcmute.edu.vn',
          actorTitle: 'Chuyên viên',
          touchedCells: ['B1:b1-1:soSpNam'],
          data: {
            A1: [{ id: 'a1-rev1', maNhiemVu: 'LAB_QA.NV01', tenNhiemVu: 'Nhiệm vụ bản 1' }],
            C1: [{ id: 'c1-rev1', maVtvl: 'LAB_QA.CV01', tenVtvl: 'Chuyên viên thử nghiệm' }],
            A2: [{ id: 'a2-rev1', maCongViec: 'LAB_QA.NV01.CV01', maNhiemVu: 'LAB_QA.NV01', maVtvl: 'LAB_QA.CV01', tenCongViec: 'Công việc 1', sanPham: 'Báo cáo' }],
            B1: [{ id: 'b1-1', maCongViec: 'LAB_QA.NV01.CV01', maVtvl: 'LAB_QA.CV01', soSpNam: 10, phutThucTe: 60 }]
          }
        });
        assert.strictEqual(s1.success, true);
        const wbId = s1.serverWorkbook.id;
        const rev1 = s1.currentRevision;

        const relPayload = buildWorkbookRelationalPayload(s1.serverWorkbook);
        assert.strictEqual(relPayload.can_cu_goi_y.length, 1, 'Phải ánh xạ can_cu_goi_y từ A2 + B1');
        assert.strictEqual(relPayload.can_cu_goi_y[0].da_sua_thuc_te, true, 'Phải ghi nhận da_sua_thuc_te từ touchedCells');
        assert.ok(relPayload.workbook_sessions.length >= 1 && relPayload.session_participants.length >= 1, 'Phải ánh xạ workbook_sessions và session_participants');

        // Kiểm thử lỗi giữa giao dịch (simulateTxError = true) -> phải rollback toàn bộ, không lưu dở dang
        let txFailed = false;
        try {
          await saveServerWorkbookAndPersist({
            workbookId: wbId,
            unitCode: 'LAB_QA',
            baseRevision: rev1,
            actorEmail: 'staff.labqa@hcmute.edu.vn',
            data: { A1: [{ id: 'a1-corrupt', maNhiemVu: 'LAB_QA.NV01', tenNhiemVu: 'Dữ liệu lỗi giữa giao dịch' }] },
            simulateTxError: true
          });
        } catch (err) {
          txFailed = String(err.message || err).includes('TX_ABORTED_MIDWAY');
        }
        assert.strictEqual(txFailed, true, 'Lỗi giữa giao dịch phải ném ngoại lệ TX_ABORTED_MIDWAY');
        const wbAfterAbort = getWorkbookById(wbId);
        assert.strictEqual(wbAfterAbort.currentRevision, rev1, 'Sau lỗi giữa giao dịch, currentRevision phải được rollback về rev1');
        assert.strictEqual(wbAfterAbort.data.A1[0].tenNhiemVu, 'Nhiệm vụ bản 1', 'Dữ liệu không được lưu dở dang khi giao dịch thất bại');

        const s2 = saveServerWorkbook({
          workbookId: wbId,
          unitCode: 'LAB_QA',
          baseRevision: rev1,
          actorEmail: 'staff.labqa@hcmute.edu.vn',
          data: { A1: [{ id: 'a1-rev2', maNhiemVu: 'LAB_QA.NV01', tenNhiemVu: 'Nhiệm vụ bản 2 bị sai' }] }
        });
        assert.strictEqual(s2.success, true);

        const rb = await rollbackServerWorkbookRevisionAndPersist(wbId, rev1, 'admin.audit@hcmute.edu.vn', 'Khôi phục dữ liệu đúng chuẩn');
        assert.strictEqual(rb.success, true, 'Khôi phục phiên bản bảng tính phải thành công');
        assert.strictEqual(rb.serverWorkbook.data.A1[0].tenNhiemVu, 'Nhiệm vụ bản 1', 'Dữ liệu sau khôi phục phải khớp phiên bản đích');
        assert.strictEqual(rb.serverWorkbook.revisions[0].actorEmail, 'admin.audit@hcmute.edu.vn', 'Lịch sử khôi phục phải ghi đúng tác nhân');
        assert.ok(rb.serverWorkbook.revisions[0].changeSummary.includes('Khôi phục dữ liệu đúng chuẩn'), 'Lịch sử khôi phục phải ghi đúng lý do');

        // 4. Ngừng hoạt động đơn vị mới LAB_QA VÀ ngừng hoạt động đơn vị chuẩn TYT -> đảm bảo TYT không bị cấu hình 39 đơn vị tự thêm lại
        await deleteServerUnit('LAB_QA');
        assert.strictEqual(getServerUnits().some((u) => u.code === 'LAB_QA'), false);
        assert.strictEqual(getActiveHcmuteUnits().some((u) => u.code === 'LAB_QA'), false);

        await deleteServerUnit('TYT');
        resetUnitMemoryStore(); // Xóa RAM cache để buộc đọc lại từ đĩa
        assert.strictEqual(getServerUnits().some((u) => u.code === 'TYT'), false, 'Đơn vị chuẩn TYT sau khi ngừng hoạt động không được còn trong getServerUnits()');
        assert.strictEqual(getActiveHcmuteUnits().some((u) => u.code === 'TYT'), false, 'Đơn vị chuẩn TYT sau khi ngừng hoạt động không được bị cấu hình 39 đơn vị tự thêm lại');
        assert.strictEqual(getActiveHcmuteUnits().length, 38, 'Số đơn vị hoạt động sau khi ngừng TYT phải đúng 38');

        // Khôi phục lại danh mục 39 đơn vị chuẩn
        await resetServerUnits();
        assert.strictEqual(getActiveHcmuteUnits().length, 39, 'Sau resetServerUnits phải khôi phục đủ 39 đơn vị chuẩn');

        // 5. Kiểm thử RPC nguyên tử trên DB mock (Prisma/PostgreSQL hook), backfill workRelationships từ JSONB & chống tự thêm lại TYT khi is_active=false trên dm_don_vi
        const origIso = process.env.VTVL_ISOLATED_LOCAL_STORE;
        const { setDbTestHook } = require('./src/services/storage/prisma');
        try {
          process.env.VTVL_ISOLATED_LOCAL_STORE = 'false';

          const rpcCalls = [];
          const mockWorkRelDb = new Map();
          let simulateDbRpcAbort = false;

          setDbTestHook({
            rpc: async (fnName, params) => {
              if (fnName === 'rpc_sync_workbook_atomic') {
                rpcCalls.push(params);
                if (params.p_simulate_error || simulateDbRpcAbort) {
                  return { ok: false, status: 500, errorText: 'TX_ABORTED_MIDWAY' };
                }
                return { ok: true, status: 200, row: { success: true, atomic_tx: true } };
              }
              return { ok: true, status: 200, row: {} };
            },
            select: async (table) => {
              if (table === 't_tien_do') {
                return [{
                  ma_don_vi: 'TCNS',
                  phien_ban: 'v1',
                  du_lieu_ho_so_json: {
                    customUnits: [
                      { code: 'TYT', nameVi: 'Trạm Y tế', group: 'phong-ban' },
                      { code: 'TCNS', nameVi: 'Phòng Tổ chức - Nhân sự', group: 'phong-ban' }
                    ],
                    workRelationships: [{
                      id: 'wrel-jsonb-1',
                      sourceSurveyId: 'tk-src-1',
                      sourceTaskCode: 'TCNS.NV01.CV01',
                      sourceTaskName: 'Phối hợp JSONB',
                      sourceMissionCode: 'TCNS.NV01',
                      hostUnitCode: 'TCNS',
                      hostUnitName: 'Phòng Tổ chức - Nhân sự',
                      hostVtvlCode: 'TCNS.QL01',
                      targetUnitCode: 'QTTHTT',
                      targetUnitName: 'Phòng Quản trị thương hiệu và Truyền thông',
                      targetVtvlCode: 'QTTHTT.HT46',
                      hostLeaderApproved: true,
                      hostApprovedBy: 'tcns@hcmute.edu.vn',
                      targetLeaderApproved: true,
                      targetApprovedBy: 'leader.qtthtt@hcmute.edu.vn',
                      tcnsApproved: true,
                      tcnsApprovedBy: 'tcns@hcmute.edu.vn',
                      approvalLevel: 'both_units_and_tcns',
                      updatedAt: '2026-11-16T10:00:00.000Z'
                    }]
                  }
                }];
              }
              if (table === 'work_relationships') {
                return Array.from(mockWorkRelDb.values());
              }
              if (table === 'dm_don_vi') {
                return [
                  { ma_don_vi: 'TCNS', ten_don_vi_vi: 'Phòng Tổ chức - Nhân sự', khoi_don_vi: 'phong-ban', is_active: true },
                  { ma_don_vi: 'TYT', ten_don_vi_vi: 'Trạm Y tế', khoi_don_vi: 'phong-ban', is_active: false }
                ];
              }
              return [];
            },
            upsert: async (table, rows) => {
              if (table === 'work_relationships') {
                for (const r of rows) mockWorkRelDb.set(r.id, r);
              }
              return { ok: true, status: 201 };
            }
          });

          const { syncWorkbookAtomicOrFallback } = require('./src/services/storage/server-workbook-relational-sync');
          const { syncWorkRelationshipsFromSupabase, resetWorkRelationshipsMemoryStore, getWorkRelationshipById } = require('./src/services/storage/server-work-relationship-store');
          const { syncUnitsFromSupabase } = require('./src/services/storage/server-unit-store');

          // 5a. Gọi syncWorkbookAtomicOrFallback thành công qua 1 RPC duy nhất
          const wbCur = getWorkbookById(wbId);
          const okSync = await syncWorkbookAtomicOrFallback(wbCur, { ma_don_vi: 'LAB_QA', ten_don_vi: 'LAB_QA', phien_ban: 'v2' });
          assert.strictEqual(okSync.ok, true);
          assert.strictEqual(okSync.atomicRpcUsed, true, 'Phải thực thi qua RPC nguyên tử rpc_sync_workbook_atomic');
          assert.strictEqual(rpcCalls.length, 1, 'Chỉ gọi đúng 1 request RPC cho toàn bộ snapshot + 16 bảng quan hệ');

          // 5b. Giả lập lỗi giữa giao dịch trên DB RPC -> ném lỗi TX_ABORTED_MIDWAY
          simulateDbRpcAbort = true;
          let dbRpcThrew = false;
          try {
            await syncWorkbookAtomicOrFallback(wbCur, { ma_don_vi: 'LAB_QA' }, undefined, { requireAtomicRpc: true });
          } catch (e) {
            dbRpcThrew = String(e.message || e).includes('TX_ABORTED_MIDWAY');
          }
          assert.strictEqual(dbRpcThrew, true, 'Khi DB RPC lỗi giữa giao dịch phải ném TX_ABORTED_MIDWAY');

          // 5c. Backfill workRelationships từ JSONB sang bảng work_relationships: chạy 2 lần liên tiếp không trùng, giữ nguyên trạng thái duyệt
          resetWorkRelationshipsMemoryStore();
          await syncWorkRelationshipsFromSupabase();
          await syncWorkRelationshipsFromSupabase();
          assert.strictEqual(mockWorkRelDb.size, 1, 'Chạy backfill 2 lần không được tạo bản ghi trùng');
          const backfilled = mockWorkRelDb.get('wrel-jsonb-1');
          assert.strictEqual(backfilled.host_leader_approved, true);
          assert.strictEqual(backfilled.target_leader_approved, true);
          assert.strictEqual(backfilled.tcns_approved, true);
          assert.strictEqual(getWorkRelationshipById('wrel-jsonb-1').tcnsApproved, true);

          // 5d. Khi TYT có is_active=false trên dm_don_vi nhưng vẫn còn trong t_tien_do.customUnits -> không được tự thêm lại
          resetUnitMemoryStore();
          const syncedUnits = await syncUnitsFromSupabase(true);
          assert.strictEqual(syncedUnits.some((u) => u.code === 'TYT'), false, 'Đơn vị is_active=false trên dm_don_vi không được bị backfill từ customUnits thêm lại');
          await resetServerUnits();
        } finally {
          setDbTestHook(null);
          process.env.VTVL_ISOLATED_LOCAL_STORE = origIso;
        }
      })().catch((e) => { console.error(e); process.exit(1); });
    `;
    execSync(`npx tsx -e "${tsxCode.replace(/"/g, '\\"')}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'pipe'
    });
  } finally {
    for (const [name, content] of backups.entries()) {
      const p = path.join(dataDir, name);
      if (content === null) { if (fs.existsSync(p)) fs.unlinkSync(p); }
      else fs.writeFileSync(p, content, 'utf8');
    }
  }
});

runTest('Ca 25: Luồng Chỉnh sửa phiếu đang Chờ duyệt (14 tiêu chí nghiệm thu: giữ nguyên ID/mã CV, tăng version, lịch sử UPDATE_PENDING, khóa sau khi Đã duyệt / Đã gộp B1-B2)', () => {
  const inlineFormCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketInlineForm.tsx'), 'utf8');
  const toolbarCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffTicketToolbar.tsx'), 'utf8');
  const myTicketsCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/StaffMyTicketsList.tsx'), 'utf8');
  const timelineCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/TicketApprovalHistoryTimeline.tsx'), 'utf8');

  assert.ok(
    inlineFormCode.includes('Phiếu đã được gửi duyệt. Bạn vẫn có thể chỉnh sửa trong thời gian phiếu chưa được duyệt. Nội dung mới nhất sẽ được gửi đến người duyệt.'),
    'StaffTicketInlineForm phải hiển thị đúng thông báo khi chỉnh sửa phiếu Chờ duyệt'
  );
  assert.ok(
    inlineFormCode.includes('Đã cập nhật phiếu. Phiếu tiếp tục ở trạng thái Chờ duyệt.'),
    'StaffTicketInlineForm phải hiển thị đúng thông báo sau khi cập nhật phiếu Chờ duyệt thành công'
  );
  assert.ok(
    toolbarCode.includes("'Cập nhật phiếu'"),
    'StaffTicketToolbar phải đổi nhãn nút thành Cập nhật phiếu khi đang sửa phiếu Chờ duyệt'
  );
  assert.ok(
    myTicketsCode.includes('Chỉnh sửa') && myTicketsCode.includes("canonical === 'submitted'") && myTicketsCode.includes('!t.isMergedToB1B2'),
    'StaffMyTicketsList phải cho phép nút Chỉnh sửa trên phiếu Chờ duyệt và chặn khi Đã duyệt hoặc Đã gộp B1/B2'
  );
  assert.ok(
    timelineCode.includes('UPDATE_PENDING') && timelineCode.includes('Cập nhật phiếu sau khi gửi duyệt'),
    'TicketApprovalHistoryTimeline phải có sự kiện UPDATE_PENDING ("Cập nhật phiếu sau khi gửi duyệt")'
  );

  const dataDir = path.join(root, '.data');
  const backupFiles = ['server_accounts.json', 'accounts.json', 'staff_tickets.json', 'work_survey_versions.json', 'work_survey_merge_links.json', 'audit-logs.json', 'audit_logs.json', 'server_workbooks.json', 'work_survey_coordinated_vtvls.json'];
  const backups = new Map();
  for (const name of backupFiles) {
    const p = path.join(dataDir, name);
    backups.set(p, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }

  try {
    const tsxScript = `
      import assert from 'assert';
      import { NextRequest } from 'next/server';
      import { GET as getTickets, POST as postTicket, PATCH as patchTicket } from './src/app/api/tickets/route';
      import { generateUserSessionToken } from './src/services/storage/server-auth-guard';
      import { upsertUserAccount } from './src/services/storage/server-account-store';
      import { getOrCreateWorkbook } from './src/services/storage/server-workbook-store';

      (async () => {
        const ownerEmail = 'staff.editpending.qa@hcmute.edu.vn';
        const otherStaffEmail = 'other.staff.qa@hcmute.edu.vn';
        const leaderEmail = 'leader.editpending.qa@hcmute.edu.vn';
        const adminEmail = 'tcns@hcmute.edu.vn';

        await upsertUserAccount({ email: ownerEmail, displayName: 'Chuyên viên Kê khai QA', unitCode: 'SDH', unitNameVi: 'Viện Sau Đại học', title: 'Cán bộ – Giảng viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: otherStaffEmail, displayName: 'Chuyên viên Khác QA', unitCode: 'SDH', unitNameVi: 'Viện Sau Đại học', title: 'Cán bộ – Giảng viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: leaderEmail, displayName: 'Lãnh đạo SĐH QA', unitCode: 'SDH', unitNameVi: 'Viện Sau Đại học', title: 'Lãnh đạo đơn vị', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: adminEmail, displayName: 'Quản trị viên TCNS', unitCode: 'TCNS', unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Phòng Tổ chức – Nhân sự', role: 'admin', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        getOrCreateWorkbook('SDH', '01/10/2025–30/9/2026', leaderEmail, 'Lãnh đạo đơn vị');

        const ownerToken = generateUserSessionToken({ email: ownerEmail, unitCode: 'SDH', role: 'staff' });
        const otherToken = generateUserSessionToken({ email: otherStaffEmail, unitCode: 'SDH', role: 'staff' });
        const leaderToken = generateUserSessionToken({ email: leaderEmail, unitCode: 'SDH', role: 'unit_leader' });
        const adminToken = generateUserSessionToken({ email: adminEmail, unitCode: 'TCNS', role: 'admin' });

        // TC1: Tạo nháp rồi mở lại sửa nháp bình thường
        const draftRes1 = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'draft', status: 'Nháp', unitCode: 'SDH',
            maNhiemVu: 'SDH.NV01', tenCongViec: 'Công việc khảo sát bản nháp 1', maVtvl: 'SDH.CV01',
            sanPham: 'Báo cáo nháp', chatLuong: 'Đúng hạn', canCu: 'QĐ 01', soSpNam: 5, nguonSoLieu: 'Hồ sơ', phutThucTe: 60, gioBoSung: 2
          })
        }));
        assert.strictEqual(draftRes1.status, 200);
        const draft1 = (await draftRes1.json()).ticket;
        const ticketId = draft1.id;
        const originalTaskCode = draft1.maCongViec;
        assert.strictEqual(draft1.status, 'Nháp');
        assert.ok(originalTaskCode.startsWith('SDH.NV01.CV'), 'Phải cấp mã công việc cho bản nháp');

        const draftRes2 = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json' },
          body: JSON.stringify({
            id: ticketId, action: 'draft', status: 'Nháp', unitCode: 'SDH',
            maNhiemVu: 'SDH.NV01', tenCongViec: 'Công việc khảo sát bản nháp 2', maVtvl: 'SDH.CV01',
            sanPham: 'Báo cáo nháp 2', chatLuong: 'Đúng hạn', canCu: 'QĐ 01', soSpNam: 8, nguonSoLieu: 'Hồ sơ', phutThucTe: 60, gioBoSung: 2
          })
        }));
        assert.strictEqual(draftRes2.status, 200);
        const draft2 = (await draftRes2.json()).ticket;
        assert.strictEqual(draft2.id, ticketId);
        assert.strictEqual(draft2.maCongViec, originalTaskCode);

        // TC2: Nhấn "Lưu & nộp" -> phiếu chuyển sang Chờ duyệt ("Đã nộp", v1)
        const submitRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json' },
          body: JSON.stringify({
            id: ticketId, action: 'submit', status: 'Đã nộp', unitCode: 'SDH',
            maNhiemVu: 'SDH.NV01', tenCongViec: 'Công việc nộp lần đầu v1', maVtvl: 'SDH.CV01',
            coordinatedVtvls: [{ unitCode: 'SDH', maVtvl: 'SDH.CV02', note: 'Phối hợp chuyên môn' }],
            sanPham: 'Hồ sơ v1', chatLuong: 'Đạt chuẩn ISO', canCu: 'Quyết định 100/QĐ-ĐHCNKT',
            soSpNam: 10, nguonSoLieu: 'Phần mềm quản lý', phutThucTe: 90, gioBoSung: 4
          })
        }));
        assert.strictEqual(submitRes.status, 200);
        const submittedV1 = (await submitRes.json()).ticket;
        assert.strictEqual(submittedV1.status, 'Đã nộp');
        assert.strictEqual(submittedV1.currentVersionNo, 1);
        assert.strictEqual(submittedV1.maCongViec, originalTaskCode);
        const firstSubmittedAt = submittedV1.submittedAt;
        assert.ok(firstSubmittedAt, 'Phải lưu ngày gửi lần đầu submittedAt');

        // TC5 & TC6 & TC7 & TC8: Chủ sở hữu mở lại phiếu đang Chờ duyệt và bấm "Cập nhật phiếu" (không đổi maNhiemVu -> giữ nguyên maCongViec)
        const updatePendingRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json' },
          body: JSON.stringify({
            id: ticketId, action: 'update_pending', status: 'Đã nộp', unitCode: 'SDH',
            maNhiemVu: 'SDH.NV01',
            tenCongViec: 'Công việc đã cập nhật khi đang Chờ duyệt v2',
            maVtvl: 'SDH.CV02',
            maVtvlPhoiHop: 'SDH.CV03',
            coordinationNote: 'Phối hợp rà soát học vụ',
            coordinatedVtvls: [{ unitCode: 'SDH', maVtvl: 'SDH.CV03', note: 'Phối hợp rà soát học vụ' }],
            sanPham: 'Hồ sơ thẩm định v2',
            chatLuong: 'Hoàn thành 100% đúng hạn',
            canCu: 'Quyết định 200/QĐ-ĐHCNKT',
            soSpNam: 25,
            nguonSoLieu: 'Hệ thống E-Office HCM-UTE',
            phutThucTe: 120,
            gioBoSung: 6
          })
        }));
        assert.strictEqual(updatePendingRes.status, 200, 'Chủ sở hữu phải cập nhật được phiếu đang Chờ duyệt');
        const updatedV2 = (await updatePendingRes.json()).ticket;
        assert.strictEqual(updatedV2.id, ticketId, 'Không được tạo bản ghi phiếu mới');
        assert.strictEqual(updatedV2.maCongViec, originalTaskCode, 'Không đổi Mã nhiệm vụ thì phải giữ nguyên Mã công việc');
        assert.strictEqual(updatedV2.status, 'Đã nộp', 'Sau khi cập nhật, phiếu phải tiếp tục giữ trạng thái Chờ duyệt (Đã nộp)');
        assert.strictEqual(updatedV2.currentVersionNo, 2, 'Phải tăng phiên bản lên v2');
        assert.strictEqual(updatedV2.submittedAt, firstSubmittedAt, 'Không được làm mất ngày gửi lần đầu submittedAt');
        assert.strictEqual(updatedV2.ownerEmail, ownerEmail, 'Không được làm mất người kê khai');
        assert.strictEqual(updatedV2.unitCode, 'SDH', 'Không được làm mất đơn vị');
        assert.strictEqual(updatedV2.maNhiemVu, 'SDH.NV01');
        assert.strictEqual(updatedV2.tenCongViec, 'Công việc đã cập nhật khi đang Chờ duyệt v2');
        assert.strictEqual(updatedV2.maVtvl, 'SDH.CV02');
        assert.strictEqual(updatedV2.soSpNam, 25);
        assert.strictEqual(updatedV2.phutThucTe, 120);
        assert.strictEqual(updatedV2.gioBoSung, 6);
        assert.strictEqual(updatedV2.coordinatedVtvls.length, 1);
        assert.strictEqual(updatedV2.coordinatedVtvls[0].maVtvl, 'SDH.CV03');

        // Kiểm tra Lịch sử và Người duyệt nhìn thấy nội dung mới nhất
        const leaderViewRes = await getTickets(new NextRequest('http://localhost:3360/api/tickets?id=' + encodeURIComponent(ticketId), {
          headers: { authorization: 'Bearer ' + leaderToken }
        }));
        assert.strictEqual(leaderViewRes.status, 200);
        const leaderViewBody = await leaderViewRes.json();
        assert.strictEqual(leaderViewBody.ticket.tenCongViec, 'Công việc đã cập nhật khi đang Chờ duyệt v2', 'Người duyệt phải nhìn thấy nội dung mới nhất');
        assert.strictEqual(leaderViewBody.versions.length, 2, 'Phải có đủ 2 snapshot phiên bản v1 và v2');
        assert.strictEqual(leaderViewBody.versions[1].changeSummary, 'Cập nhật phiếu sau khi gửi duyệt');
        const hasUpdatePendingHistory = (leaderViewBody.ticket.statusHistory || []).some(
          (h) => h.action === 'UPDATE_PENDING' && h.reason === 'Cập nhật phiếu sau khi gửi duyệt'
        );
        assert.strictEqual(hasUpdatePendingHistory, true, 'Lịch sử phải ghi nhận sự kiện UPDATE_PENDING ("Cập nhật phiếu sau khi gửi duyệt")');

        // TC11: Người dùng khác (kể cả cán bộ khác, lãnh đạo, hay admin) không sửa được phiếu của người kê khai
        for (const [label, tok] of [['cán bộ khác', otherToken], ['lãnh đạo', leaderToken], ['admin', adminToken]]) {
          const illegalRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
            body: JSON.stringify({
              id: ticketId, action: 'update_pending', unitCode: 'SDH',
              maNhiemVu: 'SDH.NV02', tenCongViec: 'Sửa trái phép bởi ' + label, maVtvl: 'SDH.CV02',
              sanPham: 'SP', chatLuong: 'CL', canCu: 'CC', soSpNam: 1, nguonSoLieu: 'NSL', phutThucTe: 10
            })
          }));
          assert.strictEqual(illegalRes.status, 403, label + ' không được phép sửa nội dung phiếu của người khác');
          const illegalErr = await illegalRes.json();
          assert.strictEqual(illegalErr.code, 'FORBIDDEN_IDOR');
        }

        // TC9 & TC10: Lãnh đạo duyệt phiếu (autoMerge: false để kiểm thử trạng thái Đã duyệt trước khi gộp B1/B2) -> sau đó chủ sở hữu bấm "Cập nhật phiếu"
        const approveRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH',
          headers: { authorization: 'Bearer ' + leaderToken, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId, action: 'approve', autoMerge: false, unitCode: 'SDH' })
        }));
        assert.strictEqual(approveRes.status, 200);
        const approvedTicket = (await approveRes.json()).ticket;
        assert.strictEqual(approvedTicket.status, 'Đã duyệt');
        assert.strictEqual(approvedTicket.currentVersionNo, 2, 'Phải duyệt đúng phiên bản mới nhất v2');
        assert.strictEqual(Boolean(approvedTicket.isMergedToB1B2), false);

        const concurrentEditAfterApprove = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json' },
          body: JSON.stringify({
            id: ticketId, action: 'update_pending', status: 'Đã nộp', unitCode: 'SDH',
            maNhiemVu: 'SDH.NV02', tenCongViec: 'Cố sửa sau khi lãnh đạo vừa duyệt', maVtvl: 'SDH.CV02',
            sanPham: 'SP', chatLuong: 'CL', canCu: 'CC', soSpNam: 99, nguonSoLieu: 'NSL', phutThucTe: 99
          })
        }));
        assert.strictEqual(concurrentEditAfterApprove.status, 403, 'Phiếu đã duyệt phải từ chối chỉnh sửa với HTTP 403');
        const approvedErr = await concurrentEditAfterApprove.json();
        assert.strictEqual(approvedErr.code, 'FORBIDDEN_TICKET_APPROVED');
        assert.strictEqual(
          approvedErr.error,
          'Phiếu đã được duyệt nên không thể tiếp tục chỉnh sửa. Vui lòng tải lại dữ liệu.',
          'Thông báo từ chối khi phiếu đã được duyệt phải khớp chính xác yêu cầu'
        );

        // TC12: Khi phiếu đã gộp B1/B2 (isMergedToB1B2 = true) -> tuyệt đối không cho sửa nội dung nguồn
        const mergeRes = await patchTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PATCH',
          headers: { authorization: 'Bearer ' + leaderToken, 'content-type': 'application/json' },
          body: JSON.stringify({ ticketId, action: 'merge', unitCode: 'SDH' })
        }));
        assert.strictEqual(mergeRes.status, 200);
        const editMergedRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + ownerToken, 'content-type': 'application/json' },
          body: JSON.stringify({
            id: ticketId, action: 'update_pending', unitCode: 'SDH',
            maNhiemVu: 'SDH.NV02', tenCongViec: 'Cố sửa phiếu đã gộp B1/B2', maVtvl: 'SDH.CV02',
            sanPham: 'SP', chatLuong: 'CL', canCu: 'CC', soSpNam: 99, nguonSoLieu: 'NSL', phutThucTe: 99
          })
        }));
        assert.strictEqual(editMergedRes.status, 403);
        const mergedErr = await editMergedRes.json();
        assert.strictEqual(mergedErr.code, 'FORBIDDEN_TICKET_MERGED');
      })().catch((e) => { console.error(e); process.exit(1); });
    `;
    execSync(`npx tsx -e "${tsxScript.replace(/"/g, '\\"')}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'pipe'
    });
  } finally {
    for (const [p, content] of backups.entries()) {
      if (content === null) { if (fs.existsSync(p)) fs.unlinkSync(p); }
      else fs.writeFileSync(p, content, 'utf8');
    }
  }
});

runTest('Ca 26: Nghiệp vụ đổi Mã nhiệm vụ khi chỉnh sửa phiếu (9 tiêu chí nghiệm thu: cấp mã CV mới, bảo lưu mã cũ replaced không tái sử dụng, lịch sử CHANGE_MISSION_CODE, đồng bộ đề xuất phối hợp, rollback & xử lý đồng thời)', () => {
  const dataDir = path.join(root, '.data');
  const backupFiles = ['server_accounts.json', 'accounts.json', 'staff_tickets.json', 'work_survey_versions.json', 'work_survey_merge_links.json', 'audit-logs.json', 'audit_logs.json', 'server_workbooks.json', 'work_survey_coordinated_vtvls.json', 'work_relationships.json', 'user_vtvl_assignments.json'];
  const backups = new Map();
  for (const name of backupFiles) {
    const p = path.join(dataDir, name);
    backups.set(p, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }

  try {
    const tsxScript = `
      import assert from 'assert';
      import { NextRequest } from 'next/server';
      import { GET as getTickets, POST as postTicket, PUT as putTicket, PATCH as patchTicket } from './src/app/api/tickets/route';
      import { GET as getCoordinated } from './src/app/api/tickets/coordinated/route';
      import { generateUserSessionToken } from './src/services/storage/server-auth-guard';
      import { upsertUserAccount } from './src/services/storage/server-account-store';
      import { getOrCreateWorkbook } from './src/services/storage/server-workbook-store';
      import { setAssignmentsForAccount } from './src/services/storage/server-vtvl-assignment-store';
      import { getReplacedWorkCodesForSurvey } from './src/services/storage/server-coordination-store';

      (async () => {
        const staff1 = 'staff1.mission.qa@hcmute.edu.vn';
        const staff2 = 'staff2.mission.qa@hcmute.edu.vn';
        const coordReceiver = 'receiver.mission.qa@hcmute.edu.vn';
        const leader = 'leader.mission.qa@hcmute.edu.vn';

        await upsertUserAccount({ email: staff1, displayName: 'Cán bộ 1 QA', unitCode: 'TCNS', unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Chuyên viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: staff2, displayName: 'Cán bộ 2 QA', unitCode: 'TCNS', unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Chuyên viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: coordReceiver, displayName: 'Người nhận phối hợp QA', unitCode: 'TCNS', unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Chuyên viên', role: 'staff', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);
        await upsertUserAccount({ email: leader, displayName: 'Lãnh đạo TCNS QA', unitCode: 'TCNS', unitNameVi: 'Phòng Tổ chức - Nhân sự', title: 'Trưởng phòng', role: 'unit_leader', authProvider: 'email', status: 'active', hasSelectedUnit: true }, true);

        getOrCreateWorkbook('TCNS', '01/10/2025–30/9/2026', leader, 'Trưởng phòng');
        await setAssignmentsForAccount({ userEmail: coordReceiver, unitCode: 'TCNS', items: [{ maVtvl: 'TCNS.CV09', tenVtvl: 'Chuyên viên phối hợp' }], assignedBy: leader });

        const tok1 = generateUserSessionToken({ email: staff1, unitCode: 'TCNS', role: 'staff' });
        const tok2 = generateUserSessionToken({ email: staff2, unitCode: 'TCNS', role: 'staff' });
        const tokReceiver = generateUserSessionToken({ email: coordReceiver, unitCode: 'TCNS', role: 'staff' });
        const tokLeader = generateUserSessionToken({ email: leader, unitCode: 'TCNS', role: 'unit_leader' });

        // 1. Tạo phiếu ở TCNS.NV01 và nộp (v1) -> nhận mã TCNS.NV01.CVxx
        const createRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tok1, 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'submit', status: 'Đã nộp', unitCode: 'TCNS',
            maNhiemVu: 'TCNS.NV01', tenCongViec: 'Rà soát hồ sơ vị trí việc làm v1', maVtvl: 'TCNS.CV01',
            coordinatedVtvls: [{ unitCode: 'TCNS', maVtvl: 'TCNS.CV09', note: 'Phối hợp đối chiếu' }],
            sanPham: 'Báo cáo rà soát', chatLuong: 'Đúng hạn', canCu: 'QĐ 2266',
            soSpNam: 12, nguonSoLieu: 'Hồ sơ TCNS', phutThucTe: 90, gioBoSung: 2
          })
        }));
        assert.strictEqual(createRes.status, 200);
        const ticketV1 = (await createRes.json()).ticket;
        const ticketId = ticketV1.id;
        const oldWorkCode = ticketV1.maCongViec;
        assert.ok(oldWorkCode.startsWith('TCNS.NV01.CV'), 'Mã công việc v1 phải thuộc TCNS.NV01');

        // 2. TC1: Chỉnh sửa nội dung nhưng KHÔNG đổi Mã nhiệm vụ -> giữ nguyên oldWorkCode
        const sameMissionRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tok1, 'content-type': 'application/json' },
          body: JSON.stringify({
            id: ticketId, action: 'update_pending', status: 'Đã nộp', unitCode: 'TCNS',
            maNhiemVu: 'TCNS.NV01', maCongViec: oldWorkCode,
            tenCongViec: 'Rà soát hồ sơ vị trí việc làm v2 (cùng nhiệm vụ)', maVtvl: 'TCNS.CV01',
            coordinatedVtvls: [{ unitCode: 'TCNS', maVtvl: 'TCNS.CV09', note: 'Phối hợp đối chiếu' }],
            sanPham: 'Báo cáo rà soát', chatLuong: 'Đúng hạn', canCu: 'QĐ 2266',
            soSpNam: 15, nguonSoLieu: 'Hồ sơ TCNS', phutThucTe: 90, gioBoSung: 2
          })
        }));
        assert.strictEqual(sameMissionRes.status, 200);
        const ticketV2 = (await sameMissionRes.json()).ticket;
        assert.strictEqual(ticketV2.id, ticketId);
        assert.strictEqual(ticketV2.maCongViec, oldWorkCode, 'Không đổi Mã nhiệm vụ thì Mã công việc giữ nguyên');
        assert.strictEqual(ticketV2.currentVersionNo, 2);

        // 3. TC8: Giả lập lỗi giữa chừng (_simulateVersionFailure) khi đổi Mã nhiệm vụ sang TCNS.NV02 -> phải rollback toàn bộ
        const failChangeRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tok1, 'content-type': 'application/json' },
          body: JSON.stringify({
            id: ticketId, action: 'update_pending', status: 'Đã nộp', unitCode: 'TCNS',
            maNhiemVu: 'TCNS.NV02', tenCongViec: 'Thử đổi sang NV02 nhưng lỗi giữa chừng', maVtvl: 'TCNS.CV01',
            coordinatedVtvls: [{ unitCode: 'TCNS', maVtvl: 'TCNS.CV09', note: 'Phối hợp đối chiếu' }],
            sanPham: 'Báo cáo', chatLuong: 'Đúng hạn', canCu: 'QĐ 2266',
            soSpNam: 15, nguonSoLieu: 'Hồ sơ TCNS', phutThucTe: 90, gioBoSung: 2,
            _simulateVersionFailure: true
          })
        }));
        assert.strictEqual(failChangeRes.status, 500, 'Lỗi giữa chừng phải trả về 500');
        const checkAfterRollback = await getTickets(new NextRequest('http://localhost:3360/api/tickets?id=' + encodeURIComponent(ticketId), {
          headers: { authorization: 'Bearer ' + tok1 }
        }));
        const rolledBackTicket = (await checkAfterRollback.json()).ticket;
        assert.strictEqual(rolledBackTicket.maNhiemVu, 'TCNS.NV01', 'Rollback phải giữ nguyên Mã nhiệm vụ cũ');
        assert.strictEqual(rolledBackTicket.maCongViec, oldWorkCode, 'Rollback phải giữ nguyên Mã công việc cũ');
        assert.strictEqual(rolledBackTicket.currentVersionNo, 2, 'Rollback không được tạo phiên bản rác');
        assert.strictEqual(getReplacedWorkCodesForSurvey(ticketId).length, 0, 'Rollback không được để lại bản ghi replaced rác');

        // 4. TC2, TC3, TC4, TC5, TC6: Đổi Mã nhiệm vụ từ TCNS.NV01 sang TCNS.NV02 thành công (kể cả khi client cố gửi maCongViec cũ)
        const changeMissionRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tok1, 'content-type': 'application/json' },
          body: JSON.stringify({
            id: ticketId, action: 'update_pending', status: 'Đã nộp', unitCode: 'TCNS',
            maNhiemVu: 'TCNS.NV02', maCongViec: oldWorkCode,
            tenCongViec: 'Công việc sau khi chuyển sang nhiệm vụ TCNS.NV02', maVtvl: 'TCNS.CV01',
            coordinatedVtvls: [{ unitCode: 'TCNS', maVtvl: 'TCNS.CV09', note: 'Phối hợp đối chiếu ở NV02' }],
            sanPham: 'Báo cáo NV02', chatLuong: 'Đúng hạn', canCu: 'QĐ 2266',
            soSpNam: 20, nguonSoLieu: 'Hồ sơ TCNS', phutThucTe: 90, gioBoSung: 2
          })
        }));
        assert.strictEqual(changeMissionRes.status, 200);
        const ticketV3 = (await changeMissionRes.json()).ticket;
        const newWorkCode = ticketV3.maCongViec;
        assert.strictEqual(ticketV3.id, ticketId, 'ID phiếu giữ nguyên');
        assert.strictEqual(ticketV3.status, 'Đã nộp', 'Trạng thái Chờ duyệt giữ nguyên');
        assert.strictEqual(ticketV3.maNhiemVu, 'TCNS.NV02');
        assert.ok(newWorkCode.startsWith('TCNS.NV02.CV'), 'Mã công việc mới phải thuộc TCNS.NV02: ' + newWorkCode);
        assert.notStrictEqual(newWorkCode, oldWorkCode, 'Mã công việc mới phải khác mã cũ');
        assert.strictEqual(ticketV3.currentVersionNo, 3);

        // Kiểm tra cấu trúc replacedWorkCodes lưu quan hệ oldWorkCode -> newWorkCode
        const replacedList = getReplacedWorkCodesForSurvey(ticketId);
        assert.strictEqual(replacedList.length, 1, 'Phải lưu bản ghi đánh dấu mã cũ là replaced');
        assert.strictEqual(replacedList[0].oldMissionCode, 'TCNS.NV01');
        assert.strictEqual(replacedList[0].newMissionCode, 'TCNS.NV02');
        assert.strictEqual(replacedList[0].oldWorkCode, oldWorkCode);
        assert.strictEqual(replacedList[0].newWorkCode, newWorkCode);
        assert.strictEqual(replacedList[0].status, 'replaced');
        assert.strictEqual(replacedList[0].previousVersionNo, 2);
        assert.strictEqual(replacedList[0].currentVersionNo, 3);

        // Kiểm tra lịch sử và snapshot phiên bản
        const detailAfterChange = await (await getTickets(new NextRequest('http://localhost:3360/api/tickets?id=' + encodeURIComponent(ticketId), {
          headers: { authorization: 'Bearer ' + tokLeader }
        }))).json();
        assert.strictEqual(detailAfterChange.versions[0].snapshot.maCongViec, oldWorkCode, 'Snapshot v1 vẫn giữ nguyên mã công việc cũ');
        assert.strictEqual(detailAfterChange.versions[1].snapshot.maCongViec, oldWorkCode, 'Snapshot v2 vẫn giữ nguyên mã công việc cũ');
        assert.strictEqual(detailAfterChange.versions[2].snapshot.maCongViec, newWorkCode, 'Snapshot v3 lưu mã công việc mới');
        const expectedReason = 'Thay đổi Mã nhiệm vụ từ TCNS.NV01 sang TCNS.NV02; Mã công việc được thay đổi từ ' + oldWorkCode + ' sang ' + newWorkCode + '.';
        const changeHist = (detailAfterChange.ticket.statusHistory || []).find((h) => h.action === 'CHANGE_MISSION_CODE');
        assert.ok(changeHist, 'Lịch sử phải có sự kiện CHANGE_MISSION_CODE');
        assert.ok(changeHist.reason.includes(expectedReason), 'Nội dung lịch sử phải khớp mẫu chuẩn: ' + changeHist.reason);
        assert.strictEqual(changeHist.oldMissionCode, 'TCNS.NV01');
        assert.strictEqual(changeHist.newMissionCode, 'TCNS.NV02');
        assert.strictEqual(changeHist.oldWorkCode, oldWorkCode);
        assert.strictEqual(changeHist.newWorkCode, newWorkCode);

        // Kiểm tra TC4: Mã công việc cũ (oldWorkCode thuộc TCNS.NV01) tuyệt đối KHÔNG được cấp lại cho phiếu mới thuộc TCNS.NV01
        const nextAllocRes = await putTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'PUT',
          headers: { authorization: 'Bearer ' + tok2, 'content-type': 'application/json' },
          body: JSON.stringify({ unitCode: 'TCNS', maNhiemVu: 'TCNS.NV01' })
        }));
        const nextAllocCode = (await nextAllocRes.json()).nextTaskCode;
        assert.notStrictEqual(nextAllocCode, oldWorkCode, 'Mã công việc cũ đã replaced tuyệt đối không được tái sử dụng');
        const oldSeq = parseInt(oldWorkCode.split('.CV')[1], 10);
        const nextSeq = parseInt(nextAllocCode.split('.CV')[1], 10);
        assert.ok(nextSeq > oldSeq, 'Số thứ tự CV mới (' + nextSeq + ') phải lớn hơn số thứ tự mã cũ đã replaced (' + oldSeq + ')');

        // Kiểm tra TC6: Đề xuất VTVL phối hợp hiện hành phải phản ánh Mã nhiệm vụ mới & Mã công việc mới (không còn mã cũ)
        const coordRes = await getCoordinated(new NextRequest('http://localhost:3360/api/tickets/coordinated?scope=unit', {
          headers: { authorization: 'Bearer ' + tokReceiver }
        }));
        const coordBody = await coordRes.json();
        const propItem = (coordBody.items || []).find((i) => i.surveyId === ticketId);
        assert.ok(propItem, 'Đề xuất phối hợp của phiếu phải tồn tại');
        assert.strictEqual(propItem.maNhiemVu, 'TCNS.NV02', 'Đề xuất phối hợp hiện hành phải dùng Mã nhiệm vụ mới');
        assert.strictEqual(propItem.maCongViec, newWorkCode, 'Đề xuất phối hợp hiện hành phải dùng Mã công việc mới');

        // 5. TC9 (Đồng thời & Idempotency):
        // 5a. Gửi lại đúng cùng request cập nhật 2 lần liên tiếp (timeout retry) -> không sinh thêm phiên bản hay lịch sử
        const retryRes = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tok1, 'content-type': 'application/json' },
          body: JSON.stringify({
            id: ticketId, action: 'update_pending', status: 'Đã nộp', unitCode: 'TCNS',
            maNhiemVu: 'TCNS.NV02', maCongViec: newWorkCode,
            tenCongViec: 'Công việc sau khi chuyển sang nhiệm vụ TCNS.NV02', maVtvl: 'TCNS.CV01',
            coordinatedVtvls: [{ unitCode: 'TCNS', maVtvl: 'TCNS.CV09', note: 'Phối hợp đối chiếu ở NV02' }],
            sanPham: 'Báo cáo NV02', chatLuong: 'Đúng hạn', canCu: 'QĐ 2266',
            soSpNam: 20, nguonSoLieu: 'Hồ sơ TCNS', phutThucTe: 90, gioBoSung: 2
          })
        }));
        const retryBody = await retryRes.json();
        assert.strictEqual(retryBody.idempotent, true, 'Gửi trùng cùng nội dung phải trả về idempotent=true');
        assert.strictEqual(retryBody.ticket.currentVersionNo, 3, 'Không được tạo thêm phiên bản thứ 4 khi retry');

        // 5b. Hai phiếu khác nhau đồng thời chuyển sang cùng một Mã nhiệm vụ (TCNS.NV03) -> phải nhận 2 mã CV khác nhau, không trùng
        const tA_Res = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tok1, 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'draft', status: 'Nháp', unitCode: 'TCNS', maNhiemVu: 'TCNS.NV01', tenCongViec: 'Phiếu A', maVtvl: 'TCNS.CV01' })
        }));
        const tB_Res = await postTicket(new NextRequest('http://localhost:3360/api/tickets', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + tok2, 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'draft', status: 'Nháp', unitCode: 'TCNS', maNhiemVu: 'TCNS.NV01', tenCongViec: 'Phiếu B', maVtvl: 'TCNS.CV01' })
        }));
        const tA = (await tA_Res.json()).ticket;
        const tB = (await tB_Res.json()).ticket;

        const [moveA, moveB] = await Promise.all([
          postTicket(new NextRequest('http://localhost:3360/api/tickets', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + tok1, 'content-type': 'application/json' },
            body: JSON.stringify({ id: tA.id, action: 'draft', status: 'Nháp', unitCode: 'TCNS', maNhiemVu: 'TCNS.NV03', tenCongViec: 'Phiếu A sang NV03', maVtvl: 'TCNS.CV01' })
          })),
          postTicket(new NextRequest('http://localhost:3360/api/tickets', {
            method: 'POST',
            headers: { authorization: 'Bearer ' + tok2, 'content-type': 'application/json' },
            body: JSON.stringify({ id: tB.id, action: 'draft', status: 'Nháp', unitCode: 'TCNS', maNhiemVu: 'TCNS.NV03', tenCongViec: 'Phiếu B sang NV03', maVtvl: 'TCNS.CV01' })
          }))
        ]);
        const codeA = (await moveA.json()).ticket.maCongViec;
        const codeB = (await moveB.json()).ticket.maCongViec;
        assert.ok(codeA.startsWith('TCNS.NV03.CV') && codeB.startsWith('TCNS.NV03.CV'), 'Cả hai phiếu phải nhận mã thuộc TCNS.NV03');
        assert.notStrictEqual(codeA, codeB, 'Hai phiếu chuyển đồng thời sang cùng Mã nhiệm vụ không được nhận trùng Mã công việc (' + codeA + ' vs ' + codeB + ')');
      })().catch((e) => { console.error(e); process.exit(1); });
    `;
    execSync(`npx tsx -e "${tsxScript.replace(/"/g, '\\"')}"`, {
      env: { ...process.env, VTVL_ISOLATED_LOCAL_STORE: 'true' },
      stdio: 'pipe'
    });
  } finally {
    for (const [p, content] of backups.entries()) {
      if (content === null) { if (fs.existsSync(p)) fs.unlinkSync(p); }
      else fs.writeFileSync(p, content, 'utf8');
    }
  }
});

console.log('\n================================================================');
console.log(` KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
