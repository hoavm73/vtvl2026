import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { ValidationIssue } from './vtvl-validation-types';

export function validateA1Sheet(rows: GenericGridRow[], unitCode: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenMissionCodes = new Set<string>();

  rows.forEach((r, idx) => {
    const rowNum = idx + 3;
    const mCode = String(r.maNhiemVu || '').trim();
    const mName = String(r.tenNhiemVu || '').trim();
    const period = String(r.ky || '').trim();
    const status = String(r.trangThai || '').trim();

    if (!mCode) {
      issues.push({
        id: `a1-empty-code-${idx}`, ruleId: 'R-A1-01', sheetKey: 'A1', sheetName: '1. A1_NhiemVu',
        cellRef: `1. A1_NhiemVu!A${rowNum}`, rowId: r.id, field: 'maNhiemVu', severity: 'fix',
        title: 'Mã nhiệm vụ không được để trống', currentValue: 'Trống',
        suggestion: `Điền mã nhiệm vụ theo chuẩn ${unitCode}.NV01, ${unitCode}.NV02...`
      });
    } else {
      if (seenMissionCodes.has(mCode)) {
        issues.push({
          id: `a1-dup-code-${idx}`, ruleId: 'R-A1-02', sheetKey: 'A1', sheetName: '1. A1_NhiemVu',
          cellRef: `1. A1_NhiemVu!A${rowNum}`, rowId: r.id, field: 'maNhiemVu', severity: 'fix',
          title: `TRÙNG MÃ NHIỆM VỤ: Mã "${mCode}" đã tồn tại`, currentValue: mCode,
          suggestion: 'Mỗi nhiệm vụ phải có một mã định danh duy nhất.'
        });
      }
      seenMissionCodes.add(mCode);

      if (!mCode.startsWith(`${unitCode}.NV`)) {
        issues.push({
          id: `a1-prefix-${idx}`, ruleId: 'R-A1-03', sheetKey: 'A1', sheetName: '1. A1_NhiemVu',
          cellRef: `1. A1_NhiemVu!A${rowNum}`, rowId: r.id, field: 'maNhiemVu', severity: 'fix',
          title: `Mã nhiệm vụ chưa theo chuẩn [ĐV].NVxx: "${mCode}"`, currentValue: mCode,
          suggestion: `Quy chuẩn mã nhiệm vụ HCM-UTE: ${unitCode}.NVxx (ví dụ: ${unitCode}.NV01).`
        });
      }
    }

    if (!mName) {
      issues.push({
        id: `a1-name-${idx}`, ruleId: 'R-A1-04', sheetKey: 'A1', sheetName: '1. A1_NhiemVu',
        cellRef: `1. A1_NhiemVu!B${rowNum}`, rowId: r.id, field: 'tenNhiemVu', severity: 'fix',
        title: 'Tên nhiệm vụ không được để trống', currentValue: 'Trống',
        suggestion: 'Ghi tên nhiệm vụ được giao theo Quyết định chức năng nhiệm vụ (QĐ 2266).'
      });
    }

    if (period !== '01/10/2025–30/9/2026') {
      issues.push({
        id: `a1-period-${idx}`, ruleId: 'R-A1-05', sheetKey: 'A1', sheetName: '1. A1_NhiemVu',
        cellRef: `1. A1_NhiemVu!E${rowNum}`, rowId: r.id, field: 'ky', severity: 'fix',
        title: `Kỳ số liệu chưa đồng bộ: "${period}"`, currentValue: period || 'Trống',
        suggestion: 'Thống nhất toàn bộ file kỳ: "01/10/2025–30/9/2026" (dấu gạch nối en-dash "–").'
      });
    }

    const validStatus = ['Tiếp tục thực hiện', 'Mới tiếp nhận', 'Đã chuyển giao', 'Không còn thực hiện'];
    if (!validStatus.includes(status)) {
      issues.push({
        id: `a1-status-${idx}`, ruleId: 'R-A1-06', sheetKey: 'A1', sheetName: '1. A1_NhiemVu',
        cellRef: `1. A1_NhiemVu!F${rowNum}`, rowId: r.id, field: 'trangThai', severity: 'fix',
        title: `Trạng thái nhiệm vụ không hợp lệ: "${status}"`, currentValue: status || 'Trống',
        suggestion: 'Chọn đúng 1 trong các giá trị: Tiếp tục thực hiện, Mới tiếp nhận, Đã chuyển giao, Không còn thực hiện.'
      });
    }
  });

  return issues;
}

