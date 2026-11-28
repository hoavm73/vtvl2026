#!/usr/bin/env node
/**
 * Chuyển đổi tệp Excel kê khai công việc cá nhân sang mẫu chuẩn 14 cột `2. A2_CongViec`
 * Giữ nguyên văn 100% nội dung chữ & số; chỉ gắn tiền tố `<UNIT>.` cho Mã VTVL & Mã VTVL phối hợp.
 */
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

function parseArgs(argv) {
  const opts = { src: '', unit: '', unitName: '', email: '', out: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--unit') opts.unit = (argv[++i] || '').trim().toUpperCase();
    else if (a === '--unitName') opts.unitName = (argv[++i] || '').trim();
    else if (a === '--email') opts.email = (argv[++i] || '').trim().toLowerCase();
    else if (a === '--out') opts.out = (argv[++i] || '').trim();
    else if (!opts.src) opts.src = a;
  }
  return opts;
}

function normKey(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slugAscii(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function lookupEmailByName(displayName) {
  const target = normKey(displayName);
  if (!target) return '';
  const root = process.cwd();
  const accJson = path.join(root, '.data', 'server_accounts.json');
  if (fs.existsSync(accJson)) {
    try {
      const list = JSON.parse(fs.readFileSync(accJson, 'utf8'));
      const found = (Array.isArray(list) ? list : []).find((a) => normKey(a.displayName) === target && a.email);
      if (found) return String(found.email).trim().toLowerCase();
    } catch { /* ignore */ }
  }
  for (const xlsName of ['v2DS phan quyen (1).xls', 'DS phan quyen.xls']) {
    const p = path.join(root, xlsName);
    if (!fs.existsSync(p)) continue;
    try {
      const wb = XLSX.readFile(p);
      for (const sh of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sh], { header: 1, defval: '' });
        for (const r of rows) {
          const emailCell = r.find((c) => /@hcmute\.edu\.vn$/i.test(String(c || '').trim()));
          if (emailCell && r.some((c) => normKey(c) === target)) {
            return String(emailCell).trim().toLowerCase();
          }
        }
      }
    } catch { /* ignore */ }
  }
  return '';
}

function detectHeader(matrix) {
  for (let r = 0; r < Math.min(matrix.length, 15); r++) {
    const row = matrix[r] || [];
    const col = {};
    row.forEach((cell, c) => {
      const h = normKey(cell);
      if (!h) return;
      if (col.maNv === undefined && (h.includes('ma nhiem vu') || h === 'ma nv')) col.maNv = c;
      else if (col.phoiHop === undefined && h.includes('phoi hop')) col.phoiHop = c;
      else if (col.maVtvl === undefined && (h.includes('ma vtvl') || h.includes('vi tri viec lam'))) col.maVtvl = c;
      else if (col.tenCv === undefined && (h.includes('ten cong viec') || h === 'cong viec')) col.tenCv = c;
      else if (col.sanPham === undefined && h.includes('san pham')) col.sanPham = c;
      else if (col.dvt === undefined && (h.includes('don vi tinh') || h === 'dvt')) col.dvt = c;
      else if (col.chatLuong === undefined && (h.includes('chat luong') || h.includes('tieu chuan'))) col.chatLuong = c;
      else if (col.canCu === undefined && h.includes('can cu')) col.canCu = c;
      else if (col.soSp === undefined && (h.includes('so sp') || h.includes('san luong'))) col.soSp = c;
      else if (col.nguon === undefined && h.includes('nguon')) col.nguon = c;
      else if (col.phut === undefined && (h.includes('phut') || h.includes('thoi gian thuc te'))) col.phut = c;
      else if (col.gioBs === undefined && h.includes('gio bo sung')) col.gioBs = c;
      else if (col.owner === undefined && (h.includes('email') || h.includes('nguoi lap') || h.includes('can bo'))) col.owner = c;
    });
    if (col.maNv !== undefined && col.tenCv !== undefined) return { headerIdx: r, col };
  }
  return null;
}

function extractOwnerFromTop(matrix) {
  for (let r = 0; r < Math.min(matrix.length, 5); r++) {
    const row = matrix[r] || [];
    for (let c = 0; c < row.length - 1; c++) {
      if (normKey(row[c]).includes('ho ten nguoi ke khai')) {
        return String(row[c + 1] || '').trim();
      }
    }
  }
  return '';
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.src) {
  console.error('Cách dùng: node convert-personal-a2.mjs <file_nguon.xlsx> --unit <MA_DV> [--email <email>] [--out <file_dich.xlsx>]');
  process.exit(1);
}

const srcWb = XLSX.readFile(opts.src);
const sheetName = srcWb.SheetNames.find((n) => /ke_khai|a2/i.test(n)) || srcWb.SheetNames[0];
const matrix = XLSX.utils.sheet_to_json(srcWb.Sheets[sheetName], { header: 1, defval: '' });
const detected = detectHeader(matrix);
if (!detected) {
  console.error(`Không tìm thấy dòng tiêu đề hợp lệ trong sheet "${sheetName}".`);
  process.exit(1);
}

const { headerIdx, col } = detected;
const topOwnerName = extractOwnerFromTop(matrix);
const resolvedEmail = opts.email || lookupEmailByName(topOwnerName) || topOwnerName;

