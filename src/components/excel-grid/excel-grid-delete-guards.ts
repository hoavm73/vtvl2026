import { ExcelSheetKey, GenericGridRow } from './excel-grid-types';

export interface DeleteGuardResult {
  canDelete: boolean;
  message?: string;
}

/**
 * Kiểm tra ràng buộc phụ thuộc khi xóa dòng dữ liệu:
 * 1. Ràng buộc thời gian: Xóa dữ liệu năm sau trước khi xóa dữ liệu năm trước (2027..2031).
 * 2. Ràng buộc biểu nguồn - biểu đích: Xóa dữ liệu ở biểu sau trước khi xóa biểu trước.
 */
export function validateRowDeletion(
  workbookData: Record<string, GenericGridRow[]>,
  sheetKey: ExcelSheetKey,
  rowIdOrIds: string | string[]
): DeleteGuardResult {
  const ids = Array.isArray(rowIdOrIds) ? rowIdOrIds : [rowIdOrIds];
  if (ids.length === 0) return { canDelete: true };
  const deleteSet = new Set(ids);
  const currentRows = workbookData[sheetKey] || [];

  for (const id of ids) {
    const targetRow = currentRows.find((r) => r.id === id);
    if (!targetRow) continue;

    // 1. Kiểm tra thứ tự năm tại Biểu 11. D2_PhuongAn
    if (sheetKey === 'D2') {
      const vCode = String(targetRow.maVtvl || '').trim();
      const year = Number(targetRow.nam);
      if (vCode && !isNaN(year)) {
        const laterRows = currentRows.filter(
          (r) => String(r.maVtvl || '').trim() === vCode && Number(r.nam) > year && !deleteSet.has(r.id)
        );
        if (laterRows.length > 0) {
          const laterYears = laterRows.map((r) => r.nam).sort();
          return {
            canDelete: false,
            message: `Không thể xóa phương án năm ${year} của vị trí [${vCode}].\n\nDữ liệu năm ${year} làm ảnh hưởng đến phương án các năm sau (${laterYears.join(', ')}).\nVui lòng xóa dữ liệu năm sau trước khi xóa dữ liệu năm trước!`
          };
        }
      }
    }

    // 2. Kiểm tra thứ tự năm và liên kết tại Biểu 10. DU_BAO_5_NAM
    if (sheetKey === 'DU_BAO') {
      const vCode = String(targetRow.maVtvl || '').trim();
      const year = Number(targetRow.nam);
      if (vCode && !isNaN(year)) {
        const laterRows = currentRows.filter(
          (r) => String(r.maVtvl || '').trim() === vCode && Number(r.nam) > year && !deleteSet.has(r.id)
        );
        if (laterRows.length > 0) {
          const laterYears = laterRows.map((r) => r.nam).sort();
          return {
            canDelete: false,
            message: `Không thể xóa dự báo năm ${year} của vị trí [${vCode}].\n\nDữ liệu năm ${year} làm ảnh hưởng đến dự báo các năm sau (${laterYears.join(', ')}).\nVui lòng xóa dữ liệu năm sau trước khi xóa dữ liệu năm trước!`
          };
        }

        // Kiểm tra biểu sau: 11. D2_PhuongAn
        const linkedD2 = (workbookData.D2 || []).filter(
          (d) => String(d.maVtvl || '').trim() === vCode && Number(d.nam) === year
        );
        if (linkedD2.length > 0) {
          return {
            canDelete: false,
            message: `Dự báo năm ${year} của vị trí [${vCode}] đang được liên kết làm căn cứ cho Biểu 11. D2_PhuongAn.\n\nVui lòng xóa dữ liệu phương án tại Biểu D2 trước khi xóa dữ liệu dự báo năm trước!`
          };
        }
      }
    }

    // 3. Kiểm tra Biểu 1. A1_NhiemVu -> 2. A2_CongViec
    if (sheetKey === 'A1') {
      const missionCode = String(targetRow.maNhiemVu || '').trim().toUpperCase();
      if (missionCode) {
        const linkedA2 = (workbookData.A2 || []).filter(
          (t) => String(t.maNhiemVu || '').trim().toUpperCase() === missionCode
        );
        if (linkedA2.length > 0) {
          return {
            canDelete: false,
            message: `Nhiệm vụ [${missionCode}] đang có ${linkedA2.length} công việc liên kết tại Biểu 2. A2_CongViec.\n\nVui lòng xóa dữ liệu công việc ở biểu sau trước khi xóa nhiệm vụ năm trước!`
          };
        }
      }
    }

    // 4. Kiểm tra Biểu 2. A2_CongViec -> 4. B1 & 5. B2_CT
    if (sheetKey === 'A2') {
      const taskCode = String(targetRow.maCongViec || '').trim();
      if (taskCode) {
        const b1Item = (workbookData.B1 || []).find(
          (b) => String(b.maCongViec || '').trim() === taskCode && Number(b.gioTong) > 0
        );
        const b2CtItem = (workbookData.B2_CT || []).find(
          (c) => String(c.maCongViec || '').trim() === taskCode
        );
        if (b1Item || b2CtItem) {
          const detail = b1Item ? 'Biểu 4. B1_KhoiLuong' : 'Biểu 5. B2_CT_TacDong';
          return {
            canDelete: false,
            message: `Công việc [${taskCode}] đang có số liệu thực hiện tại ${detail}.\n\nVui lòng xóa dữ liệu ở biểu sau trước khi xóa công việc!`
          };
        }
      }
    }

    // 5. Kiểm tra Biểu 3. C1_VTVL -> D1, DU_BAO, D2
    if (sheetKey === 'C1') {
      const vCode = String(targetRow.maVtvl || '').trim().toUpperCase();
      if (vCode) {
        const linkedD1 = (workbookData.D1 || []).filter((d) => String(d.maVtvl || '').trim().toUpperCase() === vCode);
        const linkedDuBao = (workbookData.DU_BAO || []).filter((db) => String(db.maVtvl || '').trim().toUpperCase() === vCode);
        const linkedD2 = (workbookData.D2 || []).filter((d) => String(d.maVtvl || '').trim().toUpperCase() === vCode);
        const linkedSheets: string[] = [];
        if (linkedD1.length > 0) linkedSheets.push('9. D1_NhanLuc');
        if (linkedDuBao.length > 0) linkedSheets.push('10. DU_BAO_5_NAM');
        if (linkedD2.length > 0) linkedSheets.push('11. D2_PhuongAn');

        if (linkedSheets.length > 0) {
          return {
            canDelete: false,
            message: `Vị trí việc làm [${vCode}] đang có dữ liệu liên kết tại các biểu sau: ${linkedSheets.join(', ')}.\n\nVui lòng xóa dữ liệu ở các biểu sau trước khi xóa danh mục VTVL gốc!`
          };
        }
      }
    }
  }

  return { canDelete: true };
}

