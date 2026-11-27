import * as XLSX from 'xlsx';
import { StaffWorkTicket } from '@/types/staff-ticket';

export interface UnitAccountLite {
  email: string;
  displayName: string;
  role: string;
  unitCode: string;
}

export interface ParsedA2TicketRow {
  rowIndex: number;
  maCongViec: string;
  maNhiemVu: string;
  maVtvl: string;
  tenCongViec: string;
  sanPham: string;
  dvt: string;
  chatLuong: string;
  canCu: string;
  maVtvlPhoiHop: string;
  rawOwner: string;
  ownerEmail: string;
  soSpNam: number;
  phutThucTe: number;
  gioBoSung: number;
  nguonSoLieu: string;
  isDuplicate: boolean;
  duplicateCode?: string;
  errors: string[];
}

export interface A2TicketParseResult {
  sheetName: string;
  rows: ParsedA2TicketRow[];
  error?: string;
}

function normHeader(val: unknown): string {
  return String(val ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normText(val: unknown): string {
  return String(val ?? '').trim();
}

function normCompare(val: unknown): string {
  return normText(val).toLowerCase().replace(/\s+/g, ' ');
}

function toNum(val: unknown): number {
  const n = Number(String(val ?? '').replace(/,/g, '.').trim());
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function matchAccountEmail(rawOwner: string, accounts: UnitAccountLite[]): string {
  const clean = normText(rawOwner);
  if (!clean) return '';
  const lower = clean.toLowerCase();
  const byEmail = accounts.find((a) => a.email.toLowerCase() === lower);
  if (byEmail) return byEmail.email;
  const emailInParens = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailInParens) {
    const found = accounts.find((a) => a.email.toLowerCase() === emailInParens[0].toLowerCase());
    if (found) return found.email;
  }
  const cleanNorm = normHeader(clean);
  if (!cleanNorm) return '';
  const byName = accounts.find((a) => normHeader(a.displayName) === cleanNorm);
  return byName ? byName.email : '';
}

function detectHeaderRow(matrix: unknown[][]): { headerIdx: number; colMap: Record<string, number> } | null {
  const limit = Math.min(matrix.length, 15);
  for (let r = 0; r < limit; r++) {
    const row = matrix[r] || [];
    const colMap: Record<string, number> = {};
    row.forEach((cell, c) => {
      const h = normHeader(cell);
      if (!h) return;
      if (colMap.maCongViec === undefined && (h.includes('ma cong viec') || h === 'ma cv')) colMap.maCongViec = c;
      else if (colMap.maNhiemVu === undefined && (h.includes('ma nhiem vu') || h === 'ma nv')) colMap.maNhiemVu = c;
      else if (colMap.maVtvlPhoiHop === undefined && h.includes('phoi hop')) colMap.maVtvlPhoiHop = c;
      else if (colMap.maVtvl === undefined && (h.includes('ma vtvl') || h.includes('vi tri viec lam'))) colMap.maVtvl = c;
      else if (colMap.tenCongViec === undefined && (h.includes('ten cong viec') || h === 'cong viec')) colMap.tenCongViec = c;
      else if (colMap.sanPham === undefined && h.includes('san pham')) colMap.sanPham = c;
      else if (colMap.dvt === undefined && (h.includes('don vi tinh') || h === 'dvt')) colMap.dvt = c;
      else if (colMap.chatLuong === undefined && h.includes('chat luong')) colMap.chatLuong = c;
      else if (colMap.canCu === undefined && h.includes('can cu')) colMap.canCu = c;
      else if (colMap.owner === undefined && (h.includes('email') || h.includes('nguoi lap') || h.includes('nguoi thuc hien') || h.includes('can bo'))) colMap.owner = c;
      else if (colMap.soSpNam === undefined && (h.includes('so sp') || h.includes('san luong'))) colMap.soSpNam = c;
      else if (colMap.phutThucTe === undefined && (h.includes('phut') || h.includes('dinh muc'))) colMap.phutThucTe = c;
      else if (colMap.gioBoSung === undefined && h.includes('gio bo sung')) colMap.gioBoSung = c;
      else if (colMap.nguonSoLieu === undefined && h.includes('nguon so lieu')) colMap.nguonSoLieu = c;
    });
    if (colMap.maNhiemVu !== undefined && colMap.tenCongViec !== undefined) {
      return { headerIdx: r, colMap };
    }
  }
  return null;
}

export function parseA2TicketExcelBuffer(
  buffer: ArrayBuffer,
  unitAccounts: UnitAccountLite[],
  existingTickets: StaffWorkTicket[]
): A2TicketParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames.length) {
    return { sheetName: '', rows: [], error: 'Tệp Excel không có sheet dữ liệu.' };
  }
  const preferredSheet =
    wb.SheetNames.find((n) => /a2/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[preferredSheet];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  const detected = detectHeaderRow(matrix);
  if (!detected) {
    return {
      sheetName: preferredSheet,
      rows: [],
      error: `Không tìm thấy dòng tiêu đề chuẩn A2_CongViec (cần có cột "Mã nhiệm vụ" và "Tên công việc") trong sheet "${preferredSheet}".`
    };
  }

  const { headerIdx, colMap } = detected;
  const rows: ParsedA2TicketRow[] = [];

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const raw = matrix[r] || [];
    const maCongViec = colMap.maCongViec !== undefined ? normText(raw[colMap.maCongViec]) : '';
    const maNhiemVu = colMap.maNhiemVu !== undefined ? normText(raw[colMap.maNhiemVu]).toUpperCase() : '';
    const maVtvl = colMap.maVtvl !== undefined ? normText(raw[colMap.maVtvl]).toUpperCase() : '';
    const tenCongViec = colMap.tenCongViec !== undefined ? normText(raw[colMap.tenCongViec]) : '';
    const sanPham = colMap.sanPham !== undefined ? normText(raw[colMap.sanPham]) : '';
    const dvt = colMap.dvt !== undefined ? normText(raw[colMap.dvt]) : '';
    const chatLuong = colMap.chatLuong !== undefined ? normText(raw[colMap.chatLuong]) : '';
    const canCu = colMap.canCu !== undefined ? normText(raw[colMap.canCu]) : '';
    const maVtvlPhoiHop = colMap.maVtvlPhoiHop !== undefined ? normText(raw[colMap.maVtvlPhoiHop]).toUpperCase() : '';
    const rawOwner = colMap.owner !== undefined ? normText(raw[colMap.owner]) : '';
    const soSpNam = colMap.soSpNam !== undefined ? toNum(raw[colMap.soSpNam]) : 0;
    const phutThucTe = colMap.phutThucTe !== undefined ? toNum(raw[colMap.phutThucTe]) : 0;
    const gioBoSung = colMap.gioBoSung !== undefined ? toNum(raw[colMap.gioBoSung]) : 0;
    const nguonSoLieu = colMap.nguonSoLieu !== undefined ? normText(raw[colMap.nguonSoLieu]) : '';

    if (!maNhiemVu && !maVtvl && !tenCongViec && !sanPham) continue;

    const ownerEmail = matchAccountEmail(rawOwner, unitAccounts);
    const errors: string[] = [];
    if (!maNhiemVu) errors.push('Thiếu Mã nhiệm vụ (A1)');
    if (!maVtvl) errors.push('Thiếu Mã VTVL (C1)');
    if (!tenCongViec) errors.push('Thiếu Tên công việc');

    const dup = existingTickets.find(
      (t) =>
        normCompare(t.maNhiemVu) === normCompare(maNhiemVu) &&
        normCompare(t.tenCongViec) === normCompare(tenCongViec) &&
        (!ownerEmail || normCompare(t.ownerEmail) === normCompare(ownerEmail))
    );

    rows.push({
      rowIndex: r + 1,
      maCongViec,
      maNhiemVu,
      maVtvl,
      tenCongViec,
      sanPham,
      dvt,
      chatLuong,
      canCu,
      maVtvlPhoiHop,
      rawOwner,
      ownerEmail,
      soSpNam,
      phutThucTe,
      gioBoSung,
      nguonSoLieu,
      isDuplicate: Boolean(dup),
      duplicateCode: dup?.maCongViec,
      errors
    });
  }

  return { sheetName: preferredSheet, rows };
}

