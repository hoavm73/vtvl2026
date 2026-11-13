import * as XLSX from 'xlsx';
import {
  AuditEvidenceItem,
  AuditIssue,
  AuditReportResult,
  AuditSeverity,
  AuditSheetCode,
  AuditTemplateFeedbackItem,
  AuditVtvlRecalcRow
} from '@/types/vtvl';
import { HCMUTE_UNITS } from '@/configs/hcmute-units';

export const AUDIT_RULES_CATALOG: { code: string; sheet: string; level: string; desc: string }[] = [
  { code: 'R-TEP-*', sheet: 'Toàn bộ tệp', level: 'Phải sửa', desc: 'Kiểm tra đủ 10 trang tính bắt buộc (A1, A2, B1, B2_CT, B2, C1, C2, C3, D1, D2) và cấu trúc cột chuẩn Hướng dẫn 07-HD/BTCTW.' },
  { code: 'R-TT31-40', sheet: '2. A2_CongViec', level: 'Phải sửa', desc: 'Kiểm tra căn cứ pháp lý không còn dẫn chiếu các điều khoản đã hết hiệu lực của TT 40/2020 theo khoản 2 Điều 17 Thông tư số 31/2026/TT-BGDĐT.' },
  { code: 'R-ND232-BAC', sheet: '3. C1 & 7. C2', level: 'Nên xem lại', desc: 'Kiểm tra Bậc nghề nghiệp (Bậc 1–5) nằm trong giới hạn Phụ lục I văn bản 1907/HD-ĐHCNKT và Nghị định 232/2026/NĐ-CP.' },
  { code: 'R-B1-SL / TG', sheet: '4. B1_KhoiLuong', level: 'Phải sửa', desc: 'Kiểm tra Số sản phẩm/năm (Cột C) và Trung bình phút/SP (Cột D) phải lớn hơn 0 đối với mọi đầu việc tính theo PP2.' },
  { code: 'R-B1-NGUON', sheet: '4. B1 & Can_cu_goi_y', level: 'Chưa đủ căn cứ', desc: 'Phát hiện các dòng còn giữ nguyên số phút gợi ý ở ô màu cam ("mức tham khảo, chưa đo thực tế") hoặc thiếu nguồn văn bản E-Office.' },
  { code: 'R-B1-LECH', sheet: '4. B1_KhoiLuong', level: 'Nên xem lại', desc: 'Kiểm tra trường hợp Phút/SP thực tế lệch trên 30% so với định mức chuẩn ở 11. DM_SAN_PHAM nhưng chưa ghi giải trình tại Cột S.' },
  { code: 'R-D1-TRUNG / GIO', sheet: '9. D1_NhanLuc', level: 'Phải sửa', desc: 'Kiểm tra không khai trùng Mã nguồn lực giữa các vị trí và tổng giờ phân bổ không vượt quỹ giờ chuẩn năm (1.760h hoặc 1.904h).' },
  { code: 'R-TT31-TG', sheet: '3. C1 & 9. D1', level: 'Nên xem lại', desc: 'Rà soát diện chuyển tiếp chức danh Trợ giảng (V.07.01.23) sang Giảng viên (V.07.01.03) theo khoản 5 Điều 15 Thông tư 31/2026/TT-BGDĐT.' }
];

