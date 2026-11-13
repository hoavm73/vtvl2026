import { GenericGridRow } from './excel-grid-types';
import { getNextMissionCode, getNextTaskCode } from './excel-grid-code-helpers';

/**
 * Định nghĩa cấu trúc hàng mới khi người dùng bấm "Thêm dòng mới" ở từng biểu
 */
export function buildNewGridRow(
  sheetKey: string,
  prevData: Record<string, GenericGridRow[]>,
  currentUnit: { code: string; nameVi: string }
): { newRow: GenericGridRow; extraC2Row?: GenericGridRow } {
  const sheetRows = prevData[sheetKey] || [];
  const newId = `${sheetKey.toLowerCase()}-${Date.now().toString(36)}`;

  if (sheetKey === 'A1') {
    const nextCode = getNextMissionCode(sheetRows, currentUnit.code);
    return {
      newRow: {
        id: newId,
        maNhiemVu: nextCode,
        tenNhiemVu: '',
        coQuan: currentUnit.nameVi,
        canCu: '',
        ky: '01/10/2025–30/9/2026',
        trangThai: 'Tiếp tục thực hiện',
        nguon: ''
      }
    };
  }

  if (sheetKey === 'A2') {
    const existingA2 = prevData.A2 || [];
    const lastRow = existingA2[existingA2.length - 1];
    const targetMission =
      (lastRow?.maNhiemVu as string) ||
      (prevData.A1 && (prevData.A1[0]?.maNhiemVu as string)) ||
      `${currentUnit.code}.NV01`;
    const nextTaskCode = getNextTaskCode(existingA2, targetMission);
    return {
      newRow: {
        id: newId,
        maCongViec: nextTaskCode,
        maNhiemVu: targetMission,
        maVtvl: '',
        tenCongViec: '',
        sanPham: '',
        dvt: '',
        chatLuong: '',
        canCu: ''
      }
    };
  }

  if (sheetKey === 'B1') {
    return {
      newRow: {
        id: newId,
        maCongViec: '',
        maVtvl: '',
        soSpNam: '',
        phutThucTe: '',
        gioBoSung: 0,
        gioSp: 0,
        gioTong: 0,
        nguon: '',
        ppThucTe: '',
        phutApDung: 0,
        canhBao: 'CHƯA ĐẠT'
      }
    };
  }

  if (sheetKey === 'B2_CT') {
    return {
      newRow: {
        id: newId,
        maCongViec: '',
        maVtvl: '',
        congDoan: '',
        loaiTacDong: '',
        mucDo: '',
        gioBienDong: '',
        vanBan: ''
      }
    };
  }

  if (sheetKey === 'B2') {
    return {
      newRow: {
        id: newId,
        maCongViec: '',
        maVtvl: '',
        gioB1: '',
        gioGiam: '',
        gioMoi: '',
        gioSauTacDong: '',
        tyLeThayDoi: '',
        trangThai: 'Đã kiểm chứng',
        doiChieuTrung: 'Đã đối chiếu'
      }
    };
  }

  if (sheetKey === 'C1') {
    return {
      newRow: {
        id: newId,
        maVtvl: '',
        tenVtvl: '',
        loaiNhanLuc: '',
        quyetDinh: '',
        gioChuanPp2: 1904,
        canCuQuyGio: 'Mức chung 1.904 giờ – quy định về thời giờ làm việc',
        trangThai: 'Tiếp tục sử dụng',
        gioRieng: '',
        xacNhanGioRieng: 'Không',
        cheDoLamViec: 'Phổ biến (40 giờ/tuần)',
        kiemTra: 'ĐẠT'
      }
    };
  }

  if (sheetKey === 'DU_BAO') {
    return {
      newRow: {
        id: newId,
        maVtvl: '',
        nam: '2027',
        bienDong: '',
        noiDungThayDoi: '',
        canCuNguon: '',
        nguoiC3: '',
        nguoiCanBoTriNam: '',
        kiemTra: 'THIẾU BIẾN ĐỘNG (NHẬP 0 NẾU KHÔNG ĐỔI)'
      }
    };
  }

  if (sheetKey === 'D2') {
    return {
      newRow: {
        id: newId,
        maVtvl: '',
        nam: '2027',
        soNguoiCanBoTri: '',
        soNguoiCoTheBoTri: '',
        bienCheGiao: '',
        deNghiDieuChinh: '',
        nguonGiaiTrinh: '',
        canhBao: 'THIẾU BIẾN ĐỘNG (NHẬP 0 NẾU KHÔNG ĐỔI)',
        trangThai: 'Đang xây dựng'
      }
    };
  }

  return { newRow: { id: newId } };
}