export function validateA2Sheet(
  rows: GenericGridRow[],
  validMissionCodes: Set<string>,
  validVtvlCodes: Set<string>,
  unitCode: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenTaskCodes = new Set<string>();

  rows.forEach((r, idx) => {
    const rowNum = idx + 3;
    const tCode = String(r.maCongViec || '').trim();
    const mCode = String(r.maNhiemVu || '').trim();
    const vCode = String(r.maVtvl || '').trim();
    const tName = String(r.tenCongViec || '').trim();
    const basis = String(r.canCu || '').trim();

    if (!tCode) {
      issues.push({
        id: `a2-empty-code-${idx}`, ruleId: 'R-A2-01', sheetKey: 'A2', sheetName: '2. A2_CongViec',
        cellRef: `2. A2_CongViec!A${rowNum}`, rowId: r.id, field: 'maCongViec', severity: 'fix',
        title: 'Mã công việc không được để trống', currentValue: 'Trống',
        suggestion: `Điền mã theo chuẩn [Mã NV].CVxx (ví dụ: ${unitCode}.NV01.CV01).`
      });
    } else {
      if (seenTaskCodes.has(tCode)) {
        issues.push({
          id: `a2-dup-code-${idx}`, ruleId: 'R-A2-02', sheetKey: 'A2', sheetName: '2. A2_CongViec',
          cellRef: `2. A2_CongViec!A${rowNum}`, rowId: r.id, field: 'maCongViec', severity: 'fix',
          title: `TRÙNG MÃ CÔNG VIỆC: Mã "${tCode}" đã tồn tại`, currentValue: tCode,
          suggestion: 'Mỗi công việc trong biểu 2 phải có một mã duy nhất.'
        });
      }
      seenTaskCodes.add(tCode);

      if (mCode && !tCode.startsWith(mCode)) {
        issues.push({
          id: `a2-prefix-${idx}`, ruleId: 'R-A2-03', sheetKey: 'A2', sheetName: '2. A2_CongViec',
          cellRef: `2. A2_CongViec!A${rowNum}`, rowId: r.id, field: 'maCongViec', severity: 'fix',
          title: `Mã công việc "${tCode}" chưa kế thừa đúng Mã nhiệm vụ "${mCode}"`, currentValue: tCode,
          suggestion: `Mã công việc phải bắt đầu bằng mã nhiệm vụ tương ứng: ${mCode}.CVxx.`
        });
      }
    }

    if (!mCode || !validMissionCodes.has(mCode)) {
      issues.push({
        id: `a2-mis-invalid-${idx}`, ruleId: 'R-A2-04', sheetKey: 'A2', sheetName: '2. A2_CongViec',
        cellRef: `2. A2_CongViec!B${rowNum}`, rowId: r.id, field: 'maNhiemVu', severity: 'fix',
        title: `MÃ NHIỆM VỤ CHƯA CÓ Ở A1: "${mCode}"`, currentValue: mCode || 'Trống',
        suggestion: 'Mã nhiệm vụ tại A2 phải khớp chính xác với danh mục nhiệm vụ đã khai tại Biểu 1. A1_NhiemVu.'
      });
    }

    if (!vCode || !validVtvlCodes.has(vCode)) {
      issues.push({
        id: `a2-vtvl-invalid-${idx}`, ruleId: 'R-A2-05', sheetKey: 'A2', sheetName: '2. A2_CongViec',
        cellRef: `2. A2_CongViec!C${rowNum}`, rowId: r.id, field: 'maVtvl', severity: 'fix',
        title: `MÃ VTVL CHƯA CÓ Ở C1: "${vCode}"`, currentValue: vCode || 'Trống',
        suggestion: 'Mã VTVL phải trùng đúng mã đã ban hành tại Biểu 3. C1_VTVL.'
      });
    }

    if (!tName) {
      issues.push({
        id: `a2-name-${idx}`, ruleId: 'R-A2-06', sheetKey: 'A2', sheetName: '2. A2_CongViec',
        cellRef: `2. A2_CongViec!D${rowNum}`, rowId: r.id, field: 'tenCongViec', severity: 'fix',
        title: 'Tên công việc không được để trống', currentValue: 'Trống',
        suggestion: 'Mô tả rõ ràng tên đầu việc cụ thể gắn với sản phẩm đầu ra.'
      });
    }

    if (/(40\/2020|35\/2020|07\/2023|10\/2024)/i.test(basis)) {
      issues.push({
        id: `a2-basis-expired-${idx}`, ruleId: 'R-TT31-40', sheetKey: 'A2', sheetName: '2. A2_CongViec',
        cellRef: `2. A2_CongViec!H${rowNum}`, rowId: r.id, field: 'canCu', severity: 'fix',
        title: 'Căn cứ pháp lý dẫn chiếu văn bản cũ đã hết hiệu lực', currentValue: basis,
        suggestion: 'Thay thế bằng Nghị định 232/2026/NĐ-CP và Thông tư số 31/2026/TT-BGDĐT.',
        legalBasis: 'Khoản 2 Điều 17 Thông tư số 31/2026/TT-BGDĐT'
      });
    }
  });

  return issues;
}