export async function auditUnitWorkbooks(files: File[], isSampleDemo = false): Promise<AuditReportResult> {
  const issues: AuditIssue[] = [];
  const unitSummaries: AuditReportResult['unitSummaries'] = [];
  const vtvlRecalcRows: AuditVtvlRecalcRow[] = [];
  const evidenceItems: AuditEvidenceItem[] = [];
  const templateFeedbackItems: AuditTemplateFeedbackItem[] = [];

  for (const file of files) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });

    const nameMatch = /^([A-Za-z0-9-]+)_K2526_(?:DuThao_GoiY_)?(v\d+)_(\d{8})\.xlsx$/i.exec(file.name);
    const unitCode = nameMatch ? nameMatch[1].toUpperCase() : file.name.split('_')[0].toUpperCase();
    const version = nameMatch ? nameMatch[2] : 'v1';
    const unitInfo = HCMUTE_UNITS.find((u) => u.code === unitCode);
    const unitName = unitInfo ? unitInfo.nameVi : `Đơn vị giả định ${unitCode}`;

    let fileFix = 0; let fileEvidence = 0; let fileReview = 0;

    const pushIssue = (ruleId: string, sheet: AuditSheetCode, cellRef: string, severity: AuditSeverity, title: string, currentValue: string, suggestion: string) => {
      if (severity === 'fix') fileFix++;
      else if (severity === 'evidence') fileEvidence++;
      else fileReview++;
      issues.push({
        id: `${file.name}-${ruleId}-${cellRef}-${issues.length}`,
        ruleId, fileName: file.name, unitCode, sheet, cellRef, severity, title, currentValue, suggestion
      });
    };

    const requiredPrefixes: { code: AuditSheetCode; match: string; desc: string }[] = [
      { code: 'A1', match: 'A1', desc: '1. A1_NhiemVu' }, { code: 'A2', match: 'A2', desc: '2. A2_CongViec' },
      { code: 'C1', match: 'C1', desc: '3. C1_VTVL' }, { code: 'B1', match: 'B1', desc: '4. B1_KhoiLuong' },
      { code: 'B2_CT', match: 'B2_CT', desc: '5. B2_CT_TacDong' }, { code: 'B2', match: 'B2_ThayDoi', desc: '6. B2_ThayDoi' },
      { code: 'C2', match: 'C2', desc: '7. C2_NangLuc' }, { code: 'C3', match: 'C3', desc: '8. C3_NhuCau' },
      { code: 'D1', match: 'D1', desc: '9. D1_NhanLuc' }, { code: 'D2', match: 'D2', desc: '11. D2_PhuongAn' }
    ];

    for (const req of requiredPrefixes) {
      const found = wb.SheetNames.some((s) => s.includes(req.match) || (req.code === 'B2' && s.includes('B2')));
      if (!found) pushIssue(`R-TEP-${req.code}`, 'Tệp', 'Workbook', 'fix', `Thiếu trang tính bắt buộc: ${req.desc}`, `Không tìm thấy ${req.match}`, 'Khởi tạo lại tệp đơn vị tại Bước 2.');
    }

    const a2Name = wb.SheetNames.find((s) => s.includes('A2'));
    const taskNameByCode = new Map<string, string>();
    if (a2Name) {
      const a2Rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[a2Name], { header: 1, defval: '' });
      for (let r = 2; r < a2Rows.length; r++) {
        const tCode = String(a2Rows[r][0] || '').trim();
        const tName = String(a2Rows[r][3] || tCode).trim();
        if (tCode) taskNameByCode.set(tCode, tName);
        const basis = String(a2Rows[r][7] || '').trim();
        if (/(40\/2020\/TT-BGDĐT|35\/2020\/TT-BGDĐT|07\/2023\/TT-BLĐTBXH|10\/2024\/TT-BLĐTBXH)/i.test(basis)) {
          pushIssue('R-TT31-40', 'A2', `A2_CongViec!H${r + 1}`, 'fix', 'Căn cứ pháp lý còn dẫn chiếu Thông tư cũ đã hết hiệu lực theo khoản 2 Điều 17 TT 31/2026/TT-BGDĐT', basis, 'Thay bằng: Nghị định số 232/2026/NĐ-CP & Thông tư số 31/2026/TT-BGDĐT.');
        }
      }
    }

    const c2Name = wb.SheetNames.find((s) => s.includes('C2'));
    if (c2Name) {
      const c2Rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[c2Name], { header: 1, defval: '' });
      for (let r = 2; r < c2Rows.length; r++) {
        const vCode = String(c2Rows[r][0] || '').trim();
        const competency = String(c2Rows[r][3] || '').trim();
        if (vCode && !/(bậc\s*[1-5]|cấp độ\s*[1-5]|đáp ứng năng lực|phụ lục\s*i|không áp dụng bậc)/i.test(competency)) {
          pushIssue('R-ND232-BAC', 'C2', `C2_NangLuc!D${r + 1}`, 'review', `Khung năng lực của "${vCode}" chưa ghi rõ Bậc nghề nghiệp (Bậc 1–5) theo NĐ 232/2026/NĐ-CP`, competency || 'Trống', 'Ghi rõ Bậc nghề nghiệp theo Phụ lục I văn bản 1907/HD-ĐHCNKT.');
        }
      }
    }

    const c1Name = wb.SheetNames.find((s) => s.includes('C1'));
    const validVtvlSet = new Set<string>();
    const vtvlMetaMap = new Map<string, { name: string; level: string; stdHours: number }>();
    if (c1Name) {
      const c1Rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[c1Name], { header: 1, defval: '' });
      for (let r = 2; r < c1Rows.length; r++) {
        const row = c1Rows[r];
        const vCode = String(row[0] || '').trim();
        const vName = String(row[1] || '').trim();
        if (!vCode) continue;
        validVtvlSet.add(vCode);
        const stdHours = Number(row[4] || row[11] || 1904);
        const levelMatch = vName.match(/Bậc\s*[1-5](?:,\s*Bậc\s*[1-5])*/i);
        const levelText = levelMatch ? levelMatch[0] : vCode.includes('QL') ? 'Không áp dụng bậc' : 'Bậc 3';
        vtvlMetaMap.set(vCode, { name: vName, level: levelText, stdHours });
        const excelRow = r + 1;
        if (vCode.startsWith('XXX')) pushIssue('R-C1-01', 'C1', `C1_VTVL!A${excelRow}`, 'fix', 'Mã VTVL tại C1_VTVL còn giữ tiền tố mẫu XXX', vCode, `Đổi tiền tố XXX thành ${unitCode}.`);
        if (vName.toLowerCase().includes('trợ giảng') || vCode.includes('V.07.01.23')) {
          pushIssue('R-TT31-TG', 'C1', `C1_VTVL!B${excelRow}`, 'review', 'Vị trí Trợ giảng (V.07.01.23) thuộc diện rà soát chuyển tiếp theo khoản 5 Điều 15 TT 31/2026/TT-BGDĐT', vName, 'Nếu bổ nhiệm trước 31/3/2026 và đủ chuẩn Giảng viên (V.07.01.03) thì xét bổ nhiệm sang V.07.01.03.');
        }
      }
    }

    // Tự tính lại Giờ B1 theo từng VTVL từ các cột nhập liệu (Cột C × Cột D / 60 + Cột E)
    const b1Name = wb.SheetNames.find((s) => s.includes('B1'));
    let taskCount = 0;
    const recalcB1ByVtvl = new Map<string, { taskCount: number; hours: number }>();
    if (b1Name) {
      const b1Rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[b1Name], { header: 1, defval: '' });
      const isHd07 = String(b1Rows[1]?.[0] || '').includes('Mã công việc');
      for (let r = 2; r < b1Rows.length; r++) {
        const row = b1Rows[r];
        const taskCode = String(isHd07 ? row[0] : row[3] || '').trim();
        const vtvlCode = String(row[1] || '').trim();
        if (!taskCode && !vtvlCode) continue;
        taskCount++;
        const excelRow = r + 1;
        const qty = Number(isHd07 ? row[2] : row[8]);
        const measuredMin = Number(isHd07 ? row[3] : row[10] || row[11]);
        const extraH = Number(isHd07 ? row[4] : 0);
        const sourceQty = String(isHd07 ? row[7] : row[9] || '').trim();
        const sourceTime = String(isHd07 ? row[8] : '').trim();
        const stdMin = Number(isHd07 ? row[13] : row[15] || measuredMin);
        const explanationColS = String(isHd07 ? row[18] : '').trim();

        if (qty > 0 && measuredMin > 0 && vtvlCode) {
          const h = (qty * measuredMin) / 60 + extraH;
          const prev = recalcB1ByVtvl.get(vtvlCode) || { taskCount: 0, hours: 0 };
          recalcB1ByVtvl.set(vtvlCode, { taskCount: prev.taskCount + 1, hours: Number((prev.hours + h).toFixed(1)) });
        }

        if (!qty || qty <= 0) pushIssue('R-B1-SL', 'B1', `B1_KhoiLuong!C${excelRow}`, 'fix', `THIẾU SẢN LƯỢNG: Công việc "${taskCode}" chưa có Số SP/năm (Cột C)`, String(qty || 'Trống'), 'Nhập số lượng sản phẩm thực tế phát sinh trong kỳ thống kê.');
        if (!measuredMin || measuredMin <= 0) pushIssue('R-B1-TG', 'B1', `B1_KhoiLuong!D${excelRow}`, 'fix', `THIẾU THỜI GIAN: Công việc "${taskCode}" chưa có Trung bình phút/SP (Cột D)`, String(measuredMin || 'Trống'), 'Đo tại trang Bấm giờ công việc hoặc nhập định mức Phút/SP hợp lệ.');
        if (!sourceQty || sourceQty.includes('gợi ý') || sourceTime.includes('chờ nạp phiếu đo') || sourceTime.includes('chưa đo thực tế')) {
          const msg = `Nguồn sản lượng/thời gian của "${taskCode}" còn dùng câu gợi ý mẫu (ô cam chưa đo thực tế)`;
          pushIssue('R-B1-NGUON', 'B1', `B1_KhoiLuong!H${excelRow}`, 'evidence', msg, sourceQty || sourceTime || 'Trống', 'Nạp phiếu khảo sát ở Bước 4 hoặc ghi rõ số văn bản/hệ thống E-Office.');
          evidenceItems.push({
            unitCode, fileName: file.name, sheet: 'B1', cellRef: `B1_KhoiLuong!H${excelRow}`,
            refCode: taskCode, taskOrPositionName: taskNameByCode.get(taskCode) || taskCode,
            currentSourceText: sourceTime || sourceQty || 'Giữ nguyên ô cam gợi ý – chưa đo thực tế',
            reasonHint: 'Chưa nộp phiếu đo thời gian thực tế (3–5 lần đo) hoặc chưa ghi số sổ sách E-Office'
          });
        }
        if (stdMin > 0 && measuredMin > 0 && Math.abs(measuredMin - stdMin) / stdMin > 0.3 && !explanationColS) {
          pushIssue('R-B1-LECH', 'B1', `B1_KhoiLuong!S${excelRow}`, 'review', `Phút/SP thực tế (${measuredMin}p) lệch trên 30% so với Phút/SP chuẩn (${stdMin}p) nhưng chưa ghi Giải trình (Cột S)`, `${measuredMin}p vs ${stdMin}p`, 'Ghi rõ nguyên nhân đặc thù tại Cột S biểu B1_KhoiLuong.');
        }
      }
    }

    const d1Name = wb.SheetNames.find((s) => s.includes('D1'));
    let staffCount = 0;
    const d1StaffByVtvl = new Map<string, number>();
    if (d1Name) {
      const d1Rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[d1Name], { header: 1, defval: '' });
      const seenStaffIds = new Set<string>();
      for (let r = 2; r < d1Rows.length; r++) {
        const row = d1Rows[r];
        const sid = String(row[0] || row[1] || '').trim();
        const vCode = String(row[1] || '').trim();
        if (!sid) continue;
        staffCount++;
        if (vCode) d1StaffByVtvl.set(vCode, (d1StaffByVtvl.get(vCode) || 0) + 1);
        const excelRow = r + 1;
        if (seenStaffIds.has(sid)) pushIssue('R-D1-TRUNG', 'D1', `D1_NhanLuc!A${excelRow}`, 'fix', `TRÙNG MÃ NGUỒN LỰC: Mã "${sid}" lặp lại nhiều dòng trên biểu 9. D1_NhanLuc`, sid, 'Mỗi cá nhân chốt tại 30/9/2026 chỉ khai 1 dòng duy nhất.');
        seenStaffIds.add(sid);
        const stdH = Number(row[3] || 1904); const vtvlH = Number(row[4] || 0); const otherH = Number(row[5] || 0);
        if (stdH > 0 && vtvlH + otherH > stdH) pushIssue('R-D1-VUOTGIO', 'D1', `D1_NhanLuc!E${excelRow}`, 'fix', `VƯỢT QUỸ GIỜ: Tổng giờ (${vtvlH + otherH}h) của "${sid}" vượt quỹ giờ năm (${stdH}h)`, `${vtvlH + otherH}h > ${stdH}h`, 'Điều chỉnh lại phân bổ giờ thực tế.');
      }
    }

    const c3Name = wb.SheetNames.find((s) => s.includes('C3'));
    let proposedFte = 0;
    if (c3Name) {
      const c3Rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[c3Name], { header: 1, defval: '' });
      const isC3Hd07 = String(c3Rows[1]?.[1] || '').includes('Phương pháp');
      for (let r = 2; r < c3Rows.length; r++) {
        const row = c3Rows[r];
        const vCode = String(row[0] || '').trim();
        if (!vCode) continue;
        const vName = String((isC3Hd07 ? vtvlMetaMap.get(vCode)?.name : row[1]) || vtvlMetaMap.get(vCode)?.name || vCode).trim();
        const method = String((isC3Hd07 ? row[1] : row[2]) || 'PP2').trim();
        const b2Delta = Number((isC3Hd07 ? row[3] : row[5]) || 0);
        const stdH = Number((isC3Hd07 ? row[5] : row[7]) || vtvlMetaMap.get(vCode)?.stdHours || 1904);
        const c3Fte = Number(row[9] || 0);
        proposedFte += c3Fte;

        const recalcB1 = recalcB1ByVtvl.get(vCode) || { taskCount: 0, hours: Number((isC3Hd07 ? row[2] : row[4]) || 0) };
        const netH = Number(Math.max(0, recalcB1.hours + b2Delta).toFixed(1));
        const recalcPp2 = stdH > 0 ? Number((netH / stdH).toFixed(2)) : 0;

        vtvlRecalcRows.push({
          unitCode, vtvlCode: vCode, vtvlName: vName,
          careerLevel: vtvlMetaMap.get(vCode)?.level || 'Bậc 3',
          method, standardHours: stdH, taskCount: recalcB1.taskCount,
          recalcB1Hours: recalcB1.hours, b2DeltaHours: b2Delta, recalcNetHours: netH,
          recalcPp2Fte: recalcPp2, c3ProposedFte: c3Fte,
          d1CurrentStaff: d1StaffByVtvl.get(vCode) || 0,
          hasData: recalcB1.hours > 0 || c3Fte > 0
        });
      }
    }

    // Ghi nhận thông tin Góp ý biểu mẫu (Tab 4: Lỗi của biểu mẫu, không tính là lỗi của đơn vị)
    templateFeedbackItems.push(
      {
        unitCode,
        sheet: '8. C3_NhuCau',
        cellOrColumn: 'Cột I (Người quy đổi PP2)',
        templateIssue: 'Trong biểu mẫu gốc, các vị trí kết hợp PP1+PP2 vẫn lấy tròn hệ số định mức mà chưa tự động tách phần giờ hành chính phát sinh.',
        unitFeedbackSuggestion: 'Đề xuất bổ sung cột tách riêng tỷ trọng định mức PP1 và giờ thực tế PP2 đối với Trưởng/Phó đơn vị kiêm giảng dạy.'
      },
      {
        unitCode,
        sheet: '11. DM_SAN_PHAM',
        cellOrColumn: 'Nhóm II & Nhóm V',
        templateIssue: 'Danh mục sản phẩm mẫu chưa tách riêng định mức giờ chuẩn cho học phần giảng dạy bằng tiếng Anh / dự án doanh nghiệp tại HCM-UTE.',
        unitFeedbackSuggestion: 'Kiến nghị bổ sung mã sản phẩm chuẩn đặc thù đào tạo kỹ thuật thực hành và đồ án liên ngành vào Phụ lục danh mục sản phẩm.'
      }
    );

    unitSummaries.push({
      fileName: file.name, unitCode, unitName, version,
      vtvlCount: validVtvlSet.size, taskCount, staffCount,
      proposedFte: Number(proposedFte.toFixed(2)),
      fixCount: fileFix, evidenceCount: fileEvidence, reviewCount: fileReview
    });
  }

  const countsBySeverity: Record<AuditSeverity, number> = {
    fix: issues.filter((i) => i.severity === 'fix').length,
    evidence: issues.filter((i) => i.severity === 'evidence').length,
    review: issues.filter((i) => i.severity === 'review').length
  };
  const countsBySheet: Record<string, number> = {};
  issues.forEach((i) => { countsBySheet[i.sheet] = (countsBySheet[i.sheet] || 0) + 1; });

  return {
    filesCount: files.length, isSampleDemo, totalIssues: issues.length,
    countsBySeverity, countsBySheet, unitSummaries, issues,
    vtvlRecalcRows, evidenceItems, templateFeedbackItems
  };
}

