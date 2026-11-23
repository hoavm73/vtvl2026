import { GenericGridRow } from './excel-grid-types';
import { getNextMissionCode } from './excel-grid-code-helpers';
import { A1_DEFAULT_PERIOD } from '@/services/a1/a1-validation';

/**
 * Định nghĩa cấu trúc hàng mới khi người dùng bấm "Thêm dòng mới" ở từng biểu.
 * Không điền sẵn văn bản mẫu hay chọn sẵn dropdown — để trống để hiển thị "Nhập nội dung" / "Chọn".
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
        coQuan: currentUnit.nameVi || '',
        canCu: '',
        ky: A1_DEFAULT_PERIOD,
        trangThai: '',
        nguon: ''
      }
    };
  }

  if (sheetKey === 'A2') {
    return {
      newRow: {
        id: newId,
        maCongViec: '',
        maNhiemVu: '',
        maVtvl: '',
        tenCongViec: '',
        sanPham: '',
        dvt: '',
        chatLuong: '',
        canCu: '',
        maVtvlPhoiHop: '',
        trangThaiPhieu: ''
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
        gioBoSung: '',
        gioSp: 0,
        gioTong: 0,
        nguon: '',
        ppThucTe: '',
        phutApDung: 0,
        canhBao: 'CHƯA ĐẠT',
        giaiTrinhKhacChuan: '',
        trangThaiPhieu: ''
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
        trangThai: '',
        doiChieuTrung: ''
      }
    };
  }

  if (sheetKey === 'C1') {
    return {
      newRow: {
        id: newId,
        maVtvl: '',
        tenVtvl: '',
        nhomVtvl4: '',
        maNgach: '',
        loaiNhanLuc: '',
        quyetDinh: '',
        gioChuanPp2: 1904,
        canCuQuyGio: '',
        trangThai: '',
        gioRieng: '',
        xacNhanGioRieng: '',
        cheDoLamViec: '',
        kiemTra: 'ĐẠT'
      }
    };
  }

  if (sheetKey === 'C2') {
    return {
      newRow: {
        id: newId,
        maVtvl: '',
        trachNhiem: '',
        nangLucChung: '',
        chuyenMon: '',
        lanhDao: '',
        canCu: '',
        nguonBanMoTa: ''
      }
    };
  }

  if (sheetKey === 'D1') {
    return {
      newRow: {
        id: newId,
        maNguonLuc: '',
        maVtvl: '',
        loaiNhanLuc: '',
        gioQuyDoiNam: '',
        gioChoVtvl: '',
        gioViecKhac: '',
        noiTinhBc: '',
        nguon: '',
        trangThai: '',
        canhBao: '',
        gioRieng: ''
      }
    };
  }

  if (sheetKey === 'DU_BAO') {
    return {
      newRow: {
        id: newId,
        maVtvl: '',
        nam: '',
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
        nam: '',
        soNguoiCanBoTri: '',
        soNguoiCoTheBoTri: '',
        bienCheGiao: '',
        deNghiDieuChinh: '',
        nguonGiaiTrinh: '',
        canhBao: 'THIẾU BIẾN ĐỘNG (NHẬP 0 NẾU KHÔNG ĐỔI)',
        trangThai: ''
      }
    };
  }

  return { newRow: { id: newId } };
}

