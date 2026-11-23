export type A1ImportParsedRowStatus = 'new' | 'duplicate' | 'unchanged' | 'conflict' | 'error';

export interface A1ImportRowError {
  excelRow: number;
  colLetter: string;
  field: string;
  maNhiemVu: string;
  message: string;
}

export interface A1ImportConflictRow {
  excelRow: number;
  maNhiemVu: string;
  differingFields: string[];
}

export interface A1ImportCandidateRow {
  excelRow: number;
  maNhiemVu: string;
  assignedCode: string;
  tenNhiemVu: string;
  coQuan: string;
  canCu: string;
  ky: string;
  trangThai: string;
  nguon: string;
}

export interface A1ImportDuplicateContentRow {
  excelRow: number;
  matchReason: 'exact' | 'same_name';
  incoming: A1ImportCandidateRow;
  existing: {
    maNhiemVu: string;
    tenNhiemVu: string;
    coQuan: string;
    canCu: string;
    ky: string;
    trangThai: string;
    nguon: string;
  };
}

export interface A1ImportParsedRow {
  excelRow: number;
  status: A1ImportParsedRowStatus;
  maNhiemVu: string;
  assignedCode: string;
  tenNhiemVu: string;
  coQuan: string;
  canCu: string;
  ky: string;
  trangThai: string;
  nguon: string;
  existingCode?: string;
  existingTenNhiemVu?: string;
  messages?: string[];
}

export interface A1ImportPreviewResult {
  ok: boolean;
  sheetFound: boolean;
  fatalError?: string;
  summary: {
    totalRead: number;
    newCount: number;
    unchangedCount: number;
    duplicateContentCount: number;
    conflictCount: number;
    errorCount: number;
  };
  parsedRows: A1ImportParsedRow[];
  newRows: A1ImportCandidateRow[];
  duplicateContentRows: A1ImportDuplicateContentRow[];
  unchangedRows: { excelRow: number; maNhiemVu: string }[];
  conflictRows: A1ImportConflictRow[];
  errorRows: A1ImportRowError[];
}