export function downloadA2TicketTemplate(unitCode: string, unitNameVi: string): string {
  const headers = [
    'Mã công việc ([NV].CVxx)',
    'Mã nhiệm vụ (A1)',
    'Mã VTVL (từ C1)',
    'Tên công việc cụ thể',
    'Sản phẩm đầu ra',
    'Đơn vị tính',
    'Yêu cầu chất lượng',
    'Căn cứ (nguồn tài liệu)',
    'Mã VTVL phối hợp',
    'Email cán bộ (@hcmute.edu.vn)',
    'Số SP/năm',
    'Phút/SP',
    'Giờ bổ sung',
    'Nguồn số liệu'
  ];
  const sampleRow = [
    '',
    `${unitCode}.NV01`,
    `${unitCode}.CM63`,
    'Ví dụ: Tổng hợp báo cáo định kỳ của đơn vị',
    'Báo cáo tổng hợp đã phê duyệt',
    'Báo cáo',
    'Đúng hạn, đủ số liệu kiểm chứng',
    'QĐ 2266/QĐ-ĐHCNKT',
    '',
    'canbo@hcmute.edu.vn',
    12,
    60,
    0,
    'Sổ theo dõi công việc đơn vị'
  ];
  const ws = XLSX.utils.aoa_to_sheet([
    [`MẪU NHẬP PHIẾU CÔNG VIỆC CHUẨN A2_CONGVIEC — ${unitNameVi} (${unitCode})`],
    ['Lưu ý: Cột Mã công việc có thể để trống để hệ thống tự cấp. Cột Email cán bộ bắt buộc khớp tài khoản thuộc đơn vị.'],
    headers,
    sampleRow
  ]);
  ws['!cols'] = [
    { wch: 20 }, { wch: 18 }, { wch: 16 }, { wch: 42 }, { wch: 28 }, { wch: 14 },
    { wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 24 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '2. A2_CongViec');
  const fileName = `Mau_Phieu_A2_${unitCode}_HCMUTE.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
}