export function exportAuditReportToExcel(report: AuditReportResult, defaultUnitCode: string): void {
  const wb = XLSX.utils.book_new();
  const sevLabel: Record<AuditSeverity, string> = { fix: 'Phải sửa', evidence: 'Cần bổ sung căn cứ', review: 'Nên xem lại' };

  const wsIssues = XLSX.utils.aoa_to_sheet([
    [`BÁO CÁO KẾT QUẢ RÀ SOÁT BỘ BIỂU VỊ TRÍ VIỆC LÀM — ĐƠN VỊ: [${defaultUnitCode}]`],
    ['Mã đơn vị', 'Tên tệp', 'Mã quy tắc', 'Biểu', 'Tọa độ ô', 'Mức độ', 'Nội dung phát hiện', 'Giá trị hiện tại', 'Hướng dẫn hoàn thiện'],
    ...report.issues.map((i) => [i.unitCode, i.fileName, i.ruleId, i.sheet, i.cellRef, sevLabel[i.severity], i.title, i.currentValue, i.suggestion])
  ]);
  XLSX.utils.book_append_sheet(wb, wsIssues, 'Can_xu_ly');

  const wsVtvl = XLSX.utils.aoa_to_sheet([
    ['BẢNG TỔNG HỢP VTVL TỰ TÍNH LẠI (SO SÁNH NGƯỜI QUY ĐỔI PP2 — NGƯỜI CẦN BỐ TRÍ C3 — NHÂN SỰ HIỆN CÓ D1)'],
    ['Mã ĐV', 'Mã VTVL', 'Tên VTVL cụ thể', 'Bậc nghề nghiệp', 'Phương pháp', 'Quỹ giờ chuẩn', 'Số việc B1', 'Giờ B1 tự tính lại', 'Giờ giảm B2', 'Giờ ròng', 'Người quy đổi PP2 (tự tính)', 'Người cần bố trí (C3)', 'Nhân sự hiện có (D1)'],
    ...report.vtvlRecalcRows.map((r) => [r.unitCode, r.vtvlCode, r.vtvlName, r.careerLevel, r.method, r.standardHours, r.taskCount, r.recalcB1Hours, r.b2DeltaHours, r.recalcNetHours, r.recalcPp2Fte, r.c3ProposedFte, r.d1CurrentStaff])
  ]);
  XLSX.utils.book_append_sheet(wb, wsVtvl, 'Tong_hop_VTVL');

  // Trang Chua_du_can_cu với các cột trống để đơn vị điền nguyên nhân, thời hạn bổ sung và đầu mối
  const wsEvidence = XLSX.utils.aoa_to_sheet([
    ['DANH SÁCH NỘI DUNG CHƯA ĐỦ CĂN CỨ (ĐƠN VỊ ĐIỀN NGUYÊN NHÂN, THỜI HẠN BỔ SUNG VÀ ĐẦU MỐI ĐỂ NỘP KÈM HỒ SƠ)'],
    ['Mã đơn vị', 'Biểu', 'Tọa độ ô', 'Mã công việc / VTVL', 'Tên công việc / Vị trí', 'Nguồn đang ghi trong tệp (ô cam / mẫu)', 'Nguyên nhân chưa đủ căn cứ (Đơn vị điền)', 'Thời hạn bổ sung (Đơn vị điền)', 'Đầu mối phụ trách (Đơn vị điền)'],
    ...report.evidenceItems.map((e) => [e.unitCode, e.sheet, e.cellRef, e.refCode, e.taskOrPositionName, e.currentSourceText, e.reasonHint, '', ''])
  ]);
  XLSX.utils.book_append_sheet(wb, wsEvidence, 'Chua_du_can_cu');

  const wsTemplate = XLSX.utils.aoa_to_sheet([
    ['TRANG GOP_Y_BIEU_MAU — CÁC VẤN ĐỀ CỦA BIỂU MẪU GỐC (KHÔNG TÍNH LÀ LỖI CỦA ĐƠN VỊ — DÙNG ĐỂ CHÉP VÀO Y_KIEN_DON_VI)'],
    ['Mã đơn vị', 'Biểu mẫu', 'Cột / Ô tham chiếu', 'Mô tả bất cập của biểu mẫu gốc', 'Nội dung kiến nghị / góp ý của đơn vị'],
    ...report.templateFeedbackItems.map((t) => [t.unitCode, t.sheet, t.cellOrColumn, t.templateIssue, t.unitFeedbackSuggestion])
  ]);
  XLSX.utils.book_append_sheet(wb, wsTemplate, 'Gop_y_bieu_mau');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ket_Qua_Ra_Soat_9_Bieu_${defaultUnitCode}_20261107.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
