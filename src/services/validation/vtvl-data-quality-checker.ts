import { ExcelSheetKey, GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { ValidationIssue, ValidationReport, ValidationSummary } from './vtvl-validation-types';
import { validateA1Sheet, validateA2Sheet, validateB1Sheet } from './vtvl-core-validators';
import {
  validateC1Sheet,
  validateC3Sheet,
  validateDuBaoSheet,
  validateD1Sheet,
  validateD2Sheet
} from './vtvl-eval-validators';
import { HCMUTE_UNITS, findHcmuteUnit } from '@/configs/hcmute-units';

export function validateWorkbookData(
  data: Record<ExcelSheetKey, GenericGridRow[]>,
  unitCode: string,
  unitNameVi?: string
): ValidationReport {
  const unitInfo = findHcmuteUnit(unitCode);
  const resolvedUnitName = unitNameVi || unitInfo?.nameVi || `Đơn vị ${unitCode}`;
  const issues: ValidationIssue[] = [];

  // 1. Thu thập bộ danh mục cơ sở phục vụ đối soát chéo (Lookup sets)
  const a1Rows = data.A1 || [];
  const a2Rows = data.A2 || [];
  const b1Rows = data.B1 || [];
  const c1Rows = data.C1 || [];
  const c3Rows = data.C3 || [];
  const duBaoRows = data.DU_BAO || [];
  const d1Rows = data.D1 || [];
  const d2Rows = data.D2 || [];
  const dmSpRows = data.DM_SP || [];

  const validMissionCodes = new Set(a1Rows.map((r) => String(r.maNhiemVu || '').trim()).filter(Boolean));
  const validVtvlCodes = new Set(c1Rows.map((r) => String(r.maVtvl || '').trim()).filter(Boolean));
  const validTaskCodes = new Set(a2Rows.map((r) => String(r.maCongViec || '').trim()).filter(Boolean));

  // Bản đồ tra cứu định mức phút từ 11. DM_SAN_PHAM
  const stdMinutesMap = new Map<string, number>();
  dmSpRows.forEach((sp) => {
    const code = String(sp.maSpChuan || '').trim();
    const mins = Number(sp.phutChuan);
    if (code && !isNaN(mins) && mins > 0) stdMinutesMap.set(code, mins);
  });

  // 2. Chạy lần lượt các bộ kiểm tra chất lượng dữ liệu từng sheet
  issues.push(...validateC1Sheet(c1Rows, unitCode));
  issues.push(...validateA1Sheet(a1Rows, unitCode));
  issues.push(...validateA2Sheet(a2Rows, validMissionCodes, validVtvlCodes, unitCode));
  issues.push(...validateB1Sheet(b1Rows, validTaskCodes, validVtvlCodes, stdMinutesMap));
  issues.push(...validateC3Sheet(c3Rows, validVtvlCodes));
  issues.push(...validateDuBaoSheet(duBaoRows, validVtvlCodes));
  issues.push(...validateD1Sheet(d1Rows, validVtvlCodes));
  issues.push(...validateD2Sheet(d2Rows, validVtvlCodes));

  // 3. Kiểm soát tính toàn vẹn liên thông hệ thống (Cross-sheet System Integrity)
  if (c1Rows.length === 0) {
    issues.push({
      id: 'sys-empty-c1', ruleId: 'R-SYS-01', sheetKey: 'C1', sheetName: '3. C1_VTVL',
      cellRef: '3. C1_VTVL!A3', severity: 'fix',
      title: 'Chưa có danh mục VTVL tại Biểu 3. C1_VTVL', currentValue: '0 VTVL',
      suggestion: 'Đơn vị hoặc Quản trị viên cần nạp danh mục VTVL chuẩn theo Phụ lục I trước.'
    });
  }

  if (a1Rows.length === 0) {
    issues.push({
      id: 'sys-empty-a1', ruleId: 'R-SYS-02', sheetKey: 'A1', sheetName: '1. A1_NhiemVu',
      cellRef: '1. A1_NhiemVu!A3', severity: 'fix',
      title: 'Chưa khai báo danh mục nhiệm vụ tại Biểu 1. A1_NhiemVu', currentValue: '0 nhiệm vụ',
      suggestion: 'Khai báo chức năng, nhiệm vụ của đơn vị theo Quyết định 2266/QĐ-ĐHCNKT.'
    });
  }

  // 4. Tính toán số liệu thống kê tổng hợp (Summary Metrics)
  let fixCount = 0;
  let evidenceCount = 0;
  let reviewCount = 0;
  const countsBySheet: Record<string, number> = {};

  issues.forEach((issue) => {
    if (issue.severity === 'fix') fixCount++;
    else if (issue.severity === 'evidence') evidenceCount++;
    else reviewCount++;
    countsBySheet[issue.sheetName] = (countsBySheet[issue.sheetName] || 0) + 1;
  });

  // Điểm chất lượng dữ liệu thang 100
  // Lỗi fix trừ 5đ, lỗi evidence trừ 2đ, lỗi review trừ 0.5đ
  const penalty = fixCount * 5 + evidenceCount * 2 + reviewCount * 0.5;
  const scorePercent = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const isEligibleToSubmit = fixCount === 0;

  const summary: ValidationSummary = {
    totalIssues: issues.length,
    fixCount,
    evidenceCount,
    reviewCount,
    countsBySheet,
    isEligibleToSubmit,
    scorePercent
  };

  return {
    unitCode,
    unitName: resolvedUnitName,
    summary,
    issues,
    validatedAt: new Date().toISOString()
  };
}