export function validateB1Sheet(
  rows: GenericGridRow[],
  validTaskCodes: Set<string>,
  validVtvlCodes: Set<string>,
  stdMinutesMap: Map<string, number>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  rows.forEach((r, idx) => {
    const rowNum = idx + 3;
    const tCode = String(r.maCongViec || '').trim();
    const vCode = String(r.maVtvl || '').trim();
    const qty = Number(r.soSpNam);
    const measuredMins = Number(r.phutThucTe);
    const sourceQty = String(r.nguon || '').trim();
    const alertCol = String(r.canhBao || '').trim();
    const explanation = String(r.giaiTrinhKhacChuan || '').trim();

    if (!tCode || !validTaskCodes.has(tCode)) {
      issues.push({
        id: `b1-task-${idx}`, ruleId: 'R-B1-01', sheetKey: 'B1', sheetName: '4. B1_KhoiLuong',
        cellRef: `4. B1_KhoiLuong!A${rowNum}`, rowId: r.id, field: 'maCongViec', severity: 'fix',
        title: `MÃ CÔNG VIỆC CHƯA CÓ Ở A2: "${tCode}"`, currentValue: tCode || 'Trống',
        suggestion: 'Mã công việc phải khai báo trước tại Biểu 2. A2_CongViec.'
      });
    }

    if (!vCode || !validVtvlCodes.has(vCode)) {
      issues.push({
        id: `b1-vtvl-${idx}`, ruleId: 'R-B1-02', sheetKey: 'B1', sheetName: '4. B1_KhoiLuong',
        cellRef: `4. B1_KhoiLuong!B${rowNum}`, rowId: r.id, field: 'maVtvl', severity: 'fix',
        title: `THIẾU MÃ VTVL: Không tra cứu được VTVL của "${tCode}"`, currentValue: vCode || 'Trống',
        suggestion: 'Kiểm tra Cột C tại Biểu 2. A2_CongViec đã gán đúng Mã VTVL chuẩn chưa.'
      });
    }

    if (isNaN(qty) || qty <= 0) {
      issues.push({
        id: `b1-qty-${idx}`, ruleId: 'R-B1-03', sheetKey: 'B1', sheetName: '4. B1_KhoiLuong',
        cellRef: `4. B1_KhoiLuong!C${rowNum}`, rowId: r.id, field: 'soSpNam', severity: 'fix',
        title: `THIẾU SẢN LƯỢNG: Công việc "${tCode}" chưa có Số SP/năm`, currentValue: String(r.soSpNam || 'Trống'),
        suggestion: 'Nhập số lượng sản phẩm thực tế phát sinh trong kỳ 01/10/2025–30/9/2026.'
      });
    }

    if (isNaN(measuredMins) || measuredMins <= 0) {
      issues.push({
        id: `b1-time-${idx}`, ruleId: 'R-B1-04', sheetKey: 'B1', sheetName: '4. B1_KhoiLuong',
        cellRef: `4. B1_KhoiLuong!D${rowNum}`, rowId: r.id, field: 'phutThucTe', severity: 'fix',
        title: `THIẾU THỜI GIAN: Công việc "${tCode}" chưa có phút/SP thực tế`, currentValue: String(r.phutThucTe || 'Trống'),
        suggestion: 'Thực hiện bấm giờ đo định mức hoặc nhập thời gian thực tế đã kiểm chứng.'
      });
    }

    if (!sourceQty || sourceQty.includes('gợi ý') || sourceQty.includes('chưa đo thực tế')) {
      issues.push({
        id: `b1-source-${idx}`, ruleId: 'R-B1-05', sheetKey: 'B1', sheetName: '4. B1_KhoiLuong',
        cellRef: `4. B1_KhoiLuong!H${rowNum}`, rowId: r.id, field: 'nguon', severity: 'evidence',
        title: `Nguồn sản lượng của "${tCode}" còn dùng câu gợi ý mẫu`, currentValue: sourceQty || 'Trống',
        suggestion: 'Ghi cụ thể số hiệu văn bản, hệ thống E-Office hoặc sổ theo dõi nghiệp vụ.'
      });
    }

    // Validation rule nghiêm ngặt Cột S
    if (explanation !== '' && !explanation.startsWith('Đã xác nhận:')) {
      issues.push({
        id: `b1-exp-prefix-${idx}`, ruleId: 'R-B1-06', sheetKey: 'B1', sheetName: '4. B1_KhoiLuong',
        cellRef: `4. B1_KhoiLuong!S${rowNum}`, rowId: r.id, field: 'giaiTrinhKhacChuan', severity: 'evidence',
        title: 'CHỜ XÁC NHẬN KHÁC CHUẨN: Giải trình Cột S sai cú pháp', currentValue: explanation,
        suggestion: 'Nội dung giải trình khác chuẩn bắt buộc phải bắt đầu bằng: "Đã xác nhận: ".'
      });
    }

    // So sánh phút đo thực tế với định mức chuẩn ở 11. DM_SAN_PHAM
    const stdMins = stdMinutesMap.get(tCode);
    if (stdMins && stdMins > 0 && measuredMins > 0 && Math.abs(measuredMins - stdMins) / stdMins > 0.3 && !explanation) {
      issues.push({
        id: `b1-diff-${idx}`, ruleId: 'R-B1-07', sheetKey: 'B1', sheetName: '4. B1_KhoiLuong',
        cellRef: `4. B1_KhoiLuong!S${rowNum}`, rowId: r.id, field: 'giaiTrinhKhacChuan', severity: 'review',
        title: `Phút thực tế (${measuredMins}p) lệch > 30% so với chuẩn (${stdMins}p)`,
        currentValue: `${measuredMins}p vs ${stdMins}p`,
        suggestion: 'Cần bổ sung giải trình lý do chênh lệch lớn tại Cột S Biểu 4. B1_KhoiLuong.'
      });
    }
  });

  return issues;
}

