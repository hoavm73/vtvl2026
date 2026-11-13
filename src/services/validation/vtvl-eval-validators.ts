import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { ValidationIssue } from './vtvl-validation-types';

export function validateC1Sheet(rows: GenericGridRow[], unitCode: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenCodes = new Set<string>();
  const validStatus = ['Tiếp tục sử dụng', 'Cần cập nhật', 'Đề nghị bổ sung', 'Đề nghị sửa đổi', 'Đề nghị bãi bỏ'];
  const validPersonnel = ['Viên chức', 'Hợp đồng lao động', 'Hợp đồng khoán việc', 'Thuê dịch vụ'];

  rows.forEach((r, idx) => {
    const rowNum = idx + 3;
    const vCode = String(r.maVtvl || '').trim();
    const vName = String(r.tenVtvl || '').trim();
    const status = String(r.trangThai || '').trim();
    const stdHours = Number(r.gioChuanPp2);
    const workMode = String(r.cheDoLamViec || '').trim();
    const pType = String(r.loaiNhanLuc || '').trim();

    if (!vCode) {
      issues.push({
        id: `c1-code-${idx}`, ruleId: 'R-C1-01', sheetKey: 'C1', sheetName: '3. C1_VTVL',
        cellRef: `3. C1_VTVL!A${rowNum}`, rowId: r.id, field: 'maVtvl', severity: 'fix',
        title: 'Mã VTVL không được để trống', currentValue: 'Trống',
        suggestion: `Chọn mã VTVL chuẩn theo Phụ lục I (ví dụ: ${unitCode}.HT45, ${unitCode}.QL33...).`
      });
    } else {
      if (seenCodes.has(vCode)) {
        issues.push({
          id: `c1-dup-${idx}`, ruleId: 'R-C1-02', sheetKey: 'C1', sheetName: '3. C1_VTVL',
          cellRef: `3. C1_VTVL!A${rowNum}`, rowId: r.id, field: 'maVtvl', severity: 'fix',
          title: `TRÙNG MÃ VTVL Ở C1: Mã "${vCode}" lặp lại`, currentValue: vCode,
          suggestion: 'Mỗi vị trí việc làm trong đơn vị chỉ khai đúng 1 dòng tại Biểu 3.'
        });
      }
      seenCodes.add(vCode);

      if (vCode.startsWith('XXX')) {
        issues.push({
          id: `c1-xxx-${idx}`, ruleId: 'R-C1-03', sheetKey: 'C1', sheetName: '3. C1_VTVL',
          cellRef: `3. C1_VTVL!A${rowNum}`, rowId: r.id, field: 'maVtvl', severity: 'fix',
          title: `Mã VTVL còn giữ tiền tố mẫu XXX: "${vCode}"`, currentValue: vCode,
          suggestion: `Đổi tiền tố XXX thành mã đơn vị chuẩn: ${unitCode}.`
        });
      }
    }

    if (!validStatus.includes(status)) {
      issues.push({
        id: `c1-status-${idx}`, ruleId: 'R-C1-04', sheetKey: 'C1', sheetName: '3. C1_VTVL',
        cellRef: `3. C1_VTVL!G${rowNum}`, rowId: r.id, field: 'trangThai', severity: 'fix',
        title: `Trạng thái VTVL chưa đúng chuẩn: "${status}"`, currentValue: status || 'Trống',
        suggestion: 'Chỉ chọn 1 trong: Tiếp tục sử dụng, Cần cập nhật, Đề nghị bổ sung, Đề nghị sửa đổi, Đề nghị bãi bỏ.'
      });
    }

    if (isNaN(stdHours) || stdHours <= 0) {
      issues.push({
        id: `c1-hours-${idx}`, ruleId: 'R-C1-05', sheetKey: 'C1', sheetName: '3. C1_VTVL',
        cellRef: `3. C1_VTVL!E${rowNum}`, rowId: r.id, field: 'gioChuanPp2', severity: 'fix',
        title: `THIẾU MẪU SỐ: Quỹ giờ PP2 chưa xác định cho "${vCode}"`, currentValue: String(r.gioChuanPp2 || 'Trống'),
        suggestion: 'Quỹ giờ chuẩn phổ biến là 1.904 giờ/năm (hoặc 1.760 giờ cho chế độ đặc thù).'
      });
    }

    if (pType && !validPersonnel.includes(pType)) {
      issues.push({
        id: `c1-pType-${idx}`, ruleId: 'R-C1-06', sheetKey: 'C1', sheetName: '3. C1_VTVL',
        cellRef: `3. C1_VTVL!C${rowNum}`, rowId: r.id, field: 'loaiNhanLuc', severity: 'fix',
        title: `Loại nhân lực chưa đúng chuẩn: "${pType}"`, currentValue: pType,
        suggestion: 'Chỉ chọn 1 trong: Viên chức, Hợp đồng lao động, Hợp đồng khoán việc, Thuê dịch vụ.'
      });
    }

    if (vName.toLowerCase().includes('trợ giảng') || vCode.includes('V.07.01.23')) {
      issues.push({
        id: `c1-tg-${idx}`, ruleId: 'R-TT31-TG', sheetKey: 'C1', sheetName: '3. C1_VTVL',
        cellRef: `3. C1_VTVL!B${rowNum}`, rowId: r.id, field: 'tenVtvl', severity: 'review',
        title: 'Vị trí Trợ giảng thuộc diện rà soát chuyển tiếp theo TT 31/2026', currentValue: vName,
        suggestion: 'Nếu bổ nhiệm trước 31/3/2026 và đủ chuẩn Giảng viên thì xét bổ nhiệm sang V.07.01.03.',
        legalBasis: 'Khoản 5 Điều 15 Thông tư 31/2026/TT-BGDĐT'
      });
    }
  });

  return issues;
}