// Suy ra mã đơn vị nếu chưa truyền --unit
let unitCode = opts.unit;
if (!unitCode) {
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const m = String(matrix[r]?.[col.maNv] || '').trim().match(/^([A-Z0-9]+)\.NV\d+/i);
    if (m) { unitCode = m[1].toUpperCase(); break; }
  }
}

const extractMissionCode = (val) => {
  const clean = String(val || '').trim();
  const m = clean.match(/^([A-Z0-9]+\.NV\d+)/i);
  return m ? m[1].toUpperCase() : clean.split(/\s*[—–-]\s*/)[0].trim().toUpperCase();
};
const prefixUnit = (code) => {
  const head = String(code || '').trim().split(/\s*[—–]\s*/)[0].trim();
  const m = head.match(/^([A-Z0-9]+(?:\.[A-Z0-9_-]+)?)/i);
  const clean = (m ? m[1] : head).toUpperCase();
  if (!clean || !unitCode) return clean;
  return clean.includes('.') ? clean : `${unitCode}.${clean}`;
};
const prefixList = (val) =>
  String(val || '')
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(prefixUnit)
    .filter((v, idx, arr) => v && arr.indexOf(v) === idx)
    .join(', ');

const headers = [
  'Mã công việc ([NV].CVxx)', 'Mã nhiệm vụ (A1)', 'Mã VTVL (từ C1)', 'Tên công việc cụ thể',
  'Sản phẩm đầu ra', 'Đơn vị tính', 'Yêu cầu chất lượng', 'Căn cứ (nguồn tài liệu)',
  'Mã VTVL phối hợp', 'Email cán bộ (@hcmute.edu.vn)', 'Số SP/năm', 'Phút/SP', 'Giờ bổ sung', 'Nguồn số liệu'
];

const mapped = [];
let totalHours = 0;

for (let r = headerIdx + 1; r < matrix.length; r++) {
  const row = matrix[r] || [];
  const maNv = row[col.maNv];
  const tenCv = row[col.tenCv];
  if (!String(maNv || '').trim() || !String(tenCv || '').trim()) continue;
  if (!/^[A-Z0-9]+\.NV\d+/i.test(String(maNv).trim())) continue;

  const soSp = col.soSp !== undefined ? row[col.soSp] : '';
  const phut = col.phut !== undefined ? row[col.phut] : '';
  const gioBs = col.gioBs !== undefined ? row[col.gioBs] : 0;
  totalHours += ((Number(soSp) || 0) * (Number(phut) || 0)) / 60 + (Number(gioBs) || 0);

  const rowOwner = col.owner !== undefined && String(row[col.owner] || '').trim()
    ? String(row[col.owner]).trim()
    : resolvedEmail;

  mapped.push([
    '',
    extractMissionCode(maNv),
    col.maVtvl !== undefined ? prefixUnit(row[col.maVtvl]) : '',
    tenCv,
    col.sanPham !== undefined ? row[col.sanPham] : '',
    col.dvt !== undefined ? row[col.dvt] : '',
    col.chatLuong !== undefined ? row[col.chatLuong] : '',
    col.canCu !== undefined ? row[col.canCu] : '',
    col.phoiHop !== undefined ? prefixList(row[col.phoiHop]) : '',
    rowOwner,
    soSp,
    phut,
    gioBs,
    col.nguon !== undefined ? row[col.nguon] : ''
  ]);
}

const outDir = opts.out ? path.dirname(opts.out) : path.join(path.dirname(opts.src), 'Mẫu phiếu final');
fs.mkdirSync(outDir, { recursive: true });
const ownerSlug = slugAscii(topOwnerName || path.basename(opts.src, path.extname(opts.src)));
const outPath = opts.out || path.join(outDir, `Mau_Phieu_A2_${unitCode || 'HCMUTE'}_${ownerSlug}_READY.xlsx`);

const titleLine = `MẪU NHẬP PHIẾU CÔNG VIỆC CHUẨN A2_CONGVIEC — ${opts.unitName || unitCode || 'HCM-UTE'}${opts.unitName && unitCode ? ` (${unitCode})` : ''}`;
const outWs = XLSX.utils.aoa_to_sheet([
  [titleLine],
  ['Lưu ý: Cột Mã công việc có thể để trống để hệ thống tự cấp. Cột Email cán bộ bắt buộc khớp tài khoản thuộc đơn vị.'],
  headers,
  ...mapped
]);
outWs['!cols'] = [
  { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 46 }, { wch: 28 }, { wch: 14 },
  { wch: 32 }, { wch: 30 }, { wch: 24 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 30 }
];
const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, outWs, '2. A2_CongViec');
XLSX.writeFile(outWb, outPath);

console.log(`✓ Xuất thành công: ${outPath}`);
console.log(`  Đơn vị: ${unitCode || '(chưa xác định)'} | Cán bộ: ${topOwnerName || '(từ cột nguồn)'} | Email: ${resolvedEmail}`);
console.log(`  Số dòng: ${mapped.length} | Tổng quỹ giờ: ${totalHours.toFixed(2)} giờ/năm`);
