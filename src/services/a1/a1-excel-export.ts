import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { A1_HEADERS, A1_SHEET_NAME, A1_STATUS_OPTIONS, trimA1Value } from './a1-validation';

function escapeXmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Tạo tệp Excel Biểu A1 chuẩn HD07 (1. A1_NhiemVu) có AutoFilter trên 7 cột A–G
 * và Data Validation danh sách chọn 4 trạng thái tại cột F (F3:F500).
 */
export async function buildA1ExcelBuffer(params: {
  unitCode: string;
  unitNameVi: string;
  rows?: GenericGridRow[];
  mode: 'template' | 'export';
}): Promise<Uint8Array> {
  const rows = params.mode === 'export' && Array.isArray(params.rows) ? params.rows : [];
  const aoa: (string | number)[][] = [
    [
      `Biểu A1_ Nhiệm vụ (${params.unitCode} — ${params.unitNameVi})`,
      '',
      '',
      '→ Nhập từ dòng 3. Mã nhiệm vụ (Cột A) để trống khi thêm mới; Trạng thái (Cột F) chọn từ danh sách.'
    ],
    [...A1_HEADERS],
    ...rows.map((r) => [
      trimA1Value(r.maNhiemVu),
      trimA1Value(r.tenNhiemVu),
      trimA1Value(r.coQuan),
      trimA1Value(r.canCu),
      trimA1Value(r.ky),
      trimA1Value(r.trangThai),
      trimA1Value(r.nguon)
    ])
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 20 },
    { wch: 52 },
    { wch: 30 },
    { wch: 34 },
    { wch: 22 },
    { wch: 24 },
    { wch: 32 }
  ];
  const lastFilterRow = Math.max(500, rows.length + 2);
  ws['!autofilter'] = { ref: `A2:G${lastFilterRow}` };
  XLSX.utils.book_append_sheet(wb, ws, A1_SHEET_NAME);

  const rawBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const zip = await JSZip.loadAsync(rawBuf);
  const sheetFile = zip.file('xl/worksheets/sheet1.xml');
  if (sheetFile) {
    let xml = await sheetFile.async('string');
    const listFormula = escapeXmlAttr(`"${A1_STATUS_OPTIONS.join(',')}"`);
    const dvXml =
      `<dataValidations count="1">` +
      `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" ` +
      `errorTitle="Trạng thái không hợp lệ" ` +
      `error="Vui lòng chọn đúng 1 trong 4 trạng thái chuẩn của Biểu A1." ` +
      `sqref="F3:F${lastFilterRow}">` +
      `<formula1>${listFormula}</formula1>` +
      `</dataValidation></dataValidations>`;

    if (!xml.includes('<autoFilter')) {
      xml = xml.replace('</sheetData>', `</sheetData><autoFilter ref="A2:G${lastFilterRow}"/>`);
    }
    if (!xml.includes('<dataValidations')) {
      xml = xml.replace('</worksheet>', `${dvXml}</worksheet>`);
    }
    zip.file('xl/worksheets/sheet1.xml', xml);
  }

  return zip.generateAsync({ type: 'uint8array' });
}

export async function downloadA1ExcelFile(params: {
  unitCode: string;
  unitNameVi: string;
  rows?: GenericGridRow[];
  mode: 'template' | 'export';
}): Promise<string> {
  const bytes = await buildA1ExcelBuffer(params);
  const compactDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName =
    params.mode === 'template'
      ? `Mau_A1_NhiemVu_${params.unitCode}.xlsx`
      : `A1_NhiemVu_${params.unitCode}_${compactDate}.xlsx`;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return fileName;
}