export function validateC3Sheet(rows: GenericGridRow[], validVtvlCodes: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const validMethods = ['PP1', 'PP2', 'PP3', 'PP1+PP2', 'PP1+PP3', 'PP2+PP3'];

  rows.forEach((r, idx) => {
    const rowNum = idx + 3;
    const vCode = String(r.maVtvl || '').trim();
    const method = String(r.phuongPhap || '').trim();
    const netHours = Number(r.gioRong);
    const people = Number(r.nguoiCanBoTri);
    const explain = String(r.nguonGiaiTrinh || '').trim();

    if (!vCode || !validVtvlCodes.has(vCode)) {
      issues.push({
        id: `c3-vtvl-${idx}`, ruleId: 'R-C3-01', sheetKey: 'C3', sheetName: '8. C3_NhuCau',
        cellRef: `8. C3_NhuCau!A${rowNum}`, rowId: r.id, field: 'maVtvl', severity: 'fix',
        title: `MÃ VTVL CHƯA CÓ Ở C1: "${vCode}"`, currentValue: vCode || 'Trống',
        suggestion: 'Mã VTVL phải tồn tại và kích hoạt tại Biểu 3. C1_VTVL.'
      });
    }

    if (!validMethods.includes(method)) {
      issues.push({
        id: `c3-method-${idx}`, ruleId: 'R-C3-02', sheetKey: 'C3', sheetName: '8. C3_NhuCau',
        cellRef: `8. C3_NhuCau!B${rowNum}`, rowId: r.id, field: 'phuongPhap', severity: 'fix',
        title: `PHƯƠNG PHÁP KHÔNG HỢP LỆ: "${method}"`, currentValue: method || 'Trống',
        suggestion: 'Chỉ chọn một trong các phương pháp: PP1, PP2, PP3, PP1+PP2, PP1+PP3, PP2+PP3.'
      });
    }

    if (method.includes('PP2') && !isNaN(netHours) && netHours < 0) {
      issues.push({
        id: `c3-net-neg-${idx}`, ruleId: 'R-C3-03', sheetKey: 'C3', sheetName: '8. C3_NhuCau',
        cellRef: `8. C3_NhuCau!E${rowNum}`, rowId: r.id, field: 'gioRong', severity: 'fix',
        title: `GIỜ RÒNG ÂM – KIỂM TRA B2 (${netHours} giờ)`, currentValue: String(netHours),
        suggestion: 'Tổng giờ giảm do chuyển đổi số vượt quá tổng giờ công việc thực tế tại B1.'
      });
    }

    if (!explain || explain === 'a') {
      issues.push({
        id: `c3-explain-${idx}`, ruleId: 'R-C3-04', sheetKey: 'C3', sheetName: '8. C3_NhuCau',
        cellRef: `8. C3_NhuCau!K${rowNum}`, rowId: r.id, field: 'nguonGiaiTrinh', severity: 'evidence',
        title: 'THIẾU NGUỒN/GIẢI TRÌNH CĂN CỨ NHU CẦU', currentValue: explain || 'Trống',
        suggestion: 'Ghi rõ căn cứ định biên theo PP1 (QĐ 2266, PL18) hoặc kết quả đo lường PP2.'
      });
    }

    if (isNaN(people) || people <= 0) {
      issues.push({
        id: `c3-people-${idx}`, ruleId: 'R-C3-05', sheetKey: 'C3', sheetName: '8. C3_NhuCau',
        cellRef: `8. C3_NhuCau!J${rowNum}`, rowId: r.id, field: 'nguoiCanBoTri', severity: 'fix',
        title: 'CHƯA KẾT LUẬN NGƯỜI CẦN BỐ TRÍ', currentValue: String(people || 'Trống'),
        suggestion: 'Kết luận số lượng người làm việc cần bố trí (số nguyên >= 1).'
      });
    }
  });

  return issues;
}

