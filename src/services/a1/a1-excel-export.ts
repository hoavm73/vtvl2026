import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { GenericGridRow } from '@/components/excel-grid/excel-grid-types';
import { A1_DEFAULT_PERIOD, A1_HEADERS, A1_SHEET_NAME, A1_STATUS_OPTIONS, trimA1Value } from './a1-validation';

function escapeXmlText(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const A1_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11"/><color rgb="FF004776"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="12"/><color rgb="FF004776"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFED1C24"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FF004776"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9ECFA"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEBF6FF"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;

function applyCellStyle(xml: string, ref: string, styleIdx: number): string {
  const rx = new RegExp(`<c r="${ref}"([^>]*)>`);
  return xml.replace(rx, (_match, attrs: string) => {
    const cleaned = attrs.replace(/\s+s="\d+"/, '');
    return `<c r="${ref}" s="${styleIdx}"${cleaned}>`;
  });
}

/**
 * Tạo tệp Excel Biểu A1 chuẩn HD07 (1. A1_NhiemVu) có:
 * - AutoFilter 7 cột A–G
 * - Data Validation danh sách chọn 4 trạng thái tại cột F (F3:F500)
 * - Nền xanh dương nhẹ cho cột F (Trạng thái) và ghi chú chữ đỏ nổi bật ở dòng 1
 */
export async function buildA1ExcelBuffer(params: {
  unitCode: string;
  unitNameVi: string;
  rows?: GenericGridRow[];
  mode: 'template' | 'export';
}): Promise<Uint8Array> {
  const rows = params.mode === 'export' && Array.isArray(params.rows) ? params.rows : [];
  const templateBlankRows: (string | number)[][] =
    params.mode === 'template'
      ? Array.from({ length: 20 }, () => ['', '', params.unitNameVi || '', '', A1_DEFAULT_PERIOD, '', ''])
      : [];
  const aoa: (string | number)[][] = [
    [
      `Biểu A1_ Nhiệm vụ (${params.unitCode} — ${params.unitNameVi})`,
      'LƯU Ý: Nhập từ dòng 3. Cột A (Mã nhiệm vụ) ĐỂ TRỐNG khi thêm mới — hệ thống tự cấp mã.',
      '',
      '',
      '',
      '▼ CHỌN DROPDOWN (4 trạng thái chuẩn)',
      ''
    ],
    [...A1_HEADERS],
    ...templateBlankRows,
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
    { wch: 22 },
    { wch: 52 },
    { wch: 30 },
    { wch: 34 },
    { wch: 22 },
    { wch: 28 },
    { wch: 32 }
  ];
  const lastFilterRow = Math.max(500, rows.length + 2);
  ws['!autofilter'] = { ref: `A2:G${lastFilterRow}` };
  XLSX.utils.book_append_sheet(wb, ws, A1_SHEET_NAME);

  const rawBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const zip = await JSZip.loadAsync(rawBuf);
  zip.file('xl/styles.xml', A1_STYLES_XML);

  const sheetFile = zip.file('xl/worksheets/sheet1.xml');
  if (sheetFile) {
    let xml = await sheetFile.async('string');

    // Tô nền xanh dương nhẹ toàn cột F (Trạng thái)
    xml = xml.replace(
      /<col min="6" max="6"([^>]*)\/>/,
      '<col min="6" max="6"$1 style="5"/>'
    );

    // Định dạng dòng 1 (tiêu đề + ghi chú chữ đỏ nổi bật) và dòng 2 (tiêu đề 7 cột)
    xml = applyCellStyle(xml, 'A1', 1);
    xml = applyCellStyle(xml, 'B1', 2);
    xml = applyCellStyle(xml, 'F1', 2);
    for (const col of ['A', 'B', 'C', 'D', 'E', 'G']) {
      xml = applyCellStyle(xml, `${col}2`, 3);
    }
    xml = applyCellStyle(xml, 'F2', 4);
    for (let r = 3; r <= Math.max(rows.length, templateBlankRows.length) + 2; r += 1) {
      xml = applyCellStyle(xml, `F${r}`, 5);
    }

    const listFormula = escapeXmlText(`"${A1_STATUS_OPTIONS.join(',')}"`);
    const dvXml =
      `<dataValidations count="1">` +
      `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" ` +
      `promptTitle="Chọn Trạng thái" ` +
      `prompt="Bấm mũi tên thả xuống để chọn đúng 1 trong 4 trạng thái chuẩn." ` +
      `errorTitle="Trạng thái không hợp lệ" ` +
      `error="Vui lòng chọn đúng 1 trong 4 trạng thái chuẩn của Biểu A1." ` +
      `sqref="F3:F${lastFilterRow}">` +
      `<formula1>${listFormula}</formula1>` +
      `</dataValidation></dataValidations>`;

    if (!xml.includes('<autoFilter')) {
      xml = xml.replace('</sheetData>', `</sheetData><autoFilter ref="A2:G${lastFilterRow}"/>`);
    }
    if (!xml.includes('<dataValidations')) {
      const autoFilterMatch = xml.match(/<autoFilter[^>]*\/>/);
      if (autoFilterMatch) {
        xml = xml.replace(autoFilterMatch[0], `${autoFilterMatch[0]}${dvXml}`);
      } else {
        xml = xml.replace('</sheetData>', `</sheetData>${dvXml}`);
      }
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
