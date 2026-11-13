import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export interface RegenFormsResult {
  unitCode: string;
  vtvlCount: number;
  pp2PositionCount: number;
  taskCount: number;
  fullFormFileName: string;
  fullFormBlob: Blob;
  zipFileName?: string;
  zipBlob?: Blob;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function regenerateFormsFromEditedUnitWorkbook(
  unitFile: File,
  includeZip: boolean,
  exportDate: string
): Promise<RegenFormsResult> {
  const buf = await unitFile.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  const nameMatch = /^([A-Za-z0-9-]+)_K2526/i.exec(unitFile.name);
  const unitCode = nameMatch ? nameMatch[1].toUpperCase() : unitFile.name.split('_')[0].toUpperCase();
  const compactDate = (exportDate || '2026-11-07').replace(/-/g, '');

  const c3SheetName = wb.SheetNames.find((s) => s.includes('C3'));
  const b1SheetName = wb.SheetNames.find((s) => s.includes('B1'));
  const b2CtSheetName = wb.SheetNames.find((s) => s.includes('B2_CT'));
  const d1SheetName = wb.SheetNames.find((s) => s.includes('D1'));

  if (!c3SheetName || !b1SheetName) {
    throw new Error('Tệp đơn vị tải lên thiếu Biểu 8. C3_NhuCau hoặc Biểu 4. B1_KhoiLuong.');
  }

  const c3Rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[c3SheetName], { header: 1, defval: '' });
  const b1Rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[b1SheetName], { header: 1, defval: '' });

  const methodByVtvl = new Map<string, { name: string; method: string }>();
  let pp2PositionCount = 0;

  const isC3Hd07 = String(c3Rows[1]?.[1] || '').includes('Phương pháp');
  for (let r = 2; r < c3Rows.length; r++) {
    const vCode = String(c3Rows[r][0] || '').trim();
    const vName = String((isC3Hd07 ? vCode : c3Rows[r][1]) || vCode).trim();
    const method = String((isC3Hd07 ? c3Rows[r][1] : c3Rows[r][2]) || 'PP2').trim();
    if (!vCode) continue;
    methodByVtvl.set(vCode, { name: vName, method });
    if (method.includes('PP2')) pp2PositionCount++;
  }

  // Tạo Phiếu thu số liệu đầy đủ mới từ tệp đơn vị đã sửa
  const formWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(formWb, wb.Sheets[b1SheetName], '4. B1_KhoiLuong');
  if (b2CtSheetName) XLSX.utils.book_append_sheet(formWb, wb.Sheets[b2CtSheetName], '5. B2_CT_TacDong');
  if (d1SheetName) XLSX.utils.book_append_sheet(formWb, wb.Sheets[d1SheetName], '9. D1_NhanLuc');
  if (wb.Sheets['Can_cu_goi_y']) XLSX.utils.book_append_sheet(formWb, wb.Sheets['Can_cu_goi_y'], 'Can_cu_goi_y');

  const fullFormFileName = `Phieu_Thu_So_Lieu_TaiTao_${unitCode}_K2526_${compactDate}.xlsx`;
  const fullFormOut = XLSX.write(formWb, { bookType: 'xlsx', type: 'array' });
  const fullFormBlob = new Blob([fullFormOut], { type: XLSX_MIME });

  const b1Header = b1Rows[1] || [];
  const dataRows = b1Rows.slice(2).filter((row) => String(row[0] || row[1] || '').trim() !== '');

  let zipFileName: string | undefined;
  let zipBlob: Blob | undefined;

  if (includeZip) {
    const zip = new JSZip();
    methodByVtvl.forEach((meta, vCode) => {
      const posWb = XLSX.utils.book_new();
      const posRows = dataRows.filter((r) => String(r[1] || '').trim() === vCode);
      const noteMethod = meta.method.includes('PP2')
        ? 'Vị trí tính theo PP2: có gợi ý phút/SP ở ô màu cam, cần bấm giờ/đo thực tế 3–5 lần.'
        : `Vị trí tính theo ${meta.method}: chỉ ghi số sản phẩm và nguồn số liệu kèm giải trình.`;
      const wsPosB1 = XLSX.utils.aoa_to_sheet([
        [`PHIẾU KHẢO SÁT TÁI TẠO VỊ TRÍ ${vCode} — ${meta.name} (${noteMethod})`],
        b1Header,
        ...posRows
      ]);
      XLSX.utils.book_append_sheet(posWb, wsPosB1, '4. B1_KhoiLuong');
      const posBuf = XLSX.write(posWb, { bookType: 'xlsx', type: 'array' });
      zip.file(`Phieu_ViTri_${vCode}_${compactDate}.xlsx`, posBuf);
    });
    zipFileName = `Phieu_TungViTri_TaiTao_${unitCode}_K2526_${compactDate}.zip`;
    zipBlob = await zip.generateAsync({ type: 'blob' });
  }

  return {
    unitCode,
    vtvlCount: methodByVtvl.size,
    pp2PositionCount,
    taskCount: dataRows.length,
    fullFormFileName,
    fullFormBlob,
    zipFileName,
    zipBlob
  };
}

