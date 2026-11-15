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
const reviewListCode = fs.readFileSync(path.join(root, 'src/components/staff-portal/UnitTicketsReviewList.tsx'), 'utf8');
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
  assert.ok(printSheetCode.includes('TRƯỜNG ĐẠI HỌC CÔNG NGHỆ KỸ THUẬT TP.HCM'), 'Bản in PDF có quốc hiệu và tên trường chuẩn');
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

console.log('\n================================================================');
console.log(` KẾT QUẢ KIỂM THỬ: ${passed} PASS, ${failed} FAIL`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
