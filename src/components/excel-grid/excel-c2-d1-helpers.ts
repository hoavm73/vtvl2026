import { GenericGridRow } from './excel-grid-types';

/**
 * Chuẩn hóa & tự động tính toán Biểu 7. C2_NangLuc (7 cột A–G) và Biểu 9. D1_NhanLuc (11 cột A–K)
 * theo đúng chuẩn mẫu Excel HD07 (TCNS_HCMUTE_Bo_bieu_HD07.xlsx), giữ tương thích ngược với dữ liệu cũ.
 */
export function normalizeC2Rows(
  c2Rows: GenericGridRow[] | undefined,
  c1Positions: GenericGridRow[]
): GenericGridRow[] {
  if (!Array.isArray(c2Rows)) return [];
  const c1NameByCode = new Map(
    c1Positions.map((c) => [String(c.maVtvl || '').trim().toUpperCase(), String(c.tenVtvl || '')])
  );

  return c2Rows.map((r) => {
    const codeUpper = String(r.maVtvl || '').trim().toUpperCase();
    const matchedName = c1NameByCode.get(codeUpper);
    const hasHd07Fields =
      r.trachNhiem !== undefined ||
      r.nangLucChung !== undefined ||
      r.chuyenMon !== undefined ||
      r.lanhDao !== undefined ||
      r.canCu !== undefined ||
      r.nguonBanMoTa !== undefined;

    if (hasHd07Fields) {
      return {
        ...r,
        ...(matchedName ? { tenVtvl: matchedName } : {})
      };
    }

    // Tương thích ngược từ dữ liệu C2 cũ (moTaChiTiet / tenNangLuc / bacNgheNghiep)
    const legacyDetail = String(r.moTaChiTiet || '').trim();
    const legacyName = String(r.tenNangLuc || '').trim();
    const legacyLevel = String(r.bacNgheNghiep || '').trim();
    const isQl = codeUpper.includes('.QL');
    return {
      ...r,
      ...(matchedName ? { tenVtvl: matchedName } : {}),
      trachNhiem: legacyName || legacyDetail || '',
      nangLucChung: legacyDetail ? legacyDetail.split('|')[0]?.trim() || '' : '',
      chuyenMon: legacyDetail.includes('|')
        ? legacyDetail.split('|').slice(1).join('|').trim()
        : (legacyLevel || legacyDetail || ''),
      lanhDao: isQl ? 'Điều hành, phân công và giải trình trong phạm vi đơn vị' : 'Không áp dụng',
      canCu: 'Điều 8 và PL IV NĐ 232/2026/NĐ-CP; QĐ 2266/QĐ-ĐHCNKT',
      nguonBanMoTa: ''
    };
  });
}

export function normalizeD1Rows(
  d1Rows: GenericGridRow[] | undefined,
  c1Positions: GenericGridRow[],
  unitNameVi: string
): GenericGridRow[] {
  if (!Array.isArray(d1Rows)) return [];
  const c1HoursByCode = new Map(
    c1Positions.map((c) => [String(c.maVtvl || '').trim().toUpperCase(), Number(c.gioChuanPp2) || 1904])
  );

  return d1Rows.map((r) => {
    const codeUpper = String(r.maVtvl || '').trim().toUpperCase();
    const maNguonLuc = String(r.maNguonLuc ?? r.hoTen ?? '').trim();
    const loaiNhanLuc = String(
      r.loaiNhanLuc ??
      (String(r.loaiHopDong || '').includes('111') ? 'Hợp đồng lao động' : r.loaiHopDong ? 'Viên chức' : '')
    ).trim();
    const rawGioRieng = r.gioRieng;
    const hasGioRieng = rawGioRieng !== '' && rawGioRieng !== null && rawGioRieng !== undefined && Number(rawGioRieng) > 0;
    const stdHours = hasGioRieng ? Number(rawGioRieng) : (c1HoursByCode.get(codeUpper) || 1904);

    const rawChoVtvl = r.gioChoVtvl;
    const rawViecKhac = r.gioViecKhac;
    const hasAllocated = rawChoVtvl !== '' && rawChoVtvl !== null && rawChoVtvl !== undefined;
    const allocatedH = hasAllocated ? Number(rawChoVtvl) : 0;
    const otherH = rawViecKhac !== '' && rawViecKhac !== null && rawViecKhac !== undefined ? Number(rawViecKhac) : 0;
    const alert = maNguonLuc || codeUpper
      ? (allocatedH + otherH > stdHours ? 'Vượt quỹ giờ' : 'Đạt')
      : '';

    return {
      ...r,
      maNguonLuc,
      loaiNhanLuc,
      gioQuyDoiNam: codeUpper || hasGioRieng ? stdHours : '',
      gioChoVtvl: hasAllocated ? allocatedH : (r.gioChoVtvl ?? ''),
      gioViecKhac: rawViecKhac ?? '',
      noiTinhBc: r.noiTinhBc ?? (r.hoTen ? unitNameVi : ''),
      nguon: r.nguon ?? r.ghiChu ?? '',
      trangThai: r.trangThai ?? (r.hoTen ? 'Đã kiểm chứng' : ''),
      canhBao: alert,
      gioRieng: rawGioRieng ?? ''
    };
  });
}
