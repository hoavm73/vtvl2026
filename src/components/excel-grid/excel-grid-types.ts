export type ExcelSheetKey =
  | 'A1'
  | 'A2'
  | 'B1'
  | 'B2_CT'
  | 'B2'
  | 'C1'
  | 'C2'
  | 'C3'
  | 'D1'
  | 'D2'
  | 'DM_SP'
  | 'DU_BAO'
  | 'K'
  | 'T'
  | 'S';

export interface ExcelColumnDef {
  colLetter: string;
  field: string;
  headerName: string;
  width?: string;
  type?: 'text' | 'number' | 'select' | 'status';
  isFormula?: boolean;
  formulaHint?: string;
  selectOptions?: string[];
  dynamicOptionsKey?: 'vtvlList' | 'missionList' | 'taskList' | 'productList' | 'pl1VtvlList';
  readOnly?: boolean;
  required?: boolean;
}

export interface ExcelSheetMeta {
  key: ExcelSheetKey;
  stepNum: number;
  sheetNumberPrefix: string;
  sheetName: string;
  shortLabel: string;
  title: string;
  guideDesc: string;
  ruleHint: string;
  columns: ExcelColumnDef[];
}

export interface GenericGridRow {
  id: string;
  [key: string]: string | number | boolean | undefined;
}

export interface GridWorkbookState {
  unitCode: string;
  unitNameVi: string;
  activeSheet: ExcelSheetKey;
  data: Record<ExcelSheetKey, GenericGridRow[]>;
  lastSavedAt: string;
}

export type SheetOrderMode = 'excel' | 'technical';

/**
 * Thứ tự các sheet tự nhiên theo đúng tệp Excel gốc TCNS_HCMUTE_Bo_bieu_HD07.xlsx
 * và Trình tự 08 bước nghiệp vụ trong văn bản "04 - Huong dan dien bieu.docx".
 * Số thứ tự 1..15 trên tab khớp 100% với tiền tố tên sheet (1. A1 -> 15. S).
 */
export const EXCEL_NATURAL_SHEET_ORDER: ExcelSheetKey[] = [
  'A1',     // 1. A1_NhiemVu
  'A2',     // 2. A2_CongViec
  'C1',     // 3. C1_VTVL
  'B1',     // 4. B1_KhoiLuong
  'B2_CT',  // 5. B2_CT_TacDong
  'B2',     // 6. B2_ThayDoi
  'C2',     // 7. C2_NangLuc
  'C3',     // 8. C3_NhuCau
  'D1',     // 9. D1_NhanLuc
  'D2',     // 10. D2_PhuongAn
  'DM_SP',  // 11. DM_SAN_PHAM
  'DU_BAO', // 12. DU_BAO_5_NAM
  'K',      // 13. K_KiemTra
  'T',      // 14. T_TienDo
  'S'       // 15. S_NhatKy
];

/**
 * Thứ tự kỹ thuật phụ thuộc dữ liệu (Data Dependency) theo Bảng 12 bước tại Mục II
 * văn bản "Huong_dan_chuan_nhap_du_lieu_Bo_bieu_VTVL.docx" để công thức tự động chạy đúng:
 * DM_SP -> C1 -> A1 -> A2 -> B1 -> B2_CT -> B2 -> C2 -> D1 -> C3 -> DU_BAO -> D2.
 */
export const TECHNICAL_DEPENDENCY_ORDER: ExcelSheetKey[] = [
  'DM_SP',  // Bước 2: 11. DM_SAN_PHAM (tra cứu phút chuẩn)
  'C1',     // Bước 3: 3. C1_VTVL (nguồn tra cứu VTVL)
  'A1',     // Bước 4: 1. A1_NhiemVu (danh mục nhiệm vụ gốc)
  'A2',     // Bước 5: 2. A2_CongViec (gắn nhiệm vụ và VTVL)
  'B1',     // Bước 6: 4. B1_KhoiLuong
  'B2_CT',  // Bước 7: 5. B2_CT_TacDong
  'B2',     // Xem: 6. B2_ThayDoi (tự tính)
  'C2',     // Bước 8: 7. C2_NangLuc
  'D1',     // Bước 9: 9. D1_NhanLuc
  'C3',     // Bước 10: 8. C3_NhuCau
  'DU_BAO', // Bước 11: 12. DU_BAO_5_NAM
  'D2',     // Bước 12: 10. D2_PhuongAn
  'K',      // Bổ sung: 13. K_KiemTra
  'T',      // Bổ sung: 14. T_TienDo
  'S'       // Bổ sung: 15. S_NhatKy
];

/**
 * Danh sách 3 biểu chỉ dành cho Admin (tạm ẩn đối với người dùng thông thường):
 * 13. K_KiemTra, 14. T_TienDo, 15. S_NhatKy
 */
export const ADMIN_ONLY_SHEETS = new Set<ExcelSheetKey>(['K', 'T', 'S']);

export const WORKFLOW_SHEET_ORDER: ExcelSheetKey[] = EXCEL_NATURAL_SHEET_ORDER;