export function validateDuBaoSheet(rows: GenericGridRow[], validVtvlCodes: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenPairs = new Set<string>();

  rows.forEach((r, idx) => {
    const rowNum = idx + 3;
    const vCode = String(r.maVtvl || '').trim();
    const year = Number(r.nam);
    const rawDiff = r.bienDong;
    const pairKey = `${vCode}-${year}`;

    if (!vCode || !validVtvlCodes.has(vCode)) {
      issues.push({
        id: `dubao-vtvl-${idx}`, ruleId: 'R-DB-01', sheetKey: 'DU_BAO', sheetName: '10. DU_BAO_5_NAM',
        cellRef: `10. DU_BAO_5_NAM!A${rowNum}`, rowId: r.id, field: 'maVtvl', severity: 'fix',
        title: `Mã VTVL chưa có ở C1: "${vCode}"`, currentValue: vCode || 'Trống',
        suggestion: 'Mã VTVL phải khớp danh mục vị trí việc làm đã ban hành.'
      });
    }

    if (isNaN(year) || year < 2027 || year > 2031 || !Number.isInteger(year)) {
      issues.push({
        id: `dubao-year-${idx}`, ruleId: 'R-DB-02', sheetKey: 'DU_BAO', sheetName: '10. DU_BAO_5_NAM',
        cellRef: `10. DU_BAO_5_NAM!B${rowNum}`, rowId: r.id, field: 'nam', severity: 'fix',
        title: `NĂM KHÔNG HỢP LỆ: "${r.nam}"`, currentValue: String(r.nam || 'Trống'),
        suggestion: 'Năm dự báo phải là số nguyên trong khoảng 2027 đến 2031.'
      });
    }

    if (vCode && year) {
      if (seenPairs.has(pairKey)) {
        issues.push({
          id: `dubao-dup-${idx}`, ruleId: 'R-DB-03', sheetKey: 'DU_BAO', sheetName: '10. DU_BAO_5_NAM',
          cellRef: `10. DU_BAO_5_NAM!A${rowNum}`, rowId: r.id, field: 'maVtvl', severity: 'fix',
          title: `TRÙNG MÃ VTVL – NĂM: Cặp (${vCode}, ${year}) lặp lại`, currentValue: pairKey,
          suggestion: 'Mỗi vị trí chỉ có duy nhất 1 dòng dự báo cho mỗi năm.'
        });
      }
      seenPairs.add(pairKey);
    }

    // Rule nghiêm ngặt: Phân biệt 0 (hợp lệ) với rỗng/null/undefined
    if (rawDiff === '' || rawDiff === null || rawDiff === undefined || isNaN(Number(rawDiff))) {
      issues.push({
        id: `dubao-diff-${idx}`, ruleId: 'R-DB-04', sheetKey: 'DU_BAO', sheetName: '10. DU_BAO_5_NAM',
        cellRef: `10. DU_BAO_5_NAM!C${rowNum}`, rowId: r.id, field: 'bienDong', severity: 'fix',
        title: 'THIẾU BIẾN ĐỘNG (NHẬP 0 NẾU KHÔNG ĐỔI)', currentValue: String(rawDiff ?? 'Trống'),
        suggestion: 'Bắt buộc nhập số nguyên biến động biên chế (+/- người). Nếu không đổi thì nhập 0.'
      });
    }
  });

  return issues;
}

export function validateD1Sheet(rows: GenericGridRow[], validVtvlCodes: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenStaff = new Set<string>();

  rows.forEach((r, idx) => {
    const rowNum = idx + 3;
    const staffId = String(r.maNguonLuc || r.hoTen || '').trim();
    const vCode = String(r.maVtvl || '').trim();
    const stdH = Number(r.gioQuyDoiNam || 1904);
    const allocatedH = Number(r.gioChoVtvl || 0);
    const otherH = Number(r.gioViecKhac || 0);

    if (staffId && seenStaff.has(staffId)) {
      issues.push({
        id: `d1-dup-${idx}`, ruleId: 'R-D1-01', sheetKey: 'D1', sheetName: '9. D1_NhanLuc',
        cellRef: `9. D1_NhanLuc!A${rowNum}`, rowId: r.id, field: 'maNguonLuc', severity: 'fix',
        title: `TRÙNG MÃ NGUỒN LỰC: Nhân sự "${staffId}" lặp lại`, currentValue: staffId,
        suggestion: 'Mỗi cá nhân chốt tại 30/9/2026 chỉ khai báo đúng 1 dòng trên biểu D1.'
      });
    }
    if (staffId) seenStaff.add(staffId);

    if (vCode && !validVtvlCodes.has(vCode)) {
      issues.push({
        id: `d1-vtvl-${idx}`, ruleId: 'R-D1-02', sheetKey: 'D1', sheetName: '9. D1_NhanLuc',
        cellRef: `9. D1_NhanLuc!B${rowNum}`, rowId: r.id, field: 'maVtvl', severity: 'fix',
        title: `Mã VTVL đảm nhận "${vCode}" không tồn tại tại C1`, currentValue: vCode,
        suggestion: 'Nhân sự phải được phân công đảm nhận một VTVL hợp lệ đã có tại C1.'
      });
    }

    if (stdH > 0 && allocatedH + otherH > stdH) {
      issues.push({
        id: `d1-hours-over-${idx}`, ruleId: 'R-D1-03', sheetKey: 'D1', sheetName: '9. D1_NhanLuc',
        cellRef: `9. D1_NhanLuc!E${rowNum}`, rowId: r.id, field: 'gioChoVtvl', severity: 'fix',
        title: `VƯỢT QUỸ GIỜ: Tổng giờ (${allocatedH + otherH}h) vượt quỹ năm (${stdH}h)`,
        currentValue: `${allocatedH + otherH}h > ${stdH}h`,
        suggestion: 'Điều chỉnh lại phân bổ giờ công việc cho phù hợp với quỹ thời gian chuẩn.'
      });
    }
  });

  return issues;
}

export function validateD2Sheet(rows: GenericGridRow[], validVtvlCodes: Set<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  rows.forEach((r, idx) => {
    const rowNum = idx + 3;
    const vCode = String(r.maVtvl || '').trim();
    const rawAdjust = r.deNghiDieuChinh;

    if (vCode && !validVtvlCodes.has(vCode)) {
      issues.push({
        id: `d2-vtvl-${idx}`, ruleId: 'R-D2-01', sheetKey: 'D2', sheetName: '11. D2_PhuongAn',
        cellRef: `11. D2_PhuongAn!A${rowNum}`, rowId: r.id, field: 'maVtvl', severity: 'fix',
        title: `Mã VTVL chưa có ở C1: "${vCode}"`, currentValue: vCode,
        suggestion: 'Phương án biên chế chỉ lập cho các vị trí việc làm có trong danh mục C1.'
      });
    }

    if (rawAdjust === '' || rawAdjust === null || rawAdjust === undefined || isNaN(Number(rawAdjust))) {
      issues.push({
        id: `d2-adjust-${idx}`, ruleId: 'R-D2-02', sheetKey: 'D2', sheetName: '11. D2_PhuongAn',
        cellRef: `11. D2_PhuongAn!G${rowNum}`, rowId: r.id, field: 'deNghiDieuChinh', severity: 'fix',
        title: 'THIẾU BIẾN ĐỘNG (NHẬP 0 NẾU KHÔNG ĐỔI)', currentValue: String(rawAdjust ?? 'Trống'),
        suggestion: 'Bắt buộc nhập số người đề nghị điều chỉnh tăng/giảm (+/- người). Nhập 0 nếu giữ nguyên.'
      });
    }
  });

  return issues;
}

